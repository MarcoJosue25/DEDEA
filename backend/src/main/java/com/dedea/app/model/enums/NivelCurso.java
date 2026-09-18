package com.dedea.app.model.enums;

// Nivel del futuro Curso por niveles. Los ejercicios del catálogo actual ("Ejercicios
// Base") tienen nivel = null: viven sueltos hasta que se decida en qué nivel y bloque
// encajan. Un ejercicio con nivel asignado participa en la analítica y el umbral de
// avance de ProgresoCursoNivel; uno sin nivel, no.
public enum NivelCurso {
    BASICO,
    INTERMEDIO,
    AVANZADO
}
