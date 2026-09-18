import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icono from '../components/ui/Icono';
import AvisoRacha from '../components/practica/AvisoRacha';
import { useApariencia } from '../core/apariencia/useApariencia';
import {
  FINALES, POR_FAMILIA, type Candidato, type Familia, type Grado,
} from '../core/sonido/catalogo';
import {
  ESQUEMAS, UNIDADES, escalonDeHito, type UnidadRacha,
} from '../core/sonido/hitos';
import {
  MODOS, guardarPreferencias, leerPreferencias,
  type ModoTecleo, type PreferenciasSonido,
} from '../core/sonido/preferencias';
import { arrancarAudio, ponerVolumen } from '../core/sonido/sintesis';

/* LABORATORIO DE SONIDO — hoy, la pantalla que configura el sonido de la app.

   Nació como la pantalla que sirvió para elegir el degradado del fondo: sin enlazar desde
   ningún sitio, se llega escribiendo la ruta, y su trabajo era poner todas las opciones
   juntas para que el usuario eligiera. Ya eligió (7-sep-2026), y con eso cambió de papel:
   lo que se toca aquí se GUARDA en preferencias.ts, o sea que esta pantalla es de verdad la
   configuración de sonido hasta que exista la del perfil. Lo que se abre al entrar no son
   valores de ejemplo: es lo que suena.

   Y por eso ya no se borra nada. Los 44 candidatos se quedan, porque son el menú que el
   usuario va a poder recorrer desde su perfil.

   LO QUE DE VERDAD DECIDE ES EL BANCO DE PRUEBA DE ABAJO, no los botones de audición.

   Un sonido de tecleo escuchado de a uno siempre parece bien: dura 20 milisegundos y no da
   tiempo a que moleste. El mismo sonido a seis por segundo durante un minuto es otra cosa
   completamente distinta, y ahí es donde se caen casi todos. Por eso la mitad de esta
   pantalla es un ejercicio de tipeo de verdad, con su racha y su sonido final. */

const TEXTO_DEMO =
  'El teclado de tu computadora guarda un orden que nació con las máquinas de escribir, '
  + 'y desde entonces cada dedo aprendió su ruta. La práctica constante convierte ese mapa '
  + 'en un gesto que ya no necesitas mirar para repetir.';

interface Seccion {
  familia: Familia;
  titulo: string;
  cuando: string;
  criterio: string;
}

const SECCIONES: Seccion[] = [
  {
    familia: 'tecleo',
    titulo: 'Tecleo',
    cuando: 'En cada pulsación, acierte o falle.',
    criterio: 'El más exigente: se oye seis veces por segundo. Tiene que ser corto, flojo y sin '
      + 'nota clara, o a los dos minutos se convierte en un zumbido.',
  },
  {
    familia: 'correcto',
    titulo: 'Acierto',
    cuando: 'Cuando la tecla era la correcta. Solo suena en los modos «Por resultado» y '
      + '«Base + acento» — y «Base + acento» es el modo por defecto, así que hoy sí suena.',
    criterio: 'Ojo con esta familia: suena CIEN veces por ejercicio, y una nota afinada '
      + 'repetida cien veces puede volverse una melodía involuntaria. Si termina cansando, la '
      + 'vuelta atrás es el modo «Tecleo + fallo», que deja el premio en la racha y no en cada '
      + 'letra.',
  },
  {
    familia: 'error',
    titulo: 'Fallo',
    cuando: 'Cuando la tecla no era la correcta.',
    criterio: 'No lo pediste, y lo añadí por un motivo: con premio al acierto y silencio al '
      + 'fallo, el silencio pasa a significar error. Ninguno de estos es un pitido de fracaso.',
  },
  {
    familia: 'racha',
    titulo: 'Racha',
    cuando: 'Al llegar a un hito de aciertos seguidos.',
    criterio: 'Sube dos semitonos en cada hito: el veinte suena más alto que el diez, así la '
      + 'racha se oye crecer aunque no se mire el número. Prueba la subida antes de elegir, y '
      + 'ten en cuenta que se oye decenas de veces por sesión: si es largo, interrumpe.',
  },
];

const GRADOS: { id: Grado; nombre: string; nota: string }[] = [
  { id: 'bien', nombre: 'Muy bien', nota: 'Sube y resuelve' },
  { id: 'normal', nombre: 'Así así', nota: 'Se queda a medias' },
  { id: 'flojo', nombre: 'Flojo', nota: 'Baja, corto y grave' },
];

/* Los cortes del sonido final en el banco de prueba. No son los umbrales del Curso —los de
   Básico son 9 WPM y 70% de precisión— porque aquí solo hay que poder oír los tres sonidos
   sin pelearse con el teclado. */
const PRECISION_BIEN = 95;
const PRECISION_NORMAL = 80;

/* La marca de "esto es lo que suena hoy". Ya no dice "recomendado": desde que la elección
   está hecha, el distintivo señala el valor por defecto y no una sugerencia mía.

   No se exporta: si este archivo exportara algo que no sea la vista, react-refresh perdería
   el recargado en caliente de la pantalla entera. */
const Predeterminado = ({ esOscuro }: { esOscuro: boolean }) => (
  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase
    tracking-[0.1em] ${esOscuro ? 'bg-cian/20 text-cian' : 'bg-emerald-100 text-emerald-700'}`}>
    Predeterminado
  </span>
);

/* Parte una lista en los subgrupos que declara. Solo el primero de cada tanda lleva
   `grupo`; los siguientes HEREDAN el último declarado, así que añadir un candidato a un
   grupo existente no obliga a repetir la etiqueta ni deja huecos si alguien la olvida. */
const porGrupo = <T extends { grupo?: string }>(lista: T[]) => {
  const tandas: { nombre: string; items: T[] }[] = [];
  let actual = '';
  lista.forEach((item) => {
    actual = item.grupo ?? actual;
    const ultima = tandas[tandas.length - 1];
    if (ultima && ultima.nombre === actual) ultima.items.push(item);
    else tandas.push({ nombre: actual, items: [item] });
  });
  return tandas;
};

const ESCALONES_SUBIDA = 4;
const PASO_SUBIDA_MS = 550;

const LaboratorioSonidoView = () => {
  const { apariencia } = useApariencia();
  const esOscuro = apariencia === 'oscuro';

  /* TODO EL ESTADO ARRANCA DE LAS PREFERENCIAS GUARDADAS, no del primero de cada lista.

     Antes esta pantalla abría siempre con `POR_FAMILIA.tecleo[0]` y compañía, que eran
     valores de ejemplo: el orden del array, nada más. Ahora abre con lo que de verdad suena
     en la app, así que lo que se oye aquí es lo que va a oír el usuario en un ejercicio.

     Inicialización PEREZOSA (`useState(() => ...)`) y no un efecto: leer preferencias en el
     cuerpo de un useEffect sería un setState síncrono, que en este repo es error de lint. */
  const guardadas = leerPreferencias();
  const [volumen, setVolumen] = useState(() => guardadas.volumen);
  const [modo, setModo] = useState<ModoTecleo>(() => guardadas.modo);
  const [unidad, setUnidad] = useState<UnidadRacha>(() => guardadas.unidad);
  const [esquemaId, setEsquemaId] = useState(() => guardadas.esquemaId);
  const [duracionAviso, setDuracionAviso] = useState(() => guardadas.avisoMs);
  const [escalonPrueba, setEscalonPrueba] = useState(0);

  const [elegidos, setElegidos] = useState<Record<Familia, string>>(() => ({
    tecleo: guardadas.tecleo,
    correcto: guardadas.correcto,
    error: guardadas.error,
    racha: guardadas.racha,
  }));
  const [familiaFinal, setFamiliaFinal] = useState(() => guardadas.final);

  // Banco de prueba.
  const [enMarcha, setEnMarcha] = useState(false);
  const [indice, setIndice] = useState(0);
  const [errores, setErrores] = useState<Set<number>>(new Set());
  const [racha, setRacha] = useState(0);
  const [rachaVisible, setRachaVisible] = useState(0);
  const [disparo, setDisparo] = useState(0);
  const fallosPalabraRef = useRef(0);
  /* EL MANEJADOR TRABAJA CON REFS Y NO CON EL ESTADO, igual que las tres vistas de tipeo
     de verdad. React agrupa los cambios de estado por tarea, así que dos pulsaciones que
     lleguen en la misma tarea leerían las dos el MISMO índice: la segunda se compara contra
     la letra que ya se escribió y cuenta como fallo. Con teclas de un humano no pasa —van
     separadas por decenas de milisegundos— pero sí en cuanto algo las emite en ráfaga, que
     es justo como se prueba esta pantalla. El estado se conserva solo para pintar. */
  const indiceRef = useRef(0);
  const rachaRef = useRef(0);
  const erroresRef = useRef<Set<number>>(new Set());
  /* Hasta cuándo sigue en pantalla el aviso. Es lo que decide si una palabra nueva puede
     subirle el número: sin esto, romper la racha durante el desvanecido dejaba el cartel
     contando desde cero mientras todavía se leía "seguidas". */
  const avisoHastaRef = useRef(0);

  const temporizadoresRef = useRef<number[]>([]);
  useEffect(() => () => {
    temporizadoresRef.current.forEach((t) => window.clearTimeout(t));
  }, []);

  /* El volumen se aplica al maestro y se guarda a la vez. Va en un efecto y no en el
     onChange del deslizador porque `ponerVolumen` tiene que correr también en el primer
     render, para que el valor guardado se aplique al entrar. */
  useEffect(() => { ponerVolumen(volumen); guardarPreferencias({ volumen }); }, [volumen]);

  const sonidoDe = useCallback(
    (familia: Familia): Candidato | undefined =>
      POR_FAMILIA[familia].find((c) => c.id === elegidos[familia]),
    [elegidos],
  );

  const tocar = useCallback((familia: Familia, nivel = 0) => {
    sonidoDe(familia)?.tocar(nivel);
  }, [sonidoDe]);

  /* Elegir GUARDA, no solo pinta. Es lo que convierte esta pantalla en la configuración de
     sonido: sin esto habría que copiar el resumen de abajo y trasladarlo a mano al código,
     que era el flujo de cuando esto era una pantalla de decisión y nada más.

     El nombre de la familia en el catálogo ('correcto') y el de la preferencia coinciden a
     propósito, así que el cambio viaja tal cual. */
  const elegir = useCallback((familia: Familia, id: string) => {
    setElegidos((prev) => ({ ...prev, [familia]: id }));
    guardarPreferencias({ [familia]: id } as Partial<PreferenciasSonido>);
  }, []);

  const elegirFinal = useCallback((id: string) => {
    setFamiliaFinal(id);
    guardarPreferencias({ final: id });
  }, []);

  const elegirModo = useCallback((m: ModoTecleo) => {
    setModo(m);
    guardarPreferencias({ modo: m });
  }, []);

  const elegirEsquema = useCallback((id: string) => {
    setEsquemaId(id);
    guardarPreferencias({ esquemaId: id });
  }, []);

  const oirSubida = useCallback(() => {
    const c = sonidoDe('racha');
    if (!c) return;
    temporizadoresRef.current.forEach((t) => window.clearTimeout(t));
    temporizadoresRef.current = [];
    for (let i = 0; i < ESCALONES_SUBIDA; i += 1) {
      temporizadoresRef.current.push(
        window.setTimeout(() => c.tocar(i), i * PASO_SUBIDA_MS),
      );
    }
  }, [sonidoDe]);

  const finalElegido = useMemo(
    () => FINALES.find((f) => f.id === familiaFinal) ?? FINALES[0],
    [familiaFinal],
  );

  const esquema = useMemo(
    () => ESQUEMAS[unidad].find((e) => e.id === esquemaId) ?? ESQUEMAS[unidad][0],
    [unidad, esquemaId],
  );

  /* Cambiar de unidad cambia los escalones disponibles, así que el esquema elegido se
     reajusta en el mismo clic. Va aquí y no en un efecto: es consecuencia directa de una
     acción del usuario, y con un efecto habría un render intermedio con un esquema que no
     pertenece a la unidad. */
  const cambiarUnidad = useCallback((u: UnidadRacha) => {
    setUnidad(u);
    setEsquemaId(ESQUEMAS[u][0].id);
    guardarPreferencias({ unidad: u, esquemaId: ESQUEMAS[u][0].id });
  }, []);

  const reiniciar = useCallback(() => {
    setIndice(0);
    setErrores(new Set());
    setRacha(0);
    setRachaVisible(0);
    setDisparo(0);
    indiceRef.current = 0;
    rachaRef.current = 0;
    erroresRef.current = new Set();
    fallosPalabraRef.current = 0;
    avisoHastaRef.current = 0;
  }, []);

  const empezar = useCallback(() => {
    arrancarAudio();
    reiniciar();
    setEnMarcha(true);
  }, [reiniciar]);

  const manejar = useCallback((e: KeyboardEvent) => {
    /* La misma guarda que se acaba de poner en los ocho manejadores de la app: mantener una
       tecla pulsada es UNA pulsación, no cuarenta. Aquí importa el doble, porque cuarenta
       repeticiones dispararían cuarenta sonidos encima. */
    if (e.repeat) return;
    if (e.ctrlKey || e.metaKey) return;
    if (e.key === 'Escape') { setEnMarcha(false); return; }
    if (e.key.length !== 1) return;
    e.preventDefault();

    const posicion = indiceRef.current;
    const esperado = TEXTO_DEMO[posicion];
    const acierto = e.key === esperado;

    if (modo === 'solo-tecleo') tocar('tecleo');
    else if (modo === 'tecleo-fallo') { tocar('tecleo'); if (!acierto) tocar('error'); }
    else if (modo === 'por-resultado') tocar(acierto ? 'correcto' : 'error');
    else { tocar('tecleo'); tocar(acierto ? 'correcto' : 'error'); }

    if (!acierto) {
      fallosPalabraRef.current += 1;
      erroresRef.current = new Set(erroresRef.current).add(posicion);
      setErrores(erroresRef.current);
    }

    const siguiente = posicion + 1;
    indiceRef.current = siguiente;
    setIndice(siguiente);

    const subirRacha = () => {
      const nueva = rachaRef.current + 1;
      rachaRef.current = nueva;
      setRacha(nueva);
      const escalon = escalonDeHito(nueva, esquema);
      if (escalon !== null) {
        tocar('racha', escalon);
        avisoHastaRef.current = performance.now() + duracionAviso;
        setRachaVisible(nueva);
        setDisparo((d) => d + 1);
      } else if (performance.now() < avisoHastaRef.current) {
        /* El número sube solo mientras el cartel siga en pantalla. Pasado su tiempo se queda
           con el último que mostró, en vez de contar una racha que ya nadie ve. */
        setRachaVisible(nueva);
      }
    };
    const romperRacha = () => { rachaRef.current = 0; setRacha(0); };

    /* Contando LETRAS la racha se resuelve en la propia pulsación, y por eso el cartel sube
       de verdad: en el segundo y medio que dura caben ocho o nueve teclas más. Contando
       PALABRAS hay que esperar a que la palabra se cierre —con su espacio, o con el final
       del texto— y solo cuenta si no tuvo ni un fallo. */
    if (unidad === 'letras') {
      if (acierto) subirRacha(); else romperRacha();
    } else if (esperado === ' ' || siguiente === TEXTO_DEMO.length) {
      if (fallosPalabraRef.current === 0) subirRacha(); else romperRacha();
      fallosPalabraRef.current = 0;
    }

    if (siguiente === TEXTO_DEMO.length) {
      const precision =
        ((TEXTO_DEMO.length - erroresRef.current.size) / TEXTO_DEMO.length) * 100;
      const grado: Grado = precision >= PRECISION_BIEN
        ? 'bien'
        : precision >= PRECISION_NORMAL ? 'normal' : 'flojo';
      // Después del último acierto, para que no se solape con su propio sonido de tecla.
      temporizadoresRef.current.push(
        window.setTimeout(() => finalElegido.tocar(grado), 260),
      );
      setEnMarcha(false);
    }
  }, [modo, tocar, unidad, esquema, duracionAviso, finalElegido]);

  useEffect(() => {
    if (!enMarcha) return;
    window.addEventListener('keydown', manejar);
    return () => window.removeEventListener('keydown', manejar);
  }, [enMarcha, manejar]);

  // ---------------------------------------------------------------- estilos
  const panel = esOscuro
    ? 'border-(--sup-borde) bg-(--sup)'
    : 'border-slate-200 bg-white';
  const titulo = esOscuro ? 'text-white' : 'text-slate-800';
  const suave = esOscuro ? 'text-gris-texto' : 'text-slate-500';
  const acento = esOscuro ? 'var(--color-cian)' : '#059669';

  const claseCandidato = (activo: boolean) => {
    if (activo) {
      return esOscuro
        ? 'border-cian bg-cian/12 text-white'
        : 'border-emerald-500 bg-emerald-50 text-slate-800';
    }
    return esOscuro
      ? 'border-vidrio-borde bg-white/4 text-white hover:border-white/25 hover:bg-white/8'
      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50';
  };

  const claseBoton = (activo: boolean) => `rounded-xl border px-4 py-2 text-sm font-semibold
    transition ${claseCandidato(activo)}`;

  const total = TEXTO_DEMO.length;
  const precisionDemo = indice > 0
    ? Math.round(((indice - errores.size) / indice) * 100)
    : 100;

  return (
    <div data-apariencia={apariencia} className="mx-auto flex max-w-5xl flex-col gap-8 py-8">
      {/* La cabecera va SIEMPRE en claro y no sigue la apariencia: el fondo de la web es
          el degradado oscuro del `body` en las dos, así que un título en `text-slate-800`
          quedaba azul marino sobre azul marino. Es lo que hacen el resto de portadas. */}
      <header>
        <h1 className="text-4xl font-black text-white">Laboratorio de sonido</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gris-texto">
          Todos los candidatos suenan sintetizados en el navegador, sin archivos de audio.
          Haz clic en uno para oírlo y queda elegido. Cuando tengas los cinco, bájate al banco
          de prueba: <strong className="text-white">un sonido de tecleo solo se puede juzgar
          tecleando</strong>, porque escuchado de a uno ninguno molesta.
        </p>
      </header>

      {/* ------------------------------------------------------------ ajustes */}
      <section className={`rounded-2xl border p-6 ${panel}`}>
        <h2 className={`text-lg font-bold ${titulo}`}>Ajustes generales</h2>

        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div>
            <label className={`text-[11px] font-bold uppercase tracking-[0.14em] ${suave}`}>
              Volumen · {Math.round(volumen * 100)}%
            </label>
            <input
              type="range" min={0} max={100} value={Math.round(volumen * 100)}
              onChange={(e) => setVolumen(Number(e.target.value) / 100)}
              className="mt-2 w-full accent-cian" />
            <p className={`mt-1 text-xs ${suave}`}>
              Los candidatos ya vienen equilibrados entre sí: el tecleo suena por debajo del
              resto a propósito, para que el premio se note.
            </p>
          </div>

          <div>
            <span className={`text-[11px] font-bold uppercase tracking-[0.14em] ${suave}`}>
              Cómo suena cada pulsación
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {MODOS.map((m) => (
                <button key={m.id} onClick={() => elegirModo(m.id)}
                  className={`${claseBoton(modo === m.id)} flex items-center gap-1.5`}>
                  {m.predeterminado && (
                    <Icono nombre="star" tamano={14} relleno style={{ color: acento }} />
                  )}
                  {m.nombre}
                </button>
              ))}
            </div>
            <p className={`mt-2 text-xs ${suave}`}>
              {MODOS.find((m) => m.id === modo)?.nota}
            </p>
          </div>

          <div>
            <span className={`text-[11px] font-bold uppercase tracking-[0.14em] ${suave}`}>
              Qué cuenta la racha
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {UNIDADES.map((u) => (
                <button key={u.id} onClick={() => cambiarUnidad(u.id)}
                  className={claseBoton(unidad === u.id)}>
                  {u.nombre}
                </button>
              ))}
            </div>
            <p className={`mt-2 text-xs ${suave}`}>
              {UNIDADES.find((u) => u.id === unidad)?.nota}
            </p>
          </div>

          <div>
            <span className={`text-[11px] font-bold uppercase tracking-[0.14em] ${suave}`}>
              Hitos, en {unidad}
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {ESQUEMAS[unidad].map((es) => (
                <button key={es.id} onClick={() => elegirEsquema(es.id)}
                  className={claseBoton(esquemaId === es.id)}>
                  {es.nombre}
                </button>
              ))}
            </div>
            <p className={`mt-2 text-xs ${suave}`}>{esquema.nota}</p>
          </div>

          <div>
            <label className={`text-[11px] font-bold uppercase tracking-[0.14em] ${suave}`}>
              El aviso tarda {(duracionAviso / 1000).toFixed(1)} s en irse
            </label>
            <input
              type="range" min={1000} max={2500} step={100} value={duracionAviso}
              onChange={(e) => { setDuracionAviso(Number(e.target.value));
                guardarPreferencias({ avisoMs: Number(e.target.value) }); }}
              className="mt-2 w-full accent-cian" />
            <p className={`mt-1 text-xs ${suave}`}>
              Aparece de golpe y se desvanece poco a poco. Mientras siga visible, el número
              sigue subiendo con cada palabra limpia.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ candidatos */}
      {SECCIONES.map((sec) => (
        <section key={sec.familia} className={`rounded-2xl border p-6 ${panel}`}>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className={`text-lg font-bold ${titulo}`}>{sec.titulo}</h2>
            <span className={`text-xs font-semibold ${suave}`}>{sec.cuando}</span>
          </div>
          <p className={`mt-2 max-w-3xl text-sm leading-relaxed ${suave}`}>{sec.criterio}</p>

          {sec.familia === 'racha' && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={`text-[11px] font-bold uppercase tracking-[0.14em] ${suave}`}>
                Escalón
              </span>
              {Array.from({ length: ESCALONES_SUBIDA }, (_, i) => (
                <button key={i} onClick={() => setEscalonPrueba(i)}
                  className={`h-9 w-9 rounded-lg border text-sm font-bold transition
                    ${claseCandidato(escalonPrueba === i)}`}>
                  {i + 1}
                </button>
              ))}
              <button onClick={oirSubida}
                className={`${claseBoton(false)} ml-2 flex items-center gap-2`}>
                <Icono nombre="graphic_eq" tamano={18} />
                Oír la subida
              </button>
            </div>
          )}

          {porGrupo(POR_FAMILIA[sec.familia]).map((tanda) => (
            <div key={tanda.nombre || sec.familia}>
              {tanda.nombre && (
                <h3 className={`mt-6 text-[11px] font-bold uppercase tracking-[0.16em] ${suave}`}>
                  {tanda.nombre}
                </h3>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tanda.items.map((c) => {
                  const activo = elegidos[sec.familia] === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        elegir(sec.familia, c.id);
                        c.tocar(sec.familia === 'racha' ? escalonPrueba : 0);
                      }}
                      className={`rounded-xl border p-4 text-left transition
                        ${claseCandidato(activo)}`}>
                      <span className="flex items-center gap-2">
                        <Icono
                          nombre={activo ? 'check_circle' : 'play_circle'}
                          tamano={20} relleno={activo}
                          style={{ color: activo ? acento : 'currentColor' }} />
                        <span className="font-bold">{c.nombre}</span>
                        {c.predeterminado && <Predeterminado esOscuro={esOscuro} />}
                      </span>
                      <span className={`mt-2 block text-xs leading-relaxed ${suave}`}>
                        {c.nota}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ))}

      {/* ------------------------------------------------------------ finales */}
      <section className={`rounded-2xl border p-6 ${panel}`}>
        <h2 className={`text-lg font-bold ${titulo}`}>Fin del ejercicio</h2>
        <p className={`mt-2 max-w-3xl text-sm leading-relaxed ${suave}`}>
          Van por familias y no como nueve sonidos sueltos: los tres se oyen el mismo día en la
          misma pantalla, y si no comparten timbre el usuario no oye «me fue regular», oye «esta
          vez sonó otra aplicación». Elige la familia; dentro de ella, escucha los tres grados.
        </p>

        {porGrupo(FINALES).map((tanda) => (
          <div key={tanda.nombre}>
            {tanda.nombre && (
              <h3 className={`mt-6 text-[11px] font-bold uppercase tracking-[0.16em] ${suave}`}>
                {tanda.nombre}
              </h3>
            )}
            <div className="mt-3 flex flex-col gap-3">
          {tanda.items.map((f) => {
            const activo = familiaFinal === f.id;
            return (
              <div key={f.id}
                className={`rounded-xl border p-4 transition ${claseCandidato(activo)}`}>
                <button onClick={() => elegirFinal(f.id)}
                  className="flex w-full items-center gap-2 text-left">
                  <Icono
                    nombre={activo ? 'check_circle' : 'radio_button_unchecked'}
                    tamano={20} relleno={activo}
                    style={{ color: activo ? acento : 'currentColor' }} />
                  <span className="font-bold">{f.nombre}</span>
                  {f.predeterminado && <Predeterminado esOscuro={esOscuro} />}
                </button>
                <p className={`mt-1 text-xs leading-relaxed ${suave}`}>{f.nota}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {GRADOS.map((g) => (
                    <button key={g.id}
                      onClick={() => { elegirFinal(f.id); f.tocar(g.id); }}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs
                        font-bold transition ${esOscuro
                          ? 'border-white/20 bg-white/10 text-white hover:border-cian/60 hover:bg-white/16'
                          : 'border-slate-300 bg-white text-slate-800 hover:border-emerald-500 hover:bg-emerald-50'}`}>
                      <Icono nombre="play_arrow" tamano={16} />
                      {g.nombre}
                      <span className={suave}>· {g.nota}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
            </div>
          </div>
        ))}
      </section>

      {/* ------------------------------------------------------------ banco de prueba */}
      <section className={`rounded-2xl border p-6 ${panel}`}>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className={`text-lg font-bold ${titulo}`}>Banco de prueba</h2>
          <span className={`text-xs font-semibold ${suave}`}>
            Aquí es donde se decide de verdad.
          </span>
        </div>
        <p className={`mt-2 max-w-3xl text-sm leading-relaxed ${suave}`}>
          Teclea el texto con los sonidos que elegiste. La racha cuenta {unidad} seguidas sin un
          solo fallo; al llegar a un hito suena el premio y aparece el aviso flotante. Al final
          del texto suena el cierre que corresponda a tu precisión
          ({PRECISION_BIEN}% o más «muy bien», {PRECISION_NORMAL}% «así así», por debajo «flojo»).
          Esc corta.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button onClick={empezar}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold
              ${esOscuro ? 'bg-cian text-[#03202A]' : 'bg-emerald-600 text-white'}`}>
            <Icono nombre={enMarcha ? 'restart_alt' : 'play_arrow'} tamano={18} />
            {enMarcha ? 'Reiniciar' : 'Empezar a teclear'}
          </button>
          <button
            onClick={() => {
              arrancarAudio();
              const n = Math.max(rachaRef.current, esquema.primero);
              setRachaVisible(n);
              avisoHastaRef.current = performance.now() + duracionAviso;
              setDisparo((d) => d + 1);
              tocar('racha', escalonPrueba);
            }}
            className={claseBoton(false)}>
            Ver el aviso suelto
          </button>

          <span className={`ml-auto text-sm font-bold tabular-nums ${titulo}`}>
            <span style={{ color: acento }}>{racha}</span>
            <span className={`ml-1 text-xs font-semibold ${suave}`}>racha</span>
            <span className="mx-3 opacity-30">|</span>
            <span style={{ color: acento }}>{precisionDemo}%</span>
            <span className={`ml-1 text-xs font-semibold ${suave}`}>precisión</span>
            <span className="mx-3 opacity-30">|</span>
            <span style={{ color: acento }}>{indice}/{total}</span>
          </span>
        </div>

        {/* El contenedor del aviso es `relative` — el aviso se coloca en absoluto sobre él. */}
        <div className="relative mt-6 pt-16">
          <AvisoRacha
            racha={rachaVisible} disparo={disparo}
            duracionMs={duracionAviso} esOscuro={esOscuro} className="top-0" />

          <p className={`font-mono text-xl leading-[2.1] tracking-wide
            ${enMarcha ? '' : 'opacity-50'}`}>
            {TEXTO_DEMO.split('').map((ch, i) => {
              const escrito = i < indice;
              const fallado = errores.has(i);
              const color = escrito
                ? (fallado ? 'var(--color-dificil)' : acento)
                : (esOscuro ? 'var(--color-gris-texto)' : '#94a3b8');
              return (
                <span key={i}
                  style={{ color }}
                  className={i === indice && enMarcha
                    ? `rounded-sm underline decoration-2 underline-offset-4
                       ${esOscuro ? 'bg-white/15' : 'bg-emerald-600/15'}`
                    : undefined}>
                  {ch}
                </span>
              );
            })}
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ resumen */}
      <section className={`rounded-2xl border p-6 ${panel}`}>
        <h2 className={`text-lg font-bold ${titulo}`}>Lo que suena ahora</h2>
        <p className={`mt-2 text-sm ${suave}`}>
          Esto ya está guardado: es la configuración con la que va a sonar la app, y se conserva
          al recargar. Nada del catálogo se borra — los sonidos que no elegiste siguen aquí para
          cuando se pueda cambiarlos desde el perfil.
        </p>
        <pre className={`mt-4 overflow-x-auto rounded-xl border p-4 text-xs leading-relaxed
          ${esOscuro ? 'border-vidrio-borde bg-black/25 text-cian' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
{`tecleo   ${elegidos.tecleo}
acierto  ${elegidos.correcto}
fallo    ${elegidos.error}
racha    ${elegidos.racha}
final    ${familiaFinal}
modo     ${modo}
racha    por ${unidad}
hitos    ${esquema.nombre}
aviso    ${(duracionAviso / 1000).toFixed(1)} s
volumen  ${Math.round(volumen * 100)}%`}
        </pre>
      </section>
    </div>
  );
};

export default LaboratorioSonidoView;
