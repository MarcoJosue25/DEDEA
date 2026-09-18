package com.dedea.app.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;

// Sirve los audios subidos para el ejercicio de Dictado. Separado de CorsConfig a propósito:
// esa clase configura CORS, esta sirve archivos estáticos, son responsabilidades distintas.
@Configuration
public class ArchivosEstaticosConfig implements WebMvcConfigurer {

    // Misma carpeta relativa que usa DictadoController para guardar los archivos subidos.
    public static final Path CARPETA_AUDIOS = Path.of("uploads", "audios");

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/media/audios/**")
                .addResourceLocations("file:" + CARPETA_AUDIOS.toAbsolutePath() + "/");
    }
}
