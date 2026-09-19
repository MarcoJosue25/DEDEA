package com.dedea.app.service.impl;

import com.dedea.app.dto.CursoStatsResponse;
import com.dedea.app.dto.DebilidadesResponse;
import com.dedea.app.dto.ProgresoEjercicioResponse;
import com.dedea.app.dto.ResultadoCursoResponse;
import com.dedea.app.model.Ejercicio;
import com.dedea.app.model.ProgresoCursoNivel;
import com.dedea.app.model.ProgresoEjercicioCurso;
import com.dedea.app.model.Sesion;
import com.dedea.app.model.enums.TipoEjercicio;
import com.dedea.app.model.enums.NivelCurso;
import com.dedea.app.model.enums.RolEjercicioNivel;
import com.dedea.app.repository.EjercicioRepository;
import com.dedea.app.repository.ProgresoCursoNivelRepository;
import com.dedea.app.repository.ProgresoEjercicioCursoRepository;
import com.dedea.app.repository.SesionRepository;
import com.dedea.app.repository.SesionTeclaRepository;
import com.dedea.app.service.CursoStatsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/* Analítica y umbral de avance del futuro Curso por niveles. Deliberadamente separado de
   StatsServiceImpl: ninguna query ni ningún cálculo de acá se cruza con los promedios
   globales (que solo miden Noticias + IA). */
@Slf4j
@Service
@RequiredArgsConstructor
public class CursoStatsServiceImpl implements CursoStatsService {

    private final SesionRepository sesionRepository;
    private final SesionTeclaRepository sesionTeclaRepository;
    private final ProgresoCursoNivelRepository progresoRepository;
    private final ProgresoEjercicioCursoRepository progresoEjercicioRepository;
    private final EjercicioRepository ejercicioRepository;

    private static final NivelCurso[] ORDEN_NIVELES = {NivelCurso.BASICO, NivelCurso.INTERMEDIO, NivelCurso.AVANZADO};

    /* Umbral FIJO por nivel para APROBAR EL NIVEL (Test Final y Test de Nivel usan
       este mismo umbral — no una escalera adaptativa como el Área de Entrenamiento).
       Números de partida, ajustables acá sin tocar la lógica. */
    private static final Map<NivelCurso, Integer> UMBRAL_WPM = Map.of(
            NivelCurso.BASICO, 18,
            NivelCurso.INTERMEDIO, 32,
            NivelCurso.AVANZADO, 45);

    private static final Map<NivelCurso, Integer> UMBRAL_PRECISION = Map.of(
            NivelCurso.BASICO, 90,
            NivelCurso.INTERMEDIO, 92,
            NivelCurso.AVANZADO, 94);

    /* Umbral por defecto para un ejercicio NORMAL (ni test de nivel ni test final): la
       mitad del umbral de aprobar el nivel, redondeado. Un ejercicio puede pisar esto
       con su propio umbralWpmPropio/umbralPrecisionPropia si hace falta algo distinto. */
    private static final Map<NivelCurso, Integer> UMBRAL_WPM_EJERCICIO_DEFAULT = Map.of(
            NivelCurso.BASICO, 10,
            NivelCurso.INTERMEDIO, 16,
            NivelCurso.AVANZADO, 22);

    /* Básico subió de 70% a 85%. El motivo: 70% es fallar tres de cada diez teclas, y a esa
       altura no se está aprendiendo a escribir sino grabando el error como hábito. El
       marcador de TypingClub exige 80% de precisión y apenas 3 WPM — la precisión es la
       puerta y la velocidad casi no cuenta. Acá se pide algo más: 85%. */
    private static final Map<NivelCurso, BigDecimal> UMBRAL_PRECISION_EJERCICIO_DEFAULT = Map.of(
            NivelCurso.BASICO, BigDecimal.valueOf(85),
            NivelCurso.INTERMEDIO, BigDecimal.valueOf(75),
            NivelCurso.AVANZADO, BigDecimal.valueOf(80));

    /* ---- Umbrales de los LATIDOS (solo ejercicios de letras del Curso) ----

       SALTO: tras el segundo latido, quien va MUY por encima se ahorra los dos que faltan.
       35 WPM es casi el doble de los 18 con los que se aprueba Básico entero: no es una
       puerta para "el que va bien" sino para el que ya sabe teclear y está repasando.
       Un aprendiz normal hace los cuatro, y eso es intencional. */
    public static final int SALTO_WPM = 35;
    public static final BigDecimal SALTO_PRECISION = BigDecimal.valueOf(95);

    /* ÚLTIMO INTENTO: el quinto latido que se ofrece tras fallar los cuatro. Se juzga SOLO
       por precisión — sin exigencia de velocidad — porque el error que corrige es
       justamente ir demasiado rápido. Pedir además WPM lo convertiría en un castigo
       disfrazado de rescate. Aprobar por acá da UNA estrella: pasaste, pero con ayuda. */
    public static final BigDecimal ULTIMO_INTENTO_PRECISION = BigDecimal.valueOf(90);

    /* Test de Nivel (la "Prueba de nivel"): precisión ≥95% Y WPM ≥ el umbral de aprobar ese
       nivel. Subió de 80% el 18-sep-2026, decisión del usuario: "lo que importa es la
       precisión, no la velocidad". Con 80% saltarse el nivel entero salía MÁS fácil que
       terminarlo (el Test Final pide 90/92/94%); 95% queda por encima de los tres. */
    private static final BigDecimal UMBRAL_TEST_NIVEL_PRECISION = BigDecimal.valueOf(95);

    @Override
    public CursoStatsResponse obtenerStatsPorNivel(String identificadorTemporal, NivelCurso nivel) {
        List<Sesion> sesiones = sesionRepository.findSesionesCursoPorNivel(identificadorTemporal, nivel.name());

        int wpmPromedio = (int) Math.round(sesiones.stream().mapToInt(Sesion::getWpm).average().orElse(0.0));
        BigDecimal precisionPromedio = sesiones.isEmpty() ? BigDecimal.ZERO :
                sesiones.stream()
                        .map(Sesion::getPrecision)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(sesiones.size()), 2, RoundingMode.HALF_UP);

        List<DebilidadesResponse.ItemDebilidad> teclas = sesionTeclaRepository
                .findTeclaStatsCursoPorNivel(identificadorTemporal, nivel.name(), 1)
                .stream()
                .map(dto -> {
                    double pct = dto.totalIntentos().doubleValue() > 0
                            ? (dto.errores().doubleValue() / dto.totalIntentos().doubleValue()) * 100
                            : 0.0;
                    return new DebilidadesResponse.ItemDebilidad(
                            dto.tecla(), (int) Math.round(pct), dto.totalIntentos().longValue());
                })
                .sorted(Comparator.comparingInt(DebilidadesResponse.ItemDebilidad::getPorcentajeError).reversed())
                .limit(5)
                .collect(Collectors.toList());

        ProgresoCursoNivel progreso = progresoRepository
                .findByIdentificadorTemporalAndNivel(identificadorTemporal, nivel)
                .orElseGet(() -> crearProgresoInicial(identificadorTemporal, nivel));

        Ejercicio prueba = ejercicioRepository
                .findFirstByNivelAndRolEnNivelAndActivoTrue(nivel, RolEjercicioNivel.TEST_NIVEL)
                .orElse(null);

        return CursoStatsResponse.builder()
                .nivel(nivel.name())
                .wpmPromedio(wpmPromedio)
                .precisionPromedio(precisionPromedio)
                .sesionesCompletadas(sesiones.size())
                .desbloqueado(Boolean.TRUE.equals(progreso.getDesbloqueado()))
                .aprobado(Boolean.TRUE.equals(progreso.getAprobado()))
                .teclasMasFalladas(teclas)
                .nodosPorMejorar(contarPorMejorar(identificadorTemporal, nivel))
                .pruebaNivelId(prueba != null ? prueba.getId() : null)
                .pruebaNivelWpm(prueba != null ? UMBRAL_WPM.get(nivel) : null)
                .pruebaNivelPrecision(prueba != null ? UMBRAL_TEST_NIVEL_PRECISION : null)
                .build();
    }

    @Override
    @Transactional
    public ResultadoCursoResponse registrarProgresoEjercicio(String identificadorTemporal, Ejercicio ejercicio,
                                                             Integer wpm, BigDecimal precision,
                                                             boolean porUltimoIntento) {
        NivelCurso nivel = ejercicio.getNivel();
        if (nivel == null) return null; // Ejercicios Base no participan de esto

        RolEjercicioNivel rol = ejercicio.getRolEnNivel();

        /* El estado ANTES de tocar nada. Hace falta para poder decir "subiste de 2 a 3
           estrellas" o "primera vez": leerlo después de guardar daría siempre "ya estaba". */
        ProgresoEjercicioCurso previo = progresoEjercicioRepository
                .findByIdentificadorTemporalAndEjercicioId(identificadorTemporal, ejercicio.getId())
                .orElse(null);
        int mediasPrevias = previo != null && previo.getMediasEstrellas() != null ? previo.getMediasEstrellas() : 0;
        boolean yaEstabaCompletado = previo != null && Boolean.TRUE.equals(previo.getCompletado());
        boolean esRecord = previo == null || previo.getMejorWpm() == null || wpm > previo.getMejorWpm();

        // No son finales: el ultimo intento los reemplaza mas abajo.
        int umbralWpm;
        BigDecimal umbralPrecision;
        if (rol == RolEjercicioNivel.TEST_NIVEL) {
            umbralWpm = UMBRAL_WPM.get(nivel);
            umbralPrecision = UMBRAL_TEST_NIVEL_PRECISION;
        } else if (rol == RolEjercicioNivel.TEST_FINAL) {
            umbralWpm = UMBRAL_WPM.get(nivel);
            umbralPrecision = BigDecimal.valueOf(UMBRAL_PRECISION.get(nivel));
        } else {
            umbralWpm = ejercicio.getUmbralWpmPropio() != null
                    ? ejercicio.getUmbralWpmPropio() : UMBRAL_WPM_EJERCICIO_DEFAULT.get(nivel);
            umbralPrecision = ejercicio.getUmbralPrecisionPropia() != null
                    ? ejercicio.getUmbralPrecisionPropia() : UMBRAL_PRECISION_EJERCICIO_DEFAULT.get(nivel);
        }

        /* El QUINTO latido cambia las reglas: solo cuenta la precision, sin exigencia de
           velocidad, y aprobar por ahi da exactamente UNA estrella. Es un rescate para
           quien fallo por ir demasiado rapido, no una segunda puerta mas facil — de hecho
           pide MAS precision (90%) que el camino normal (85%). */
        /* En un juego el WPM no mide destreza: la letra tarda lo que tarda en caer, así que
           un jugador impecable y uno mediocre sacan cifras parecidas. Lo que sí distingue es
           la PRECISIÓN — de las teclas que pulsaste, cuántas eran una letra que de verdad
           estaba cayendo—, y por eso las estrellas de la Lluvia salen solo de ahí. */
        boolean esJuego = ejercicio.getTipo() == TipoEjercicio.LLUVIA_LETRAS;

        boolean superado;
        int medias;
        if (porUltimoIntento) {
            superado = precision.compareTo(ULTIMO_INTENTO_PRECISION) >= 0;
            medias = superado ? 2 : 0;
            umbralWpm = 0;
            umbralPrecision = ULTIMO_INTENTO_PRECISION;
        } else {
            superado = wpm >= umbralWpm && precision.compareTo(umbralPrecision) >= 0;
            medias = esJuego
                    ? calcularMediasJuego(precision)
                    : calcularMediasEstrellas(nivel, wpm, precision, superado, umbralWpm);
        }

        boolean nivelAprobadoAhora = false;
        boolean primeraVez = false;

        if (superado) {
            if (rol == RolEjercicioNivel.TEST_NIVEL) {
                /* Salto de nivel completo: NO pasa por ProgresoEjercicioCurso — aprobar el
                   nivel por acá es una excepción, no un nodo más de la secuencia. */
                nivelAprobadoAhora = aprobarNivelCompleto(identificadorTemporal, nivel);
            } else {
                primeraVez = !yaEstabaCompletado;
                marcarEjercicioCompletado(identificadorTemporal, ejercicio.getId(), wpm, precision, medias);

                // Test Final es el único gatillo real de la aprobación del nivel — ya no un
                // promedio continuo evaluado después de cada sesión.
                /* El Test Final NO aprueba el nivel mientras queden nodos de una sola
                   estrella. Aprobar a duras penas cada ejercicio no puede sumar un nivel
                   aprobado, y es lo que cierra la puerta a farmear el quinto intento:
                   pasar por ahi da una estrella, y esa estrella hay que levantarla antes
                   de que el examen cuente. */
                if (rol == RolEjercicioNivel.TEST_FINAL && contarPorMejorar(identificadorTemporal, nivel) == 0) {
                    nivelAprobadoAhora = aprobarNivelCompleto(identificadorTemporal, nivel);
                }
            }
        }

        return ResultadoCursoResponse.builder()
                .nivel(nivel.name())
                .rolEnNivel(rol != null ? rol.name() : null)
                .superado(superado)
                .estrellas(aEstrellas(medias))
                .estrellasPrevias(aEstrellas(mediasPrevias))
                .umbralWpm(umbralWpm)
                .umbralPrecision(umbralPrecision)
                .wpm(wpm)
                .precision(precision)
                .primeraVez(primeraVez)
                .esRecordWpm(esRecord)
                .nivelAprobado(nivelAprobadoAhora)
                .nivelDesbloqueado(nivelAprobadoAhora ? nombreDelSiguiente(nivel) : null)
                .nodosCompletados(contarCompletados(identificadorTemporal, nivel))
                .nodosTotales(ejercicioRepository
                        .findByNivelAndActivoTrueAndOrdenGreaterThanOrderByOrdenAsc(nivel, 0).size())
                .esJuego(esJuego)
                .nodosPorMejorar(contarPorMejorar(identificadorTemporal, nivel))
                .build();
    }

    /* Puntaje de un intento, EN MEDIAS ESTRELLAS (0 a 6). LA PRECISIÓN MANDA SOBRE LA
       VELOCIDAD, que es el criterio de TypingClub ("optimized to value accuracy over
       speed") y de typing.com (sus tres estrellas van atadas a la precisión). Tiene
       sentido acá también: escribir rápido con errores es el hábito que un curso de
       mecanografía tiene que desalentar, no premiar.

       Los números NO son nuevos: salen de los umbrales que ya estaban calibrados arriba.
       La escalera, con lo que significa cada peldaño:

         0        no llegaste al mínimo del ejercicio
         1 ★      pasaste el mínimo y nada más — CONVIENE REPETIRLO
         2 ★      lo pasaste bien: además llegaste a la precisión de aprobar el nivel
         2½ ★     lo pasaste bien y vas rápido: la velocidad está a mitad de camino
         3 ★      muy bien: este intento habría aprobado el nivel entero

       El peldaño de la media estrella es el PUNTO MEDIO entre el umbral del propio
       ejercicio y el de aprobar el nivel (en Básico: entre 9 y 18 WPM, o sea 14). No es
       una constante nueva — se calcula de las dos que ya existen, así que recalibrar los
       umbrales lo mueve solo. Existe porque el salto de 2 a 3 era demasiado largo para no
       tener ninguna señal en el medio: con 15 WPM en Básico y 17 se veía exactamente lo
       mismo, aunque uno esté a un paso de aprobar.

       Ninguna estrella por encima de la primera se consigue con velocidad sola: el orden
       de los ifs es deliberado — sin precisión el intento se queda en una estrella por
       rápido que sea. */
    private int calcularMediasEstrellas(NivelCurso nivel, Integer wpm, BigDecimal precision,
                                        boolean superado, int umbralWpmDelEjercicio) {
        if (!superado) return 0;
        if (precision.compareTo(BigDecimal.valueOf(UMBRAL_PRECISION.get(nivel))) < 0) return 2; // 1 estrella

        int umbralNivel = UMBRAL_WPM.get(nivel);
        if (wpm >= umbralNivel) return 6;                                  // 3 estrellas

        /* El punto medio se calcula contra el umbral REAL de este ejercicio, no contra el
           default del nivel: una fila con umbralWpmPropio arrancaría su media estrella en
           el lugar equivocado. Redondeo hacia arriba para que el peldaño quede POR ENCIMA
           del medio y no se conceda con menos de la mitad del camino.
           En un test (umbral del ejercicio = umbral del nivel) el punto medio coincide con
           el umbral entero, así que la media estrella no existe ahí — que es correcto: un
           test se aprueba o no. */
        int puntoMedio = (int) Math.ceil((umbralWpmDelEjercicio + umbralNivel) / 2.0);
        return wpm >= puntoMedio ? 5 : 4;                                  // 2½ o 2 estrellas
    }

    /* Las estrellas de un juego, solo por precisión.

       Con la escala normal la Lluvia era casi imposible de puntuar: pide 10 WPM para las
       tres estrellas y el juego apenas los roza, así que todo intento honesto caía en una
       o dos estrellas hiciera lo que hiciera el jugador. Las estrellas dejaban de informar
       justo en la pantalla donde son lo único que se muestra.

       La escala es más suave que la del curso (95/85/75/60 contra el 85 pelado del nivel)
       porque en la Lluvia se falla por causas que no son torpeza: una letra rápida que no
       llegaste a leer, o dos carriles pidiendo teclas a la vez. */
    private int calcularMediasJuego(BigDecimal precision) {
        double p = precision.doubleValue();
        if (p >= 95) return 6;   // 3
        if (p >= 85) return 5;   // 2½
        if (p >= 75) return 4;   // 2
        if (p >= 60) return 3;   // 1½
        return 2;                // 1
    }

    // De medias estrellas a la escala que entiende la interfaz: 0, 1, 2, 2.5 o 3.
    private BigDecimal aEstrellas(int mediasEstrellas) {
        return BigDecimal.valueOf(mediasEstrellas).divide(BigDecimal.valueOf(2));
    }

    /* Nodos completados que se quedaron en UNA estrella (2 medias): los que el Test Final
       exige levantar. Los completados antes de que existiera la columna cuentan como "hay
       que mejorarlos" — no se sabe con que nota se pasaron, y darles el beneficio de la
       duda dejaria entrar al Test Final sin haberlo comprobado.

       ⚠️ SOLO LOS NODOS QUE HOY ESTAN EN EL SENDERO. `findPorNivel` trae el progreso de
       todo ejercicio del nivel, retirados incluidos, y hasta el 10-sep-2026 se contaban:
       medido, el historial principal tenia 5 "por mejorar" y 3 eran nodos retirados
       (`fd jk`, `as lñ`, "Palabras linea superior") — invisibles en el sendero e imposibles
       de repetir, o sea que habrian bloqueado el examen para siempre. */
    private int contarPorMejorar(String identificadorTemporal, NivelCurso nivel) {
        Map<Integer, Ejercicio> sendero = ejerciciosDelSendero(nivel);
        return (int) progresoEjercicioRepository.findPorNivel(identificadorTemporal, nivel.name())
                .stream()
                .filter(p -> {
                    Ejercicio e = sendero.get(p.getEjercicioId());
                    return e != null && pideDosEstrellas(e) && estaPorMejorar(p);
                })
                .count();
    }

    // El mismo filtro: un nodo retirado no suma al "12/36 ejercicios" de la pantalla.
    private int contarCompletados(String identificadorTemporal, NivelCurso nivel) {
        Map<Integer, Ejercicio> sendero = ejerciciosDelSendero(nivel);
        return (int) progresoEjercicioRepository.findPorNivel(identificadorTemporal, nivel.name())
                .stream()
                .filter(p -> sendero.containsKey(p.getEjercicioId()))
                .filter(p -> Boolean.TRUE.equals(p.getCompletado()))
                .count();
    }

    // Los nodos activos del sendero (orden > 0: la Prueba de nivel no es un paso), por id.
    private Map<Integer, Ejercicio> ejerciciosDelSendero(NivelCurso nivel) {
        return ejercicioRepository.findByNivelAndActivoTrueAndOrdenGreaterThanOrderByOrdenAsc(nivel, 0)
                .stream()
                .collect(Collectors.toMap(Ejercicio::getId, e -> e));
    }

    /* Qué nodos exigen las 2 estrellas antes del examen. Todos menos dos:
         · la LLUVIA DE LETRAS, decisión del usuario: "es un ejercicio de relajo, divertido".
           Sus estrellas salen de la precisión y una partida floja o sin reservas se queda en
           una; bloquear el examen por eso convertiría el juego en otra prueba.
         · el propio TEST FINAL, que no puede ser requisito de si mismo. */
    private boolean pideDosEstrellas(Ejercicio e) {
        return e.getTipo() != TipoEjercicio.LLUVIA_LETRAS && e.getRolEnNivel() != RolEjercicioNivel.TEST_FINAL;
    }

    private boolean estaPorMejorar(ProgresoEjercicioCurso p) {
        return p != null && Boolean.TRUE.equals(p.getCompletado())
                && (p.getMediasEstrellas() == null || p.getMediasEstrellas() <= 2);
    }

    private String nombreDelSiguiente(NivelCurso nivel) {
        int indice = indexOf(nivel);
        return (indice >= 0 && indice < ORDEN_NIVELES.length - 1) ? ORDEN_NIVELES[indice + 1].name() : null;
    }

    @Override
    public List<ProgresoEjercicioResponse> obtenerProgresoPorNivel(String identificadorTemporal, NivelCurso nivel) {
        // El orden 0 queda fuera del sendero: ver la nota del repositorio.
        List<Ejercicio> ejercicios = ejercicioRepository
                .findByNivelAndActivoTrueAndOrdenGreaterThanOrderByOrdenAsc(nivel, 0);

        /* Antes esto era un Set de ids completados y nada más. Ahora se indexa la fila
           entera: el sendero necesita las estrellas y las marcas personales de cada nodo,
           y traerlas de acá no cuesta ninguna consulta extra — ya venían en el mismo
           findPorNivel, solo se estaban tirando. */
        Map<Integer, ProgresoEjercicioCurso> porEjercicio = progresoEjercicioRepository
                .findPorNivel(identificadorTemporal, nivel.name())
                .stream()
                .collect(Collectors.toMap(ProgresoEjercicioCurso::getEjercicioId, p -> p, (a, b) -> a));

        return ejercicios.stream()
                .map(e -> {
                    ProgresoEjercicioCurso p = porEjercicio.get(e.getId());
                    boolean completado = p != null && Boolean.TRUE.equals(p.getCompletado());
                    return ProgresoEjercicioResponse.builder()
                            .ejercicioId(e.getId())
                            .titulo(e.getTitulo())
                            .descripcion(e.getDescripcion())
                            .bloque(e.getBloque())
                            .orden(e.getOrden())
                            .completado(completado)
                            .tipo(e.getTipo() != null ? e.getTipo().name() : null)
                            .rolEnNivel(e.getRolEnNivel() != null ? e.getRolEnNivel().name() : null)
                            .estrellas(completado && p.getMediasEstrellas() != null
                                    ? aEstrellas(p.getMediasEstrellas()) : null)
                            .mejorWpm(p != null ? p.getMejorWpm() : null)
                            .mejorPrecision(p != null ? p.getMejorPrecision() : null)
                            .porMejorar(pideDosEstrellas(e) && estaPorMejorar(p))
                            .build();
                })
                .collect(Collectors.toList());
    }

    private void marcarEjercicioCompletado(String identificadorTemporal, Integer ejercicioId,
                                           Integer wpm, BigDecimal precision, int mediasEstrellas) {
        ProgresoEjercicioCurso progreso = progresoEjercicioRepository
                .findByIdentificadorTemporalAndEjercicioId(identificadorTemporal, ejercicioId)
                .orElseGet(() -> ProgresoEjercicioCurso.builder()
                        .identificadorTemporal(identificadorTemporal)
                        .ejercicioId(ejercicioId)
                        .completado(false)
                        .build());

        progreso.setCompletado(true);
        if (progreso.getMejorWpm() == null || wpm > progreso.getMejorWpm()) progreso.setMejorWpm(wpm);
        if (progreso.getMejorPrecision() == null || precision.compareTo(progreso.getMejorPrecision()) > 0) {
            progreso.setMejorPrecision(precision);
        }
        if (progreso.getFechaCompletado() == null) progreso.setFechaCompletado(LocalDateTime.now());
        // Igual que mejorWpm: se guarda el máximo histórico, nunca el del último intento.
        if (progreso.getMediasEstrellas() == null || mediasEstrellas > progreso.getMediasEstrellas()) {
            progreso.setMediasEstrellas(mediasEstrellas);
        }
        progresoEjercicioRepository.save(progreso);
    }

    /* Devuelve si la aprobación ocurrió EN ESTA LLAMADA. Volver a aprobar un nivel ya
       aprobado (repetir el Test Final para mejorar la marca) no es noticia: sin este
       distingo la pantalla final tiraría la animación de "¡Nivel aprobado!" cada vez. */
    private boolean aprobarNivelCompleto(String identificadorTemporal, NivelCurso nivel) {
        ProgresoCursoNivel progreso = progresoRepository
                .findByIdentificadorTemporalAndNivel(identificadorTemporal, nivel)
                .orElseGet(() -> crearProgresoInicial(identificadorTemporal, nivel));

        if (Boolean.TRUE.equals(progreso.getAprobado())) return false;

        progreso.setAprobado(true);
        progreso.setFechaAprobado(LocalDateTime.now());
        progresoRepository.save(progreso);
        log.info("[CURSO] Nivel {} aprobado por {}", nivel, abreviar(identificadorTemporal));

        int indice = indexOf(nivel);
        if (indice >= 0 && indice < ORDEN_NIVELES.length - 1) {
            NivelCurso siguiente = ORDEN_NIVELES[indice + 1];
            ProgresoCursoNivel progresoSiguiente = progresoRepository
                    .findByIdentificadorTemporalAndNivel(identificadorTemporal, siguiente)
                    .orElseGet(() -> crearProgresoInicial(identificadorTemporal, siguiente));
            if (!Boolean.TRUE.equals(progresoSiguiente.getDesbloqueado())) {
                progresoSiguiente.setDesbloqueado(true);
                progresoRepository.save(progresoSiguiente);
                log.info("[CURSO] Nivel {} desbloqueado para {}", siguiente, abreviar(identificadorTemporal));
            }
        }
        return true;
    }

    // Básico arranca desbloqueado; los demás esperan a que se apruebe el anterior.
    private ProgresoCursoNivel crearProgresoInicial(String identificadorTemporal, NivelCurso nivel) {
        return progresoRepository.save(ProgresoCursoNivel.builder()
                .identificadorTemporal(identificadorTemporal)
                .nivel(nivel)
                .desbloqueado(nivel == NivelCurso.BASICO)
                .aprobado(false)
                .build());
    }

    private int indexOf(NivelCurso nivel) {
        for (int i = 0; i < ORDEN_NIVELES.length; i++) if (ORDEN_NIVELES[i] == nivel) return i;
        return -1;
    }

    private String abreviar(String identificador) {
        if (identificador == null || identificador.length() < 8) return "***";
        return identificador.substring(0, 8) + "...";
    }
}
