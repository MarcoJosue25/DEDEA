import { useEffect, useRef, useState } from 'react';
import { APARIENCIAS } from '../../core/apariencia/apariencia';
import { useApariencia } from '../../core/apariencia/useApariencia';

/* Icono de paleta que abre un panel flotante para cambiar la apariencia de la
   pantalla. Se monta en Práctica y en Resultados; la elección es compartida. */
const SelectorApariencia = () => {
  const { apariencia, cambiar } = useApariencia();
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrarSiClickAfuera = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    };
    const cerrarConEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', cerrarSiClickAfuera);
    document.addEventListener('keydown', cerrarConEsc);
    return () => {
      document.removeEventListener('mousedown', cerrarSiClickAfuera);
      document.removeEventListener('keydown', cerrarConEsc);
    };
  }, [abierto]);

  return (
    <div ref={contenedor} className="relative">
      <button
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-label="Cambiar la apariencia"
        title="Apariencia"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-(--sup-borde) bg-(--sup) text-(--sup-tenue) transition-all hover:text-cian active:scale-95">
        <span className="material-symbols-outlined text-[20px]">palette</span>
      </button>

      {abierto && (
        <div className="absolute right-0 z-50 mt-3 w-64 rounded-2xl border border-white/10 bg-carta p-3 shadow-2xl">
          <p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-cian">
            Apariencia
          </p>

          {APARIENCIAS.map((opcion) => {
            const activa = opcion.id === apariencia;
            return (
              <button
                key={opcion.id}
                onClick={() => { cambiar(opcion.id); setAbierto(false); }}
                aria-pressed={activa}
                className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors ${
                  activa ? 'bg-cian/10' : 'hover:bg-white/5'
                }`}>
                {/* Miniatura: un cuadrito con la superficie y su acento */}
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10"
                  style={{ background: opcion.muestra[0] }}>
                  <span className="h-3 w-3 rounded-full" style={{ background: opcion.muestra[1] }} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${activa ? 'text-cian' : 'text-white'}`}>
                    {opcion.nombre}
                  </span>
                  <span className="block text-[11px] leading-snug text-gris-texto">
                    {opcion.descripcion}
                  </span>
                </span>

                {activa && (
                  <span className="material-symbols-outlined text-[18px] text-cian">check</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SelectorApariencia;
