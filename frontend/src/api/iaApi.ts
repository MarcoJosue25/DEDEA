import { api } from './client';
import type { GenericResponse, TextoIaRequest, TextoIaResponse } from '../types';

export const generarTextoIA = (request: TextoIaRequest): Promise<TextoIaResponse> => {
  return api.post<GenericResponse<TextoIaResponse>>('/ia/generar', request)
    .then((res) => res.data.data);
};