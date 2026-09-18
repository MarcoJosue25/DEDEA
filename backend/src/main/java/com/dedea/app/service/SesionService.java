package com.dedea.app.service;

import com.dedea.app.dto.SesionRequest;
import com.dedea.app.dto.SesionResponse;

public interface SesionService {

    /**
     * Procesa y guarda los resultados de una partida completa.
     * @param identificadorTemporal El UUID extraído de las cabeceras de seguridad.
     * @param request DTO que contiene WPM, Precisión y desgloses de errores/tiempos.
     * @return SesionResponse con el resumen de la partida guardada y su ID generado.
     */
    // ¡AQUÍ ESTÁ EL CAMBIO! Ahora recibe dos parámetros.
    SesionResponse guardarSesionCompletada(String identificadorTemporal, SesionRequest request);
}