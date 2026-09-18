package com.dedea.app.dto;

import java.time.LocalDate;
import java.util.List;

/* Una sesión pasada convertida en rival para correr contra ella.

   Solo aplica a Noticias y a textos de IA: son los dos modos donde se teclea un texto
   largo y donde tiene sentido medirse contra una marca propia. Curso y el Área de
   Entrenamiento quedan fuera a propósito — ahí el contenido se genera distinto en cada
   vuelta y ya tienen su propio modo sombra por ejercicio.

   El fantasma va a RITMO CONSTANTE, derivado de `wpm`: no reproduce las pausas y tirones
   del intento original. Es una decisión deliberada — la reproducción exacta necesita los
   eventos tecla a tecla, que solo existen en las sesiones guardadas desde el 8 de agosto
   de 2026, y dejaría el reto muerto en casi todo el historial. Con el ritmo constante
   funciona cualquier sesión.

   `texto` se reconstruye desde la noticia o el texto de IA que se practicó: en estos dos
   modos no se guarda copia en la sesión (a diferencia de Curso). Si el artículo se borró,
   viene null y el front lo trata como rival no disponible. */
public record RivalSesionResponse(
        Integer sesionId,
        Integer wpm,
        Integer segundos,
        String texto,
        String modo,
        LocalDate fecha,
        Integer noticiaId,
        Integer textoIaId,

        /* El recorrido segundo a segundo del rival, para dibujarlo detrás del tuyo al
           terminar. Es lo que convierte "perdiste por 4 WPM" en "lo tenías hasta el
           segundo 12". Viene vacío en sesiones anteriores a que se guardara el progreso. */
        List<SesionProgresoDTO> progreso
) {
}
