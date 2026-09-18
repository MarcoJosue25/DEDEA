package com.dedea.app.util;

import java.util.HashMap;
import java.util.Map;

/**
 * ¿Lo que devolvió el modelo se parece a un texto?
 *
 * <p><b>El caso que lo motivó.</b> El 20-ago-2026, pidiendo un resumen, Gemini entró en un
 * bucle de repetición y devolvió <b>el dígito "1" repetido 1.309 veces</b>. Se guardó y
 * llegó a la pantalla del usuario, y ninguna de las defensas existentes lo frenó — cada una
 * por un motivo distinto y razonable:
 *
 * <ul>
 *   <li>{@link TextCleaner} solo comprobaba que el texto no estuviera vacío. Y no lo estaba.
 *   <li>La lista blanca deja pasar dígitos: un "1" es un carácter perfectamente válido.
 *   <li>{@link DifficultyScorer} calculó su porcentaje obedientemente, porque es una función
 *       matemática y no tiene opinión sobre si eso es un texto.
 * </ul>
 *
 * <p>Nadie hacía la pregunta que faltaba, que es distinta de todas las anteriores. La
 * degeneración por repetición es un modo de fallo <b>conocido</b> de los modelos de lenguaje
 * —no un bug que alguien vaya a arreglar, sino cómo funciona el muestreo—, así que va a
 * volver a pasar y la defensa tiene que ser nuestra.
 *
 * <p>Vive en util y no dentro de un service porque la necesitan los dos que le hablan a
 * Gemini: Noticias y los ejercicios de IA. Duplicar cuarenta líneas en dos clases es
 * garantizar que se desincronicen.
 */
public final class ValidadorTexto {

    private ValidadorTexto() {
        throw new UnsupportedOperationException("Clase utilitaria");
    }

    /**
     * @return el MOTIVO por el que el texto no sirve, o {@code null} si pasa.
     *         Se devuelve el motivo y no un booleano para que el log diga qué falló:
     *         "solo 3 palabra(s)" y "el carácter '1' ocupa el 98% del texto" son problemas
     *         distintos y llevan a revisar cosas distintas.
     */
    public static String motivoInvalido(String texto) {
        if (texto == null || texto.isBlank()) return "vacío";

        String limpio = texto.trim();

        // 1) ¿Algún carácter ocupa demasiado? (ignora espacios: separan, no son contenido)
        Map<Character, Integer> conteo = new HashMap<>();
        int noEspacios = 0;
        for (char c : limpio.toCharArray()) {
            if (Character.isWhitespace(c)) continue;
            noEspacios++;
            conteo.merge(c, 1, Integer::sum);
        }
        if (noEspacios == 0) return "solo espacios";

        for (Map.Entry<Character, Integer> e : conteo.entrySet()) {
            double pct = (double) e.getValue() / noEspacios * 100;
            if (pct > Constants.MAX_PORCENTAJE_UN_CARACTER) {
                return String.format("el carácter '%s' ocupa el %.0f%% del texto (bucle de repetición)",
                        e.getKey(), pct);
            }
        }

        // 2) ¿Tiene suficientes palabras como para ser un texto?
        int palabras = limpio.split("\s+").length;
        if (palabras < Constants.MIN_PALABRAS_TEXTO_IA) {
            return "solo " + palabras + " palabra(s)";
        }

        // 3) ¿Es mayormente letras, o mayormente dígitos y símbolos?
        long letras = limpio.chars().filter(Character::isLetter).count();
        double pctLetras = (double) letras / noEspacios * 100;
        if (pctLetras < Constants.MIN_PORCENTAJE_LETRAS) {
            return String.format("solo %.0f%% de letras (demasiados dígitos o símbolos)", pctLetras);
        }

        return null; // pasa
    }
}
