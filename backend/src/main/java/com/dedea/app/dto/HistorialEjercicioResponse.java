package com.dedea.app.dto;

import java.util.List;

public record HistorialEjercicioResponse(
        List<IntentoResumen> mejores,
        List<IntentoResumen> peores
) {}
