import axios from 'axios';
import { useAppStore } from '../store/useAppStore';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1',
  // Necesario para que el navegador mande la cookie dedea_token (login) en cada request.
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de REQUEST: Inyecta el UUID en cada petición
api.interceptors.request.use(
  (config) => {
    const uuid = useAppStore.getState().uuid;
    if (uuid) {
      config.headers['X-Identificador-Temporal'] = uuid;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de RESPONSE: Manejo global de errores del backend
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // El backend devuelve el mensaje de error dentro de GenericResponse
    const mensaje = error.response?.data?.message || 'Error de conexión con el servidor';
    console.error(`[API Error] ${error.response?.status}: ${mensaje}`);
    return Promise.reject(error);
  }
);