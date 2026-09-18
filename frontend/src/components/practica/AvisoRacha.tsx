import { useEffect, useRef } from 'react';
import Icono from '../ui/Icono';

interface Props {
  /* El número que se muestra. NO es el hito: es la racha en curso, y sigue subiendo
     mientras el aviso siga en pantalla — 10, 11, 12... */
  racha: number;
  /* Cambia con cada hito nuevo. Es lo único que relanza la animación. Con 0 no hay aviso. */
  disparo: number;
  duracionMs?: number;
  esOscuro: boolean;
  /* Solo para colocarlo: el componente fija el centrado horizontal y quien lo monta decide
     la altura (`top-6`, `-top-4`...). Sin esto habría que duplicar el componente por cada
     pantalla que lo quiera en otro sitio. */
  className?: string;
}

/* EL AVISO FLOTANTE DE RACHA.

   Aparece DE GOLPE, a plena opacidad, y se va desvaneciendo durante uno o dos segundos.
   Nunca hay entrada gradual: un premio que tarda en aparecer llega cuando el usuario ya
   tecleó tres palabras más y deja de estar atado a lo que lo causó.

   EL NÚMERO SIGUE SUBIENDO MIENTRAS SE DESVANECE, y esa es la parte que le da vida: si en
   ese segundo y medio se escriben tres palabras limpias más, el aviso pasa de 10 a 13 a la
   vista. El desvanecido NO se reinicia con cada palabra, y es deliberado — reiniciándolo,
   una racha larga dejaría el cartel clavado en pantalla para siempre, tapando el texto que
   se está tecleando. El aviso dura lo que dura y el siguiente hito trae uno nuevo.

   Va con la Web Animations API y no con una clase CSS por el mismo motivo que el destello
   de fallo del tutorial: hay que poder RE-disparar la misma animación en hitos seguidos, y
   volver a poner una clase que ya está no reinicia nada.

   ⚠️ Se posiciona en absoluto: el contenedor que lo monte tiene que ser `relative`. */
/* El centrado horizontal va DENTRO de los fotogramas y no en una clase de Tailwind: una
   animación de `transform` sustituye el transform entero del elemento, así que un
   `-translate-x-1/2` de clase desaparecería en cuanto arrancara el desvanecido y el cartel
   saltaría media anchura a la derecha. */
const CENTRADO = 'translateX(-50%)';

const AvisoRacha = ({
  racha, disparo, duracionMs = 1600, esOscuro, className = '',
}: Props) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!disparo) return;
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') return;

    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const anim = el.animate(
      quieto
        ? [{ opacity: 1 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }]
        : [
          /* El 1.06 de entrada dura 90 ms: sigue leyéndose como instantáneo, pero un
             elemento que aparece con el tamaño exacto y quieto parece que llevaba ahí
             todo el rato. */
          { opacity: 1, transform: `${CENTRADO} scale(1.06)` },
          { opacity: 1, transform: `${CENTRADO} scale(1)`, offset: 0.06 },
          { opacity: 1, transform: `${CENTRADO} translateY(-4px)`, offset: 0.4 },
          { opacity: 0, transform: `${CENTRADO} translateY(-16px) scale(0.97)` },
        ],
      { duration: duracionMs, easing: 'ease-out', fill: 'forwards' },
    );
    return () => anim.cancel();
  }, [disparo, duracionMs]);

  if (!disparo) return null;

  const marco = esOscuro
    ? 'border-cian/35 bg-[#08222B]/92 text-white'
    : 'border-emerald-300 bg-white text-slate-800';
  const acento = esOscuro ? 'var(--color-cian)' : '#059669';

  return (
    <div
      ref={ref}
      /* `opacity-0` de arranque para que el primer fotograma pintado ya sea el de la
         animación: sin esto, el navegador alcanza a mostrar el cartel opaco en la posición
         final antes de que la animación tome el control, y en un hito seguido a otro se ve
         un parpadeo. */
      style={{ transform: CENTRADO }}
      className={`pointer-events-none absolute left-1/2 z-20 flex items-center gap-3
        rounded-2xl border px-5 py-3 opacity-0 shadow-lg shadow-black/25 backdrop-blur-sm
        ${marco} ${className}`}>
      <Icono nombre="local_fire_department" tamano={30} relleno style={{ color: acento }} />
      <span className="text-3xl font-black tabular-nums leading-none" style={{ color: acento }}>
        {racha}
      </span>
      <span className="text-sm font-bold uppercase tracking-[0.14em] leading-none">
        seguidas
      </span>
    </div>
  );
};

export default AvisoRacha;
