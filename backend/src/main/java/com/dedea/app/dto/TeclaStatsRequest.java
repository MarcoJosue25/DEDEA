package com.dedea.app.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TeclaStatsRequest {
    @NotNull(message = "La tecla evaluada es obligatoria")
    private String tecla;

    @NotNull
    @Min(value = 0)
    private Integer vecesPresionada;

    @NotNull
    @Min(value = 0)
    private Integer vecesCorrecta;

    @NotNull
    @Min(value = 0)
    private Integer vecesError;

    @NotNull
    @Min(value = 0)
    private Long tiempoTotalMs;
}