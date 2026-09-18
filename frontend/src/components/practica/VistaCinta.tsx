import { useCallback, useLayoutEffect, useRef, useState } from 'react';

interface Props {
  texto: string;
  indice: number;
  errores: Set<number>;
  esOscuro: boolean;
  /* Un poco más gruesa en los ejercicios de letras sueltas. A 30 px una sílaba aislada con
     trazo fino se ve endeble; en un texto corrido ese mismo peso cansaría. */
  masGruesa?: boolean;
}

/* La CINTA: el texto en una sola línea que se desliza, con el cursor siempre en el mismo
   sitio.

   Es el hermano horizontal del teleprompter que ya existía. Y resuelve un problema real
   del bloque de texto normal: repartido en dos o tres líneas, un ejercicio de sílabas se
   lee como un párrafo. En una línea a 30 px se lee como lo que es — una tira de teclas que
   van pasando.

   EL CURSOR NO SE MUEVE NUNCA: se queda clavado en el centro y lo que se desplaza es el
   texto. La primera versión lo dejaba pegado al borde izquierdo hasta que hubiera bastante
   texto detrás, o sea que el punto donde hay que mirar cambiaba de sitio durante los
   primeros segundos de cada tanda, justo cuando el usuario busca dónde poner la vista.
   Un punto fijo no se busca. */
const TAMANO = 30;
const POSICION_CURSOR = 0.5;

const VistaCinta = ({ texto, indice, errores, esOscuro, masGruesa }: Props) => {
  const cursorRef = useRef<HTMLSpanElement>(null);
  const pistaRef = useRef<HTMLDivElement>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [desplazamiento, setDesplazamiento] = useState(0);

  /* La posición del carácter DENTRO DE LA PISTA, restando el rectángulo de la pista al del
     cursor. Los dos se mueven juntos con el desplazamiento, así que la resta lo cancela y
     queda una medida absoluta que no depende de cuánto se haya desplazado ya.

     Dos formas anteriores fallaron, y las dos vale la pena recordarlas:

     - `offsetLeft`: el cursor se iba corriendo a la derecha mientras se escribía —medido,
       empezaba centrado y a las 24 pulsaciones estaba 190 px desviado— porque offsetLeft
       se mide contra el ancestro POSICIONADO, que acá es la propia pista desplazada, así
       que en la cuenta entraba un valor que ya incluía parte del desplazamiento.
     - Corregir POR DIFERENCIA (mover la cinta lo que le falte): se autocorrige, sí, pero
       solo si vuelve a ejecutarse. Al montar corre una única vez, y si esa vez mide mal el
       error se queda para siempre — que es exactamente lo que pasaba al salir del tutorial. */
  const recolocar = useCallback(() => {
    const cursor = cursorRef.current;
    const pista = pistaRef.current;
    const contenedor = contenedorRef.current;
    if (!cursor || !pista || !contenedor) return;

    /* ⚠️ EL GUARD DEL ANCHO CERO. Al montar la cinta —justo al salir del tutorial— el
       contenedor todavía no tiene ancho, y con ancho 0 la cuenta da un desplazamiento
       absurdo que empuja el texto entero fuera del recorte: la cinta se veía VACÍA hasta la
       primera pulsación. Medido: transform de 910 px en un contenedor de 910 px.

       No alcanza con no calcular. Hace falta además volver a medir cuando el ancho llegue,
       y de eso se encarga el ResizeObserver de abajo. */
    const ancho = contenedor.clientWidth;
    if (ancho === 0) return;

    const posEnPista = cursor.getBoundingClientRect().left - pista.getBoundingClientRect().left;
    // Negativo al empezar, y es lo correcto: empuja el texto a la derecha para que el
    // primer carácter ya nazca en el centro.
    setDesplazamiento(posEnPista - ancho * POSICION_CURSOR);
  }, []);

  /* useLayoutEffect y no useEffect: mide y coloca ANTES de pintar, así no hay un fotograma
     con la cinta descolocada al empezar cada tanda. */
  useLayoutEffect(recolocar, [indice, texto, recolocar]);

  /* Y también cuando el contenedor cambia de tamaño: es lo que rescata el caso del ancho
     cero al montar, y de paso mantiene el cursor centrado al redimensionar la ventana. */
  useLayoutEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(() => recolocar());
    observador.observe(contenedor);
    return () => observador.disconnect();
  }, [recolocar]);

  const colorDe = (i: number) => {
    if (i < indice) {
      if (errores.has(i)) return esOscuro ? 'var(--color-dificil)' : '#E11D48';
      return esOscuro ? 'var(--color-cian)' : '#059669';
    }
    if (i === indice) return esOscuro ? '#FFFFFF' : '#0F172A';
    return esOscuro ? 'var(--color-faint)' : '#CBD5E1';
  };

  return (
    <div
      ref={contenedorRef}
      className="relative overflow-hidden"
      style={{ height: TAMANO * 2.4 }}>
      <div
        ref={pistaRef}
        className="absolute left-0 flex whitespace-nowrap font-mono"
        style={{
          /* Sin transición CSS: la recolocación mide la posición REAL en pantalla, y
             durante una animación esa posición es un valor a medio camino — la medición
             siguiente corregiría de más y la cinta oscilaría. Salta de carácter en
             carácter, que es como se comportan las cintas de TypingClub y typing.com. */
          top: '50%',
          fontSize: TAMANO,
          fontWeight: masGruesa ? 500 : 400,
          letterSpacing: '0.06em',
          transform: `translateY(-50%) translateX(${-desplazamiento}px)`,
        }}>
        {texto.split('').map((char, i) => (
          <span
            key={i}
            ref={i === indice ? cursorRef : undefined}
            style={{
              color: colorDe(i),
              /* El cursor es un bloque detrás de la letra, no un subrayado: a este tamaño
                 y con el texto moviéndose, una barra fina se pierde.

                 En CIAN TRANSLÚCIDO, no en dorado macizo. El dorado es el color de las
                 estrellas y las recompensas; usarlo también para "estás acá" hacía que el
                 cursor pareciera un premio, y encima opaco tapaba la letra de debajo —
                 justo la que hay que leer. El cian al 18% es el mismo tono que ya marca la
                 tecla esperada en el teclado: un solo lenguaje para "esto es lo que toca
                 ahora". */
              background: i === indice
                ? (esOscuro ? 'rgba(0,241,253,0.18)' : 'rgba(5,150,105,0.14)')
                : undefined,
              borderRadius: i === indice ? 4 : undefined,
              boxShadow: i === indice
                ? `inset 0 -3px 0 ${esOscuro ? 'var(--color-cian)' : '#059669'}`
                : undefined,
              // El espacio necesita ancho propio para que el cursor se vea sobre él.
              minWidth: char === ' ' ? '0.6em' : undefined,
              display: char === ' ' ? 'inline-block' : undefined,
            }}>
            {char}
          </span>
        ))}
      </div>

      {/* Difuminado en los bordes: sin esto el texto aparece y desaparece de golpe contra
          el borde de la tarjeta, y se lee como un corte y no como una cinta. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12"
        style={{ background: 'linear-gradient(to right, var(--sup), transparent)' }} />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16"
        style={{ background: 'linear-gradient(to left, var(--sup), transparent)' }} />
    </div>
  );
};

export default VistaCinta;
