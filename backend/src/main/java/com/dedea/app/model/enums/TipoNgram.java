package com.dedea.app.model.enums;

public enum TipoNgram {
    /* Letra suelta. Se guarda desde el 27-ago-2026 para que la busqueda pueda usar
       comparacion EXACTA en vez de LIKE con comodin: antes, pedir "k" no encontraba ningun
       ngram —no habia ninguno de una letra— y por eso la consulta usaba `LIKE '%k%'`, que no
       puede aprovechar ningun indice. */
    UNIGRAMA,
    BIGRAMA,
    TRIGRAMA
}
