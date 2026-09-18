package com.dedea.app.client;

import com.dedea.app.exception.ApiException;
import com.google.auth.oauth2.GoogleCredentials;
import com.dedea.app.exception.CuotaIaAgotadaException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.util.List;

@Slf4j //Inyecta automáticamente un log() para ya no escribir un System.out.print()
@Component //Comunica a Spring que esta clase es un Bean
//Esta anotación hace que se cree un constructor de esta clase mientras el programa corre

public class GeminiApiClient {

    /* @Value: Ordena a Spring que busque esta propiedad en el application.yml
    Luego se inyecta el valor en la variable apiKey */
    @Value("${app.gemini.key}")
    private String apiKey;

    /* ===== VERTEX AI =====
       Los MISMOS modelos de Gemini se sirven por dos puertas distintas:

       - Gemini Developer API (generativelanguage.googleapis.com): clave de API en una
         cabecera. Es la puerta historica de este proyecto.
       - Vertex AI (aiplatform.googleapis.com, hoy rebautizado "Agent Platform"): token
         OAuth via ADC, y es la UNICA que acepta el credito de bienvenida de Google Cloud.

       El cuerpo de la peticion y el de la respuesta son identicos, asi que solo cambian la
       URL y la cabecera de autorizacion. Por eso la bifurcacion vive aca adentro en vez de
       en una clase paralela que duplicaria el armado del JSON, el parseo y el manejo de
       errores — y por eso los tres sitios que inyectan este bean no se enteran de nada.

       Para volver atras: app.gemini.vertex.enabled=false en application.yml. */
    @Value("${app.gemini.vertex.enabled:false}")
    private boolean usarVertex;

    @Value("${app.gemini.vertex.project:}")
    private String vertexProject;

    @Value("${app.gemini.vertex.location:us-central1}")
    private String vertexLocation;

    /*volatile: Fuerza que la lectura/escritura de ese campo pase siempre por la memoria principal
    GoogleCredentials: Clase de la librería Google, representa la autenticación OAuth
     */
    private volatile GoogleCredentials credenciales;

    /*RestCliente es la herramienta que fabrica y despacha el mensaje
    Aquí hace de tipo de dato complejo basado en una interfaz.
    Funciona como plano arquitectónico. Dice que botonoes tiene( .post(), .get(), etc) */
    private final RestClient restClient;
    /*ObjectMapper es una clase de la librería Jackson, tambien hace de dato complejo acá
    Agarra los datos de Java (Objetos) Y los transforma en un String plano con formato Json
    Transforma la respuesta devuelta a un árbol de nodos(JsonNode) para extraer el texto de forma limpia*/
    private final ObjectMapper mapper;

    /*
    RestClient.Builder: Es un tipo de dato por referencia, es una clase interna dentro de RestClient
    ObjectMapper: Tipo de dato complejo (Le dice a Java que el siguiente parámetro tiene que ser un objeto
    capaz de convertir estructuras de datos en texto y viceversa
    this: Palabra clave que hace referencia al OBJETO (instancia) actual que se está construyendo en la memoria RAM.
    this.restClient = Le asignamos un valor al atributo de este objeto específico que fue declarado
    más arriba, rompiendo cualquier ambigüedad con los parámetros.
    restClientBuilder.build():Orden de ejecución del objeto
     */
    public GeminiApiClient(RestClient.Builder restClientBuilder, ObjectMapper mapper) {
        this.restClient = restClientBuilder.build(); //Se ejecuta el constructor creando el objeto
        this.mapper = mapper;//This obliga al compilador a apuntar a la instancia actual y no a la variable local
    }

    /* Orden de modelos. Cada uno tiene su PROPIA cuota diaria: el quotaId que devuelve
       Google es "GenerateRequestsPerDayPerProjectPerModel-FreeTier" con quotaValue 20,
       o sea 20 peticiones por día POR MODELO. Por eso, si el primero se queda sin cupo,
       vale la pena pasar al siguiente en vez de rendirse: son 20 llamadas más.
       Solo cuando TODOS se quedan sin cuota se propaga CuotaIaAgotadaException y quien
       llama corta (el sincronizador de noticias aborta la tanda entera). */
    /* Hoy la lista tiene UN solo modelo, y se mantiene como List a proposito: sumar un
       respaldo vigente es agregar un String, sin tocar la logica.

       NO agregar gemini-2.5-flash como respaldo. Con una clave posterior al 24-ago-2026
       devuelve 404 SIEMPRE, asi que cada intento gastaria una llamada garantizada a la basura.
       Es el mismo error que se cometio con gemini-1.5-flash: ante un fallo transitorio del
       principal, el respaldo muerto agregaba una llamada perdida y convertia el intento en
       fallo definitivo — tres seguidos abortaban la tanda.

       MIGRADO a gemini-3.6-flash el 24-ago-2026, porque gemini-2.5-flash dejo de servirse a
       claves nuevas ("no longer available to new users") y ademas se deprecia el 16-oct-2026.
       El sucesor lo indico la propia API en el mensaje del 404.

       ⚠️ La migracion OBLIGA A RECALIBRAR: los umbrales del scorer, la banda MEDIO_DIFICIL, el
       minimo de caracteres especiales y el rango de longitud se midieron sobre textos que
       produjo 2.5-flash. Ver CLAUDE.md 10.14 y 10.24. */
    private static final List<String> MODELOS = List.of("gemini-3.6-flash");
    // ROLLBACK: List.of("gemini-2.5-flash") — solo funciona con las claves ANTERIORES al
    // 24-ago-2026; una clave nueva recibe 404. Volver a el solo si el modelo nuevo produce
    // textos peores, y sabiendo que caduca el 16-oct-2026.

    public String generarTexto(String prompt) {
        CuotaIaAgotadaException sinCuota = null;

        for (String modelo : MODELOS) {
            try {
                return llamarGemini(prompt, modelo);
            } catch (CuotaIaAgotadaException e) {
                // Este modelo agotó su cupo del día: se recuerda y se prueba el siguiente.
                log.warn("Sin cuota en {}. Probando el siguiente modelo...", modelo);
                sinCuota = e;
            } catch (ApiException e) {
                // Fallo que no es de cuota (500, JSON raro): el siguiente modelo puede servir.
                log.warn("{} falló por un error que no es de cuota. Probando el siguiente...", modelo);
            }
        }

        if (sinCuota != null) {
            log.error("Todos los modelos ({}) se quedaron sin cuota diaria.", MODELOS);
            throw sinCuota;
        }
        throw new ApiException("Error de Gemini: ningún modelo pudo generar el texto.");
    }

    /* Token de acceso para Vertex. `refreshIfExpired` renueva solo cuando hace falta, asi
       que llamarlo en cada peticion es barato: no pide un token nuevo cada vez. */
    private String tokenDeAcceso() throws IOException {
        if (credenciales == null) {
            synchronized (this) {
                if (credenciales == null) {
                    credenciales = GoogleCredentials.getApplicationDefault()
                            .createScoped("https://www.googleapis.com/auth/cloud-platform");
                }
            }
        }
        credenciales.refreshIfExpired();
        return credenciales.getAccessToken().getTokenValue();
    }

    private String llamarGemini(String prompt, String modelo) {
        /* La credencial va SIEMPRE en una cabecera, nunca en la URL: los proxies y servidores
           intermedios registran las query strings en sus logs. */
        /* Ojo con el host: la region "global" NO lleva prefijo (aiplatform.googleapis.com),
           mientras que las regionales si (us-central1-aiplatform.googleapis.com). Verificado
           el 24-ago-2026: gemini-3.6-flash solo respondio en "global"; en us-central1 devuelve
           404 "model was not found or your project does not have access to it". */
        String hostVertex = "global".equals(vertexLocation)
                ? "aiplatform.googleapis.com"
                : vertexLocation + "-aiplatform.googleapis.com";

        String url = usarVertex
                ? "https://" + hostVertex + "/v1/projects/" + vertexProject
                        + "/locations/" + vertexLocation
                        + "/publishers/google/models/" + modelo + ":generateContent"
                : "https://generativelanguage.googleapis.com/v1/models/"
                        + modelo + ":generateContent";

        try {
            ObjectNode requestNode = mapper.createObjectNode();//Crea un nodo Json de tipo objeto vacío
            ArrayNode contents = requestNode.putArray("contents");//Crea un arreglo vacío dentro del objeto y una clave "contents"
            ObjectNode contentPart = contents.addObject(); //crea un objeto Json vacío y lo pone como elemento dentro de contents
            /* Vertex EXIGE el rol; la Developer API lo da por supuesto si falta. Sin esto,
               Vertex devuelve 400 y el mensaje no menciona el rol por ningun lado. Mandarlo
               siempre es inofensivo para la otra puerta, asi que no se condiciona. */
            contentPart.put("role", "user");
            ArrayNode parts = contentPart.putArray("parts");//Crea el arreglo y le pone la clave "parts"
            parts.addObject().put("text", prompt);
            //.addObject(): Crea un objeto vacío dentro de parts
            //.put():Agrega la clave text  con el valor prompt dentro del objeto

            String requestBody = mapper.writeValueAsString(requestNode);
            //Convierte la estructura Json de objeto a un solo String

            String nombreCabecera = usarVertex ? "Authorization" : "X-Goog-Api-Key";
            String valorCabecera = usarVertex ? "Bearer " + tokenDeAcceso() : apiKey;

            log.info("Enviando petición a {} modelo: {}...", usarVertex ? "Vertex AI" : "Gemini", modelo);

            String response = restClient.post()//arma la petición de tipo post
                    .uri(url)//Dirección a la cual va la dirección
                    .header(nombreCabecera, valorCabecera)//Credencial: clave de API o token OAuth
                    .contentType(MediaType.APPLICATION_JSON)//El tipo de formato (JSON)
                    .body(requestBody)//El Dato que se envía en la petición
                    .retrieve()//Envía la petición
                    .body(String.class);//Convierte lo recibido en un String simple

            JsonNode responseRoot = mapper.readTree(response);
            //.readTree(): Convierte el String devuelto en un árbol navegable (objeto Json)
            String textoGenerado = responseRoot.path("candidates").get(0)
                    .path("content")
                    .path("parts").get(0)
                    .path("text").asText();
                    //.path(): Entra a la clave dada "candidates". get(0): Toma el primer elemento
                    //.asText(): Convierte el valor de la clave "text" en un String
            log.info("Texto generado exitosamente por {}", modelo);
            return textoGenerado;

        } catch (HttpStatusCodeException e) {
            // 429 = cuota agotada. Va ANTES del catch genérico, si no lo taparía.
            if (e.getStatusCode().value() == 429) {
                log.error("Cuota de Gemini agotada (429) en el modelo {}. No tiene sentido reintentar.", modelo);
                throw new CuotaIaAgotadaException("Cuota diaria de la API de Gemini agotada.");
            }
            log.error("Error HTTP {} al conectar con Gemini {}: {}", e.getStatusCode(), modelo, e.getMessage());
            throw new ApiException("Error de Gemini: No se pudo generar el texto de práctica.");

        } catch (Exception e) {
            log.error("Error crítico al conectar con Gemini {}: {}", modelo, e.getMessage());
            throw new ApiException("Error de Gemini: No se pudo generar el texto de práctica.");
        }
    }
}
