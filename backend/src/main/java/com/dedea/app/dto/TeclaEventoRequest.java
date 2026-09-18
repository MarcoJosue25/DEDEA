package com.dedea.app.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// Una pulsación individual con su milisegundo exacto. Base de "modo sombra": a diferencia
// de TeclaStatsRequest (conteos agregados), esto viaja en una lista ordenada, una fila por tecla.
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TeclaEventoRequest {

    // NotBlank rechaza strings de puro espacio, pero " " (la barra espaciadora) es un
    // valor de tecla legítimo acá. NotNull + Size sí lo permite.
    @NotNull
    @Size(min = 1, max = 20)
    private String tecla;

    @NotNull @Min(0)
    private Integer ordenSecuencia;

    @NotNull @Min(0)
    private Long tiempoDesdeInicioMs;

    @NotNull @Min(0)
    private Integer indiceResultante;

    @NotNull
    private Boolean correcta;
}
