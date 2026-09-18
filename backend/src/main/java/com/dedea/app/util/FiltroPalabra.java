package com.dedea.app.util;

/**
 * Decide si una palabra importada puede siquiera llegar a la pantalla de revisión.
 *
 * <p><b>Qué es y qué no es.</b> Esto NO decide si una palabra entra al diccionario — eso lo
 * decide el usuario a mano, una por una. Esto solo saca lo que no es una palabra del español
 * por razones objetivas, para que la revisión manual no gaste tiempo en basura.
 *
 * <p><b>Por qué existe.</b> Hasta el 27-ago-2026 la única "curación" del diccionario era un
 * proceso externo aplicado UNA vez cuando se armó el archivo semilla, y no estaba en el
 * repositorio. No se podía re-correr, no se podía auditar, y por eso se coló `pito`. Lo que
 * hay en el código —{@code TextCleaner} dentro de {@code agregarPalabra}— es un SANEADOR, no
 * un validador: quita los caracteres que no le gustan pero no rechaza la palabra, y su lista
 * blanca admite dígitos y puntuación. Con un archivo crudo de 50.000 líneas, entradas como
 * "50" o "d.c" entrarían como palabras.
 *
 * <p><b>Lo que rechaza no se pierde:</b> el importador lo manda a {@code NO_PERMITIDA} con el
 * motivo anotado, así queda en el filtro permanente y el buscador puede rescatarlo si alguna
 * regla se equivocó.
 */
public final class FiltroPalabra {

    private FiltroPalabra() {
        throw new UnsupportedOperationException("Clase utilitaria");
    }

    /* Las 27 letras del español más las vocales acentuadas y la diéresis. Nada más: ni
       dígitos, ni símbolos, ni espacios, ni letras de otros alfabetos.

       Es lista BLANCA y no negra, por la misma razón que en DifficultyScorer: un carácter
       que no previmos queda fuera en vez de colarse en silencio. */
    private static final String LETRAS = "abcdefghijklmnñopqrstuvwxyzáéíóúü";

    /* 15 es el máximo real del corpus actual y ya cubre "extraordinariamente". Más largo que
       eso, en una lista de subtítulos, casi siempre son dos palabras pegadas. */
    private static final int LARGO_MIN = 2;
    private static final int LARGO_MAX = 15;

    /** Motivo del rechazo, o {@code null} si la palabra pasa a revisión manual. */
    public static String motivoRechazo(String palabra) {
        if (palabra == null || palabra.isBlank()) {
            return "vacía";
        }
        String p = palabra.trim().toLowerCase(java.util.Locale.ROOT);

        if (p.length() < LARGO_MIN) {
            return "muy corta";
        }
        if (p.length() > LARGO_MAX) {
            return "muy larga";
        }
        for (char c : p.toCharArray()) {
            if (LETRAS.indexOf(c) == -1) {
                return "carácter no permitido: " + c;
            }
        }
        if (sinVocales(p)) {
            return "sin vocales";
        }
        if (tieneLetraTriple(p)) {
            return "letra repetida 3 veces";
        }
        return null;
    }

    /* Ninguna palabra del español carece de vocal. En una lista de subtítulos esto agarra
       siglas sueltas y restos de OCR. */
    private static boolean sinVocales(String p) {
        for (char c : p.toCharArray()) {
            if ("aeiouáéíóúü".indexOf(c) != -1) {
                return false;
            }
        }
        return true;
    }

    /* "jajaja" no, pero "aaah" y "nooo" sí: el español no tiene ninguna letra tres veces
       seguidas, así que es señal segura de transcripción de subtítulo. */
    private static boolean tieneLetraTriple(String p) {
        for (int i = 2; i < p.length(); i++) {
            if (p.charAt(i) == p.charAt(i - 1) && p.charAt(i) == p.charAt(i - 2)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Pista para la pantalla de revisión, o {@code null}. NO rechaza.
     *
     * <p>Son los casos donde hace falta el ojo del usuario y una regla automática se
     * equivocaría: `kilómetro`, `kiosco`, `web` y `whisky` son español correcto pese a la k y
     * la w, y `york` o `washington` no lo son. La diferencia no la puede hacer un patrón.
     */
    public static String sospecha(String palabra) {
        String p = palabra.toLowerCase(java.util.Locale.ROOT);
        if (p.matches(".*(ing|tion|ck|sh|oo|ee).*") || p.endsWith("ll")) {
            return "posible extranjerismo";
        }
        if (p.indexOf('k') != -1 || p.indexOf('w') != -1) {
            return "lleva k o w";
        }
        return null;
    }
}
