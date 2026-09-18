package com.dedea.app.service.impl;

import com.dedea.app.client.GeminiApiClient;
import com.dedea.app.dto.TextoIaRequest;
import com.dedea.app.dto.TextoIaResponse;
import com.dedea.app.mapper.EntityMapper;
import com.dedea.app.model.TextoIa;
import com.dedea.app.model.enums.Dificultad;
import com.dedea.app.repository.TextoIaRepository;
import com.dedea.app.service.IaService;
import com.dedea.app.util.Constants;
import com.dedea.app.util.DifficultyScorer;
import com.dedea.app.util.TextCleaner;
import com.dedea.app.util.ValidadorTexto;
import com.dedea.app.exception.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom; // Buenas prácticas de concurrencia

@Slf4j
@Service
@RequiredArgsConstructor
public class IaServiceImpl implements IaService {

    private final TextoIaRepository textoIaRepository;
    private final EntityMapper mapper;
    private final GeminiApiClient geminiApiClient;

    // Galería estática de 30 categorías para romper la monotonía científica de la IA
    private static final List<String> CATEGORIAS_TEMATICAS = List.of(
            "Deportes extremos", "Historia antigua", "Humor y comedia",
            "Ciencia ficción", "Política y sociedad", "Cine y entretenimiento",
            "Gastronomía y cocina", "Misterio y detectives", "Tecnología del futuro",
            "Mitología y leyendas", "Música y conciertos", "Arte y pintura",
            "Viajes y turismo", "Biología y naturaleza", "Psicología cotidiana",
            "Economía y negocios", "Arquitectura famosa", "Moda y tendencias",
            "Literatura y libros", "Ecología y medio ambiente", "Astronomía y el espacio",
            "Cultura pop", "Videojuegos y eSports", "Salud y bienestar",
            "Inventos históricos", "Cuentos infantiles", "Vida de mascotas",
            "Anécdotas escolares", "Superhéroes y cómics", "Noticias curiosas y raras"
    );

    /* Intentos de generacion antes de rendirse. DOS: uno de gracia por si el modelo
       degenero por azar, y nada mas — si el segundo tambien falla el problema es del prompt
       o del modelo, y seguir intentando solo gasta cuota y hace esperar al usuario. */
    private static final int MAX_INTENTOS_TEXTO_IA = 2;

    @Override
    /* SIN @Transactional a proposito, y es el mismo motivo que en NoticiaServiceImpl.

       Con la anotacion, la transaccion quedaba abierta durante TODA la llamada a Gemini —60
       segundos medidos, y hasta seis veces mas con el modo de tres niveles puesto—, o sea que
       una conexion del pool se quedaba retenida varios minutos sin hacer nada de base de
       datos. Con unos pocos usuarios pidiendo a la vez, eso agota el pool y tumba peticiones
       que no tienen nada que ver.

       No hace falta para nada: lo unico que toca la base es el save() del final, y los
       repositorios de Spring Data ya son transaccionales por metodo. */
    public TextoIaResponse generarTextoPersonalizado(String identificadorTemporal, TextoIaRequest request) {

        // 1. Crear la "Huella Dactilar" (Para la Base de Datos)
        List<String> todasLasDebilidades = new ArrayList<>();
        if (request.getNgramsDebiles() != null) todasLasDebilidades.addAll(request.getNgramsDebiles());
        if (request.getTeclasDebiles() != null) todasLasDebilidades.addAll(request.getTeclasDebiles());

        Collections.sort(todasLasDebilidades);
        String huellaTeclasBase = String.join(",", todasLasDebilidades);

        /* El nivel se normaliza ACA, antes de tocar el cache. Antes la consulta usaba el
           String crudo del request y el guardado usaba el enum ya resuelto, asi que un valor
           raro buscaba en un cajon y guardaba en otro: se preguntaba por "MEDIO_DIFICIL" —que
           no existe como pedido— y despues se guardaba como MEDIO. Nunca reventaba, pero el
           cache jamas acertaba y cada peticion generaba de nuevo. */
        Dificultad nivelPedido = nivelDe(request.getDificultad());

        // REGLA 1: EL RECICLAJE INTELIGENTE (Caché Hit)
        long totalCacheados = textoIaRepository.countTextoReciclableInedito(
                identificadorTemporal, nivelPedido.name(), huellaTeclasBase);

        if (totalCacheados > 0) {
            long randomOffset = ThreadLocalRandom.current().nextLong(totalCacheados);

            Optional<TextoIa> textoCacheadoyLimpio = textoIaRepository.findTextoReciclableInedito(
                    identificadorTemporal, nivelPedido.name(), huellaTeclasBase, randomOffset);

            if (textoCacheadoyLimpio.isPresent()) {
                log.info("Caché Hit: Reutilizando texto IA para cliente {} con huella [{}]",
                        identificadorTemporal, huellaTeclasBase);
                return mapper.toTextoIaResponse(textoCacheadoyLimpio.get());
            }
        }

        // REGLA 2: GENERACIÓN REAL (Caché Miss)
        log.info("Caché Miss: Solicitando nuevo texto a Gemini para huella [{}]", huellaTeclasBase);

        // SELECCIÓN TEMÁTICA ALEATORIA (Solo ocurre si hay Cache Miss)
        String categoriaAleatoria = CATEGORIAS_TEMATICAS.get(
                ThreadLocalRandom.current().nextInt(CATEGORIAS_TEMATICAS.size())
        );
        log.info("Ruleta Temática: Categoría seleccionada para el prompt -> [{}]", categoriaAleatoria);

        /* Objetivos que NO son letras: %, $, :, /, parentesis. Se separan porque el prompt
           los pide de otra forma —ninguna palabra del espanol "contiene" un %— y porque son
           los que TextCleaner borraria si no se lo avisamos. */
        List<String> objetivosSimbolo = todasLasDebilidades.stream()
                .filter(o -> !esSoloLetras(o))
                .toList();

        String textoLimpio = Constants.GENERAR_LOS_TRES_NIVELES_IA
                ? generarLosTresNiveles(nivelPedido, request, categoriaAleatoria,
                        objetivosSimbolo, todasLasDebilidades)
                : generarYRegistrar(nivelPedido, request, categoriaAleatoria,
                        objetivosSimbolo, todasLasDebilidades);

        // Persistencia para que el "Reciclaje" funcione la próxima vez
        TextoIa nuevoTexto = TextoIa.builder()
                .contenido(textoLimpio)
                .dificultad(nivelPedido)
                .teclasBase(huellaTeclasBase)
                .fechaGeneracion(LocalDateTime.now())
                .build();

        TextoIa textoGuardado = textoIaRepository.save(nuevoTexto);

        return mapper.toTextoIaResponse(textoGuardado);
    }

    /* ===== DESARROLLO — REVERTIR ANTES DE PUBLICAR =====
       Ver Constants.GENERAR_LOS_TRES_NIVELES_IA.

       Genera los tres niveles con los MISMOS objetivos y los vuelca al log. Devuelve el que
       el usuario pidio; los otros dos mueren en el log — no se guardan ni llegan a pantalla.

       El orden es FACIL, MEDIO, DIFICIL a proposito, para que en el log queden uno debajo del
       otro y se puedan comparar de corrido.

       Si un nivel falla, NO se cae la peticion entera: se registra y se sigue. Seria absurdo
       que el usuario se quedara sin su ejercicio porque un nivel que ni pidio no salio. La
       excepcion es que falle justamente el suyo, y ahi si se propaga. */
    private String generarLosTresNiveles(Dificultad nivelPedido, TextoIaRequest request,
            String categoria, List<String> objetivosSimbolo, List<String> objetivos) {

        String delPedido = null;

        for (Dificultad nivel : List.of(Dificultad.FACIL, Dificultad.MEDIO, Dificultad.DIFICIL)) {
            try {
                String texto = generarYRegistrar(nivel, request, categoria, objetivosSimbolo, objetivos);
                if (nivel == nivelPedido) {
                    delPedido = texto;
                }
            } catch (RuntimeException e) {
                if (nivel == nivelPedido) {
                    throw e;
                }
                log.warn("[3 NIVELES] {} fallo ({}). Se sigue con los demas.",
                        nivel, e.getMessage());
            }
        }

        /* Solo puede pasar si nivelPedido no estuvo en la lista, o sea nunca. El chequeo esta
           para que un cambio futuro en la lista no devuelva null en silencio. */
        if (delPedido == null) {
            throw new ApiException("No se pudo generar el texto de práctica. Intenta de nuevo.");
        }
        return delPedido;
    }

    /* Genera un texto para un nivel y deja su radiografia en el log. */
    private String generarYRegistrar(Dificultad nivel, TextoIaRequest request, String categoria,
            List<String> objetivosSimbolo, List<String> objetivos) {
        String texto = generarTextoLimpio(nivel, request, categoria, objetivosSimbolo);
        log.info("[IA {}] {}", nivel, informeDeTexto(texto, objetivos));
        log.info("[IA {}] {}", nivel, texto);
        return texto;
    }

    /* Una linea con todo lo que el prompt EXIGIO, para poder ver de un vistazo si se cumplio.

       Es el mismo contenido que el panel de PracticaView, y esta duplicado a proposito: el
       panel sirve para mirar un ejercicio mientras lo tecleas, el log sirve para revisar una
       tanda entera despues. Los dos mueren con la calibracion.

       El porcentaje del scorer va como OBSERVACION y no decide nada. En Noticias el scorer es
       la autoridad; aca el objetivo es el ngram y la dificultad mecanica es un efecto
       secundario que conviene mirar sin que gobierne. */
    private String informeDeTexto(String texto, List<String> objetivos) {
        /* El filtro del vacio no es cosmetico: split() devuelve un primer elemento vacio
           cuando el texto arranca con algo que no es letra (un "¿", una comilla), y eso
           inflaba en uno el conteo de palabras del log. */
        List<String> palabras = java.util.Arrays.stream(texto.split("[^\\p{L}]+"))
                .filter(w -> !w.isEmpty())
                .toList();

        StringBuilder sb = new StringBuilder();
        for (String o : objetivos) {
            int veces = contarEn(texto, o);
            /* Las "palabras distintas" solo tienen sentido para los objetivos que son letras.
               Un simbolo no vive DENTRO de una palabra, asi que su columna daria siempre 0 y
               eso se lee como un fallo cuando no lo es. */
            if (!esSoloLetras(o)) {
                sb.append(String.format("%s=%dx  ", o, veces));
                continue;
            }
            String bajo = o.toLowerCase(Locale.ROOT);
            long distintas = palabras.stream()
                    .map(w -> w.toLowerCase(Locale.ROOT))
                    .filter(w -> w.contains(bajo))
                    .distinct()
                    .count();
            sb.append(String.format("%s=%dx/%dpal  ", o, veces, distintas));
        }

        long largas = palabras.stream().filter(w -> silabas(w) >= 4).count();
        /* Locale.ROOT para que el decimal sea siempre punto. Con el locale del sistema el log
           alterna coma y punto segun donde corra, y eso rompe cualquier grep o script que
           despues quiera leer estos numeros en tanda. */
        return String.format(Locale.ROOT, "%s| %d palabras, %d de 4+ silabas | scorer %s %.2f%%",
                sb, palabras.size(), largas,
                DifficultyScorer.calcularDificultad(texto), DifficultyScorer.porcentaje(texto));
    }

    private static int contarEn(String texto, String objetivo) {
        int n = 0;
        int i = texto.toLowerCase(Locale.ROOT).indexOf(objetivo.toLowerCase(Locale.ROOT));
        while (i != -1) {
            n++;
            i = texto.toLowerCase(Locale.ROOT).indexOf(objetivo.toLowerCase(Locale.ROOT), i + 1);
        }
        return n;
    }

    /* Silabas aproximadas: grupos de vocales seguidas. En espanol alcanza para lo que se
       quiere medir —los diptongos ("cuatro", "tiempo") son una silaba y este conteo tambien
       los da como una— y se queda corto con el hiato ("dia", "pais"), asi que el numero real
       es este o un poco mas alto, nunca menos. Misma aproximacion que usa el panel. */
    private static int silabas(String palabra) {
        int n = 0;
        boolean dentro = false;
        for (char c : palabra.toLowerCase(Locale.ROOT).toCharArray()) {
            boolean vocal = "aeiouáéíóúü".indexOf(c) != -1;
            if (vocal && !dentro) n++;
            dentro = vocal;
        }
        return n;
    }

    /* Una generacion, con UN reintento si lo que vuelve no se parece a un texto.

       La validacion es la misma que usa Noticias (ver ValidadorTexto): ataca la degeneracion
       por repeticion, el modo de fallo en el que el modelo se engancha y devuelve el mismo
       caracter cientos de veces. Es un fallo conocido de los LLM, o sea que va a repetirse.

       Por que reintentar y no descartar como hace Noticias: alla hay un "siguiente articulo"
       al que pasar, aca el usuario esta esperando SU ejercicio. Y por que UNA sola vez: si el
       segundo intento tambien degenera, el problema es del prompt o del modelo, y un tercer
       intento solo gasta cuota y hace esperar mas.

       Lo que NO se hace en ningun caso es devolver el texto malo. Es lo mas importante de
       todo esto: el reciclaje de textos IA es GLOBAL (findTextoReciclable filtra por
       dificultad y huella, no por usuario), asi que una fila envenenada no le arruina el
       ejercicio a quien la genero — se la sirve a cualquier otro usuario que tenga las mismas
       debilidades. */
    private String generarTextoLimpio(Dificultad nivel, TextoIaRequest request, String categoria,
            List<String> objetivosSimbolo) {

        String prompt = construirPromptSistema(nivel, request.getNgramsDebiles(),
                request.getTeclasDebiles(), categoria, objetivosSimbolo);

        String ultimoMotivo = null;
        for (int intento = 1; intento <= MAX_INTENTOS_TEXTO_IA; intento++) {
            String respuestaCruda = geminiApiClient.generarTexto(prompt);

            /* Se valida la respuesta CRUDA, antes de limpiar: si se validara despues, la
               limpieza podria maquillar el problema (borra los caracteres raros y sube el
               porcentaje de letras) y dejar pasar justo lo que se quiere atrapar. */
            ultimoMotivo = ValidadorTexto.motivoInvalido(respuestaCruda);
            if (ultimoMotivo == null) {
                /* Los simbolos pedidos viajan como excepcion a la lista blanca. Sin esto,
                   pedir `/` como tecla debil daba un ejercicio del que `/` habia
                   desaparecido: Gemini lo escribia y el limpiador lo borraba, ademas sin
                   dejar espacio (bug 9). */
                return TextCleaner.limpiarTexto(respuestaCruda, caracteresDe(objetivosSimbolo));
            }
            log.warn("Texto de IA descartado ({}, intento {} de {}): {}",
                    nivel, intento, MAX_INTENTOS_TEXTO_IA, ultimoMotivo);
        }

        log.error("Gemini no devolvio un texto usable para {} en {} intentos. Ultimo motivo: {}",
                nivel, MAX_INTENTOS_TEXTO_IA, ultimoMotivo);
        throw new ApiException("No se pudo generar el texto de práctica. Intenta de nuevo.");
    }

    /* Un objetivo que Gemini puede meter DENTRO de una palabra. Los que no lo son —%, $,
       :, /, parentesis— se piden aparte, en su propio bloque del prompt. */
    private static boolean esSoloLetras(String objetivo) {
        if (objetivo == null || objetivo.isBlank()) return false;
        for (char c : objetivo.toCharArray()) {
            if (!Character.isLetter(c)) return false;
        }
        return true;
    }

    private static List<String> soloLetras(List<String> objetivos) {
        if (objetivos == null) return List.of();
        return objetivos.stream().filter(IaServiceImpl::esSoloLetras).toList();
    }

    /* Los caracteres distintos de una lista de objetivos, para pasarselos a TextCleaner
       como excepcion a la lista blanca. */
    private static String caracteresDe(List<String> objetivos) {
        StringBuilder sb = new StringBuilder();
        for (String o : objetivos) {
            for (char c : o.toCharArray()) {
                if (sb.indexOf(String.valueOf(c)) == -1) sb.append(c);
            }
        }
        return sb.toString();
    }

    /* Marcas donde se insertan los bloques variables. Van escritas en la plantilla como
       texto normal y se reemplazan al final, para que la posicion se VEA al leer el prompt
       en vez de ser un indice calculado que se rompe en cuanto alguien reordena una linea.

       ⚠️ El reemplazo va DESPUES de .formatted(), nunca antes: el bloque de simbolos lleva
       un `%` literal, y dentro de una cadena de formato eso revienta con
       UnknownFormatConversionException. */
    private static final String MARCA_SIMBOLOS = "{{SIMBOLOS}}";
    private static final String MARCA_NIVEL = "{{NIVEL}}";

    /* Cuantas veces tiene que aparecer cada objetivo. Cuantos menos objetivos haya, mas se
       insiste con cada uno: con uno solo el texto entero puede girar a su alrededor, con
       ocho eso es imposible sin que el parrafo se vuelva absurdo. */
    private static int minimoApariciones(int totalElementos) {
        if (totalElementos <= 2) return 8;
        if (totalElementos <= 4) return 5;
        return 3;
    }

    /* La dificultad llega como String y sin @Pattern que la acote (ver TextoIaRequest), asi
       que un cliente puede mandar cualquier cosa. Antes eso terminaba en un valueOf que
       lanzaba y devolvia 500; ahora cae a MEDIO y queda en el log.

       MEDIO_DIFICIL tambien cae aca a proposito: existe en el enum como RESULTADO posible
       del scorer de Noticias, pero no es un nivel que se pida nunca (ver 10.22). */
    private Dificultad nivelDe(String dificultad) {
        try {
            Dificultad d = Dificultad.valueOf(dificultad.trim().toUpperCase(Locale.ROOT));
            if (d == Dificultad.FACIL || d == Dificultad.MEDIO || d == Dificultad.DIFICIL) {
                return d;
            }
        } catch (IllegalArgumentException ignorado) {
            // cae al respaldo de abajo
        }
        log.warn("Dificultad no reconocida para el texto de IA: [{}]. Se usa MEDIO.", dificultad);
        return Dificultad.MEDIO;
    }

    private String construirPromptSistema(Dificultad nivel, List<String> ngramsDebiles,
            List<String> teclasDebiles, String categoria, List<String> objetivosSimbolo) {

        List<String> ngramsLetra = soloLetras(ngramsDebiles);
        List<String> teclasLetra = soloLetras(teclasDebiles);

        String patrones = !ngramsLetra.isEmpty() ? String.join(", ", ngramsLetra) : "variados";
        String teclas = !teclasLetra.isEmpty() ? String.join(", ", teclasLetra) : "variadas";

        int totalElementos = ngramsLetra.size() + teclasLetra.size();
        int base = minimoApariciones(totalElementos);

        /* En DIFICIL se pide un RANGO por encima del minimo, no un minimo mas alto. La
           diferencia importa: un minimo invita a quedarse justo en el borde, y un rango
           cerrado obliga a apuntar adentro. El +1/+2 lo fijo el usuario, y es deliberadamente
           chico — subir mucho las repeticiones en un texto de largo fijo compite con las
           palabras largas y raras que este mismo nivel exige. */
        String cuantasVeces = nivel == Dificultad.DIFICIL
                ? "entre %d y %d veces".formatted(base + 1, base + 2)
                : "un MÍNIMO de %d veces".formatted(base);

        String instruccionDensidad = """
            INSTRUCCIÓN DE DENSIDAD: tienes %d elemento(s) para practicar.
            Debes usar cada uno de ellos %s en el texto.
            Construye el párrafo deliberadamente alrededor de ellos: cada oración debe
            contener al menos uno.
            PALABRAS DISTINTAS: busca que la combinación caiga en palabras diferentes y no
            siempre en la misma — se practica mejor el gesto cuando cambia lo que hay
            alrededor. Pero es una preferencia, no una cuota: si para conseguir variedad
            tendrías que traer palabras que no encajan con el tema, PREFIERE REPETIR una que
            ya usaste. Un párrafo que se entiende con tres palabras repetidas vale más que uno
            incoherente con diez distintas. Y nunca inventes un término para sumar variedad.
            """.formatted(totalElementos, cuantasVeces);

        String plantilla = """
        Eres un redactor experto en textos para práctica de mecanografía.
        REGLA ABSOLUTA 1: Responde ÚNICAMENTE con el texto. Cero saludos, cero explicaciones, cero Markdown.
        REGLA ABSOLUTA 2: El texto debe leerse como un párrafo natural, fluido y perfectamente adaptado a la categoría indicada.
        REGLA ABSOLUTA 3: Todo el párrafo tiene que hablar de UN SOLO asunto, el de la categoría.
        Cada palabra poco frecuente que uses tiene que pertenecer a ESE campo. No mezcles términos
        de dominios distintos para llegar a un número: un texto donde conviven una enfermedad
        animal, un hongo y una premezcla industrial cumple la cuenta y no significa nada.
        Si no encuentras suficientes palabras reales de ese campo, REPITE alguna que ya hayas
        usado: es preferible repetir a traer un término de otro dominio solo para llegar a un
        número.

        NIVEL DE DIFICULTAD: %s
        CATEGORÍA TEMÁTICA OBLIGATORIA: %s

        %s
        TU MISIÓN: Escribe un párrafo cohesivo que desarrolle la categoría temática asignada.

        ESTRATEGIA DE ESCRITURA:
        - Selecciona deliberadamente palabras que naturalmente contengan las letras: %s
        - Favorece vocabulario donde aparezcan las combinaciones: %s
        {{SIMBOLOS}}- Si puedes elegir entre dos palabras equivalentes, elige siempre la que contenga más de esas combinaciones.
        - El MÍNIMO de repeticiones manda. Si para llegar a él tienes que repetir una palabra,
          nombrar algo dos veces o dar un rodeo, hazlo: este texto existe para corregir esas
          combinaciones, y uno impecable donde aparecen tres veces no sirve para nada.
        - Lo que NO se admite es inventar palabras ni escribir agramaticalmente. Dentro del
          español correcto, prioriza siempre el mínimo por encima de la elegancia.

        {{NIVEL}}
        LONGITUD: Entre 80 y 90 palabras. Ni una oración suelta, ni un bloque indigesto.
        """.formatted(nivel.name(), categoria, instruccionDensidad, teclas, patrones);

        String armado = reemplazar(plantilla, MARCA_SIMBOLOS, bloqueSimbolos(objetivosSimbolo));
        return reemplazar(armado, MARCA_NIVEL, reglasDeNivel(nivel));
    }

    private static String reemplazar(String texto, String marca, String contenido) {
        int i = texto.indexOf(marca);
        return new StringBuilder(texto).replace(i, i + marca.length(), contenido).toString();
    }

    /* LAS REGLAS DE CADA NIVEL.

       La forma de la regla importa mas que su contenido, y es la leccion mas cara de la
       calibracion de Noticias (10.2.2): alla el prompt definia FACIL por lo que PROHIBE y
       MEDIO por lo que PERMITE, y el resultado fue 33/33 contra 12/34. **Prohibir crea
       dificultad garantizada; permitir no crea nada** — un permiso le da al modelo una
       salida gratis, porque no hacer nada ya esta permitido.

       Por eso FACIL es una lista de prohibiciones y los otros dos son listas de exigencias
       CONTABLES. Nada de "vocabulario mas rico" ni "manten la densidad alta": es la misma
       distincion que en Noticias separo la regla de "cifras en palabras", que funciono, de
       la de "mantenete bajo 4%", que se descarto por exigirle al modelo contar caracteres.

       Y se cuenta por SILABAS, no por letras: los modelos cuentan palabras y silabas
       razonablemente bien y caracteres muy mal (10.6).

       LO QUE NO ES PALANCA, aunque lo parezca. Las tildes pesan 0.1 y las mayusculas 0.2 en
       el scorer, y no por capricho: los textos mas cargados de tildes fueron los que el
       usuario tecleo MAS RAPIDO (69, 76 y 79 wpm, de lo mas alto de su historial). Pedir
       "mas tildes en dificil" no haria el texto mas dificil. Los DIGITOS si mueven la aguja
       en Noticias, pero aca no se usan a proposito: cada digito es un caracter que NO es el
       ngram que se practica, y en un texto de largo fijo los dos objetivos compiten. */
    private String reglasDeNivel(Dificultad nivel) {
        return switch (nivel) {
            case FACIL -> """
                REGLAS DEL NIVEL FÁCIL. Son PROHIBICIONES, no sugerencias:
                - TODO en español. Ni una palabra en inglés ni un extranjerismo, aunque sea de
                  uso corriente en el tema (nada de "sponsor", "skin", "e-sports", "top"): usa
                  el equivalente español o cambia la idea. Tampoco compuestos inventados con
                  una raíz extranjera. Si el tema asignado no se puede contar así, cuéntalo
                  desde el ángulo que sí se pueda.
                - Ninguna palabra de más de tres sílabas. Si la única que se te ocurre es más
                  larga, cambia la idea, no busques un sinónimo raro.
                - Solo vocabulario cotidiano, del que usa cualquier persona al hablar.
                - Un solo nombre propio en todo el texto, y en su forma corta.
                - Puntuación: solo coma y punto. Nada de punto y coma, dos puntos, comillas,
                  paréntesis, ¿? ni ¡!
                """;
            case DIFICIL -> """
                REGLAS DEL NIVEL DIFÍCIL. Son EXIGENCIAS, y el nivel se define por cumplirlas:
                - Al menos OCHO palabras de cuatro sílabas o más, y de ellas al menos TRES
                  técnicas, especializadas o de uso poco frecuente.
                - Aloja las combinaciones en palabras LARGAS siempre que puedas:
                  "extraterrestre" antes que "otra". Y al menos DOS de sus apariciones tienen
                  que caer al FINAL de una palabra, no al principio.
                - Al menos DOS nombres propios poco corrientes.
                - Registro formal, de correo o de informe.
                - Incluye un inciso entre paréntesis y una cita textual entre comillas dobles.
                """;
            default -> """
                REGLAS DEL NIVEL MEDIO. Son EXIGENCIAS que tienes que cumplir, no permisos:
                - Entre CINCO y SIETE palabras de cuatro sílabas o más. Es un rango cerrado:
                  ni menos de cinco ni más de siete. Este nivel se distingue del difícil por
                  no pasarse, tanto como por llegar.
                - Usa el punto y coma o los dos puntos al menos una vez, donde la frase lo
                  admita de forma natural.
                - Los nombres propios son libres y van con su forma completa.
                """;
        };
    }

    /* El bloque de simbolos, que se inserta JUSTO DESPUES de pedir las letras y las
       combinaciones. La posicion importa: el modelo ya viene leyendo la lista de lo que
       tiene que meter en el texto, y esto es un item mas de esa misma lista.

       Va en un bloque aparte y no mezclado con las letras porque son dos pedidos de
       naturaleza distinta. A una letra se le puede decir "elegi palabras que la contengan";
       a un simbolo eso no se le puede decir —ninguna palabra del espanol contiene uno— asi
       que hay que pedirle que lo USE, que es otra cosa. Mezclarlos era el bug: el prompt
       pedia "palabras que contengan las letras: %" y el modelo respondia lo unico que podia,
       un texto sin un solo simbolo.

       Se le pide una cantidad EXACTA y no un minimo: un simbolo repetido de mas convierte el
       parrafo en una lista de simbolos, mientras que una letra de mas no molesta a nadie.

       LA ULTIMA LINEA NO ES DECORATIVA. FACIL prohibe comillas y dos puntos, y esos mismos
       caracteres pueden ser el objetivo que el usuario eligio practicar: son dos reglas
       mandando sobre el mismo caracter. Sin un ganador escrito, cual gana depende de a cual
       le preste mas atencion el modelo. Es la trampa de 10.25 — dos reglas que miden lo
       mismo tienen que compartir el numero, o al menos declarar quien manda. */
    private String bloqueSimbolos(List<String> objetivosSimbolo) {
        if (objetivosSimbolo == null || objetivosSimbolo.isEmpty()) {
            return "";
        }
        return """
        - SÍMBOLOS OBLIGATORIOS: el texto debe contener %s. No son letras, así que no busques
          palabras que los contengan: úsalos donde el español los admite (porcentajes,
          cantidades, incisos, enumeraciones, citas). Repártelos por el párrafo, sin
          amontonarlos en una sola frase. Todo lo que abras, ciérralo.
          Esta regla MANDA sobre la puntuación que permita o prohíba el nivel: si el nivel
          prohíbe alguno de estos caracteres, esta instrucción tiene prioridad.
        """.formatted(exigenciaSimbolos(objetivosSimbolo));
    }

    /* Caracteres que abren y cierran CON EL MISMO signo. Son un caso aparte porque pedirles
       una cantidad impar deja el texto mal formado: cinco comillas dobles son dos citas y
       media, o sea una comilla abierta que nunca cierra.

       El parentesis NO esta aca, y la diferencia es real: `(` y `)` son caracteres
       DISTINTOS, asi que cinco de uno y cinco del otro es perfectamente balanceado. Lo mismo
       `¿?`, `¡!`, `[]` y `<>`. La regla generica "todo lo que abras, cierralo" los cubre. */
    private static final String SIMETRICOS = "\"'";

    /* Cuantas veces se pide cada simbolo. Los simetricos se redondean HACIA ARRIBA al par
       siguiente: es preferible una cita de mas que una comilla huerfana. */
    private static int cuentaPara(String simbolo) {
        int base = Constants.OBJETIVOS_SIMBOLO_POR_TEXTO;
        boolean simetrico = simbolo.length() == 1 && SIMETRICOS.indexOf(simbolo.charAt(0)) != -1;
        if (!simetrico) {
            return base;
        }
        return base % 2 == 0 ? base : base + 1;
    }

    /* "el símbolo '%' exactamente 5 veces" · "los símbolos '%' 5 veces y '\"' 6 veces (en 3
       parejas)". Entrecomillados para que el modelo no confunda el caracter con la
       puntuacion de la propia frase, y con la cuenta pegada a cada uno en vez de una sola
       cifra al final: si un texto pide 5 de uno y 6 de otro, una cifra comun mentiria. */
    private static String exigenciaSimbolos(List<String> objetivos) {
        List<String> partes = objetivos.stream().map(o -> {
            int n = cuentaPara(o);
            String base = "'" + o + "' exactamente " + n + " veces";
            boolean simetrico = o.length() == 1 && SIMETRICOS.indexOf(o.charAt(0)) != -1;
            return simetrico ? base + " (en " + (n / 2) + " parejas, abriendo y cerrando)" : base;
        }).toList();

        if (partes.size() == 1) return "el símbolo " + partes.get(0);
        return "los símbolos " + String.join(", y ", partes);
    }
}           //.ROOT: Fuerza las reglas de mayúsculas neutras