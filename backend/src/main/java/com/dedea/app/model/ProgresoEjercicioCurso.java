package com.dedea.app.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

// Progreso por EJERCICIO puntual dentro de un nivel del Curso — distinto de
// ProgresoCursoNivel, que es por nivel entero. Sin esto, el sendero no puede pintar qué
// nodo ya se completó, cuál es el actual, y cuáles siguen bloqueados. Una fila por
// (usuario, ejercicio).
@Entity
@Table(name = "progreso_ejercicio_curso",
        uniqueConstraints = @UniqueConstraint(columnNames = {"identificador_temporal", "ejercicio_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProgresoEjercicioCurso {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "identificador_temporal", nullable = false, length = 36)
    private String identificadorTemporal;

    @Column(name = "ejercicio_id", nullable = false)
    private Integer ejercicioId;

    @Column(nullable = false)
    @Builder.Default
    private Boolean completado = false;

    private Integer mejorWpm;
    private java.math.BigDecimal mejorPrecision;
    private LocalDateTime fechaCompletado;

    /* Mejor puntaje historico de este nodo, EN MEDIAS ESTRELLAS: 0 a 6, donde 6 = tres
       estrellas y 5 = dos y media.

       Se guardan medias y no estrellas enteras porque la escala tiene un peldano a mitad
       de camino (ver calcularMediasEstrellas en CursoStatsServiceImpl), y un entero de
       medias es exacto — un decimal obligaria a confiar en la comparacion de coma
       flotante para decidir si una marca supera a otra. El nombre dice la unidad a
       proposito: una columna llamada `estrellas` que guardara 6 para tres estrellas es
       justo la clase de rotulo que miente.

       Se guarda el MAXIMO alcanzado, no el del ultimo intento: repetir un ejercicio para
       practicar no puede borrar una marca ya conseguida — misma regla que mejorWpm.
       Nullable a proposito: las filas escritas antes del 2-sep-2026 no lo tienen, y el
       sendero las trata como "completado sin estrellas registradas". */
    private Integer mediasEstrellas;

    @Column(name = "actualizado_en")
    private LocalDateTime actualizadoEn;

    @PrePersist
    @PreUpdate
    protected void alGuardar() {
        actualizadoEn = LocalDateTime.now();
    }
}
