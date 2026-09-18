import { useEffect } from 'react';
import Icono from '../ui/Icono';

interface Props {
  icono: string;
  titulo: string;
  mensaje: string;
  // Puntos cortos, cada uno con su propio ícono de tilde. Ausente = solo el mensaje.
  reglas?: string[];
  esOscuro?: boolean;
  onEmpezar: () => void;
}

/* LA VENTANA GENÉRICA DE "ANTES DE EMPEZAR, LEÉ ESTO".

   Mismo molde visual que IntroLluvia e IntroRecorrido —pausa de verdad, se cierra con
   Enter y nunca con el espacio, que es tecla del ejercicio— pero sin nada específico de
   una mecánica: un ícono, un título, un mensaje y opcionalmente una lista corta de
   puntos. Dos usos hoy, los dos vía la misma fase 'tutorial' que ya paran TutorialTeclas,
   IntroLluvia e IntroRecorrido:
     - Cualquier CONTRARRELOJ, con las reglas fijas del bono y la penalización.
     - Un nodo con `introTexto` en su configuración (hoy solo "Oraciones con las teclas
       nuevas") — contenido, no mecánica, así que viaja desde el backend como cualquier
       otro texto curado en vez de vivir escrito acá. */
const IntroInfo = ({ icono, titulo, mensaje, reglas, esOscuro, onEmpezar }: Props) => {
  useEffect(() => {
    const manejar = (e: KeyboardEvent) => {
      if (e.repeat || e.key !== 'Enter') return;
      e.preventDefault();
      onEmpezar();
    };
    window.addEventListener('keydown', manejar);
    return () => window.removeEventListener('keydown', manejar);
  }, [onEmpezar]);

  const marco = esOscuro
    ? 'border-vidrio-borde bg-[rgba(10,20,28,0.98)]'
    : 'border-slate-200 bg-white';
  const tituloColor = esOscuro ? 'text-white' : 'text-slate-900';
  const suave = esOscuro ? 'text-gris-texto' : 'text-slate-500';
  const acento = esOscuro ? 'var(--color-cian)' : '#059669';

  return (
    <div className="flex justify-center py-6">
      <div className={`sube-y-aparece w-full max-w-2xl rounded-2xl border-2 p-10 shadow-2xl ${marco}`}
        style={{ boxShadow: `0 20px 60px -18px ${acento}55` }}
        role="dialog"
        aria-label={titulo}>
        <div className="flex items-center gap-2.5">
          <Icono nombre={icono} tamano={34} relleno style={{ color: acento }} />
          <h2 className={`text-3xl font-bold ${tituloColor}`}>{titulo}</h2>
        </div>

        <p className={`mt-3 text-lg leading-relaxed ${suave}`}>{mensaje}</p>

        {reglas && reglas.length > 0 && (
          <ul className="mt-6 flex flex-col gap-3">
            {reglas.map((r) => (
              <li key={r} className={`flex items-start gap-3 text-base leading-snug ${suave}`}>
                <Icono nombre="check_circle" tamano={20}
                  style={{ color: acento, flexShrink: 0, marginTop: 2 }} />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={onEmpezar}
          autoFocus
          className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-xl px-5 py-4 text-xl font-bold transition-all hover:brightness-110 active:scale-[0.99]"
          style={{ background: acento, color: esOscuro ? 'var(--color-ground)' : '#FFFFFF' }}>
          <span className="rounded border border-current px-2 py-0.5 text-xs uppercase tracking-wide">
            Enter
          </span>
          Empezar
        </button>
      </div>
    </div>
  );
};

export default IntroInfo;
