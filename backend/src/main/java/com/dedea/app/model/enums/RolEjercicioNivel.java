package com.dedea.app.model.enums;

// Rol de control dentro de la secuencia de un nivel del Curso. null = ejercicio normal,
// solo exige su propio umbral mínimo para desbloquear el siguiente.
public enum RolEjercicioNivel {
    // Al principio del nivel: si se aprueba con precisión ≥80% y WPM ≥ umbral del
    // nivel, salta el nivel ENTERO (no hace falta hacer los demás ejercicios).
    TEST_NIVEL,

    // Al final del nivel: único gatillo real de ProgresoCursoNivel.aprobado. Exige el
    // umbral fijo de aprobar el nivel (CursoStatsServiceImpl.UMBRAL_WPM/UMBRAL_PRECISION),
    // no el umbral más bajo que usa un ejercicio normal.
    TEST_FINAL
}
