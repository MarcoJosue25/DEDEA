package com.dedea.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Una palabra tal como la ve la pantalla de revisión. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PalabraRevisionDTO {
    private Integer id;
    private String palabra;
    private String estado;
    private Integer rangoFrecuencia;
    /* Pista visual, no decisión: la pantalla la pinta distinto para que el ojo vaya
       más rápido sobre los casos que de verdad hay que pensar. */
    private String sospecha;
}
