const Footer = () => {
  return (
    // Sin fondo propio: se apoya sobre el degradado, igual que el header.
    <footer className="mt-16 w-full border-t border-white/10">
      {/* Sin enlaces a Privacidad, Términos ni Soporte hasta que esas páginas existan: un
          enlace que no lleva a ningún lado se lee como sitio a medio hacer. La de Privacidad
          va a hacer falta antes del lanzamiento, porque Google y Facebook la piden para
          habilitar el login a todo el mundo. */}
      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-6 md:items-start">
        <span className="text-lg font-bold uppercase tracking-[0.08em] text-gris-texto">Dedea</span>
        <span className="mt-1 text-xs text-gris-texto/60">© 2026 DEDEA</span>
      </div>
    </footer>
  );
};

export default Footer;
