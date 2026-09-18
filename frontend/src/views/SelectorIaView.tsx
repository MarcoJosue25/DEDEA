import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { generarTextoIA } from '../api/iaApi';
import RellenoPalabras from '../components/practica/RellenoPalabras';
import SelectorApariencia from '../components/ui/SelectorApariencia';
import { useApariencia } from '../core/apariencia/useApariencia';
import type { TextoIaResponse } from '../types';

interface ItemSeleccionable {
  secuencia: string;
  porcentajeError: number;
  seleccionado: boolean;
}

const NIVELES = [
  { id: 'FACIL',   etiqueta: 'Fácil',   claro: 'bg-emerald-500 border-emerald-500', color: '#0048FF' },
  { id: 'MEDIO',   etiqueta: 'Medio',   claro: 'bg-sky-500 border-sky-500',         color: '#BF81FF' },
  { id: 'DIFICIL', etiqueta: 'Difícil', claro: 'bg-rose-500 border-rose-500',       color: '#FF0004' },
] as const;

/* Grupo de fichas seleccionables (teclas, bigramas o trigramas).
   Antes los tres bloques estaban copiados casi idénticos; unificarlos evita que
   se desincronicen al tener que mantener además dos apariencias. */
const GrupoChips = ({
  titulo, items, onToggle, esOscuro, mayusculas,
}: {
  titulo: string;
  items: ItemSeleccionable[];
  onToggle: (i: number) => void;
  esOscuro: boolean;
  mayusculas?: boolean;
}) => {
  if (items.length === 0) return null;
  const elegidos = items.filter((i) => i.seleccionado).length;

  return (
    <div className={esOscuro
      ? 'rounded-2xl border border-(--sup-borde) bg-(--sup) p-6'
      : 'rounded-2xl border border-slate-200 bg-white p-6'}
      style={esOscuro ? undefined : { boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>

      <div className="mb-4 flex items-center justify-between">
        <h2 className={`text-lg font-bold ${esOscuro ? 'text-white' : 'text-slate-800'}`}>{titulo}</h2>
        <span className={`text-xs ${esOscuro ? 'text-gris-texto' : 'text-slate-400'}`}>
          {elegidos}/{items.length} seleccionadas
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        {items.map((it, i) => (
          <button
            key={it.secuencia}
            onClick={() => onToggle(i)}
            aria-pressed={it.seleccionado}
            className={`flex flex-col items-center rounded-xl border-2 px-4 py-3 transition-all ${
              esOscuro
                ? (it.seleccionado
                    ? 'border-cian bg-cian/10 text-cian'
                    : 'border-white/8 bg-carta text-gris-texto hover:border-white/20')
                : (it.seleccionado
                    ? 'border-rose-400 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-slate-50 text-slate-400')
            }`}>
            <span className="font-mono text-xl font-bold">
              {mayusculas ? it.secuencia.toUpperCase() : it.secuencia}
            </span>
            <span className="mt-1 text-xs">{it.porcentajeError}% error</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const SelectorIaView = () => {
  const navigate = useNavigate();
  const { apariencia } = useApariencia();
  const esOscuro = apariencia === 'oscuro';

  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dificultad, setDificultad] = useState<'FACIL' | 'MEDIO' | 'DIFICIL'>('MEDIO');
  const [esperandoEnter, setEsperandoEnter] = useState(false);
  const huboProgresoRelleno = useRef(false);
  const textoListoRef = useRef<{
    textoIA: TextoIaResponse;
    config: { teclas: string[]; bigramas: string[]; trigramas: string[] };
  } | null>(null);

  /* Las debilidades vienen del histórico GLOBAL (las deja GlobalStatsView o
     ResultadosView en sessionStorage), no de la última sesión: una sesión suelta
     aporta dos o tres errores, muestra demasiado chica para deducir una debilidad. */
  const cargarItems = (key: string): ItemSeleccionable[] => {
    try {
      const stored = sessionStorage.getItem(key);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return parsed.map((item: { secuencia: string; porcentajeError: number }) => ({
        ...item,
        seleccionado: false, // Por defecto todos deseleccionados
      }));
    } catch {
      return [];
    }
  };

  const [teclas, setTeclas] = useState<ItemSeleccionable[]>(() => cargarItems('debilidades_teclas'));
  const [bigramas, setBigramas] = useState<ItemSeleccionable[]>(() => cargarItems('debilidades_bigramas'));
  const [trigramas, setTrigramas] = useState<ItemSeleccionable[]>(() => cargarItems('debilidades_trigramas'));

  const alternar = (
    set: React.Dispatch<React.SetStateAction<ItemSeleccionable[]>>,
  ) => (idx: number) => {
    set((prev) => prev.map((t, i) => (i === idx ? { ...t, seleccionado: !t.seleccionado } : t)));
  };

  // Derivados a nivel de componente: los necesita tanto handleGenerar como el relleno
  // (para pedir palabras de los mismos ngrams mientras se espera a Gemini).
  const teclasSeleccionadas = teclas
    .filter((t) => t.seleccionado && t.secuencia && t.secuencia.trim().length > 0)
    .map((t) => t.secuencia);

  const bigramasSeleccionados = bigramas
    .filter((b) => b.seleccionado && b.secuencia && b.secuencia.trim().length > 0)
    .map((b) => b.secuencia);

  const trigramasSeleccionados = trigramas
    .filter((t) => t.seleccionado && t.secuencia && t.secuencia.trim().length > 0)
    .map((t) => t.secuencia);

  const ngramsSeleccionados = [...bigramasSeleccionados, ...trigramasSeleccionados];

  const handleGenerar = async () => {
    if (teclasSeleccionadas.length === 0 && ngramsSeleccionados.length === 0) {
      setError('Selecciona al menos una tecla o combinación para practicar.');
      return;
    }

    setGenerando(true);
    setError(null);
    huboProgresoRelleno.current = false;

    const config = {
      teclas: teclasSeleccionadas,
      bigramas: bigramasSeleccionados,
      trigramas: trigramasSeleccionados,
    };

    try {
      const textoIA = await generarTextoIA({
        dificultad,
        ngramsDebiles: ngramsSeleccionados,
        teclasDebiles: teclasSeleccionadas,
      });

      if (huboProgresoRelleno.current) {
        // El usuario estaba practicando el relleno: no lo cortamos de golpe.
        // Dejamos el ejercicio listo y esperamos a que él presione Enter.
        textoListoRef.current = { textoIA, config };
        setEsperandoEnter(true);
        setGenerando(false);
      } else {
        // No tocó el relleno (o no alcanzó a aparecer): salta directo, como antes.
        guardarYNavegar(textoIA, config);
      }
    } catch (err) {
      /* 429 = se acabó el límite de intentos diarios (ver GlobalExceptionHandler):
         reintentar ahora no sirve de nada hasta que se renueve, así que acá NO se
         muestra el genérico de abajo ("Intenta de nuevo"), que en este caso concreto
         sería mala información. El mensaje tampoco menciona de qué depende el límite
         por dentro — eso es un detalle de implementación, no algo que el usuario
         necesite saber. */
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        setError('Alcanzaste el límite de intentos diarios. Inténtalo de nuevo mañana.');
      } else {
        setError('No se pudo generar el texto. Intenta de nuevo.');
      }
      console.error(err);
      setGenerando(false);
    }
  };

  const guardarYNavegar = (
    textoIA: TextoIaResponse,
    config: { teclas: string[]; bigramas: string[]; trigramas: string[] },
  ) => {
    sessionStorage.setItem('practica_ia_config', JSON.stringify(config));
    sessionStorage.setItem('texto_ia_seleccionado', JSON.stringify(textoIA));
    sessionStorage.removeItem('noticia_seleccionada');
    // Sin esto, un ejercicio de palabras abandonado a medias secuestra la práctica:
    // PracticaView revisa texto_palabras_seleccionado antes que el texto de IA.
    sessionStorage.removeItem('texto_palabras_seleccionado');
    navigate('/practica');
  };

  // Mientras esperamos el Enter del usuario, el relleno sigue visible e interactivo.
  useEffect(() => {
    if (!esperandoEnter) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && textoListoRef.current) {
        guardarYNavegar(textoListoRef.current.textoIA, textoListoRef.current.config);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esperandoEnter]);

  const hayDatos = teclas.length > 0 || bigramas.length > 0 || trigramas.length > 0;

  return (
    <div
      data-apariencia={esOscuro ? 'oscuro' : undefined}
      className="mx-auto flex max-w-3xl flex-col gap-6">

      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <button
            onClick={() => navigate(-1)}
            className={`mb-4 flex items-center gap-2 text-sm font-semibold transition-colors ${
              esOscuro ? 'text-gris-texto hover:text-cian' : 'text-slate-400 hover:text-slate-700'
            }`}>
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Volver
          </button>
          <h1 className={`mb-2 text-4xl font-bold ${esOscuro ? 'text-white' : 'text-slate-800'}`}>
            Práctica personalizada
          </h1>
          <p className={`text-lg ${esOscuro ? 'text-gris-texto' : 'text-slate-400'}`}>
            Selecciona las teclas y combinaciones que quieres practicar.
            Gemini generará un texto diseñado para ellas.
          </p>
        </div>
        <SelectorApariencia />
      </header>

      {!hayDatos && (
        <div className={esOscuro
          ? 'rounded-2xl border border-medio/30 bg-medio/10 p-6 text-center'
          : 'rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center'}>
          <span className={`material-symbols-outlined mb-2 block text-4xl ${esOscuro ? 'text-medio' : 'text-amber-400'}`}>info</span>
          <p className={`font-semibold ${esOscuro ? 'text-white' : 'text-amber-700'}`}>
            No hay datos de debilidades todavía.
          </p>
          <p className={`mt-1 text-sm ${esOscuro ? 'text-gris-texto' : 'text-amber-600'}`}>
            Completa al menos 3 sesiones de práctica para que el sistema detecte tus puntos débiles.
          </p>
        </div>
      )}

      {hayDatos && (
        <>
          {/* Selector de dificultad */}
          <div className={esOscuro
            ? 'rounded-2xl border border-(--sup-borde) bg-(--sup) p-6'
            : 'rounded-2xl border border-slate-200 bg-white p-6'}
            style={esOscuro ? undefined : { boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
            <h2 className={`mb-4 text-lg font-bold ${esOscuro ? 'text-white' : 'text-slate-800'}`}>
              Nivel de dificultad
            </h2>
            <div className="flex gap-3">
              {NIVELES.map((nivel) => {
                const activo = dificultad === nivel.id;
                return (
                  <button
                    key={nivel.id}
                    onClick={() => setDificultad(nivel.id)}
                    aria-pressed={activo}
                    /* En oscuro el nivel elegido usa el mismo color que su punto en
                       Noticias, en tonalidad baja — igual que la insignia de Resultados. */
                    style={activo && esOscuro
                      ? { background: `${nivel.color}33`, borderColor: nivel.color, color: '#FFFFFF' }
                      : undefined}
                    className={`flex-1 rounded-xl border-2 py-3 text-sm font-bold transition-all ${
                      esOscuro
                        ? (activo ? '' : 'border-white/8 bg-carta text-gris-texto hover:border-white/20')
                        : (activo ? `${nivel.claro} text-white` : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300')
                    }`}>
                    {nivel.etiqueta}
                  </button>
                );
              })}
            </div>
          </div>

          <GrupoChips titulo="Teclas difíciles"    items={teclas}    onToggle={alternar(setTeclas)}    esOscuro={esOscuro} mayusculas />
          <GrupoChips titulo="Bigramas difíciles"  items={bigramas}  onToggle={alternar(setBigramas)}  esOscuro={esOscuro} />
          <GrupoChips titulo="Trigramas difíciles" items={trigramas} onToggle={alternar(setTrigramas)} esOscuro={esOscuro} />

          {error && (
            <p className={`text-center text-sm font-semibold ${esOscuro ? 'text-dificil' : 'text-rose-500'}`}>
              {error}
            </p>
          )}

          {/* Relleno mientras Gemini genera el texto (o mientras esperamos el Enter) */}
          {(generando || esperandoEnter) && (
            <RellenoPalabras
              ngrams={ngramsSeleccionados.length > 0 ? ngramsSeleccionados : teclasSeleccionadas}
              dificultad={dificultad}
              onProgreso={() => { huboProgresoRelleno.current = true; }}
            />
          )}

          {esperandoEnter && (
            <p className={`animate-pulse text-center text-sm font-bold ${esOscuro ? 'text-cian' : 'text-emerald-600'}`}>
              Tu ejercicio personalizado ya está listo. Presiona Enter para empezar.
            </p>
          )}

          <div className="flex justify-center pb-8">
            <button
              onClick={handleGenerar}
              disabled={generando || esperandoEnter}
              className={`flex items-center gap-3 rounded-full px-10 py-5 text-lg font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                esOscuro
                  ? 'bg-cian text-ground hover:brightness-110'
                  : 'bg-emerald-500 text-white shadow-lg hover:-translate-y-1 hover:bg-emerald-600 hover:shadow-xl disabled:hover:translate-y-0'
              }`}>
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                {generando ? 'hourglass_empty' : 'auto_awesome'}
              </span>
              {generando
                ? 'Generando con Gemini...'
                : esperandoEnter ? 'Listo, presiona Enter' : 'Generar texto personalizado'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default SelectorIaView;
