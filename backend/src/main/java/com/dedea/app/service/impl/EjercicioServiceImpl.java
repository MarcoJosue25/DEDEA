package com.dedea.app.service.impl;

import com.dedea.app.dto.DebilidadesResponse;
import com.dedea.app.dto.EjercicioContenidoResponse;
import com.dedea.app.dto.LatidoResponse;
import com.dedea.app.dto.EjercicioDTO;
import com.dedea.app.dto.HistorialEjercicioResponse;
import com.dedea.app.dto.IntentoResumen;
import com.dedea.app.dto.SesionCursoRequest;
import com.dedea.app.dto.SesionResponse;
import com.dedea.app.dto.TeclaEventoDTO;
import com.dedea.app.exception.ApiException;
import com.dedea.app.exception.ResourceNotFoundException;
import com.dedea.app.mapper.EntityMapper;
import com.dedea.app.model.Ejercicio;
import com.dedea.app.model.Sesion;
import com.dedea.app.model.SesionNgram;
import com.dedea.app.model.SesionProgreso;
import com.dedea.app.model.SesionTecla;
import com.dedea.app.model.SesionTeclaEvento;
import com.dedea.app.model.DictadoAudio;
import com.dedea.app.model.enums.Dificultad;
import com.dedea.app.model.enums.ModoUsado;
import com.dedea.app.model.enums.NivelCurso;
import com.dedea.app.model.enums.RolEjercicioNivel;
import com.dedea.app.model.enums.TipoEjercicio;
import com.dedea.app.repository.DiccionarioRepository;
import com.dedea.app.repository.DictadoAudioRepository;
import com.dedea.app.repository.EjercicioRepository;
import com.dedea.app.repository.SesionNgramRepository;
import com.dedea.app.repository.SesionProgresoRepository;
import com.dedea.app.repository.SesionRepository;
import com.dedea.app.repository.SesionTeclaEventoRepository;
import com.dedea.app.repository.SesionTeclaRepository;
import com.dedea.app.service.CursoStatsService;
import com.dedea.app.service.EjercicioService;
import com.dedea.app.util.ContenidoCurado;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class EjercicioServiceImpl implements EjercicioService {

    private final EjercicioRepository ejercicioRepository;
    private final DiccionarioRepository diccionarioRepository;
    private final DictadoAudioRepository dictadoAudioRepository;
    private final SesionRepository sesionRepository;
    private final SesionProgresoRepository sesionProgresoRepository;
    private final SesionTeclaRepository sesionTeclaRepository;
    private final SesionNgramRepository sesionNgramRepository;
    private final SesionTeclaEventoRepository sesionTeclaEventoRepository;
    private final EntityMapper mapper;
    private final ObjectMapper objectMapper;
    private final CursoStatsService cursoStatsService;

    private static final int PALABRAS_POR_TANDA = 30;

    /* Palabras confusas: 40 y no 30 porque acá la unidad no es la palabra sino el GRUPO
       (un par da 4 palabras, un trío 6), y con 30 entraban muy pocos grupos distintos. */
    private static final int PALABRAS_CONFUSAS_POR_TANDA = 40;

    /* Un rival más corto que esto no sirve como fantasma: la carrera termina antes de
       que el usuario levante la vista, y encima el WPM de las sesiones muy cortas viene
       inflado porque la duración se acota a un mínimo de 1 segundo. */
    private static final int SEGUNDOS_MINIMOS_RIVAL = 10;

    @Override
    public List<EjercicioDTO> listarActivos() {
        return ejercicioRepository.findByActivoTrueAndNivelIsNullOrderByOrdenAsc().stream()
                .map(e -> new EjercicioDTO(e.getId(), e.getTitulo(), e.getDescripcion(), e.getTipo().name()))
                .collect(Collectors.toList());
        //.map(): Genera un objeto por cada elemento, llamando y enviando los datos al constructor.
    }

    @Override
    public EjercicioContenidoResponse generarContenido(Integer ejercicioId, String grupo, String identificadorTemporal) {
        Ejercicio ejercicio = ejercicioRepository.findById(ejercicioId)
                .orElseThrow(() -> new ResourceNotFoundException("Ejercicio no encontrado: " + ejercicioId));
        Map<String, Object> config = new HashMap<>(parsearConfiguracion(ejercicio.getConfiguracion()));

        /* Los ejercicios de letras DEL CURSO se sirven en latidos; los mismos tipos en
           Ejercicios Base (nivel = null) siguen siendo una sola pasada, porque esa sección
           existe justamente para probar una mecánica suelta sin una progresión detrás. */
        /* LOS RECORRIDOS, UN DEDO POR TANDA. Antes `generarUnDedo` caia a `dedos.get(0)`
           cuando no llegaba un grupo, asi que el nodo servia CIEN caracteres del indice
           izquierdo y se daba por completado: los otros tres dedos de su configuracion no
           se practicaban nunca. Medido en la API antes de arreglarlo: `grupos: []` y
           `latidos: 0`.

           Con latidos, cada dedo es su propia tanda y entre una y otra aparece la ventana
           de resumen que ya existe — que es exactamente lo que el nodo prometia y no
           cumplia. No hace falta mecanica nueva: la maquinaria de latidos es generica y
           solo estaba enchufada a LETRAS_BASICO. */
        if (ejercicio.getTipo() == TipoEjercicio.UN_DEDO && ejercicio.getNivel() != null) {
            List<LatidoResponse> latidos = generarLatidosUnDedo(config);
            if (latidos != null && latidos.size() > 1) {
                return new EjercicioContenidoResponse(ejercicio.getId(), ejercicio.getTitulo(),
                        ejercicio.getTipo().name(), latidos.get(0).getTexto(), config, null, null,
                        latidos, null, cursoStatsService.umbralesDeLatidos(ejercicio));
            }
        }

        if (ejercicio.getTipo() == TipoEjercicio.LETRAS_BASICO && ejercicio.getNivel() != null) {
            List<LatidoResponse> latidos = generarLatidos(config, grupo);
            if (latidos != null && !latidos.isEmpty()) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> filas = (List<Map<String, Object>>) config.get("filas");
                /* `texto` se llena con el PRIMER latido y no con todos concatenados: es lo
                   que el usuario teclea primero, así que un cliente que no entienda los
                   latidos sigue recibiendo un ejercicio válido en vez de uno cuádruple. */
                return new EjercicioContenidoResponse(ejercicio.getId(), ejercicio.getTitulo(),
                        ejercicio.getTipo().name(), latidos.get(0).getTexto(), config, null, null,
                        latidos, teclasDelTutorial(letrasDelPaso(filas, grupo)),
                        cursoStatsService.umbralesDeLatidos(ejercicio));
            }
        }

        String texto = generarTextoParaEjercicio(ejercicio, config, grupo, identificadorTemporal);

        /* El reparto en tandas se aplica ACA y no dentro de cada generador: asi cualquier
           tipo puede usarlo poniendo `porTandas` en su configuracion, sin tocar codigo.
           Es el mismo criterio que ya rige en este archivo — parametrizar un tipo antes
           que multiplicarlos (ver CLAUDE.md 6.8). */
        /* EL TUTORIAL DE PALABRAS. Se calcula ANTES de partir en tandas: después el texto
           lleva saltos de línea y el primer ítem saldría con uno pegado.

           Es el mismo mecanismo que el tutorial de teclas de Fundamentos —mismos ítems,
           mismo componente— con palabras enteras en vez de letras sueltas. Un flag en la
           configuración y ningún tipo nuevo, como manda 6.8: cualquier ejercicio que sirva
           palabras separadas por espacio puede pedirlo.

           Los ítems son las PRIMERAS palabras del texto que se va a teclear, no otras al
           azar: el tutorial es un ensayo de lo que viene, y presentar palabras distintas lo
           convertiría en un ejercicio aparte. */
        List<String> tutorialPalabras = null;
        if (config.get("tutorialPalabras") instanceof Number n && !texto.isBlank()) {
            tutorialPalabras = Arrays.stream(texto.split(" "))
                    .filter(pal -> !pal.isBlank())
                    .limit(Math.max(1, n.intValue()))
                    .collect(Collectors.toList());
        }

        /* La leyenda por ítem, cuando el ejercicio la trae. A diferencia de tutorialPalabras
           (que sale del texto ya generado) esta va tal cual en la configuración: son
           etiquetas fijas ("Meñique izquierdo"...) que no dependen de qué tocó esta vez. */
        @SuppressWarnings("unchecked")
        List<String> captionsTutorial = config.get("captionsTutorial") instanceof List<?> lista
                ? (List<String>) lista : null;

        /* "teclasTutorial" FIJO en la configuración, para cuando lo que hay que ensayar no
           es un fragmento del texto generado. `tutorialPalabras` corta TOKENS reales del
           texto —separados por espacio—, y hay símbolos que NUNCA son un token suelto: `;`
           siempre va pegado a la palabra anterior ("corazones;"), así que cortar del texto
           jamás aislaría el signo solo. Mismo trato que captionsTutorial: viaja tal cual
           desde la configuración sembrada porque es contenido fijo. Si está presente, pisa
           a tutorialPalabras — hoy solo lo trae "El punto y coma". */
        @SuppressWarnings("unchecked")
        List<String> teclasTutorialFijas = config.get("teclasTutorial") instanceof List<?> listaTeclas
                ? (List<String>) listaTeclas : null;

        /* Solo si el generador no lo hizo ya. Los bancos de oraciones separan sus frases
           por su cuenta —una por tanda— porque son los únicos que saben dónde acaba cada
           una cuando el nivel todavía no tiene puntuación. Volver a repartir aquí
           desharía justamente eso. */
        if (Boolean.TRUE.equals(config.get("porTandas")) && !texto.contains("\n")) {
            int cuantas = config.get("tandas") instanceof Number n ? n.intValue() : TANDAS_POR_DEFECTO;
            texto = partirEnTandas(texto, cuantas);
        }

        return new EjercicioContenidoResponse(ejercicio.getId(), ejercicio.getTitulo(),
                ejercicio.getTipo().name(), texto, config, null, null,
                null, teclasTutorialFijas != null ? teclasTutorialFijas : tutorialPalabras,
                (String) config.get("mensajeTutorial"), captionsTutorial, null);
    }

    /* GET /ejercicios/{id}/ultimo-intento: el quinto latido, el que se ofrece después de
       fallar los cuatro. Va en su propia petición y no dentro de la respuesta inicial
       porque la mayoría de las veces no se usa, y mandarlo siempre significaría generar y
       enviar contenido que se descarta en la mayoría de los intentos. */
    @Override
    public LatidoResponse generarUltimoIntento(Integer ejercicioId, String grupo) {
        Ejercicio ejercicio = ejercicioRepository.findById(ejercicioId)
                .orElseThrow(() -> new ResourceNotFoundException("Ejercicio no encontrado: " + ejercicioId));
        Map<String, Object> config = new HashMap<>(parsearConfiguracion(ejercicio.getConfiguracion()));
        return generarUltimoIntento(config, grupo);
    }

    // Switch de generación, compartido entre generarContenido (normal) y
    // generarContenidoConFantasmaSimulado (mismo texto, más un ritmo fantasma inventado).
    private String generarTextoParaEjercicio(Ejercicio ejercicio, Map<String, Object> config, String grupo, String identificadorTemporal) {
        //new HashMap<>(mapaOriginal) → es un constructor de HashMap que crea un mapa nuevo, copiando dentro todas las parejas clave-valor del mapa que le pasas como argumento.
        return switch (ejercicio.getTipo()) {
            case LETRAS_BASICO -> generarLetrasBasico(config, grupo);
            case TOP_100_PALABRAS, MODO_CIEGO, PALABRAS_MUTANTES -> generarDesdeTop100();
            // Antes usaban palabras sueltas del top 100: sin concordancia gramatical.
            // Ahora usan oraciones reales, igual que ORACIONES_SIMPLES.
            case SUDDEN_DEATH -> generarUnaOracion(grupo);
            /* CONTRARRELOJ nació sirviendo oraciones, pero en Básico hace falta contra
               PALABRAS: ahí todavía no hay vocabulario para una oración. Si la
               configuración trae `fila` o `patron` se delega en el generador de palabras
               —el mismo que ya usa PALABRAS_DE_FILA— y si no, sigue con las oraciones de
               siempre. Parametrizar en vez de crear un tipo nuevo, como manda 6.8. */
            case CONTRARRELOJ -> (config.containsKey("fila") || config.containsKey("patron"))
                    ? generarPalabrasDeFila(config)
                    /* Con `banco` sirve oraciones curadas en vez de palabras del
                       diccionario. El reloj no cambia: cada palabra acertada sigue
                       sumando tiempo, y en una frase eso ocurre en cada espacio. */
                    : config.containsKey("banco")
                            ? generarOracionesTematicas(config)
                            : generarOraciones(ContenidoCurado.ORACIONES_SIMPLES);
            case PALABRAS_SIMPLES -> generarPalabrasSimples();
            case ORACIONES_SIMPLES -> generarOraciones(ContenidoCurado.ORACIONES_SIMPLES);
            case ORACIONES_MAYUSCULAS -> generarOraciones(ContenidoCurado.ORACIONES_MAYUSCULAS);
            case PALABRAS_CONFUSAS -> generarPalabrasConfusas();
            case SIMBOLOS_CRITICOS -> generarSimbolosCriticos(config, grupo);
            case MODO_UNA_MANO -> generarUnaMano(config, grupo);
            case DICTADO_VOZ -> generarDictado(config);
            case UN_DEDO -> generarUnDedo(config, grupo);
            case UNA_MANO_FORZADA -> generarUnaManoForzada(config, grupo);
            case SHIFT_LATERAL -> generarShiftLateral(config);
            case RESISTENCIA -> generarResistencia(config);
            case LLUVIA_LETRAS -> generarLluviaLetras(config, ejercicio.getNivel(), identificadorTemporal);
            case PALABRAS_DE_FILA -> generarPalabrasDeFila(config);
            case ORACIONES_TEMATICAS -> generarOracionesTematicas(config);
            case REPASO_FALLADAS -> generarRepasoFalladas(ejercicio.getNivel(), identificadorTemporal);
            /* Reusa el tipo del Área de Entrenamiento (Desestructura/PalabrasFlotantes):
               ahí lo genera GeneradorBloques, acá lo genera esto — son subsistemas
               separados, mismo TipoEjercicio pero ningún dato compartido. */
            case DESESTRUCTURA -> generarPalabrasFlotantes();
            default -> throw new ApiException(
                    "El tipo " + ejercicio.getTipo() + " todavía no tiene generación de contenido implementada.");
        };
    }

    /* Fantasma SIMULADO: a diferencia de generarContenidoConFantasma (que reproduce una
       sesión real guardada), acá se inventa un recorrido a un WPM elegido por el
       usuario — pensado para "Ejercicios Base", donde todavía no hay historial propio
       contra el que correr. El ritmo no es constante a propósito: parejo se siente a
       metrónomo, no a persona (ver generarFantasmaSimulado). */
    @Override
    public EjercicioContenidoResponse generarContenidoConFantasmaSimulado(Integer ejercicioId, Integer wpmObjetivo, String grupo) {
        if (wpmObjetivo == null || wpmObjetivo <= 0) {
            throw new ApiException("El WPM del fantasma simulado debe ser mayor a cero.");
        }
        Ejercicio ejercicio = ejercicioRepository.findById(ejercicioId)
                .orElseThrow(() -> new ResourceNotFoundException("Ejercicio no encontrado: " + ejercicioId));
        Map<String, Object> config = new HashMap<>(parsearConfiguracion(ejercicio.getConfiguracion()));
        String texto = generarTextoParaEjercicio(ejercicio, config, grupo, null);

        return new EjercicioContenidoResponse(ejercicio.getId(), ejercicio.getTitulo(), ejercicio.getTipo().name(),
                texto, config, generarFantasmaSimulado(texto, wpmObjetivo), wpmObjetivo);
    }

    /* Reparte el tiempo total esperado (según el WPM objetivo) entre cada carácter con
       peso variable en vez de partes iguales: así el fantasma acelera y frena como una
       persona real, no como un metrónomo. ~12% de las pulsaciones caen en una "pausa"
       de 2 a 4 veces el ritmo normal (duda, o el instante de corregir un error), el
       resto varía ±20% alrededor del promedio. Al final se normaliza para que la suma
       de pesos siga dando el tiempo total exacto del WPM pedido. */
    private List<TeclaEventoDTO> generarFantasmaSimulado(String texto, int wpmObjetivo) {
        int longitud = texto.length();
        double minutos = (longitud / 5.0) / wpmObjetivo;
        long tiempoTotalMs = Math.round(minutos * 60_000);

        ThreadLocalRandom random = ThreadLocalRandom.current();
        double[] pesos = new double[longitud];
        double sumaPesos = 0;
        for (int i = 0; i < longitud; i++) {
            double peso = 0.8 + random.nextDouble() * 0.4;
            if (random.nextDouble() < 0.12) {
                peso *= 2.0 + random.nextDouble() * 2.0;
            }
            pesos[i] = peso;
            sumaPesos += peso;
        }

        List<TeclaEventoDTO> eventos = new ArrayList<>(longitud);
        double acumuladoMs = 0;
        for (int i = 0; i < longitud; i++) {
            acumuladoMs += (pesos[i] / sumaPesos) * tiempoTotalMs;
            eventos.add(new TeclaEventoDTO(i + 1, Math.round(acumuladoMs), i + 1, true));
        }
        return eventos;
    }

    @Override
    public EjercicioContenidoResponse generarContenidoConFantasma(Integer ejercicioId, Integer fantasmaSesionId, String identificadorTemporal) {
        Ejercicio ejercicio = ejercicioRepository.findById(ejercicioId)
                .orElseThrow(() -> new ResourceNotFoundException("Ejercicio no encontrado: " + ejercicioId));

        // Verificación de dueño: solo puedes usar como fantasma una sesión tuya.
        Sesion sesionFantasma = sesionRepository.findByIdAndIdentificadorTemporal(fantasmaSesionId, identificadorTemporal)
                .orElseThrow(() -> new ApiException("Esa sesión no existe o no te pertenece."));

        if (sesionFantasma.getEjercicio() == null || !sesionFantasma.getEjercicio().getId().equals(ejercicioId)) {
            throw new ApiException("Esa sesión no corresponde a este ejercicio.");
        }
        if (sesionFantasma.getTextoGenerado() == null) {
            throw new ApiException("Esa sesión es de antes de modo sombra y no guardó el texto exacto.");
        }

        List<TeclaEventoDTO> eventos = sesionTeclaEventoRepository.findBySesionIdOrderByOrdenSecuenciaAsc(sesionFantasma.getId())
                .stream()
                .map(ev -> new TeclaEventoDTO(ev.getOrdenSecuencia(), ev.getTiempoDesdeInicioMs(), ev.getIndiceResultante(), ev.getCorrecta()))
                .collect(Collectors.toList());

        Map<String, Object> config = new HashMap<>(parsearConfiguracion(ejercicio.getConfiguracion()));

        return new EjercicioContenidoResponse(ejercicio.getId(), ejercicio.getTitulo(), ejercicio.getTipo().name(),
                sesionFantasma.getTextoGenerado(), config, eventos, sesionFantasma.getWpm());
    }

    @Override
    public HistorialEjercicioResponse obtenerHistorial(Integer ejercicioId, String identificadorTemporal) {
        /* Un intento entra primero a "mejores". Solo pasa a "peores" cuando lo superan
           y además queda entre los más bajos; si queda en el medio, desaparece.

           Antes eran dos consultas independientes sobre el mismo conjunto, así que se
           pisaban: con una sola sesión guardada, esa misma aparecía como el mejor Y el
           peor intento a la vez. La corrección es excluir de "peores" lo que ya está
           en "mejores". */
        Pageable top3Mejores = PageRequest.of(0, 3, Sort.by(Sort.Direction.DESC, "wpm"));
        Pageable top3Peores = PageRequest.of(0, 3, Sort.by(Sort.Direction.ASC, "wpm"));

        List<Sesion> sesionesMejores = sesionRepository
                .findByIdentificadorTemporalAndEjercicio_Id(identificadorTemporal, ejercicioId, top3Mejores);

        Set<Integer> idsMejores = sesionesMejores.stream()
                .map(Sesion::getId)
                .collect(Collectors.toSet());

        List<IntentoResumen> mejores = sesionesMejores.stream()
                .map(this::toIntentoResumen)
                .collect(Collectors.toList());

        List<IntentoResumen> peores = sesionRepository
                .findByIdentificadorTemporalAndEjercicio_Id(identificadorTemporal, ejercicioId, top3Peores)
                .stream()
                .filter(s -> !idsMejores.contains(s.getId()))
                .map(this::toIntentoResumen)
                .collect(Collectors.toList());

        return new HistorialEjercicioResponse(mejores, peores);
    }

    @Override
    public IntentoResumen buscarRivalSombra(Integer ejercicioId, String identificadorTemporal) {
        /* Sin selector de por medio: el rival es tu mejor intento válido de este mismo
           ejercicio. La consulta ya filtra los que no sirven (sin texto guardado, sin
           eventos, demasiado cortos), así que acá solo queda traducir a DTO.
           null = todavía no tienes ninguna sesión que sirva, y el front lo trata como
           "sin rival" en vez de como error. */
        return sesionRepository
                .buscarRivalParaSombra(identificadorTemporal, ejercicioId, SEGUNDOS_MINIMOS_RIVAL)
                .map(this::toIntentoResumen)
                .orElse(null);
    }

    @Override
    public EjercicioDTO obtenerSiguienteEnCurso(Integer ejercicioId) {
        Ejercicio actual = ejercicioRepository.findById(ejercicioId)
                .orElseThrow(() -> new ResourceNotFoundException("Ejercicio no encontrado: " + ejercicioId));
        if (actual.getNivel() == null) return null;

        List<Ejercicio> siguientes = ejercicioRepository
                .findTop1ByNivelAndActivoTrueAndOrdenGreaterThanOrderByOrdenAsc(actual.getNivel(), actual.getOrden());
        if (siguientes.isEmpty()) return null;

        Ejercicio siguiente = siguientes.get(0);
        return new EjercicioDTO(siguiente.getId(), siguiente.getTitulo(), siguiente.getDescripcion(), siguiente.getTipo().name());
    }

    private IntentoResumen toIntentoResumen(Sesion s) {
        return new IntentoResumen(s.getId(), s.getWpm(), s.getPrecision(), s.getSegundos(), s.getFechaGuardado());
    }

    // --- LETRAS_BASICO: pseudo-sílabas aleatorias por zona, mezcladas ---
    // configuracion: {"zonas": [["a","s","d","f","j","k","l","ñ"], [...], [...]]}
    @SuppressWarnings("unchecked")
    private static final int TOKENS_LETRAS_BASICO = 30;

    /* LETRAS_BASICO: progresión por dedos.
       configuracion: {"filas":[{"id":"central","nombre":"...","pasos":["f j","d k",...]}, ...]}

       Cada paso es una etiqueta como "fd jk"; las letras salen de quitarle los espacios.
       `grupo` llega con el formato "fila:indice" (por ejemplo "central:0"); sin él se
       genera el primer paso de la primera fila, que es el más básico.

       Los tokens llevan de 1 a 4 letras. Antes era `nextInt(2, 5)`, o sea 2 a 4, y por
       eso nunca salían tokens de una sola letra. */
    @SuppressWarnings("unchecked")
    private String generarLetrasBasico(Map<String, Object> config, String grupo) {
        List<Map<String, Object>> filas = (List<Map<String, Object>>) config.get("filas");
        if (filas == null || filas.isEmpty()) {
            throw new ApiException("El ejercicio de fundamentos no tiene filas configuradas.");
        }

        // La resolucion del paso vive en letrasDelPaso: la comparten este generador, los
        // latidos y el tutorial, y tenerla en tres sitios era garantia de que se
        // desincronizaran.
        List<String> letras = letrasDelPaso(filas, grupo).chars()
                .mapToObj(c -> String.valueOf((char) c))
                .collect(Collectors.toList());

        return generarTokensDeLetras(letras);
    }

    // Mismo armado de tokens (1 a 4 letras al azar antes de cada espacio) que usa
    // LETRAS_BASICO — lo reusa REPASO_FALLADAS con un set de letras dinámico en vez de
    // uno fijo por config.
    private String generarTokensDeLetras(List<String> letras) {
        ThreadLocalRandom random = ThreadLocalRandom.current();
        List<String> tokens = new ArrayList<>();
        for (int i = 0; i < TOKENS_LETRAS_BASICO; i++) {
            int largo = random.nextInt(1, 5); // 1 a 4 letras antes de cada espacio
            StringBuilder token = new StringBuilder();
            for (int j = 0; j < largo; j++) {
                token.append(letras.get(random.nextInt(letras.size())));
            }
            tokens.add(token.toString());
        }
        return String.join(" ", tokens);
    }

    /* ================== LATIDOS ==================

       Un ejercicio de letras del Curso no es una tanda de 110 caracteres: son varias
       tandas cortas encadenadas. El motivo está medido — una lección de TypingClub ronda
       los 31 caracteres, o sea piezas 3,5 veces más chicas que las nuestras, y por eso su
       curso da la sensación de avanzar mientras el nuestro da la de repetir.

       Los tres ejes que cambian de un latido al siguiente:
         - LARGO: 40 → 60 → 80 → 80 caracteres
         - DOMINANCIA: 95% → 90% → 85% → 80% de las teclas nuevas del nodo. El resto sale de
           `ancla` cuando el nodo la tiene (fila superior e inferior, y "g h") — nunca de
           TODO lo acumulado: mezclar "r u" con `d` o `l` no enseña nada, solo confunde. Solo
           en la fila central de reposo (sin ancla) el resto sí sale de todo lo acumulado,
           porque ahí cualquier tecla vieja es igual de segura. Ver la nota grande de
           `ancla`/`secundarias` en PASOS_FUNDAMENTOS.
         - FORMA: sílabas cortas al principio, y PALABRAS REALES en el último cuando el
           diccionario da para armarlas

       Lo de las palabras reales importa más de lo que parece. Medido contra el
       diccionario: hasta el nodo 4 no existe ninguna palabra española (f j d k s l no
       tienen vocal), en el nodo 5 aparecen 15 y en el 10 ya hay 265. Así que desde "a ñ"
       en adelante cada nodo puede cerrar con "sala salsa falsa" en vez de con una sílaba
       inventada — que es la única prueba que el usuario recibe de estar aprendiendo algo
       que sirve. */
    private record PlanLatido(String nombre, String descripcion, int caracteres,
                              int dominancia, int largoMin, int largoMax) {}

    private static final List<PlanLatido> PLAN_LATIDOS = List.of(
            new PlanLatido("Aprende", "Solo las teclas nuevas", 40, 95, 1, 2),
            new PlanLatido("Combina", "Con las que ya practicaste", 60, 90, 2, 3),
            new PlanLatido("Mezcla", "Más teclas en juego", 80, 85, 2, 4),
            new PlanLatido("Prueba", "Todo junto", 80, 80, 3, 5));

    // Teclas del tutorial: se alternan las nuevas hasta llegar a diez.
    private static final int TECLAS_TUTORIAL = 10;

    /* Con menos palabras disponibles que esto, el último latido usa solo TRES distintas y
       las repite. Es deliberado: en "a ñ" el diccionario da 15 palabras y servirlas todas
       convierte el cierre en una lista inconexa; con tres repetidas es un drill. */
    private static final int POOL_PALABRAS_ESCASO = 20;
    private static final int PALABRAS_DISTINTAS_ESCASAS = 3;

    /* Cuántos latidos tiene un nodo. "f j" es el primero de todos: no hay ninguna tecla
       anterior con la que combinar, así que su cuarto latido sería idéntico al tercero y
       se queda en tres. */
    private int cantidadDeLatidos(String acumuladas) {
        return acumuladas.isEmpty() ? 3 : PLAN_LATIDOS.size();
    }

    @SuppressWarnings("unchecked")
    private List<LatidoResponse> generarLatidos(Map<String, Object> config, String grupo) {
        List<Map<String, Object>> filas = (List<Map<String, Object>>) config.get("filas");
        if (filas == null || filas.isEmpty()) return null;

        String nuevas = letrasDelPaso(filas, grupo);
        // Las teclas vistas en nodos anteriores del nivel. Se calcula en el sembrado y se
        // guarda en la fila, así no depende del orden en tiempo de ejecución.
        String acumuladas = (String) config.getOrDefault("acumuladas", "");
        String ancla = (String) config.getOrDefault("ancla", "");
        String secundarias = (String) config.getOrDefault("secundarias", "");
        int domSecundarias = config.get("dominanciaSecundarias") instanceof Number n
                ? n.intValue() : 0;
        /* "z x" es el ÚNICO nodo con progresión propia (11-sep-2026), 80/75/70/70 en vez
           de la global 95/90/85/80: sin vocales, no forma palabras reales y no tiene
           sentido mezclarlo con nada fuera de ". -" — ni siquiera en el último latido,
           que para el resto del curso busca palabras del diccionario. Ver la nota grande
           de `ancla`/`secundarias` junto a PASOS_FUNDAMENTOS. */
        String dominanciaPropiaStr = (String) config.getOrDefault("dominanciaPropia", "");
        List<Integer> dominanciaPropia = dominanciaPropiaStr.isEmpty() ? List.of()
                : Arrays.stream(dominanciaPropiaStr.split(",")).map(Integer::parseInt).toList();

        List<LatidoResponse> latidos = new ArrayList<>();
        int cuantos = cantidadDeLatidos(acumuladas);
        for (int i = 0; i < cuantos; i++) {
            PlanLatido plan = PLAN_LATIDOS.get(i);
            if (!dominanciaPropia.isEmpty()) {
                plan = new PlanLatido(plan.nombre(), plan.descripcion(), plan.caracteres(),
                        dominanciaPropia.get(i), plan.largoMin(), plan.largoMax());
            }
            boolean esUltimo = i == cuantos - 1;
            /* El último latido SIEMPRE intenta palabras reales —salvo `z x`, ver abajo—,
               tenga o no teclas acumuladas: "asdf jklñ" no introduce ninguna letra nueva
               —así que su `acumuladas` queda vacío— y sin embargo con la fila central
               completa el diccionario ya da quince palabras. generarCierreDelNodo cae
               solo a sílabas cuando no hay ninguna. */
            /* ⚠️ REESCRITO el 11-sep-2026. Hasta hoy el PRIMER latido de los nodos con
               `ancla` tenía un generador propio (`generarTandaConAncla`, ya borrado):
               emparejaba cada tecla nueva con su reposo EN EL MISMO TOKEN —`fv fvf jm
               jmj`— así que la mitad del texto era la tecla vieja, sin importar la
               `dominancia` del plan (95% para "Aprende"). El usuario lo notó comparando
               contra la fila central: ahí "Aprende" SIEMPRE cayó acá, al generador de
               dominancia de siempre, porque esos nodos no tienen `ancla` — y por eso su
               primer latido ya se sentía "95% la tecla nueva". La fila superior tiene que
               sentirse igual: ahora los tres latidos que no son el último (Aprende, Combina,
               Mezcla) pasan TODOS por el mismo camino, con la misma regla —el "viejo" sale
               de `ancla` cuando el nodo la tiene, nunca de todo `acumuladas` (ver la nota
               grande junto a PASOS_FUNDAMENTOS)— y solo cambia el `dominancia` del plan
               (95 → 90 → 85). Los nodos de fila central sin ancla (d k, s l, a ñ) siguen
               mezclando con todo lo acumulado en los tres, que ahí siempre fue correcto. */
            String texto;
            if (!dominanciaPropia.isEmpty()) {
                // z x: el "viejo" es SOLO la secundaria (. -), nunca `acumuladas` -- y
                // corre igual en los cuatro latidos, sin la excepción de palabras reales
                // que tiene el resto del curso en el último.
                texto = generarTandaConDominancia(nuevas, secundarias, plan);
            } else if (esUltimo) {
                texto = generarCierreDelNodo(nuevas, acumuladas, plan);
            } else {
                String poolViejo = ancla.isEmpty() ? acumuladas : ancla;
                texto = generarTandaConDominancia(nuevas, poolViejo, secundarias,
                        domSecundarias, plan);
            }

            latidos.add(LatidoResponse.builder()
                    .nombre(plan.nombre())
                    .descripcion(plan.descripcion())
                    .texto(texto)
                    .dominancia(acumuladas.isEmpty() ? 100 : plan.dominancia())
                    .build());
        }
        return latidos;
    }

    /* El QUINTO latido: el último intento después de fallar los cuatro. Se juzga solo por
       precisión, sin exigencia de velocidad, así que su contenido vuelve a ser cómodo —
       la dominancia del segundo latido y un largo intermedio. Pedirle aquí el material
       más difícil sería castigar en vez de rescatar. */
    private LatidoResponse generarUltimoIntento(Map<String, Object> config, String grupo) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> filas = (List<Map<String, Object>>) config.get("filas");
        if (filas == null || filas.isEmpty()) return null;

        String nuevas = letrasDelPaso(filas, grupo);
        String acumuladas = (String) config.getOrDefault("acumuladas", "");
        PlanLatido plan = new PlanLatido("Último intento",
                "Olvídate del reloj: aquí solo cuenta acertar", 60, 90, 2, 3);

        return LatidoResponse.builder()
                .nombre(plan.nombre())
                .descripcion(plan.descripcion())
                .texto(generarTandaConDominancia(nuevas, acumuladas, plan))
                .dominancia(acumuladas.isEmpty() ? 100 : plan.dominancia())
                .ultimoIntento(true)
                .build();
    }

    /* Tokens de sílabas, respetando la proporción entre teclas nuevas y ya vistas.
       La dominancia se aplica CARÁCTER a CARÁCTER y no token a token: si se decidiera por
       token, con tokens de dos letras la proporción real solo podría ser 0%, 50% o 100% y
       el 85% pedido no existiría. */
    private String generarTandaConDominancia(String nuevas, String acumuladas, PlanLatido plan) {
        return generarTandaConDominancia(nuevas, acumuladas, "", 0, plan);
    }

    /* Con un tercer cubo: las teclas SECUNDARIAS, que entran en su propio porcentaje antes
       de repartir el resto entre nuevas y acumuladas. El reparto se hace carácter a carácter
       y no token a token por la misma razón de siempre: con tokens de dos letras la
       proporción real solo podría ser 0%, 50% o 100%, y un 10% no existiría. */
    private String generarTandaConDominancia(String nuevas, String acumuladas,
            String secundarias, int dominanciaSecundarias, PlanLatido plan) {
        ThreadLocalRandom random = ThreadLocalRandom.current();
        List<String> tokens = new ArrayList<>();
        int escritos = 0;

        while (escritos < plan.caracteres()) {
            int largo = random.nextInt(plan.largoMin(), plan.largoMax() + 1);
            StringBuilder token = new StringBuilder();
            for (int j = 0; j < largo; j++) {
                String fuente;
                if (!secundarias.isEmpty() && random.nextInt(100) < dominanciaSecundarias) {
                    fuente = secundarias;
                } else {
                    boolean deLasNuevas = acumuladas.isEmpty()
                            || random.nextInt(100) < plan.dominancia();
                    fuente = deLasNuevas ? nuevas : acumuladas;
                }
                token.append(fuente.charAt(random.nextInt(fuente.length())));
            }
            tokens.add(token.toString());
            escritos += largo + 1; // +1 por el espacio que lo separa del siguiente
        }
        return String.join(" ", tokens);
    }

    /* El cierre del nodo: palabras REALES si el diccionario alcanza, y si no, sílabas.
       Nunca inventa: si con las teclas disponibles no hay palabras españolas, cae al
       generador de sílabas en vez de servir algo que parezca una palabra y no lo sea. */
    private String generarCierreDelNodo(String nuevas, String acumuladas, PlanLatido plan) {
        String disponibles = nuevas + acumuladas;
        List<String> pool;
        try {
            pool = diccionarioRepository
                    .findPorPatronDeLetras("^[" + disponibles + "]{3,}$", 200)
                    .stream()
                    .filter(p -> !ContenidoCurado.PALABRAS_NO_ESPANOLAS.contains(p.toLowerCase()))
                    .collect(Collectors.toCollection(ArrayList::new));
        } catch (Exception e) {
            log.warn("[CURSO] No se pudo consultar el diccionario para el cierre del nodo: {}", e.getMessage());
            pool = new ArrayList<>();
        }

        if (pool.isEmpty()) return generarTandaConDominancia(nuevas, acumuladas, plan);

        Collections.shuffle(pool, ThreadLocalRandom.current());
        // Con pocas palabras se eligen TRES y se repiten: ver POOL_PALABRAS_ESCASO.
        List<String> elegidas = pool.size() < POOL_PALABRAS_ESCASO
                ? new ArrayList<>(pool.subList(0, Math.min(PALABRAS_DISTINTAS_ESCASAS, pool.size())))
                : pool;

        List<String> salida = new ArrayList<>();
        int escritos = 0;
        int i = 0;
        while (escritos < plan.caracteres()) {
            String palabra = elegidas.get(i % elegidas.size());
            salida.add(palabra);
            escritos += palabra.length() + 1;
            i++;
            // Cortafuegos: si las palabras fueran de un solo carácter no terminaría nunca.
            if (i > 200) break;
        }
        return String.join(" ", salida);
    }

    // Las diez teclas del tutorial, alternando las nuevas: para "d k" → d k d k d k d k d k.
    /* El orden del tutorial es AL AZAR, no alternado.

       Antes salia f j f j f j f j f j, y ese patron se teclea sin leerlo: a la tercera
       pareja la mano ya sabe que viene y el tutorial deja de ensenar donde esta cada
       tecla para convertirse en un redoble. Con orden aleatorio hay que MIRAR cual toca,
       que es justo el gesto que el tutorial existe para entrenar.

       Con dos topes, porque el azar puro tambien falla:
         - nunca mas de MAX_SEGUIDAS iguales, para que no salga f f f f f f
         - todas las teclas nuevas aparecen al menos una vez, para que el tutorial de
           un paso de dos teclas no pueda servir diez veces la misma. */
    private static final int MAX_SEGUIDAS_TUTORIAL = 2;

    private List<String> teclasDelTutorial(String nuevas) {
        ThreadLocalRandom random = ThreadLocalRandom.current();
        List<String> teclas = new ArrayList<>();
        int seguidas = 0;

        for (int i = 0; i < TECLAS_TUTORIAL; i++) {
            String candidata;
            int intentos = 0;
            do {
                candidata = String.valueOf(nuevas.charAt(random.nextInt(nuevas.length())));
                intentos++;
                /* El corte por intentos evita el bucle infinito cuando el paso tiene UNA
                   sola tecla nueva: ahi no hay alternativa posible y repetir es correcto. */
            } while (intentos < 10 && seguidas >= MAX_SEGUIDAS_TUTORIAL
                    && !teclas.isEmpty() && candidata.equals(teclas.get(teclas.size() - 1)));

            seguidas = (!teclas.isEmpty() && candidata.equals(teclas.get(teclas.size() - 1)))
                    ? seguidas + 1 : 1;
            teclas.add(candidata);
        }

        /* Que ninguna tecla nueva se quede fuera. Con dos teclas y diez tiradas la
           probabilidad de que una no salga es minima, pero no es cero, y el tutorial de
           un nodo que no muestra una de sus dos teclas es exactamente lo que no puede
           pasar. Se sustituyen posiciones al azar en vez de anadir al final para no
           dejar la que falta siempre en el ultimo sitio. */
        for (char c : nuevas.toCharArray()) {
            if (!teclas.contains(String.valueOf(c))) {
                teclas.set(random.nextInt(teclas.size()), String.valueOf(c));
            }
        }
        return teclas;
    }

    /* Las letras del paso pedido, sin espacios: "fd jk" → "fdjk". Se extrajo de
       generarLetrasBasico porque ahora la necesitan también los latidos y el tutorial. */
    private String letrasDelPaso(List<Map<String, Object>> filas, String grupo) {
        String filaId = null;
        int paso = 0;
        if (grupo != null && grupo.contains(":")) {
            String[] partes = grupo.split(":", 2);
            filaId = partes[0];
            try { paso = Integer.parseInt(partes[1]); } catch (NumberFormatException ignored) { paso = 0; }
        }

        final String buscado = filaId;
        Map<String, Object> fila = filas.stream()
                .filter(f -> buscado != null && buscado.equals(f.get("id")))
                .findFirst()
                .orElse(filas.get(0));

        @SuppressWarnings("unchecked")
        List<String> pasos = (List<String>) fila.get("pasos");
        if (pasos == null || pasos.isEmpty()) {
            throw new ApiException("La fila '" + fila.get("id") + "' no tiene pasos configurados.");
        }
        return pasos.get(Math.max(0, Math.min(paso, pasos.size() - 1))).replace(" ", "");
    }

    /* REPASO_FALLADAS: no tiene banco propio — reusa exactamente las mismas
       "teclasMasFalladas" que ya calcula CursoStatsService.obtenerStatsPorNivel (la
       pantalla de estadísticas del Curso), así el drill siempre coincide con lo que el
       usuario ve ahí. Sin identificador (consulta anónima) o sin suficiente historial
       todavía, cae a un set genérico de letras poco entrenadas — nunca revienta. */
    private static final List<String> LETRAS_FALLADAS_GENERICO = List.of("q", "z", "x", "w", "ñ", "k");

    private String generarRepasoFalladas(NivelCurso nivel, String identificadorTemporal) {
        return generarTokensDeLetras(letrasFalladasDe(nivel, identificadorTemporal));
    }

    /* Las teclas que este usuario mas falla en este nivel, o un set generico si todavia
       no hay historial. Extraido para que la Lluvia de repaso y REPASO_FALLADAS midan
       exactamente lo mismo: dos consultas distintas darian dos "peores teclas" distintas
       para el mismo usuario, y el que las viera juntas no entenderia por que. */
    private List<String> letrasFalladasDe(NivelCurso nivel, String identificadorTemporal) {
        if (identificadorTemporal == null || nivel == null) return LETRAS_FALLADAS_GENERICO;
        List<String> falladas = cursoStatsService.obtenerStatsPorNivel(identificadorTemporal, nivel)
                .getTeclasMasFalladas()
                .stream()
                .map(DebilidadesResponse.ItemDebilidad::getSecuencia)
                .filter(t -> t != null && t.length() == 1)
                .distinct()
                .collect(Collectors.toList());
        return falladas.isEmpty() ? LETRAS_FALLADAS_GENERICO : falladas;
    }

    /* TOP_100_PALABRAS / MODO_CIEGO / PALABRAS_MUTANTES comparten la misma fuente,
       barajada distinto en cada llamada.

       ⚠️ REESCRITO el 11-sep-2026: hasta hoy salía de `diccionarioRepository
       .findTop100PorFrecuencia()`, o sea las 100 más comunes DE ENTRE LAS PALABRAS QUE EL
       USUARIO YA APROBÓ en /revision-palabras — no las 100 más comunes del español, que es
       lo que el ejercicio promete. Ahora usa `ContenidoCurado.TOP_100_PALABRAS_ESPANOL`,
       una lista fija que no depende de qué tanda se haya revisado (ver la nota grande
       junto a esa constante). El método del repositorio quedó sin ningún otro llamador y
       se borró. */
    private String generarDesdeTop100() {
        List<String> top100 = new ArrayList<>(ContenidoCurado.TOP_100_PALABRAS_ESPANOL);
        Collections.shuffle(top100, ThreadLocalRandom.current());
        return top100.stream().limit(PALABRAS_POR_TANDA).collect(Collectors.joining(" "));
    }

    /* SUDDEN_DEATH: una sola oración (se repite en el frontend mientras fallas).
       `grupo` elige el banco por longitud: "cortas", "medias" o "largas".
       Sin grupo se usan las medias, que es el punto intermedio razonable. */
    private String generarUnaOracion(String grupo) {
        List<String> banco = switch (grupo == null ? "" : grupo) {
            case "cortas" -> ContenidoCurado.ORACIONES_CORTAS;
            case "largas" -> ContenidoCurado.ORACIONES_LARGAS;
            default -> ContenidoCurado.ORACIONES_MEDIAS;
        };
        List<String> copia = new ArrayList<>(banco);
        Collections.shuffle(copia, ThreadLocalRandom.current());
        return copia.get(0);
    }

    // PALABRAS_SIMPLES: palabras reales, cortas, SOLO con las letras base del teclado
    // (sin tildes ni ñ) — la continuación natural de "Fundamentos de teclado".
    private static final Set<Character> LETRAS_SIN_TILDE = Set.of(
            'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z');

    private String generarPalabrasSimples() {
        List<String> pool = diccionarioRepository.findTopNPorFrecuencia(500);
        List<String> simples = pool.stream()
                .filter(p -> p.length() <= 6)
                .filter(p -> p.chars().allMatch(c -> LETRAS_SIN_TILDE.contains((char) c)))
                .collect(Collectors.toList());
        if (simples.isEmpty()) {
            throw new ApiException("No hay suficientes palabras simples en el diccionario todavía.");
        }
        Collections.shuffle(simples, ThreadLocalRandom.current());
        return simples.stream().limit(PALABRAS_POR_TANDA).collect(Collectors.joining(" "));
    }

    // ORACIONES_SIMPLES / ORACIONES_MAYUSCULAS: unas pocas oraciones del set curado,
    // distintas combinaciones en cada llamada.
    private String generarOraciones(List<String> banco) {
        return generarOraciones(banco, 6);
    }

    private String generarOraciones(List<String> banco, int cuantas) {
        return generarOraciones(banco, cuantas, " ");
    }

    private String generarOraciones(List<String> banco, int cuantas, String union) {
        List<String> copia = new ArrayList<>(banco);
        Collections.shuffle(copia, ThreadLocalRandom.current());
        return String.join(union, copia.subList(0, Math.min(cuantas, copia.size())));
    }

    /* PALABRAS_CONFUSAS: cada grupo de homófonos se sirve JUNTO, no disperso.

       Antes se aplanaban todos los grupos en una sola lista y se barajaba entera, así que
       "tubo" podía salir en la posición 3 y "tuvo" en la 31. El ejercicio se llama
       "palabras que se confunden al escribir" y su valor está justamente en teclear el
       par pegado —tubo tuvo tubo tuvo— porque lo que se entrena es la diferencia entre
       dos secuencias de dedos casi idénticas. Separadas por treinta palabras son dos
       palabras cualesquiera del diccionario y el ejercicio no se distingue de "Palabras
       simples".

       Lo que se baraja ahora es el ORDEN DE LOS GRUPOS y cuál del grupo abre; adentro del
       grupo se respeta el bloque. Así la tanda sigue saliendo distinta en cada vuelta sin
       perder el contraste. */
    private String generarPalabrasConfusas() {
        List<List<String>> grupos = new ArrayList<>(ContenidoCurado.GRUPOS_PALABRAS_CONFUSAS);
        Collections.shuffle(grupos, ThreadLocalRandom.current());

        List<String> salida = new ArrayList<>();
        for (List<String> grupo : grupos) {
            if (salida.size() >= PALABRAS_CONFUSAS_POR_TANDA) break;
            List<String> copia = new ArrayList<>(grupo);
            Collections.shuffle(copia, ThreadLocalRandom.current());
            // Dos vueltas seguidas del mismo grupo: la repetición inmediata es lo que fija
            // el contraste. Un trío (haya/halla/allá) da seis palabras; un par, cuatro.
            salida.addAll(copia);
            salida.addAll(copia);
        }
        return String.join(" ", salida.subList(0, Math.min(PALABRAS_CONFUSAS_POR_TANDA, salida.size())));
    }

    // SIMBOLOS_CRITICOS: pseudo-tokens que mezclan símbolos con letras, mismo mecanismo
    /* MODO_UNA_MANO: palabras que se teclean enteras con una sola mano.
       configuracion: {"manos":[{"id":"izquierda","nombre":"...","letras":"qwertasdfgzxcvb"}, ...]}
       El reparto de letras vive en la config, así que cambiarlo no toca el código. */
    @SuppressWarnings("unchecked")
    private String generarUnaMano(Map<String, Object> config, String grupo) {
        List<Map<String, Object>> manos = (List<Map<String, Object>>) config.get("manos");
        if (manos == null || manos.isEmpty()) {
            throw new ApiException("El ejercicio de una mano no tiene manos configuradas.");
        }

        final String pedida = grupo;
        Map<String, Object> mano = manos.stream()
                .filter(m -> pedida != null && pedida.equals(m.get("id")))
                .findFirst()
                .orElse(manos.get(0));

        String letras = String.valueOf(mano.get("letras"));
        /* Se pide de más porque después se filtra y se recorta: así la tanda no sale
           siempre igual cuando la mano tiene pocas palabras (la derecha, sobre todo).
           El filtro saca el ruido del corpus (nombres ingleses y abreviaturas), que
           en un conjunto tan chico se nota muchísimo. */
        List<String> pool = diccionarioRepository
                .findPorPatronDeLetras("^[" + letras + "]+$", 400)
                .stream()
                .filter(p -> !ContenidoCurado.PALABRAS_NO_ESPANOLAS.contains(p.toLowerCase()))
                .collect(Collectors.toCollection(ArrayList::new));

        if (pool.isEmpty()) {
            throw new ApiException("No hay palabras en el diccionario para la mano '" + mano.get("id") + "'.");
        }

        return recortarTanda(pool, config);
    }

    /* UN_DEDO: progresión por dedo específico de la mecanografía al tacto estándar (no
       por fila, como LETRAS_BASICO, ni por mano entera, como MODO_UNA_MANO). Mismo
       generador de pseudo-tokens de 1 a 4 letras que ya usa LETRAS_BASICO.
       configuracion: {"dedos":[{"id":"indice_izq","nombre":"...","letras":"rfvtgb"}, ...]} */
    @SuppressWarnings("unchecked")
    private String generarUnDedo(Map<String, Object> config, String grupo) {
        List<Map<String, Object>> dedos = (List<Map<String, Object>>) config.get("dedos");
        if (dedos == null || dedos.isEmpty()) {
            throw new ApiException("El ejercicio de un dedo no tiene dedos configurados.");
        }

        final String pedido = grupo;
        Map<String, Object> dedo = dedos.stream()
                .filter(d -> pedido != null && pedido.equals(d.get("id")))
                .findFirst()
                .orElse(dedos.get(0));

        List<String> letras = String.valueOf(dedo.get("letras")).chars()
                .mapToObj(c -> String.valueOf((char) c))
                .collect(Collectors.toList());

        ThreadLocalRandom random = ThreadLocalRandom.current();
        List<String> tokens = new ArrayList<>();
        for (int i = 0; i < TOKENS_LETRAS_BASICO; i++) {
            int largo = random.nextInt(1, 5);
            StringBuilder token = new StringBuilder();
            for (int j = 0; j < largo; j++) {
                token.append(letras.get(random.nextInt(letras.size())));
            }
            tokens.add(token.toString());
        }
        return String.join(" ", tokens);
    }

    /* Parte un texto en tandas que el frente sirve DE A UNA, con un destello entre medio.

       Existe por un problema de lectura: un ejercicio de dos o tres minutos servido de una
       sola vez no da ninguna senal por el camino, y en Basico eso es medio nivel — los
       nodos de Fundamentos tienen sus cuatro latidos con su ventana, y los de palabras y
       oraciones no tenian nada hasta la pantalla de resultados.

       CORTA POR ORACION si el texto las tiene, y por palabra si no. Partir una lista de
       palabras por la mitad de una es obvio que esta mal; partir una oracion por la mitad
       lo es igual, y con el mismo criterio de contar palabras se hacia. Se reparte lo mas
       parejo posible para que las tres tandas duren lo mismo.

       El separador es un salto de linea y NUNCA llega al texto que se teclea: el frente
       parte por el antes de pintar nada. */
    private static final int TANDAS_POR_DEFECTO = 3;

    private String partirEnTandas(String texto, int cuantas) {
        if (texto == null || texto.isBlank() || cuantas < 2) return texto;

        // Por oracion cuando las hay; si no, por palabra.
        String[] piezas = texto.contains(". ")
                ? texto.split("(?<=[.]) ")
                : texto.split(" ");
        if (piezas.length < cuantas) return texto;

        List<StringBuilder> grupos = new ArrayList<>();
        for (int i = 0; i < cuantas; i++) grupos.add(new StringBuilder());
        for (int i = 0; i < piezas.length; i++) {
            /* Reparto por posicion y no por longitud: con listas de palabras cortas las dos
               formas dan lo mismo, y esta no puede dejar un grupo vacio. */
            StringBuilder g = grupos.get(i * cuantas / piezas.length);
            if (g.length() > 0) g.append(' ');
            g.append(piezas[i]);
        }
        return grupos.stream().map(StringBuilder::toString)
                .filter(t -> !t.isBlank())
                .collect(Collectors.joining("\n"));
    }

    /* Un latido por dedo. El texto de cada uno es mas corto que el de una tanda de
       Fundamentos porque un dedo solo tiene tres teclas: con los cien caracteres de antes
       el drill se volvia repetitivo mucho antes de terminar.

       El nombre del latido es el del DEDO, no un rotulo generico tipo "Aprende": aqui lo
       que cambia entre tandas es que mano y que dedo se usa, y esa es justamente la
       informacion que el usuario necesita ver en la ventana antes de seguir. */
    private static final int CARACTERES_LATIDO_DEDO = 60;

    /* LAS FORMAS DE UN RECORRIDO, en índices de fila: 0 = arriba, 1 = reposo, 2 = abajo.

       Antes este drill servía tokens de 1 a 4 letras al azar del dedo, y la mitad no dibujaba
       ningún viaje: `dd`, `ec`, `ce`. El ejercicio se llama recorrido porque lo que entrena es
       SALIR de la fila de reposo y VOLVER, así que los tokens tienen que ser eso.

       Las nueve formas cubren los cuatro gestos reales: la ida (`de`), la ida y vuelta (`ded`),
       el repique sobre la misma tecla lejana (`cc`) y el barrido de las tres filas (`edc`). Se
       alternan al azar para que no se teclee de memoria — el mismo motivo por el que el
       tutorial de teclas sortea su orden. */
    private static final int[][] FORMAS_RECORRIDO = {
            {1, 0}, {1, 0, 1}, {0, 1},
            {1, 2}, {1, 2, 1}, {2, 1},
            {0, 0}, {2, 2},
            {0, 1, 2}, {2, 1, 0},
    };

    /* ⚠️ CONTRATO CON LA CONFIGURACIÓN: las letras de cada dedo vienen en grupos de TRES, por
       COLUMNA y de arriba abajo. `edc` es e(arriba) d(reposo) c(abajo), y un dedo con dos
       columnas se escribiría `rfvtgb` (`r f v` y `t g b`). Hoy los ocho dedos sembrados
       tienen una sola —el índice perdió la interior el 10-sep-2026—, pero el generador
       sigue admitiendo varias.

       El backend no puede verificarlo —la distribución del teclado vive en el front
       (`tecladoLayout.ts`)—, así que si el largo no es múltiplo de tres se cae al generador de
       siempre en vez de inventar un recorrido con las filas cruzadas. Un dedo mal escrito
       produce un drill más pobre, nunca uno equivocado. */
    private String generarTandaRecorrido(String letras, PlanLatido plan) {
        if (letras.length() < 3 || letras.length() % 3 != 0) {
            return generarTandaConDominancia(letras, "", plan);
        }
        ThreadLocalRandom random = ThreadLocalRandom.current();
        int columnas = letras.length() / 3;
        List<String> tokens = new ArrayList<>();
        int escritos = 0;

        while (escritos < plan.caracteres()) {
            // La columna se sortea POR TOKEN: con dos columnas, un recorrido cruzado entre
            // ellas no es el viaje que se está enseñando.
            int columna = random.nextInt(columnas);
            int[] forma = FORMAS_RECORRIDO[random.nextInt(FORMAS_RECORRIDO.length)];
            StringBuilder token = new StringBuilder();
            for (int fila : forma) token.append(letras.charAt(columna * 3 + fila));
            tokens.add(token.toString());
            escritos += token.length() + 1;
        }
        return String.join(" ", tokens);
    }

    @SuppressWarnings("unchecked")
    private List<LatidoResponse> generarLatidosUnDedo(Map<String, Object> config) {
        List<Map<String, Object>> dedos = (List<Map<String, Object>>) config.get("dedos");
        if (dedos == null || dedos.size() < 2) return null;

        List<LatidoResponse> latidos = new ArrayList<>();
        for (Map<String, Object> dedo : dedos) {
            String letras = String.valueOf(dedo.get("letras"));
            PlanLatido plan = new PlanLatido(String.valueOf(dedo.get("nombre")),
                    "Sale de la fila de reposo y vuelve",
                    CARACTERES_LATIDO_DEDO, 100, 1, 4);
            latidos.add(LatidoResponse.builder()
                    .nombre(plan.nombre())
                    .descripcion(plan.descripcion())
                    .texto(generarTandaRecorrido(letras, plan))
                    .dominancia(100)
                    .build());
        }
        return latidos;
    }

    /* UNA_MANO_FORZADA: como MODO_UNA_MANO pero sin exigir el 100% — palabras (o, en
       modo "oraciones", frases curadas a mano) donde ≥90% de las letras caen en una
       mano, forzando 1-2 alcances hacia la otra. Reutiliza el mismo reparto "manos" que
       ya usa MODO_UNA_MANO.
       configuracion: {"modo":"palabras"|"oraciones","manos":[{"id":"izquierda","letras":"..."}, ...]} */
    @SuppressWarnings("unchecked")
    private String generarUnaManoForzada(Map<String, Object> config, String grupo) {
        List<Map<String, Object>> manos = (List<Map<String, Object>>) config.get("manos");
        if (manos == null || manos.isEmpty()) {
            throw new ApiException("El ejercicio de mano forzada no tiene manos configuradas.");
        }

        final String pedida = grupo;
        Map<String, Object> mano = manos.stream()
                .filter(m -> pedida != null && pedida.equals(m.get("id")))
                .findFirst()
                .orElse(manos.get(0));

        String modo = (String) config.getOrDefault("modo", "palabras");
        if ("oraciones".equals(modo)) {
            // El generador algorítmico solo sirve para palabras sueltas: puntuar
            // oraciones completas por dominancia de mano Y que salgan gramaticales es
            // un problema distinto. Ver la nota larga en ContenidoCurado.
            List<String> banco = "derecha".equals(mano.get("id"))
                    ? ContenidoCurado.ORACIONES_UNA_MANO_DERECHA
                    : ContenidoCurado.ORACIONES_UNA_MANO_IZQUIERDA;
            List<String> copia = new ArrayList<>(banco);
            Collections.shuffle(copia, ThreadLocalRandom.current());
            return String.join(" ", copia.subList(0, Math.min(4, copia.size())));
        }

        Set<Character> letrasMano = String.valueOf(mano.get("letras")).chars()
                .mapToObj(c -> (char) c)
                .collect(Collectors.toSet());

        List<String> pool = diccionarioRepository.findTopNPorFrecuencia(3000);

        /* Se pide primero al 90%; si el diccionario no da para armar una tanda completa,
           se relaja al 80% antes de fallar — mismo patrón de "pedir de más y filtrar"
           que ya usa generarUnaMano. Menor a 1.0 a propósito: el 100% puro ya lo cubre
           MODO_UNA_MANO, acá el objetivo es justo forzar 1-2 alcances con la otra mano. */
        List<String> candidatas = filtrarPorDominanciaDeMano(pool, letrasMano, 0.90);
        if (candidatas.size() < PALABRAS_POR_TANDA) {
            candidatas = filtrarPorDominanciaDeMano(pool, letrasMano, 0.80);
        }
        if (candidatas.isEmpty()) {
            throw new ApiException("No hay palabras en el diccionario con suficiente dominancia de mano '" + mano.get("id") + "'.");
        }

        Collections.shuffle(candidatas, ThreadLocalRandom.current());
        return candidatas.stream().limit(PALABRAS_POR_TANDA).collect(Collectors.joining(" "));
    }

    private List<String> filtrarPorDominanciaDeMano(List<String> pool, Set<Character> letrasMano, double umbralMinimo) {
        return pool.stream()
                .filter(p -> !ContenidoCurado.PALABRAS_NO_ESPANOLAS.contains(p.toLowerCase()))
                .filter(p -> p.length() >= 3) // muy cortas (1-2 letras) no fuerzan ningún alcance real
                .filter(p -> {
                    String limpia = p.toLowerCase();
                    long total = limpia.length();
                    long deLaMano = limpia.chars().filter(c -> letrasMano.contains((char) c)).count();
                    double proporcion = (double) deLaMano / total;
                    return proporcion >= umbralMinimo && proporcion < 1.0;
                })
                .collect(Collectors.toList());
    }

    /* SHIFT_LATERAL: tokens de letras en MAYÚSCULA de ambas manos, mezcladas. Cada una
       exige el Shift del lado CONTRARIO a su mano (letra de mano derecha → Shift
       izquierdo). La validación de qué lado se usó vive en el frontend
       (KeyboardEvent.code), acá solo se entrega el texto objetivo.
       configuracion: {"manos":[{"id":"izquierda","letras":"..."}, {"id":"derecha","letras":"..."}]} */
    @SuppressWarnings("unchecked")
    private String generarShiftLateral(Map<String, Object> config) {
        List<Map<String, Object>> manos = (List<Map<String, Object>>) config.get("manos");
        if (manos == null || manos.isEmpty()) {
            throw new ApiException("El ejercicio de shift lateral no tiene manos configuradas.");
        }

        List<String> todasLasLetras = manos.stream()
                .flatMap(m -> String.valueOf(m.get("letras")).chars()
                        .mapToObj(c -> String.valueOf((char) c)))
                .collect(Collectors.toList());

        ThreadLocalRandom random = ThreadLocalRandom.current();
        List<String> tokens = new ArrayList<>();
        for (int i = 0; i < TOKENS_LETRAS_BASICO; i++) {
            tokens.add(todasLasLetras.get(random.nextInt(todasLasLetras.size())).toUpperCase());
        }
        return String.join(" ", tokens);
    }

    /* RESISTENCIA. Sin config (la fila "Resistencia" de Ejercicios Base): encadena
       oraciones largas hasta juntar un texto de verdad largo (300+ caracteres) — una
       sola oración de ORACIONES_LARGAS no alcanza para medir caída de rendimiento a
       mitad de camino.
       Con configuracion.banco (las filas "texto" del Curso — Textos de 1-2 minutos,
       correos formales, textos tediosos, etc.): cada ítem del banco YA ES un texto
       completo del largo que le corresponde a ese ejercicio, así que no hace falta
       encadenar nada — se elige uno al azar tal cual. */
    /* "bancoTandas" arma un ejercicio de VARIAS bolsas distintas, una tanda por
       bolsa: "Documentos de oficina" quiere una carta y un aviso (Intermedio) o
       un memo y un formulario (Avanzado), pero nunca los MISMOS dos textos dos
       veces seguidas. Por eso no alcanza con un solo `banco` — hace falta
       elegir un ítem al azar de cada bolsa nombrada y unirlos con el separador
       de tanda, igual que ya hace `generarOracionesTematicas` con `porTandas`. */
    private String generarResistencia(Map<String, Object> config) {
        String banco = config == null ? null : (String) config.get("banco");
        if (banco != null) {
            return unTextoAlAzarDe(banco);
        }

        @SuppressWarnings("unchecked")
        List<String> bancoTandas = config == null ? null : (List<String>) config.get("bancoTandas");
        if (bancoTandas != null && !bancoTandas.isEmpty()) {
            return bancoTandas.stream()
                    .map(this::unTextoAlAzarDe)
                    .collect(Collectors.joining("\n"));
        }

        List<String> copia = new ArrayList<>(ContenidoCurado.ORACIONES_LARGAS);
        Collections.shuffle(copia, ThreadLocalRandom.current());
        StringBuilder texto = new StringBuilder();
        for (String oracion : copia) {
            if (texto.length() >= 350) break;
            if (texto.length() > 0) texto.append(" ");
            texto.append(oracion);
        }
        return texto.toString();
    }

    private String unTextoAlAzarDe(String banco) {
        List<String> textos = switch (banco) {
            case "intermedio_textos" -> ContenidoCurado.TEXTOS_INTERMEDIO;
            case "intermedio_textos_exclamacion" -> ContenidoCurado.TEXTOS_INTERMEDIO_EXCLAMACION;
            case "intermedio_doc_carta" -> ContenidoCurado.TEXTOS_INTERMEDIO_DOC_CARTA;
            case "intermedio_doc_aviso" -> ContenidoCurado.TEXTOS_INTERMEDIO_DOC_AVISO;
            case "avanzado_correos" -> ContenidoCurado.TEXTOS_AVANZADO_CORREOS;
            case "avanzado_textos_medios" -> ContenidoCurado.TEXTOS_AVANZADO_MEDIOS;
            case "avanzado_textos_largos" -> ContenidoCurado.TEXTOS_AVANZADO_LARGOS;
            case "avanzado_doc_memo" -> ContenidoCurado.TEXTOS_AVANZADO_DOC_MEMO;
            case "avanzado_doc_formulario" -> ContenidoCurado.TEXTOS_AVANZADO_DOC_FORMULARIO;
            case "intermedio_fecha_lista1" -> ContenidoCurado.TEXTOS_INTERMEDIO_FECHA_LISTA_1;
            case "intermedio_fecha_lista2" -> ContenidoCurado.TEXTOS_INTERMEDIO_FECHA_LISTA_2;
            case "intermedio_fecha_oracion1" -> ContenidoCurado.TEXTOS_INTERMEDIO_FECHA_ORACION_1;
            case "intermedio_fecha_oracion2" -> ContenidoCurado.TEXTOS_INTERMEDIO_FECHA_ORACION_2;
            default -> throw new ApiException("Banco de textos desconocido: " + banco);
        };
        List<String> copia = new ArrayList<>(textos);
        Collections.shuffle(copia, ThreadLocalRandom.current());
        return copia.get(0);
    }

    /* ORACIONES_TEMATICAS: mismo mecanismo que generarOraciones (varias oraciones
       cortas encadenadas), pero el banco lo elige configuracion.banco en vez de estar
       fijo en el código — así un solo TipoEjercicio sirve para todos los bancos
       temáticos del Curso (signos, tildes, interrogación, números y fechas, textos
       tediosos, inglés...). */
    private String generarOracionesTematicas(Map<String, Object> config) {
        String banco = (String) config.get("banco");
        List<String> oraciones = switch (banco) {
            case "intermedio_general" -> ContenidoCurado.ORACIONES_INTERMEDIO_GENERAL;
            case "intermedio_contrarreloj" -> ContenidoCurado.ORACIONES_INTERMEDIO_CONTRARRELOJ;
            case "intermedio_puntoycoma" -> ContenidoCurado.ORACIONES_INTERMEDIO_PUNTOYCOMA;
            case "intermedio_signos" -> ContenidoCurado.ORACIONES_INTERMEDIO_SIGNOS;
            case "intermedio_tildes" -> ContenidoCurado.ORACIONES_INTERMEDIO_TILDES;
            case "intermedio_exclamacion" -> ContenidoCurado.ORACIONES_INTERMEDIO_EXCLAMACION;
            case "intermedio_palabras_largas" -> ContenidoCurado.ORACIONES_INTERMEDIO_PALABRAS_LARGAS;
            case "ergonomia" -> ContenidoCurado.ORACIONES_ERGONOMIA;
            case "intermedio_numeros" -> ContenidoCurado.ORACIONES_INTERMEDIO_NUMEROS;
            case "intermedio_signos_pregunta" -> ContenidoCurado.ORACIONES_INTERMEDIO_SIGNOS_PREGUNTA;
            case "intermedio_signos_exclamacion" -> ContenidoCurado.ORACIONES_INTERMEDIO_SIGNOS_EXCLAMACION;
            case "intermedio_signo_diagonal" -> ContenidoCurado.ORACIONES_INTERMEDIO_SIGNO_DIAGONAL;
            case "intermedio_diagonal_frase" -> ContenidoCurado.ORACIONES_INTERMEDIO_DIAGONAL_EN_FRASE;
            case "avanzado_numeros" -> ContenidoCurado.ORACIONES_AVANZADO_NUMEROS;
            case "avanzado_tediosas" -> ContenidoCurado.ORACIONES_AVANZADO_TEDIOSAS;
            case "avanzado_ingles" -> ContenidoCurado.ORACIONES_AVANZADO_INGLES;
            case "basico_qwerty" -> ContenidoCurado.ORACIONES_BASICO_QWERTY;
            case "basico_numeros" -> ContenidoCurado.ORACIONES_BASICO_NUMEROS;
            case "basico_relajo" -> ContenidoCurado.ORACIONES_BASICO_RELAJO;
            case "basico_tildes" -> ContenidoCurado.ORACIONES_BASICO_TILDES;
            case "basico_dos_filas" -> ContenidoCurado.ORACIONES_BASICO_DOS_FILAS;
            case "basico_tres_filas" -> ContenidoCurado.ORACIONES_BASICO_TRES_FILAS;
            case "basico_linea_base" -> ContenidoCurado.ORACIONES_BASICO_LINEA_BASE;
            case "basico_teclas_nuevas" -> ContenidoCurado.ORACIONES_BASICO_TECLAS_NUEVAS;
            case "test_final_basico" -> ContenidoCurado.TEXTO_TEST_FINAL_BASICO;
            case "test_final_intermedio" -> ContenidoCurado.TEXTO_TEST_FINAL_INTERMEDIO;
            case "test_nivel_basico" -> ContenidoCurado.TEXTO_TEST_NIVEL_BASICO;
            default -> throw new ApiException("Banco de oraciones desconocido: " + banco);
        };
        /* `cantidad` existe para los bancos cuyo ítem YA ES un ejercicio entero. Los bancos
           temáticos encadenan seis frases cortas; los textos de relajo son de doscientos
           caracteres cada uno y encadenar seis daría un muro de mil doscientos. */
        int cantidad = config.get("cantidad") instanceof Number n ? n.intValue() : 6;

        /* CON `porTandas`, UNA FRASE POR TANDA — y las frases viajan ya separadas.

           Antes se unían con espacio y `partirEnTandas` las volvía a cortar por su cuenta.
           Eso funciona cuando el texto trae puntos, pero los bancos tempranos de Básico no
           los tienen (el punto es del anular derecho, orden 23), así que ahí caía al reparto
           POR PALABRA y las tandas quedaban cortadas a mitad de frase: «…y perdí la hoja
           Papá» / «salió tarde pero llegó…». Tres frases sin relación entre sí, cada una
           partida por la mitad, leídas de corrido: eso es lo que no tenía coherencia.

           El generador es el único que sabe dónde acaba una frase cuando no hay puntuación
           que lo diga, así que lo marca él. `generarContenido` respeta las marcas que ya
           vengan puestas en vez de rehacer el reparto. */
        String union = Boolean.TRUE.equals(config.get("porTandas")) ? "\n" : " ";

        /* (El reparto en tandas ya no se hace aqui: vive en partirEnTandas, que se aplica
           a la salida de CUALQUIER generador. Antes estaba solo en este metodo y por eso
           los nodos de palabras no podian usarlo.)
           NOTA VIEJA, conservada porque explica el porque: las frases viajan separadas por
           un espacio, y el frente las sirve DE A UNA con un destello entre medio.

           Existe por un problema de lectura, no de mecanica: en Basico no hay punto hasta
           la fila inferior, asi que seis frases encadenadas se ven como un parrafo corrido
           sin ningun corte visible. El salto de linea nunca llega al texto que se teclea
           —el frente parte por el ANTES de pintar nada—, asi que no hay ninguna tecla
           nueva de por medio. */
        return generarOraciones(oraciones, cantidad, union);
    }

    /* SIMBOLOS_CRITICOS. `grupo` llega con los símbolos que el usuario dejó activos,
       concatenados (por ejemplo "{}[]#$"). Sirve para excluir alguno que su teclado no
       pueda producir: se genera solo con los que quedan. Sin grupo, van todos. */
    @SuppressWarnings("unchecked")
    private String generarSimbolosCriticos(Map<String, Object> config, String grupo) {
        /* "Fila de números" es SIMBOLOS_CRITICOS con este flag — no un tipo nuevo, para no
           tocar "Maratón de símbolos", que sigue usando el camino de abajo tal cual.
           ⚠️ EL NODO VIEJO "Práctica de signos" ya no existe con este nombre (11-sep-2026,
           6.23): se renombró a "El punto y coma" y pasó a ORACIONES_TEMATICAS con
           oraciones reales, porque generar pseudo-tokens al azar (`a;j`, `.kl`) no enseña
           CUÁNDO se usa el punto y coma, solo dónde está la tecla.

           El nodo NUEVO "Práctica con signos" (15-sep-2026) es distinto a propósito: viene
           ANTES del anterior en el sendero, cuando todavía no se enseñó ningún uso
           gramatical — ahí sí corresponde practicar solo la posición de la tecla, mismo
           criterio que ya vale para los dígitos. Usa `progresionSignos`, no
           `progresionNumerica`: menos símbolos (4) y ninguno tiene un dedo único y
           universal como los dígitos, así que no hay tabla de captions que ofrecer. */
        if (Boolean.TRUE.equals(config.get("progresionNumerica"))) {
            return generarProgresionNumerica();
        }
        if (Boolean.TRUE.equals(config.get("progresionSignos"))) {
            return generarProgresionSignos();
        }

        List<String> simbolos = (List<String>) config.get("simbolos");

        if (grupo != null && !grupo.isBlank()) {
            List<String> elegidos = grupo.chars()
                    .mapToObj(c -> String.valueOf((char) c))
                    .filter(simbolos::contains)   // solo los que existen en la config
                    .distinct()
                    .collect(Collectors.toList());
            if (!elegidos.isEmpty()) simbolos = elegidos;
        }

        List<String> letras = List.of("a", "s", "d", "f", "j", "k", "l");
        ThreadLocalRandom random = ThreadLocalRandom.current();
        List<String> tokens = new ArrayList<>();

        for (int i = 0; i < 25; i++) {
            StringBuilder token = new StringBuilder();
            int largo = random.nextInt(2, 4);
            for (int j = 0; j < largo; j++) {
                boolean usarSimbolo = random.nextBoolean();
                List<String> alfabeto = usarSimbolo ? simbolos : letras;
                token.append(alfabeto.get(random.nextInt(alfabeto.size())));
            }
            tokens.add(token.toString());
        }
        Collections.shuffle(tokens, random);
        return String.join(" ", tokens);
    }

    private static final String DIGITOS_PROGRESION = "1234567890";
    private static final String LETRAS_PROGRESION_NUMERICA = "asdfjkl";

    /* LAS CUATRO TANDAS DE "FILA DE NÚMEROS". Pedido del usuario tras ver que el generador
       de arriba mezclaba dígitos y letras al 50% desde el primer token, sin ninguna
       progresión: "como está ahora está complicada".

       El texto arranca con los DIEZ dígitos sueltos, uno por ítem ("1 2 3 4 5 6 7 8 9 0"):
       eso es lo que `tutorialPalabras` recorta para el tutorial con la leyenda de qué dedo
       va en cada uno (ver `captionsTutorial` en el sembrado). Es el mismo trato que ya usa
       "Palabras de la línea base": lo que el tutorial adelanta vuelve a aparecer al empezar
       la tanda cronometrada, no desaparece.

       TANDA 1 (más sencilla): un grupo de tres caracteres por cada dígito, reforzándolo DOS
       veces y mezclando UN dígito ya visto — el mismo criterio de "lo nuevo pesa más" que
       PASOS_FUNDAMENTOS usa para las letras, aplicado a los números.
       TANDAS 2 y 3: tokens de puros dígitos, cada vez más largos y sin ninguna progresión —
       "un poco más al azar", como pidió.
       TANDA 4: igual que la 3, pero cada carácter tiene 15% de chance de salir como letra
       de la fila central en vez de dígito. Nunca más que eso: el nodo sigue siendo,
       sobre todo, de números. */
    private String generarProgresionNumerica() {
        ThreadLocalRandom random = ThreadLocalRandom.current();

        List<String> digitosSueltos = DIGITOS_PROGRESION.chars()
                .mapToObj(c -> String.valueOf((char) c))
                .collect(Collectors.toList());

        List<String> tanda1 = new ArrayList<>();
        for (int i = 0; i < DIGITOS_PROGRESION.length(); i++) {
            char actual = DIGITOS_PROGRESION.charAt(i);
            char anterior = i == 0 ? actual : DIGITOS_PROGRESION.charAt(random.nextInt(i));
            List<Character> caracteres = new ArrayList<>(List.of(actual, actual, anterior));
            Collections.shuffle(caracteres, random);
            StringBuilder token = new StringBuilder();
            caracteres.forEach(token::append);
            tanda1.add(token.toString());
        }

        List<String> tanda2 = tandaAleatoriaDeDigitos(12, 2, 3, 0, random);
        List<String> tanda3 = tandaAleatoriaDeDigitos(15, 2, 4, 0, random);
        List<String> tanda4 = tandaAleatoriaDeDigitos(15, 2, 4, 15, random);
        /* Con 15% por carácter es fácil que alguna de las siete letras no toque en esta
           vuelta — y ahí es donde se rompía la pista de fila: el frente arma su lista de
           "caracteres permitidos" a partir del TEXTO que de verdad llegó, no de esta
           configuración, así que una letra que nunca salió se trataba como "todavía no la
           usamos" justo en la tanda que la usa. Se asegura acá, así el texto real dice la
           verdad completa y no hace falta ningún caso especial del lado de la pista. */
        asegurarTodasLasLetras(tanda4, random);

        // Marca las tandas con "\n" ella misma, igual que generarOracionesTematicas con
        // porTandas: generarContenido respeta el salto de línea que ya viene puesto.
        return String.join(" ", digitosSueltos) + " " + String.join(" ", tanda1)
                + "\n" + String.join(" ", tanda2)
                + "\n" + String.join(" ", tanda3)
                + "\n" + String.join(" ", tanda4);
    }

    private List<String> tandaAleatoriaDeDigitos(int cuantos, int largoMinimo, int largoMaximo,
            int porcentajeLetras, ThreadLocalRandom random) {
        List<String> tokens = new ArrayList<>();
        for (int i = 0; i < cuantos; i++) {
            int largo = random.nextInt(largoMinimo, largoMaximo + 1);
            StringBuilder token = new StringBuilder();
            for (int j = 0; j < largo; j++) {
                boolean letra = porcentajeLetras > 0 && random.nextInt(100) < porcentajeLetras;
                char fuente = letra
                        ? LETRAS_PROGRESION_NUMERICA.charAt(random.nextInt(LETRAS_PROGRESION_NUMERICA.length()))
                        : DIGITOS_PROGRESION.charAt(random.nextInt(DIGITOS_PROGRESION.length()));
                token.append(fuente);
            }
            tokens.add(token.toString());
        }
        return tokens;
    }

    private static final String SIGNOS_PROGRESION = ";,.-";
    private static final String LETRAS_PROGRESION_SIGNOS = "asdfjkl";

    /* "Práctica con signos" (Intermedio, 15-sep-2026): mismo espíritu que
       generarProgresionNumerica pero para ; , . - en vez de dígitos, y con solo 3 tandas
       en vez de 4 — son cuatro símbolos, no diez, así que no hace falta tanto escalón.

       TANDA 1: cada signo introducido de a uno, reforzado dos veces junto con uno ya visto
       — mismo criterio "lo nuevo pesa más" que ya usa PASOS_FUNDAMENTOS y la tanda 1 de
       números. TANDAS 2 y 3: acá SÍ se mezclan con letras del home row (a diferencia de los
       dígitos, que en sus tandas 2-3 van puros) — una coma o un guion sueltos entre
       dígitos no tienen paralelo real, pero un signo de puntuación apareciendo entre
       letras sí es justamente la situación real que el nodo entrena. La proporción de
       signos sube de una tanda a la otra (35% → 50%) para que el mezclado crezca en vez de
       ser el mismo desde el primer token. */
    private String generarProgresionSignos() {
        ThreadLocalRandom random = ThreadLocalRandom.current();

        List<String> signosSueltos = SIGNOS_PROGRESION.chars()
                .mapToObj(c -> String.valueOf((char) c))
                .collect(Collectors.toList());

        List<String> tanda1 = new ArrayList<>();
        for (int i = 0; i < SIGNOS_PROGRESION.length(); i++) {
            char actual = SIGNOS_PROGRESION.charAt(i);
            char anterior = i == 0 ? actual : SIGNOS_PROGRESION.charAt(random.nextInt(i));
            List<Character> caracteres = new ArrayList<>(List.of(actual, actual, anterior));
            Collections.shuffle(caracteres, random);
            StringBuilder token = new StringBuilder();
            caracteres.forEach(token::append);
            tanda1.add(token.toString());
        }

        List<String> tanda2 = tandaAleatoriaDeSignos(12, 2, 3, 35, random);
        List<String> tanda3 = tandaAleatoriaDeSignos(15, 2, 4, 50, random);

        return String.join(" ", signosSueltos) + " " + String.join(" ", tanda1)
                + "\n" + String.join(" ", tanda2)
                + "\n" + String.join(" ", tanda3);
    }

    private List<String> tandaAleatoriaDeSignos(int cuantos, int largoMinimo, int largoMaximo,
            int porcentajeSignos, ThreadLocalRandom random) {
        List<String> tokens = new ArrayList<>();
        for (int i = 0; i < cuantos; i++) {
            int largo = random.nextInt(largoMinimo, largoMaximo + 1);
            StringBuilder token = new StringBuilder();
            for (int j = 0; j < largo; j++) {
                boolean signo = random.nextInt(100) < porcentajeSignos;
                char fuente = signo
                        ? SIGNOS_PROGRESION.charAt(random.nextInt(SIGNOS_PROGRESION.length()))
                        : LETRAS_PROGRESION_SIGNOS.charAt(random.nextInt(LETRAS_PROGRESION_SIGNOS.length()));
                token.append(fuente);
            }
            tokens.add(token.toString());
        }
        Collections.shuffle(tokens, random);
        return tokens;
    }

    /* Reemplaza un carácter al azar por cada letra de LETRAS_PROGRESION_NUMERICA que no
       haya aparecido todavía en `tanda`, para garantizar cobertura completa (ver la nota
       en generarProgresionNumerica). Muta la lista en el lugar. */
    private void asegurarTodasLasLetras(List<String> tanda, ThreadLocalRandom random) {
        if (tanda.isEmpty()) return;
        for (int k = 0; k < LETRAS_PROGRESION_NUMERICA.length(); k++) {
            char letra = LETRAS_PROGRESION_NUMERICA.charAt(k);
            boolean presente = tanda.stream().anyMatch(t -> t.indexOf(letra) >= 0);
            if (presente) continue;
            int indiceToken = random.nextInt(tanda.size());
            String token = tanda.get(indiceToken);
            int pos = random.nextInt(token.length());
            tanda.set(indiceToken, token.substring(0, pos) + letra + token.substring(pos + 1));
        }
    }

    // DICTADO_VOZ: dos modos.
    // - "tts": el navegador lee el texto en voz alta (SpeechSynthesis), sin infraestructura.
    // - "archivo": un audio real subido por el admin vía POST /api/v1/dictado/audios.
    //   Si todavía no se subió ninguno, avisamos claro en vez de devolver algo vacío.
    private String generarDictado(Map<String, Object> config) {
        String modo = (String) config.getOrDefault("modo", "tts");
        if ("archivo".equals(modo)) {
            List<DictadoAudio> candidatos = dictadoAudioRepository.encontrarUnoAleatorio();
            if (candidatos.isEmpty()) {
                /* DOS MENSAJES PARA EL MISMO HECHO, y la separación es deliberada.

                   Antes el usuario recibía "usa POST /api/v1/dictado/audios con X-Admin-Key":
                   una instrucción de administrador en la pantalla de alguien que solo quería
                   practicar. Es el mismo criterio que ya se aplicó con la cuota de Gemini —
                   ahí el mensaje dice "intentá mañana" y no habla de cuotas ni de modelos.

                   La arquitectura está completa (endpoint de subida protegido, tabla,
                   archivoUrl viajando hasta la vista); lo único que falta son los archivos,
                   que es contenido y no código. */
                log.warn("Dictado en modo archivo pedido, pero dictado_audios está vacío. "
                        + "Subir uno con POST /api/v1/dictado/audios (X-Admin-Key).");
                throw new ApiException("Este ejercicio estará disponible en unos días.");
            }
            DictadoAudio audio = candidatos.get(0);
            config.put("archivoUrl", audio.getArchivoUrl());
            return audio.getTextoTranscripcion();
        }
        // modo tts: una oración corta del banco curado, sin mostrarla (la vista la oculta)
        List<String> copia = new ArrayList<>(ContenidoCurado.ORACIONES_SIMPLES);
        Collections.shuffle(copia, ThreadLocalRandom.current());
        return copia.get(0);
    }

    /* LLUVIA_LETRAS: el "texto" acá no es una frase a escribir de corrido, es una cola
       de tokens (letras sueltas, o letras+palabras en "avanzado") que el frontend va
       soltando de a uno por columna — el timing y el ritmo adaptativo son 100%
       client-side, el backend solo entrega el contenido a repartir. */
    private String generarLluviaLetras(Map<String, Object> config, NivelCurso nivel,
            String identificadorTemporal) {
        String modo = (String) config.getOrDefault("modo", "letras");

        /* Con `desdeFalladas` la lluvia deja de ser generica y llueve TUS peores teclas.
           Es el mismo dato que alimentaba REPASO_FALLADAS —la consulta se comparte en
           letrasFalladasDe— servido como juego en vez de como drill: abre el bloque de
           consolidacion con algo personalizado, que es lo que ninguno de los cursos de
           referencia tiene. Sin historial cae al set generico y nunca revienta. */
        if (Boolean.TRUE.equals(config.get("desdeFalladas"))) {
            String falladas = String.join("", letrasFalladasDe(nivel, identificadorTemporal));
            if (!falladas.isBlank()) {
                config = new java.util.HashMap<>(config);
                config.put("letras", falladas);
                config.put("foco", falladas);
            }
        }

        /* Las teclas que caen. Antes el alfabeto entero estaba escrito a fuego, y por eso
           la Lluvia no podía usarse dentro de Básico: en el tercer nodo del curso habrían
           llovido teclas que el usuario todavía no vio. Con `letras` en la configuración,
           cada lluvia usa exactamente lo aprendido hasta ese punto — que es lo que la
           convierte en repaso y no en examen sorpresa. */
        String alfabeto = (String) config.getOrDefault("letras", "asdfghjklñqwertyuiopzxcvbnm");
        if (alfabeto.isBlank()) alfabeto = "asdfghjklñqwertyuiopzxcvbnm";

        /* DOMINANCIA. Una lluvia que cae justo después de "s l" y "a ñ" tiene que llover
           sobre todo `aslñ`: es el repaso de esos dos nodos, no un repaso general. Con
           `foco` y `dominancia`, el 95% de lo que cae sale de las teclas recién aprendidas
           y el 5% restante del resto — lo justo para que no se olviden.

           Es el mismo parámetro que gobierna los latidos, con el mismo nombre, a propósito:
           el día que se recalibre uno se busca el otro. */
        String foco = (String) config.getOrDefault("foco", "");
        int dominancia = config.get("dominancia") instanceof Number n ? n.intValue() : 100;
        ThreadLocalRandom random = ThreadLocalRandom.current();

        List<String> tokens = new ArrayList<>();
        int cantidadLetras = "avanzado".equals(modo) ? 25 : 50;
        for (int i = 0; i < cantidadLetras; i++) {
            boolean delFoco = !foco.isBlank() && random.nextInt(100) < dominancia;
            String fuente = delFoco ? foco : alfabeto;
            tokens.add(String.valueOf(fuente.charAt(random.nextInt(fuente.length()))));
        }

        if ("avanzado".equals(modo)) {
            List<String> pool = diccionarioRepository.findTopNPorFrecuencia(500).stream()
                    .filter(p -> p.length() <= 6)
                    .filter(p -> !ContenidoCurado.PALABRAS_NO_ESPANOLAS.contains(p.toLowerCase()))
                    .collect(Collectors.toList());
            if (!pool.isEmpty()) {
                Collections.shuffle(pool, random);
                tokens.addAll(pool.stream().limit(20).collect(Collectors.toList()));
            }
        }

        return String.join(" ", tokens);
    }

    /* PALABRAS_DE_FILA: central/superior generan palabras REALES del diccionario que
       caen enteras dentro de esa fila (mismo mecanismo regex que generarUnaMano, filas
       en vez de manos). La fila inferior no tiene vocales — no genera palabras, usa el
       banco de oraciones curadas a mano (ver ContenidoCurado.ORACIONES_LINEA_INFERIOR).

       Dos configuraciones posibles:
       - {"fila":"central"|"superior"|"inferior","letras":"asdfghjklñ"[,"dominancia":75]}
         Básico exige la palabra ENTERA dentro de la fila (sin "dominancia"). Intermedio
         puede relajar con "dominancia": ya no exige el 100%, alcanza con que ese % de
         los caracteres de la palabra caigan en la fila — mismo criterio de "no forzar
         el 100% para no perder naturalidad" que ya usa UNA_MANO_FORZADA con manos,
         aplicado acá a filas ("Palabras por línea, con letras de otras líneas").
       - {"patron":"<regex de MySQL>"} — cualquier otro filtro fonético sobre el
         diccionario que no sea "toda la palabra en esta fila" (doble consonante,
         tildes, longitud mínima...). Reusa el mismo findPorPatronDeLetras, cero query
         nueva: el patrón viaja completo en la config en vez de armarse en el código. */

    /* Baraja y recorta una tanda de palabras.

       `cantidad` permite tandas cortas: lo pide el primer nodo de palabras de Básico, que
       es un tutorial de diez palabras y no un drill de treinta. Con la fila central el
       diccionario solo da 29 palabras, y servirlas todas de golpe convierte la
       presentación en una lista de rarezas (alfalfa, agallas, daga).

       El recorte va ANTES de barajar, no después: el pool llega ordenado por frecuencia,
       así que quedarse con las primeras `cantidad` son LAS MÁS COMUNES. Barajar primero
       daría diez palabras al azar de las 29, que para una presentación es justo lo que no
       se quiere. Después sí se barajan entre ellas, para que el orden cambie en cada
       vuelta. */
    private String recortarTanda(List<String> pool, Map<String, Object> config) {
        int cuantas = config.get("cantidad") instanceof Number n
                ? n.intValue() : PALABRAS_POR_TANDA;
        List<String> elegidas = new ArrayList<>(pool.subList(0, Math.min(cuantas, pool.size())));
        Collections.shuffle(elegidas, ThreadLocalRandom.current());
        return String.join(" ", elegidas);
    }

    /* "patronesPorTanda": una lista de patrones, UNA TANDA POR PATRÓN — a diferencia de
       "patron" (una sola cadena, todo mezclado en una tanda), esto es lo que pidió el
       usuario para "Patrones de la mano izquierda/derecha": que "ser" no se diluya entre
       otros ocho patrones, sino que tenga su propia tanda de palabras, todas con "ser".
       El propio front lee esta misma lista para anunciar, en una ventana, qué combinación
       viene en cada tanda — ver `patronesPorTanda` en CursoPracticaView. */
    private String generarPorPatronesEnTandas(List<String> patrones, Map<String, Object> config) {
        List<String> tandas = new ArrayList<>();
        for (String patron : patrones) {
            List<String> pool = diccionarioRepository
                    .findPorPatronDeLetras(patron, 300)
                    .stream()
                    .filter(p -> !ContenidoCurado.PALABRAS_NO_ESPANOLAS.contains(p.toLowerCase()))
                    .collect(Collectors.toCollection(ArrayList::new));
            if (pool.isEmpty()) {
                throw new ApiException("No hay palabras en el diccionario para el patrón '" + patron + "'.");
            }
            tandas.add(recortarTanda(pool, config));
        }
        return String.join("\n", tandas);
    }

    /* "filasPorTanda": el mismo reparto de arriba, pero por FILA del teclado en vez de por
       patrón de letras — "Palabras por línea" (Intermedio) repasa las tres filas en un
       solo nodo, una por tanda, en vez de mezclarlas o quedarse solo con la central.

       ⚠️ La fila inferior (z x c v b n m) no tiene ninguna vocal — como ya documenta
       ORACIONES_LINEA_INFERIOR en Básico, "palabra hecha solo con esa fila" es
       matemáticamente imposible. Por eso cada fila trae su PROPIO umbral de dominancia en
       vez de uno fijo: medido contra el diccionario real (top 600 por frecuencia), central
       sostiene 72% con margen, superior sostiene 70%, e inferior recién da un pool usable
       bajando a 40% — un umbral más bajo ahí no es un descuido, es lo más alto que da la
       fila sin vocales propias. */
    private String generarPorFilasEnTandas(List<Map<String, Object>> filas, Map<String, Object> config) {
        List<String> tandas = new ArrayList<>();
        for (Map<String, Object> filaCfg : filas) {
            String letras = (String) filaCfg.get("letras");
            int minimoPct = filaCfg.get("dominancia") instanceof Number n ? n.intValue() : 70;
            List<String> pool = diccionarioRepository.findTopNPorFrecuencia(600).stream()
                    .filter(p -> p.length() >= 3)
                    .filter(p -> dominanciaDeFila(p, letras) >= minimoPct)
                    .filter(p -> !ContenidoCurado.PALABRAS_NO_ESPANOLAS.contains(p.toLowerCase()))
                    .collect(Collectors.toCollection(ArrayList::new));
            if (pool.isEmpty()) {
                throw new ApiException("No hay palabras en el diccionario para la fila con letras '" + letras + "'.");
            }
            tandas.add(recortarTanda(pool, config));
        }
        return String.join("\n", tandas);
    }

    private String generarPalabrasDeFila(Map<String, Object> config) {
        String filaId = (String) config.get("fila");

        @SuppressWarnings("unchecked")
        List<String> patronesPorTanda = config.get("patronesPorTanda") instanceof List<?> listaPatrones
                ? (List<String>) listaPatrones : null;
        if (patronesPorTanda != null && !patronesPorTanda.isEmpty()) {
            return generarPorPatronesEnTandas(patronesPorTanda, config);
        }

        /* "filasPorTanda": mismo espíritu que "patronesPorTanda", pero para FILAS enteras
           en vez de un patrón de letras — nació el 15-sep-2026 para repasar las tres filas
           del teclado en un solo nodo ("Palabras por línea"), una fila por tanda. Cada
           entrada es {"letras":..., "dominancia":N}, el mismo par que ya acepta la rama de
           abajo para una sola fila. */
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> filasPorTanda = config.get("filasPorTanda") instanceof List<?> listaFilas
                ? (List<Map<String, Object>>) listaFilas : null;
        if (filasPorTanda != null && !filasPorTanda.isEmpty()) {
            return generarPorFilasEnTandas(filasPorTanda, config);
        }

        if (filaId == null) {
            String patron = (String) config.get("patron");
            List<String> pool = diccionarioRepository
                    .findPorPatronDeLetras(patron, 300)
                    .stream()
                    .filter(p -> !ContenidoCurado.PALABRAS_NO_ESPANOLAS.contains(p.toLowerCase()))
                    .collect(Collectors.toCollection(ArrayList::new));
            if (pool.isEmpty()) {
                throw new ApiException("No hay palabras en el diccionario para el patrón '" + patron + "'.");
            }
            /* ⚠️ REESCRITO el 13-sep-2026: antes barajaba las 300 y cortaba a
               PALABRAS_POR_TANDA (30) fijo, sin mirar `cantidad` — a diferencia de la
               rama con `fila`, que sí lo respeta vía recortarTanda. "Palabras en -ción"
               y "Palabras en -mente" necesitaban pedir menos (20 y 15), así que ahora
               esta rama reusa el mismo recortarTanda: recorta ANTES de barajar (se
               queda con las `cantidad` más frecuentes del pool, ya ordenado) y recién
               ahí baraja el orden — mismo criterio que ya explica el comentario de
               recortarTanda, ahora también aplicado acá. */
            return recortarTanda(pool, config);
        }

        if ("inferior".equals(filaId)) {
            if (ContenidoCurado.ORACIONES_LINEA_INFERIOR.isEmpty()) {
                throw new ApiException("Todavía no hay oraciones curadas para la línea inferior (pendiente de la fase de contenido).");
            }
            List<String> copia = new ArrayList<>(ContenidoCurado.ORACIONES_LINEA_INFERIOR);
            Collections.shuffle(copia, ThreadLocalRandom.current());
            return String.join(" ", copia.subList(0, Math.min(4, copia.size())));
        }

        String letras = (String) config.get("letras");
        Number dominanciaCfg = (Number) config.get("dominancia");
        List<String> pool;

        if (dominanciaCfg != null) {
            int minimoPct = dominanciaCfg.intValue();
            pool = diccionarioRepository.findTopNPorFrecuencia(600).stream()
                    .filter(p -> p.length() >= 3)
                    .filter(p -> dominanciaDeFila(p, letras) >= minimoPct)
                    .filter(p -> !ContenidoCurado.PALABRAS_NO_ESPANOLAS.contains(p.toLowerCase()))
                    .collect(Collectors.toCollection(ArrayList::new));
        } else {
            pool = diccionarioRepository
                    .findPorPatronDeLetras("^[" + letras + "]+$", 400)
                    .stream()
                    .filter(p -> !ContenidoCurado.PALABRAS_NO_ESPANOLAS.contains(p.toLowerCase()))
                    .collect(Collectors.toCollection(ArrayList::new));
        }

        if (pool.isEmpty()) {
            throw new ApiException("No hay palabras en el diccionario para la fila '" + filaId
                    + "'. Importá más palabras desde la pantalla /revision-palabras y activalas.");
        }

        return recortarTanda(pool, config);
    }

    // % de los caracteres de la palabra que pertenecen al set de letras de una fila.
    private int dominanciaDeFila(String palabra, String letrasFila) {
        Set<Character> set = letrasFila.chars().mapToObj(c -> (char) c).collect(Collectors.toSet());
        long enFila = palabra.chars().filter(c -> set.contains((char) c)).count();
        return (int) Math.round(100.0 * enFila / palabra.length());
    }

    /* Palabras flotantes (Curso): N palabras del diccionario sin que dos compartan la
       primera letra — la regla que el propio componente PalabrasFlotantes.tsx ya
       documenta como responsabilidad del backend (con dos palabras que empiezan igual
       flotando a la vez, es imposible saber cuál estás tecleando). */
    private static final int PALABRAS_FLOTANTES_CANTIDAD = 6;

    private String generarPalabrasFlotantes() {
        List<String> pool = new ArrayList<>(diccionarioRepository.findTopNPorFrecuencia(500));
        pool.removeIf(p -> ContenidoCurado.PALABRAS_NO_ESPANOLAS.contains(p.toLowerCase()));
        Collections.shuffle(pool, ThreadLocalRandom.current());

        List<String> elegidas = new ArrayList<>();
        Set<Character> primerasLetras = new HashSet<>();
        for (String palabra : pool) {
            if (palabra.isEmpty()) continue;
            char primera = Character.toLowerCase(palabra.charAt(0));
            if (!primerasLetras.add(primera)) continue; // ya hay una que empieza igual
            elegidas.add(palabra);
            if (elegidas.size() >= PALABRAS_FLOTANTES_CANTIDAD) break;
        }

        if (elegidas.isEmpty()) {
            throw new ApiException("No hay palabras suficientes para Palabras flotantes.");
        }
        return String.join(" ", elegidas);
    }

    @Override
    @Transactional
    public SesionResponse guardarSesion(String identificadorTemporal, Integer ejercicioId, SesionCursoRequest request) {
        Ejercicio ejercicio = ejercicioRepository.findById(ejercicioId)
                .orElseThrow(() -> new ResourceNotFoundException("Ejercicio no encontrado: " + ejercicioId));

        Sesion sesion = Sesion.builder()
                .identificadorTemporal(identificadorTemporal)
                .ejercicio(ejercicio)
                .textoGenerado(request.getTexto())
                .wpm(request.getWpm())
                .precision(request.getPrecision())
                .segundos(request.getSegundos())
                .modoUsado(ModoUsado.CURSO)
                .dificultad(parseDificultad(request.getDificultad()))
                .fechaGuardado(LocalDateTime.now())
                .build();

        Sesion sesionGuardada = sesionRepository.save(sesion);

        if (request.getProgreso() != null && !request.getProgreso().isEmpty()) {
            List<SesionProgreso> progreso = request.getProgreso().stream()
                    .map(dto -> mapper.toSesionProgreso(dto, sesionGuardada))
                    .collect(Collectors.toList());
            sesionProgresoRepository.saveAll(progreso);
        }

        if (request.getTeclas() != null && !request.getTeclas().isEmpty()) {
            List<SesionTecla> teclas = request.getTeclas().stream()
                    .map(dto -> mapper.toSesionTecla(dto, sesionGuardada))
                    .collect(Collectors.toList());
            sesionTeclaRepository.saveAll(teclas);
        }

        if (request.getNgrams() != null && !request.getNgrams().isEmpty()) {
            List<SesionNgram> ngrams = request.getNgrams().stream()
                    .map(dto -> mapper.toSesionNgram(dto, sesionGuardada))
                    .collect(Collectors.toList());
            sesionNgramRepository.saveAll(ngrams);
        }

        // El log de modo sombra: la razón de ser de esta tabla nueva
        if (request.getEventos() != null && !request.getEventos().isEmpty()) {
            List<SesionTeclaEvento> eventos = request.getEventos().stream()
                    .map(dto -> mapper.toSesionTeclaEvento(dto, sesionGuardada))
                    .collect(Collectors.toList());
            sesionTeclaEventoRepository.saveAll(eventos);
        }

        log.info("Sesión de Curso {} guardada ({} eventos de teclado).",
                sesionGuardada.getId(), request.getEventos() != null ? request.getEventos().size() : 0);

        /* Solo si el ejercicio ya tiene nivel asignado — "Ejercicios Base" (nivel = null)
           no participa de la analítica ni del progreso por nodo. El umbral se evalúa acá
           adentro (propio del ejercicio, o el especial de TEST_NIVEL/TEST_FINAL). */
        SesionResponse response = mapper.toSesionResponse(sesionGuardada);
        if (ejercicio.getNivel() != null) {
            /* El veredicto se adjunta a la respuesta. Antes se calculaba y se descartaba:
               el nodo quedaba marcado en la base y el usuario no se enteraba de nada —
               ni de que había aprobado, ni de cuánto le había faltado. */
            response.setResultadoCurso(cursoStatsService.registrarProgresoEjercicio(
                    identificadorTemporal, ejercicio, request.getWpm(), request.getPrecision(),
                    Boolean.TRUE.equals(request.getPorUltimoIntento())));
        }

        return response;
    }

    private Dificultad parseDificultad(String dif) {
        try {
            return Dificultad.valueOf(dif.toUpperCase());
        } catch (Exception e) {
            throw new ApiException("Nivel de dificultad inválido. Valores permitidos: FACIL, MEDIO, DIFICIL.");
        }
    }

    private Map<String, Object> parsearConfiguracion(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.error("Configuración inválida en ejercicio: {}", e.getMessage());
            return Map.of();
        }
    }

    // --- Seed idempotente del catálogo base (los 4 tipos ya implementados) ---
    @Override
    @Transactional
    public void sembrarCatalogoBase() {
        /* Progresión por PARES de dedos, no por dedo suelto: primero índice+medio (cada
           uno individual y después combinados), luego anular+meñique (ídem), y recién al
           final las cuatro letras juntas. Se descarta a propósito el paso "cruzado"
           medio+anular (antes "sd kl"/"we oi"/"xc m,"): agregar una tercera combinación
           antes de juntar las cuatro alargaba la lección sin sumar nada nuevo.
           "g h" (central) y "t y" (superior) son los pasos "puente" que faltaban: sin
           ellos, las palabras de línea (que sí usan g/h y t/y) llegaban antes de que esas
           letras se hubieran enseñado. La fila inferior no tiene un puente equivalente —
           no lo pidió el usuario, y ahí ya están las 7 letras completas.
           Si más adelante se decide otro orden, esto se reemplaza entero — la función
           actualiza el ejercicio ya sembrado en vez de solo crearlo la primera vez. */
        crearSiNoExiste("Fundamentos de teclado", "Progresión por pares de dedos: índice y medio primero, anular y meñique después.",
                TipoEjercicio.LETRAS_BASICO,
                "{\"filas\":["
                        + "{\"id\":\"central\",\"nombre\":\"Fila central\","
                        + "\"pasos\":[\"f j\",\"d k\",\"fd jk\",\"s l\",\"a ñ\",\"as lñ\",\"asdf jklñ\",\"g h\"]},"
                        + "{\"id\":\"superior\",\"nombre\":\"Fila superior\","
                        + "\"pasos\":[\"r u\",\"e i\",\"re ui\",\"w o\",\"q p\",\"qw op\",\"qwer uiop\",\"t y\"]},"
                        + "{\"id\":\"inferior\",\"nombre\":\"Fila inferior\","
                        + "\"pasos\":[\"v n\",\"c m\",\"vc nm\",\"x ,\",\"z .\",\"zx ,.\",\"zxcv nm,.\"]}"
                        + "]}",
                1);

        crearSiNoExiste("Top 100 palabras", "Las 100 palabras más comunes del español.",
                TipoEjercicio.TOP_100_PALABRAS, null, 2);

        /* Las categorías se declaran igual que la progresión de Fundamentos: la vista
           dibuja el selector a partir de esta lista, sin saber qué hay en cada banco. */
        crearSiNoExiste("Muerte súbita", "Un solo error reinicia el ejercicio desde cero.",
                TipoEjercicio.SUDDEN_DEATH,
                "{\"categorias\":["
                        + "{\"id\":\"cortas\",\"nombre\":\"Oraciones cortas\"},"
                        + "{\"id\":\"medias\",\"nombre\":\"Oraciones medias\"},"
                        + "{\"id\":\"largas\",\"nombre\":\"Oraciones largas\"}"
                        + "]}",
                3);

        crearSiNoExiste("Contrarreloj", "Las correctas suman tiempo, las falladas lo restan.",
                TipoEjercicio.CONTRARRELOJ,
                "{\"tiempoInicialSegundos\":30,\"bonusCorrectaSegundos\":1,\"penalizacionErrorSegundos\":2}",
                4);

        crearSiNoExiste("Contrarreloj rápido (15s)", "Igual que el otro, pero arrancas con la mitad de tiempo.",
                TipoEjercicio.CONTRARRELOJ,
                "{\"tiempoInicialSegundos\":15,\"bonusCorrectaSegundos\":1,\"penalizacionErrorSegundos\":2}",
                4);

        /* "penalizacionPorTecla": distinto mecanismo, no solo números distintos. En el
           Contrarreloj normal el error se evalúa recién al cerrar la palabra (si hubo
           algún fallo, se resta una vez). Acá cada tecla errónea resta al instante en
           que se comete — corregís rápido o perdés tiempo ya, no al final de la
           palabra. El bono por palabra correcta sigue igual, evaluado al cerrarla. */
        crearSiNoExiste("Contrarreloj avanzado", "Cada tecla errónea resta al instante, no al cerrar la palabra: no hay margen para corregir sin costo.",
                TipoEjercicio.CONTRARRELOJ,
                "{\"tiempoInicialSegundos\":30,\"bonusCorrectaSegundos\":0.5,\"penalizacionErrorSegundos\":0.5,\"penalizacionPorTecla\":true}",
                21);

        crearSiNoExiste("Palabras simples", "Palabras cortas, sin tildes ni ñ, base para seguir tras las letras.",
                TipoEjercicio.PALABRAS_SIMPLES, null, 5);

        /* "Oraciones simples" había quedado desactivada por redundante en el catálogo
           plano ("Oraciones con mayúsculas" cubría lo mismo, ahí sí). En el Curso por
           niveles vuelve a tener sentido propio: es justo la versión más suave (sin
           mayúsculas ni puntuación) para el cierre de Básico, mientras que la de
           mayúsculas+puntuación queda para Intermedio. Se REACTIVA en vez de crearse de
           nuevo para no perder las sesiones históricas que ya la referencian. */
        ejercicioRepository.findByTitulo("Oraciones simples").ifPresent(e -> {
            if (!Boolean.TRUE.equals(e.getActivo())) {
                e.setActivo(true);
                ejercicioRepository.save(e);
                log.info("Ejercicio reactivado: Oraciones simples");
            }
        });

        crearSiNoExiste("Oraciones con mayúsculas", "Las mismas oraciones, ahora con mayúsculas y puntuación real.",
                TipoEjercicio.ORACIONES_MAYUSCULAS, null, 7);

        crearSiNoExiste("Palabras confusas", "Homófonos y palabras que se confunden al escribir (tubo/tuvo, haya/halla).",
                TipoEjercicio.PALABRAS_CONFUSAS, null, 8);

        /* La descripción original ("el texto no se ve mientras escribes") no describía lo
           que el ejercicio hace de verdad: el texto SÍ se ve completo desde el inicio —
           lo que se oculta es el color de acierto/error, y recién al terminar se revela
           coloreado. Corregida acá.
           "ocultarCursor" decide si además se ve el parpadeo de dónde estás parado: en
           esta versión (pensada para intermedio) sí se ve, como ayuda; la variante de
           abajo lo apaga también, para avanzar a ciegas de verdad. */
        crearSiNoExiste("Modo ciego total", "El texto se ve completo, pero no sabrás si aciertas o fallas hasta el final. El cursor te ayuda a ubicarte.",
                TipoEjercicio.MODO_CIEGO, "{\"ocultarCursor\":false}", 9);

        crearSiNoExiste("Modo ciego sin cursor", "Igual que el anterior, pero tampoco ves dónde estás parado: avanzas del todo a ciegas.",
                TipoEjercicio.MODO_CIEGO, "{\"ocultarCursor\":true}", 20);

        crearSiNoExiste("Maratón de símbolos", "Los caracteres más incómodos del teclado: { } [ ] # $ ! % ( ) < > / \\ - _ =",
                TipoEjercicio.SIMBOLOS_CRITICOS,
                "{\"simbolos\":[\"{\",\"}\",\"[\",\"]\",\"#\",\"$\",\"!\",\"%\",\"(\",\")\",\"<\",\">\",\"/\",\"\\\\\",\"-\",\"_\",\"=\"]}",
                10);

        /* El reparto es el del tecleo al tacto: cada mano cubre su mitad del teclado.
           Vive acá y no en el código para poder ajustarlo sin recompilar.

           "ancla" es la tecla donde debe descansar la mano que NO está escribiendo —
           la posición de reposo estándar de esa mano en el teclado al tacto (F para la
           izquierda, J para la derecha). El frontend exige mantenerla presionada
           mientras dura el ejercicio: si se suelta, el tecleo se bloquea hasta que
           vuelva a apoyarse. Sin esto, nada impedía "hacer trampa" ayudándose con la
           mano que se supone que no participa. */
        crearSiNoExiste("Modo una mano", "Palabras que se escriben completas con una sola mano. La otra debe quedarse quieta, apoyada en su tecla de reposo.",
                TipoEjercicio.MODO_UNA_MANO,
                "{\"manos\":["
                        + "{\"id\":\"izquierda\",\"nombre\":\"Mano izquierda\",\"letras\":\"qwertasdfgzxcvb\",\"ancla\":\"j\"},"
                        + "{\"id\":\"derecha\",\"nombre\":\"Mano derecha\",\"letras\":\"yuiophjklñnm\",\"ancla\":\"f\"}"
                        + "]}",
                14);

        crearSiNoExiste("Palabras mutantes", "Las palabras se apilan una encima de otra: no hay pausa entre ellas.",
                TipoEjercicio.PALABRAS_MUTANTES, null, 11);

        crearSiNoExiste("Dictado de voz", "Escuchas la oración y la escribes sin verla en pantalla.",
                TipoEjercicio.DICTADO_VOZ, "{\"modo\":\"tts\",\"wpmObjetivo\":60}", 12);

        crearSiNoExiste("Dictado con audio real", "Igual que el anterior, pero con un audio grabado de verdad.",
                TipoEjercicio.DICTADO_VOZ, "{\"modo\":\"archivo\"}", 13);

        /* --- Los 4 tipos nuevos del futuro Curso por niveles. Se siembran sin nivel
           (quedan en "Ejercicios Base") para probarse sueltos antes de encajarlos en un
           nivel/bloque en una pasada aparte. --- */

        crearSiNoExiste("Un solo dedo", "Practica cada dedo por separado, sin apoyo de los vecinos.",
                TipoEjercicio.UN_DEDO,
                "{\"dedos\":["
                        + "{\"id\":\"menique_izq\",\"nombre\":\"Meñique izquierdo\",\"letras\":\"qaz\"},"
                        + "{\"id\":\"anular_izq\",\"nombre\":\"Anular izquierdo\",\"letras\":\"wsx\"},"
                        + "{\"id\":\"medio_izq\",\"nombre\":\"Medio izquierdo\",\"letras\":\"edc\"},"
                        + "{\"id\":\"indice_izq\",\"nombre\":\"Índice izquierdo\",\"letras\":\"rfvtgb\"},"
                        + "{\"id\":\"indice_der\",\"nombre\":\"Índice derecho\",\"letras\":\"yhnujm\"},"
                        + "{\"id\":\"medio_der\",\"nombre\":\"Medio derecho\",\"letras\":\"ik\"},"
                        + "{\"id\":\"anular_der\",\"nombre\":\"Anular derecho\",\"letras\":\"ol\"},"
                        + "{\"id\":\"menique_der\",\"nombre\":\"Meñique derecho\",\"letras\":\"pñ\"}"
                        + "]}",
                15);

        crearSiNoExiste("Palabras con mano forzada", "Casi todas las letras caen en una mano, con 1-2 alcances hacia la otra.",
                TipoEjercicio.UNA_MANO_FORZADA,
                "{\"modo\":\"palabras\",\"manos\":["
                        + "{\"id\":\"izquierda\",\"nombre\":\"Mano izquierda\",\"letras\":\"qwertasdfgzxcvb\"},"
                        + "{\"id\":\"derecha\",\"nombre\":\"Mano derecha\",\"letras\":\"yuiophjklñnm\"}"
                        + "]}",
                16);

        crearSiNoExiste("Oraciones con mano forzada", "Frases cortas donde casi todo el tecleo cae en una mano.",
                TipoEjercicio.UNA_MANO_FORZADA,
                "{\"modo\":\"oraciones\",\"manos\":["
                        + "{\"id\":\"izquierda\",\"nombre\":\"Mano izquierda\",\"letras\":\"qwertasdfgzxcvb\"},"
                        + "{\"id\":\"derecha\",\"nombre\":\"Mano derecha\",\"letras\":\"yuiophjklñnm\"}"
                        + "]}",
                17);

        crearSiNoExiste("Shift lateral", "Mayúsculas de ambas manos: cada letra exige el Shift del lado contrario.",
                TipoEjercicio.SHIFT_LATERAL,
                "{\"manos\":["
                        + "{\"id\":\"izquierda\",\"nombre\":\"Mano izquierda\",\"letras\":\"qwertasdfgzxcvb\"},"
                        + "{\"id\":\"derecha\",\"nombre\":\"Mano derecha\",\"letras\":\"yuiophjklñnm\"}"
                        + "]}",
                18);

        crearSiNoExiste("Resistencia", "Un texto largo para medir si tu rendimiento cae con el cansancio.",
                TipoEjercicio.RESISTENCIA, null, 19);

        crearSiNoExiste("Lluvia de letras", "Las letras caen en columnas: tecleá la que está más abajo antes de que aterrice. Si una columna se llena, se acaba.",
                TipoEjercicio.LLUVIA_LETRAS, "{\"modo\":\"letras\"}", 22);

        crearSiNoExiste("Lluvia de letras (avanzado)", "Empieza con letras sueltas y pasa a palabras cortas cayendo.",
                TipoEjercicio.LLUVIA_LETRAS, "{\"modo\":\"avanzado\"}", 23);
    }

    /* --- Catálogo del Curso por niveles: filas propias, con nivel/bloque/orden. ---
       "Fundamentos de teclado" en Ejercicios Base es UNA fila con 8 pasos por fila
       (sub-selector). Acá cada paso es su propia fila — el usuario lo pidió así porque
       en la secuencia guiada cada paso debe ser su propio nodo del sendero, no algo que
       se elige a mano dentro de un mismo ejercicio. Reutiliza generarLetrasBasico tal
       cual: con una sola fila y un solo paso en la config, cae directo ahí sin
       necesitar `grupo`.
       El `orden` dentro de cada nivel deja huecos a propósito (4, 8, 16, 20, 28, 32 en
       Básico) — esos números están reservados para los "Lluvia de letras" cortitos de
       calentamiento que van entre pasos, sembrados en una pasada aparte. */
    @Override
    @Transactional
    public void sembrarCatalogoCurso() {
        sembrarFundamentosCurso();
        sembrarRestoDeBasicoCurso();
        sembrarPalabrasDeFilaCurso();
        sembrarPalabrasFlotantesCurso();
        sembrarReutilizadosIntermedioCurso();
        sembrarReutilizadosAvanzadoCurso();
        sembrarContenidoNuevoIntermedioCurso();
        sembrarContenidoNuevoAvanzadoCurso();
        sembrarInfraCurso();
        /* Al final de todo: marca inactivo lo que ya no forma parte del plan. Va después
           de sembrar y no antes porque algunos títulos retirados podrían volver a crearse
           si estuvieran todavía en alguna lista — así el último en hablar es el retiro. */
        retirarDelCurso();
    }

    /* Los últimos huecos: no son contenido para redactar, son filtros/lógica sobre
       datos que ya existen (diccionario o historial propio). "Palabras extensas" usa
       el patrón genérico de generarPalabrasDeFila (ver ese método). */
    private void sembrarInfraCurso() {
        /* ⚠️ REPENSADO el 15-sep-2026: solo con la fila central quedaba redundante con "Top
           palabras comunes" — las dos sirven palabras frecuentes sin ningún eje propio. Se
           movió al PRIMER lugar del nivel y pasó a "filasPorTanda": tres tandas, una por
           fila (central → superior → inferior), como repaso de por dónde entra cada letra
           justo al arrancar Intermedio. Umbrales medidos contra el diccionario real (ver
           la nota en generarPorFilasEnTandas): 72/70/40, del más alto que sostiene cada
           fila para arriba de esa altura ya no queda pool. */
        crearEnCursoSiNoExiste("Palabras por línea", "Un repaso rápido: primero la fila central, después la de arriba, después la de abajo.",
                TipoEjercicio.PALABRAS_DE_FILA,
                "{\"filasPorTanda\":["
                        + "{\"letras\":\"asdfghjklñ\",\"dominancia\":72},"
                        + "{\"letras\":\"qwertyuiop\",\"dominancia\":70},"
                        + "{\"letras\":\"zxcvbnm\",\"dominancia\":40}"
                        + "],\"cantidad\":10,\"porTandas\":true,"
                        + "\"introTexto\":\"Tres tandas cortas, una por fila del teclado: primero la fila "
                        + "central, después la de arriba, y por último la de abajo — la que menos vocales "
                        + "tiene, así que sus palabras se sienten distintas.\"}",
                NivelCurso.INTERMEDIO, 1, 1);

        /* ⚠️ REESCRITO el 15-sep-2026: la alternancia mezclada (rr|ll|cc|nn|mm) en una
           sola tanda de 30 se diluía — medido contra el diccionario real: rr=138, ll=229,
           cc=33, y nn/mm=0 (CERO: no hay ninguna palabra con esas letras en el diccionario,
           así que la descripción vieja mentía). Con la mezcla por frecuencia, el top 30
           salía ~18 `ll`, ~9 `rr` y apenas 2 `cc`. Mismo mecanismo que "Patrones de la
           mano izquierda/derecha" (generarPorPatronesEnTandas): una tanda por patrón, así
           `cc` no se ahoga en el más frecuente. Sin nn/mm — no existen en el diccionario.
           ⚠️ Sin `introTexto` a propósito, como en "Patrones de..." — con los dos juntos,
           la ventana genérica de introTexto gana en el render (viene antes en la cadena de
           ternarios) y tapa el anuncio "Ahora: 'rr'" de la primera tanda, que es
           justamente lo que hace que las tres tandas se distingan entre sí. */
        crearEnCursoSiNoExiste("Palabras con doble consonante", "Rr, ll, cc — la letra que se repite pide un golpe extra de dedo.",
                TipoEjercicio.PALABRAS_DE_FILA,
                "{\"patronesPorTanda\":[\"rr\",\"ll\",\"cc\"],\"cantidad\":10,\"porTandas\":true}",
                NivelCurso.INTERMEDIO, 1, 4);

        /* Tutorial agregado el 15-sep-2026, a pedido del usuario: dos palabras reales por
           cada vocal con tilde (10 ítems fijos, ver `teclasTutorial`) antes de que empiecen
           a salir al azar del diccionario. `introTexto` se sacó porque con `teclasTutorial`
           presente ya no se llega a mostrar (ese branch gana antes en el render) — habría
           quedado como config muerta. */
        crearEnCursoSiNoExiste("Práctica de tildes", "Solo palabras con alguna vocal acentuada.",
                TipoEjercicio.PALABRAS_DE_FILA,
                "{\"patron\":\"[áéíóú]\","
                        + "\"teclasTutorial\":[\"está\",\"además\",\"también\",\"café\",\"así\",\"país\","
                        + "\"corazón\",\"avión\",\"único\",\"música\"],"
                        + "\"mensajeTutorial\":\"Dos palabras por cada vocal con tilde, antes de que empiecen "
                        + "a salir al azar.\","
                        + "\"captionsTutorial\":[\"Con á\",\"Con á\",\"Con é\",\"Con é\",\"Con í\",\"Con í\","
                        + "\"Con ó\",\"Con ó\",\"Con ú\",\"Con ú\"]}",
                NivelCurso.INTERMEDIO, 1, 10);

        /* Palabras en -ción / -mente: el mismo espíritu que doble consonante o
           tildes —una combinación fija se repite en varias palabras reales—
           pero por SUFIJO. "ción$" atrapa también "-cción" (acción, colección,
           bendición terminan las tres en las mismas 4 letras). Pedido del
           usuario tras ver que TypingClub arma lecciones enteras sobre
           patrones frecuentes, no solo el REPASO_FALLADAS personalizado. */
        crearEnCursoSiNoExiste("Palabras en -ción", "Acción, colección, bendición: todas terminan igual.",
                TipoEjercicio.PALABRAS_DE_FILA,
                "{\"patron\":\"ción$\",\"cantidad\":20,\"introTexto\":\"Todas estas palabras terminan igual, "
                        + "en -ción: acción, colección, información...\"}",
                NivelCurso.INTERMEDIO, 1, 12);

        crearEnCursoSiNoExiste("Palabras en -mente", "Rápidamente, claramente, finalmente: el sufijo más repetido de los adverbios.",
                TipoEjercicio.PALABRAS_DE_FILA,
                "{\"patron\":\"mente$\",\"cantidad\":15,\"introTexto\":\"Estas son palabras largas que "
                        + "terminan en -mente: rápidamente, claramente, finalmente...\"}",
                NivelCurso.INTERMEDIO, 1, 13);

        /* ⚠️ REESCRITO el 13-sep-2026: "Patrones de una mano" mezclaba las 9 combinaciones
           de las dos manos en una sola tanda de 30 palabras al azar — el usuario notó que
           así nunca "se siente" que se repite ninguna, se diluyen entre sí. Ahora es UNA
           TANDA POR PATRÓN ("patronesPorTanda", ver generarPorPatronesEnTandas), y el
           frente anuncia en una ventana cuál viene antes de cada una. Se partió en dos
           nodos, uno por mano, porque cada uno ya trae sus 3 tandas propias.

           Los 3 patrones de cada mano se eligieron consultando el diccionario real, no a
           ojo: "uno" (el ejemplo original de mano derecha) solo tenía 6 coincidencias en
           todo el diccionario y se habría repetido todo el tiempo. Con esto, cantidades
           reales medidas:
             ser  → 38 (ser, será, serio, sería, servicio, serpiente, reserva, miserable)
             des  → 108 (después, desde, deseo, destino, despierta, desastre, descanso)
             car  → 69 (cariño, cara, buscar, carta, carrera, carne, cargo, sacar, tocar)
             mon  → 22 (demonios, montón, matrimonio, monstruo, montaña, mono, moneda)
             pol  → 11 (policía, política, pollo, polvo, político, policial, polo)
             mil  → 20 (familia, millones, mil, miles, millón, militar, milagro, similar)

           El título viejo va a RETIRADOS_DEL_CURSO. */
        crearEnCursoSiNoExiste("Patrones de la mano izquierda", "Ser, des, car: la misma combinación se repite en toda la tanda, sin cruzar de mano.",
                TipoEjercicio.PALABRAS_DE_FILA,
                "{\"patronesPorTanda\":[\"ser\",\"des\",\"car\"],\"cantidad\":10,\"porTandas\":true}",
                NivelCurso.INTERMEDIO, 2, 16);

        crearEnCursoSiNoExiste("Patrones de la mano derecha", "Mon, pol, mil: la misma combinación se repite en toda la tanda, sin cruzar de mano.",
                TipoEjercicio.PALABRAS_DE_FILA,
                "{\"patronesPorTanda\":[\"mon\",\"pol\",\"mil\"],\"cantidad\":10,\"porTandas\":true}",
                NivelCurso.INTERMEDIO, 2, 17);

        // orden 20: "Palabras mutantes" se corrió antes de la Lluvia el 14-sep-2026 (ver
        // esa nota), así que esta pasó a ocupar el hueco que dejó.
        crearEnCursoSiNoExiste("Palabras extensas", "Palabras de diez letras o más, del diccionario real.",
                TipoEjercicio.PALABRAS_DE_FILA,
                "{\"patron\":\".{10,}\",\"cantidad\":12,\"introTexto\":\"Estas palabras tienen diez letras o "
                        + "más: son las más largas del diccionario, y aparecen en un orden distinto cada vez.\"}",
                NivelCurso.INTERMEDIO, 2, 21);

    }

    /* Los nodos de Intermedio que necesitan contenido propio en ContenidoCurado
       (a diferencia de sembrarReutilizadosIntermedioCurso, que no escribe banco
       propio, o sembrarInfraCurso, que tira del diccionario). Los de "oraciones"
       usan ORACIONES_TEMATICAS; los de "texto" (más largos, un solo ítem por
       sesión, o dos con "bancoTandas") reusan RESISTENCIA con configuracion.banco.
       Sumó 7 nodos el 12-sep-2026: dos Respiro, Documentos simples, Números/
       fechas/porcentajes y los tres de signos (¿...? y /). */
    private void sembrarContenidoNuevoIntermedioCurso() {
        /* Renombrado el 13-sep-2026: junto a "El punto y coma" (o7), "Oraciones con
           signos" no decía cuál — es coma y punto, el ritmo de parar y seguir.
           ⚠️ Config sumada el mismo día: mismo problema que tenía "El punto y coma" —
           6 oraciones de intermedio_signos corridas con un espacio, un párrafo largo con
           ideas sin relación entre sí. Ahora una ventana explica el eje del nodo antes de
           empezar, y porTandas + cantidad:2 lo parte en dos frases, una a la vez. */
        crearEnCursoSiNoExiste("Pausas y enumeraciones", "Mayúsculas, comas y puntos — el ritmo de parar y seguir.",
                TipoEjercicio.ORACIONES_TEMATICAS,
                "{\"banco\":\"intermedio_signos\",\"porTandas\":true,\"cantidad\":2,"
                        + "\"introTexto\":\"La coma y el punto son las pausas que le dan ritmo a una frase: "
                        + "saber dónde van es tan importante como saber teclearlas.\"}",
                NivelCurso.INTERMEDIO, 1, 8);

        /* ⚠️ Config sumada el 13-sep-2026: mismo problema que "El punto y coma" y "Pausas
           y enumeraciones" — 6 oraciones de temas sin relación, corridas con un espacio.
           porTandas + cantidad:2 lo parte en dos frases, una a la vez. */
        crearEnCursoSiNoExiste("Oraciones con tildes y acentos", "Tildes y ñ sin límite, a propósito.",
                TipoEjercicio.ORACIONES_TEMATICAS,
                "{\"banco\":\"intermedio_tildes\",\"porTandas\":true,\"cantidad\":2}",
                NivelCurso.INTERMEDIO, 1, 11);

        /* ⚠️ "(Intermedio)" en el título no es decorativo: Avanzado YA TIENE un
           "Respiro I" (su propia serie I-VII). El sembrado busca por título —
           llamar a este nodo igual habría repurposeado esa fila de Avanzado
           hacia Intermedio en silencio (la trampa de la sección 8).
           ⚠️ `cantidad:1` sumado el 13-sep-2026: el banco pasó de 15 datos sueltos a
           2 párrafos cohesivos (ver ORACIONES_ERGONOMIA) — sin esto seguiría juntando
           los dos con un espacio, el mismo problema que se quería resolver. */
        crearEnCursoSiNoExiste("Respiro (Intermedio) I", "Unas líneas tranquilas para bajar el ritmo antes de seguir.",
                TipoEjercicio.ORACIONES_TEMATICAS,
                "{\"banco\":\"ergonomia\",\"cantidad\":1,\"introTexto\":\"Una pausa: un solo texto, sin prisa. "
                        + "No se aprende ninguna tecla nueva acá.\"}",
                NivelCurso.INTERMEDIO, 2, 23);

        crearEnCursoSiNoExiste("Textos de 1 a 2 minutos", "Un texto más largo, de corrido, sin pausas entre oraciones.",
                TipoEjercicio.RESISTENCIA,
                "{\"banco\":\"intermedio_textos\",\"introTexto\":\"Un texto largo, de un minuto o dos de "
                        + "escritura, sin cortes entre oraciones — para practicar sostener el ritmo.\"}",
                NivelCurso.INTERMEDIO, 2, 24);

        // porTandas + cantidad:3 sumado el 14-sep-2026: 6 oraciones corridas con un
        // espacio eran demasiadas juntas. Ahora 3 tandas, una oración a la vez.
        crearEnCursoSiNoExiste("Ráfagas de palabras largas", "Oraciones armadas a propósito con palabras largas y complejas.",
                TipoEjercicio.ORACIONES_TEMATICAS,
                "{\"banco\":\"intermedio_palabras_largas\",\"porTandas\":true,\"cantidad\":3}",
                NivelCurso.INTERMEDIO, 2, 25);

        /* Documentos simples: dos tandas, una carta y un aviso — cada una sale de
           su propia bolsa (ver ContenidoCurado y "bancoTandas" en
           generarResistencia) para que la combinación no salga siempre igual.
           El memo y el formulario, más estructurados, van en Avanzado.
           ⚠️ Movido del bloque 3 al 2 el 15-sep-2026: a pedido del usuario, el bloque 3
           queda reservado para fechas/números → signos → cierre del nivel. */
        crearEnCursoSiNoExiste("Documentos simples", "Una carta formal y un aviso de oficina, uno detrás del otro.",
                TipoEjercicio.RESISTENCIA,
                "{\"bancoTandas\":[\"intermedio_doc_carta\",\"intermedio_doc_aviso\"],"
                        + "\"introTexto\":\"Vas a escribir dos documentos cortos, uno después del otro: una "
                        + "carta formal y un aviso de oficina.\"}",
                NivelCurso.INTERMEDIO, 2, 26);

        /* NUEVO el 15-sep-2026, justo ANTES de "Cómo escribir una fecha": por si alguien
           llegó a Intermedio sin pasar por Básico, acá no hay NADA de dígitos sueltos
           todavía, y "Cómo escribir una fecha" ya asume que la fila de números no es
           totalmente nueva. Reusa TAL CUAL generarProgresionNumerica — el mismo generador
           y el mismo tutorial de "Fila de números" (Básico), dedo por dedo — porque es
           exactamente el mismo contenido que haría falta reconstruir. */
        crearEnCursoSiNoExiste("Números sueltos", "Los diez dígitos: primero de a uno, con el dedo que le toca a cada uno.",
                TipoEjercicio.SIMBOLOS_CRITICOS,
                "{\"simbolos\":[\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\",\"9\",\"0\"],"
                        + "\"progresionNumerica\":true,\"porTandas\":true,\"tutorialPalabras\":10,"
                        + "\"mensajeTutorial\":\"Cada número tiene su propio dedo\","
                        + "\"captionsTutorial\":[\"Meñique izquierdo\",\"Anular izquierdo\",\"Medio izquierdo\","
                        + "\"Índice izquierdo\",\"Índice izquierdo\",\"Índice derecho\",\"Índice derecho\","
                        + "\"Medio derecho\",\"Anular derecho\",\"Meñique derecho\"]}",
                NivelCurso.INTERMEDIO, 3, 27);

        /* Nuevo el 14-sep-2026, justo ANTES de "Números, fechas y porcentajes": ese nodo
           ya mezcla fechas dentro de oraciones, pero nunca enseña el FORMATO en sí — el
           día, la palabra "de" y el mes, en ese orden, sin pensarlo. Mismo patrón que
           "Fila de números" (6.15, punto 8): un tutorial fijo primero, después tandas
           cada vez más aplicadas. "bancoTandas" arma las 4 (dos de fechas sueltas, dos
           con la fecha ya metida en una oración) sacando cada una de su propia bolsa —
           ver generarResistencia y las notas junto a los bancos en ContenidoCurado. */
        crearEnCursoSiNoExiste("Cómo escribir una fecha", "El día, el mes y el año, en el orden y la forma que se usan de verdad.",
                TipoEjercicio.RESISTENCIA,
                "{\"bancoTandas\":[\"intermedio_fecha_lista1\",\"intermedio_fecha_lista2\","
                        + "\"intermedio_fecha_oracion1\",\"intermedio_fecha_oracion2\"],"
                        + "\"teclasTutorial\":[\"15\",\"de\",\"marzo\",\"de\",\"2024\"],"
                        + "\"mensajeTutorial\":\"Así se escribe una fecha completa: el día, la palabra 'de', el mes y el año.\"}",
                NivelCurso.INTERMEDIO, 3, 28);

        /* "porTandas":true + "cantidad":3 agregados el 15-sep-2026: sin ellos, las 6
           oraciones por defecto se unían con un simple espacio — un solo bloque, "todas
           apiladas" (el usuario lo notó). Mismo arreglo que ya tiene "Ráfagas de palabras
           largas": 3 oraciones, cada una su propia tanda con destello entre medio. */
        crearEnCursoSiNoExiste("Números, fechas y porcentajes", "Fechas simples, horas en punto y porcentajes redondos.",
                TipoEjercicio.ORACIONES_TEMATICAS,
                "{\"banco\":\"intermedio_numeros\",\"porTandas\":true,\"cantidad\":3,\"introTexto\":\"Fechas, horas y porcentajes simples, "
                        + "mezclados con el texto — sin decimales ni símbolos de moneda todavía.\"}",
                NivelCurso.INTERMEDIO, 3, 29);

        /* ⚠️ REORDENADO el 14-sep-2026: antes iba DESPUÉS de "Oraciones con interrogación y
           exclamación", pero el usuario pidió el orden inverso — la mecánica aislada
           (preguntas cortas) primero, la aplicación en frase completa después. Es el mismo
           patrón que ya usan tildes ("Práctica de tildes" → "Oraciones con tildes") y el
           punto y coma. También se acortó: cada ítem del banco ya trae 4 preguntas, así que
           `cantidad:3` da 12 en total (antes 6 ítems = 24) — más cerca de lo que pidió el
           usuario ("unas 10") sin tocar el banco. */
        crearEnCursoSiNoExiste("Palabras con signos ¿...?", "¿Quién? ¿Qué? ¿Cuándo? — preguntas cortas, una detrás de otra.",
                TipoEjercicio.ORACIONES_TEMATICAS,
                "{\"banco\":\"intermedio_signos_pregunta\",\"cantidad\":3,"
                        + "\"introTexto\":\"Estas son preguntas cortas, no oraciones completas: el foco está "
                        + "en la apertura ¿, que en español no existe en ningún otro idioma.\"}",
                NivelCurso.INTERMEDIO, 3, 30);

        /* NUEVO el 15-sep-2026: el espejo exacto del anterior, con ¡exclamación! — mismo
           motivo de orden, antes de "Oraciones con interrogación y exclamación" y no
           después, para no pedir un signo dentro de una oración completa antes de haberlo
           practicado suelto. Ver ORACIONES_INTERMEDIO_SIGNOS_EXCLAMACION. */
        crearEnCursoSiNoExiste("Palabras con exclamación", "¡Cuidado! ¡Vamos! ¡Increíble! — exclamaciones cortas, una detrás de otra.",
                TipoEjercicio.ORACIONES_TEMATICAS,
                "{\"banco\":\"intermedio_signos_exclamacion\",\"cantidad\":3,"
                        + "\"introTexto\":\"Igual que con las preguntas: exclamaciones cortas, no oraciones "
                        + "completas. El foco está en la apertura ¡, que tampoco existe en otros idiomas.\"}",
                NivelCurso.INTERMEDIO, 3, 31);

        crearEnCursoSiNoExiste("Oraciones con interrogación y exclamación", "¿Preguntas? ¡Y exclamaciones! Los signos de apertura son la parte nueva.",
                TipoEjercicio.ORACIONES_TEMATICAS,
                "{\"banco\":\"intermedio_exclamacion\",\"introTexto\":\"Ahora la apertura ¿ y ¡ dentro de "
                        + "oraciones completas, no sueltas como en los dos ejercicios anteriores.\"}",
                NivelCurso.INTERMEDIO, 3, 32);

        crearEnCursoSiNoExiste("Palabras con el signo /", "Sí/no, arriba/abajo: el formato real de formularios y avisos.",
                TipoEjercicio.ORACIONES_TEMATICAS,
                "{\"banco\":\"intermedio_signo_diagonal\",\"introTexto\":\"El signo / se usa todo el tiempo en "
                        + "formularios y avisos, para dar dos opciones a la vez: sí/no, arriba/abajo.\"}",
                NivelCurso.INTERMEDIO, 3, 33);

        crearEnCursoSiNoExiste("Oración con el signo /", "El mismo signo, ahora dentro de una frase completa.",
                TipoEjercicio.ORACIONES_TEMATICAS,
                "{\"banco\":\"intermedio_diagonal_frase\",\"porTandas\":true,\"cantidad\":2}",
                NivelCurso.INTERMEDIO, 3, 34);

        crearEnCursoSiNoExiste("Textos cortos con ¿? y ¡!", "Un texto breve, cargado de preguntas y exclamaciones.",
                TipoEjercicio.RESISTENCIA,
                "{\"banco\":\"intermedio_textos_exclamacion\",\"introTexto\":\"Un texto corto, con varias "
                        + "preguntas y exclamaciones seguidas — el mismo eje de los últimos ejercicios, ahora "
                        + "en un párrafo completo.\"}",
                NivelCurso.INTERMEDIO, 3, 35);

        // Postura y descanso, segunda aparición — antes del tramo final del nivel.
        // Mismo cantidad:1 que Respiro I, ver esa nota.
        crearEnCursoSiNoExiste("Respiro (Intermedio) II", "Unas líneas tranquilas para bajar el ritmo antes de seguir.",
                TipoEjercicio.ORACIONES_TEMATICAS,
                "{\"banco\":\"ergonomia\",\"cantidad\":1,\"introTexto\":\"Otra pausa: un solo texto, sin prisa. "
                        + "No se aprende ninguna tecla nueva acá.\"}",
                NivelCurso.INTERMEDIO, 3, 37);
    }

    /* Los 7 huecos de Avanzado que necesitaban contenido nuevo. "Oraciones con números
       y fechas" y "Fechas e importes cortos" comparten el mismo banco (avanzado_numeros):
       son la misma dificultad, solo se repite el ejercicio más adelante en el nivel. */
    private void sembrarContenidoNuevoAvanzadoCurso() {
        crearEnCursoSiNoExiste("Oraciones con números y fechas", "Fechas, horas, montos y porcentajes mezclados con el texto.",
                TipoEjercicio.ORACIONES_TEMATICAS, "{\"banco\":\"avanzado_numeros\"}", NivelCurso.AVANZADO, 1, 2);

        crearEnCursoSiNoExiste("Simulación de correos", "Un correo formal completo: saludo, cuerpo y despedida.",
                TipoEjercicio.RESISTENCIA, "{\"banco\":\"avanzado_correos\"}", NivelCurso.AVANZADO, 1, 7);

        crearEnCursoSiNoExiste("Fechas e importes cortos", "Repaso corto de fechas, horas y montos.",
                TipoEjercicio.ORACIONES_TEMATICAS, "{\"banco\":\"avanzado_numeros\"}", NivelCurso.AVANZADO, 1, 9);

        crearEnCursoSiNoExiste("Oraciones con textos tediosos", "Registro formal y burocrático, denso a propósito.",
                TipoEjercicio.ORACIONES_TEMATICAS, "{\"banco\":\"avanzado_tediosas\"}", NivelCurso.AVANZADO, 1, 11);

        crearEnCursoSiNoExiste("Oraciones con palabras en inglés", "Préstamos del inglés como se usan de verdad, en tono relajado.",
                TipoEjercicio.ORACIONES_TEMATICAS, "{\"banco\":\"avanzado_ingles\"}", NivelCurso.AVANZADO, 2, 12);

        crearEnCursoSiNoExiste("Textos de dificultad media", "Un párrafo técnico, de corrido, sin pausas entre oraciones.",
                TipoEjercicio.RESISTENCIA, "{\"banco\":\"avanzado_textos_medios\"}", NivelCurso.AVANZADO, 2, 20);

        crearEnCursoSiNoExiste("Textos largos (fatiga)", "Un texto largo para medir si el rendimiento cae hacia el final.",
                TipoEjercicio.RESISTENCIA, "{\"banco\":\"avanzado_textos_largos\"}", NivelCurso.AVANZADO, 3, 28);
    }

    /* Avanzado (31 ítems: Bloque 1 = 1-11, Bloque 2 = 12-21, Bloque 3 = 22-31). Mismo
       criterio de "cero código nuevo" que Intermedio. Dos ajustes sobre el borrador
       original, charlados con el usuario:
       - Los 7 "Respiro" (líneas tranquilas entre ejercicios duros) SÍ se siembran tal
         cual: son solo texto (reutilizan ORACIONES_MAYUSCULAS), no hacía falta
         recortarlos.
       - Lluvia de letras y Palabras mutantes NO varían entre sus repeticiones (mismo
         config que su versión de Intermedio) — a pedido explícito, por ahora no vale
         la pena construir una escala de dificultad propia para estos dos. Diferenciar
         más Intermedio de Avanzado en estos dos queda pendiente para más adelante.
       - Se cae la segunda repetición de "Palabras flotantes" del borrador original
         (iba en bloque 3): con la instancia que ya está en bloque 2 (orden 14)
         alcanza, duplicarla no aportaba nada distinto.

       ⚠️ El orden 16 dejó de ser un número muerto el 12-sep-2026: lo ocupa
       "Documentos de oficina (Avanzado)", el compañero de "Documentos simples"
       de Intermedio. El comentario viejo de este método listaba once "huecos"
       (1, 2, 7, 9, 11, 12, 16, 20, 28, 30, 31); salvo el 1 (Test de Nivel), el
       30 (número muerto real, ver CLAUDE.md 6.5) y el 31 (Test Final), todos
       los demás ya estaban sembrados por `sembrarContenidoNuevoAvanzadoCurso`
       — el comentario había quedado desactualizado y nadie lo había notado. */
    private void sembrarReutilizadosAvanzadoCurso() {
        crearEnCursoSiNoExiste("Modo ciego sin cursor (Avanzado)", "Igual que el anterior, pero tampoco ves dónde estás parado: avanzas del todo a ciegas.",
                TipoEjercicio.MODO_CIEGO, "{\"ocultarCursor\":true}", NivelCurso.AVANZADO, 1, 3);

        crearEnCursoSiNoExiste("Respiro I", "Unas líneas tranquilas para bajar el ritmo antes de seguir.",
                TipoEjercicio.ORACIONES_MAYUSCULAS, null, NivelCurso.AVANZADO, 1, 4);

        crearEnCursoSiNoExiste("Contrarreloj sin margen", "Cada tecla errónea resta al instante, no al cerrar la palabra: no hay margen para corregir sin costo.",
                TipoEjercicio.CONTRARRELOJ,
                "{\"tiempoInicialSegundos\":30,\"bonusCorrectaSegundos\":0.5,\"penalizacionErrorSegundos\":0.5,\"penalizacionPorTecla\":true}",
                NivelCurso.AVANZADO, 1, 5);

        crearEnCursoSiNoExiste("Respiro II", "Unas líneas tranquilas para bajar el ritmo antes de seguir.",
                TipoEjercicio.ORACIONES_MAYUSCULAS, null, NivelCurso.AVANZADO, 1, 6);

        crearEnCursoSiNoExiste("Palabras mutantes (Avanzado)", "Las palabras se apilan una encima de otra: no hay pausa entre ellas.",
                TipoEjercicio.PALABRAS_MUTANTES, null, NivelCurso.AVANZADO, 1, 8);

        crearEnCursoSiNoExiste("Modo una mano (Avanzado)", "Palabras que se escriben completas con una sola mano. La otra debe quedarse quieta, apoyada en su tecla de reposo.",
                TipoEjercicio.MODO_UNA_MANO,
                "{\"manos\":["
                        + "{\"id\":\"izquierda\",\"nombre\":\"Mano izquierda\",\"letras\":\"qwertasdfgzxcvb\",\"ancla\":\"j\"},"
                        + "{\"id\":\"derecha\",\"nombre\":\"Mano derecha\",\"letras\":\"yuiophjklñnm\",\"ancla\":\"f\"}"
                        + "]}",
                NivelCurso.AVANZADO, 1, 10);

        crearEnCursoSiNoExiste("Dictado avanzado", "Escuchas la oración y la escribes sin verla en pantalla, a un ritmo más alto.",
                TipoEjercicio.DICTADO_VOZ, "{\"modo\":\"tts\",\"wpmObjetivo\":70}", NivelCurso.AVANZADO, 2, 13);

        crearEnCursoSiNoExiste("Respiro III", "Unas líneas tranquilas para bajar el ritmo antes de seguir.",
                TipoEjercicio.ORACIONES_MAYUSCULAS, null, NivelCurso.AVANZADO, 2, 15);

        /* El compañero de "Documentos simples" (Intermedio): mismo mecanismo de
           2 tandas con "bancoTandas" (ver generarResistencia), pero con los dos
           formatos más estructurados — memo con etiquetas y formulario con
           campos en blanco — en vez de la carta y el aviso más simples. */
        crearEnCursoSiNoExiste("Documentos de oficina (Avanzado)", "Un memo interno y un formulario con campos, uno detrás del otro.",
                TipoEjercicio.RESISTENCIA, "{\"bancoTandas\":[\"avanzado_doc_memo\",\"avanzado_doc_formulario\"]}",
                NivelCurso.AVANZADO, 2, 16);

        crearEnCursoSiNoExiste("Mano forzada, oraciones (Avanzado)", "Frases cortas donde casi todo el tecleo cae en una mano.",
                TipoEjercicio.UNA_MANO_FORZADA,
                "{\"modo\":\"oraciones\",\"manos\":["
                        + "{\"id\":\"izquierda\",\"nombre\":\"Mano izquierda\",\"letras\":\"qwertasdfgzxcvb\"},"
                        + "{\"id\":\"derecha\",\"nombre\":\"Mano derecha\",\"letras\":\"yuiophjklñnm\"}"
                        + "]}",
                NivelCurso.AVANZADO, 2, 17);

        crearEnCursoSiNoExiste("Respiro IV", "Unas líneas tranquilas para bajar el ritmo antes de seguir.",
                TipoEjercicio.ORACIONES_MAYUSCULAS, null, NivelCurso.AVANZADO, 2, 18);

        crearEnCursoSiNoExiste("Contrarreloj, repaso", "Las correctas suman tiempo, las falladas lo restan.",
                TipoEjercicio.CONTRARRELOJ,
                "{\"tiempoInicialSegundos\":30,\"bonusCorrectaSegundos\":1,\"penalizacionErrorSegundos\":2}",
                NivelCurso.AVANZADO, 2, 19);

        crearEnCursoSiNoExiste("Palabras mutantes — repaso (Avanzado)", "Las palabras se apilan una encima de otra: no hay pausa entre ellas.",
                TipoEjercicio.PALABRAS_MUTANTES, null, NivelCurso.AVANZADO, 2, 21);

        crearEnCursoSiNoExiste("Maratón de símbolos (Avanzado)", "Los caracteres más incómodos del teclado: { } [ ] # $ ! % ( ) < > / \\ - _ =",
                TipoEjercicio.SIMBOLOS_CRITICOS,
                "{\"simbolos\":[\"{\",\"}\",\"[\",\"]\",\"#\",\"$\",\"!\",\"%\",\"(\",\")\",\"<\",\">\",\"/\",\"\\\\\",\"-\",\"_\",\"=\"]}",
                NivelCurso.AVANZADO, 3, 22);

        crearEnCursoSiNoExiste("Respiro V", "Unas líneas tranquilas para bajar el ritmo antes de seguir.",
                TipoEjercicio.ORACIONES_MAYUSCULAS, null, NivelCurso.AVANZADO, 3, 23);

        crearEnCursoSiNoExiste("Shift lateral (Avanzado)", "Mayúsculas de ambas manos: cada letra exige el Shift del lado contrario.",
                TipoEjercicio.SHIFT_LATERAL,
                "{\"manos\":["
                        + "{\"id\":\"izquierda\",\"nombre\":\"Mano izquierda\",\"letras\":\"qwertasdfgzxcvb\"},"
                        + "{\"id\":\"derecha\",\"nombre\":\"Mano derecha\",\"letras\":\"yuiophjklñnm\"}"
                        + "]}",
                NivelCurso.AVANZADO, 3, 24);

        crearEnCursoSiNoExiste("Respiro VI", "Unas líneas tranquilas para bajar el ritmo antes de seguir.",
                TipoEjercicio.ORACIONES_MAYUSCULAS, null, NivelCurso.AVANZADO, 3, 25);

        crearEnCursoSiNoExiste("Lluvia de letras — repaso (Avanzado)", "Empieza con letras sueltas y pasa a palabras cortas cayendo.",
                TipoEjercicio.LLUVIA_LETRAS, "{\"modo\":\"avanzado\"}", NivelCurso.AVANZADO, 3, 26);

        crearEnCursoSiNoExiste("Contrarreloj sin margen — repaso", "Cada tecla errónea resta al instante, no al cerrar la palabra: no hay margen para corregir sin costo.",
                TipoEjercicio.CONTRARRELOJ,
                "{\"tiempoInicialSegundos\":30,\"bonusCorrectaSegundos\":0.5,\"penalizacionErrorSegundos\":0.5,\"penalizacionPorTecla\":true}",
                NivelCurso.AVANZADO, 3, 27);

        crearEnCursoSiNoExiste("Respiro VII", "Unas líneas tranquilas para bajar el ritmo antes de seguir.",
                TipoEjercicio.ORACIONES_MAYUSCULAS, null, NivelCurso.AVANZADO, 3, 29);
    }

    /* Intermedio: 41 nodos en el sendero (orden 1 a 41), sin huecos deliberados.
       El que dejaban los ocho "Un dedo" retirados (14 a 20) se llenó por
       completo al sumar los nodos nuevos del 12 y 13-sep-2026 — "Patrones de la
       mano izquierda/derecha" (13-sep, split de "Patrones de una mano"), los
       dos "Respiro", "Documentos simples", "Números, fechas y porcentajes" y
       los tres nodos de signos (¿...? y /), repartidos en `sembrarInfraCurso` y
       `sembrarContenidoNuevoIntermedioCurso`. El 14-sep-2026 sumó dos más: el
       split de "Oraciones con mano forzada al 90%" en dos, y "Cómo escribir una
       fecha".

       ⚠️ REORDENADO A FONDO el 15-sep-2026, a pedido del usuario tras recorrer
       el nivel: "Palabras con la mano izquierda" pasó del bloque 1 al 2 (para
       quedar junto a su pareja de la mano derecha) y "Documentos simples" del
       bloque 3 al 2, dejando el bloque 3 dedicado a fechas/números → signos →
       cierre del nivel. "Palabras por línea" se repensó (ya no competía con
       "Top palabras comunes") y pasó al PRIMER lugar del sendero, con tres
       tandas nuevas, una por fila (ver `filasPorTanda` en generarPalabrasDeFila).
       Sumó tres nodos: "Práctica con signos" (antes de "El punto y coma" y
       "Pausas y enumeraciones", para no pedir un signo en una oración antes de
       haberlo practicado suelto), "Números sueltos" (antes de "Cómo escribir
       una fecha", por si alguien saltó Básico) y "Palabras con exclamación"
       (el espejo de "Palabras con signos ¿...?", antes de "Oraciones con
       interrogación y exclamación"). 38 + 3 = 41.

       Solo faltan el Test de Nivel (orden 0, igual que en Básico) y el Test Final. */
    private void sembrarReutilizadosIntermedioCurso() {
        crearEnCursoSiNoExiste("Top palabras comunes", "Las 100 palabras más comunes del español, ahora en oraciones reales.",
                TipoEjercicio.TOP_100_PALABRAS,
                "{\"introTexto\":\"Estas son algunas de las palabras que más se repiten al escribir en español: "
                        + "artículos, preposiciones y conjunciones cortas que aparecen en casi cualquier frase.\"}",
                NivelCurso.INTERMEDIO, 1, 2);

        /* "porTandas" agregado el 13-sep-2026: las 6 oraciones pasan de ir corridas con un
           espacio a servirse de a dos (3 tandas, el reparto por defecto de partirEnTandas).
           ⚠️ "esperarEnterEntreTandas" se sumó ese mismo día y se sacó el 15-sep-2026 a
           pedido del usuario: el corte manual no aportaba nada frente al destello
           automático de 1,5s que ya usa el resto del Curso, y era la única excepción. */
        crearEnCursoSiNoExiste("Oraciones con mayúsculas incluidas", "Las mismas oraciones, ahora con mayúsculas y puntuación real.",
                TipoEjercicio.ORACIONES_MAYUSCULAS,
                "{\"porTandas\":true}",
                NivelCurso.INTERMEDIO, 1, 3);

        crearEnCursoSiNoExiste("Muerte súbita (Intermedio)", "Un solo error reinicia el ejercicio desde cero.",
                TipoEjercicio.SUDDEN_DEATH,
                "{\"categorias\":[{\"id\":\"cortas\",\"nombre\":\"Oraciones cortas\"}],"
                        + "\"introTexto\":\"Un solo error te hace empezar de nuevo la misma oración, desde el "
                        + "principio. Cuando la aciertes completa, pasás a una segunda ronda: ahí cada error "
                        + "trae una oración distinta, no la misma.\"}",
                NivelCurso.INTERMEDIO, 1, 5);

        /* REESCRITO el 11-sep-2026: no tenía `banco`, así que caía a `ORACIONES_SIMPLES`
           (ver la nota de `ORACIONES_INTERMEDIO_GENERAL`). */
        /* REESCRITO el 13-sep-2026: servía 6 oraciones de intermedio_general concatenadas
           con espacio — seis ideas sueltas de temas distintos, sin relación entre sí. El
           usuario lo notó ("son varios textos, no un texto") y pidió UN SOLO texto
           cohesivo de 35 a 40 palabras. Ahora usa `intermedio_contrarreloj` (cada ítem ya
           es un párrafo entero sobre un único tema) con `cantidad:1`, mismo trato que
           basico_relajo/basico_qwerty. "Contrarreloj rápido" se queda con el banco viejo
           tal cual — la idea ahí es justo la contraria: varias ideas sueltas y menos
           tiempo, para ver si el usuario aguanta o cae. */
        /* "retoContrarreloj" sumado el 13-sep-2026: un tercer punto opcional en la
           ventana de Contrarreloj (compartida por TODOS los Contrarreloj de la app),
           que solo aparece cuando el nodo lo trae en su config — ver esConTexto en
           CursoPracticaView. Aclara que el texto es más largo de lo normal a
           propósito, sin que eso sea requisito para avanzar (lo que decide es la
           precisión, igual que en cualquier otro nodo). */
        crearEnCursoSiNoExiste("Contrarreloj (Intermedio)", "Las correctas suman tiempo, las falladas lo restan.",
                TipoEjercicio.CONTRARRELOJ,
                "{\"banco\":\"intermedio_contrarreloj\",\"cantidad\":1,"
                        + "\"tiempoInicialSegundos\":30,\"bonusCorrectaSegundos\":1,\"penalizacionErrorSegundos\":2,"
                        + "\"retoContrarreloj\":\"Este texto es más largo que el resto: el objetivo es "
                        + "terminarlo entero. Lo que decide si avanzás sigue siendo tu precisión, no si "
                        + "llegás al final.\"}",
                NivelCurso.INTERMEDIO, 1, 6);

        /* NUEVO el 15-sep-2026, ANTES de "El punto y coma" y "Pausas y enumeraciones": los
           tres símbolos de puntuación de ese bloque (; , .) más el guion, practicados como
           posición de tecla pura — sin ninguna oración todavía — para no pedir un signo
           dentro de una frase antes de haberlo tecleado ni una vez. Usa `progresionSignos`
           (ver esa nota en generarSimbolosCriticos): 3 tandas, la primera introduce cada
           signo de a uno, las otras dos lo mezclan cada vez más con letras del home row. */
        crearEnCursoSiNoExiste("Práctica con signos", "Punto y coma, coma, punto y guion: dónde están, antes de usarlos en una frase.",
                TipoEjercicio.SIMBOLOS_CRITICOS,
                "{\"simbolos\":[\";\",\",\",\".\",\"-\"],\"progresionSignos\":true,\"porTandas\":true,"
                        + "\"tutorialPalabras\":4,"
                        + "\"mensajeTutorial\":\"Cuatro signos nuevos, antes de mezclarlos con letras.\"}",
                NivelCurso.INTERMEDIO, 1, 7);

        /* REESCRITO el 11-sep-2026: generaba pseudo-tokens al azar (`a;j`, `.kl`) mezclando
           `; .` con letras sueltas — ni una oración real, y el punto y coma es justo el
           signo que más depende de SABER CUÁNDO usarlo, no solo de encontrar la tecla. El
           punto no necesita nodo propio (ya se enseña en cualquier frase); el título se
           mantiene porque sigue siendo cierto — sigue siendo un signo que casi nadie
           practica, ahora en serio. Mismo título → no hace falta retirar nada, pero SÍ
           hace falta que `crearEnCursoSiNoExiste` sincronice `tipo` en filas existentes,
           que hasta hoy no lo hacía (ver el fix de arriba). */
        /* Renombrado el 13-sep-2026: "Práctica de signos" no decía CUÁL signo, y quedaba
           al lado de "Oraciones con signos" (coma/punto) — dos títulos casi iguales
           practicando cosas distintas. El viejo va a RETIRADOS_DEL_CURSO. */
        /* ⚠️ REESCRITO el 13-sep-2026, dos cambios pedidos por el usuario:
           1. La ventana pasiva (introTexto) se cambió por un tutorial DE VERDAD: tres
              repeticiones de ";" con teclasTutorial —reusa TutorialTeclas tal cual, que
              ya compara e.key contra el ítem sin distinguir letra de símbolo— y
              captionsTutorial fijo diciendo el gesto, así el usuario sabe qué apretar
              ANTES de fallar y no solo cuando el destello ámbar/rojo se lo confirma.
           2. `porTandas` + `cantidad:2`: antes servía 6 oraciones de intermedio_puntoycoma
              corridas con un espacio — "un montón de párrafos juntos" según el usuario.
              Ahora son 2 tandas, una oración a la vez. */
        crearEnCursoSiNoExiste("El punto y coma", "El signo que casi nadie usa bien: cuándo va un punto y coma en vez de una coma o un punto.",
                TipoEjercicio.ORACIONES_TEMATICAS,
                "{\"banco\":\"intermedio_puntoycoma\",\"puntoYComaObligatorio\":true,"
                        + "\"porTandas\":true,\"cantidad\":2,"
                        + "\"teclasTutorial\":[\";\",\";\",\";\"],"
                        + "\"captionsTutorial\":[\"Shift + la coma, a la vez\",\"Shift + la coma, a la vez\","
                        + "\"Shift + la coma, a la vez\"],"
                        + "\"mensajeTutorial\":\"Practica el punto y coma antes de empezar.\"}",
                NivelCurso.INTERMEDIO, 1, 9);

        /* REESCRITO el 11-sep-2026: "Palabras cortas con una sola mano" metía las DOS manos
           en un solo nodo con sub-selector (2+ opciones, así que sí se dibuja — ver la nota
           de la sección 8 sobre cuándo un sub-selector se pinta). Inconsistente con el resto
           del Curso, que trata cada concepto como su propio paso secuencial (fila superior,
           fila inferior, los dos recorridos de un dedo en Básico). Dos nodos en vez de uno,
           cada cual con UNA sola mano configurada — así ninguno dibuja sub-selector, y el
           orden natural es izquierda antes que derecha porque su pool del diccionario es
           bastante más grande (242 contra 32 palabras, medido): empezar por la mano con más
           variedad da una primera impresión mejor del ejercicio. */
        crearEnCursoSiNoExiste("Palabras con la mano izquierda", "Palabras que se escriben completas con la mano izquierda. La derecha debe quedarse quieta, apoyada en la jota.",
                TipoEjercicio.MODO_UNA_MANO,
                "{\"manos\":[{\"id\":\"izquierda\",\"nombre\":\"Mano izquierda\",\"letras\":\"qwertasdfgzxcvb\",\"ancla\":\"j\"}]}",
                NivelCurso.INTERMEDIO, 2, 14);

        // Bloque 2: "Palabras con la mano derecha" abre y "Patrones de una mano" (en
        // sembrarInfraCurso) sigue justo después, cerrando el arco de las dos manos.
        crearEnCursoSiNoExiste("Palabras con la mano derecha", "Palabras que se escriben completas con la mano derecha. La izquierda debe quedarse quieta, apoyada en la efe.",
                TipoEjercicio.MODO_UNA_MANO,
                "{\"manos\":[{\"id\":\"derecha\",\"nombre\":\"Mano derecha\",\"letras\":\"yuiophjklñnm\",\"ancla\":\"f\"}]}",
                NivelCurso.INTERMEDIO, 2, 15);

        // Falta intro sumado el 13-sep-2026: explica qué son los homófonos antes de empezar.
        crearEnCursoSiNoExiste("Palabras confusas (Intermedio)", "Homófonos y palabras que se confunden al escribir (tubo/tuvo, haya/halla).",
                TipoEjercicio.PALABRAS_CONFUSAS,
                "{\"introTexto\":\"Estas palabras suenan igual o parecido, pero se escriben distinto y "
                        + "significan cosas distintas: tubo/tuvo, haya/halla. Vienen de a pares, para "
                        + "practicar el contraste.\"}",
                NivelCurso.INTERMEDIO, 2, 18);

        // "retoContrarreloj" agregado el 15-sep-2026: misma viñeta extra que ya usa
        // "Contrarreloj (Intermedio)", pedida a medida por el usuario para este nodo.
        crearEnCursoSiNoExiste("Contrarreloj rápido (Intermedio)", "Igual que el otro, pero arrancas con la mitad de tiempo.",
                TipoEjercicio.CONTRARRELOJ,
                "{\"banco\":\"intermedio_general\","
                        + "\"tiempoInicialSegundos\":15,\"bonusCorrectaSegundos\":1,\"penalizacionErrorSegundos\":2,"
                        + "\"retoContrarreloj\":\"¡Nuevo desafío! Prueba qué tan lejos llegas en solo 15 "
                        + "segundos. Prioriza tus aciertos: te suman un tiempo valioso.\"}",
                NivelCurso.INTERMEDIO, 2, 19);

        /* ⚠️ REESCRITO el 14-sep-2026: la descripción vieja ("se apilan una encima de otra:
           no hay pausa entre ellas") describía el apilado visual —que sí funciona bien,
           VistaPalabrasMutantes ya muestra la palabra activa grande y las 2 siguientes
           asomando detrás— pero callaba lo que de verdad genera la confusión: un 30% de
           las veces, la palabra que sigue CAMBIA por otra distinta justo al terminar la
           anterior (`mutarSiguientePalabra`). Nueva descripción + introTexto explican esa
           mutación, no solo el apilado. Reposicionada ANTES de la Lluvia (orden 19, no 21):
           dos ejercicios de relajo seguidos —esta y la Lluvia— no sumaban variedad. */
        crearEnCursoSiNoExiste("Palabras mutantes (Intermedio)", "Escribís una palabra a la vez, pero cuidado: a veces la que sigue cambia de golpe justo antes de que la termines.",
                TipoEjercicio.PALABRAS_MUTANTES,
                "{\"introTexto\":\"Vas a ver la palabra activa grande, con las dos siguientes asomando detrás. "
                        + "Pero ojo: a veces la palabra que sigue cambia de golpe por otra distinta, justo "
                        + "cuando terminás la que estás escribiendo. Mirá siempre la palabra grande del centro.\"}",
                NivelCurso.INTERMEDIO, 2, 20);

        crearEnCursoSiNoExiste("Lluvia de letras: letras y palabras", "Empieza con letras sueltas y pasa a palabras cortas cayendo.",
                TipoEjercicio.LLUVIA_LETRAS, "{\"modo\":\"avanzado\"}", NivelCurso.INTERMEDIO, 2, 22);

        crearEnCursoSiNoExiste("Modo ciego (cursor visible)", "El texto se ve completo, pero no sabrás si aciertas o fallas hasta el final. El cursor te ayuda a ubicarte.",
                TipoEjercicio.MODO_CIEGO, "{\"ocultarCursor\":false}", NivelCurso.INTERMEDIO, 3, 36);

        /* ⚠️ REESCRITO el 14-sep-2026: partido en dos, mismo criterio que "Palabras con la
           mano izquierda/derecha" — un solo nodo con las DOS manos configuradas dibuja un
           sub-selector (2+ opciones), inconsistente con el resto del Curso. El título se
           queda con "al 90%" a pedido del usuario, aunque el banco real apunte a 80-95%
           (ver la nota de ORACIONES_UNA_MANO_IZQUIERDA/DERECHA en ContenidoCurado) — no se
           tocó el nombre, solo la estructura. Cada nodo trae UNA sola mano, así que
           generarUnaManoForzada resuelve el banco correcto sin necesitar `grupo`. */
        crearEnCursoSiNoExiste("Oraciones con mano forzada al 90% (izquierda)", "Frases cortas donde casi todo el tecleo cae en la mano izquierda.",
                TipoEjercicio.UNA_MANO_FORZADA,
                "{\"modo\":\"oraciones\",\"manos\":[{\"id\":\"izquierda\",\"nombre\":\"Mano izquierda\","
                        + "\"letras\":\"qwertasdfgzxcvb\"}],"
                        + "\"introTexto\":\"Casi todas las letras de estas frases caen en la mano izquierda "
                        + "— de vez en cuando vas a necesitar la derecha para alguna palabra corta.\"}",
                NivelCurso.INTERMEDIO, 3, 38);

        crearEnCursoSiNoExiste("Oraciones con mano forzada al 90% (derecha)", "Frases cortas donde casi todo el tecleo cae en la mano derecha.",
                TipoEjercicio.UNA_MANO_FORZADA,
                "{\"modo\":\"oraciones\",\"manos\":[{\"id\":\"derecha\",\"nombre\":\"Mano derecha\","
                        + "\"letras\":\"yuiophjklñnm\"}],"
                        + "\"introTexto\":\"Casi todas las letras de estas frases caen en la mano derecha "
                        + "— de vez en cuando vas a necesitar la izquierda para alguna palabra corta.\"}",
                NivelCurso.INTERMEDIO, 3, 39);

        crearEnCursoSiNoExiste("Dictado de voz sencillo y corto", "Escuchas la oración y la escribes sin verla en pantalla.",
                TipoEjercicio.DICTADO_VOZ,
                "{\"modo\":\"tts\",\"wpmObjetivo\":55,\"puntoFinalOpcional\":true}",
                NivelCurso.INTERMEDIO, 3, 41);

        /* EL EXAMEN DE INTERMEDIO (18-sep-2026): cierra el sendero, después del dictado. Sin
           Prueba de nivel, decisión del usuario: Intermedio se aprueba solo con este examen.
           Mismas reglas que el de Básico: 32 WPM y 92%, y no se deja dar mientras quede algún
           nodo de una sola estrella. Sirve UNO de sus cuatro textos al azar en cada intento. */
        crearEnCursoSiNoExiste("Test Final de Intermedio",
                "El examen del nivel: mayúsculas, tildes, signos y números en un solo texto.",
                TipoEjercicio.ORACIONES_TEMATICAS,
                "{\"banco\":\"test_final_intermedio\",\"cantidad\":1}",
                NivelCurso.INTERMEDIO, 3, 42, RolEjercicioNivel.TEST_FINAL);
    }


    private void sembrarPalabrasFlotantesCurso() {
        crearEnCursoSiNoExiste("Palabras flotantes", "Las palabras cruzan la pantalla: escribilas completas antes de que lleguen al otro lado.",
                TipoEjercicio.DESESTRUCTURA,
                "{\"msHastaElBorde\":6000,\"introTexto\":\"¡No permitas que alguna palabra llegue al borde! "
                        + "Las palabras cruzan la pantalla: escribilas completas antes de que lo hagan.\"}",
                NivelCurso.INTERMEDIO, 3, 40);
        crearEnCursoSiNoExiste("Palabras flotantes (más rápido)", "Igual que en Intermedio, pero cruzan más rápido.",
                TipoEjercicio.DESESTRUCTURA, "{\"msHastaElBorde\":4000}", NivelCurso.AVANZADO, 2, 14);
    }

    /* Las tres filas de BÁSICO ya no están acá: se mudaron a sembrarRestoDeBasicoCurso,
       donde vive el nivel entero en orden. Este método queda para las filas de Intermedio
       y Avanzado que usan el mismo tipo. */
    private void sembrarPalabrasDeFilaCurso() {
    }

    /* ================== EL RESTO DE BÁSICO ==================

       Todo lo que no es un paso de Fundamentos: las lluvias, las palabras, los
       contrarrelojes, los recorridos por dedo y el cierre. Vive junto y no repartido entre
       sembrarPalabrasDeFilaCurso / sembrarCierreBasicoCurso / sembrarInfraCurso porque el
       ORDEN de Básico es el currículo, y hasta ahora había que abrir cuatro métodos para
       reconstruirlo mentalmente.

       Las teclas de cada lluvia y de cada nodo de palabras son EXACTAMENTE las aprendidas
       hasta ese punto de la secuencia. Están escritas a mano y no calculadas porque estos
       nodos no son pasos de Fundamentos y no participan del acumulador; si se reordena la
       secuencia hay que revisarlas. La comprobación es mecánica: ninguna letra de acá puede
       aparecer después de su `orden` en PASOS_FUNDAMENTOS. */
    private static final String FILA_CENTRAL = "asdfghjklñ";
    private static final String DOS_FILAS = "asdfghjklñqwertyuiop";

    /* LAS RESERVAS DE LA LLUVIA: cuántas teclas equivocadas aguanta una partida. Pedido del
       usuario, contra el aporreo — sin tope, pulsar teclas al azar limpiaba la pista sola y
       costaba solo precisión. Cada tecla que no esté cayendo gasta una; al llegar a cero la
       partida termina (el front hace caer las letras en el carril más tocado para no hacer
       esperar). Terminar sin reservas NO suspende el nodo: la Lluvia sigue sin bloquear el
       curso, y lo que baja es la nota, que se puntúa por precisión.

       15 y no 20, sabiéndolo: medido con las partidas reales, 15 habría cortado unas cuatro
       de cada diez, todas por debajo de ~80% de precisión. Solo en las cinco de Básico: las
       de Intermedio y Avanzado sirven palabras, y ahí fallar una letra no es aporrear. */
    private static final String RESERVAS_LLUVIA_BASICO = ",\"reservas\":15";

    private void sembrarRestoDeBasicoCurso() {
        // ---------- Bloque 1: fila central ----------
        crearEnCursoSiNoExiste("Lluvia de letras: f j d k",
                "Sobrevive 30 segundos a las cuatro primeras teclas.",
                TipoEjercicio.LLUVIA_LETRAS,
                "{\"modo\":\"letras\",\"letras\":\"fjdk\",\"foco\":\"fjdk\","
                        + "\"dominancia\":95,\"duracionSegundos\":30" + RESERVAS_LLUVIA_BASICO + "}",
                NivelCurso.BASICO, 1, 3, 0, java.math.BigDecimal.ZERO);

        crearEnCursoSiNoExiste("Lluvia de letras: media fila central",
                "Sobrevive 30 segundos, ahora con ocho teclas.",
                TipoEjercicio.LLUVIA_LETRAS,
                "{\"modo\":\"letras\",\"letras\":\"fjdkslañ\",\"foco\":\"slañ\","
                        + "\"dominancia\":95,\"duracionSegundos\":30" + RESERVAS_LLUVIA_BASICO + "}",
                NivelCurso.BASICO, 1, 6, 0, java.math.BigDecimal.ZERO);

        /* Dieciocho palabras y no treinta: con la fila central el diccionario da poco más
           de treinta, y las más raras (alfalfa, agallas, daga, alga, gasa...) quedan bien
           lejos de las dieciocho más frecuentes. Dentro de esas dieciocho todo es normal —
           de dos a cinco letras (la, las, al, ha, has, sala, salga, gafas...)—, así que
           subir la tanda no mete ninguna rareza; solo la hace menos parecida a la lista de
           diez de antes. El contrarreloj de abajo es el que usa todo el pool igual. */
        /* Con TUTORIAL, y es el único nodo de palabras que lo lleva: es el primero de todo
           el curso donde lo que aparece en pantalla es una palabra y no una sílaba inventada.
           Las cinco primeras se tecleaN en cuadros grandes, sin reloj y sin medir nada, antes
           de la tanda de dieciocho. */
        crearEnCursoSiNoExiste("Palabras de la línea base",
                "Tus primeras palabras reales, todas con la fila de reposo.",
                TipoEjercicio.PALABRAS_DE_FILA,
                "{\"fila\":\"central\",\"letras\":\"" + FILA_CENTRAL + "\",\"cantidad\":18,"
                        + "\"tutorialPalabras\":5,"
                        + "\"mensajeTutorial\":\"Es hora de teclear tus primeras palabras\"}",
                NivelCurso.BASICO, 1, 8);

        /* FRASES, no una lista de palabras. El nodo 8 que tiene justo encima ya sirve
           palabras sueltas de esta misma fila: encadenar dos nodos de listas cambiando solo
           el cronómetro no aportaba variedad. Con frases se practica además el espacio a
           ritmo, y el contrarreloj mide igual —el bono cae en cada espacio—.
           Salen forzadas porque la fila central no tiene más vocal que la `a`; ver la nota
           larga de ORACIONES_BASICO_LINEA_BASE. */
        crearEnCursoSiNoExiste("Contrarreloj: palabras de la fila central",
                "Treinta segundos de frases. Cada palabra correcta suma tiempo; cada error lo resta.",
                TipoEjercicio.CONTRARRELOJ,
                "{\"banco\":\"basico_linea_base\",\"cantidad\":6,"
                        + "\"tiempoInicialSegundos\":30,\"bonusCorrectaSegundos\":1,\"penalizacionErrorSegundos\":2}",
                NivelCurso.BASICO, 1, 9);

        // ---------- Bloque 2: fila superior ----------
        /* FRASES, no una lista. Hasta el 10-sep-2026 este nodo servia palabras sueltas con
           el patron `^[asdfghjklñruei]+$`, y un nodo de oraciones se habia descartado aqui
           por imposible: sin `o`, `n`, `t` ni `y` no existen "no", "con", "una" ni "que".
           Pero con `e i r u` ya entran `de la el es se su del al ser ella fue era desde`, y
           eso alcanza para frases que suenan a lengua. Lo pidio el usuario: muchos nodos de
           palabras podian ser oraciones con esas mismas teclas.

           Una frase por tanda, como "Oraciones con tilde". Son de cinco a siete palabras
           —mas cortas que las de ese nodo—, y por eso van cuatro tandas en vez de tres.

           ⚠️ Cambia de titulo, asi que el viejo va a RETIRADOS_DEL_CURSO: el sembrado busca
           por titulo, y sin eso quedarian dos nodos 12 en el sendero. */
        /* `introTexto`: pedido del usuario, solo para este nodo por ahora — que avise qué
           teclas entran en juego antes de arrancar, no solo el título. `introTexto` es un
           campo GENÉRICO (lo lee IntroInfo en el front si está presente, en cualquier tipo
           de ejercicio), pero hoy solo lo trae este. */
        crearEnCursoSiNoExiste("Oraciones con las teclas nuevas",
                "Tus primeras frases enteras: ya entran la e, la i, la r y la u.",
                TipoEjercicio.ORACIONES_TEMATICAS,
                "{\"banco\":\"basico_teclas_nuevas\",\"cantidad\":4,\"porTandas\":true,"
                        + "\"introTexto\":\"Este nodo mezcla toda la fila central con las "
                        + "cuatro teclas nuevas de la fila de arriba: e, r, u, i.\"}",
                NivelCurso.BASICO, 2, 12);

        /* `letras` NO es el alfabeto entero del nivel — es el pool del 5% que NO sale de
           `foco`. Hasta el 11-sep-2026 llevaba las 18 letras de las dos filas (central +
           superior), así que ese 5% terminaba pudiendo caer en cualquiera de las diez
           centrales con casi igual chance: "solo debería mezclarme la 'f j', no más",
           pidió el usuario, mismo criterio que en los latidos de r u (ver PASOS_FUNDAMENTOS).
           Acotado a `fjdk` —los anclas de índice y medio, los dos dedos que esta fila ya
           usó para subir— en vez de las diez letras centrales enteras. Nunca lleva ninguna
           de la fila inferior: esta lluvia es solo de las dos filas de arriba. */
        crearEnCursoSiNoExiste("Lluvia de letras: dos filas",
                "Sobrevive 30 segundos mezclando la fila central y la superior.",
                TipoEjercicio.LLUVIA_LETRAS,
                "{\"modo\":\"letras\",\"letras\":\"fjdk\",\"foco\":\"woqp\","
                        + "\"dominancia\":95,\"duracionSegundos\":30" + RESERVAS_LLUVIA_BASICO + "}",
                NivelCurso.BASICO, 2, 15, 0, java.math.BigDecimal.ZERO);

        /* La tecla del acento, presentada. Va entre "t y" y las palabras de la fila
           porque el acento vive en esa misma fila y porque de aqui en adelante todo el
           nivel puede escribir con tildes. El aviso lateral explica el gesto: primero el
           acento, despues la vocal — es tecla muerta y sola no escribe nada.

           `tildeObligatoria`: en una vocal con tilde el cursor NO avanza hasta que salga
           bien. Pedido del usuario — si el nodo existe para ensenar la tilde, dejar pasar
           "a" por "á" le permite completarlo sin haberla escrito nunca. Los intentos
           fallidos SI cuentan (tambien decision suya), al reves que la primera mayuscula:
           ahi el usuario no podia deducir que le faltaba media pulsacion, y aqui tiene el
           aviso lateral explicando el gesto delante. Solo las letras con tilde: el resto
           del texto se falla como en cualquier nodo. */
        crearEnCursoSiNoExiste("Oraciones con tilde",
                "La tecla del acento: se pulsa antes de la vocal y sola no escribe nada.",
                TipoEjercicio.ORACIONES_TEMATICAS,
                "{\"banco\":\"basico_tildes\",\"cantidad\":3,\"porTandas\":true,"
                        + "\"tildeObligatoria\":true}",
                NivelCurso.BASICO, 2, 17);

        /* Las dos filas en un solo nodo. Antes habia uno de palabras de la fila superior
           y el contrarreloj de al lado servia palabras de las dos: dos nodos seguidos
           pidiendo lo mismo con distinto rotulo. Ahora este junta las dos fuentes y el
           contrarreloj pasa a oraciones, que es donde estaba la variedad que faltaba.

           El patron de dos filas ya INCLUYE las palabras que solo usan la de arriba:
           "tepuy" y "papel" pasan los dos, asi que no hace falta mezclar dos consultas. */
        crearEnCursoSiNoExiste("Palabras de las dos filas",
                "Todo lo que ya se puede escribir sin bajar de la fila de reposo.",
                TipoEjercicio.PALABRAS_DE_FILA,
                "{\"patron\":\"^[" + DOS_FILAS + "]+$\",\"porTandas\":true}",
                NivelCurso.BASICO, 2, 18);

        /* ORACIONES bajo reloj, no palabras sueltas. El nodo anterior ya sirve palabras de
           estas dos filas; encadenar dos nodos de listas cambiando solo el cronometro no
           aportaba variedad. Con frases se practica ademas el espacio entre palabras a
           ritmo, que es lo que una lista nunca entrena. */
        /* `cantidad:1` desde el 11-sep-2026: cada ítem del banco ya es una oración larga
           entera (19-22 palabras), no una frase corta para encadenar. Ver la nota grande
           en ContenidoCurado.ORACIONES_BASICO_DOS_FILAS. */
        crearEnCursoSiNoExiste("Contrarreloj: dos filas",
                "Treinta segundos con una oración larga. Cada palabra correcta suma tiempo, cada error lo resta.",
                TipoEjercicio.CONTRARRELOJ,
                "{\"banco\":\"basico_dos_filas\",\"cantidad\":1,"
                        + "\"tiempoInicialSegundos\":30,\"bonusCorrectaSegundos\":1,\"penalizacionErrorSegundos\":2}",
                NivelCurso.BASICO, 2, 19);

        // ---------- Bloque 3: fila inferior ----------
        crearEnCursoSiNoExiste("Lluvia de letras: los dedos que bajan",
                "Sobrevive 30 segundos con las teclas nuevas y sus vecinas de arriba.",
                TipoEjercicio.LLUVIA_LETRAS,
                "{\"modo\":\"letras\",\"letras\":\"vmc,fjdk\",\"foco\":\"vmc,\","
                        + "\"dominancia\":95,\"duracionSegundos\":30" + RESERVAS_LLUVIA_BASICO + "}",
                NivelCurso.BASICO, 3, 22, 0, java.math.BigDecimal.ZERO);

        /* COBRAR LAS TECLAS NUEVAS, que es lo que este bloque no hacia hasta el final.

           Los bloques 1 y 2 rematan cada tanda de teclas con palabras reales; el 3 encadenaba
           siete nodos de letras sueltas antes de la primera palabra. Medido contra el
           diccionario: con la fila central, la superior y `v m c` —o sea sin b, n, z ni x—
           salen 2.883 palabras, MAS DEL DOBLE de las 1.340 del nodo equivalente del bloque
           anterior. Y las mas frecuentes son el nucleo del idioma: `de que la el es lo por me
           para pero como todo muy vamos`. La eme trae `me, mi, muy, como`; la ce trae `como,
           cosa, poco`; la ve trae `vamos, ver`.

           ⚠️ El patron EXIGE al menos una `v`, `m` o `c`, no solo que no haya prohibidas.
           Sin esa exigencia el pool son 2.883 palabras pero la mayoria no lleva ninguna de
           las teclas nuevas: la primera tanda salio `lejos ella juego ahora puerta`, que es
           un nodo del bloque anterior con otro titulo. Exigiendola quedan 1.543 —todavia mas
           que las 1.340 del nodo equivalente del bloque 2— y las frecuentes son justo las que
           el bloque acaba de desbloquear: `me mi como muy vamos casa mucho mejor ver vida`.
           Es el mismo criterio que el nodo de la fila de abajo, mas abajo en este archivo.

           ⚠️ El titulo NO puede ser "Palabras con las teclas nuevas": fue el del nodo 12
           hasta el 10-sep-2026 y hoy esta en RETIRADOS_DEL_CURSO, asi que un nodo nuevo con
           ese nombre se retiraria solo en cada arranque. Es la trampa del sembrado por
           titulo, que ya mordio cinco veces. */
        crearEnCursoSiNoExiste("Palabras con la ve, la eme y la ce",
                "Con la eme y la ce entran de golpe las palabras mas usadas del idioma.",
                TipoEjercicio.PALABRAS_DE_FILA,
                "{\"patron\":\"^[asdfghjklñqwertyuiopvmc]*[vmc][asdfghjklñqwertyuiopvmc]*$\","
                        + "\"porTandas\":true}",
                NivelCurso.BASICO, 3, 23);

        /* EL RESPIRO. La primera mitad de este bloque no puede tener lenguaje: el punto y
           la coma son teclas de esta misma fila, asi que hasta aca no hay con que puntuar
           nada. Por eso los bloques 1 y 2 no tienen ni un nodo de oraciones: no es una
           omision, es el teclado. Este texto es lo primero parecido a leer en todo el
           nivel, y va justo antes del tramo mas mecanico. Ver ORACIONES_BASICO_RELAJO
           para que se puede y que no se puede escribir en este punto de la secuencia. */
        crearEnCursoSiNoExiste("Un respiro entre teclas",
                "Un texto corto, sin prisa. Aqui no se aprende ninguna tecla nueva.",
                TipoEjercicio.ORACIONES_TEMATICAS,
                "{\"banco\":\"basico_relajo\",\"cantidad\":1}",
                NivelCurso.BASICO, 3, 25);

        /* LOS RECORRIDOS. La dificultad de la fila inferior no es horizontal sino VERTICAL:
           el dedo tiene que bajar y volver a la fila de reposo. TypingClub entrena eso con
           diez lecciones "Travel" repartidas por su fila inferior; acá se hace con UN_DEDO,
           que ya existía y vivía entero en Intermedio, donde llega tarde.

           Cada recorrido va justo DONDE ESE DEDO QUEDA COMPLETO, y esa es la razón de que
           el meñique venga antes que el índice aunque parezca al revés:
             - meñiques y anulares se completan con "zx .-" (orden 22)
             - los índices no se completan hasta "b n" (orden 24), la última pareja
           Ponerlos antes sería pedirle al usuario teclas que todavía no vio. */
        crearEnCursoSiNoExiste("Recorrido de anular y meñique",
                "Un solo dedo, sus tres filas. Los dedos débiles son los que peor bajan.",
                TipoEjercicio.UN_DEDO,
                "{\"dedos\":["
                        + "{\"id\":\"anular_izq\",\"nombre\":\"Anular izquierdo\",\"letras\":\"wsx\"},"
                        + "{\"id\":\"anular_der\",\"nombre\":\"Anular derecho\",\"letras\":\"ol.\"},"
                        + "{\"id\":\"menique_izq\",\"nombre\":\"Meñique izquierdo\",\"letras\":\"qaz\"},"
                        + "{\"id\":\"menique_der\",\"nombre\":\"Meñique derecho\",\"letras\":\"pñ-\"}"
                        + "]}",
                NivelCurso.BASICO, 3, 29);

        /* EL ÍNDICE, SOLO SU COLUMNA DE REPOSO: `r f v` y `u j m`. Hasta el 10-sep-2026
           llevaba ademas la interior (`t g b` / `y h n`), y la mezcla emborronaba justo lo que
           el nodo entrena: la columna interior es un estiramiento LATERAL, otro gesto, y un
           token como `rg` o `tfb` cruzaba de una a otra. Pedido del usuario, 100% esas tres
           teclas. La columna interior no se queda sin practicar: la trabajan los latidos de
           `g h`, `t y` y `b n`.

           Con tres teclas el indice queda igual que los otros tres dedos: una columna, un
           recorrido. */
        crearEnCursoSiNoExiste("Recorrido del índice y el medio",
                "Los dos dedos que más trabajan, cada uno por sus tres filas.",
                TipoEjercicio.UN_DEDO,
                "{\"dedos\":["
                        + "{\"id\":\"indice_izq\",\"nombre\":\"Índice izquierdo\",\"letras\":\"rfv\"},"
                        + "{\"id\":\"indice_der\",\"nombre\":\"Índice derecho\",\"letras\":\"ujm\"},"
                        + "{\"id\":\"medio_izq\",\"nombre\":\"Medio izquierdo\",\"letras\":\"edc\"},"
                        + "{\"id\":\"medio_der\",\"nombre\":\"Medio derecho\",\"letras\":\"ik,\"}"
                        + "]}",
                NivelCurso.BASICO, 3, 27);

        /* PALABRAS de la fila de abajo, que hasta ahora se daban por imposibles.

           El nodo de al lado (orden 30) genera ORACIONES porque `z x c v b n m` no tiene
           ninguna vocal, asi que "palabra hecha solo con esa fila" no existe. Pero eso no es
           lo mismo que "palabra cuyas CONSONANTES salen todas de abajo": las vocales pueden
           venir de donde sea, y eso si es expresable como clase de caracteres.

           El patron pide vocales y consonantes de abajo, y ademas AL MENOS UNA de abajo — sin
           esa exigencia entraban dos palabras hechas solo de vocales (`ia`, `oi`), que no
           practican nada de esta fila. Medido: 200 palabras, y las frecuentes son justo las
           que faltaban en todo el nivel — `no en un me una con mi bien como bueno nunca`.

           ⚠️ Va DESPUES del recorrido del indice y el medio (orden 27) y no antes: cinco de
           las siete consonantes de esta fila son de esos dos dedos (`v b n m c`), asi que el
           recorrido es literalmente la preparacion de estas palabras. */
        crearEnCursoSiNoExiste("Palabras de la fila de abajo",
                "Palabras reales donde todas las consonantes salen de la fila de abajo.",
                TipoEjercicio.PALABRAS_DE_FILA,
                "{\"patron\":\"^[aeiouáéíóúzxcvbnm]*[zxcvbnm][aeiouáéíóúzxcvbnm]*$\","
                        + "\"porTandas\":true}",
                NivelCurso.BASICO, 3, 28);

        /* Se llamaba "Palabras linea inferior" y el titulo mentia: z x c v b n m no tiene
           ninguna vocal, asi que una palabra hecha solo con esa fila es imposible y este
           generador SIEMPRE produjo oraciones (consonantes de abajo, vocales de donde
           sea). Ver la nota de la fila inferior en CLAUDE.md 6.7. */
        crearEnCursoSiNoExiste("Oraciones de la línea inferior",
                "Frases donde casi todas las consonantes salen de la fila de abajo.",
                TipoEjercicio.PALABRAS_DE_FILA, "{\"fila\":\"inferior\",\"porTandas\":true}",
                NivelCurso.BASICO, 3, 30);

        /* CIERRA EL BLOQUE 3, no abre el 4. El bloque de la fila inferior termina en el
           unico sitio donde ya existe el abecedario entero, que es su propio pago: cuatro
           nodos de teclas nuevas y dos recorridos desembocan en frases de verdad. Dejarlo en
           el bloque 4 hacia que el 3 cerrara con un drill. */
        crearEnCursoSiNoExiste("Oraciones con las tres filas",
                "Frases completas, ya con todas las letras del abecedario.",
                TipoEjercicio.ORACIONES_SIMPLES, "{\"porTandas\":true}",
                NivelCurso.BASICO, 3, 31);

        // ---------- Bloque 4: cierre del nivel ----------
        /* ABRE el bloque, y no la Lluvia. Reescrito el 11-sep-2026, dos veces el mismo día:
           el nodo ya existía (con `porTandas`, sirviendo sus dos textos como dos tandas
           seguidas) pero el usuario pidió reordenar todo el cierre para que este fuera el
           PRIMERO —el dato curioso corona la fila inferior recién terminada, antes de
           entrar en el repaso general— y de paso cambió qué es "texto largo" acá: no es
           "todo lo que haya", es UN texto que llene la vista sin pasarse, ~65-70 palabras.

           `porTandas` se reemplaza por `cantidad:1`: antes servía SUS DOS textos seguidos
           (619 caracteres, el nodo más largo del nivel por 2,5× — ver CLAUDE.md 11, punto
           8), y al terminar el primero aparecía el segundo sin que el usuario lo pidiera.
           Con `cantidad:1` cada intento sirve UNO solo, elegido al azar, igual que
           "Un respiro entre teclas" o "Contrarreloj: las tres filas".

           SIN NÚMEROS a propósito: en este orden nuevo, QWERTY va ANTES de "Fila de
           números" (que ahora es el 35), así que el nodo no puede tocar dígitos todavía —
           el `1873` que traía el texto original se sacó por eso. */
        crearEnCursoSiNoExiste("Por qué el teclado se llama QWERTY",
                "Un respiro con datos sobre el teclado que tienes delante.",
                TipoEjercicio.ORACIONES_TEMATICAS, "{\"banco\":\"basico_qwerty\",\"cantidad\":1}",
                NivelCurso.BASICO, 4, 32);

        /* Reemplaza a la vez a la "Lluvia de las tres filas" (que barria el alfabeto al
           azar) y a "Repetir letras mas falladas" (mismo dato, presentado como drill): una
           lluvia sobre TUS peores teclas hace las dos cosas. Sin foco: acá el objetivo ES
           el teclado entero. */
        crearEnCursoSiNoExiste("Lluvia de repaso: tus teclas mas falladas",
                "Empezamos recopilando todas las teclas del curso, centrada en las que mas te cuestan.",
                TipoEjercicio.LLUVIA_LETRAS,
                "{\"modo\":\"letras\",\"desdeFalladas\":true,"
                        + "\"dominancia\":100,\"duracionSegundos\":30" + RESERVAS_LLUVIA_BASICO + "}",
                NivelCurso.BASICO, 4, 33, 0, java.math.BigDecimal.ZERO);

        /* El bloque 1 cierra con "Contrarreloj: palabras de la fila central" y el 2 con
           "Contrarreloj: dos filas"; el 3 y el 4 no tenian ninguno. Sin este nodo el Test
           Final pedia 18 WPM —el umbral estricto del nivel— sin que ningun ejercicio
           hubiera pedido velocidad jamas: el examen media algo que el nivel no entreno. */
        /* Cambiado el 11-sep-2026 de `patron` (lista de palabras sueltas del diccionario) a
           `banco` (texto largo real): "son puras palabras, debe ser un texto largo", dijo
           el usuario. Ver ORACIONES_BASICO_TRES_FILAS. */
        crearEnCursoSiNoExiste("Contrarreloj: las tres filas",
                "Treinta segundos con un texto largo y el alfabeto entero. Cada palabra suma tiempo, cada error lo resta.",
                TipoEjercicio.CONTRARRELOJ,
                "{\"banco\":\"basico_tres_filas\",\"cantidad\":1,"
                        + "\"tiempoInicialSegundos\":30,\"bonusCorrectaSegundos\":1,\"penalizacionErrorSegundos\":2}",
                NivelCurso.BASICO, 4, 34);

        /* Reescrito el 11-sep-2026: mezclaba dígitos y letras al 50% desde el primer token,
           sin ninguna progresión — "como está ahora está complicada". Ahora son 4 tandas
           (ver generarProgresionNumerica) precedidas de un tutorial que enseña los diez
           dígitos de a uno, con el dedo que le toca a cada uno. */
        crearEnCursoSiNoExiste("Fila de números",
                "Los diez dígitos: primero de a uno, con el dedo que le toca a cada uno; después en tandas cada vez más sueltas.",
                TipoEjercicio.SIMBOLOS_CRITICOS,
                "{\"simbolos\":[\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\",\"9\",\"0\"],"
                        + "\"progresionNumerica\":true,\"porTandas\":true,\"tutorialPalabras\":10,"
                        + "\"mensajeTutorial\":\"Cada número tiene su propio dedo\","
                        + "\"captionsTutorial\":[\"Meñique izquierdo\",\"Anular izquierdo\",\"Medio izquierdo\","
                        + "\"Índice izquierdo\",\"Índice izquierdo\",\"Índice derecho\",\"Índice derecho\","
                        + "\"Medio derecho\",\"Anular derecho\",\"Meñique derecho\"]}",
                NivelCurso.BASICO, 4, 35);

        /* NUEVO el 11-sep-2026: el puente entre "Fila de números" (que solo enseña las
           TECLAS) y el Test Final (que ya no vuelve a mencionar un dígito). Sin este nodo
           un dígito se practicaba una sola vez, aislado, y nunca dentro de una frase real.
           Dos temas, salud/bienestar y motivación — no son de los cuatro de la guía de
           contenido, pero encajan con "datos curiosos" en que dan algo que pensar además
           de teclear, y los números de verdad ayudan a esos dos temas en particular
           (cantidades, minutos, repeticiones) sin sentirse forzados como en otros. */
        crearEnCursoSiNoExiste("Números de todos los días",
                "Un texto con algunos números de por medio, para no volver a verlos sueltos.",
                TipoEjercicio.ORACIONES_TEMATICAS,
                "{\"banco\":\"basico_numeros\",\"cantidad\":1}",
                NivelCurso.BASICO, 4, 36);

        /* EL EXAMEN DE SALIDA. Umbrales estrictos del nivel (18 WPM y 90%) y ademas no
           aprueba el nivel mientras queden nodos de una sola estrella: pasar cada
           ejercicio a duras penas no puede sumar un nivel aprobado. */
        crearEnCursoSiNoExiste("Test Final de Básico",
                "El examen del nivel: las tres filas, la coma y el punto, en un solo texto.",
                TipoEjercicio.ORACIONES_TEMATICAS,
                "{\"banco\":\"test_final_basico\",\"cantidad\":1}",
                NivelCurso.BASICO, 4, 37, RolEjercicioNivel.TEST_FINAL);

        /* EL EXAMEN DE UBICACION, y va en ORDEN 0 a proposito: orden 0 significa "no va en
           el sendero". No es parte del camino, es la ALTERNATIVA al camino, y ponerlo
           dentro le da una posicion en una secuencia que esta disenado para saltarse. De
           nodo 1 seria peor todavia: el usuario abre el curso y lo primero que ve es un
           examen que probablemente falle. Se dibuja como tarjeta en la pantalla del nivel.

           Ninguna de las cuatro webs de referencia lo mete en su lista de lecciones. */
        crearEnCursoSiNoExiste("Prueba de nivel: Básico",
                "¿Ya escribes al tacto? Supera esta prueba y sáltate el nivel entero.",
                TipoEjercicio.ORACIONES_TEMATICAS,
                "{\"banco\":\"test_nivel_basico\",\"cantidad\":1}",
                NivelCurso.BASICO, 4, 0, RolEjercicioNivel.TEST_NIVEL);
    }

    /* Nodos que dejaron de formar parte del Curso.

       Hace falta porque `crearEnCursoSiNoExiste` solo crea y actualiza: nunca borra. Sin
       esto, quitar un paso de PASOS_FUNDAMENTOS lo deja en la base con su `nivel` puesto y
       el sendero lo sigue mostrando — el usuario vería "Fundamentos: fd jk" flotando entre
       nodos que ya no existen en el plan.

       Se marcan `activo = false` en vez de borrarse: hay sesiones y progreso apuntando a
       esas filas por clave foránea, y borrarlas sería perder el historial de alguien que sí
       las practicó. Inactivo desaparece del sendero (la consulta filtra por activo) y
       tampoco cae en Ejercicios Base, que solo lista filas sin nivel. */
    private static final List<String> RETIRADOS_DEL_CURSO = List.of(
            // Consolidaciones que los latidos volvieron redundantes.
            "Fundamentos: fd jk", "Fundamentos: as lñ", "Fundamentos: asdf jklñ",
            "Fundamentos: re ui", "Fundamentos: qw op", "Fundamentos: qwer uiop",
            "Fundamentos: vc nm", "Fundamentos: zx ,.", "Fundamentos: zxcv nm,.",
            // Parejas de la fila inferior que estaban mal espejadas (ver PASOS_FUNDAMENTOS).
            "Fundamentos: v n", "Fundamentos: c m", "Fundamentos: x ,", "Fundamentos: z .",
            /* Partido en "Fundamentos: z x" con el punto y el guion de secundarias: cuatro
               teclas nuevas en un solo nodo era el doble que cualquier otro paso del nivel,
               y encima en el anular y el meñique. Como el sembrado busca por TÍTULO, cambiar
               el nombre crea una fila nueva y deja la vieja viva — por eso va acá. */
            "Fundamentos: zx .-",
            // Reemplazado por "Oraciones con las tres filas".
            "Oraciones simples cortas",
            /* Renombrados. El sembrado busca por TITULO, asi que cambiar el nombre deja la
               fila vieja viva con su orden anterior y el sendero mostraria las dos. */
            "Recorrido del índice", "Palabras línea inferior",
            /* Los dos los reemplaza "Lluvia de repaso: tus teclas mas falladas": la de las
               tres filas barria el alfabeto al azar y esta llueve lo que el usuario falla,
               que es estrictamente mejor como repaso; y el drill de falladas usaba el mismo
               dato con otra mecanica. La logica no se pierde: vive en letrasFalladasDe. */
            "Lluvia de letras: las tres filas", "Repetir letras más falladas",
            /* Renombrado a "Palabras de las dos filas". Se detecto en la auditoria: los dos
               quedaron ACTIVOS en el orden 18 y el sendero mostraba dos nodos seguidos casi
               identicos. Tercera vez que muerde la misma trampa del sembrado por titulo. */
            "Palabras línea superior",
            /* Renombrado a "Recorrido de anular y meñique". El titulo viejo contradecia a su
               propia configuracion, que ya servia el anular antes que el meñique — fuerte
               antes que debil, como manda el resto del nivel. Cuarta vez que hace falta
               retirar un titulo renombrado. */
            "Recorrido de meñique y anular",
            /* Quitada a pedido del usuario: el bloque 3 se queda con UNA sola lluvia. Sus
               teclas (`z x . -`) siguen practicandose en su nodo de Fundamentos y en el
               recorrido del anular y el meñique, que es donde el punto y el guion pasan del
               10% a ser el ejercicio. */
            "Lluvia de letras: las teclas raras",
            /* LOS OCHO "UN DEDO" DE INTERMEDIO, retirados el 9-sep-2026.

               Estaban duplicados con los dos recorridos de Basico y nadie los quito cuando
               aquellos se sembraron. Eran ademas la peor version de la mecanica: un dedo por
               nodo, asi que `generarLatidosUnDedo` —que exige dos o mas para partir— no los
               partia en tandas, y su sub-selector mostraba un unico boton ya pulsado. Ocho
               nodos seguidos de lo mismo abriendo el bloque 2 del nivel.

               Lo que hacian ahora lo hacen mejor los dos recorridos del bloque 3 de Basico,
               con la pista de tres carriles y con el dedo cayendo justo cuando se completa.
               Intermedio baja de 32 a 24 nodos y su bloque 2 arranca en el orden 21: el hueco
               del 13 al 20 es deliberado, igual que los dos numeros muertos de Avanzado. */
            "Un dedo: meñique izquierdo", "Un dedo: anular izquierdo",
            "Un dedo: medio izquierdo", "Un dedo: índice izquierdo",
            "Un dedo: índice derecho", "Un dedo: medio derecho",
            "Un dedo: anular derecho", "Un dedo: meñique derecho",
            /* Renombrado a "Oraciones con las teclas nuevas" el 10-sep-2026, al pasar de
               lista de palabras a frases. Quinta vez que un renombrado exige retirar el
               titulo viejo en el mismo cambio. */
            "Palabras con las teclas nuevas",
            /* Partido en dos el 11-sep-2026: "Palabras con la mano izquierda" y "...derecha".
               Metía las dos manos en un solo nodo con sub-selector, inconsistente con el
               resto del Curso (cada concepto es su propio paso). Sexta vez que un
               renombrado/split exige retirar el titulo viejo en el mismo cambio. */
            "Palabras cortas con una sola mano",
            /* Renombrados el 13-sep-2026: "Práctica de signos" → "El punto y coma" y
               "Oraciones con signos" → "Pausas y enumeraciones". Los dos títulos viejos
               llevaban la palabra "signos" y quedaban uno al lado del otro en el sendero
               sin decir cuál signo practicaba cada uno. Séptima y octava vez que un
               renombrado exige retirar el título viejo en el mismo cambio. */
            "Práctica de signos", "Oraciones con signos",
            /* Partido en dos el mismo día: "Patrones de la mano izquierda/derecha", cada
               uno con sus propias 3 tandas (una por patrón) en vez de las 9 combinaciones
               mezcladas en una sola tanda. Novena vez que un renombrado/split exige
               retirar el título viejo en el mismo cambio. */
            "Patrones de una mano",
            /* Partido en dos el 14-sep-2026: "Oraciones con mano forzada al 90% (izquierda)"
               y "(derecha)", mismo criterio que "Palabras con la mano izquierda/derecha" —
               un solo nodo con las DOS manos en su config dibujaba un sub-selector,
               inconsistente con el resto del Curso. Décima vez que un renombrado/split
               exige retirar el título viejo en el mismo cambio. */
            "Oraciones con mano forzada al 90%");

    private void retirarDelCurso() {
        for (String titulo : RETIRADOS_DEL_CURSO) {
            ejercicioRepository.findByTitulo(titulo).ifPresent(e -> {
                if (Boolean.TRUE.equals(e.getActivo())) {
                    e.setActivo(false);
                    /* Y se le aparca el `orden` fuera del rango del curso. El filtro por
                       `activo` ya alcanza, pero un retirado que conserva su orden viejo
                       empata con el nodo nuevo que ocupó ese número, y cualquier consulta
                       futura que se olvide del filtro vuelve a caer en el mismo pozo.
                       Con 900+ el empate es imposible. */
                    e.setOrden(900 + e.getId());
                    ejercicioRepository.save(e);
                    log.info("[CURSO] Ejercicio retirado del sendero: {}", titulo);
                }
            });
        }
    }


    /* Los pasos de Fundamentos de BÁSICO, como DATOS y no como llamadas escritas a mano.

       Dos motivos. El primero es que cada fila necesita saber qué teclas vio el usuario
       ANTES de llegar a ella, para mezclarlas en los latidos 2, 3 y 4; escribir esa cadena
       a mano sería un fallo mudo el día que se reordene un paso —el ejercicio seguiría
       generando texto, con las teclas equivocadas—. El segundo es que el orden de los
       pasos ES el currículo, y conviene poder leerlo de corrido.

       ===== POR QUÉ ESTA LISTA TIENE 14 PASOS Y NO 23 =====

       Se retiraron los pasos de CONSOLIDACIÓN — "fd jk", "as lñ", "asdf jklñ", "re ui",
       "qw op", "qwer uiop", "vc nm", "zx ,." y "zxcv nm,." — porque quedaron duplicados
       por los latidos. Antes tenían sentido: "f j" era una sola tanda plana de 110
       caracteres y hacía falta un nodo aparte para mezclar. Hoy "d k" ya son cuatro
       tandas donde las tres últimas mezclan `f` y `j` al 90, 85 y 80 por ciento. El nodo
       de consolidación repetía lo que el nodo anterior ya hace por dentro.

       Medido: 14 pasos con latidos son ~2.600 caracteres de práctica contra los ~2.530 de
       los 23 pasos planos. Menos de la mitad de nodos, la misma práctica o algo más.

       ===== LA FILA INFERIOR SE REEMPAREJÓ =====

       Estaba mal desde el principio: las cinco parejas iban corridas un lugar respecto del
       espejo real de los dedos, y la `b` se había quedado sin pareja — o sea que la letra
       B no se enseñaba en NINGÚN punto del curso, siendo el 11% del diccionario (bien,
       bueno, sabes, estaba, también, sobre, hombre, trabajo).

       El espejo correcto, que además coincide exactamente con el orden de TypingClub
       (lecciones 52 a 88 de su curso): v↔m · c↔, · x↔. · z↔- · y b↔n al final, como
       "puente del medio", el mismo papel que ya tienen "g h" y "t y" en las otras filas.
       `z` y `x` van juntos en un solo paso porque entre los dos son el 3% del idioma. */
    /* `ancla`: la tecla de REPOSO de la que sale cada tecla nueva, en el mismo orden en que
       aparecen en `paso`. Vacía en la fila central de reposo (f j, d k, s l, a ñ), donde las
       teclas nuevas SON el reposo y no hay ningún alcance que mezclar aparte.

       ⚠️ REESCRITO el 11-sep-2026, dos veces el mismo día. Hasta entonces el PRIMER latido
       de un nodo con `ancla` tenía su propio generador (`generarTandaConAncla`, ya borrado):
       emparejaba cada tecla nueva con su reposo EN EL MISMO TOKEN —`fv fvf jm jmj`—, así que
       la mitad del texto era la tecla vieja sin importar la `dominancia` del plan. El
       usuario lo comparó contra la fila central —ahí "Aprende" siempre fue 95% la tecla
       nueva, porque esos nodos no tienen `ancla` y caen directo al generador de dominancia
       de siempre— y pidió que la fila superior se sintiera IGUAL: mismo generador en los
       tres latidos que no son el último (Aprende, Combina, Mezcla), solo cambiando el
       `dominancia` del plan (95 → 90 → 85). Ya no hay ida-vuelta forzado en ningún latido;
       lo que enseña el regreso a la fila de reposo es que ese "viejo" 5-15% siga siendo
       `ancla` y nunca el resto de `acumuladas` — ver el motivo abajo.

       Y ESE es el primer arreglo del día: mezclar con TODO lo acumulado tenía sentido en la
       fila central —cualquier tecla de reposo es igual de segura mezclarla con cualquier
       otra— pero en la fila superior "r u" terminaba mezclando con `d`, `l`, `a`... letras
       de otros dedos que no tienen nada que ver con el alcance que se está enseñando. El
       usuario lo vio en la pantalla: *"solo debería mezclarme la 'f j' no más"*. La cadena
       por nodo, siguiendo su propia regla (ancla propia + la lección inmediatamente anterior
       de la fila):
         · r u → fj (primera de la fila, sin lección previa que sumar)
         · e i → dk + ru
         · w o → sl + ei
         · q p → añ + wo
         · t y → fj + qp
       `g h` (fila central, alcance interior) no suma nada: su cadena sigue siendo `fj` sola,
       porque no hay "lección anterior de la fila" — es el primer alcance del nivel.

       `secundarias`: un tercer pool, MÁS chico (`DOMINANCIA_SECUNDARIAS`, hoy 10%), para lo
       que quedó "dos lecciones atrás" — todavía vale la pena repasarlo un poco, pero no
       tanto como la cadena inmediata de `ancla`. Nace con `z x`, que lo usa para `. -` con
       otro criterio (teclas que el paso introduce de refilón, ver más abajo); en la fila
       superior lo reusa el mismo mecanismo, con las letras de las lecciones más viejas:
         · w o → ru        (lo que quedó dos atrás de w o)
         · q p → ei ru     (dos atrás de w o Y de q p, acumulado)
         · t y → wo ei ru  (idem)

       Fila inferior, 11-sep-2026: la misma cadena, con `z x` como excepción propia (abajo):
         · v m → fj (primera de la fila, como r u en la superior — sin lección previa)
         · c , → dk + vm
         · b n → vm + fj + gh, el ancla más ancha del nivel: todo lo que ya usan los
                 ÍNDICES (su propio reposo, el otro "puente" g h, y la bajada corta v m),
                 pedido explícito del usuario — no sigue la cadena estricta de "solo la
                 lección inmediata anterior" porque `z x` (el nodo justo antes) usa dedos
                 distintos (anular y meñique) y no tiene nada que ver con el alcance más
                 largo del índice que este nodo enseña.

       `z x` es distinto a propósito, y no solo en su `ancla`. Sin ninguna vocal, no forma
       palabras reales ni tiene sentido mezclarlo con nada fuera de sus propias `. -` — ni
       con `d k s l a ñ` (su ancla original, `aslñ`, se borró) ni con el resto de
       `acumuladas`. El punto y el guion son del anular y el meñique DERECHOS: meterlos con
       el mismo peso que la z y la x daba un nodo de cuatro teclas y dos manos —el más
       cargado del nivel, y en los dedos más débiles—, así que entran de refilón y su
       práctica real llega en el recorrido de esos dos dedos, que va justo después. Pero
       acá SON el único "viejo" que existe —no hay ningún ancla de reposo detrás que
       también repasar— así que además de `ancla=""` y `secundarias=".-"` lleva su PROPIA
       progresión en `dominanciaPropia` (`"80,75,70,70"`, no la global 95/90/85/80).
       `generarLatidos` la usa como gatillo de dos cosas a la vez: cambia el `dominancia`
       de cada latido Y hace que el ÚLTIMO TAMBIÉN use el generador de sílabas en vez de
       buscar palabras reales — `z x . -` nunca forma ninguna, así que `generarCierreDelNodo`
       habría ido a buscarlas en TODO `acumuladas`, sacando al nodo de su propio material. */
    private record PasoFundamentos(String titulo, String descripcion, String fila,
                                   String paso, String ancla, String secundarias,
                                   int bloque, int orden, String dominanciaPropia) {
        /* Constructor de 8 argumentos para todos los nodos que usan la progresión GLOBAL
           de PLAN_LATIDOS (95/90/85/80). Solo "z x" necesita el de 9, con su propia
           progresión (80/75/70/70) — ver la nota grande junto a PASOS_FUNDAMENTOS. */
        PasoFundamentos(String titulo, String descripcion, String fila, String paso,
                        String ancla, String secundarias, int bloque, int orden) {
            this(titulo, descripcion, fila, paso, ancla, secundarias, bloque, orden, "");
        }
    }

    private static final int DOMINANCIA_SECUNDARIAS = 10;

    private static final List<PasoFundamentos> PASOS_FUNDAMENTOS = List.of(
            // --- Bloque 1: fila central ---
            new PasoFundamentos("Fundamentos: f j", "Los dos índices, sobre las teclas con relieve.", "central", "f j", "", "", 1, 1),
            new PasoFundamentos("Fundamentos: d k", "Los dedos medios, justo al lado.", "central", "d k", "", "", 1, 2),
            new PasoFundamentos("Fundamentos: s l", "Los anulares.", "central", "s l", "", "", 1, 4),
            new PasoFundamentos("Fundamentos: a ñ", "Los meñiques, en los extremos de la fila.", "central", "a ñ", "", "", 1, 5),
            new PasoFundamentos("Fundamentos: g h", "El puente del medio: los índices se estiran hacia dentro, sin soltar la efe ni la jota.", "central", "g h", "fj", "", 1, 7),

            // --- Bloque 2: fila superior ---
            new PasoFundamentos("Fundamentos: r u", "Los índices suben una fila y vuelven.", "superior", "r u", "fj", "", 2, 10),
            new PasoFundamentos("Fundamentos: e i", "Los medios suben. La e es la letra más usada del español.", "superior", "e i", "dkru", "", 2, 11),
            new PasoFundamentos("Fundamentos: w o", "Los anulares suben.", "superior", "w o", "slei", "ru", 2, 13),
            new PasoFundamentos("Fundamentos: q p", "Los meñiques suben. Son los dedos más débiles de la mano.", "superior", "q p", "añwo", "eiru", 2, 14),
            new PasoFundamentos("Fundamentos: t y", "El puente de arriba: el índice se estira en diagonal.", "superior", "t y", "fjqp", "woeiru", 2, 16),

            /* --- Bloque 3: fila inferior ---
               `z x` van juntos porque entre los dos son el 3% del idioma: la x aparece en el
               1,1% de las palabras del diccionario y la z en el 2,9%, contra el 37,6% de la n.
               No merecen el mismo espacio que una tecla frecuente. */
            new PasoFundamentos("Fundamentos: v m", "Los índices bajan. El dedo se dobla y regresa a su tecla.", "inferior", "v m", "fj", "", 3, 20),
            new PasoFundamentos("Fundamentos: c ,", "El medio baja y aparece la coma. La coma va pegada a la palabra, el espacio va después.", "inferior", "c ,", "dkvm", "", 3, 21),
            new PasoFundamentos("Fundamentos: z x", "Las dos teclas menos usadas del idioma, con el punto y el guion asomando.", "inferior", "z x", "", ".-", 3, 24, "80,75,70,70"),
            new PasoFundamentos("Fundamentos: b n", "El puente de abajo: el alcance más largo del teclado.", "inferior", "b n", "vmfghj", "", 3, 26));

    private void sembrarFundamentosCurso() {
        /* Las teclas vistas hasta ahora, en orden de aparición. Un LinkedHashSet y no un
           HashSet para que la cadena salga siempre igual: con un HashSet el orden depende
           del hash, la configuración de la fila cambiaría entre arranques y dispararía una
           escritura en la base cada vez sin que nada haya cambiado de verdad. */
        Set<Character> vistas = new LinkedHashSet<>();

        for (PasoFundamentos p : PASOS_FUNDAMENTOS) {
            String nuevas = p.paso().replace(" ", "");

            // Acumuladas = lo visto antes, MENOS lo que este paso ya practica.
            StringBuilder acumuladas = new StringBuilder();
            for (Character c : vistas) {
                if (nuevas.indexOf(c) < 0) acumuladas.append(c);
            }

            /* Las secundarias NO entran en `vistas`: se practican de refilón acá y de verdad
               en el recorrido que viene después, así que hasta entonces no cuentan como
               aprendidas para las lluvias ni para los nodos de palabras. */
            String extras = p.ancla().isEmpty() ? ""
                    : String.format(",\"ancla\":\"%s\"", p.ancla());
            if (!p.secundarias().isEmpty()) {
                extras += String.format(",\"secundarias\":\"%s\",\"dominanciaSecundarias\":%d",
                        p.secundarias(), DOMINANCIA_SECUNDARIAS);
            }
            if (!p.dominanciaPropia().isEmpty()) {
                extras += String.format(",\"dominanciaPropia\":\"%s\"", p.dominanciaPropia());
            }

            String config = String.format(
                    "{\"filas\":[{\"id\":\"%s\",\"pasos\":[\"%s\"]}],\"acumuladas\":\"%s\"%s}",
                    p.fila(), p.paso(), acumuladas, extras);

            crearEnCursoSiNoExiste(p.titulo(), p.descripcion(), TipoEjercicio.LETRAS_BASICO,
                    config, NivelCurso.BASICO, p.bloque(), p.orden());

            for (char c : nuevas.toCharArray()) vistas.add(c);
        }
    }

    /* Mismo criterio de crearSiNoExiste (idempotente, actualiza si cambió), pero para
       filas del CURSO: además de config, mantiene nivel/bloque/orden/rol al día en cada
       arranque — así reordenar el mapeo es solo cambiar estos números acá, sin migración
       manual. */
    private void crearEnCursoSiNoExiste(String titulo, String descripcion, TipoEjercicio tipo, String config,
            NivelCurso nivel, Integer bloque, int ordenEnNivel) {
        crearEnCursoSiNoExiste(titulo, descripcion, tipo, config, nivel, bloque, ordenEnNivel, null);
    }

    /* Igual, pero fijando los umbrales de ESTE ejercicio en vez de heredar los del nivel.

       Lo usa la Lluvia de letras, que va con 0 y 0: es un juego, y su WPM no es comparable
       con el de un drill de tecleo —el jugador espera a que la letra baje— así que medirlo
       con la misma vara sería medir otra cosa. Con la calibración de antes el nodo era
       IMPOSIBLE de aprobar: la mecánica daba once letras en quince segundos, o sea 8,8 WPM
       contra los 10 que pedía el nivel.

       Es el mismo mecanismo que ya existía en la entidad (umbralWpmPropio /
       umbralPrecisionPropia) y que hasta ahora ninguna fila usaba. */
    private void crearEnCursoSiNoExiste(String titulo, String descripcion, TipoEjercicio tipo, String config,
            NivelCurso nivel, Integer bloque, int ordenEnNivel,
            int umbralWpm, java.math.BigDecimal umbralPrecision) {
        crearEnCursoSiNoExiste(titulo, descripcion, tipo, config, nivel, bloque, ordenEnNivel, null);
        ejercicioRepository.findByTitulo(titulo).ifPresent(e -> {
            e.setUmbralWpmPropio(umbralWpm);
            e.setUmbralPrecisionPropia(umbralPrecision);
            ejercicioRepository.save(e);
        });
    }

    private void crearEnCursoSiNoExiste(String titulo, String descripcion, TipoEjercicio tipo, String config,
            NivelCurso nivel, Integer bloque, int ordenEnNivel, RolEjercicioNivel rol) {
        Ejercicio existente = ejercicioRepository.findByTitulo(titulo).orElse(null);

        if (existente != null) {
            /* La DESCRIPCIÓN se sincroniza siempre, no solo cuando cambió la configuración.
               Estaban atadas, y por eso reescribir un texto sin tocar el JSON no llegaba
               nunca a la pantalla: los nodos seguían mostrando la descripción vieja para
               siempre. Es un fallo mudo — el sembrado registra que "creó" el ejercicio y
               todo parece correcto. */
            existente.setDescripcion(descripcion);
            /* ⚠️ REESCRITO el 11-sep-2026: hasta hoy `tipo` nunca se resincronizaba acá —se
               guardaba solo al CREAR la fila—, así que cambiar el TipoEjercicio de un
               ejercicio ya sembrado (manteniendo el mismo título a propósito, para no pasar
               por RETIRADOS_DEL_CURSO) no hacía nada: la fila seguía comportándose con el
               tipo viejo para siempre. Lo destapó "Práctica de signos" al pasar de
               SIMBOLOS_CRITICOS a ORACIONES_TEMATICAS sin cambiar el título (6.23). */
            existente.setTipo(tipo);
            if (!java.util.Objects.equals(config, existente.getConfiguracion())) {
                existente.setConfiguracion(config);
            }
            /* Y `activo` vuelve a true: un ejercicio que estuvo retirado y regresa al plan
               tiene que reaparecer en el sendero. Sin esto, quitarlo y devolverlo lo
               dejaría invisible sin ninguna señal de por qué. */
            existente.setActivo(true);
            existente.setNivel(nivel);
            existente.setBloque(bloque);
            existente.setOrden(ordenEnNivel);
            existente.setRolEnNivel(rol);
            ejercicioRepository.save(existente);
            return;
        }

        ejercicioRepository.save(Ejercicio.builder()
                .titulo(titulo)
                .descripcion(descripcion)
                .tipo(tipo)
                .configuracion(config)
                .orden(ordenEnNivel)
                .activo(true)
                .nivel(nivel)
                .bloque(bloque)
                .rolEnNivel(rol)
                .build());
        log.info("Ejercicio de Curso sembrado: {} (nivel {} bloque {} orden {})", titulo, nivel, bloque, ordenEnNivel);
    }

    /* Saca un ejercicio del catálogo sin borrarlo: deja de listarse (listarActivos filtra
       por activo=true) pero las sesiones históricas que lo referencian siguen válidas. */
    private void desactivarSiExiste(String titulo) {
        ejercicioRepository.findByTitulo(titulo).ifPresent(e -> {
            if (Boolean.TRUE.equals(e.getActivo())) {
                e.setActivo(false);
                ejercicioRepository.save(e);
                log.info("Ejercicio desactivado: {}", titulo);
            }
        });
    }

    private void crearSiNoExiste(String titulo, String descripcion, TipoEjercicio tipo, String config, int orden) {
        /* Antes esto solo insertaba si faltaba, y nunca actualizaba. El problema: al
           cambiar el formato de `configuracion` (como pasó en Fundamentos, que pasó de
           "zonas" a "filas"), la fila vieja se quedaba con el formato anterior y el
           generador reventaba al no encontrar la clave nueva.
           Ahora, si el ejercicio existe pero su configuración cambió, se actualiza. */
        Ejercicio existente = ejercicioRepository.findByTitulo(titulo).orElse(null);

        if (existente != null) {
            /* Objects.equals y no config.equals: hay ejercicios que se siembran con
               configuracion = null (Top 100, Oraciones con mayúsculas, Palabras
               simples...), y comparar desde el null reventaba el arranque entero. */
            if (!java.util.Objects.equals(config, existente.getConfiguracion())) {
                existente.setConfiguracion(config);
                existente.setDescripcion(descripcion);
                ejercicioRepository.save(existente);
                log.info("Ejercicio actualizado (configuración nueva): {}", titulo);
            }
            return;
        }

        ejercicioRepository.save(Ejercicio.builder()
                .titulo(titulo)
                .descripcion(descripcion)
                .tipo(tipo)
                .configuracion(config)
                .orden(orden)
                .activo(true)
                .build());
        log.info("Ejercicio sembrado: {}", titulo);
    }
}
