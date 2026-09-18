import Navbar from './Navbar';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    // Sin fondo propio: el degradado vive en body (index.css). Antes había un
    // bg-slate-50 acá que lo tapaba entero.
    <div className="min-h-screen text-on-surface flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-5xl mx-auto w-full px-6 py-12">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;