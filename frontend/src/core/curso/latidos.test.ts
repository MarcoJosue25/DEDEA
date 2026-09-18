import { describe, expect, it } from 'vitest';
import {
  decidirSiguiente, decidirUltimoIntento, notaFinal, promediarUltimosDos,
  SALTO_PRECISION, SALTO_WPM, UMBRAL_PRECISION, UMBRAL_WPM, ULTIMO_INTENTO_PRECISION,
  type ResultadoLatido,
} from './latidos';

const flojo: ResultadoLatido = { wpm: 20, precision: 80 };
const excelente: ResultadoLatido = { wpm: SALTO_WPM + 5, precision: SALTO_PRECISION + 2 };
const aprobado: ResultadoLatido = { wpm: UMBRAL_WPM + 2, precision: UMBRAL_PRECISION + 3 };

describe('decidirSiguiente: el salto de latidos', () => {
  /* El bug del 11-sep-2026 (CLAUDE.md 6.20): un latido flojo seguido de uno excelente
     saltaba el resto del nodo, pero la nota que viaja al servidor es el promedio de los
     dos últimos — con el flojo adentro daba una estrella. El salto decía "ya sabés esto"
     y la pantalla decía "repítelo". */
  it('no salta con un latido flojo seguido de uno excelente', () => {
    expect(decidirSiguiente([flojo, excelente], 1, 4)).toBe('siguiente');
  });

  it('salta cuando los DOS últimos superan el umbral, cada uno por separado', () => {
    expect(decidirSiguiente([flojo, excelente, excelente], 2, 4)).toBe('aprobado');
  });

  it('nunca salta en el primer latido, por bueno que sea', () => {
    expect(decidirSiguiente([excelente], 0, 4)).toBe('siguiente');
  });

  it('en "un dedo" no salta nunca: cada tanda es un dedo distinto', () => {
    expect(decidirSiguiente([excelente, excelente], 1, 4, false)).toBe('siguiente');
    expect(decidirSiguiente([excelente, excelente, excelente], 2, 4, false)).toBe('siguiente');
  });

  it('un promedio alto no alcanza si uno de los dos queda por debajo', () => {
    // Promedian 99% de precisión, pero el primero no llega a SALTO_PRECISION.
    const casi: ResultadoLatido = { wpm: SALTO_WPM + 10, precision: SALTO_PRECISION - 1 };
    const perfecto: ResultadoLatido = { wpm: SALTO_WPM + 10, precision: 100 };
    expect(decidirSiguiente([casi, perfecto], 1, 4)).toBe('siguiente');
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
        if (decidirSiguiente(resultados, indice, 4) === 'aprobado') {
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
    expect(decidirSiguiente([aprobado], 0, 4)).toBe('siguiente');
    expect(decidirSiguiente([aprobado, aprobado, aprobado], 2, 4)).toBe('siguiente');
  });

  it('en el último latido aprueba si el promedio de los dos últimos llega al umbral', () => {
    expect(decidirSiguiente([flojo, flojo, aprobado, aprobado], 3, 4)).toBe('aprobado');
  });

  it('en el último latido ofrece el quinto intento si no llega', () => {
    expect(decidirSiguiente([aprobado, aprobado, flojo, flojo], 3, 4)).toBe('ultimo-intento');
  });

  it('"f j" tiene tres latidos: el tercero ya es el último', () => {
    expect(decidirSiguiente([flojo, aprobado, aprobado], 2, 3)).toBe('aprobado');
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
    expect(decidirUltimoIntento({ wpm: 3, precision: ULTIMO_INTENTO_PRECISION })).toBe('aprobado');
    expect(decidirUltimoIntento({ wpm: 80, precision: ULTIMO_INTENTO_PRECISION - 0.01 })).toBe('no-aprobado');
  });

  it('su nota no se promedia con los latidos fallados', () => {
    const quinto = { wpm: 12, precision: 97 };
    expect(notaFinal([flojo, flojo, flojo, flojo, quinto], true)).toEqual(quinto);
    expect(notaFinal([flojo, quinto], false)).toEqual(promediarUltimosDos([flojo, quinto]));
  });
});
