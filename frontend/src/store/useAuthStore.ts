import { create } from 'zustand';
import type { UsuarioResponse } from '../types';
import { obtenerUsuarioActual, cerrarSesion } from '../api/authApi';

interface AuthState {
  usuario: UsuarioResponse | null;
  cargando: boolean;
  cargarUsuario: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  usuario: null,
  cargando: true,

  cargarUsuario: async () => {
    try {
      const usuario = await obtenerUsuarioActual();
      set({ usuario: usuario.autenticado ? usuario : null, cargando: false });
    } catch {
      // Si /auth/me falla (backend caído, red, etc.) seguimos en modo invitado sin romper la app.
      set({ usuario: null, cargando: false });
    }
  },

  logout: async () => {
    await cerrarSesion();
    set({ usuario: null });
  },
}));
