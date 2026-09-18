import Icono from '../ui/Icono';

interface Props {
  texto: string;
  // Las dos teclas, cuando la pista es de vecindad. Sin ellas se dibuja solo el texto.
  pulsada?: string;
  esperada?: string;
  esOscuro: boolean;
}

/* LA VENTANA QUE CORRIGE UN FALLO.

   Antes era una línea de texto debajo del ejercicio. El usuario pidió una ventana, y el
   cambio no es de tamaño: es que **se dibujan las dos teclas**. "Una tecla a tu derecha" es
   una frase que hay que traducir a un gesto; la erre y la te una al lado de la otra, con una
   flecha en medio, ya SON el gesto.

   FLOTA Y NO BLOQUEA. `pointer-events: none` y posición fija abajo, lejos del texto que se
   está tecleando: el ejercicio sigue corriendo mientras la ventana está puesta, igual que
   `AvisoTeclaEspecial`. Una corrección que detiene lo que se está corrigiendo no corrige
   nada.

   ⚠️ El centrado va en un CONTENEDOR sin transform, no en la tarjeta con `-translate-x-1/2`.
   La animación de entrada anima `transform`, y una clase de Tailwind con transform sería
   sustituida en cuanto arranca — es exactamente el fallo que ya tuvo el aviso de racha, que
   saltaba media anchura a la derecha. */

const TAMANO_TECLA = 54;

const AvisoPista = ({ texto, pulsada, esperada, esOscuro }: Props) => {
  const oro = 'var(--color-oro)';
  const hayTeclas = Boolean(pulsada && esperada);

  const tecla = (letra: string, correcta: boolean) => (
    <span
      className="flex items-center justify-center rounded-xl border-2 font-mono font-bold uppercase"
      style={{
        width: TAMANO_TECLA,
        height: TAMANO_TECLA,
        fontSize: 24,
        /* La pulsada apagada y la correcta encendida. El contraste entre las dos es lo que
           dice cuál es cuál sin ninguna etiqueta. */
        borderColor: correcta ? oro : (esOscuro ? 'rgba(255,255,255,0.22)' : '#CBD5E1'),
        color: correcta ? oro : (esOscuro ? 'rgba(255,255,255,0.45)' : '#94A3B8'),
        background: correcta ? 'rgba(255,197,61,0.12)' : 'transparent',
      }}>
      {letra}
    </span>
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-30 flex justify-center px-4">
      <div
        className="sube-y-aparece flex items-center gap-4 rounded-2xl border-2 px-6 py-4 shadow-2xl"
        style={{
          borderColor: 'rgba(255,197,61,0.45)',
          background: esOscuro ? 'rgba(10,20,28,0.97)' : 'rgba(255,255,255,0.98)',
          boxShadow: '0 18px 50px -16px rgba(255,197,61,0.45)',
        }}
        role="status"
        aria-live="polite">

        {hayTeclas ? (
          <div className="flex shrink-0 items-center gap-2.5">
            {tecla(pulsada as string, false)}
            <Icono nombre="arrow_forward" tamano={22} style={{ color: oro }} />
            {tecla(esperada as string, true)}
          </div>
        ) : (
          <Icono nombre="info" tamano={26} relleno style={{ color: oro, flexShrink: 0 }} />
        )}

        <p className={`text-lg font-bold leading-tight ${esOscuro ? 'text-white' : 'text-slate-900'}`}>
          {texto}
        </p>
      </div>
    </div>
  );
};

export default AvisoPista;
