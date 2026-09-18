import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthMenu from '../auth/AuthMenu';

const RUTAS_PRACTICA = ['/practica', '/practica-palabras', '/practica-libre', '/selector-ia', '/ejercicios-base'];

/* Enlace del nav. El activo se distingue solo por el color de la letra (cian),
   sin pastilla ni subrayado: el resto queda en blanco. */
const enlace = (activo: boolean) =>
  `text-base font-semibold transition-colors ${
    activo ? 'text-cian' : 'text-white hover:text-cian/80'
  }`;

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuPracticaAbierto, setMenuPracticaAbierto] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    /* Sin fondo propio: el header va sobre el degradado, como en el diseño.
       El backdrop-blur no se nota arriba del todo (detrás solo hay degradado) pero
       mantiene legibles los enlaces cuando el contenido pasa por debajo al hacer scroll. */
    <nav className="w-full top-0 sticky z-50 backdrop-blur-md">
      <div className="flex justify-between items-center px-6 py-5 max-w-5xl mx-auto">

        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="text-[1.75rem] font-bold uppercase tracking-[0.08em] leading-none text-white transition-opacity hover:opacity-80">
          Dedea
        </button>

        {/* Links */}
        <div className="hidden md:flex items-center gap-9">
          {/* La portada de noticias pasó a llamarse "Práctica": es de donde el usuario
              arranca a teclear. "Ejercicios" agrupa Palabras y Ejercicios Base (el
              catálogo plano de mecánica, para probar sueltos). "Curso" es la experiencia
              guiada por niveles (sendero con bloques). */}
          <button onClick={() => navigate('/')} className={enlace(isActive('/'))}>
            Práctica
          </button>

          <button onClick={() => navigate('/curso')} className={enlace(location.pathname.startsWith('/curso'))}>
            Curso
          </button>

          <div
            className="relative"
            onMouseEnter={() => setMenuPracticaAbierto(true)}
            onMouseLeave={() => setMenuPracticaAbierto(false)}>
            <button
              onClick={() => navigate('/ejercicios-base')}
              className={enlace(RUTAS_PRACTICA.includes(location.pathname))}>
              Ejercicios
            </button>

            {menuPracticaAbierto && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 w-40 z-50">
                <div className="overflow-hidden rounded-xl border border-white/10 bg-carta shadow-xl">
                  <button
                    onClick={() => navigate('/practica-palabras')}
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-white/75 transition-colors hover:bg-white/5 hover:text-cian">
                    Palabras
                  </button>
                  <button
                    onClick={() => navigate('/ejercicios-base')}
                    className="w-full border-t border-white/10 px-4 py-3 text-left text-sm font-semibold text-white/75 transition-colors hover:bg-white/5 hover:text-cian">
                    Ejercicios Base
                  </button>
                </div>
              </div>
            )}
          </div>

          <button onClick={() => navigate('/stats')} className={enlace(isActive('/stats'))}>
            Estadísticas
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            aria-label="Cambiar tema"
            className="rounded-lg p-2 text-white/70 transition-all hover:bg-white/10 hover:text-white active:scale-95">
            <span className="material-symbols-outlined">dark_mode</span>
          </button>
          <AuthMenu />
        </div>

      </div>
    </nav>
  );
};

export default Navbar;