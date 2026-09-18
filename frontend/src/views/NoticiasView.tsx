import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NoticiaDTO } from '../types';
import { obtenerNoticiasDelDia } from '../api/noticiaApi';
import Spinner from '../components/ui/Spinner';

/* Deben coincidir EXACTAMENTE con las etiquetas que guarda el backend
   (NoticiaServiceImpl.CATEGORIAS). Antes faltaba Política y esas noticias
   solo eran visibles con "Todos" seleccionado. */
const CATEGORIAS = ['Todos', 'Tecnología', 'Deportes', 'Ciencia', 'Cultura', 'Política'];

const CLAVE_IMAGENES = 'dedea_noticias_con_imagen';

const PUNTO_DIFICULTAD: Record<string, string> = {
  FACIL: 'bg-facil',
  MEDIO: 'bg-medio',
  MEDIO_DIFICIL: 'bg-medio-dificil',
  DIFICIL: 'bg-dificil',
};

const etiquetaDificultad = (dificultad: string) => {
  switch (dificultad) {
    case 'FACIL':   return 'Fácil';
    case 'MEDIO':   return 'Medio';
    case 'MEDIO_DIFICIL': return 'Medio-difícil';
    case 'DIFICIL': return 'Difícil';
    default:        return dificultad;
  }
};

const leerPreferenciaImagenes = () => {
  try {
    return localStorage.getItem(CLAVE_IMAGENES) === 'true';
  } catch {
    return false; // modo privado o storage bloqueado
  }
};

const NoticiasView = () => {
  const navigate = useNavigate();
  const [noticias, setNoticias] = useState<NoticiaDTO[]>([]);
  const [cargando, setCargando] = useState(true);
  const [categoriaActiva, setCategoriaActiva] = useState('Todos');
  const [sincronizando, setSincronizando] = useState(false);

  // Las imágenes son opcionales y la elección se recuerda entre visitas.
  const [conImagen, setConImagen] = useState(leerPreferenciaImagenes);

  const alternarImagenes = useCallback(() => {
    setConImagen((previo) => {
      const siguiente = !previo;
      try {
        localStorage.setItem(CLAVE_IMAGENES, String(siguiente));
      } catch { /* sin storage: la preferencia dura solo esta sesión */ }
      return siguiente;
    });
  }, []);

  /* Las noticias del día se generan de a una (scraping + Gemini, ~8s cada una) y el
     backend las guarda apenas están listas. Si al entrar todavía no hay ninguna de hoy,
     probablemente haya una carga en curso: se refresca cada 10s para que vayan
     apareciendo solas en vez de obligar a recargar la página.

     El sondeo se corta solo en cuanto llegan noticias con la fecha de hoy, y tiene un
     techo de intentos para que una jornada sin carga no deje el temporizador girando. */
  useEffect(() => {
    let vivo = true;
    let intentos = 0;
    const MAX_INTENTOS = 18; // 18 x 10s = 3 min, algo más que lo que tarda una tanda
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    const hoyISO = () => new Date().toISOString().slice(0, 10);
    const sonDeHoy = (lista: NoticiaDTO[]) =>
      lista.length > 0 && lista.some((n) => n.fechaPublicacion === hoyISO());

    const traer = async () => {
      try {
        const data = await obtenerNoticiasDelDia();
        if (!vivo) return;

        setNoticias(data);
        sessionStorage.setItem('lista_noticias', JSON.stringify(data));

        if (sonDeHoy(data)) {
          setSincronizando(false);
          return;
        }

        intentos += 1;
        if (intentos < MAX_INTENTOS) {
          setSincronizando(true);
          temporizador = setTimeout(traer, 10000);
        } else {
          setSincronizando(false);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (vivo) setCargando(false);
      }
    };

    traer();
    return () => {
      vivo = false;
      if (temporizador) clearTimeout(temporizador);
    };
  }, []);

  const noticiasFiltradas = categoriaActiva === 'Todos'
    ? noticias
    : noticias.filter((n) => n.categoria === categoriaActiva);

  const handlePracticar = (noticia: NoticiaDTO, indiceNoticia: number) => {
    sessionStorage.setItem('noticia_seleccionada', JSON.stringify(noticia));
    sessionStorage.setItem('indice_noticia', String(indiceNoticia));
    // Limpiamos los otros modos: PracticaView los revisa ANTES que la noticia,
    // así que un ejercicio de IA o de palabras abandonado a medias la taparía.
    sessionStorage.removeItem('texto_ia_seleccionado');
    sessionStorage.removeItem('texto_palabras_seleccionado');
    sessionStorage.removeItem('practica_ia_config');
    navigate('/practica');
  };

  return (
    <div>
      <header className="mb-10">
        <h1 className="text-5xl font-bold leading-[1.1] tracking-tight text-white">
          Practica con…
          <br />
          Noticias <span className="text-cian">&amp;</span> Tendencias
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-gris-texto">
          Selecciona un artículo real del día para practicar.
          Mide tu velocidad y tu porcentaje de aciertos.
        </p>
      </header>

      {/* Filtros + interruptor de imágenes */}
      <div className="mb-10 flex flex-wrap items-center gap-3">
        {CATEGORIAS.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoriaActiva(cat)}
            aria-pressed={categoriaActiva === cat}
            className={`rounded-full px-5 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
              categoriaActiva === cat
                ? 'bg-cian text-ground'
                : 'bg-white/3 text-white/70 hover:bg-white/10 hover:text-white'
            }`}>
            {cat}
          </button>
        ))}

        <button
          onClick={alternarImagenes}
          aria-pressed={conImagen}
          title={conImagen ? 'Ocultar las imágenes' : 'Mostrar las imágenes'}
          className={`ml-auto flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
            conImagen
              ? 'bg-cian/15 text-cian'
              : 'bg-white/3 text-white/70 hover:bg-white/10 hover:text-white'
          }`}>
          <span className="material-symbols-outlined text-[18px]">
            {conImagen ? 'image' : 'hide_image'}
          </span>
          Imágenes
        </button>
      </div>

      {cargando && <Spinner texto="Cargando noticias..." />}

      {/* Carga del día en curso: el backend guarda de a una, así que la lista se va
          completando sola. Se avisa para que no parezca que la página está rota. */}
      {!cargando && sincronizando && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-cian/25 bg-cian/5 px-5 py-3">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-cian" />
          <p className="text-sm text-gris-texto">
            Preparando las noticias de hoy. Van apareciendo solas a medida que se generan
            — mientras tanto puedes practicar con las últimas disponibles.
          </p>
        </div>
      )}

      {!cargando && noticiasFiltradas.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <span className="material-symbols-outlined text-6xl text-white/15">newspaper</span>
          <p className="text-lg text-gris-texto">No hay noticias disponibles en esta categoría.</p>
        </div>
      )}

      {!cargando && noticiasFiltradas.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {noticiasFiltradas.map((noticia, indice) => {
            /* La foto solo se dibuja si el usuario la pidió Y la noticia la tiene.
               Las guardadas antes de que el backend leyera el campo "image" de GNews
               vienen sin imagenUrl, y deben verse como una tarjeta normal. */
            const muestraFoto = conImagen && Boolean(noticia.imagenUrl);

            /* La tarjeta del medio de cada fila lleva la foto ARRIBA del todo, y su pie
               dentro del cuerpo. Las laterales la llevan abajo con el pie montado encima.
               Esa alternancia es lo que le da ritmo a la grilla en vez de tres bloques
               idénticos. Se calcula por posición porque la fila es de tres en pantallas
               grandes; en móvil la grilla es de una columna y la variante simplemente no
               se nota. */
            const esCentralDeFila = muestraFoto && indice % 3 === 1;

            return (
              <article
                key={noticia.id}
                className="flex flex-col overflow-hidden rounded-2xl bg-carta transition-all duration-200 hover:-translate-y-1">

                {esCentralDeFila && (
                  <img
                    src={noticia.imagenUrl!}
                    alt=""
                    loading="lazy"
                    className="h-44 w-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}

                <div className="flex flex-grow flex-col p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="rounded-md bg-cian-suave/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-cian-suave">
                      {noticia.categoria}
                    </span>
                    <span className="font-mono text-xs text-gris-texto">
                      {noticia.fechaPublicacion}
                    </span>
                  </div>

                  <h3 className="mb-4 text-xl font-bold leading-snug text-white">
                    {noticia.titulo}
                  </h3>

                  <p className="mb-6 flex-grow text-sm leading-relaxed text-gris-texto">
                    {noticia.contenidoResumido || `${noticia.contenidoCompleto?.slice(0, 150)}...`}
                  </p>

                  {/* El pie va dentro del cuerpo cuando no hay foto, y también en la
                      tarjeta central: ahí la imagen está arriba, así que no hay nada
                      abajo sobre lo que montarlo. */}
                  {(!muestraFoto || esCentralDeFila) && (
                    <PieTarjeta
                      noticia={noticia}
                      onPracticar={() => handlePracticar(noticia, indice)}
                    />
                  )}
                </div>

                {/* En las laterales el pie se monta encima de la imagen, como en el diseño. */}
                {muestraFoto && !esCentralDeFila && (
                  <div className="relative mt-auto">
                    <img
                      src={noticia.imagenUrl!}
                      alt=""
                      loading="lazy"
                      className="h-44 w-full object-cover"
                      /* Si la URL de la portada está rota, se esconde la imagen en vez
                         de dejar el icono de imagen partida sobre la tarjeta. */
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-6 pb-5 pt-10">
                      <PieTarjeta
                        noticia={noticia}
                        onPracticar={() => handlePracticar(noticia, indice)}
                      />
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* Pie de la tarjeta: dificultad a la izquierda, acción a la derecha.
   Vive aparte porque cambia de sitio según haya foto o no, y así las dos
   variantes no se desincronizan. */
const PieTarjeta = ({
  noticia,
  onPracticar,
}: {
  noticia: NoticiaDTO;
  onPracticar: () => void;
}) => (
  <div className="flex items-center justify-between gap-4">
    <span className="flex items-center gap-2 rounded-full bg-pastilla px-3 py-1.5">
      <span className={`h-2 w-2 rounded-full ${PUNTO_DIFICULTAD[noticia.dificultad] ?? 'bg-white/40'}`} />
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gris-texto">
        {etiquetaDificultad(noticia.dificultad)}
      </span>
    </span>

    <button
      onClick={onPracticar}
      className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-cian transition-transform hover:translate-x-0.5">
      Practicar
      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
    </button>
  </div>
);

export default NoticiasView;
