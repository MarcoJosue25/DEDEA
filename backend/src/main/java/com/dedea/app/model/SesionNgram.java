package com.dedea.app.model;

import com.dedea.app.model.enums.TipoNgram;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "sesion_ngrams")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SesionNgram {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sesion_id", nullable = false)
    private Sesion sesion;

    /* COLACIÓN SENSIBLE A TILDES, en la COLUMNA.

       `utf8mb4_0900_as_ci` distingue tildes pero no mayúsculas. Sin esto la columna nace
       `ai_ci` —accent-insensitive— y para MySQL `ñ` = `n` y `á` = `a`: un GROUP BY las suma
       juntas. Fue un bug real: la Ñ aparecía "sin datos" en el mapa de calor con 213
       pulsaciones registradas, porque se sumaban a la N.

       Hasta el 31-ago-2026 esto se resolvía escribiendo `COLLATE utf8mb4_0900_as_ci` dentro
       de cada consulta. Funcionaba, pero convivían dos estrategias para el mismo problema —
       las tablas del diccionario ya lo tenían en la columna— y eso era una trampa: quien
       viera el COLLATE en la consulta podía creerlo redundante, borrarlo, y hacer volver el
       bug en silencio. Ahora está en un solo lugar.

       ⚠️ Hibernate NO cambia colaciones de columnas existentes aunque ddl-auto sea `update`:
       para las bases que ya existían hizo falta un ALTER TABLE a mano. Esto sirve para que
       una base nueva nazca bien. */
    @Column(nullable = false, length = 10,
            columnDefinition = "VARCHAR(10) COLLATE utf8mb4_0900_as_ci")
    //Guarda los grupos de letras que el usuario intentó teclear
    private String secuencia;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoNgram tipo;

    //name indica que asi está escrita la tabla en la DB
    @Column(name = "total_intentos", nullable = false)
    @Builder.Default
    private Integer totalIntentos = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer errores = 0;

    @Column(name = "tiempo_total_ms")
    private Long tiempoTotalMs; // Usamos Long porque los milisegundos acumulados pueden ser muchos
}

