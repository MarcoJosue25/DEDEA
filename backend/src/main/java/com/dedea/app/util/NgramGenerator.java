package com.dedea.app.util;

import java.util.ArrayList;
import java.util.List;

public final class NgramGenerator {

    private NgramGenerator() {
        throw new UnsupportedOperationException("Esta es una clase utilitaria y no puede ser instanciada");
    }

    /**
     * ESCENARIO 1: Para el Diccionario.
     * Saca TODOS los n-grams posibles de una palabra para guardarlos como índice de búsqueda.
     * Ejemplo: "casa" -> [ca, as, sa, cas, asa]
     */

    /**
     * ESCENARIO 1: Para el Diccionario.
     * Saca TODOS los n-grams posibles de una palabra para guardarlos como índice de búsqueda.
     * Ejemplo: "casa" -> [ca, as, sa, cas, asa]
     */
    public static List<String> generarTodosNgrams(String palabra) {
        List<String> ngrams = new ArrayList<>();
        if (palabra == null || palabra.length() < 2) {
            return ngrams;
        }

        String p = palabra.toLowerCase();

        /* SIN REPETIDOS. "casaca" generaba el bigrama "ca" dos veces y la consulta hace
           DISTINCT sobre la palabra igual, asi que la fila extra no aportaba ni un resultado
           y solo engordaba la tabla. Con 50.000 palabras eso son decenas de miles de filas
           que no hacen nada. */
        java.util.LinkedHashSet<String> unicos = new java.util.LinkedHashSet<>();

        /* Letras sueltas. Es lo que permite que la busqueda compare por igualdad en vez de
           con LIKE '%x%': sin unigramas, pedir "k" no encontraba nada y habia que recurrir al
           comodin, que obliga a revisar TODAS las filas de la tabla. */
        for (int i = 0; i < p.length(); i++) {
            unicos.add(p.substring(i, i + 1));
        }

        // Bigramas (ventanas de 2 letras)
        for (int i = 0; i < p.length() - 1; i++) {
            unicos.add(p.substring(i, i + 2));
        }

        // Trigramas (ventanas de 3 letras)
        for (int i = 0; i < p.length() - 2; i++) {
            unicos.add(p.substring(i, i + 3));
        }

        ngrams.addAll(unicos);
        return ngrams;
    }

    /**
     * ESCENARIO 2: Para el Análisis de Errores.
     * Devuelve el bigrama y trigrama exacto que falló, usando la letra objetivo y sus precedentes.
     */
    //Este tipo de métodos están diseñados para devolver una lista por eso
    // es obligatorio usar List<String> sino devolvería un solo valor (Int, String)
    public static List<String> extraerNgramsFallidos(String palabraObjetivo, int indiceError) {
        List<String> ngramsFallidos = new ArrayList<>();

        // Si falló en la primera letra o hay datos inválidos, retornamos vacío
        //indiceError >= palabraObjetivo.length() -> Para prevenir errores de índice por desincronización
        if (palabraObjetivo == null || indiceError <= 0 || indiceError >= palabraObjetivo.length()) {
            return ngramsFallidos;
        }

        String p = palabraObjetivo.toLowerCase();

        // --- TU VALIDACIÓN DE EDGE CASE ---
        // Si el usuario falló al teclear un espacio, o el carácter anterior era un espacio
        // (es decir, falló en la primera letra de una palabra tras un espacio), no hay bigrama.
        // charAt() -> Va directo al caracter específico (donde ocurrió el error)
        if (p.charAt(indiceError) == ' ' || p.charAt(indiceError - 1) == ' ') {
            return ngramsFallidos;
        }

        // 1. Extraer Bigrama Fallido (ya sabemos que no contiene espacios)
        // Si tenemos casa y fallamos en la 's' (2) el -1 resta el numero de digito
        // y sería (1) que es a y el +1 suma sería el (3) que es el que ya no se debe contar
        // quedando (1),(2) = 'as'
        ngramsFallidos.add(p.substring(indiceError - 1, indiceError + 1));

        // 2. Extraer Trigrama Fallido
        // Además de verificar que haya suficientes letras (indiceError >= 2),
        // validamos que la letra de hace dos posiciones tampoco sea un espacio.
        if (indiceError >= 2 && p.charAt(indiceError - 2) != ' ') {
            ngramsFallidos.add(p.substring(indiceError - 2, indiceError + 1));
        }
        //La misma lógica de arriba solo que al número de letra se le restan 2
        return ngramsFallidos;
    }
}