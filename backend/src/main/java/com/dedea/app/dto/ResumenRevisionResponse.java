package com.dedea.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Cuántas palabras hay en cada cajón. Lo devuelve toda operación que mueva palabras,
 *  así la pantalla refresca sus contadores sin pedir nada más. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResumenRevisionResponse {
    private long pendientes;
    private long preactivas;
    private long noPermitidas;
    private long enDiccionario;
    /** Qué hizo la operación que se acaba de ejecutar, en una línea para el usuario. */
    private String detalle;
}
