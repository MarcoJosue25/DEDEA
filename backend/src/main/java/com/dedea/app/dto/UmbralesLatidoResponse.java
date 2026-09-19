package com.dedea.app.dto;

import java.math.BigDecimal;

/* Lo que tiene que sacar un nodo servido en LATIDOS para aprobarse, y lo que pide su quinto
   latido. Viaja con el contenido del nodo porque el front decide entre tanda y tanda qué
   viene después sin preguntarle al servidor; antes esos tres números estaban escritos a mano
   en core/curso/latidos.ts y había que sincronizarlos con CursoStatsServiceImpl (hasta el
   19-sep-2026). Salen de las mismas reglas con que el servidor puntúa, incluido el umbral
   propio del ejercicio si lo tiene.

   El SALTO de latidos (35 WPM y 95%) no viaja: es solo una decisión de navegación y vive
   únicamente en el front. */
public record UmbralesLatidoResponse(
        Integer wpm,
        BigDecimal precision,
        BigDecimal ultimoIntentoPrecision
) {
}
