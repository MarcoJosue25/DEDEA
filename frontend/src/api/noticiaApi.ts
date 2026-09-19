import { api } from './client';
import type { GenericResponse, NoticiaDTO } from '../types';

export const obtenerNoticiasDelDia = (): Promise<NoticiaDTO[]> => {
  return api.get<GenericResponse<NoticiaDTO[]>>('/noticias')
    .then((res) => res.data.data);
};
