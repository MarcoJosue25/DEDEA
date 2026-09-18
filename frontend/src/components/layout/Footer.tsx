const Footer = () => {
  return (
    // Sin fondo propio: se apoya sobre el degradado, igual que el header.
    <footer className="mt-16 w-full border-t border-white/10">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-6 md:flex-row">
        <div className="flex flex-col items-center md:items-start">
          <span className="text-lg font-bold uppercase tracking-[0.08em] text-gris-texto">Dedea</span>
          <span className="mt-1 text-xs text-gris-texto/60">© 2026 Dedea Flow State Typing</span>
        </div>
        <div className="flex gap-6">
          <a href="#" className="text-xs uppercase tracking-wide text-gris-texto transition-colors hover:text-cian">Privacidad</a>
          <a href="#" className="text-xs uppercase tracking-wide text-gris-texto transition-colors hover:text-cian">Términos</a>
          <a href="#" className="text-xs uppercase tracking-wide text-gris-texto transition-colors hover:text-cian">Soporte</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
