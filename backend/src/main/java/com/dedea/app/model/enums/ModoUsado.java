package com.dedea.app.model.enums;

public enum ModoUsado {
    NOTICIAS,
    IA,
    LIBRE,
    CURSO,
    /* Los tres modos del Área de Entrenamiento. Quedan FUERA de los promedios de WPM,
       precisión y récords, por la misma razón que Libre: son bloques de segundos y sus WPM
       inflan la media (hay sesiones de 1s con 1740 WPM porque la duración se acota a un
       mínimo de 1 segundo). El volumen y la racha sí los cuentan.

       La exclusión no hay que tocarla en ningún lado: las consultas de estadísticas usan
       CondicionesSesion, que nombra los modos que ENTRAN (Noticias, IA y el Curso por
       niveles), así que todo modo nuevo queda excluido por omisión.

       Ojo: la columna `sesiones.modo_usado` es un ENUM de MySQL e Hibernate con
       ddl-auto:update no le agrega valores. Sumar un modo acá exige un
       ALTER TABLE sesiones MODIFY COLUMN modo_usado ENUM(...) a mano. */
    ENTRENAMIENTO,
    EGO_CONSTRUIR,
    EGO_DESTRUIR
}
