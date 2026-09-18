package com.dedea.app.model;

import com.dedea.app.model.enums.Dificultad;
import com.dedea.app.model.enums.ModoUsado;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "sesiones")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Sesion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "usuario_id")
    private Integer usuarioId;

    @Column(name = "identificador_temporal", length = 100)
    private String identificadorTemporal;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "noticia_id")
    private Noticia noticia;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "texto_ia_id")
    private TextoIa textoIa;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ejercicio_id")
    private Ejercicio ejercicio;

    // El texto EXACTO que se mostró en esta sesión (solo se llena en modoUsado=CURSO).
    // Necesario para "modo sombra": sin esto no hay forma de volver a mostrar lo mismo,
    // ya que el contenido normalmente se genera al azar en cada intento.
    @Column(name = "texto_generado", columnDefinition = "TEXT")
    private String textoGenerado;

    @Column(nullable = false)
    private Integer wpm;

    // CAMBIO CRÍTICO: Double -> BigDecimal para coincidir con DECIMAL(5 ,2 )
    // 5 números en total contando decimales, 2 decimales = máximo 100.00
    @Column(name = "precision_stats", nullable = false, precision = 5, scale = 2)
    private BigDecimal precision;

    @Column(name = "duracion_segundos", nullable = false)
    private Integer segundos;

    @Enumerated(EnumType.STRING)
    @Column(name = "modo_usado", nullable = false)
    private ModoUsado modoUsado;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Dificultad dificultad;

    @Column(name = "fecha_guardado", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime fechaGuardado = LocalDateTime.now();
}