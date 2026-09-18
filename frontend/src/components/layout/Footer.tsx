import { useNavigate } from 'react-router-dom';
import { CORREO_CONTACTO } from '../../core/contacto';

const ENLACE = 'text-xs uppercase tracking-wide text-gris-texto transition-colors hover:text-cian';

const Footer = () => {
  const navigate = useNavigate();

  /* El footer está al fondo de la página y la app no vuelve arriba al cambiar de ruta: sin
     esto, Privacidad o Términos se abrirían ya desplazados hacia abajo. */
  const ir = (ruta: string) => {
    window.scrollTo(0, 0);
    navigate(ruta);
  };

  return (
    // Sin fondo propio: se apoya sobre el degradado, igual que el header.
    <footer className="mt-16 w-full border-t border-white/10">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-6 md:flex-row">
        <div className="flex flex-col items-center md:items-start">
          <span className="text-lg font-bold uppercase tracking-[0.08em] text-gris-texto">Dedea</span>
          <span className="mt-1 text-xs text-gris-texto/60">© 2026 DEDEA - Mecanografía inteligente</span>
        </div>
        <nav className="flex gap-6">
          <button onClick={() => ir('/privacidad')} className={ENLACE}>Privacidad</button>
          <button onClick={() => ir('/terminos')} className={ENLACE}>Términos</button>
          <a href={`mailto:${CORREO_CONTACTO}`} className={ENLACE}>Contacto</a>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
