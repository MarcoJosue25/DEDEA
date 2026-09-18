package com.dedea.app.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/*Le comunica a Spring (cuando arranca) que esta clase contiene
las herramientas globales que el programa quiere que Spring fabrique*/
@Configuration

/*CORS: Cross-Origin Resource Sharing (Intercambio de Recursos de Origen Cruzado)
Es un guardia de seguridad integrado en todos los navegadores. BLoquea la trasmisión
de datos entre servidores distintos a menos que el servidor le diga explícitamente que
está bien
Esta clase es el pase Vip que el backend le da al Front para que el navegador no lo bloquee*/

/*WebMvcConfigurer: Es una interfaz, contiene el manual de configuración Web de Spring
(WebMvcConfigurer) y vamos a sobreescribir algunas reglas*/
public class CorsConfig implements WebMvcConfigurer {

    /* LOS ORÍGENES SALEN DE LA CONFIGURACIÓN, NO DEL CÓDIGO.

       Estaban fijos acá, y eso era un bloqueante de publicación silencioso: al desplegar, el
       dominio real no está en la lista, el navegador corta cada petición, y el error que
       muestra no dice "falta tu dominio" sino algo genérico de CORS. Se pierde una tarde
       buscando en el lugar equivocado.

       Ahora se define con CORS_ORIGENES; en local el valor por defecto ya trae el puerto de
       Vite, así que no hay que configurar nada para desarrollar. Mismo patrón que
       app.security.cookie-secure.

       ⚠️ Con allowCredentials(true) —necesario para que viaje la cookie de login— el navegador
       PROHÍBE usar "*". Los orígenes tienen que ser explícitos siempre. */
    @Value("${app.cors.origenes}")
    private String[] origenes;

    @Override
    //Registry: Es un objeto de registro en blanco de tipo CorsRegistry
    //void: No devuelve nada, solo ejecuta la acción del método
    public void addCorsMappings(CorsRegistry registry) {
        //Reglas de acceso
        //.addMappping(): Significa que las reglas se aplican a las rutas (URLs)
        // que empiecen con "/api/**"
        registry.addMapping("/api/**") // Aplica a todos nuestros controllers
                // allowedOrigins(): Orígenes permitidos, dirección del Front. Solo permitimos
                // la intercomunicación con estas rutas
                /* Solo 5173, que es el puerto de Vite. `localhost:3000` estuvo acá hasta el
                   31-ago-2026 como resto de una configuración anterior (CRA usa 3000 por
                   defecto); el proyecto nunca corrió ahí. Un origen permitido que nadie usa no
                   rompe nada, pero es superficie de más y confunde al leer.

                   ⚠️ Con allowCredentials(true) NO se puede usar "*": el navegador rechaza esa
                   combinación. Los orígenes tienen que ser explícitos, y por eso al publicar hay
                   que agregar el dominio real acá o —mejor— moverlos a application.yml con
                   @Value, como ya se hizo con app.security.cookie-secure. Ver CLAUDE.md 11. */
                .allowedOrigins(origenes)
                //Indicamos que peticiones (HTTP) están autorizadas a usarse
                //Options es vital para que Cors no falle con las peticiones fantasmas
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                /*metodo que permite que informacion se acepta de la cabecera (header) del front
                Este "*" permite que se envíe cualquier cabecera que el front envíe, como en el
                 identificador temporal cuando se practica sin iniciar sesión */
                .allowedHeaders("*")
                // Necesario para que el navegador mande la cookie dedea_token (login) en cada
                // fetch/axios del front. Sin esto, /api/v1/auth/me nunca vería la cookie.
                .allowCredentials(true);
    }
}
/*Riesgo a futuro: estos orígenes están hardcodeados para desarrollo local. Al
desplegar a producción, hay que agregar el dominio real (o mover esto a application.yml
 con @Value, como se hizo con otras configs del proyecto) — si no, el front en producción
 quedará bloqueado por CORS.*/