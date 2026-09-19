package com.dedea.app.dto;

import java.util.List;
import java.util.Map;

/* Lo que recibe la pantalla de práctica al abrir un ejercicio del Curso. "texto" trae el
   contenido ya generado (letras/palabras/oraciones separadas por espacio, igual que en
   PracticaLibreView); "configuracion" pasa tal cual el JSON de Ejercicio.configuracion
   para que el frontend lea parámetros propios del tipo (ej. tiempo del contrarreloj).
   fantasmaEventos/fantasmaWpm solo vienen cuando se pidió ?fantasma={sesionId}: en ese
   caso "texto" NO se genera al azar, es el texto_generado exacto de esa sesión pasada.

   `latidos` y `teclasTutorial` solo vienen en los ejercicios de letras del Curso, que se
   practican en tandas cortas encadenadas en vez de en una sola pasada larga. Cuando son
   null, el ejercicio es de una pasada y `texto` es todo lo que hay — que es el caso de
   todo lo demás del catálogo. */
public record EjercicioContenidoResponse(
        Integer id,
        String titulo,
        String tipo,
        String texto,
        Map<String, Object> configuracion,
        List<TeclaEventoDTO> fantasmaEventos,
        Integer fantasmaWpm,
        List<LatidoResponse> latidos,
        /* Lo que hay que teclear en el tutorial, en orden. En los nodos de Fundamentos son
           TECLAS —las nuevas del nodo, al azar: para "d k" salen d k k d j…— y en los nodos
           de palabras son PALABRAS enteras. El componente no distingue: teclea cada ítem
           carácter a carácter y avanza al terminarlo, y una tecla suelta es el caso de un
           ítem de un solo carácter. */
        List<String> teclasTutorial,
        /* El rótulo del tutorial. Null = el genérico ("Pulsa estas diez teclas..."). Lo usan
           los nodos de palabras, donde el tutorial no presenta una tecla nueva sino un salto
           de otra clase: "Es hora de teclear tus primeras palabras". Viaja desde la
           configuración sembrada porque es CONTENIDO, y el contenido del Curso vive en el
           backend igual que los bancos de oraciones. */
        String mensajeTutorial,
        /* Una leyenda por ítem de teclasTutorial (mismo orden, mismo largo) — hoy solo la
           trae "Fila de números", para decir qué dedo va en cada dígito. Casi ningún
           tutorial la necesita (la tecla ya se explica sola), así que va null salvo que el
           ejercicio la traiga en su configuración, igual que mensajeTutorial. */
        List<String> captionsTutorial,
        /* Solo con `latidos`: lo que el nodo pide para aprobarse y lo que pide su quinto
           latido. Ver UmbralesLatidoResponse. */
        UmbralesLatidoResponse umbralesLatido
) {
    /* Constructor corto para todo lo que no tiene latidos, que es la mayoría del catálogo.
       Existe para no tener que escribir cinco null al final en cada sitio de construcción —
       y sobre todo para que agregar un campo más adelante no obligue a tocarlos todos. */
    public EjercicioContenidoResponse(Integer id, String titulo, String tipo, String texto,
                                      Map<String, Object> configuracion,
                                      List<TeclaEventoDTO> fantasmaEventos, Integer fantasmaWpm) {
        this(id, titulo, tipo, texto, configuracion, fantasmaEventos, fantasmaWpm, null, null, null, null, null);
    }

    /* El de los nodos con latidos, que traen tutorial de teclas, ningún rótulo propio y los
       umbrales con que se decide entre tanda y tanda. */
    public EjercicioContenidoResponse(Integer id, String titulo, String tipo, String texto,
                                      Map<String, Object> configuracion,
                                      List<TeclaEventoDTO> fantasmaEventos, Integer fantasmaWpm,
                                      List<LatidoResponse> latidos, List<String> teclasTutorial,
                                      UmbralesLatidoResponse umbralesLatido) {
        this(id, titulo, tipo, texto, configuracion, fantasmaEventos, fantasmaWpm,
                latidos, teclasTutorial, null, null, umbralesLatido);
    }
}
