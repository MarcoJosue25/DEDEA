import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthMenu from '../auth/AuthMenu';

/* Qué sección del menú se marca en cada ruta. "Práctica" es la portada de noticias y
   todo lo que sale de ella: practicar una noticia o un texto con IA (antes esas dos
   marcaban "Ejercicios"). "Ejercicios" agrupa Palabras y Ejercicios Base, también
   dentro de un ejercicio suelto. */
const esPractica = (ruta: string) => ['/', '/practica', '/selector-ia'].includes(ruta);
const esEjercicios = (ruta: string) =>
  ['/practica-palabras', '/practica-libre'].includes(ruta) || ruta.startsWith('/ejercicios-base');

/* Enlace del nav. El activo se distingue solo por el color de la letra (cian),
   sin pastilla ni subrayado: el resto queda en blanco. */
const enlace = (activo: boolean) =>
  `text-base font-semibold transition-colors ${
    activo ? 'text-cian' : 'text-white hover:text-cian/80'
  }`;

// Cuánto se queda a la vista el aviso de la luna.
const DURACION_AVISO_TEMA_MS = 4000;

const Navbar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuPracticaAbierto, setMenuPracticaAbierto] = useState(false);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [avisoTema, setAvisoTema] = useState(false);
  const temporizadorAviso = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(temporizadorAviso.current), []);

  /* V1 sale solo con la apariencia oscura (core/apariencia/apariencia.ts). La luna se
     queda como anuncio de lo que viene, en vez de desaparecer y volver después. */
  const mostrarAvisoTema = () => {
    window.clearTimeout(temporizadorAviso.current);
    setAvisoTema(true);
    temporizadorAviso.current = window.setTimeout(() => setAvisoTema(false), DURACION_AVISO_TEMA_MS);
  };

  const ir = (ruta: string) => {
    setMenuMovilAbierto(false);
    navigate(ruta);
  };

  /* Las mismas secciones para el menú del celular, en una sola lista: ahí no hay
     espacio para el desplegable de "Ejercicios", así que sus dos opciones van sueltas. */
  const seccionesMovil = [
    { ruta: '/', texto: 'Práctica', activa: esPractica(pathname) },
    { ruta: '/curso', texto: 'Curso', activa: pathname.startsWith('/curso') },
    { ruta: '/practica-palabras', texto: 'Palabras', activa: ['/practica-palabras', '/practica-libre'].includes(pathname) },
    { ruta: '/ejercicios-base', texto: 'Ejercicios Base', activa: pathname.startsWith('/ejercicios-base') },
    { ruta: '/stats', texto: 'Estadísticas', activa: pathname === '/stats' },
  ];

  return (
    /* Sin fondo propio: el header va sobre el degradado, como en el diseño.
       El backdrop-blur no se nota arriba del todo (detrás solo hay degradado) pero
       mantiene legibles los enlaces cuando el contenido pasa por debajo al hacer scroll. */
    <nav className="w-full top-0 sticky z-50 backdrop-blur-md">
      <div className="relative flex justify-between items-center px-6 py-5 max-w-5xl mx-auto">

        {/* Logo */}
        <button
          onClick={() => ir('/')}
          className="text-[1.75rem] font-bold uppercase tracking-[0.08em] leading-none text-white transition-opacity hover:opacity-80">
          Dedea
        </button>

        {/* Links */}
        <div className="hidden md:flex items-center gap-9">
          {/* La portada de noticias pasó a llamarse "Práctica": es de donde el usuario
              arranca a teclear. "Ejercicios" agrupa Palabras y Ejercicios Base (el
              catálogo plano de mecánica, para probar sueltos). "Curso" es la experiencia
              guiada por niveles (sendero con bloques). */}
          <button onClick={() => navigate('/')} className={enlace(esPractica(pathname))}>
            Práctica
          </button>

          <button onClick={() => navigate('/curso')} className={enlace(pathname.startsWith('/curso'))}>
            Curso
          </button>

          <div
            className="relative"
            onMouseEnter={() => setMenuPracticaAbierto(true)}
            onMouseLeave={() => setMenuPracticaAbierto(false)}>
            <button
              onClick={() => navigate('/ejercicios-base')}
              className={enlace(esEjercicios(pathname))}>
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

          <button onClick={() => navigate('/stats')} className={enlace(pathname === '/stats')}>
            Estadísticas
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={mostrarAvisoTema}
              aria-label="Temas de color"
              className="rounded-lg p-2 text-white/70 transition-all hover:bg-white/10 hover:text-white active:scale-95">
              <span className="material-symbols-outlined">dark_mode</span>
            </button>

            {avisoTema && (
              <div role="status"
                className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-carta p-4 text-sm leading-relaxed text-white shadow-xl">
                Estamos trabajando en distintos temas de color, te avisaremos cuando estén listos.
              </div>
            )}
          </div>

          <AuthMenu />

          <button
            onClick={() => setMenuMovilAbierto((abierto) => !abierto)}
            aria-label={menuMovilAbierto ? 'Cerrar el menú' : 'Abrir el menú'}
            aria-expanded={menuMovilAbierto}
            className="rounded-lg p-2 text-white/80 transition-all hover:bg-white/10 hover:text-white active:scale-95 md:hidden">
            <span className="material-symbols-outlined">{menuMovilAbierto ? 'close' : 'menu'}</span>
          </button>
        </div>

        {/* Menú del celular: debajo del header, a lo ancho. */}
        {menuMovilAbierto && (
          <div className="absolute inset-x-4 top-full z-50 overflow-hidden rounded-xl border border-white/10 bg-carta shadow-xl md:hidden">
            {seccionesMovil.map((s, i) => (
              <button
                key={s.ruta}
                onClick={() => ir(s.ruta)}
                className={`w-full px-5 py-3.5 text-left text-base font-semibold transition-colors hover:bg-white/5 ${
                  i > 0 ? 'border-t border-white/10' : ''
                } ${s.activa ? 'text-cian' : 'text-white/80'}`}>
                {s.texto}
              </button>
            ))}
          </div>
        )}

      </div>
    </nav>
  );
};

export default Navbar;
