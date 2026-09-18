package com.dedea.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/* Un LATIDO: una de las tandas cortas en las que se parte un ejercicio de letras del Curso.

   Existe porque un nodo de Fundamentos era una sola tanda de ~110 caracteres, igual para
   todos. Medido contra TypingClub, sus lecciones son de ~31 caracteres: piezas 3,5 veces
   mas chicas, o sea muchisimos mas momentos de "lo consegui" con la misma practica total.

   La respuesta trae los latidos YA GENERADOS, todos de una: el nodo es una sola sesion y
   una sola peticion. Pedirlos de a uno significaria cuatro viajes al servidor en mitad de
   un ejercicio, con el usuario esperando entre tanda y tanda. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LatidoResponse {

    // "Aprende", "Combina", "Mezcla", "Prueba". Se muestra como rotulo de la fase.
    private String nombre;

    // Una linea sobre que cambia en este latido, para el rotulo.
    private String descripcion;

    private String texto;

    /* Que porcentaje de las letras sale de las teclas NUEVAS del nodo. Viaja solo para
       poder verlo en la interfaz de calibracion; la interfaz no lo usa para nada mas. */
    private Integer dominancia;

    /* El quinto latido no se manda con los otros cuatro: solo aparece si el usuario falla,
       y por eso llega en su propia peticion. Esta bandera lo distingue — es el que se
       juzga solo por precision, sin exigencia de velocidad. */
    @Builder.Default
    private Boolean ultimoIntento = false;
}
