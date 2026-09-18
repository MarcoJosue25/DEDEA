import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { NivelCurso, CursoStatsResponse, ProgresoEjercicioResponse } from '../types';
import { obtenerStatsCursoPorNivel, obtenerProgresoCursoPorNivel } from '../api/cursoStatsApi';
import Spinner from '../components/ui/Spinner';
import Icono from '../components/ui/Icono';
import NodoSendero from "../components/curso/NodoSendero";
import BloqueoTestFinal from '../components/curso/BloqueoTestFinal';
import { offsetSerpiente } from "../components/curso/geometriaSendero";
import { DESBLOQUEAR_TODO_EL_CURSO } from '../core/desarrollo';
import { useApariencia } from '../core/apariencia/useApariencia';
import { llegoAlTestFinal } from '../core/curso/sendero';

const NOMBRE_NIVEL: Record<NivelCurso, string> = {
  BASICO: 'Básico',
  INTERMEDIO: 'Intermedio',
  AVANZADO: 'Avanzado',
};

const NIVELES_VALIDOS: NivelCurso[] = ['BASICO', 'INTERMEDIO', 'AVANZADO'];

/* Nombre de cada bloque. Los de Básico son ESTRUCTURALES (una fila del teclado cada uno)
   y no pueden desincronizarse del contenido. Los de Intermedio y Avanzado describen lo
   que hay sembrado hoy, así que son la clase de rótulo que puede quedar mintiendo: si un
   bloque cambia de contenido, hay que cambiar el nombre acá también.
   Cualquier clave que falte cae en "Bloque N", que nunca miente. */
const NOMBRE_BLOQUE: Record<string, string> = {
  'BASICO-1': 'La fila central',
  'BASICO-2': 'La fila superior',
  'BASICO-3': 'La fila inferior',
  'BASICO-4': 'Números y cierre del nivel',
  'INTERMEDIO-1': 'Palabras, signos y ritmo',
  'INTERMEDIO-2': 'Un dedo por vez',
  'INTERMEDIO-3': 'Textos y desafíos',
  'AVANZADO-1': 'Números, símbolos y presión',
  'AVANZADO-2': 'Precisión bajo carga',
  'AVANZADO-3': 'Maratón final',
};

const CursoNivelView = () => {
  const { nivel: nivelParam } = useParams();
  const navigate = useNavigate();
  const nivel = (nivelParam?.toUpperCase() ?? '') as NivelCurso;
  const nivelValido = NIVELES_VALIDOS.includes(nivel);

  const { apariencia } = useApariencia();
  const [stats, setStats] = useState<CursoStatsResponse | null>(null);
  const [progreso, setProgreso] = useState<ProgresoEjercicioResponse[]>([]);
  // La ventana del Test Final cerrado, al tocar su nodo.
  const [verBloqueo, setVerBloqueo] = useState(false);
  // Arranca en el valor correcto según si hay algo que cargar — evita tener que
  // pisarlo de nuevo dentro del efecto (setState síncrono en el cuerpo del efecto).
  const [cargando, setCargando] = useState(nivelValido);

  useEffect(() => {
    if (!nivelValido) return;
    Promise.all([obtenerStatsCursoPorNivel(nivel), obtenerProgresoCursoPorNivel(nivel)])
      .then(([s, p]) => { setStats(s); setProgreso(p); })
      .catch(() => { setStats(null); setProgreso([]); })
      .finally(() => setCargando(false));
  }, [nivel, nivelValido]);

  /* El nodo "actual" es el primer no-completado en orden. Si el nivel ya está aprobado
     (por ejemplo, se saltó con el Test de Nivel), no hay progreso ejercicio-por-ejercicio
     que respetar: todos quedan desbloqueados para practicar libre. */
  const indiceActual = useMemo(() => {
    if (stats?.aprobado) return progreso.length; // ninguno bloqueado
    return progreso.findIndex((p) => !p.completado);
  }, [progreso, stats]);

  // Agrupa por bloque, preservando el orden ya ordenado que trae el backend.
  const bloques = useMemo(() => {
    const mapa = new Map<number, { item: ProgresoEjercicioResponse; indiceGlobal: number }[]>();
    progreso.forEach((item, indiceGlobal) => {
      const clave = item.bloque ?? 0;
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push({ item, indiceGlobal });
    });
    return Array.from(mapa.entries()).sort((a, b) => a[0] - b[0]);
  }, [progreso]);

  const completados = progreso.filter((p) => p.completado).length;
  const pct = progreso.length > 0 ? (completados / progreso.length) * 100 : 0;
  /* Estrellas conseguidas sobre el máximo posible. Es la métrica que convierte "29 de 29
     completados" en algo con recorrido: se puede terminar el nivel entero con una
     estrella por nodo y todavía tener 58 por ganar. Los nodos completados antes de que
     existiera la columna suman 0 y no rompen la cuenta. */
  const estrellasGanadas = progreso.reduce((suma, p) => suma + (p.estrellas ?? 0), 0);
  const estrellasPosibles = progreso.length * 3;

  /* Ir directo al nodo actual. Sin esto, retomar el curso en el nodo 22 obliga a bajar
     por veintiún nodos ya hechos hasta encontrar dónde ibas. */
  const nodoActual = indiceActual >= 0 && indiceActual < progreso.length
    ? progreso[indiceActual] : null;

  /* Los ejercicios que el Test Final va a pedir levantar (menos de 2 estrellas; la Lluvia
     nunca). La regla es del backend; aquí solo se cuentan. Es el aviso que faltaba: el
     examen ya los exigía y ninguna pantalla lo decía.

     Pero solo se habla de ellos al LLEGAR al examen, con todo lo demás hecho (ver
     llegoAlTestFinal). Antes, los nodos de una estrella ya se ven en amarillo. */
  const pendientes = progreso.filter((p) => p.porMejorar);
  const alTestFinal = llegoAlTestFinal(progreso);
  const irAlPrimerPendiente = () => {
    if (pendientes.length > 0) navigate(`/curso/${nivelParam}/${pendientes[0].ejercicioId}`);
  };
  // Si lo que toca es el Test Final y está cerrado, "Continuar" lleva al primero sin estrellas.
  const continuarAPendiente = nodoActual?.rolEnNivel === 'TEST_FINAL' && pendientes.length > 0;
  const testFinal = progreso.find((p) => p.rolEnNivel === 'TEST_FINAL') ?? null;

  const refActual = useRef<HTMLDivElement>(null);
  const [yaSeDesplazo, setYaSeDesplazo] = useState(false);
  useEffect(() => {
    /* Un solo desplazamiento automático, al cargar. Se guarda que ya ocurrió porque el
       efecto vuelve a correr al llegar los datos y sin la marca la pantalla saltaría de
       nuevo si el usuario ya había desplazado a mano. */
    if (yaSeDesplazo || !refActual.current) return;
    refActual.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setYaSeDesplazo(true);
  }, [yaSeDesplazo, progreso.length]);

  if (!nivelValido) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <p className="text-lg text-gris-texto">Nivel no reconocido.</p>
        <button onClick={() => navigate('/curso')} className="mt-4 text-cian underline">
          Volver a los niveles
        </button>
      </div>
    );
  }

  if (cargando) return <Spinner texto="Cargando el sendero..." />;

  /* DESARROLLO: el interruptor saltea la pantalla de "nivel bloqueado". Se deja el
     bloque entero en pie —no se borra— porque es lo que ve el usuario real y hay que
     poder volver a él poniendo el interruptor en false. */
  if (!DESBLOQUEAR_TODO_EL_CURSO && !stats?.desbloqueado) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
        <span className="material-symbols-outlined text-5xl text-gris-texto/50">lock</span>
        <h1 className="text-2xl font-bold text-white">{NOMBRE_NIVEL[nivel]} todavía está bloqueado</h1>
        <p className="text-gris-texto">Aprueba el nivel anterior para desbloquear este.</p>
        <button onClick={() => navigate('/curso')}
          className="mt-2 rounded-full border border-vidrio-borde bg-vidrio px-5 py-2.5 text-sm font-semibold text-white hover:border-cian/40">
          Volver a los niveles
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">

      {/* ===== Cabecera del nivel ===== */}
      <header className="rounded-2xl border border-vidrio-borde bg-vidrio p-6 backdrop-blur-sm">
        <button onClick={() => navigate('/curso')}
          className="mb-3 flex items-center gap-1 text-xs font-semibold text-gris-texto hover:text-cian">
          <Icono nombre="arrow_back" tamano={16} />
          Niveles
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">{NOMBRE_NIVEL[nivel]}</h1>
              {stats?.aprobado && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: 'rgba(255,197,61,0.15)', color: 'var(--color-oro)' }}>
                  <Icono nombre="trophy" tamano={14} relleno />
                  Aprobado
                </span>
              )}
            </div>

            {/* Una sola estrella y el total, no tres estrellas parciales: tres estrellas
                al lado de "0 de 87" se leen como una calificación sobre 3 y contradicen
                el número que tienen justo al lado. */}
            <div className="mt-2 flex items-center gap-1.5">
              <Icono nombre="star" tamano={18} relleno style={{ color: 'var(--color-oro)' }} />
              <span className="text-sm font-bold tabular-nums text-white">
                {estrellasGanadas}
                <span className="font-semibold text-gris-texto"> / {estrellasPosibles}</span>
              </span>
              <span className="text-xs text-gris-texto">estrellas</span>
            </div>
          </div>

          {/* Aro de avance: el mismo dato del contador viejo, pero legible de un vistazo. */}
          <div className="relative shrink-0" style={{ width: 76, height: 76 }}>
            <svg width="76" height="76" className="-rotate-90">
              <circle cx="38" cy="38" r="33" fill="none" strokeWidth="6" className="stroke-white/8" />
              <circle
                cx="38" cy="38" r="33" fill="none" strokeWidth="6" strokeLinecap="round"
                className="stroke-cian transition-[stroke-dashoffset] duration-700"
                strokeDasharray={2 * Math.PI * 33}
                strokeDashoffset={2 * Math.PI * 33 * (1 - pct / 100)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold leading-none tabular-nums text-white">{completados}</span>
              <span className="text-[10px] leading-tight text-gris-texto">de {progreso.length}</span>
            </div>
          </div>
        </div>

        {/* Cuántos le faltan para el examen, al llegar a él. Amarillo como sus nodos, y con
            su propio atajo. */}
        {alTestFinal && pendientes.length > 0 && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border px-4 py-2.5"
            style={{ borderColor: 'rgba(255,197,61,0.35)', background: 'rgba(255,197,61,0.07)' }}>
            <Icono nombre="star_half" tamano={20} style={{ color: 'var(--color-oro)' }} />
            <p className="min-w-0 flex-1 text-sm text-white">
              {pendientes.length === 1
                ? 'Te falta 1 ejercicio con 2 estrellas para el Test Final.'
                : `Te faltan ${pendientes.length} ejercicios con 2 estrellas para el Test Final.`}
            </p>
            {!continuarAPendiente && (
              <button onClick={irAlPrimerPendiente}
                className="shrink-0 text-xs font-bold text-oro underline-offset-4 hover:underline">
                Completarlos
              </button>
            )}
          </div>
        )}

        {nodoActual && (
          <button
            onClick={() => (continuarAPendiente
              ? irAlPrimerPendiente()
              : navigate(`/curso/${nivelParam}/${nodoActual.ejercicioId}`))}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-cian px-5 py-3 text-sm font-bold text-ground transition-all hover:brightness-110 active:scale-[0.99]">
            <Icono nombre="play_arrow" tamano={18} />
            {continuarAPendiente ? 'Completar estrellas' : completados === 0 ? 'Empezar el nivel' : 'Continuar'}
            <span className="truncate font-semibold opacity-70">
              · {continuarAPendiente ? pendientes[0].titulo : nodoActual.titulo}
            </span>
          </button>
        )}
      </header>

      {verBloqueo && pendientes.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setVerBloqueo(false)}>
          {/* El clic dentro de la ventana no la cierra: solo el del fondo. */}
          <div onClick={(e) => e.stopPropagation()} className="flex w-full justify-center">
            <BloqueoTestFinal
              pendientes={pendientes}
              esOscuro={apariencia === 'oscuro'}
              onCompletar={irAlPrimerPendiente}
              onVolver={() => setVerBloqueo(false)}
              textoVolver="Cerrar"
              onEntrarIgual={DESBLOQUEAR_TODO_EL_CURSO && testFinal
                ? () => navigate(`/curso/${nivelParam}/${testFinal.ejercicioId}`, { state: { entrarIgual: true } })
                : undefined}
            />
          </div>
        </div>
      )}

      {/* ===== El sendero ===== */}
      {bloques.map(([numeroBloque, items]) => {
        const hechosDelBloque = items.filter(({ item }) => item.completado).length;
        const nombre = NOMBRE_BLOQUE[`${nivel}-${numeroBloque}`] ?? `Bloque ${numeroBloque}`;
        const bloqueCompleto = hechosDelBloque === items.length && items.length > 0;

        return (
          <div key={numeroBloque} className="flex flex-col items-center py-2">

            {/* Cabecera de bloque. Antes era un círculo con "B1" adentro y nada más: no
                decía de qué trataba el tramo ni cuánto quedaba. */}
            <div className="mb-4 w-full rounded-xl border border-vidrio-borde bg-vidrio/60 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  bloqueCompleto ? 'border-cian bg-cian text-ground' : 'border-cian/40 bg-carta text-cian'
                }`}>
                  {bloqueCompleto ? (
                    <Icono nombre="check" tamano={18} />
                  ) : numeroBloque}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{nombre}</p>
                  <p className="text-[11px] tabular-nums text-gris-texto">
                    {hechosDelBloque} de {items.length} ejercicios
                  </p>
                </div>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full bg-cian transition-[width] duration-700"
                  style={{ width: `${items.length ? (hechosDelBloque / items.length) * 100 : 0}%` }} />
              </div>
            </div>

            {items.map(({ item, indiceGlobal }, posEnBloque) => {
              const completado = item.completado;
              /* DESARROLLO: con el interruptor puesto no se bloquea ningún nodo. El resto
                 del cálculo queda intacto: `esActual` sigue marcando dónde vas de verdad. */
              const bloqueado = !DESBLOQUEAR_TODO_EL_CURSO
                && !completado && indiceGlobal > indiceActual;
              const esActual = !completado && indiceGlobal === indiceActual;
              /* El Test Final cerrado por estrellas: solo al llegar a él, que ya implica que el
                 orden normal no lo bloquea. Aunque ya se haya dado: la práctica tampoco deja
                 repetirlo mientras falten estrellas, y el sendero tiene que decir lo mismo que
                 esa pantalla. */
              const cerrado = item.rolEnNivel === 'TEST_FINAL' && alTestFinal && pendientes.length > 0;

              /* El primer nodo de cada bloque no lleva tramo de camino: el bloque anterior
                 termina en su cabecera, y una línea que la cruzara uniría dos tramos que
                 la pantalla acaba de separar a propósito. */
              const offsetAnterior = posEnBloque === 0 ? null : offsetSerpiente(indiceGlobal - 1);

              return (
                <div key={item.ejercicioId} ref={esActual ? refActual : undefined} className="w-full">
                  <NodoSendero
                    item={item}
                    indice={indiceGlobal}
                    completado={completado}
                    esActual={esActual}
                    bloqueado={bloqueado}
                    offsetAnterior={offsetAnterior}
                    cerradoPorEstrellas={cerrado}
                    faltan={pendientes.length}
                    onEntrar={() => (cerrado
                      ? setVerBloqueo(true)
                      : navigate(`/curso/${nivelParam}/${item.ejercicioId}`))}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default CursoNivelView;
