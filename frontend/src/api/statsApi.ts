import { api } from './client';
import type {
  GenericResponse, StatsResponse, DebilidadesResponse, ProgresoNgramResponse,
  ProgresoTemporalResponse, RecordsResponse, AgrupacionProgreso,
  ItemDebilidad, RivalSesionResponse,
} from '../types';

export const obtenerProgresoNgrams = (): Promise<ProgresoNgramResponse> => {
  return api.get<GenericResponse<ProgresoNgramResponse>>('/stats/progreso-ngrams')
    .then((res) => res.data.data);
};

export const obtenerResumenGlobal = (): Promise<StatsResponse> => {
  return api.get<GenericResponse<StatsResponse>>('/stats/resumen')
    .then((res) => res.data.data);
};

export const obtenerDebilidades = (enfoque: string = 'GRAVES'): Promise<DebilidadesResponse> => {
  return api.get<GenericResponse<DebilidadesResponse>>('/stats/debilidades', {
    params: { enfoque }
  }).then((res) => res.data.data);
};

export const obtenerProgresoTemporal = (
  agrupacion: AgrupacionProgreso = 'dia',
): Promise<ProgresoTemporalResponse> => {
  return api.get<GenericResponse<ProgresoTemporalResponse>>('/stats/progreso-temporal', {
    params: { agrupacion }
  }).then((res) => res.data.data);
};

export const obtenerRecords = (): Promise<RecordsResponse> => {
  return api.get<GenericResponse<RecordsResponse>>('/stats/records')
    .then((res) => res.data.data);
};

/* Las teclas del MAPA DE CALOR. Es un endpoint aparte de /debilidades a propósito: aquel
   devuelve el top 5 pensado para Gemini y con ese recorte el teclado se pintaba entero
   como "sin errores" teniendo miles registrados, porque las 5 ganadoras eran símbolos con
   dos pulsaciones al 100%. Este exige un mínimo alto de pulsaciones, devuelve todas las
   teclas con datos y excluye los modos drill. */
export const obtenerMapaDeTeclas = (): Promise<ItemDebilidad[]> => {
  return api.get<GenericResponse<ItemDebilidad[]>>('/stats/mapa-teclas')
    .then((res) => res.data.data ?? []);
};

/* Convierte una sesión pasada en rival. Devuelve null cuando esa sesión no sirve: no es
   tuya, no es de Noticias ni de IA, o la noticia original ya no existe. */
export const obtenerRivalDeSesion = (sesionId: number): Promise<RivalSesionResponse | null> => {
  return api.get<GenericResponse<RivalSesionResponse | null>>(`/stats/rival/${sesionId}`)
    .then((res) => res.data.data ?? null);
};