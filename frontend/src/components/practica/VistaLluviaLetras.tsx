import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icono from '../ui/Icono';
import IntroLluvia from './IntroLluvia';
import { filaDe, NOMBRE_FILA } from './tecladoLayout';

interface Props {
  /* Cola de tokens separados por espacio: letras sueltas, o letras+palabras.
     Si trae SALTOS DE LÍNEA son TRAMOS: la partida se reparte entre ellos en partes iguales
     y cada uno se anuncia con sus teclas — ver TRAMOS, más abajo. */
  texto: string;
  esOscuro?: boolean;
  onKeystroke: (correcta: boolean) => void;
  onIniciar: () => void;
  /* Se llama al terminar la partida, sea por perder un carril o por sobrevivir el tiempo
     pedido. Lleva la racha más larga de aciertos seguidos que hubo en la partida, para
     que Resultados la muestre, y si el final fue por SOBREVIVIR el tiempo (no por perder
     un carril) — el padre lo necesita para reportar la duración exacta en vez de la
     medida, que puede quedar unas centésimas corta por el desfase entre el reloj del
     juego (por fotogramas) y el reloj de la sesión (por wall-clock). */
  onPerder: (mejorRacha: number, sobrevivioElTiempo: boolean) => void;
  /* Segundos que hay que sobrevivir. Sin esto la partida solo terminaba PERDIENDO —se
     llenaba una columna— y alguien flojo en el juego se quedaba atascado en un nodo del
     Curso. Ausente en Ejercicios Base, donde la lluvia se juega suelta: ahí perder ES el
     final y ponerle reloj le quitaría la gracia. */
  duracionSegundos?: number;
  /* Cuántas teclas equivocadas aguanta la partida. Ausente = sin tope, que es como se
     juega en Ejercicios Base y en los niveles que sirven palabras. Ver la nota de las
     reservas más abajo. */
  reservas?: number;
}

interface ItemCayendo {
  letra: string;
  progreso: number;
  y: number;
  id: number;
  // Cae al doble. Va marcada en dorado y latiendo: ver la nota en el render.
  rapida: boolean;
  /* Entró como PREMIO a ir retrasado (todas las de pantalla habían pasado el umbral) y por
     eso NO ocupa cupo: ver la nota de UMBRAL_EXTRA. */
  extra: boolean;
}

const NUM_COLUMNAS = 5;

/* GEOMETRÍA. Los carriles crecieron dos veces por lo mismo: en pantalla ancha el juego se
   veía como una miniatura. De 240 a 360 px de alto y de 64 a 96 de ancho primero; y el
   10-sep-2026, con una captura del usuario donde sobraba casi media pantalla por debajo, la
   ALTURA dejó de ser un número fijo: se MIDE el espacio libre desde el borde superior de la
   pista hasta el pie de la ventana, y se toma entero menos un margen.

   Medirla no cambia la dificultad, y por eso se puede: todas las velocidades se expresan en
   SEGUNDOS DE CAÍDA y se derivan de la altura (ver RITMO). En una pantalla alta la letra
   recorre más píxeles en el mismo tiempo; lo que el jugador tiene para reaccionar es igual.

   Se mide UNA vez por partida, al cerrar la explicación, y no al redimensionar: una letra
   guardada en píxeles cambiaría de sitio relativo a mitad de su caída.

   ⚠️ EL TOPE ES 500, decisión del usuario tras verlo: medida sin techo, en su pantalla la
   pista llegaba a ~655 px y la página hacía scroll — "demasiado grande". Con 500 de máximo
   su pantalla queda en 500 justos y una más baja se sigue achicando sola hasta 360. */
const ALTURA_MINIMA = 360;     // px: la de antes, para pantallas bajas
const ALTURA_MAXIMA = 500;     // px: pedido del usuario; con 680 sobraba pista
const MARGEN_INFERIOR = 120;   // px: el pie de la tarjeta y un respiro hasta el borde
const ANCHO_CARRIL = 110;      // px: era 96; 128 le pareció ancho de más al usuario
/* 36 y no los 30 del resto del Curso: con carriles más anchos y casi la mitad más altos, la
   letra a 30 volvía a verse pequeña dentro de su túnel. El usuario la dio por buena. */
const TAMANO_LETRA = 36;

/* TRES VIDAS POR CARRIL, y se pierde en cuanto UNO llega a tres — aunque los otros cuatro
   estén intactos. Es lo que obliga a repartir la atención en vez de acampar en una columna.

   La alternativa que se descartó era bloquear el carril tras dos golpes y hacer llover solo
   por los demás: eso hace el juego MÁS FÁCIL cuanto peor lo haces (menos carriles que
   vigilar), o sea que premia fallar. */
const GOLPES_MAX = 3;

/* RITMO.

   La primera versión era una recta: 40 px/s más 2 por segundo, sobre 220 px de pista. En
   treinta segundos solo llegaba a 100 px/s, y como además no subía a dos letras
   simultáneas hasta el segundo 18, una ronda de quince daba once letras como mucho. Once
   caracteres en quince segundos son 8,8 WPM contra los 10 que pedía el nodo: era
   imposible de aprobar jugando perfecto.

   Ahora la aceleración es COMPUESTA — un 5% sobre la velocidad del segundo anterior — y
   eso cambia la forma de la partida: al principio hay tiempo de sobra y al final aprieta
   de verdad, que es lo que un juego de supervivencia necesita. Una recta reparte la misma
   dificultad de principio a fin.

   ⚠️ EL SUELO DE CAÍDA ES LO QUE LA HACE JUGABLE. Sin tope, el 5% compuesto llega a 393
   px/s en el segundo 30: la letra cae en 0,6 s y la rápida en 0,3 s. El tiempo de reacción
   visual de una persona ronda los 0,25 s, así que esa letra rápida no sería difícil sino
   IMPOSIBLE de tocar aunque se estuviera mirando.

   El límite se expresa en SEGUNDOS DE CAÍDA y no en px/s porque lo que importa es cuánto
   tiempo tiene el jugador para reaccionar; así sigue siendo correcto si cambia la altura de
   la pista. Con los valores de hoy el tope entra en el segundo 23, o sea que tres cuartas
   partes de la ronda corren con la aceleración libre. */
/* TODO se expresa en SEGUNDOS DE CAÍDA y la velocidad se deriva de la altura de la pista.
   Al revés —constantes en px/s— agrandar la pista de 240 a 360 px habría hecho el juego un
   50% más fácil sin que nadie tocara la dificultad, porque la letra tardaría medio segundo
   más en llegar abajo. Lo que el jugador percibe es el tiempo que tiene para reaccionar, y
   es eso lo que se fija acá. */
const CAIDA_MINIMA_SEGUNDOS = 0.85;
const CAIDA_MINIMA_RAPIDA_SEGUNDOS = 0.55;
const MULTIPLICADOR_RAPIDA = 2;

/* Crecimiento PROGRESIVO: la tasa misma sube con el tiempo, en vez de ser fija.

   Es la forma que pidió el usuario y es la correcta para una ronda de supervivencia: una
   rampa suave al principio —donde un principiante todavía está buscando las teclas— y
   presión creciente hasta la última letra, sin la meseta que deja un porcentaje fijo al
   chocar contra CAIDA_MINIMA_SEGUNDOS.

   Se precalcula porque el factor acumulado es un producto: recorrer la serie entera en
   cada frame sería hacerlo sesenta veces por segundo. Y se interpola entre segundos
   enteros — sin eso la velocidad pega un tirón al cruzar cada segundo, que es justo lo que
   hace que un juego de caída se sienta roto. */
const curvaProgresiva = (tasaInicial: number, subePorSegundo: number, desde = 2) => {
  const tabla = [1];
  for (let seg = 1; seg <= 180; seg++) {
    const tasa = seg < desde ? 0 : tasaInicial + subePorSegundo * (seg - desde);
    tabla[seg] = tabla[seg - 1] * (1 + tasa / 100);
  }
  return (segundos: number) => {
    /* El suelo en 0 evita indexar la tabla en -1, que devolvía `undefined` y contagiaba un
       NaN a toda la cadena de la velocidad. Se arregla acá ADEMÁS de topar el dt: son dos
       defensas para el mismo fallo, y esta protege también a cualquier llamada futura. */
    const i = Math.max(0, Math.min(Math.floor(segundos), tabla.length - 2));
    const frac = Math.min(1, Math.max(0, segundos - i));
    return tabla[i] + (tabla[i + 1] - tabla[i]) * frac;
  };
};

/* LA CURVA DE CAÍDA, elegida por el usuario el 10-sep-2026: 2,8 s de arranque y una tasa
   del 0,5% que sube 0,08 cada segundo. La letra tarda 2,7 s en caer a los 5 s de partida,
   2,2 s a los 20 y 1,8 s a los 30.

   Sustituye a las dos que se comparaban con un selector de desarrollo (A: 2,2 s · 1%, y B:
   2,2 s · 1,5%), y el motivo está medido: desde el 5-sep el usuario —65 WPM en noticias—
   sobrevivía 11 de cada 33 partidas de Básico, y ninguna de las 4 de "los dedos que bajan".
   Si pierde dos de cada tres alguien que ya sabe teclear, un novato no tiene opción.

   ⚠️ Y LA NOTA QUE HABÍA AQUÍ YA LO AVISABA. Al pasar del reloj a la POBLACIÓN (dos letras
   siempre en pantalla, relleno inmediato) el juego empezó a servir un 60% más de letras, y
   la nota decía que la caída inicial "tuvo que subir de 2,2 a 3,2 s" — pero los dos perfiles
   seguían en 2,2. La recalibración se escribió y nunca se aplicó. La lección vale para la
   próxima: cambiar la regla de aparición OBLIGA a recalibrar la curva en el mismo cambio.

   No hay simulación para estos números: el simulador de la tabla vieja no está en el
   repositorio. Se juzgan jugando. */
const CAIDA_INICIAL_SEGUNDOS = 2.8;
const factorCaida = curvaProgresiva(0.5, 0.08);

/* CUÁNTAS LETRAS PUEDE HABER A LA VEZ, y cada cuánto entra una.

   Antes la regla era "una sola, y la siguiente no entra hasta que la pista quede vacía".
   Eso tenía una consecuencia que no se veía en ningún número: el juego era IMPOSIBLE DE
   PERDER para alguien competente, porque el ritmo lo marcaba el propio jugador. No podía
   desbordarte. La aceleración solo acortaba la ventana de reacción sobre una letra suelta,
   que es un problema distinto y mucho más chico.

   Ahora las letras entran por reloj, se acumulen o no, con un tope de cuántas pueden estar
   cayendo al mismo tiempo. Ese tope es la dificultad de verdad.

   El intervalo se DERIVA del tiempo de caída, y no es un número aparte, por una identidad
   que conviene tener a la vista:

       letras en pantalla = tiempo de caída ÷ intervalo entre apariciones

   O sea que pedir tres en pantalla obliga a un intervalo de un tercio de la caída. Si la
   caída se acelera, el intervalo se aprieta con ella y la exigencia sube al cuadrado: por
   eso acelerar mucho Y querer tres letras son objetivos que se pelean. */
/* DOS, y no tres. Se probó el escalón a tres en el segundo 20 y la aritmética de arriba lo
   desaconseja sola: con tres en pantalla el intervalo cae a un tercio de la caída y el
   juego pasa a exigir más de 40 palabras por minuto sostenidas — en un nodo donde el
   alumno acaba de aprender cuatro teclas. Dos dan flujo continuo desde el primer segundo,
   que es lo que hacía falta, sin convertir el repaso en un examen de reflejos. */
const SIMULTANEAS = 2;

/* SEPARACIÓN entre una letra y la siguiente. No es un intervalo de aparición —las letras ya
   no entran por reloj— sino el mínimo que se respeta entre dos, para que nunca aparezcan en
   el mismo instante y la pareja se lea como "una y luego la otra". */
const SEPARACION_MINIMA = 200; // ms

/* La letra EXTRA: cuándo entra una de más, y por qué no ocupa cupo.

   Entra cuando TODAS las que están cayendo pasaron este punto de la pista, o sea que están
   a punto de aterrizar y la parte de arriba quedó libre. Es una escalada que castiga ir
   retrasado: si limpias a tiempo no la ves nunca.

   FUERA DEL CUPO, y esto es lo que la hace funcionar. Contándola, al limpiar las dos de
   abajo entraba UNA sola letra nueva —porque la extra ya ocupaba uno de los dos sitios— y
   el premio por ir retrasado terminaba siendo un descanso. Ahora el cupo de dos se cuenta
   solo entre las normales, así que quedan tres en pantalla: las dos del cupo más la extra.

   Y la regla se reaplica: si esas tres vuelven a pasar el umbral, entra una cuarta. En la
   práctica casi no ocurre —medido, 0,01 segundos por partida— porque exige que TODAS estén
   abajo a la vez, y cuantas más haya, menos probable es. */
const UMBRAL_EXTRA = 0.70;

/* Tope duro de letras en pantalla. La regla de arriba se autolimita sola, pero un tope
   explícito evita que un caso raro llene los cinco carriles y deje la pista ilegible. */
const MAX_EN_PANTALLA = 4;

/* Techo del salto de tiempo entre frames.

   `requestAnimationFrame` NO corre con la pestaña en segundo plano, así que al volver el
   primer frame trae todo el tiempo transcurrido de golpe. Sin techo eso hacía dos cosas, y
   las dos se vieron: las letras se teletransportaban al suelo cobrando vidas que el jugador
   nunca tuvo ocasión de defender, y `tiempoJuegoRef` saltaba por encima de los 30 segundos,
   con lo que la ronda TERMINABA SOLA al volver — se observó una partida cerrada con 0
   letras y el marcador en 1 segundo.

   Con el techo, mirar otra pestaña equivale a pausar: se pierde el tiempo real, no la
   partida. 50 ms son tres frames a 60 Hz, suficiente para absorber un tirón normal del
   navegador sin disimular una caída de rendimiento de verdad. */
const DT_MAXIMO = 50; // ms


const PROBABILIDAD_RAPIDA = 0.18;
const LETRAS_ANTES_DE_LA_PRIMERA_RAPIDA = 3;

/* LAS RESERVAS: el tope de teclas equivocadas (pedido del usuario, 10-sep-2026).

   Sin tope, aporrear el teclado limpiaba la pista sola: cualquier letra que cayera acababa
   acertada por pura estadística, y lo único que se perdía era precisión — que en un juego
   no se ve hasta el final. Cada tecla que no esté cayendo gasta una reserva, y el contador
   está a la vista desde el principio.

   AL QUEDARSE SIN RESERVAS LA PARTIDA ACABA, PERO NO DE GOLPE: el aviso sale encima de la
   pista y las letras siguen cayendo hasta que un carril se llena, que es el final de
   siempre. Lo que cambia es el ritmo — si pasara a los diez segundos de partida, con la
   caída todavía lenta, habría que esperar medio minuto viendo cómo se pierde. Así que las
   letras pasan a caer casi seguidas y MUY rápido en el carril más tocado (el rojo si lo
   hay; si no, el que tenga menos vidas): con tres vidas como mucho por llenar, la partida
   termina en un segundo y medio como mucho, por debajo de los dos que pidió el usuario.

   EL AVISO NO OFRECE NADA: ni Espacio para volver a empezar ni Enter para saltar. Los tuvo
   y el usuario los quitó —"es mucha info en un lapso de pocos segundos"—, y las teclas se
   ignoran también: un Espacio que reinicia sin decirlo es justo lo que se pulsa sin querer
   cuando se está aporreando, que es como se gasta la última reserva. */
/* 0,45 s por túnel: unas seis veces la velocidad del arranque (CAIDA_INICIAL_SEGUNDOS, 2,8).
   Empezó en 0,35 —seis veces el arranque de entonces, 2,2— y al usuario le gustó el efecto
   ("se ve bien y es gracioso") pero pidió bajarlo un poco para que se alcance a leer el
   aviso. */
const CAIDA_FINAL_SEGUNDOS = 0.45;
const SEPARACION_FINAL = 60;   // ms entre que una aterriza y entra la siguiente

/* TRAMOS. "Lluvia de repaso" (el cierre de Básico) divide su texto en tres secciones, una
   por fila del teclado, y la partida reparte la duración entre ellas: diez segundos de la
   fila del medio, diez de la de arriba y diez de la de abajo. Cada tramo se anuncia con un
   cartel que trae SUS CUATRO TECLAS, que es la parte que el usuario pidió expresamente —
   sin saber qué va a caer, una lluvia de las teclas que peor te salen es un examen sorpresa.

   El cartel NO pausa el juego: sale flotando sobre la pista mientras las primeras letras ya
   caen, igual que el aviso de quedarse sin reservas. Pausar cada diez segundos partiría en
   tres una partida que dura treinta.

   El resto de las lluvias del curso trae una sola sección y nada de esto se activa. */
const ANUNCIO_TRAMO_MS = 1800;

// El mismo salto de línea con el que el backend separa las tandas del resto del Curso.
const SALTO_DE_TRAMO = '\n';

/* Y el aviso se queda como mínimo esto antes de que la partida se cierre. Bajar la velocidad
   no alcanzaba solo: con un carril ya en rojo y una letra en el aire, el final llegaba en
   menos de medio segundo por lenta que cayera, y el aviso desaparecía antes de leerse. Con
   este piso el caso rápido espera a llegar aquí y el lento (tres vidas por llenar, ~1,5 s)
   no se alarga nada. */
const LECTURA_MINIMA_MS = 1200;

/* El carril que antes se llena: el que más golpes lleva entre los que siguen vivos. A
   igualdad, el primero por la izquierda — da igual cuál, y un criterio fijo no parpadea. */
const carrilDelFinal = (golpes: number[]): number => {
  let mejor = -1;
  golpes.forEach((n, i) => {
    if (n >= GOLPES_MAX) return;
    if (mejor === -1 || n > golpes[mejor]) mejor = i;
  });
  return mejor;
};

const VistaLluviaLetras = ({
  texto, esOscuro, onKeystroke, onIniciar, onPerder, duracionSegundos, reservas,
}: Props) => {
  const [columnas, setColumnas] = useState<(ItemCayendo | null)[]>(
    () => Array(NUM_COLUMNAS).fill(null));
  const [golpes, setGolpes] = useState<number[]>(() => Array(NUM_COLUMNAS).fill(0));
  const [racha, setRacha] = useState(0);
  /* La partida no arranca sola: primero se explica. Mientras esto sea true, ni el bucle de
     caída ni el teclado del juego corren — si el bucle siguiera por detrás, las primeras
     letras caerían mientras el usuario lee y llegaría al suelo antes de empezar. */
  const [enIntro, setEnIntro] = useState(true);
  const tramos = useMemo(
    () => texto.split(SALTO_DE_TRAMO).map((t) => t.trim()).filter(Boolean),
    [texto],
  );
  const hayTramos = tramos.length > 1;
  // Sin tramos vale 0 y el bucle ni lo mira: una sola sección no se reparte en el tiempo.
  const duracionTramo = hayTramos && duracionSegundos ? duracionSegundos / tramos.length : 0;
  const [tramoActual, setTramoActual] = useState(0);
  const tramoActualRef = useRef(0);
  // Lo que dice el cartel del tramo en curso. Null = no hay cartel puesto.
  const [anuncio, setAnuncio] = useState<{ fila: string; teclas: string[] } | null>(null);
  /* La altura medida de la pista (ver GEOMETRÍA). null mientras no se midió: el bucle no
     arranca hasta tenerla, o las primeras letras caerían con una altura y seguirían con
     otra. */
  const [alturaPista, setAlturaPista] = useState<number | null>(null);
  const pistaRef = useRef<HTMLDivElement | null>(null);
  const [reservasRestantes, setReservasRestantes] = useState(reservas ?? 0);
  const [sinReservas, setSinReservas] = useState(false);

  // Estado "vivo" en refs: el bucle de animación y el teclado leen y escriben acá directo,
  // y solo al final de cada evento se espeja a React para pintar. Nunca se llama setState
  // dentro del updater de otro setState.
  const columnasRef = useRef<(ItemCayendo | null)[]>(columnas);
  const golpesRef = useRef<number[]>(golpes);
  const rachaRef = useRef(0);
  // El pico de rachaRef: nunca baja, solo sube cuando un acierto supera la marca.
  const mejorRachaRef = useRef(0);
  const reservasRef = useRef(reservas ?? 0);
  const sinReservasRef = useRef(false);
  // El tiempo de juego en que se gastó la última reserva: cuenta LECTURA_MINIMA_MS.
  const sinReservasDesdeRef = useRef(0);
  const pildoraRef = useRef<HTMLSpanElement | null>(null);
  const perdidoRef = useRef(false);
  const iniciadoRef = useRef(false);
  const idSiguienteRef = useRef(0);
  const spawneadasRef = useRef(0);
  // Arranca en el mínimo para que la primera letra salga en el primer frame, sin espera.
  const desdeUltimoSpawnRef = useRef(SEPARACION_MINIMA);
  const tiempoJuegoRef = useRef(0);
  const ultimoFrameRef = useRef(0);
  const tokensRef = useRef<string[]>([]);
  const indiceTokenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  // Referencias a los carriles, para sacudirlos al recibir un golpe.
  const carrilesRef = useRef<(HTMLDivElement | null)[]>([]);

  /* Las teclas del tramo en curso, en el orden en que se anuncian. Se sacan del propio
     texto —no viajan aparte— y la FILA se deduce del teclado dibujado: el backend manda las
     letras y el front ya sabe dónde vive cada una. */
  const teclasDelTramo = useCallback((indice: number) => {
    const seccion = tramos[indice] ?? '';
    return [...new Set(seccion.split(' ').filter(Boolean))];
  }, [tramos]);

  const anuncioDelTramo = useCallback((indice: number) => {
    const teclas = teclasDelTramo(indice);
    const fila = teclas.length > 0 ? filaDe(teclas[0]) : null;
    return { fila: fila === null ? 'estas teclas' : NOMBRE_FILA[fila], teclas };
  }, [teclasDelTramo]);

  useEffect(() => {
    tokensRef.current = (tramos[tramoActual] ?? texto).split(' ').filter(Boolean);
    indiceTokenRef.current = 0;
  }, [texto, tramos, tramoActual]);

  // El cartel se va solo. Vive acá y no en el bucle para no depender de los fotogramas.
  useEffect(() => {
    if (!anuncio) return;
    const t = window.setTimeout(() => setAnuncio(null), ANUNCIO_TRAMO_MS);
    return () => window.clearTimeout(t);
  }, [anuncio]);

  // Se recicla la cola (barajada de nuevo) si se agota: el ejercicio no tiene un final
  // "natural" por contenido, termina por tiempo o por perder un carril.
  const siguienteToken = useCallback(() => {
    if (tokensRef.current.length === 0) return 'a';
    if (indiceTokenRef.current >= tokensRef.current.length) {
      tokensRef.current = [...tokensRef.current].sort(() => Math.random() - 0.5);
      indiceTokenRef.current = 0;
    }
    return tokensRef.current[indiceTokenRef.current++];
  }, []);

  /* La sacudida del carril al ser golpeado. Con la Web Animations API y no con una clase
     CSS porque hay que poder RE-disparar la misma animación en golpes seguidos: volver a
     poner una clase que ya está no reinicia nada, y quitarla y ponerla obliga a un ciclo de
     render en el medio. `animate()` arranca siempre. */
  const sacudirCarril = useCallback((col: number) => {
    const el = carrilesRef.current[col];
    if (!el || typeof el.animate !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(-3px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 260, easing: 'ease-in-out' },
    );
  }, []);

  /* `carril` fuerza dónde cae: lo usa el final sin reservas, que las manda todas al carril
     más tocado. Sin él, se sortea entre los libres. */
  const intentarSpawnear = useCallback((esExtra: boolean, carril?: number) => {
    const actuales = columnasRef.current;

    /* Carriles VACÍOS y vivos. El filtro por vacío no estaba y no hacía falta mientras solo
       podía caer una letra a la vez —la pista siempre estaba vacía al spawnear—; con varias
       simultáneas el sorteo podía tocar un carril ocupado y SOBRESCRIBIR la letra en vuelo,
       que desaparecía sin cobrarse ni acertarse. */
    const libres = actuales
      .map((_, i) => i)
      .filter((i) => actuales[i] === null && golpesRef.current[i] < GOLPES_MAX);
    if (libres.length === 0) return;
    if (carril !== undefined && !libres.includes(carril)) return;

    const col = carril ?? libres[Math.floor(Math.random() * libres.length)];
    spawneadasRef.current += 1;
    // En el final no hay doradas: ahí ya no se juega, solo se termina.
    const rapida = carril === undefined
      && spawneadasRef.current > LETRAS_ANTES_DE_LA_PRIMERA_RAPIDA
      && Math.random() < PROBABILIDAD_RAPIDA;

    const copia = [...actuales];
    copia[col] = {
      letra: siguienteToken(), progreso: 0, y: 0, id: idSiguienteRef.current++, rapida,
      extra: esExtra,
    };
    columnasRef.current = copia;
    setColumnas(copia);

    /* El cronómetro arranca con la PRIMERA LETRA y no con la primera tecla. Atado a la
       pulsación, el tiempo que tardabas en reaccionar a la primera letra era gratis: el
       marcador seguía en 0:00 mientras ya estaba cayendo, y quien dudaba dos segundos
       jugaba una ronda dos segundos más corta. */
    if (!iniciadoRef.current) { iniciadoRef.current = true; onIniciar(); }
  }, [siguienteToken, onIniciar]);

  /* El único sitio donde acaba una partida, sea por un carril lleno o por tiempo. El padre
     no distingue los finales a propósito (ver el cierre por tiempo en el bucle). */
  const acabar = useCallback((sobrevivioElTiempo: boolean) => {
    if (perdidoRef.current) return;
    perdidoRef.current = true;
    onPerder(mejorRachaRef.current, sobrevivioElTiempo);
  }, [onPerder]);

  /* El contador de reservas da un salto cada vez que se gasta una: el número solo cambia en
     un dígito y de reojo no se ve. Con la Web Animations API por lo mismo que la sacudida
     del carril —re-dispararla en fallos seguidos—, y cancelando la anterior: si no, se
     apilan (medido en el tutorial de palabras: tres a la vez sobre el mismo elemento). */
  const latirPildora = useCallback(() => {
    const el = pildoraRef.current;
    if (!el || typeof el.animate !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.getAnimations().forEach((a) => a.cancel());
    el.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }],
      { duration: 240, easing: 'ease-out' },
    );
  }, []);

  /* LA ALTURA DE LA PISTA, medida al cerrar la explicación (ver GEOMETRÍA). Temporizador y
     no requestAnimationFrame, y el ref leído DENTRO — las dos trampas de medir el DOM desde
     un efecto que ya costaron horas (CLAUDE.md, sección 8). Se mide contra el documento y
     no contra la ventana visible: al empezar la partida la página está arriba, y si el
     usuario hubiera bajado para leer la explicación la pista saldría del tamaño de ese
     scroll y no del de su pantalla. */
  useEffect(() => {
    if (enIntro) return;
    const t = window.setTimeout(() => {
      const el = pistaRef.current;
      const arriba = el ? el.getBoundingClientRect().top + window.scrollY : ALTURA_MINIMA;
      const libre = window.innerHeight - arriba - MARGEN_INFERIOR;
      setAlturaPista(Math.round(Math.min(ALTURA_MAXIMA, Math.max(ALTURA_MINIMA, libre))));
    }, 0);
    return () => window.clearTimeout(t);
  }, [enIntro]);

  // Bucle de caída, con tiempo real (no por frame) para no acelerarse ni frenarse si el
  // navegador saltea frames. El salto entre frames va topeado: ver DT_MAXIMO.
  useEffect(() => {
    if (enIntro || alturaPista === null) return;
    const ALTURA_PISTA = alturaPista;
    ultimoFrameRef.current = performance.now();

    const tick = (ahora: number) => {
      if (perdidoRef.current) return;
      /* El suelo de 0 NO es paranoia: `requestAnimationFrame` entrega el timestamp del
         INICIO del frame, que puede ser ANTERIOR al `performance.now()` que capturó el
         cuerpo del efecto. Cuando eso pasaba, el primer dt salía negativo y el juego se
         quedaba congelado para siempre — carriles dibujados y ni una letra— porque el
         tiempo negativo envenenaba la curva con un NaN que ya no se limpiaba solo.
         Intermitente por naturaleza: dependía de en qué punto del frame cayera el montaje,
         y por eso aparecía "a veces al recargar". */
      const dt = Math.max(0, Math.min(ahora - ultimoFrameRef.current, DT_MAXIMO));
      ultimoFrameRef.current = ahora;
      tiempoJuegoRef.current += dt;
      const segundos = tiempoJuegoRef.current / 1000;

      /* EL CAMBIO DE TRAMO lo decide el reloj del juego, no un temporizador aparte: el
         mismo que gobierna la velocidad de caída y el final de la partida, así que los
         tres cortes caen exactamente en los tercios de la duración pedida. */
      if (duracionTramo > 0) {
        const tramo = Math.min(tramos.length - 1, Math.floor(segundos / duracionTramo));
        if (tramo !== tramoActualRef.current) {
          tramoActualRef.current = tramo;
          setTramoActual(tramo);
          setAnuncio(anuncioDelTramo(tramo));
        }
      }

      /* La velocidad se deriva de la altura de la pista para que agrandar el juego no lo
         vuelva más fácil (ver la nota de la geometría). */
      const base = (ALTURA_PISTA / CAIDA_INICIAL_SEGUNDOS) * factorCaida(segundos);

      /* CUÁNTAS TIENE QUE HABER, en vez de cada cuánto entra una.

         El reloj de antes dejaba huecos: al limpiar una letra pronto, la siguiente tardaba
         media caída en aparecer y la pareja se veía siempre muy separada. Ahora la pista
         mantiene una POBLACIÓN —dos— y se rellena en cuanto se libera un sitio, sea porque
         la acertaste o porque tocó el suelo.

         ⚠️ NO es un cambio cosmético: medido, sirve un 60% más de letras a quien va justo,
         porque dejar caer una ya no regala el segundo de aire que regalaba el reloj. La
         exigencia pasa a marcarla el jugador, y por eso las curvas se recalibraron con esta
         regla puesta y no con la anterior. */
      const vivas = columnasRef.current.filter((c): c is ItemCayendo => c !== null);
      // El cupo se cuenta SOLO entre las normales: la extra no lo ocupa.
      const normales = vivas.filter((it) => !it.extra).length;
      const todasAbajo = vivas.length > 0
        && vivas.every((it) => it.y >= ALTURA_PISTA * UMBRAL_EXTRA);

      const faltaNormal = normales < SIMULTANEAS;
      const tocaExtra = !faltaNormal && todasAbajo;
      // Sin reservas: el final rápido. Ver la nota de las reservas, arriba.
      const enFinal = sinReservasRef.current;

      desdeUltimoSpawnRef.current += dt;
      if (enFinal) {
        /* Con un carril ya lleno no entra ninguna más: la partida está decidida y solo se
           espera a que el aviso cumpla su tiempo. Sin esto el final elegiría el siguiente
           carril vivo y seguiría llenándolo mientras tanto. */
        const decidida = golpesRef.current.some((n) => n >= GOLPES_MAX);
        const objetivo = decidida ? -1 : carrilDelFinal(golpesRef.current);
        if (objetivo !== -1 && desdeUltimoSpawnRef.current >= SEPARACION_FINAL
          && columnasRef.current[objetivo] === null) {
          desdeUltimoSpawnRef.current = 0;
          intentarSpawnear(false, objetivo);
        }
      } else if ((faltaNormal || tocaExtra)
        && vivas.length < MAX_EN_PANTALLA
        && desdeUltimoSpawnRef.current >= SEPARACION_MINIMA) {
        desdeUltimoSpawnRef.current = 0;
        intentarSpawnear(tocaExtra);
      }
      const actuales = columnasRef.current;
      const nuevasColumnas = actuales.map((item) => {
        if (!item) return item;
        // Se llamaba `tope` y tapaba al tope de concurrencia de arriba: dos cosas distintas
        // con el mismo nombre en el mismo bucle.
        const velocidadMaxima = ALTURA_PISTA / (item.rapida
          ? CAIDA_MINIMA_RAPIDA_SEGUNDOS : CAIDA_MINIMA_SEGUNDOS);
        /* En el final TODAS caen a la velocidad de cierre, también las que ya estaban en el
           aire: una letra lenta a medio carril alargaría justo la espera que se quiere
           quitar. */
        const velocidad = enFinal
          ? ALTURA_PISTA / CAIDA_FINAL_SEGUNDOS
          : Math.min(base * (item.rapida ? MULTIPLICADOR_RAPIDA : 1), velocidadMaxima);
        const nuevaY = item.y + velocidad * (dt / 1000);
        return nuevaY >= ALTURA_PISTA ? null : { ...item, y: nuevaY };
      });

      const aterrizaron = actuales.map((item, i) => item !== null && nuevasColumnas[i] === null);
      let nuevosGolpes = golpesRef.current;
      if (aterrizaron.some(Boolean)) {
        nuevosGolpes = golpesRef.current.map((n, i) => (aterrizaron[i] ? n + 1 : n));
        aterrizaron.forEach((fue, i) => { if (fue) sacudirCarril(i); });
        // Dejar caer una letra corta la racha, igual que fallar una tecla.
        rachaRef.current = 0;
        setRacha(0);
      }

      columnasRef.current = nuevasColumnas;
      golpesRef.current = nuevosGolpes;
      setColumnas(nuevasColumnas);
      setGolpes(nuevosGolpes);

      /* Un carril con tres golpes acaba la partida, estén como estén los otros. Sin reservas,
         no antes de que el aviso haya estado a la vista LECTURA_MINIMA_MS: hasta entonces el
         bucle sigue corriendo, pero ya no entra ninguna letra más (ver el spawn del final). */
      if (nuevosGolpes.some((n) => n >= GOLPES_MAX)) {
        const avisoLeido = !enFinal
          || tiempoJuegoRef.current - sinReservasDesdeRef.current >= LECTURA_MINIMA_MS;
        if (avisoLeido) {
          acabar(false);
          return;
        }
      }

      /* Sobreviviste el tiempo pedido: termina igual que si se hubiera perdido un carril
         para la nota y el sendero — el padre no distingue los dos finales para ESO, a
         propósito. Pero SÍ necesita saber que fue por tiempo para reportar la duración
         exacta (ver la nota de `onPerder`). */
      if (duracionSegundos && segundos >= duracionSegundos) {
        acabar(true);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [enIntro, alturaPista, intentarSpawnear, acabar, duracionSegundos, sacudirCarril,
      duracionTramo, tramos.length, anuncioDelTramo]);

  // Teclado propio. Ojo: ya pueden caer DOS letras a la vez, así que "la tecla correcta" es
  // cualquiera de las que estén en pantalla, no la de la única que había.
  useEffect(() => {
    if (enIntro) return;   // durante la explicación el teclado es de la ventana
    const manejar = (e: KeyboardEvent) => {
      /* Sin esto, apoyarse en una letra la acertaba tantas veces como el sistema
         repitiera el evento: en la lluvia eso limpia la pista sola. */
      if (e.repeat) return;
      if (perdidoRef.current) return;

      /* Sin reservas ya no se juega: las letras caen solas hacia el final y ninguna tecla
         hace nada (ver la nota de las reservas). El Espacio se anula igual para que no baje
         la página mientras el aviso está a la vista. */
      if (sinReservasRef.current) {
        if (e.key === ' ') e.preventDefault();
        return;
      }

      if (e.key.length !== 1) return;

      const actuales = columnasRef.current;

      /* CUÁL de las letras que caen se lleva la pulsación.

         Con una sola en pantalla no había nada que decidir. Con dos, `findIndex` tomaba la
         primera POR LA IZQUIERDA, que es un criterio sin sentido: si las dos muestran la
         misma letra —con un set de cuatro teclas pasa a cada rato— pulsar la correcta
         limpiaba la de arriba mientras la de abajo tocaba el suelo y cobraba una vida que
         el jugador ya se había ganado.

         Manda la más URGENTE, o sea la más baja. Y antes que eso, una palabra a medio
         escribir: en el modo avanzado los tokens son palabras, y saltar a otro carril a
         mitad de una dejaría la primera imposible de terminar. */
      const candidatas = actuales
        .map((item, i) => ({ item, i }))
        .filter(({ item }) => item
          && e.key.toLowerCase() === (item.letra[item.progreso] ?? '').toLowerCase());

      const col = candidatas.length === 0 ? -1 : candidatas.reduce((mejor, act) => {
        const enCurso = (c: typeof act) => (c.item!.progreso > 0 ? 1 : 0);
        if (enCurso(act) !== enCurso(mejor)) return enCurso(act) > enCurso(mejor) ? act : mejor;
        return act.item!.y > mejor.item!.y ? act : mejor;
      }).i;

      onKeystroke(col !== -1);

      if (col === -1) {
        rachaRef.current = 0;
        setRacha(0);
        if (reservas !== undefined) {
          reservasRef.current = Math.max(0, reservasRef.current - 1);
          setReservasRestantes(reservasRef.current);
          latirPildora();
          if (reservasRef.current === 0) {
            sinReservasRef.current = true;
            sinReservasDesdeRef.current = tiempoJuegoRef.current;
            setSinReservas(true);
            // La primera del final entra ya, sin esperar la separación.
            desdeUltimoSpawnRef.current = SEPARACION_FINAL;
          }
        }
        return;
      }

      rachaRef.current += 1;
      if (rachaRef.current > mejorRachaRef.current) mejorRachaRef.current = rachaRef.current;
      setRacha(rachaRef.current);

      const item = actuales[col]!;
      const nuevoProgreso = item.progreso + 1;
      const copia = [...actuales];
      copia[col] = nuevoProgreso >= item.letra.length ? null : { ...item, progreso: nuevoProgreso };
      columnasRef.current = copia;
      setColumnas(copia);
    };

    window.addEventListener('keydown', manejar);
    return () => window.removeEventListener('keydown', manejar);
  }, [enIntro, onKeystroke, reservas, latirPildora]);

  /* El estado de un carril se ve en el CARRIL ENTERO, no en unos bloques apilados al pie.
     Los bloques rojos de antes no se leían como error — un rectángulo pequeño en una
     esquina no dice "acabas de perder una vida". Un carril completo cambiando de color sí.

     El tinte va MUY tenue a propósito: encima siguen cayendo letras que hay que leer. El
     que va al 100% es el símbolo de alerta del pie, que es donde tiene que gritar. */
  const AMBAR = '#FFC53D';
  const ROJO = '#FF0004';
  const colorDelCarril = (n: number) => (n >= 2 ? ROJO : n === 1 ? AMBAR : null);

  /* La explicación SUSTITUYE al juego en vez de taparlo. Dibujar los carriles detrás de una
     ventana modal invitaría a leerlos, y no hay nada que leer todavía: están vacíos y las
     vidas intactas. */
  if (enIntro) {
    return (
      <IntroLluvia
        duracionSegundos={duracionSegundos}
        reservas={reservas}
        esOscuro={esOscuro}
        onEmpezar={() => {
          setEnIntro(false);
          // El primer tramo no lo anuncia el bucle: nunca "cambia" a él.
          if (hayTramos) setAnuncio(anuncioDelTramo(0));
        }}
      />
    );
  }

  /* El contador de reservas se gasta como una batería, y va pasando de color con los mismos
     umbrales que un carril: ámbar cuando queda poco, rojo al borde. Una batería y no un
     número rojo desde el principio: es un recurso que se administra, no un marcador de
     fallos — el curso evita el tono de castigo. */
  const iconoReservas = reservasRestantes > 10 ? 'battery_full'
    : reservasRestantes > 6 ? 'battery_5_bar'
      : reservasRestantes > 3 ? 'battery_3_bar'
        : reservasRestantes > 0 ? 'battery_1_bar' : 'battery_alert';
  const colorReservas = reservasRestantes <= 2 ? ROJO
    : reservasRestantes <= 5 ? AMBAR
      : (esOscuro ? '#00F1FD' : '#059669');
  const alturaDibujada = alturaPista ?? ALTURA_MINIMA;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-center justify-center gap-4">
        {duracionSegundos && (
          <p className={`text-base font-semibold ${esOscuro ? 'text-cian' : 'text-emerald-600'}`}>
            ¡Sobrevive {duracionSegundos} segundos a la lluvia de letras!
          </p>
        )}
        {hayTramos && (
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold"
            style={{ background: 'rgba(255,197,61,0.15)', color: AMBAR }}>
            <Icono nombre="keyboard_double_arrow_down" tamano={16} relleno />
            Ahora {anuncioDelTramo(tramoActual).fila}
          </span>
        )}
        {reservas !== undefined && (
          <span ref={pildoraRef}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold tabular-nums"
            style={{ background: `${colorReservas}1F`, color: colorReservas }}
            title="Cada tecla que no esté cayendo gasta una reserva">
            <Icono nombre={iconoReservas} tamano={18} relleno />
            {reservasRestantes} {reservasRestantes === 1 ? 'reserva' : 'reservas'}
          </span>
        )}
        {/* La racha: lo que le da marca que batir a un ejercicio que no exige velocidad.
            Solo aparece a partir de tres para que no parpadee en cada pulsación. */}
        {racha >= 3 && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
            style={{ background: 'rgba(255,197,61,0.15)', color: AMBAR }}>
            <Icono nombre="bolt" tamano={14} relleno />
            {racha} seguidas
          </span>
        )}
      </div>

      <div className="flex items-start justify-center gap-5">
      <div ref={pistaRef} className="relative flex items-end justify-center gap-4">
        {columnas.map((item, i) => {
          const color = colorDelCarril(golpes[i]);
          return (
            <div
              key={i}
              ref={(el) => { carrilesRef.current[i] = el; }}
              className={`relative shrink-0 overflow-hidden rounded-xl border ${
                esOscuro ? 'bg-carta/60' : 'bg-slate-50'
              }`}
              style={{
                width: ANCHO_CARRIL,
                height: alturaDibujada,
                borderColor: color ?? (esOscuro ? 'rgba(255,255,255,0.08)' : '#E2E8F0'),
                // Apenas un velo: las letras tienen que seguir leyéndose encima.
                background: color
                  ? `linear-gradient(to top, ${color}22, transparent 60%)`
                  : undefined,
              }}>
              {item && (
                <div
                  className={`absolute left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 font-mono font-bold ${
                    item.rapida ? 'late-rapida' : ''
                  }`}
                  style={{
                    top: item.y,
                    fontSize: TAMANO_LETRA,
                    background: item.rapida
                      ? 'rgba(255,197,61,0.22)'
                      : (esOscuro ? 'rgba(0,241,253,0.15)' : '#D1FAE5'),
                    color: item.rapida ? AMBAR : (esOscuro ? 'var(--color-cian)' : '#047857'),
                  }}>
                  <span className="opacity-40">{item.letra.slice(0, item.progreso)}</span>
                  {item.letra.slice(item.progreso)}
                </div>
              )}

              {/* El aviso del pie. Aparece al primer golpe y se pone rojo al segundo: es la
                  señal que el usuario mira de reojo mientras teclea. El número de vidas
                  creció de 12 a 22 px con los carriles: a 12 no se leía de reojo, que es
                  justo como se mira. */}
              {color && (
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-0.5 pb-3">
                  <Icono nombre="warning" tamano={32} relleno style={{ color }} />
                  <span className="text-[22px] font-bold leading-none tabular-nums" style={{ color }}>
                    {GOLPES_MAX - golpes[i]}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* SIN RESERVAS. Flota sobre la pista sin taparla entera —las letras siguen cayendo
            hacia el final y se tienen que ver— y no captura el ratón. Va en el tercio de
            arriba: abajo están el suelo y las vidas, que es donde se decide cuándo acaba.

            Las medidas van en píxeles y no en clases porque son un 15% más grandes que la
            escala de Tailwind (pedido del usuario: 24→28 px el título, 40→46 el icono) y
            porque `transform: scale` no sirve aquí: la animación de entrada anima `transform`
            y lo sustituiría entero, la misma trampa que el aviso de racha. */}
        {anuncio && !sinReservas && (
          <div className="pointer-events-none absolute inset-x-0 top-[14%] z-10 flex justify-center px-4">
            <div className="sube-y-aparece flex flex-col items-center rounded-2xl border-2 text-center shadow-2xl"
              style={{
                padding: '20px 30px',
                borderColor: 'rgba(255,197,61,0.55)',
                background: esOscuro ? 'rgba(10,20,28,0.93)' : 'rgba(255,255,255,0.96)',
                boxShadow: '0 18px 50px -14px rgba(255,197,61,0.45)',
              }}
              role="status"
              aria-live="polite">
              <p className={`font-bold ${esOscuro ? 'text-white' : 'text-slate-900'}`}
                style={{ fontSize: 22, lineHeight: 1.2 }}>
                ¡Letras de {anuncio.fila}!
              </p>
              <span className="mt-3 flex gap-2">
                {anuncio.teclas.map((t) => (
                  <kbd key={t}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border font-mono text-xl font-bold"
                    style={{
                      borderColor: 'rgba(255,197,61,0.45)',
                      background: esOscuro ? 'rgba(255,197,61,0.12)' : '#FFFBEB',
                      color: AMBAR,
                    }}>
                    {t}
                  </kbd>
                ))}
              </span>
            </div>
          </div>
        )}

        {sinReservas && (
          <div className="pointer-events-none absolute inset-x-0 top-[16%] z-10 flex justify-center px-4">
            <div className="sube-y-aparece flex flex-col items-center rounded-2xl border-2 text-center shadow-2xl"
              style={{
                padding: '28px 37px',
                borderColor: 'rgba(255,197,61,0.55)',
                background: esOscuro ? 'rgba(10,20,28,0.93)' : 'rgba(255,255,255,0.96)',
                boxShadow: '0 18px 50px -14px rgba(255,197,61,0.45)',
              }}
              role="status"
              aria-live="assertive">
              <Icono nombre="battery_alert" tamano={46} relleno style={{ color: AMBAR }} />
              <p className={`font-bold ${esOscuro ? 'text-white' : 'text-slate-900'}`}
                style={{ fontSize: 28, marginTop: 9, lineHeight: 1.2 }}>
                ¡Te quedaste sin reservas!
              </p>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default VistaLluviaLetras;
