package com.dedea.app.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.core.convert.converter.ConverterFactory;
import org.springframework.format.FormatterRegistry;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Locale;

/**
 * Hace que los enums de la URL se acepten en cualquier combinación de mayúsculas.
 *
 * <p><b>El bug que arregla.</b> Spring convierte un {@code @PathVariable NivelCurso} con un
 * {@code valueOf} exacto, así que {@code /api/v1/curso/basico/progreso} —minúscula— tiraba
 * {@code MethodArgumentTypeMismatchException} y salía un <b>500</b>. Y la URL en minúscula no es
 * un caso raro: es <b>la que produce la propia app</b>, porque {@code CursoSelectorView} navega
 * con {@code n.id.toLowerCase()}. O sea que estos dos endpoints reventaban justo con lo que les
 * manda el frontend.
 *
 * <p>Costó una sesión entera de depuración, y el motivo es que el fallo era mudo: quien lo probaba
 * a mano escribía {@code /curso/BASICO/25} y funcionaba, mientras que al entrar por la interfaz la
 * petición fallaba y la función que dependía de ella no hacía nada ni avisaba.
 *
 * <p><b>Por qué global y no un parche en el controlador.</b> Todo el resto del proyecto ya
 * normaliza a mano —{@code Dificultad.valueOf(dif.toUpperCase())} aparece en ocho servicios— así
 * que los únicos dos sitios sin esa defensa eran justamente los que usan el binding automático de
 * Spring. Esto los alinea con el resto y cubre cualquier enum que se agregue después, sin que
 * nadie tenga que acordarse.
 *
 * <p><b>Un valor inválido de verdad sigue fallando</b>, y eso es lo que se quiere: {@code PATATA}
 * lanza igual, y el {@code GlobalExceptionHandler} lo convierte en un 400 que dice qué valores se
 * aceptan. Lo que cambia es que "válido pero en minúscula" deja de contar como inválido.
 */
@Configuration
public class EnumSinMayusculasConfig implements WebMvcConfigurer {

    @Override
    public void addFormatters(@NonNull FormatterRegistry registro) {
        registro.addConverterFactory(new FabricaEnumSinMayusculas());
    }

    private static class FabricaEnumSinMayusculas implements ConverterFactory<String, Enum<?>> {
        @Override
        @NonNull
        public <T extends Enum<?>> Converter<String, T> getConverter(@NonNull Class<T> destino) {
            return origen -> {
                String limpio = origen.trim().toUpperCase(Locale.ROOT);
                for (T valor : destino.getEnumConstants()) {
                    if (valor.name().equals(limpio)) {
                        return valor;
                    }
                }
                /* Se lanza en vez de devolver null: null haría que el endpoint corriera con el
                   parámetro vacío y fallara más adentro, lejos de la causa. */
                throw new IllegalArgumentException(
                        "Valor no reconocido para " + destino.getSimpleName() + ": " + origen);
            };
        }
    }
}
