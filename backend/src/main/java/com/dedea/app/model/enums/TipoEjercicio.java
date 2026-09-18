package com.dedea.app.model.enums;

// Los tipos de la sección "Curso". No todos tienen generación implementada todavía
// (EjercicioService.generarContenido lanza si falta); se van sumando de a poco.
public enum TipoEjercicio {
    LETRAS_BASICO,
    PALABRAS_SIMPLES,
    TOP_100_PALABRAS,
    ORACIONES_SIMPLES,
    ORACIONES_MAYUSCULAS,
    SUDDEN_DEATH,
    PALABRAS_CONFUSAS,
    MODO_CIEGO,
    DICTADO_VOZ,
    SIMBOLOS_CRITICOS,
    CONTRARRELOJ,
    PALABRAS_MUTANTES,
    /* Acá vivía MODO_SOMBRA, y era un error de modelado: la sombra no es un tipo de
       contenido, es un MODIFICADOR que se puede aplicar a cualquier ejercicio (corres
       el que sea contra el registro de una sesión tuya pasada). Como tipo nunca llegó
       a funcionar: no tenía fila en el catálogo ni caso en generarContenido, así que
       caía en el default del switch y lanzaba. Se retiró sin dejar valor deprecado
       porque ninguna fila de `ejercicios` lo usaba.
       El camino vivo es ?fantasma={sesionId} → generarContenidoConFantasma. */
    // Palabras que se escriben con una sola mano. El reparto de letras vive en la
    // configuración del ejercicio, no en el código.
    MODO_UNA_MANO,

    /* DESESTRUCTURA: palabras flotando que derivan hacia los bordes de un cuadro. Si una
       toca el borde, se pierde el bloque. Ninguna puede empezar con el mismo carácter que
       otra (salvo que una lleve mayúscula), porque si no es imposible saber cuál estás
       tecleando. Es el tipo de "Palabras flotantes" del Curso. */
    DESESTRUCTURA,

    /* --- Los 4 tipos nuevos para el futuro Curso por niveles. Se siembran primero en
       "Ejercicios Base" (nivel = null) para probarse sueltos antes de encajarlos en un
       nivel/bloque. --- */

    // Progresión por dedo específico (no por fila, como LETRAS_BASICO, ni por mano
    // entera, como MODO_UNA_MANO): cada dedo cubre 2-3 letras fijas de la mecanografía
    // al tacto estándar.
    UN_DEDO,

    /* Como MODO_UNA_MANO pero sin exigir el 100%: palabras (o, en modo "oraciones",
       frases curadas a mano) donde ≥90% de las letras caen en una mano, forzando 1-2
       alcances hacia la otra. MODO_UNA_MANO ya cubre el 100% puro; este es el paso
       intermedio, más realista al escribir texto real. */
    UNA_MANO_FORZADA,

    /* Mayúsculas de ambas manos: cada letra exige el Shift del lado CONTRARIO a la
       letra (letra de mano derecha → Shift izquierdo, y viceversa). La validación de
       qué lado se usó vive en el frontend, vía KeyboardEvent.code. */
    SHIFT_LATERAL,

    // Texto largo (300+ caracteres) pensado para medir si el WPM/precisión cae después
    // de cierto % del texto recorrido — el análisis vive en el frontend, sobre los
    // eventos tecla a tecla que ya se registran para el modo sombra.
    RESISTENCIA,

    /* LLUVIA_LETRAS: el "Tetris/piano" de letras cayendo. A diferencia de todo lo demás
       del catálogo (que siempre es "escribí esta secuencia fija de izquierda a
       derecha"), acá el frontend consume `texto` como una COLA de tokens que va
       soltando de a uno en columnas — el orden de aparición no es lineal por índice de
       carácter, así que esta vista no pasa por el handleKeyDown compartido de
       CursoPracticaView. "letras" = solo letras sueltas; "avanzado" = arranca con
       letras y pasa a palabras cortas. */
    LLUVIA_LETRAS,

    /* Palabras (fila central/superior) u oraciones (fila inferior, que no tiene
       vocales — ver generarPalabrasDeFila) restringidas a las letras de una fila del
       teclado. Del Curso por niveles, Básico. */
    PALABRAS_DE_FILA,

    /* ORACIONES_TEMATICAS: igual que ORACIONES_SIMPLES/ORACIONES_MAYUSCULAS (varias
       oraciones cortas encadenadas), pero el banco de dónde salen no está fijo en el
       código — llega en configuracion.banco. Existe para no tener que sumar un
       TipoEjercicio nuevo por cada banco temático del Curso (signos, tildes,
       interrogación, números y fechas, textos tediosos, inglés...): todos comparten
       la misma mecánica de generación, solo cambia el contenido curado. */
    ORACIONES_TEMATICAS,

    /* REPASO_FALLADAS: no tiene banco de contenido — el "contenido" es tu propio
       historial. Reusa las mismas "teclasMasFalladas" que ya calcula
       CursoStatsService.obtenerStatsPorNivel (la pantalla de estadísticas del Curso)
       y arma un drill de LETRAS_BASICO con esas letras en vez de una fila fija. Sin
       historial todavía (usuario nuevo, o consulta anónima), cae a un set genérico de
       letras poco entrenadas. */
    REPASO_FALLADAS
}
