package com.dedea.app.dto;

import java.time.LocalDateTime;
// Una fila del selector "practicar contra tu mejor/peor intento".
public record IntentoResumen(
        Integer sesionId,
        Integer wpm,
        java.math.BigDecimal precision,
        Integer segundos,
        LocalDateTime fecha
) {}
