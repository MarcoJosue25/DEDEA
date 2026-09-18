package com.dedea.app.model;

import com.dedea.app.model.enums.TipoNgram;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "diccionario_ngrams", indexes = {
        /* La busqueda de palabras filtra por ngram exacto. Sin este indice, cada consulta
           recorre la tabla entera — 81.793 filas hoy, mas de medio millon con 50.000
           palabras, y la pantalla de practica dispara varias consultas a la vez. */
        @Index(name = "idx_ngram", columnList = "ngram")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class DiccionarioNgram {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    // RELACIÓN: Le dice a Hibernate que muchos ngrams pertenecen a una sola palabra
    // @Lazy ahorra mucha memoria y evita el colapso en consultas encadenadas innecesarias
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "diccionario_id", nullable = false)
    //@JoinColumn es el equivalente a la llave Foranea
    private Diccionario diccionario;

    /* COLACIÓN SENSIBLE A TILDES, y no es un detalle.

       La colación por defecto de estas tablas es utf8mb4_0900_ai_ci — accent-insensitive —
       y con ella MySQL responde que 'a' = 'á' es VERDADERO. Medido. En una app cuyo primer
       eje de dificultad son justamente las tildes, eso significa que pedir practicar 'á'
       devolvía palabras con 'a' pelada, y que 'de' y 'dé' eran la misma palabra: en el
       archivo semilla hay 247 grupos que colisionan así (de/dé, el/él, si/sí, tu/tú,
       como/cómo), y por eso 267 palabras se perdieron en silencio al sembrar.

       Se pone en la columna y no en la consulta a propósito: un COLLATE aplicado sobre la
       columna dentro del WHERE inutiliza el índice, igual que envolverla en una función. */
    @Column(nullable = false, length = 5,
            columnDefinition = "VARCHAR(5) COLLATE utf8mb4_0900_as_ci")
    private String ngram; // Ej: "tr", "cas"

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private TipoNgram tipo; // "bigrama" o "trigrama"
}
