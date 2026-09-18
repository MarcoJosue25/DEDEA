import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { iniciarLoginConProveedor } from '../../api/authApi';

const AuthMenu = () => {
  const { usuario, cargando, cargarUsuario, logout } = useAuthStore();
  const uuid = useAppStore((state) => state.uuid);
  const [abierto, setAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cargarUsuario();
  }, [cargarUsuario]);

  useEffect(() => {
    const cerrarSiClickAfuera = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', cerrarSiClickAfuera);
    return () => document.removeEventListener('mousedown', cerrarSiClickAfuera);
  }, []);

  const handleLogin = (proveedor: 'google' | 'facebook') => {
    iniciarLoginConProveedor(proveedor, uuid);
  };

  const handleLogout = async () => {
    await logout();
    setAbierto(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setAbierto((a) => !a)}
        className="flex items-center gap-1 rounded-full p-1 transition-all hover:bg-white/10 active:scale-95"
        disabled={cargando}
      >
        {usuario?.avatarUrl ? (
          <img
            src={usuario.avatarUrl}
            alt={usuario.nombre ?? 'Usuario'}
            className="h-8 w-8 rounded-full ring-2 ring-white/20"
          />
        ) : (
          <span className="material-symbols-outlined text-[28px] text-white/70">account_circle</span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 z-50 mt-3 w-64 rounded-xl border border-white/10 bg-carta p-4 shadow-xl">
          {usuario ? (
            <div className="flex flex-col gap-3">
              <div>
                <p className="truncate text-sm font-semibold text-white">{usuario.nombre}</p>
                <p className="truncate text-xs text-gris-texto">{usuario.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-left text-sm font-semibold text-dificil transition-opacity hover:opacity-80"
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gris-texto">
                Inicia sesión (opcional)
              </p>
              <p className="text-xs text-gris-texto">
                Puedes seguir practicando como invitado. Inicia sesión para guardar tu progreso en la nube.
              </p>
              <button
                onClick={() => handleLogin('google')}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition-all hover:border-cian hover:text-cian active:scale-95"
              >
                Continuar con Google
              </button>
              <button
                onClick={() => handleLogin('facebook')}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition-all hover:border-cian hover:text-cian active:scale-95"
              >
                Continuar con Facebook
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuthMenu;
