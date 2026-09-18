package com.dedea.app.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NgramStatsRequest {
    @NotBlank(message = "La secuencia del n-grama es obligatoria")
    // Un bigrama tiene exactamente 2 letras, un trigrama exactamente 3.
    // Cualquier secuencia fuera de ese rango es datos corruptos del frontend.
    @Size(min = 2, max = 3, message = "La secuencia debe ser un bigrama (2) o trigrama (3)")
    private String secuencia;

    @NotBlank(message = "El tipo de n-grama (BIGRAMA/TRIGRAMA) es obligatorio")
    private String tipo;

    @NotNull(message = "El total de intentos no puede ser nulo")
    @Min(value = 1, message = "Debe haber al menos un intento")
    private Integer totalIntentos;

    @NotNull(message = "La cantidad de errores no puede ser nula")
    @Min(value = 0, message = "Los errores no pueden ser negativos")
    private Integer errores;

    @NotNull(message = "El tiempo total en milisegundos es obligatorio")
    @Min(value = 0, message = "El tiempo no puede ser negativo")
    private Long tiempoTotalMs;
}
