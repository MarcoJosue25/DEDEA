import { api } from './client';
import type { GenericResponse, NoticiaDTO } from '../types';

export const obtenerNoticiasDelDia = (): Promise<NoticiaDTO[]> => {
  return api.get<GenericResponse<NoticiaDTO[]>>('/noticias')
    .then((res) => res.data.data);
};

export const obtenerNoticiaPorId = (id: number): Promise<NoticiaDTO> => {
  return api.get<GenericResponse<NoticiaDTO>>(`/noticias/${id}`)
    .then((res) => res.data.data);
};

export const obtenerNoticiaAleatoriaInedita = (
  categoria: string,
  dificultad: string
): Promise<NoticiaDTO> => {
  return api.get<GenericResponse<NoticiaDTO>>('/noticias/aleatoria', {
    params: { categoria, dificultad }
  }).then((res) => res.data.data);
};