import { useEffect } from 'react';
import type { ProgresoEjercicioResponse } from '../../types';
import { colorPorMejorar } from '../../core/curso/sendero';
import Icono from '../ui/Icono';
import Estrellas from './Estrellas';

interface Props {
  // Los ejercicios que todavía no tienen sus 2 estrellas, en orden del sendero.
  pendientes: ProgresoEjercicioResponse[];
  esOscuro: boolean;
  // Lleva al primero de la lista.
  onCompletar: () => void;
  onVolver: () => void;
  // "Volver al sendero" en la pantalla del Test Final; "Cerrar" cuando ya se está en él.
  textoVolver?: string;
  /* ===== DESARROLLO =====
     Solo llega con DESBLOQUEAR_TODO_EL_CURSO: deja abrir el Test Final igual, para poder
     mirar su contenido sin completar el nivel. Ausente, el botón no existe. */
  onEntrarIgual?: () => void;
}

// Cuántos pendientes se nombran antes de resumir el resto en "y N más".
const LISTA_MAXIMA = 6;

/* EL TEST FINAL CERRADO: todavía quedan ejercicios sin sus 2 estrellas.

   Pedido del usuario (10-sep-2026): el examen no se puede dar hasta que cada ejercicio del
   nivel tenga al menos 2 estrellas. Hasta ahora se podía dar igual y, si quedaban
   ejercicios de una estrella, el nivel simplemente no se aprobaba — sin ningún mensaje. Se
   tecleaba el examen entero para nada, y la pantalla no decía por qué.

   SE AVISA ANTES, NO DESPUÉS. Esta ventana sale al tocar el nodo del Test Final en el
   sendero y también si se entra por la URL, en vez de dejar hacer el examen y explicar
   después por qué no contó.

   La salida principal no es "volver": es "completarlos ahora", que lleva directo al primer
   pendiente. Desde ahí la barra de la pantalla de resultados guía el resto (ver
   BarraSendero). La Lluvia no aparece nunca aquí: es un juego de relajo, y el backend la
   deja fuera de la regla. */
const BloqueoTestFinal = ({
  pendientes, esOscuro, onCompletar, onVolver, textoVolver = 'Volver al sendero', onEntrarIgual,
}: Props) => {
  useEffect(() => {
    const manejar = (e: KeyboardEvent) => {
      /* Enter completa y Escape vuelve. `preventDefault` en los dos: es la marca con la que
         el resto de la pantalla sabe que la tecla ya tuvo dueño (CLAUDE.md, sección 8). */
      if (e.repeat) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        onCompletar();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onVolver();
      }
    };
    window.addEventListener('keydown', manejar);
    return () => window.removeEventListener('keydown', manejar);
  }, [onCompletar, onVolver]);

  const oro = 'var(--color-oro)';
  const amarillo = colorPorMejorar(esOscuro);
  const titulo = esOscuro ? 'text-white' : 'text-slate-900';
  const suave = esOscuro ? 'text-gris-texto' : 'text-slate-500';
  const visibles = pendientes.slice(0, LISTA_MAXIMA);
  const resto = pendientes.length - visibles.length;

  return (
    <div className={`sube-y-aparece w-full max-w-xl rounded-2xl border-2 p-8 shadow-2xl ${
      esOscuro ? 'bg-[rgba(10,20,28,0.98)]' : 'bg-white'
    }`}
      style={{ borderColor: 'rgba(255,197,61,0.45)', boxShadow: '0 20px 60px -18px rgba(255,197,61,0.45)' }}
      role="dialog"
      aria-label="El Test Final todavía está cerrado">

      <div className="flex items-center gap-3">
        <Icono nombre="lock" tamano={34} relleno style={{ color: oro }} />
        <h2 className={`text-2xl font-bold ${titulo}`}>Todavía no puedes dar el Test Final</h2>
      </div>

      <p className={`mt-3 text-base leading-relaxed ${suave}`}>
        El examen pide al menos <strong className={titulo}>2 estrellas</strong> en cada ejercicio
        del nivel. {pendientes.length === 1 ? 'Te falta uno:' : `Te faltan ${pendientes.length}:`}
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {visibles.map((p) => (
          <li key={p.ejercicioId}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
              esOscuro ? 'border-white/8 bg-white/4' : 'border-slate-200 bg-slate-50'
            }`}>
            <span className="w-7 shrink-0 text-right text-xs font-bold tabular-nums" style={{ color: amarillo }}>
              {p.orden}
            </span>
            <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${titulo}`}>{p.titulo}</span>
            {/* Sin nota: completado antes de que existiera la columna de estrellas. Se dice
                así y no con tres estrellas vacías, que se leerían como "sacaste cero". */}
            {p.estrellas != null
              ? <Estrellas cantidad={p.estrellas} tamano={14} />
              : <span className={`text-[11px] ${suave}`}>sin nota</span>}
          </li>
        ))}
      </ul>
      {resto > 0 && (
        <p className={`mt-2 text-xs ${suave}`}>y {resto} más</p>
      )}

      <p className={`mt-4 text-xs ${suave}`}>
        La Lluvia de letras no cuenta: es un juego para relajarse.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={onCompletar}
          autoFocus
          className="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-bold transition-all hover:brightness-110 active:scale-[0.99]"
          style={{ background: esOscuro ? 'var(--color-cian)' : '#059669', color: esOscuro ? 'var(--color-ground)' : '#FFFFFF' }}>
          <span className="rounded border border-current px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Enter</span>
          Completarlos ahora
        </button>
        <button
          onClick={onVolver}
          className={`rounded-xl border px-5 py-3 text-sm font-semibold transition-colors ${
            esOscuro ? 'border-white/10 text-gris-texto hover:text-white' : 'border-slate-200 text-slate-600 hover:text-slate-900'
          }`}>
          {textoVolver}
        </button>
      </div>

      {onEntrarIgual && (
        <button onClick={onEntrarIgual}
          className={`mt-4 text-[11px] underline underline-offset-4 ${suave}`}>
          Entrar igual (solo en desarrollo)
        </button>
      )}
    </div>
  );
};

export default BloqueoTestFinal;
