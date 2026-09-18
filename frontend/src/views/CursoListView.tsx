import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listarEjercicios } from '../api/ejercicioApi';
import type { EjercicioDTO } from '../types';
import Spinner from '../components/ui/Spinner';

const ICONO_POR_TIPO: Record<string, string> = {
  LETRAS_BASICO: 'keyboard',
  PALABRAS_SIMPLES: 'text_fields',
  TOP_100_PALABRAS: 'star',
  ORACIONES_SIMPLES: 'short_text',
  ORACIONES_MAYUSCULAS: 'text_increase',
  SUDDEN_DEATH: 'skull',
  PALABRAS_CONFUSAS: 'help',
  MODO_CIEGO: 'visibility_off',
  DICTADO_VOZ: 'mic',
  SIMBOLOS_CRITICOS: 'code',
  CONTRARRELOJ: 'timer',
  PALABRAS_MUTANTES: 'auto_awesome_motion',
  // MODO_SOMBRA ya no está: la sombra es un modificador de cualquier ejercicio, no una
  // fila del catálogo. Su icono vive ahora en el botón de sombra de CursoPracticaView.
  MODO_UNA_MANO: 'back_hand',
  UN_DEDO: 'touch_app',
  UNA_MANO_FORZADA: 'front_hand',
  SHIFT_LATERAL: 'keyboard_capslock',
  RESISTENCIA: 'timeline',
  LLUVIA_LETRAS: 'grain',
  PALABRAS_DE_FILA: 'view_column',
  ORACIONES_TEMATICAS: 'topic',
  REPASO_FALLADAS: 'refresh',
};

const CursoListView = () => {
  const navigate = useNavigate();
  const [ejercicios, setEjercicios] = useState<EjercicioDTO[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    listarEjercicios()
      .then(setEjercicios)
      .catch(() => setEjercicios([]))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <Spinner texto="Cargando ejercicios..." />;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="mb-2 text-4xl font-bold text-white">Ejercicios Base</h1>
        <p className="text-lg text-gris-texto">El catálogo completo de mecánica, suelto — la base del futuro Curso por niveles.</p>
      </header>

      {ejercicios.length === 0 ? (
        <div className="rounded-2xl border border-medio/30 bg-medio/10 p-6 text-center">
          <span className="material-symbols-outlined mb-2 block text-4xl text-medio">info</span>
          <p className="font-semibold text-white">Todavía no hay ejercicios publicados.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {ejercicios.map((ej) => (
            <button
              key={ej.id}
              onClick={() => navigate(`/ejercicios-base/${ej.id}`)}
              /* Superficie de vidrio: deja pasar el degradado en vez de taparlo con un
                 bloque opaco. Con una lista larga, tarjetas oscuras sólidas apagaban
                 toda la pantalla. */
              className="group flex items-center gap-4 rounded-2xl border border-vidrio-borde bg-vidrio p-5 text-left backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-cian/40 hover:bg-vidrio-alto active:scale-[0.99]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cian/10 text-cian">
                <span className="material-symbols-outlined">{ICONO_POR_TIPO[ej.tipo] ?? 'school'}</span>
              </div>
              <div className="flex-1">
                <p className="font-bold text-white">{ej.titulo}</p>
                <p className="text-sm text-gris-texto">{ej.descripcion}</p>
              </div>
              <span className="material-symbols-outlined text-gris-texto/50 transition-colors group-hover:text-cian">
                chevron_right
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CursoListView;
