package com.dedea.app.client;

import lombok.extern.slf4j.Slf4j;
import net.dankito.readability4j.Article;
import net.dankito.readability4j.Readability4J;
import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Component
public class WebScraperClient {

    /* Contenedores de avisos de consentimiento (CMP). Se sacan del árbol ANTES de leer
       los <p>, porque select("p") no distingue el artículo del banner legal.

       El caso que lo motivó (18-ago-2026): softzone.es metía 6.600 caracteres de aviso
       de cookies ANTES del artículo. Como el service recorta a los primeros 4.000
       caracteres, a Gemini le llegó puro texto legal y ni una línea de la noticia — el
       resumen guardado terminó siendo "Softzone.es ofrece acceso gratuito si consientes
       el uso de cookies...". El recorte no falló por descuido: asume que lo importante
       está al principio, y con un muro de consentimiento pasa exactamente al revés.

       "gdpr" va en la lista porque es justo el que usaba softzone (#gaz-gdpr-modal) y
       ningún selector de "cookie" lo atrapaba. Los demás cubren los CMP más comunes
       (Didomi, OneTrust, Quantcast). Se busca por subcadena en id y class para no
       depender del nombre exacto que le ponga cada sitio. */
    private static final String SELECTOR_CONSENTIMIENTO = String.join(", ",
            "[id*=cookie]", "[class*=cookie]",
            "[id*=consent]", "[class*=consent]",
            "[id*=gdpr]", "[class*=gdpr]",
            "[id*=didomi]", "[class*=didomi]",
            "[id*=onetrust]", "[class*=onetrust]",
            "[id*=qc-cmp]", "[class*=qc-cmp]");

    /* Red de seguridad para los sitios cuyo banner NO vive en un contenedor reconocible.
       Son frases de aviso legal, no de periodismo: se exigen DOS distintas en el mismo
       párrafo a propósito, porque una nota real sobre privacidad puede mencionar
       "cookies" o "publicidad personalizada" una vez sin ser un banner. */
    private static final List<String> MARCADORES_CONSENTIMIENTO = List.of(
            "publicidad personalizada",
            "tratamiento de datos",
            "datos personales",
            "identificadores de dispositivo",
            "nuestros socios",
            "tu consentimiento",
            "aceptar y continuar",
            "política de cookies",
            "finalidades");

    private static final int MARCADORES_PARA_DESCARTAR = 2;

    /* Finge ser un navegador real para entrar a la URL y extraer todo el texto de los párrafos.*/
    /* Mínimo de texto para dar por bueno un artículo. Por debajo de esto lo que se extrajo
       no es una nota: es un teaser de muro de pago, una página que pinta el contenido con
       JavaScript, o directamente algo que no es un artículo.

       600 es menos de lo que da cualquier nota real —las medidas van de 1.500 a 16.000
       caracteres— y más de lo que da un teaser. */
    private static final int MIN_CARACTERES_ARTICULO = 600;

    /* Extrae el cuerpo del artículo de una página de noticias.

       DOS MÉTODOS, en orden:

       1. READABILITY (el puerto del algoritmo de Mozilla). Puntúa cada bloque del DOM por
          densidad de texto y de enlaces y devuelve el bloque principal. No conoce ningún
          caso particular: descarta menús porque tienen muchos enlaces y poco texto,
          descarta widgets numéricos porque no tienen oraciones, descarta pies legales
          porque están fuera del contenedor ganador.

       2. RESPALDO: el método anterior, select("p") con los filtros de consentimiento y
          boilerplate. Se usa solo si Readability devuelve poco o falla. Existe porque
          Readability puede equivocarse en maquetados raros, y quedarse sin texto por culpa
          del extractor sería peor que quedarse con texto sucio.

       Medido el 24-ago-2026 sobre 10 artículos reales: Readability limpió 6 de 10 de forma
       evidente. El caso más claro fue el widget de "pico y placa" de los diarios
       colombianos, que aportaba 16 de los 22 datos numéricos de un artículo — o sea que
       veníamos midiendo la riqueza de un widget de tránsito. Ver CLAUDE.md 10.19. */
    public String extraerTextoDeUrl(String url) {
        try {
            log.info("[SCRAPER] Intentando acceder a: {}", url);

            /* El disfraz de navegador real: sin el User-Agent, muchos sitios devuelven un
               403 o una página de bloqueo anti-bot. El timeout evita que el hilo quede
               colgado en una web muerta. */
            /*Jsoup: Librería para hacer el webScrapping
            .connect(url): Prepara la petición. Crea un objeto "Connection" configurado para apuntar a esa url,
            .userAgent(): Configura el header HTTP User-Agent
             */
            Connection.Response respuesta = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                            + "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .timeout(10000)//Tiempo máximo de espera antes de abortar la conexión
                    .execute();//Dispara la petición, y devuelve un objeto de tipo connection.Response
            String html = respuesta.body();//Extrae solo el cuerpo de la respuesta, descarta headers y código de estado

            String texto = extraerConReadability(html, url);

            if (texto.length() < MIN_CARACTERES_ARTICULO) {
                log.info("[SCRAPER] Readability devolvió {} caracteres, se prueba el respaldo.", texto.length());
                String respaldo = extraerConParrafos(Jsoup.parse(html, url));
                if (respaldo.length() > texto.length()) texto = respaldo;
            }

            if (texto.length() < MIN_CARACTERES_ARTICULO) {
                log.warn("[SCRAPER-WARN] Solo {} caracteres tras los dos métodos. Muro de pago, "
                        + "contenido por JavaScript o página que no es un artículo: {}", texto.length(), url);
                return "";
            }

            log.info("[SCRAPER] Texto extraído con éxito ({} caracteres).", texto.length());
            return texto;

        } catch (Exception e) {
            log.error("[SCRAPER-ERROR] Fallo al extraer texto de la URL: {}", e.getMessage());
            return "";
        }
    }

    /* METADATOS DE PUBLICACIÓN: fecha, hora, firma e iconos de la plantilla.

       Es la costura conocida de Readability —se queda con firmas y etiquetas— y es la que
       más daño hace, porque son PURO NÚMERO y por lo tanto inflan justo la métrica que
       usamos para decidir el nivel.

       Medido el 24-ago-2026: una nota social de 1.425 caracteres sobre una fiesta de un
       hogar de ancianos salió con picoZona 53.2%, el valor más alto de toda la tanda. Su
       "riqueza" era esto:

           Mario Corrales, Montevideo 23/08/26 - 13:12 Actualizado: 23/08/26 - 13:13

       Cuatro barras, dos guiones, cuatro dos-puntos y doce dígitos, en 40 caracteres. Con
       eso le ganó el puesto de DIFICIL a una previa de River-Vélez que sí traía datos
       reales del partido y que quedó en 13.6%.

       Se limpia con expresiones regulares sobre el texto ya extraído y no filtrando
       párrafos, porque Readability devuelve el bloque aplanado: los párrafos ya no existen
       como unidades separadas. */
    private static final java.util.regex.Pattern FECHA_PUBLICACION = java.util.regex.Pattern.compile(
            "(?i)(actualizado|publicado|modificado)?\\s*:?\\s*"
          + "\\d{1,2}\\s*/\\s*[a-zA-Z]{3,10}\\s*/\\s*\\d{2,4}(\\s*-\\s*\\d{1,2}[:.]\\d{2})?"
          + "|(?i)(actualizado|publicado|modificado)?\\s*:?\\s*"
          + "\\d{1,2}/\\d{1,2}/\\d{2,4}(\\s*-\\s*\\d{1,2}[:.]\\d{2})?"
          + "|(?i)(actualizado|publicado|modificado)\\s*:\\s*\\d{1,2}[:.]\\d{2}");

    /* Iconos de plantilla que llegan como texto: son nombres de Material Icons que el sitio
       usa en la maqueta y que Readability no distingue de una palabra. */
    private static final java.util.regex.Pattern ICONOS_PLANTILLA = java.util.regex.Pattern.compile(
            "\\b(photo_camera|play_arrow|access_time|share|whatsapp|facebook|twitter)\\b",
            java.util.regex.Pattern.CASE_INSENSITIVE);

    /* Llamadas a acción escritas todas en mayúsculas: "UNIRSE AL CANAL DE WHATSAPP DE
       DESDESORIA", "SUSCRIBITE AL NEWSLETTER".

       Se exigen CUATRO palabras seguidas en mayúsculas, de DOS letras o más.

       El mínimo de dos y no de tres se corrigió el 24-ago-2026 después de probarlo: con tres,
       "UNIRSE AL CANAL DE WHATSAPP DE DESDESORIA" no se detectaba, porque el "AL" y los "DE"
       cortaban la racha. El español está lleno de conectores de dos letras y una llamada a
       acción los usa igual que cualquier frase.

       Lo que protege el contenido real es exigir CUATRO seguidas, no la longitud de cada
       palabra: en prosa periodística no aparecen rachas así. Una sigla suelta (ONU, MLB), un
       "EE.UU." —que va con puntos, no con espacios— o dos siglas juntas no llegan a cuatro.
       Verificado contra "La ONU y la OEA pidieron a EE.UU. que revise su postura": intacto. */
    private static final java.util.regex.Pattern LLAMADA_ACCION = java.util.regex.Pattern.compile(
            "\\b([A-ZÁÉÍÓÚÑÜ]{2,}\\s+){3,}[A-ZÁÉÍÓÚÑÜ]{2,}\\b");

    /* Mas formas de metadato, encontradas en el sondeo del 24-ago-2026 despues del primer
       filtro. Cada una venia de un sitio distinto:

       - FECHA CON PUNTOS: "23.08.2026 - 14:05" (RTVE). El patron de arriba solo cubria
         barras.
       - DOS HORAS SEGUIDAS: "14:05 20:09" (OKDiario) — son la hora de publicacion y la de
         actualizacion, pegadas y sin etiqueta. Se exige el PAR a proposito: una hora suelta
         sí aparece en noticias reales ("el aviso se recibio a las 3:23 horas"), pero dos
         pegadas sin nada en medio no.
       - CREDITO ENTRE PARENTESIS: "(Foto: COOL)".
       - CORREO DEL PERIODISTA en la firma. */
    private static final java.util.regex.Pattern FECHA_CON_PUNTOS = java.util.regex.Pattern.compile(
            "\\b\\d{1,2}\\.\\d{1,2}\\.\\d{2,4}(\\s*-\\s*\\d{1,2}[:.]\\d{2})?"
          /* Resto de una fecha que el sitio ya venia truncando: ".2026 - 17:31". */
          + "|\\.\\d{2,4}\\s*-\\s*\\d{1,2}[:.]\\d{2}");

    private static final java.util.regex.Pattern HORAS_PEGADAS = java.util.regex.Pattern.compile(
            "\\b\\d{1,2}:\\d{2}\\s*[|]?\\s*\\d{1,2}:\\d{2}\\b");

    private static final java.util.regex.Pattern CREDITO_PARENTESIS = java.util.regex.Pattern.compile(
            "(?i)[(]\\s*(foto|imagen|video|fotografia|fotograf.a|cr.dito)s?\\s*:[^)]{0,40}[)]");

    private static final java.util.regex.Pattern CORREO = java.util.regex.Pattern.compile(
            /* El "[email protected]" es el texto que dejan los sitios que ofuscan el correo
               del periodista en la firma. Los corchetes van escapados uno por uno: en Java
               "[]]" no es un corchete literal dentro de una clase, es una clase vacia sin
               cerrar, y revienta al construir el Pattern. */
            "[\\w.+-]+@[\\w.-]+\\.[a-zA-Z]{2,}"
          + "|\\[email\\s*protected\\]");

    private String limpiarMetadatos(String texto) {
        String t = FECHA_PUBLICACION.matcher(texto).replaceAll(" ");
        t = FECHA_CON_PUNTOS.matcher(t).replaceAll(" ");
        t = CREDITO_PARENTESIS.matcher(t).replaceAll(" ");
        t = CORREO.matcher(t).replaceAll(" ");
        t = HORAS_PEGADAS.matcher(t).replaceAll(" ");
        /* LLAMADA_ACCION va ANTES que ICONOS_PLANTILLA a proposito. Al reves, el filtro de
           iconos borra "WHATSAPP" de "UNIRSE AL CANAL DE WHATSAPP DE DESDESORIA" y con eso
           rompe la racha de cuatro mayusculas que la otra regex necesita para reconocerla:
           quedaba "UNIRSE AL CANAL DE DE DESDESORIA" a medio limpiar. */
        t = LLAMADA_ACCION.matcher(t).replaceAll(" ");
        t = ICONOS_PLANTILLA.matcher(t).replaceAll(" ");
        return t.replaceAll("\s+", " ").trim();
    }

    /* METADATOS POR ETIQUETA, antes de aplanar el HTML a texto.

       Readability devuelve el bloque del articulo, pero adentro vienen la fecha, la firma y
       los pies de foto. En vez de perseguirlos con expresiones regulares sobre el texto ya
       plano —que es una lista negra infinita: cada sitio inventa su formato— se los saca por
       ETIQUETA, aprovechando que ahi si hay convencion web: <time> para fechas, <figcaption>
       para pies de foto, y clases con "author", "byline", "date", "caption".

       Medido el 24-ago-2026 sobre 10 articulos reales: limpia 4 de 10, incluido el peor
       —"23 ag. 2026 - 11:54 hrs." era 4 de los 5 datos numericos de esa noticia—. No los
       agarra todos: "32 SUCESOS.-" y "CNN —" no viven en ninguna etiqueta semantica. Pero
       esos aportan 1 y 0 datos, o sea que no cambian ninguna clasificacion.

       La limpieza perfecta no existe y perseguirla es la trampa. Lo que atrapa el resto es
       la verificacion de Gemini al generar (ver Constants.MARCADOR_SIN_MATERIAL), que le
       dice explicitamente que avise si lo unico numerico es la fecha de publicacion. */
    private static final String SELECTOR_METADATOS = String.join(", ",
            "time", "figcaption",
            "[class*=date]", "[class*=fecha]", "[class*=timestamp]", "[class*=publish]",
            "[class*=author]", "[class*=autor]", "[class*=byline]", "[class*=firma]",
            "[class*=credit]", "[class*=caption]", "[class*=epigrafe]", "[class*=meta-]");

    /* Readability sobre el HTML crudo. Devuelve cadena vacía si falla: quien llama decide
       qué hacer, y siempre tiene el respaldo. */
    private String extraerConReadability(String html, String url) {
        try {
            Article articulo = new Readability4J(url, html).parse();
            /* Se pide el HTML y no el texto plano para poder sacar los metadatos POR
               ETIQUETA antes de aplanar. Ver SELECTOR_METADATOS. */
            String contenido = articulo.getContent();
            if (contenido == null || contenido.isBlank()) return "";

            Document bloque = Jsoup.parse(contenido, url);
            bloque.select(SELECTOR_METADATOS).remove();
            return limpiarMetadatos(bloque.text());
        } catch (Exception e) {
            log.warn("[SCRAPER] Readability falló ({}), se usará el respaldo.", e.getMessage());
            return "";
        }
    }

    /* MÉTODO DE RESPALDO — el que se usaba antes de Readability.

       Toma todos los <p> de la página y va tachando lo que huele a consentimiento o a
       boilerplate. Es una lista negra, así que siempre se le escapa algo nuevo: por eso
       dejó de ser el método principal. Sigue acá porque cubre los maquetados donde
       Readability no encuentra un bloque principal claro. */
    private String extraerConParrafos(Document webPage) {
        int contenedoresQuitados = webPage.select(SELECTOR_CONSENTIMIENTO).size();
        webPage.select(SELECTOR_CONSENTIMIENTO).remove();

        List<String> parrafos = webPage.select("p").stream()
                .map(Element::text)
                .filter(p -> !p.isBlank())
                .filter(p -> !pareceConsentimiento(p) && !pareceBoilerplate(p))
                .collect(Collectors.toList());

        if (contenedoresQuitados > 0) {
            log.info("[SCRAPER] Respaldo: {} contenedor(es) de consentimiento quitado(s).", contenedoresQuitados);
        }
        return String.join(" ", parrafos).trim();
    }

    /* BOILERPLATE: avisos legales, créditos de foto y navegación del sitio.

       Es un filtro DISTINTO del de consentimiento y por eso va aparte. El de arriba busca
       vocabulario de cookies y privacidad, y exige DOS marcadores para no borrar una nota
       real que mencione el tema. Un aviso de copyright no comparte ni una palabra con ese
       vocabulario, así que pasaba entero.

       El caso que lo motivó (24-ago-2026): un teletipo de AP llegaba con
       "Copyright 2026 The Associated Press. All Rights Reserved." DOS VECES antes del
       artículo, más un pie de foto "(AP Foto/Karl Anderson)". Eso se comía el comienzo del
       texto —que es lo que Gemini prioriza— y encima inflaba el perfil del artículo con
       dígitos y mayúsculas que no son del contenido. Es primo del pie legal de diario.mx
       que arruinó las noticias 263 y 266.

       CON UN SOLO MARCADOR ALCANZA, al revés que en consentimiento, pero SOLO si el párrafo
       es corto: "todos los derechos reservados" en 50 caracteres es un aviso legal; la misma
       frase dentro de un párrafo de 600 es una nota que habla de derechos de autor. El largo
       es lo que separa un caso del otro. */
    private static final List<String> MARCADORES_LEGALES = List.of(
            "all rights reserved", "todos los derechos reservados", "derechos reservados",
            "prohibida su reproducción", "prohibida la reproducción", "copyright ©",
            "©", "s. de r.l.", "s.a. de c.v.");

    private static final List<String> MARCADORES_NAVEGACION = List.of(
            "sigue el canal", "síguenos en", "suscríbete", "suscribite", "newsletter",
            "compartir en", "lee también", "te puede interesar", "más información en",
            "descarga la app", "regístrate gratis", "inicia sesión");

    /* Tope de largo para considerar que un párrafo es boilerplate y no contenido. */
    private static final int MAX_LARGO_LEGAL = 250;
    private static final int MAX_LARGO_NAVEGACION = 200;
    private static final int MAX_LARGO_CREDITO = 300;

    /* Pie de foto: "(AP Foto/Karl Anderson)", "Foto: EFE", "Imagen: Reuters". Son texto
       descriptivo real —no basura legal— pero no forman parte del artículo, y sus nombres
       propios y fechas contaminan el perfil. */
    private static final java.util.regex.Pattern CREDITO_FOTO = java.util.regex.Pattern.compile(
            "(?i)\b(foto|fotograf[íi]a|imagen|cr[ée]dito|v[íi]deo)\s*[:/]");

    private boolean pareceBoilerplate(String parrafo) {
        String t = parrafo.toLowerCase();
        int largo = parrafo.length();

        if (largo <= MAX_LARGO_LEGAL) {
            for (String m : MARCADORES_LEGALES) if (t.contains(m)) return true;
        }
        if (largo <= MAX_LARGO_NAVEGACION) {
            for (String m : MARCADORES_NAVEGACION) if (t.contains(m)) return true;
        }
        if (largo <= MAX_LARGO_CREDITO && CREDITO_FOTO.matcher(parrafo).find()) return true;

        return false;
    }

    private boolean pareceConsentimiento(String parrafo) {
        String t = parrafo.toLowerCase();
        int encontrados = 0;
        for (String marcador : MARCADORES_CONSENTIMIENTO) {
            if (t.contains(marcador) && ++encontrados >= MARCADORES_PARA_DESCARTAR) return true;
        }
        return false;
    }

    /* Detecta protección anti-hotlinking por Referer, el caso real que rompió la imagen
       de la noticia de escambray.cu: el navegador manda el Referer de nuestra propia
       página al pedir la foto, y el sitio de origen la rechaza si ese Referer no es el
       suyo — aunque la imagen exista y responda 200 a cualquier otro pedido (confirmado
       a mano con curl: sin Referer da 200, con un Referer ajeno da 403).

       El Referer que se manda es genérico ("google.com") a propósito: lo que se prueba
       es si el sitio bloquea CUALQUIER Referer que no sea el suyo, no si bloquea uno en
       particular — no hace falta conocer el dominio final de producción de DEDEA para
       que la prueba sea válida.

       Solo 401/403 cuentan como bloqueo confirmado. Cualquier otro resultado (timeout,
       DNS caído, 404, 500, excepción) devuelve false: puede ser un hipo de red pasajero,
       y confundirlo con un bloqueo real dejaría la imagen sin foto para siempre sin
       necesidad — la llamada solo debe apagar la imagen ante una señal inequívoca. */
    public boolean pareceBloqueoAntiHotlinking(String urlImagen) {
        if (urlImagen == null || urlImagen.isBlank()) return false;

        try {
            Connection.Response respuesta = Jsoup.connect(urlImagen)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .referrer("https://www.google.com/")
                    .timeout(6000)
                    .method(Connection.Method.HEAD)
                    .ignoreContentType(true)
                    // Sin esto, Jsoup lanza una excepción en cualquier status que no sea
                    // 2xx/3xx y nunca llegaríamos a leer el código para distinguir un 403
                    // (bloqueo real) de un 404 o un 500 (otra cosa).
                    .ignoreHttpErrors(true)
                    .execute();

            int status = respuesta.statusCode();
            if (status == 401 || status == 403) {
                log.warn("[IMG-CHECK] Bloqueo anti-hotlinking detectado ({}) en: {}", status, urlImagen);
                return true;
            }
            return false;

        } catch (Exception e) {
            log.warn("[IMG-CHECK] No se pudo verificar la imagen (se deja como está): {} — {}", urlImagen, e.getMessage());
            return false;
        }
    }
}

