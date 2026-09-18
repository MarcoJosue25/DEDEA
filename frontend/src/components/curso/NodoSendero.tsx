import type { CSSProperties } from 'react';
import type { ProgresoEjercicioResponse } from '../../types';
import Icono from '../ui/Icono';
import Estrellas from './Estrellas';
import { ALTO_FILA, ANCHO_CARRIL, offsetSerpiente } from './geometriaSendero';

/* Icono por mecánica. Es el mismo mapa que ya usa CursoListView para el catálogo plano:
   se duplica a propósito en vez de importarlo desde una vista, porque una vista no es
   lugar del que otra deba depender. Si algún día se agrega un TipoEjercicio hay que
   tocar los dos — está anotado en el checklist de CLAUDE.md 6.8. */
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

interface Props {
  item: ProgresoEjercicioResponse;
  indice: number;
  completado: boolean;
  esActual: boolean;
  bloqueado: boolean;
  // Offset del nodo anterior, para dibujar el tramo de camino que llega hasta este.
  offsetAnterior: number | null;
  onEntrar: () => void;
  /* El Test Final cerrado porque a algún ejercicio le faltan sus 2 estrellas, y cuántos son.
     No es `bloqueado`: se puede tocar —abre la ventana que explica qué falta y lleva al
     primero—, así que el botón no se deshabilita. */
  cerradoPorEstrellas?: boolean;
  faltan?: number;
}

const NodoSendero = ({
  item, indice, completado, esActual, bloqueado, offsetAnterior, onEntrar,
  cerradoPorEstrellas = false, faltan = 0,
}: Props) => {
  const offset = offsetSerpiente(indice);
  const esTest = item.rolEnNivel === 'TEST_NIVEL' || item.rolEnNivel === 'TEST_FINAL';
  /* Completado pero sin sus 2 estrellas: en amarillo, igual que su guion en la barra de
     Resultados. Es lo que el Test Final va a pedir, y el sendero es donde se busca. Fue rojo
     y resaltaba demasiado para un ejercicio que está aprobado (ver colorPorMejorar). */
  const porMejorar = completado && item.porMejorar === true;

  /* Los dos nodos de control se ven distintos porque hacen algo distinto: aprueban un
     nivel entero. Antes eran un círculo idéntico a los demás, así que llegar al Test
     Final no se notaba hasta después de hacerlo. */
  const diametro = esTest ? 68 : esActual ? 62 : 50;

  const icono = esTest
    ? (item.rolEnNivel === 'TEST_NIVEL' ? 'bolt' : 'trophy')
    : (ICONO_POR_TIPO[item.tipo ?? ''] ?? 'keyboard');

  /* El aro del círculo. Completado = relleno cian; actual = contorno cian con halo;
     test sin hacer = contorno dorado, que es lo que lo señala a la distancia. */
  const clasesCirculo = porMejorar
    ? 'border-oro bg-carta text-oro shadow-[0_0_0_5px_rgba(255,197,61,0.12)]'
    : completado
    ? 'border-cian bg-cian text-ground'
    : esActual
      ? 'border-cian bg-carta text-cian shadow-[0_0_0_8px_rgba(0,241,253,0.13)]'
      : bloqueado
        ? 'cursor-not-allowed border-white/8 bg-carta text-gris-texto/40'
        : esTest
          ? 'bg-carta'
          : 'border-cian/35 bg-carta text-cian hover:border-cian';

  const estiloCirculo: CSSProperties = {
    width: diametro,
    height: diametro,
    transform: `translateX(${offset}px)`,
  };
  if (esTest && !completado && !bloqueado) {
    estiloCirculo.borderColor = cerradoPorEstrellas ? 'rgba(255,197,61,0.45)' : 'var(--color-oro)';
    estiloCirculo.color = cerradoPorEstrellas ? 'rgba(255,197,61,0.6)' : 'var(--color-oro)';
  }

  return (
    <div className="relative flex w-full items-center gap-4" style={{ height: ALTO_FILA }}>
      <div className="relative flex shrink-0 items-center justify-center"
        style={{ width: ANCHO_CARRIL, height: ALTO_FILA }}>

        {/* El camino. Va de centro a centro del nodo anterior, y por eso el SVG arranca
            media fila más arriba (-ALTO_FILA/2) y mide una fila entera.
            Se pinta cian hasta donde llegaste y apagado más adelante: el color del tramo
            es, literalmente, cuánto camino recorriste. */}
        {offsetAnterior !== null && (
          <svg
            className="pointer-events-none absolute left-0"
            style={{ top: -ALTO_FILA / 2, width: ANCHO_CARRIL, height: ALTO_FILA }}
            viewBox={`0 0 ${ANCHO_CARRIL} ${ALTO_FILA}`}
            aria-hidden="true">
            <line
              x1={ANCHO_CARRIL / 2 + offsetAnterior} y1={0}
              x2={ANCHO_CARRIL / 2 + offset} y2={ALTO_FILA}
              stroke={completado || esActual ? 'var(--color-cian)' : 'rgba(255,255,255,0.10)'}
              strokeWidth={completado ? 4 : 3}
              strokeLinecap="round"
              // Punteado a partir de donde todavía no llegaste: el camino existe pero no
              // está recorrido, y eso se lee sin necesidad de ninguna leyenda.
              strokeDasharray={completado || esActual ? undefined : '2 7'}
              opacity={completado ? 0.55 : 1}
            />
          </svg>
        )}

        <button
          disabled={bloqueado}
          onClick={onEntrar}
          title={item.titulo}
          style={estiloCirculo}
          className={`relative z-10 flex items-center justify-center rounded-full border-2 transition-all active:scale-95 ${clasesCirculo}`}>
          <Icono nombre={bloqueado || cerradoPorEstrellas ? 'lock' : icono} tamano={esTest ? 28 : 20} />
        </button>

        {/* Las estrellas cuelgan del círculo, no de la fila: tienen que seguir a la
            serpiente o quedarían debajo del nodo equivocado.

            ⚠️ La comparación es `!= null` (floja) y no `!== null`: el backend corre con
            `default-property-inclusion: non_null`, así que un campo nulo NO viaja como
            null — viaja ausente, y llega como undefined. Con la comparación estricta, un
            nodo completado antes de que existiera la columna pasaba el filtro y pintaba
            tres estrellas vacías, que se lee como "lo hiciste y sacaste cero". */}
        {completado && item.estrellas != null && (
          <span
            className="pointer-events-none absolute z-10"
            style={{ transform: `translateX(${offset}px)`, top: ALTO_FILA / 2 + diametro / 2 - 6 }}>
            <Estrellas cantidad={item.estrellas} tamano={13} />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {esTest && (
            <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{
                background: 'rgba(255,197,61,0.15)',
                color: bloqueado ? 'rgba(255,197,61,0.4)' : 'var(--color-oro)',
              }}>
              {item.rolEnNivel === 'TEST_NIVEL' ? 'Test de nivel' : 'Test final'}
            </span>
          )}
          <p className={`truncate text-sm font-semibold ${
            bloqueado ? 'text-gris-texto/40' : esActual ? 'text-cian' : 'text-white'
          }`}>
            {item.titulo}
          </p>
        </div>

        {item.descripcion && (
          <p className={`mt-0.5 line-clamp-2 text-xs leading-snug ${
            bloqueado ? 'text-gris-texto/30' : 'text-gris-texto'
          }`}>
            {item.descripcion}
          </p>
        )}

        {/* La marca personal, solo donde existe. Convierte un nodo ya hecho en algo a lo
            que volver: sin esto, repetir un ejercicio completado no tiene ningún objetivo
            visible. */}
        {completado && item.mejorWpm != null && (
          <p className="mt-1 text-[11px] font-semibold tabular-nums text-gris-texto/70">
            Mejor: {item.mejorWpm} WPM
            {item.mejorPrecision != null && ` · ${Math.round(item.mejorPrecision)}%`}
          </p>
        )}
      </div>

      {/* El Test Final cerrado dice cuánto falta, en el mismo amarillo de los ejercicios que
          lo cierran. Manda sobre "Vas aquí": estar ahí sin poder entrar es justo lo que hay
          que explicar. */}
      {cerradoPorEstrellas ? (
        <span className="shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: 'rgba(255,197,61,0.14)', color: 'var(--color-oro)' }}>
          {faltan === 1 ? 'Falta 1' : `Faltan ${faltan}`}
        </span>
      ) : esActual && (
        <span className="shrink-0 rounded-full bg-cian px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ground">
          Vas aquí
        </span>
      )}
    </div>
  );
};

export default NodoSendero;
