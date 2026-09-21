import { useCallback, useEffect, useRef, useState } from 'react';
import type { BusquedaPalabras, PalabraRevisionDTO, ResumenRevision } from '../types';
import {
  activarPreactivas, buscarPalabras, cambiarEstadoLote, cambiarEstadoPalabra,
  deshacerUltimaTanda,
  guardarClave, guardarTanda, importarArchivo, leerClave, migrarDiccionario,
  obtenerResumen, obtenerTanda,
} from '../api/revisionApi';

/* PANTALLA DE REVISIÓN MANUAL DEL DICCIONARIO.

   No está enlazada desde ninguna parte de la web y el backend exige X-Admin-Key en cada
   llamada. La ruta oculta no es la seguridad —una ruta se descubre— es solo para que un
   usuario normal no se tropiece con ella.

   El flujo que pidió el usuario: se muestran 100 palabras, se marcan a puro teclado, y al
   guardar las marcadas quedan PREACTIVAS y las no marcadas pasan a NO PERMITIDAS, que es un
   filtro permanente para que ninguna importación futura las vuelva a proponer. */

/* La grilla: 8 columnas de cabecera y las palabras CAEN hacia abajo, hasta 13 por columna.
   El llenado es por columnas y no por filas, y eso es lo que hace que la navegación tenga
   sentido: la flecha abajo avanza a la palabra siguiente de la lista. */
const COLUMNAS = 8;
const FILAS = 13;
const POR_TANDA = COLUMNAS * FILAS;

const RevisionPalabrasView = () => {
  const [clave, setClave] = useState(leerClave());
  const [autorizado, setAutorizado] = useState(false);
  const [resumen, setResumen] = useState<ResumenRevision | null>(null);
  const [tanda, setTanda] = useState<PalabraRevisionDTO[]>([]);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [busqueda, setBusqueda] = useState('');
  /* null = todavía no se buscó nada. Es distinto de "se buscó y no hubo resultados", que es
     un objeto con las listas vacías: solo en el segundo caso hay que decir que no hay nada. */
  const [hallazgo, setHallazgo] = useState<BusquedaPalabras | null>(null);
  /* Confirmacion en dos pasos para la migracion. No es adorno: vacia el diccionario, o sea
     que deja sin material a la seccion de Palabras y a los ejercicios del Curso que leen de
     ahi. Un window.confirm haria lo mismo pero se sale del estilo de la app. */
  const [confirmarMigrar, setConfirmarMigrar] = useState(false);
  const [archivo, setArchivo] = useState('es_50k.txt');

  const contenedorRef = useRef<HTMLDivElement>(null);
  /* El cursor se lee dentro del manejador de teclado, que se registra una sola vez. Sin el
     ref, ese manejador vería siempre el valor del primer render. */
  const cursorRef = useRef(0);
  useEffect(() => { cursorRef.current = cursor; }, [cursor]);
  const tandaRef = useRef<PalabraRevisionDTO[]>([]);
  useEffect(() => { tandaRef.current = tanda; }, [tanda]);

  const cargarTanda = useCallback(async () => {
    const [nueva, resu] = await Promise.all([obtenerTanda(POR_TANDA), obtenerResumen()]);
    setTanda(nueva);
    setMarcadas(new Set());
    setCursor(0);
    setResumen(resu);
    // `preventScroll`: sin esto, cargar una tanda nueva saltaba el scroll hasta acá.
    contenedorRef.current?.focus({ preventScroll: true });
  }, []);

  const entrar = async () => {
    try {
      guardarClave(clave);
      await cargarTanda();
      setAutorizado(true);
    } catch {
      setAviso('Clave incorrecta o backend caído.');
    }
  };

  /* Marca o desmarca. Es la misma operación para el teclado y para el clic: el usuario pidió
     que el clic alterne, así que una palabra marcada por error se corrige sin salir del ratón
     ni volver con las flechas. */
  const alternar = useCallback((id: number) => {
    setMarcadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  /* Navegación. El índice recorre la lista en el mismo orden en que se llena la grilla —por
     columnas—, así que:
       abajo/arriba = ±1 dentro de la columna, y al llegar al borde pasa a la siguiente
       derecha/izquierda = ±FILAS, o sea la palabra de al lado
     Enter marca y baja: al terminar una columna sigue arriba de la próxima, sin saltos. */
  useEffect(() => {
    if (!autorizado) return;

    const manejar = (e: KeyboardEvent) => {
      const total = tandaRef.current.length;
      if (total === 0) return;
      const i = cursorRef.current;
      /* Sin valor inicial: todas las ramas de abajo asignan, y la que no reconoce la tecla
         sale con return antes de leerlo. Un `= null` de arranque nunca se leeria. */
      let destino: number;

      if (e.key === 'ArrowDown') destino = Math.min(i + 1, total - 1);
      else if (e.key === 'ArrowUp') destino = Math.max(i - 1, 0);
      else if (e.key === 'ArrowRight') destino = Math.min(i + FILAS, total - 1);
      else if (e.key === 'ArrowLeft') destino = Math.max(i - FILAS, 0);
      else if (e.key === 'Enter') {
        alternar(tandaRef.current[i].id);
        destino = Math.min(i + 1, total - 1);
      } else {
        return;
      }

      /* Sin esto las flechas además desplazan la página y el espacio hace scroll, justo
         mientras se navega. */
      e.preventDefault();
      setCursor(destino);
    };

    window.addEventListener('keydown', manejar);
    return () => window.removeEventListener('keydown', manejar);
  }, [autorizado, alternar]);

  const conAviso = async (accion: () => Promise<ResumenRevision>, recargar: boolean) => {
    setOcupado(true);
    try {
      const r = await accion();
      setResumen(r);
      setAviso(r.detalle);
      if (recargar) await cargarTanda();
    } catch {
      setAviso('La operación falló. Revisá el log del backend.');
      /* Se recarga IGUAL. El fallo puede venir de una segunda llamada disparada por accidente
         mientras la primera sí funcionó, y en ese caso dejar la pantalla vacía hace creer que
         no pasó nada cuando en realidad los datos están. */
      if (recargar) await cargarTanda().catch(() => undefined);
    } finally {
      setOcupado(false);
    }
  };

  const guardar = () =>
    conAviso(() => guardarTanda([...marcadas], tanda.map((p) => p.id)), true);

  const buscar = async () => {
    if (!busqueda.trim()) return;
    setHallazgo(await buscarPalabras(busqueda));
  };

  const mover = async (id: number, estado: string) => {
    await cambiarEstadoPalabra(id, estado);
    setHallazgo(await buscarPalabras(busqueda));
    setResumen(await obtenerResumen());
  };

  /* El botón de rechazo masivo. Manda las dos listas: las encontradas cambian de cajón y las
     que no existían se CREAN ya rechazadas, para que bloqueen su propio reingreso en la
     próxima importación.

     Va con recargar=false a propósito: recargar la tanda acá borraría las marcas que el
     usuario tenga a medio hacer en la grilla de arriba. */
  const rechazarTodos = async () => {
    if (!hallazgo?.exacta) return;
    await conAviso(() => cambiarEstadoLote(
      hallazgo.resultados.map((r) => r.id), hallazgo.noEncontradas, 'NO_PERMITIDA',
    ), false);
    setHallazgo(await buscarPalabras(busqueda));
  };

  // ---------------------------------------------------------------- puerta
  if (!autorizado) {
    return (
      <div className="mx-auto flex max-w-sm flex-col gap-4 py-24">
        <h1 className="text-2xl font-bold text-white">Revisión del diccionario</h1>
        <p className="text-sm text-gris-texto">Esta pantalla pide la clave de administrador.</p>
        <input
          type="password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') entrar(); }}
          placeholder="X-Admin-Key"
          className="rounded-xl border border-vidrio-borde bg-vidrio px-4 py-3 text-white outline-none focus:border-cian/50"
        />
        <button onClick={entrar}
          className="rounded-xl bg-cian px-4 py-3 font-bold text-ground active:scale-95">
          Entrar
        </button>
        {aviso && <p className="text-sm font-semibold text-dificil">{aviso}</p>}
      </div>
    );
  }

  // ---------------------------------------------------------------- pantalla
  return (
    <div ref={contenedorRef} tabIndex={-1} className="flex flex-col gap-5 outline-none">

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Revisión del diccionario</h1>
          <p className="text-xs text-gris-texto">
            Enter marca y baja · flechas para moverse · clic alterna
          </p>
        </div>
        {resumen && (
          <div className="flex gap-5 text-right">
            {[
              { etq: 'Pendientes', v: resumen.pendientes, color: 'text-white' },
              { etq: 'Pre-activas', v: resumen.preactivas, color: 'text-cian' },
              { etq: 'No permitidas', v: resumen.noPermitidas, color: 'text-dificil' },
              { etq: 'En la web', v: resumen.enDiccionario, color: 'text-medio' },
            ].map((c) => (
              <div key={c.etq}>
                <p className={`text-xl font-bold tabular-nums ${c.color}`}>{c.v.toLocaleString('es-PE')}</p>
                <p className="text-[10px] uppercase tracking-wide text-gris-texto">{c.etq}</p>
              </div>
            ))}
          </div>
        )}
      </header>

      {aviso && (
        <p className="rounded-lg border border-cian/30 bg-cian/10 px-4 py-2 text-sm text-white">{aviso}</p>
      )}

      {/* Las dos operaciones de carga. Viven acá y no solo como endpoint porque la pantalla
          es el único lugar donde ya está la clave: pedirle al usuario que salga a la consola
          para poder empezar no tiene sentido. Van arriba y separadas del flujo de revisión
          para que no se confundan con los botones de cada tanda. */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-vidrio-borde bg-vidrio/50 px-4 py-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gris-texto">Cargar</span>

        {!confirmarMigrar ? (
          <button onClick={() => setConfirmarMigrar(true)} disabled={ocupado}
            className="rounded-full border border-vidrio-borde px-4 py-2 text-xs font-semibold text-white active:scale-95 disabled:opacity-40">
            Traer las {resumen?.enDiccionario ?? 0} de la web a revisión
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-dificil">
              Esto vacía el diccionario: Palabras y el Curso se quedan sin material hasta que actives.
            </span>
            <button
              disabled={ocupado}
              onClick={() => { setConfirmarMigrar(false); conAviso(migrarDiccionario, true); }}
              className="rounded-full bg-dificil px-3 py-1.5 text-xs font-bold text-white active:scale-95 disabled:opacity-40">
              Sí, migrar
            </button>
            <button onClick={() => setConfirmarMigrar(false)}
              className="rounded-full border border-vidrio-borde px-3 py-1.5 text-xs font-semibold text-white">
              Cancelar
            </button>
          </div>
        )}

        <span className="mx-1 text-vidrio-borde">|</span>
        <input
          value={archivo}
          onChange={(e) => setArchivo(e.target.value)}
          className="w-40 rounded-lg border border-vidrio-borde bg-vidrio px-2 py-1.5 font-mono text-xs text-white outline-none focus:border-cian/50"
        />
        <button onClick={() => conAviso(() => importarArchivo(archivo), true)} disabled={ocupado}
          className="rounded-full border border-vidrio-borde px-4 py-2 text-xs font-semibold text-white active:scale-95 disabled:opacity-40">
          Importar de resources/seed/
        </button>
      </div>

      {tanda.length === 0 ? (
        <p className="py-16 text-center text-gris-texto">
          No quedan palabras pendientes.
        </p>
      ) : (
        <>
          {/* grid-flow-col + grid-rows: las palabras caen hacia ABAJO llenando cada columna
              antes de pasar a la siguiente, que es lo que hace coherente a la flecha abajo. */}
          <div
            className="grid gap-x-3 gap-y-1"
            style={{
              gridTemplateColumns: `repeat(${COLUMNAS}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${FILAS}, minmax(0, auto))`,
              gridAutoFlow: 'column',
            }}>
            {tanda.map((p, i) => {
              const activa = i === cursor;
              const marcada = marcadas.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => { setCursor(i); alternar(p.id); }}
                  title={p.sospecha ?? `frecuencia #${p.rangoFrecuencia}`}
                  className={`truncate rounded px-2 py-1 text-left font-mono text-[13px] transition-colors ${
                    marcada
                      ? 'bg-cian font-bold text-ground'
                      : p.sospecha
                        ? 'bg-medio/15 text-medio'
                        : 'bg-vidrio text-white/80'
                  } ${activa ? 'ring-2 ring-cian ring-offset-1 ring-offset-ground' : ''}`}>
                  {p.palabra}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* La barra de acciones vive FUERA del condicional de la tanda. Estuvo dentro y eso
          escondía "Activar pre-activas" y "Deshacer" justo al terminar de revisar: con cero
          pendientes la pantalla se quedaba en "No quedan palabras pendientes" y sin un solo
          botón, cuando activar es exactamente lo que toca en ese momento. Solo "Guardar
          tanda" depende de que haya una tanda en pantalla. */}
      <div className="flex flex-wrap items-center gap-3 border-t border-vidrio-borde pt-4">
        {tanda.length > 0 && (
          <>
            <span className="text-sm text-gris-texto">
              <b className="text-cian">{marcadas.size}</b> marcadas de {tanda.length}
            </span>
            <button onClick={guardar} disabled={ocupado}
              className="rounded-full bg-cian px-5 py-2.5 text-sm font-bold text-ground active:scale-95 disabled:opacity-40">
              Guardar tanda
            </button>
          </>
        )}
        <button onClick={() => conAviso(activarPreactivas, false)} disabled={ocupado}
          className="rounded-full border border-vidrio-borde bg-vidrio px-5 py-2.5 text-sm font-semibold text-white active:scale-95 disabled:opacity-40">
          Activar pre-activas
        </button>
        {/* Deshacer: la revisión se hace a puro Enter y sin mirar, así que una navegación
            equivocada puede mandar 100 palabras a no-permitidas de un saque. */}
        <button onClick={() => conAviso(deshacerUltimaTanda, true)} disabled={ocupado}
          className="rounded-full border border-dificil/40 px-5 py-2.5 text-sm font-semibold text-dificil active:scale-95 disabled:opacity-40">
          Deshacer última tanda
        </button>
      </div>

      {/* Buscador: para corregir una palabra ya clasificada, en los dos sentidos. */}
      <div className="flex flex-col gap-2 border-t border-vidrio-borde pt-4">
        <div className="flex gap-2">
          {/* textarea y no input: acá se pegan listas de varias líneas, y un input de una
              sola línea las destroza al pegar. Chrome borra los saltos y junta las palabras
              —`brian` y `carl` llegan como `briancarl`— mientras Firefox los pasa a espacio.
              Con textarea el texto llega tal cual y el separador lo decide el backend. */}
          <textarea
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();   // que no lo lea el manejador global de la grilla
              /* Enter busca, Shift+Enter hace salto de línea. Sin el preventDefault, Enter
                 buscaría Y metería un salto, dejando basura en el cuadro. */
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); buscar(); }
            }}
            rows={2}
            placeholder="Una palabra busca por prefijo. Varias (separadas por espacio o salto de línea) buscan coincidencia exacta de cada una."
            className="flex-1 resize-y rounded-lg border border-vidrio-borde bg-vidrio px-3 py-2 text-sm text-white outline-none focus:border-cian/50"
          />
          <button onClick={buscar}
            className="shrink-0 self-stretch rounded-lg border border-vidrio-borde px-4 text-sm font-semibold text-white">
            Buscar
          </button>
        </div>
        {/* Resumen del modo lista. Solo aparece con dos o más términos: con uno la búsqueda es
            por prefijo y contar "encontrados" no significaría nada. */}
        {hallazgo?.exacta && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-vidrio-borde bg-vidrio px-3 py-2">
            <span className="text-xs text-gris-texto">
              {hallazgo.resultados.length + hallazgo.noEncontradas.length} términos ·{' '}
              <span className="text-white">{hallazgo.resultados.length}</span> en la tabla ·{' '}
              <span className="text-white">{hallazgo.noEncontradas.length}</span> sin registrar
            </span>
            <button onClick={rechazarTodos} disabled={ocupado}
              className="ml-auto rounded-full border border-dificil/40 px-4 py-1.5 text-xs font-semibold text-dificil active:scale-95 disabled:opacity-40">
              Todos a no permitidos ({hallazgo.resultados.length + hallazgo.noEncontradas.length})
            </button>
          </div>
        )}

        {hallazgo && hallazgo.resultados.length === 0 && hallazgo.noEncontradas.length === 0 && (
          <p className="px-1 text-xs text-gris-texto">Sin coincidencias.</p>
        )}

        {hallazgo?.resultados.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-lg bg-vidrio px-3 py-2">
            <span className="font-mono text-sm text-white">{r.palabra}</span>
            <span className="text-[10px] uppercase tracking-wide text-gris-texto">{r.estado}</span>
            <div className="ml-auto flex gap-2">
              <button onClick={() => mover(r.id, 'PREACTIVA')}
                className="rounded px-2 py-1 text-xs font-semibold text-cian hover:bg-cian/10">
                a pre-activa
              </button>
              <button onClick={() => mover(r.id, 'NO_PERMITIDA')}
                className="rounded px-2 py-1 text-xs font-semibold text-dificil hover:bg-dificil/10">
                a no permitida
              </button>
            </div>
          </div>
        ))}

        {/* Las que no existen en la tabla. Se muestran para que se vea qué va a crearse: el
            botón de arriba las da de alta como rechazadas, y eso es permanente. */}
        {!!hallazgo?.noEncontradas.length && (
          <div className="rounded-lg border border-dashed border-vidrio-borde px-3 py-2">
            <p className="mb-1.5 text-[10px] uppercase tracking-wide text-gris-texto">
              No están en la tabla — se crearán como no permitidas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {hallazgo.noEncontradas.map((w) => (
                <span key={w} className="rounded bg-vidrio px-2 py-0.5 font-mono text-xs text-gris-texto">
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RevisionPalabrasView;
