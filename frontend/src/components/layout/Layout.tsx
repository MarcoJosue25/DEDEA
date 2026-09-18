import { matchPath, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

/* Las pantallas donde se TECLEA, y la de su resultado, van sin footer. Ahí lo único que
   importa es el texto y el siguiente paso; debajo del ejercicio el pie solo distrae. Es lo
   que hacen las plataformas de mecanografía: el pie vive en las pantallas de navegación.

   Noticias es la portada y tiene que conservarlo: Google exige que la página principal
   enlace la política de privacidad para habilitar el login a todo el mundo. */
const RUTAS_SIN_FOOTER = [
  '/practica',
  '/practica-libre',
  '/resultados',
  '/ejercicios-base/:id',
  '/curso/:nivel/:id',
];

const Layout = ({ children }: LayoutProps) => {
  const { pathname } = useLocation();
  const conFooter = !RUTAS_SIN_FOOTER.some((ruta) => matchPath(ruta, pathname));

  return (
    // Sin fondo propio: el degradado vive en body (index.css). Antes había un
    // bg-slate-50 acá que lo tapaba entero.
    <div className="min-h-screen text-on-surface flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-5xl mx-auto w-full px-6 py-12">
        {children}
      </main>
      {conFooter && <Footer />}
    </div>
  );
};

export default Layout;
