package com.dedea.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProgresoNgramResponse {

    private List<NgramConProgreso> mejorandoEnTop5;
    private List<NgramConProgreso> graduados;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class NgramConProgreso {
        private String secuencia;
        private String tipo;
        private int porcentajeErrorActual;
        private int porcentajeErrorAnterior;
        private int puntosMejorados; // anterior - actual
        private long totalIntentos;
    }
}