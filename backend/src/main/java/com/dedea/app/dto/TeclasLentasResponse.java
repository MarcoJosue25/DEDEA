package com.dedea.app.dto;

import java.util.List;

/* Las teclas que más te frenan, para el segundo modo del mapa de calor.

   `datosSuficientes` avisa cuando todavía no hay pulsaciones que analizar: el tiempo por
   tecla se deriva de sesion_teclas_eventos, y esos eventos solo se guardan desde que se
   añadió el registro tecla a tecla. Sin esto, la pantalla no podría distinguir "eres
   parejo con todas las teclas" de "todavía no hay datos". */
public record TeclasLentasResponse(
        boolean datosSuficientes,
        List<TeclaLenta> teclas
) {
    public record TeclaLenta(
            String tecla,
            Integer msPromedio,
            Integer pulsaciones
    ) {}
}
