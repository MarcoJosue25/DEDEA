import { arpegio, ruido, tono, transportar } from './sintesis';

/* EL CATÁLOGO DE CANDIDATOS.

   Hay diez sonidos de tecleo y no uno porque la única forma honesta de elegir un sonido es
   oírlo al lado de sus alternativas y, sobre todo, oírlo a velocidad de tecleo, que es donde
   casi todos se caen. /laboratorio-sonido es la pantalla que los pone juntos.

   ELEGIDOS (7-sep-2026): barra de tipos · marimba · martillo · campanas · cristal. Van
   marcados con `predeterminado` y viven en preferencias.ts, que es lo que van a llamar los
   ejercicios cuando se cablee el sonido.

   ⚠️ EL RESTO NO SE BORRA, y es una decisión del usuario, no un olvido. El plan original era
   quedarse con los cinco ganadores y tirar los treinta y nueve restantes; en su lugar el
   catálogo entero se queda como el menú de opciones que el usuario va a poder cambiar a su
   antojo desde su perfil más adelante. O sea que este archivo dejó de ser una lista de
   candidatos y pasó a ser producto: lo que se añada aquí hay que medirlo y mantenerlo. */

/* LAS GANANCIAS ESTÁN NIVELADAS A OÍDO IGUALADO, NO PUESTAS A OJO.

   Medidas una a una en el navegador, con un analizador pinchado en la salida de cada sonido
   justo antes del maestro. Sin nivelar, dentro de la familia de tecleo había SEIS VECES de
   diferencia entre el más flojo (fieltro, 0.026 de pico) y el más fuerte (clic seco, 0.158),
   y eso arruina la comparación: puestos a elegir a oído, el más fuerte gana casi siempre por
   serlo, no por ser mejor.

   Los objetivos por familia no son iguales, y ahí sí hay criterio:

     tecleo ~0.075 · racha ~0.11 · fallo discreto ~0.085 · fallo con peso ~0.145

   El tecleo va por DEBAJO de todo porque suena seis veces por segundo. El fallo va por
   encima porque su trabajo es interrumpir. Y el tope del fallo es 1,3 veces la racha y no
   dos: un error que suena el doble que el premio convierte la práctica en un castigo.

   ⚠️ Si añades un candidato, mídelo contra estos números en vez de copiar la ganancia del
   de al lado — un paso de banda estrecho se come 15 dB y el mismo número da otra cosa.

   ⚠️ Y mide DESPUÉS de que el sonido esté bien, no antes: la primera tanda de medidas se
   hizo con los chasquidos de arranque todavía presentes (ver ADELANTO en sintesis.ts) y los
   números de los sonidos cortos estaban inflados hasta ocho veces. Nivelar sobre eso dejó
   `madera` en 0.013 y `tope` en 0.024, o sea inaudibles. Estos valores son de la segunda
   pasada, ya en limpio. */
export type Familia = 'tecleo' | 'correcto' | 'error' | 'racha';

export interface Candidato {
  id: string;
  nombre: string;
  /* El elegido de esa familia: el que suena si el usuario no cambia nada. Uno por familia.

     Antes este campo se llamaba `recomendado` y marcaba mi propuesta para que el usuario la
     oyera y me llevara la contraria. Ya la eligió, así que el campo dice lo que de verdad
     hace hoy — un sonido marcado aquí no es una sugerencia, es lo que va a sonar. */
  predeterminado?: boolean;
  /* Abre un subgrupo dentro de la familia. Solo lo lleva el PRIMERO de cada tanda: los que
     vienen detrás heredan el último declarado. Con dieciocho candidatos de racha en una sola
     rejilla no se puede comparar nada; separados por origen, sí. */
  grupo?: string;
  /* Qué se buscaba con este sonido. Sirve para elegir con criterio y no solo por gusto:
     dos sonidos pueden gustar igual y uno cansar a los tres minutos. */
  nota: string;
  tocar: (nivel?: number) => void;
}

/* Notas, en Hz. Escritas con nombre porque 783.99 no dice nada al leer un arpegio. */
const A3 = 220.00;
const C4 = 261.63; const E4 = 329.63; const G4 = 392.00; const A4 = 440.00;
const Bb4 = 466.16;
const C5 = 523.25; const D5 = 587.33; const E5 = 659.25; const G5 = 783.99;
const F5 = 698.46; const A5 = 880.00; const B5 = 987.77;
const C6 = 1046.50; const D6 = 1174.66; const E6 = 1318.51; const G6 = 1567.98;
const A6 = 1760.00;

/* LOS PARCIALES DE UN OBJETO GOLPEADO NO SON MÚLTIPLOS ENTEROS DE SU FUNDAMENTAL.

   Es la diferencia técnica entre "esto suena a app genérica" y "esto suena a algo real". Un
   seno con caída rápida tiene sus armónicos en 2x, 3x, 4x exactos: eso no existe en la
   naturaleza y el oído lo archiva como notificación de móvil, porque es literalmente de
   donde lo conoce.

   Un metal golpeado reparte los suyos en relaciones que no son notas. Una campana de torre
   va cerca de 0.5 : 1 : 1.2 : 1.5 : 2 : 2.66 —ese 1.2 es una tercera menor, y es la razón
   de que todas las campanas suenen un poco graves de ánimo—. Un tubo de carrillón va en
   1 : 2.76 : 5.4. Un cuenco, más cerrado todavía.

   Y todos empiezan con un golpe de RUIDO: el badajo, la baqueta, el martillo. Sin ese
   transitorio el sonido nace de la nada y vuelve a sonar sintético por mucho que los
   parciales estén bien. */
const PARCIALES_CAMPANA = [0.5, 1, 1.2, 1.5, 2.0, 2.66];
const PARCIALES_TUBO = [1, 2.76, 5.40];
const PARCIALES_CUENCO = [1, 2.32, 4.25];

const golpeInarmonico = (
  freq: number, parciales: number[], en: number, gain: number, largo: number,
  golpe = 0,
) => {
  parciales.forEach((p, k) => tono({
    freq: freq * p,
    // Los parciales altos se apagan antes, igual que en el objeto de verdad.
    dur: Math.max(0.05, largo * (1 - k * 0.16)),
    gain: gain / (k + 1),
    ataque: 0.003,
    en,
  }));
  if (golpe > 0) {
    ruido({ dur: 0.02, gain: golpe, en, filtro: { tipo: 'highpass', freq: 3000 } });
  }
};

/* ============================ TECLEO ============================

   El sonido que suena en CADA pulsación. Es el más difícil de los cinco y el que más
   restricciones tiene, todas por el mismo motivo: se va a oír seis veces por segundo
   durante minutos.

     · Corto de verdad. Por encima de ~60 ms las pulsaciones se solapan y aparece un
       zumbido continuo en cuanto el usuario coge ritmo.
     · Flojo. Va por debajo del resto de sonidos a propósito; si compite con el de racha,
       el premio deja de notarse.
     · Sin tono definido, o con uno muy grave. Una nota clara repetida cien veces se
       convierte en una melodía involuntaria y molesta. */
export const TECLEO: Candidato[] = [
  {
    id: 'click-seco',
    nombre: 'Clic seco',
    nota: 'Ruido agudo de 20 ms. Lo más parecido a un clic de ratón: presente y sin tono.',
    tocar: () => ruido({ dur: 0.02, gain: 0.058, filtro: { tipo: 'highpass', freq: 2200 } }),
  },
  {
    id: 'membrana',
    nombre: 'Membrana',
    nota: 'Ruido apagado más un golpe grave. Imita el sonido hueco de un teclado silencioso.',
    tocar: () => {
      ruido({ dur: 0.03, gain: 0.084, filtro: { tipo: 'lowpass', freq: 1200 } });
      tono({ freq: 180, freqFin: 120, dur: 0.045, gain: 0.068 });
    },
  },
  {
    id: 'mecanico',
    nombre: 'Mecánico',
    nota: 'Chasquido con cuerpo: capa aguda muy corta sobre una grave. El más "teclado".',
    tocar: () => {
      ruido({ dur: 0.015, gain: 0.18, filtro: { tipo: 'bandpass', freq: 2800, q: 1.2 } });
      ruido({ dur: 0.05, gain: 0.118, filtro: { tipo: 'lowpass', freq: 420 } });
    },
  },
  {
    id: 'fieltro',
    nombre: 'Fieltro',
    nota: 'Solo graves, sin chasquido. El menos cansino de todos y también el menos nítido.',
    tocar: () => ruido({ dur: 0.045, gain: 0.26, filtro: { tipo: 'lowpass', freq: 700 } }),
  },
  {
    id: 'tinta',
    nombre: 'Tinta',
    nota: 'Casi inaudible, 12 ms. Para quien quiera notar el tecleo sin llegar a oírlo.',
    tocar: () => ruido({ dur: 0.012, gain: 0.025, filtro: { tipo: 'highpass', freq: 5000 } }),
  },
  {
    id: 'burbuja',
    nombre: 'Burbuja',
    nota: 'Seno que cae de 600 a 320 Hz. Suave y redondo; tiene tono, así que puede cansar.',
    tocar: () => tono({ freq: 600, freqFin: 320, dur: 0.055, gain: 0.077 }),
  },
  {
    id: 'madera',
    nombre: 'Madera',
    nota: 'Triangular filtrada. Suena a golpecito sobre un tablero.',
    tocar: () => tono({
      freq: 420, freqFin: 300, tipo: 'triangle', dur: 0.05, gain: 0.48,
      filtro: { tipo: 'bandpass', freq: 900, q: 3 },
    }),
  },
  {
    id: 'goma',
    nombre: 'Goma',
    nota: 'Grave con un punto de ruido encima. Mate, sin brillo.',
    tocar: () => {
      tono({ freq: 240, freqFin: 160, tipo: 'triangle', dur: 0.05, gain: 0.09 });
      ruido({ dur: 0.012, gain: 0.041, filtro: { tipo: 'lowpass', freq: 1500 } });
    },
  },
  {
    id: 'digital',
    nombre: 'Digital',
    nota: 'Cuadrada de 8 ms. Frío y muy definido; es el más "máquina" de la lista.',
    tocar: () => tono({ freq: 1400, tipo: 'square', dur: 0.008, gain: 0.085 }),
  },
  {
    id: 'papel',
    nombre: 'Papel',
    nota: 'Ruido medio, ancho. Roce más que golpe.',
    tocar: () => ruido({
      dur: 0.035, gain: 0.118, filtro: { tipo: 'bandpass', freq: 3200, q: 0.7 },
    }),
  },
  {
    id: 'barra',
    nombre: 'Barra de tipos',
    predeterminado: true,
    grupo: 'Máquina de escribir',
    nota: 'Tres capas: el impacto de la tecla, la barra dando contra el papel y un timbre '
      + 'metálico cortísimo. Es el único de la lista con una historia detrás.',
    tocar: () => {
      ruido({ dur: 0.012, gain: 0.076, filtro: { tipo: 'highpass', freq: 3200 } });
      ruido({ dur: 0.045, gain: 0.068, filtro: { tipo: 'lowpass', freq: 480 } });
      tono({ freq: 2400, tipo: 'triangle', dur: 0.03, gain: 0.023 });
    },
  },
];

/* ============================ ACIERTO ============================

   El acento de "esta iba bien". Puede sonar solo o encima del de tecleo, según el modo que
   se elija en el laboratorio. Aquí sí conviene tono definido: es lo que lo separa del ruido
   del tecleo. Sigue siendo corto — si dura más que una pulsación, se pisa con la siguiente. */
export const CORRECTO: Candidato[] = [
  {
    id: 'campanita',
    nombre: 'Campanita',
    nota: 'Un seno agudo con caída larga. Limpio y positivo.',
    tocar: () => tono({ freq: G6, dur: 0.12, gain: 0.07 }),
  },
  {
    id: 'marimba',
    nombre: 'Marimba',
    predeterminado: true,
    nota: 'Fundamental más octava. Cálido, con cuerpo de madera.',
    tocar: () => {
      tono({ freq: A5, tipo: 'triangle', dur: 0.10, gain: 0.08 });
      tono({ freq: A5 * 2, dur: 0.05, gain: 0.03 });
    },
  },
  {
    id: 'pulsada',
    nombre: 'Cuerda pulsada',
    nota: 'Sierra filtrada: ataque nítido y desaparece. Recuerda a un arpa.',
    tocar: () => tono({
      freq: E5, tipo: 'sawtooth', dur: 0.09, gain: 0.06,
      filtro: { tipo: 'lowpass', freq: 2000 },
    }),
  },
  {
    id: 'quinta',
    nombre: 'Quinta',
    nota: 'Dos notas a la vez, sin tercera. Suena a "correcto" sin sonar alegre.',
    tocar: () => {
      tono({ freq: E5, dur: 0.09, gain: 0.05 });
      tono({ freq: B5, dur: 0.09, gain: 0.04 });
    },
  },
  {
    id: 'gota',
    nombre: 'Gota',
    nota: 'Barrido que SUBE. El único que se distingue por movimiento y no por altura.',
    tocar: () => tono({ freq: 900, freqFin: 1500, dur: 0.07, gain: 0.06 }),
  },
  {
    id: 'aire',
    nombre: 'Aire',
    nota: 'Muy flojo y con ataque lento. Se siente más que se oye; el más discreto.',
    tocar: () => tono({ freq: C6, dur: 0.10, gain: 0.04, ataque: 0.02 }),
  },
];

/* ============================ FALLO ============================

   No lo pidió el usuario y se añade con una intención concreta: si hay un sonido para el
   acierto y NINGUNO para el fallo, el silencio pasa a significar error, y eso es un castigo
   peor que un sonido — el usuario deja de oír el premio y empieza a oír su ausencia.

   LOS TRES PRIMEROS SON DISCRETOS Y LOS CINCO ÚLTIMOS TIENEN PESO DE VERDAD, a pedido
   explícito. El fallo es el único sonido de la app que puede permitirse molestar: si no se
   distingue, el usuario sigue tecleando mal sin enterarse, que es justo lo que el sonido
   venía a evitar.

   Aun así ninguno es un pitido de fracaso. La diferencia entre "te equivocaste" y "fallaste"
   está en la duración y en la cola: estos avisan y se van, no se quedan sonando encima. Es
   el mismo criterio que se aplicó al aviso de precisión de los latidos, donde el velo rojo a
   pantalla completa se quitó por leerse como castigo cuando esto es una práctica. */
export const ERROR: Candidato[] = [
  {
    id: 'nota-baja',
    nombre: 'Nota baja',
    nota: 'Una sola nota grave que cae. Musical, no agresiva.',
    tocar: () => tono({ freq: 220, freqFin: 165, tipo: 'triangle', dur: 0.13, gain: 0.093 }),
  },
  {
    id: 'roce',
    nombre: 'Roce',
    nota: 'Dos notas casi iguales que chocan. Se nota que algo no encajó, sin gritarlo.',
    tocar: () => {
      tono({ freq: 300, dur: 0.10, gain: 0.044 });
      tono({ freq: 318, dur: 0.10, gain: 0.044 });
    },
  },
  {
    id: 'tope',
    nombre: 'Tope',
    nota: 'Dos golpecitos muy juntos, como una tecla que no llega a entrar.',
    tocar: () => {
      ruido({ dur: 0.02, gain: 0.31, filtro: { tipo: 'lowpass', freq: 600 } });
      ruido({ dur: 0.02, gain: 0.24, en: 0.055, filtro: { tipo: 'lowpass', freq: 600 } });
    },
  },

  /* ---- Los que sí se hacen notar ---- */
  {
    grupo: 'Con peso',
    id: 'martillo',
    nombre: 'Martillo',
    predeterminado: true,
    nota: 'Un golpe con peso: grave en picado más un impacto de ruido. Se nota muchísimo y '
      + 'aun así no es un pitido. Es el elegido para el fallo.',
    tocar: () => {
      tono({ freq: 200, freqFin: 55, tipo: 'triangle', dur: 0.20, gain: 0.143 });
      ruido({ dur: 0.05, gain: 0.084, filtro: { tipo: 'lowpass', freq: 900 } });
    },
  },
  {
    id: 'alarma',
    nombre: 'Alarma',
    nota: 'Dos cuadradas que bajan, el «no» de una máquina recreativa. Imposible de ignorar y '
      + 'también lo más parecido a una regañina.',
    tocar: () => {
      tono({ freq: 320, tipo: 'square', dur: 0.09, gain: 0.16 });
      tono({ freq: 240, tipo: 'square', dur: 0.15, gain: 0.16, en: 0.09 });
    },
  },
  {
    id: 'zumbido',
    nombre: 'Zumbido',
    nota: 'Dos sierras graves desafinadas cuatro hercios entre sí. Esa batida es lo que lo '
      + 'vuelve áspero; es el más duro de los ocho.',
    tocar: () => {
      const capa = (f: number) => tono({
        freq: f, tipo: 'sawtooth', dur: 0.17, gain: 0.073,
        filtro: { tipo: 'lowpass', freq: 1400 },
      });
      capa(110); capa(114);
    },
  },
  {
    id: 'disonancia',
    nombre: 'Disonancia',
    nota: 'Dos notas a distancia de tritono, el intervalo que el oído rechaza solo. Molesta '
      + 'por lo que es, no por cuánto suena: no hace falta subirle el volumen.',
    tocar: () => {
      tono({ freq: 330, tipo: 'triangle', dur: 0.22, gain: 0.092 });
      tono({ freq: Bb4, tipo: 'triangle', dur: 0.22, gain: 0.092 });
    },
  },
  {
    id: 'vidrio',
    nombre: 'Vidrio',
    nota: 'Estallido agudo con cola que cae. Corta el ritmo en seco: es para cuando quieras '
      + 'que el usuario PARE, no solo que se entere.',
    tocar: () => {
      ruido({ dur: 0.13, gain: 0.081, filtro: { tipo: 'highpass', freq: 3500 } });
      tono({ freq: 2200, freqFin: 700, dur: 0.14, gain: 0.043 });
    },
  },
  {
    id: 'atasco',
    nombre: 'Tecla atascada',
    grupo: 'Máquina de escribir',
    nota: 'Dos barras que chocan y se quedan trabadas: golpe seco, madera y un roce metálico '
      + 'detrás. No tiene altura definida, así que no puede sonar a pitido de error.',
    tocar: () => {
      ruido({ dur: 0.02, gain: 0.18, filtro: { tipo: 'bandpass', freq: 1800, q: 1.5 } });
      ruido({ dur: 0.10, gain: 0.15, filtro: { tipo: 'lowpass', freq: 380 } });
      ruido({ dur: 0.05, gain: 0.10, en: 0.045, filtro: { tipo: 'bandpass', freq: 2600, q: 3 } });
      tono({ freq: 150, freqFin: 95, tipo: 'triangle', dur: 0.14, gain: 0.13 });
    },
  },
];

/* ============================ RACHA ============================

   Suena en cada hito (10, 20, 30... o 5, 15, 25...). Recibe el `nivel` del hito —0 el
   primero, 1 el segundo...— y SUBE DE TONO con él: dos semitonos por escalón.

   Que suba es la mitad del efecto. Con un sonido fijo, el hito veinte suena exactamente
   igual que el diez y el premio deja de significar progreso; subiendo, la racha se oye
   crecer aunque no se mire el número. El transporte se topa a los seis escalones porque a
   partir de ahí se vuelve chillón. */
const TOPE_ESCALONES = 6;
const escalon = (nivel: number) => Math.min(nivel, TOPE_ESCALONES) * 2;

const sub = (freqs: number[], nivel: number) =>
  freqs.map((f) => transportar(f, escalon(nivel)));

export const RACHA: Candidato[] = [
  {
    grupo: 'Clásicos',
    id: 'arpegio',
    nombre: 'Arpegio',
    nota: 'Tres notas de acorde mayor, hacia arriba. El premio clásico y el más legible.',
    tocar: (nivel = 0) => arpegio(sub([C5, E5, G5], nivel), 0.06, {
      tipo: 'triangle', dur: 0.18, gain: 0.10,
    }),
  },
  {
    id: 'moneda',
    nombre: 'Moneda',
    nota: 'Dos notas rápidas, la segunda mantenida. Es el gesto de los videojuegos.',
    tocar: (nivel = 0) => {
      const [a, b] = sub([B5, E6], nivel);
      tono({ freq: a, tipo: 'square', dur: 0.06, gain: 0.045 });
      tono({ freq: b, tipo: 'square', dur: 0.20, gain: 0.045, en: 0.06 });
    },
  },
  {
    id: 'campanas',
    nombre: 'Campanas',
    predeterminado: true,
    nota: 'Dos senos agudos con cola larga. Brillante y aireado; el menos "videojuego".',
    tocar: (nivel = 0) => {
      const [a, b] = sub([E6, G6], nivel);
      tono({ freq: a, dur: 0.45, gain: 0.07 });
      tono({ freq: b, dur: 0.55, gain: 0.05, en: 0.08 });
    },
  },
  {
    id: 'subida',
    nombre: 'Subida',
    nota: 'Un barrido continuo, sin notas. Se lee como impulso más que como premio.',
    tocar: (nivel = 0) => tono({
      freq: transportar(500, escalon(nivel)), freqFin: transportar(1400, escalon(nivel)),
      tipo: 'triangle', dur: 0.26, gain: 0.112,
    }),
  },
  {
    id: 'chispa',
    nombre: 'Chispa',
    nota: 'Cuatro notas muy rápidas de escala pentatónica. Ligero, no interrumpe el tecleo.',
    tocar: (nivel = 0) => arpegio(sub([C5, D5, E5, G5], nivel), 0.045, {
      dur: 0.12, gain: 0.11,
    }),
  },
  {
    id: 'acorde',
    nombre: 'Acorde',
    nota: 'Las tres notas a la vez y con ataque suave. Un "bien" cálido, sin fanfarria.',
    tocar: (nivel = 0) => {
      sub([C5, E5, G5], nivel).forEach((f) =>
        tono({ freq: f, tipo: 'triangle', dur: 0.40, gain: 0.06, ataque: 0.03 }));
    },
  },

  /* ---- Los raros. Ninguno es el premio estándar de un videojuego, y esa es la intención:
     este sonido se oye decenas de veces por sesión, y un gesto que ya se conoce de otro
     sitio cansa antes que uno que no se sabe de dónde sale. ---- */
  {
    grupo: 'Raros',
    id: 'koto',
    nombre: 'Koto',
    nota: 'Cinco notas de escala pentatónica japonesa con cuerda pulsada. Se reconoce como '
      + 'música y es rarísimo en una web de tipeo.',
    tocar: (nivel = 0) => arpegio(sub([D5, E5, A5, B5, D6], nivel), 0.055, {
      tipo: 'sawtooth', dur: 0.35, gain: 0.083, filtro: { tipo: 'lowpass', freq: 2600 },
    }),
  },
  {
    id: 'sonar',
    nombre: 'Sonar',
    nota: 'Un ping muy filtrado con cola larguísima y su eco a un tercio de segundo. '
      + 'Espacioso, casi submarino; no se parece a ningún premio conocido.',
    tocar: (nivel = 0) => {
      const [a] = sub([A5], nivel);
      const eco = (en: number, gain: number, dur: number) => tono({
        freq: a, dur, gain, ataque: 0.003, en, filtro: { tipo: 'bandpass', freq: a, q: 8 },
      });
      eco(0, 0.12, 0.9);
      eco(0.28, 0.053, 0.7);
    },
  },
  {
    id: 'cristal',
    nombre: 'Cristal',
    nota: 'Tres agudos desafinados unos pocos hercios entre sí. La batida da un brillo que no '
      + 'suena a ningún instrumento y se queda flotando.',
    tocar: (nivel = 0) => {
      sub([E6, E6 * 1.006, A6], nivel).forEach((f, i) =>
        tono({ freq: f, dur: 0.75 - i * 0.12, gain: 0.045, ataque: 0.006 }));
    },
  },
  {
    id: 'bumeran',
    nombre: 'Bumerán',
    nota: 'Cae en picado y vuelve a subir mucho más alto de donde empezó. Aquí el premio es '
      + 'el gesto y no la melodía: se entiende sin oído musical.',
    tocar: (nivel = 0) => {
      const base = transportar(700, escalon(nivel));
      tono({ freq: base, freqFin: base * 0.45, tipo: 'triangle', dur: 0.12, gain: 0.10 });
      tono({
        freq: base * 0.45, freqFin: base * 2.2, tipo: 'triangle',
        dur: 0.30, gain: 0.115, en: 0.12,
      });
    },
  },
  {
    id: 'burbujeo',
    nombre: 'Burbujeo',
    nota: 'Seis notas cortísimas que suben a saltos desiguales. Suena a algo que se derrama, '
      + 'no a fanfarria; el más ligero de los raros.',
    tocar: (nivel = 0) => {
      [0, 4, 2, 7, 9, 12].forEach((semis, i) => tono({
        freq: transportar(C5, semis + escalon(nivel)),
        dur: 0.09, gain: 0.072, en: i * 0.035,
      }));
    },
  },

  /* ---- AIRE. Ni una nota: solo ruido con el filtro moviéndose. Es la familia que menos
     convención arrastra, porque no hay nada musical de lo que tirar. El precio es que
     tampoco puede apoyarse en el "subir = bien" de una melodía, así que el gesto lo tiene
     que hacer todo el filtro: lo que premia es que se ABRA. ---- */
  {
    grupo: 'Aire',
    id: 'brisa',
    nombre: 'Brisa',
    nota: 'Una ráfaga con el filtro abriéndose hacia arriba. Suave, corta, y en cada hito se '
      + 'abre un poco más alto.',
    tocar: (nivel = 0) => {
      ruido({
        dur: 0.55, gain: 0.39, ataque: 0.10,
        filtro: {
          tipo: 'bandpass', freq: 380, freqFin: transportar(1700, escalon(nivel)), q: 1.3,
        },
      });
      ruido({ dur: 0.75, gain: 0.065, ataque: 0.20, filtro: { tipo: 'highpass', freq: 3000 } });
    },
  },
  {
    id: 'llovizna',
    nombre: 'Llovizna',
    nota: 'Un lecho de agua fina y doce gotas colocadas al azar. Nunca suena dos veces igual, '
      + 'porque las gotas no caen dos veces en el mismo sitio.',
    tocar: (nivel = 0) => {
      ruido({ dur: 0.70, gain: 0.08, ataque: 0.12, filtro: { tipo: 'highpass', freq: 2600 } });
      const brillo = transportar(3000, escalon(nivel));
      for (let i = 0; i < 12; i += 1) {
        ruido({
          dur: 0.012, gain: 0.05 + Math.random() * 0.05, en: Math.random() * 0.55,
          filtro: { tipo: 'bandpass', freq: brillo * (0.6 + Math.random() * 0.9), q: 8 },
        });
      }
    },
  },
  {
    id: 'ola',
    nombre: 'Ola',
    nota: 'Grave que crece, rompe y se retira: el filtro se abre y se vuelve a cerrar. Suena '
      + 'a agua y no a premio, y aun así el gesto se entiende solo.',
    tocar: (nivel = 0) => {
      const cima = transportar(2600, escalon(nivel));
      ruido({
        dur: 0.45, gain: 0.22, ataque: 0.25,
        filtro: { tipo: 'lowpass', freq: 300, freqFin: cima },
      });
      ruido({
        dur: 0.50, gain: 0.14, ataque: 0.03, en: 0.42,
        filtro: { tipo: 'lowpass', freq: cima, freqFin: 500 },
      });
    },
  },
  {
    id: 'carrillon',
    nombre: 'Carrillón',
    nota: 'Cuatro tubos de metal movidos por una brisa, en orden y momento al azar. Es lo más '
      + 'cerca que se puede estar de "sonido de viento" sin dejar de avisar de algo. El más '
      + 'largo de los suaves: cola de algo más de un segundo.',
    tocar: (nivel = 0) => {
      ruido({ dur: 0.80, gain: 0.078, ataque: 0.18, filtro: { tipo: 'bandpass', freq: 900, q: 0.9 } });
      const base = transportar(A5, escalon(nivel));
      [0, 7, 12, 4].forEach((semis, i) => golpeInarmonico(
        transportar(base, semis), PARCIALES_TUBO,
        i * 0.13 + Math.random() * 0.05, 0.032, 1.1,
      ));
    },
  },

  /* ---- OBJETOS. Metal golpeado y nada más: los parciales inarmónicos hacen el trabajo. ---- */
  {
    grupo: 'Objetos',
    id: 'cuenco',
    nombre: 'Cuenco',
    nota: 'Metal grande golpeado, con dos capas desafinadas cuatro milésimas que baten muy '
      + 'despacio. Larguísimo y suavísimo; casi no tiene ataque, así que no interrumpe.',
    tocar: (nivel = 0) => {
      const f = transportar(G4, escalon(nivel));
      golpeInarmonico(f, PARCIALES_CUENCO, 0, 0.058, 1.6, 0.02);
      golpeInarmonico(f * 1.004, PARCIALES_CUENCO, 0.012, 0.043, 1.5);
    },
  },
  {
    id: 'tubo',
    nombre: 'Tubo',
    nota: 'Un solo tubo de carrillón, apagado. Corto y seco: el premio más discreto de todos.',
    tocar: (nivel = 0) => golpeInarmonico(
      transportar(A5, escalon(nivel)), PARCIALES_TUBO, 0, 0.07, 0.55, 0.025,
    ),
  },

  /* ---- MÁQUINA DE ESCRIBIR ---- */
  {
    grupo: 'Máquina de escribir',
    id: 'campanilla',
    nombre: 'Campanilla de margen',
    nota: 'La campanilla que avisaba de que se acababa la línea. Parciales de campana de '
      + 'verdad —con su tercera menor— y el golpe del badajo delante. Es el único sonido de '
      + 'toda la lista que solo tendría sentido en DEDEA.',
    tocar: (nivel = 0) => golpeInarmonico(
      transportar(C6, escalon(nivel)), PARCIALES_CAMPANA, 0, 0.055, 0.9, 0.035,
    ),
  },
];

/* ==================== FIN DEL EJERCICIO ====================

   Tres resultados: muy bien, así así y flojo. Se ofrecen como FAMILIAS y no como nueve
   sonidos sueltos, y esa es la decisión de diseño de este bloque: los tres se van a oír el
   mismo día, en la misma pantalla, y si no comparten timbre el usuario no oye "me fue
   regular", oye "esta vez sonó otra aplicación".

   Dentro de la familia lo que cambia es lo musical, que es donde vive el significado:
     · BIEN   — sube y RESUELVE en la tónica. Cierra.
     · NORMAL — se queda a medias, sin resolver. "Ahí está, pero falta."
     · FLOJO  — baja, corto y grave. Y NO es un pitido de error: el ejercicio terminó, solo
                que sin llegar al mínimo. Un sonido de fracaso convierte en castigo lo que
                debería ser una invitación a repetir. */
export type Grado = 'bien' | 'normal' | 'flojo';

export interface FamiliaFinal {
  id: string;
  nombre: string;
  // Ver la nota de `predeterminado` en Candidato: es el mismo campo y el mismo criterio.
  predeterminado?: boolean;
  grupo?: string;
  nota: string;
  tocar: (grado: Grado) => void;
}

export const FINALES: FamiliaFinal[] = [
  {
    grupo: 'Musicales',
    id: 'fanfarria',
    nombre: 'Fanfarria',
    nota: 'Arpegios de triangular, secos y brillantes. El más celebratorio de los tres.',
    tocar: (grado) => {
      if (grado === 'bien') {
        arpegio([C5, E5, G5, C6], 0.10, { tipo: 'triangle', dur: 0.30, gain: 0.10 });
      } else if (grado === 'normal') {
        arpegio([C5, E5, G5], 0.10, { tipo: 'triangle', dur: 0.28, gain: 0.09 });
      } else {
        arpegio([G4, E4], 0.13, { tipo: 'triangle', dur: 0.30, gain: 0.08 });
      }
    },
  },
  {
    id: 'campanas-fin',
    nombre: 'Campanas',
    nota: 'Senos con cola larga, casi sin ataque. Sereno; encaja con la paleta oscura.',
    tocar: (grado) => {
      if (grado === 'bien') {
        arpegio([E5, G5, C6, E6], 0.13, { dur: 0.7, gain: 0.07, ataque: 0.01 });
      } else if (grado === 'normal') {
        arpegio([E5, A5], 0.15, { dur: 0.7, gain: 0.07, ataque: 0.01 });
      } else {
        tono({ freq: A4, dur: 0.9, gain: 0.07, ataque: 0.02 });
      }
    },
  },
  {
    id: 'calido',
    nombre: 'Cálido',
    nota: 'Notas gruesas de dos capas con ataque lento. El menos infantil; suena a "hecho".',
    tocar: (grado) => {
      const capa = (f: number, en: number, dur: number, gain: number) => {
        tono({ freq: f, tipo: 'triangle', dur, gain, ataque: 0.02, en });
        tono({ freq: f * 2, dur: dur * 0.6, gain: gain * 0.35, ataque: 0.02, en });
      };
      if (grado === 'bien') {
        [C5, E5, G5, C6].forEach((f, i) => capa(f, i * 0.11, 0.5, 0.08));
      } else if (grado === 'normal') {
        [C5, G5].forEach((f, i) => capa(f, i * 0.13, 0.5, 0.08));
      } else {
        [G4, E4].forEach((f, i) => capa(f, i * 0.15, 0.55, 0.07));
      }
    },
  },

  /* ---- Las tres llamativas ---- */
  {
    id: 'cristal-fin',
    nombre: 'Cristal',
    predeterminado: true,
    nota: 'Agudos larguísimos y desafinados entre sí, sin ataque. Se queda flotando después '
      + 'de que el ejercicio ya terminó; no se parece a nada de un juego.',
    tocar: (grado) => {
      // Cada nota es un par batiendo: es lo que produce el brillo, no la nota en sí.
      const par = (f: number, en: number, dur: number, gain: number) => {
        tono({ freq: f, dur, gain, ataque: 0.01, en });
        tono({ freq: f * 1.006, dur, gain: gain * 0.8, ataque: 0.01, en });
      };
      if (grado === 'bien') [E5, G5, C6, E6].forEach((f, i) => par(f, i * 0.14, 1.3, 0.05));
      else if (grado === 'normal') [E5, A5].forEach((f, i) => par(f, i * 0.16, 1.2, 0.05));
      else par(A4, 0, 1.2, 0.05);
    },
  },
  {
    id: 'retro',
    nombre: 'Retro',
    nota: 'Cuadradas de consola de ocho bits, y el «muy bien» remata con un trino. Es la más '
      + 'llamativa de las seis y también la más divisiva: o encanta o cansa.',
    tocar: (grado) => {
      if (grado === 'bien') {
        arpegio([C5, E5, G5, C6], 0.07, { tipo: 'square', dur: 0.14, gain: 0.07 });
        // El trino final es lo que la vuelve reconocible; sin él es un arpegio más.
        [C6, D6, C6, D6, C6].forEach((f, i) => tono({
          freq: f, tipo: 'square', dur: 0.07, gain: 0.06, en: 0.30 + i * 0.055,
        }));
      } else if (grado === 'normal') {
        arpegio([C5, F5, C5], 0.09, { tipo: 'square', dur: 0.16, gain: 0.07 });
      } else {
        arpegio([G4, E4, C4], 0.11, { tipo: 'square', dur: 0.20, gain: 0.06 });
      }
    },
  },
  {
    id: 'coral',
    nombre: 'Coral',
    nota: 'Un acorde que se abre desde el centro y crece durante casi dos segundos. Sin '
      + 'melodía y sin ataque: es la más solemne y la más adulta de todas.',
    tocar: (grado) => {
      const voz = (f: number, en: number, gain = 0.05) => tono({
        freq: f, tipo: 'triangle', dur: 1.6, gain, ataque: 0.25, en,
      });
      if (grado === 'bien') {
        // Se abre: primero el centro, después el grave y el agudo a la vez.
        voz(G4, 0); voz(C4, 0.18); voz(C5, 0.18); voz(E5, 0.36); voz(G5, 0.54, 0.035);
      } else if (grado === 'normal') {
        // Quinta al aire: ni mayor ni menor, o sea sin veredicto.
        voz(C4, 0); voz(G4, 0.2); voz(C5, 0.4);
      } else {
        voz(A3, 0); voz(A4, 0.22); voz(C5, 0.44, 0.035);
      }
    },
  },

  /* ---- AIRE ----

     Estas tres no tienen melodía, así que no pueden decir "bien" con un acorde mayor. El
     grado se oye en la CANTIDAD: cuánto se abre el filtro, cuánto brillo hay, cuánto dura.
     Es una gramática distinta y hay que comprobar que se entiende — que "así así" no suene
     a "muy bien más corto". Ese es justo el riesgo de esta familia. */
  {
    grupo: 'Aire',
    id: 'viento',
    nombre: 'Viento',
    nota: 'Ruido puro, ni una nota en toda la familia. Lo que dice cómo te fue es cuánto se '
      + 'abre el filtro: brillante y largo, medio, o apenas un suspiro grave.',
    tocar: (grado) => {
      /* Dos capas encadenadas: la primera abre y la segunda cierra. Con eso el soplo tiene
         principio y final sin necesidad de automatizar una curva entera. */
      const soplo = (cima: number, largo: number, gain: number) => {
        ruido({
          dur: largo * 0.62, gain, ataque: largo * 0.35,
          filtro: { tipo: 'lowpass', freq: 260, freqFin: cima },
        });
        ruido({
          dur: largo * 0.55, gain: gain * 0.8, ataque: 0.06, en: largo * 0.55,
          filtro: { tipo: 'lowpass', freq: cima, freqFin: 320 },
        });
      };
      /* Las ganancias NO son las tres iguales, y la diferencia no es de gusto: un paso
         bajo a 760 Hz sobre ruido blanco se come muchísimo más nivel que uno a 5200. Con
         el mismo número los tres, el "flojo" medía 0.05 de pico contra 0.13 del "bien" y
         se quedaba casi inaudible. Compensadas, los tres caen cerca de 0.10. */
      if (grado === 'bien') soplo(5200, 2.0, 0.19);
      else if (grado === 'normal') soplo(1900, 1.5, 0.24);
      else soplo(760, 1.2, 0.30);
    },
  },
  {
    id: 'lluvia',
    nombre: 'Lluvia',
    nota: 'Llega, cae y pasa. En "muy bien" escampa y entra un claro al final; en "flojo" se '
      + 'queda gris y se apaga sin abrirse.',
    tocar: (grado) => {
      const gotas = grado === 'bien' ? 26 : grado === 'normal' ? 16 : 8;
      const largo = grado === 'bien' ? 1.9 : grado === 'normal' ? 1.5 : 1.1;
      const brillo = grado === 'bien' ? 4200 : grado === 'normal' ? 2600 : 1100;

      /* EL LECHO NO CAMBIA DE DENSIDAD, CAMBIA DE FORMA. En "muy bien" escampa —el filtro
         sube y se abre—, en "así así" se queda quieto, y en "flojo" se cierra y se vuelve
         pesado.

         La primera versión solo cambiaba cuántas gotas caían y dónde empezaba un paso alto.
         Medido, los tres grados daban el MISMO centroide espectral —13.387, 12.549 y 12.207
         Hz— y sonaban prácticamente iguales: un paso alto deja pasar todo lo de arriba, así
         que el brillo no bajaba por mucho que se moviera el corte. Era justo el riesgo de
         esta familia: sin melodía, si la cantidad no se oye, no queda nada. */
      if (grado === 'bien') {
        /* DOS LECHOS ENCADENADOS y no uno con el filtro barriendo.

           Con un solo barrido de 1.200 a 4.200 Hz el brillo llegaba TARDE: la envolvente ya
           había caído casi del todo para cuando el corte estaba arriba, así que el claro no
           se oía. Medido, el centroide de "muy bien" salía en 2.133 Hz contra los 2.432 de
           "así así" — el mejor resultado sonaba más apagado que el mediano. Con dos capas, la
           segunda entra con su propio ataque y con nivel de sobra. */
        ruido({
          dur: largo * 0.75, gain: 0.22, ataque: 0.25,
          filtro: { tipo: 'bandpass', freq: 1400, q: 0.7 },
        });
        ruido({
          dur: largo * 0.70, gain: 0.20, ataque: 0.35, en: largo * 0.32,
          filtro: { tipo: 'bandpass', freq: 3900, q: 0.7 },
        });
      } else if (grado === 'normal') {
        ruido({
          dur: largo, gain: 0.22, ataque: 0.25,
          filtro: { tipo: 'bandpass', freq: 1900, q: 0.7 },
        });
      } else {
        ruido({
          dur: largo, gain: 0.17, ataque: 0.25,
          filtro: { tipo: 'lowpass', freq: 2200, freqFin: 600 },
        });
      }
      for (let i = 0; i < gotas; i += 1) {
        ruido({
          dur: 0.012, gain: 0.04 + Math.random() * 0.05,
          en: 0.10 + Math.random() * (largo - 0.35),
          filtro: { tipo: 'bandpass', freq: brillo * (0.5 + Math.random()), q: 9 },
        });
      }
      /* El claro es la ÚNICA señal tonal de la familia, y solo aparece cuando fue bien.
         Sin él, "muy bien" y "así así" se distinguían solo por cuánto duraban. */
      if (grado === 'bien') {
        [E5, A5, C6].forEach((f, i) => tono({
          freq: f, dur: 1.4 - i * 0.2, gain: 0.035, ataque: 0.12, en: 1.0 + i * 0.1,
        }));
      }
    },
  },
  {
    id: 'carrillon-fin',
    nombre: 'Carrillón',
    nota: 'Los mismos tubos inarmónicos de la racha, pero con tiempo: seis en "muy bien", '
      + 'tres en "así así", y uno solo y grave en "flojo".',
    tocar: (grado) => {
      const tubos = grado === 'bien'
        ? [0, 5, 7, 12, 16, 19]
        : grado === 'normal' ? [0, 5, 7] : [-5];
      const base = grado === 'flojo' ? G4 : A5;
      const largo = grado === 'bien' ? 1.6 : 1.2;
      ruido({
        dur: largo + 0.5, gain: 0.10, ataque: 0.3,
        filtro: { tipo: 'bandpass', freq: 700, freqFin: grado === 'bien' ? 1500 : 600, q: 0.9 },
      });
      tubos.forEach((semis, i) => golpeInarmonico(
        transportar(base, semis), PARCIALES_TUBO,
        i * 0.17 + Math.random() * 0.05, 0.05, largo,
      ));
    },
  },

  /* ---- OBJETOS ---- */
  {
    grupo: 'Objetos',
    id: 'cuenco-fin',
    nombre: 'Cuenco',
    nota: 'Un golpe de metal grande que se queda sonando tres segundos. Sin melodía y casi '
      + 'sin ataque: el grado se oye en cuánto se abre el timbre y cuánto tarda en irse.',
    tocar: (grado) => {
      const f = grado === 'bien' ? G4 : grado === 'normal' ? E4 : C4;
      const largo = grado === 'bien' ? 3.0 : grado === 'normal' ? 2.2 : 1.6;
      /* Cuanto más grave la fundamental, más se suman los parciales entre sí: con la misma
         ganancia en los tres, "flojo" medía MÁS pico que "muy bien" (0.167 contra 0.134),
         o sea que el peor resultado sonaba más fuerte que el mejor. */
      const gain = grado === 'bien' ? 0.080 : grado === 'normal' ? 0.058 : 0.046;
      golpeInarmonico(f, PARCIALES_CUENCO, 0, gain, largo, 0.025);
      golpeInarmonico(f * 1.004, PARCIALES_CUENCO, 0.012, gain * 0.75, largo * 0.95);
      // La segunda campanada, media octava arriba, solo en el mejor: es el "se abre".
      if (grado === 'bien') {
        golpeInarmonico(f * 1.5, PARCIALES_CUENCO, 0.55, 0.040, largo * 0.7, 0.015);
      }
    },
  },

  /* ---- MÁQUINA DE ESCRIBIR ---- */
  {
    grupo: 'Máquina de escribir',
    id: 'carro',
    nombre: 'Retorno del carro',
    nota: 'El trinquete del carro corriendo, el tope al llegar, y la campanilla. Es un gesto '
      + 'mecánico que TERMINA en vez de una melodía que resuelve; el grado se oye en cuántos '
      + 'dientes recorre y en si llega a sonar la campana.',
    tocar: (grado) => {
      const dientes = grado === 'bien' ? 9 : grado === 'normal' ? 6 : 4;
      /* Las posiciones se calculan una a una y los huecos se van acortando: el carro
         ACELERA. Con separación fija sonaba a metrónomo, que es exactamente lo contrario de
         un mecanismo soltándose. */
      const cuando: number[] = [];
      let t = 0;
      for (let i = 0; i < dientes; i += 1) { cuando.push(t); t += 0.048 - i * 0.003; }
      cuando.forEach((en) => ruido({
        dur: 0.02, gain: 0.05, en,
        filtro: { tipo: 'bandpass', freq: 1600 + Math.random() * 900, q: 3 },
      }));

      /* EL TOPE ES MÁS FUERTE CUANTO PEOR FUE, y es lo contrario de lo que parece.

         La primera versión dejaba el "flojo" sin campanilla y sin nada más: medía 0.016 de
         pico, treinta veces menos que su propio "muy bien" (0.479), o sea inaudible al lado
         del resto del catálogo. El arreglo no es subirle el volumen a secas sino darle un
         golpe seco con cuerpo: el carro llega al final y NO suena la campana. El mensaje
         sigue siendo el mismo —no llegaste— pero se oye. */
      ruido({
        dur: 0.09, gain: grado === 'flojo' ? 0.09 : 0.07, en: t,
        filtro: { tipo: 'lowpass', freq: 500 },
      });
      if (grado === 'flojo') {
        tono({ freq: 130, freqFin: 78, tipo: 'triangle', dur: 0.22, gain: 0.07, en: t });
      } else {
        /* Seis parciales de campana se suman entre sí: con 0.055 el conjunto medía 0.479 de
           pico, tres veces cualquier otro sonido del catálogo. Con 0.028 se fue al otro
           extremo y "muy bien" acababa sonando más flojo que "flojo". 0.045 los deja a los
           tres alrededor de 0.10, que es la media de la lista. */
        golpeInarmonico(
          grado === 'bien' ? C6 : A5, PARCIALES_CAMPANA,
          t + 0.03, 0.045, grado === 'bien' ? 1.1 : 0.7, 0.025,
        );
      }
    },
  },
];

export const POR_FAMILIA: Record<Familia, Candidato[]> = {
  tecleo: TECLEO,
  correcto: CORRECTO,
  error: ERROR,
  racha: RACHA,
};
