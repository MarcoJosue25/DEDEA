package com.dedea.app.util;

import com.dedea.app.model.enums.Dificultad;

// DifficultyScorer (el existente) está calibrado para textos completos: mayúsculas,
// comas, signos. Una palabra suelta del diccionario no tiene nada de eso, así que casi
// todo caía en FACIL. Esta clase evalúa solo la palabra en sí: tildes, ñ, letras poco
// frecuentes en español (k, w, x), letras dobles, clusters de consonantes y longitud.
//
// Importante: el puntaje es aditivo y NO se divide por la longitud de la palabra.
// Dividir por longitud castigaba de más a palabras cortas con una sola tilde
// (ej. "sí", "qué", "más" terminaban en DIFICIL solo por ser cortas) — un resultado
// contraintuitivo para practicar mecanografía. Los umbrales están calibrados contra
// las 8,000 palabras reales del diccionario para que ningún n-grama (ej. "ño", "k", "w")
// quede encerrado en un solo nivel: si un usuario busca practicar "k" en FACIL,
// tiene que haber resultados.
public final class PalabraDifficultyScorer {

    private static final java.util.Set<Character> VOCALES_TILDE = java.util.Set.of('á', 'é', 'í', 'ó', 'ú', 'ü');
    private static final java.util.Set<Character> CONSONANTES = java.util.Set.of(
            'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'ñ', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'y', 'z');
    private static final java.util.Set<Character> LETRAS_RARAS = java.util.Set.of('k', 'w', 'x');

    private PalabraDifficultyScorer() {
        throw new UnsupportedOperationException("Clase utilitaria");
    }

    public static Dificultad calcularDificultad(String palabra) {
        if (palabra == null || palabra.isEmpty()) {
            return Dificultad.FACIL;
        }

        double score = 0;
        for (char c : palabra.toCharArray()) {
            if (VOCALES_TILDE.contains(c)) score += 1;
            if (c == 'ñ') score += 1;
            if (LETRAS_RARAS.contains(c)) score += 1;
        }

        // Letras dobles consecutivas (rr, ll, cc...) rompen el ritmo de tipeo
        for (int i = 0; i < palabra.length() - 1; i++) {
            if (palabra.charAt(i) == palabra.charAt(i + 1)) score += 1;
        }

        // Clusters de 3+ consonantes seguidas (ej. "obstr", "transp")
        int i = 0;
        while (i < palabra.length()) {
            int j = i;
            while (j < palabra.length() && CONSONANTES.contains(palabra.charAt(j))) j++;
            int largoCluster = j - i;
            if (largoCluster >= 3) score += (largoCluster - 2);//Genera puntos en base al rango de las consonantes
            i = Math.max(j, i + 1);
        }//transporte

        // Palabras largas exigen más tiempo sostenido de tipeo
        score += palabra.length() / 4;

        if (score <= 1) return Dificultad.FACIL;
        if (score <= 2) return Dificultad.MEDIO;
        return Dificultad.DIFICIL;
    }
}
