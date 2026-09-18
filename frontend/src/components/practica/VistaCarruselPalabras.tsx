interface Props {
  texto: string; // palabras separadas por espacio
  indice: number; // posición global (incluye los espacios) dentro de texto
  errores: Set<number>;
  esOscuro?: boolean;
}

// Carrusel de tarjetas: la palabra activa al centro, grande; la anterior y la
// siguiente asoman achicadas a los costados. Presentación alternativa del mismo texto
// y la misma validación tecla a tecla — no cambia nada de cómo se cuentan aciertos.
const VistaCarruselPalabras = ({ texto, indice, errores, esOscuro }: Props) => {
  const palabras = texto.split(' ');

  let acumulado = 0;
  let idxActual = 0;
  let offset = 0;
  for (let p = 0; p < palabras.length; p++) {
    const largo = palabras[p].length;
    if (indice <= acumulado + largo) {
      idxActual = p;
      offset = indice - acumulado;
      break;
    }
    acumulado += largo + 1;
  }

  const palabraAnterior = idxActual > 0 ? palabras[idxActual - 1] : null;
  const palabraActual = palabras[idxActual] ?? '';
  const palabraSiguiente = idxActual < palabras.length - 1 ? palabras[idxActual + 1] : null;
  const inicioPalabraActual = acumulado;

  const colorLetra = (i: number) => {
    const posGlobal = inicioPalabraActual + i;
    if (esOscuro) {
      if (i < offset) return errores.has(posGlobal) ? 'text-dificil' : 'text-cian';
      if (i === offset) return 'text-white border-b-2 border-cian cursor-blink';
      return 'text-faint';
    }
    if (i < offset) return errores.has(posGlobal) ? 'text-rose-500' : 'text-emerald-600';
    if (i === offset) return 'text-slate-800 border-b-2 border-emerald-500 cursor-blink';
    return 'text-slate-300';
  };

  const claseVecina = esOscuro
    ? 'text-gris-texto/40'
    : 'text-slate-300';

  return (
    <div className="relative flex min-h-[120px] items-center justify-center gap-6">
      <div className={`w-24 shrink-0 truncate text-right font-mono text-lg ${claseVecina}`}>
        {palabraAnterior ?? ''}
      </div>

      <div className="rounded-2xl border-2 px-8 py-4 font-mono text-3xl tracking-wide"
        style={{
          borderColor: esOscuro ? 'var(--color-cian)' : '#34d399',
          background: esOscuro ? 'transparent' : '#fff',
        }}>
        {palabraActual.split('').map((char, i) => (
          <span key={i} className={`${colorLetra(i)} transition-colors`}>{char}</span>
        ))}
      </div>

      <div className={`w-24 shrink-0 truncate text-left font-mono text-lg ${claseVecina}`}>
        {palabraSiguiente ?? ''}
      </div>
    </div>
  );
};

export default VistaCarruselPalabras;
