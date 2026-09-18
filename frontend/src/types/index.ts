// --- RESPUESTAS GLOBALES ---
export interface GenericResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// --- AUTENTICACIÓN ---
export interface UsuarioResponse {
  autenticado: boolean;
  id: number | null;
  email: string | null;
  nombre: string | null;
  avatarUrl: string | null;
}

// --- NOTICIAS ---
export interface NoticiaDTO {
  id: number;
  titulo: string;
  contenidoCompleto: string;
  contenidoResumido: string;
  categoria: string;
  fuente: string;
  dificultad: 'FACIL' | 'MEDIO' | 'MEDIO_DIFICIL' | 'DIFICIL';
  fechaPublicacion: string;
  // Portada del artículo. Puede faltar: GNews no siempre la trae, y las noticias
  // guardadas antes de que el backend leyera ese campo tampoco la tienen.
  imagenUrl?: string | null;
}

// --- IA ---
export interface TextoIaRequest {
  dificultad: 'FACIL' | 'MEDIO' | 'DIFICIL';
  ngramsDebiles?: string[];
  teclasDebiles?: string[];
}

export interface TextoIaResponse {
  id: number;
  contenidoLimpio: string;
  dificultad: string;
  teclasBase: string;
}

// --- SESIONES ---
export interface SesionProgresoDTO {
  segundo: number;
  wpmMomento: number;
  precisionMomento: number;
}

export interface TeclaStatsRequest {
  tecla: string;
  vecesPresionada: number;
  vecesCorrecta: number;
  vecesError: number;
  tiempoTotalMs: number;
}

export interface NgramStatsRequest {
  secuencia: string;
  tipo: 'BIGRAMA' | 'TRIGRAMA';
  totalIntentos: number;
  errores: number;
  tiempoTotalMs: number;
}

export interface SesionRequest {
  usuarioId?: number;
  noticiaId?: number;
  textoIaId?: number;
  wpm: number;
  precision: number;
  segundos: number;
  modoUsado: 'NOTICIAS' | 'IA' | 'LIBRE';
  dificultad: 'FACIL' | 'MEDIO' | 'MEDIO_DIFICIL' | 'DIFICIL';
  progreso: SesionProgresoDTO[];
  teclas: TeclaStatsRequest[];
  ngrams: NgramStatsRequest[];
  // Opcional porque no toda vista lleva el registro tecla a tecla; sin esto la sesión se
  // guarda igual, solo queda fuera del análisis de ritmo.
  eventos?: TeclaEventoRequest[];
}

export interface SesionResponse {
  id: number;
  mensaje: string;
  /* Solo lo llena el Curso por niveles; fuera de él el campo no viaja (non_null).
     Definido más abajo, junto al resto de los tipos del Curso — TypeScript no exige
     declararlo antes de usarlo en una interfaz. */
  resultadoCurso?: ResultadoCursoResponse;
}

// --- ESTADÍSTICAS ---
export interface StatsResponse {
  // Promedios sobre Noticias, IA y el Curso por niveles, sin sus juegos ni las sesiones de
  // menos de 10 s (el filtro vive en CondicionesSesion, en el backend). Ejercicios Base
  // queda fuera: ahí están los drills de un segundo que llegaron a dar 1740 WPM.
  wpmPromedio: number;
  precisionPromedio: number;
  sesionesMedidas: number;
  // El volumen sí cuenta todo lo practicado.
  sesionesCompletadas: number;
  tiempoTotalSegundos: number;
  caracteresEscritos: number;
  caracteresFallados: number;
}

/* 'hoy' es la única que NO promedia: devuelve una sesión por punto con su hora, para ver
   cómo fue cada práctica del día en vez de aplastarlas todas en una media. */
export type AgrupacionProgreso = 'hoy' | 'dia' | 'semana' | 'mes';

export interface PuntoProgreso {
  periodo: string;
  wpm: number;
  precision: number;
  sesiones: number;
}

export interface ProgresoTemporalResponse {
  agrupacion: AgrupacionProgreso;
  puntos: PuntoProgreso[];
}

export interface RecordsResponse {
  mejorWpm: number;
  fechaMejorWpm: string | null;
  // La sesión que marcó el récord, para poder ofrecer correr contra ella.
  mejorWpmSesionId: number | null;
  /* Solo si el récord salió del Curso (hoy, nivel Avanzado): su rival se corre en la ruta
     del ejercicio, no en /practica. Null en Noticias e IA. */
  mejorWpmEjercicioId: number | null;
  mejorWpmNivel: string | null;
  mejorPrecision: number;
  sesionMasLarga: number;
  rachaActual: number;
  rachaMaxima: number;
  diasActivos: number;
}

/* Una sesión pasada convertida en rival. Solo existe para Noticias y textos de IA: en
   Curso el modo sombra va por ejercicio, y en el Área de Entrenamiento el contenido cambia
   en cada vuelta.

   El fantasma corre a RITMO CONSTANTE derivado de `wpm`; no reproduce las pausas del
   intento original. La reproducción exacta necesitaría los eventos tecla a tecla, que solo
   existen en las sesiones guardadas desde el 8 de agosto de 2026 — con el ritmo constante
   funciona todo el historial. */
export interface RivalSesionResponse {
  sesionId: number;
  wpm: number;
  segundos: number;
  texto: string;
  modo: 'NOTICIAS' | 'IA';
  fecha: string;
  noticiaId: number | null;
  textoIaId: number | null;
  /* El recorrido segundo a segundo del rival, para dibujarlo detrás del tuyo al terminar.
     Es lo que convierte "perdiste por 4 WPM" en "lo tenías hasta el segundo 12". */
  progreso: SesionProgresoDTO[];
}

export interface TeclaLenta {
  tecla: string;
  msPromedio: number;
  pulsaciones: number;
}

export interface TeclasLentasResponse {
  // Distingue "escribes parejo" de "todavía no hay eventos guardados".
  datosSuficientes: boolean;
  teclas: TeclaLenta[];
}

export interface ItemDebilidad {
  secuencia: string;
  porcentajeError: number;
  totalIntentos: number;
}
export interface DebilidadesResponse {
  peoresBigramas: ItemDebilidad[];
  peoresTrigramas: ItemDebilidad[];
  peoresTeclas: ItemDebilidad[];
}
export interface NgramConProgreso {
  secuencia: string;
  tipo: string;
  porcentajeErrorActual: number;
  porcentajeErrorAnterior: number;
  puntosMejorados: number;
  totalIntentos: number;
}

export interface ProgresoNgramResponse {
  mejorandoEnTop5: NgramConProgreso[];
  graduados: NgramConProgreso[];
}

// --- CURSO / EJERCICIOS ---
/* Sin MODO_SOMBRA: la sombra no es un tipo de ejercicio sino un modificador que se
   aplica a cualquiera (correr contra el registro de una sesión tuya). Como tipo nunca
   funcionó — no tenía fila en el catálogo ni generación en el backend. */
export type TipoEjercicio =
  | 'LETRAS_BASICO' | 'PALABRAS_SIMPLES' | 'TOP_100_PALABRAS' | 'ORACIONES_SIMPLES'
  | 'ORACIONES_MAYUSCULAS' | 'SUDDEN_DEATH' | 'PALABRAS_CONFUSAS' | 'MODO_CIEGO'
  | 'DICTADO_VOZ' | 'SIMBOLOS_CRITICOS' | 'CONTRARRELOJ' | 'PALABRAS_MUTANTES'
  | 'MODO_UNA_MANO'
  // "Palabras flotantes" del Curso.
  | 'DESESTRUCTURA'
  // Los tipos nuevos del futuro Curso por niveles (sembrados sin nivel todavía, en
  // "Ejercicios Base", para probarse sueltos).
  | 'UN_DEDO' | 'UNA_MANO_FORZADA' | 'SHIFT_LATERAL' | 'RESISTENCIA' | 'LLUVIA_LETRAS'
  | 'PALABRAS_DE_FILA' | 'ORACIONES_TEMATICAS' | 'REPASO_FALLADAS';

export interface EjercicioDTO {
  id: number;
  titulo: string;
  descripcion: string;
  tipo: TipoEjercicio;
}

export interface TeclaEventoDTO {
  ordenSecuencia: number;
  tiempoDesdeInicioMs: number;
  indiceResultante: number;
  correcta: boolean;
}

export interface EjercicioContenidoResponse {
  id: number;
  titulo: string;
  tipo: TipoEjercicio;
  texto: string;
  configuracion: Record<string, unknown>;
  fantasmaEventos: TeclaEventoDTO[] | null;
  fantasmaWpm: number | null;
  /* Solo en los ejercicios de letras del Curso: el nodo se practica en varias tandas
     cortas encadenadas en vez de una sola pasada larga. Ausentes en todo lo demás — y
     ausentes, no null, porque el backend omite los campos nulos. */
  latidos?: LatidoResponse[];
  /* Los ítems del tutorial: TECLAS en Fundamentos, PALABRAS enteras en el primer nodo de
     palabras. El componente los trata igual (ver TutorialTeclas). */
  teclasTutorial?: string[];
  // El rótulo del tutorial. Ausente = el genérico de las teclas.
  mensajeTutorial?: string;
  /* Una leyenda por ítem de teclasTutorial (mismo orden, mismo largo). Ausente en casi
     todo el catálogo — hoy solo la trae "Fila de números", para decir qué dedo va en
     cada dígito. */
  captionsTutorial?: string[];
}

/* Una tanda corta dentro de un ejercicio de letras. El nombre y la descripción se muestran
   como rótulo de la fase; `dominancia` es solo informativo. */
export interface LatidoResponse {
  nombre: string;
  descripcion: string;
  texto: string;
  dominancia: number;
  /* El quinto latido: el último intento tras fallar los cuatro. Se juzga solo por
     precisión, sin exigencia de velocidad. */
  ultimoIntento: boolean;
}

export interface TeclaEventoRequest {
  tecla: string;
  ordenSecuencia: number;
  tiempoDesdeInicioMs: number;
  indiceResultante: number;
  correcta: boolean;
}

export interface SesionCursoRequest {
  wpm: number;
  precision: number;
  segundos: number;
  dificultad: 'FACIL' | 'MEDIO' | 'DIFICIL';
  texto: string;
  progreso: SesionProgresoDTO[];
  teclas: TeclaStatsRequest[];
  ngrams: NgramStatsRequest[];
  eventos: TeclaEventoRequest[];
  /* Verdadero cuando el nodo se aprobó en el quinto latido. Cambia cómo lo juzga el
     servidor: solo precisión, y una sola estrella. */
  porUltimoIntento?: boolean;
}

// --- CURSO POR NIVELES ---
export type NivelCurso = 'BASICO' | 'INTERMEDIO' | 'AVANZADO';

export interface CursoStatsResponse {
  nivel: NivelCurso;
  wpmPromedio: number;
  precisionPromedio: number;
  sesionesCompletadas: number;
  desbloqueado: boolean;
  aprobado: boolean;
  teclasMasFalladas: ItemDebilidad[];
  nodosPorMejorar: number;
}

// Un nodo del sendero. El "actual" no viaja del backend: es el primer no-completado
// de la lista, en el orden en que ya viene ordenada.
export interface ProgresoEjercicioResponse {
  ejercicioId: number;
  titulo: string;
  // Nullable: las filas sembradas antes de que existiera la columna pueden no tenerla.
  descripcion: string | null;
  bloque: number | null;
  orden: number;
  completado: boolean;
  /* ⚠️ Los cinco de abajo van OPCIONALES, no `| null`, y es a propósito: el backend corre
     con `default-property-inclusion: non_null`, así que un valor nulo no llega como null
     sino que no llega. Declararlos `| null` haría que TypeScript aceptara un `!== null`
     que en ejecución nunca es falso. */
  // El sendero pinta un icono por mecánica y marca distinto los dos nodos de control.
  tipo?: TipoEjercicio;
  rolEnNivel?: RolEjercicioNivel;
  // Estrellas ya conseguidas. Ausente en un nodo sin completar, y también en los
  // completados antes de que la columna existiera (2-sep-2026).
  estrellas?: number;
  mejorWpm?: number;
  mejorPrecision?: number;
  /* Completado pero sin las 2 estrellas que pide el Test Final (la Lluvia nunca lo está: es
     un juego de relajo). Lo decide el backend con la misma regla que bloquea el examen, así
     que el front no reescribe el umbral: si la escala cambia, esto sigue diciendo la verdad. */
  porMejorar?: boolean;
}

export type RolEjercicioNivel = 'TEST_NIVEL' | 'TEST_FINAL';

/* El veredicto del Curso al terminar un ejercicio. Lo calcula ENTERO el servidor: acá
   solo se pinta. Llega dentro de SesionResponse y viene null fuera del Curso por
   niveles (Ejercicios Base, Noticias, IA). */
export interface ResultadoCursoResponse {
  nivel: NivelCurso;
  // Opcional por lo mismo que arriba: un ejercicio sin rol no manda el campo.
  rolEnNivel?: RolEjercicioNivel;
  superado: boolean;
  estrellas: number;
  estrellasPrevias: number;
  umbralWpm: number;
  umbralPrecision: number;
  wpm: number;
  precision: number;
  primeraVez: boolean;
  esRecordWpm: boolean;
  nivelAprobado: boolean;
  nivelDesbloqueado?: NivelCurso;
  nodosCompletados: number;
  nodosTotales: number;
  /* Nodos completados que se quedaron en una estrella. El Test Final no aprueba el nivel
     mientras quede alguno. */
  nodosPorMejorar: number;
  /* Este nodo es un juego (hoy solo Lluvia de letras). Opcional y no `| null`: el backend
     corre con `default-property-inclusion: non_null`. */
  esJuego?: boolean;
  /* La racha más larga de aciertos seguidos en la partida. A diferencia del resto de este
     tipo, el BACKEND NO LA MANDA: CursoPracticaView la agrega acá antes de guardar en
     sessionStorage, porque es un dato decorativo (no puntúa) y solo existe en Lluvia. */
  mejorRachaLluvia?: number;
}

// Modo sombra: selector de intentos pasados
export interface IntentoResumen {
  sesionId: number;
  wpm: number;
  precision: number;
  segundos: number;
  fecha: string;
}

export interface HistorialEjercicioResponse {
  mejores: IntentoResumen[];
  peores: IntentoResumen[];
}

// --- REVISIÓN MANUAL DEL DICCIONARIO (pantalla de admin, sin enlace en la navegación) ---
export interface PalabraRevisionDTO {
  id: number;
  palabra: string;
  estado: 'PENDIENTE' | 'PREACTIVA' | 'NO_PERMITIDA';
  rangoFrecuencia: number;
  // Pista del filtro, no una decisión: "posible extranjerismo", "lleva k o w".
  sospecha: string | null;
}

/* El buscador de la revisión devuelve dos listas porque tiene dos modos. Con un término
   busca por prefijo; con dos o más, coincidencia exacta de cada uno — y ahí `noEncontradas`
   dice qué términos no existen en la tabla, que es lo que permite crearlos como rechazados
   sin volver a escribirlos. */
export interface BusquedaPalabras {
  resultados: PalabraRevisionDTO[];
  noEncontradas: string[];
  exacta: boolean;
}

export interface ResumenRevision {
  pendientes: number;
  preactivas: number;
  noPermitidas: number;
  enDiccionario: number;
  detalle: string | null;
}
