interface Props {
  texto: string; // palabras separadas por espacio
  indice: number; // posición global (incluye los espacios) dentro de texto
  errores: Set<number>;
  esOscuro?: boolean;
}

// "Palabras mutantes": las palabras se apilan una encima de otra dentro de un óvalo.
// En cuanto terminas la palabra activa, la siguiente ya está ahí (no hay pausa/espacio
// que marque el cambio) — por eso se ve la próxima ya asomando detrás, más chica y opaca.
const VistaPalabrasMutantes = ({ texto, indice, errores, esOscuro }: Props) => {
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

  const palabraActual = palabras[idxActual] ?? '';
  const inicioPalabraActual = acumulado;
  const siguientes = palabras.slice(idxActual + 1, idxActual + 3);

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

  return (
    <div className="relative flex min-h-[180px] flex-col items-center justify-center gap-3">
      {siguientes.map((palabra, i) => (
        <div key={`${palabra}-${i}`}
          /* Las que asoman detrás van en negro: sobre el degradado oscuro un gris
             claro se confundía con el óvalo principal y no se leía el apilado. */
          className={`absolute select-none rounded-full px-8 py-3 font-mono text-lg ${
            esOscuro ? 'bg-black text-gris-texto' : 'bg-slate-100 text-slate-300'
          }`}
          style={{
            top: `${(i + 1) * 14}px`,
            opacity: esOscuro ? 0.85 - i * 0.25 : 0.5 - i * 0.15,
            transform: `scale(${1 - (i + 1) * 0.08})`,
            zIndex: 1 - i,
          }}>
          {palabra}
        </div>
      ))}

      {/* Óvalo principal: en oscuro va sin relleno, solo el contorno cian, para que
          se vea el degradado detrás y no un parche blanco. */}
      <div
        className={`relative z-10 select-none rounded-full border-2 px-10 py-5 font-mono text-3xl tracking-wide ${
          esOscuro ? 'border-cian bg-transparent' : 'border-emerald-400 bg-white'
        }`}
        style={{
          boxShadow: esOscuro
            ? '0 8px 24px rgba(0, 241, 253, 0.15)'
            : '0 8px 20px rgba(16,185,129,0.15)',
        }}>
        {palabraActual.split('').map((char, i) => (
          <span key={i} className={`${colorLetra(i)} transition-colors`}>{char}</span>
        ))}
      </div>
    </div>
  );
};

export default VistaPalabrasMutantes;
