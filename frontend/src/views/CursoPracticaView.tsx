import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type {
  SesionProgresoDTO, TeclaStatsRequest, NgramStatsRequest, TeclaEventoRequest,
  EjercicioContenidoResponse, IntentoResumen, NivelCurso, ProgresoEjercicioResponse,
  UmbralesLatido,
} from '../types';
import {
  obtenerContenidoEjercicio, obtenerContenidoConFantasma, obtenerContenidoConFantasmaSimulado,
  obtenerRivalSombra, guardarSesionEjercicio, obtenerUltimoIntento,
} from '../api/ejercicioApi';
import Spinner from '../components/ui/Spinner';
import Cronometro from '../components/practica/Cronometro';
import AroProgreso from '../components/practica/AroProgreso';
import { useApariencia } from '../core/apariencia/useApariencia';
import VistaPalabrasMutantes from '../components/practica/VistaPalabrasMutantes';
import VistaCarruselPalabras from '../components/practica/VistaCarruselPalabras';
import VistaLluviaLetras from '../components/practica/VistaLluviaLetras';
import PalabrasFlotantes, { type MetricasFlotantes } from '../components/practica/PalabrasFlotantes';
import TecladoGuia from '../components/practica/TecladoGuia';
import { esMayuscula, teclasDelTexto } from '../components/practica/tecladoLayout';
import AvisoTeclaEspecial from '../components/curso/AvisoTeclaEspecial';
import DestelloTanda from '../components/curso/DestelloTanda';
import Icono from '../components/ui/Icono';
import VistaCinta from '../components/practica/VistaCinta';
import VistaRecorrido from '../components/practica/VistaRecorrido';
import TutorialTeclas from '../components/curso/TutorialTeclas';
import IntroRecorrido from '../components/curso/IntroRecorrido';
import IntroInfo from '../components/practica/IntroInfo';
import BloqueoTestFinal from '../components/curso/BloqueoTestFinal';
import ResumenLatido, { type CierreLatido } from '../components/curso/ResumenLatido';
import {
  decidirSiguiente, decidirUltimoIntento, notaFinal, type ResultadoLatido,
} from '../core/curso/latidos';
import { calcularDelta } from '../utils/ritmoTecleo';
import {
  guardarEstadoNodo, restaurarEstadoNodo, type EstadoNodo,
} from '../core/curso/estadoNodo';
import { conjuntoDelNodo, pistaDeFallo } from '../core/curso/pistas';
import { llegoAlTestFinal } from '../core/curso/sendero';
import AvisoPista from '../components/curso/AvisoPista';
import { DESBLOQUEAR_TODO_EL_CURSO, NAVEGAR_CURSO_CON_FLECHAS } from '../core/desarrollo';
import { obtenerProgresoCursoPorNivel } from '../api/cursoStatsApi';

interface ConfigContrarreloj {
  tiempoInicialSegundos: number;
  bonusCorrectaSegundos: number;
  penalizacionErrorSegundos: number;
  // Variante avanzada: la penalización se aplica al instante de cada tecla errónea,
  // no diferida al cierre de la palabra. El bono sigue siendo por palabra.
  penalizacionPorTecla?: boolean;
}

/* El separador con el que el backend manda las frases del modo `porTandas`. Vive en una
   constante y no suelto en la condición porque es un contrato con el generador: si allá
   cambia el carácter de unión, este es el único sitio que hay que tocar acá. */
const SALTO_DE_TANDA = '\n';

const DURACION_DESTELLO_MS = 1500;
// El aviso de "pasaste a fase 2" de Muerte Súbita dura un segundo más que el destello
// normal de tanda — pedido del usuario: anuncia un cambio de mecánica, no solo un corte
// entre frases del mismo tipo, así que necesita un pelín más de tiempo de lectura.
const DURACION_AVISO_FASE2_MS = DURACION_DESTELLO_MS + 1000;

/* Lo que dura una pista de tecla equivocada. Más larga que el destello de fallo del
   teclado (150 ms) porque hay que LEERLA, y bastante más corta que el aviso de tecla
   especial, que se queda mientras haga falta: la pista corrige algo que ya pasó. */
const DURACION_PISTA_MS = 2600;

/* Una vocal con tilde: lo que `tildeObligatoria` no deja pasar. La diéresis queda fuera a
   propósito — el nodo enseña la tecla del acento, y la ü se escribe con otro gesto. */
const CON_TILDE = /^[áéíóúÁÉÍÓÚ]$/;

const CursoPracticaView = () => {
  // `nivel` solo viene poblado en /curso/:nivel/:id (secuencia dentro de un nivel) —
  // en /ejercicios-base/:id queda undefined, y ese es justo el distingo que se necesita.
  const { id, nivel } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { apariencia } = useApariencia();
  const esOscuro = apariencia === 'oscuro';

  /* ===== DESARROLLO — QUITAR ANTES DE PUBLICAR (ver core/desarrollo.ts) =====
     Los ids del nivel en orden, para que ← y → salten al ejercicio de al lado. Va en un ref
     y no en estado porque solo lo lee el manejador de teclado: guardarlo en estado obligaría
     a recrear ese manejador —y a re-registrar el listener— cada vez que llega la lista. */
  const secuenciaNivelRef = useRef<number[]>([]);

  /* Los nodos del nivel con su progreso: estrellas y si están "por mejorar". Hace falta para
     el BLOQUEO DEL TEST FINAL —no se puede dar mientras quede algún ejercicio sin sus 2
     estrellas— y de paso alimenta las flechas de desarrollo.

     Tri-estado, como en ResultadosView: undefined = cargando, null = falló o no hay nivel,
     lista = llegó. Si la petición falla el bloqueo NO se aplica: un fallo de red no puede
     dejar a nadie sin poder practicar, y el backend ya se niega a aprobar el nivel con
     ejercicios pendientes, así que no se regala nada. */
  const [nodosNivel, setNodosNivel] = useState<ProgresoEjercicioResponse[] | null | undefined>(
    () => (nivel ? undefined : null));
  /* "Entrar igual" de la ventana de bloqueo: solo existe con DESBLOQUEAR_TODO_EL_CURSO. Si ya
     se eligió en la ventana del sendero llega en el estado de la navegación, para no tener
     que elegirlo dos veces. */
  const [entrarIgual, setEntrarIgual] = useState(() => DESBLOQUEAR_TODO_EL_CURSO
    && (location.state as { entrarIgual?: boolean } | null)?.entrarIgual === true);

  const [ejercicio, setEjercicio] = useState<EjercicioContenidoResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState('');
  const [indice, setIndice] = useState(0);
  const [errores, setErrores] = useState<Set<number>>(new Set());
  /* Índices de un carácter "obligatorio" —una tilde con `tildeObligatoria`, o desde el
     11-sep-2026 también un `;` con `puntoYComaObligatorio`— que fallaron al menos una vez
     pero se terminaron acertando. `errores` los deja pintados de rojo para siempre —es lo
     correcto para un fallo sin corregir— pero acá SÍ hubo corrección, y pedirle al usuario
     que la mire en rojo aunque la haya sacado bien confunde "esto sigue mal" con "esto te
     costó". `getColorCaracter` los pinta en celeste (el cian de "acertado") en vez de rojo,
     sin importar cuántas veces haya fallado antes — pedido explícito del usuario para el
     punto y coma: mostrar de algún modo "cuántas veces falló" se leería como un castigo,
     cuando el punto es que al final lo sacó bien. */
  const [corregidosTrasFallar, setCorregidosTrasFallar] = useState<Set<number>>(new Set());
  const [teclaPresionada, setTeclaPresionada] = useState('');
  const [teclaError, setTeclaError] = useState('');
  const [corriendo, setCorriendo] = useState(false);
  const [terminado, setTerminado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [caracteresCorrectos, setCaracteresCorrectos] = useState(0);
  const [totalPresionadas, setTotalPresionadas] = useState(0);
  const [tiempoMs, setTiempoMs] = useState(0); // cuenta arriba (normal/sudden death) o abajo (contrarreloj)

  /* Tiempo REALMENTE transcurrido, siempre hacia adelante. En contrarreloj no se puede
     derivar del cronómetro: los bonus por acierto le SUMAN tiempo al reloj, así que
     `inicial − restante` se achica cuando escribes bien y el WPM en vivo se dispara
     (llegaba a marcar 500). El reloj cuenta lo que te queda; esto cuenta lo que llevas. */
  const [transcurridoMs, setTranscurridoMs] = useState(0);
  const [reinicios, setReinicios] = useState(0); // solo informativo para sudden death

  /* --- Modo sombra ---
     Se entra directo al ejercicio y, si el backend encuentra un rival digno (tu mejor
     intento de este mismo ejercicio, con texto y eventos guardados y de más de 10s),
     aparece el botón para correr contra él. Antes el único camino era escribir
     ?fantasma={sesionId} a mano en la URL, que sigue funcionando. */
  const [ghostIndice, setGhostIndice] = useState(-1);
  const fantasmaEventosRef = useRef<{ tiempoDesdeInicioMs: number; indiceResultante: number }[] | null>(null);
  const [rival, setRival] = useState<IntentoResumen | null>(null);
  const [avisoRival, setAvisoRival] = useState('');
  // Fantasma simulado: distingue el badge de "tu intento real" del de "ritmo inventado
  // a este WPM", que es lo que arma cargarConFantasmaSimulado.
  const [fantasmaEsSimulado, setFantasmaEsSimulado] = useState(false);
  const WPM_FANTASMA_SIMULADO = [30, 40, 50, 60, 70, 80, 90];

  /* Sub-selección del ejercicio: el paso de la progresión en "Fundamentos de teclado"
     ("central:0") o la categoría en "Muerte súbita" ("cortas" | "medias" | "largas").
     Arranca vacío a propósito para que decida el backend cuál es el valor por defecto
     de cada tipo; el ref lo lee `cargar()` para que al repetir se mantenga lo elegido
     en vez de volver al principio. */
  const [grupo, setGrupo] = useState<string>('');
  const grupoRef = useRef('');

  /* ===== LATIDOS =====
     Un ejercicio de letras del Curso no es una tanda larga sino varias cortas encadenadas.
     La decisión de qué viene después de cada una vive en core/curso/latidos.ts; acá solo
     está el estado y el cableado.

     Todo lo "vivo" va en refs además de en estado porque quien las lee es handleKeyDown,
     que se registra una vez: si leyera el estado, vería el valor del render en que se
     creó el manejador y se quedaría clavado en el primer latido. */
  const [faseNodo, setFaseNodo] = useState<'tutorial' | 'latido'>('latido');
  /* La fase también en ref: la lee handleKeyDown, que se registra una vez y vería el valor
     congelado del render en que se creó si leyera el estado. */
  const faseNodoRef = useRef<'tutorial' | 'latido'>('latido');
  const [indiceLatido, setIndiceLatido] = useState(0);
  const indiceLatidoRef = useRef(0);
  const resultadosLatidosRef = useRef<ResultadoLatido[]>([]);
  /* Tiempo del NODO entero. `transcurridoMsRef` se reinicia en cada latido, así que sin
     este acumulador la sesión guardaría la duración del último y no la de todo el
     ejercicio — y el "0:18" de la pantalla de resultados sería falso. */
  const tiempoNodoMsRef = useRef(0);
  const latidosRef = useRef<{ nombre: string; descripcion: string; texto: string }[]>([]);
  /* Lo que el nodo pide para aprobarse y lo que pide su quinto latido. Llegan con el
     contenido, calculados por el servidor con las mismas reglas con que después puntúa;
     null en todo lo que no se sirve en latidos. */
  const umbralesLatidoRef = useRef<UmbralesLatido | null>(null);
  /* El mismo dato en estado, solo para pintar. El ref existe porque lo lee handleKeyDown
     —que se registra una vez y vería un valor congelado si leyera el estado—; el estado
     existe porque leer un ref durante el render está prohibido en este repo, y con razón:
     React no vuelve a pintar cuando un ref cambia, así que el rótulo se quedaría clavado
     en el primer latido. Los dos se escriben juntos, siempre. */
  const [latidosVista, setLatidosVista] = useState<{ nombre: string; descripcion: string }[]>([]);
  // El quinto latido, cuando se llega a él. Cambia cómo el servidor juzga la sesión.
  const [enUltimoIntento, setEnUltimoIntento] = useState(false);
  /* Se ha retomado el nodo tras recargar. Solo sirve para decirlo en pantalla: sin el
     aviso, aparecer en la tercera tanda con el tutorial saltado se lee como un fallo. */
  const [retomado, setRetomado] = useState(false);

  /* Los caracteres que el NODO ENTERO puede pedir, en minúscula. Es la vara contra la que
     se decide si un fallo merece una pista ("esa es de la fila de arriba") o es un
     despiste normal. Se calcula del contenido y no de la configuración: ver pistas.ts. */
  const conjuntoNodoRef = useRef<Set<string>>(new Set());
  /* La pista que se está mostrando. `sello` cambia en cada aparición para poder relanzar
     el temporizador aunque el texto sea el mismo dos veces seguidas. */
  const [pista, setPista] = useState<
    { texto: string; pulsada?: string; esperada?: string; sello: number } | null>(null);

  /* La primera mayúscula del nodo NO se puede fallar: el ejercicio se detiene ahí hasta
     que salga, y los intentos fallidos no cuentan. Es la única tecla del Curso que se
     enseña bloqueando, y el motivo es que Shift no es una tecla más — es media pulsación
     que no está en ninguna parte del texto. Una vez que sale, el nodo sigue con las reglas
     normales: las siguientes mayúsculas se fallan como cualquier otra tecla. */
  /* El mismo dato en ref y en estado, como `faseNodo` o `enUltimoIntento`: el manejador de
     teclado lo lee sin esperar al render siguiente, y el render lo necesita para saber si
     el aviso está deteniendo el ejercicio. Leer el ref en el cuerpo del render es error de
     lint en este repo, y con razón: ahí no hay nada que garantice que esté al día. */
  const shiftEnsenadoRef = useRef(false);
  const [shiftEnsenado, setShiftEnsenado] = useState(false);
  /* Cuenta los intentos fallidos de la mayúscula gratis, para el golpe/temblor breve del
     aviso y del teclado — ver el bloque que la incrementa, más abajo. Arranca en 0 con
     cada nodo (la vista se remonta entera por `key={id}`, sección 8), así que el guard de
     "primer render" de los efectos que lo consumen es lo que evita destellar al abrir. */
  const [mayusculaFallidaSello, setMayusculaFallidaSello] = useState(0);
  const porUltimoIntentoRef = useRef(false);

  /* El resumen que se muestra ENTRE latidos. Mientras está puesto, el ejercicio está en
     pausa: el manejador de teclado se calla (igual que durante el tutorial) y la
     transición al latido siguiente espera a que el usuario pulse Enter.

     `pendiente` guarda lo que hay que hacer AL CONTINUAR. Se calcula al cerrar el latido y
     no al continuar porque en ese momento se tienen los contadores todavía sin reiniciar;
     hacerlo después obligaría a conservarlos vivos durante la pausa. */
  const [resumen, setResumen] = useState<{
    nombre: string; indice: number; total: number;
    wpm: number; precision: number; aciertos: number; cierre: CierreLatido;
    umbrales: UmbralesLatido;
  } | null>(null);
  const enPausaRef = useRef(false);
  const pendienteRef = useRef<(() => void) | null>(null);

  /* Modo linterna: preferencia de vista, no de ejercicio — "más un relajo o distracción,
     no ayuda mucho en mecanografía" (según lo confirmado). Persiste en localStorage,
     scoped a esta pantalla nada más (a diferencia de la apariencia, no se comparte con
     Resultados ni con Noticias/IA). */
  const RADIO_LINTERNA = 15;
  const [linternaActiva, setLinternaActiva] = useState(
    () => localStorage.getItem('dedea_linterna') === 'true',
  );
  useEffect(() => {
    localStorage.setItem('dedea_linterna', String(linternaActiva));
  }, [linternaActiva]);

  /* Teleprompter: otra preferencia de vista, independiente de la linterna (pueden
     combinarse). En vez de recortar líneas a mano, se apoya en el reflow real del
     navegador: mide dónde quedó el span del cursor y centra el scroll ahí — así el
     salto de línea sigue siendo el que decide el CSS (responsive de verdad), no un
     conteo de caracteres inventado. */
  const [teleprompterActivo, setTeleprompterActivo] = useState(
    () => localStorage.getItem('dedea_teleprompter') === 'true',
  );
  useEffect(() => {
    localStorage.setItem('dedea_teleprompter', String(teleprompterActivo));
  }, [teleprompterActivo]);
  const cursorSpanRef = useRef<HTMLSpanElement>(null);
  /* En qué mitad de la pantalla está el cursor. Lo usa el aviso de tecla especial para
     colocarse en la contraria. Arranca en "izquierda/arriba" porque es donde empieza
     cualquier texto, así que la primera aparición ya sale bien colocada. */
  const [posicionAviso, setPosicionAviso] = useState<{
    lado: 'izquierda' | 'derecha'; arriba: boolean;
  }>({ lado: 'izquierda', arriba: true });
  const contenedorTeleprompterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!teleprompterActivo) return;
    const cursorEl = cursorSpanRef.current;
    const contenedorEl = contenedorTeleprompterRef.current;
    if (!cursorEl || !contenedorEl) return;
    const objetivo = cursorEl.offsetTop - contenedorEl.clientHeight / 2 + cursorEl.offsetHeight / 2;
    contenedorEl.scrollTo({ top: Math.max(0, objetivo), behavior: 'smooth' });
  }, [indice, teleprompterActivo]);

  /* Carrusel de tarjetas: reemplaza el bloque de texto entero (como ya hace Palabras
     Mutantes), así que no tiene sentido combinarlo con el teleprompter — el toggle
     queda visible igual, simplemente no hace nada mientras el carrusel está activo. */
  const [carruselActivo, setCarruselActivo] = useState(
    () => localStorage.getItem('dedea_carrusel') === 'true',
  );
  useEffect(() => {
    localStorage.setItem('dedea_carrusel', String(carruselActivo));
  }, [carruselActivo]);

  /* Colores por dedo en el teclado de ayuda. Arranca ENCENDIDO —al revés que la linterna,
     el teleprompter y el carrusel, que son adornos— porque enseñar qué dedo va en cada
     tecla es el objetivo del Curso, no una preferencia de vista. Se puede apagar: a quien
     ya escribe al tacto el color no le aporta y le ensucia el teclado. */
  /* La CINTA: el texto en una línea que se desliza, a 26 px. Es preferencia de vista como
     la linterna o el carrusel, y arranca ENCENDIDA en los ejercicios de letras: un drill
     de sílabas repartido en tres líneas a 20 px se lee como un párrafo. */
  const [cintaActiva, setCintaActiva] = useState(
    () => localStorage.getItem('dedea_cinta') !== 'false',
  );
  useEffect(() => {
    localStorage.setItem('dedea_cinta', String(cintaActiva));
  }, [cintaActiva]);

  const [guiaDedos, setGuiaDedos] = useState(
    () => localStorage.getItem('dedea_guia_dedos') !== 'false',
  );
  useEffect(() => {
    localStorage.setItem('dedea_guia_dedos', String(guiaDedos));
  }, [guiaDedos]);

  // --- Sudden Death en 2 fases ---
  // Fase 1: la MISMA oración se repite cada vez que fallas, hasta que la aciertas completa.
  // Fase 2 (recién ahí): cada fallo trae una oración NUEVA al azar, hasta acertar una — ahí termina.
  const [faseSuddenDeath, setFaseSuddenDeath] = useState<'primera' | 'segunda'>('primera');
  const faseSuddenDeathRef = useRef<'primera' | 'segunda'>('primera');

  // 3 promedios para Sudden Death: "general" acumula TODO (incluidos los reinicios
  // fallidos) y nunca se resetea; fase1/fase2 son instantáneas del intento exitoso de
  // cada fase, tomadas justo antes de que reiniciarProgreso() los ponga en cero.
  const caracteresCorrectosGlobalRef = useRef(0);
  const totalPresionadasGlobalRef = useRef(0);
  const tiempoGlobalMsRef = useRef(0);
  const tiempoMsRef = useRef(0);
  const transcurridoMsRef = useRef(0);
  const fase1ResultadoRef = useRef<{ wpm: number; precision: number } | null>(null);
  const fase2ResultadoRef = useRef<{ wpm: number; precision: number } | null>(null);

  const esFundamentos = ejercicio?.tipo === 'LETRAS_BASICO';
  const esUnaMano = ejercicio?.tipo === 'MODO_UNA_MANO';
  const esUnDedo = ejercicio?.tipo === 'UN_DEDO';
  /* "Fila de números": la última tanda mezcla letras con dígitos A PROPÓSITO, así que la
     pista de fila ("todavía no usamos esa fila") deja de tener sentido justo ahí — avisaría
     de un carácter que el propio ejercicio acaba de habilitar, y eso confunde más de lo que
     ayuda. Se apaga solo en esa tanda (ver el gate en el manejador de teclado), no en el
     nodo entero: en las tres primeras, de puros dígitos, la pista sigue siendo la señal
     correcta si aparece una letra. */
  const esProgresionNumerica =
    (ejercicio?.configuracion as { progresionNumerica?: boolean } | undefined)?.progresionNumerica === true;
  /* Para pistaDeAlcance ("vuelve el dedo a la tecla de reposo" / "estira un poco más el
     índice"): solo existe en los nodos de Fundamentos que traen `ancla` propia, o sea los
     de ALCANCE (g h, r u, e i, w o, q p, t y). `ancla` viaja extendida —con la cadena de
     lecciones anteriores para los latidos 2 y 3, ver el sembrado— así que acá se recorta a
     los primeros `nuevas.length()` caracteres para recuperar el par propio, mismo truco que
     ya usa `generarTandaConAncla` en el backend. */
  const alcanceNodo = (() => {
    if (!esFundamentos) return null;
    const config = ejercicio?.configuracion as {
      filas?: { pasos?: string[] }[]; ancla?: string;
    } | undefined;
    const paso = config?.filas?.[0]?.pasos?.[0];
    const ancla = config?.ancla;
    if (!paso || !ancla) return null;
    const nuevas = paso.replace(/\s+/g, '');
    return { nuevas, anclaPropia: ancla.slice(0, nuevas.length) };
  })();
  /* El nodo no deja pasar una tilde mal escrita: se queda en esa letra hasta que sale.
     Hoy solo lo trae "Oraciones con tilde" (Básico, orden 17); ver su nota en el sembrado. */
  const tildeObligatoria =
    (ejercicio?.configuracion as { tildeObligatoria?: boolean } | undefined)?.tildeObligatoria === true;
  /* "Práctica de signos" (Intermedio): cada `;` bloquea el avance hasta acertarlo, y a
     diferencia de la primera mayúscula, SÍ cuenta como error si falla — el panel ya explica
     el gesto y la gramática, así que fallar después de verlo se cobra. Mismo trato que
     `tildeObligatoria`, ver esa nota para el porqué de la diferencia con la mayúscula. */
  const puntoYComaObligatorio =
    (ejercicio?.configuracion as { puntoYComaObligatorio?: boolean } | undefined)?.puntoYComaObligatorio === true;

  /* EL TEST FINAL, CERRADO MIENTRAS FALTEN ESTRELLAS. Qué cuenta como pendiente lo decide
     el backend (`porMejorar`: completado con menos de 2 estrellas, sin contar la Lluvia) y
     aquí solo se lee — si algún día cambia la escala, esto no se toca. Ver BloqueoTestFinal.

     Y solo al LLEGAR al examen, con el resto del sendero hecho: antes de eso la ventana
     hablaría de un examen que todavía no toca (ver llegoAlTestFinal). En el uso normal no se
     entra aquí antes de tiempo —el sendero lo tiene cerrado—; solo con el desbloqueo de
     desarrollo o escribiendo la URL, y ahí el backend igual se niega a aprobar el nivel con
     ejercicios de una estrella. */
  const pendientesNivel = useMemo(
    () => (nodosNivel ?? []).filter((n) => n.porMejorar), [nodosNivel]);
  const esTestFinal = nodosNivel?.find((n) => n.ejercicioId === Number(id))?.rolEnNivel === 'TEST_FINAL';
  const bloqueadoPorEstrellas = esTestFinal && llegoAlTestFinal(nodosNivel ?? [])
    && pendientesNivel.length > 0 && !entrarIgual;
  /* Mientras no se sabe si ESTE ejercicio es el Test Final cerrado, el teclado espera. Es
     lo que dura una petición local, y evita que alguien empiece el examen y la ventana le
     salte encima a mitad. Si la petición falla, `nodosNivel` pasa a null y esto se levanta. */
  const esperandoProgreso = nodosNivel === undefined;
  const esManoForzada = ejercicio?.tipo === 'UNA_MANO_FORZADA';
  const esShiftLateral = ejercicio?.tipo === 'SHIFT_LATERAL';
  const esResistencia = ejercicio?.tipo === 'RESISTENCIA';

  /* Ejercicios de LETRAS SUELTAS: sílabas o caracteres aislados, nunca palabras ni frases.
     Se les da un trazo un poco más grueso (peso 500 en vez de 400) porque a 30 px una
     sílaba de dos letras con trazo fino se ve endeble y cuesta distinguir la que toca; en
     un texto corrido ese mismo peso cansaría la vista. Es el único sitio donde el grosor
     cambia según el tipo de ejercicio. */
  const esDeLetrasSueltas = ejercicio?.tipo === 'LETRAS_BASICO'
    || ejercicio?.tipo === 'UN_DEDO'
    || ejercicio?.tipo === 'REPASO_FALLADAS'
    || ejercicio?.tipo === 'SHIFT_LATERAL';
  /* "Saltar" con Enter: solo en los ejercicios que traen `saltable: true` en su config
     (pensados como pausa/relajo — no tiene sentido forzar a completarlos). Se lee de la
     config y no de una lista de tipos porque cualquier TipoEjercicio puede marcarse. */
  const esSaltable = Boolean((ejercicio?.configuracion as { saltable?: boolean } | undefined)?.saltable);
  const esSimbolos = ejercicio?.tipo === 'SIMBOLOS_CRITICOS';
  const esContrarreloj = ejercicio?.tipo === 'CONTRARRELOJ';
  // Punto extra opcional en la ventana de Contrarreloj — ver el render, más abajo.
  const retoContrarreloj = (ejercicio?.configuracion as { retoContrarreloj?: string } | undefined)
    ?.retoContrarreloj;
  // Ver la nota de IntroInfo: contenido curado, no mecánica — hoy solo lo trae un nodo.
  const introTextoNodo = (ejercicio?.configuracion as { introTexto?: string } | undefined)?.introTexto;
  /* "Patrones de la mano izquierda/derecha": una lista, una tanda por patrón (ver
     generarPorPatronesEnTandas en el backend). El frente reusa esta MISMA lista para
     anunciar, en la ventana entre tandas, cuál combinación viene — no hace falta que el
     backend mande un texto de anuncio aparte. */
  const patronesPorTandaNodo = (ejercicio?.configuracion as { patronesPorTanda?: string[] } | undefined)
    ?.patronesPorTanda;
  /* El corte entre tandas espera un Enter explícito en vez del destello automático de
     1,5s — para "Oraciones con mayúsculas incluidas" (flag explícito) y, desde el
     13-sep-2026, también para cualquier nodo con `patronesPorTanda`: ahí la ventana no
     es un simple "¡Muy bien!", es el anuncio de la próxima combinación, y eso necesita
     que el usuario la lea antes de que el texto cambie debajo. Ver terminarTanda y
     avanzarASiguienteTanda. */
  const esperarEnterEntreTandas = Boolean(
    (ejercicio?.configuracion as { esperarEnterEntreTandas?: boolean } | undefined)
      ?.esperarEnterEntreTandas) || Boolean(patronesPorTandaNodo?.length);
  const esSuddenDeath = ejercicio?.tipo === 'SUDDEN_DEATH';
  const esModoCiego = ejercicio?.tipo === 'MODO_CIEGO';
  const esDictado = ejercicio?.tipo === 'DICTADO_VOZ';
  /* "Dictado de voz sencillo y corto": único nodo, por ahora, donde el punto final no
     hace falta para terminar — se escucha la oración, no se lee, y exigir un carácter
     que nunca se vio ni se dijo en voz alta es pedir algo que el ejercicio no enseñó. */
  const puntoFinalOpcional = Boolean(
    (ejercicio?.configuracion as { puntoFinalOpcional?: boolean } | undefined)?.puntoFinalOpcional);
  const esPalabrasMutantes = ejercicio?.tipo === 'PALABRAS_MUTANTES';
  const esLluviaLetras = ejercicio?.tipo === 'LLUVIA_LETRAS';
  const esPalabrasFlotantes = ejercicio?.tipo === 'DESESTRUCTURA';
  /* Sombra activa = el backend adjuntó el registro de un intento pasado a este
     contenido. Se lee de `ejercicio` (estado) y no del ref de eventos, que al no
     provocar re-render dejaría la cabecera desactualizada. */
  const enSombra = (ejercicio?.fantasmaWpm ?? null) !== null;

  /* ⚠️ AMPLIADO el 13-sep-2026: EL MODO SOMBRA NO SE OFRECE EN NINGÚN NIVEL DEL CURSO.
     Hasta hoy solo se apagaba en Básico ("nivel !== 'BASICO'"); el argumento nunca fue
     exclusivo de Básico, es de CUALQUIER nodo del Curso con un umbral fijo que superar:
     Intermedio exige 32 WPM y Avanzado 45, y ofrecer competir contra un ritmo de 90 —o
     contra tu propio mejor intento— sigue siendo la misma carrera que empuja al error
     que el curso combate (ir más rápido de lo que el nodo pide, sacrificando precisión).
     Para "competir de verdad" ya existe el Área de Entrenamiento (V3): el Curso y el
     Área tienen roles distintos a propósito.

     `nivel` (de useParams) solo viene poblado en las rutas de Curso —Ejercicios Base
     entra por /ejercicios-base/:id, sin nivel— así que "sin nivel" es exactamente
     "estamos en Ejercicios Base", donde el modo sombra se sigue ofreciendo igual.

     Se apaga solo la OFERTA, no la maquinaria: entrar con ?fantasma={sesionId} a mano
     sigue funcionando en cualquier nivel. */
  const ofreceSombra = !nivel;
  const configContrarreloj = ejercicio?.configuracion as unknown as ConfigContrarreloj | undefined;
  // Modo ciego: si además de los colores hay que ocultar el cursor (avanzado) o no
  // (intermedio, donde se deja como ayuda). Default false: sin el campo en la config,
  // el cursor se ve — es el comportamiento de siempre.
  const ocultarCursorCiego = Boolean((ejercicio?.configuracion as { ocultarCursor?: boolean } | undefined)?.ocultarCursor);
  // Shift lateral: de qué mano es cada letra, para saber qué lado de Shift le tocaba.
  // useMemo (no un const suelto) porque handleKeyDown la lleva en sus dependencias:
  // un array nuevo en cada render la recrearía siempre, aunque el ejercicio no cambie.
  const manosShift = useMemo(
    () => (ejercicio?.configuracion?.manos ?? []) as { id: string; letras: string }[],
    [ejercicio],
  );

  /* Modo una mano: tecla de reposo de la mano que NO participa (F/J), según cuál mano
     esté activa ahora mismo. Solo aplica a MODO_UNA_MANO — el resto de los tipos no
     trae "ancla" en su config y esto queda en null, sin efecto. */
  const anclaOtraMano = useMemo(() => {
    if (ejercicio?.tipo !== 'MODO_UNA_MANO') return null;
    const listaManos = (ejercicio.configuracion?.manos ?? []) as { id: string; ancla?: string }[];
    // Mismo default que usa grupoActivo más abajo para MODO_UNA_MANO cuando no se
    // eligió mano todavía: "izquierda".
    const idManoActual = grupo || 'izquierda';
    const manoActual = listaManos.find((m) => m.id === idManoActual) ?? listaManos[0];
    return manoActual?.ancla ?? null;
  }, [ejercicio, grupo]);
  const configDictado = ejercicio?.configuracion as unknown as { modo?: string; wpmObjetivo?: number; archivoUrl?: string } | undefined;

  // Dictado: nunca muestra el texto objetivo (solo se oye), por eso ahí sí se oculta el futuro.
  // Modo ciego es distinto: se ve el texto COMPLETO desde el inicio, como un ejercicio normal —
  // lo que se oculta es el feedback de correcto/incorrecto mientras escribes, no el texto en sí.
  const ocultarTextoFuturo = esDictado;

  const textoRef = useRef('');
  const indiceRef = useRef(0);
  // Espejo de `errores`, mismo motivo que `indiceRef`: handleKeyDown lo necesita LEER
  // (no solo escribir con el updater funcional) y no puede llevar `errores` en sus deps
  // sin arriesgar un cierre viejo entre pulsaciones rápidas.
  const erroresRef = useRef<Set<number>>(new Set());
  const terminadoRef = useRef(false);
  /* TANDAS POR FRASE. El backend manda las oraciones separadas por salto de línea cuando
     el ejercicio lleva `porTandas`; acá se parten y se tecleaN de a una, con un destello
     entre medio. El salto NUNCA llega al texto que se escribe: se descarta al partir.

     Es distinto de los latidos y por eso no los reusa: un latido es una tanda cronometrada
     que decide estrellas y puede activar el quinto intento; esto es solo un corte de
     lectura, sin veredicto, sin Enter y sin pausa que el usuario tenga que resolver. */
  const tandasRef = useRef<string[]>([]);
  const tandaActualRef = useRef(0);
  /* Espejo de tandaActualRef, SOLO para leer en el render (el anuncio de "Ahora: '<patrón>'").
     El ref por sí solo alcanza para toda la lógica de avance porque esa lógica corre en
     manejadores/efectos, nunca en el cuerpo de render — pero leer un ref.current directo
     dentro del JSX es justamente lo que la regla react-hooks/refs prohíbe, así que este
     estado existe nada más para ese único punto de lectura. */
  const [tandaActual, setTandaActual] = useState(0);
  // Contadores al empezar la tanda, para poder medir SU precisión y no la acumulada.
  const tandaInicioRef = useRef({ correctas: 0, presionadas: 0 });
  const [destello, setDestello] = useState<number | null>(null);
  // El destello de "pasaste a fase 2" de Muerte Súbita — el badge de arriba ya cambia de
  // color y texto solo, pero en silencio; esto avisa en el momento, mismo molde visual
  // que DestelloTanda (aparece y se desvanece, no bloquea el tecleo).
  const [avisoFase2, setAvisoFase2] = useState(false);
  /* SOLO para nodos con "esperarEnterEntreTandas" en su config (hoy, únicamente
     "Oraciones con mayúsculas incluidas"): en vez del corte automático de 1,5s que
     usa el resto del Curso, la tanda queda esperando un Enter explícito. El ref
     es lo que lee el listener de teclado (evita el cierre viejo entre
     renders); el estado es lo que decide qué se pinta. */
  const esperandoEnterTandaRef = useRef(false);
  const [esperandoEnterTanda, setEsperandoEnterTanda] = useState(false);
  // Un resultado por frase. La nota del ejercicio es su promedio.
  const resultadosTandasRef = useRef<{ wpm: number; precision: number }[]>([]);
  /* El detalle segundo a segundo de CADA tanda, para el gráfico de Resultados — pedido del
     usuario tras ver que el gráfico de "Progreso de velocidad" solo mostraba la ÚLTIMA
     frase: `progresoRef` se borra en cada `reiniciarProgreso()` entre tanda y tanda (es
     avance normal, no un bug), así que sin este acumulador aparte las tandas anteriores
     nunca llegaban ni al guardado ni al gráfico.

     A PROPÓSITO no viaja al backend ni toca `sesion_progreso`: agregar una columna nueva
     para esto es una migración que no hacía falta para lo que se pidió ("no creo que pese
     mucho... que sea algo temporal"). Vive y muere en `sessionStorage`, igual que
     `resultados_tandas` — se lee una vez en Resultados y se pierde. */
  const progresoPorTandaRef = useRef<(SesionProgresoDTO & { tanda: number })[]>([]);
  const temporizadorTandaRef = useRef<number | null>(null);

  const caracteresCorrectosRef = useRef(0);
  const totalPresionadasRef = useRef(0);
  // La racha más larga de aciertos seguidos en una partida de Lluvia. Solo para mostrarla en
  // Resultados: no puntúa nada, así que no hace falta que la calcule el servidor.
  const mejorRachaLluviaRef = useRef(0);
  // Si la Lluvia terminó por SOBREVIVIR el tiempo (true) o por perder un carril (false).
  // Ver la nota junto a `segundosFinal` más abajo: solo importa para reportar la duración.
  const lluviaSobrevivioRef = useRef(false);
  const inicioPerfRef = useRef(0);
  const ultimoInstanteRef = useRef(0);
  const ordenSecuenciaRef = useRef(0);
  const eventosRef = useRef<TeclaEventoRequest[]>([]);
  const erroresEnPalabraRef = useRef(0);
  // Shift lateral: qué lado está físicamente presionado ahora mismo. Se lee vía
  // KeyboardEvent.code (no .key, que no distingue ShiftLeft de ShiftRight).
  const shiftActivoRef = useRef<'ShiftLeft' | 'ShiftRight' | null>(null);
  // Modo una mano: si la tecla de ancla (la mano que NO escribe) está sostenida ahora
  // mismo. Ref para leerla sin demora dentro de handleKeyDown; estado en paralelo solo
  // para pintar el indicador.
  const anclaPresionadaRef = useRef(false);
  const [anclaActiva, setAnclaActiva] = useState(false);
  const teclasMapRef = useRef<Map<string, TeclaStatsRequest>>(new Map());
  const ngramsMapRef = useRef<Map<string, NgramStatsRequest>>(new Map());
  const progresoRef = useRef<SesionProgresoDTO[]>([]);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  // Espera de 2s en modo ciego antes de ir a resultados (ver el efecto de guardado).
  const temporizadorRevelacionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (temporizadorRevelacionRef.current) clearTimeout(temporizadorRevelacionRef.current);
  }, []);

  const registrarTecla = (tecla: string, correcta: boolean, deltaMs: number) => {
    if (!tecla) return;
    const limpia = tecla.length === 1 ? tecla.toLowerCase() : tecla.toLowerCase().slice(0, 20);
    const ex = teclasMapRef.current.get(limpia) || { tecla: limpia, vecesPresionada: 0, vecesCorrecta: 0, vecesError: 0, tiempoTotalMs: 0 };
    teclasMapRef.current.set(limpia, {
      ...ex,
      vecesPresionada: ex.vecesPresionada + 1,
      vecesCorrecta: correcta ? ex.vecesCorrecta + 1 : ex.vecesCorrecta,
      vecesError: !correcta ? ex.vecesError + 1 : ex.vecesError,
      tiempoTotalMs: ex.tiempoTotalMs + deltaMs,
    });
  };

  const registrarNgram = (secuencia: string, tipo: 'BIGRAMA' | 'TRIGRAMA', error: boolean) => {
    const ex = ngramsMapRef.current.get(secuencia) || { secuencia, tipo, totalIntentos: 0, errores: 0, tiempoTotalMs: 0 };
    ngramsMapRef.current.set(secuencia, { ...ex, totalIntentos: ex.totalIntentos + 1, errores: error ? ex.errores + 1 : ex.errores });
  };

  const aplicarContenido = (data: EjercicioContenidoResponse) => {
    setEjercicio(data);

    /* Con latidos, el texto que se teclea es el del PRIMER latido, no el campo `texto`
       entero. El backend manda ahí el primero justamente para que un cliente que no
       entienda los latidos siga recibiendo un ejercicio válido. */
    /* Se parte ANTES de pintar nada. Si el salto de línea llegara al texto, sería una
       pulsación de Enter —que cuenta como error, está pegada a la Ñ— en medio de la frase. */
    /* ⚠️ La LLUVIA queda fuera: desde el 19-sep-2026 su texto también puede traer saltos de
       línea, pero ahí no son tandas sino TRAMOS que la propia vista reparte en el tiempo
       (ver VistaLluviaLetras). Partiéndolos acá, el nodo serviría un tercio del contenido y
       encima con el destello de "¡Muy bien!" apareciendo en medio de un juego. */
    const tandas = data.tipo !== 'LLUVIA_LETRAS' && (data.texto ?? '').includes(SALTO_DE_TANDA)
      ? data.texto.split(SALTO_DE_TANDA).map((t) => t.trim()).filter(Boolean)
      : [];
    tandasRef.current = tandas;
    tandaActualRef.current = 0;
    setTandaActual(0);
    resultadosTandasRef.current = [];
    progresoPorTandaRef.current = [];
    setDestello(null);

    const conLatidos = (data.latidos?.length ?? 0) > 0;
    latidosRef.current = data.latidos ?? [];
    umbralesLatidoRef.current = data.umbralesLatido ?? null;
    setLatidosVista((data.latidos ?? []).map((l) => ({ nombre: l.nombre, descripcion: l.descripcion })));
    resultadosLatidosRef.current = [];
    tiempoNodoMsRef.current = 0;
    indiceLatidoRef.current = 0;
    setIndiceLatido(0);
    porUltimoIntentoRef.current = false;
    setEnUltimoIntento(false);
    /* El tutorial se muestra en TODOS los ejercicios que lo traen, no solo la primera vez:
       decisión del usuario, y se salta con Enter en un gesto.

       ⚠️ Ya NO exige latidos. Lo pedía porque hasta ahora solo lo tenía Fundamentos, y eso
       dejaba fuera al primer nodo de palabras, que no tiene latidos y sí tutorial. La
       condición correcta es la única que importa: que el backend haya mandado ítems.

       Los RECORRIDOS del Curso también abren con una ventana —"sube y baja en diagonal"—,
       aunque sin ítems que teclear: usan la misma fase porque necesitan lo mismo que el
       tutorial, un ejercicio que no escucha el teclado hasta que se cierre. Solo con
       latidos, o sea solo en el Curso: en Ejercicios Base cada cambio de dedo recarga el
       contenido y la ventana saldría otra vez con cada botón. */
    const esRecorridoDelCurso = data.tipo === 'UN_DEDO' && conLatidos;
    /* Dos ventanas más que abren en fase 'tutorial', las dos con IntroInfo:
       - Cualquier CONTRARRELOJ, siempre: la mecánica del bono/penalización tampoco se
         deduce del texto, mismo motivo que ya tiene la Lluvia (ver IntroLluvia).
       - Un ejercicio con `introTexto` en su configuración — hoy solo "Oraciones con las
         teclas nuevas", pero el campo es genérico: cualquier nodo puede traerlo. */
    const esContrarrelojDelCurso = data.tipo === 'CONTRARRELOJ';
    const introTexto = (data.configuracion as { introTexto?: string } | undefined)?.introTexto;
    /* "Patrones de la mano izquierda/derecha": también abren en 'tutorial', para anunciar
       cuál es la PRIMERA combinación antes de escribir nada — las siguientes se anuncian
       entre tandas (ver esperandoEnterTanda, más abajo). */
    const patronesPorTandaData = (data.configuracion as { patronesPorTanda?: string[] } | undefined)
      ?.patronesPorTanda;
    const fase = ((data.teclasTutorial?.length ?? 0) > 0 || esRecorridoDelCurso
      || esContrarrelojDelCurso || Boolean(introTexto) || Boolean(patronesPorTandaData?.length))
      ? 'tutorial' : 'latido';
    faseNodoRef.current = fase;
    setFaseNodo(fase);

    /* TODOS los textos del nodo, no solo el que se teclea ahora: la pista tiene que saber
       que la `w` sí entra en este nodo aunque todavía no haya aparecido en la primera
       tanda, o avisaría de una tecla que el ejercicio sí usa. */
    conjuntoNodoRef.current = conjuntoDelNodo([
      data.texto,
      ...tandas,
      ...(data.latidos ?? []).map((l) => l.texto),
      ...(data.teclasTutorial ?? []),
    ]);
    shiftEnsenadoRef.current = false;
    setShiftEnsenado(false);
    setPista(null);

    const primerTexto = conLatidos ? data.latidos![0].texto
      : (tandas.length > 0 ? tandas[0] : data.texto);
    setTexto(primerTexto);
    textoRef.current = primerTexto;
    fantasmaEventosRef.current = data.fantasmaEventos ?? null;
    setGhostIndice(-1);
    setFantasmaEsSimulado(false);
    anclaPresionadaRef.current = false;
    setAnclaActiva(false);
    faseSuddenDeathRef.current = 'primera';
    setFaseSuddenDeath('primera');
    caracteresCorrectosGlobalRef.current = 0;
    totalPresionadasGlobalRef.current = 0;
    tiempoGlobalMsRef.current = 0;
    fase1ResultadoRef.current = null;
    fase2ResultadoRef.current = null;
    const cfg = data.configuracion as unknown as ConfigContrarreloj;
    const tiempoInicial = data.tipo === 'CONTRARRELOJ' ? (cfg.tiempoInicialSegundos ?? 30) * 1000 : 0;
    setTiempoMs(tiempoInicial);
    tiempoMsRef.current = tiempoInicial;
    setTranscurridoMs(0);
    transcurridoMsRef.current = 0;
  };

  /* Retoma el nodo donde estaba antes de recargar. Corre SIEMPRE después de
     aplicarContenido y solo pisa lo que hace falta: la POSICIÓN y la analítica.

     EL CONTENIDO ES EL RECIÉN GENERADO, no el que había antes de recargar. Es lo que pidió
     el usuario y tiene su motivo: repetir la misma cadena de letras se memoriza, y un drill
     memorizado deja de entrenar dónde está cada tecla para entrenar una secuencia. Una
     tanda nueva del mismo plan mide exactamente lo mismo sin ese atajo.

     Ver core/curso/estadoNodo.ts para cuándo existe un estado que restaurar. */
  const restaurarNodo = (estado: EstadoNodo) => {
    const totalLatidos = latidosRef.current.length;
    const totalTandas = tandasRef.current.length;

    /* Los índices se acotan contra el contenido NUEVO. "f j" tiene tres latidos y el resto
       cuatro, así que un índice guardado siempre podría caer fuera si algo cambia entre una
       carga y la siguiente; acotar es más barato que descartar el estado entero. */
    const indice = totalLatidos > 0 ? Math.min(estado.indiceLatido, totalLatidos - 1) : 0;
    indiceLatidoRef.current = indice;
    setIndiceLatido(indice);
    resultadosLatidosRef.current = estado.resultadosLatidos;
    tiempoNodoMsRef.current = estado.tiempoNodoMs;

    const tanda = totalTandas > 0 ? Math.min(estado.tandaActual, totalTandas - 1) : 0;
    tandaActualRef.current = tanda;
    setTandaActual(tanda);
    resultadosTandasRef.current = estado.resultadosTandas;

    // Los Map se reconstruyen desde la lista de valores: la clave es un campo del propio
    // registro, así que no hace falta guardarla dos veces.
    teclasMapRef.current = new Map(estado.teclas.map((t) => [t.tecla, t]));
    ngramsMapRef.current = new Map(estado.ngrams.map((n) => [n.secuencia, n]));

    setGrupo(estado.grupo);
    grupoRef.current = estado.grupo;

    // El tutorial no se repite: retomar es volver a la TANDA, no a la explicación.
    faseNodoRef.current = 'latido';
    setFaseNodo('latido');

    const texto = totalLatidos > 0
      ? latidosRef.current[indice]?.texto
      : (totalTandas > 0 ? tandasRef.current[tanda] : undefined);
    if (texto) {
      setTexto(texto);
      textoRef.current = texto;
    }
    setRetomado(true);

    /* El QUINTO latido no viaja con los otros cuatro —se pide aparte, porque la mayoría de
       los nodos no llega hasta ahí—, así que si la recarga ocurrió en él hay que volver a
       pedirlo. Si la petición falla se queda en el último latido normal, que es un estado
       válido: perder la conexión no puede dejar al usuario en un ejercicio sin salida. */
    if (estado.porUltimoIntento && id) {
      obtenerUltimoIntento(Number(id), estado.grupo || undefined)
        .then((latido) => {
          if (!latido) return;
          latidosRef.current = [...latidosRef.current, latido];
          setLatidosVista((v) => [...v, { nombre: latido.nombre, descripcion: latido.descripcion }]);
          const ultimo = latidosRef.current.length - 1;
          indiceLatidoRef.current = ultimo;
          setIndiceLatido(ultimo);
          porUltimoIntentoRef.current = true;
          setEnUltimoIntento(true);
          setTexto(latido.texto);
          textoRef.current = latido.texto;
        })
        .catch(() => { /* se retoma el último latido normal, ya puesto arriba */ });
    }
  };

  /* Solo para recargas posteriores (repetir, cambiar de grupo): la carga inicial vive
     en su propio efecto, más abajo. Por eso acá sí se enciende el spinner. */
  const cargar = useCallback((grupoPedido?: string) => {
    if (!id) return;
    setCargando(true);
    obtenerContenidoEjercicio(Number(id), grupoPedido ?? grupoRef.current)
      .then(aplicarContenido)
      .catch(() => navigate('/ejercicios-base'))
      .finally(() => setCargando(false));
  }, [id, navigate]);

  // Sudden death fase 2: trae una oración nueva SIN mostrar el spinner de página completa
  // (no toca `cargando`/`ejercicio`, solo cambia el texto activo a mitad de la práctica).
  const cargarNuevaOracion = useCallback(() => {
    if (!id) return;
    // Con el grupo: si no, la fase 2 traería oraciones del banco por defecto en vez
    // de la categoría que el usuario eligió (cortas / medias / largas).
    obtenerContenidoEjercicio(Number(id), grupoRef.current)
      .then((data) => {
        setTexto(data.texto);
        textoRef.current = data.texto;
        /* El fantasma se apaga acá a propósito. Sus eventos guardan índices sobre el
           texto CON EL QUE SE GRABÓ, y en fase 2 el texto cambia por debajo: dejarlo
           vivo hacía que el cursor rival avanzara sobre una oración que ya no existe,
           pintando como "ya pasó por acá" tramos al azar de la oración nueva. */
        fantasmaEventosRef.current = null;
        setGhostIndice(-1);
      })
      /* Si falla, la fase 2 sigue con la oración anterior: mejor que cortar el ejercicio.
         Pero que quede rastro, o el día que pase no hay de dónde tirar. */
      .catch((error) => console.warn('No se pudo traer la oración de la fase 2:', error));
  }, [id]);

  /* Si el rival no se puede cargar (sesión borrada, de otro ejercicio, o guardada antes
     de que se empezara a guardar el texto exacto) NO se expulsa al usuario de la
     pantalla, que es lo que hacía navigate('/ejercicios-base') y dejaba la sensación de que el
     ejercicio estaba roto. Se cae con gracia al ejercicio normal y se avisa. */
  const cargarConFantasma = useCallback((sesionId: number) => {
    if (!id) return;
    setCargando(true);
    obtenerContenidoConFantasma(Number(id), sesionId)
      /* El aviso se limpia acá dentro y no antes de la llamada: un setState síncrono en
         el cuerpo de esta función la vuelve inservible desde un efecto
         (react-hooks/set-state-in-effect), que es justo desde donde la llama la entrada
         por ?fantasma={sesionId}. */
      .then((data) => {
        aplicarContenido(data);
        setAvisoRival('');
      })
      .catch(() => {
        setAvisoRival('No se pudo cargar tu intento anterior: corres sin sombra.');
        return obtenerContenidoEjercicio(Number(id), grupoRef.current).then(aplicarContenido);
      })
      .catch(() => navigate('/ejercicios-base'))
      .finally(() => setCargando(false));
  }, [id, navigate]);

  /* Fantasma simulado: no depende de tener un intento previo — cualquier ejercicio de
     Ejercicios Base puede correrse contra un WPM inventado. `aplicarContenido` ya deja
     `fantasmaEsSimulado` en false por defecto; acá se pisa a true justo después,
     ambos updates quedan en el mismo tick. */
  const cargarConFantasmaSimulado = useCallback((wpm: number) => {
    if (!id) return;
    setCargando(true);
    obtenerContenidoConFantasmaSimulado(Number(id), wpm, grupoRef.current)
      .then((data) => {
        aplicarContenido(data);
        setFantasmaEsSimulado(true);
        setAvisoRival('');
      })
      .catch(() => navigate('/ejercicios-base'))
      .finally(() => setCargando(false));
  }, [id, navigate]);

  /* Entrada directa: al abrir un ejercicio se carga y punto. La pantalla que preguntaba
     "¿contra qué fantasma quieres correr?" se quitó a pedido, y el endpoint del
     historial sigue vivo para la sección aparte que viene después.

     ?fantasma={sesionId} en la URL sigue funcionando (es lo que enlazará esa sección),
     pero ya no es el único camino: el botón de sombra usa el rival que elige el backend.

     Esta carga NO pasa por cargar()/cargarConFantasma(): las dos ponen `cargando` en
     true de entrada, y eso es un setState síncrono dentro del efecto — el error de
     react-hooks/set-state-in-effect que arrastraba este archivo. Acá no hace falta,
     porque `cargando` ya nace en true y todo el estado se toca dentro de las promesas. */
  useEffect(() => {
    if (!id) return;
    let vigente = true;
    const fantasmaId = new URLSearchParams(window.location.search).get('fantasma');

    const peticion = fantasmaId
      ? obtenerContenidoConFantasma(Number(id), Number(fantasmaId)).catch(() => {
          // Mismo criterio que el botón: si el rival no carga, se corre sin sombra en
          // vez de expulsar al usuario de la pantalla.
          setAvisoRival('No se pudo cargar tu intento anterior: corres sin sombra.');
          return obtenerContenidoEjercicio(Number(id), grupoRef.current);
        })
      : obtenerContenidoEjercicio(Number(id), grupoRef.current);

    peticion
      .then((data) => {
        if (!vigente) return;
        aplicarContenido(data);
        /* Y si veníamos de una recarga, se pisa con lo que había. Se consulta DESPUÉS de
           aplicar el contenido nuevo y no antes porque `restaurarEstadoNodo` consume la
           entrada: leerla y luego no poder usarla la perdería para siempre. */
        const guardado = restaurarEstadoNodo(Number(id));
        if (guardado) restaurarNodo(guardado);
      })
      .catch(() => { if (vigente) navigate('/ejercicios-base'); })
      .finally(() => { if (vigente) setCargando(false); });

    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* GUARDA EL NODO CUANDO LA PÁGINA SE VA. Solo en `pagehide`, que se dispara al recargar
     o cerrar y NO cuando la app navega a otra ruta — que es lo que separa "reinicio" de
     "me salí del ejercicio". La explicación larga está en core/curso/estadoNodo.ts. */
  useEffect(() => {
    if (!id) return;
    const guardar = () => {
      // Sin empezar (tutorial) o ya terminado no hay nada que retomar.
      if (faseNodoRef.current === 'tutorial' || terminadoRef.current) return;
      if (latidosRef.current.length === 0 && tandasRef.current.length === 0) return;

      /* Con el resumen abierto, el último resultado es del latido que se va a REHACER: la
         transición al siguiente todavía está pendiente, así que `indiceLatido` sigue
         apuntando al que acaba de terminar. Guardarlo dejaría ese latido contado dos veces
         en el promedio. `tiempoNodoMs` sí se queda con lo suyo — no se guarda el tiempo de
         cada latido por separado, así que retomar ahí suma unos segundos de más. */
      const enResumen = pendienteRef.current !== null;
      const resultados = enResumen
        ? resultadosLatidosRef.current.slice(0, -1)
        : resultadosLatidosRef.current;

      guardarEstadoNodo({
        ejercicioId: Number(id),
        grupo: grupoRef.current,
        indiceLatido: indiceLatidoRef.current,
        resultadosLatidos: resultados,
        tiempoNodoMs: tiempoNodoMsRef.current,
        porUltimoIntento: porUltimoIntentoRef.current,
        tandaActual: tandaActualRef.current,
        resultadosTandas: resultadosTandasRef.current,
        teclas: [...teclasMapRef.current.values()],
        ngrams: [...ngramsMapRef.current.values()],
      });
    };
    window.addEventListener('pagehide', guardar);
    return () => window.removeEventListener('pagehide', guardar);
  }, [id]);

  /* Los nodos del nivel, cada vez que se entra a un ejercicio (la vista se vuelve a montar
     por ejercicio, así que esto corre una vez por cada uno). Tienen que estar frescos: el
     bloqueo del Test Final depende de las estrellas, y esas cambian justo entre un ejercicio
     y el siguiente. Las flechas de desarrollo aprovechan la misma respuesta. */
  useEffect(() => {
    if (!nivel) return;

    /* EN MAYÚSCULA, siempre. La URL del Curso llega en minúscula porque `CursoSelectorView`
       navega con `n.id.toLowerCase()`, y `/curso/{nivel}/progreso` hace `NivelCurso.valueOf()`:
       con "basico" revienta con 500. `CursoNivelView` ya normaliza igual en su línea 23.

       Esto costó una sesión entera de depuración: escribiendo la URL a mano en mayúsculas todo
       funcionaba, y entrando por la interfaz —que es lo que hace el usuario— las flechas no
       hacían nada y no avisaban. */
    const nivelApi = nivel.toUpperCase() as NivelCurso;
    const clave = `curso_secuencia_${nivelApi}`;

    /* El caché no es una optimización: es lo que hace que las flechas funcionen SIEMPRE. Sin él
       dependen de que una petición asíncrona haya vuelto, así que en la primera carga —o con la
       red lenta, o si el backend contesta mal— la tecla no hace nada y no avisa. Con el valor
       guardado, a partir de la primera vez que se abre el nivel la lista ya está.

       sessionStorage y no localStorage: si el catálogo cambia entre sesiones, una lista vieja
       sería mentira. */
    const guardado = sessionStorage.getItem(clave);
    if (guardado) {
      try {
        secuenciaNivelRef.current = JSON.parse(guardado) as number[];
      } catch {
        sessionStorage.removeItem(clave);
      }
    }

    let vigente = true;
    obtenerProgresoCursoPorNivel(nivelApi)
      .then((lista) => {
        if (!vigente) return;
        setNodosNivel(lista);
        // DESARROLLO: la secuencia para las flechas, con su caché.
        const ids = lista.map((n) => n.ejercicioId);
        secuenciaNivelRef.current = ids;
        sessionStorage.setItem(clave, JSON.stringify(ids));
      })
      .catch((e) => {
        /* Se avisa en consola en vez de fallar callado: una flecha que no hace nada es
           indistinguible de una flecha no implementada, y eso ya costó una sesión de
           depuración. No se vacía el ref — si había caché, sigue sirviendo. Y el bloqueo
           del Test Final se levanta (null): ver la nota de `nodosNivel`. */
        if (vigente) setNodosNivel(null);
        console.warn('No se pudo cargar el progreso del nivel: sin bloqueo del Test Final '
          + 'ni flechas de desarrollo.', e);
      });
    return () => { vigente = false; };
  }, [nivel]);

  /* ¿Hay contra quién correr? Se pregunta una vez por ejercicio. El backend devuelve
     null mientras no exista un intento tuyo que sirva de rival, así que lo normal las
     primeras veces es que el botón de sombra ni siquiera aparezca. */
  useEffect(() => {
    if (!id) return;
    let vigente = true;
    obtenerRivalSombra(Number(id))
      .then((r) => { if (vigente) setRival(r); })
      .catch(() => { if (vigente) setRival(null); });
    return () => { vigente = false; };
  }, [id]);

  // Dictado (modo TTS): el navegador lee el texto en voz alta. La velocidad se calcula
  // a partir del WPM objetivo configurado (una síntesis "normal" ronda ~70 WPM en rate=1).
  const reproducirDictado = useCallback(() => {
    if (!ejercicio || configDictado?.modo !== 'tts') return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textoRef.current);
    utterance.lang = 'es-ES';
    const wpmObjetivo = configDictado?.wpmObjetivo ?? 60;
    utterance.rate = Math.min(2, Math.max(0.5, wpmObjetivo / 70));
    window.speechSynthesis.speak(utterance);
  }, [ejercicio, configDictado]);

  useEffect(() => {
    if (ejercicio && esDictado && configDictado?.modo === 'tts') {
      reproducirDictado();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ejercicio]);

  /* `conservarAnalitica` mantiene los mapas de teclas y n-gramas entre latidos. El nodo
     entero es UNA sesión, así que sus pulsaciones se suman: da mejores datos que hoy, no
     peores, porque son cuatro tandas en vez de una. Muerte súbita sigue llamándola sin el
     parámetro, y ahí sí se borra todo — son intentos distintos del mismo texto. */
  const reiniciarProgreso = useCallback((conservarAnalitica = false) => {
    setIndice(0);
    indiceRef.current = 0;
    /* El fantasma vuelve a la salida con el usuario. Sin esto, al reiniciar en Muerte
       Súbita el rival se quedaba clavado en el índice alto donde iba, y como el
       intervalo solo recalcula mientras `corriendo` es true, todo el texto reescrito se
       pintaba en cian/40 ("el fantasma ya pasó por acá") hasta la siguiente pulsación. */
    setGhostIndice(-1);
    anclaPresionadaRef.current = false;
    setAnclaActiva(false);
    setErrores(new Set());
    erroresRef.current = new Set();
    setCorregidosTrasFallar(new Set());
    setCaracteresCorrectos(0);
    caracteresCorrectosRef.current = 0;
    setTotalPresionadas(0);
    totalPresionadasRef.current = 0;
    ordenSecuenciaRef.current = 0;
    eventosRef.current = [];
    ultimoInstanteRef.current = 0;
    erroresEnPalabraRef.current = 0;
    if (!conservarAnalitica) {
      teclasMapRef.current = new Map();
      ngramsMapRef.current = new Map();
    }
    progresoRef.current = [];
    inicioPerfRef.current = performance.now();
    // "Repites de cero" incluye el cronómetro: si no, el intento exitoso final
    // arrastraría el tiempo de los intentos fallidos y el WPM saldría inflado.
    // (Esto es solo el contador POR INTENTO — el acumulador global de más abajo
    // sigue sumando aparte, sin resetearse nunca, para el promedio "general".)
    setTiempoMs(0);
    setTranscurridoMs(0);
    transcurridoMsRef.current = 0;
    tiempoMsRef.current = 0;
    setCorriendo(false);
  }, []);

  useEffect(() => () => {
    if (temporizadorTandaRef.current) window.clearTimeout(temporizadorTandaRef.current);
  }, []);

  /* La pista se va sola. Dura poco a propósito: es una corrección al vuelo, no un cartel
     que haya que cerrar, y si se quedara puesta el usuario dejaría de mirarla. El
     `setPista` vive dentro del temporizador y no en el cuerpo del efecto, que es lo que
     pide react-hooks/set-state-in-effect. */
  useEffect(() => {
    if (!pista) return;
    const t = window.setTimeout(() => setPista(null), DURACION_PISTA_MS);
    return () => window.clearTimeout(t);
  }, [pista]);

  /* Cambia al texto de la tanda siguiente y reinicia cursor, contadores y cronómetro.
     Factorizado el 13-sep-2026 para que lo llamen dos caminos: el corte automático de
     siempre (setTimeout de 1,5s, ver terminarTanda) y el listener de Enter que usa
     "esperarEnterEntreTandas" — hoy solo "Oraciones con mayúsculas incluidas". Antes
     esto vivía inline dentro del setTimeout; separado, ninguno de los dos caminos
     puede desincronizarse del otro. */
  const avanzarASiguienteTanda = useCallback(() => {
    const tandas = tandasRef.current;
    const siguienteTanda = tandaActualRef.current + 1;
    tandaActualRef.current = siguienteTanda;
    setTandaActual(siguienteTanda);
    tandaInicioRef.current = {
      correctas: caracteresCorrectosRef.current,
      presionadas: totalPresionadasRef.current,
    };
    const txt = tandas[siguienteTanda];
    setTexto(txt);
    textoRef.current = txt;

    /* A CERO: cursor, contadores y cronómetro. `reiniciarProgreso(true)` hace
       exactamente eso conservando los mapas de teclas y n-gramas, que son del nodo
       entero y alimentan el análisis de debilidades. Es la misma llamada que usan
       los latidos entre tanda y tanda. */
    reiniciarProgreso(true);

    /* ⚠️ `errores` es un Set de ÍNDICES, no de caracteres, y por eso TIENE que
       limpiarse al cambiar de frase — lo hace reiniciarProgreso. Sin eso, al teclear
       la segunda tanda bien se pintaban de rojo justo los índices fallados en la
       primera, y como el pintado solo mira `i < indice` el fallo era invisible hasta
       pasar por encima: parecía que el ejercicio marcaba mal caracteres correctos. */
    setDestello(null);
    esperandoEnterTandaRef.current = false;
    setEsperandoEnterTanda(false);
    enPausaRef.current = false;
  }, [reiniciarProgreso]);

  /* El Enter que avanza de tanda en los nodos con "esperarEnterEntreTandas". Listener
     propio, mismo patrón que IntroInfo: el manejador principal de teclado ignora TODA
     tecla mientras enPausaRef está activo (Enter incluido), así que colgarse de ahí
     no serviría. */
  useEffect(() => {
    if (!esperandoEnterTanda) return;
    const manejar = (e: KeyboardEvent) => {
      if (e.repeat || e.key !== 'Enter') return;
      e.preventDefault();
      avanzarASiguienteTanda();
    };
    window.addEventListener('keydown', manejar);
    return () => window.removeEventListener('keydown', manejar);
  }, [esperandoEnterTanda, avanzarASiguienteTanda]);

  /* Se acabó una FRASE de las encadenadas. Si queda otra: destella, cambia el texto por
     debajo y sigue la misma sesión — el reloj no se para y los contadores no se borran,
     porque las tres frases son un solo ejercicio.

     Devuelve true si se encargó (o sea: NO hay que terminar el ejercicio todavía). */
  const terminarTanda = useCallback((): boolean => {
    const tandas = tandasRef.current;
    if (tandas.length === 0) return false;

    /* CADA FRASE SE MIDE POR SEPARADO y la nota del ejercicio es el promedio.

       Antes los contadores eran acumulados y el reloj no paraba durante el destello:
       segundo y medio de pausa por corte, tres cortes, y el WPM bajaba sin que el
       usuario estuviera haciendo nada. Con la medición por tanda ese tiempo muerto
       queda fuera de las tres cuentas.

       Es el mismo criterio que ya usan los latidos: cada tanda es un intento con su
       propia nota. La diferencia es qué se promedia — los latidos toman los dos
       últimos porque van de menos a más difícil, y aquí las tres frases son del mismo
       nivel, así que entran las tres. */
    const seg = Math.max(1, transcurridoMsRef.current / 1000);
    const precisionTanda = totalPresionadasRef.current > 0
      ? (caracteresCorrectosRef.current / totalPresionadasRef.current) * 100
      : 100;
    resultadosTandasRef.current = [...resultadosTandasRef.current, {
      wpm: Math.round((caracteresCorrectosRef.current / 5) / (seg / 60)),
      precision: Number(precisionTanda.toFixed(2)),
    }];
    /* Y su tiempo al del NODO, antes de que reiniciarProgreso lo ponga a cero. El guardado
       lee la duración de este acumulador —igual que los latidos— y hasta el 10-sep-2026
       nadie lo sumaba en las tandas: los nodos por frases se guardaban con 1 segundo (13
       sesiones medidas, a 60-76 WPM), lo que falseaba "Tiempo total" y la sesión más larga,
       y dejaba esos nodos fuera de las estadísticas globales por el piso de 10 s. */
    tiempoNodoMsRef.current += transcurridoMsRef.current;

    const actual = tandaActualRef.current;
    /* Snapshot ANTES de que `reiniciarProgreso()` (en `avanzarASiguienteTanda`, y también
       en el cierre del ejercicio si esta era la última) borre `progresoRef`: es la única
       oportunidad de conservar el detalle de ESTA tanda. Ver la nota junto a
       `progresoPorTandaRef`. */
    progresoPorTandaRef.current = [
      ...progresoPorTandaRef.current,
      ...progresoRef.current.map((p) => ({ ...p, tanda: actual })),
    ];
    if (actual >= tandas.length - 1) return false;   // era la última: cierra el ejercicio

    setDestello(precisionTanda);
    // El reloj se para: la pausa del destello no es tiempo de tecleo de nadie.
    setCorriendo(false);

    /* El teclado se apaga durante el destello. Sin esto, seguir escribiendo mientras el
       texto se cambia por debajo mete las pulsaciones en la frase equivocada — el mismo
       fallo que ya tuvimos con el tutorial de teclas. */
    enPausaRef.current = true;

    /* ⚠️ AGREGADO el 13-sep-2026, SOLO detrás de "esperarEnterEntreTandas": el corte
       automático de siempre (setTimeout de 1,5s) queda para todo el resto del Curso
       sin tocar un pelo. Este nodo en particular espera un Enter explícito — pedido
       del usuario, ver avanzarASiguienteTanda() y el listener de teclado más abajo. */
    if (esperarEnterEntreTandas) {
      esperandoEnterTandaRef.current = true;
      setEsperandoEnterTanda(true);
    } else {
      temporizadorTandaRef.current = window.setTimeout(avanzarASiguienteTanda, DURACION_DESTELLO_MS);
    }

    return true;
  }, [esperarEnterEntreTandas, avanzarASiguienteTanda]);

  // El destello dura lo que su animación: si se cambiara uno hay que cambiar el otro.
  /* Se acabó un latido. Decide si viene otro, si el nodo está aprobado, o si toca el
     último intento. Sigue el mismo patrón que Muerte Súbita, que ya cerraba una fase y
     cargaba la siguiente sin guardar sesión.

     Devuelve true si se encargó (o sea: NO hay que terminar el ejercicio todavía). */
  const terminarLatido = useCallback((): boolean => {
    if (latidosRef.current.length === 0) return false;

    // La marca de ESTE latido, antes de que reiniciarProgreso ponga los contadores a cero.
    const seg = Math.max(1, Math.floor(transcurridoMsRef.current / 1000));
    const resultado: ResultadoLatido = {
      wpm: Math.round((caracteresCorrectosRef.current / 5) / (seg / 60)),
      precision: totalPresionadasRef.current > 0
        ? Number(((caracteresCorrectosRef.current / totalPresionadasRef.current) * 100).toFixed(2))
        : 100,
    };
    resultadosLatidosRef.current = [...resultadosLatidosRef.current, resultado];
    tiempoNodoMsRef.current += transcurridoMsRef.current;

    /* Un nodo con latidos siempre trae sus umbrales (lo comprueba un test del catálogo).
       Si faltaran —un backend anterior al 19-sep-2026— no hay con qué decidir entre
       tandas: el nodo termina acá y el servidor lo puntúa con sus propias reglas. Nada de
       números de respaldo escritos aquí, que es justo la copia que se quitó. */
    const umbrales = umbralesLatidoRef.current;
    if (!umbrales) {
      console.error('El nodo trae latidos pero no sus umbrales: se termina sin decidir entre tandas.');
      return false;
    }

    // El quinto latido lo decide él solo: no se promedia con los cuatro fallos.
    if (porUltimoIntentoRef.current) {
      decidirUltimoIntento(resultado, umbrales); // el veredicto real lo da el servidor
      return false;                              // en los dos casos el nodo termina acá
    }

    const decision = decidirSiguiente(
      resultadosLatidosRef.current, indiceLatidoRef.current, latidosRef.current.length,
      umbrales,
      /* "Un dedo" no salta: cada tanda es un dedo distinto, no una versión más difícil de
         la misma — ir bien en los dos primeros no dice nada de los dos que faltan. */
      !esUnDedo);

    /* Pausa. La transición queda guardada en `pendienteRef` y se ejecuta cuando el
       usuario pulsa Enter en el resumen — no antes: si el latido siguiente se cargara ya,
       el texto de fondo cambiaría detrás de la ventana y se vería el cambio al cerrarla. */
    const pausar = (cierre: CierreLatido, alContinuar: () => void) => {
      enPausaRef.current = true;
      pendienteRef.current = alContinuar;
      setResumen({
        nombre: latidosRef.current[indiceLatidoRef.current]?.nombre ?? '',
        indice: indiceLatidoRef.current,
        total: latidosRef.current.length,
        wpm: resultado.wpm,
        precision: resultado.precision,
        aciertos: caracteresCorrectosRef.current,
        cierre,
        umbrales,
      });
    };

    if (decision === 'siguiente') {
      pausar('siguiente', () => {
        const siguiente = indiceLatidoRef.current + 1;
        indiceLatidoRef.current = siguiente;
        setIndiceLatido(siguiente);
        const texto = latidosRef.current[siguiente].texto;
        reiniciarProgreso(true);
        setTexto(texto);
        textoRef.current = texto;
      });
      return true;
    }

    if (decision === 'ultimo-intento') {
      /* Se pide al servidor, que no lo manda con los otros cuatro: la mayoría de los nodos
         no llegan hasta acá y generarlo siempre sería contenido que se descarta. */
      obtenerUltimoIntento(Number(id), grupoRef.current || undefined)
        .then((latido) => {
          if (!latido) { terminadoRef.current = true; setTerminado(true); return; }
          latidosRef.current = [...latidosRef.current, latido];
          setLatidosVista((v) => [...v, { nombre: latido.nombre, descripcion: latido.descripcion }]);
          pausar('ultimo-intento', () => {
            porUltimoIntentoRef.current = true;
            setEnUltimoIntento(true);
            const siguiente = indiceLatidoRef.current + 1;
            indiceLatidoRef.current = siguiente;
            setIndiceLatido(siguiente);
            reiniciarProgreso(true);
            setTexto(latido.texto);
            textoRef.current = latido.texto;
          });
        })
        .catch(() => {
          /* Sin quinto latido el nodo se cierra con lo que hay: el servidor lo evaluará
             como no superado, que es el resultado correcto. Perder la conexión no puede
             dejar al usuario atrapado en un ejercicio sin salida. */
          terminadoRef.current = true;
          setTerminado(true);
        });
      return true;
    }

    /* 'aprobado' con latidos por delante = salió por la puerta de 35 WPM y 95%. Merece su
       propia ventana: saltarse dos tandas sin que nadie lo explique se lee como que el
       ejercicio se cortó solo. Cuando ya era el último latido no se pausa — ahí la
       pantalla de resultados llega enseguida y una ventana antes sería un paso de más. */
    if (indiceLatidoRef.current + 1 < latidosRef.current.length) {
      pausar('aprobado', () => {
        terminadoRef.current = true;
        setTerminado(true);
      });
      return true;
    }

    return false; // el nodo termina, que lo guarde el flujo normal
  }, [id, reiniciarProgreso, esUnDedo]);

  /* Cerrar el resumen: ejecuta la transición que quedó pendiente y devuelve el teclado al
     ejercicio. */
  const continuarTrasResumen = useCallback(() => {
    const seguir = pendienteRef.current;
    pendienteRef.current = null;
    enPausaRef.current = false;
    setResumen(null);
    seguir?.();
  }, []);

  // Cronómetro: sube (normal) o baja (contrarreloj), en pasos de 100ms para que los
  // centesimas se vean fluidos.
  useEffect(() => {
    if (!corriendo || terminado) return;
    intervaloRef.current = setInterval(() => {
      // Modo sombra: dónde iba el fantasma en este instante, según su propio registro.
      if (fantasmaEventosRef.current) {
        const elapsed = performance.now() - inicioPerfRef.current;
        let idx = 0;
        for (const ev of fantasmaEventosRef.current) {
          if (ev.tiempoDesdeInicioMs <= elapsed) idx = ev.indiceResultante;
          else break;
        }
        setGhostIndice(idx);
      }
      // Acumulador global: suma sin importar reinicios, para el promedio "general"
      // de Sudden Death (que sí cuenta el tiempo perdido en los intentos fallidos).
      tiempoGlobalMsRef.current += 100;

      /* El transcurrido se lleva en un ref además del estado porque el updater de
         setTiempoMs necesita leerlo en el mismo tick, y ahí un estado todavía tiene el
         valor viejo. */
      transcurridoMsRef.current += 100;
      const transcurrido = transcurridoMsRef.current;
      setTranscurridoMs(transcurrido);

      /* Todo el cálculo del reloj vive ACÁ, no dentro del updater de setTiempoMs.

         Un updater de estado tiene que ser puro y este empujaba a progresoRef. React 18 en
         modo estricto invoca los updaters dos veces a propósito para destapar justo esa
         clase de efecto colateral, y por eso el recorrido se guardaba con cada segundo
         DUPLICADO. El comentario anterior ya sospechaba de esto ("React puede invocarlo
         más de una vez") pero solo acotaba el síntoma con Math.max(1, ...). */
      const t = tiempoMsRef.current;
      const siguiente = esContrarreloj ? t - 100 : t + 100;
      const segundoAnterior = Math.floor(t / 1000);
      const segundoNuevo = Math.floor(siguiente / 1000);

      if (segundoAnterior !== segundoNuevo) {
        /* El eje y el divisor salen del transcurrido, no del cronómetro: en contrarreloj
           los bonus hacen crecer el reloj, y con `inicial − restante` el eje retrocedía y
           el WPM se disparaba.
           El Math.max(1, ...) se conserva porque el backend valida `segundo` con @Min(1) y
           en contrarreloj el reloj puede cruzar el cero. */
        const segundoMedido = Math.floor(transcurrido / 1000);

        progresoRef.current.push({
          segundo: Math.max(1, segundoMedido),
          wpmMomento: Math.round((caracteresCorrectosRef.current / 5) / (Math.max(1, segundoMedido) / 60)),
          precisionMomento: totalPresionadasRef.current > 0
            ? Number(((caracteresCorrectosRef.current / totalPresionadasRef.current) * 100).toFixed(2))
            : 100,
        });
      }

      if (esContrarreloj && siguiente <= 0) {
        tiempoMsRef.current = 0;
        setTiempoMs(0);
        terminadoRef.current = true;
        setTerminado(true);
        setCorriendo(false);
        return;
      }

      tiempoMsRef.current = siguiente;
      setTiempoMs(siguiente);
    }, 100);
    return () => { if (intervaloRef.current) clearInterval(intervaloRef.current); };
  }, [corriendo, terminado, esContrarreloj, configContrarreloj]);

  // Palabras mutantes: justo cuando una palabra está por pasar al óvalo principal (se
  // detecta en el cierre de la anterior), a veces la cambiamos por otra del mismo texto.
  // Se muta el string real (no solo lo visual) para que lo que pidas escribir sea
  // consistente con lo que se valida tecla por tecla.
  const mutarSiguientePalabra = useCallback((desdeEspacio: number) => {
    const txt = textoRef.current;
    if (desdeEspacio >= txt.length) return; // no hay palabra siguiente
    const inicioSiguiente = desdeEspacio + 1;
    let finSiguiente = txt.indexOf(' ', inicioSiguiente);
    if (finSiguiente === -1) finSiguiente = txt.length;
    const palabraActual = txt.slice(inicioSiguiente, finSiguiente);

    const candidatos = Array.from(new Set(txt.split(' '))).filter((p) => p && p !== palabraActual);
    if (candidatos.length === 0) return;
    const nueva = candidatos[Math.floor(Math.random() * candidatos.length)];

    const nuevoTexto = txt.slice(0, inicioSiguiente) + nueva + txt.slice(finSiguiente);
    textoRef.current = nuevoTexto;
    setTexto(nuevoTexto);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    /* MANTENER UNA TECLA PULSADA CUENTA UNA SOLA VEZ.

       El sistema operativo repite el `keydown` mientras la tecla siga abajo —es lo que
       hace que en un editor salga `fffffffff`— y este manejador los trataba como
       pulsaciones reales: apoyarse en la efe medio segundo metía treinta aciertos o
       treinta fallos que nadie tecleó, y ensuciaba a la vez el WPM, la precisión, los
       n-gramas y el tiempo entre teclas.

       `e.repeat` distingue la pulsación de sus repeticiones automáticas. Va lo PRIMERO
       de todo, antes que cualquier otro filtro, porque una repetición no es un evento
       válido para nada de lo que venga después. */
    if (e.repeat) return;
    /* ===== DESARROLLO — QUITAR ANTES DE PUBLICAR (ver core/desarrollo.ts) =====
       ← y → saltan al ejercicio de al lado dentro del nivel, en orden del sendero.

       Va en la PRIMERA línea del manejador, antes que ningún corte. No es estilo: abajo hay
       tres `return` tempranos que lo dejaban muerto justo cuando más se necesita —mientras el
       ejercicio carga, cuando ya terminó, y en Lluvia de letras y Palabras flotantes, que
       manejan su propio teclado—. Para recorrer contenido hay que poder saltar SIEMPRE,
       incluso desde un ejercicio a medio cargar. */
    if (NAVEGAR_CURSO_CON_FLECHAS && nivel && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const orden = secuenciaNivelRef.current;
      const actual = orden.indexOf(Number(id));
      if (actual === -1) {
        console.warn('[DESARROLLO] Flecha ignorada: el ejercicio %s no está en la secuencia de '
          + '%s (la lista tiene %d nodos). ¿Todavía no llegó /progreso?', id, nivel, orden.length);
        return;
      }
      const destino = actual + (e.key === 'ArrowRight' ? 1 : -1);
      if (destino < 0 || destino >= orden.length) return;   // en los extremos no se cruza de nivel
      e.preventDefault();
      navigate(`/curso/${nivel}/${orden[destino]}`);
      return;
    }
    /* Durante el TUTORIAL este manejador no hace nada. Sin esto, las diez pulsaciones
       guiadas —y sobre todo el Enter que lo salta— entran al ejercicio como si fueran
       parte de la tanda: el Enter cuenta como error (está pegado a la Ñ), consume la
       primera posición del texto y deja TODO lo que viene después corrido un lugar, así
       que el usuario teclea bien y casi todo se marca mal.
       Medido antes de arreglarlo: tecleando el texto exacto, la precisión salía 27%.

       El guard va acá y no dentro de TutorialTeclas porque el problema no es que el
       tutorial escuche de más, sino que el ejercicio escucha antes de empezar. */
    if (faseNodoRef.current === 'tutorial') return;
    // El Test Final cerrado por estrellas no es un ejercicio: es una ventana. Ver arriba.
    if (bloqueadoPorEstrellas || esperandoProgreso) return;
    /* Y UNA TECLA QUE YA CONSUMIÓ OTRA VENTANA NO ES DEL EJERCICIO. El guard de arriba
       tiene un hueco que depende del ORDEN de los listeners: el Enter que cierra el tutorial
       (o la ventana del recorrido) cambia la fase a 'latido' en su propio manejador, y si
       ese manejador corre antes que este —un hijo registra sus efectos antes que el padre—,
       aquí ya se lee 'latido' y el Enter entra como error en la primera letra. Las ventanas
       marcan con preventDefault lo que consumen, y eso cubre los dos órdenes. */
    if (e.defaultPrevented) return;
    // Con el resumen abierto el ejercicio está en pausa: las teclas son suyas, no del
    // texto. Su propio manejador se ocupa del Enter que lo cierra.
    if (enPausaRef.current) return;
    if (terminadoRef.current || guardando || cargando) return;
    // Lluvia de letras y Palabras flotantes manejan su propio teclado: este handler se
    // queda registrado pero no hace nada mientras esos tipos están activos.
    if (esLluviaLetras || esPalabrasFlotantes) return;

    /* Antes Shift se descartaba junto con los demás modificadores, sin registrar nada.
       Para SHIFT_LATERAL hace falta saber cuál de los dos se usó — .code distingue
       ShiftLeft de ShiftRight, cosa que .key no puede. */
    if (e.key === 'Shift') {
      shiftActivoRef.current = e.code === 'ShiftRight' ? 'ShiftRight' : 'ShiftLeft';
      return;
    }
    /* AltGraph incluida: pulsar AltGr sola es apoyar un modificador, no teclear. */
    if (['Control', 'Alt', 'AltGraph', 'Meta'].includes(e.key)) return;
    /* Los atajos del navegador (Ctrl+R, Ctrl+C, Alt+Tab) no son tipeo y no deben contar.
       AltGr queda EXCEPTUADO: en el teclado español es la única forma de escribir
       @ # \ | [ ] { } €, y en Windows dispara ctrlKey+altKey a la vez — sin la excepción,
       "Maratón de símbolos" tendría caracteres imposibles de acertar.
       getModifierState('AltGraph') es lo único que lo distingue de un Ctrl+Alt real. */
    if (!e.getModifierState('AltGraph') && (e.ctrlKey || e.metaKey || e.altKey)) return;
    /* Modo una mano: la tecla de ancla es la posición de reposo de la mano que NO
       participa. Se registra acá y no cuenta como tecleo — nunca aparece en el texto
       generado (viene de la mano contraria a la que se está practicando). */
    if (anclaOtraMano && e.key.toLowerCase() === anclaOtraMano) {
      anclaPresionadaRef.current = true;
      setAnclaActiva(true);
      return;
    }
    /* Solo el espacio se anula: es un carácter del texto, y sin esto la página baja de
       golpe. Las flechas se dejan pasar a propósito — son las que desplazan la pantalla
       mientras se practica. */
    if (e.key === ' ') e.preventDefault();
    /* Antes Enter caía siempre acá y se descartaba sin más — código muerto que dejaba
       la decisión #9 (Tab y Enter cuentan como fallo) rota solo para Enter. Ahora sigue
       de largo hacia la comparación normal más abajo, salvo que el ejercicio sea
       saltable: ahí Enter sale de la pantalla sin guardar sesión, antes de tocar nada
       del estado de la práctica. */
    if (e.key === 'Dead' || e.key === 'Unidentified') return;
    if (e.key === 'Enter' && esSaltable) {
      navigate('/ejercicios-base');
      return;
    }
    /* Si el ejercicio exige ancla y se soltó (o nunca se apoyó), el tecleo no avanza —
       ni letras, ni Backspace, nada — hasta que la mano libre vuelva a su posición. */
    if (anclaOtraMano && !anclaPresionadaRef.current) return;

    const txt = textoRef.current;
    if (!txt) return;

    const i = indiceRef.current;

    /* ⚠️ AGREGADO el 13-sep-2026: cálculo temprano, sin efectos secundarios (solo
       lee, no toca estado), para decidir si el reloj/WPM deben esperar. La lógica
       REAL de "la primera mayúscula gratis" sigue más abajo, sin tocar — esto
       solo adelanta la misma condición para usarla acá.

       EL BUG QUE ARREGLA: el reloj de Contrarreloj arrancaba en la PRIMERA tecla
       presionada, sin importar si esa tecla terminaba siendo un intento fallido
       de la mayúscula gratis (que no cuenta como error y no mueve el cursor). El
       teclado se quedaba quieto pero el cronómetro seguía corriendo por su
       cuenta — perdías segundos reales de Contrarreloj por algo que se suponía
       gratis. En Avanzado se deja el comportamiento de siempre a propósito: para
       cuando alguien llega ahí, Shift+letra ya se practicó de sobra en
       Intermedio, así que no hace falta la demora. */
    const esAvanzado = nivel?.toUpperCase() === 'AVANZADO';
    const esPrimeraMayusculaGratisFallada = e.key.length === 1
      && esMayuscula(txt[i]) && !shiftEnsenadoRef.current && e.key !== txt[i];

    if (!corriendo && !(esPrimeraMayusculaGratisFallada && !esAvanzado)) {
      inicioPerfRef.current = performance.now();
      setCorriendo(true);
    }

    if (e.key === 'Backspace') {
      if (i > 0 && !esSuddenDeath) {
        indiceRef.current = i - 1;
        setIndice(i - 1);
        setErrores((prev) => { const n = new Set(prev); n.delete(i - 1); erroresRef.current = n; return n; });
      }
      return;
    }
    /* Tab y Enter SÍ cuentan como fallo: están pegados a la Q y a la Ñ, así que pulsarlas
       es un error de mecanografía real. Las flechas, F1-F12 y demás teclas de navegación
       no producen carácter y se ignoran sin ensuciar la precisión. */
    if (e.key.length !== 1 && e.key !== 'Tab' && e.key !== 'Enter') return;
    if (e.key === 'Tab' || e.key === 'Enter') e.preventDefault();

    const esperada = txt[i];
    let esCorrecta = e.key === esperada;
    /* SHIFT_LATERAL: la letra sola no alcanza — además exige el Shift del lado
       CONTRARIO a la mano de esa letra. Las que no pertenecen a ninguna mano (el
       espacio entre tokens) quedan fuera de esta regla. */
    if (esCorrecta && esShiftLateral && manosShift.length === 2) {
      const manoDeLaLetra = manosShift.find((m) => m.letras.includes(esperada.toLowerCase()));
      if (manoDeLaLetra) {
        const ladoEsperado = manoDeLaLetra.id === 'derecha' ? 'ShiftLeft' : 'ShiftRight';
        esCorrecta = shiftActivoRef.current === ladoEsperado;
      }
    }
    /* LA PRIMERA MAYÚSCULA DEL NODO NO SE PUEDE FALLAR.

       Va ANTES de que se registre nada —antes del evento, del contador de pulsaciones y de
       registrarTecla— porque el intento fallido no existe para el ejercicio: no cuenta como
       error, no baja la precisión y no mueve el cursor. El usuario se queda en esa letra
       hasta que le sale, las veces que haga falta.

       Es la única tecla del Curso que se enseña deteniendo el ejercicio, y la razón es que
       Shift no es una tecla más: es media pulsación que no aparece en ninguna parte del
       texto, así que el usuario no puede deducir que le falta. Fallarla y ver un número de
       precisión bajando enseña lo contrario de lo que hace falta.

       Solo la PRIMERA. Después el nodo vuelve a sus reglas: las demás mayúsculas se fallan
       como cualquier otra tecla, porque el gesto ya se explicó.

       ⚠️ `esMayuscula`, no `necesitaShift` (que desde el 11-sep-2026 también es true para
       `;`): el punto y coma tiene su PROPIO mecanismo, `puntoYComaObligatorio` más abajo,
       donde fallar SÍ cuenta desde el primer intento — mezclar los dos acá le regalaría al
       `;` el mismo perdón que a una mayúscula, que es justo lo que no se quiere. */
    if (esMayuscula(esperada) && !shiftEnsenadoRef.current) {
      if (!esCorrecta) {
        setTeclaError(e.key.toUpperCase());
        setTimeout(() => setTeclaError(''), 150);
        /* Sube en cada intento fallido de la mayúscula gratis — el ÚNICO fallo del Curso
           que no cuenta, no pinta rojo el cursor y no mueve nada: sin esta señal, insistir
           con la combinación se siente como si el ejercicio no respondiera. El aviso y el
           teclado la usan para un golpe/temblor breve, ver AvisoTeclaEspecial y
           TecladoGuia. */
        setMayusculaFallidaSello((s) => s + 1);
        return;
      }
      shiftEnsenadoRef.current = true;
      setShiftEnsenado(true);
    }

    const ahoraMs = performance.now();
    const msDesdeInicio = Math.round(ahoraMs - inicioPerfRef.current);
    // Lo que tardó esta tecla desde la anterior: alimenta tiempoTotalMs, que hasta ahora
    // se guardaba siempre en 0 y dejaba el análisis de ritmo sin insumo.
    const deltaMs = calcularDelta(ahoraMs, ultimoInstanteRef.current);
    ultimoInstanteRef.current = ahoraMs;
    /* EL FALLO QUE NO MUEVE EL CURSOR. Tres casos se quedan en la letra hasta que sale: el
       recorrido de un dedo, una tilde en un nodo con `tildeObligatoria`, y un `;` en un nodo
       con `puntoYComaObligatorio`. En los tres el intento fallido SÍ cuenta —baja la
       precisión y queda registrado—; lo único que no hace es avanzar. Se decide aquí, antes
       del evento, porque el evento guarda dónde quedó el cursor: con i + 1 la sesión
       registraría un avance que no ocurrió. */
    const retieneCursor = !esCorrecta
      && (esUnDedo || (tildeObligatoria && CON_TILDE.test(esperada))
        || (puntoYComaObligatorio && esperada === ';'));
    // Igual que el índice real más abajo, salvo que sudden death reinicia a 0 en vez de avanzar.
    const indiceResultante = (!esCorrecta && esSuddenDeath) ? 0 : (retieneCursor ? i : i + 1);

    ordenSecuenciaRef.current += 1;
    eventosRef.current.push({
      tecla: e.key.toLowerCase(),
      ordenSecuencia: ordenSecuenciaRef.current,
      tiempoDesdeInicioMs: msDesdeInicio,
      indiceResultante,
      correcta: esCorrecta,
    });

    setTotalPresionadas((t) => { totalPresionadasRef.current = t + 1; return t + 1; });
    totalPresionadasGlobalRef.current += 1; // nunca se resetea: alimenta el promedio "general"
    setTeclaPresionada(e.key.toUpperCase());
    setTimeout(() => setTeclaPresionada(''), 100);

    // La tecla ESPERADA, no la pulsada: así el fallo se le atribuye a la letra que no
    // lograste, no a la que apretaste por error. (Ver la nota larga en PracticaView.)
    registrarTecla(esperada, esCorrecta, deltaMs);
    if (i >= 1) {
      const big = txt.slice(i - 1, i + 1).toLowerCase();
      if (/^[a-záéíóúñü]{2}$/.test(big)) registrarNgram(big, 'BIGRAMA', !esCorrecta);
    }
    if (i >= 2) {
      const tri = txt.slice(i - 2, i + 1).toLowerCase();
      if (/^[a-záéíóúñü]{3}$/.test(tri)) registrarNgram(tri, 'TRIGRAMA', !esCorrecta);
    }

    if (!esCorrecta) {
      erroresEnPalabraRef.current += 1;
      /* La pista dice ADÓNDE ir, no que fallaste — eso ya lo dice el rojo. Primero mira la
         tilde, después si el nodo es de ALCANCE y el dedo no llegó o no volvió (pistaDeAlcance,
         solo en g h / r u / e i / w o / q p / t y), después si el dedo se fue de territorio
         (otra fila, un número que el curso no mencionó) y si no, cuánto se desvió de la tecla
         correcta — esto último SOLO en "un dedo" (esUnDedo). Ver pistas.ts.

         Y en "Fila de números" se calla del todo en la ÚLTIMA tanda: ahí letras y dígitos
         conviven a propósito, así que "todavía no usamos esa fila" ya no es cierto y solo
         confunde. Las tres primeras tandas la conservan igual que cualquier otro nodo. */
      const enUltimaTandaSinPista = esProgresionNumerica
        && tandasRef.current.length > 0
        && tandaActualRef.current === tandasRef.current.length - 1;
      if (!enUltimaTandaSinPista) {
        const consejo = pistaDeFallo(
          e.key, esperada, conjuntoNodoRef.current, esUnDedo, alcanceNodo);
        if (consejo) {
          setPista({ ...consejo, sello: Date.now() });
        }
      }
      setTeclaError(e.key.toUpperCase());
      setTimeout(() => setTeclaError(''), 150);

      /* Contrarreloj avanzado: la penalización resta AL INSTANTE de la tecla errónea,
         no se espera al cierre de palabra como en el Contrarreloj normal — ver el
         bloque de cierraPalabra más abajo, que se salta la penalización (ya aplicada
         acá) y solo evalúa el bono. */
      if (esContrarreloj && configContrarreloj?.penalizacionPorTecla) {
        tiempoMsRef.current = Math.max(0, tiempoMsRef.current - configContrarreloj.penalizacionErrorSegundos * 1000);
        setTiempoMs(tiempoMsRef.current);
      }

      if (esSuddenDeath) {
        // Un solo error: reinicia. En fase 1 repites la MISMA oración; en fase 2
        // (ya superaste la fase 1) cada fallo trae una oración nueva al azar.
        setReinicios((r) => r + 1);
        reiniciarProgreso();
        if (faseSuddenDeathRef.current === 'segunda') cargarNuevaOracion();
        return;
      }

      setErrores((prev) => { const n = new Set(prev).add(i); erroresRef.current = n; return n; });

      /* EL RECORRIDO NO AVANZA CON LA TECLA EQUIVOCADA: te quedas en esa letra hasta que
         sale. Es un drill de TRES teclas dibujadas delante, y dejar pasar el fallo rompe
         justo el viaje que se está enseñando — la escalera de la pista quedaría con un
         escalón que nadie hizo.

         LA TILDE OBLIGATORIA, lo mismo: si el nodo existe para enseñar la tilde, dejar
         pasar "a" por "á" permite completarlo sin haberla escrito nunca.

         A diferencia de la primera mayúscula, que tampoco avanza pero además no cuenta,
         en estos dos el fallo SÍ cuenta: baja la precisión y queda registrado. La diferencia
         es que ahí el usuario no podía deducir que le faltaba media pulsación, y acá tiene
         delante las tres teclas del dedo, o el aviso lateral explicando el acento. */
      if (retieneCursor) return;
    } else {
      setCaracteresCorrectos((c) => { caracteresCorrectosRef.current = c + 1; return c + 1; });
      caracteresCorrectosGlobalRef.current += 1;
      // Se acertó un carácter "obligatorio" (tilde o `;`) que antes había fallado: que se
      // vea celeste, no rojo — ver la nota junto a `corregidosTrasFallar`.
      const eraObligatorioYFallado = erroresRef.current.has(i)
        && ((tildeObligatoria && CON_TILDE.test(esperada))
          || (puntoYComaObligatorio && esperada === ';'));
      if (eraObligatorioYFallado) {
        setCorregidosTrasFallar((prev) => new Set(prev).add(i));
      }
    }

    // Cierre de palabra (espacio o fin de texto): aplica bono/penalización de contrarreloj.
    // OJO: se evalúa según si la PALABRA tuvo algún error, sin importar si esta pulsación
    // (la que cierra la palabra) en particular fue correcta — si el error cae justo en la
    // última letra o el espacio, igual debe contar como palabra fallada, no quedar sin evaluar.
    const cierraPalabra = txt[i + 1] === ' ' || txt[i + 1] === undefined;
    if (cierraPalabra) {
      if (esContrarreloj && configContrarreloj) {
        const huboError = erroresEnPalabraRef.current > 0;
        /* El ref se actualiza junto con el estado: el intervalo lee el reloj desde el ref,
           así que si el bonus solo tocara el estado, el siguiente tick lo pisaría. */
        if (configContrarreloj.penalizacionPorTecla) {
          // La penalización ya se aplicó tecla por tecla, en el momento del error.
          // Acá solo queda el bono, y solo si la palabra terminó sin ningún fallo.
          if (!huboError) {
            tiempoMsRef.current = Math.max(0, tiempoMsRef.current + configContrarreloj.bonusCorrectaSegundos * 1000);
            setTiempoMs(tiempoMsRef.current);
          }
        } else {
          const ajuste = huboError
            ? -configContrarreloj.penalizacionErrorSegundos * 1000
            : configContrarreloj.bonusCorrectaSegundos * 1000;
          tiempoMsRef.current = Math.max(0, tiempoMsRef.current + ajuste);
          setTiempoMs(tiempoMsRef.current);
        }
      }
      // Justo cuando la siguiente palabra está por entrar al óvalo principal: 30% de
      // que mute por otra, para que no puedas confiarte de lo que viste "detrás".
      if (esPalabrasMutantes && txt[i + 1] === ' ' && Math.random() < 0.3) {
        mutarSiguientePalabra(i + 1);
      }
      erroresEnPalabraRef.current = 0;
    }

    const siguiente = i + 1;
    indiceRef.current = siguiente;
    setIndice(siguiente);

    // El punto final no cuenta como pendiente: llegar a la posición justo antes de él
    // ya cierra el ejercicio, sin exigir esa última pulsación.
    const faltaSoloElPuntoFinal = puntoFinalOpcional
      && txt.endsWith('.') && siguiente >= txt.length - 1;
    if (siguiente >= txt.length || faltaSoloElPuntoFinal) {
      // Los latidos se resuelven primero: si queda otra tanda, el ejercicio NO termina.
      if (terminarLatido()) {
        setCorriendo(false);
        return;
      }
      // Frases encadenadas: si queda otra, destello y cambio de texto sin cortar la sesión.
      if (terminarTanda()) return;
      if (esSuddenDeath && faseSuddenDeathRef.current === 'primera') {
        // Acertaste la oración que se repetía: capturamos SU wpm/precisión (el
        // intento por-fase, antes de que reiniciarProgreso() lo ponga en cero) y
        // pasamos a la fase 2. El ejercicio SIGUE, no se guarda todavía.
        const seg1 = Math.max(1, Math.floor(tiempoMsRef.current / 1000));
        fase1ResultadoRef.current = {
          wpm: Math.round((caracteresCorrectosRef.current / 5) / (seg1 / 60)),
          precision: totalPresionadasRef.current > 0
            ? Number(((caracteresCorrectosRef.current / totalPresionadasRef.current) * 100).toFixed(2))
            : 100,
        };
        faseSuddenDeathRef.current = 'segunda';
        setFaseSuddenDeath('segunda');
        reiniciarProgreso();
        cargarNuevaOracion();
        setAvisoFase2(true);
        window.setTimeout(() => setAvisoFase2(false), DURACION_AVISO_FASE2_MS);
      } else {
        if (esSuddenDeath) {
          const seg2 = Math.max(1, Math.floor(tiempoMsRef.current / 1000));
          fase2ResultadoRef.current = {
            wpm: Math.round((caracteresCorrectosRef.current / 5) / (seg2 / 60)),
            precision: totalPresionadasRef.current > 0
              ? Number(((caracteresCorrectosRef.current / totalPresionadasRef.current) * 100).toFixed(2))
              : 100,
          };
        }
        terminadoRef.current = true;
        setTerminado(true);
        setCorriendo(false);
      }
    }
  }, [corriendo, guardando, cargando, esSuddenDeath, esContrarreloj, configContrarreloj, esPalabrasMutantes, terminarTanda,
      mutarSiguientePalabra, reiniciarProgreso, cargarNuevaOracion, esSaltable, navigate, terminarLatido,
      esShiftLateral, manosShift, anclaOtraMano, esLluviaLetras, esPalabrasFlotantes, esUnDedo,
      esProgresionNumerica, alcanceNodo, tildeObligatoria, puntoYComaObligatorio, puntoFinalOpcional, bloqueadoPorEstrellas, esperandoProgreso,
      // DESARROLLO: las usa el salto con flechas entre ejercicios del nivel.
      nivel, id]);

  // Limpia el lado de Shift activo al soltarlo, y detecta cuándo se levanta la mano
  // de apoyo del ancla — ahí es donde realmente se bloquea el ejercicio (ver el
  // guard "anclaOtraMano && !anclaPresionadaRef.current" en handleKeyDown).
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Shift') shiftActivoRef.current = null;
    if (anclaOtraMano && e.key.toLowerCase() === anclaOtraMano) {
      anclaPresionadaRef.current = false;
      setAnclaActiva(false);
    }
  }, [anclaOtraMano]);

  /* Lluvia de letras reporta acá en vez de pasar por handleKeyDown: el padre solo
     necesita saber "hubo una pulsación, ¿fue correcta?" y "arrancó"/"perdió" — el resto
     (cronómetro, WPM/precisión en vivo, guardado al terminar) es la misma maquinaria
     que ya usan todos los demás ejercicios. */
  const manejarKeystrokeLluvia = useCallback((correcta: boolean) => {
    setTotalPresionadas((t) => { totalPresionadasRef.current = t + 1; return t + 1; });
    if (correcta) {
      setCaracteresCorrectos((c) => { caracteresCorrectosRef.current = c + 1; return c + 1; });
    }
  }, []);

  const manejarInicioLluvia = useCallback(() => {
    if (!corriendo) {
      inicioPerfRef.current = performance.now();
      setCorriendo(true);
    }
  }, [corriendo]);

  const manejarPerderLluvia = useCallback((mejorRacha: number, sobrevivioElTiempo: boolean) => {
    mejorRachaLluviaRef.current = mejorRacha;
    lluviaSobrevivioRef.current = sobrevivioElTiempo;
    terminadoRef.current = true;
    setTerminado(true);
    setCorriendo(false);
  }, []);

  /* Palabras flotantes reporta las métricas ACUMULADAS una sola vez al final (perdió o
     completó todas), a diferencia de Lluvia de letras que reporta tecla por tecla — acá
     alcanza con volcarlas de una sola vez a los mismos refs compartidos. */
  const manejarFinPalabrasFlotantes = useCallback((metricas: MetricasFlotantes) => {
    caracteresCorrectosRef.current = metricas.caracteresCorrectos;
    setCaracteresCorrectos(metricas.caracteresCorrectos);
    totalPresionadasRef.current = metricas.totalPresionadas;
    setTotalPresionadas(metricas.totalPresionadas);
    terminadoRef.current = true;
    setTerminado(true);
    setCorriendo(false);
  }, []);

  /* A diferencia de Lluvia de letras (que arranca el reloj recién con la primera tecla),
     las palabras acá ya empiezan a moverse apenas se monta — así que el cronómetro
     compartido tiene que arrancar junto con el componente, no esperar ninguna pulsación. */
  useEffect(() => {
    if (!esPalabrasFlotantes || !ejercicio) return;
    inicioPerfRef.current = performance.now();
    // Mismo caso ya aceptado en este archivo para setGuardando: no hay evento de usuario
    // que disparar acá (el propio componente arranca a moverse solo), así que no queda
    // otra que reaccionar a que los datos llegaron.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCorriendo(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esPalabrasFlotantes, ejercicio?.id]);

  useEffect(() => {
    contenedorRef.current?.focus();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  /* RESISTENCIA: compara el primer 15% del texto (por posición de carácter, no de
     tiempo) contra el resto, usando los eventos tecla a tecla que ya se registran para
     el modo sombra — no hace falta guardar nada nuevo para esto. */
  const calcularAnalisisResistencia = useCallback(() => {
    if (!esResistencia) return null;
    const eventos = eventosRef.current;
    const totalCaracteres = textoRef.current.length;
    if (eventos.length === 0 || totalCaracteres === 0) return null;

    const corteIndice = Math.floor(totalCaracteres * 0.15);
    const tramoInicial = eventos.filter((ev) => ev.indiceResultante <= corteIndice);
    const tramoResto = eventos.filter((ev) => ev.indiceResultante > corteIndice);

    const calcularTramo = (tramo: TeclaEventoRequest[]) => {
      if (tramo.length < 2) return null;
      const correctas = tramo.filter((ev) => ev.correcta).length;
      const duracionMs = tramo[tramo.length - 1].tiempoDesdeInicioMs - tramo[0].tiempoDesdeInicioMs;
      const segundos = Math.max(1, duracionMs / 1000);
      return {
        wpm: Math.round((correctas / 5) / (segundos / 60)),
        precision: Number(((correctas / tramo.length) * 100).toFixed(2)),
      };
    };

    const inicial = calcularTramo(tramoInicial);
    const resto = calcularTramo(tramoResto);
    if (!inicial || !resto) return null;

    return {
      wpmInicial: inicial.wpm,
      precisionInicial: inicial.precision,
      wpmResto: resto.wpm,
      precisionResto: resto.precision,
      // Umbral simple: 10% menos de WPM o 5 puntos menos de precisión ya cuenta como
      // caída real, no ruido de medición.
      cayoRendimiento: resto.wpm < inicial.wpm * 0.9 || resto.precision < inicial.precision - 5,
    };
  }, [esResistencia]);

  // Guardado al terminar
  useEffect(() => {
    if (!terminado || !ejercicio) return;

    /* EL DESGLOSE POR FRASE SE BORRA ANTES DE DECIDIR NADA, y solo lo repone el ejercicio
       que de verdad tiene tandas.

       Sin esto era un dato pegajoso: se escribía al terminar un nodo servido en frases y no
       se limpiaba nunca, así que el SIGUIENTE nodo del Curso —una Lluvia, un contrarreloj,
       cualquiera sin tandas— abría su pantalla de resultados con el «Frase por frase» del
       ejercicio anterior. Cifras reales, del ejercicio equivocado, y sin nada que delatara
       de dónde salían. Lo reportó el usuario viendo tres frases en una partida de Lluvia.

       Es el mismo trato que ya tenía `resultado_curso`, que se borra cuando la sesión no
       trae veredicto. La regla general: en `sessionStorage`, un dato que solo escriben
       ALGUNOS ejercicios hay que borrarlo en todos. */
    sessionStorage.removeItem('resultados_tandas');
    // Mismo trato para el detalle segundo a segundo por tanda — ver progresoPorTandaRef.
    sessionStorage.removeItem('progreso_tandas');

    let wpmFinal: number;
    let precisionFinal: number;
    let segundosFinal: number;

    if (esSuddenDeath) {
      // El "general": TODO el intento, reinicios fallidos incluidos — nunca se reseteó.
      segundosFinal = Math.max(1, Math.floor(tiempoGlobalMsRef.current / 1000));
      wpmFinal = Math.round((caracteresCorrectosGlobalRef.current / 5) / (segundosFinal / 60));
      precisionFinal = totalPresionadasGlobalRef.current > 0
        ? Number(((caracteresCorrectosGlobalRef.current / totalPresionadasGlobalRef.current) * 100).toFixed(2))
        : 100;
    } else if (resultadosTandasRef.current.length > 0) {
      /* El promedio de las tres frases. No se usan los contadores en pantalla porque
         son los de la ÚLTIMA tanda: cada una arranca de cero para que la pausa del
         destello no le reste WPM a nadie. */
      const rs = resultadosTandasRef.current;
      wpmFinal = Math.round(rs.reduce((a, r) => a + r.wpm, 0) / rs.length);
      precisionFinal = Number(
        (rs.reduce((a, r) => a + r.precision, 0) / rs.length).toFixed(2));
      // La duración es la del nodo entero, sin las pausas.
      segundosFinal = Math.max(1, Math.floor(tiempoNodoMsRef.current / 1000));
      // Para que la pantalla de resultados pueda desglosarlas.
      sessionStorage.setItem('resultados_tandas', JSON.stringify(rs));
      // Y el detalle segundo a segundo de cada una, para el gráfico — ver progresoPorTandaRef.
      if (progresoPorTandaRef.current.length > 0) {
        sessionStorage.setItem('progreso_tandas', JSON.stringify(progresoPorTandaRef.current));
      }
    } else if (resultadosLatidosRef.current.length > 0) {
      /* Con latidos la nota NO sale de los contadores en pantalla —que son los del último
         latido— sino del promedio de los dos últimos, o del quinto intento solo si se
         llegó a él. El porqué de "los dos últimos" está en core/curso/latidos.ts: los
         latidos son progresivamente más difíciles, así que promediar "todos los hechos"
         castigaría dos veces a quien necesitó los cuatro. */
      const nota = notaFinal(resultadosLatidosRef.current, porUltimoIntentoRef.current);
      wpmFinal = nota.wpm;
      precisionFinal = nota.precision;
      // La duración sí es la del nodo entero, sumando todos los latidos.
      segundosFinal = Math.max(1, Math.floor(tiempoNodoMsRef.current / 1000));
    } else {
      // Vale para los dos casos: el contador solo avanza, así que no hay que distinguir
      // contrarreloj (donde el reloj crece con los bonus y falseaba la duración).
      segundosFinal = Math.max(1, Math.floor(transcurridoMsRef.current / 1000));
      wpmFinal = Math.round((caracteresCorrectosRef.current / 5) / (segundosFinal / 60));
      precisionFinal = totalPresionadasRef.current > 0
        ? Number(((caracteresCorrectosRef.current / totalPresionadasRef.current) * 100).toFixed(2))
        : 100;
    }

    /* La Lluvia, cuando termina por SOBREVIVIR el tiempo (no por perder un carril): el
       reloj del juego (por fotogramas, dentro de VistaLluviaLetras) y el de acá
       (wall-clock) no laten exactamente igual, y la duración medida podía quedar unas
       centésimas corta — 29.90 en vez de 30.00. Si sobrevivió, la duración real del
       intento es la pedida, ni más ni menos, así que se fija acá en vez de confiar en
       la medición. Recalcula el WPM con la duración ya corregida para que las dos
       cifras sigan siendo consistentes entre sí. */
    let tiempoMsLluvia: number | null = null;
    if (esLluviaLetras && lluviaSobrevivioRef.current) {
      const duracionPedida = (ejercicio.configuracion as { duracionSegundos?: number } | undefined)
        ?.duracionSegundos;
      if (duracionPedida) {
        segundosFinal = duracionPedida;
        wpmFinal = Math.round((caracteresCorrectosRef.current / 5) / (segundosFinal / 60));
        tiempoMsLluvia = duracionPedida * 1000;
      }
    }

    /* Limpieza del progreso antes de enviarlo:
       - fuera lo que tenga segundo < 1 (el backend lo rechaza con @Min(1)),
       - y un solo punto por segundo, porque si el updater se invocó dos veces
         quedaron duplicados que además deformaban el gráfico. */
    const progresoLimpio = Array.from(
      new Map(
        progresoRef.current
          .filter((p) => p.segundo >= 1)
          .map((p) => [p.segundo, p]),
      ).values(),
    ).sort((a, b) => a.segundo - b.segundo);

    // Lo que ve la pantalla de resultados. `caracteres` y `tiempoMs` no viajan al
    // backend (no existen en SesionCursoRequest), pero sin ellos la tarjeta de
    // "Letras" salía vacía y el tiempo no podía mostrar centésimas.
    const resultadoLocal = {
      wpm: wpmFinal,
      precision: precisionFinal,
      segundos: segundosFinal,
      tiempoMs: tiempoMsLluvia ?? (esSuddenDeath ? tiempoGlobalMsRef.current
        : ((resultadosLatidosRef.current.length > 0 || resultadosTandasRef.current.length > 0)
          ? tiempoNodoMsRef.current : tiempoMs)),
      caracteres: esSuddenDeath ? caracteresCorrectosGlobalRef.current : caracteresCorrectosRef.current,
      dificultad: 'MEDIO',
      progreso: progresoLimpio,
      peoresTeclas: [],
      peoresBigramas: [],
      esIA: false,
      desgloseSuddenDeath: esSuddenDeath ? {
        general: { wpm: wpmFinal, precision: precisionFinal },
        fase1: fase1ResultadoRef.current,
        fase2: fase2ResultadoRef.current,
      } : null,
      analisisResistencia: calcularAnalisisResistencia(),
    };

    /* De dónde viene la sesión. La pantalla de resultados lo usa para saber si sus
       botones deben moverse entre EJERCICIOS del catálogo plano, avanzar de a un nodo
       dentro de un nivel (Enter → siguiente), o entre noticias. */
    sessionStorage.setItem('origen_practica', nivel ? 'curso-nivel' : 'curso');
    if (nivel) sessionStorage.setItem('curso_nivel_actual', nivel);
    sessionStorage.setItem('ejercicio_id', String(ejercicio.id));
    // El titular de la pantalla de resultados en el Curso: qué ejercicio acabás de hacer.
    // Sin esto ahí decía "¡Sesión Completada!", igual para los 88 nodos del sendero.
    sessionStorage.setItem('ejercicio_titulo', ejercicio.titulo);

    /* En modo ciego se retrasa el salto para dar tiempo a ver el texto revelado.
       El temporizador se guarda en un ref para poder cancelarlo si el componente
       se desmonta antes (cambiar de ejercicio, volver atrás). */
    const irAResultados = () => {
      if (esModoCiego) {
        temporizadorRevelacionRef.current = setTimeout(() => navigate('/resultados'), 2000);
      } else {
        navigate('/resultados');
      }
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGuardando(true);
    guardarSesionEjercicio(ejercicio.id, {
      wpm: wpmFinal,
      precision: precisionFinal,
      segundos: segundosFinal,
      dificultad: 'MEDIO',
      texto: textoRef.current,
      progreso: progresoLimpio,
      teclas: Array.from(teclasMapRef.current.values()),
      ngrams: Array.from(ngramsMapRef.current.values()),
      eventos: eventosRef.current,
      porUltimoIntento: porUltimoIntentoRef.current,
    })
      /* Modo ciego: al terminar, el texto se revela con sus colores reales (cian lo
         acertado, rojo lo fallado) porque el bloque que lo aplanaba solo actúa
         mientras !terminado. Se le dan 2 segundos para mirarlo antes de saltar a
         resultados — es la única devolución que el ejercicio da en toda la partida. */
      .then((respuesta) => {
        /* El veredicto del Curso (umbral, estrellas, aprobación del nivel) lo calcula el
           servidor y viaja acá dentro. Se guarda aparte del resultado local porque son
           dos cosas distintas: `sesion_resultado` es lo que hiciste, esto es lo que
           significó. Si el ejercicio no es del Curso por niveles llega null, y la
           pantalla de resultados simplemente no muestra el panel de recompensa. */
        if (respuesta?.resultadoCurso) {
          /* `mejorRachaLluvia` no la manda el backend: es una racha en vivo que solo sirve
             para mostrarla, no para puntuar, así que se agrega acá antes de guardar en vez
             de abrir un viaje de ida y vuelta al servidor por un dato decorativo. */
          const resultadoConRacha = esLluviaLetras
            ? { ...respuesta.resultadoCurso, mejorRachaLluvia: mejorRachaLluviaRef.current }
            : respuesta.resultadoCurso;
          sessionStorage.setItem('resultado_curso', JSON.stringify(resultadoConRacha));
        } else {
          sessionStorage.removeItem('resultado_curso');
        }
        sessionStorage.setItem('sesion_resultado', JSON.stringify(resultadoLocal));
        irAResultados();
      })
      .catch((err) => {
        /* Antes esto solo escribía en consola y NO navegaba: si el guardado fallaba,
           el usuario se quedaba con el "¡Completado!" en pantalla, sin resultados y
           sin salida. Ahora se muestran igual los datos locales; lo único que se
           pierde es el registro en el historial. */
        console.error('Error guardando sesión de curso:', err);
        // Sin respuesta del servidor no hay veredicto que mostrar: se limpia el de la
        // vuelta anterior para no pintar una recompensa que no corresponde a este intento.
        sessionStorage.removeItem('resultado_curso');
        sessionStorage.setItem('sesion_resultado', JSON.stringify(resultadoLocal));
        irAResultados();
      })
      .finally(() => setGuardando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminado]);

  const getColorCaracter = (i: number) => {
    // Modo ciego mientras se escribe: TODO el texto (tecleado o no) se ve en el mismo
    // gris neutro, incluyendo un cursor sutil — nada te dice si vas bien o mal hasta el final.
    /* Modo ciego mientras escribes: el texto se ve entero, pero TODO en el mismo tono
       y sin cursor. Antes se marcaba la posición actual, y eso ya delataba el avance
       —que es justo lo que el ejercicio quiere ocultar—. Al terminar, este bloque deja
       de aplicar y el texto se revela con los colores normales. */
    if (esModoCiego && !terminado) {
      // Intermedio: el cursor se deja ver como ayuda de ubicación (sin decir si vas
      // bien o mal). Avanzado (ocultarCursorCiego): tampoco esto, a ciegas del todo.
      if (!ocultarCursorCiego && i === indice) {
        return esOscuro ? 'text-white border-b-2 border-cian cursor-blink' : 'text-slate-800 border-b-2 border-emerald-500 cursor-blink';
      }
      return esOscuro ? 'text-gris-texto/60' : 'text-slate-400';
    }

    if (esOscuro) {
      if (i < indice) {
        if (corregidosTrasFallar.has(i)) return 'text-cian';
        if (errores.has(i)) return 'text-dificil';
        // El fantasma ya pasó por acá (te alcanzó o te pasó): mismo cian, pero opaco.
        return i <= ghostIndice ? 'text-cian/40' : 'text-cian';
      }
      if (i === indice) return 'text-white border-b-2 border-cian cursor-blink';
      if (ghostIndice >= 0 && i === ghostIndice) return 'rounded bg-white/8 text-gris-texto';
      return 'text-faint';
    }

    if (i < indice) {
      if (corregidosTrasFallar.has(i)) return 'text-sky-500 bg-sky-50';
      if (errores.has(i)) return 'text-rose-500 bg-rose-50';
      return i <= ghostIndice ? 'text-emerald-300' : 'text-emerald-600';
    }
    if (i === indice) return 'text-slate-800 border-b-2 border-emerald-500 cursor-blink';
    if (ghostIndice >= 0 && i === ghostIndice) return 'text-slate-500 bg-slate-100 rounded';
    return 'text-slate-300';
  };

  /* Qué carácter toca escribir, para el teclado guía. En modo ciego y en dictado va
     vacío a propósito: en uno el ejercicio ES no recibir devolución, en el otro no se
     debe ver el texto. La guía queda muda en vez de mentir.

     Acá vivía además getColorTecla, que pintaba el teclado viejo de tres filas. Se borró
     junto con él: el color de cada tecla ahora lo decide TecladoGuia, que además sabe de
     dedos, números y espacio. */
  const caracterEsperado = (esModoCiego || ocultarTextoFuturo) ? '' : (texto[indice] ?? '');

  /* El aviso de tecla especial NO tiene estado: se deriva del carácter que toca y se
     dibuja mientras haga falta. Sin bandera de "ya lo vi", sin efecto que lo encienda y sin
     pausa — es un cartel al costado, no un paso del ejercicio. */
  const caracterDelAviso = texto[indice] ?? '';

  /* Mientras la primera mayúscula del nodo no salga, el ejercicio está detenido en ella.
     Se DERIVA en vez de guardarse en estado: `shiftEnsenadoRef` solo cambia en la
     pulsación que acierta, y esa misma pulsación mueve el cursor —o sea que ya provoca un
     render—. Un estado en paralelo sería una segunda copia que sincronizar.
     `esMayuscula`, no `necesitaShift`: el `;` no es "gratis" como la primera mayúscula, ver
     `puntoYComaObligatorio` abajo. */
  const bloqueandoShift = !shiftEnsenado && esMayuscula(caracterDelAviso);
  /* Y cuánto cuesta fallar mientras está detenido. La primera mayúscula manda: una É inicial
     lleva las dos cosas, y ahí el intento fallido todavía no se cobra. Después, tilde y `;`
     — los dos SÍ cobran, así que da igual cuál de los dos sea. */
  const bloqueoAviso = bloqueandoShift ? 'no-cuenta' as const
    : ((tildeObligatoria && CON_TILDE.test(caracterDelAviso))
        || (puntoYComaObligatorio && caracterDelAviso === ';')) ? 'cuenta' as const : null;

  /* EN QUÉ ESQUINA CAE EL AVISO: la contraria al carácter que se va a teclear.

     Se mide el propio cursor en vez de suponer dónde está el texto, porque su posición
     depende de la vista elegida (linterna, teleprompter, tamaño de ventana) y de por dónde
     vaya el usuario dentro de la línea.

     La medida va en un temporizador y no en el cuerpo del efecto para que el setState no
     sea síncrono ahí dentro, que en este repo es error de lint. Un temporizador y no un
     `requestAnimationFrame` a propósito: `getBoundingClientRect` fuerza el diseño por su
     cuenta, así que no hace falta esperar al fotograma —y rAF NO CORRE con el panel oculto,
     con lo que el aviso se quedaba clavado en su posición inicial (es la misma trampa que
     ya está anotada para las animaciones en CLAUDE.md 8).

     Si el cursor no existe se conserva la última posición. Pasa de verdad y no es un caso
     de borde: LA CINTA Y EL CARRUSEL NO MONTAN el cursor, y las dos son preferencias que
     el usuario deja guardadas en localStorage — o sea que se puede entrar a un nodo con la
     cinta encendida de otro día y el aviso no tendría dónde medir. Ahí la esquina por
     defecto es la correcta de todos modos: en la cinta el texto se desliza bajo un cursor
     FIJO, así que no hay nada que esquivar. */
  useEffect(() => {
    /* El ref se lee DENTRO del temporizador y no fuera. Capturándolo antes se medía el
       elemento que había cuando el efecto se registró, y el cursor cambia de span en cada
       pulsación: el rectángulo salía de un nodo que ya no era el actual —o de uno
       desprendido, que devuelve ceros y colocaba el aviso siempre en la misma esquina. */
    const t = window.setTimeout(() => {
      const el = cursorSpanRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;   // desprendido: no hay nada que medir
      setPosicionAviso({
        lado: r.left + r.width / 2 > window.innerWidth / 2 ? 'derecha' : 'izquierda',
        arriba: r.top + r.height / 2 < window.innerHeight / 2,
      });
    }, 0);
    return () => window.clearTimeout(t);
  }, [indice, caracterDelAviso]);

  /* Qué teclas usa ESTE ejercicio: el teclado apaga las demás. En modo ciego y en dictado
     va null —o sea, no se apaga ninguna— porque el conjunto de letras delataría el
     contenido del texto, que es justo lo que esos dos ejercicios ocultan. Es el mismo
     motivo por el que `caracterEsperado` va vacío ahí. */
  const conjuntoActivo = useMemo(
    () => ((esModoCiego || ocultarTextoFuturo) ? null : teclasDelTexto(texto)),
    [texto, esModoCiego, ocultarTextoFuturo],
  );

  if (cargando || !ejercicio || esperandoProgreso) return <Spinner texto="Cargando ejercicio..." />;

  if (bloqueadoPorEstrellas) {
    return (
      <div className="flex justify-center px-4 py-10">
        <BloqueoTestFinal
          pendientes={pendientesNivel}
          esOscuro={esOscuro}
          onCompletar={() => navigate(`/curso/${nivel}/${pendientesNivel[0].ejercicioId}`)}
          onVolver={() => navigate(`/curso/${nivel}`)}
          onEntrarIgual={DESBLOQUEAR_TODO_EL_CURSO ? () => setEntrarIgual(true) : undefined}
        />
      </div>
    );
  }

  /* Sub-selector del ejercicio. Los grupos vienen en la propia configuración que
     manda el backend, así que agregar pasos o categorías es tocar el seed — esta
     vista no sabe qué letras ni qué oraciones hay detrás de cada opción. */
  const filasProgresion = esFundamentos
    ? ((ejercicio.configuracion?.filas ?? []) as { id: string; nombre: string; pasos: string[] }[])
    : [];
  const categorias = esSuddenDeath
    ? ((ejercicio.configuracion?.categorias ?? []) as { id: string; nombre: string }[])
    : [];
  const manos = esUnaMano
    ? ((ejercicio.configuracion?.manos ?? []) as { id: string; nombre: string; letras: string }[])
    : [];
  const dedos = esUnDedo
    ? ((ejercicio.configuracion?.dedos ?? []) as { id: string; nombre: string; letras: string }[])
    : [];
  /* Las columnas que recorre el nodo, para la ventana de entrada. Las letras de cada dedo
     vienen en grupos de tres —arriba, reposo, abajo— por contrato con el generador; un dedo
     que no lo cumpla simplemente no se dibuja, igual que allá cae al generador de siempre. */
  const columnasRecorrido = dedos.flatMap((d) => {
    const letras = [...(d.letras ?? '')];
    if (letras.length === 0 || letras.length % 3 !== 0) return [];
    return Array.from({ length: letras.length / 3 }, (_, k) => letras.slice(k * 3, k * 3 + 3));
  });
  const manosForzadas = esManoForzada
    ? ((ejercicio.configuracion?.manos ?? []) as { id: string; nombre: string; letras: string }[])
    : [];
  const simbolosDisponibles = esSimbolos
    ? ((ejercicio.configuracion?.simbolos ?? []) as string[])
    : [];

  /* Símbolos activos. Vacío = todos. Sirve para apagar alguno que el teclado del
     usuario no pueda producir; el backend genera la tanda solo con los que quedan. */
  const simbolosActivos = grupo ? grupo.split('') : simbolosDisponibles;

  const alternarSimbolo = (simbolo: string) => {
    const siguiente = simbolosActivos.includes(simbolo)
      ? simbolosActivos.filter((s) => s !== simbolo)
      : [...simbolosActivos, simbolo];
    // Nunca dejar cero: sin símbolos el ejercicio pierde su sentido.
    if (siguiente.length === 0) return;
    elegirGrupo(siguiente.join(''));
  };

  // Lo que el backend usa cuando no se le manda grupo, para resaltar la opción correcta.
  const grupoActivo = grupo
    || (esFundamentos ? 'central:0'
      : esSuddenDeath ? 'medias'
      : esUnaMano ? 'izquierda'
      : esUnDedo ? 'menique_izq'
      : esManoForzada ? 'izquierda'
      : '');

  const elegirGrupo = (nuevo: string) => {
    setGrupo(nuevo);
    grupoRef.current = nuevo;
    reiniciarProgreso();
    cargar(nuevo);
  };

  const claseOpcion = (activo: boolean) =>
    `rounded-lg px-3 py-2 text-sm font-bold transition-all ${
      esOscuro
        ? (activo ? 'bg-cian text-ground' : 'bg-carta text-gris-texto hover:text-white')
        : (activo ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')
    }`;

  // Datos de los latidos que necesita el render.
  const hayLatidos = latidosVista.length > 0;
  const latidoActual = latidosVista[indiceLatido] ?? null;

  /* UN SELECTOR QUE NO PUEDE ELEGIR NADA NO SE DIBUJA.

     Dos casos que llevaban tiempo en pantalla sin hacer nada, y el usuario reportó el
     segundo:

     - **El nodo se sirve en LATIDOS.** Ahí las tandas ya recorren todos los grupos —un
       dedo por tanda, un paso por nodo— así que elegir uno no cambia nada: el ejercicio te
       sirve los cuatro igual. Es un resto de cuando estos nodos eran una sola pasada.
     - **Queda UNA sola opción.** Los ocho "Un dedo" de Intermedio traen un dedo cada uno, y
       los Fundamentos del Curso un paso cada uno: un selector de un botón que ya está
       pulsado.

     Los SÍMBOLOS son la excepción y siguen siempre: ahí no se elige una variante del
     ejercicio, se apaga un carácter que el teclado del usuario no puede producir. Eso sigue
     haciendo falta dentro del Curso. */
  const opcionesDeGrupo = filasProgresion.reduce((n, f) => n + (f.pasos?.length ?? 0), 0)
    + categorias.length + manos.length + dedos.length + manosForzadas.length;
  const hayGrupos = latidosVista.length === 0 && opcionesDeGrupo >= 2;

  const haySubSelector = hayGrupos || simbolosDisponibles.length > 0;

  const subSelector = haySubSelector && (
    <div className="rounded-2xl border border-(--sup-borde) bg-(--sup) p-6"
      style={{ boxShadow: 'var(--sup-sombra)' }}>
      <p className="mb-4 text-xs font-bold uppercase tracking-widest text-(--sup-tenue)">
        {esFundamentos ? 'Con qué dedos quieres practicar'
          : esSuddenDeath ? 'Longitud de las oraciones'
          : esUnaMano ? 'Con qué mano quieres practicar'
          : esUnDedo ? 'Con qué dedo quieres practicar'
          : esManoForzada ? 'Con qué mano quieres practicar'
          : 'Símbolos incluidos'}
      </p>

      {hayGrupos && esFundamentos && (
        <div className="flex flex-col gap-4">
          {filasProgresion.map((fila) => (
            <div key={fila.id}>
              <p className="mb-2 text-[11px] font-semibold text-(--sup-tenue)">{fila.nombre}</p>
              <div className="flex flex-wrap gap-2">
                {fila.pasos.map((paso, i) => {
                  const clave = `${fila.id}:${i}`;
                  return (
                    <button key={clave} onClick={() => elegirGrupo(clave)}
                      aria-pressed={clave === grupoActivo}
                      className={`${claseOpcion(clave === grupoActivo)} font-mono`}>
                      {paso}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {hayGrupos && esSuddenDeath && (
        <div className="flex flex-wrap gap-2">
          {categorias.map((cat) => (
            <button key={cat.id} onClick={() => elegirGrupo(cat.id)}
              aria-pressed={cat.id === grupoActivo}
              className={claseOpcion(cat.id === grupoActivo)}>
              {cat.nombre}
            </button>
          ))}
        </div>
      )}

      {hayGrupos && esUnaMano && (
        <div className="flex flex-wrap gap-2">
          {manos.map((mano) => (
            <button key={mano.id} onClick={() => elegirGrupo(mano.id)}
              aria-pressed={mano.id === grupoActivo}
              className={claseOpcion(mano.id === grupoActivo)}>
              {mano.nombre}
              <span className="ml-2 font-mono text-[11px] opacity-70">{mano.letras}</span>
            </button>
          ))}
        </div>
      )}

      {hayGrupos && esUnDedo && (
        <div className="flex flex-wrap gap-2">
          {dedos.map((dedo) => (
            <button key={dedo.id} onClick={() => elegirGrupo(dedo.id)}
              aria-pressed={dedo.id === grupoActivo}
              className={`${claseOpcion(dedo.id === grupoActivo)} font-mono`}>
              {dedo.nombre}
              <span className="ml-2 text-[11px] opacity-70">{dedo.letras}</span>
            </button>
          ))}
        </div>
      )}

      {hayGrupos && esManoForzada && (
        <div className="flex flex-wrap gap-2">
          {manosForzadas.map((mano) => (
            <button key={mano.id} onClick={() => elegirGrupo(mano.id)}
              aria-pressed={mano.id === grupoActivo}
              className={claseOpcion(mano.id === grupoActivo)}>
              {mano.nombre}
            </button>
          ))}
        </div>
      )}

      {esSimbolos && (
        <>
          <div className="flex flex-wrap gap-2">
            {simbolosDisponibles.map((s) => (
              <button key={s} onClick={() => alternarSimbolo(s)}
                aria-pressed={simbolosActivos.includes(s)}
                title={simbolosActivos.includes(s) ? 'Quitar de la práctica' : 'Incluir en la práctica'}
                className={`${claseOpcion(simbolosActivos.includes(s))} w-10 font-mono`}>
                {s}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-(--sup-tenue)">
            Apaga los que tu teclado no pueda producir: la práctica se genera sin ellos.
          </p>
        </>
      )}
    </div>
  );

  // El divisor sale del contador que solo avanza, nunca del cronómetro: en contrarreloj
  // el reloj crece con los bonus y hacía que el WPM en vivo subiera a cifras irreales.
  const wpm = totalPresionadas > 0
    ? Math.round((caracteresCorrectos / 5) / (Math.max(1, Math.floor(transcurridoMs / 1000)) / 60))
    : 0;
  const precision = totalPresionadas > 0 ? Math.round((caracteresCorrectos / totalPresionadas) * 100) : 100;
  // Aro de progreso: mismo dato que ya usan las "letras completadas" del panel de stats.
  const progresoPct = texto.length > 0 ? (indice / texto.length) * 100 : 0;

  /* Las 4 métricas, con el stroke de color solo en la apariencia oscura.
     Los colores son los mismos que en la práctica de noticias. */
  const stats = [
    { label: 'Velocidad', valor: String(wpm),      unidad: 'WPM', stroke: '#00F1FD', claro: 'text-emerald-500' },
    { label: 'Precisión', valor: `${precision}`,   unidad: '%',   stroke: '#BF81FF', claro: 'text-sky-500' },
  ];

  return (
    <div
      ref={contenedorRef}
      tabIndex={0}
      data-apariencia={apariencia}
      className="flex flex-col gap-6 outline-none">

      <div className="flex items-start gap-4">
        {esOscuro ? (
          <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}
                className="rounded-xl border border-(--sup-borde) bg-(--sup) px-4 py-3"
                style={{ borderLeft: `3px solid ${s.stroke}` }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--sup-tenue)">{s.label}</p>
                <p className="mt-1 text-(--sup-texto)">
                  <span className="text-3xl font-bold tabular-nums">{s.valor}</span>
                  <span className="ml-1 text-xs text-(--sup-tenue)">{s.unidad}</span>
                </p>
              </div>
            ))}
            <div className="rounded-xl border border-(--sup-borde) bg-(--sup) px-4 py-3"
              style={{ borderLeft: '3px solid #96F8FF' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--sup-tenue)">
                {esContrarreloj ? 'Restante' : 'Tiempo'}
              </p>
              <p className="mt-1">
                <Cronometro ms={tiempoMs} cuentaRegresiva={esContrarreloj} formatoCorto claseColor="text-(--sup-texto)" />
              </p>
            </div>
            <div className="rounded-xl border border-(--sup-borde) bg-(--sup) px-4 py-3"
              style={{ borderLeft: '3px solid #FFFFFF' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--sup-tenue)">
                {esSuddenDeath ? 'Reinicios' : 'Letras'}
              </p>
              <p className="mt-1 text-(--sup-texto)">
                <span className="text-3xl font-bold tabular-nums">{esSuddenDeath ? reinicios : caracteresCorrectos}</span>
                {!esSuddenDeath && <span className="ml-1 text-xs text-(--sup-tenue)">CHAR</span>}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid flex-1 grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-4"
            style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">WPM</span>
              <span className="text-3xl font-bold text-emerald-500">{wpm}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Precisión</span>
              <span className="text-3xl font-bold text-sky-500">{precision}%</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {esContrarreloj ? 'Tiempo restante' : 'Tiempo'}
              </span>
              <Cronometro ms={tiempoMs} cuentaRegresiva={esContrarreloj} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {esSuddenDeath ? 'Reinicios' : 'Caracteres'}
              </span>
              <span className="text-3xl font-bold text-slate-800">{esSuddenDeath ? reinicios : caracteresCorrectos}</span>
            </div>
          </div>
        )}

        {/* Sin sentido en Lluvia de letras ni Palabras flotantes: el índice nunca avanza
            ahí, no hay "% de texto". */}
        {!esLluviaLetras && !esPalabrasFlotantes && <AroProgreso porcentaje={progresoPct} esOscuro={esOscuro} />}
        <button
          onClick={() => setLinternaActiva((v) => !v)}
          title={linternaActiva ? 'Apagar modo linterna' : 'Encender modo linterna'}
          aria-pressed={linternaActiva}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 ${
            linternaActiva
              ? (esOscuro ? 'border-cian bg-cian/15 text-cian' : 'border-emerald-400 bg-emerald-50 text-emerald-600')
              : (esOscuro ? 'border-white/10 bg-carta text-gris-texto hover:text-white' : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600')
          }`}>
          <span className="material-symbols-outlined text-[18px]">
            {linternaActiva ? 'flashlight_on' : 'flashlight_off'}
          </span>
        </button>
        <button
          onClick={() => setTeleprompterActivo((v) => !v)}
          title={teleprompterActivo ? 'Apagar teleprompter' : 'Encender teleprompter'}
          aria-pressed={teleprompterActivo}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 ${
            teleprompterActivo
              ? (esOscuro ? 'border-cian bg-cian/15 text-cian' : 'border-emerald-400 bg-emerald-50 text-emerald-600')
              : (esOscuro ? 'border-white/10 bg-carta text-gris-texto hover:text-white' : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600')
          }`}>
          <span className="material-symbols-outlined text-[18px]">swap_vert</span>
        </button>
        <button
          onClick={() => setCintaActiva((v) => !v)}
          title={cintaActiva ? 'Ver el texto en bloque' : 'Ver el texto como cinta deslizante'}
          aria-pressed={cintaActiva}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 ${
            cintaActiva
              ? (esOscuro ? 'border-cian bg-cian/15 text-cian' : 'border-emerald-400 bg-emerald-50 text-emerald-600')
              : (esOscuro ? 'border-white/10 bg-carta text-gris-texto hover:text-white' : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600')
          }`}>
          <span className="material-symbols-outlined text-[18px]">swipe_left</span>
        </button>
        <button
          onClick={() => setCarruselActivo((v) => !v)}
          title={carruselActivo ? 'Volver al texto corrido' : 'Ver como carrusel de tarjetas'}
          aria-pressed={carruselActivo}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 ${
            carruselActivo
              ? (esOscuro ? 'border-cian bg-cian/15 text-cian' : 'border-emerald-400 bg-emerald-50 text-emerald-600')
              : (esOscuro ? 'border-white/10 bg-carta text-gris-texto hover:text-white' : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600')
          }`}>
          <span className="material-symbols-outlined text-[18px]">view_carousel</span>
        </button>
      </div>

      {subSelector}

      <div className="relative rounded-2xl border border-(--sup-borde) bg-(--sup) p-8"
        style={{ boxShadow: 'var(--sup-sombra)' }}>
        <div className="mb-6 flex items-center gap-3">
          <p className="text-xs font-bold uppercase tracking-widest text-(--sup-tenue)">{ejercicio.titulo}</p>
          {esSuddenDeath && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              esOscuro
                ? (faseSuddenDeath === 'primera' ? 'bg-cian/15 text-cian' : 'bg-medio/20 text-medio')
                : (faseSuddenDeath === 'primera' ? 'bg-sky-100 text-sky-600' : 'bg-amber-100 text-amber-600')
            }`}>
              {faseSuddenDeath === 'primera' ? 'Fase 1: repite hasta acertar' : 'Fase 2: al azar en cada fallo'}
            </span>
          )}

          {/* Modo sombra: el único camino desde la interfaz para correr contra un intento
              tuyo. Antes había que escribir ?fantasma={sesionId} a mano en la URL, así que
              en la práctica la función existía pero no la usaba nadie. */}
          {enSombra ? (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
              esOscuro ? 'bg-medio/20 text-medio' : 'bg-violet-100 text-violet-600'
            }`}>
              <span className="material-symbols-outlined text-[14px]">nightlight</span>
              {fantasmaEsSimulado
                ? `Ritmo simulado de ${ejercicio.fantasmaWpm} WPM`
                : `Sombra: tu intento de ${ejercicio.fantasmaWpm} WPM`}
            </span>
          ) : ofreceSombra && rival && (
            <button
              onClick={() => cargarConFantasma(rival.sesionId)}
              title="Corre contra el registro de tu mejor intento en este ejercicio"
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold transition-all active:scale-95 ${
                esOscuro
                  ? 'bg-medio/15 text-medio hover:bg-medio/25'
                  : 'bg-violet-50 text-violet-600 hover:bg-violet-100'
              }`}>
              <span className="material-symbols-outlined text-[14px]">nightlight</span>
              Correr contra tu mejor intento ({rival.wpm} WPM)
            </button>
          )}
        </div>

        {/* Fantasma simulado: no hace falta tener un intento previo — cualquier WPM de
            referencia sirve para medirse, sea cual sea tu historial en este ejercicio. */}
        {!enSombra && ofreceSombra && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className={`text-[11px] font-semibold ${esOscuro ? 'text-gris-texto' : 'text-slate-400'}`}>
              Competir contra un ritmo de:
            </span>
            {WPM_FANTASMA_SIMULADO.map((wpm) => (
              <button
                key={wpm}
                onClick={() => cargarConFantasmaSimulado(wpm)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-all active:scale-95 ${
                  esOscuro
                    ? 'border-medio/30 text-medio hover:bg-medio/10'
                    : 'border-violet-200 text-violet-600 hover:bg-violet-50'
                }`}>
                {wpm} WPM
              </button>
            ))}
          </div>
        )}

        {avisoRival && (
          <p className={`-mt-3 mb-5 text-xs ${esOscuro ? 'text-gris-texto' : 'text-slate-500'}`}>
            {avisoRival}
          </p>
        )}

        {anclaOtraMano && (
          <div className={`mb-6 flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold transition-colors ${
            anclaActiva
              ? (esOscuro ? 'border-cian/30 bg-cian/10 text-cian' : 'border-emerald-200 bg-emerald-50 text-emerald-600')
              : (esOscuro ? 'border-dificil/40 bg-dificil/10 text-dificil animate-pulse' : 'border-rose-300 bg-rose-50 text-rose-600 animate-pulse')
          }`}>
            <span className="material-symbols-outlined text-[18px]">
              {anclaActiva ? 'front_hand' : 'pan_tool'}
            </span>
            {anclaActiva
              ? `Mano de apoyo detectada sobre "${anclaOtraMano.toUpperCase()}". Puedes escribir.`
              : `Apoya tu mano libre sobre la tecla "${anclaOtraMano.toUpperCase()}" para poder escribir.`}
          </div>
        )}

        {esDictado && (
          <div className={`mb-6 flex items-center gap-3 rounded-xl border p-4 ${
            esOscuro ? 'border-white/8 bg-carta' : 'border-slate-100 bg-slate-50'
          }`}>
            {configDictado?.modo === 'archivo' && configDictado.archivoUrl ? (
              <audio ref={audioRef} controls src={configDictado.archivoUrl} className="w-full" />
            ) : (
              <button
                onClick={reproducirDictado}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 font-semibold transition-all active:scale-95 ${
                  esOscuro
                    ? 'bg-cian text-ground hover:brightness-110'
                    : 'bg-emerald-500 text-white hover:bg-emerald-600'
                }`}>
                <span className="material-symbols-outlined text-[18px]">volume_up</span>
                Escuchar de nuevo
              </button>
            )}
            <p className="text-xs text-(--sup-tenue)">No verás el texto — escribe lo que escuchas.</p>
          </div>
        )}

        {/* Rótulo del latido: qué tanda es y qué cambia en ella. Sin esto las cuatro
            tandas parecen la misma repetida, que es justo lo que se quiere evitar. */}
        {hayLatidos && faseNodo === 'latido' && (
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
              enUltimoIntento ? '' : (esOscuro ? 'bg-cian/15 text-cian' : 'bg-emerald-50 text-emerald-600')
            }`}
              style={enUltimoIntento
                ? { background: 'rgba(255,197,61,0.15)', color: 'var(--color-oro)' }
                : undefined}>
              {latidoActual?.nombre}
            </span>
            {/* En el último intento la descripción NO se repite acá: el aviso de abajo
                 dice lo mismo con más sitio y mejor. Estaban los dos a la vez, uno debajo
                 del otro, diciendo la misma frase. */}
            {!enUltimoIntento && (
              <span className={`text-xs ${esOscuro ? 'text-gris-texto' : 'text-slate-500'}`}>
                {latidoActual?.descripcion}
              </span>
            )}

            {/* Que el tutorial no aparezca no es un fallo: se retomó el nodo. Sin decirlo,
                caer directamente en la tercera tanda se lee como que algo se saltó. */}
            {retomado && (
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                esOscuro ? 'bg-white/8 text-gris-texto' : 'bg-slate-100 text-slate-500'
              }`}>
                Retomas donde ibas
              </span>
            )}

            {/* Los puntos: cuántas tandas tiene el nodo y en cuál vas. */}
            <span className="ml-auto flex items-center gap-1.5">
              {latidosVista.map((_, i) => (
                <span key={i} className="h-1.5 rounded-full transition-all"
                  style={{
                    width: i === indiceLatido ? 20 : 8,
                    background: i < indiceLatido
                      ? 'var(--color-cian)'
                      : i === indiceLatido
                        ? (enUltimoIntento ? 'var(--color-oro)' : 'var(--color-cian)')
                        : (esOscuro ? 'rgba(255,255,255,0.12)' : '#E2E8F0'),
                  }} />
              ))}
            </span>
          </div>
        )}

        {/* El último intento avisa en palabras, no solo con un color. Es el único momento
            del Curso donde la instrucción es "ve más despacio". */}
        {enUltimoIntento && faseNodo === 'latido' && (
          <div className="mb-5 rounded-xl border p-4 text-sm"
            style={{ borderColor: 'rgba(255,197,61,0.35)', background: 'rgba(255,197,61,0.08)' }}>
            <strong style={{ color: 'var(--color-oro)' }}>Último intento.</strong>{' '}
            <span className={esOscuro ? 'text-gris-texto' : 'text-slate-600'}>
              Olvídate del reloj. Aquí solo cuenta acertar: 90% de precisión y el ejercicio es tuyo.
            </span>
          </div>
        )}

        {faseNodo === 'tutorial' && esUnDedo ? (
          <IntroRecorrido
            columnas={columnasRecorrido}
            esOscuro={esOscuro}
            onEmpezar={() => { faseNodoRef.current = 'latido'; setFaseNodo('latido'); }}
          />
        ) : faseNodo === 'tutorial' && ejercicio.teclasTutorial ? (
          <TutorialTeclas
            items={ejercicio.teclasTutorial}
            mensaje={ejercicio.mensajeTutorial}
            captions={ejercicio.captionsTutorial}
            esOscuro={esOscuro}
            onCompletar={() => { faseNodoRef.current = 'latido'; setFaseNodo('latido'); }}
            onSaltar={() => { faseNodoRef.current = 'latido'; setFaseNodo('latido'); }}
          />
        ) : faseNodo === 'tutorial' && esContrarreloj ? (
          <IntroInfo
            icono="timer"
            titulo="Contrarreloj"
            mensaje="Tenés un tiempo inicial que corre en tu contra: escribí antes de que llegue a cero."
            reglas={[
              'Cada palabra correcta suma tiempo.',
              'Cada error resta tiempo.',
              /* Opcional, solo cuando el nodo lo trae — hoy únicamente "Contrarreloj
                 (Intermedio)", que sirve un solo texto largo. No es requisito para
                 avanzar: eso lo sigue decidiendo la precisión, como en cualquier nodo. */
              ...(retoContrarreloj ? [retoContrarreloj] : []),
            ]}
            esOscuro={esOscuro}
            onEmpezar={() => { faseNodoRef.current = 'latido'; setFaseNodo('latido'); }}
          />
        ) : faseNodo === 'tutorial' && introTextoNodo ? (
          <IntroInfo
            icono="info"
            titulo={ejercicio.titulo}
            mensaje={introTextoNodo}
            esOscuro={esOscuro}
            onEmpezar={() => { faseNodoRef.current = 'latido'; setFaseNodo('latido'); }}
          />
        ) : faseNodo === 'tutorial' && patronesPorTandaNodo?.length ? (
          /* El anuncio de la PRIMERA tanda — las siguientes (2ª, 3ª) se anuncian entre
             tandas, ver el bloque de "esperandoEnterTanda" más abajo, que reusa esta
             misma lista. */
          <IntroInfo
            icono="back_hand"
            titulo={ejercicio.titulo}
            mensaje={`Primera combinación: "${patronesPorTandaNodo[0]}". Todas las palabras de esta tanda la tienen.`}
            esOscuro={esOscuro}
            onEmpezar={() => { faseNodoRef.current = 'latido'; setFaseNodo('latido'); }}
          />
        ) : esLluviaLetras ? (
          <VistaLluviaLetras
            texto={texto}
            esOscuro={esOscuro}
            onKeystroke={manejarKeystrokeLluvia}
            onIniciar={manejarInicioLluvia}
            onPerder={manejarPerderLluvia}
            duracionSegundos={
              (ejercicio.configuracion as { duracionSegundos?: number } | undefined)?.duracionSegundos
            }
            reservas={(ejercicio.configuracion as { reservas?: number } | undefined)?.reservas}
          />
        ) : esPalabrasFlotantes ? (
          <PalabrasFlotantes
            palabras={texto.split(' ').filter(Boolean)}
            msHastaElBorde={Number((ejercicio.configuracion as { msHastaElBorde?: number } | undefined)?.msHastaElBorde ?? 6000)}
            onPerder={manejarFinPalabrasFlotantes}
            onCompletar={manejarFinPalabrasFlotantes}
          />
        ) : esPalabrasMutantes ? (
          <VistaPalabrasMutantes texto={texto} indice={indice} errores={errores} esOscuro={esOscuro} />
        ) : esUnDedo ? (
          /* La pista de tres carriles GANA a la cinta y al carrusel, que son preferencias
             generales de lectura. Acá la vista no es una preferencia: es el ejercicio. Un
             recorrido de un dedo servido en una línea plana esconde justo lo que entrena. */
          <VistaRecorrido texto={texto} indice={indice} errores={errores} esOscuro={esOscuro} />
        ) : carruselActivo ? (
          <VistaCarruselPalabras texto={texto} indice={indice} errores={errores} esOscuro={esOscuro} />
        ) : cintaActiva ? (
          <VistaCinta texto={texto} indice={indice} errores={errores} esOscuro={esOscuro}
            masGruesa={esDeLetrasSueltas} />
        ) : (
          <div
            ref={contenedorTeleprompterRef}
            /* 30 px, igual que la cinta y el tutorial: el Curso entero usa el mismo
               cuerpo de letra. A 20 px un drill de sílabas repartido en tres líneas se
               leía como un párrafo, que es exactamente lo que no es. */
            className="font-mono text-3xl leading-relaxed tracking-wide select-none min-h-[120px]"
            style={{
              // Mismo criterio que la cinta: un poco más de trazo solo en letras sueltas.
              fontWeight: esDeLetrasSueltas ? 500 : 400,
              ...(teleprompterActivo ? { height: '4.5em', overflowY: 'hidden' } : {}),
            }}>
            {(ocultarTextoFuturo ? texto.slice(0, indice) : texto).split('').map((char, i) => (
              <span
                key={i}
                ref={i === indice ? cursorSpanRef : undefined}
                className={`${getColorCaracter(i)} transition-all`}
                style={linternaActiva && Math.abs(i - indice) > RADIO_LINTERNA ? { opacity: 0.12 } : undefined}>
                {char}
              </span>
            ))}
            {ocultarTextoFuturo && indice < texto.length && (
              <span className={`cursor-blink border-b-2 ${
                esOscuro ? 'border-cian text-faint' : 'border-emerald-500 text-slate-300'
              }`}>&nbsp;</span>
            )}
          </div>
        )}

        {terminado && (
          <div className={`mt-6 animate-pulse text-center text-lg font-bold ${
            esOscuro ? 'text-cian' : 'text-emerald-500'
          }`}>
            {guardando
              ? (esOscuro ? 'Guardando resultados…' : '⏳ Guardando resultados...')
              : esLluviaLetras
                /* La lluvia se cierra SIEMPRE en buenos términos, se haya sobrevivido el
                   tiempo o se haya perdido un carril. Es un ejercicio de relajo: no exige
                   velocidad (sus umbrales van en cero) y en la pantalla siguiente están
                   los dos botones, repetir y avanzar. Regañar a alguien por perder en un
                   juego que existe para descansar es exactamente lo contrario de lo que
                   hace ahí. El mensaje anterior anunciaba una derrota: "se llenó una
                   columna — partida terminada". */
                ? '¡Muy bien! Puedes repetirla o seguir adelante'
                : esModoCiego
                  /* Los 2 segundos de revelación: sin este aviso la pausa parece que
                     la app se colgó justo al terminar. */
                  ? 'Así te fue — mira el texto'
                  : (esOscuro ? '¡Completado!' : '✅ ¡Completado!')}
          </div>
        )}

        {/* Va DENTRO de la tarjeta del ejercicio: se posiciona con `absolute inset-0` y
            necesita que su ancestro posicionado sea la tarjeta, no la pantalla. Así el
            teclado y las métricas siguen viéndose alrededor y el corte se lee como una
            pausa y no como haber salido del ejercicio. */}
        {/* Fuera del flujo y sin pausar: ver AvisoTeclaEspecial. Solo en el Curso, que es
            donde se está enseñando a teclear. */}
        {!resumen && faseNodo !== 'tutorial' && (
          <AvisoTeclaEspecial
            caracter={caracterDelAviso}
            ladoTexto={posicionAviso.lado}
            arribaTexto={posicionAviso.arriba}
            bloqueo={bloqueoAviso}
            esOscuro={esOscuro}
            sacudidaSello={mayusculaFallidaSello}
          />
        )}

        {/* LA PISTA DE TECLA EQUIVOCADA. Va debajo del texto y no al costado como el aviso
            de tecla especial, y la diferencia es de tiempo: el aviso acompaña a una tecla
            que todavía no se ha pulsado, y la pista corrige una que ya se pulsó. Lo que ya
            pasó se lee donde estaba mirando el ojo. */}
        {pista && (
          <AvisoPista key={pista.sello} texto={pista.texto}
            pulsada={pista.pulsada} esperada={pista.esperada} esOscuro={esOscuro} />
        )}

        {destello !== null && !esperandoEnterTanda && (
          <DestelloTanda precision={destello} esOscuro={esOscuro} />
        )}

        {/* SOLO "Oraciones con mayúsculas incluidas" por ahora: en vez del destello que
            se desvanece solo (DestelloTanda usa la clase `destello-tanda`, que termina
            en opacity:0 a los 1,5s — serviría para desaparecer, no para quedarse), esto
            se queda fijo hasta que se aprieta Enter. Mismo lenguaje visual que el
            cuadrito de la barra espaciadora en el tutorial de palabras (ícono, no una
            letra — acá `keyboard_return` en vez de `space_bar`). */}
        {esperandoEnterTanda && destello !== null && (() => {
          const bien = destello >= 85; // mismo umbral que DestelloTanda (UMBRAL_ELOGIO)
          const color = bien
            ? (esOscuro ? 'var(--color-cian)' : '#059669')
            : 'var(--color-oro)';
          /* Con "patronesPorTanda", el mensaje no es un elogio: es el anuncio de la
             combinación que sigue — tandaActual todavía no avanzó acá (eso lo hace
             avanzarASiguienteTanda al presionar Enter), así que el siguiente patrón es
             el índice actual + 1. Se lee del estado espejo y no del ref: leer un
             ref.current dentro del render dispara react-hooks/refs. */
          const siguientePatron = patronesPorTandaNodo?.[tandaActual + 1];
          return (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 rounded-2xl border px-8 py-6"
                style={{
                  borderColor: color,
                  background: esOscuro ? 'rgba(6,14,23,0.92)' : 'rgba(255,255,255,0.95)',
                  boxShadow: `0 0 0 6px ${bien ? 'rgba(0,241,253,0.10)' : 'rgba(255,197,61,0.12)'}`,
                }}>
                <div className="flex items-center gap-3">
                  <Icono nombre={siguientePatron ? 'back_hand' : (bien ? 'check_circle' : 'target')}
                    tamano={34} relleno style={{ color }} />
                  <p className="text-2xl font-bold" style={{ color }}>
                    {siguientePatron
                      ? `Ahora: "${siguientePatron}"`
                      : (bien ? '¡Muy bien!' : 'Casi, prioriza tu precisión')}
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5"
                  style={{ borderColor: color, color }}>
                  <Icono nombre="keyboard_return" tamano={20} />
                  <span className="text-sm font-semibold">Presioná Enter para continuar</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Mismo molde que DestelloTanda (aparece y se desvanece solo, pointer-events-none
            para no robar el tecleo) pero con su propio mensaje: el badge de arriba ya
            cambia de "Fase 1" a "Fase 2" en silencio, y esto avisa en el momento exacto
            en que pasa. */}
        {avisoFase2 && (
          /* `animationDuration` inline pisa el 1,5s de la clase `destello-tanda` sin
             tocarla: anuncia un cambio de mecánica, no un simple corte entre frases, así
             que necesita quedarse un segundo más (DURACION_AVISO_FASE2_MS). */
          <div className="destello-tanda pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            style={{ animationDuration: `${DURACION_AVISO_FASE2_MS}ms` }}>
            <div className="flex items-center gap-3 rounded-2xl border px-7 py-5"
              style={{
                borderColor: 'var(--color-oro)',
                background: esOscuro ? 'rgba(6,14,23,0.92)' : 'rgba(255,255,255,0.95)',
                boxShadow: '0 0 0 6px rgba(255,197,61,0.12)',
              }}>
              <Icono nombre="bolt" tamano={34} relleno style={{ color: 'var(--color-oro)' }} />
              <p className="text-2xl font-bold" style={{ color: 'var(--color-oro)' }}>
                ¡Fase 2! Ahora cada fallo trae una oración distinta.
              </p>
            </div>
          </div>
        )}

        {resumen && (
          <ResumenLatido
            nombre={resumen.nombre}
            indice={resumen.indice}
            total={resumen.total}
            wpm={resumen.wpm}
            precision={resumen.precision}
            aciertos={resumen.aciertos}
            cierre={resumen.cierre}
            umbrales={resumen.umbrales}
            esOscuro={esOscuro}
            onContinuar={continuarTrasResumen}
          />
        )}
      </div>

      {/* El teclado de abajo asume "hay una única próxima tecla fija" — ni Lluvia de
          letras (el objetivo cambia según qué columna esté más urgente) ni Palabras
          flotantes (puedes estar tecleando cualquiera de las que están cruzando) tienen
          eso, así que se omite para no mostrar una tecla resaltada que no significa nada. */}
      {!esLluviaLetras && !esPalabrasFlotantes && (
        <TecladoGuia
          caracterEsperado={caracterEsperado}
          teclaError={teclaError}
          teclaPulsada={teclaPresionada}
          esOscuro={esOscuro}
          guiaDedos={guiaDedos}
          onAlternarGuia={() => setGuiaDedos((v) => !v)}
          conjuntoActivo={conjuntoActivo}
          sinRojoDeError={esModoCiego}
          sacudidaSello={mayusculaFallidaSello}
        />
      )}
    </div>
  );
};

export default CursoPracticaView;
