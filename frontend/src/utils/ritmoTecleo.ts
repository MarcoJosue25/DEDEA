/* Cuánto tardó una tecla desde la pulsación anterior.

   El campo `tiempoTotalMs` existía en la base de datos desde el principio pero siempre se
   guardaba en 0, así que el tiempo por tecla nunca se pudo calcular. Esto lo llena.

   Los deltas absurdos se descartan en lugar de sumarse:
   - La primera pulsación no tiene referencia previa (anterior === 0).
   - Una pausa larga —te levantaste, cambiaste de pestaña, leíste el texto— no dice nada
     sobre lo que cuesta esa tecla, pero bastaría una sola para coronarla como "la más
     lenta" en el promedio.

   El techo coincide con el de la consulta de teclas lentas del backend, que filtra los
   deltas entre 20 y 3000 ms. */
export const DELTA_MAX_MS = 3000;

export const calcularDelta = (ahora: number, anterior: number): number => {
  if (anterior === 0) return 0;
  const delta = Math.round(ahora - anterior);
  return delta > 0 && delta <= DELTA_MAX_MS ? delta : 0;
};
