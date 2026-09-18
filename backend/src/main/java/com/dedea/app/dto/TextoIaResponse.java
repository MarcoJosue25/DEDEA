package com.dedea.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TextoIaResponse {
    private Integer id;
    private String contenidoLimpio;
    private String dificultad;
    private String teclasBase; // Para saber en qué debilidades se basó
}