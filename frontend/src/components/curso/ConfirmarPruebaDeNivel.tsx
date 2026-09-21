import { useEffect } from 'react';
import Icono from '../ui/Icono';

interface Props {
  nombreNivel: string;
  nombreSiguiente?: string;
  precision: number;
  wpm: number;
  esOscuro: boolean;
  onHacerla: () => void;
  onCancelar: () => void;
}

/* "¿Ya tienes los fundamentos?" — pedido del usuario al llevar la Prueba de nivel del
   sendero (CursoNivelView, donde ya se explica sola con el texto de al lado) al selector
   de niveles, donde una tarjeta entera es un botón y la prueba es un atajo entre otros:
   ahí sí hace falta preguntar antes de saltar, porque un clic de más manda derecho a un
   examen en vez de al sendero. Mismo molde que ConfirmarRepeticion. */
const ConfirmarPruebaDeNivel = ({
  nombreNivel, nombreSiguiente, precision, wpm, esOscuro, onHacerla, onCancelar,
}: Props) => {
  useEffect(() => {
    const manejar = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        onHacerla();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancelar();
      }
    };
    window.addEventListener('keydown', manejar);
    return () => window.removeEventListener('keydown', manejar);
  }, [onHacerla, onCancelar]);

  const titulo = esOscuro ? 'text-white' : 'text-slate-900';
  const suave = esOscuro ? 'text-gris-texto' : 'text-slate-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
      onClick={onCancelar}>
      <div
        className={`sube-y-aparece w-full max-w-sm rounded-2xl border p-6 shadow-2xl ${
          esOscuro ? 'border-white/10 bg-[rgba(10,20,28,0.98)]' : 'border-slate-200 bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Confirmar la Prueba de nivel">
        <div className="flex items-center gap-2">
          <Icono nombre="bolt" tamano={24} relleno style={{ color: 'var(--color-oro)' }} />
          <h2 className={`text-lg font-bold ${titulo}`}>¿Ya sabes escribir sin mirar?</h2>
        </div>

        <p className={`mt-3 text-sm ${suave}`}>
          La Prueba de nivel salta el {nombreNivel} entero: si llegas a {precision}% de
          precisión y {wpm} WPM, apruebas el nivel de una vez{nombreSiguiente
            ? <> y se abre el {nombreSiguiente}</> : null}. Si todavía no tienes los
          fundamentos, conviene hacer el curso — ahí se aprende dónde está cada tecla en
          el camino, y la prueba solo mide, no enseña.
        </p>

        <div className="mt-5 flex gap-3">
          <button onClick={onHacerla} autoFocus
            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:brightness-110"
            style={{ background: 'var(--color-oro)', color: esOscuro ? 'var(--color-ground)' : '#FFFFFF' }}>
            <span className="rounded border border-current px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Enter</span>
            Sí, hacer la prueba
          </button>
          <button onClick={onCancelar}
            className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
              esOscuro ? 'border-white/10 text-gris-texto hover:text-white' : 'border-slate-200 text-slate-600'
            }`}>
            Prefiero el curso
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmarPruebaDeNivel;
