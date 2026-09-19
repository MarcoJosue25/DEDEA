import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type {
  SesionProgresoDTO, NoticiaDTO, DebilidadesResponse, EjercicioDTO, ResultadoCursoResponse,
  NivelCurso, ProgresoEjercicioResponse,
} from '../types';
import { obtenerDebilidades } from '../api/statsApi';
import { listarEjercicios, obtenerSiguienteEnCurso } from '../api/ejercicioApi';
import { obtenerProgresoCursoPorNivel } from '../api/cursoStatsApi';
import SelectorApariencia from '../components/ui/SelectorApariencia';
import RecompensaCurso from '../components/curso/RecompensaCurso';
import DesgloseTandas from '../components/curso/DesgloseTandas';
import ConfirmarRepeticion from '../components/curso/ConfirmarRepeticion';
import { useApariencia } from '../core/apariencia/useApariencia';
import { DESBLOQUEAR_TODO_EL_CURSO } from '../core/desarrollo';
import { NOMBRE_NIVEL, llegoAlTestFinal } from '../core/curso/sendero';

interface ResultadoSesion {
  wpm: number;
  precision: number;
  segundos: number;
  /* Añadidos para la apariencia oscura: `segundos` es entero y no alcanza para
     mostrar centésimas, y las letras no se guardaban en ningún lado. Vienen
     ausentes en resultados generados antes del cambio. */
  tiempoMs?: number;
  caracteres?: number;
  dificultad?: string;
  progreso: SesionProgresoDTO[];
  /* Modo sombra: el recorrido de la sesión que enfrentaste, para dibujarlo detrás del
     tuyo. Ausente cuando no corriste contra nadie. */
  progresoRival?: SesionProgresoDTO[];
  rivalWpm?: number;
  peoresTeclas?: { secuencia: string; porcentajeError: number }[];
  peoresBigramas?: { secuencia: string; porcentajeError: number }[];
  desgloseTeclas?: { tecla: string; intentos: number; errores: number; aciertos: number }[];
  desgloseNgrams?: {
    secuencia: string; tipo: string; intentos: number;
    errores: number; aciertos: number; aparicionesEnTexto: number;
  }[];
  esIA?: boolean;
  esPalabras?: boolean;
  desgloseSuddenDeath?: {
    general: { wpm: number; precision: number };
    fase1: { wpm: number; precision: number } | null;
    fase2: { wpm: number; precision: number } | null;
  } | null;
  // RESISTENCIA: primer 15% del texto vs. el resto, para ver si el rendimiento cae
  // con el cansancio. Ausente en cualquier otro tipo de ejercicio.
  analisisResistencia?: {
    wpmInicial: number;
    precisionInicial: number;
    wpmResto: number;
    precisionResto: number;
    cayoRendimiento: boolean;
  } | null;
}

/* Fondo de la insignia de dificultad: el mismo color que los puntos de las
   tarjetas de Noticias, en tonalidad oscura (baja opacidad sobre el degradado). */
const FONDO_DIFICULTAD: Record<string, string> = {
  FACIL:   'rgba(0, 72, 255, 0.28)',
  MEDIO:   'rgba(191, 129, 255, 0.28)',
  DIFICIL: 'rgba(255, 0, 4, 0.28)',
};

const ResultadosView = () => {
  const navigate = useNavigate();
  const { apariencia } = useApariencia();
  const [resultado, setResultado] = useState<ResultadoSesion | null>(null);
  const [debilidadesGlobales, setDebilidadesGlobales] = useState<DebilidadesResponse | null>(null);

  useEffect(() => {
    obtenerDebilidades()
      .then(setDebilidadesGlobales)
      .catch((err) => console.error('Error cargando debilidades:', err));
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem('sesion_resultado');
    if (!stored) { navigate('/'); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResultado(JSON.parse(stored));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTiempo = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const seg = (s % 60).toString().padStart(2, '0');
    return `${m}:${seg}`;
  };

  /* Tiempo con centésimas ("1:09.45"). Si el resultado viene de antes de que se
     guardara tiempoMs, se cae a los segundos enteros. */
  const tiempoConCentesimas = (r: ResultadoSesion) => {
    const ms = r.tiempoMs ?? r.segundos * 1000;
    const totalSeg = Math.floor(ms / 1000);
    const cent = Math.floor((ms % 1000) / 10);
    return {
      principal: `${Math.floor(totalSeg / 60)}:${(totalSeg % 60).toString().padStart(2, '0')}`,
      centesimas: cent.toString().padStart(2, '0'),
    };
  };

  const badgeDificultadClaro = (d?: string) => {
    switch (d) {
      case 'FACIL':   return 'bg-emerald-100 text-emerald-700';
      case 'MEDIO':   return 'bg-sky-100 text-sky-700';
      case 'DIFICIL': return 'bg-rose-100 text-rose-700';
      default:        return 'bg-slate-100 text-slate-600';
    }
  };

  /* La práctica con IA se arma con el histórico GLOBAL, no con esta sesión:
     una sesión de 20 segundos aporta dos o tres errores, muestra demasiado chica
     para deducir una debilidad real (el backend exige NGRAM_MIN_INTENTOS). */
  const generarConIa = useCallback(() => {
    if (!debilidadesGlobales) return;
    sessionStorage.setItem('debilidades_teclas', JSON.stringify(debilidadesGlobales.peoresTeclas));
    sessionStorage.setItem('debilidades_bigramas', JSON.stringify(debilidadesGlobales.peoresBigramas));
    sessionStorage.setItem('debilidades_trigramas', JSON.stringify(debilidadesGlobales.peoresTrigramas));
    navigate('/selector-ia');
  }, [debilidadesGlobales, navigate]);

  /* De dónde vino la sesión. Los botones de abajo significan cosas distintas según
     el caso: en el curso plano (Ejercicios Base) mueven entre EJERCICIOS del catálogo,
     en noticias entre noticias, y en curso-nivel (secuencia dentro de un nivel) avanzan
     de a un nodo con Enter en vez de anterior/siguiente/repetir. */
  const origen = sessionStorage.getItem('origen_practica') ?? 'noticia';
  const esCurso = origen === 'curso';
  const esCursoNivel = origen === 'curso-nivel';
  /* El modo IA navega como una noticia (repetir vuelve a /practica, que relee el
     sessionStorage) pero NO es una noticia: lo que se repite es un ejercicio generado a
     medida. Solo cambia el rotulo del boton — el destino ya era el correcto. */
  const esIa = origen === 'ia';
  const ejercicioId = Number(sessionStorage.getItem('ejercicio_id') ?? 0);
  const nivelActual = sessionStorage.getItem('curso_nivel_actual');

  /* El veredicto del Curso, calculado por el servidor y dejado en sessionStorage por
     CursoPracticaView. Inicialización perezosa y no un efecto: el valor YA está cuando
     la vista monta, así que setearlo desde un useEffect sería justo el patrón que este
     repo prohíbe (react-hooks/set-state-in-effect).

     Es `useState` y no una lectura directa en el cuerpo del render para que el valor
     quede congelado en el primer render: si un re-render lo releyera después de que otra
     pantalla lo limpie, la recompensa desaparecería a mitad de la animación.

     ⚠️ EL GUARD ES `esCursoNivel`, NO "¿hay algo guardado?". Atarlo a la existencia de la
     clave fue un error con consecuencia visible: `resultado_curso` sobrevivía en
     sessionStorage al terminar el ejercicio del Curso, así que la siguiente NOTICIA
     mostraba el panel de estrellas y el título del último ejercicio del Curso. El origen
     de la sesión es el único dato que dice de verdad a qué sección pertenece esta
     pantalla. Ejercicios Base queda fuera también, y es correcto: sus filas tienen
     nivel = null, o sea que el backend ni siquiera devuelve veredicto. */
  const [recompensa] = useState<ResultadoCursoResponse | null>(() => {
    if (!esCursoNivel) return null;
    const crudo = sessionStorage.getItem('resultado_curso');
    if (!crudo) return null;
    try {
      return JSON.parse(crudo) as ResultadoCursoResponse;
    } catch {
      return null;
    }
  });

  /* Un juego (hoy solo Lluvia de letras). Sale del veredicto del servidor y no de una clave
     propia de sessionStorage porque ese objeto ya llega entero acá. */
  const esJuego = recompensa?.esJuego === true;

  /* El desglose por frase de los nodos servidos en tandas. Inicializacion perezosa por
     lo mismo que la recompensa: el valor YA esta cuando la vista monta, asi que leerlo
     desde un efecto seria el setState-en-efecto que este repo prohibe. */
  const [tandas] = useState<{ wpm: number; precision: number }[]>(() => {
    if (!esCursoNivel) return [];
    try {
      const crudo = sessionStorage.getItem('resultados_tandas');
      return crudo ? JSON.parse(crudo) : [];
    } catch {
      return [];
    }
  });

  /* El detalle segundo a segundo de cada tanda, solo para el gráfico — nunca viaja al
     backend, así que no está en `resultado.progreso` (eso es de la ÚLTIMA tanda nada más,
     ver la nota en CursoPracticaView). Efímero a propósito: si no está, el gráfico cae a
     una sola línea con `resultado.progreso`, como siempre hizo. */
  const [progresoTandas] = useState<(SesionProgresoDTO & { tanda: number })[]>(() => {
    if (!esCursoNivel) return [];
    try {
      const crudo = sessionStorage.getItem('progreso_tandas');
      return crudo ? JSON.parse(crudo) : [];
    } catch {
      return [];
    }
  });

  // Mismo guard para el titular: el nombre del ejercicio solo tiene sentido en el Curso.
  const ejercicioTitulo = esCursoNivel ? (sessionStorage.getItem('ejercicio_titulo') ?? '') : '';

  /* Se evaluó borrar las dos claves al leerlas, para que el traspaso fuera de un solo uso,
     y se descartó: con el guard de arriba ya no pueden filtrarse a otra sección, y
     borrarlas rompería volver a esta pantalla con el botón "atrás" del navegador —la
     recompensa desaparecería y quedarían las cifras sueltas—. Dentro del Curso tampoco
     pueden quedar viejas: CursoPracticaView escribe `resultado_curso` o lo BORRA en cada
     guardado, tanto si responde el servidor como si falla. */

  // Catálogo del curso, solo si hace falta para calcular anterior/siguiente.
  const [ejercicios, setEjercicios] = useState<EjercicioDTO[]>([]);
  useEffect(() => {
    if (!esCurso) return;
    listarEjercicios().then(setEjercicios).catch(() => setEjercicios([]));
  }, [esCurso]);

  /* Curso-nivel: el siguiente ejercicio de la secuencia. Tres estados con dos valores
     porque así se evita un setState síncrono al arrancar el efecto (prohibido en este
     proyecto — ver la nota de duplicados en sesion_progreso): undefined = todavía no se
     preguntó, null = ya se preguntó y no hay siguiente (Test Final), objeto = hay uno. */
  const [siguienteEnCurso, setSiguienteEnCurso] = useState<EjercicioDTO | null | undefined>(undefined);
  const cargandoSiguiente = esCursoNivel && siguienteEnCurso === undefined;
  useEffect(() => {
    if (!esCursoNivel || !ejercicioId) return;
    obtenerSiguienteEnCurso(ejercicioId)
      .then(setSiguienteEnCurso)
      .catch(() => setSiguienteEnCurso(null));
  }, [esCursoNivel, ejercicioId]);

  /* LOS NODOS DEL NIVEL, con las estrellas de este intento ya puestas: la petición sale
     después de guardar la sesión, así que el guion del ejercicio recién hecho ya viene en su
     color nuevo. Alimentan la barra de guiones y el modo de completar estrellas.

     Tri-estado: undefined = cargando, null = falló (la barra vuelve a ser la lisa y el botón
     principal, el de siempre), lista = llegó. */
  const [nodosNivel, setNodosNivel] = useState<ProgresoEjercicioResponse[] | null | undefined>(
    () => (esCursoNivel && nivelActual ? undefined : null));
  useEffect(() => {
    if (!esCursoNivel || !nivelActual) return;
    let vigente = true;
    obtenerProgresoCursoPorNivel(nivelActual.toUpperCase() as NivelCurso)
      .then((lista) => { if (vigente) setNodosNivel(lista); })
      .catch(() => { if (vigente) setNodosNivel(null); });
    return () => { vigente = false; };
  }, [esCursoNivel, nivelActual]);
  const cargandoNodos = esCursoNivel && nodosNivel === undefined;

  // El ejercicio ya aprobado que se tocó en la barra, esperando la confirmación.
  const [confirmar, setConfirmar] = useState<ProgresoEjercicioResponse | null>(null);

  /* EL MODO DE COMPLETAR ESTRELLAS. Se enciende cuando ya no queda nada del sendero por
     hacer salvo el Test Final, y el Test Final todavía no está dado o está cerrado por
     estrellas. Ahí "siguiente" deja de significar "el siguiente del sendero" —que ya está
     hecho— y pasa a significar "el siguiente de una estrella" (los guiones amarillos). Sin
     esto habría dos botones de avanzar compitiendo: uno al nodo de al lado y otro al que de
     verdad falta.

     Destino del botón principal, por orden:
       · el siguiente amarillo después de este (y si no hay, el primero): "Ir al siguiente";
       · si el único amarillo que queda es ESTE: "Repetir este ejercicio";
       · si no queda ninguno: "Ir al Test Final".
     Ese destino es además el guion que parpadea en la barra. */
  const nodos = nodosNivel ?? [];
  const pendientes = nodos.filter((n) => n.porMejorar);
  const testFinal = nodos.find((n) => n.rolEnNivel === 'TEST_FINAL') ?? null;
  const modoCompletar = testFinal !== null && llegoAlTestFinal(nodos)
    && ejercicioId !== testFinal.ejercicioId
    && (pendientes.length > 0 || !testFinal.completado);
  const ordenActual = nodos.find((n) => n.ejercicioId === ejercicioId)?.orden ?? 0;
  const otrosPendientes = pendientes.filter((n) => n.ejercicioId !== ejercicioId);
  /* El `length` es explícito a propósito: `otrosPendientes[0]` tipa como si existiera siempre,
     y con un `?? null` detrás TypeScript daba la rama de "repetir" por inalcanzable. */
  const siguientePendiente = otrosPendientes.find((n) => n.orden > ordenActual)
    ?? (otrosPendientes.length > 0 ? otrosPendientes[0] : null);
  const esteSigueSinEstrellas = pendientes.some((n) => n.ejercicioId === ejercicioId);
  const destinoCompletar: ProgresoEjercicioResponse | 'repetir' | null = !modoCompletar
    ? null
    : siguientePendiente ?? (esteSigueSinEstrellas ? 'repetir' : testFinal);
  const destacadoId = destinoCompletar === 'repetir'
    ? ejercicioId
    : destinoCompletar?.ejercicioId ?? null;

  /* LA PRUEBA DE NIVEL no es un paso del sendero (orden 0), así que "el siguiente
     ejercicio" no significa nada después de ella: desde el orden 0 el siguiente es siempre
     el primer nodo, aunque ya vayas por el veinte. Aprobada, se va al nivel que acaba de
     abrirse; no aprobada, a retomar el curso donde ibas (o a empezarlo). */
  const esPruebaNivel = recompensa?.rolEnNivel === 'TEST_NIVEL';
  const nivelAbierto = esPruebaNivel ? recompensa?.nivelDesbloqueado ?? null : null;
  const retomarCurso = esPruebaNivel && !recompensa?.superado
    ? nodos.find((n) => !n.completado) ?? null
    : null;

  const irASiguienteOMenu = useCallback(() => {
    if (nivelAbierto) {
      navigate(`/curso/${nivelAbierto.toLowerCase()}`);
    } else if (destinoCompletar === 'repetir') {
      navigate(`/curso/${nivelActual}/${ejercicioId}`);
    } else if (destinoCompletar) {
      navigate(`/curso/${nivelActual}/${destinoCompletar.ejercicioId}`);
    } else if (retomarCurso) {
      navigate(`/curso/${nivelActual}/${retomarCurso.ejercicioId}`);
    } else if (siguienteEnCurso) {
      navigate(`/curso/${nivelActual}/${siguienteEnCurso.id}`);
    } else {
      navigate(`/curso/${nivelActual}`);
    }
  }, [nivelAbierto, destinoCompletar, retomarCurso, siguienteEnCurso, nivelActual, ejercicioId, navigate]);

  /* El rótulo del botón principal, que cambia con el modo. Una sola función para los dos
     paneles (ejercicio y juego): lo único que difiere es cómo se dice "el siguiente del
     sendero" fuera del modo. */
  const rotuloPrincipal = (siguienteNormal: string) => {
    if (cargandoSiguiente || cargandoNodos) return 'Cargando…';
    if (nivelAbierto) return `Ir al ${NOMBRE_NIVEL[nivelAbierto]}`;
    if (destinoCompletar === 'repetir') return 'Repetir este ejercicio';
    if (destinoCompletar) {
      return destinoCompletar.rolEnNivel === 'TEST_FINAL' ? 'Ir al Test Final' : 'Ir al siguiente ejercicio';
    }
    if (retomarCurso) return nodos.some((n) => n.completado) ? 'Continuar el curso' : 'Empezar el curso';
    return siguienteEnCurso ? siguienteNormal : 'Volver al menú';
  };

  /* Un guion de la barra. Amarillo (le falta una estrella): se va directo. Ya aprobado: se
     pregunta. Sin hacer —el Test Final incluido—: solo si es el siguiente del sendero, o con
     el desbloqueo de desarrollo; si el examen está cerrado, su pantalla enseña la ventana
     con "Completarlos ahora". El guion del ejercicio actual no hace nada: para eso está
     "Repetir".

     El Test Final iba antes directo, con o sin llegar a él. Lo frenaba la ventana de las
     estrellas, y esa ventana ya no sale hasta llegar al final (ver llegoAlTestFinal). */
  const elegirNodo = (n: ProgresoEjercicioResponse) => {
    if (n.ejercicioId === ejercicioId) return;
    const ir = () => navigate(`/curso/${nivelActual}/${n.ejercicioId}`);
    if (n.porMejorar) { ir(); return; }
    if (n.completado) { setConfirmar(n); return; }
    const primeroSinHacer = nodos.find((x) => !x.completado);
    if (DESBLOQUEAR_TODO_EL_CURSO || primeroSinHacer?.ejercicioId === n.ejercicioId) ir();
  };

  const volverAlMenu = useCallback(() => {
    navigate(`/curso/${nivelActual}`);
  }, [nivelActual, navigate]);

  // Enter hace lo mismo que el botón — refuerza justo el gesto que se está entrenando.
  useEffect(() => {
    if (!esCursoNivel || cargandoSiguiente || cargandoNodos) return;
    const manejar = (e: KeyboardEvent) => {
      // Mantener Enter pulsado navegaba varias veces seguidas.
      if (e.repeat) return;
      // Con la pregunta de "¿deseas repetirlo?" abierta, Enter es de la pregunta.
      if (confirmar || e.defaultPrevented) return;
      if (e.key === 'Enter') irASiguienteOMenu();
    };
    window.addEventListener('keydown', manejar);
    return () => window.removeEventListener('keydown', manejar);
  }, [esCursoNivel, cargandoSiguiente, cargandoNodos, confirmar, irASiguienteOMenu]);

  const posicion = ejercicios.findIndex((e) => e.id === ejercicioId);

  /* Repetir: se vuelve a la misma pantalla.

     En Ejercicios Base el contenido sale distinto, porque el backend rebaraja en cada
     llamada y la vista lo pide al montar. En noticias y en IA sale IGUAL, porque el texto
     ya esta en sessionStorage: se repite el mismo, que es lo que se quiere para volver a
     intentar un ejercicio armado sobre tus ngrams fallados.

     Que esto funcione en IA depende de que PracticaView ya NO borre texto_ia_seleccionado
     al guardar la sesion. Cuando lo borraba, esta misma linea terminaba en la portada de
     noticias — ver la nota larga en PracticaView, en el .then del guardado. */
  const repetir = useCallback(() => {
    /* Tres destinos, uno por origen. El de curso-nivel vuelve al MISMO nodo dentro del
       sendero (no a /ejercicios-base/, que es el catálogo plano y sacaría al usuario de
       la secuencia): así al terminar de repetir vuelve a aparecer "Enter → siguiente" y
       no se pierde el hilo del nivel. */
    if (esCursoNivel) navigate(`/curso/${nivelActual}/${ejercicioId}`);
    else navigate(esCurso ? `/ejercicios-base/${ejercicioId}` : '/practica');
  }, [navigate, esCurso, esCursoNivel, nivelActual, ejercicioId]);

  /* Espacio = repetir: el mismo gesto que ya hace el botón, sin levantar las manos del
     teclado. Va en un listener aparte del de Enter porque son dos flujos distintos —
     Enter avanza al siguiente nodo dentro de un nivel del Curso, espacio rehace el
     ejercicio que acabás de terminar.

     Vale en TODOS los orígenes, curso-nivel incluido. Durante un tiempo quedó fuera de
     ahí porque esa pantalla no tenía botón "Repetir" y el atajo no habría tenido a qué
     acción corresponder; ahora lo tiene, en el medio de los otros dos.

     El preventDefault no es opcional: sin él la barra espaciadora además desplaza la
     página mientras navega. */
  useEffect(() => {
    const manejar = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key !== ' ') return;
      // Con la pregunta abierta, el espacio no puede repetir por detrás.
      if (confirmar) return;
      e.preventDefault();
      repetir();
    };
    window.addEventListener('keydown', manejar);
    return () => window.removeEventListener('keydown', manejar);
  }, [repetir, confirmar]);

  // Salta al ejercicio anterior o siguiente del curso, en el orden del catálogo.
  const irAEjercicio = useCallback((delta: number) => {
    const destino = ejercicios[posicion + delta];
    if (!destino) return;
    sessionStorage.setItem('ejercicio_id', String(destino.id));
    navigate(`/ejercicios-base/${destino.id}`);
  }, [ejercicios, posicion, navigate]);

  /* Anterior / Siguiente: mueven el índice sobre la lista que dejó la portada.
     Devuelve false cuando no hay a dónde ir, para poder deshabilitar el botón. */
  const hayLista = () => {
    try {
      return (JSON.parse(sessionStorage.getItem('lista_noticias') || '[]') as NoticiaDTO[]).length > 0;
    } catch { return false; }
  };

  const irANoticia = useCallback((delta: number) => {
    /* Sin valor inicial: el catch sale de la función, así que si se llega a la línea
       siguiente `lista` está siempre asignada. El `= []` de antes no se leía nunca y era
       lo que marcaba no-useless-assignment. */
    let lista: NoticiaDTO[];
    try { lista = JSON.parse(sessionStorage.getItem('lista_noticias') || '[]'); } catch { return; }
    const actual = parseInt(sessionStorage.getItem('indice_noticia') || '0', 10);
    const nuevo = actual + delta;
    if (nuevo < 0 || nuevo >= lista.length) return;

    sessionStorage.setItem('noticia_seleccionada', JSON.stringify(lista[nuevo]));
    sessionStorage.setItem('indice_noticia', String(nuevo));
    // Se sale del modo IA al saltar a una noticia normal.
    sessionStorage.removeItem('texto_ia_seleccionado');
    sessionStorage.removeItem('practica_ia_config');
    navigate('/practica');
  }, [navigate]);

  if (!resultado) return null;

  /* La curva del rival se indexa por segundo y se mezcla con la tuya, en vez de ir como
     una serie aparte: recharts necesita un eje X común para que las dos líneas queden
     alineadas. Los segundos donde el rival ya había terminado quedan en undefined y
     recharts simplemente corta la línea ahí, que es justo lo que se quiere mostrar. */
  const rivalPorSegundo = new Map(
    (resultado.progresoRival ?? []).map((p) => [p.segundo, p.wpmMomento]),
  );
  const hayRival = rivalPorSegundo.size > 0;

  const datosGrafico = resultado.progreso?.map((p) => ({
    segundo: p.segundo,
    wpm: p.wpmMomento,
    rival: rivalPorSegundo.get(p.segundo),
  })) || [];

  /* Una línea por TANDA en vez de una sola para todo el nodo — pedido del usuario al ver
     que un nodo de 3-4 oraciones solo mostraba el progreso de la última. `progresoTandas`
     es efímero (ver su nota) y viene en formato largo (un punto por segundo y por tanda);
     acá se pasa a formato ANCHO (`tanda0`, `tanda1`...) porque es lo que Recharts pide para
     dibujar varias `<Line>` sobre el mismo eje de segundos. Sin `progresoTandas` (cualquier
     ejercicio sin tandas, o una sesión vieja) queda vacío y el gráfico de siempre no cambia
     en nada. */
  const tandasDelGrafico = [...new Set(progresoTandas.map((p) => p.tanda))].sort((a, b) => a - b);
  const datosGraficoTandas = tandasDelGrafico.length > 0
    ? Array.from(
      { length: Math.max(0, ...progresoTandas.map((p) => p.segundo)) },
      (_, i) => {
        const segundo = i + 1;
        const fila: { segundo: number } & Record<string, number> = { segundo };
        progresoTandas
          .filter((p) => p.segundo === segundo)
          .forEach((p) => { fila[`tanda${p.tanda}`] = p.wpmMomento; });
        return fila;
      },
    )
    : [];
  // Cian, violeta, dorado, verde — los mismos cuatro colores que ya usa el resto del Curso
  // (precisión, dificultad media, estrellas...), ciclados si algún día hay más de cuatro.
  const COLORES_TANDA = ['#00F1FD', '#BF81FF', '#FFC53D', '#34D399'];

  const esOscuro = apariencia === 'oscuro';
  const listaDisponible = hayLista();

  // "¿Deseas repetirlo?", al tocar en la barra un ejercicio que ya está aprobado.
  const ventanaConfirmar = confirmar && (
    <ConfirmarRepeticion
      nodo={confirmar}
      esOscuro={esOscuro}
      onRepetir={() => navigate(`/curso/${nivelActual}/${confirmar.ejercicioId}`)}
      onCancelar={() => setConfirmar(null)}
    />
  );

  /* ======================= BOTONES DE ACCIÓN =======================
     Los mismos cuatro en las dos apariencias; solo cambia el estilo. */
  // En el curso los laterales cambian de EJERCICIO; fuera, de noticia.
  const alAnterior = esCurso ? () => irAEjercicio(-1) : () => irANoticia(-1);
  const alSiguiente = esCurso ? () => irAEjercicio(1) : () => irANoticia(1);
  const hayAnterior = esCurso ? posicion > 0 : listaDisponible;
  const haySiguiente = esCurso ? posicion >= 0 && posicion < ejercicios.length - 1 : listaDisponible;

  const acciones = (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button
        onClick={alAnterior}
        disabled={!hayAnterior}
        className={esOscuro
          ? 'flex items-center gap-2 rounded-full border border-(--sup-borde) bg-(--sup) px-5 py-2.5 text-sm font-semibold text-(--sup-texto) transition-all hover:text-cian active:scale-95 disabled:opacity-40'
          : 'flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:border-emerald-400 hover:text-emerald-600 active:scale-95 disabled:opacity-40'}>
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        {esCurso ? 'Ejercicio anterior' : 'Texto anterior'}
      </button>

      <button
        onClick={repetir}
        className={esOscuro
          ? 'flex items-center gap-2 rounded-full border border-(--sup-borde) bg-(--sup) px-5 py-2.5 text-sm font-semibold text-(--sup-texto) transition-all hover:text-cian active:scale-95'
          : 'flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:border-emerald-400 hover:text-emerald-600 active:scale-95'}>
        <span className="material-symbols-outlined text-[18px]">refresh</span>
        {esCurso || esIa ? 'Repetir ejercicio' : 'Repetir noticia'}
      </button>

      <button
        onClick={alSiguiente}
        disabled={!haySiguiente}
        className={esOscuro
          ? 'flex items-center gap-2 rounded-full border border-(--sup-borde) bg-(--sup) px-5 py-2.5 text-sm font-semibold text-(--sup-texto) transition-all hover:text-cian active:scale-95 disabled:opacity-40'
          : 'flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:border-emerald-400 hover:text-emerald-600 active:scale-95 disabled:opacity-40'}>
        {esCurso ? 'Siguiente ejercicio' : 'Siguiente noticia'}
        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
      </button>

      <button
        onClick={generarConIa}
        disabled={!debilidadesGlobales}
        className={esOscuro
          ? 'flex items-center gap-2 rounded-full bg-cian px-5 py-2.5 text-sm font-bold text-ground transition-all hover:brightness-110 active:scale-95 disabled:opacity-40'
          : 'flex items-center gap-2 rounded-full bg-slate-800 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-slate-700 active:scale-95 disabled:opacity-40'}>
        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          auto_awesome
        </span>
        {debilidadesGlobales ? 'Generar con IA' : 'Cargando…'}
      </button>
    </div>
  );

  /* Un juego: las dos acciones que de verdad se quieren ahí, con los mismos atajos que en
     el resto de la app (espacio rehace, Enter avanza). "Volver al menú" baja a un enlace
     discreto en vez de desaparecer: sin él, un nodo de juego sin siguiente —el último del
     nivel— dejaría la pantalla sin salida al sendero. */
  const accionesJuego = (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={repetir}
          className={esOscuro
            ? 'flex items-center gap-2 rounded-full border border-(--sup-borde) bg-(--sup) px-6 py-2.5 text-sm font-bold text-(--sup-texto) transition-all hover:text-cian active:scale-95'
            : 'flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-slate-600 transition-all hover:border-emerald-400 hover:text-emerald-600 active:scale-95'}>
          <span className="rounded border border-current px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Espacio</span>
          <span className="material-symbols-outlined text-[18px]">replay</span>
          Jugar de nuevo
        </button>

        <button
          onClick={irASiguienteOMenu}
          disabled={cargandoSiguiente || cargandoNodos}
          className={esOscuro
            ? 'flex items-center gap-2 rounded-full bg-cian px-6 py-2.5 text-sm font-bold text-ground transition-all hover:brightness-110 active:scale-95 disabled:opacity-40'
            : 'flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-emerald-600 active:scale-95 disabled:opacity-40'}>
          <span className="rounded border border-current px-1.5 py-0.5 text-[11px] uppercase tracking-wide">Enter</span>
          {rotuloPrincipal('Avanza al siguiente ejercicio')}
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>

      {(siguienteEnCurso || destinoCompletar) && (
        <button
          onClick={volverAlMenu}
          className={`text-xs font-semibold underline-offset-4 transition-colors hover:underline ${
            esOscuro ? 'text-(--sup-tenue) hover:text-cian' : 'text-slate-400 hover:text-emerald-600'
          }`}>
          Volver al menú
        </button>
      )}
    </div>
  );

  /* Curso-nivel: reemplaza el set de 4 botones — acá se avanza de a un nodo, no se
     navega libre por el catálogo. */
  /* Los tres, 15% más grandes que el resto de la pantalla (pedido del usuario) y con las
     teclas de atajo — Espacio, Enter — ocultas hasta el hover: siempre visibles competían
     por atención con el texto, y acá el texto ("Repetir", "Siguiente ejercicio") es lo que
     hay que leer primero. "Volver al menú" no tiene atajo de teclado propio, así que no
     lleva tecla que mostrar.

     ⚠️ REESCRITO el 11-sep-2026: la tecla vivía COMO HERMANA del ícono+etiqueta dentro del
     mismo `flex`, así que aunque estuviera en `opacity-0` seguía RESERVANDO su ancho —el
     botón entero se veía corrido hacia la derecha, con un hueco invisible a la izquierda
     del texto. Ahora la tecla es un `absolute inset-0` DENTRO del botón (que pasa a
     `relative`): no ocupa espacio propio, se superpone al centro. Al pasar el mouse, la
     tecla sube de opacidad y el contenido (ícono+etiqueta) baja mucho más que antes
     (`opacity-70` → `opacity-20`) para que la tecla se lea encima sin pelearse con el
     texto de abajo. */
  const accionesCursoNivel = (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button
        onClick={volverAlMenu}
        className={esOscuro
          ? 'flex items-center gap-2.5 rounded-full border border-(--sup-borde) bg-(--sup) px-6 py-3 text-base font-semibold text-(--sup-texto) transition-all hover:text-cian active:scale-95'
          : 'flex items-center gap-2.5 rounded-full border border-slate-200 bg-white px-6 py-3 text-base font-semibold text-slate-600 transition-all hover:border-emerald-400 hover:text-emerald-600 active:scale-95'}>
        <span className="material-symbols-outlined text-[21px]">menu</span>
        Volver al menú
      </button>

      {/* Repetir, en el medio. Faltaba, y se notaba justo cuando más falta hacía: al NO
          superar el umbral la pantalla decía "todavía no" y las dos únicas salidas eran
          volver al menú o seguir de largo al ejercicio siguiente. Reintentar exigía
          volver al sendero y buscar el nodo otra vez.

          El atajo es la barra espaciadora, igual que en Noticias e IA — así el gesto es
          el mismo en toda la app: Enter avanza, espacio rehace. */}
      <button
        onClick={repetir}
        className={`group relative flex items-center justify-center gap-2.5 rounded-full border px-6 py-3 text-base font-semibold transition-all active:scale-95 ${
          esOscuro
            ? 'border-(--sup-borde) bg-(--sup) text-(--sup-texto) hover:text-cian'
            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-400 hover:text-emerald-600'
        }`}>
        <span className="pointer-events-none absolute inset-0 flex scale-90 items-center justify-center rounded-full border border-current text-[12px] uppercase tracking-wide opacity-0 transition-all duration-150 group-hover:scale-105 group-hover:opacity-100">
          Espacio
        </span>
        <span className="flex items-center gap-2.5 transition-opacity duration-150 group-hover:opacity-20">
          <span className="material-symbols-outlined text-[21px]">refresh</span>
          Repetir
        </span>
      </button>

      <button
        onClick={irASiguienteOMenu}
        disabled={cargandoSiguiente || cargandoNodos}
        className={`group relative flex items-center justify-center gap-2.5 rounded-full px-7 py-3 text-base font-bold transition-all active:scale-95 disabled:opacity-40 ${
          esOscuro
            ? 'bg-cian text-ground hover:brightness-110'
            : 'bg-emerald-500 text-white hover:bg-emerald-600'
        }`}>
        <span className="pointer-events-none absolute inset-0 flex scale-90 items-center justify-center rounded-full border border-current text-[13px] uppercase tracking-wide opacity-0 transition-all duration-150 group-hover:scale-105 group-hover:opacity-100">
          Enter
        </span>
        <span className="flex items-center gap-2.5 transition-opacity duration-150 group-hover:opacity-20">
          {rotuloPrincipal('Siguiente ejercicio')}
          <span className="material-symbols-outlined text-[21px]">arrow_forward</span>
        </span>
      </button>
    </div>
  );

  /* ======================= APARIENCIA OSCURA ======================= */
  if (esOscuro) {
    const t = tiempoConCentesimas(resultado);
    /* En un juego se cae velocidad y precisión y queda el conteo de letras. No es por
       ahorrar espacio: el WPM de la Lluvia mide cuánto tardó la letra en caer, no cuán
       rápido escribes, y ponerlo con el mismo formato que en un dictado invita a leerlo
       como una nota comparable — que es justo lo que no es. */
    const stats = esJuego
      ? [{ label: 'Letras', valor: String(resultado.caracteres ?? '—'), unidad: 'CHAR', stroke: '#96F8FF' }]
      : [
        { label: 'Velocidad', valor: String(resultado.wpm),                  unidad: 'WPM',  stroke: '#00F1FD' },
        { label: 'Precisión', valor: resultado.precision.toFixed(1),         unidad: '%',    stroke: '#BF81FF' },
        { label: 'Letras',    valor: String(resultado.caracteres ?? '—'),    unidad: 'CHAR', stroke: '#96F8FF' },
      ];

    return (
      <div data-apariencia="oscuro" className="flex flex-col gap-8">
        {ventanaConfirmar}

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 text-center">
            {/* En el Curso el titular lo pone la recompensa, que dice algo verdadero sobre
                este intento. "Mantuviste un estado de flujo excepcional" es una frase fija
                que se muestra igual después de un intento perfecto y de uno fallado. */}
            <h1 className="text-4xl font-bold text-white">
              {recompensa ? ejercicioTitulo || 'Ejercicio terminado' : '¡Sesión Completada!'}
            </h1>
            {!recompensa && (
              <p className="mt-2 text-lg text-gris-texto">Mantuviste un estado de flujo excepcional</p>
            )}
            {!recompensa && resultado.dificultad && (
              <span
                className="mt-4 inline-block rounded-lg px-5 py-1.5 text-sm font-bold tracking-wide text-gris-texto"
                style={{ background: FONDO_DIFICULTAD[resultado.dificultad] ?? 'rgba(255,255,255,0.1)' }}>
                {resultado.dificultad}
              </span>
            )}
          </div>
          <SelectorApariencia />
        </div>

        {/* La recompensa va ARRIBA de las cifras y no debajo: es la respuesta a "¿pasé?",
            que es lo primero que el usuario quiere saber al terminar un nodo del Curso.
            Las cuatro métricas siguen estando, un escalón más abajo. */}
        {recompensa && (
          <RecompensaCurso resultado={recompensa} esOscuro
            nodos={nodosNivel} ejercicioId={ejercicioId} destacadoId={destacadoId}
            onElegirNodo={elegirNodo} />
        )}

        {tandas.length > 1 && <DesgloseTandas tandas={tandas} esOscuro />}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}
              className="rounded-xl border border-(--sup-borde) bg-(--sup) px-4 py-3"
              style={{ borderLeft: `3px solid ${s.stroke}` }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--sup-tenue)">{s.label}</p>
              <p className="mt-1 text-white">
                <span className="text-3xl font-bold tabular-nums">{s.valor}</span>
                <span className="ml-1 text-xs text-(--sup-tenue)">{s.unidad}</span>
              </p>
            </div>
          ))}
          <div className="rounded-xl border border-(--sup-borde) bg-(--sup) px-4 py-3"
            style={{ borderLeft: '3px solid #FFFFFF' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--sup-tenue)">Tiempo</p>
            <p className="mt-1 font-bold text-white">
              <span className="text-3xl tabular-nums">{t.principal}</span>
              <span className="ml-0.5 align-top text-base tabular-nums">.{t.centesimas}</span>
            </p>
          </div>
        </div>


        {/* En un juego no hay curva de velocidad que mirar: el WPM sube y baja con el ritmo de la lluvia, no con el del jugador. */}
        {!esJuego && (
        <div className="rounded-2xl border border-(--sup-borde) bg-(--sup) p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-bold text-white">Progreso de Velocidad</h3>
            {hayRival && (
              <div className="flex items-center gap-4 text-[11px] font-semibold">
                <span className="flex items-center gap-1.5 text-cian">
                  <span className="h-0.5 w-5 rounded bg-cian" />
                  Tú · {resultado.wpm} WPM
                </span>
                <span className="flex items-center gap-1.5 text-muted">
                  <span className="h-0.5 w-5 rounded" style={{
                    background: 'repeating-linear-gradient(to right, #7C97AC 0 4px, transparent 4px 8px)',
                  }} />
                  Rival · {resultado.rivalWpm} WPM
                </span>
              </div>
            )}
          </div>

          {datosGraficoTandas.length > 0 ? (
            /* Una línea por tanda, sin relleno de área: con 3-4 líneas superpuestas un
               relleno solo taparía las de abajo. Sirve además para comparar de un vistazo
               si el ritmo subió o bajó de una oración a la siguiente, que el desglose de
               arriba ya dice en números pero no se ve tan directo. */
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={datosGraficoTandas} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="segundo" tick={{ fontSize: 11, fill: '#B0B3B5' }}
                  tickFormatter={(v) => `${v}s`} axisLine={{ stroke: 'rgba(255,255,255,0.15)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#B0B3B5' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                    background: '#0A141C', fontSize: '12px', color: '#FFFFFF',
                  }}
                  labelStyle={{ color: '#B0B3B5' }}
                  formatter={(value, name) => [`${value} WPM`, `Frase ${Number(String(name).replace('tanda', '')) + 1}`]} />
                {tandasDelGrafico.map((t, i) => (
                  <Line key={t} type="monotone" dataKey={`tanda${t}`} name={`tanda${t}`}
                    stroke={COLORES_TANDA[i % COLORES_TANDA.length]} strokeWidth={3}
                    dot={{ fill: COLORES_TANDA[i % COLORES_TANDA.length], r: 3 }}
                    activeDot={{ r: 6 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : datosGrafico.length > 0 ? (
            <div className="relative">
              {/* Marca de agua decorativa.

                  Estaba en cian por debajo del gráfico y el relleno del área —cian al 20%
                  que va bajando— la teñía solo en la parte que queda bajo la curva. El
                  resultado era un corte de color horizontal a media altura que parecía un
                  icono recortado, y se notaba más cuanto más bajo era el WPM.

                  Ahora es gris neutro, así que el relleno cian ya no le cambia el tono, y
                  va en una capa propia (z-0) por debajo del SVG del gráfico (z-10): sigue
                  quedando detrás de la línea y de los puntos, pero se ve entera. */}
              <span
                aria-hidden="true"
                className="material-symbols-outlined pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 text-white/10"
                style={{ fontSize: '96px' }}>
                instant_mix
              </span>

              <div className="relative z-10">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={datosGrafico} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  {/* El relleno cae de 20% pegado a la línea hasta 0% en la base,
                      igual que los stops del Figma. Area rellena SOLO bajo la curva. */}
                  <defs>
                    <linearGradient id="rellenoWpm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#00F1FD" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#00F1FD" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="segundo" tick={{ fontSize: 11, fill: '#B0B3B5' }}
                    tickFormatter={(v) => `${v}s`} axisLine={{ stroke: 'rgba(255,255,255,0.15)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#B0B3B5' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                      background: '#0A141C', fontSize: '12px', color: '#FFFFFF',
                    }}
                    labelStyle={{ color: '#B0B3B5' }}
                    formatter={(value) => [`${value} WPM`, 'Velocidad']} />
                  {/* El rival va ANTES que tu área: recharts pinta en orden, así que queda
                      por detrás de tu línea y de tus puntos cian. Gris y sin puntos para
                      que se lea como referencia y no compita con tu recorrido.
                      `connectNulls` deja la línea continua si a esa sesión le faltara
                      algún segundo suelto. */}
                  {hayRival && (
                    <Line type="monotone" dataKey="rival" stroke="#7C97AC" strokeWidth={2}
                      strokeDasharray="4 4" dot={false} activeDot={false} connectNulls />
                  )}
                  <Area type="monotone" dataKey="wpm" stroke="#00F1FD" strokeWidth={3}
                    fill="url(#rellenoWpm)"
                    dot={{ fill: '#00F1FD', stroke: '#00F1FD', r: 4 }}
                    activeDot={{ r: 6, fill: '#00F1FD' }} />
                </AreaChart>
              </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-gris-texto">
              <p>El gráfico aparece cuando la sesión dura más de 1 segundo.</p>
            </div>
          )}
        </div>
        )}

        {/* RESISTENCIA: primer 15% del texto vs. el resto. */}
        {resultado.analisisResistencia && (
          <div className="rounded-2xl border border-(--sup-borde) bg-(--sup) p-6">
            <h3 className="mb-1 text-xl font-bold text-white">Resistencia</h3>
            <p className="mb-6 text-sm text-gris-texto">
              {resultado.analisisResistencia.cayoRendimiento
                ? 'Tu rendimiento cayó después del primer tramo del texto.'
                : 'Mantuviste el ritmo parejo durante todo el texto.'}
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                { label: 'Primer 15% del texto', wpm: resultado.analisisResistencia.wpmInicial, precision: resultado.analisisResistencia.precisionInicial },
                { label: 'Resto del texto', wpm: resultado.analisisResistencia.wpmResto, precision: resultado.analisisResistencia.precisionResto },
              ].map(({ label, wpm, precision }) => (
                <div key={label} className="rounded-xl border border-white/8 bg-carta/40 p-4 text-center">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gris-texto">{label}</p>
                  <p className="text-3xl font-bold text-cian">{wpm} <span className="text-base font-semibold">WPM</span></p>
                  <p className="mt-1 text-sm text-gris-texto">{precision}% precisión</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lo que más fallaste EN ESTA SESIÓN. Este dato ya se calculaba y se
            guardaba, pero la pantalla nunca lo mostraba. */}
        {((resultado.peoresTeclas?.length ?? 0) > 0 || (resultado.peoresBigramas?.length ?? 0) > 0) && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <PanelFallos titulo="Teclas que más fallaste" items={resultado.peoresTeclas} />
            <PanelFallos titulo="Bigramas que más fallaste" items={resultado.peoresBigramas} />
          </div>
        )}

        <div className="flex flex-col items-center gap-4 pb-8">
          <p className="text-center text-sm text-gris-texto">
            Genera un ejercicio con IA basado en el reporte de tus letras más falladas
          </p>
          {esJuego ? accionesJuego : esCursoNivel ? accionesCursoNivel : acciones}
        </div>
      </div>
    );
  }

  /* ======================= APARIENCIA CLARA =======================
     El diseño original, sin tocar. Lo único que cambia son los botones del pie
     (ahora son cuatro y funcionan) y el acceso a la paleta. */
  return (
    <div className="flex flex-col gap-6">
      {ventanaConfirmar}

      <div className="relative py-8 text-center">
        {/* El check verde afirma "completado" antes de saber si se aprobó. En el Curso lo
            reemplaza la recompensa, que sí sabe. */}
        {!recompensa && (
          <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
            <span className="material-symbols-outlined text-5xl text-emerald-500"
              style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
          </div>
        )}
        {/* El título del ejercicio va en blanco y "¡Sesión Completada!" se queda como
            estaba. No es una inconsistencia: el h1 de esta apariencia es slate-800 sobre
            el degradado OSCURO del body (el fondo no cambia con la apariencia, solo las
            superficies), así que ya venía costando leerse. Se toca únicamente el caso
            nuevo, que es el que ahora lleva información —qué ejercicio hiciste— en vez de
            una frase fija. El resto del diseño claro queda intacto, como manda CLAUDE.md 4. */}
        <h1 className={`mb-2 text-4xl font-bold ${recompensa ? 'text-white' : 'text-slate-800'}`}>
          {recompensa ? ejercicioTitulo || 'Ejercicio terminado' : '¡Sesión Completada!'}
        </h1>
        {!recompensa && (
          <p className="text-lg text-slate-400">Has mantenido un estado de flujo excepcional.</p>
        )}
        {!recompensa && resultado.dificultad && (
          <span className={`mt-3 inline-block rounded-full px-4 py-1 text-xs font-bold ${badgeDificultadClaro(resultado.dificultad)}`}>
            {resultado.dificultad}
          </span>
        )}
        <div className="absolute right-0 top-8 hidden lg:block">
          <SelectorApariencia />
        </div>
      </div>

      {recompensa && (
        <div className="mx-auto w-full max-w-3xl">
          <RecompensaCurso resultado={recompensa} esOscuro={false}
            nodos={nodosNivel} ejercicioId={ejercicioId} destacadoId={destacadoId}
            onElegirNodo={elegirNodo} />
        </div>
      )}

      {tandas.length > 1 && (
        <div className="mx-auto w-full max-w-3xl">
          <DesgloseTandas tandas={tandas} esOscuro={false} />
        </div>
      )}

      {/* La apariencia clara arma sus tarjetas a mano y no desde el array `stats` de la
          oscura, así que el filtro del juego hay que hacerlo también acá. Se descubrió
          probando: la oscura ya escondía velocidad y precisión mientras la clara —que es
          la apariencia POR DEFECTO— las seguía mostrando enteras. */}
      <div className={`grid grid-cols-1 gap-6 ${esJuego ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
        {esJuego ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"
          style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
            <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Letras</span>
            <span className="text-6xl font-bold text-emerald-500">{resultado.caracteres ?? '—'}</span>
            <div className="mt-2 flex items-center justify-center gap-1 text-emerald-500">
              <span className="material-symbols-outlined text-sm">keyboard</span>
              <span className="text-xs font-bold">Atrapadas</span>
            </div>
          </div>
        ) : (
          <>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"
          style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">WPM Final</span>
              <span className="text-6xl font-bold text-emerald-500">{resultado.wpm}</span>
              <div className="mt-2 flex items-center justify-center gap-1 text-emerald-500">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                <span className="text-xs font-bold">Palabras por minuto</span>
              </div>
            </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"
          style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Precisión</span>
              <span className="text-6xl font-bold text-sky-500">{resultado.precision}<span className="text-3xl">%</span></span>
              <div className="mt-2 flex items-center justify-center gap-1 text-sky-500">
                <span className="material-symbols-outlined text-sm">verified</span>
                <span className="text-xs font-bold">Teclas correctas</span>
              </div>
            </div>
          </>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"
          style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
          <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Duración</span>
          <span className="text-6xl font-bold text-slate-800">{formatTiempo(resultado.segundos)}</span>
          <div className="mt-2 flex items-center justify-center gap-1 text-slate-400">
            <span className="material-symbols-outlined text-sm">timer</span>
            <span className="text-xs font-bold">Tiempo total</span>
          </div>
        </div>
      </div>

      {resultado.desgloseSuddenDeath && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6"
          style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
          <h3 className="mb-1 text-xl font-bold text-slate-800">Muerte súbita: 3 promedios</h3>
          <p className="mb-6 text-sm text-slate-400">El general cuenta los reinicios fallidos; los de fase solo el intento que acertaste.</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { label: 'General (con fallos)', datos: resultado.desgloseSuddenDeath.general, color: 'text-slate-800' },
              { label: 'Fase 1 (oración fija)', datos: resultado.desgloseSuddenDeath.fase1, color: 'text-sky-600' },
              { label: 'Fase 2 (al azar)', datos: resultado.desgloseSuddenDeath.fase2, color: 'text-amber-600' },
            ].map(({ label, datos, color }) => (
              <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                {datos ? (
                  <>
                    <p className={`text-3xl font-bold ${color}`}>{datos.wpm} <span className="text-base font-semibold">WPM</span></p>
                    <p className="mt-1 text-sm text-slate-400">{datos.precision}% precisión</p>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-300">No disponible</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* En un juego no hay curva de velocidad que mirar: el WPM sube y baja con el ritmo de la lluvia, no con el del jugador. */}
      {!esJuego && (
      <div className="rounded-2xl border border-slate-200 bg-white p-6"
        style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-800">Progreso de Velocidad</h3>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-slate-400">WPM por segundo</span>
          </div>
        </div>
        {datosGraficoTandas.length > 0 ? (
          // Una línea por tanda — ver la nota gemela en la apariencia oscura.
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={datosGraficoTandas}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="segundo" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${v}s`} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                formatter={(value, name) => [`${value} WPM`, `Frase ${Number(String(name).replace('tanda', '')) + 1}`]} />
              {tandasDelGrafico.map((t, i) => (
                <Line key={t} type="monotone" dataKey={`tanda${t}`} name={`tanda${t}`}
                  stroke={COLORES_TANDA[i % COLORES_TANDA.length]} strokeWidth={3}
                  dot={{ fill: COLORES_TANDA[i % COLORES_TANDA.length], r: 3 }}
                  activeDot={{ r: 6 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : datosGrafico.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={datosGrafico}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="segundo" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${v}s`} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                formatter={(value) => [`${value} WPM`, 'Velocidad']} />
              <Line type="monotone" dataKey="wpm" stroke="#10b981" strokeWidth={3}
                dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-40 items-center justify-center text-slate-300">
            <p>El gráfico aparece cuando la sesión dura más de 1 segundo.</p>
          </div>
        )}
      </div>
      )}

      <div className="flex flex-col items-center gap-4 pb-8">
        {/* La apariencia CLARA se había quedado con el juego de 4 botones para todos los
            casos: en la secuencia de un nivel mostraba "Ejercicio anterior / Siguiente
            ejercicio", que navegan el catálogo PLANO y sacan al usuario del sendero. La
            oscura ya distinguía el caso; esta no. Y el Enter global sí estaba registrado,
            así que la tecla avanzaba al nodo siguiente sin que ningún botón lo dijera. */}
        {!esCursoNivel && (
          <p className="text-center text-sm text-slate-400">
            Genera un ejercicio con IA basado en el reporte de tus letras más falladas
          </p>
        )}
        {esJuego ? accionesJuego : esCursoNivel ? accionesCursoNivel : acciones}
      </div>
    </div>
  );
};

/* Panel de "lo que más fallaste" en la apariencia oscura. */
const PanelFallos = ({
  titulo, items,
}: { titulo: string; items?: { secuencia: string; porcentajeError: number }[] }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-(--sup-borde) bg-(--sup) p-6">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.12em] text-cian">{titulo}</h3>
      <div className="flex flex-col gap-3">
        {items.map((i) => (
          <div key={i.secuencia} className="flex items-center justify-between gap-4">
            <span className="rounded-md bg-cian-suave/10 px-2.5 py-1 font-mono text-sm font-bold text-cian-suave">
              {i.secuencia === ' ' ? '␣' : i.secuencia}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-dificil" style={{ width: `${i.porcentajeError}%` }} />
            </div>
            <span className="w-12 text-right text-xs font-bold tabular-nums text-gris-texto">
              {i.porcentajeError}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResultadosView;
