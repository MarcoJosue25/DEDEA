import { api } from './client';
import type { GenericResponse } from '../types';

// Cuántas palabras se piden en total cuando se combinan varios ngrams/letras.
const TOTAL_PALABRAS_DEFECTO = 40;

const obtenerPalabrasPorNgram = (
  ngram: string,
  dificultad: 'FACIL' | 'MEDIO' | 'DIFICIL',
  limite: number,
): Promise<string[]> => {
  return api.post<GenericResponse<string[]>>('/diccionario/practica', {
    ngram,
    dificultad,
    limite,
  }).then((res) => res.data.data ?? []);
};

// El backend solo filtra por un ngram a la vez (consulta indexada). Para "practicar varios
// ngrams juntos" pedimos cada uno por separado y mezclamos los resultados acá, repartiendo
// el total pedido entre la cantidad de ngrams seleccionados.
export const generarTextoDePalabras = async (
  ngrams: string[],
  dificultad: 'FACIL' | 'MEDIO' | 'DIFICIL',
  totalPalabras: number = TOTAL_PALABRAS_DEFECTO,
): Promise<string> => {
  const seleccionados = ngrams.map((n) => n.trim().toLowerCase()).filter(Boolean);
  if (seleccionados.length === 0) return '';

  const porNgram = Math.max(5, Math.ceil(totalPalabras / seleccionados.length));

  const resultados = await Promise.all(
    seleccionados.map((ngram) =>
      obtenerPalabrasPorNgram(ngram, dificultad, porNgram).catch(() => [] as string[])
    )
  );

  const combinadas = resultados.flat();
  // Barajamos para que no queden agrupadas por ngram (todas las de "ca" primero, etc.)
  for (let i = combinadas.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combinadas[i], combinadas[j]] = [combinadas[j], combinadas[i]];
  }

  return combinadas.slice(0, totalPalabras).join(' ');
};
