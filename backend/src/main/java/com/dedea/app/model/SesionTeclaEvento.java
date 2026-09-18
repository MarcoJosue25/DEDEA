package com.dedea.app.model;

import jakarta.persistence.*;
import lombok.*;

// Log tecla-por-tecla con milisegundo exacto: la base de "modo sombra". A diferencia de
// SesionTecla (conteos agregados por tecla), acá cada fila es UNA pulsación en el orden en
// que ocurrió, para poder reproducir el ritmo exacto de una sesión pasada como fantasma.
// Solo se llena en sesiones modoUsado=CURSO, no en Noticias/IA/Palabras.
@Entity
@Table(name = "sesion_teclas_eventos")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SesionTeclaEvento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sesion_id", nullable = false)
    private Sesion sesion;

    /* Misma colación que `sesion_teclas.tecla`, y por el mismo motivo: `as_ci` distingue
       tildes, así que la ñ y las vocales acentuadas se agrupan aparte en el análisis de
       ritmo. Ver la nota larga en SesionTeclaRepository. */
    @Column(nullable = false, length = 20,
            columnDefinition = "VARCHAR(20) COLLATE utf8mb4_0900_as_ci")
    private String tecla;

    @Column(name = "orden_secuencia", nullable = false)
    private Integer ordenSecuencia;

    @Column(name = "tiempo_desde_inicio_ms", nullable = false)
    private Long tiempoDesdeInicioMs;

    // Posición en el texto INMEDIATAMENTE DESPUÉS de esta tecla (0..largo del texto).
    // Sin esto, reconstruir dónde iba el fantasma en un instante dado obligaría a
    // replayear tecla por tecla adivinando backspaces; con esto es una lectura directa.
    @Column(name = "indice_resultante", nullable = false)
    private Integer indiceResultante;

    @Column(nullable = false)
    private Boolean correcta;
}
