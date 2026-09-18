/* Geometría del sendero del Curso.

   Vive en su propio módulo y no dentro de NodoSendero porque el conector entre nodos se
   dibuja desde la posición del nodo ANTERIOR, así que la vista que arma la lista también
   necesita la fórmula. Un archivo de componente que exporta además constantes rompe
   `react-refresh/only-export-components`, que en este repo es error y no aviso. */

/* ALTURA FIJA DE FILA. No es un número estético: el conector es una línea recta trazada
   de un centro al siguiente, y para saber dónde cae el centro anterior sin medir el DOM
   la distancia tiene que ser constante. Por eso el título del nodo va con line-clamp y la
   fila no crece — un nodo con descripción larga desalinearía todas las líneas de abajo. */
export const ALTO_FILA = 96;

/* Amplitud de la serpiente. Bajó de 84 a 56 px: con 84 el tramo entre dos nodos quedaba
   casi horizontal y la línea que ahora los une parecía un zigzag, no un camino. */
const AMPLITUD = 56;

export const offsetSerpiente = (indice: number) => Math.sin(indice * 0.9) * AMPLITUD;

// Ancho del carril que contiene el círculo. Tiene que superar 2 x AMPLITUD + diámetro.
export const ANCHO_CARRIL = 190;
