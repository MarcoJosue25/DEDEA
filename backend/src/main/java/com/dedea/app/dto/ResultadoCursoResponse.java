package com.dedea.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/* Lo que el Curso le devuelve al frontend al terminar un ejercicio.

   Existe porque hasta el 2-sep-2026 el guardado respondia SesionResponse{id, mensaje} y
   nada mas: el servidor evaluaba el umbral, marcaba el nodo y hasta aprobaba el nivel,
   pero el usuario no se enteraba de nada de eso. La pantalla de resultados mostraba las
   mismas cuatro cifras que en Noticias y el sendero recien reflejaba el cambio al volver
   al menu, sin decir que habia pasado ni por que.

   El calculo entero (umbral, estrellas, aprobacion) vive en el servidor y viaja ya
   resuelto — misma regla que el Area de Entrenamiento (decision 5.7): si el cliente
   decidiera si aprobaste, el progreso seria falsificable desde la consola. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResultadoCursoResponse {

    private String nivel;

    // null = ejercicio normal. TEST_NIVEL / TEST_FINAL cambian que umbral se evaluo.
    private String rolEnNivel;

    // Si este intento alcanzo el umbral del ejercicio (o el del test, segun el rol).
    private Boolean superado;

    /* De ESTE intento, en la escala 0 / 1 / 2 / 2.5 / 3. Es DECIMAL porque la escala
       tiene un peldano a mitad de camino entre dos y tres estrellas. La precision manda
       sobre la velocidad, igual que en TypingClub y typing.com. El detalle de cada
       peldano y su porque esta en calcularMediasEstrellas (CursoStatsServiceImpl).

       Se guarda en medias estrellas (un entero de 0 a 6) y se convierte solo al salir:
       comparar marcas con enteros es exacto, con decimales seria comparar coma flotante. */
    private BigDecimal estrellas;

    // El mejor puntaje que ya tenias en este nodo, para poder decir "subiste a 3".
    private BigDecimal estrellasPrevias;

    /* Lo que hacia falta. Sin esto el fracaso es mudo: el usuario ve "no completado" y
       no sabe si le falto 1 WPM o 20. */
    private Integer umbralWpm;
    private BigDecimal umbralPrecision;

    // Lo que lograste, tal como lo evaluo el servidor.
    private Integer wpm;
    private BigDecimal precision;

    // Primera vez que este nodo queda completado (no se repite al reintentarlo).
    private Boolean primeraVez;

    // Mejor WPM tuyo en este ejercicio, superado en este intento.
    private Boolean esRecordWpm;

    // Este intento aprobo el nivel entero (TEST_FINAL, o TEST_NIVEL saltandolo).
    private Boolean nivelAprobado;

    // Nivel que quedo abierto por aprobar este, o null.
    private String nivelDesbloqueado;

    // Avance del sendero DESPUES de este intento, para la barra de la pantalla final.
    private Integer nodosCompletados;
    private Integer nodosTotales;

    /* Cuantos nodos completados se quedaron en UNA estrella. El Test Final no aprueba el
       nivel mientras haya alguno: aprobar a duras penas cada ejercicio no puede sumar un
       nivel aprobado. Es tambien lo que impide farmear el quinto intento — pasar por ahi
       da una estrella, y una estrella hay que volver a levantarla antes del examen. */
    private Integer nodosPorMejorar;

    /* Este nodo es un JUEGO (hoy solo Lluvia de letras). La pantalla de resultados lo usa
       para esconder velocidad, precisión y el gráfico de progreso: en un juego donde se
       espera a que la letra baje, el WPM no mide destreza sino cuánto tardó en caer, y
       enseñarlo invita a leerlo como una nota. Viaja en el veredicto y no por una clave
       aparte de sessionStorage porque este objeto ya llega entero a esa pantalla. */
    private Boolean esJuego;
}
