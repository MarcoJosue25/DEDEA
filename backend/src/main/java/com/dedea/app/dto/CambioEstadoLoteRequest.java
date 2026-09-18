package com.dedea.app.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Mover VARIAS palabras de cajón de una sola vez, desde el resultado de una búsqueda por
 * lista. Existe para no hacer una petición HTTP por palabra: rechazar sesenta nombres eran
 * sesenta llamadas, y la pantalla quedaba a medio actualizar si una fallaba por el medio.
 *
 * <p>Lleva DOS listas porque la búsqueda por lista devuelve dos cosas. {@code ids} son las
 * palabras que la tabla ya tenía; {@code nuevas} son los términos que no existían y que hay
 * que <b>crear</b> directamente como rechazadas. Eso último no es un extra: es lo que
 * convierte esta pantalla en un filtro que se acumula. {@code FiltroPalabra} descarta todo lo
 * que ya esté en la tabla en cualquier estado, así que una palabra creada así bloquea sola su
 * reingreso en la próxima importación, sin que nadie tenga que volver a decidirlo.
 *
 * <p>El tope de 500 por lista no es un número mágico: es lo que cabe en una búsqueda hecha a
 * mano pegando una lista. Una carga masiva de verdad va por {@code /importar}, que es otro
 * camino y tiene otras garantías.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CambioEstadoLoteRequest {

    /* Ninguna de las dos lleva @NotEmpty: una búsqueda puede no encontrar NADA (y entonces
       todo es `nuevas`) o encontrarlo todo (y entonces `nuevas` viene vacía). Que al menos
       una traiga algo lo comprueba el servicio, porque es una condición cruzada. */
    @Size(max = 500, message = "Como máximo 500 palabras por lote")
    private List<Integer> ids;

    @Size(max = 500, message = "Como máximo 500 palabras nuevas por lote")
    private List<String> nuevas;

    @Pattern(regexp = "PENDIENTE|PREACTIVA|NO_PERMITIDA",
            message = "El estado debe ser PENDIENTE, PREACTIVA o NO_PERMITIDA")
    @NotNull(message = "El estado es obligatorio")
    private String estado;
}
