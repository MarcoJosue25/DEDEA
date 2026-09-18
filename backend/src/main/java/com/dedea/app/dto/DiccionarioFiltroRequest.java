package com.dedea.app.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DiccionarioFiltroRequest {

    @NotBlank(message = "La dificultad es obligatoria")
    private String dificultad;

    @NotNull(message = "El límite es obligatorio")
    @Min(value = 1, message = "El límite debe ser al menos 1")
    /* El tope existe porque este endpoint es PUBLICO —lo llama cualquier visitante, sin
       login— y sin el, un `limite` de medio millon intenta traer el diccionario entero a
       memoria. 200 palabras ya son varias veces lo que cualquier ejercicio pide. */
    @Max(value = 200, message = "El límite máximo es 200 palabras")
    private Integer limite;

    /* El ngram viaja DENTRO de un LIKE, asi que sin patron un `%` devolvia el diccionario
       completo y un `_` hacia de comodin. Se acota a 1-3 letras del alfabeto espanol, que es
       exactamente lo que la tabla de ngramas puede contener: mas largo que eso no existe, y
       cualquier otro caracter no es una letra que se pueda practicar.

       Es la misma correccion que ya se le hizo a TextoIaRequest; este endpoint quedo sin
       ella. */
    @NotBlank(message = "El n-gram es obligatorio para esta búsqueda")
    @Pattern(regexp = "^[a-záéíóúüñ]{1,3}$",
            message = "El n-gram debe ser de 1 a 3 letras del alfabeto español.")
    private String ngram;
}
/* Notblank para Strings y NotNull para Int
@NotBlank:  Verifica que el dato no sea null ni la cadena esté vacía
@NotNull: Solo verifica que el campo no esté vacío, que no sea null, pero deja pasar textos vacíos
@Min: Valida rangos numéricos. @Min(value = 1)
Para que estos parámetros del DTO funcionen debemos poner @Valid en el Controller
@Patter:
regexp:
 */

