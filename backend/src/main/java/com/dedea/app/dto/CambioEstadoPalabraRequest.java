package com.dedea.app.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Mover una palabra entre cajones desde el buscador de la pantalla de revisión.
 *
 * <p>Antes esto viajaba como un {@code Map<String,String>} y el controlador hacía
 * {@code Integer.valueOf(cuerpo.get("id"))}: un cuerpo mal armado lanzaba
 * {@code NumberFormatException} y salía un <b>500</b>, o sea "el servidor se rompió" cuando
 * lo que estaba mal era la petición. Con un DTO tipado, la validación la hace Spring antes
 * de entrar al método y el {@code GlobalExceptionHandler} devuelve un 400 con el campo que
 * falla.
 *
 * <p>Es la misma corrección que ya se le hizo a {@code TextoIaRequest} y a
 * {@code DiccionarioFiltroRequest}: ningún endpoint debería confiar en la forma del cuerpo.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CambioEstadoPalabraRequest {

    @NotNull(message = "El id de la palabra es obligatorio")
    private Integer id;

    /* El patrón acota a los tres estados reales en vez de dejar que un valueOf falle más
       adentro: así el error dice qué valores se aceptan, en el borde y no en el servicio. */
    @Pattern(regexp = "PENDIENTE|PREACTIVA|NO_PERMITIDA",
            message = "El estado debe ser PENDIENTE, PREACTIVA o NO_PERMITIDA")
    @NotNull(message = "El estado es obligatorio")
    private String estado;
}
