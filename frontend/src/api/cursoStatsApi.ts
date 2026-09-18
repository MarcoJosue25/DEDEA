import { api } from './client';
import type { GenericResponse, NivelCurso, CursoStatsResponse, ProgresoEjercicioResponse } from '../types';

// Separado por completo de statsApi.ts: nunca comparte endpoint ni datos con las
// estadísticas globales (que solo miden Noticias + IA).

export const obtenerStatsCursoPorNivel = (nivel: NivelCurso): Promise<CursoStatsResponse> => {
  return api.get<GenericResponse<CursoStatsResponse>>(`/curso/stats/${nivel}`)
    .then((res) => res.data.data);
};

export const obtenerProgresoCursoPorNivel = (nivel: NivelCurso): Promise<ProgresoEjercicioResponse[]> => {
  return api.get<GenericResponse<ProgresoEjercicioResponse[]>>(`/curso/${nivel}/progreso`)
    .then((res) => res.data.data);
};
