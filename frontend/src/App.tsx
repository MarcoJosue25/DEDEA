import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import Layout from './components/layout/Layout';
import Spinner from './components/ui/Spinner';

/* CARGA POR VISTA, CON PRECARGA EN SEGUNDO PLANO.

   Antes las 12 vistas viajaban en un solo archivo de 758 kB: al abrir la portada de noticias
   el navegador descargaba Y PARSEABA también el Curso, el Área, las estadísticas con toda la
   librería de gráficos y hasta la pantalla de administración del diccionario. En una conexión
   buena eso son décimas de segundo; en un móvil de gama baja el parseo de medio megabyte de
   JavaScript sí se nota al arrancar.

   `lazy()` parte cada vista en su propio archivo. Y para no cambiar un problema por otro —el
   parpadeo de carga la primera vez que entrás a Estadísticas— abajo se precarga el resto
   cuando el navegador queda ocioso: partido para arrancar rápido, precargado para navegar sin
   esperas. El usuario no debería notar ninguna diferencia respecto de hoy, salvo que la
   portada abre antes.

   NoticiasView NO va acá: es la ruta de entrada y cargarla aparte agregaría un salto extra
   justo en la pantalla que se quiere acelerar. */
import NoticiasView from './views/NoticiasView';

const PracticaView = lazy(() => import('./views/PracticaView'));
const ResultadosView = lazy(() => import('./views/ResultadosView'));
const GlobalStatsView = lazy(() => import('./views/GlobalStatsView'));
const SelectorIaView = lazy(() => import('./views/SelectorIaView'));
const PalabrasSelectorView = lazy(() => import('./views/PalabrasSelectorView'));
const PracticaLibreView = lazy(() => import('./views/PracticaLibreView'));
const CursoListView = lazy(() => import('./views/CursoListView'));
const CursoPracticaView = lazy(() => import('./views/CursoPracticaView'));

/* Fuerza el remontaje al cambiar de ejercicio. Ver la nota de las rutas. Va acá y no en el
   propio componente porque una `key` solo puede ponerla quien lo crea. */
const PracticaConClave = () => {
  const { id } = useParams();
  return <CursoPracticaView key={id} />;
};
const CursoSelectorView = lazy(() => import('./views/CursoSelectorView'));
const CursoNivelView = lazy(() => import('./views/CursoNivelView'));
const RevisionPalabrasView = lazy(() => import('./views/RevisionPalabrasView'));
const LaboratorioSonidoView = lazy(() => import('./views/LaboratorioSonidoView'));
// Fuera de la precarga: se visitan muy poco y pesan casi nada.
const PrivacidadView = lazy(() => import('./views/PrivacidadView'));
const TerminosView = lazy(() => import('./views/TerminosView'));

/* El orden importa: primero lo que el usuario toca a los pocos segundos de entrar (elegir una
   noticia y ponerse a teclear), después el resto. La pantalla de administración va al final
   porque la usa una sola persona y no vale la pena adelantarla. */
const PRECARGA = [
  () => import('./views/PracticaView'),
  () => import('./views/ResultadosView'),
  () => import('./views/GlobalStatsView'),
  () => import('./views/SelectorIaView'),
  () => import('./views/CursoSelectorView'),
  () => import('./views/CursoNivelView'),
  () => import('./views/CursoPracticaView'),
  () => import('./views/CursoListView'),
  () => import('./views/PalabrasSelectorView'),
  () => import('./views/PracticaLibreView'),
  () => import('./views/RevisionPalabrasView'),
];

/* Trae el resto de las vistas cuando el navegador no tiene nada mejor que hacer.

   `requestIdleCallback` es exactamente para esto: corre en los huecos entre tareas, así que no
   compite con el render de la portada ni con la petición de las noticias. Safari no lo tiene,
   de ahí el respaldo con setTimeout.

   Se traen de a UNA y encadenadas, no todas de golpe: doce peticiones simultáneas le pelean
   el ancho de banda a las imágenes de las noticias, que es lo que el usuario sí está mirando. */
const usePrecarga = () => {
  useEffect(() => {
    let cancelado = false;

    const traerSiguiente = (i: number) => {
      if (cancelado || i >= PRECARGA.length) return;
      PRECARGA[i]()
        .catch(() => undefined)   // una precarga fallida no debe romper nada: se reintenta al navegar
        .finally(() => traerSiguiente(i + 1));
    };

    const agendar = window.requestIdleCallback
      ? window.requestIdleCallback(() => traerSiguiente(0))
      : window.setTimeout(() => traerSiguiente(0), 2000);

    return () => {
      cancelado = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(agendar as number);
      else window.clearTimeout(agendar as number);
    };
  }, []);
};

function App() {
  const uuid = useAppStore((state) => state.uuid);
  usePrecarga();

  if (!uuid) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-emerald-600 animate-pulse text-xl">Iniciando Motor Dedea...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout>
        {/* El fallback casi nunca se ve: para cuando el usuario navega, la precarga ya trajo
            la vista. Solo aparece si hace clic en los primeros segundos o si la red es muy
            lenta — y ahí es preferible un spinner a una pantalla en blanco. */}
        <Suspense fallback={<Spinner texto="Cargando..." />}>
          <Routes>
            <Route path="/" element={<NoticiasView />} />
            <Route path="/practica" element={<PracticaView />} />
            <Route path="/resultados" element={<ResultadosView />} />
            <Route path="/stats" element={<GlobalStatsView />} />
            <Route path="/selector-ia" element={<SelectorIaView />} />
            <Route path="/practica-palabras" element={<PalabrasSelectorView />} />
            <Route path="/practica-libre" element={<PracticaLibreView />} />
            <Route path="/ejercicios-base" element={<CursoListView />} />
            {/* ⚠️ `key` CON EL ID, y no es decorativo. Estas dos rutas comparten componente,
                así que pasar de un ejercicio a otro NO lo desmonta: React reutiliza la
                instancia y todo su estado sobrevive al cambio.

                Costó un bug real: tecleando "Palabras de la línea base" con el cronómetro
                en marcha y saltando al "Contrarreloj" de al lado, `corriendo` seguía en
                true y la cuenta atrás arrancaba sola, sin que el usuario hubiera pulsado
                una tecla. Y el cronómetro es solo el síntoma más visible — lo mismo valía
                para el índice del cursor, los latidos, el fantasma y los acumuladores de
                teclas y n-gramas.

                Con la key, cambiar de ejercicio equivale a entrar de cero, que es lo que
                significa de verdad. Arregla la familia entera en vez de un caso. */}
            <Route path="/ejercicios-base/:id" element={<PracticaConClave />} />
            {/* Curso por niveles: selector → sendero por nivel → práctica secuencial.
                CursoPracticaView detecta el segmento :nivel y guarda origen_practica como
                'curso-nivel', para que Resultados muestre "Enter → siguiente" en vez de
                anterior/siguiente/repetir. */}
            <Route path="/curso" element={<CursoSelectorView />} />
            <Route path="/curso/:nivel" element={<CursoNivelView />} />
            <Route path="/curso/:nivel/:id" element={<PracticaConClave />} />

            {/* Pantalla de administracion: revision manual del diccionario. NO se enlaza desde
                ningun lado a proposito — se llega escribiendo la ruta, y ademas el backend exige
                X-Admin-Key en cada llamada. La ruta oculta no es la seguridad; la clave si. */}
            <Route path="/revision-palabras" element={<RevisionPalabrasView />} />

            {/* Laboratorio de sonido: la pantalla donde se ELIGEN los sonidos, no donde
                suenan. Tampoco se enlaza desde ningun lado, igual que la que sirvio para
                elegir el degradado del fondo. Se borra cuando los ganadores esten
                cableados en los ejercicios. */}
            <Route path="/laboratorio-sonido" element={<LaboratorioSonidoView />} />
            <Route path="/privacidad" element={<PrivacidadView />} />
            <Route path="/terminos" element={<TerminosView />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
