import { BASE_ACENTUADA, NOMBRE_FILA, filaDe, posicionDe } from '../../components/practica/tecladoLayout';

/* LA PISTA QUE ACOMPAÑA A UN FALLO, cuando el fallo dice algo más que "esa no era".

   En los primeros nodos del Curso el usuario todavía no sabe dónde está nada, y el error
   más común no es confundir dos teclas vecinas: es irse de fila, o intentar un número que
   el curso ni ha mencionado. Marcarlo en rojo y callar deja al usuario adivinando qué hizo
   mal; una línea que diga "esa es de la fila de arriba" convierte el fallo en la lección.

   DEVUELVE null MÁS VECES DE LAS QUE DEVUELVE TEXTO, y es deliberado. Un aviso que sale en
   cada error deja de leerse a los treinta segundos, así que solo habla cuando tiene algo
   que aportar:
     · la tecla pulsada es de otra FILA distinta a las del ejercicio → lo dice;
     · es un dígito y el ejercicio no tiene ninguno → lo dice;
     · es una tecla de la misma fila que el ejercicio, o una que el ejercicio sí usa → se
       calla, porque ahí el fallo es un despiste normal y el color rojo ya lo cuenta.

   `permitidas` son los caracteres que aparecen en el contenido del NODO ENTERO (todas sus
   tandas), en minúscula. Se saca del texto y no de la configuración por el mismo motivo que
   teclasDelTexto: la configuración dice qué se pidió, el texto dice qué llegó. */
export const pistaDeTeclaFuera = (
  pulsada: string,
  permitidas: Set<string>,
): string | null => {
  if (!pulsada || pulsada.length !== 1) return null;

  const c = pulsada.toLowerCase();
  if (permitidas.has(c)) return null;          // es del ejercicio: fallo normal

  if (/[0-9]/.test(c)) {
    const elNodoUsaDigitos = [...permitidas].some((x) => /[0-9]/.test(x));
    return elNodoUsaDigitos ? null : 'Todavía no trabajamos con números.';
  }

  const filaPulsada = filaDe(c);
  if (filaPulsada === null) return null;       // no está en el teclado dibujado

  const filasDelNodo = new Set<number>();
  permitidas.forEach((x) => {
    const f = filaDe(x);
    if (f !== null) filasDelNodo.add(f);
  });
  // La misma fila no es un despiste de fila: ahí la pista sería ruido.
  if (filasDelNodo.size === 0 || filasDelNodo.has(filaPulsada)) return null;

  if (filasDelNodo.size === 1) {
    const [unica] = [...filasDelNodo];
    return `Esa tecla es de ${NOMBRE_FILA[filaPulsada]}. Céntrate en ${NOMBRE_FILA[unica]}.`;
  }
  return `Esa tecla es de ${NOMBRE_FILA[filaPulsada]}. Todavía no la usamos.`;
};

/* ===== LA PISTA DE VECINDAD: qué tan lejos quedó el dedo =====

   Pedido del usuario: *"si me pide la t y aprieto R que salte una ventana que diga una tecla
   a tu derecha"*. Y cuando la tecla está lejos, que diga que te saliste del patrón.

   LA DIRECCIÓN SE DA DESDE LA TECLA QUE PULSASTE, no desde la que tocaba, y eso es todo el
   valor del aviso: "una tecla a tu derecha" es una instrucción que el dedo puede ejecutar sin
   pensar. "La te está a la derecha de la erre" obliga a localizar las dos primero, que es lo
   que el usuario todavía no sabe hacer.

   Las distancias salen de `posicionDe`, o sea de la distribución real del teclado dibujado —
   no de una tabla de vecinos escrita a mano, que habría que mantener sincronizada con FILAS. */

// Media unidad de tecla. Por debajo de esto dos teclas de filas distintas están una encima de
// la otra: la `r` cae en 4.0 y la `f` en 4.25, y ese cuarto de unidad es la sangría de fila.
const ENCIMA = 0.6;
// Hasta aquí sigue siendo "al lado". Más allá, el dedo se fue a otra parte del teclado.
const AL_LADO = 1.6;
const A_DOS = 2.6;

export interface Pista {
  texto: string;
  /* Las dos teclas, cuando la pista es de vecindad. La ventana las dibuja con una flecha en
     medio: ver la tecla equivocada al lado de la correcta enseña más que la frase. */
  pulsada?: string;
  esperada?: string;
}

const lado = (dx: number) => (dx > 0 ? 'a tu derecha' : 'a tu izquierda');

export const pistaDeVecindad = (pulsada: string, esperada: string): Pista | null => {
  if (!pulsada || !esperada || pulsada.length !== 1) return null;
  const a = posicionDe(pulsada);
  const b = posicionDe(esperada);
  if (!a || !b) return null;
  if (a.fila === b.fila && Math.abs(b.x - a.x) < 0.1) return null;   // la misma tecla

  const dx = b.x - a.x;
  const df = b.fila - a.fila;
  const lejos: Pista = { texto: 'Te saliste del patrón.', pulsada, esperada };

  if (df === 0) {
    if (Math.abs(dx) <= AL_LADO) return { texto: `Una tecla ${lado(dx)}.`, pulsada, esperada };
    if (Math.abs(dx) <= A_DOS) return { texto: `Dos teclas ${lado(dx)}.`, pulsada, esperada };
    return lejos;
  }

  if (Math.abs(df) === 1) {
    const vertical = df < 0 ? 'arriba' : 'abajo';
    if (Math.abs(dx) < ENCIMA) {
      return { texto: `Justo ${vertical} de la que pulsaste.`, pulsada, esperada };
    }
    if (Math.abs(dx) <= AL_LADO) {
      return { texto: `Una fila más ${vertical}, ${lado(dx)}.`, pulsada, esperada };
    }
  }
  return lejos;
};

/* ===== LA PISTA DEL DEDO QUE NO LLEGA O NO VUELVE =====

   Para los nodos de ALCANCE de Fundamentos (g h, r u, e i, w o, q p, t y): cada uno tiene
   su propia tecla de RESPOSO ("ancla") y su propia tecla de ALCANCE ("nuevas"). Dos fallos
   posibles, y son espejo uno del otro:
     · el objetivo es el reposo (p. ej. la `f`) y el dedo se quedó arriba, en el alcance
       (pulsó `r`) → no volvió. "Vuelve el dedo a la tecla de reposo."
     · el objetivo es el alcance (p. ej. la `g`) y el dedo se quedó abajo, en el reposo
       (pulsó `f`) → no llegó. "Estira un poco más el [dedo]."

   Pedido del usuario con un caso concreto: *"en 'gh' si toca la g y aprieta la f que se le
   diga estira un poco más el índice"*. Solo dispara cuando pulsada Y esperada son, las dos,
   del mismo par reposo/alcance de ESTE nodo — un fallo hacia cualquier otra tecla no es
   esto, ya lo cubre la pista de territorio o la de vecindad. */
const NOMBRE_DEDO_POR_ANCLA: Record<string, string> = {
  fj: 'índice',
  dk: 'medio',
  sl: 'anular',
  añ: 'meñique',
};

export const pistaDeAlcance = (
  pulsada: string,
  esperada: string,
  nuevas: string,
  anclaPropia: string,
): Pista | null => {
  if (!pulsada || !esperada || pulsada.length !== 1 || !anclaPropia) return null;
  const p = pulsada.toLowerCase();
  const e = esperada.toLowerCase();
  const enNuevas = (c: string) => nuevas.toLowerCase().includes(c);
  const enAncla = (c: string) => anclaPropia.toLowerCase().includes(c);
  const dedo = NOMBRE_DEDO_POR_ANCLA[anclaPropia.toLowerCase()] ?? 'dedo';

  if (enAncla(e) && enNuevas(p)) {
    return { texto: 'Vuelve el dedo a la tecla de reposo.', pulsada, esperada };
  }
  if (enNuevas(e) && enAncla(p)) {
    return { texto: `Estira un poco más el ${dedo}.`, pulsada, esperada };
  }
  return null;
};

/* LA VOCAL SIN SU TILDE: pulsaste la `a` y tocaba la `á`.

   Va PRIMERO en pistaDeFallo porque las otras dos se equivocan aquí: la vocal pelada es del
   ejercicio, así que la de territorio calla, y la `á` no está en el teclado dibujado, así
   que la de vecindad tampoco sabe qué decir. Sin esto el fallo más común del nodo de tildes
   salía mudo —justo el que ese nodo existe para corregir—, y desde que ahí no se avanza sin
   la tilde, un fallo mudo es un ejercicio que se planta sin explicar por qué.

   Solo cuando la vocal ES la correcta: si pulsaste otra, el error no es la tilde. */
const pistaDeTilde = (pulsada: string, esperada: string): Pista | null => {
  if (!pulsada || pulsada.length !== 1 || !esperada) return null;
  const base = BASE_ACENTUADA[esperada.toUpperCase()];
  if (!base || esperada.toUpperCase() === 'Ü') return null;
  if (pulsada.toUpperCase() !== base) return null;
  return { texto: 'Te faltó la tilde: primero el acento, después la vocal.', pulsada, esperada };
};

/* LA PISTA DEL FALLO, entera. La de la tilde va delante de todo (ver arriba). Después la
   de territorio —irse de fila, un dígito que el curso no ha mencionado— porque es la lección
   más grande; si esa se calla, habla la de vecindad.

   LA DE VECINDAD SOLO CON `permiteVecindad` (hoy, solo en "un dedo"). Decisión del usuario:
   en Fundamentos y el resto de los ejercicios de letras la dirección ("una tecla a tu
   derecha", "te saliste del patrón") no aporta — ahí ya está la de territorio para el
   despiste grande, y la de vecindad se sentía como ruido. El recorrido de un dedo es
   justo el ejercicio que entrena moverse entre filas, así que es el único lugar donde decir
   ADÓNDE en cada fallo tiene sentido.

   ⚠️ Con la de vecindad el aviso pasa a salir en CASI TODOS los fallos DEL RECORRIDO, y eso
   rompe a propósito la regla de arriba ("devuelve null más veces de las que devuelve texto").
   Es una decisión del usuario y tiene un argumento: estas pistas no dicen "esa no era" —eso ya
   lo dice el rojo— sino ADÓNDE ir, que es lo único accionable mientras no sabes dónde está
   nada. Si termina cansando, la palanca es exigir que el nodo sea de los primeros del nivel. */
export const pistaDeFallo = (
  pulsada: string,
  esperada: string,
  permitidas: Set<string>,
  permiteVecindad: boolean,
  /* Presente solo en los nodos de Fundamentos con ancla propia (g h, r u, e i, w o, q p,
     t y). Ausente en el resto, y ahí pistaDeAlcance no tiene nada que decir. */
  alcance?: { nuevas: string; anclaPropia: string } | null,
): Pista | null => {
  const tilde = pistaDeTilde(pulsada, esperada);
  if (tilde) return tilde;
  if (alcance) {
    const dedo = pistaDeAlcance(pulsada, esperada, alcance.nuevas, alcance.anclaPropia);
    if (dedo) return dedo;
  }
  const territorio = pistaDeTeclaFuera(pulsada, permitidas);
  if (territorio) return { texto: territorio };
  return permiteVecindad ? pistaDeVecindad(pulsada, esperada) : null;
};

/* Los caracteres que el nodo entero puede pedir. Se calcula una vez por nodo y se le pasa a
   pistaDeTeclaFuera en cada fallo, que es lo que la deja ser una función pura y barata. */
export const conjuntoDelNodo = (textos: (string | undefined)[]): Set<string> => {
  const conjunto = new Set<string>();
  textos.forEach((t) => {
    if (!t) return;
    for (const ch of t.toLowerCase()) if (ch !== '\n') conjunto.add(ch);
  });
  return conjunto;
};
