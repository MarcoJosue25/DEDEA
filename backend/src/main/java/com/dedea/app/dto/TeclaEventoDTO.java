package com.dedea.app.dto;

// Eco de lectura de un evento guardado: lo que necesita el frontend para animar
// la posición del fantasma en el instante t (busca el evento con mayor
// tiempoDesdeInicioMs <= t transcurrido, y usa su indiceResultante).
public record TeclaEventoDTO(
        Integer ordenSecuencia,
        Long tiempoDesdeInicioMs,
        Integer indiceResultante,
        Boolean correcta
) {}
