package com.dedea.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NoticiaDTO {
    private Integer id;
    private String titulo;
    private String contenidoCompleto;
    private String contenidoResumido;
    private String categoria;
    private String fuente;
    private String dificultad; // facil, medio, dificil
    private LocalDate fechaPublicacion;
    /* Portada del artículo. Puede llegar null: no todos los artículos de GNews traen
       imagen, y las noticias guardadas antes de agregar este campo tampoco la tienen.
       La tarjeta del panel debe dibujarse sin foto en ese caso. */
    private String imagenUrl;
}