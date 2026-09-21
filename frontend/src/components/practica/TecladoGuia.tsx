import { useEffect, useRef, type CSSProperties } from 'react';
import {
  FILAS, SANGRIA_FILA, COLOR_DEDO, NOMBRE_DEDO, BASE_ACENTUADA, teclaDe, necesitaShift,
  shiftContrarioDe, type Dedo, type Tecla,
} from './tecladoLayout';

// Geometría del dibujo. Con anchos fijos las columnas se alinean entre filas.
const ANCHO_TECLA = 40;
const GAP = 6;

/* Escalonado de cada fila, en fracciones de tecla. Son las medidas de un teclado físico:
   cada fila arranca corrida respecto de la de arriba, y por eso la mano cae en diagonal.
   Sin el escalonado el dibujo es una grilla, y una grilla enseña posiciones que no
   existen en el teclado real.

   ⚠️ LA FILA INFERIOR VA EN 0 Y NO EN 1.15, y no es un descuido: su sangría la produce
   ahora el propio Shift izquierdo, que en un teclado real arranca al ras del borde, a la
   misma altura que el 1 de la fila de números. Al añadir el Shift con la sangría antigua
   la fila entera se corrió y la Z quedaba debajo de la D en vez de debajo de la A —que es
   justo la posición que este dibujo existe para enseñar—. El ancho del Shift está
   calculado para dejar la Z donde estaba: ver la nota de MAYUS-IZQ en tecladoLayout. */
interface Props {
  // El carácter que toca escribir. Vacío = no resaltar nada (modo ciego, dictado).
  caracterEsperado: string;
  // La tecla que se acaba de errar, en mayúscula. Vacío = ninguna.
  teclaError: string;
  /* La que se acaba de pulsar, en mayúscula, durante 100 ms. Era un destello que solo
     existía en la apariencia clara del teclado viejo; acá vale para las dos, porque ver
     que la pulsación se registró es lo que hace que el teclado se sienta vivo. */
  teclaPulsada: string;
  esOscuro: boolean;
  // Colores por dedo encendidos. Es preferencia del usuario, no del ejercicio.
  guiaDedos: boolean;
  onAlternarGuia: () => void;
  /* Etiquetas de las teclas que este ejercicio realmente usa; el resto se apaga. null =
     no apagar ninguna, que es lo que corresponde cuando no se puede mirar el texto (modo
     ciego y dictado): ahí el conjunto de letras delataría el contenido. */
  conjuntoActivo: Set<string> | null;
  /* Modo ciego, y SOLO ahí: el error no se pinta de rojo. El mismo gris neutro que ya
     usa una tecla pulsada que no era la esperada — pedido explícito del usuario, para no
     castigar con el color más agresivo del teclado justo en el ejercicio pensado para
     escribir sin mirar. Default false: el resto del Curso conserva el rojo. */
  sinRojoDeError?: boolean;
  /* Sube en cada intento fallido de la mayúscula gratis. Tiembla y parpadea la tecla de
     la letra esperada Y la del Shift contrario, juntas — es la respuesta a "insistí y no
     pasó nada": señala EXACTAMENTE las dos teclas que hay que pulsar a la vez, en vez de
     solo el destello rojo genérico de `teclaError` (que marca la tecla que SÍ apretaste,
     no las que faltan). undefined o sin cambios = quieto. */
  sacudidaSello?: number;
  /* MODO DEMOSTRACIÓN (IntroPalabrasBase, "Palabras de la línea base"): índice de fila en
     `FILAS` a resaltar (2 = central), ignorando caracterEsperado/teclaError/teclaPulsada
     por completo. Las teclas de esa fila laten en cian; el resto se apaga con opacidad, no
     con un overlay aparte — es el mismo lenguaje que ya usa TutorialTeclas para "lo que no
     toca todavía". undefined = comportamiento normal de práctica. */
  filaResaltada?: number;
  // Oculta la cabecera (dedo esperado + el botón de colores de dedo): no hay nada que
  // decir ahí en modo demostración, donde no se está tecleando ningún carácter puntual.
  ocultarCabecera?: boolean;
}

/* El teclado de ayuda del Curso, con guía de dedos.

   Lo que había antes eran tres filas de letras (sin números, sin espacio, sin signos) que
   resaltaban la próxima tecla en cian. Servía para ubicar la tecla, pero no enseñaba
   mecanografía: no decía con QUÉ DEDO se pulsa, que es justamente lo que distingue
   escribir al tacto de buscar la letra con la vista. Es el elemento central de TypingClub
   y de typing.com, y era lo que más se extrañaba acá.

   Tres agregados sobre el anterior:
   - color por dedo (cuatro colores espejados entre manos — ver tecladoLayout),
   - la fila de números y la barra espaciadora, que directamente no existían,
   - el relieve de F y J, que es el ancla de la posición de reposo. */
const TecladoGuia = ({
  caracterEsperado, teclaError, teclaPulsada, esOscuro, guiaDedos, onAlternarGuia,
  conjuntoActivo, sinRojoDeError = false, sacudidaSello, filaResaltada, ocultarCabecera = false,
}: Props) => {
  // Cada tecla física tiene su propia etiqueta (los dos Shift incluidos: 'MAYUS-IZQ' y
  // 'MAYUS-DER' son etiquetas distintas), así que un nodo por etiqueta alcanza.
  const tileRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const primerRenderSacudidaRef = useRef(true);
  /* LAS TECLAS DE ESTE EJERCICIO SE MARCAN; LAS DEMÁS NO SE APAGAN.

     La primera versión hacía lo contrario —atenuaba todo lo que el ejercicio no usa— y
     estaba mal por una razón concreta: los 29 ejercicios de Básico son drills de dos
     letras, así que el teclado habría quedado con dos teclas vivas y cuarenta muertas
     durante el nivel entero. Justo el nivel donde el mapa de colores por dedo es lo que
     hay que aprender. Marcar suma información sin quitar ninguna.

     El tope de 14 teclas es lo que hace que esto exista "solo en las prácticas con
     letras", sin necesidad de mirar el tipo de ejercicio: un drill de f/j marca 3 teclas y
     se lee de un vistazo; una oración usa casi todo el teclado y marcarlo entero no
     diría nada, así que ahí no se marca nada. El límite lo pone el propio contenido. */
  const MAX_TECLAS_MARCABLES = 14;
  const marcarActivas = conjuntoActivo !== null && conjuntoActivo.size <= MAX_TECLAS_MARCABLES;
  const esDelEjercicio = (t: Tecla) => marcarActivas && conjuntoActivo!.has(t.etiqueta);

  const etiquetaEsperada = teclaDe(caracterEsperado);
  const mayusEsperada = caracterEsperado.toUpperCase();

  /* Una vocal acentuada son DOS pulsaciones: ´ y después la vocal. Se resalta la tecla
     muerta en segundo plano para que se entienda la secuencia; sin esto, pedir "á"
     encendía la A y el usuario no tenía cómo saber de dónde sale la tilde. */
  const necesitaAcento = Boolean(BASE_ACENTUADA[mayusEsperada]) && mayusEsperada !== 'Ü';
  const conShift = necesitaShift(caracterEsperado);
  // Cuál de los dos Shift hay que pulsar: siempre el de la mano contraria.
  const shiftEsperado = shiftContrarioDe(caracterEsperado);

  /* El golpe/temblor de un intento fallido de la mayúscula gratis, sobre las DOS teclas
     que hacen falta a la vez: la letra y su Shift contrario. Mismo patrón que
     `destellarFallo` en TutorialTeclas — cancelar antes de relanzar, para que dos fallos
     seguidos no se apilen. */
  useEffect(() => {
    if (primerRenderSacudidaRef.current) {
      primerRenderSacudidaRef.current = false;
      return;
    }
    if (!sacudidaSello) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const etiquetas = [etiquetaEsperada, shiftEsperado].filter((e): e is string => Boolean(e));
    for (const etiqueta of etiquetas) {
      const el = tileRefs.current.get(etiqueta);
      if (!el || typeof el.animate !== 'function') continue;
      el.getAnimations().forEach((a) => a.cancel());
      el.animate(
        [
          { transform: 'translateX(0)', opacity: 1 },
          { transform: 'translateX(-4px)', opacity: 0.35, offset: 0.2 },
          { transform: 'translateX(4px)', opacity: 1, offset: 0.4 },
          { transform: 'translateX(-3px)', opacity: 0.5, offset: 0.6 },
          { transform: 'translateX(3px)', opacity: 1, offset: 0.8 },
          { transform: 'translateX(0)', opacity: 1 },
        ],
        { duration: 320, easing: 'ease-out' },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sacudidaSello]);

  const dedoEsperado: Dedo | null = etiquetaEsperada
    ? (FILAS.flat().find((t) => t.etiqueta === etiquetaEsperada)?.dedo ?? null)
    : null;
  const manoEsperada = etiquetaEsperada
    ? FILAS.flat().find((t) => t.etiqueta === etiquetaEsperada)?.mano
    : null;

  const estiloTecla = (t: Tecla, fi: number): CSSProperties => {
    /* Modo demostración: nada de lo que sigue (esperada, error, pulsada, dedo) tiene
       sentido acá, así que corta antes de leer ninguna de esas props. */
    if (filaResaltada !== undefined) {
      const base: CSSProperties = {
        width: ANCHO_TECLA * (t.ancho ?? 1) + GAP * ((t.ancho ?? 1) - 1),
        flexShrink: 0,
      };
      if (fi === filaResaltada) {
        return {
          ...base,
          borderColor: 'var(--color-cian)',
          background: 'rgba(0,241,253,0.14)',
          color: 'var(--color-cian)',
        };
      }
      // Apagadas con opacidad, mismo lenguaje que TutorialTeclas usa para "todavía no".
      return { ...base, opacity: 0.28 };
    }

    const esEsperada = etiquetaEsperada === t.etiqueta;
    const esError = teclaError === t.etiqueta;
    const esAcentoPendiente = necesitaAcento && t.etiqueta === '´';
    const esShiftEsperado = shiftEsperado === t.etiqueta;

    /* Ancho FIJO por tecla, no flexible. Con flex-grow cada fila repartía el mismo ancho
       total entre distinta cantidad de teclas, así que las de la fila de números salían
       más angostas que las de la fila central y las columnas no se alineaban: la Q no
       caía sobre la A. Un teclado en el que las columnas no coinciden no sirve para
       aprender dónde está cada tecla, que es justamente para lo que está dibujado. */
    const base: CSSProperties = {
      width: ANCHO_TECLA * (t.ancho ?? 1) + GAP * ((t.ancho ?? 1) - 1),
      flexShrink: 0,
    };

    if (esError) {
      if (sinRojoDeError) {
        return { ...base, borderColor: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.10)' };
      }
      return { ...base, borderColor: 'var(--color-dificil)', background: 'rgba(255,0,4,0.15)', color: 'var(--color-dificil)' };
    }
    /* El destello de la tecla recién pulsada va DESPUÉS del error y ANTES de la esperada:
       si ganara a la esperada, acertar apagaría el resaltado de la siguiente durante 100 ms
       y el teclado parpadearía en cada letra. */
    if (teclaPulsada === t.etiqueta && !esEsperada) {
      return { ...base, borderColor: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.10)' };
    }
    if (esEsperada) {
      /* CIAN MACIZO CON LETRA OSCURA, no un cian translúcido con letra cian.

         La primera versión pintaba el fondo al 18% y la letra en cian: contra un teclado
         donde TODAS las teclas ya tienen un tinte de color, ese resaltado quedaba a la
         par del resto y había que buscarlo. El problema no era el tono sino que competía
         en la misma liga que los demás.

         Ahora la tecla que toca es la única del teclado con relleno sólido y texto
         oscuro, y además crece un poco y saca un halo. Es un cambio de CATEGORÍA visual,
         no de intensidad: ninguna otra tecla puede parecerse a esta por mucho color de
         dedo que tenga. El par cian/fondo-oscuro es el mismo que ya usan los botones
         principales de la app. */
      return {
        ...base,
        borderColor: 'var(--color-cian)',
        background: 'var(--color-cian)',
        color: 'var(--color-ground)',
        transform: 'scale(1.10)',
        boxShadow: '0 0 0 5px rgba(0,241,253,0.18), 0 4px 14px rgba(0,241,253,0.35)',
        zIndex: 2,
      };
    }
    if (esAcentoPendiente) {
      return { ...base, borderColor: 'var(--color-cian)', background: 'rgba(0,241,253,0.06)', color: 'var(--color-cian)' };
    }
    /* El Shift se enciende FUERTE pero sin el relleno macizo de la tecla esperada: las dos
       se pulsan a la vez, así que tienen que verse como un par y no como dos instrucciones
       en competencia. Misma familia de color, distinta jerarquía. */
    if (esShiftEsperado) {
      return {
        ...base,
        borderColor: 'var(--color-cian)',
        background: 'rgba(0,241,253,0.22)',
        color: 'var(--color-cian)',
        boxShadow: '0 0 0 3px rgba(0,241,253,0.14)',
      };
    }

    if (guiaDedos) {
      const color = COLOR_DEDO[t.dedo];
      // Una tecla del ejercicio lleva su color de dedo más marcado, además del punto.
      const delEjercicio = esDelEjercicio(t);
      return {
        ...base,
        /* Tinte bajo: el teclado tiene que seguir leyéndose como teclado, no como una
           paleta. Al 12% los cinco colores no se distinguían entre sí sobre el fondo
           oscuro — probado en pantalla; al 22% se separan y la letra sigue legible. */
        borderColor: `color-mix(in oklab, ${color} ${delEjercicio ? 100 : 60}%, transparent)`,
        background: `color-mix(in oklab, ${color} ${delEjercicio ? 34 : 22}%, transparent)`,
        color: esOscuro ? '#FFFFFF' : '#334155',
      };
    }
    // Sin colores de dedo, la marca del ejercicio se sostiene sola con el borde.
    if (esDelEjercicio(t)) {
      return { ...base, borderColor: esOscuro ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.35)' };
    }
    return base;
  };

  const claseBase = esOscuro
    ? 'border-white/7 bg-carta text-gris-texto'
    : 'border-slate-200 bg-white text-slate-700';

  return (
    <div className="rounded-2xl border border-(--sup-borde) bg-(--sup) p-6"
      style={{ boxShadow: 'var(--sup-sombra)' }}>

      {/* Qué dedo toca. Es la mitad pedagógica del asunto: el resaltado dice DÓNDE, esto
          dice CON QUÉ, y sin decirlo en palabras un color no significa nada la primera vez. */}
      {!ocultarCabecera && (
      <div className="mb-4 flex min-h-8 flex-wrap items-center justify-between gap-3">
        {dedoEsperado && manoEsperada ? (
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full"
              style={{ background: COLOR_DEDO[dedoEsperado] }} />
            <span className="text-sm font-bold text-(--sup-texto)">
              {/* El pulgar va SIN mano: la barra espaciadora se pulsa con el pulgar que a
                  cada uno le quede cómodo, y decir "pulgar derecho" sería inventar una
                  regla que la mecanografía no tiene. Para el resto la mano sí es parte de
                  la instrucción — la J es del índice DERECHO y la F del izquierdo. */}
              {NOMBRE_DEDO[dedoEsperado]}
              {dedoEsperado !== 'pulgar' && (manoEsperada === 'izquierda' ? ' izquierdo' : ' derecho')}
            </span>
            {conShift && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ background: 'rgba(191,129,255,0.15)', color: 'var(--color-medio)' }}>
                + Shift {shiftEsperado === 'MAYUS-IZQ' ? 'izquierdo' : 'derecho'}, a la vez
              </span>
            )}
            {necesitaAcento && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ background: 'rgba(0,241,253,0.12)', color: 'var(--color-cian)' }}>
                primero ´
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-(--sup-tenue)">&nbsp;</span>
        )}

        <button
          onClick={onAlternarGuia}
          aria-pressed={guiaDedos}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-all active:scale-95 ${
            guiaDedos
              ? (esOscuro ? 'border-cian/40 bg-cian/10 text-cian' : 'border-emerald-400 bg-emerald-50 text-emerald-600')
              : (esOscuro ? 'border-white/10 bg-carta text-gris-texto hover:text-white' : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600')
          }`}>
          {guiaDedos ? 'Colores de dedo: sí' : 'Colores de dedo: no'}
        </button>
      </div>
      )}

      {/* overflow-x-auto: en una pantalla angosta el teclado no se deforma ni empuja el
          resto de la página — se desplaza dentro de su propia caja. */}
      <div className="overflow-x-auto">
      <div className="mx-auto flex w-fit flex-col gap-1.5">
        {FILAS.map((fila, fi) => (
          <div key={fi} className="flex" style={{ gap: GAP, marginLeft: SANGRIA_FILA[fi] * (ANCHO_TECLA + GAP) }}>
            {fila.map((t) => (
              <div
                key={t.etiqueta}
                ref={(el) => {
                  if (el) tileRefs.current.set(t.etiqueta, el);
                  else tileRefs.current.delete(t.etiqueta);
                }}
                style={estiloTecla(t, fi)}
                className={`relative flex h-11 items-center justify-center rounded-lg border text-xs font-bold transition-all ${claseBase} ${
                  filaResaltada === fi ? 'destello-tecla-fila' : ''
                }`}>
                {t.etiqueta === 'espacio' ? ''
                  : t.etiqueta.startsWith('MAYUS') ? 'Shift' : t.etiqueta}

                {/* El relieve de F y J: una rayita, como la del teclado real. NO se mueve
                    de sitio según el ejercicio, aunque la idea de moverlo a S/L era
                    tentadora: esa marca representa un relieve FÍSICO que existe en el
                    teclado que el usuario tiene delante, y ponerla en otra tecla enseñaría
                    una referencia falsa justo al que todavía busca la posición de reposo
                    con los dedos. Lo que sí cambia por ejercicio es el punto de abajo. */}
                {t.conRelieve && (
                  <span className="absolute bottom-1.5 h-0.5 w-3 rounded-full bg-current opacity-50" />
                )}

                {/* Punto de "esta tecla es de este ejercicio". Va ARRIBA, para no chocar
                    con el relieve de F y J cuando ambos coinciden — que es exactamente lo
                    que pasa en el primer ejercicio del curso. */}
                {esDelEjercicio(t) && (
                  <span className="absolute top-1 h-1 w-1 rounded-full bg-current opacity-80" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      </div>

      {guiaDedos && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {(['menique', 'anular', 'medio', 'indice', 'pulgar'] as Dedo[]).map((d) => (
            <span key={d} className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-(--sup-tenue)">
              <span className="h-2 w-2 rounded-full" style={{ background: COLOR_DEDO[d] }} />
              {NOMBRE_DEDO[d]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default TecladoGuia;
