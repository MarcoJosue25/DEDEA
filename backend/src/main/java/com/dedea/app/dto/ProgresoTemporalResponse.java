package com.dedea.app.dto;

import java.math.BigDecimal;
import java.util.List;

/* Serie para el gráfico de progreso de Estadísticas.

   `agrupacion` viaja de vuelta para que el frontend sepa qué está dibujando sin tener
   que recordar qué pidió (importa cuando llegan respuestas fuera de orden al cambiar
   rápido entre día/semana/mes).

   Solo incluye sesiones de Noticias y textos de IA: Curso y Palabras son ejercicios más
   cortos y mecánicos, y mezclarlos deformaba la curva. */
public record ProgresoTemporalResponse(
        String agrupacion,
        List<PuntoProgreso> puntos
) {
    public record PuntoProgreso(
            String periodo,
            Integer wpm,
            BigDecimal precision,
            Integer sesiones
    ) {}
}
