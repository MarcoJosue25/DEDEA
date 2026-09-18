/* ===== DESARROLLO — REVERTIR ANTES DE PUBLICAR =====

   Interruptores que existen solo para poder revisar la app a mano. Ninguno debe llegar a
   producción. Viven todos acá, y no repartidos por las vistas, porque revertirlos tiene
   que ser cambiar un valor y no salir a buscar dónde estaban.

   Ver CLAUDE.md 10.15.1 y el bug 14 de la sección 11. */

/* Desbloquea el Curso entero: los tres niveles del selector, la pantalla de cualquier
   nivel y todos los nodos del sendero.

   Existe porque el Curso nunca se recorrió de punta a punta en el navegador (es la
   verificación pendiente más importante de la sección 11), y con el desbloqueo secuencial
   real hay que aprobar 29 ejercicios de Básico antes de poder mirar el primero de
   Intermedio. Con esto se puede entrar a cualquier nodo y ver si su generador devuelve
   contenido de verdad.

   OJO CON LO QUE ESTE INTERRUPTOR NO HACE: no toca el backend. El progreso se sigue
   guardando igual, `completado` se sigue marcando por umbral y el Test de Nivel sigue
   aprobando el nivel entero. O sea que lo que se ve al navegar es real; lo único falso es
   que se pueda llegar. Por eso NO sirve para verificar el desbloqueo en sí — para probar
   que un nodo se desbloquea al aprobar el anterior hay que poner esto en false.

   PRODUCCIÓN: false. */
export const DESBLOQUEAR_TODO_EL_CURSO = true;

/* Las flechas ← y → saltan al ejercicio anterior/siguiente DENTRO del nivel, sin volver al
   sendero. Solo en /curso/:nivel/:id — en Ejercicios Base no hay secuencia que recorrer.

   Existe para poder recorrer los 29 nodos de Básico, los 32 de Intermedio y los 27 de
   Avanzado de corrido y ver que cada generador devuelva contenido de verdad. Con el flujo
   normal hay que volver al menú entre uno y otro, que son tres clics por ejercicio.

   NO pregunta antes de cambiar aunque ya hayas escrito, al revés que las flechas de
   Noticias. Es deliberado: acá se viene a mirar contenido, no a hacer una marca, y una
   confirmación en el medio arruina justo la fluidez que motiva el interruptor. No se pierde
   ningún dato — la sesión se guarda al terminar el ejercicio, así que abandonarlo a la mitad
   no escribe nada.

   No cruza de nivel: al final de Básico se queda ahí. Recorrer los tres es entrar una vez a
   cada uno.

   PRODUCCIÓN: false. */
export const NAVEGAR_CURSO_CON_FLECHAS = true;

/* (Hubo un tercero, PROBAR_CAIDA_LLUVIA: un selector para comparar dos curvas de caída de la
   Lluvia. Se retiró el 10-sep-2026 cuando el usuario eligió la curva —2,8 s y 0,5%— y quedó
   escrita a fuego en VistaLluviaLetras. Ver CLAUDE.md 6.13, punto 8.) */
