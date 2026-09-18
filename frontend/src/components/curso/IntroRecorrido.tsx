import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Icono from '../ui/Icono';
import { FILAS, SANGRIA_FILA } from '../practica/tecladoLayout';

interface Props {
  /* Las columnas que recorre el nodo, cada una como [arriba, reposo, abajo]. Salen de la
     configuración de los dedos, que ya viene en grupos de tres por contrato (ver
     generarTandaRecorrido en el backend). */
  columnas: string[][];
  esOscuro?: boolean;
  onEmpezar: () => void;
}

/* LA VENTANA DE ENTRADA DEL RECORRIDO: "sube y baja en diagonal".

   Pedido del usuario, y con la observación exacta: la `v` no está debajo de la `f`, está
   debajo y A LA DERECHA; la `r` está arriba y a la IZQUIERDA. Las filas del teclado van
   sangradas, así que la columna de cada dedo no es vertical sino inclinada, y quien baja el
   dedo en línea recta cae entre dos teclas. Es el error que el recorrido va a cobrar, así
   que se explica antes de la primera letra.

   EL DIBUJO ES EL TECLADO DE VERDAD, no un esquema. Las posiciones salen de FILAS y
   SANGRIA_FILA —las mismas que usa el teclado de ayuda y las pistas de vecindad— así que la
   inclinación que se ve es la real, sin exagerar ni corregir nada. Sobre esa base, las
   columnas del nodo se encienden por turnos en el orden del gesto: reposo, arriba, reposo,
   abajo. El dedo se ve ir a la izquierda al subir y a la derecha al bajar sin que haga falta
   leerlo.

   SIN LÍNEAS NI FLECHAS dibujadas entre teclas, a propósito: es el lenguaje que el usuario
   rechazó en la primera versión de los túneles ("genérico y tecnológico, como hecho por IA").
   Aquí el gesto lo cuenta la luz que se mueve de tecla en tecla.

   Es una pausa de verdad, igual que IntroLluvia: el ejercicio no escucha el teclado hasta
   cerrarla, y se cierra con Enter — nunca con el espacio, que es tecla del ejercicio. */

// Tamaño de tecla. Grande a propósito: la sangría es un cuarto de tecla, y a tamaño de
// teclado de ayuda (40 px) ese cuarto son diez píxeles que no se ven.
const UNIDAD = 56;
const TECLA = 50;
const ANCHO_ROTULO = 84;

// Las tres filas de letras de FILAS (la 0 son los números, la 4 el espacio).
const FILAS_LETRAS = [1, 2, 3];
const NOMBRE_FILA = ['Arriba', 'Reposo', 'Abajo'];

/* El orden en que se encienden las filas, en índices de columna: reposo, arriba, reposo,
   abajo. Es el recorrido que el ejercicio va a pedir, dibujado. */
const SECUENCIA = [1, 0, 1, 2];
const MS_POR_PASO = 720;

interface TeclaDibujada {
  etiqueta: string;
  fila: number;     // 0 arriba · 1 reposo · 2 abajo
  izquierda: number; // borde izquierdo, en unidades de tecla
  relieve: boolean;
}

const IntroRecorrido = ({ columnas, esOscuro, onEmpezar }: Props) => {
  const [paso, setPaso] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setPaso((p) => (p + 1) % SECUENCIA.length), MS_POR_PASO);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const manejar = (e: KeyboardEvent) => {
      /* ENTER y nunca el espacio. Y `preventDefault` no es un adorno: es la marca con la que
         el ejercicio sabe que esta pulsación ya tuvo dueño (ver el guard de
         `e.defaultPrevented` en CursoPracticaView). */
      if (e.repeat || e.key !== 'Enter') return;
      e.preventDefault();
      onEmpezar();
    };
    window.addEventListener('keydown', manejar);
    return () => window.removeEventListener('keydown', manejar);
  }, [onEmpezar]);

  /* Las teclas de letras con su posición. Los dos Shift se saltan pero SÍ se cuenta su
     ancho: el izquierdo es justo lo que empuja la Z hasta quedar debajo de la A. */
  const teclas = useMemo(() => {
    const lista: TeclaDibujada[] = [];
    FILAS_LETRAS.forEach((f, fila) => {
      let x = SANGRIA_FILA[f] ?? 0;
      FILAS[f].forEach((t) => {
        const ancho = t.ancho ?? 1;
        if (!t.etiqueta.startsWith('MAYUS')) {
          lista.push({ etiqueta: t.etiqueta, fila, izquierda: x, relieve: Boolean(t.conRelieve) });
        }
        x += ancho;
      });
    });
    return lista;
  }, []);

  const anchoTeclado = Math.max(...teclas.map((t) => t.izquierda + 1)) * UNIDAD;

  // Qué tecla de cada columna está encendida en este paso, y qué columnas son del nodo.
  const filaEncendida = SECUENCIA[paso];
  const delNodo = useMemo(() => {
    const mapa = new Map<string, number>();   // etiqueta → fila dentro de su columna
    columnas.forEach((col) => col.forEach((c, fila) => mapa.set(c.toUpperCase(), fila)));
    return mapa;
  }, [columnas]);

  const [arriba, reposo, abajo] = (columnas[0] ?? []).map((c) => c.toUpperCase());

  const acento = esOscuro ? 'var(--color-cian)' : '#059669';
  const marco = esOscuro
    ? 'border-vidrio-borde bg-[rgba(10,20,28,0.98)]'
    : 'border-slate-200 bg-white';
  const titulo = esOscuro ? 'text-white' : 'text-slate-900';
  const suave = esOscuro ? 'text-gris-texto' : 'text-slate-500';

  const regla = (icono: string, contenido: ReactNode) => (
    <li className={`flex items-start gap-3 text-lg leading-snug ${suave}`}>
      <Icono nombre={icono} tamano={24} style={{ color: acento, flexShrink: 0, marginTop: 2 }} />
      <span>{contenido}</span>
    </li>
  );
  const letra = (c: string) => (
    <strong className={`font-mono ${titulo}`}>{c}</strong>
  );

  return (
    <div className="flex justify-center py-6">
      <div className={`sube-y-aparece w-full max-w-5xl rounded-2xl border-2 p-10 shadow-2xl ${marco}`}
        style={{ boxShadow: `0 20px 60px -18px ${acento}55` }}
        role="dialog"
        aria-label="Cómo se recorre la columna de cada dedo">

        <div className="flex items-center gap-2.5">
          <Icono nombre="swap_vert" tamano={34} style={{ color: acento }} />
          <h2 className={`text-4xl font-bold ${titulo}`}>Sube y baja en diagonal</h2>
        </div>

        <p className={`mt-3 text-xl ${suave}`}>
          La columna de cada dedo no es recta: está inclinada. Si bajas el dedo en línea recta,
          caes entre dos teclas.
        </p>

        {/* ---------- El teclado, con el gesto encendiéndose ---------- */}
        <div className={`mt-8 overflow-x-auto rounded-xl border px-6 py-6 ${
          esOscuro ? 'border-vidrio-borde bg-black/25' : 'border-slate-200 bg-slate-50'
        }`} aria-hidden="true">
          <div className="mx-auto flex" style={{ width: ANCHO_ROTULO + anchoTeclado }}>
            <div className="shrink-0" style={{ width: ANCHO_ROTULO }}>
              {NOMBRE_FILA.map((nombre, fila) => (
                <div key={nombre} className="flex items-center"
                  style={{ height: UNIDAD }}>
                  <span className="text-[11px] font-bold uppercase tracking-wider transition-colors duration-200"
                    style={{
                      color: fila === filaEncendida
                        ? acento
                        : (esOscuro ? 'rgba(255,255,255,0.3)' : '#94A3B8'),
                    }}>
                    {nombre}
                  </span>
                </div>
              ))}
            </div>

            <div className="relative" style={{ width: anchoTeclado, height: UNIDAD * 3 }}>
              {teclas.map((t) => {
                const filaEnColumna = delNodo.get(t.etiqueta);
                const esDelNodo = filaEnColumna !== undefined;
                const encendida = esDelNodo && filaEnColumna === filaEncendida;
                return (
                  <div key={t.etiqueta}
                    className="absolute flex items-center justify-center rounded-lg border-2 font-mono font-bold"
                    style={{
                      left: t.izquierda * UNIDAD,
                      top: t.fila * UNIDAD,
                      width: TECLA,
                      height: TECLA,
                      fontSize: 20,
                      /* Tres estados: fuera del nodo casi apagada (da el contexto de dónde
                         está la columna sin competir con ella), del nodo en contorno, y la
                         del paso actual encendida entera. */
                      borderColor: encendida
                        ? acento
                        : esDelNodo
                          ? (esOscuro ? 'rgba(0,241,253,0.35)' : 'rgba(5,150,105,0.4)')
                          : (esOscuro ? 'rgba(255,255,255,0.08)' : '#E2E8F0'),
                      color: encendida || esDelNodo
                        ? acento
                        : (esOscuro ? 'rgba(255,255,255,0.18)' : '#CBD5E1'),
                      background: encendida
                        ? (esOscuro ? 'rgba(0,241,253,0.16)' : 'rgba(5,150,105,0.12)')
                        : 'transparent',
                      boxShadow: encendida ? `0 0 22px -4px ${acento}` : 'none',
                      transform: encendida ? 'scale(1.08)' : 'scale(1)',
                      opacity: esDelNodo ? 1 : 0.8,
                      transition: 'background 180ms ease-out, box-shadow 180ms ease-out, transform 180ms ease-out',
                    }}>
                    {t.etiqueta}
                    {/* El relieve de la F y la J: el ancla que el dedo reconoce sin mirar. */}
                    {t.relieve && (
                      <span className="absolute bottom-1.5 h-0.5 w-3 rounded-full"
                        style={{ background: 'currentColor', opacity: 0.7 }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ---------- Las reglas ---------- */}
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {arriba && reposo && abajo && (
            <>
              {regla('north_west', <>La {letra(arriba)} queda arriba y un poco a la izquierda de la {letra(reposo)}.</>)}
              {regla('south_east', <>La {letra(abajo)}, abajo y un poco a la derecha.</>)}
            </>
          )}
          {regla('back_hand', 'Pasa igual con todos los dedos: al subir, hacia la izquierda; al bajar, hacia la derecha.')}
          {regla('lock', 'Si fallas, la letra te espera: no se avanza hasta acertarla.')}
        </ul>

        <button
          onClick={onEmpezar}
          autoFocus
          className="mt-9 flex w-full items-center justify-center gap-2.5 rounded-xl px-5 py-4 text-xl font-bold transition-all hover:brightness-110 active:scale-[0.99]"
          style={{ background: acento, color: esOscuro ? 'var(--color-ground)' : '#FFFFFF' }}>
          <span className="rounded border border-current px-2 py-0.5 text-xs uppercase tracking-wide">
            Enter
          </span>
          Empezar
        </button>
      </div>
    </div>
  );
};

export default IntroRecorrido;
