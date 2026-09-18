import { useEffect, useRef } from 'react';
import Icono from '../ui/Icono';
import { shiftContrarioDe, necesitaShift, BASE_ACENTUADA } from '../practica/tecladoLayout';

interface Props {
  // El carácter que toca escribir. Si no es especial, el componente no dibuja nada.
  caracter: string;
  /* En qué mitad de la pantalla está el carácter que se va a teclear. El panel se coloca
     en la CONTRARIA: puede taparlo todo menos lo único que importa. Sin esto vivía siempre
     pegado al borde derecho, que es donde menos se mira y donde el texto también puede
     estar. */
  ladoTexto?: 'izquierda' | 'derecha';
  arribaTexto?: boolean;
  /* El ejercicio está DETENIDO en este carácter hasta que salga, y el panel lo dice. No es
     un estado del panel, es del ejercicio — por eso llega como prop y no se calcula acá.

     Hay dos detenciones y se distinguen por lo que cuesta fallar:
       · 'no-cuenta' — la primera mayúscula del nodo. Shift es media pulsación invisible y
         el usuario no puede deducir que le falta, así que fallar no se cobra.
       · 'cuenta' — una tilde en un nodo con `tildeObligatoria`, O un `;` en un nodo con
         `puntoYComaObligatorio`. El gesto está explicado en este mismo panel, así que los
         intentos fallidos sí bajan la precisión. Decirlo es la mitad del aviso: sin eso el
         usuario cree estar en el caso gratis. */
  bloqueo?: 'no-cuenta' | 'cuenta' | null;
  esOscuro: boolean;
  /* Sube en cada intento fallido de la mayúscula gratis (bloqueo='no-cuenta' es el ÚNICO
     caso: no cuenta como error, no pinta nada rojo, así que sin esto insistir con la
     combinación se siente como si el ejercicio no respondiera). El panel da un golpe
     hacia arriba y vuelve — no es un aviso de error nuevo, es la confirmación de "recibí
     tu intento" que hoy falta. undefined o sin cambios = quieto. */
  sacudidaSello?: number;
}

/* Cómo se teclea el carácter que viene, cuando no basta con una tecla.

   ES UN PANEL AL COSTADO Y NO UN MODAL, y esa fue una corrección explícita: la primera
   versión tapaba la tarjeta del ejercicio y paraba el tecleo hasta pulsar Enter. Enseñaba,
   sí, pero cortaba el texto en dos justo en el carácter más difícil, que es donde menos
   conviene romper el ritmo. Acá el aviso aparece al lado, el ejercicio nunca se detiene y
   el usuario decide si lo mira.

   Se muestra mientras el carácter esperado lo necesita y desaparece solo. No hay estado que
   mantener, no hay "ya lo vi", no hay Enter que pulsar: es un cartel, no un paso.

   DOS TECLAS ESPECIALES, DOS GESTOS DISTINTOS, y confundirlos es el error que el panel
   existe para evitar:
     - MAYÚSCULA: Shift y letra A LA VEZ. Y el Shift de la mano CONTRARIA, que es el método
       que documenta TypingClub — con el mismo, la mano se deforma para alcanzar las dos.
     - TILDE: el acento PRIMERO y la vocal DESPUÉS. Es una tecla muerta: pulsada sola no
       escribe nada, y por eso quien no lo sabe la pulsa dos veces y le salen dos acentos.

   Y A VECES LAS DOS A LA VEZ: una vocal mayúscula con tilde (Á É Í Ó Ú) necesita los DOS
   gestos, EN ORDEN — el acento primero (sin Shift) y recién ahí Shift+letra. Mostrar solo
   el bloque de "Mayúscula" acá sería mentir: dibujaría `[É] + [Shift]` como si É fuera una
   tecla física, y el paso del acento —el primero, el que hay que hacer bien para que el
   segundo funcione— desaparecería del todo. Lo reportó el usuario con un nodo que
   empezaba justo con una É.

   UN CUARTO CASO, el 11-sep-2026: EL PUNTO Y COMA. No es un gesto físico nuevo —sale de
   Shift + la coma, el mismo tipo de combinación que una mayúscula— pero lo que hay que
   enseñar no es "dónde está la tecla", es CUÁNDO se usa: es el signo que menos gente sabe
   usar bien en su propio idioma, no solo teclear. Por eso este modo no comparte layout con
   "Mayúscula" (mostraría `;` como si fuera una tecla física, que no lo es) ni con "Tilde":
   tiene su propio texto, con un ejemplo, y enseña gramática además del gesto. */
const AvisoTeclaEspecial = ({
  caracter, ladoTexto = 'izquierda', arribaTexto = true, bloqueo = null, esOscuro, sacudidaSello,
}: Props) => {
  const asideRef = useRef<HTMLElement>(null);
  const primerRenderSacudidaRef = useRef(true);

  useEffect(() => {
    // Sin este guard, el sello en 0 al MONTAR el panel dispararía el golpe con el primer
    // render — no hubo ningún intento todavía, así que no hay nada que confirmar.
    if (primerRenderSacudidaRef.current) {
      primerRenderSacudidaRef.current = false;
      return;
    }
    if (!sacudidaSello) return;
    const el = asideRef.current;
    if (!el || typeof el.animate !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    el.getAnimations().forEach((a) => a.cancel());
    el.animate(
      [
        { transform: 'translateY(0)' },
        { transform: 'translateY(-10px)', offset: 0.35 },
        { transform: 'translateY(0)' },
      ],
      { duration: 260, easing: 'ease-out' },
    );
  }, [sacudidaSello]);

  const esPuntoYComa = caracter === ';';
  const conShift = !esPuntoYComa && necesitaShift(caracter);
  const baseAcentuada = BASE_ACENTUADA[caracter.toUpperCase()];
  const conAcento = Boolean(baseAcentuada) && caracter.toUpperCase() !== 'Ü';

  if (!conShift && !conAcento && !esPuntoYComa) return null;

  const acento = esOscuro ? 'var(--color-cian)' : '#059669';
  const izquierdo = shiftContrarioDe(caracter) === 'MAYUS-IZQ';

  const tecla = (texto: string, ancha = false) => (
    <span
      className="inline-flex items-center justify-center rounded-xl border-2 font-bold"
      style={{
        minWidth: ancha ? 108 : 68,
        height: 68,
        fontSize: ancha ? 20 : 34,
        borderColor: acento,
        background: esOscuro ? 'rgba(0,241,253,0.12)' : '#D1FAE5',
        color: acento,
      }}>
      {texto}
    </span>
  );

  // La mayúscula manda sobre la tilde para decidir qué DETIENE el ejercicio (ver
  // CursoPracticaView, retieneCursor): una Á lleva las dos y el bloqueo que aplica es el
  // de la mayúscula. Pero el PANEL, acá abajo, no puede callarse el acento — ver `combinada`.
  const esMayuscula = conShift;
  // Vocal con Shift Y tilde a la vez: los dos gestos, uno detrás del otro.
  const combinada = esMayuscula && conAcento;

  const marco = (contenido: React.ReactNode) => (
    <aside
      ref={asideRef}
      /* EN LA ESQUINA CONTRARIA AL CURSOR, y por eso las cuatro posiciones se calculan en
         vez de fijarse: el panel puede solaparse con el texto —eso da igual— pero nunca con
         el carácter que se está intentando teclear.

         Sigue `fixed` y sin capturar el ratón: es un cartel, no un paso. */
      className={`pointer-events-none fixed z-30 w-[22rem] rounded-2xl border-2 p-6 shadow-2xl sube-y-aparece ${
        ladoTexto === 'derecha' ? 'left-6' : 'right-6'
      } ${arribaTexto ? 'bottom-10' : 'top-24'}`}
      style={{
        borderColor: acento,
        background: esOscuro ? 'rgba(10,20,28,0.98)' : 'rgba(255,255,255,0.99)',
        boxShadow: `0 18px 50px -12px ${acento}55`,
      }}
      role="note"
      aria-live="polite">
      {contenido}
    </aside>
  );

  const pieBloqueo = (mensajeCuenta: string) => bloqueo && (
    <p className="mt-4 rounded-xl px-3 py-2 text-center text-sm font-semibold"
      style={{ background: `${acento}1F`, color: acento }}>
      {bloqueo === 'no-cuenta'
        ? 'Aquí no se sigue hasta que salga. Inténtalo las veces que quieras: esto no cuenta como error.'
        : mensajeCuenta}
    </p>
  );

  /* EL PUNTO Y COMA: layout propio, no comparte nada con mayúscula/tilde. La clave es el
     EJEMPLO — sin uno, "une dos ideas relacionadas" es abstracto y no se aterriza. */
  if (esPuntoYComa) {
    return marco(
      <>
        <div className="flex items-center gap-2">
          <Icono nombre="link" tamano={26} relleno style={{ color: acento }} />
          <p className="text-sm font-bold uppercase tracking-[0.12em]" style={{ color: acento }}>
            Punto y coma
          </p>
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          {izquierdo ? tecla('Shift', true) : tecla(',')}
          <span className="text-lg font-bold" style={{ color: acento }}>+</span>
          {izquierdo ? tecla(',') : tecla('Shift', true)}
        </div>

        <p className={`mt-5 text-center text-lg font-bold ${esOscuro ? 'text-white' : 'text-slate-900'}`}>
          Sale de Shift + la coma
        </p>

        <p className={`mt-2 text-center text-sm leading-snug ${
          esOscuro ? 'text-gris-texto' : 'text-slate-500'
        }`}>
          Une dos ideas relacionadas sin necesitar "y" ni "pero". Ej.: «El cielo se
          oscureció; empezó a llover poco después.» — las dos partes podrían ir separadas,
          pero están conectadas.
        </p>

        {pieBloqueo('Sin el punto y coma no se avanza, y cada intento fallido cuenta como error.')}
      </>,
    );
  }

  return marco(
    <>
      <div className="flex items-center gap-2">
        <Icono nombre={esMayuscula ? 'keyboard_capslock' : 'text_fields'} tamano={26} relleno
          style={{ color: acento }} />
        <p className="text-sm font-bold uppercase tracking-[0.12em]"
          style={{ color: acento }}>
          {combinada ? 'Mayúscula con tilde' : esMayuscula ? 'Mayúscula' : 'Tilde'}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        {combinada ? (
          <>
            {tecla('´')}
            <Icono nombre="arrow_forward" tamano={24} style={{ color: acento }} />
            {izquierdo ? tecla('Shift', true) : tecla(baseAcentuada.toLowerCase())}
            <span className="text-lg font-bold" style={{ color: acento }}>+</span>
            {izquierdo ? tecla(baseAcentuada.toLowerCase()) : tecla('Shift', true)}
          </>
        ) : esMayuscula ? (
          <>
            {izquierdo ? tecla('Shift', true) : tecla(caracter)}
            <span className="text-lg font-bold" style={{ color: acento }}>+</span>
            {izquierdo ? tecla(caracter) : tecla('Shift', true)}
          </>
        ) : (
          <>
            {tecla('´')}
            <Icono nombre="arrow_forward" tamano={24} style={{ color: acento }} />
            {tecla(baseAcentuada.toLowerCase())}
          </>
        )}
      </div>

      <p className={`mt-5 text-center text-lg font-bold ${esOscuro ? 'text-white' : 'text-slate-900'}`}>
        {combinada ? 'Primero el acento, después Shift y la letra'
          : esMayuscula ? 'Pulsa las dos a la vez' : 'Primero una, después la otra'}
      </p>

      <p className={`mt-2 text-center text-sm leading-snug ${
        esOscuro ? 'text-gris-texto' : 'text-slate-500'
      }`}>
        {combinada
          ? `El acento va SIN Shift. Recién después, Shift ${izquierdo ? 'izquierdo' : 'derecho'} `
            + '(la mano contraria) junto con la letra.'
          : esMayuscula
            ? `Usa el Shift ${izquierdo ? 'izquierdo' : 'derecho'}, el de la mano contraria a la letra.`
            : 'La tecla del acento no escribe nada sola: espera a la vocal.'}
      </p>

      {pieBloqueo('Sin la tilde no se avanza, y cada intento fallido cuenta como error.')}
    </>,
  );
};

export default AvisoTeclaEspecial;
