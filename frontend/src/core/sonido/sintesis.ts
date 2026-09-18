/* SÍNTESIS DE SONIDO EN EL NAVEGADOR — sin un solo archivo de audio.

   No es por ahorrar espacio: un `.mp3` de 3 KB pesa nada, pero llega por la red. El primer
   tecleo de la sesión sonaría tarde o no sonaría, que en una app de mecanografía es peor que
   el silencio — un sonido que llega 200 ms después de la tecla se percibe como un fallo del
   teclado, no como una respuesta.

   Y hay una razón que el archivo no puede cubrir: el sonido de racha SUBE DE TONO con cada
   hito. Con una muestra grabada eso exige o diez archivos o un cambio de velocidad de
   reproducción, que arrastra la duración y suena a cinta acelerada. Sintetizado es un
   multiplicador sobre la frecuencia.

   Todo lo de aquí son cuatro primitivas —tono, ruido, secuencia y el maestro de volumen—.
   Los sonidos concretos viven en catalogo.ts, para que probar uno nuevo no obligue a tocar
   el motor. */

/* Un AudioContext no puede crearse ni sonar hasta que el usuario haya interactuado con la
   página: los navegadores lo bloquean para que nadie haga ruido al entrar. Por eso el
   contexto es PEREZOSO y se crea en la primera llamada real, que siempre viene de un clic o
   de una tecla, y por eso `arrancarAudio` además intenta reanudarlo — un contexto creado
   antes de tiempo queda 'suspended' y no vuelve solo. */
let contexto: AudioContext | null = null;
let maestro: GainNode | null = null;

export const VOLUMEN_POR_DEFECTO = 0.6;

export const arrancarAudio = (): AudioContext => {
  if (!contexto) {
    contexto = new AudioContext();
    maestro = contexto.createGain();
    maestro.gain.value = VOLUMEN_POR_DEFECTO;
    maestro.connect(contexto.destination);
  }
  if (contexto.state === 'suspended') void contexto.resume();
  return contexto;
};

const salida = (): GainNode => {
  arrancarAudio();
  return maestro as GainNode;
};

export const ponerVolumen = (v: number) => {
  salida().gain.value = Math.max(0, Math.min(1, v));
};

/* El buffer de ruido blanco se genera UNA vez y se reutiliza.

   Dos segundos y medio de ruido son ~120.000 números al azar. Generarlos en cada pulsación,
   a cinco o seis por segundo, es trabajo tirado a la basura en el hilo que también tiene que
   pintar el texto.

   Dura 2,5 s y no medio segundo porque los sonidos de aire —viento, lluvia, el cierre
   largo— pasan de los dos segundos, y además se reproduce EN BUCLE: así ninguna duración
   puede quedarse sin material. La periodicidad de 2,5 s no se oye a estas duraciones. */
const DURACION_BUFFER_RUIDO = 2.5;
let bufferRuido: AudioBuffer | null = null;

const ruidoBlanco = (ctx: AudioContext): AudioBuffer => {
  if (!bufferRuido) {
    const n = Math.floor(ctx.sampleRate * DURACION_BUFFER_RUIDO);
    bufferRuido = ctx.createBuffer(1, n, ctx.sampleRate);
    const datos = bufferRuido.getChannelData(0);
    for (let i = 0; i < n; i += 1) datos[i] = Math.random() * 2 - 1;
  }
  return bufferRuido;
};

export interface Filtro {
  tipo: BiquadFilterType;
  freq: number;
  /* Adónde se mueve el corte del filtro a lo largo de la duración.

     Es lo que convierte ruido blanco en VIENTO. Un ruido filtrado con el corte quieto es una
     textura plana; moviendo el corte aparece un gesto —algo que se abre, algo que pasa— y el
     oído lo lee como un objeto en movimiento en vez de como estática. Y como no hay ninguna
     nota de por medio, no puede sonar a melodía de videojuego: es la única familia de
     sonidos que no arrastra ninguna convención musical. */
  freqFin?: number;
  q?: number;
}

const conFiltro = (
  ctx: AudioContext, destino: AudioNode, t0: number, dur: number, filtro?: Filtro,
): AudioNode => {
  if (!filtro) return destino;
  const f = ctx.createBiquadFilter();
  f.type = filtro.tipo;
  f.frequency.setValueAtTime(filtro.freq, t0);
  if (filtro.freqFin) {
    f.frequency.exponentialRampToValueAtTime(Math.max(20, filtro.freqFin), t0 + dur);
  }
  if (filtro.q !== undefined) f.Q.value = filtro.q;
  f.connect(destino);
  return f;
};

/* La envolvente es exponencial y no lineal, y no es un detalle de gusto: el oído percibe el
   volumen en escala logarítmica, así que una caída lineal se escucha como un corte brusco al
   final. El suelo es 0.0001 porque `exponentialRampToValueAtTime` no admite el cero. */
/* CINCO MILISEGUNDOS DE ADELANTO en todo lo que se programa.

   Sin esto el instante de arranque se calcula con `currentTime`, y para cuando la envolvente
   termina de programarse ese instante ya pasó. Cuando eso ocurre el navegador no puede
   interpolar hacia atrás: salta al valor y comprime la rampa en lo que queda, y un ataque
   comprimido es un chasquido.

   NO es prevención: estaba pasando, y en los sonidos CORTOS. Medido antes y después sobre
   el mismo sonido de tecleo de 50 ms, `madera`: con la ganancia BAJADA de 0.12 a 0.083 su
   pico se desplomó de 0.109 a 0.013. Un cambio de ganancia no puede hacer eso; lo que
   desapareció fue el chasquido, que era casi todo lo que se estaba midiendo. Los sonidos
   largos no lo notaban porque el chasquido quedaba enterrado bajo el resto.

   La consecuencia práctica es doble: sonaban peor de lo necesario, y cualquier medición
   hecha antes de este cambio estaba midiendo el fallo en vez del sonido. */
const ADELANTO = 0.005;

const envolvente = (g: GainNode, t0: number, pico: number, ataque: number, dur: number) => {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pico), t0 + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
};

export interface Tono {
  freq: number;
  /* Barrido hasta esta frecuencia a lo largo de la duración. Es lo que convierte un pitido
     en un "pop" (cae) o en un "swoosh" (sube). */
  freqFin?: number;
  tipo?: OscillatorType;
  dur?: number;
  gain?: number;
  ataque?: number;
  /* Retardo desde ahora, en segundos. Así se escriben arpegios sin encadenar temporizadores:
     todas las notas se programan de una vez y el reloj del audio las coloca con precisión de
     muestra, cosa que un setTimeout no puede prometer. */
  en?: number;
  filtro?: Filtro;
}

export const tono = ({
  freq, freqFin, tipo = 'sine', dur = 0.1, gain = 0.1, ataque = 0.004, en = 0, filtro,
}: Tono) => {
  const ctx = arrancarAudio();
  const t0 = ctx.currentTime + ADELANTO + en;

  const osc = ctx.createOscillator();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqFin) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqFin), t0 + dur);

  const g = ctx.createGain();
  envolvente(g, t0, gain, Math.min(ataque, dur / 2), dur);
  g.connect(salida());

  osc.connect(conFiltro(ctx, g, t0, dur, filtro));
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
};

export interface Ruido {
  dur?: number;
  gain?: number;
  ataque?: number;
  en?: number;
  filtro?: Filtro;
}

export const ruido = ({ dur = 0.03, gain = 0.1, ataque = 0.002, en = 0, filtro }: Ruido) => {
  const ctx = arrancarAudio();
  const t0 = ctx.currentTime + ADELANTO + en;

  const src = ctx.createBufferSource();
  src.buffer = ruidoBlanco(ctx);

  const g = ctx.createGain();
  envolvente(g, t0, gain, Math.min(ataque, dur / 2), dur);
  g.connect(salida());

  src.connect(conFiltro(ctx, g, t0, dur, filtro));
  /* EN BUCLE y arrancando en un punto AL AZAR del buffer.

     Lo del azar es lo que impide que las cien pulsaciones de un ejercicio suenen idénticas,
     que es justo lo que vuelve cansino un sonido de tecleo: el oído detecta la repetición
     exacta y deja de oírlo como una respuesta para oírlo como un zumbido.

     El bucle es lo que permite que un soplo dure más que el buffer sin quedarse mudo a mitad
     de camino; con el corte fijado por `stop`, la duración la sigue mandando la envolvente. */
  src.loop = true;
  src.start(t0, Math.random() * DURACION_BUFFER_RUIDO);
  src.stop(t0 + dur + 0.02);
};

/* Un semitono es la raíz duodécima de 2. Se usa para transportar la racha: cada hito suena
   un tono entero (2 semitonos) más arriba que el anterior. */
export const transportar = (freq: number, semitonos: number) =>
  freq * Math.pow(2, semitonos / 12);

/* Una secuencia de notas con separación fija. Es el 80% de los sonidos de premio: un arpegio
   es esto, y escribirlo como lista se lee mejor que cuatro llamadas con `en` a mano. */
export const arpegio = (
  freqs: number[],
  paso: number,
  base: Omit<Tono, 'freq' | 'en'> = {},
) => {
  freqs.forEach((f, i) => tono({ ...base, freq: f, en: i * paso }));
};
