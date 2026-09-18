package com.dedea.app.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Slf4j //Crea automáticamente la variable log para escribir en la consola
@Component /* Le dice a Spring que esta clase es una herramienta suya y
              que la cree y guarde en la memoria para que cualquiera pueda usarla*/
public class NewsApiClient {

    private final RestClient restClient;
    //RestClient es el navegador interno de Spring, hace la llamada HTTP

    @Value("${app.news-api.key}")
    /*Se usa @Value(...) para no guardar la contraseña en esta clase (inseguro)
      En lugar de eso se busca en el properties*/
    private String apiKey;
    //Se usa para no guardar la URL
    @Value("${app.news-api.url}")
    private String apiUrl;

    //El constructor (Inyección de dependencias)
    //Su trabajo es ejecutarse una vez para fabricar el objeto y dejarlo listo
    public NewsApiClient(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder.build();
        //RestClient.Builder: (Tipo de fábrica/Dato) Estamos pidiendo un constructor de clientes web
        //RestClientBuilder: Es el nombre (Parámetro o variable) que se le asigna a este tipo de dato
        //this: Es una palabra clave que significa la variable/instancia actual de esta clase, no otra
        //this.restClient = Le asignamos un valor a esta variable que fue creada mas arriba
    }

    /* Devuelve los titulares de UNA categoría de GNews. Cada elemento es un diccionario.
       Categorías válidas de la API: general, world, nation, business, technology,
       entertainment, sports, science, health.

       Antes este método pedía siempre "technology". Por eso las 126 noticias de la base
       terminaron con la misma categoría y los filtros del panel (Deportes, Ciencia,
       Cultura, Política) no podían devolver nada: esas noticias nunca se descargaban. */
    public List<Map<String, Object>> obtenerNoticiasPorCategoria(String categoria) {
        String url = String.format("%s/top-headlines?category=%s&lang=es&apikey=%s",
                apiUrl, categoria, apiKey); //Estas son variables que se meten en el texto
        try {
            log.info("Conectando con NewsApi para obtener titulares de '{}'...", categoria);

            /* Usamos RestClient de forma fluida (igual que en GeminiApiClient)
            restClient: Estamos llamando a la herramienta conectada a
            internet que preparamos en el constructor
            .get(): La orden es de solo traer los datos (información)*/
            Map response = restClient.get()
                    .uri(url)
                    .retrieve()
                    .body(Map.class);//Convertimos lo devuelto en un mapa


            //Si response no está vacío y contiene una llave de etiqueta ("articles")
            if (response != null && response.containsKey("articles")) {
                //"unchecked": Es el parámetro que dice que advertencia callar, en la linea abajo forzamos
                // una conversión de datos, sin esta palabra java nos pondría una advertencia
                //Estamos convirtiendo a la fuerza un Texto de internet en una List<Map<String,Object>>
                @SuppressWarnings("unchecked")//Anotación que cumple la función de suprimir las advertencias
                List<Map<String, Object>> articulos = (List<Map<String, Object>>) response.get("articles");
                log.info("NewsApi: Se recuperaron {} noticias de '{}' exitosamente.", articulos.size(), categoria);
                return articulos;
            }
        } catch (Exception e) {
            // Una categoría que falle no debe tumbar la sincronización de las demás:
            // se devuelve lista vacía y el service sigue con la siguiente.
            log.error("Error consultando NewsApi para la categoría '{}': {}", categoria, e.getMessage());

        }
        return Collections.emptyList();
        //En caso haya un error y apliquemos el catch, devolvemos una lista vacía al usuario
        // con un mensaje como "No hay noticias disponibles". Si no devolvemos una lista el
        // programa explota ya que este método promete devolver una lista
    }
}