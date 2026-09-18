import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import Icono from '../ui/Icono';

interface Props {
  duracionSegundos?: number;
  // Cuántas teclas equivocadas aguanta la partida. Ausente = sin tope, y la regla no sale.
  reservas?: number;
  /* Opcional por lo mismo que en VistaLluviaLetras, de donde viene: la apariencia clara es
     la de por defecto, así que ausente significa clara. */
  esOscuro?: boolean;
  onEmpezar: () => void;
}

/* LA VENTANA DE ENTRADA DE LA LLUVIA DE LETRAS.

   La Lluvia es el único ejercicio del Curso cuya mecánica no se deduce del texto: en todos
   los demás hay algo escrito y se copia. Aquí hay carriles, vidas y una letra que va más
   deprisa que las otras, y hasta ahora el usuario descubría las tres reglas perdiendo.

   ES UNA PAUSA DE VERDAD, no un cartel al costado: el juego no corre por detrás. Es la
   diferencia con AvisoTeclaEspecial —que nunca detiene nada— y el motivo es que aquí no hay
   nada que interrumpir todavía; la partida empieza cuando el usuario dice.

   LA DEMOSTRACIÓN SE MUEVE, y esa es la mitad del componente. "La letra dorada cae más
   rápido" es una frase que hay que creerse; dos letras bajando al lado, una al doble que la
   otra, se entiende sin leerla. La regla se enseña con el mismo lenguaje visual con el que
   después se juega — mismo dorado, mismo latido, misma caída lineal. */

/* LA PISTA DE LA DEMO. Nació casi a escala real —300 × 356 contra los 360 × 480 que tenía
   el juego— y desde el 10-sep-2026 ya no lo es: los carriles del juego pasaron a 128 px de
   ancho y a tomar el alto libre de la pantalla. Se dejó así a propósito: lo que el usuario
   pidió agrandar fue la pista de juego, no esta ventana, y la demo sigue teniendo la forma
   de lo que viene —carriles, una dorada al doble—, que es lo que la hace explicar.

   La primera versión medía 176 × 104 y era el problema que reportó el usuario — a ese tamaño
   la demostración se leía como un icono y la caída apenas se apreciaba. Lo que la hace
   funcionar es justamente que se parezca a lo que viene después: si la pista de la
   explicación no tiene la forma de la pista del juego, no está explicando el juego.

   La letra va a 36 px, entre los 30 del juego y lo que pide un cuadro de este tamaño. */
const ALTO_DEMO = 300;
const ANCHO_DEMO = 356;
const TAMANO_LETRA_DEMO = 36;

const AMBAR = '#FFC53D';

/* Las cuatro letras de la demo. `dur` en segundos y `retraso` para escalonarlas: sin el
   escalonado caen las cuatro a la vez y parece una sola fila bajando, que es justo lo que
   no pasa en el juego. La dorada va a la mitad de tiempo que sus vecinas, que es la
   proporción real (MULTIPLICADOR_RAPIDA). */
const LETRAS_DEMO = [
  { letra: 'f', dur: 2.6, retraso: 0, rapida: false },
  { letra: 'j', dur: 2.6, retraso: 0.9, rapida: false },
  { letra: 'k', dur: 1.3, retraso: 0.45, rapida: true },
  { letra: 'd', dur: 2.6, retraso: 1.8, rapida: false },
];

const IntroLluvia = ({ duracionSegundos, reservas, esOscuro, onEmpezar }: Props) => {
  useEffect(() => {
    const manejar = (e: KeyboardEvent) => {
      /* ENTER y nunca el espacio, la misma regla que la ventana entre latidos: el espacio
         es una tecla del ejercicio, así que la pulsación que cierra la ventana se colaría
         como primera pulsación de la partida. Y `e.repeat` porque mantener Enter pulsado
         no son cuarenta confirmaciones. */
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
  const titulo = esOscuro ? 'text-white' : 'text-slate-900';
  const suave = esOscuro ? 'text-gris-texto' : 'text-slate-500';
  const acento = esOscuro ? 'var(--color-cian)' : '#059669';

  const regla = (icono: string, texto: string) => (
    <li className={`flex items-start gap-3 text-lg leading-snug ${suave}`}>
      <Icono nombre={icono} tamano={24} style={{ color: acento, flexShrink: 0, marginTop: 2 }} />
      <span>{texto}</span>
    </li>
  );

  return (
    <div className="flex justify-center py-6">
      <div className={`sube-y-aparece w-full max-w-5xl rounded-2xl border-2 p-10 shadow-2xl ${marco}`}
        style={{ boxShadow: `0 20px 60px -18px ${acento}55` }}
        role="dialog"
        aria-label="Cómo se juega la lluvia de letras">

        <div className="flex items-center gap-2.5">
          <Icono nombre="grain" tamano={34} relleno style={{ color: acento }} />
          <h2 className={`text-4xl font-bold ${titulo}`}>Lluvia de letras</h2>
        </div>

        <p className={`mt-3 text-xl ${suave}`}>
          Van cayendo letras por los cinco carriles. Púlsalas antes de que toquen el suelo.
        </p>

        <div className="mt-8 flex flex-col gap-8 sm:flex-row sm:items-center">
          {/* ---------- La demostración ---------- */}
          <div className={`relative shrink-0 overflow-hidden rounded-xl border ${
            esOscuro ? 'border-vidrio-borde bg-black/25' : 'border-slate-200 bg-slate-50'
          }`}
            style={{ width: ANCHO_DEMO, height: ALTO_DEMO }}
            aria-hidden="true">
            <div className="flex h-full justify-around px-1">
              {LETRAS_DEMO.map(({ letra, dur, retraso, rapida }) => (
                <span
                  key={letra}
                  className={`cae-demo font-mono font-bold ${rapida ? 'late-rapida' : ''}`}
                  style={{
                    /* El recorrido se pasa en una variable porque el fotograma final es el
                       mismo para las cuatro; lo único que cambia entre ellas son los tres
                       valores de aquí. */
                    '--recorrido': `${ALTO_DEMO - TAMANO_LETRA_DEMO - 16}px`,
                    '--dur': `${dur}s`,
                    '--retraso': `${retraso}s`,
                    fontSize: TAMANO_LETRA_DEMO,
                    color: rapida ? AMBAR : acento,
                    alignSelf: 'flex-start',
                    marginTop: 10,
                  } as CSSProperties}>
                  {letra}
                </span>
              ))}
            </div>
            {/* El suelo, para que se entienda dónde termina la caída. */}
            <div className="absolute inset-x-0 bottom-0 h-px"
              style={{ background: esOscuro ? 'rgba(255,255,255,0.15)' : '#CBD5E1' }} />
          </div>

          {/* ---------- Las reglas ---------- */}
          <ul className="flex flex-col gap-4">
            {regla('bolt', 'La letra dorada cae al doble de rápido. Es la que hay que mirar primero.')}
            {regla('favorite', 'Cada letra que llega al suelo es un golpe en su carril. '
              + 'Tres golpes en el mismo carril y se acaba la partida.')}
            {regla('touch_app', 'Puedes pulsar cualquiera de las que estén cayendo, no solo la más baja.')}
            {reservas
              ? regla('battery_full', `Tienes ${reservas} reservas: cada tecla que pulses y no esté `
                + 'cayendo gasta una. Si se acaban, la partida termina.')
              : null}
            {duracionSegundos
              ? regla('timer', `Aguanta ${duracionSegundos} segundos y el ejercicio es tuyo.`)
              : null}
          </ul>
        </div>

        <button
          onClick={onEmpezar}
          autoFocus
          className="mt-9 flex w-full items-center justify-center gap-2.5 rounded-xl px-5 py-4 text-xl font-bold transition-all hover:brightness-110 active:scale-[0.99]"
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

export default IntroLluvia;
