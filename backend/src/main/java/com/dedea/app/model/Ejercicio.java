package com.dedea.app.model;

import com.dedea.app.model.enums.NivelCurso;
import com.dedea.app.model.enums.RolEjercicioNivel;
import com.dedea.app.model.enums.TipoEjercicio;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

// Catálogo de la sección "Curso". La columna configuracion guarda un JSON en texto plano
// (sin tipo JSON nativo en el resto del proyecto, así que seguimos la misma convención):
// cada tipo de ejercicio lo interpreta a su manera en EjercicioService.
@Entity
@Table(name = "ejercicios")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Ejercicio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 150)
    private String titulo;

    @Column(length = 300)
    private String descripcion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TipoEjercicio tipo;

    @Column(columnDefinition = "TEXT")
    private String configuracion;

    @Column(nullable = false)
    @Builder.Default
    private Integer orden = 0;

    @Column(nullable = false)
    @Builder.Default
    private Boolean activo = true;

    /* Nivel y bloque del futuro Curso por niveles. Nullable a propósito: los 14
       ejercicios de "Ejercicios Base" no tienen nivel todavía — siguen listándose ahí
       (listarActivos no filtra por nivel) hasta que se decida su posición. Un ejercicio
       con nivel asignado es el que cuenta para la analítica y el umbral de avance de
       ProgresoCursoNivel. */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private NivelCurso nivel;

    private Integer bloque;

    /* Umbral propio para desbloquear el SIGUIENTE ejercicio de la secuencia. Nullable:
       sin config específica, se usa el default del nivel (la mitad del umbral de
       aprobar el nivel — ver CursoStatsServiceImpl). No es lo mismo que el umbral de
       TEST_FINAL, que siempre es el umbral completo de aprobar el nivel. */
    private Integer umbralWpmPropio;
    private BigDecimal umbralPrecisionPropia;

    /* null = ejercicio normal. TEST_NIVEL/TEST_FINAL cambian qué umbral se evalúa y qué
       pasa al aprobarlo — ver RolEjercicioNivel y CursoStatsServiceImpl.registrarProgresoEjercicio. */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private RolEjercicioNivel rolEnNivel;
}
