package com.dedea.app.util;

public final class TextCleaner {

    private TextCleaner() {
        throw new UnsupportedOperationException("Esta es una clase utilitaria y no puede ser instanciada");
    }

    /* Caracteres que se conservan SIEMPRE, en cualquier nivel y en cualquier llamador
       (noticias, textos de IA y diccionario comparten esta clase).

       `#` y `&` entraron el 27-ago-2026. En el teclado LATINOAMERICANO —el que usa el
       usuario— son Shift+3 y Shift+6, o sea tan tecleables como el `%` o el `$` que ya
       estaban. Antes se borraban en todos los niveles y en silencio: "AT&T" llegaba como
       "ATT" y "#1" como "1".

       ⚠️ Con una salvedad conocida: en el teclado de ESPAÑA el `#` no es Shift+3 sino
       AltGr+3, así que para ese usuario queda fuera de alcance — el mismo motivo por el que
       el `€` se convierte a "EUR" en vez de conservarse. Se acepta porque el público es
       latinoamericano; la solución de fondo es el perfil de teclado por usuario, anotado en
       CLAUDE.md 12.8. */
    private static final String PERMITIDOS_BASE =
            "a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\\s\\.,:;\\(\\)\\\"\\'\\!\\?¡¿\\-_%$€@#&";

    /* Símbolos que solo sobreviven en el nivel DIFICIL de Noticias.

       Son perfectamente tecleables en teclado español —`+` es tecla directa, `*` es
       Shift++, `/` es Shift+7, `[` `]` `<` `>` están al alcance— y son justo la clase de
       carácter incómodo que ese nivel busca. Hasta el 19-ago-2026 estaban FUERA de la
       lista blanca, así que se borraban en silencio: una noticia con "4 * 2 +3" llegaba
       al usuario como "4 2 3".

       Fuera de DIFICIL siguen prohibidos a propósito: en fácil y medio meterían un salto
       de dificultad que esos niveles no quieren. */
    private static final String PERMITIDOS_SOLO_DIFICIL = "\\[\\]\\+\\*/<>";

    /**
     * Limpia un texto crudo proveniente de NewsAPI o Gemini.
     * Aplica reglas de formato, normalización tipográfica para teclado ASCII y una lista blanca de caracteres.
     *
     * Sobrecarga sin nivel: mantiene el comportamiento de siempre (sin símbolos
     * avanzados). La usan IaServiceImpl y DictionaryServiceImpl, que no tienen nivel.
     */
    public static String limpiarTexto(String input) {
        /* PALABRA SUELTA: lo prohibido se borra SIN dejar espacio.

           Es lo contrario de lo que hacen las otras dos sobrecargas, y es a propósito: acá
           entra una palabra del diccionario, no una frase. Si un carácter raro se
           reemplazara por espacio, la palabra se partiría en dos y se guardaría como si
           fueran dos entradas. Pegarla es el mal menor — y desde que existe FiltroPalabra
           casi no se llega a este caso, porque una palabra con caracteres raros se rechaza
           antes de llegar acá. */
        return limpiarTexto(input, false, null, "");
    }

    /**
     * Limpia conservando ADEMÁS unos caracteres concretos que el llamador pide preservar.
     *
     * <p>Existe por los ejercicios de IA. Ahí el usuario elige qué practicar, y desde que
     * las teclas débiles pueden ser símbolos, puede pedir justamente un carácter que la
     * lista blanca base borra: {@code / [ ] + * < >}. El resultado era absurdo y silencioso
     * — <b>el ejercicio no podía contener el carácter que se había pedido practicar</b>.
     * Gemini lo escribía, esta clase lo borraba, y encima sin dejar espacio (el bug 9), así
     * que "4/5" llegaba como "45".
     *
     * <p>Se resuelve por excepción explícita y no ensanchando PERMITIDOS_BASE: los símbolos
     * siguen prohibidos por defecto en todos lados, y solo pasan cuando alguien los pidió a
     * propósito para ese texto. Noticias y diccionario no cambian en nada.
     *
     * @param caracteresExtra caracteres sueltos que deben sobrevivir sí o sí. Vacío o null
     *                        se comporta igual que la sobrecarga de un argumento.
     */
    public static String limpiarTexto(String input, String caracteresExtra) {
        return limpiarTexto(input, false, caracteresExtra, " ");
    }

    /**
     * @param permitirSimbolosAvanzados true solo cuando el texto se pidió para el nivel
     *                                  DIFICIL de Noticias (ver PERMITIDOS_SOLO_DIFICIL).
     */
    public static String limpiarTexto(String input, boolean permitirSimbolosAvanzados) {
        return limpiarTexto(input, permitirSimbolosAvanzados, null, " ");
    }

    /** @param reemplazo con qué se sustituye lo que no pasa la lista blanca: " " para
     *                   textos, "" para palabras sueltas. Ver las sobrecargas de arriba. */
    private static String limpiarTexto(String input, boolean permitirSimbolosAvanzados,
            String caracteresExtra, String reemplazo) {
        if (input == null || input.trim().isEmpty()) {
            return "";
        }

        // REGLA 1: Reemplazar saltos de línea (\n, \r) y tabulaciones (\t) por un espacio simple
        String texto = input.replaceAll("[\\n\\r\\t]", " ");

        // REGLA 2: Normalización Tipográfica (Rápida)
        // Convierte guiones de periodismo y comillas "inteligentes" a formatos nativos de teclado
        texto = texto.replace("—", "-")  // Raya (Em-dash)
                .replace("–", "-")  // Semirraya (En-dash)
                .replace("“", "\"") // Comilla doble de apertura
                .replace("”", "\"") // Comilla doble de cierre
                .replace("‘", "'")  // Comilla simple de apertura
                .replace("’", "'")  // Comilla simple de cierre
                /* Comillas ANGULARES. Son las estándar del periodismo en español y estaban
                   fuera de esta lista: no se convertían y tampoco pasaban la lista blanca, así
                   que se borraban enteras. Cada cita textual de un artículo llegaba al usuario
                   sin sus comillas, en silencio. Van a la comilla recta, igual que las
                   tipográficas de arriba. */
                .replace("«", "\"")
                .replace("»", "\"")
                /* El euro exige AltGr en el teclado español y en la práctica queda fuera
                   del alcance del usuario, así que rompe la decisión de que TODO el
                   contenido tiene que ser tecleable. Se convierte a "EUR" en vez de
                   borrarse o cambiarse por otra moneda: borrarlo dejaría "38,99" sin
                   unidad y cambiarlo por $ falsearía el dato (son precios reales en
                   euros), lo que además chocaría con la regla de fidelidad del prompt.
                   El $ NO se toca: es Shift+4, perfectamente tecleable, y sigue pasando
                   la lista blanca tal cual. */
                .replace("€", " EUR");

        /* REGLA 3: Lista Blanca (Filtro estricto de caracteres)
           Mantiene alfanuméricos, acentos, espacios, puntuación básica y símbolos especiales.
           NOTA: Se eliminó la raya (—) de este filtro porque la REGLA 2 ya la transformó en un guion normal (-).

           ¿ y ¡ van en la lista desde 2026-08-09. Antes se conservaban `?` y `!` pero se
           BORRABAN los de apertura, así que toda noticia llegaba con español mal escrito
           ("Quién vino?") y el usuario no llegaba a practicar los dos únicos signos
           exclusivos del español: en todo el historial, `¿` aparecía 2 veces.
           Son teclas reales del teclado español, así que son perfectamente tecleables. */

        String permitidos = permitirSimbolosAvanzados
                ? PERMITIDOS_BASE + PERMITIDOS_SOLO_DIFICIL
                : PERMITIDOS_BASE;
        permitidos += escaparParaClase(caracteresExtra);

        /* SE REEMPLAZA POR ESPACIO, NO POR VACÍO (en textos).

           Borrar sin dejar nada pegaba lo que quedaba a los lados y podía FABRICAR UN DATO
           FALSO: en fácil y medio, donde `<` está prohibido, "5<10" llegaba al usuario como
           "510" — una cifra que el artículo original no decía, justo después de que la regla
           de fidelidad del prompt logró que Gemini la respetara. Lo mismo "AT&T" -> "ATT".

           El espacio de más no molesta: la REGLA 4 de abajo colapsa los espacios múltiples y
           recorta los extremos, así que "5 10" queda limpio y, sobre todo, no miente. */
        texto = texto.replaceAll("[^" + permitidos + "]", reemplazo);

        // REGLA 4: Reducir múltiples espacios a uno solo y limpiar los extremos
        texto = texto.replaceAll("\\s+", " ").trim();

        return texto;
    }

    /* Deja unos caracteres sueltos listos para pegarlos dentro de un [...] de regex.

       Se escapa TODO carácter que no sea letra o dígito, en vez de mantener una lista de
       los que son especiales dentro de una clase de caracteres. Es la misma decisión de
       lista blanca que en DifficultyScorer.soloTeclasDirectas y por el mismo motivo: con
       lista negra, olvidarse de uno no da error de compilación — da una expresión regular
       mal formada en tiempo de ejecución, o peor, una que compila y filtra otra cosa.
       Escapar de más es inofensivo. */
    private static String escaparParaClase(String caracteres) {
        if (caracteres == null || caracteres.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (char c : caracteres.toCharArray()) {
            if (!Character.isLetterOrDigit(c)) {
                sb.append('\\');
            }
            sb.append(c);
        }
        return sb.toString();
    }
}
