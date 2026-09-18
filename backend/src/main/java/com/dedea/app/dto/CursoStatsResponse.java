package com.dedea.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

// Analítica del futuro Curso por niveles. Independiente de StatsResponse/DebilidadesResponse
// (que miden Noticias + IA): nunca se cruza con esos números. Reutiliza
// DebilidadesResponse.ItemDebilidad para las teclas falladas, que ya tiene la forma exacta
// que hace falta (secuencia + porcentajeError + totalIntentos), sin duplicar el DTO.
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CursoStatsResponse {
    private String nivel;
    private int wpmPromedio;
    private BigDecimal precisionPromedio;
    private int sesionesCompletadas;
    private boolean desbloqueado;
    private boolean aprobado;
    private List<DebilidadesResponse.ItemDebilidad> teclasMasFalladas;

    /* Nodos completados con una sola estrella. Hay que volver a hacerlos antes de que el
       Test Final pueda aprobar el nivel. */
    private Integer nodosPorMejorar;
}
