package com.dedea.app.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "sesion_progreso")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SesionProgreso {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sesion_id", nullable = false)
    private Sesion sesion;

    @Column(nullable = false)
    private Integer segundo;

    @Column(name = "wpm_momento", nullable = false)
    private Integer wpmMomento;

    // Aseguramos precisión 5 y escala 2 (ej: 100.00)
    @Column(name = "precision_momento", nullable = false, precision = 5, scale = 2)
    private BigDecimal precisionMomento;
}

