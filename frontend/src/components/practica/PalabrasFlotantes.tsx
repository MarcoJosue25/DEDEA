import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* Desestructura — las palabras entran por un borde del cuadro y lo cruzan hasta el lado
   opuesto. Si una llega al otro lado, el bloque se pierde: es la prueba de que no
   sostuviste tu ritmo.

   Dos reglas que hacen que el ejercicio sea difícil y no injusto:

   1. Ninguna palabra puede empezar con el mismo carácter que otra. Con dos palabras que
      empiezan por "p" flotando a la vez es imposible saber cuál estás tecleando. La
      mayúscula sí distingue, así que "pino" y "Pino" pueden convivir. Esto lo garantiza
      el backend al generar la lista; acá solo se respeta.
   2. La palabra se escribe COMPLETA. Un error obliga a empezarla de nuevo, no a corregir
      un carácter: si no, el ejercicio se convierte en pulsar teclas al azar hasta acertar.

   La que está más cerca del borde vira al rojo — es la que hay que atender primero, y sin
   esa señal el ejercicio es solo caos visual. */

/* El bloque termina de dos formas —una palabra tocó el borde, o las escribiste todas— y
   en las dos hay que reportar lo tecleado: el backend calcula el WPM y la precisión de
   este bloque igual que los demás, así que no puede recibirlo vacío. */
export interface MetricasFlotantes {
  caracteresCorrectos: number;
  totalPresionadas: number;
}

interface Props {
  palabras: string[];
  msHastaElBorde: number;
  onPerder: (metricas: MetricasFlotantes) => void;
  onCompletar: (metricas: MetricasFlotantes) => void;
}

interface Flotante {
  id: number;
  texto: string;
  /* Punto de entrada y de salida en porcentaje del contenedor, ambos fuera del marco: la
     palabra se ve deslizarse hacia dentro y hacia fuera en vez de aparecer de la nada.
     La posición se interpola entre los dos según el progreso, así el movimiento es
     estable y no acumula deriva. */
  desdeX: number;
  desdeY: number;
  hastaX: number;
  hastaY: number;
  /* Cuándo aparece, en milisegundos de reloj DEL EJERCICIO, no de `performance.now()`.
     Con marcas de tiempo absolutas, cambiar de pestaña congelaba la animación (el
     navegador no dispara requestAnimationFrame en pestañas ocultas) y al volver el
     tiempo real había seguido corriendo: todas las palabras saltaban al borde de golpe y
     perdías sin haber visto nada. */
  apareceEnMs: number;
  escrita: boolean;
}

const entre = (min: number, max: number) => min + Math.random() * (max - min);

/* Cada palabra ENTRA por un borde y cruza hasta el opuesto. Antes nacían todas alrededor
   del centro y se amontonaban ahí: ilegibles los primeros segundos, y encima el ejercicio
   no se entendía porque parecía que explotaban desde un punto.

   Cruzar de lado a lado resuelve las dos cosas: nacen separadas por construcción y la
   trayectoria se lee de un vistazo. Perder es dejar que una llegue al lado contrario.

   Los lados se reparten en ciclo (izquierda, arriba, derecha, abajo) para que no entren
   varias seguidas por el mismo sitio. */
const construirFlotantes = (palabras: string[], msHastaElBorde: number): Flotante[] => {
  /* Escalonado: la última aparece más o menos cuando la primera está por salir, así al
     principio hay pocas en pantalla y la cosa se va llenando sola. */
  const retardo = Math.max(500, Math.round(msHastaElBorde / Math.max(4, palabras.length)));

  return palabras.map((texto, i) => {
    const lado = i % 4;
    let desdeX: number, desdeY: number, hastaX: number, hastaY: number;

    if (lado === 0) {          // entra por la izquierda
      desdeX = -8; desdeY = entre(12, 88);
      hastaX = 108; hastaY = entre(12, 88);
    } else if (lado === 1) {   // entra por arriba
      desdeX = entre(12, 88); desdeY = -10;
      hastaX = entre(12, 88); hastaY = 110;
    } else if (lado === 2) {   // entra por la derecha
      desdeX = 108; desdeY = entre(12, 88);
      hastaX = -8; hastaY = entre(12, 88);
    } else {                   // entra por abajo
      desdeX = entre(12, 88); desdeY = 110;
      hastaX = entre(12, 88); hastaY = -10;
    }

    return {
      id: i,
      texto,
      desdeX, desdeY, hastaX, hastaY,
      apareceEnMs: i * retardo,
      escrita: false,
    };
  });
};

const PalabrasFlotantes = ({ palabras, msHastaElBorde, onPerder, onCompletar }: Props) => {
  /* Inicialización perezosa en vez de un efecto: la vista monta este componente con
     `key={bloqueId}`, así que cada bloque trae una instancia nueva y no hace falta
     resetear nada desde fuera. */
  const [flotantes, setFlotantes] = useState<Flotante[]>(() => construirFlotantes(palabras, msHastaElBorde));
  const [prefijo, setPrefijo] = useState('');
  const [progresos, setProgresos] = useState<Record<number, number>>({});

  const flotantesRef = useRef<Flotante[]>(flotantes);
  const prefijoRef = useRef('');
  const terminadoRef = useRef(false);
  const cuadroRef = useRef<HTMLDivElement>(null);
  const correctasRef = useRef(0);
  const presionadasRef = useRef(0);
  // Reloj propio del ejercicio, en ms, inmune a pausas del navegador.
  const relojRef = useRef(0);

  const metricas = useCallback((): MetricasFlotantes => ({
    caracteresCorrectos: correctasRef.current,
    totalPresionadas: presionadasRef.current,
  }), []);

  // Bucle de animación. Se calcula el progreso de cada palabra y se pierde en cuanto una
  // llega al borde.
  useEffect(() => {
    let frame = 0;
    let anterior = performance.now();

    const tick = () => {
      if (terminadoRef.current) return;

      /* El reloj del ejercicio avanza por DELTAS acumulados, no por marcas absolutas, y
         cada delta se recorta a 100 ms. Así, si el usuario cambia de pestaña o el equipo
         se traba, el ejercicio simplemente se pausa en vez de saltar hacia adelante y
         hacerle perder por algo que no vio. Es el mismo criterio que ya usa
         utils/ritmoTecleo para descartar pausas largas. */
      const ahora = performance.now();
      relojRef.current += Math.min(100, ahora - anterior);
      anterior = ahora;

      const nuevos: Record<number, number> = {};
      let algunaLlegó = false;

      for (const f of flotantesRef.current) {
        if (f.escrita) continue;
        const transcurrido = relojRef.current - f.apareceEnMs;
        if (transcurrido < 0) {
          nuevos[f.id] = 0;
          continue;
        }
        const p = transcurrido / msHastaElBorde;
        nuevos[f.id] = p;
        if (p >= 1) algunaLlegó = true;
      }

      setProgresos(nuevos);

      if (algunaLlegó) {
        terminadoRef.current = true;
        onPerder(metricas());
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [msHastaElBorde, onPerder, metricas]);

  const alPulsar = useCallback((e: KeyboardEvent) => {
    // Los atajos no son tipeo: Ctrl+R tiene key 'r' y se colaba como pulsación fallada.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length !== 1 || terminadoRef.current) return;
    e.preventDefault();

    const vivas = flotantesRef.current.filter((f) => !f.escrita);
    if (vivas.length === 0) return;

    const intento = prefijoRef.current + e.key;
    presionadasRef.current += 1;

    // ¿Alguna palabra viva empieza con lo que llevamos escrito?
    const candidata = vivas.find((f) => f.texto.startsWith(intento));

    if (!candidata) {
      // Error: la palabra se empieza de nuevo, completa.
      prefijoRef.current = '';
      setPrefijo('');
      return;
    }

    correctasRef.current += 1;

    if (candidata.texto === intento) {
      const actualizadas = flotantesRef.current.map((f) =>
        f.id === candidata.id ? { ...f, escrita: true } : f);
      flotantesRef.current = actualizadas;
      setFlotantes(actualizadas);
      prefijoRef.current = '';
      setPrefijo('');

      if (actualizadas.every((f) => f.escrita)) {
        terminadoRef.current = true;
        onCompletar(metricas());
      }
      return;
    }

    prefijoRef.current = intento;
    setPrefijo(intento);
  }, [onCompletar, metricas]);

  useEffect(() => {
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [alPulsar]);

  // La más cercana al borde: la que hay que atender primero.
  // Se calcula sobre el estado, no sobre el ref: leer un ref durante el render da un
  // valor que React no puede garantizar (react-hooks/refs).
  const idMasUrgente = useMemo(() => {
    let id: number | null = null;
    let mayor = -1;
    for (const f of flotantes) {
      if (f.escrita) continue;
      const p = progresos[f.id] ?? 0;
      if (p > mayor) { mayor = p; id = f.id; }
    }
    return id;
  }, [progresos, flotantes]);

  const vivas = flotantes.filter((f) => !f.escrita);

  return (
    <div ref={cuadroRef}
      className="relative h-[340px] overflow-hidden rounded-2xl border border-white/8 bg-(--color-entreno-sup)/50">

      {vivas.map((f) => {
        const p = Math.min(1, Math.max(0, progresos[f.id] ?? 0));
        const x = f.desdeX + (f.hastaX - f.desdeX) * p;
        const y = f.desdeY + (f.hastaY - f.desdeY) * p;
        const urgente = f.id === idMasUrgente && p > 0.55;
        const enCurso = prefijo.length > 0 && f.texto.startsWith(prefijo);

        return (
          <span key={f.id}
            className={`absolute -translate-x-1/2 -translate-y-1/2 font-mono text-lg font-bold transition-colors ${
              urgente ? 'text-dificil' : enCurso ? 'text-cian' : 'text-white/70'
            }`}
            style={{ left: `${x}%`, top: `${y}%` }}>
            {enCurso && <span className="text-cian">{f.texto.slice(0, prefijo.length)}</span>}
            <span className={enCurso ? 'text-white/50' : undefined}>
              {enCurso ? f.texto.slice(prefijo.length) : f.texto}
            </span>
          </span>
        );
      })}

      <p className="absolute bottom-3 left-0 right-0 text-center text-[11px] text-gris-texto">
        Escribe la palabra completa. Si una cruza al otro lado, pierdes el bloque.
      </p>
    </div>
  );
};

export default PalabrasFlotantes;
