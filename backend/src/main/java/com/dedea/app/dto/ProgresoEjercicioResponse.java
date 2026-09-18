package com.dedea.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// Un nodo del sendero: el frontend decide solo si es completado/actual/bloqueado
// comparando esta lista contra la posición del usuario (el primer no-completado en orden
// es el actual; todo lo que sigue está bloqueado).
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProgresoEjercicioResponse {
    private Integer ejercicioId;
    private String titulo;
    /* De qué trata el ejercicio, en una línea. El sendero son nodos redondos sin texto:
       sin esto no hay forma de saber qué es cada uno sin entrar. Sale de la misma columna
       que ya escribe el sembrado (crearEnCursoSiNoExiste), así que no hay dato nuevo que
       mantener. */
    private String descripcion;
    private Integer bloque;
    private Integer orden;
    private Boolean completado;

    /* Tipo del ejercicio: el sendero lo usa para pintar un icono distinto por mecanica
       (teclado, cronometro, calavera, microfono...). Antes todos los nodos eran el mismo
       circulo con el mismo icono, asi que un dictado y una muerte subita se veian igual. */
    private String tipo;

    /* TEST_NIVEL / TEST_FINAL / null. Los dos nodos de control son los unicos que pueden
       aprobar un nivel entero: el sendero los dibuja distinto (mas grandes, con marco)
       para que se vea que ahi se juega algo. */
    private String rolEnNivel;

    /* Estrellas ya conseguidas, en la escala 0 / 1 / 2 / 2.5 / 3, y las marcas
       personales. Null en un nodo que todavia no se completo, y tambien en los
       completados antes del 2-sep-2026. */
    private java.math.BigDecimal estrellas;
    private Integer mejorWpm;
    private java.math.BigDecimal mejorPrecision;

    /* Completado, pero sin las 2 estrellas que pide el Test Final. Es la MISMA regla que
       bloquea el examen (CursoStatsServiceImpl.estaPorMejorar), calculada aquí para que el
       front no tenga que reescribir el umbral: si algún día la escala pasa a 5 estrellas,
       la barra roja de resultados y el candado del Test Final siguen diciendo la verdad sin
       tocarlos. Nunca true en la Lluvia, que es un juego de relajo. */
    private Boolean porMejorar;
}
