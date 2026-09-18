package com.dedea.app.model;

import com.dedea.app.model.enums.Dificultad;
import com.dedea.app.model.enums.Idioma;
import jakarta.annotation.Nullable;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "textos_ia")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TextoIa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String contenido;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Dificultad dificultad;

    // Este es el campo clave para nuestro "Reciclaje Inteligente" (ej: "ca,tr")
    @Column(name = "teclas_base", length = 100)
    private String teclasBase;

    @Column(name = "fecha_generacion", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime fechaGeneracion = LocalDateTime.now();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Idioma idioma = Idioma.es;
}