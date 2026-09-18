package com.dedea.app.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * El UUID de invitado que se quiere vincular a la cuenta que está por iniciar sesión.
 *
 * <p>Antes viajaba como {@code Map<String,String>} y el controlador comprobaba el formato a
 * mano con un {@code matches()}. La validación era correcta —el agujero estaba tapado— pero
 * vivía dentro del método y no se veía desde afuera: nada en la firma decía qué forma tenía
 * que tener el cuerpo. Con un DTO, la regla es parte del contrato del endpoint, Spring la
 * aplica antes de entrar, y el {@code GlobalExceptionHandler} devuelve un 400 con el campo
 * que falla en vez de aceptar la petición y no hacer nada en silencio.
 *
 * <p>Mismo criterio que {@code TextoIaRequest}, {@code DiccionarioFiltroRequest} y
 * {@code CambioEstadoPalabraRequest}.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VincularUuidRequest {

    /* El patrón es el UUID v4 canónico, el mismo formato que genera el frontend en
       localStorage. Acotarlo importa porque este valor termina en la sesión HTTP y de ahí
       pasa a la columna `identificador_temporal` del usuario. */
    @NotBlank(message = "El uuid es obligatorio")
    @Pattern(regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
            message = "El uuid no tiene el formato esperado")
    private String uuid;
}
