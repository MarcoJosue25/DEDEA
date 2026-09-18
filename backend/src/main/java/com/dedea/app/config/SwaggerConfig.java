package com.dedea.app.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SwaggerConfig {

    @Bean
    /*retornamos un objeto OpenAPI que es el cascarón o plantilla principal del documento
    OpenAPI es el estándar de la industria para describir APIs REST*/
    /*OpenAPI: Es el tipo de dato que queremos que devuelva el método*/
    public OpenAPI dedeaOpenAPI() {
        return new OpenAPI()
                //.info(): Toma la carpeta y la manda dentro del cajón "Información" de OpenAPI
                .info(new Info()//New Info(): Fabricamos una carpeta equis
                        .title("Dedea API")//Agregamos todas estas secciones
                        .version("1.0")
                        .description("Documentación de los servicios de mecanografía adaptativa de Dedea"));
    }
}
/*Con esta clase, librerías cmo Swagger toman los datos y generan una página web interactiva
donde se ven las rutas y servicios que ofrece la API de Dedea, y se puede probar cada ruta en
el navegador sin necesidad de herramientas como Postman

El metodo es opcional y es para personalizar esos valores, sin ellos no hace falta crear
la clase, basta con tener la dependencia en el pom
 */