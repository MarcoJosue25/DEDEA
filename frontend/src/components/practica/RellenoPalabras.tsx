import { useCallback, useEffect, useRef, useState } from 'react';
import { generarTextoDePalabras } from '../../api/diccionarioApi';

interface RellenoPalabrasProps {
  ngrams: string[];
  dificultad: 'FACIL' | 'MEDIO' | 'DIFICIL';
  onProgreso: () => void;
}

// Mini ejercicio de tipeo completamente aparte del motor de PracticaView: no guarda sesión,
// no registra ngrams/teclas ni estadísticas. Solo existe para que el usuario no se aburra
// mientras Gemini genera su texto personalizado (8-10s). Cuando termina las palabras
// mostradas, pide otra tanda automáticamente y sigue.
const RellenoPalabras = ({ ngrams, dificultad, onProgreso }: RellenoPalabrasProps) => {
  const [texto, setTexto] = useState('');
  const [indice, setIndice] = useState(0);
  const [errores, setErrores] = useState<Set<number>>(new Set());
  const [cargando, setCargando] = useState(true);
  const yaAvisoProgreso = useRef(false);
  const indiceRef = useRef(0);
  const textoRef = useRef('');

  const pedirTanda = useCallback(async () => {
    setCargando(true);
    const nuevoTexto = await generarTextoDePalabras(ngrams, dificultad, 24).catch(() => '');
    setTexto(nuevoTexto);
    textoRef.current = nuevoTexto;
    setIndice(0);
    indiceRef.current = 0;
    setErrores(new Set());
    setCargando(false);
  }, [ngrams, dificultad]);

  /* Este es el caso legitimo de la excepcion, no de refactor. La regla existe para evitar
     renders en cascada, y las tres salidas preferidas de la seccion 8 no aplican acá:

     - Inicializacion perezosa: no sirve, el valor viene de una peticion asincrona.
     - Tri-estado: tampoco, el problema no es el booleano de carga sino que hay cinco
       setState y uno de ellos depende de la respuesta del servidor.
     - Colgarse de un evento: NO HAY. El relleno arranca solo, al montarse, mientras Gemini
       genera el ejercicio; no existe ningun clic ni tecla que dispare la primera tanda.

     Las siguientes tandas si salen de un evento (terminar las palabras mostradas). Solo la
     primera necesita esto. */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    pedirTanda();
  }, [pedirTanda]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ver la nota de e.repeat en CursoPracticaView.
    if (e.repeat) return;
    if (cargando || !textoRef.current) return;
    if (['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
    if (e.key === ' ') e.preventDefault();
    if (e.key === 'Dead' || e.key === 'Unidentified') return;
    if (e.key.length !== 1 && e.key !== ' ' && e.key !== 'Backspace') return;

    if (!yaAvisoProgreso.current) {
      yaAvisoProgreso.current = true;
      onProgreso();
    }

    const idx = indiceRef.current;

    if (e.key === 'Backspace') {
      if (idx > 0) {
        indiceRef.current = idx - 1;
        setIndice(idx - 1);
        setErrores((prev) => {
          const next = new Set(prev);
          next.delete(idx - 1);
          return next;
        });
      }
      return;
    }

    const esperada = textoRef.current[idx];
    if (e.key !== esperada) {
      setErrores((prev) => new Set(prev).add(idx));
    }

    const siguiente = idx + 1;
    indiceRef.current = siguiente;
    setIndice(siguiente);

    if (siguiente >= textoRef.current.length) {
      pedirTanda();
    }
  }, [cargando, onProgreso, pedirTanda]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const getColorCaracter = (i: number) => {
    if (i < indice) return errores.has(i) ? 'text-rose-400 bg-rose-50' : 'text-emerald-500';
    if (i === indice) return 'text-slate-700 border-b-2 border-emerald-400 cursor-blink';
    return 'text-slate-300';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6"
      style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
        Mientras esperas, practica esto
      </p>
      {texto ? (
        <div className="font-mono text-lg leading-relaxed tracking-wide select-none min-h-[60px]">
          {texto.split('').map((char, i) => (
            <span key={i} className={`${getColorCaracter(i)} transition-colors`}>{char}</span>
          ))}
        </div>
      ) : (
        <div className="min-h-[60px] flex items-center text-slate-300 text-sm">Cargando palabras...</div>
      )}
    </div>
  );
};

export default RellenoPalabras;
