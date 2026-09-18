package com.dedea.app.model;

import com.dedea.app.model.enums.Dificultad;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

// Un audio real subido por el administrador para el ejercicio de Dictado (modo "archivo").
// El texto nunca se muestra en pantalla: solo se usa para validar lo que el usuario escribe
// mientras escucha. La velocidad de reproducción se ajusta en el navegador (no se re-graba
// el archivo por cada velocidad).
@Entity
@Table(name = "dictado_audios")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DictadoAudio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 150)
    private String titulo;

    @Column(name = "texto_transcripcion", nullable = false, columnDefinition = "TEXT")
    private String textoTranscripcion;

    // Ruta relativa dentro de la carpeta de subidas (ver AppConfig / DictadoController).
    @Column(name = "archivo_url", nullable = false, length = 300)
    private String archivoUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Dificultad dificultad = Dificultad.MEDIO;

    @Column(name = "fecha_subida", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime fechaSubida = LocalDateTime.now();
}
