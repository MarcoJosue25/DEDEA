package com.dedea.app.config;

import com.dedea.app.security.JwtAuthFilter;
import com.dedea.app.security.OAuth2LoginSuccessHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import static org.springframework.security.config.Customizer.withDefaults;

@Configuration
//Sesactiva las reglas de seguridad y autoriza las instrucciones de abajo
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;

    /*Un Bean es un objeto que vive en la memoria de Spring
   Acá ordena que cuando arranque el servidor se ejecute este método
   una vez para guardarlo en la caja de herramientas para siempre*/
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
                //Todos estos son métodos de la clase HttpSecurity
                // 1. Desactivamos CSRF (Obligatorio para APIs que reciben POST/PUT)
                http.csrf(AbstractHttpConfigurer::disable)

                // 2. Activamos CORS con configuración por defecto, para que la API acepte peticiones del front
                .cors(withDefaults())

                //Definimos que rutas requieren tarjeta VIP y cuales no
                .authorizeHttpRequests(auth -> auth
                        // 3. Documentación LIBRE PARA DEASARROLLADORES (ES EL CONCEPTO DE LA CLASE SWAGGER)
                        .requestMatchers("/api-docs/**", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()

                        // 3b. Endpoints del handshake OAuth2 (redirect a Google/Facebook y callback de vuelta)
                        .requestMatchers("/oauth2/**", "/login/**").permitAll()

                        // 4. API LIBRE (Aquí es donde entran tus invitados y usuarios no registrados)
                        .requestMatchers("/api/v1/**").permitAll()

                        // 4b. Audios subidos para el ejercicio de Dictado (solo lectura pública;
                        // la subida en sí vive en /api/v1/dictado/audios, protegida por X-Admin-Key)
                        .requestMatchers("/media/**").permitAll()

                        // 5. Cualquier otra ruta (si existiera) requiere autenticación
                        .anyRequest().authenticated()
                )

                // 6. BLOQUE CLAVE: Desactivamos el formulario de login y el popup de contraseña
                // esto ya no lo hace Spring. Porque si no interceptaría a los usuarios y pediría autenticación
                //formLogin Redirige un html para solicitar autenticación
                //httpBasic Muestra una ventana emergente solicitando autenticaión
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)

                // 7. Login con Google/Facebook. Al terminar el handshake, el successHandler
                // emite nuestro propio JWT en cookie httpOnly y redirige al frontend.
                .oauth2Login(oauth2 -> oauth2.successHandler(oAuth2LoginSuccessHandler))

                // 8. Nuestro filtro lee la cookie dedea_token en cada request y, si es válida,
                // autentica al usuario para esa request (sin esto, oauth2Login no basta:
                // solo cubre el momento del login, no las siguientes peticiones a /api/v1/**).
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
    /*SecurityFilerChain: Es una Interfaz que cumple la función de una cadena de filtros de Seguridad.
    ttpSecurity: Caja de herramientas que se trae para configurar las reglas
    throes Exception: Advertencia en caso de error en algún punto

     */
}