package com.dedea.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SesionResponse {
    private Integer id;
    private String mensaje;

    /* Solo lo llena el Curso por niveles: que umbral hacia falta, cuantas estrellas
       sacaste, si se aprobo el nivel. Queda null en Noticias, IA y Ejercicios Base, que
       no tienen progresion que reportar. */
    private ResultadoCursoResponse resultadoCurso;
}