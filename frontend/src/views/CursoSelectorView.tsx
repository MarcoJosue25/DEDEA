import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NivelCurso, CursoStatsResponse, ProgresoEjercicioResponse } from '../types';
import { obtenerStatsCursoPorNivel, obtenerProgresoCursoPorNivel } from '../api/cursoStatsApi';
import Spinner from '../components/ui/Spinner';
import Icono from '../components/ui/Icono';
import { DESBLOQUEAR_TODO_EL_CURSO } from '../core/desarrollo';
import { enConstruccion, mensajeDeBloqueo } from '../core/curso/sendero';

/* Cada nivel se presenta por lo que SE APRENDE en él, no solo por su nombre. "Básico /
   Intermedio / Avanzado" no le dice a nadie qué va a hacer adentro ni por qué empezar;
   los umbrales sí, y además fijan la meta desde el primer momento. Los números salen de
   CursoStatsServiceImpl (UMBRAL_WPM / UMBRAL_PRECISION).
   ⚠️ Están escritos en dos lugares. Si se recalibran allá, hay que traerlos acá. */
const NIVELES: {
  id: NivelCurso; nombre: string; icono: string; resumen: string;
  metaWpm: number; metaPrecision: number;
}[] = [
  {
    id: 'BASICO', nombre: 'Básico', icono: 'keyboard',
    resumen: 'Las tres filas del teclado, dedo por dedo, sin mirar.',
    metaWpm: 18, metaPrecision: 90,
  },
  {
    id: 'INTERMEDIO', nombre: 'Intermedio', icono: 'speed',
    resumen: 'Palabras reales, mayúsculas, tildes y signos de puntuación.',
    metaWpm: 32, metaPrecision: 92,
  },
  {
    id: 'AVANZADO', nombre: 'Avanzado', icono: 'military_tech',
    resumen: 'Números, símbolos, textos largos y velocidad bajo presión.',
    metaWpm: 45, metaPrecision: 94,
  },
];

interface DatosNivel {
  stats: CursoStatsResponse | null;
  progreso: ProgresoEjercicioResponse[];
}

const CursoSelectorView = () => {
  const navigate = useNavigate();
  const [datos, setDatos] = useState<Record<NivelCurso, DatosNivel>>({
    BASICO: { stats: null, progreso: [] },
    INTERMEDIO: { stats: null, progreso: [] },
    AVANZADO: { stats: null, progreso: [] },
  });
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    /* Se pide también el progreso de cada nivel, no solo las stats: sin él la tarjeta no
       puede decir "12 de 29" ni cuántas estrellas llevas, que es lo que convierte el
       selector en un tablero de avance y no en tres botones. Son 6 peticiones en paralelo
       contra 3; a cambio, la pantalla deja de mentir por omisión. */
    Promise.all(NIVELES.map((n) => Promise.all([
      obtenerStatsCursoPorNivel(n.id).catch(() => null),
      obtenerProgresoCursoPorNivel(n.id).catch(() => [] as ProgresoEjercicioResponse[]),
    ])))
      .then((resultados) => {
        setDatos({
          BASICO: { stats: resultados[0][0], progreso: resultados[0][1] },
          INTERMEDIO: { stats: resultados[1][0], progreso: resultados[1][1] },
          AVANZADO: { stats: resultados[2][0], progreso: resultados[2][1] },
        });
      })
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <Spinner texto="Cargando niveles..." />;

  // Totales de los tres niveles, para la cinta de arriba.
  const todos = NIVELES.flatMap((n) => datos[n.id].progreso);
  const totalCompletados = todos.filter((p) => p.completado).length;
  const totalEstrellas = todos.reduce((s, p) => s + (p.estrellas ?? 0), 0);
  const nivelesAprobados = NIVELES.filter((n) => datos[n.id].stats?.aprobado).length;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="mb-2 text-4xl font-bold text-white">Curso</h1>
        <p className="text-lg text-gris-texto">
          Tres niveles, en orden. Cada ejercicio se desbloquea al superar el anterior.
        </p>
      </header>

      {/* Resumen del recorrido completo. Antes no existía: se veían tres tarjetas sueltas
          y no había ningún lugar donde el curso se viera como UNA cosa con un final. */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { valor: `${totalCompletados}/${todos.length}`, etiqueta: 'ejercicios', icono: 'check_circle', color: 'var(--color-cian)' },
          { valor: String(totalEstrellas), etiqueta: 'estrellas', icono: 'star', color: 'var(--color-oro)' },
          { valor: `${nivelesAprobados}/3`, etiqueta: 'niveles', icono: 'trophy', color: 'var(--color-oro)' },
        ].map((c) => (
          <div key={c.etiqueta}
            className="flex items-center gap-3 rounded-xl border border-vidrio-borde bg-vidrio px-4 py-3">
            <Icono nombre={c.icono} tamano={20} relleno style={{ color: c.color }} />
            <div className="min-w-0">
              <p className="text-lg font-bold leading-none tabular-nums text-white">{c.valor}</p>
              <p className="text-[11px] text-gris-texto">{c.etiqueta}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {NIVELES.map((n) => {
          const { stats, progreso } = datos[n.id];
          /* DESARROLLO: con el interruptor puesto los tres niveles se abren. `aprobado`
             NO se toca — es el estado real y sigue pintando la tarjeta como corresponde.
             Un nivel en construcción queda cerrado aunque el backend lo haya desbloqueado. */
          const desbloqueado = DESBLOQUEAR_TODO_EL_CURSO
            || (!enConstruccion(n.id) && Boolean(stats?.desbloqueado));
          const aprobado = Boolean(stats?.aprobado);
          const hechos = progreso.filter((p) => p.completado).length;
          const pct = progreso.length > 0 ? (hechos / progreso.length) * 100 : 0;
          const estrellas = progreso.reduce((s, p) => s + (p.estrellas ?? 0), 0);
          const empezado = hechos > 0;

          return (
            <button
              key={n.id}
              disabled={!desbloqueado}
              onClick={() => navigate(`/curso/${n.id.toLowerCase()}`)}
              className={`group relative overflow-hidden rounded-2xl border p-6 text-left backdrop-blur-sm transition-all active:scale-[0.99] ${
                desbloqueado
                  ? 'border-vidrio-borde bg-vidrio hover:-translate-y-0.5 hover:border-cian/40 hover:bg-vidrio-alto'
                  : 'cursor-not-allowed border-white/5 bg-vidrio/40 opacity-60'
              }`}
              style={aprobado ? { borderColor: 'rgba(255,197,61,0.35)' } : undefined}>

              <div className="flex items-start gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${
                  aprobado ? 'bg-oro/20' : desbloqueado ? 'bg-cian/10' : 'bg-white/5'
                }`}
                  style={{
                    background: aprobado ? 'rgba(255,197,61,0.15)' : undefined,
                    color: aprobado ? 'var(--color-oro)' : desbloqueado ? 'var(--color-cian)' : 'rgba(176,179,181,0.5)',
                  }}>
                  <Icono nombre={desbloqueado ? n.icono : 'lock'} tamano={26} relleno={aprobado} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-white">{n.nombre}</p>
                    {aprobado && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: 'rgba(255,197,61,0.15)', color: 'var(--color-oro)' }}>
                        Aprobado
                      </span>
                    )}
                  </div>

                  <p className="mt-0.5 text-sm text-gris-texto">
                    {desbloqueado ? n.resumen : mensajeDeBloqueo(n.id)}
                  </p>

                  {desbloqueado && (
                    <>
                      {/* La meta del nivel, siempre visible. Antes solo se veía el promedio,
                          que no dice contra qué se compara: 24 WPM puede ser mucho o poco
                          según el nivel, y el usuario no tenía cómo saberlo. */}
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-gris-texto/70">
                        Meta para aprobar: {n.metaWpm} WPM · {n.metaPrecision}% de precisión
                      </p>

                      <div className="mt-3 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                          <div className="h-full rounded-full bg-cian transition-[width] duration-700"
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className="shrink-0 text-[11px] font-bold tabular-nums text-white">
                          {hechos}/{progreso.length}
                        </span>
                        {estrellas > 0 && (
                          <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold tabular-nums"
                            style={{ color: 'var(--color-oro)' }}>
                            <Icono nombre="star" tamano={13} relleno />
                            {estrellas}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {desbloqueado && (
                  <span className="shrink-0 self-center text-gris-texto/50 transition-colors group-hover:text-cian">
                    <Icono nombre="chevron_right" tamano={24} />
                  </span>
                )}
              </div>

              {/* El rótulo de acción. Que la tarjeta diga "Empezar" o "Continuar" en vez de
                  solo una flecha es lo que la convierte en una invitación concreta. */}
              {desbloqueado && (
                <span className="pointer-events-none absolute bottom-0 right-0 rounded-tl-xl px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background: 'rgba(0,241,253,0.10)',
                    color: 'var(--color-cian)',
                  }}>
                  {aprobado ? 'Practicar libre' : empezado ? 'Continuar' : 'Empezar'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CursoSelectorView;
