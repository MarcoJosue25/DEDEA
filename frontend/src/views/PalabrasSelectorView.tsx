import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { obtenerDebilidades } from '../api/statsApi';
import { generarTextoDePalabras } from '../api/diccionarioApi';
import type { ItemDebilidad } from '../types';
import Spinner from '../components/ui/Spinner';

const PalabrasSelectorView = () => {
  const navigate = useNavigate();
  const [cargandoDebilidades, setCargandoDebilidades] = useState(true);
  const [teclas, setTeclas] = useState<ItemDebilidad[]>([]);
  const [bigramas, setBigramas] = useState<ItemDebilidad[]>([]);
  const [trigramas, setTrigramas] = useState<ItemDebilidad[]>([]);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [textoLibre, setTextoLibre] = useState('');
  const [dificultad, setDificultad] = useState<'FACIL' | 'MEDIO' | 'DIFICIL'>('MEDIO');
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerDebilidades()
      .then((res) => {
        setTeclas(res.peoresTeclas ?? []);
        setBigramas(res.peoresBigramas ?? []);
        setTrigramas(res.peoresTrigramas ?? []);
      })
      .catch(() => {
        // Sin debilidades todavía (usuario nuevo) no es un error fatal: sigue con el input libre.
      })
      .finally(() => setCargandoDebilidades(false));
  }, []);

  const toggleChip = (secuencia: string) => {
    setSeleccionados((prev) =>
      prev.includes(secuencia) ? prev.filter((s) => s !== secuencia) : [...prev, secuencia]
    );
  };

  const agregarLibre = () => {
    const limpio = textoLibre.trim().toLowerCase();
    if (!limpio) return;
    if (!/^[a-záéíóúñü]{1,5}$/.test(limpio)) {
      setError('Escribe solo letras (1 a 5 caracteres).');
      return;
    }
    setError(null);
    if (!seleccionados.includes(limpio)) {
      setSeleccionados((prev) => [...prev, limpio]);
    }
    setTextoLibre('');
  };

  const handleGenerar = async () => {
    if (seleccionados.length === 0) {
      setError('Escribe o selecciona al menos un ngram o letra para practicar.');
      return;
    }

    setGenerando(true);
    setError(null);

    try {
      const texto = await generarTextoDePalabras(seleccionados, dificultad, 40);
      if (!texto) {
        setError('No se encontraron palabras para esa combinación. Prueba con otra letra o dificultad.');
        setGenerando(false);
        return;
      }

      sessionStorage.setItem('texto_palabras_seleccionado', JSON.stringify({
        texto,
        ngrams: seleccionados,
        dificultad,
      }));
      sessionStorage.removeItem('noticia_seleccionada');
      sessionStorage.removeItem('texto_ia_seleccionado');
      sessionStorage.removeItem('practica_ia_config');
      navigate('/practica-libre');
    } catch (err) {
      setError('No se pudieron generar las palabras. Intenta de nuevo.');
      console.error(err);
      setGenerando(false);
    }
  };

  /* Un solo estilo de selección (cian) para teclas, bigramas y trigramas. Antes cada
     grupo tenía su color —rosa, azul, ámbar—, lo que hacía parecer que el color
     significaba algo cuando solo indicaba de qué lista venía. */
  const chip = (secuencia: string, porcentajeError: number) => {
    const activo = seleccionados.includes(secuencia);
    return (
      <button
        key={secuencia}
        onClick={() => toggleChip(secuencia)}
        aria-pressed={activo}
        className={`flex flex-col items-center rounded-xl border-2 px-4 py-3 transition-all ${
          activo
            ? 'border-cian bg-cian/10 text-cian'
            : 'border-vidrio-borde bg-vidrio text-gris-texto hover:border-white/25'
        }`}>
        <span className="font-mono text-xl font-bold">{secuencia}</span>
        <span className="mt-1 text-xs">{porcentajeError}% error</span>
      </button>
    );
  };

  const hayDebilidades = teclas.length > 0 || bigramas.length > 0 || trigramas.length > 0;

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <header>
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-sm font-semibold text-gris-texto transition-colors hover:text-cian">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Volver
        </button>
        <h1 className="mb-2 text-4xl font-bold text-white">Práctica con palabras</h1>
        <p className="text-lg text-gris-texto">
          Escribe o selecciona las letras y combinaciones que quieres practicar.
        </p>
      </header>

      {/* Input libre + dificultad al costado */}
      <div className="rounded-2xl border border-vidrio-borde bg-vidrio p-6 backdrop-blur-sm">
        <h2 className="mb-4 text-lg font-bold text-white">Escribe un ngram o letra</h2>
        <div className="flex gap-3 items-stretch">
          <input
            type="text"
            value={textoLibre}
            onChange={(e) => setTextoLibre(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') agregarLibre(); }}
            placeholder="ej: ca, ño, k"
            maxLength={5}
            className="flex-1 rounded-xl border border-vidrio-borde bg-carta/60 px-4 py-2 font-mono text-lg text-white placeholder:text-gris-texto/50 focus:border-cian focus:outline-none"
          />
          <button
            onClick={agregarLibre}
            className="rounded-xl bg-cian px-5 py-2 font-semibold text-ground transition-all hover:brightness-110 active:scale-95">
            Agregar
          </button>
          {/* Mismos colores que los puntos de dificultad en Noticias, en tonalidad
              baja: azul fácil, morado medio, rojo difícil. */}
          <div className="flex items-center gap-2 border-l border-vidrio-borde pl-3">
            {([
              { id: 'FACIL', etiqueta: 'Fácil', color: '#0048FF' },
              { id: 'MEDIO', etiqueta: 'Medio', color: '#BF81FF' },
              { id: 'DIFICIL', etiqueta: 'Difícil', color: '#FF0004' },
            ] as const).map((nivel) => {
              const activo = dificultad === nivel.id;
              return (
                <button
                  key={nivel.id}
                  onClick={() => setDificultad(nivel.id)}
                  aria-pressed={activo}
                  title={nivel.etiqueta}
                  style={activo ? { background: `${nivel.color}33`, borderColor: nivel.color } : undefined}
                  className={`rounded-lg border-2 px-3 py-2 text-xs font-bold transition-all ${
                    activo ? 'text-white' : 'border-vidrio-borde bg-vidrio text-gris-texto hover:border-white/25'
                  }`}>
                  {nivel.etiqueta}
                </button>
              );
            })}
          </div>
        </div>

        {seleccionados.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {seleccionados.map((s) => (
              <span key={s}
                className="flex items-center gap-1 rounded-full border border-cian/40 bg-cian/10 px-3 py-1 font-mono text-sm font-bold text-cian">
                {s}
                <button onClick={() => toggleChip(s)} className="text-cian/70 transition-colors hover:text-cian">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Chips de debilidades propias */}
      {cargandoDebilidades ? (
        <Spinner texto="Cargando tus debilidades..." />
      ) : hayDebilidades ? (
        <div className="rounded-2xl border border-vidrio-borde bg-vidrio p-6 backdrop-blur-sm"
          style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
          <h2 className="mb-4 text-lg font-bold text-white">O selecciona de tus puntos débiles</h2>
          <div className="flex flex-col gap-4">
            {teclas.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {teclas.map((t) => chip(t.secuencia.toLowerCase(), t.porcentajeError))}
              </div>
            )}
            {bigramas.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {bigramas.map((b) => chip(b.secuencia, b.porcentajeError))}
              </div>
            )}
            {trigramas.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {trigramas.map((t) => chip(t.secuencia, t.porcentajeError))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-medio/30 bg-medio/10 p-6 text-center">
          <span className="material-symbols-outlined mb-2 block text-4xl text-medio">info</span>
          <p className="font-semibold text-white">Todavía no tienes debilidades detectadas.</p>
          <p className="mt-1 text-sm text-gris-texto">Escribe un ngram o letra arriba para empezar.</p>
        </div>
      )}

      {error && <p className="text-center text-sm font-semibold text-dificil">{error}</p>}

      <div className="flex justify-center pb-8">
        <button
          onClick={handleGenerar}
          disabled={generando}
          className="flex items-center gap-3 rounded-full bg-cian px-10 py-5 text-lg font-bold text-ground transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            {generando ? 'hourglass_empty' : 'text_fields'}
          </span>
          {generando ? 'Buscando palabras...' : 'Practicar con estas palabras'}
        </button>
      </div>
    </div>
  );
};

export default PalabrasSelectorView;
