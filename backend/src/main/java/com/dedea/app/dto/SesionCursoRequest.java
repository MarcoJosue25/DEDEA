package com.dedea.app.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

// Igual que SesionRequest, pero para sesiones de la sección Curso: además de las 3
// dimensiones que ya tenías (progreso, teclas agregadas, ngrams), suma la lista de
// eventos tecla-por-tecla con milisegundo exacto que alimenta el modo sombra.
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SesionCursoRequest {

    @NotNull @Min(0)
    private Integer wpm;

    @NotNull
    @DecimalMin(value = "0.0")
    @DecimalMax(value = "100.0")
    private BigDecimal precision;

    @NotNull @Min(1)
    private Integer segundos;

    @NotBlank
    private String dificultad;

    // El texto exacto que se mostró (para poder reproducirlo después en modo sombra).
    @NotBlank
    private String texto;

    @Valid
    private List<SesionProgresoDTO> progreso;

    @Valid
    private List<TeclaStatsRequest> teclas;

    @Valid
    private List<NgramStatsRequest> ngrams;

    @Valid
    @NotNull
    private List<TeclaEventoRequest> eventos;

    /* Verdadero cuando el ejercicio se aprobo en el QUINTO latido — el ultimo intento que
       se ofrece tras fallar los cuatro. Cambia como se juzga la sesion: solo precision,
       sin exigencia de velocidad, y aprobar por ahi da una sola estrella.

       Lo manda el cliente porque es el unico que sabe en que latido esta; el servidor no
       guarda estado entre latidos (el nodo entero es UNA sesion, que se envia al final).
       No es falsificable para sacar ventaja: declarar `true` da la NOTA MAS BAJA posible
       ademas de exigir mas precision que el camino normal. */
    @Builder.Default
    private Boolean porUltimoIntento = false;
}
