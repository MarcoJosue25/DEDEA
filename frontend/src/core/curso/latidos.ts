/* La lógica de LATIDOS: qué pasa cuando termina cada tanda corta de un ejercicio de letras.

   Vive fuera de la vista y como funciones puras a propósito. CursoPracticaView ya tiene
   1.600 líneas y casos especiales para muerte súbita, modo ciego, contrarreloj, lluvia y
   palabras flotantes; meterle además una máquina de fases enterrada entre los refs lo
   volvería intocable. Acá la decisión se lee de corrido y se puede razonar sin abrir la
   vista.

   ⚠️ LOS TRES UMBRALES ESTÁN ESCRITOS DOS VECES: acá y en CursoStatsServiceImpl. El
   servidor es la autoridad —él decide si el nodo se aprueba y con cuántas estrellas—;
   estas copias solo deciden QUÉ LATIDO VIENE DESPUÉS, que es una decisión de navegación y
   tiene que tomarse sin ir y volver al servidor entre tanda y tanda. Si allá se
   recalibran, hay que traerlos acá. Es el mismo trato que ya tiene el panel de exigencia
   de los ejercicios con IA. */

export interface ResultadoLatido {
  wpm: number;
  precision: number;
}

/* Salir después del segundo latido. 35 WPM es casi el doble de los 18 con los que se
   aprueba Básico entero: no es una puerta para "el que va bien" sino para quien ya sabe
   teclear y está repasando lo básico. Un aprendiz normal hace los cuatro, y es
   intencional — la puerta es una salida de emergencia, no el camino habitual. */
export const SALTO_WPM = 35;
export const SALTO_PRECISION = 95;

// Para completar el nodo por el camino normal. Ver CursoStatsServiceImpl.
export const UMBRAL_WPM = 10;
export const UMBRAL_PRECISION = 85;

/* El quinto latido: solo precisión, sin exigencia de velocidad. Corrige justamente el
   error de ir demasiado rápido, así que pedir además WPM sería un castigo disfrazado de
   rescate. */
export const ULTIMO_INTENTO_PRECISION = 90;

// Nunca se sale antes del segundo: un solo latido bueno puede ser suerte.
export const LATIDOS_MINIMOS = 2;

export type DecisionLatido =
  | 'siguiente'        // quedan latidos por hacer
  | 'aprobado'         // el nodo se completa acá
  | 'ultimo-intento'   // se acabaron los latidos sin llegar al umbral: queda una bala
  | 'no-aprobado';     // ni el último intento alcanzó

/* El promedio que se manda al servidor: SIEMPRE los DOS ÚLTIMOS latidos.

   No es el promedio de todos, y el motivo es que los latidos son progresivamente más
   difíciles — el primero es 95% teclas nuevas y el último las mezcla todas. Promediar
   "los que hizo" castigaría dos veces a quien pelea: teclea más Y se le puntúa sobre
   material más duro, mientras que quien sale en dos promedia los dos más fáciles. Con los
   dos últimos, ambos se miden sobre dos tandas consecutivas y la comparación es justa. */
export const promediarUltimosDos = (resultados: ResultadoLatido[]): ResultadoLatido => {
  const ultimos = resultados.slice(-2);
  if (ultimos.length === 0) return { wpm: 0, precision: 0 };
  return {
    wpm: Math.round(ultimos.reduce((s, r) => s + r.wpm, 0) / ultimos.length),
    precision: Number(
      (ultimos.reduce((s, r) => s + r.precision, 0) / ultimos.length).toFixed(2),
    ),
  };
};

/* Qué hacer después de terminar un latido.

   `indice` es el que acaba de terminar (base 0) y `total` cuántos tiene el nodo — tres en
   "f j", que no tiene teclas anteriores con las que mezclar, y cuatro en el resto. */
export const decidirSiguiente = (
  resultados: ResultadoLatido[],
  indice: number,
  total: number,
  /* Falso en "un dedo": ahí cada tanda es un DEDO distinto, no una versión más difícil
     de la misma tanda, así que ir muy bien en los dos primeros no dice nada sobre los
     dos que faltan — saltar dejaría dedos enteros sin practicar. Verdadero por defecto
     para no romper a Fundamentos, que es donde el salto sí tiene sentido. */
  permiteSalto = true,
): DecisionLatido => {
  const recien = resultados[resultados.length - 1];
  if (!recien) return 'siguiente';

  const hechos = indice + 1;

  /* Salto: solo a partir del segundo, solo si el propio nodo lo permite, y solo con los
     DOS ÚLTIMOS latidos —cada uno POR SEPARADO, no su promedio— muy por encima del nivel.

     ⚠️ REESCRITO el 11-sep-2026. Hasta hoy solo miraba `recien` (el latido que acaba de
     terminar): un latido flojo seguido de uno excelente ya alcanzaba para saltar, y la
     nota que se manda al servidor es el promedio de los DOS últimos (`promediarUltimosDos`)
     — con el flojo adentro, ese promedio podía quedar por debajo del umbral de la segunda
     estrella. El usuario lo vio pasar: el nodo se saltaba (la señal de "ya sabés esto") y
     la pantalla decía "¡Aprobado! Repítelo y sube de nota" (una estrella) — la señal y el
     resultado se contradecían.

     Exigiendo que LOS DOS últimos, cada uno, superen el umbral —no solo el más reciente—
     un latido malo ya no se "tapa" con uno bueno: hace falta que el bueno se repita. Y de
     paso, si los dos superan el umbral por separado, su promedio también lo supera, así
     que cuando el salto SÍ dispara, la nota que llega al servidor ya viene calificando
     alto — deja de existir el salto que aprueba con una sola estrella. */
  const ultimosDos = resultados.slice(-2);
  const saltoValido = ultimosDos.length === 2
    && ultimosDos.every((r) => r.wpm >= SALTO_WPM && r.precision >= SALTO_PRECISION);
  if (permiteSalto && hechos >= LATIDOS_MINIMOS && hechos < total && saltoValido) {
    return 'aprobado';
  }

  if (hechos < total) return 'siguiente';

  // Se acabaron los latidos: decide el promedio de los dos últimos.
  const nota = promediarUltimosDos(resultados);
  return (nota.wpm >= UMBRAL_WPM && nota.precision >= UMBRAL_PRECISION)
    ? 'aprobado'
    : 'ultimo-intento';
};

// El quinto latido no se promedia con nada: lo decidió él solo.
export const decidirUltimoIntento = (resultado: ResultadoLatido): DecisionLatido =>
  resultado.precision >= ULTIMO_INTENTO_PRECISION ? 'aprobado' : 'no-aprobado';

/* La nota que viaja al servidor.

   En el camino normal es el promedio de los dos últimos latidos. En el quinto intento es
   ese latido y nada más: promediarlo con los cuatro fallos borraría justamente la mejora
   que se acaba de conseguir. */
export const notaFinal = (
  resultados: ResultadoLatido[],
  porUltimoIntento: boolean,
): ResultadoLatido => (
  porUltimoIntento && resultados.length > 0
    ? resultados[resultados.length - 1]
    : promediarUltimosDos(resultados)
);
