import { api } from './client';
import type { BusquedaPalabras, PalabraRevisionDTO, ResumenRevision } from '../types';

/* La clave de administrador NO viaja en el interceptor global de client.ts: es exclusiva de
   esta pantalla y meterla ahí la mandaría en todas las peticiones de la app, incluidas las
   que hace un usuario cualquiera. Vive en sessionStorage —no en localStorage— para que se
   borre al cerrar la pestaña. */
const CLAVE = 'dedea_admin_key';

export const guardarClave = (clave: string) => sessionStorage.setItem(CLAVE, clave);
export const leerClave = () => sessionStorage.getItem(CLAVE) ?? '';

const cabecera = () => ({ headers: { 'X-Admin-Key': leerClave() } });

export const obtenerResumen = async (): Promise<ResumenRevision> =>
  (await api.get('/revision-palabras/resumen', cabecera())).data.data;

export const obtenerTanda = async (cuantas = 100): Promise<PalabraRevisionDTO[]> =>
  (await api.get(`/revision-palabras/tanda?cuantas=${cuantas}`, cabecera())).data.data;

/* Van las aprobadas Y todas las mostradas: sin la segunda lista el backend no puede
   distinguir "la vi y la rechacé" de "todavía no llegué a esa". */
export const guardarTanda = async (
  aprobadas: number[], mostradas: number[],
): Promise<ResumenRevision> =>
  (await api.post('/revision-palabras/guardar', { aprobadas, mostradas }, cabecera())).data.data;

export const activarPreactivas = async (): Promise<ResumenRevision> =>
  (await api.post('/revision-palabras/activar', {}, cabecera())).data.data;

export const deshacerUltimaTanda = async (): Promise<ResumenRevision> =>
  (await api.post('/revision-palabras/deshacer', {}, cabecera())).data.data;

export const buscarPalabras = async (texto: string): Promise<BusquedaPalabras> =>
  (await api.get(`/revision-palabras/buscar?texto=${encodeURIComponent(texto)}`, cabecera())).data.data;

/* Mover muchas de un golpe. `nuevas` son los terminos que la busqueda NO encontro: el backend
   los crea directamente como rechazados, y asi quedan bloqueando su propio reingreso en la
   proxima importacion sin que nadie tenga que volver a decidirlo. */
export const cambiarEstadoLote = async (
  ids: number[], nuevas: string[], estado: string,
): Promise<ResumenRevision> =>
  (await api.post('/revision-palabras/estado-lote', { ids, nuevas, estado }, cabecera())).data.data;

export const cambiarEstadoPalabra = async (
  id: number, estado: string,
): Promise<PalabraRevisionDTO> =>
  // El id viaja como NUMERO: el backend ahora lo recibe en un DTO tipado y validado.
  (await api.post('/revision-palabras/estado', { id, estado }, cabecera())).data.data;

export const migrarDiccionario = async (): Promise<ResumenRevision> =>
  (await api.post('/revision-palabras/migrar-diccionario', {}, cabecera())).data.data;

export const importarArchivo = async (archivo: string): Promise<ResumenRevision> =>
  (await api.post(`/revision-palabras/importar?archivo=${encodeURIComponent(archivo)}`, {}, cabecera())).data.data;
