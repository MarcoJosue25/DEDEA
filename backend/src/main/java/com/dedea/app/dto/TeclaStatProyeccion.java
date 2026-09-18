package com.dedea.app.dto;

import java.math.BigDecimal;
import java.util.function.BiFunction;

/**
 * Record que reemplaza el Map<String, Object> que devolvía SesionTeclaRepository.
 *
 * ANTES: map.get("tecla").toString() → falla en runtime si cambias el alias SQL
 * AHORA: dto.tecla()                 → el compilador te avisa si algo no cuadra
 *
 * Los nombres de los campos deben coincidir EXACTAMENTE con los alias AS del SQL:
 * AS tecla, AS totalIntentos, AS errores
 */
public record TeclaStatProyeccion(
        String tecla,
        BigDecimal totalIntentos,
        BigDecimal errores
) {}

