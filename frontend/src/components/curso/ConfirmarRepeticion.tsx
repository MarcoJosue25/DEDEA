import { useEffect } from 'react';
import type { ProgresoEjercicioResponse } from '../../types';
import Icono from '../ui/Icono';
import Estrellas from './Estrellas';

interface Props {
  nodo: ProgresoEjercicioResponse;
  esOscuro: boolean;
  onRepetir: () => void;
  onCancelar: () => void;
}

/* "Este ejercicio ya lo aprobaste, ¿deseas repetirlo?" — al tocar en la barra de guiones
   un ejercicio hecho que NO está en amarillo. Pedido del usuario: se puede ir a cualquiera,
   pero ir a uno ya resuelto merece una pregunta, porque lo normal en ese punto es estar
   levantando los de una estrella y un clic de más saca del recorrido.

   Enseña las estrellas que ya tiene: es lo que decide si vale la pena repetirlo. */
const ConfirmarRepeticion = ({ nodo, esOscuro, onRepetir, onCancelar }: Props) => {
  useEffect(() => {
    const manejar = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        onRepetir();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancelar();
      }
    };
    window.addEventListener('keydown', manejar);
    return () => window.removeEventListener('keydown', manejar);
  }, [onRepetir, onCancelar]);

  const titulo = esOscuro ? 'text-white' : 'text-slate-900';
  const suave = esOscuro ? 'text-gris-texto' : 'text-slate-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
      onClick={onCancelar}>
      <div
        className={`sube-y-aparece w-full max-w-sm rounded-2xl border p-6 shadow-2xl ${
          esOscuro ? 'border-white/10 bg-[rgba(10,20,28,0.98)]' : 'border-slate-200 bg-white'
        }`}
        // El clic dentro de la ventana no la cierra: solo el del fondo.
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Repetir un ejercicio ya aprobado">
        <div className="flex items-center gap-2">
          <Icono nombre="task_alt" tamano={24} style={{ color: esOscuro ? 'var(--color-cian)' : '#059669' }} />
          <h2 className={`text-lg font-bold ${titulo}`}>Este ejercicio ya lo aprobaste</h2>
        </div>

        <p className={`mt-3 text-sm font-semibold ${titulo}`}>{nodo.titulo}</p>
        <div className="mt-1.5">
          {nodo.estrellas != null
            ? <Estrellas cantidad={nodo.estrellas} tamano={18} />
            : <span className={`text-xs ${suave}`}>Sin nota todavía</span>}
        </div>

        <p className={`mt-4 text-sm ${suave}`}>¿Deseas repetirlo?</p>

        <div className="mt-5 flex gap-3">
          <button onClick={onRepetir} autoFocus
            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:brightness-110"
            style={{ background: esOscuro ? 'var(--color-cian)' : '#059669', color: esOscuro ? 'var(--color-ground)' : '#FFFFFF' }}>
            <span className="rounded border border-current px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Enter</span>
            Repetir
          </button>
          <button onClick={onCancelar}
            className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
              esOscuro ? 'border-white/10 text-gris-texto hover:text-white' : 'border-slate-200 text-slate-600'
            }`}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmarRepeticion;
