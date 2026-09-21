import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NivelCurso, CursoStatsResponse, ProgresoEjercicioResponse } from '../types';
import { obtenerStatsCursoPorNivel, obtenerProgresoCursoPorNivel } from '../api/cursoStatsApi';
import Spinner from '../components/ui/Spinner';
import Icono from '../components/ui/Icono';
import ConfirmarPruebaDeNivel from '../components/curso/ConfirmarPruebaDeNivel';
import { DESBLOQUEAR_TODO_EL_CURSO } from '../core/desarrollo';
import { enConstruccion, mensajeDeBloqueo } from '../core/curso/sendero';

/* Cada nivel se presenta por lo que SE APRENDE en él, no solo por su nombre. "Básico /
   Intermedio / Avanzado" no le dice a nadie qué va a hacer adentro ni por qué empezar;
   la meta para aprobar sí. Esa meta ya no se escribe acá: llega en las estadísticas de
   cada nivel (metaWpm / metaPrecision), que salen de los mismos umbrales que aprueban el
   nivel en el backend. */
const NIVELES: { id: NivelCurso; nombre: string; icono: string; resumen: string }[] = [
  {
    id: 'BASICO', nombre: 'Básico', icono: 'keyboard',
    resumen: 'Las tres filas del teclado, dedo por dedo, sin mirar.',
  },
  {
    id: 'INTERMEDIO', nombre: 'Intermedio', icono: 'speed',
    resumen: 'Palabras reales, mayúsculas, tildes y signos de puntuación.',
  },
  {
    id: 'AVANZADO', nombre: 'Avanzado', icono: 'military_tech',
    resumen: 'Números, símbolos, textos largos y velocidad bajo presión.',
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
  // La Prueba de nivel para la que se pide confirmación antes de saltar — null = cerrada.
  const [confirmarPrueba, setConfirmarPrueba] = useState<{
    nivel: NivelCurso; ejercicioId: number; stats: CursoStatsResponse;
  } | null>(null);

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
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
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

      {/* LOS TRES NIVELES, UNO AL LADO DEL OTRO — pedido del usuario, 20-sep-2026, con la
          captura de referencia: no una franja ancha por nivel (eso fue el primer intento
          y no era lo que pedía), sino tres tarjetas compactas en columna, lado a lado. El
          contenedor de cada una pasa de <button> a <div role="button"> porque ahora vive
          un <button> de verdad adentro (Hacer la prueba) y un botón dentro de otro botón
          es HTML inválido — el navegador lo "arregla" sacándolo afuera, y el clic deja de
          hacer lo que el layout promete. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          /* La Prueba de nivel, igual que en CursoNivelView: solo mientras el nivel no
             esté aprobado. Hoy solo Básico trae una (Intermedio no lleva, decisión del
             usuario del 18-sep-2026, ver CLAUDE.md 6.5) — el botón se apaga solo cuando
             un nivel no tiene, sin ningún caso especial por nombre. */
          const tienePrueba = desbloqueado && !aprobado && stats?.pruebaNivelId != null;

          return (
            <div
              key={n.id}
              role="button"
              tabIndex={desbloqueado ? 0 : -1}
              aria-disabled={!desbloqueado}
              onClick={() => desbloqueado && navigate(`/curso/${n.id.toLowerCase()}`)}
              onKeyDown={(e) => {
                if (desbloqueado && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  navigate(`/curso/${n.id.toLowerCase()}`);
                }
              }}
              className={`flex flex-col gap-3 rounded-2xl border p-5 text-left outline-none transition-all ${
                desbloqueado
                  ? 'cursor-pointer border-vidrio-borde bg-vidrio hover:-translate-y-0.5 hover:border-cian/40 hover:bg-vidrio-alto'
                  : 'cursor-not-allowed border-white/5 bg-vidrio/40 opacity-60'
              }`}
              style={aprobado ? { borderColor: 'rgba(255,197,61,0.35)' } : undefined}>

              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                  aprobado ? 'bg-oro/20' : desbloqueado ? 'bg-cian/10' : 'bg-white/5'
                }`}
                  style={{
                    background: aprobado ? 'rgba(255,197,61,0.15)' : undefined,
                    color: aprobado ? 'var(--color-oro)' : desbloqueado ? 'var(--color-cian)' : 'rgba(176,179,181,0.5)',
                  }}>
                  <Icono nombre={desbloqueado ? n.icono : 'lock'} tamano={22} relleno={aprobado} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-bold text-white">{n.nombre}</p>
                    {aprobado && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: 'rgba(255,197,61,0.15)', color: 'var(--color-oro)' }}>
                        Aprobado
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-sm text-gris-texto">
                {desbloqueado ? n.resumen : mensajeDeBloqueo(n.id)}
              </p>

              {desbloqueado && (
                <>
                  {/* La meta del nivel, siempre visible. Antes solo se veía el promedio,
                      que no dice contra qué se compara: 24 WPM puede ser mucho o poco
                      según el nivel, y el usuario no tenía cómo saberlo. */}
                  {stats?.metaWpm != null && (
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gris-texto/70">
                      Meta: {stats.metaWpm} WPM · {stats.metaPrecision}% de precisión
                    </p>
                  )}

                  <div className="flex items-center gap-2">
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

                  {/* Las acciones, siempre abajo. "Hacer test" es un atajo que salta el
                      nivel, así que pide confirmación antes de navegar (pedido del
                      usuario) — nunca actúa solo con el clic. */}
                  <div className="mt-1 flex flex-col gap-2">
                    {tienePrueba && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmarPrueba({ nivel: n.id, ejercicioId: stats!.pruebaNivelId!, stats: stats! });
                        }}
                        title="¿Ya tienes los fundamentos? Este atajo salta el nivel entero."
                        className="w-full rounded-full border py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors hover:bg-oro/10"
                        style={{ borderColor: 'rgba(255,197,61,0.5)', color: 'var(--color-oro)' }}>
                        Hacer test
                      </button>
                    )}
                    <span className="w-full rounded-full py-1.5 text-center text-[11px] font-bold uppercase tracking-wider"
                      style={{ background: 'rgba(0,241,253,0.10)', color: 'var(--color-cian)' }}>
                      {aprobado ? 'Practicar libre' : empezado ? 'Continuar' : 'Empezar'}
                    </span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {confirmarPrueba && (
        <ConfirmarPruebaDeNivel
          nombreNivel={NIVELES.find((n) => n.id === confirmarPrueba.nivel)!.nombre}
          nombreSiguiente={NIVELES[NIVELES.findIndex((n) => n.id === confirmarPrueba.nivel) + 1]?.nombre}
          precision={confirmarPrueba.stats.pruebaNivelPrecision!}
          wpm={confirmarPrueba.stats.pruebaNivelWpm!}
          esOscuro
          onHacerla={() => navigate(`/curso/${confirmarPrueba.nivel.toLowerCase()}/${confirmarPrueba.ejercicioId}`)}
          onCancelar={() => setConfirmarPrueba(null)}
        />
      )}
    </div>
  );
};

export default CursoSelectorView;
