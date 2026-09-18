/* Distribución del teclado español latinoamericano y el dedo que corresponde a cada tecla.

   Vive aparte del componente porque son datos, no interfaz: un archivo de componente que
   además exporta constantes rompe `react-refresh/only-export-components`, que en este repo
   es error.

   Por qué latinoamericano y no de España: es la decisión que ya está tomada en el resto
   del proyecto (ver CLAUDE.md 10.9 y 12.8 — el `#` es Shift+3 acá y AltGr+3 allá). El día
   que exista el perfil de teclado por usuario, este archivo es el que se elige según ese
   perfil. */

export type Dedo = 'menique' | 'anular' | 'medio' | 'indice' | 'pulgar';

export interface Tecla {
  // Lo que se pinta en la tecla.
  etiqueta: string;
  dedo: Dedo;
  mano: 'izquierda' | 'derecha';
  // Ancho relativo: 1 = tecla normal. La barra espaciadora es la única que se estira.
  ancho?: number;
  /* Marca táctil de la fila de reposo. F y J llevan un relieve físico en cualquier
     teclado, y son el ancla de la mecanografía al tacto: sin señalarlas, la fila central
     se ve como cualquier otra. */
  conRelieve?: boolean;
}

/* La fila de números existe acá y NO existía en el teclado que dibujaba el Curso. No es un
   detalle estético: "Fila de números" (Básico, orden 39) y "Oraciones con números y fechas"
   (Avanzado) se practican tecleando dígitos, y el teclado de ayuda no tenía dónde
   resaltarlos — durante todo el ejercicio no se encendía ninguna tecla. */
export const FILAS: Tecla[][] = [
  [
    { etiqueta: '1', dedo: 'menique', mano: 'izquierda' },
    { etiqueta: '2', dedo: 'anular', mano: 'izquierda' },
    { etiqueta: '3', dedo: 'medio', mano: 'izquierda' },
    { etiqueta: '4', dedo: 'indice', mano: 'izquierda' },
    { etiqueta: '5', dedo: 'indice', mano: 'izquierda' },
    { etiqueta: '6', dedo: 'indice', mano: 'derecha' },
    { etiqueta: '7', dedo: 'indice', mano: 'derecha' },
    { etiqueta: '8', dedo: 'medio', mano: 'derecha' },
    { etiqueta: '9', dedo: 'anular', mano: 'derecha' },
    { etiqueta: '0', dedo: 'menique', mano: 'derecha' },
    { etiqueta: "'", dedo: 'menique', mano: 'derecha' },
    { etiqueta: '¿', dedo: 'menique', mano: 'derecha' },
  ],
  [
    { etiqueta: 'Q', dedo: 'menique', mano: 'izquierda' },
    { etiqueta: 'W', dedo: 'anular', mano: 'izquierda' },
    { etiqueta: 'E', dedo: 'medio', mano: 'izquierda' },
    { etiqueta: 'R', dedo: 'indice', mano: 'izquierda' },
    { etiqueta: 'T', dedo: 'indice', mano: 'izquierda' },
    { etiqueta: 'Y', dedo: 'indice', mano: 'derecha' },
    { etiqueta: 'U', dedo: 'indice', mano: 'derecha' },
    { etiqueta: 'I', dedo: 'medio', mano: 'derecha' },
    { etiqueta: 'O', dedo: 'anular', mano: 'derecha' },
    { etiqueta: 'P', dedo: 'menique', mano: 'derecha' },
    // La tecla del acento. Se pinta porque en español es el paso previo a cada tilde.
    { etiqueta: '´', dedo: 'menique', mano: 'derecha' },
  ],
  [
    { etiqueta: 'A', dedo: 'menique', mano: 'izquierda' },
    { etiqueta: 'S', dedo: 'anular', mano: 'izquierda' },
    { etiqueta: 'D', dedo: 'medio', mano: 'izquierda' },
    { etiqueta: 'F', dedo: 'indice', mano: 'izquierda', conRelieve: true },
    { etiqueta: 'G', dedo: 'indice', mano: 'izquierda' },
    { etiqueta: 'H', dedo: 'indice', mano: 'derecha' },
    { etiqueta: 'J', dedo: 'indice', mano: 'derecha', conRelieve: true },
    { etiqueta: 'K', dedo: 'medio', mano: 'derecha' },
    { etiqueta: 'L', dedo: 'anular', mano: 'derecha' },
    { etiqueta: 'Ñ', dedo: 'menique', mano: 'derecha' },
  ],
  [
    /* Las dos teclas Shift. Se dibujan aunque no se "escriban": son las únicas del teclado
       que el usuario tiene que pulsar A LA VEZ que otra, y sin verlas la instrucción
       "pulsa Shift" no tiene dónde apoyarse. Van con el meñique de su mano, que es el dedo
       que las alcanza. */
    /* ANCHO 1.15, no 2, y sale de una cuenta: la fila inferior tenía 1.15 teclas de
       sangría para que la Z cayera debajo de la A. Ahora esa sangría la ocupa el Shift, así
       que su ancho tiene que ser exactamente el que había — con 40 px de tecla y 6 de hueco,
       46·a − 6 = 1,15·46 − 6 da a = 1,15. Cualquier otro valor desalinea la fila. */
    { etiqueta: 'MAYUS-IZQ', dedo: 'menique', mano: 'izquierda', ancho: 1.15 },
    { etiqueta: 'Z', dedo: 'menique', mano: 'izquierda' },
    { etiqueta: 'X', dedo: 'anular', mano: 'izquierda' },
    { etiqueta: 'C', dedo: 'medio', mano: 'izquierda' },
    { etiqueta: 'V', dedo: 'indice', mano: 'izquierda' },
    { etiqueta: 'B', dedo: 'indice', mano: 'izquierda' },
    { etiqueta: 'N', dedo: 'indice', mano: 'derecha' },
    { etiqueta: 'M', dedo: 'indice', mano: 'derecha' },
    { etiqueta: ',', dedo: 'medio', mano: 'derecha' },
    { etiqueta: '.', dedo: 'anular', mano: 'derecha' },
    { etiqueta: '-', dedo: 'menique', mano: 'derecha' },
    { etiqueta: 'MAYUS-DER', dedo: 'menique', mano: 'derecha', ancho: 2 },
  ],
  [
    { etiqueta: 'espacio', dedo: 'pulgar', mano: 'derecha', ancho: 7 },
  ],
];

export const COLOR_DEDO: Record<Dedo, string> = {
  menique: 'var(--color-dedo-menique)',
  anular: 'var(--color-dedo-anular)',
  medio: 'var(--color-dedo-medio)',
  indice: 'var(--color-dedo-indice)',
  pulgar: 'var(--color-dedo-pulgar)',
};

export const NOMBRE_DEDO: Record<Dedo, string> = {
  menique: 'Meñique',
  anular: 'Anular',
  medio: 'Medio',
  indice: 'Índice',
  pulgar: 'Pulgar',
};

/* Vocal base de cada vocal acentuada. En el teclado español la tilde NO es una tecla
   propia: se pulsa ´ y después la vocal, así que resaltar solo "á" (que no existe como
   tecla) dejaría al usuario sin saber dónde apretar. Con esto se resaltan las dos, en ese
   orden. La diéresis va acá por lo mismo, aunque además exija Shift. */
export const BASE_ACENTUADA: Record<string, string> = {
  Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', Ü: 'U',
};

/* Símbolos que salen de OTRA tecla + Shift, sin ser letras ni vocales acentuadas. Hoy
   solo el punto y coma: en el teclado latinoamericano sale de Shift + la coma (la coma
   sola ya está dibujada en `FILAS`, así que no hace falta agregar una tecla nueva). */
export const SIMBOLO_CON_SHIFT: Record<string, string> = {
  ';': ',',
};

/* De un carácter del texto a la etiqueta de la tecla que hay que pulsar.
   Devuelve null cuando el carácter no está en el teclado dibujado (por ejemplo `%`, que
   es Shift+5): en ese caso el componente no resalta nada en vez de resaltar mal. */
export const teclaDe = (caracter: string): string | null => {
  if (!caracter) return null;
  if (caracter === ' ') return 'espacio';
  if (SIMBOLO_CON_SHIFT[caracter]) return SIMBOLO_CON_SHIFT[caracter];

  const mayus = caracter.toUpperCase();
  if (BASE_ACENTUADA[mayus]) return BASE_ACENTUADA[mayus];

  const existe = FILAS.some((fila) => fila.some((t) => t.etiqueta === mayus));
  return existe ? mayus : null;
};

/* SOLO mayúsculas — letra con case distinto de sí misma. Es la que decide si la PRIMERA
   vez de un nodo se enseña gratis (ver CursoPracticaView): ese mecanismo es específico del
   gesto Shift+letra y no tiene que activarse para `;`, que tiene su PROPIO mecanismo
   (`puntoYComaObligatorio`) donde fallar sí cuenta desde el principio — ahí el gesto ya se
   explica en el panel, así que no es gratis como una mayúscula que nadie te avisó. */
export const esMayuscula = (caracter: string): boolean =>
  caracter.length === 1 && caracter !== caracter.toLowerCase()
    && caracter === caracter.toUpperCase();

// Un carácter que se produce con Shift: mayúsculas Y los símbolos de `SIMBOLO_CON_SHIFT`.
// La guía visual (TecladoGuia, AvisoTeclaEspecial) lo necesita para saber si además del
// carácter hay que resaltar un Shift — es media pulsación que no aparece en el teclado.
export const necesitaShift = (caracter: string): boolean =>
  esMayuscula(caracter) || Boolean(SIMBOLO_CON_SHIFT[caracter]);

/* CUÁL de los dos Shift. Siempre el de la mano CONTRARIA a la que teclea la letra.

   No es una preferencia: es el método que documenta TypingClub en su manual —"usar el
   shift opuesto a la mano que teclea el carácter, así se mantiene la posición de los dedos
   y se vuelve fácil al reposo"—. Con el mismo Shift que la letra, la mano tiene que
   deformarse para alcanzar las dos teclas, y eso es justo el hábito que después hay que
   desaprender. Enseñar "pulsa Shift" a secas crea ese hábito por omisión.

   Devuelve null cuando el carácter no exige Shift o no está en el teclado dibujado. */
export const shiftContrarioDe = (caracter: string): string | null => {
  if (!necesitaShift(caracter)) return null;
  const tecla = teclaDe(caracter);
  if (!tecla) return null;
  const info = FILAS.flat().find((t) => t.etiqueta === tecla);
  if (!info) return null;
  return info.mano === 'izquierda' ? 'MAYUS-DER' : 'MAYUS-IZQ';
};

/* EN QUÉ FILA VIVE UNA TECLA, y cómo se llama esa fila cuando hay que nombrarla.

   Existe para las pistas del Curso: cuando en un nodo de la fila central el usuario pulsa
   una tecla de otra fila, lo útil no es "fallaste" sino "esa es de arriba". Los nombres
   están en el lenguaje del curso y no en el técnico ("superior", "home row"): son lo que se
   le enseña a leer al usuario desde el primer nodo.

   El índice coincide con FILAS, así que si algún día se añade una fila arriba hay que mover
   los dos a la vez — por eso el nombre va pegado al array y no en otro archivo. */
export const NOMBRE_FILA = [
  'la fila de los números',
  'la fila de arriba',
  'la fila del medio',
  'la fila de abajo',
  // La quinta fila de FILAS es solo el espacio. `filaDe` nunca la devuelve —descarta
  // 'espacio' antes—, pero el nombre está para que las dos listas midan igual.
  'la barra espaciadora',
];

/* El índice de fila de un carácter, o null si no está en el teclado dibujado. Resuelve
   antes la vocal acentuada (una `á` vive donde su `A`) por la misma razón que teclaDe. */
export const filaDe = (caracter: string): number | null => {
  const tecla = teclaDe(caracter);
  if (!tecla || tecla === 'espacio') return null;
  const indice = FILAS.findIndex((fila) => fila.some((t) => t.etiqueta === tecla));
  return indice === -1 ? null : indice;
};

/* LA SANGRÍA DE CADA FILA, en unidades de tecla. Vivía dentro de `TecladoGuia` y se movió
   acá porque ya no la usa solo el dibujo: la necesita `posicionDe` para saber qué tecla cae
   al lado de cuál, y un componente no es sitio del que otro módulo deba depender (además
   exportar constantes desde un `.tsx` rompe `react-refresh/only-export-components`).

   ⚠️ La fila inferior lleva 0 y no 1.15 porque esa sangría la ocupa el Shift izquierdo, que
   se dibuja con ancho 1.15 justamente para que la Z siga cayendo debajo de la A. Las dos
   cosas se mueven juntas o la fila se descoloca. */
export const SANGRIA_FILA = [0, 0.5, 0.75, 0, 3.5];

/* DÓNDE CAE FÍSICAMENTE UNA TECLA: su fila y el centro horizontal, en unidades de tecla.

   Se mide en unidades y no en píxeles porque los huecos entre teclas son constantes y se
   cancelan: lo que importa es cuántas teclas de distancia hay, que es justo lo que se le
   puede decir al usuario ("una tecla a tu derecha").

   Con esto, la tecla que está justo encima de otra sale con una diferencia de x menor a
   media unidad —la `r` está a 4.0 y la `f` a 4.25— y eso es lo que permite distinguir
   "justo arriba" de "arriba y a la derecha" sin escribir a mano ninguna tabla de vecinos. */
export const posicionDe = (caracter: string): { fila: number; x: number } | null => {
  const tecla = teclaDe(caracter);
  if (!tecla || tecla === 'espacio') return null;

  for (let f = 0; f < FILAS.length; f += 1) {
    let x = SANGRIA_FILA[f] ?? 0;
    for (const t of FILAS[f]) {
      const ancho = t.ancho ?? 1;
      if (t.etiqueta === tecla) return { fila: f, x: x + ancho / 2 };
      x += ancho;
    }
  }
  return null;
};

/* Las teclas que hacen falta para escribir un texto dado.

   Alimenta el apagado del teclado: lo que no está acá se atenúa. Se calcula del propio
   texto generado y no de la configuración del ejercicio a propósito — la configuración
   dice qué letras se PIDIERON, y el generador puede haber traído además espacios, comas o
   una tilde. El texto es la única fuente que no puede desincronizarse.

   Los caracteres que no existen en el teclado dibujado (`%`, `¡`…) se descartan: incluir
   un `null` en el conjunto apagaría teclas que sí se usan. */
export const teclasDelTexto = (texto: string): Set<string> => {
  const conjunto = new Set<string>();
  /* Los Shift entran si el texto trae UNA sola mayúscula. Sin esto el apagado los atenúa
     —ningún carácter "produce" un Shift— y el ejercicio encendería la letra en una tecla
     viva mientras la otra mitad de la pulsación queda en gris. */
  if ([...texto].some((c) => necesitaShift(c))) {
    conjunto.add('MAYUS-IZQ');
    conjunto.add('MAYUS-DER');
  }
  for (const caracter of texto) {
    const etiqueta = teclaDe(caracter);
    if (etiqueta) conjunto.add(etiqueta);
    /* Una vocal acentuada necesita ADEMÁS la tecla muerta del acento, que teclaDe no
       devuelve porque solo puede devolver una. Sin esto la ´ se apagaba justo en el
       ejercicio de tildes. */
    if (BASE_ACENTUADA[caracter.toUpperCase()]) conjunto.add('´');
  }
  return conjunto;
};
