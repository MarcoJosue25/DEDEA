import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SesionProgresoDTO, TeclaStatsRequest, NgramStatsRequest, ItemDebilidad } from '../types';
import { guardarSesion } from '../api/sesionApi';
import { obtenerDebilidades } from '../api/statsApi';
import { generarTextoDePalabras } from '../api/diccionarioApi';
import Spinner from '../components/ui/Spinner';
import Cronometro from '../components/practica/Cronometro';
import { useApariencia } from '../core/apariencia/useApariencia';
import { calcularDelta } from '../utils/ritmoTecleo';

const FILAS_TECLADO = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L','Ñ'],
  ['Z','X','C','V','B','N','M'],
];

const PALABRAS_POR_LINEA = 8;

// La búsqueda del diccionario en MySQL es insensible a tildes ("ira" también trae "irá"),
// así que el conteo del panel debe serlo igual o esas ocurrencias no sumarían nunca.
// La ñ NO se toca: es una letra distinta, no una n con tilde.
const quitarTildes = (s: string) =>
  s.replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ü/g, 'u');

interface StatsSeleccion {
  cantidad: number;
  correctas: number;
  falladas: number;
}

interface DatosPalabras {
  texto: string;
  ngrams: string[];
  dificultad: 'FACIL' | 'MEDIO' | 'DIFICIL';
}

// Vista dedicada de práctica con palabras del diccionario. Vive separada de PracticaView
// a propósito: el flujo es distinto (dos líneas rotativas en vez de un texto fijo, panel
// de stats en vivo, chips para cambiar la combinación sin salir, modo ilimitado) y así
// los modos noticia/IA no se acoplan con este.
const PracticaLibreView = () => {
  const navigate = useNavigate();
  const { apariencia } = useApariencia();
  const esOscuro = apariencia === 'oscuro';

  const [datos] = useState<DatosPalabras | null>(() => {
    try {
      const stored = sessionStorage.getItem('texto_palabras_seleccionado');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // --- Estado del motor de tipeo (opera SIEMPRE sobre la línea activa) ---
  const [lineas, setLineas] = useState<[string, string]>(['', '']);
  const [lineaActiva, setLineaActiva] = useState<0 | 1>(0);
  const [lineaNueva, setLineaNueva] = useState<[boolean, boolean]>([false, false]);
  const [indice, setIndice] = useState(0);
  const [errores, setErrores] = useState<Set<number>>(new Set());
  const [teclaPresionada, setTeclaPresionada] = useState('');
  const [teclaError, setTeclaError] = useState('');
  const [modoEstricto, setModoEstricto] = useState(false);
  const [ilimitada, setIlimitada] = useState(true);
  // En modo NO ilimitado la sesión son exactamente las dos líneas visibles:
  // acá marcamos cuál ya se tecleó para saber cuándo cortar.
  const [lineaConsumida, setLineaConsumida] = useState<[boolean, boolean]>([false, false]);
  const [segundos, setSegundos] = useState(0);
  const [tiempoMs, setTiempoMs] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const [terminado, setTerminado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [caracteresCorrectos, setCaracteresCorrectos] = useState(0);
  const [totalPresionadas, setTotalPresionadas] = useState(0);
  const [esperandoPalabras, setEsperandoPalabras] = useState(false);

  // --- Selección de ngrams y chips ---
  const [seleccion, setSeleccion] = useState<string[]>(() => datos?.ngrams ?? []);
  const [chips, setChips] = useState<string[]>([]);
  const [avisoCombinacion, setAvisoCombinacion] = useState(false);
  const [statsSel, setStatsSel] = useState<Record<string, StatsSeleccion>>({});
  // C. Total: ocurrencias de cada ngram en las líneas mostradas hasta ahora (crece con cada tanda)
  const [apariciones, setApariciones] = useState<Record<string, number>>({});

  // --- Refs espejo (el listener de teclado no puede depender de estado stale) ---
  const lineasRef = useRef<[string, string]>(['', '']);
  const lineaActivaRef = useRef<0 | 1>(0);
  const indiceRef = useRef(0);
  const colaRef = useRef<string[]>([]);
  const seleccionRef = useRef<string[]>(seleccion);
  const ilimitadaRef = useRef(true);
  const lineaConsumidaRef = useRef<[boolean, boolean]>([false, false]);
  const statsSelRef = useRef<Record<string, StatsSeleccion>>({});
  const aparicionesRef = useRef<Map<string, number>>(new Map());
  const modoEstrictoRef = useRef(false);
  const terminadoRef = useRef(false);
  const caracteresCorrectosRef = useRef(0);
  const totalPresionadasRef = useRef(0);
  const segundosRef = useRef(0);
  // Acumulador del cronómetro, en ref para no leerlo desde el updater de setTiempoMs.
  const tiempoMsRef = useRef(0);
  // Instante de la pulsacion anterior: de su diferencia sale el tiempo por tecla.
  const ultimoInstanteRef = useRef(0);
  const teclasMapRef = useRef<Map<string, TeclaStatsRequest>>(new Map());
  const ngramsMapRef = useRef<Map<string, NgramStatsRequest>>(new Map());
  const progresoRef = useRef<SesionProgresoDTO[]>([]);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => { seleccionRef.current = seleccion; }, [seleccion]);
  useEffect(() => { ilimitadaRef.current = ilimitada; }, [ilimitada]);
  useEffect(() => { modoEstrictoRef.current = modoEstricto; }, [modoEstricto]);
  useEffect(() => { terminadoRef.current = terminado; }, [terminado]);

  // Acumula cuántas veces aparece cada ngram seleccionado en el texto que se va mostrando.
  // Alimenta la columna "C. Total" del panel y el "X veces en el texto" del resumen final.
  // Insensible a tildes, igual que la búsqueda del diccionario.
  const contarApariciones = (texto: string) => {
    const bajo = quitarTildes(texto.toLowerCase());
    let cambio = false;
    for (const sel of seleccionRef.current) {
      const objetivo = quitarTildes(sel);
      let count = 0;
      let pos = bajo.indexOf(objetivo);
      while (pos !== -1) { count++; pos = bajo.indexOf(objetivo, pos + 1); }
      if (count > 0) {
        aparicionesRef.current.set(sel, (aparicionesRef.current.get(sel) || 0) + count);
        cambio = true;
      }
    }
    if (cambio) setApariciones(Object.fromEntries(aparicionesRef.current));
  };

  // --- Carga inicial: partir el texto del selector en líneas + cola ---
  useEffect(() => {
    if (!datos || !datos.texto) { navigate('/practica-palabras'); return; }
    const palabras = datos.texto.split(' ').filter(Boolean);
    const l0 = palabras.slice(0, PALABRAS_POR_LINEA).join(' ');
    const l1 = palabras.slice(PALABRAS_POR_LINEA, PALABRAS_POR_LINEA * 2).join(' ');
    colaRef.current = palabras.slice(PALABRAS_POR_LINEA * 2);
    lineasRef.current = [l0, l1];
    // Reset antes de contar: React StrictMode (solo en dev) corre este efecto dos veces,
    // y sin esto las apariciones iniciales quedaban duplicadas.
    aparicionesRef.current = new Map();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApariciones({});
    contarApariciones(l0);
    contarApariciones(l1);
     
    setLineas([l0, l1]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Chips: debilidades históricas + lo que ya venía seleccionado ---
  useEffect(() => {
    obtenerDebilidades()
      .then((res) => {
        const historicos = [
          ...(res.peoresTeclas ?? []),
          ...(res.peoresBigramas ?? []),
          ...(res.peoresTrigramas ?? []),
        ].map((i: ItemDebilidad) => i.secuencia.toLowerCase());
         
        setChips(Array.from(new Set([...(datos?.ngrams ?? []), ...historicos])));
      })
      .catch(() => setChips(datos?.ngrams ?? []));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Cronómetro + progreso por segundo ---
  // Corre cada 100ms para que los milisegundos se vean fluidos; el progreso (para el
  // gráfico) solo se registra al cruzar cada segundo entero, igual que antes.
  useEffect(() => {
    if (!corriendo || terminado) return;
    const intervalo = setInterval(() => {
      /* El acumulador vive en un ref y el cruce de segundo se resuelve acá, NO dentro del
         updater de setTiempoMs. Un updater tiene que ser puro, y este empujaba a
         progresoRef: React 18 en modo estricto invoca los updaters dos veces justo para
         destapar esa clase de efecto colateral, así que cada segundo se guardaba
         duplicado. */
      const msPrev = tiempoMsRef.current;
      const nuevoMs = msPrev + 100;
      tiempoMsRef.current = nuevoMs;

      const segundoAnterior = Math.floor(msPrev / 1000);
      const nuevoSegundo = Math.floor(nuevoMs / 1000);

      if (nuevoSegundo !== segundoAnterior) {
        segundosRef.current = nuevoSegundo;
        setSegundos(nuevoSegundo);
        progresoRef.current.push({
          segundo: nuevoSegundo,
          wpmMomento: Math.round((caracteresCorrectosRef.current / 5) / (nuevoSegundo / 60)),
          precisionMomento: totalPresionadasRef.current > 0
            ? Number(((caracteresCorrectosRef.current / totalPresionadasRef.current) * 100).toFixed(2))
            : 100,
        });
      }

      setTiempoMs(nuevoMs);
    }, 100);
    return () => clearInterval(intervalo);
  }, [corriendo, terminado]);

  // --- Registro para el payload del backend (idéntico a PracticaView) ---
  const registrarTecla = (tecla: string, correcta: boolean, deltaMs: number) => {
    if (!tecla) return;
    const limpia = tecla.length === 1 ? tecla.toLowerCase() : tecla.toLowerCase().slice(0, 20);
    const existing = teclasMapRef.current.get(limpia) || {
      tecla: limpia, vecesPresionada: 0, vecesCorrecta: 0, vecesError: 0, tiempoTotalMs: 0,
    };
    teclasMapRef.current.set(limpia, {
      ...existing,
      vecesPresionada: existing.vecesPresionada + 1,
      vecesCorrecta: correcta ? existing.vecesCorrecta + 1 : existing.vecesCorrecta,
      vecesError: !correcta ? existing.vecesError + 1 : existing.vecesError,
      tiempoTotalMs: existing.tiempoTotalMs + deltaMs,
    });
  };

  const registrarNgram = (secuencia: string, tipo: 'BIGRAMA' | 'TRIGRAMA', error: boolean) => {
    const existing = ngramsMapRef.current.get(secuencia) || {
      secuencia, tipo, totalIntentos: 0, errores: 0, tiempoTotalMs: 0,
    };
    ngramsMapRef.current.set(secuencia, {
      ...existing,
      totalIntentos: existing.totalIntentos + 1,
      errores: error ? existing.errores + 1 : existing.errores,
    });
  };

  // Panel lateral: una ocurrencia de un ngram seleccionado "se intenta" cuando tecleas
  // su última letra. Correcta o fallada según esa pulsación (misma convención que
  // usa el registro de bigramas/trigramas del backend).
  const registrarSeleccionados = (texto: string, i: number, esCorrecta: boolean) => {
    const completados = seleccionRef.current.filter((sel) => {
      const L = sel.length;
      return i - L + 1 >= 0
        && quitarTildes(texto.slice(i - L + 1, i + 1).toLowerCase()) === quitarTildes(sel);
    });
    if (completados.length === 0) return;
    setStatsSel((prev) => {
      const next = { ...prev };
      for (const sel of completados) {
        const st = next[sel] || { cantidad: 0, correctas: 0, falladas: 0 };
        next[sel] = {
          cantidad: st.cantidad + 1,
          correctas: esCorrecta ? st.correctas + 1 : st.correctas,
          falladas: !esCorrecta ? st.falladas + 1 : st.falladas,
        };
      }
      statsSelRef.current = next; // espejo para leer al guardar sin depender del ciclo de render
      return next;
    });
  };

  const marcarConsumida = (idx: 0 | 1, valor: boolean) => {
    lineaConsumidaRef.current[idx] = valor;
    setLineaConsumida([...lineaConsumidaRef.current] as [boolean, boolean]);
  };

  // --- Rellenar una línea con contenido fresco (solo se usa en modo ilimitado) ---
  const rellenarLinea = useCallback((idx: 0 | 1) => {
    marcarConsumida(idx, false);
    if (colaRef.current.length > 0) {
      const words = colaRef.current.splice(0, PALABRAS_POR_LINEA);
      lineasRef.current[idx] = words.join(' ');
      contarApariciones(lineasRef.current[idx]);
      setLineas([...lineasRef.current] as [string, string]);
      setLineaNueva((prev) => { const n: [boolean, boolean] = [...prev]; n[idx] = false; return n; });
      return;
    }
    lineasRef.current[idx] = '';
    setLineas([...lineasRef.current] as [string, string]);
    generarTextoDePalabras(seleccionRef.current, datos?.dificultad ?? 'MEDIO', PALABRAS_POR_LINEA * 3)
      .then((texto) => {
        const words = texto.split(' ').filter(Boolean);
        lineasRef.current[idx] = words.slice(0, PALABRAS_POR_LINEA).join(' ');
        colaRef.current.push(...words.slice(PALABRAS_POR_LINEA));
        contarApariciones(lineasRef.current[idx]);
        setLineas([...lineasRef.current] as [string, string]);
        setEsperandoPalabras(false);
      })
      .catch(() => setEsperandoPalabras(false));
  }, [datos]);  

  const finalizarSesion = useCallback(() => {
    if (terminadoRef.current) return;
    terminadoRef.current = true;
    setTerminado(true);
    setCorriendo(false);
  }, []);

  // --- Motor de tipeo sobre la línea activa ---
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ver la nota de e.repeat en CursoPracticaView: mantener una tecla es UNA pulsación.
    if (e.repeat) return;
    if (terminadoRef.current || guardando) return;
    /* AltGraph incluida: pulsar AltGr sola es apoyar un modificador, no teclear. El
       carácter que produce combinada (@ # \ | [ ] { } € en teclado español) sí cuenta —
       ver el guard de atajos, dos líneas más abajo. */
    if (['Shift', 'Control', 'Alt', 'AltGraph', 'Meta'].includes(e.key)) return;
    /* Solo el espacio se anula: es un carácter del texto, y sin esto la página baja de
       golpe. Las flechas se dejan pasar a propósito — son las que desplazan la pantalla
       mientras se practica. */
    if (e.key === ' ') e.preventDefault();
    if (e.key === 'Dead' || e.key === 'Unidentified' || e.key === 'Enter') return;
    /* Los atajos del navegador no son tipeo. AltGr exceptuado: en Windows dispara
       ctrlKey+altKey, y sin la excepción cada @ o # se descartaría como si fuera Ctrl+C. */
    if (!e.getModifierState('AltGraph') && (e.ctrlKey || e.metaKey || e.altKey)) return;

    const textoLinea = lineasRef.current[lineaActivaRef.current];
    if (!textoLinea) return; // esperando que llegue la siguiente tanda

    if (!corriendo) setCorriendo(true);

    const i = indiceRef.current;

    if (e.key === 'Backspace') {
      if (i > 0) {
        indiceRef.current = i - 1;
        setIndice(i - 1);
        setErrores((prev) => { const n = new Set(prev); n.delete(i - 1); return n; });
      }
      return;
    }
    /* Tab y Enter SÍ cuentan como fallo: están pegados a la Q y a la Ñ, así que pulsarlas
       es un error de mecanografía real. Las flechas, F1-F12 y demás teclas de navegación
       no producen carácter y se ignoran sin ensuciar la precisión. */
    if (e.key.length !== 1 && e.key !== 'Tab' && e.key !== 'Enter') return;
    if (e.key === 'Tab' || e.key === 'Enter') e.preventDefault();

    setTotalPresionadas((t) => { totalPresionadasRef.current = t + 1; return t + 1; });
    setTeclaPresionada(e.key.toUpperCase());
    setTimeout(() => setTeclaPresionada(''), 100);

    const esperada = textoLinea[i];
    const esCorrecta = e.key === esperada;
    const ahoraMs = performance.now();
    const deltaMs = calcularDelta(ahoraMs, ultimoInstanteRef.current);
    ultimoInstanteRef.current = ahoraMs;

    // La tecla ESPERADA, no la pulsada: así el fallo se le atribuye a la letra que no
    // lograste, no a la que apretaste por error. (Ver la nota larga en PracticaView.)
    registrarTecla(esperada, esCorrecta, deltaMs);
    registrarSeleccionados(textoLinea, i, esCorrecta);

    if (i >= 1) {
      const bigrama = textoLinea.slice(i - 1, i + 1).toLowerCase();
      if (/^[a-záéíóúñü]{2}$/.test(bigrama)) registrarNgram(bigrama, 'BIGRAMA', !esCorrecta);
    }
    if (i >= 2) {
      const trigrama = textoLinea.slice(i - 2, i + 1).toLowerCase();
      if (/^[a-záéíóúñü]{3}$/.test(trigrama)) registrarNgram(trigrama, 'TRIGRAMA', !esCorrecta);
    }

    const avanzar = esCorrecta || !modoEstrictoRef.current;
    if (esCorrecta) {
      setCaracteresCorrectos((c) => { caracteresCorrectosRef.current = c + 1; return c + 1; });
    } else {
      setTeclaError(e.key.toUpperCase());
      setTimeout(() => setTeclaError(''), 150);
      if (avanzar) setErrores((prev) => new Set(prev).add(i));
    }
    if (!avanzar) return;

    const siguiente = i + 1;
    if (siguiente < textoLinea.length) {
      indiceRef.current = siguiente;
      setIndice(siguiente);
      return;
    }

    // --- Línea completada: rotamos ---
    const terminada = lineaActivaRef.current;
    const otra = (1 - terminada) as 0 | 1;

    if (!ilimitadaRef.current) {
      // Modo normal: la sesión son exactamente las dos líneas visibles.
      marcarConsumida(terminada, true);
      if (lineaConsumidaRef.current[otra] || !lineasRef.current[otra]) {
        finalizarSesion();
        return;
      }
      // Pasamos a la otra línea SIN rellenar la terminada (queda visible, atenuada).
      lineaActivaRef.current = otra;
      setLineaActiva(otra);
      indiceRef.current = 0;
      setIndice(0);
      setErrores(new Set());
      setLineaNueva((prev) => { const n: [boolean, boolean] = [...prev]; n[otra] = false; return n; });
      setAvisoCombinacion(false);
      return;
    }

    if (!lineasRef.current[otra]) setEsperandoPalabras(true);

    lineaActivaRef.current = otra;
    setLineaActiva(otra);
    indiceRef.current = 0;
    setIndice(0);
    setErrores(new Set());
    setLineaNueva((prev) => { const n: [boolean, boolean] = [...prev]; n[otra] = false; return n; });
    setAvisoCombinacion(false);
    rellenarLinea(terminada);
  }, [corriendo, guardando, rellenarLinea, finalizarSesion]);

  // Si el usuario enciende "ilimitada" a mitad de sesión y la otra línea ya estaba
  // consumida (modo normal la dejó sin rellenar), la reactivamos con contenido fresco.
  useEffect(() => {
    if (!ilimitada) return;
    const otra = (1 - lineaActivaRef.current) as 0 | 1;
    if (lineaConsumidaRef.current[otra] || !lineasRef.current[otra]) {
      rellenarLinea(otra);
    }
  }, [ilimitada, rellenarLinea]);

  useEffect(() => {
    // `preventScroll`: ver la nota igual en CursoPracticaView — sin esto, cada vez que
    // `handleKeyDown` cambia de referencia (típicamente al escribir la primera tecla) el
    // navegador saltaba el scroll hasta acá, arrancándole al usuario la posición desde
    // la que estaba mirando.
    contenedorRef.current?.focus({ preventScroll: true });
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // --- Chips: cambiar la combinación sin salir ---
  const toggleChip = (sec: string) => {
    const nueva = seleccion.includes(sec)
      ? seleccion.filter((s) => s !== sec)
      : [...seleccion, sec];
    if (nueva.length === 0) return; // siempre debe quedar al menos uno
    setSeleccion(nueva);
    seleccionRef.current = nueva;
    colaRef.current = []; // lo encolado era de la combinación anterior

    generarTextoDePalabras(nueva, datos?.dificultad ?? 'MEDIO', PALABRAS_POR_LINEA * 3)
      .then((texto) => {
        const words = texto.split(' ').filter(Boolean);
        if (words.length === 0) return;
        const otra = (1 - lineaActivaRef.current) as 0 | 1;
        lineasRef.current[otra] = words.slice(0, PALABRAS_POR_LINEA).join(' ');
        colaRef.current = words.slice(PALABRAS_POR_LINEA);
        contarApariciones(lineasRef.current[otra]);
        marcarConsumida(otra, false); // la línea reemplazada vuelve a estar pendiente
        setLineas([...lineasRef.current] as [string, string]);
        setLineaNueva((prev) => {
          const n: [boolean, boolean] = [...prev];
          n[otra] = true;
          return n;
        });
        setAvisoCombinacion(true);
      })
      /* Si falla, la línea sigue con las palabras de antes: mejor que cortar la práctica.
         Pero que quede rastro, o el día que pase no hay de dónde tirar. */
      .catch((error) => console.warn('No se pudo traer la tanda nueva de palabras:', error));
  };

  // --- Guardado (una sola sesión acumulada) ---
  useEffect(() => {
    if (!terminado || !datos) return;

    const wpmFinal = segundosRef.current > 0
      ? Math.round((caracteresCorrectosRef.current / 5) / (segundosRef.current / 60))
      : 0;
    const precisionFinal = totalPresionadasRef.current > 0
      ? Number(((caracteresCorrectosRef.current / totalPresionadasRef.current) * 100).toFixed(2))
      : 100;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGuardando(true);

    const finalizar = () => {
      const teclasList = Array.from(teclasMapRef.current.values());
      const ngramsList = Array.from(ngramsMapRef.current.values());

      // Desglose por elemento practicado, igual que en los ejercicios personalizados:
      // letras sueltas van a "Teclas practicadas", ngrams de 2+ a "Combinaciones".
      const desgloseTeclas: { tecla: string; intentos: number; errores: number; aciertos: number }[] = [];
      const desgloseNgrams: { secuencia: string; tipo: string; intentos: number; errores: number; aciertos: number; aparicionesEnTexto: number }[] = [];
      for (const sel of seleccionRef.current) {
        const st = statsSelRef.current[sel] || { cantidad: 0, correctas: 0, falladas: 0 };
        if (sel.length === 1) {
          desgloseTeclas.push({ tecla: sel, intentos: st.cantidad, errores: st.falladas, aciertos: st.correctas });
        } else {
          desgloseNgrams.push({
            secuencia: sel,
            tipo: sel.length === 2 ? 'BIGRAMA' : 'TRIGRAMA',
            intentos: st.cantidad,
            errores: st.falladas,
            aciertos: st.correctas,
            aparicionesEnTexto: aparicionesRef.current.get(sel) || 0,
          });
        }
      }

      sessionStorage.setItem('sesion_resultado', JSON.stringify({
        wpm: wpmFinal,
        precision: precisionFinal,
        segundos: Math.max(1, segundosRef.current),
        // Sin estos dos, la tarjeta "Letras" salía vacía y el tiempo no podía
        // mostrar centésimas. No viajan al backend, son solo para Resultados.
        tiempoMs,
        caracteres: caracteresCorrectosRef.current,
        dificultad: datos.dificultad,
        progreso: progresoRef.current.filter((p) => p.segundo >= 1),
        peoresTeclas: teclasList
          .filter(t => t.vecesError > 0)
          .sort((a, b) => b.vecesError - a.vecesError)
          .slice(0, 3)
          .map(t => ({
            secuencia: t.tecla,
            porcentajeError: t.vecesPresionada > 0 ? Math.round((t.vecesError / t.vecesPresionada) * 100) : 0,
          })),
        peoresBigramas: ngramsList
          .filter(n => n.errores > 0 && n.tipo === 'BIGRAMA')
          .sort((a, b) => b.errores - a.errores)
          .slice(0, 3)
          .map(n => ({
            secuencia: n.secuencia,
            porcentajeError: n.totalIntentos > 0 ? Math.round((n.errores / n.totalIntentos) * 100) : 0,
          })),
        esIA: false,
        esPalabras: true,
        desgloseTeclas,
        desgloseNgrams,
      }));
      sessionStorage.setItem('origen_practica', 'palabras');
      sessionStorage.removeItem('texto_palabras_seleccionado');
      navigate('/resultados');
    };

    guardarSesion({
      wpm: wpmFinal,
      precision: precisionFinal,
      segundos: Math.max(1, segundosRef.current),
      modoUsado: 'LIBRE',
      dificultad: datos.dificultad,
      // El backend valida cada punto con @Min(1): uno solo en 0 tumba la sesión entera.
      progreso: progresoRef.current.filter((p) => p.segundo >= 1),
      teclas: Array.from(teclasMapRef.current.values()),
      ngrams: Array.from(ngramsMapRef.current.values()),
    })
      .then(finalizar)
      .catch((err) => { console.error('Error guardando sesión:', err); finalizar(); })
      .finally(() => setGuardando(false));
  }, [terminado]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Render helpers ---
  const wpm = segundos > 0 ? Math.round((caracteresCorrectos / 5) / (segundos / 60)) : 0;
  const precision = totalPresionadas > 0 ? Math.round((caracteresCorrectos / totalPresionadas) * 100) : 100;

  const getColorCaracter = (i: number) => {
    if (esOscuro) {
      if (i < indice) return errores.has(i) ? 'text-dificil' : 'text-cian';
      if (i === indice) return 'text-white border-b-2 border-cian cursor-blink';
      return 'text-faint';
    }
    if (i < indice) return errores.has(i) ? 'text-rose-500 bg-rose-50' : 'text-emerald-600';
    if (i === indice) return 'text-slate-800 border-b-2 border-emerald-500 cursor-blink';
    return 'text-slate-400';
  };

  /* En oscuro el teclado resalta la tecla que TOCA pulsar (sale de la línea activa),
     igual que en la práctica de noticias; en claro se conserva el resalte de la
     tecla pulsada que tenía siempre. */
  const teclaEsperada = (lineas[lineaActiva]?.[indice] ?? '').toUpperCase();

  const getColorTecla = (tecla: string) => {
    if (esOscuro) {
      if (tecla === teclaError) return 'border-dificil bg-dificil/15 text-dificil';
      if (tecla && tecla === teclaEsperada) return 'border-cian bg-cian/15 text-cian';
      return 'border-white/7 bg-carta text-gris-texto';
    }
    if (tecla === teclaError) return 'bg-rose-400 text-white border-rose-500';
    if (tecla === teclaPresionada) return 'bg-emerald-500 text-white border-emerald-600';
    return 'bg-white text-slate-700 border-slate-200';
  };

  if (!datos) return <Spinner texto="Cargando práctica..." />;

  return (
    <div
      ref={contenedorRef}
      tabIndex={0}
      data-apariencia={apariencia}
      className="flex flex-col gap-6 outline-none">

      {/* Barra de stats + selector de apariencia. PEGAJOSA bajo el navbar (top-20 ≈ su
          alto, 82px): ver la misma nota en CursoPracticaView — con un texto largo esta
          fila quedaba arriba del todo y scrollear para ver el teclado la sacaba de vista. */}
      <div className="sticky top-20 z-40 flex items-start gap-4 py-1 backdrop-blur-md">
        {esOscuro ? (
          <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: 'Velocidad',  valor: String(wpm),                 unidad: 'WPM',  stroke: '#00F1FD' },
              { label: 'Precisión',  valor: String(precision),           unidad: '%',    stroke: '#BF81FF' },
              { label: 'Letras',     valor: String(caracteresCorrectos), unidad: 'CHAR', stroke: '#96F8FF' },
            ].map((s) => (
              <div key={s.label}
                className="rounded-xl border border-(--sup-borde) bg-(--sup) px-4 py-3"
                style={{ borderLeft: `3px solid ${s.stroke}` }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--sup-tenue)">{s.label}</p>
                <p className="mt-1 text-(--sup-texto)">
                  <span className="text-3xl font-bold tabular-nums">{s.valor}</span>
                  <span className="ml-1 text-xs text-(--sup-tenue)">{s.unidad}</span>
                </p>
              </div>
            ))}
            <div className="rounded-xl border border-(--sup-borde) bg-(--sup) px-4 py-3"
              style={{ borderLeft: '3px solid #FFFFFF' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--sup-tenue)">Tiempo</p>
              <p className="mt-1">
                <Cronometro ms={tiempoMs} formatoCorto claseColor="text-(--sup-texto)" />
              </p>
            </div>
          </div>
        ) : (
          <div className="grid flex-1 grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-4"
            style={{ boxShadow: 'var(--sup-sombra)' }}>
            {[
              { icon: 'bolt', label: 'WPM', valor: wpm, color: 'text-emerald-500' },
              { icon: 'target', label: 'Precisión', valor: `${precision}%`, color: 'text-sky-500' },
              { icon: 'keyboard', label: 'Caracteres', valor: caracteresCorrectos, color: 'text-slate-500' },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1">
                <div className={`flex items-center gap-1 ${stat.color}`}>
                  <span className="material-symbols-outlined text-[20px]">{stat.icon}</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{stat.label}</span>
                </div>
                <span className="text-3xl font-bold text-slate-800">{stat.valor}</span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1 text-slate-500">
                <span className="material-symbols-outlined text-[20px]">schedule</span>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Tiempo</span>
              </div>
              <Cronometro ms={tiempoMs} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 items-start">

        {/* Panel lateral: stats por ngram + chips + terminar */}
        <div className="flex flex-col gap-4">

          <div className="rounded-2xl border border-(--sup-borde) bg-(--sup) p-4"
            style={{ boxShadow: 'var(--sup-sombra)' }}>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Tu selección</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-xs text-slate-400 font-semibold pb-1"></th>
                    {seleccion.map((s) => (
                      <th key={s} className="font-mono font-bold text-emerald-600 text-center px-2 pb-1">{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  <tr>
                    <td className="text-xs font-bold text-slate-500 pr-2 py-0.5">C. Total</td>
                    {seleccion.map((s) => (
                      <td key={s} className="text-center font-bold py-0.5 text-slate-400">
                        {apariciones[s] || 0}
                      </td>
                    ))}
                  </tr>
                  {([
                    ['Cantidad', (st: StatsSeleccion) => st.cantidad],
                    ['Correctas', (st: StatsSeleccion) => st.correctas],
                    ['Falladas', (st: StatsSeleccion) => st.falladas],
                  ] as const).map(([label, fn]) => (
                    <tr key={label}>
                      <td className="text-xs font-bold text-slate-500 pr-2 py-0.5">{label}</td>
                      {seleccion.map((s) => (
                        <td key={s} className="text-center font-bold py-0.5">
                          {fn(statsSel[s] || { cantidad: 0, correctas: 0, falladas: 0 })}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-(--sup-borde) bg-(--sup) p-4"
            style={{ boxShadow: 'var(--sup-sombra)' }}>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Ngrams más fallados</p>
            <div className="flex flex-wrap gap-2">
              {chips.length === 0 && (
                <p className="text-xs text-slate-400">Sin historial todavía.</p>
              )}
              {chips.map((sec) => {
                const activo = seleccion.includes(sec);
                return (
                  <button
                    key={sec}
                    onClick={() => toggleChip(sec)}
                    className={`px-3 py-1.5 rounded-lg font-mono font-bold text-sm border-2 transition-all active:scale-95 ${
                      activo
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-emerald-300'
                    }`}>
                    {sec}
                  </button>
                );
              })}
            </div>
            {avisoCombinacion && (
              <p className="flex items-center gap-1 text-xs font-bold text-emerald-600 mt-3">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Combinación aplicada
              </p>
            )}
          </div>

          <button
            onClick={finalizarSesion}
            disabled={terminado || totalPresionadas === 0}
            className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
            Terminar y guardar
          </button>
        </div>

        {/* Área de tipeo */}
        <div className="rounded-2xl border border-(--sup-borde) bg-(--sup) p-8 relative"
          style={{ boxShadow: 'var(--sup-sombra)' }}>

          <div className="absolute right-6 top-6 flex items-center gap-5">
            {[
              { etq: 'Práctica ilimitada', on: ilimitada,    set: () => setIlimitada((v) => !v) },
              { etq: 'Modo estricto',      on: modoEstricto, set: () => setModoEstricto((v) => !v) },
            ].map((t) => (
              <div key={t.etq} className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-(--sup-tenue)">{t.etq}</span>
                <button
                  onClick={t.set}
                  aria-pressed={t.on}
                  className={`relative block h-5 w-10 shrink-0 rounded-full transition-colors duration-200 ${
                    esOscuro
                      ? (t.on ? 'bg-cian/30' : 'bg-white/12')
                      : (t.on ? 'bg-emerald-500' : 'bg-slate-200')
                  }`}>
                  {/* left-0 explícito: sin inset la perilla se coloca en su posición
                      estática, que cae al final de la pastilla y se ve siempre a la derecha. */}
                  <span className={`absolute left-0 top-0.5 h-4 w-4 rounded-full shadow transition-transform duration-200 ${
                    esOscuro ? (t.on ? 'bg-cian' : 'bg-white/70') : 'bg-white'
                  } ${t.on ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </div>

          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-6">
            Práctica de palabras: {seleccion.join(', ')}
          </p>

          <div className="flex flex-col gap-4 min-h-[110px]">
            {([0, 1] as const).map((idx) => {
              const activa = lineaActiva === idx;
              const texto = lineas[idx];
              return (
                <div key={idx}
                  className={`font-mono text-xl leading-relaxed tracking-wide select-none rounded-lg px-2 py-1 transition-colors ${
                    lineaNueva[idx] ? 'bg-emerald-50 ring-1 ring-emerald-200' : ''
                  }`}>
                  {texto
                    ? texto.split('').map((char, i) => (
                        <span key={i}
                          className={`${
                            activa
                              ? getColorCaracter(i)
                              : lineaConsumida[idx]
                                ? 'text-slate-200 line-through'
                                : lineaNueva[idx] ? 'text-emerald-500' : 'text-slate-300'
                          } transition-colors`}>
                          {char}
                        </span>
                      ))
                    : activa && esperandoPalabras
                      ? <span className="text-slate-300 text-sm">Cargando más palabras...</span>
                      : <span className="text-slate-200 text-sm">—</span>}
                  {lineaNueva[idx] && (
                    <span className="ml-2 text-xs font-bold text-emerald-500 align-middle">← nueva combinación</span>
                  )}
                </div>
              );
            })}
          </div>

          {terminado && (
            <div className="mt-6 text-center text-emerald-500 font-bold text-lg animate-pulse">
              {guardando ? '⏳ Guardando resultados...' : '✅ ¡Completado!'}
            </div>
          )}
        </div>
      </div>

      {/* Teclado visual */}
      <div className="rounded-2xl border border-(--sup-borde) bg-(--sup) p-6"
        style={{ boxShadow: 'var(--sup-sombra)' }}>
        <div className="flex flex-col gap-2 items-center">
          {FILAS_TECLADO.map((fila, fi) => (
            <div key={fi} className="flex gap-1.5">
              {fila.map((tecla) => (
                <div key={tecla}
                  className={`key-cap flex items-center justify-center rounded-lg border text-xs font-bold transition-all ${getColorTecla(tecla)}`}>
                  {tecla}
                </div>
              ))}
            </div>
          ))}
          <div className={`mt-1 flex h-10 w-64 items-center justify-center rounded-lg border text-[10px] tracking-[0.2em] ${getColorTecla(' ')}`}>
            {esOscuro ? 'ESPACIO' : ''}
          </div>

          {/* Leyenda de los estados del teclado en oscuro: se enciende la que toca
              pulsar, no la que se pulsó. */}
          {esOscuro && (
            <div className="mt-3 flex gap-6 text-[10px] uppercase tracking-[0.12em] text-(--sup-tenue)">
              <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cian" />Próxima tecla</span>
              <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-dificil" />Error</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PracticaLibreView;
