package com.dedea.app.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SesionProgresoDTO {

    @NotNull(message = "El segundo es obligatorio")
    @Min(value = 1, message = "El segundo debe ser al menos 1")
    private Integer segundo;

    @NotNull(message = "Las WPM del momento son obligatorias")
    @Min(value = 0, message = "Las WPM no pueden ser negativas")
    private Integer wpmMomento;

    // CAMBIO CRÍTICO AQUÍ: Double -> BigDecimal y añadimos los escudos
    @NotNull(message = "La precisión del momento es obligatoria")
    @DecimalMin(value = "0.0", message = "La precisión no puede ser negativa")
    @DecimalMax(value = "100.0", message = "La precisión máxima es 100.00")
    private BigDecimal precisionMomento;
}