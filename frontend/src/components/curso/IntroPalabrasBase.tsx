import { useEffect, useState } from 'react';
import Icono from '../ui/Icono';
import TecladoGuia from '../practica/TecladoGuia';

interface Props {
  // Las palabras del tutorial (las mismas que después aparecen en la tanda cronometrada,
  // ver tutorialPalabras en el backend), en el orden en que se van a "escribir" solas.
  palabras: string[];
  mensaje?: string;
  esOscuro: boolean;
  onEmpezar: () => void;
}

/* LA VENTANA DE ENTRADA DE "PALABRAS DE LA LÍNEA BASE" — pedido del usuario, en reemplazo
   de los cuadros interactivos de TutorialTeclas para ESTE nodo, y solo para este.

   Hasta ahora el tutorial pedía tecleAR las cinco primeras palabras en cuadros grandes. El
   usuario quiso otra cosa: una SIMULACIÓN pasiva, las palabras escribiéndose solas en color
   celeste, como quien mira por encima el hombro de alguien que ya sabe — y el teclado real
   debajo, con la fila central latiendo y el resto apagado, para que quede clarísimo DE
   DÓNDE salen esas letras.

   Es una pausa de verdad, mismo molde que IntroLluvia e IntroRecorrido: no hay nada que
   teclear, se cierra con Enter (nunca el espacio, que es tecla del ejercicio) y listo — la
   tanda cronometrada que sigue vuelve a pedir estas mismas cinco palabras antes de las
   trece nuevas, así que nada de lo que se ve acá se pierde por no haberlo tecleado. */

// Milisegundos por carácter "escrito". Ni tan lento que aburra, ni tan rápido que no se lea.
const MS_POR_CARACTER = 110;
// Pausa con la frase completa antes de reiniciar el ciclo.
const PAUSA_FINAL_MS = 1400;

const IntroPalabrasBase = ({ palabras, mensaje, esOscuro, onEmpezar }: Props) => {
  const frase = palabras.join(' ');
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Sin animación: se muestra la frase entera ya "escrita", quieta.
  const [cursor, setCursor] = useState(() => (reducido ? frase.length : 0));

  useEffect(() => {
    if (reducido) return;
    let vivo = true;
    let posicion = 0;
    let manija: ReturnType<typeof setTimeout>;

    const paso = () => {
      if (!vivo) return;
      posicion += 1;
      setCursor(posicion);
      if (posicion >= frase.length) {
        manija = setTimeout(() => {
          if (!vivo) return;
          posicion = 0;
          setCursor(0);
          manija = setTimeout(paso, MS_POR_CARACTER);
        }, PAUSA_FINAL_MS);
        return;
      }
      manija = setTimeout(paso, MS_POR_CARACTER);
    };
    manija = setTimeout(paso, MS_POR_CARACTER);

    return () => { vivo = false; clearTimeout(manija); };
  }, [frase, reducido]);

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
  const titulo = esOscuro ? 'text-white' : 'text-slate-900';
  const suave = esOscuro ? 'text-gris-texto' : 'text-slate-500';
  const acento = esOscuro ? 'var(--color-cian)' : '#059669';

  return (
    <div className="flex justify-center py-6">
      <div className={`sube-y-aparece w-full max-w-2xl rounded-2xl border-2 p-10 shadow-2xl ${marco}`}
        style={{ boxShadow: `0 20px 60px -18px ${acento}55` }}
        role="dialog"
        aria-label="Tus primeras palabras">

        <div className="flex items-center gap-2.5">
          <Icono nombre="keyboard" tamano={34} relleno style={{ color: acento }} />
          <h2 className={`text-3xl font-bold ${titulo}`}>
            {mensaje ?? 'Es hora de teclear tus primeras palabras'}
          </h2>
        </div>

        <p className={`mt-3 text-lg ${suave}`}>
          Mira cómo se escriben solas, letra por letra. Todas salen de la fila central.
        </p>

        {/* La simulación: la frase se "escribe" sola en celeste, carácter a carácter. */}
        <div className={`mt-6 rounded-xl border p-6 text-center font-mono text-3xl font-bold tracking-wide ${
          esOscuro ? 'border-white/7 bg-carta' : 'border-slate-200 bg-slate-50'
        }`} aria-hidden="true">
          <span style={{ color: acento }}>{frase.slice(0, cursor)}</span>
          <span className={esOscuro ? 'text-white/15' : 'text-slate-300'}>{frase.slice(cursor)}</span>
          <span className="inline-block w-[2px] animate-pulse" style={{ background: acento, height: '0.9em', marginLeft: 2, verticalAlign: 'middle' }} />
        </div>

        {/* El teclado real, con la fila central latiendo y el resto apagado. */}
        <div className="mt-6">
          <TecladoGuia
            caracterEsperado=""
            teclaError=""
            teclaPulsada=""
            esOscuro={esOscuro}
            guiaDedos={false}
            onAlternarGuia={() => {}}
            conjuntoActivo={null}
            filaResaltada={2}
            ocultarCabecera
          />
        </div>

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

export default IntroPalabrasBase;
