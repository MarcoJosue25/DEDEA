interface Tanda {
  wpm: number;
  precision: number;
}

interface Props {
  tandas: Tanda[];
  esOscuro: boolean;
}

/* El desglose de un ejercicio servido en varias frases.

   Existe porque la nota de estos nodos es un PROMEDIO, y un promedio solo, sin las partes
   que lo forman, esconde justo lo que el usuario quiere saber: si mejoró entre una frase y
   la siguiente, o si una sola le hundió el resultado. Dos usuarios con el mismo 70% pueden
   venir de "70, 70, 70" o de "40, 85, 85", y esas dos historias piden cosas distintas.

   Cada frase se mide desde cero, así que estos números son comparables entre sí: el reloj
   se para durante el corte y ninguna arrastra los fallos de la anterior. */
const DesgloseTandas = ({ tandas, esOscuro }: Props) => {
  if (tandas.length < 2) return null;

  const media = (f: (t: Tanda) => number) =>
    tandas.reduce((a, t) => a + f(t), 0) / tandas.length;

  const acento = esOscuro ? 'var(--color-cian)' : '#059669';
  const marco = esOscuro ? 'border-(--sup-borde) bg-(--sup)' : 'border-slate-200 bg-white';

  return (
    <div className={`rounded-2xl border p-6 ${marco}`}>
      <h3 className={`text-xl font-bold ${esOscuro ? 'text-white' : 'text-slate-800'}`}>
        Frase por frase
      </h3>
      <p className={`mt-1 text-sm ${esOscuro ? 'text-gris-texto' : 'text-slate-500'}`}>
        Cada una se mide desde cero: la pausa entre frases no cuenta.
      </p>

      <div className="mt-5 flex flex-col gap-2">
        {tandas.map((t, i) => (
          <div key={i}
            className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
              esOscuro ? 'border-white/8 bg-white/4' : 'border-slate-100 bg-slate-50'
            }`}>
            <span className={`text-[11px] font-bold uppercase tracking-[0.12em] ${
              esOscuro ? 'text-gris-texto' : 'text-slate-400'
            }`}>
              Frase {i + 1}
            </span>
            <span className="ml-auto font-bold tabular-nums" style={{ color: acento }}>
              {t.wpm}
              <span className={`ml-1 text-xs font-semibold ${
                esOscuro ? 'text-gris-texto' : 'text-slate-400'
              }`}>
                WPM
              </span>
            </span>
            {/* La precisión va con el ancho fijo de tres cifras para que la columna quede
                alineada aunque un 100% conviva con un 8%. */}
            <span className="w-20 text-right font-bold tabular-nums" style={{ color: acento }}>
              {Math.round(t.precision)}
              <span className={`ml-0.5 text-xs font-semibold ${
                esOscuro ? 'text-gris-texto' : 'text-slate-400'
              }`}>
                %
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* El promedio, separado por una línea: es la nota que cuenta, no una fila más. */}
      <div className={`mt-4 flex items-center gap-4 border-t pt-4 ${
        esOscuro ? 'border-white/10' : 'border-slate-200'
      }`}>
        <span className={`text-[11px] font-bold uppercase tracking-[0.12em] ${
          esOscuro ? 'text-white' : 'text-slate-700'
        }`}>
          Promedio
        </span>
        <span className="ml-auto text-xl font-bold tabular-nums" style={{ color: acento }}>
          {Math.round(media((t) => t.wpm))}
          <span className={`ml-1 text-xs font-semibold ${
            esOscuro ? 'text-gris-texto' : 'text-slate-400'
          }`}>
            WPM
          </span>
        </span>
        <span className="w-20 text-right text-xl font-bold tabular-nums" style={{ color: acento }}>
          {Math.round(media((t) => t.precision))}
          <span className={`ml-0.5 text-xs font-semibold ${
            esOscuro ? 'text-gris-texto' : 'text-slate-400'
          }`}>
            %
          </span>
        </span>
      </div>
    </div>
  );
};

export default DesgloseTandas;
