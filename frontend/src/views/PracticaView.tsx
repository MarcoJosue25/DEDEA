import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  NoticiaDTO, SesionProgresoDTO, TeclaStatsRequest, NgramStatsRequest, TeclaEventoRequest,
  RivalSesionResponse,
} from '../types';
import { guardarSesion } from '../api/sesionApi';
import { obtenerRivalDeSesion } from '../api/statsApi';
import { contarAparicionesNgram } from '../utils/ngramExtractor';
import { calcularDelta } from '../utils/ritmoTecleo';
import Spinner from '../components/ui/Spinner';
import Cronometro from '../components/practica/Cronometro';
import { useApariencia } from '../core/apariencia/useApariencia';

/* Interruptor del diseño oscuro: pastilla con la perilla que se desliza.
   La perilla lleva `left-0` explícito: sin una propiedad de inset, un elemento
   absoluto se coloca en su "posición estática", que acá caía al final de la
   pastilla y hacía que la perilla apareciera a la derecha incluso apagada. */
const Interruptor = ({
  activo, onCambiar, etiqueta,
}: { activo: boolean; onCambiar: () => void; etiqueta: string }) => (
  <button onClick={onCambiar} aria-pressed={activo} className="flex items-center gap-3">
    <span
      className={`relative block h-6 w-11 shrink-0 rounded-full transition-colors ${
        activo ? 'bg-cian/30' : 'bg-white/12'
      }`}>
      <span
        className={`absolute left-0 top-1 h-4 w-4 rounded-full transition-transform ${
          activo ? 'translate-x-6 bg-cian' : 'translate-x-1 bg-white/70'
        }`}
      />
    </span>
    <span className="text-sm text-(--sup-texto)">{etiqueta}</span>
  </button>
);

/* El mismo interruptor pero con el lenguaje visual del fondo claro (verde y grises),
   para no meterle la paleta cian del diseño oscuro. */
const InterruptorClaro = ({
  activo, onCambiar, etiqueta,
}: { activo: boolean; onCambiar: () => void; etiqueta: string }) => (
  <button onClick={onCambiar} aria-pressed={activo} className="flex items-center gap-2">
    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{etiqueta}</span>
    <span
      className={`relative block h-5 w-10 shrink-0 rounded-full transition-colors duration-200 ${
        activo ? 'bg-emerald-500' : 'bg-slate-200'
      }`}>
      <span
        className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
          activo ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </span>
  </button>
);

/* ===== DESARROLLO — QUITAR ANTES DE PUBLICAR =====
   Muestra el nivel que DifficultyScorer le puso a la noticia, al lado de los
   interruptores. Es solo informativo: no cambia nada de la práctica, existe para poder
   verificar de un vistazo si el texto que estás tecleando se siente como el nivel que
   dice. Al usuario final no le aporta —ya eligió la noticia desde la portada, donde el
   nivel figura en la tarjeta— y le mete un dato técnico en medio de la pantalla de
   tipeo. Para quitarlo: borrar este componente y sus dos usos (apariencia clara y
   oscura). */
const NIVEL_PUNTO: Record<string, string> = {
  FACIL: 'bg-facil',
  MEDIO: 'bg-medio',
  MEDIO_DIFICIL: 'bg-medio-dificil',
  DIFICIL: 'bg-dificil',
};

const NIVEL_ETIQUETA: Record<string, string> = {
  FACIL: 'Fácil',
  MEDIO: 'Medio',
  MEDIO_DIFICIL: 'Medio-difícil',
  DIFICIL: 'Difícil',
};

const NivelNoticia = ({ dificultad, claro }: { dificultad: string; claro?: boolean }) => (
  <span
    className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1 ${
      claro ? 'bg-slate-100' : 'bg-vidrio'
    }`}
    title="Nivel calculado por el scorer (solo informativo)">
    <span className={`h-2 w-2 rounded-full ${NIVEL_PUNTO[dificultad] ?? 'bg-white/40'}`} />
    <span
      className={`text-[10px] font-bold uppercase tracking-[0.12em] ${
        claro ? 'text-slate-400' : 'text-gris-texto'
      }`}>
      Nivel {NIVEL_ETIQUETA[dificultad] ?? dificultad}
    </span>
  </span>
);

const BotonAccion = ({
  onClick, icono, iconoAlFinal, children,
}: { onClick: () => void; icono: string; iconoAlFinal?: boolean; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 rounded-full border border-(--sup-borde) bg-(--sup) px-5 py-2.5 text-sm font-semibold text-(--sup-texto) transition-all hover:text-cian active:scale-95">
    {!iconoAlFinal && <span className="material-symbols-outlined text-[18px]">{icono}</span>}
    {children}
    {iconoAlFinal && <span className="material-symbols-outlined text-[18px]">{icono}</span>}
  </button>
);

/* PANEL DE VERIFICACION DEL EJERCICIO CON IA.

   Cuenta cuantas veces aparece en el texto generado cada tecla y cada combinacion que se
   pidieron practicar. Es la contracara del prompt: ahi se le pide a Gemini un minimo de
   apariciones por elemento (ver IaServiceImpl.construirPromptSistema, bloque
   instruccionDensidad) y hasta ahora NADIE comprobaba si lo cumplia.

   El mismo patron que la practica de palabras, con una diferencia: alla el texto son dos
   lineas que rotan, asi que el conteo se acumula a medida que aparecen; aca el texto es
   fijo, entonces el conteo se calcula una sola vez y no cambia mientras tecleas.

   Se usa contarAparicionesNgram, que compara en minusculas pero SIN quitar tildes — al
   reves que el panel de palabras. Es deliberado: si se ignoraran las tildes, pedir "o"
   contaria tambien las "ó" y pedir "ó" contaria las "o", que es justo lo que se quiere
   distinguir. En este teclado la tilde es una pulsacion aparte.

   ⚠️ Es una herramienta de CALIBRACION del prompt, igual que la insignia de nivel de mas
   arriba. Si el prompt de IA queda afinado y el panel deja de decir nada nuevo, se quita. */
/* Lo que cada nivel le EXIGE al texto, para poder contrastarlo con lo que salió.

   ⚠️ ESTOS NÚMEROS ESTÁN DUPLICADOS: viven acá y en IaServiceImpl (palabrasDistintas y las
   reglas de nivel). Es exactamente la trampa de CLAUDE.md 10.25 —dos reglas que miden lo
   mismo con el número escrito dos veces— y se acepta a sabiendas porque este panel es de
   calibración y muere con ella. Si se cambian allá, hay que cambiarlos acá o el panel
   miente. Desde el 27-ago solo queda `largas`: la exigencia de palabras distintas dejó de
   ser un número y pasó a ser una preferencia del prompt. */
const EXIGENCIA_NIVEL: Record<string, { largas: number; largasMax?: number }> = {
  FACIL: { largas: 0 },
  // MEDIO es un RANGO cerrado: se distingue de difícil por no pasarse, tanto como por llegar.
  MEDIO: { largas: 5, largasMax: 7 },
  DIFICIL: { largas: 8 },
};

/* Sílabas aproximadas: grupos de vocales seguidas. En español alcanza para lo que se quiere
   medir, porque los diptongos ("cuatro", "tiempo") son una sílaba y este conteo también los
   da como una. Se queda corto con el hiato ("día", "país", que son dos y cuenta una), así
   que el número real es este o un poco más alto — nunca menos. Para "¿el texto trae palabras
   largas?" es suficiente; no lo uses para nada que necesite precisión. */
const silabas = (palabra: string) => (palabra.match(/[aeiouáéíóúü]+/gi) ?? []).length;

const palabrasDe = (texto: string) => texto.match(/[a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+/g) ?? [];

/* PANEL DE VERIFICACION DEL EJERCICIO CON IA.

   Contrasta lo que el prompt le PIDIÓ a Gemini contra lo que de verdad salió. Hasta que
   existió, nadie comprobaba ninguno de los mínimos: se pedían 8 apariciones y el texto podía
   traer 2 sin que nada lo notara.

   Mide tres cosas, y las tres corresponden a una regla concreta del prompt:

   - VECES: apariciones de cada objetivo (la instrucción de densidad).
   - PALABRAS: en cuántas palabras DISTINTAS cae cada uno. Es la que destapa el atajo que el
     modelo tiene más a mano — cumplir "usa `tra` 8 veces" escribiendo "otra" ocho veces, que
     son ocho repeticiones del mismo gesto y no enseñan la combinación.

     Va SIN umbral y sin rojo desde el 27-ago-2026: el prompt lo pide como PREFERENCIA y no
     como cuota. Exigir un número alto de palabras distintas obligaba al modelo a traer
     términos de campos ajenos —o a inventarlos— con tal de llegar, y un párrafo coherente
     con tres palabras repetidas vale más que uno incoherente con diez distintas. La cifra
     igual se muestra porque dividiendo las dos columnas se ve el atajo contrario de un
     vistazo: 14 apariciones en 4 palabras es repetir "otra" catorce veces.

   - LARGAS: palabras de cuatro sílabas o más (las reglas de nivel de MEDIO y DIFÍCIL).

   El mismo patrón que la práctica de palabras, con una diferencia: allá el texto son dos
   líneas que rotan, así que el conteo se acumula; acá el texto es fijo y se calcula una vez.

   Se usa contarAparicionesNgram, que compara en minúsculas pero SIN quitar tildes — al revés
   que el panel de palabras. Es deliberado: si se ignoraran las tildes, pedir "o" contaría
   también las "ó" y pedir "ó" contaría las "o", que es justo lo que se quiere distinguir. En
   este teclado la tilde es una pulsación aparte.

   ⚠️ Es una herramienta de CALIBRACIÓN del prompt, igual que la insignia de nivel. Si el
   prompt queda afinado y el panel deja de decir nada nuevo, se quita. */
const PanelObjetivosIa = ({
  objetivos, texto, dificultad, claro,
}: { objetivos: string[]; texto: string; dificultad?: string; claro?: boolean }) => {
  if (objetivos.length === 0) return null;

  const palabras = palabrasDe(texto);
  const exigencia = EXIGENCIA_NIVEL[dificultad ?? ''] ?? EXIGENCIA_NIVEL.MEDIO;

  const filas = objetivos.map((o) => {
    const objetivoBajo = o.toLowerCase();
    /* Palabras DIFERENTES que lo alojan, no apariciones. Se compara en minúsculas para que
       "Trabajo" al empezar una frase no cuente como una palabra distinta de "trabajo".

       Solo aplica a los objetivos que son LETRAS: un símbolo no vive dentro de una palabra,
       así que su celda daría siempre 0 y se leería como un fallo cuando no lo es. Para esos
       la columna va vacía. */
    const esLetras = /^[a-záéíóúüñ]+$/i.test(o);
    const huespedes = new Set(
      palabras.map((w) => w.toLowerCase()).filter((w) => w.includes(objetivoBajo)),
    );
    return {
      objetivo: o,
      veces: contarAparicionesNgram(texto, o),
      distintas: esLetras ? huespedes.size : null,
    };
  });

  const ausentes = filas.filter((f) => f.veces === 0).length;
  const largas = palabras.filter((w) => silabas(w) >= 4).length;

  const colorDato = (ok: boolean) =>
    ok ? (claro ? 'text-slate-700' : 'text-(--sup-texto)') : 'text-dificil';

  return (
    <div className={claro
      ? 'rounded-2xl border border-slate-200 bg-white p-4'
      : 'rounded-2xl border border-(--sup-borde) bg-(--sup) p-4'}
      style={claro ? { boxShadow: '0 4px 12px rgba(15,23,42,0.03)' } : undefined}>

      <p className={`mb-3 text-[10px] font-bold uppercase tracking-[0.14em] ${
        claro ? 'text-slate-400' : 'text-(--sup-tenue)'}`}>
        Objetivos en el texto
      </p>

      <table className="w-full text-sm">
        <thead>
          <tr className={`text-[10px] font-bold uppercase tracking-wider ${
            claro ? 'text-slate-400' : 'text-(--sup-tenue)'}`}>
            <th className="pb-1 text-left"></th>
            <th className="pb-1 text-right" title="Apariciones en el texto">Veces</th>
            <th className="pb-1 text-right" title="Palabras distintas que lo alojan (preferencia, no cuota)">
              Pal.
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.objetivo}>
              <td className={`py-1 pr-3 font-mono font-bold ${
                claro ? 'text-emerald-600' : 'text-cian'}`}>
                {/* Un espacio o un símbolo suelto no se distinguirían de una celda vacía. */}
                {f.objetivo === ' ' ? '␣' : f.objetivo}
              </td>
              <td className={`py-1 text-right font-bold tabular-nums ${colorDato(f.veces > 0)}`}>
                {f.veces}
              </td>
              <td className={`py-1 text-right font-bold tabular-nums ${
                claro ? 'text-slate-700' : 'text-(--sup-texto)'}`}>
                {f.distintas ?? '·'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Las palabras largas son una exigencia del NIVEL, no del objetivo, así que van
          aparte de la tabla. En fácil no se piden (la regla de ese nivel es la opuesta:
          prohíbe pasar de tres sílabas), y por eso ahí se muestra el dato sin exigencia. */}
      <div className={`mt-3 flex items-baseline justify-between border-t pt-2 ${
        claro ? 'border-slate-100' : 'border-(--sup-borde)'}`}>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${
          claro ? 'text-slate-400' : 'text-(--sup-tenue)'}`}>
          Palabras 4+ sílabas
        </span>
        <span className={`text-sm font-bold tabular-nums ${
          colorDato(largas >= exigencia.largas
            && (exigencia.largasMax === undefined || largas <= exigencia.largasMax))}`}>
          {largas}
          {exigencia.largas > 0 && (
            <span className="font-normal opacity-60">
              /{exigencia.largas}{exigencia.largasMax !== undefined && `-${exigencia.largasMax}`}
            </span>
          )}
        </span>
      </div>

      {/* Un objetivo en cero es el fallo que importa: el ejercicio no puede corregir lo que
          no aparece. Se avisa acá en vez de dejarlo en un cero fácil de pasar por alto. */}
      {ausentes > 0 && (
        <p className="mt-3 text-[11px] font-semibold leading-snug text-dificil">
          {ausentes === 1
            ? '1 objetivo no aparece en el texto.'
            : `${ausentes} objetivos no aparecen en el texto.`}
        </p>
      )}
    </div>
  );
};

const FILAS_TECLADO = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L','Ñ'],
  ['Z','X','C','V','B','N','M'],
];

const PracticaView = () => {
  const navigate = useNavigate();
  const [noticia, setNoticia] = useState<NoticiaDTO | null>(null);
  const [texto, setTexto] = useState('');
  const [indice, setIndice] = useState(0);
  const [indiceNoticia, setIndiceNoticia] = useState(0);
  const [errores, setErrores] = useState<Set<number>>(new Set());
  /* La apariencia clara conserva el comportamiento original: resalta la tecla que
     el usuario PULSÓ. La oscura resalta la que TOCA pulsar (se deduce del texto).
     Por eso este estado sigue existiendo aunque solo lo use una de las dos. */
  const [teclaPresionada, setTeclaPresionada] = useState<string>('');
  const [teclaError, setTeclaError] = useState<string>('');
  const [modoEstricto, setModoEstricto] = useState(false);
  const [mostrarTeclado, setMostrarTeclado] = useState(true);
  const { apariencia } = useApariencia();
  const [segundos, setSegundos] = useState(0);
  const [tiempoMs, setTiempoMs] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const [terminado, setTerminado] = useState(false);
  const [caracteresCorrectos, setCaracteresCorrectos] = useState(0);
  const [totalPresionadas, setTotalPresionadas] = useState(0);
  const [guardando, setGuardando] = useState(false);

  /* Teclas y combinaciones que se pidieron practicar, para el panel de verificacion.
     Inicializacion perezosa y no useEffect: el valor ya existe en sessionStorage cuando
     la vista monta, asi que setearlo desde un efecto seria el setState sincrono que este
     repo prohibe. Vacio en cualquier modo que no sea IA. */
  const [objetivosIa] = useState<string[]>(() => {
    try {
      const crudo = sessionStorage.getItem('practica_ia_config');
      if (!crudo) return [];
      const c = JSON.parse(crudo);
      return [...(c.teclas ?? []), ...(c.bigramas ?? []), ...(c.trigramas ?? [])];
    } catch {
      return [];
    }
  });

  // Refs para captura de métricas sin re-renders
  const contenedorRef = useRef<HTMLDivElement>(null);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progresoRef = useRef<SesionProgresoDTO[]>([]);
  const teclasMapRef = useRef<Map<string, TeclaStatsRequest>>(new Map());
  const ngramsMapRef = useRef<Map<string, NgramStatsRequest>>(new Map());
  const caracteresCorrectosRef = useRef(0);
  const totalPresionadasRef = useRef(0);
  const segundosRef = useRef(0);
  // Acumulador del cronómetro. Va en ref para que el intervalo no tenga que leerlo desde
  // el updater de setTiempoMs, que debe ser puro.
  const tiempoMsRef = useRef(0);
  const textoRef = useRef('');
  const indiceRef = useRef(0);

  /* Cambio de noticia con las flechas. Se guarda en un ref además del estado porque el
     manejador de teclas es un useCallback y leería un valor viejo: el aviso quedaría
     abierto sin que Enter lo aplicara. `null` = no hay cambio pendiente; un número = el
     índice de noticia al que se iría. */
  const [cambioPendiente, setCambioPendiente] = useState<number | null>(null);
  const cambioPendienteRef = useRef<number | null>(null);
  const indiceNoticiaRef = useRef(0);

  // Modo sombra: la sesión pasada contra la que se corre, si se entró con ?fantasma=.
  // Basta el estado: la posición del rival se calcula en el render a partir del reloj.
  const [rival, setRival] = useState<RivalSesionResponse | null>(null);

  /* Ritmo de tecleo. `inicioPerfRef` marca el momento de la primera pulsación (no el de
     montar la vista: entre que carga el texto y el usuario arranca pueden pasar minutos).
     `ultimoInstanteRef` sirve para el delta entre teclas consecutivas, que es lo que
     alimenta el tiempo por tecla. */
  const eventosRef = useRef<TeclaEventoRequest[]>([]);
  const ordenSecuenciaRef = useRef(0);
  const inicioPerfRef = useRef(0);
  const ultimoInstanteRef = useRef(0);

  // Sincronizar refs con estado
  useEffect(() => { indiceNoticiaRef.current = indiceNoticia; }, [indiceNoticia]);
  useEffect(() => { caracteresCorrectosRef.current = caracteresCorrectos; }, [caracteresCorrectos]);
  useEffect(() => { totalPresionadasRef.current = totalPresionadas; }, [totalPresionadas]);
  useEffect(() => { segundosRef.current = segundos; }, [segundos]);
  useEffect(() => { textoRef.current = texto; }, [texto]);
  useEffect(() => { indiceRef.current = indice; }, [indice]);

  // Cargar noticia
  useEffect(() => {
  /* Entrada por modo sombra: con ?fantasma={sesionId} el texto lo trae la sesión rival,
     no el sessionStorage. Hay que salir antes de las comprobaciones de abajo, que
     redirigen a la portada cuando no encuentran una noticia elegida — si no, el reto
     desde Estadísticas te devolvía al inicio sin llegar a cargar nunca. */
  if (new URLSearchParams(window.location.search).get('fantasma')) return;

  // La práctica de palabras vive en su propia vista (PracticaLibreView);
  // acá solo llegan los modos IA y noticia.
  const storedIA = sessionStorage.getItem('texto_ia_seleccionado');
  if (storedIA) {
    let textoIA;
    try {
      textoIA = JSON.parse(storedIA);
    } catch {
      sessionStorage.removeItem('texto_ia_seleccionado');
      navigate('/');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTexto(textoIA.contenidoLimpio || '');
     
    setNoticia({
      id: textoIA.id,
      titulo: '🤖 Práctica personalizada con IA',
      contenidoCompleto: textoIA.contenidoLimpio,
      contenidoResumido: '',
      categoria: 'IA',
      fuente: 'Gemini AI',
      dificultad: textoIA.dificultad || 'MEDIO',
      fechaPublicacion: new Date().toISOString().split('T')[0],
    });
    textoRef.current = textoIA.contenidoLimpio || '';
     
    setIndiceNoticia(-1); // -1 indica modo IA, no hay anterior/siguiente
    return;
  }

  // Si no hay texto IA, cargamos noticia normal
  const stored = sessionStorage.getItem('noticia_seleccionada');
  if (!stored) { navigate('/'); return; }
  let n: NoticiaDTO;
  try {
    n = JSON.parse(stored);
  } catch {
    sessionStorage.removeItem('noticia_seleccionada');
    navigate('/');
    return;
  }
  const idx = parseInt(sessionStorage.getItem('indice_noticia') || '0');
   
  setNoticia(n);
   
  setTexto(n.contenidoCompleto || '');
   
  setIndiceNoticia(idx);
  textoRef.current = n.contenidoCompleto || '';
}, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Modo sombra en Noticias e IA: ?fantasma={sesionId} carga esa sesión pasada como rival.
     El texto se sustituye por el exacto que se practicó entonces —si no, no hay carrera
     posible— y el fantasma avanza a ritmo constante derivado de su WPM.

     Se eligió ritmo constante y no reproducción exacta a propósito: el replay necesita los
     eventos tecla a tecla, que solo existen en las sesiones guardadas desde el 8 de agosto
     de 2026, y dejaría el reto muerto en casi todo el historial. */
  useEffect(() => {
    const sesionId = new URLSearchParams(window.location.search).get('fantasma');
    if (!sesionId) return;

    let vigente = true;
    obtenerRivalDeSesion(Number(sesionId))
      .then((r) => {
        if (!vigente) return;
        // Sin rival válido no hay nada que correr: se vuelve a la portada en vez de dejar
        // la pantalla colgada en el spinner.
        if (!r) { navigate('/'); return; }

        setRival(r);
        setTexto(r.texto);
        textoRef.current = r.texto;

        /* La vista se apoya en `noticia` para el encabezado, la dificultad y el guardado.
           En modo sombra no venimos de la portada, así que se arma una equivalente con los
           datos de la sesión rival — igual que hace el modo IA. */
        setNoticia({
          id: r.noticiaId ?? r.sesionId,
          titulo: `Revancha: tu sesión de ${r.wpm} WPM`,
          contenidoCompleto: r.texto,
          contenidoResumido: '',
          categoria: r.modo === 'IA' ? 'IA' : 'REVANCHA',
          fuente: 'Modo sombra',
          dificultad: 'MEDIO',
          fechaPublicacion: r.fecha,
        });
        // -1 = sin anterior/siguiente: acá no se navega entre noticias.
        setIndiceNoticia(-1);
      })
      .catch(() => { if (vigente) navigate('/'); });

    return () => { vigente = false; };
  }, [navigate]);

  // Cronómetro + captura de progreso segundo a segundo. Corre cada 100ms para que los
  // milisegundos del reloj se vean fluidos; el progreso (para el gráfico) solo se
  // registra al cruzar cada segundo entero, igual que antes.
  useEffect(() => {
    if (corriendo && !terminado) {
      intervaloRef.current = setInterval(() => {
        /* El tiempo se acumula en un REF y el cruce de segundo se resuelve acá, no dentro
           del updater de setTiempoMs.

           Un updater de estado tiene que ser puro, y este empujaba a progresoRef. React 18
           en modo estricto invoca los updaters DOS VECES a propósito para destapar esa
           clase de efecto colateral, así que cada segundo se guardaba por duplicado: 112
           de 131 sesiones tenían el recorrido con todos los puntos repetidos. */
        const msPrev = tiempoMsRef.current;
        const nuevoMs = msPrev + 100;
        tiempoMsRef.current = nuevoMs;

        const segundoAnterior = Math.floor(msPrev / 1000);
        const nuevoSegundo = Math.floor(nuevoMs / 1000);

        if (nuevoSegundo !== segundoAnterior) {
          segundosRef.current = nuevoSegundo;
          setSegundos(nuevoSegundo);

          const wpmMomento = Math.round((caracteresCorrectosRef.current / 5) / (nuevoSegundo / 60));
          const precisionMomento = totalPresionadasRef.current > 0
            ? Number(((caracteresCorrectosRef.current / totalPresionadasRef.current) * 100).toFixed(2))
            : 100;

          progresoRef.current.push({ segundo: nuevoSegundo, wpmMomento, precisionMomento });
        }

        setTiempoMs(nuevoMs);
      }, 100);
    }
    return () => { if (intervaloRef.current) clearInterval(intervaloRef.current); };
  }, [corriendo, terminado]);

  const wpm = segundos > 0
    ? Math.round((caracteresCorrectos / 5) / (segundos / 60))
    : 0;

  /* Dos formatos a propósito: la apariencia clara mantiene el entero que tenía
     siempre, y la oscura muestra un decimal (a 300 pulsaciones un solo error mueve
     0.3 puntos, y redondeado a entero el número no se inmutaba). Lo que se guarda
     en el backend no cambia en ninguno de los dos casos. */
  const precisionExacta = totalPresionadas > 0
    ? (caracteresCorrectos / totalPresionadas) * 100
    : 100;
  const precisionEntera = Math.round(precisionExacta);
  const precisionDecimal = precisionExacta.toFixed(1);

  // Registrar tecla en el mapa
const registrarTecla = (tecla: string, correcta: boolean, deltaMs: number) => {
  // Filtramos teclas inválidas o vacías antes de registrar
  if (!tecla || tecla.length === 0) return;

  // Normalizamos teclas especiales a nombres cortos
  const teclaLimpia = tecla.length === 1
    ? tecla.toLowerCase()
    : tecla.toLowerCase().slice(0, 20); // Backspace, Enter, etc.

  if (!teclaLimpia) return;

  const existing = teclasMapRef.current.get(teclaLimpia) || {
    tecla: teclaLimpia,
    vecesPresionada: 0,
    vecesCorrecta: 0,
    vecesError: 0,
    tiempoTotalMs: 0,
  };
  teclasMapRef.current.set(teclaLimpia, {
    ...existing,
    vecesPresionada: existing.vecesPresionada + 1,
    vecesCorrecta: correcta ? existing.vecesCorrecta + 1 : existing.vecesCorrecta,
    vecesError: !correcta ? existing.vecesError + 1 : existing.vecesError,
    tiempoTotalMs: existing.tiempoTotalMs + deltaMs,
  });
};

  // Registrar ngram en el mapa
const registrarNgram = useCallback((secuencia: string, tipo: 'BIGRAMA' | 'TRIGRAMA', error: boolean) => {
  const existing = ngramsMapRef.current.get(secuencia) || {
    secuencia,
    tipo,
    totalIntentos: 0,
    errores: 0,
    tiempoTotalMs: 0,
  };
  ngramsMapRef.current.set(secuencia, {
    ...existing,
    totalIntentos: existing.totalIntentos + 1,
    errores: error ? existing.errores + 1 : existing.errores,
  });
}, []);

  const reiniciar = useCallback(() => {
    setIndice(0);
    setErrores(new Set());
    setSegundos(0);
    setTiempoMs(0);
    tiempoMsRef.current = 0;
    setCorriendo(false);
    setTerminado(false);
    setCaracteresCorrectos(0);
    setTotalPresionadas(0);
    progresoRef.current = [];
    teclasMapRef.current = new Map();
    ngramsMapRef.current = new Map();
    eventosRef.current = [];
    ordenSecuenciaRef.current = 0;
    inicioPerfRef.current = 0;
    ultimoInstanteRef.current = 0;
    caracteresCorrectosRef.current = 0;
    totalPresionadasRef.current = 0;
    segundosRef.current = 0;
    indiceRef.current = 0;
    // `preventScroll`: ver la nota grande donde se registra el keydown, más abajo.
    contenedorRef.current?.focus({ preventScroll: true });
  }, []);

  const irANoticia = useCallback((nuevoIndice: number) => {
    let lista: NoticiaDTO[];
    try {
      lista = JSON.parse(sessionStorage.getItem('lista_noticias') || '[]');
    } catch {
      lista = [];
    }
    if (nuevoIndice < 0 || nuevoIndice >= lista.length) return;

    // Salimos del modo IA hacia una noticia: hay que soltar el contexto de la práctica IA.
    // Si no, al terminar esta noticia la pantalla de resultados mostraría el desglose de
    // teclas del texto de IA anterior, que el usuario nunca escribió acá.
    // (Se llega a este caso desde IA porque indiceNoticia vale -1 y "Siguiente" pide el 0.)
    sessionStorage.removeItem('practica_ia_config');
    sessionStorage.removeItem('texto_ia_seleccionado');

    const nueva = lista[nuevoIndice];
    sessionStorage.setItem('noticia_seleccionada', JSON.stringify(nueva));
    sessionStorage.setItem('indice_noticia', String(nuevoIndice));
    setNoticia(nueva);
    setTexto(nueva.contenidoCompleto || '');
    textoRef.current = nueva.contenidoCompleto || '';
    setIndiceNoticia(nuevoIndice);
    reiniciar();
  }, [reiniciar]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ver la nota de e.repeat en CursoPracticaView: mantener una tecla es UNA pulsación.
    if (e.repeat) return;
    if (terminado || guardando) return;

    /* AltGraph va en la lista: pulsar AltGr sola es apoyar un modificador, no teclear.
       Lo que SÍ tiene que contar es el carácter que produce combinada (ver el guard de
       atajos, más abajo). */
    if (['Shift', 'Control', 'Alt', 'AltGraph', 'Meta'].includes(e.key)) return;
    if (e.key === ' ') e.preventDefault();

    // Filtrar teclas muertas (acentos, diéresis) que no producen carácter visible
    if (e.key === 'Dead' || e.key === 'Unidentified') return;

    /* Los atajos del navegador (Ctrl+R, Ctrl+C, Alt+Tab) no son tipeo y no cuentan.
       AltGr queda EXCEPTUADO a propósito: en el teclado español es la única forma de
       escribir @ # \ | [ ] { } €, y en Windows dispara ctrlKey+altKey a la vez, así que
       este guard las daba por atajo y volvía esos caracteres imposibles de acertar —
       justo los que necesita "Maratón de símbolos". getModifierState('AltGraph') es lo
       único que distingue un AltGr de un Ctrl+Alt de verdad. */
    if (!e.getModifierState('AltGraph') && (e.ctrlKey || e.metaKey || e.altKey)) return;

    /* Con el aviso de cambio de noticia abierto, Enter lo aplica y Escape lo descarta.
       Va antes que todo lo demás porque si no, Enter contaría como error. */
    if (cambioPendienteRef.current !== null) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const destino = cambioPendienteRef.current;
        cambioPendienteRef.current = null;
        setCambioPendiente(null);
        irANoticia(destino);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cambioPendienteRef.current = null;
        setCambioPendiente(null);
        return;
      }
    }

    /* Izquierda y derecha cambian de noticia. Si el usuario ya empezó a escribir no se
       cambia de golpe —perdería el avance por un roce sin querer—: se pregunta primero. */
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const destino = indiceNoticiaRef.current + (e.key === 'ArrowRight' ? 1 : -1);
      if (destino < 0) return;
      if (indiceRef.current === 0) {
        irANoticia(destino);
      } else {
        cambioPendienteRef.current = destino;
        setCambioPendiente(destino);
      }
      return;
    }

    /* Solo cuenta como pulsación lo que produce un carácter imprimible, más Tab y Enter
       (están pegados a la Q y a la Ñ: pulsarlas es un fallo de mecanografía real) y
       Backspace, que se maneja unas líneas más abajo.

       Antes esto era una lista BLANCA de teclas a ignorar —F1-F12 por regex, más quince
       nombres de navegación— y por eso se colaba todo lo que no estuviera en la lista: en
       un teclado donde F1 y F2 están mapeadas al volumen, `e.key` no vale "F1" sino
       "AudioVolumeDown"/"AudioVolumeUp", así que llegaban hasta el contador y ensuciaban
       la precisión sin que el usuario hubiera escrito nada. Invertida, no hay lista que
       mantener: si no produce carácter, no cuenta, venga de donde venga.

       Sin preventDefault, además: flechas verticales, RePág/AvPág e Inicio/Fin no cuentan
       como pulsación pero SÍ tienen que desplazar la pantalla mientras se practica. */
    if (e.key.length !== 1 && e.key !== 'Tab' && e.key !== 'Enter' && e.key !== 'Backspace') return;

    // Tab movería el foco fuera del texto y Enter podría enviar algo: se anulan, pero
    // siguen su camino hacia el conteo como pulsación fallada.
    if (e.key === 'Tab' || e.key === 'Enter') e.preventDefault();
    if (!corriendo) {
      // El reloj de ritmo arranca en la primera tecla, no al montar la vista: entre que
      // el texto carga y el usuario empieza a escribir pueden pasar minutos.
      inicioPerfRef.current = performance.now();
      setCorriendo(true);
    }

    const ahoraMs = performance.now();
    const deltaMs = calcularDelta(ahoraMs, ultimoInstanteRef.current);
    ultimoInstanteRef.current = ahoraMs;

    const textoActual = textoRef.current;
    const indiceActual = indiceRef.current;
    const esperada = textoActual[indiceActual];

    if (e.key === 'Backspace') {
      if (indiceActual > 0) {
        setIndice((i) => i - 1);
        indiceRef.current = indiceActual - 1;
        setErrores((prev) => {
          const next = new Set(prev);
          next.delete(indiceActual - 1);
          return next;
        });
      }
      return;
    }

    setTotalPresionadas((t) => { totalPresionadasRef.current = t + 1; return t + 1; });
    setTeclaPresionada(e.key.toUpperCase());
    setTimeout(() => setTeclaPresionada(''), 100);

const esCorrecta = e.key === esperada;

if (e.key.length === 1 || e.key === ' ') {
  /* Se registra la tecla ESPERADA, no la pulsada.

     Antes se guardaba `e.key`, así que el error caía sobre la tecla que apretaste por
     accidente: teclear W donde iba una E manchaba a la W. El mapa de calor terminaba
     midiendo "qué teclas pulso sin querer" mientras el rótulo prometía "dónde más
     fallas", y salían cosas como la W al 93% o la Ñ al 94% — teclas vecinas de otras,
     no teclas difíciles.

     Con la esperada, cada tecla acumula: cuántas veces te tocó, cuántas la lograste y
     cuántas no. Eso sí es "% de error de esta tecla". */
  registrarTecla(esperada, esCorrecta, deltaMs);

  /* Los eventos tecla a tecla se guardan también acá, no solo en Curso. Son el insumo
     del análisis de ritmo del mapa de calor, y una noticia completa es mucho mejor
     muestra que un drill de dos segundos. `indiceResultante` es a dónde queda el cursor:
     en modo estricto una tecla errada no avanza. */
  ordenSecuenciaRef.current += 1;
  eventosRef.current.push({
    tecla: e.key.toLowerCase(),
    ordenSecuencia: ordenSecuenciaRef.current,
    tiempoDesdeInicioMs: Math.round(ahoraMs - inicioPerfRef.current),
    indiceResultante: (!esCorrecta && modoEstricto) ? indiceActual : indiceActual + 1,
    correcta: esCorrecta,
  });
}

// Registramos ngrams basándonos en la última letra de la secuencia
// Un ngram se intenta cuando el usuario llega a su última posición
// Solo 1 intento y máximo 1 error por ocurrencia, independiente de qué letra falló
if (indiceActual >= 1) {
  const bigrama = textoActual.slice(indiceActual - 1, indiceActual + 1).toLowerCase();
  if (!bigrama.includes(' ') && /^[a-záéíóúñü]{2}$/.test(bigrama)) {
    registrarNgram(bigrama, 'BIGRAMA', !esCorrecta);
  }
}
if (indiceActual >= 2) {
  const trigrama = textoActual.slice(indiceActual - 2, indiceActual + 1).toLowerCase();
  if (!trigrama.includes(' ') && /^[a-záéíóúñü]{3}$/.test(trigrama)) {
    registrarNgram(trigrama, 'TRIGRAMA', !esCorrecta);
  }
}

if (esCorrecta) {
  setCaracteresCorrectos((c) => { caracteresCorrectosRef.current = c + 1; return c + 1; });
  setIndice((i) => {
    const siguiente = i + 1;
    indiceRef.current = siguiente;
    if (siguiente >= textoActual.length) {
      setTerminado(true);
      setCorriendo(false);
    }
    return siguiente;
  });
} else {
  setTeclaError(e.key.toUpperCase());
  setTimeout(() => setTeclaError(''), 150);
  if (!modoEstricto) {
    setErrores((prev) => new Set(prev).add(indiceActual));
    setIndice((i) => {
      const siguiente = i + 1;
      indiceRef.current = siguiente;
      if (siguiente >= textoActual.length) {
        setTerminado(true);
        setCorriendo(false);
      }
      return siguiente;
    });
  }
}
  }, [corriendo, terminado, guardando, modoEstricto, registrarNgram, irANoticia]);

  useEffect(() => {
    /* `preventScroll`: SIN esto, cada re-registro de este efecto (cada vez que
       `handleKeyDown` cambia de referencia — típicamente al escribir la primera tecla,
       cuando `corriendo` pasa de false a true) hacía que el navegador saltara el scroll
       hasta este contenedor, arrancándole al usuario la posición desde la que estaba
       mirando las métricas. `focus()` no necesita mover el scroll para funcionar: los
       atajos de teclado ya escuchan en `window`. */
    contenedorRef.current?.focus({ preventScroll: true });
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Guardar sesión y navegar a resultados
  useEffect(() => {
  if (!terminado || !noticia) return;

  // El backend valida `segundos` con @Min(1): si el usuario termina el texto antes de que
  // el cronómetro cruce el primer segundo, segundosRef sigue en 0 y la sesión se rechaza
  // con 400 sin que el usuario se entere (el .catch de abajo igual lo manda a resultados).
  // PracticaLibreView y CursoPracticaView ya aplicaban este mismo Math.max(1, ...).
  const segundosFinal = Math.max(1, segundosRef.current);

  const wpmFinal = Math.round((caracteresCorrectosRef.current / 5) / (segundosFinal / 60));
  const precisionFinal = totalPresionadasRef.current > 0
    ? Number(((caracteresCorrectosRef.current / totalPresionadasRef.current) * 100).toFixed(2))
    : 100;

  // eslint-disable-next-line react-hooks/set-state-in-effect
  setGuardando(true);

  // Detectamos si es modo IA o noticia
  const esIA = noticia.categoria === 'IA';
  const textoIaId = esIA ? noticia.id : undefined;
  const noticiaId = esIA ? undefined : noticia.id;

  /* Origen de la sesión: lo lee Resultados para decidir si sus botones navegan
     entre noticias o entre ejercicios del curso. */
  sessionStorage.setItem('origen_practica', esIA ? 'ia' : 'noticia');

  guardarSesion({
    noticiaId,
    textoIaId,
    wpm: wpmFinal,
    precision: precisionFinal,
    segundos: segundosFinal,
    modoUsado: esIA ? 'IA' : 'NOTICIAS',
    dificultad: noticia.dificultad,
    progreso: progresoRef.current,
    teclas: Array.from(teclasMapRef.current.values()),
    ngrams: Array.from(ngramsMapRef.current.values()),
    eventos: eventosRef.current,
  })
.then(() => {
  /* NO se borra texto_ia_seleccionado ni practica_ia_config al guardar.

     Borrarlos aca es lo que hacia que "Repetir" y la barra espaciadora de la pantalla de
     resultados te mandaran a la portada de noticias en vez de al mismo ejercicio: para
     cuando llegabas a Resultados el texto de IA ya no existia, asi que /practica no
     encontraba nada que cargar, caia al respaldo de noticia_seleccionada —que el selector
     de IA justamente borra al arrancar— y terminaba en navigate('/').

     La limpieza ya esta cubierta en los tres lugares donde de verdad se SALE del modo IA:
     NoticiasView al elegir una noticia, ResultadosView.irANoticia al saltar de texto, y
     SelectorIaView, que los sobreescribe al generar el siguiente. Borrarlos tambien aca
     era redundante y rompia el unico camino que los necesita vivos.

     texto_palabras_seleccionado si se sigue borrando: es de otra vista (PracticaLibreView)
     y aca solo estorba. */
  sessionStorage.removeItem('texto_palabras_seleccionado');

  const teclasList = Array.from(teclasMapRef.current.values());
  const ngramsList = Array.from(ngramsMapRef.current.values());

 const teclasFalladas = teclasList
  .filter(t => t.vecesError > 0)
  .sort((a, b) => b.vecesError - a.vecesError)
  .slice(0, 3)
  .map(t => ({
    secuencia: t.tecla,
    porcentajeError: t.vecesPresionada > 0
      ? Math.round((t.vecesError / t.vecesPresionada) * 100)
      : 0,
  }));

const ngramsFallados = ngramsList
  .filter(n => n.errores > 0 && n.tipo === 'BIGRAMA')
  .sort((a, b) => b.errores - a.errores)
  .slice(0, 3)
  .map(n => ({
    secuencia: n.secuencia,
    porcentajeError: n.totalIntentos > 0
      ? Math.round((n.errores / n.totalIntentos) * 100)
      : 0,
  }));

  // Config de la práctica IA, solo para el desglose de la pantalla de resultados.
  // OJO: esto NO decide lo que se guarda en el backend — eso ya se resolvió arriba con
  // `esIA` (noticia.categoria), que es la fuente de verdad de modoUsado/noticiaId/textoIaId.
  // Antes esta constante también se llamaba `esIA` y tapaba a la de arriba; con el nombre
  // separado queda claro que son dos preguntas distintas.
const configIA = sessionStorage.getItem('practica_ia_config');
const tieneDesgloseIA = !!configIA;

let desgloseTeclas: { tecla: string; intentos: number; errores: number; aciertos: number }[] = [];
let desgloseNgrams: { secuencia: string; tipo: string; intentos: number; errores: number; aciertos: number; aparicionesEnTexto: number }[] = [];

if (tieneDesgloseIA && configIA) {
  try {
    const config = JSON.parse(configIA);
    const textoCompleto = textoRef.current;

    desgloseTeclas = Array.from(teclasMapRef.current.values())
      .filter(t => config.teclas.includes(t.tecla))
      .map(t => ({
        tecla: t.tecla,
        intentos: t.vecesPresionada,
        errores: t.vecesError,
        aciertos: t.vecesCorrecta,
      }));

    desgloseNgrams = Array.from(ngramsMapRef.current.values())
      .filter(n => [...config.bigramas, ...config.trigramas].includes(n.secuencia))
      .map(n => ({
        secuencia: n.secuencia,
        tipo: n.tipo,
        intentos: n.totalIntentos,
        errores: n.errores,
        aciertos: n.totalIntentos - n.errores,
        aparicionesEnTexto: contarAparicionesNgram(textoCompleto, n.secuencia),
      }));
  } catch {
    desgloseTeclas = [];
    desgloseNgrams = [];
  }
  /* La config se LEE pero ya no se borra: la necesita el "Repetir" de Resultados para
     volver a este mismo ejercicio con su panel de objetivos intacto. Ver la nota de
     arriba. */
}

  sessionStorage.setItem('sesion_resultado', JSON.stringify({
    wpm: wpmFinal,
    precision: precisionFinal,
    segundos: segundosFinal,
    /* Solo para la pantalla de resultados, no viajan al backend:
       - tiempoMs: `segundos` es entero y no alcanza para mostrar centésimas.
       - caracteres: la tarjeta "LETRAS" no tenía de dónde sacar el dato. */
    tiempoMs: tiempoMs,
    caracteres: caracteresCorrectosRef.current,
    dificultad: noticia?.dificultad,
    progreso: progresoRef.current,
    /* Modo sombra: el recorrido del rival viaja a Resultados para dibujarlo detrás del
       tuyo. Van undefined cuando no se corrió contra nadie. */
    progresoRival: rival?.progreso,
    rivalWpm: rival?.wpm,
    peoresTeclas: teclasFalladas,
    peoresBigramas: ngramsFallados,
    esIA: tieneDesgloseIA,
    desgloseTeclas,
    desgloseNgrams,
  }));
  navigate('/resultados');
})
 .catch((err) => {
  console.error('Error guardando sesión:', err);
  /* Mismo criterio que en el camino de exito, y con mas razon: si el guardado fallo, lo
     mas probable es que el usuario quiera repetir el ejercicio. */
  sessionStorage.removeItem('texto_palabras_seleccionado');
  sessionStorage.setItem('sesion_resultado', JSON.stringify({
    wpm: wpmFinal,
    precision: precisionFinal,
    segundos: segundosFinal,
    /* Solo para la pantalla de resultados, no viajan al backend:
       - tiempoMs: `segundos` es entero y no alcanza para mostrar centésimas.
       - caracteres: la tarjeta "LETRAS" no tenía de dónde sacar el dato. */
    tiempoMs: tiempoMs,
    caracteres: caracteresCorrectosRef.current,
    dificultad: noticia?.dificultad,
    progreso: progresoRef.current,
    progresoRival: rival?.progreso,
    rivalWpm: rival?.wpm,
    peoresTeclas: [],
    peoresBigramas: [],
    esIA: false,
    desgloseTeclas: [],
    desgloseNgrams: [],
  }));
  navigate('/resultados');
})
  .finally(() => setGuardando(false));
}, [terminado]); // eslint-disable-line react-hooks/exhaustive-deps

  const esOscuro = apariencia === 'oscuro';

  /* Dónde iría el rival en este instante, a ritmo constante.

     Un WPM son 5 caracteres por minuto por definición, así que la posición sale de
     wpm · 5 · minutos transcurridos. Es una recta: no reproduce las pausas del intento
     original, pero sirve de liebre y funciona con cualquier sesión del historial.
     -1 = no hay rival. */
  const ghostIndice = rival
    ? Math.floor((rival.wpm * 5 * tiempoMs) / 60000)
    : -1;

  /* --- Colores del texto: cada apariencia con los suyos --- */
  const getColorCaracter = (i: number) => {
    if (esOscuro) {
      if (i < indice) {
        if (errores.has(i)) return 'text-dificil';
        // Lo que el rival ya dejó atrás se apaga: de un vistazo se ve quién va delante.
        return i <= ghostIndice ? 'text-cian/40' : 'text-cian';
      }
      if (i === indice) return 'text-white border-b-2 border-cian cursor-blink';
      // La posición del rival por delante del cursor: la liebre a la que persigues.
      if (ghostIndice >= 0 && i === ghostIndice) return 'rounded bg-medio/25 text-white';
      return 'text-faint';
    }
    // Original, sin tocar.
    if (i < indice) return errores.has(i) ? 'text-rose-500 bg-rose-50' : 'text-emerald-600';
    if (i === indice) return 'text-slate-800 border-b-2 border-emerald-500 cursor-blink';
    return 'text-slate-300';
  };

  /* --- Teclado ---
     Claro: comportamiento original, resalta la tecla PULSADA.
     Oscuro: es una referencia, no un mapa de calor — se enciende en cian la que
     TOCA pulsar (se deduce del texto) y parpadea en rojo la que se pulsó mal. */
  const teclaEsperada = (texto[indice] ?? '').toUpperCase();

  const getColorTecla = (tecla: string) => {
    if (esOscuro) {
      if (tecla === teclaError) return 'border-dificil bg-dificil/15 text-dificil';
      if (tecla === teclaEsperada) return 'border-cian bg-cian/15 text-cian';
      return 'border-white/7 bg-carta text-gris-texto';
    }
    if (tecla === teclaError) return 'bg-rose-400 text-white border-rose-500';
    if (tecla === teclaPresionada) return 'bg-emerald-500 text-white border-emerald-600';
    return 'bg-white text-slate-700 border-slate-200';
  };

if (!noticia) return <Spinner texto="Cargando texto..." />;
  const teclado = (
    <div className="flex flex-col items-center gap-2">
      {FILAS_TECLADO.map((fila, fi) => (
        <div key={fi} className="flex gap-1.5">
          {fila.map((tecla) => (
            <div key={tecla}
              className={`key-cap flex items-center justify-center rounded-lg border text-xs font-bold transition-all ${getColorTecla(tecla)}`}>
              {tecla}
            </div>
          ))}
        </div>
      ))}
      {esOscuro ? (
        <>
          <div className={`mt-1 flex h-10 w-64 items-center justify-center rounded-lg border text-[10px] tracking-[0.2em] ${getColorTecla(' ')}`}>
            ESPACIO
          </div>
          {/* Leyenda de los estados reales: la tecla se enciende porque toca
              pulsarla, no por el historial de errores del usuario. */}
          <div className="mt-3 flex gap-6 text-[10px] uppercase tracking-[0.12em] text-gris-texto">
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cian" />Próxima tecla</span>
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-dificil" />Error</span>
          </div>
        </>
      ) : (
        <div className="mt-1 h-10 w-64 rounded-lg border border-slate-200 bg-white" />
      )}
    </div>
  );

  /* ============================ APARIENCIA CLARA ============================
     Es el diseño original, intacto: una sola barra blanca con las 4 métricas y
     sus iconos, el toggle de modo estricto en la esquina del área de tipeo, y
     los tres botones al pie. No debe converger con el oscuro "por coherencia":
     existe justamente para poder comparar contra él. */
  if (!esOscuro) {
    return (
      <div ref={contenedorRef} tabIndex={0} className="flex flex-col gap-6 outline-none">

        <div className="relative">
          <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-4"
            style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
            {[
              { icon: 'bolt',     label: 'WPM',        valor: wpm,                  color: 'text-emerald-500' },
              { icon: 'target',   label: 'Precisión',  valor: `${precisionEntera}%`, color: 'text-sky-500' },
              { icon: 'keyboard', label: 'Caracteres', valor: caracteresCorrectos,   color: 'text-slate-500' },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1">
                <div className={`flex items-center gap-1 ${stat.color}`}>
                  <span className="material-symbols-outlined text-[20px]">{stat.icon}</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{stat.label}</span>
                </div>
                <span className="text-3xl font-bold text-slate-800">{stat.valor}</span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1 text-slate-500">
                <span className="material-symbols-outlined text-[20px]">schedule</span>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Tiempo</span>
              </div>
              <Cronometro ms={tiempoMs} formatoCorto />
            </div>
          </div>

        </div>

        {/* El panel de objetivos va AL COSTADO y no debajo, para poder mirarlo sin
            sacar los ojos del texto. A la derecha y no a la izquierda como en la
            práctica de palabras: acá el texto es un párrafo largo y correrlo a la
            derecha movería el punto donde empieza cada línea. Sin objetivos (modo
            noticia) la rejilla no se aplica y todo queda exactamente como estaba. */}
        <div className={objetivosIa.length > 0 ? 'grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_220px]' : ''}>
        <div className="rounded-2xl border border-slate-200 bg-white p-8"
          style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>

          {/* Fila propia para el título y los interruptores. Antes los interruptores
              iban en absolute sobre la esquina y se montaban encima del titular
              cuando este ocupaba más de una línea. */}
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <p className="min-w-0 flex-1 text-xs font-bold uppercase tracking-widest text-slate-300">
              {noticia.titulo}
            </p>
            <div className="flex shrink-0 items-center gap-5">
              <InterruptorClaro
                activo={mostrarTeclado}
                onCambiar={() => setMostrarTeclado((v) => !v)}
                etiqueta="Teclado"
              />
              <InterruptorClaro
                activo={modoEstricto}
                onCambiar={() => setModoEstricto((m) => !m)}
                etiqueta="Modo Estricto"
              />
              {/* DESARROLLO — quitar antes de publicar (ver NivelNoticia) */}
              <NivelNoticia dificultad={noticia.dificultad} claro />
            </div>
          </div>

          <div className="min-h-[120px] select-none font-mono text-xl leading-relaxed tracking-wide">
            {texto.split('').map((char, i) => (
              <span key={i} className={`${getColorCaracter(i)} transition-colors`}>{char}</span>
            ))}
          </div>

          {terminado && (
            <div className="mt-6 animate-pulse text-center text-lg font-bold text-emerald-500">
              {guardando ? '⏳ Guardando resultados...' : '✅ ¡Completado!'}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
            <button onClick={() => irANoticia(indiceNoticia - 1)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-slate-500 transition-all hover:border-emerald-400 hover:text-emerald-600 active:scale-95">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Anterior
            </button>
            <button onClick={reiniciar}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-6 py-2 font-semibold text-slate-500 transition-all hover:border-emerald-400 hover:text-emerald-600 active:scale-95">
              Repetir
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>
            <button onClick={() => irANoticia(indiceNoticia + 1)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-slate-500 transition-all hover:border-emerald-400 hover:text-emerald-600 active:scale-95">
              Siguiente
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </div>

        <PanelObjetivosIa objetivos={objetivosIa} texto={texto}
          dificultad={noticia.dificultad} claro />
        </div>{/* fin de la rejilla texto + panel */}

        {mostrarTeclado && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6"
            style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
            {teclado}
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={() => navigate('/selector-ia')}
            className="flex items-center gap-2 rounded-full bg-slate-800 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-slate-700 active:scale-95">
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            Generar con IA
          </button>
        </div>
      </div>
    );
  }

  /* ============================ APARIENCIA OSCURA ============================ */
  const stats = [
    { label: 'Velocidad',  valor: String(wpm),                 unidad: 'WPM',  stroke: '#00F1FD' },
    { label: 'Precisión',  valor: precisionDecimal,            unidad: '%',    stroke: '#BF81FF' },
    { label: 'Caracteres', valor: String(caracteresCorrectos), unidad: 'char', stroke: '#96F8FF' },
  ];

  return (
    <div
      ref={contenedorRef}
      tabIndex={0}
      data-apariencia="oscuro"
      className="flex flex-col gap-6 outline-none">

      {/* Aviso de cambio de noticia. Aparece al costado, sin tapar el texto, cuando el
          usuario pulsa una flecha habiendo empezado ya a escribir: cambiar de golpe le
          borraría el avance por un roce sin querer. */}
      {cambioPendiente !== null && (
        <div className="fixed right-6 top-28 z-50 w-64 rounded-xl border border-cian/30 bg-carta p-4 shadow-xl">
          <p className="text-sm font-bold text-white">¿Cambiar de noticia?</p>
          <p className="mt-1 text-xs leading-relaxed text-gris-texto">
            Perderías lo que llevas escrito en esta.
          </p>
          <p className="mt-3 text-[11px] font-semibold text-cian">
            Presionar Enter para aplicar
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => { cambioPendienteRef.current = null; setCambioPendiente(null); irANoticia(cambioPendiente); }}
              className="rounded-lg bg-cian px-3 py-1.5 text-xs font-bold text-ground transition-all active:scale-95">
              Cambiar
            </button>
            <button
              onClick={() => { cambioPendienteRef.current = null; setCambioPendiente(null); }}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 transition-all hover:text-white active:scale-95">
              Seguir aquí
            </button>
          </div>
        </div>
      )}

      {/* Modo sombra: contra quién corres y cómo vas. El rival es una recta al WPM de
          aquella sesión, así que la diferencia en caracteres es directamente cuánto le
          sacas o cuánto te saca. */}
      {rival && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-medio/30 bg-medio/10 px-4 py-2.5">
          <span className="material-symbols-outlined text-[18px] text-medio">nightlight</span>
          <span className="text-sm font-semibold text-white">
            Corriendo contra tu sesión de {rival.wpm} WPM
          </span>
          <span className="text-xs text-gris-texto">
            {new Date(rival.fecha).toLocaleDateString('es-PE')}
          </span>
          {indice > 0 && (
            <span className={`ml-auto text-sm font-bold tabular-nums ${
              indice >= ghostIndice ? 'text-cian' : 'text-dificil'
            }`}>
              {indice >= ghostIndice ? 'Vas ganando' : 'Vas perdiendo'}
              <span className="ml-2 text-xs font-normal text-gris-texto">
                {Math.abs(indice - ghostIndice)} caracteres
              </span>
            </span>
          )}
        </div>
      )}

      {/* PEGAJOSO bajo el navbar (top-20 ≈ su alto, 82px): ver la misma nota en
          CursoPracticaView. Con un texto largo, esta fila quedaba arriba del todo y
          scrollear para ver el teclado la sacaba de la vista. */}
      <div className="sticky top-20 z-40 flex items-start gap-4 py-1 backdrop-blur-md">
        <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-(--sup-borde) bg-(--sup) px-4 py-3"
              style={{ borderLeft: `3px solid ${stat.stroke}` }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--sup-tenue)">{stat.label}</p>
              <p className="mt-1 text-(--sup-texto)">
                <span className="text-3xl font-bold tabular-nums">{stat.valor}</span>
                <span className="ml-1 text-xs text-(--sup-tenue)">{stat.unidad}</span>
              </p>
            </div>
          ))}

          <div className="rounded-xl border border-(--sup-borde) bg-(--sup) px-4 py-3"
            style={{ borderLeft: '3px solid #FFFFFF' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--sup-tenue)">Tiempo</p>
            <p className="mt-1">
              <Cronometro ms={tiempoMs} formatoCorto claseColor="text-(--sup-texto)" />
              <span className="ml-1 text-xs text-(--sup-tenue)">seg</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <Interruptor activo={mostrarTeclado} onCambiar={() => setMostrarTeclado((v) => !v)} etiqueta="Mostrar teclado" />
        <Interruptor activo={modoEstricto} onCambiar={() => setModoEstricto((m) => !m)} etiqueta="Modo estricto" />
        {/* DESARROLLO — quitar antes de publicar (ver NivelNoticia) */}
        <NivelNoticia dificultad={noticia.dificultad} />
      </div>

      {/* El texto ocupa todo el ancho, con letra de 24 px (era 20). El panel de objetivos
          del modo IA flota en el MARGEN derecho de la página cuando cabe —desde 1536 px: el
          contenido mide 1024 y el panel pide 244 con su separación— y cae debajo del texto
          en pantallas más chicas. Antes compartían una rejilla y el panel le quitaba 220 px
          al texto. Pedido del usuario, 19-sep-2026. */}
      <div className="relative">
      <div className="rounded-2xl border border-(--sup-borde) bg-(--sup) p-8">
        <p className="mb-6 text-xs font-bold uppercase tracking-widest text-(--sup-tenue)">{noticia.titulo}</p>

        <div className="min-h-[120px] select-none font-mono text-2xl leading-relaxed tracking-wide">
          {texto.split('').map((char, i) => (
            <span key={i} className={`${getColorCaracter(i)} transition-colors`}>{char}</span>
          ))}
        </div>

        {terminado && (
          <div className="mt-6 animate-pulse text-center text-lg font-bold text-cian">
            {guardando ? 'Guardando resultados…' : '¡Completado!'}
          </div>
        )}
      </div>

      {objetivosIa.length > 0 && (
        <div className="mt-6 max-w-xs 2xl:absolute 2xl:left-full 2xl:top-0 2xl:ml-6 2xl:mt-0 2xl:w-[220px]">
          <PanelObjetivosIa objetivos={objetivosIa} texto={texto} dificultad={noticia.dificultad} />
        </div>
      )}
      </div>{/* fin del bloque texto + panel */}

      {mostrarTeclado && (
        <div className="rounded-2xl border border-(--sup-borde) bg-(--sup) p-6">{teclado}</div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <BotonAccion onClick={() => irANoticia(indiceNoticia - 1)} icono="arrow_back">Texto anterior</BotonAccion>
        <BotonAccion onClick={reiniciar} icono="refresh">
          {objetivosIa.length > 0 ? 'Repetir ejercicio' : 'Repetir noticia'}
        </BotonAccion>
        <BotonAccion onClick={() => irANoticia(indiceNoticia + 1)} icono="arrow_forward" iconoAlFinal>Siguiente noticia</BotonAccion>
        <button
          onClick={() => navigate('/selector-ia')}
          className="flex items-center gap-2 rounded-full bg-cian px-5 py-2.5 text-sm font-bold text-ground transition-all hover:brightness-110 active:scale-95">
          <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
          Generar con IA
        </button>
      </div>
    </div>
  );
};

export default PracticaView;
