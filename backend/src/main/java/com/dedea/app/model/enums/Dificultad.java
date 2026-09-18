package com.dedea.app.model.enums;

public enum Dificultad {
    FACIL,
    MEDIO,
    /* Aterrizaje intermedio, introducido el 24-ago-2026. NUNCA se pide: el prompt sigue
       pidiendo FACIL/MEDIO/DIFICIL y las cuotas siguen siendo 3/4/3. Es solo un resultado
       posible del scorer, para los textos que quedan por encima de un medio normal sin
       llegar a difícil de verdad. Ver CLAUDE.md 10.22. */
    MEDIO_DIFICIL,
    DIFICIL
}
