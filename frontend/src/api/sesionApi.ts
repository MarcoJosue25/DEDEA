import { api } from './client';
import type { GenericResponse, SesionRequest, SesionResponse } from '../types';

export const guardarSesion = (request: SesionRequest): Promise<SesionResponse> => {
  return api.post<GenericResponse<SesionResponse>>('/sesiones', request)
    .then((res) => res.data.data);
};