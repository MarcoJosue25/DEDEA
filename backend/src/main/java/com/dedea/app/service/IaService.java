package com.dedea.app.service;

import com.dedea.app.dto.TextoIaRequest;
import com.dedea.app.dto.TextoIaResponse;

public interface IaService {
    // Cambiamos Integer por String aquí también
    TextoIaResponse generarTextoPersonalizado(String identificadorTemporal, TextoIaRequest request);
}