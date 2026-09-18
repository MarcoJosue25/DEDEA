// Espejo exacto de NgramGenerator.java método extraerNgramsFallidos

export const extraerNgramsFallidos = (
  palabraObjetivo: string,
  indiceError: number
): string[] => {
  const ngramsFallidos: string[] = [];

  if (!palabraObjetivo || indiceError <= 0 || indiceError >= palabraObjetivo.length) {
    return ngramsFallidos;
  }

  const p = palabraObjetivo.toLowerCase();

  if (p[indiceError] === ' ' || p[indiceError - 1] === ' ') {
    return ngramsFallidos;
  }

  // Bigrama fallido
  ngramsFallidos.push(p.slice(indiceError - 1, indiceError + 1));

  // Trigrama fallido
  if (indiceError >= 2 && p[indiceError - 2] !== ' ') {
    ngramsFallidos.push(p.slice(indiceError - 2, indiceError + 1));
  }

  return ngramsFallidos;
};

export const generarTodosNgrams = (palabra: string): string[] => {
  const ngrams: string[] = [];
  if (!palabra || palabra.length < 2) return ngrams;

  const p = palabra.toLowerCase();

  // Bigramas
  for (let i = 0; i < p.length - 1; i++) {
    ngrams.push(p.slice(i, i + 2));
  }

  // Trigramas
  for (let i = 0; i < p.length - 2; i++) {
    ngrams.push(p.slice(i, i + 3));
  }

  return ngrams;
};

export const contarAparicionesNgram = (texto: string, ngram: string): number => {
  const textoLimpio = texto.toLowerCase();
  let count = 0;
  let pos = 0;
  while ((pos = textoLimpio.indexOf(ngram, pos)) !== -1) {
    count++;
    pos++;
  }
  return count;
};