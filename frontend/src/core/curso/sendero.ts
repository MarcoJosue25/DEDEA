import type { ProgresoEjercicioResponse } from '../../types';

/* ¿YA SE LLEGÓ AL TEST FINAL? Todos los ejercicios del sendero hechos, menos el examen.

   Es el ÚNICO momento en que se habla de las estrellas que faltan (pedido del usuario,
   10-sep-2026). Antes el aviso salía en cuanto un ejercicio se quedaba con una estrella, a
   veinte nodos del examen, y se leía como el bloqueo de algo que todavía no tocaba. Con el
   avance de uno en uno, "llegar" es exactamente esto. Lo usan el aviso del sendero y el de
   Resultados, el candado del Test Final y la ventana que lo explica.

   Sin Test Final en el nivel (Intermedio y Avanzado todavía no lo tienen) no hay adónde
   llegar, y el aviso no sale nunca. */
export const llegoAlTestFinal = (nodos: ProgresoEjercicioResponse[]): boolean =>
  nodos.some((n) => n.rolEnNivel === 'TEST_FINAL')
  && nodos.every((n) => n.rolEnNivel === 'TEST_FINAL' || n.completado);

/* El color de un ejercicio al que le falta su segunda estrella: el dorado de las estrellas.
   Empezó en rojo y el usuario lo cambió —"el rojo resalta mucho"—, con razón: el rojo es el
   color del ERROR en toda la app, y un ejercicio de una estrella está aprobado. En la
   apariencia clara, un ámbar más oscuro: el dorado sobre blanco casi no se ve. */
export const colorPorMejorar = (esOscuro: boolean): string =>
  (esOscuro ? 'var(--color-oro)' : '#D97706');
