import { api } from './client';
import type { GenericResponse, UsuarioResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
// Los endpoints /oauth2/authorization/* de Spring Security viven en la raíz del backend,
// no bajo /api/v1, así que le quitamos ese sufijo a la URL base.
const BACKEND_ROOT = API_BASE.replace(/\/api\/v1\/?$/, '');

export const obtenerUsuarioActual = (): Promise<UsuarioResponse> => {
  return api.get<GenericResponse<UsuarioResponse>>('/auth/me').then((res) => res.data.data);
};

export const cerrarSesion = (): Promise<void> => {
  return api.post('/auth/logout').then(() => undefined);
};

// Antes de mandar al usuario a Google/Facebook, le avisamos al backend cuál es su UUID
// de invitado actual, para que si es su primera vez, la cuenta nueva adopte ese UUID
// y no pierda el historial de práctica que ya tenía en este navegador.
const vincularUuidInvitado = (uuid: string): Promise<void> => {
  return api.post('/auth/vincular-uuid-invitado', { uuid }).then(() => undefined);
};

export const iniciarLoginConProveedor = async (
  proveedor: 'google' | 'facebook',
  uuidInvitado: string,
) => {
  await vincularUuidInvitado(uuidInvitado);
  // Redirección de página completa: el flujo OAuth2 de Spring Security necesita navegación
  // real (no fetch/XHR) porque termina con un redirect a Google/Facebook y de vuelta.
  window.location.href = `${BACKEND_ROOT}/oauth2/authorization/${proveedor}`;
};
