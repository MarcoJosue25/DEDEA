import type { NivelCurso, ProgresoEjercicioResponse } from '../../types';

export const NOMBRE_NIVEL: Record<NivelCurso, string> = {
  BASICO: 'Básico',
  INTERMEDIO: 'Intermedio',
  AVANZADO: 'Avanzado',
};

const ORDEN_NIVELES: NivelCurso[] = ['BASICO', 'INTERMEDIO', 'AVANZADO'];

// El nivel que se abre al aprobar este; null después del último.
export const nivelSiguiente = (nivel: NivelCurso): NivelCurso | null => {
  const i = ORDEN_NIVELES.indexOf(nivel);
  return i >= 0 ? ORDEN_NIVELES[i + 1] ?? null : null;
};

/* NIVELES EN CONSTRUCCIÓN: cerrados aunque el anterior esté aprobado. Avanzado entra acá el
   18-sep-2026 (todavía no está terminado: entre otras cosas trae `N.º`, que no se teclea en
   un teclado latinoamericano). Intermedio se suma el 20-sep-2026, al publicar V1 por etapas:
   decisión del usuario de que solo Básico quede abierto al público (reclutadores incluidos)
   mientras el resto se sigue puliendo, aunque su contenido ya esté sembrado y su Test Final
   funcione. El backend desbloquea los dos igual, al aprobar el nivel anterior; lo que los
   cierra es esta lista, y sacar uno de acá es lo que lo abre. `DESBLOQUEAR_TODO_EL_CURSO` los
   sigue abriendo en desarrollo, para poder trabajar en ellos. */
const EN_CONSTRUCCION: ReadonlySet<NivelCurso> = new Set<NivelCurso>(['INTERMEDIO', 'AVANZADO']);

export const enConstruccion = (nivel: NivelCurso): boolean => EN_CONSTRUCCION.has(nivel);

/* Lo que dice un nivel bloqueado, igual en el selector y en la pantalla de su sendero.
   Un texto por nivel porque "aprueba el nivel anterior" obliga a adivinar cuál es.

   ⚠️ Los dos mensajes se eligieron sabiendo que, mientras el nivel siga en esta lista,
   aprobar el anterior todavía no lo abre: pasan a ser literales al sacar el nivel de acá
   (igual que ya se aceptó para Avanzado el 18-sep-2026). Alguien que ya aprobó Básico va a
   seguir viendo "completa Básico" hasta que Intermedio salga de la lista — es el precio de
   no inventar un tercer texto ("todavía no está publicado") para un cierre que se espera
   temporal. */
const MENSAJE_BLOQUEO: Partial<Record<NivelCurso, string>> = {
  INTERMEDIO: 'Completa el nivel Básico para empezar el Intermedio.',
  AVANZADO: 'Se desbloquea al completar el curso de Intermedio.',
};

export const mensajeDeBloqueo = (nivel: NivelCurso): string =>
  MENSAJE_BLOQUEO[nivel] ?? 'Aprueba el nivel anterior para desbloquear este.';

/* ¿YA SE LLEGÓ AL TEST FINAL? Todos los ejercicios del sendero hechos, menos el examen.

   Es el ÚNICO momento en que se habla de las estrellas que faltan (pedido del usuario,
   10-sep-2026). Antes el aviso salía en cuanto un ejercicio se quedaba con una estrella, a
   veinte nodos del examen, y se leía como el bloqueo de algo que todavía no tocaba. Con el
   avance de uno en uno, "llegar" es exactamente esto. Lo usan el aviso del sendero y el de
   Resultados, el candado del Test Final y la ventana que lo explica.

   Sin Test Final en el nivel (Intermedio y Avanzado todavía no lo tienen) no hay adónde
   llegar, y el aviso no sale nunca. */
export const llegoAlTestFinal = (nodos: ProgresoEjercicioResponse[]): boolean =>
  nodos.some((n) => n.rolEnNivel === 'TEST_FINAL')
  && nodos.every((n) => n.rolEnNivel === 'TEST_FINAL' || n.completado);

/* El color de un ejercicio al que le falta su segunda estrella: el dorado de las estrellas.
   Empezó en rojo y el usuario lo cambió —"el rojo resalta mucho"—, con razón: el rojo es el
   color del ERROR en toda la app, y un ejercicio de una estrella está aprobado. En la
   apariencia clara, un ámbar más oscuro: el dorado sobre blanco casi no se ve. */
export const colorPorMejorar = (esOscuro: boolean): string =>
  (esOscuro ? 'var(--color-oro)' : '#D97706');
