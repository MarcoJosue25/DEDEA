package com.dedea.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StatsResponse {

    /* wpmPromedio y precisionPromedio salen SOLO de Noticias y textos de IA. Los
       ejercicios de Curso y Palabras duran uno o dos segundos y disparaban el promedio a
       cifras irreales (hay sesiones guardadas de 1740 WPM). sesionesMedidas dice sobre
       cuántas sesiones se calcularon esos dos números. */
    private Integer wpmPromedio;
    private BigDecimal precisionPromedio;
    private Integer sesionesMedidas;

    // Volumen de práctica: acá sí cuenta todo, incluidos Curso y Palabras.
    private Integer sesionesCompletadas;
    private Integer tiempoTotalSegundos;
    private Long caracteresEscritos;
    private Long caracteresFallados;
}