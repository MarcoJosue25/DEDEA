import { useEffect } from 'react';
import Icono from '../ui/Icono';
import type { UmbralesLatido } from '../../types';

export type CierreLatido = 'siguiente' | 'aprobado' | 'ultimo-intento';

interface Props {
  nombre: string;
  indice: number;   // base 0
  total: number;
  wpm: number;
  precision: number;
  aciertos: number;
  cierre: CierreLatido;
  // Los del nodo, tal como los manda el servidor con el contenido.
  umbrales: UmbralesLatido;
  esOscuro: boolean;
  onContinuar: () => void;
}

/* La ventana entre latidos.

   Cuatro tandas encadenadas sin pausa se leen como UNA cosa larga: el usuario termina la
   primera, empieza la segunda sin enterarse y al final no sabe qué hizo en cada una. Con un
   corte en medio son cuatro logros — que es justo lo que los latidos venían a conseguir.

   ES UNA VENTANA Y NO LA PANTALLA DE RESULTADOS, por tres razones que no son de gusto:
     1. El nodo entero es UNA sesión. Ir a /resultados obligaría a guardar cuatro sesiones
        por nodo, o a inventar una pantalla de resultados que no guarda nada.
     2. Un cambio de ruta destruye el estado del ejercicio: contadores, eventos tecla a
        tecla y el acumulado de teclas y n-gramas que se suma a lo largo del nodo.
     3. Es el sitio natural para anunciar el quinto intento, que si no aparecía de golpe.

   El atajo es ENTER y nunca el espacio: el espacio es una tecla del ejercicio y se colaría
   como primera pulsación del latido siguiente. Es exactamente el bug que ya tuvimos con el
   tutorial, donde la pulsación que lo saltaba entraba al ejercicio y corría el índice. */

/* Lo que dice la ventana, según CÓMO fue el latido y no solo según cuál era.

   La primera versión decía "{nombre}, hecho · Sigue así." pasara lo que pasara. Sonaba a
   plantilla, y era peor que genérico: felicitaba igual un 98% que un 29% de precisión. Un
   corte entre tandas solo sirve si dice algo verdadero sobre la tanda que acaba de pasar. */

/* La alerta no tiene DOS estados sino una rampa.

   Con un solo rojo, quedarse en 84% —a un punto del objetivo— se pintaba igual de grave que
   quedarse en 40%, y el aviso perdía su significado: si todo es urgente, nada lo es. La
   intensidad va de ámbar a rojo según cuánto falta para el umbral, así el color mismo dice
   de qué tamaño es el problema antes de que se lea una palabra.

   El ámbar NUNCA es ámbar puro: arranca ya mezclado con un cuarto de rojo. Un amarillo
   limpio se lee como información y no como aviso, y acá siempre hay algo que corregir. */
type Trio = [number, number, number];

/* Diez puntos por debajo del umbral, rojo pleno (con el 85% de Básico, en 75%). Va relativo
   al umbral y no como un porcentaje fijo porque el umbral lo manda el servidor por nodo: con
   un piso fijo, un nodo que pidiera 75% o menos dividiría por cero. */
const TRAMO_ALERTA = 10;
const ROJO_MINIMO = 0.22;        // el "poco de rojo" que lleva hasta el ámbar más suave

const AMBAR: Trio = [255, 197, 61];   // el mismo #FFC53D de los carriles de la lluvia
const ROJO: Trio = [255, 0, 4];       // --color-dificil

/* Aquí vivían cuatro colores más (VELO_AMBAR, VELO_ROJO y sus versiones claras) que
   teñían la pantalla entera de rojo cuando la precisión caía. Se borraron al cambiar a un
   halo que sale del panel: el velo a pantalla completa se leía como un castigo y esto es
   un aviso de práctica. El código completo quedó guardado en ICEBOX.md, anotado como
   candidato para EGO Burn, que es donde el castigo sí es el mensaje. */

const mezclar = (a: Trio, b: Trio, t: number, alfa = 1) => {
  const [r, g, azul] = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return alfa === 1 ? `rgb(${r}, ${g}, ${azul})` : `rgba(${r}, ${g}, ${azul}, ${alfa})`;
};

/* 0 = ámbar (justo debajo del umbral) · 1 = rojo pleno (TRAMO_ALERTA puntos por debajo). */
const intensidadAlerta = (precision: number, umbral: number) => {
  const crudo = (umbral - precision) / TRAMO_ALERTA;
  return ROJO_MINIMO + (1 - ROJO_MINIMO) * Math.min(1, Math.max(0, crudo));
};

const lectura = (precision: number, umbral: number) => {
  if (precision >= 95) {
    return {
      icono: 'auto_awesome',
      titulo: '¡Impecable!',
      mensaje: 'Casi sin fallos. Así es como se aprende de verdad.',
      intensidad: 0,
    };
  }
  if (precision >= umbral) {
    return {
      icono: 'thumb_up',
      titulo: '¡Bien hecho!',
      mensaje: 'Vas por buen camino. Mantén ese ritmo en la siguiente.',
      intensidad: 0,
    };
  }
  /* Por debajo del umbral el tono CAMBIA, no solo el texto. Un aviso escrito en la misma
     ventana de siempre se lee como una felicitación con letra pequeña: el usuario no lee,
     mira el color.

     Pero el texto NO dice "estás fallando demasiado". Señalar el fallo no le enseña nada a
     quien ya lo vio en el marcador; lo que hace falta es la causa y la salida. La segunda
     frase es la misma en los dos casos a propósito: es la instrucción, y no cambia porque
     falles más o menos. */
  const cola = `Baja el ritmo: para aprobar hacen falta ${umbral}% de precisión, `
    + 'y la velocidad llega sola después.';
  // "Casi" es la primera mitad del tramo de alerta: con el 85% de Básico, desde 80%.
  const casi = precision >= umbral - TRAMO_ALERTA / 2;
  return {
    icono: 'warning',
    titulo: casi ? 'Casi lo tienes' : 'Cuidado con la precisión',
    mensaje: casi
      ? `Te falta muy poco para el objetivo. ${cola}`
      : `Los dedos todavía van más rápido de lo que recuerdan. ${cola}`,
    intensidad: intensidadAlerta(precision, umbral),
  };
};

const ResumenLatido = ({
  nombre, indice, total, wpm, precision, aciertos, cierre, umbrales, esOscuro, onContinuar,
}: Props) => {
  useEffect(() => {
    const manejar = (e: KeyboardEvent) => {
      // Mantener Enter pulsado cerraba el resumen y disparaba lo siguiente en cadena.
      if (e.repeat) return;
      if (e.key !== 'Enter') return;
      e.preventDefault();
      onContinuar();
    };
    window.addEventListener('keydown', manejar);
    return () => window.removeEventListener('keydown', manejar);
  }, [onContinuar]);

  const normal = lectura(precision, umbrales.precision);

  const { icono, titulo, mensaje, intensidad } = cierre === 'aprobado'
    ? {
      icono: 'check_circle',
      titulo: '¡Ejercicio superado!',
      mensaje: 'Ya demostraste que dominas estas teclas: te saltas lo que queda.',
      intensidad: 0,
    }
    : cierre === 'ultimo-intento'
      ? {
        icono: 'bolt',
        titulo: 'Te queda un intento',
        /* Explica POR QUÉ. Antes solo decía "olvídate del reloj", y el usuario llegaba a
           esta ventana sin saber que había fallado, ni contra qué, ni que ese intento es
           el que decide si el ejercicio cuenta. */
        mensaje: `Con ${wpm} WPM y ${Math.round(precision)}% no alcanzas el mínimo del ejercicio `
          + `(${umbrales.wpm} WPM y ${umbrales.precision}%). Este último intento es el que decide: `
          + `si llegas a ${umbrales.ultimoIntentoPrecision}% de precisión, el ejercicio queda aprobado. `
          + 'Aquí la velocidad no cuenta.',
        intensidad: 0,
      }
      /* El título es SOLO la valoración: "¡Impecable!", "¡Bien hecho!". Pegarle el nombre
         del latido daba "¡Bien hecho! Combina completado", que es más largo y peor que el
         "Combina, hecho" genérico que venía a reemplazar. Qué tanda era ya lo dicen los
         puntos de abajo y el rótulo que queda detrás de la ventana. */
      : normal;

  const alerta = intensidad > 0;
  const colorAlerta = mezclar(AMBAR, ROJO, intensidad);

  const acento = cierre === 'ultimo-intento'
    ? 'var(--color-oro)'
    : alerta
      ? colorAlerta
      : (esOscuro ? 'var(--color-cian)' : '#059669');

  /* El velo. En alerta lleva un degradado rojizo desde abajo: el color entra por el borde
     del ojo antes de que se lea una sola palabra. */
  /* EL HALO SALE DEL PANEL, no tiñe la pantalla.

     La versión anterior pintaba un degradado rojo sobre la ventana ENTERA. Funcionaba
     como aviso —el color llegaba antes que las palabras— pero para un fallo de práctica
     resultó demasiado severo: teñir toda la pantalla es el lenguaje de un castigo, no
     el de un 'baja el ritmo'. (Ese efecto se guardó en ICEBOX.md; encaja mucho mejor en
     EGO Burn, donde el castigo SÍ es el mensaje.)

     Ahora el color emana de los bordes del panel y se apaga antes de llegar a los
     extremos, con un radial centrado. El resultado se lee igual de urgente porque el
     rojo sigue rodeando lo que hay que mirar, pero el resto de la pantalla se queda
     como estaba — que es lo que sostiene la idea de que esto es una PAUSA del
     ejercicio y no una pantalla nueva.

     El ámbar y el cian no cambian: los dos ya estaban bien. */
  const colorHalo = mezclar(AMBAR, ROJO, intensidad, 0.30);
  const velo = alerta
    ? `radial-gradient(ellipse 46% 42% at 50% 50%, ${colorHalo} 0%, ${mezclar(AMBAR, ROJO, intensidad, 0.14)} 45%, transparent 78%), ${esOscuro ? 'rgba(6,14,23,0.45)' : 'rgba(255,255,255,0.5)'}`
    : (esOscuro ? 'rgba(6,14,23,0.45)' : 'rgba(255,255,255,0.5)');

  const cifras = [
    { etiqueta: 'Velocidad', valor: String(wpm), unidad: 'WPM' },
    { etiqueta: 'Precisión', valor: String(Math.round(precision)), unidad: '%' },
    { etiqueta: 'Aciertos', valor: String(aciertos), unidad: '' },
  ];

  return (
    /* FIJO A LA VENTANA, no a la tarjeta. Antes iba `absolute` dentro de la tarjeta del
       ejercicio, que queda a media altura de la página: el panel aparecía por encima de
       donde el ojo estaba mirando al terminar de teclear. Centrado en pantalla sale justo
       donde ya está la vista.

       Y DIFUMINA EN VEZ DE OSCURECER. El velo opaco de antes apagaba el teclado y las
       métricas, y con ellos se perdía la razón de que este panel exista: leerse como una
       pausa DENTRO del ejercicio y no como haber salido de él. Con `backdrop-blur` y la
       opacidad a la mitad, lo de detrás sigue reconocible pero fuera de foco. */
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 backdrop-blur-md"
      style={{ background: velo }}
      role="dialog"
      aria-live="polite"
      aria-label={`Resumen de ${nombre}`}>
      {/* El contenido va en su PROPIO panel y no flotando sobre el velo: sin él, el texto
          se mezclaba con el ejercicio a medio tapar que hay detrás y el corte no terminaba
          de leerse como una tarjeta aparte. */}
      {/* max-w-2xl (672 px) y no max-w-lg (512): al pasar a `fixed`, el panel dejo de
          competir con la tarjeta del ejercicio por el ancho y quedo flotando en una
          pantalla vacia. Todos sus textos suben un 50% con el, porque un panel mas grande
          con la misma letra solo tiene mas margen, no mas presencia. */}
      <div className="sube-y-aparece w-full max-w-2xl rounded-2xl border px-10 py-10 text-center"
        style={{
          borderColor: alerta
            ? mezclar(AMBAR, ROJO, intensidad, 0.55)
            : (esOscuro ? 'rgba(255,255,255,0.10)' : '#E2E8F0'),
          // El halo NACE del borde: sin esto el radial de fondo flota suelto detrás.
          boxShadow: alerta
            ? `0 0 40px 6px ${mezclar(AMBAR, ROJO, intensidad, 0.22)}`
            : undefined,
          background: esOscuro ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.85)',
        }}>
        <Icono nombre={icono} tamano={66} relleno className="mx-auto block" style={{ color: acento }} />

        <h3 className={`mt-4 text-3xl font-bold ${esOscuro ? 'text-white' : 'text-slate-900'}`}
          style={alerta ? { color: acento } : undefined}>
          {titulo}
        </h3>
        <p className={`mx-auto mt-3 max-w-md text-xl leading-relaxed ${
          esOscuro ? 'text-gris-texto' : 'text-slate-600'
        }`}>
          {mensaje}
        </p>

        {/* Avisa de que el ejercicio puede saltar tandas SOLO acá, entre el latido 1 y el
            2: es el único momento en que decirlo sirve de algo — antes no aplica y después
            ya pasó. Pedido del usuario tras ver que un nodo puede aprobarse a la 2ª, 3ª o
            4ª tanda según cómo le vaya, y quería que no sorprendiera a quien recién empieza. */}
        {indice === 0 && cierre === 'siguiente' && (
          <p className={`mx-auto mt-2 max-w-md text-sm ${esOscuro ? 'text-gris-texto' : 'text-slate-400'}`}>
            Si de aquí en adelante te va muy bien, el ejercicio puede darse por aprobado
            antes de la última tanda.
          </p>
        )}

        <div className="mt-6 grid grid-cols-3 gap-2">
          {cifras.map((c) => (
            <div key={c.etiqueta}
              /* `bg-white/6` y no `bg-black/25`: sobre un panel que ya es oscuro, un
                 recuadro más negro se lee como un agujero en vez de como una tarjeta.
                 Aclararlo lo despega del fondo, que es lo que un dato destacado pide. */
              className={`rounded-xl border px-3 py-4 ${
                esOscuro ? 'border-white/15 bg-white/6' : 'border-slate-200 bg-slate-50'
              }`}>
              <p className={`text-[13px] font-bold uppercase tracking-[0.12em] ${
                esOscuro ? 'text-gris-texto' : 'text-slate-400'
              }`}>
                {c.etiqueta}
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums" style={{ color: acento }}>
                {c.valor}
                {c.unidad && (
                  <span className={`ml-0.5 text-[15px] font-semibold ${
                    esOscuro ? 'text-gris-texto' : 'text-slate-400'
                  }`}>
                    {c.unidad}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>

        {/* Los puntos, igual que en el rótulo del ejercicio: dónde vas dentro del nodo. */}
        {cierre === 'siguiente' && (
          <div className="mt-6 flex items-center justify-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} className="h-1.5 rounded-full"
                style={{
                  width: i === indice ? 20 : 8,
                  background: i <= indice
                    ? acento
                    : (esOscuro ? 'rgba(255,255,255,0.12)' : '#E2E8F0'),
                }} />
            ))}
          </div>
        )}

        <button
          onClick={onContinuar}
          autoFocus
          className="mt-8 inline-flex items-center gap-2 rounded-full px-8 py-3 text-base font-bold transition-all active:scale-95"
          style={{ background: acento, color: esOscuro ? 'var(--color-ground)' : '#FFFFFF' }}>
          <span className="rounded border border-current px-2 py-0.5 text-[13px] uppercase tracking-wide">
            Enter
          </span>
          {cierre === 'aprobado' ? 'Ver resultados' : 'Continuar'}
        </button>
      </div>
    </div>
  );
};

export default ResumenLatido;
