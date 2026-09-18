import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import Spinner from '../components/ui/Spinner';
import SelectorApariencia from '../components/ui/SelectorApariencia';
import { useApariencia } from '../core/apariencia/useApariencia';
import {
  obtenerResumenGlobal, obtenerDebilidades, obtenerProgresoNgrams,
  obtenerProgresoTemporal, obtenerRecords, obtenerTeclasLentas, obtenerMapaDeTeclas,
} from '../api/statsApi';
import type {
  StatsResponse, DebilidadesResponse, ItemDebilidad, ProgresoNgramResponse,
  ProgresoTemporalResponse, RecordsResponse, TeclasLentasResponse, TeclaLenta,
  AgrupacionProgreso,
} from '../types';

const FILAS_TECLADO = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L','Ñ'],
  ['Z','X','C','V','B','N','M'],
];

// Las teclas que el mapa de calor puede pintar. Todo lo demás (símbolos, números,
// espacio) se lista aparte en vez de desaparecer.
const LETRAS_GRILLA = new Set(FILAS_TECLADO.flat());

const getColorHeatmap = (tecla: string, peoresTeclas: ItemDebilidad[]) => {
  const indice = peoresTeclas.findIndex(t => t.secuencia.toUpperCase() === tecla);
  if (indice === -1) return 'bg-slate-100 text-slate-600 border-slate-200';
  if (indice === 0) return 'bg-rose-500 text-white border-rose-600';
  if (indice === 1) return 'bg-rose-300 text-white border-rose-400';
  if (indice === 2) return 'bg-rose-200 text-rose-800 border-rose-300';
  if (indice === 3) return 'bg-orange-200 text-orange-800 border-orange-300';
  return 'bg-yellow-100 text-yellow-800 border-yellow-200';
};

const formatTiempo = (segundos: number) => {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

/* ================== APOYO DE LA APARIENCIA OSCURA ================== */

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

/* El backend agrupa con DATE_FORMAT y devuelve la etiqueta cruda: "2026-08-08" por día,
   "2026-S32" por semana, "2026-08" por mes. Acá se traduce a algo legible en el eje.
   Se parte el string en vez de construir un Date: `new Date("2026-08-08")` se interpreta
   como UTC y en Perú (UTC-5) retrocede al día anterior. */
const formatearPeriodo = (periodo: string, agrupacion: AgrupacionProgreso) => {
  // 'hoy' ya viene como HH:MM desde la base: es la hora de esa práctica, no un período.
  if (agrupacion === 'hoy') return periodo;

  const partes = periodo.split('-');
  if (agrupacion === 'semana') return `Sem ${partes[1]?.replace('S', '') ?? periodo}`;
  const mes = MESES[Number(partes[1]) - 1] ?? partes[1];
  if (agrupacion === 'mes') return `${mes} ${partes[0]}`;
  return `${Number(partes[2])} ${mes}`;
};

const formatearFecha = (iso: string | null) => {
  if (!iso) return '—';
  const partes = iso.split('-');
  return `${Number(partes[2])} ${MESES[Number(partes[1]) - 1]} ${partes[0]}`;
};

/* Color del mapa de calor. Las dos métricas usan tonos distintos a propósito: en rojo
   "fallas mucho acá", en morado "te demoras acá". Con la misma escala para las dos,
   cambiar de modo parecería un cambio de datos y no de pregunta. */
const TONO_ERROR = '255, 0, 4';
const TONO_LENTITUD = '191, 129, 255';

/* La intensidad sale del VALOR, no del puesto en el ranking. Con una rampa de pasos
   fijos, una lista de 15 teclas dejaba a las 11 últimas exactamente del mismo color y el
   mapa solo distinguía el podio. Normalizar contra el mínimo y el máximo de la propia
   lista hace que el degradado signifique algo.

   El piso de 0.25 es para que la tecla menos intensa igual se distinga de una sin datos:
   estar en la lista ya es información. */
const intensidad = (valor: number, min: number, max: number) => {
  const proporcion = max === min ? 1 : (valor - min) / (max - min);
  return 0.25 + proporcion * 0.75;
};

/* "Sin datos" tiene que distinguirse de cualquier valor de la escala. Con el azul oscuro
   de antes se confundía con la parada del 25% de error, así que una tecla que nunca has
   pulsado lo suficiente se veía igual que una que fallas una de cada cuatro veces. Este
   gris no tiene nada de azul ni de rojo: no pertenece a la escala. */
/* Pulsaciones mínimas para que una tecla se coloree. Por debajo el porcentaje no
   significa nada: dos pulsaciones con las dos mal darían 100% y pintarían la tecla del
   rojo más crítico. El backend igual manda las teclas con pocos datos para poder mostrar
   el conteo real en el tooltip. */
const MIN_PULSACIONES_MAPA = 15;

const ESTILO_SIN_DATOS = {
  background: '#191D21',
  borderColor: 'rgba(255,255,255,0.06)',
  color: '#6B7378',
};

const estiloTecla = (tono: string, alfa: number | null) => alfa === null
  ? ESTILO_SIN_DATOS
  : {
      background: `rgba(${tono}, ${alfa})`,
      borderColor: `rgba(${tono}, ${Math.min(1, alfa + 0.2)})`,
      // Sobre un fondo ya saturado el texto claro se pierde; recién ahí conviene invertirlo.
      color: alfa > 0.55 ? '#04212A' : '#E6F1F7',
    };

/* --- Escala de color del mapa de fallos ---

   Antes todo el teclado era rojo con distinta transparencia, así que una tecla con 5% de
   error se veía del mismo color que una con 70%, solo que más pálida: el mapa gritaba
   "todo mal" aunque la mayoría estuviera bien.

   Ahora la escala recorre tres zonas sobre el porcentaje REAL (no sobre el puesto en el
   ranking), que es lo que permite leer un valor sin comparar con el resto:

     0%   cian pleno       la tecla que nunca fallas
     8%   celeste oscuro   fallas poco
     25%  azul casi negro  el punto de inflexión
     60%  rojo oscuro
     100% rojo que resalta

   Los tramos son deliberadamente desiguales: entre 0 y 25 la mayoría de las teclas de
   un usuario decente se amontonan, así que ahí conviene gastar más recorrido de color. */
const PARADAS_ERROR: [number, [number, number, number]][] = [
  [0, [0, 241, 253]],
  [8, [11, 85, 96]],
  [25, [10, 20, 28]],
  [60, [138, 2, 6]],
  [100, [255, 0, 4]],
];

const colorPorError = (pct: number): [number, number, number] => {
  const valor = Math.max(0, Math.min(100, pct));
  for (let i = 0; i < PARADAS_ERROR.length - 1; i++) {
    const [pIni, cIni] = PARADAS_ERROR[i];
    const [pFin, cFin] = PARADAS_ERROR[i + 1];
    if (valor <= pFin) {
      const t = pFin === pIni ? 0 : (valor - pIni) / (pFin - pIni);
      return [
        Math.round(cIni[0] + (cFin[0] - cIni[0]) * t),
        Math.round(cIni[1] + (cFin[1] - cIni[1]) * t),
        Math.round(cIni[2] + (cFin[2] - cIni[2]) * t),
      ];
    }
  }
  return PARADAS_ERROR[PARADAS_ERROR.length - 1][1];
};

const estiloTeclaPorError = (pct: number) => {
  const [r, g, b] = colorPorError(pct);
  /* El texto se invierte en los dos extremos por motivos opuestos: sobre el cian pleno
     y sobre el rojo saturado, el texto claro se pierde. En la zona oscura del medio
     hace falta justo lo contrario. */
  const extremoClaro = pct < 6 || pct > 70;
  return {
    background: `rgb(${r}, ${g}, ${b})`,
    borderColor: `rgba(${r}, ${g}, ${b}, 1)`,
    color: extremoClaro ? '#04212A' : '#E6F1F7',
  };
};

const Tarjeta = ({
  children, className = '',
}: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-vidrio-borde bg-vidrio p-6 backdrop-blur-sm ${className}`}>
    {children}
  </div>
);

/* Métrica grande con la barra de color a la izquierda, igual que en Resultados. */
const Metrica = ({
  etiqueta, valor, sufijo, color, nota,
}: { etiqueta: string; valor: string | number; sufijo?: string; color: string; nota?: string }) => (
  <div className="rounded-xl border border-vidrio-borde bg-vidrio px-4 py-3 backdrop-blur-sm"
    style={{ borderLeft: `3px solid ${color}` }}>
    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gris-texto">{etiqueta}</p>
    <p className="mt-1 font-bold text-white">
      <span className="text-3xl tabular-nums">{valor}</span>
      {sufijo && <span className="ml-1 align-top text-base text-gris-texto">{sufijo}</span>}
    </p>
    {nota && <p className="mt-0.5 text-[11px] text-gris-texto">{nota}</p>}
  </div>
);

/* Lista de secuencias falladas con la barra bicolor: cian lo que aciertas, rojo lo que
   fallas. Es el mismo lenguaje visual de los paneles de Resultados. */
const PanelNgramas = ({
  titulo, items, progreso,
}: {
  titulo: string;
  items?: ItemDebilidad[];
  progreso: ProgresoNgramResponse | null;
}) => (
  <Tarjeta>
    <h3 className="mb-5 text-sm font-bold uppercase tracking-[0.12em] text-cian">{titulo}</h3>
    {items && items.length > 0 ? (
      <div className="flex flex-col gap-4">
        {(() => {
          return items.map((item, i) => {
          const pctAcierto = 100 - item.porcentajeError;
          const mejora = progreso?.mejorandoEnTop5.find(m => m.secuencia === item.secuencia);
          return (
            <div key={item.secuencia}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold tabular-nums text-gris-texto">#{i + 1}</span>
                  {/* Misma escala absoluta que el teclado: cian si casi no fallas, oscuro
                      en la zona media y rojo cuando duele. Al ser absoluta, el color de un
                      bigrama significa lo mismo acá que en el mapa. */}
                  <span className="rounded-md border px-2.5 py-1 font-mono text-sm font-bold"
                    style={estiloTeclaPorError(item.porcentajeError)}>
                    {item.secuencia === ' ' ? '␣' : item.secuencia}
                  </span>
                  <span className="text-[11px] text-gris-texto">{item.totalIntentos} intentos</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold tabular-nums">
                  <span className="text-cian">{pctAcierto}%</span>
                  <span className="text-dificil">{item.porcentajeError}%</span>
                </div>
              </div>

              {mejora && (
                <p className="mb-1 flex items-center gap-1 text-[11px] font-bold text-cian">
                  <span className="material-symbols-outlined text-[14px]">trending_up</span>
                  Mejorando {mejora.puntosMejorados} puntos
                </p>
              )}

              <div className="flex h-1.5 w-full overflow-hidden rounded-full">
                <div className="h-full bg-cian transition-all duration-500" style={{ width: `${pctAcierto}%` }} />
                <div className="h-full bg-dificil transition-all duration-500" style={{ width: `${item.porcentajeError}%` }} />
              </div>
            </div>
          );
          });
        })()}
      </div>
    ) : (
      <p className="text-sm text-gris-texto">
        Necesitas al menos 3 sesiones para que aparezcan.
      </p>
    )}
  </Tarjeta>
);

/* Chips de selección reutilizados por los dos conmutadores del panel central. */
const Chips = <T extends string>({
  opciones, valor, onCambiar,
}: { opciones: { id: T; nombre: string }[]; valor: T; onCambiar: (id: T) => void }) => (
  <div className="flex gap-1.5">
    {opciones.map((o) => (
      <button
        key={o.id}
        onClick={() => onCambiar(o.id)}
        aria-pressed={o.id === valor}
        className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
          o.id === valor
            ? 'bg-cian text-[#04212A]'
            : 'border border-vidrio-borde bg-vidrio text-gris-texto hover:border-white/25'
        }`}>
        {o.nombre}
      </button>
    ))}
  </div>
);

const GlobalStatsView = () => {
  const navigate = useNavigate();
  const { apariencia } = useApariencia();
  const esOscuro = apariencia === 'oscuro';

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [debilidades, setDebilidades] = useState<DebilidadesResponse | null>(null);
  const [progreso, setProgreso] = useState<ProgresoNgramResponse | null>(null);
  const [records, setRecords] = useState<RecordsResponse | null>(null);
  const [teclasLentas, setTeclasLentas] = useState<TeclasLentasResponse | null>(null);
  /* El mapa de calor NO usa debilidades.peoresTeclas: aquel es el top 5 que consume
     Gemini, con un mínimo de 2 pulsaciones, y sus cinco ganadoras eran símbolos con dos
     intentos al 100% — ninguno en la grilla, así que el teclado salía entero "sin
     errores" teniendo miles registrados. */
  const [mapaTeclas, setMapaTeclas] = useState<ItemDebilidad[]>([]);
  const [serie, setSerie] = useState<ProgresoTemporalResponse | null>(null);
  const [cargando, setCargando] = useState(true);

  /* Los dos conmutadores del panel central: qué se muestra (curva o teclado) y, dentro
     del teclado, qué métrica pinta las teclas. */
  const [vista, setVista] = useState<'progreso' | 'teclado'>('progreso');
  const [metricaTeclado, setMetricaTeclado] = useState<'fallos' | 'lentitud'>('fallos');
  const [agrupacion, setAgrupacion] = useState<AgrupacionProgreso>('dia');

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [resStats, resDebilidades, resProgreso, resRecords, resLentas, resMapa] = await Promise.all([
          obtenerResumenGlobal(),
          obtenerDebilidades(),
          obtenerProgresoNgrams(),
          obtenerRecords(),
          obtenerTeclasLentas(),
          obtenerMapaDeTeclas(),
        ]);
        setStats(resStats);
        setDebilidades(resDebilidades);
        setProgreso(resProgreso);
        setRecords(resRecords);
        setTeclasLentas(resLentas);
        setMapaTeclas(resMapa);
      } catch (err) {
        console.error(err);
      } finally {
        setCargando(false);
      }
    };
    cargarDatos();
  }, []);

  /* La serie se recarga sola al cambiar de agrupación en vez de pedir las tres juntas:
     son tres consultas de agregación y lo normal es que el usuario mire solo una. */
  useEffect(() => {
    let vigente = true;
    obtenerProgresoTemporal(agrupacion)
      .then((res) => { if (vigente) setSerie(res); })
      .catch((err) => console.error(err));
    // Una respuesta lenta de una agrupación anterior no debe pisar a la actual.
    return () => { vigente = false; };
  }, [agrupacion]);

  if (cargando) return <Spinner texto="Cargando estadísticas..." />;

  const handleGenerarPractica = () => {
    if (!debilidades) return;

    // Guardamos las debilidades en sessionStorage para que SelectorIaView las lea
    sessionStorage.setItem('debilidades_teclas', JSON.stringify(debilidades.peoresTeclas));
    sessionStorage.setItem('debilidades_bigramas', JSON.stringify(debilidades.peoresBigramas));
    sessionStorage.setItem('debilidades_trigramas', JSON.stringify(debilidades.peoresTrigramas));
    navigate('/selector-ia');
  };

  const botonIa = (
    <button
      onClick={handleGenerarPractica}
      disabled={!debilidades}
      className={esOscuro
        ? 'flex items-center gap-3 rounded-full bg-cian px-10 py-4 text-base font-bold text-[#04212A] transition-all hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50'
        : 'flex items-center gap-3 rounded-full bg-emerald-500 px-10 py-5 text-lg font-bold text-white shadow-lg transition-all hover:-translate-y-1 hover:bg-emerald-600 hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50'}>
      <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
        auto_awesome
      </span>
      Generar práctica personalizada con IA
    </button>
  );

  /* ======================= APARIENCIA OSCURA ======================= */
  if (esOscuro) {
    const listaLentas = teclasLentas?.teclas ?? [];
    const lentasPorTecla = new Map<string, TeclaLenta>(
      listaLentas.map((t) => [t.tecla.toUpperCase(), t]),
    );
    // El mapa se pinta con su propia consulta; `debilidades` sigue alimentando las listas
    // de bigramas y trigramas, que sí quieren el top 5.
    const peores = mapaTeclas;

    /* Los extremos se calculan SOLO sobre las teclas que el teclado dibuja. La tecla más
       lenta del historial suele ser un símbolo como "[", que no está en la grilla: si
       marcara el techo de la escala, todas las letras visibles quedarían apretadas contra
       el extremo bajo y el degradado no se notaría.

       Esto ya solo aplica a la métrica de LENTITUD. Los fallos pasaron a una escala
       absoluta (colorPorError), donde un 40% se ve igual de grave tengas el historial que
       tengas — que es lo que uno espera de un porcentaje. */
    const enGrilla = (t: string) => LETRAS_GRILLA.has(t.toUpperCase());
    const msLentos = listaLentas.filter(t => enGrilla(t.tecla)).map((t) => t.msPromedio);
    const minMs = Math.min(...msLentos);
    const maxMs = Math.max(...msLentos);

    /* Lo que la métrica encontró pero el teclado no puede pintar: símbolos, números y el
       espacio. Sin esto el panel se vería vacío mientras el dato sí existe — que es justo
       lo que pasa hoy, donde las cinco teclas más falladas son todas símbolos.

       Se muestran solo las 5 PEORES, no todas: el historial acumula decenas de símbolos y
       la fila se estiraba hasta llenar la pantalla de teclas irrelevantes. El resto sigue
       guardado y sigue contando en las estadísticas — lo único que se recorta es cuántas
       se dibujan acá.

       El orden se calcula acá y no se hereda del backend a propósito: si algún día cambia
       el ORDER BY de la consulta, este recorte seguiría mostrando cinco cualesquiera en
       vez de las cinco peores, y sería un error mudo. */
    const TOPE_FUERA_DE_GRILLA = 5;
    const fueraDeGrilla = metricaTeclado === 'fallos'
      ? peores.filter(t => !enGrilla(t.secuencia))
          .slice()
          .sort((a, b) => b.porcentajeError - a.porcentajeError)
          .slice(0, TOPE_FUERA_DE_GRILLA)
          .map(t => ({ tecla: t.secuencia, detalle: `${t.porcentajeError}% error` }))
      : listaLentas.filter(t => !enGrilla(t.tecla))
          .slice()
          .sort((a, b) => b.msPromedio - a.msPromedio)
          .slice(0, TOPE_FUERA_DE_GRILLA)
          .map(t => ({ tecla: t.tecla, detalle: `${t.msPromedio} ms` }));

    const datosSerie = (serie?.puntos ?? []).map((p) => ({
      etiqueta: formatearPeriodo(p.periodo, serie?.agrupacion ?? agrupacion),
      wpm: p.wpm,
      precision: Number(p.precision),
      sesiones: p.sesiones,
    }));

    return (
      <div className="flex flex-col gap-6 pb-10">

        <header className="relative flex items-start justify-between gap-4 pt-2">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tight text-white">
              MIS <span className="text-cian">ESTADÍSTICAS</span>
            </h1>
            <p className="mt-1 text-gris-texto">Tu historial de rendimiento y áreas de mejora.</p>
          </div>
          <SelectorApariencia />
        </header>

        {/* Métricas principales. La nota bajo velocidad y precisión aclara de dónde salen:
            sin ella el número parecería contradecir la cuenta total de sesiones. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metrica etiqueta="WPM Promedio" valor={stats?.wpmPromedio ?? 0} color="#00F1FD"
            nota={`sobre ${stats?.sesionesMedidas ?? 0} sesiones medidas`} />
          <Metrica etiqueta="Precisión Promedio" valor={stats?.precisionPromedio ?? 0} sufijo="%" color="#BF81FF"
            nota="noticias, IA y curso" />
          <Metrica etiqueta="Sesiones" valor={stats?.sesionesCompletadas ?? 0} color="#96F8FF"
            nota="todo lo practicado" />
          <Metrica etiqueta="Tiempo Total" valor={formatTiempo(stats?.tiempoTotalSegundos ?? 0)} color="#FFFFFF"
            nota={`${(stats?.caracteresEscritos ?? 0).toLocaleString('es-PE')} pulsaciones`} />
        </div>

        {/* Récords y constancia */}
        <Tarjeta>
          <h2 className="mb-5 text-sm font-bold uppercase tracking-[0.12em] text-cian">Récords y constancia</h2>
          {/* Fuera "Mejor precisión" y "Errores totales": la precisión ya está metida
              dentro del WPM (escribir mal te frena), así que verla como récord aparte
              confunde más de lo que informa, y el total de errores mezcla los drills del
              curso con el tecleo real. */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
            {[
              { etiqueta: 'Mejor WPM', valor: records?.mejorWpm ?? 0, pie: formatearFecha(records?.fechaMejorWpm ?? null) },
              { etiqueta: 'Racha actual', valor: `${records?.rachaActual ?? 0}d`, pie: 'días seguidos' },
              { etiqueta: 'Racha máxima', valor: `${records?.rachaMaxima ?? 0}d`, pie: 'tu mejor marca' },
              { etiqueta: 'Días activos', valor: records?.diasActivos ?? 0, pie: 'con al menos 1 sesión' },
            ].map((r) => {
              /* El récord de WPM se puede volver a correr: al pasar el cursor aparece el
                 reto contra esa misma sesión. Si salió de una noticia o un texto de IA, el
                 rival se reconstruye en /practica; si salió del Curso (Avanzado, desde el
                 10-sep), en la ruta de su ejercicio, que tiene su propio modo sombra. */
              const retable = r.etiqueta === 'Mejor WPM' && records?.mejorWpmSesionId != null;
              const rutaDelRival = records?.mejorWpmEjercicioId != null && records.mejorWpmNivel
                ? `/curso/${records.mejorWpmNivel.toLowerCase()}/${records.mejorWpmEjercicioId}`
                  + `?fantasma=${records.mejorWpmSesionId}`
                : `/practica?fantasma=${records?.mejorWpmSesionId}`;
              return (
                <div key={r.etiqueta} className={retable ? 'group relative' : undefined}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gris-texto">{r.etiqueta}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-white">{r.valor}</p>
                  <p className="text-[11px] text-gris-texto">{r.pie}</p>

                  {retable && (
                    <button
                      onClick={() => navigate(rutaDelRival)}
                      className="mt-2 flex items-center gap-1.5 rounded-full bg-medio/15 px-3 py-1.5 text-[11px] font-bold text-medio opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100">
                      <span className="material-symbols-outlined text-[14px]">nightlight</span>
                      Enfrentar esta sesión
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Tarjeta>

        {/* Panel conmutable: la curva de progreso y el mapa de calor comparten espacio
            porque responden a la misma pregunta desde ángulos distintos (cómo vengo /
            dónde estoy flojo) y las dos necesitan la pantalla completa de ancho. */}
        <Tarjeta>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">
                {vista === 'progreso' ? 'Progreso en el tiempo' : 'Mapa de calor del teclado'}
              </h2>
              <p className="text-sm text-gris-texto">
                {vista === 'progreso'
                  ? 'Promedio de tus noticias, textos con IA y ejercicios del curso.'
                  : metricaTeclado === 'fallos'
                    ? 'Las teclas más intensas son donde más fallas.'
                    : 'Las teclas más intensas son las que más te frenan, aunque las aciertes.'}
              </p>
            </div>
            <Chips
              opciones={[{ id: 'progreso', nombre: 'Progreso' }, { id: 'teclado', nombre: 'Teclado' }]}
              valor={vista}
              onCambiar={setVista} />
          </div>

          {vista === 'progreso' ? (
            <>
              <div className="mb-4">
                <Chips
                  opciones={[
                    { id: 'hoy', nombre: 'Hoy' },
                    { id: 'dia', nombre: 'Por día' },
                    { id: 'semana', nombre: 'Por semana' },
                    { id: 'mes', nombre: 'Por mes' },
                  ]}
                  valor={agrupacion}
                  onCambiar={setAgrupacion} />
              </div>

              {datosSerie.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={datosSerie} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rellenoProgreso" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00F1FD" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#00F1FD" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: '#B0B3B5' }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.15)' }} tickLine={false} />
                    {/* Dos escalas: el WPM vive entre 0 y ~100 y la precisión entre 80 y
                        100. En un solo eje la línea de precisión quedaría pegada al techo
                        y sin recorrido visible. */}
                    <YAxis yAxisId="wpm" tick={{ fontSize: 11, fill: '#B0B3B5' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="precision" orientation="right" domain={[0, 100]} hide />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                        background: '#0A141C', fontSize: '12px', color: '#FFFFFF',
                      }}
                      labelStyle={{ color: '#B0B3B5' }}
                      formatter={(value, name) => name === 'wpm'
                        ? [`${value} WPM`, 'Velocidad']
                        : [`${value}%`, 'Precisión']} />
                    <Area yAxisId="wpm" type="monotone" dataKey="wpm" stroke="#00F1FD" strokeWidth={3}
                      fill="url(#rellenoProgreso)"
                      /* Borde blanco: sin esto el punto es del mismo cian que el relleno
                         del área y no se distingue de lo que tiene debajo. En "Hoy", con
                         varias prácticas cercanas en el eje, dos puntos sólidos sin borde
                         se leen como uno solo — el borde separa cada práctica a simple
                         vista aunque estén una al lado de la otra. */
                      dot={{ fill: '#00F1FD', stroke: '#FFFFFF', strokeWidth: 1.5, r: 4 }}
                      activeDot={{ r: 6, fill: '#00F1FD', stroke: '#FFFFFF', strokeWidth: 2 }} />
                    <Line yAxisId="precision" type="monotone" dataKey="precision" stroke="#BF81FF"
                      strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-48 items-center justify-center text-center text-sm text-gris-texto">
                  {/* En "Hoy" el vacío significa otra cosa: no es que no tengas historial,
                      es que todavía no practicaste hoy. */}
                  <p>
                    {agrupacion === 'hoy'
                      ? 'Todavía no practicaste hoy. Cada sesión aparecerá acá con su hora.'
                      : 'Practica una noticia, un texto con IA o un ejercicio del curso y la curva empieza a dibujarse.'}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <Chips
                  opciones={[
                    { id: 'fallos', nombre: 'Más falladas' },
                    { id: 'lentitud', nombre: 'Más lentas' },
                  ]}
                  valor={metricaTeclado}
                  onCambiar={setMetricaTeclado} />

                <div className="flex items-center gap-3 text-[11px] font-bold text-gris-texto">
                  <span>{metricaTeclado === 'fallos' ? 'Sin errores' : 'Ágil'}</span>
                  {/* Degradado continuo, no bloques: el color de las teclas también lo es.
                      En fallos reproduce las mismas paradas que la escala del teclado, con
                      los cortes en el mismo sitio, para que la leyenda sirva para leer un
                      color y no solo de adorno. */}
                  <div className="h-2.5 w-24 rounded-full"
                    style={{
                      background: metricaTeclado === 'fallos'
                        ? `linear-gradient(to right, ${PARADAS_ERROR
                            .map(([p, c]) => `rgb(${c[0]},${c[1]},${c[2]}) ${p}%`)
                            .join(', ')})`
                        : `linear-gradient(to right, #0A141C, rgba(${TONO_LENTITUD}, 1))`,
                    }} />
                  <span>{metricaTeclado === 'fallos' ? 'Crítico' : 'Te frena'}</span>
                </div>
              </div>

              {metricaTeclado === 'lentitud' && !teclasLentas?.datosSuficientes ? (
                <div className="flex h-32 items-center justify-center px-6 text-center text-sm text-gris-texto">
                  <p>
                    Todavía no hay suficientes pulsaciones registradas para medir el ritmo.
                    Practica una noticia completa y el teclado se llena.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  {FILAS_TECLADO.map((fila, fi) => (
                    <div key={fi} className="flex gap-1.5">
                      {fila.map((tecla) => {
                        const lenta = lentasPorTecla.get(tecla);
                        const fallada = peores.find(t => t.secuencia.toUpperCase() === tecla);

                        const esFallos = metricaTeclado === 'fallos';

                        /* En fallos el color sale del porcentaje absoluto con la escala de
                           tres zonas (cian → oscuro → rojo). En lentitud se mantiene la
                           intensidad relativa: ahí no hay un "0 ms" que signifique
                           perfecto, así que comparar contra el resto sí es lo correcto. */
                        // Con pocas pulsaciones el porcentaje no significa nada, así que la
                        // tecla no se colorea — pero el conteo sí se muestra.
                        const medible = fallada != null && fallada.totalIntentos >= MIN_PULSACIONES_MAPA;

                        const estilo = esFallos
                          ? (medible
                              ? estiloTeclaPorError(fallada!.porcentajeError)
                              : estiloTecla(TONO_ERROR, null))
                          : estiloTecla(TONO_LENTITUD,
                              lenta ? intensidad(lenta.msPromedio, minMs, maxMs) : null);

                        /* El detalle nunca dice solo "sin datos": distinguir "nunca la
                           pulsaste" de "la pulsaste 3 veces" importa, porque en el segundo
                           caso el dato existe y solo falta práctica para que valga. */
                        const detalle = esFallos
                          ? (medible
                              ? `${fallada!.porcentajeError}% de error · ${fallada!.totalIntentos} intentos`
                              : fallada
                                ? `${fallada.totalIntentos} intentos · pocos para medir`
                                : '0 intentos registrados')
                          : (lenta ? `${lenta.msPromedio} ms en promedio · ${lenta.pulsaciones} pulsaciones` : 'Sin datos de ritmo');

                        return (
                          <div key={tecla} className="group relative">
                            <div
                              className="key-cap flex items-center justify-center rounded-lg border text-xs font-bold transition-all"
                              style={estilo}>
                              {tecla}
                            </div>

                            {/* Tooltip propio en vez de `title`: el nativo tarda un segundo
                                en aparecer y no se puede estilar. */}
                            <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-carta px-3 py-1.5 text-[11px] text-white shadow-xl group-hover:block">
                              <span className="font-bold text-cian">{tecla}</span>
                              <span className="ml-2 text-gris-texto">{detalle}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div className="mt-1 h-10 w-64 rounded-lg border border-vidrio-borde bg-carta" />

                  {fueraDeGrilla.length > 0 && (
                    <div className="mt-5 w-full border-t border-vidrio-borde pt-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gris-texto">
                        Fuera del teclado mostrado
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {fueraDeGrilla.map((t) => (
                          <span key={t.tecla}
                            className="flex items-center gap-2 rounded-lg border border-vidrio-borde bg-vidrio px-2.5 py-1">
                            <span className="font-mono text-sm font-bold text-cian-suave">
                              {t.tecla === ' ' ? '␣' : t.tecla}
                            </span>
                            <span className="text-[11px] tabular-nums text-gris-texto">{t.detalle}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Tarjeta>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <PanelNgramas titulo="Peores bigramas" items={debilidades?.peoresBigramas} progreso={progreso} />
          <PanelNgramas titulo="Peores trigramas" items={debilidades?.peoresTrigramas} progreso={progreso} />
        </div>

        {progreso && progreso.graduados.length > 0 && (
          <Tarjeta className="border-cian/25">
            <div className="mb-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-3xl text-cian"
                style={{ fontVariationSettings: "'FILL' 1" }}>
                emoji_events
              </span>
              <div>
                <h3 className="text-xl font-bold text-white">¡Ya los superaste!</h3>
                <p className="text-sm text-gris-texto">
                  Estas combinaciones estaban entre tus peores errores y ahora las dominas.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {progreso.graduados.map((item) => (
                <div key={item.secuencia}
                  className="flex flex-col items-center rounded-xl border border-vidrio-borde bg-vidrio px-4 py-3">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-cian-suave">{item.secuencia}</span>
                    <span className="rounded-full bg-white/6 px-1.5 py-0.5 text-[10px] font-bold text-gris-texto">
                      {item.tipo}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold tabular-nums">
                    <span className="text-gris-texto line-through">{item.porcentajeErrorAnterior}%</span>
                    <span className="material-symbols-outlined text-[14px] text-gris-texto">arrow_forward</span>
                    <span className="text-cian">{item.porcentajeErrorActual}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Tarjeta>
        )}

        <div className="flex flex-col items-center gap-3 pt-2">
          <p className="text-center text-sm text-gris-texto">
            Genera un ejercicio con IA basado en el reporte de tus letras más falladas
          </p>
          {botonIa}
        </div>
      </div>
    );
  }

  /* ======================= APARIENCIA CLARA =======================
     El diseño original, sin tocar. Lo único que se suma es el acceso a la paleta y las
     métricas nuevas donde ya había hueco. */
  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <header className="relative mb-4">
        <h1 className="text-4xl font-bold text-slate-800 mb-2">Mis Estadísticas</h1>
        <p className="text-slate-400 text-lg">Tu historial de rendimiento y áreas de mejora.</p>
        <div className="absolute right-0 top-0">
          <SelectorApariencia />
        </div>
      </header>

      {/* Stats globales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: 'bolt', label: 'WPM Promedio', valor: stats?.wpmPromedio ?? 0, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { icon: 'target', label: 'Precisión Promedio', valor: `${stats?.precisionPromedio ?? 0}%`, color: 'text-sky-500', bg: 'bg-sky-50' },
          { icon: 'emoji_events', label: 'Sesiones', valor: stats?.sesionesCompletadas ?? 0, color: 'text-amber-500', bg: 'bg-amber-50' },
          { icon: 'schedule', label: 'Tiempo Total', valor: formatTiempo(stats?.tiempoTotalSegundos ?? 0), color: 'text-slate-500', bg: 'bg-slate-100' },
        ].map((s) => (
          <div key={s.label}
            className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-4"
            style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
            <div className={`w-12 h-12 rounded-full ${s.bg} flex items-center justify-center ${s.color}`}>
              <span className="material-symbols-outlined">{s.icon}</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
              <p className="text-2xl font-bold text-slate-800">{s.valor}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Récords y racha */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6"
        style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
        <h2 className="text-xl font-bold text-slate-800 mb-5">Récords y constancia</h2>
        {/* Mismo criterio que en la apariencia oscura: sin "Mejor precisión" ni
            "Errores totales". */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
          {[
            { label: 'Mejor WPM', valor: records?.mejorWpm ?? 0, pie: formatearFecha(records?.fechaMejorWpm ?? null) },
            { label: 'Racha actual', valor: `${records?.rachaActual ?? 0}d`, pie: 'días seguidos' },
            { label: 'Racha máxima', valor: `${records?.rachaMaxima ?? 0}d`, pie: 'tu mejor marca' },
            { label: 'Días activos', valor: records?.diasActivos ?? 0, pie: 'con al menos 1 sesión' },
          ].map((r) => (
            <div key={r.label}>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{r.label}</p>
              <p className="text-2xl font-bold text-slate-800 tabular-nums mt-1">{r.valor}</p>
              <p className="text-xs text-slate-400">{r.pie}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Progreso en el tiempo */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6"
        style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
        <div className="flex justify-between items-end mb-6 gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Progreso en el tiempo</h2>
            <p className="text-slate-400 text-sm">Promedio de tus noticias, textos con IA y ejercicios del curso.</p>
          </div>
          <div className="flex gap-1.5">
            {/* "Hoy" faltaba acá: existe en la apariencia oscura (ver más arriba) pero
                nunca se sumó a esta, y "claro" es la apariencia por defecto de la app
                (POR_DEFECTO en apariencia.ts) — cualquier usuario nuevo, antes de elegir
                un tema, no tenía forma de llegar a esta vista. */}
            {([
              { id: 'hoy', nombre: 'Hoy' },
              { id: 'dia', nombre: 'Por día' },
              { id: 'semana', nombre: 'Por semana' },
              { id: 'mes', nombre: 'Por mes' },
            ] as { id: AgrupacionProgreso; nombre: string }[]).map((o) => (
              <button
                key={o.id}
                onClick={() => setAgrupacion(o.id)}
                aria-pressed={o.id === agrupacion}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  o.id === agrupacion
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}>
                {o.nombre}
              </button>
            ))}
          </div>
        </div>

        {(serie?.puntos.length ?? 0) > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={(serie?.puntos ?? []).map((p) => ({
                etiqueta: formatearPeriodo(p.periodo, serie?.agrupacion ?? agrupacion),
                wpm: p.wpm,
                precision: Number(p.precision),
              }))}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="rellenoProgresoClaro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} />
              <YAxis yAxisId="wpm" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="precision" orientation="right" domain={[0, 100]} hide />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }}
                formatter={(value, name) => name === 'wpm'
                  ? [`${value} WPM`, 'Velocidad']
                  : [`${value}%`, 'Precisión']} />
              <Area yAxisId="wpm" type="monotone" dataKey="wpm" stroke="#10B981" strokeWidth={3}
                fill="url(#rellenoProgresoClaro)" dot={{ fill: '#10B981', r: 4 }} />
              <Line yAxisId="precision" type="monotone" dataKey="precision" stroke="#0EA5E9"
                strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-slate-400 text-sm h-40 flex items-center justify-center">
            {agrupacion === 'hoy'
              ? 'Todavía no practicaste hoy. Cada sesión aparecerá acá con su hora.'
              : 'Practica una noticia, un texto con IA o un ejercicio del curso y la curva empieza a dibujarse.'}
          </p>
        )}
      </div>

      {/* Heatmap teclado */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6"
        style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Mapa de Calor de Teclas</h2>
            <p className="text-slate-400 text-sm">Las teclas en rojo son donde más fallas.</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400 font-semibold">
            <span>Sin errores</span>
            <div className="flex h-3 w-24 rounded-full overflow-hidden">
              <div className="flex-1 bg-slate-100" />
              <div className="flex-1 bg-yellow-100" />
              <div className="flex-1 bg-rose-200" />
              <div className="flex-1 bg-rose-500" />
            </div>
            <span>Crítico</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 items-center">
          {FILAS_TECLADO.map((fila, fi) => (
            <div key={fi} className="flex gap-1.5">
              {fila.map((tecla) => (
                <div
                  key={tecla}
                  className={`key-cap flex items-center justify-center rounded-lg border text-xs font-bold transition-all
                    ${getColorHeatmap(tecla, debilidades?.peoresTeclas ?? [])}`}>
                  {tecla}
                </div>
              ))}
            </div>
          ))}
          <div className="mt-1 h-10 w-64 bg-slate-100 border border-slate-200 rounded-lg" />
        </div>
      </div>

      {/* Bigramas y Trigramas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Peores bigramas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6"
          style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
          <h3 className="text-xl font-bold text-slate-800 mb-6">Peores Bigramas</h3>
          {debilidades?.peoresBigramas && debilidades.peoresBigramas.length > 0 ? (
            <div className="space-y-5">
              {debilidades.peoresBigramas.map((item, i) => {
                const pctAcierto = 100 - item.porcentajeError;
                return (
                  <div key={item.secuencia}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-700">#{i + 1} {item.secuencia}</span>
                        <span className="text-xs text-slate-300 font-normal">{item.totalIntentos} intentos</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold">
                        <span className="text-sky-500">{pctAcierto}% acierto</span>
                        <span className="text-rose-500">{item.porcentajeError}% error</span>
                      </div>
                    </div>
                    {progreso?.mejorandoEnTop5.find(m => m.secuencia === item.secuencia) && (
                      <div className="flex items-center gap-1 text-xs font-bold text-sky-600 mb-1">
                        <span className="material-symbols-outlined text-[14px]">trending_up</span>
                        ↑ Mejorando {progreso.mejorandoEnTop5.find(m => m.secuencia === item.secuencia)?.puntosMejorados} puntos
                      </div>
                    )}
                    {/* Barra bicolor: azul = aciertos, rojo = errores */}
                    <div className="w-full h-3 rounded-full overflow-hidden flex">
                      <div className="bg-sky-400 h-full transition-all duration-500"
                        style={{ width: `${pctAcierto}%` }} />
                      <div className="bg-rose-400 h-full transition-all duration-500"
                        style={{ width: `${item.porcentajeError}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">
              Necesitas al menos 3 sesiones para ver tus bigramas débiles.
            </p>
          )}
        </div>

        {/* Peores trigramas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6"
          style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
          <h3 className="text-xl font-bold text-slate-800 mb-6">Peores Trigramas</h3>
          {debilidades?.peoresTrigramas && debilidades.peoresTrigramas.length > 0 ? (
            <div className="space-y-5">
              {debilidades.peoresTrigramas.map((item, i) => {
                const pctAcierto = 100 - item.porcentajeError;
                return (
                  <div key={item.secuencia}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-700">#{i + 1} {item.secuencia}</span>
                        <span className="text-xs text-slate-300 font-normal">{item.totalIntentos} intentos</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold">
                        <span className="text-sky-500">{pctAcierto}% acierto</span>
                        <span className="text-rose-500">{item.porcentajeError}% error</span>
                      </div>
                    </div>
                    {progreso?.mejorandoEnTop5.find(m => m.secuencia === item.secuencia) && (
                      <div className="flex items-center gap-1 text-xs font-bold text-sky-600 mb-1">
                        <span className="material-symbols-outlined text-[14px]">trending_up</span>
                        ↑ Mejorando {progreso.mejorandoEnTop5.find(m => m.secuencia === item.secuencia)?.puntosMejorados} puntos
                      </div>
                    )}
                    {/* Barra bicolor: azul = aciertos, rojo = errores */}
                    <div className="w-full h-3 rounded-full overflow-hidden flex">
                      <div className="bg-sky-400 h-full transition-all duration-500"
                        style={{ width: `${pctAcierto}%` }} />
                      <div className="bg-rose-400 h-full transition-all duration-500"
                        style={{ width: `${item.porcentajeError}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">
              Necesitas al menos 3 sesiones para ver tus trigramas débiles.
            </p>
          )}
        </div>
      </div>

      {/* Sección ¡Ya los superaste! */}
      {progreso && progreso.graduados.length > 0 && (
        <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-6"
          style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-3xl text-emerald-500"
              style={{ fontVariationSettings: "'FILL' 1" }}>
              emoji_events
            </span>
            <div>
              <h3 className="text-xl font-bold text-emerald-700">¡Ya los superaste!</h3>
              <p className="text-emerald-600 text-sm">
                Estas combinaciones estaban entre tus peores errores y ahora las dominas.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            {progreso.graduados.map((item) => (
              <div
                key={item.secuencia}
                className="bg-white/70 rounded-xl border border-emerald-200 px-4 py-3 flex flex-col items-center opacity-80 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-lg text-emerald-700">
                    {item.secuencia}
                  </span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    item.tipo === 'BIGRAMA'
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-sky-100 text-sky-600'
                  }`}>
                    {item.tipo}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-emerald-600 font-bold">
                  <span className="text-slate-400 line-through">{item.porcentajeErrorAnterior}%</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  <span>{item.porcentajeErrorActual}%</span>
                </div>
                <span className="text-xs text-emerald-500 mt-1">
                  ↑ {item.puntosMejorados} puntos
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botón IA */}
      <div className="flex justify-center pb-8">
        {botonIa}
      </div>
    </div>
  );
};

export default GlobalStatsView;
