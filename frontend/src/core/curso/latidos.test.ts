import { describe, expect, it } from 'vitest';
import type { UmbralesLatido } from '../../types';
import {
  decidirSiguiente, decidirUltimoIntento, notaFinal, promediarUltimosDos,
  SALTO_PRECISION, SALTO_WPM, type ResultadoLatido,
} from './latidos';

// Los que manda el servidor para un nodo de Básico sin umbral propio.
const UMBRALES: UmbralesLatido = { wpm: 10, precision: 85, ultimoIntentoPrecision: 90 };

const flojo: ResultadoLatido = { wpm: 20, precision: 80 };
const excelente: ResultadoLatido = { wpm: SALTO_WPM + 5, precision: SALTO_PRECISION + 2 };
const aprobado: ResultadoLatido = { wpm: UMBRALES.wpm + 2, precision: UMBRALES.precision + 3 };

describe('decidirSiguiente: el salto de latidos', () => {
  /* El bug del 11-sep-2026 (CLAUDE.md 6.20): un latido flojo seguido de uno excelente
     saltaba el resto del nodo, pero la nota que viaja al servidor es el promedio de los
     dos últimos — con el flojo adentro daba una estrella. El salto decía "ya sabés esto"
     y la pantalla decía "repítelo". */
  it('no salta con un latido flojo seguido de uno excelente', () => {
    expect(decidirSiguiente([flojo, excelente], 1, 4, UMBRALES)).toBe('siguiente');
  });

  it('salta cuando los DOS últimos superan el umbral, cada uno por separado', () => {
    expect(decidirSiguiente([flojo, excelente, excelente], 2, 4, UMBRALES)).toBe('aprobado');
  });

  it('nunca salta en el primer latido, por bueno que sea', () => {
    expect(decidirSiguiente([excelente], 0, 4, UMBRALES)).toBe('siguiente');
  });

  it('en "un dedo" no salta nunca: cada tanda es un dedo distinto', () => {
    expect(decidirSiguiente([excelente, excelente], 1, 4, UMBRALES, false)).toBe('siguiente');
    expect(decidirSiguiente([excelente, excelente, excelente], 2, 4, UMBRALES, false)).toBe('siguiente');
  });

  it('un promedio alto no alcanza si uno de los dos queda por debajo', () => {
    // Promedian 99% de precisión, pero el primero no llega a SALTO_PRECISION.
    const casi: ResultadoLatido = { wpm: SALTO_WPM + 10, precision: SALTO_PRECISION - 1 };
    const perfecto: ResultadoLatido = { wpm: SALTO_WPM + 10, precision: 100 };
    expect(decidirSiguiente([casi, perfecto], 1, 4, UMBRALES)).toBe('siguiente');
  });

  /* La garantía de fondo del arreglo, probada sobre muchas secuencias y no sobre un solo
     ejemplo: SIEMPRE que el salto dispara, la nota que se manda al servidor ya califica
     para la segunda estrella. Semilla fija para que el test no sea aleatorio. */
  it('cada vez que salta, la nota enviada supera el umbral de precisión del salto', () => {
    let semilla = 20260918;
    const azar = () => {
      semilla = (semilla * 1103515245 + 12345) % 2 ** 31;
      return semilla / 2 ** 31;
    };
    const latidoAlAzar = (): ResultadoLatido => ({
      wpm: Math.round(5 + azar() * 60),
      precision: Number((60 + azar() * 40).toFixed(2)),
    });

    let saltos = 0;
    for (let n = 0; n < 5000; n++) {
      const resultados: ResultadoLatido[] = [];
      for (let indice = 0; indice < 3; indice++) {
        resultados.push(latidoAlAzar());
        if (decidirSiguiente(resultados, indice, 4, UMBRALES) === 'aprobado') {
          saltos++;
          expect(promediarUltimosDos(resultados).precision).toBeGreaterThanOrEqual(SALTO_PRECISION);
          break;
        }
      }
    }
    // Si nunca saltara, la propiedad de arriba no habría probado nada.
    expect(saltos).toBeGreaterThan(0);
  });
});

describe('decidirSiguiente: el final del nodo', () => {
  it('con latidos pendientes y sin salto, sigue', () => {
    expect(decidirSiguiente([aprobado], 0, 4, UMBRALES)).toBe('siguiente');
    expect(decidirSiguiente([aprobado, aprobado, aprobado], 2, 4, UMBRALES)).toBe('siguiente');
  });

  it('en el último latido aprueba si el promedio de los dos últimos llega al umbral', () => {
    expect(decidirSiguiente([flojo, flojo, aprobado, aprobado], 3, 4, UMBRALES)).toBe('aprobado');
  });

  it('en el último latido ofrece el quinto intento si no llega', () => {
    expect(decidirSiguiente([aprobado, aprobado, flojo, flojo], 3, 4, UMBRALES)).toBe('ultimo-intento');
  });

  it('"f j" tiene tres latidos: el tercero ya es el último', () => {
    expect(decidirSiguiente([flojo, aprobado, aprobado], 2, 3, UMBRALES)).toBe('aprobado');
  });

  /* Un nodo con umbral propio lo manda el servidor, y la decisión tiene que seguirlo: si
     el front usara números suyos, daría por aprobado un nodo que el servidor suspende. */
  it('decide con los umbrales que manda el servidor, no con números propios', () => {
    const exigente: UmbralesLatido = { wpm: 14, precision: 92, ultimoIntentoPrecision: 95 };
    expect(decidirSiguiente([aprobado, aprobado, aprobado, aprobado], 3, 4, exigente)).toBe('ultimo-intento');
    expect(decidirUltimoIntento({ wpm: 12, precision: 93 }, UMBRALES)).toBe('aprobado');
    expect(decidirUltimoIntento({ wpm: 12, precision: 93 }, exigente)).toBe('no-aprobado');
  });
});

describe('promediarUltimosDos', () => {
  it('usa solo los dos últimos latidos, nunca todos', () => {
    const nota = promediarUltimosDos([
      { wpm: 5, precision: 50 },
      { wpm: 20, precision: 90 },
      { wpm: 30, precision: 96 },
    ]);
    expect(nota).toEqual({ wpm: 25, precision: 93 });
  });

  it('sin latidos devuelve cero en vez de NaN', () => {
    expect(promediarUltimosDos([])).toEqual({ wpm: 0, precision: 0 });
  });
});

describe('el quinto latido', () => {
  it('se juzga solo por precisión', () => {
    expect(decidirUltimoIntento({ wpm: 3, precision: UMBRALES.ultimoIntentoPrecision }, UMBRALES)).toBe('aprobado');
    expect(decidirUltimoIntento({ wpm: 80, precision: UMBRALES.ultimoIntentoPrecision - 0.01 }, UMBRALES))
      .toBe('no-aprobado');
  });

  it('su nota no se promedia con los latidos fallados', () => {
    const quinto = { wpm: 12, precision: 97 };
    expect(notaFinal([flojo, flojo, flojo, flojo, quinto], true)).toEqual(quinto);
    expect(notaFinal([flojo, quinto], false)).toEqual(promediarUltimosDos([flojo, quinto]));
  });
});
