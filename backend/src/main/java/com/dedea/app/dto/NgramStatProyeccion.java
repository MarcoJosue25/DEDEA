package com.dedea.app.dto;

import java.math.BigDecimal;

/**
 * Record que reemplaza el Map<String, Object> que devolvía SesionNgramRepository.
 *
 * ANTES: map.get("secuencia").toString() → falla en runtime si cambias el alias SQL
 * AHORA: dto.secuencia()                 → el compilador te avisa si algo no cuadra
 *
 * Los nombres de los campos deben coincidir EXACTAMENTE con los alias AS del SQL:
 * AS secuencia, AS tipo, AS totalIntentos, AS errores
 */
public record NgramStatProyeccion(
        String secuencia,
        String tipo,
        BigDecimal totalIntentos,
        BigDecimal errores
) {}

/*Records
    Clase especial de java, es un trasportador de datos inmutable
    No tiene métodos y anotaciones
    Sus campos son automáticamente private final
    Son eficiente con el uso de memoria ram por no permitir modificaciones
    y perfectos para hilos de ejecución recurrente

 */