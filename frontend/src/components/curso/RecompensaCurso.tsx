import type { CSSProperties } from 'react';
import type { NivelCurso, ProgresoEjercicioResponse, ResultadoCursoResponse } from '../../types';
import { NOMBRE_NIVEL, colorPorMejorar, enConstruccion, llegoAlTestFinal } from '../../core/curso/sendero';
import Icono from '../ui/Icono';
import Estrellas from './Estrellas';
import Confeti from './Confeti';
import BarraSendero from './BarraSendero';

interface Props {
  resultado: ResultadoCursoResponse;
  esOscuro: boolean;
  /* Los nodos del nivel, ya con las estrellas de este intento. Con ellos la barra del nivel
     pasa a ser la de guiones (BarraSendero); sin ellos —todavía cargando, o si la petición
     falló— queda la barra lisa de siempre, que no depende de nada más. */
  nodos?: ProgresoEjercicioResponse[] | null;
  ejercicioId?: number;
  // El guion que parpadea: adónde lleva el botón principal. Ver ResultadosView.
  destacadoId?: number | null;
  onElegirNodo?: (nodo: ProgresoEjercicioResponse) => void;
}

const ORDINALES_BLOQUE = ['primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta'];

/* El banner de "terminaste el bloque N". Genérico a propósito —el usuario pidió algo que
   sirva para cualquier bloque, no cuatro textos escritos a mano— pero con una variación
   chica para que no se sienta siempre la misma frase pegada: el cierre cambia si es el
   último bloque del nivel.

   "Último de su bloque" se calcula acá y no en el backend porque es puramente de
   presentación (cuándo mostrar un cartel, no una regla de aprobación): el nodo actual
   tiene que ser el de mayor `orden` entre los de su mismo `bloque`, sin contar los de
   control (Test Final / Test de Nivel, que ya tienen su propio veredicto y no deberían
   competir con este cartel). */
const mensajeBloqueCompletado = (
  nodos: ProgresoEjercicioResponse[] | null | undefined,
  ejercicioId: number | undefined,
  nivel: NivelCurso,
): string | null => {
  if (!nodos || nodos.length === 0 || ejercicioId == null) return null;
  const actual = nodos.find((n) => n.ejercicioId === ejercicioId);
  if (!actual || actual.bloque == null || actual.rolEnNivel) return null;

  const regulares = nodos.filter((n) => n.bloque != null && !n.rolEnNivel);
  const esUltimoDeSuBloque = !regulares.some(
    (n) => n.bloque === actual.bloque && n.orden > actual.orden,
  );
  if (!esUltimoDeSuBloque) return null;

  const bloqueMaximo = Math.max(...regulares.map((n) => n.bloque as number));
  const ordinal = ORDINALES_BLOQUE[actual.bloque - 1] ?? `parte ${actual.bloque}`;
  const cierre = actual.bloque === bloqueMaximo
    ? 'Ya casi terminas el nivel.'
    : 'Vas muy bien, seguí así.';
  return `¡Felicidades! Completaste la ${ordinal} parte del curso ${NOMBRE_NIVEL[nivel]}. ${cierre}`;
};

/* Qué significa cada peldaño. No es decoración: es lo único que le dice al usuario QUÉ
   mejorar. "Bien" a secas ante dos estrellas no informa; "te falta velocidad" sí, y es
   exactamente la diferencia entre 2 y 3 según calcularMediasEstrellas.

   UNA ESTRELLA NO ES UN APROBADO CELEBRABLE: significa que pasaste el mínimo del ejercicio
   pero con una precisión por debajo de la que el nivel pide, o sea que conviene repetirlo.
   Por eso su titular y su mensaje son los únicos que empujan a volver a intentarlo, y por
   eso es el único caso superado que no tira confeti. */
const LECTURA: Record<string, { titulo: string; mensaje: string }> = {
  '1': {
    titulo: '¡Aprobado! Repítelo y sube de nota',
    mensaje: 'Ya lo lograste. La segunda estrella está cerca: repítelo con calma y '
      + 'gánala con precisión, no con velocidad.',
  },
  '2': {
    titulo: '¡Bien hecho!',
    mensaje: 'Ya tienes la precisión que pide el nivel. Ahora falta velocidad.',
  },
  '2.5': {
    titulo: '¡Bien hecho!',
    mensaje: 'Muy cerca: te falta poco para la velocidad del nivel.',
  },
  '3': {
    titulo: '¡Muy bien!',
    mensaje: 'Con este intento aprobarías el nivel entero.',
  },
};

/* El consejo del juego. Siempre en positivo y siempre accionable: en la Lluvia el titular
   es fijo ("¡Lo hiciste muy bien!") porque sobrevivir treinta segundos a una lluvia que
   acelera ya es el logro, así que lo único que puede informar es esto.

   Va por PRECISIÓN y no por estrellas para que el texto siga siendo verdadero si algún día
   se recalibra la escala; y no menciona el porcentaje, que es justo el número que la
   pantalla esconde a propósito. */
const CONSEJO_JUEGO = (precision: number) => {
  if (precision >= 95) {
    return 'Casi no fallaste una tecla. Prueba a dejar que bajen un poco más antes de '
      + 'pulsar: ahí es donde se gana ritmo.';
  }
  if (precision >= 85) {
    return 'Buen pulso. Cuando dos carriles pidan tecla a la vez, resuelve primero el que '
      + 'esté más abajo.';
  }
  if (precision >= 75) {
    return 'Vas bien. Mira el carril entero y no solo la letra: la que está por tocar el '
      + 'suelo siempre manda.';
  }
  if (precision >= 60) {
    return 'Buen aguante. Intenta no adelantarte: pulsar antes de leer es lo que más '
      + 'teclas cuesta.';
  }
  return 'Aguantaste, que es lo que cuenta. Ve tecla por tecla sin apurarte — la velocidad '
    + 'de la lluvia sube sola, tú no tienes que ayudarla.';
};

/* Una de las dos exigencias, dibujada como barra con la meta marcada.

   El fracaso mudo era el problema real: hasta ahora el usuario que no pasaba el umbral
   veía las mismas cuatro cifras de siempre y nada le decía que no había pasado, ni cuánto
   le faltaba. Acá se ve de un vistazo si el que falló fue el WPM o la precisión, y por
   cuánto. */
const Medidor = ({ etiqueta, valor, meta, unidad, cumple, esOscuro }: {
  etiqueta: string; valor: number; meta: number; unidad: string; cumple: boolean; esOscuro: boolean;
}) => {
  /* La barra se escala contra 1.25x la meta, no contra el valor máximo posible: así la
     marca de la meta queda siempre en el 80% del ancho y los dos medidores se pueden
     comparar entre sí de un vistazo. Superar la meta llena la barra sin desbordarla. */
  const tope = meta * 1.25;
  const pct = Math.min(100, (valor / tope) * 100);
  const pctMeta = (meta / tope) * 100;
  /* El cian (#00F1FD) sobre blanco no llega a contraste legible: en la apariencia clara la
     cifra "20 / 9 WPM" se leía como un gris celeste. La clara usa su propio par
     esmeralda/rosa, que es el que ya usan sus otras pantallas. */
  const color = cumple
    ? (esOscuro ? 'var(--color-cian)' : '#059669')
    : (esOscuro ? 'var(--color-dificil)' : '#E11D48');

  return (
    <div className="flex-1">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
          esOscuro ? 'text-gris-texto' : 'text-slate-400'
        }`}>
          {etiqueta}
        </span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>
          {valor}
          <span className={esOscuro ? 'text-gris-texto' : 'text-slate-400'}>
            {' / '}{meta} {unidad}
          </span>
        </span>
      </div>

      <div className={`relative h-2 overflow-hidden rounded-full ${
        esOscuro ? 'bg-white/8' : 'bg-slate-200'
      }`}>
        <div
          className="barra-llena h-full rounded-full"
          style={{ '--destino': `${pct}%`, background: color } as CSSProperties}
        />
        {/* La marca de la meta va POR ENCIMA del relleno: si quedara debajo, superar el
            umbral la taparía justo cuando más importa verla. */}
        <div
          className="absolute top-0 h-full w-0.5"
          style={{ left: `${pctMeta}%`, background: esOscuro ? '#FFFFFF' : '#0F172A', opacity: 0.55 }}
        />
      </div>
    </div>
  );
};

/* Dónde vas en el nivel: el rótulo con la cuenta y, debajo, la barra. Con los nodos es la
   barra de guiones, con los de una estrella en amarillo; sin ellos, la lisa de siempre. Es
   la misma pieza en el panel de un juego y en el de un ejercicio, y por eso vive aparte. */
const ProgresoNivel = ({
  nivel, completados, totales, nodos, ejercicioId, destacadoId, onElegirNodo, esOscuro,
}: {
  nivel: NivelCurso; completados: number; totales: number;
  nodos?: ProgresoEjercicioResponse[] | null; ejercicioId?: number; destacadoId?: number | null;
  onElegirNodo?: (nodo: ProgresoEjercicioResponse) => void; esOscuro: boolean;
}) => {
  const conGuiones = Boolean(nodos && nodos.length > 0 && onElegirNodo);
  // Con los nodos, la cuenta sale de ellos: ya traen este intento y no suman retirados.
  const hechos = conGuiones ? nodos!.filter((n) => n.completado).length : completados;
  const total = conGuiones ? nodos!.length : totales;
  // Solo al llegar al Test Final: antes, el aviso habla de un examen que todavía no toca.
  const pendientes = conGuiones && llegoAlTestFinal(nodos!)
    ? nodos!.filter((n) => n.porMejorar).length : 0;
  const pct = total > 0 ? (hechos / total) * 100 : 0;

  return (
    <div className="relative mt-6 text-left">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
          esOscuro ? 'text-gris-texto' : 'text-slate-400'
        }`}>
          Nivel {NOMBRE_NIVEL[nivel]}
        </span>
        <span className={`text-xs font-bold tabular-nums ${esOscuro ? 'text-white' : 'text-slate-700'}`}>
          {hechos}/{total} ejercicios
        </span>
      </div>

      {conGuiones ? (
        <BarraSendero
          nodos={nodos!}
          actualId={ejercicioId ?? -1}
          destacadoId={destacadoId ?? null}
          esOscuro={esOscuro}
          onElegir={onElegirNodo!}
        />
      ) : (
        <div className={`h-1.5 overflow-hidden rounded-full ${esOscuro ? 'bg-white/8' : 'bg-slate-200'}`}>
          <div className="barra-llena h-full rounded-full"
            style={{
              '--destino': `${pct}%`,
              background: esOscuro ? 'var(--color-cian)' : '#059669',
            } as CSSProperties} />
        </div>
      )}

      {/* Lo que le falta para el examen, dicho con palabras. Es el aviso que nunca existió:
          el backend calculaba estos ejercicios y ninguna pantalla los nombraba. */}
      {pendientes > 0 && (
        <p className="mt-1 text-xs font-semibold" style={{ color: colorPorMejorar(esOscuro) }}>
          {pendientes === 1
            ? 'Te falta 1 ejercicio con 2 estrellas para el Test Final.'
            : `Te faltan ${pendientes} ejercicios con 2 estrellas para el Test Final.`}
        </p>
      )}
    </div>
  );
};

/* El panel de recompensa del Curso por niveles. Tres estados, en orden de importancia:
   nivel aprobado > ejercicio superado > no llegaste. */
const RecompensaCurso = ({
  resultado, esOscuro, nodos, ejercicioId, destacadoId, onElegirNodo,
}: Props) => {
  const {
    superado, estrellas, estrellasPrevias, umbralWpm, umbralPrecision, wpm, precision,
    primeraVez, esRecordWpm, nivelAprobado, nivelDesbloqueado, nodosCompletados,
    nodosTotales, rolEnNivel, nivel, esJuego, mejorRachaLluvia,
  } = resultado;

  const cumpleWpm = wpm >= umbralWpm;
  const cumplePrecision = precision >= umbralPrecision;

  /* Una estrella = pasó, pero conviene repetirlo. Se trata aparte del resto de los casos
     superados en tres lugares —titular, color y confeti— porque es el único que pide
     volver a hacer el ejercicio en vez de seguir. */
  const aRepetir = superado && estrellas <= 1;
  /* La clave se arma con String(estrellas) para que 2.5 caiga en su propia entrada. Si
     llegara un valor inesperado (una escala nueva del servidor, por ejemplo), se cae al
     texto de tres estrellas en vez de dejar el panel sin mensaje. */
  const lectura = LECTURA[String(estrellas)] ?? LECTURA['3'];
  // Ya tenías una marca mejor: se dice, para que repetir un ejercicio no parezca un retroceso.
  const bajoSuMarca = !nivelAprobado && estrellasPrevias > estrellas;
  /* Solo la PRIMERA vez, mismo criterio que el confeti de abajo: repetir un nodo ya hecho
     no puede volver a "completar" su bloque cada vez. */
  const bloqueCompletado = superado && primeraVez
    ? mensajeBloqueCompletado(nodos, ejercicioId, nivel) : null;

  const marco = esOscuro ? 'border-(--sup-borde) bg-(--sup)' : 'border-slate-200 bg-white';

  /* ---------- 1. NIVEL APROBADO: se come la pantalla ---------- */
  if (nivelAprobado) {
    return (
      <div className={`sube-y-aparece relative overflow-hidden rounded-2xl border p-8 text-center ${marco}`}
        style={{ borderColor: 'rgba(255,197,61,0.35)' }}>
        <Confeti piezas={140} />

        <div className="relative">
          <Icono nombre="trophy" tamano={80} relleno
            className="brilla-trofeo mx-auto block" style={{ color: 'var(--color-oro)' }} />

          <h2 className={`mt-3 text-3xl font-bold ${esOscuro ? 'text-white' : 'text-slate-900'}`}>
            ¡Nivel {NOMBRE_NIVEL[nivel]} aprobado!
          </h2>

          <p className={`mt-2 ${esOscuro ? 'text-gris-texto' : 'text-slate-500'}`}>
            {rolEnNivel === 'TEST_NIVEL'
              /* El salto por Test de Nivel no rellena los nodos individuales (decisión ya
                 tomada: sería falsear el registro), así que conviene decirlo acá mismo o
                 el sendero sin tildes se lee como un error. */
              ? 'Lo aprobaste de una con el Test de Nivel. Los ejercicios quedan abiertos por si quieres practicarlos igual.'
              : 'Cerraste el nivel con el Test Final.'}
          </p>

          {/* Un nivel en construcción no se anuncia como abierto: el backend lo desbloquea,
              pero la pantalla del nivel sigue cerrada. */}
          {nivelDesbloqueado && !enConstruccion(nivelDesbloqueado) && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold"
              style={{ background: 'rgba(0,241,253,0.12)', color: 'var(--color-cian)' }}>
              <Icono nombre="lock_open" tamano={18} />
              Nivel {NOMBRE_NIVEL[nivelDesbloqueado]} desbloqueado
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------- 1b. UN JUEGO: ni velocidad, ni precisión, ni veredicto ----------

     La Lluvia se puntúa distinto y por eso se muestra distinto. Los dos medidores no
     tienen nada que medir (sus umbrales son 0 y 0, así que las barras salían "9 / 0 WPM"),
     y el veredicto de una estrella —"Aprobado, pero repítelo"— es un castigo por una cifra
     que el juego no pide: se puede jugar impecable y sacar 9 WPM porque la letra tarda lo
     que tarda en caer.

     Queda la barra del nivel, que no es una nota sino dónde vas en el sendero. */
  if (esJuego) {
    return (
      <div className={`sube-y-aparece relative overflow-hidden rounded-2xl border p-8 text-center ${marco}`}>
        {/* En un juego el confeti sale siempre que se haya llegado al final: no es el premio
            a una nota sino la celebración de haber aguantado la ronda. */}
        {superado && <Confeti piezas={90} />}

        <div className="relative">
          <div className="relative mx-auto inline-block">
            <span className="halo-late absolute -inset-6 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(255,197,61,0.35), transparent 70%)' }} />
            <span className="relative block">
              <Estrellas cantidad={estrellas} tamano={64} animar />
            </span>
          </div>

          <h2 className={`mt-4 text-3xl font-bold ${esOscuro ? 'text-white' : 'text-slate-900'}`}>
            ¡Lo hiciste muy bien!
          </h2>

          <p className={`mx-auto mt-2 max-w-md text-sm leading-relaxed ${
            esOscuro ? 'text-gris-texto' : 'text-slate-500'
          }`}>
            {CONSEJO_JUEGO(Number(precision))}
          </p>

          {(bajoSuMarca || (typeof mejorRachaLluvia === 'number' && mejorRachaLluvia > 0)) && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {bajoSuMarca && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  esOscuro ? 'bg-white/8 text-gris-texto' : 'bg-slate-100 text-slate-500'
                }`}>
                  Tu mejor: <Estrellas cantidad={estrellasPrevias} tamano={12} />
                </span>
              )}
              {/* Solo la Lluvia manda este dato (ver CursoPracticaView): la seguidilla más
                  larga de aciertos de la partida. El juego no la puntúa, pero da una marca
                  propia que batir en un ejercicio que no exige velocidad. */}
              {typeof mejorRachaLluvia === 'number' && mejorRachaLluvia > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{ background: 'rgba(255,197,61,0.14)', color: 'var(--color-oro)' }}>
                  <Icono nombre="bolt" tamano={12} relleno />
                  Racha máxima: {mejorRachaLluvia} seguidas
                </span>
              )}
            </div>
          )}

          <ProgresoNivel nivel={nivel} completados={nodosCompletados} totales={nodosTotales}
            nodos={nodos} ejercicioId={ejercicioId} destacadoId={destacadoId}
            onElegirNodo={onElegirNodo} esOscuro={esOscuro} />
        </div>
      </div>
    );
  }

  /* ---------- 2 y 3. Ejercicio superado, o no ---------- */
  return (
    <div className={`sube-y-aparece relative overflow-hidden rounded-2xl border p-6 ${marco}`}>
      {/* Confeti solo la PRIMERA vez que se completa el nodo, y NUNCA con una sola
          estrella. Dos motivos distintos: repetir un ejercicio ya hecho para subir la
          marca no vuelve a celebrarse (si celebrara siempre, dejaría de significar algo a
          la tercera repetición), y una estrella no es un logro sino un aviso de que
          conviene volver a intentarlo — festejarlo diría lo contrario del mensaje. */}
      {superado && primeraVez && estrellas >= 2 && <Confeti piezas={70} />}

      {bloqueCompletado && (
        <div className="mb-5 flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background: 'rgba(255,197,61,0.12)', border: '1px solid rgba(255,197,61,0.3)' }}>
          <Icono nombre="celebration" tamano={22} relleno style={{ color: 'var(--color-oro)' }} />
          <p className={`text-sm font-semibold ${esOscuro ? 'text-white' : 'text-slate-900'}`}>
            {bloqueCompletado}
          </p>
        </div>
      )}

      <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
        <div className="relative shrink-0">
          {superado && (
            <span className="halo-late absolute -inset-4 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(255,197,61,0.35), transparent 70%)' }} />
          )}
          <span className="relative block">
            <Estrellas cantidad={estrellas} tamano={40} animar />
          </span>
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          {/* El color del "repítelo" va en línea y no como clase: es el mismo dorado de la
              estrella que se acaba de ganar, y así queda atado al token sin depender de
              que Tailwind genere la utilidad. */}
          <h2 className={`text-2xl font-bold ${
            superado ? (esOscuro ? 'text-white' : 'text-slate-900') : 'sacude text-dificil'
          }`}
            style={aRepetir ? { color: 'var(--color-oro)' } : undefined}>
            {superado ? lectura.titulo : 'Todavía no'}
          </h2>

          <p className={`mt-1 text-sm ${esOscuro ? 'text-gris-texto' : 'text-slate-500'}`}>
            {superado
              ? lectura.mensaje
              : cumpleWpm
                ? 'Te sobra velocidad: lo que falta es precisión. Baja el ritmo hasta dejar de fallar.'
                : cumplePrecision
                  ? 'La precisión está. Ahora falta velocidad: repítelo sin perderla.'
                  : 'Faltan las dos. Empieza por la precisión: la velocidad llega sola.'}
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {/* El récord solo se felicita si además se superó el ejercicio. En un intento
                fallado el dato es cierto pero engañoso: la primera vez que entrás a un
                nodo cualquier WPM es tu mejor marca, así que fallar con 5 WPM sacaba un
                "tu mejor marca" al lado de un "todavía no". */}
            {esRecordWpm && superado && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ background: 'rgba(0,241,253,0.12)', color: 'var(--color-cian)' }}>
                <Icono nombre="trending_up" tamano={14} />
                Tu mejor marca en este ejercicio
              </span>
            )}
            {bajoSuMarca && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                esOscuro ? 'bg-white/8 text-gris-texto' : 'bg-slate-100 text-slate-500'
              }`}>
                Tu mejor: <Estrellas cantidad={estrellasPrevias} tamano={12} />
              </span>
            )}
            {rolEnNivel === 'TEST_FINAL' && !superado && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ background: 'rgba(191,129,255,0.15)', color: 'var(--color-medio)' }}>
                <Icono nombre="flag" tamano={14} />
                Test Final — exige el umbral completo del nivel
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="relative mt-6 flex flex-col gap-4 sm:flex-row sm:gap-8">
        <Medidor etiqueta="Velocidad" valor={wpm} meta={umbralWpm} unidad="WPM"
          cumple={cumpleWpm} esOscuro={esOscuro} />
        <Medidor etiqueta="Precisión" valor={Math.round(precision)} meta={Math.round(umbralPrecision)}
          unidad="%" cumple={cumplePrecision} esOscuro={esOscuro} />
      </div>

      {/* Dónde vas en el nivel. Es el dato que convierte un ejercicio suelto en un curso:
          sin él, terminar el nodo 12 de 29 se siente igual que terminar el 3. */}
      <ProgresoNivel nivel={nivel} completados={nodosCompletados} totales={nodosTotales}
        nodos={nodos} ejercicioId={ejercicioId} destacadoId={destacadoId}
        onElegirNodo={onElegirNodo} esOscuro={esOscuro} />
    </div>
  );
};

export default RecompensaCurso;
