import { api } from './client';
import type {
  GenericResponse, EjercicioDTO, EjercicioContenidoResponse, SesionCursoRequest, SesionResponse,
  HistorialEjercicioResponse, IntentoResumen, LatidoResponse,
} from '../types';

export const listarEjercicios = (): Promise<EjercicioDTO[]> => {
  return api.get<GenericResponse<EjercicioDTO[]>>('/ejercicios').then((res) => res.data.data);
};

/* `grupo` solo lo usa "Fundamentos de teclado": elige qué paso de la progresión por
   dedos generar, con el formato "fila:indice" (por ejemplo "central:0" = f/j). */
export const obtenerContenidoEjercicio = (
  id: number,
  grupo?: string,
): Promise<EjercicioContenidoResponse> => {
  return api
    .get<GenericResponse<EjercicioContenidoResponse>>(`/ejercicios/${id}`, {
      params: grupo ? { grupo } : undefined,
    })
    .then((res) => res.data.data);
};

// Modo sombra: mismo endpoint, pero pidiendo que reutilice el texto exacto de una sesión pasada.
export const obtenerContenidoConFantasma = (id: number, sesionId: number): Promise<EjercicioContenidoResponse> => {
  return api.get<GenericResponse<EjercicioContenidoResponse>>(`/ejercicios/${id}`, { params: { fantasma: sesionId } })
    .then((res) => res.data.data);
};

/* Fantasma SIMULADO: mismo mecanismo visual que el de arriba, pero sin sesión real
   detrás — el backend inventa un recorrido a este WPM (con ritmo no lineal, no un
   metrónomo). Pensado para "Ejercicios Base", donde todavía no hay historial propio. */
export const obtenerContenidoConFantasmaSimulado = (
  id: number,
  wpm: number,
  grupo?: string,
): Promise<EjercicioContenidoResponse> => {
  return api
    .get<GenericResponse<EjercicioContenidoResponse>>(`/ejercicios/${id}`, {
      params: { fantasmaWpm: wpm, ...(grupo ? { grupo } : {}) },
    })
    .then((res) => res.data.data);
};

/* Modo sombra sin selector: el backend elige el rival (tu mejor intento válido de este
   ejercicio). Devuelve null cuando todavía no hay ninguno que sirva — no es un error,
   es lo normal las primeras veces que abres un ejercicio. */
export const obtenerRivalSombra = (id: number): Promise<IntentoResumen | null> => {
  return api.get<GenericResponse<IntentoResumen | null>>(`/ejercicios/${id}/rival`)
    .then((res) => res.data.data ?? null);
};

export const obtenerHistorialEjercicio = (id: number): Promise<HistorialEjercicioResponse> => {
  return api.get<GenericResponse<HistorialEjercicioResponse>>(`/ejercicios/${id}/historial`).then((res) => res.data.data);
};

export const guardarSesionEjercicio = (id: number, request: SesionCursoRequest): Promise<SesionResponse> => {
  return api.post<GenericResponse<SesionResponse>>(`/ejercicios/${id}/sesion`, request)
    .then((res) => res.data.data);
};

/* Navegación secuencial dentro de un nivel del Curso. null = no hay siguiente (el
   ejercicio no tiene nivel, o era el último — típicamente el Test Final). */
export const obtenerSiguienteEnCurso = (id: number): Promise<EjercicioDTO | null> => {
  return api.get<GenericResponse<EjercicioDTO | null>>(`/ejercicios/${id}/siguiente-en-curso`)
    .then((res) => res.data.data ?? null);
};

/* El QUINTO latido: el último intento que se ofrece cuando los cuatro anteriores no
   alcanzaron el umbral. Se pide aparte y solo cuando hace falta — la mayoría de los nodos
   no llegan a usarlo, así que incluirlo siempre sería generar contenido que se descarta.
   Devuelve null si el ejercicio no se practica en latidos. */
export const obtenerUltimoIntento = (id: number, grupo?: string): Promise<LatidoResponse | null> => {
  return api.get<GenericResponse<LatidoResponse | null>>(`/ejercicios/${id}/ultimo-intento`, {
    params: grupo ? { grupo } : undefined,
  }).then((res) => res.data.data ?? null);
};
