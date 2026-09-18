package com.dedea.app.model;

import com.dedea.app.model.enums.NivelCurso;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

// Progreso del futuro Curso por niveles. Completamente separado de las estadísticas
// globales (StatsService/StatsController, que solo miden Noticias + IA): esta tabla y
// sus queries nunca se tocan entre sí. Una fila por (usuario, nivel).
@Entity
@Table(name = "progreso_curso_nivel",
        uniqueConstraints = @UniqueConstraint(columnNames = {"identificador_temporal", "nivel"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProgresoCursoNivel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "identificador_temporal", nullable = false, length = 36)
    private String identificadorTemporal;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private NivelCurso nivel;

    // Básico arranca desbloqueado; Intermedio y Avanzado se desbloquean al aprobar el
    // nivel anterior (CursoStatsServiceImpl.evaluarAprobacionNivel).
    @Column(nullable = false)
    @Builder.Default
    private Boolean desbloqueado = false;

    @Column(nullable = false)
    @Builder.Default
    private Boolean aprobado = false;

    private LocalDateTime fechaAprobado;

    @Column(name = "actualizado_en")
    private LocalDateTime actualizadoEn;

    @PrePersist
    @PreUpdate
    protected void alGuardar() {
        actualizadoEn = LocalDateTime.now();
    }
}
