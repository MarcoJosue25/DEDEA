package com.dedea.app.repository;

/* QUÉ SESIÓN ENTRA EN LAS ESTADÍSTICAS GLOBALES, escrito una sola vez.

   Hasta el 10-sep-2026 era una lista blanca de dos modos, `('NOTICIAS','IA')`, repetida a mano
   en cada consulta. El usuario decidió que el CURSO alimente también lo global —el que empieza
   por el curso no veía nada suyo en Estadísticas—, y con eso la condición deja de caber en
   un `IN`: hay que mirar el ejercicio de la sesión. Varias consultas en dos repositorios la
   necesitan; con la condición copiada en cada una, el día que cambie se desincronizan.

   Son fragmentos de SQL nativo para concatenar dentro de `@Query`, y por eso constantes de
   compilación: una anotación solo acepta expresiones constantes. Todas suponen el alias `s`
   para la tabla `sesiones`.

   DEL CURSO ENTRA LO QUE SE TECLEA DE VERDAD, no todo:
     · solo el Curso por NIVELES (`nivel IS NOT NULL`). Ejercicios Base guarda también como
       modo CURSO y ahí viven las sesiones de 1740 WPM: drills sueltos de un segundo.
     · fuera los JUEGOS —Lluvia de letras y Palabras flotantes—: su ritmo lo marca el juego y
       no quien teclea, así que su WPM no dice nada del usuario. Medido: las 72 partidas de
       Lluvia promedian 14 WPM. Además la Lluvia no guarda datos por tecla, a propósito.
     · fuera lo que duró menos de 10 s: intentos abortados o sesiones mal medidas. Hubo 13
       nodos por tandas guardados con 1 s por un fallo del front, ya corregido; este piso es lo
       que impide que un fallo así vuelva a ensuciar los promedios en silencio.

   Medido sobre el historial principal antes de activarlo: de 232 a 316 sesiones, y el
   promedio pasa de 65 a 64 WPM y de 90,5 a 89,8% de precisión. */
public final class CondicionesSesion {

    private CondicionesSesion() {
    }

    private static final String EJERCICIO_DEL_CURSO_QUE_CUENTA =
            "SELECT 1 FROM ejercicios ej WHERE ej.id = s.ejercicio_id "
                    + "AND ej.nivel IS NOT NULL AND ej.tipo NOT IN ('LLUVIA_LETRAS','DESESTRUCTURA')";

    /* Promedios, gráfico de progreso, "Hoy" y mapa de calor. */
    public static final String MEDIBLE =
            "(s.modo_usado IN ('NOTICIAS','IA') "
                    + "OR (s.modo_usado = 'CURSO' AND s.duracion_segundos >= 10 "
                    + "AND EXISTS (" + EJERCICIO_DEL_CURSO_QUE_CUENTA + ")))";

    /* Las MARCAS (mejor WPM, mejor precisión, sesión más larga). Del Curso solo entra el
       nivel AVANZADO — decisión del usuario para el mejor WPM: en Básico e Intermedio se
       teclean sílabas y listas cortas, y un récord tiene que salir de un texto de verdad. Se
       aplica a las tres marcas y no solo al WPM por coherencia: una lista de veinte letras
       acertadas daría también un "100% de mejor precisión" sin decir nada. */
    public static final String PARA_MARCAS =
            "(s.modo_usado IN ('NOTICIAS','IA') "
                    + "OR (s.modo_usado = 'CURSO' AND s.duracion_segundos >= 10 "
                    + "AND EXISTS (" + EJERCICIO_DEL_CURSO_QUE_CUENTA + " AND ej.nivel = 'AVANZADO')))";
}
