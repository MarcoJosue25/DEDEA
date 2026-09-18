package com.dedea.app.model;

import com.dedea.app.model.enums.Idioma;
import jakarta.persistence.*;
import lombok.*;
import com.dedea.app.model.enums.Dificultad;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "noticias")
@Data //Anotación que genera de golpe los getter, setter, tostring, EqualsAndHashCode y RequiredArgsConstructor
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Noticia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 300)
    private String titulo;

    @Column(name = "contenido_completo", nullable = false, columnDefinition = "TEXT")
    /*columndefinition = text. Si no lo hubieramos puesto por
    defecto sería varchar(max 255) y explotaría con una noticia larga*/
    private String contenidoCompleto;

    @Column(name = "contenido_resumido", columnDefinition = "TEXT")
    private String contenidoResumido;

    @Column(length = 100)
    private String categoria;

    @Enumerated(EnumType.STRING)
    //Configuras que se guarda el valor dado en formato String en lugar de un int
    @Column(nullable = false)
    @Builder.Default
    private Idioma idioma = Idioma.es;

    @Column(name = "longitud_palabras")
    private Integer longitudPalabras;

    @Column(length = 200)
    private String fuente;

    @Enumerated(EnumType.STRING)
    private Dificultad dificultad;

    @Column(name = "fecha_publicacion")
    private LocalDate fechaPublicacion;

    @Column(name = "fecha_guardado", nullable = false, updatable = false)
    //updatable false = No permite que la fecha de guardado sea editable por futuras modificaciones,
    // ya que ante cualquier modificacion esta columna es ignorada y se queda como está (Muy valioso)
    @Builder.Default
    private LocalDateTime fechaGuardado = LocalDateTime.now();

    @Column(nullable = false)
    @Builder.Default
    private boolean activo = true;

    @Column(nullable = false)
    @Builder.Default
    private boolean limpio = false;

    @Column(unique = true, length = 500)
    private String url;

    /* Portada del artículo, tal como la entrega GNews en su campo "image".
       Es opcional: hay artículos que llegan sin imagen, y la tarjeta del panel debe
       dibujarse igual (sin foto) cuando esto viene en null. */
    @Column(name = "imagen_url", length = 500)
    private String imagenUrl;

    /* El texto scrapeado tal como se lo mandamos a Gemini, SOLO PARA CALIBRACIÓN.

       Existe porque los umbrales del clasificador de artículos se fijaron razonando y no
       midiendo, y sin el texto original cada idea nueva de métrica exigía esperar una tanda
       entera para probarla. Guardándolo se puede reanalizar lo ya scrapeado sin gastar una
       sola llamada a Gemini.

       ⚠️ NO es contenido del producto: no se sirve al frontend ni se muestra a nadie. Se
       borra solo a los DIAS_RETENCION_ARTICULO días (ver limpiarArticulosViejos), y cuando
       la calibración termine hay que sacar la columna. */
    @Column(name = "articulo_scrapeado", columnDefinition = "MEDIUMTEXT")
    private String articuloScrapeado;
}