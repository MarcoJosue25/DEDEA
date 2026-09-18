import { useState } from 'react';
import type { ProgresoEjercicioResponse } from '../../types';
import { colorPorMejorar, llegoAlTestFinal } from '../../core/curso/sendero';
import Estrellas from './Estrellas';

interface Props {
  // Los nodos del sendero, en orden. Uno por guion.
  nodos: ProgresoEjercicioResponse[];
  // El ejercicio que se acaba de terminar: su guion va más alto y con aro.
  actualId: number;
  /* El que parpadea: adónde lleva el botón principal de la pantalla. Null cuando no hay un
     siguiente que señalar (fuera del modo de completar estrellas). */
  destacadoId: number | null;
  esOscuro: boolean;
  onElegir: (nodo: ProgresoEjercicioResponse) => void;
}

/* LA BARRA DE GUIONES: el nivel entero, un guion por ejercicio.

   Sustituye a la barra de progreso lisa de "Nivel Básico · 25/35 ejercicios". Pedido del
   usuario: la misma línea, pero partida en guiones con una separación mínima, y **en
   amarillo los ejercicios que todavía no tienen sus 2 estrellas**. Sin números: es una
   barra, y leída de un vistazo dice cuánto llevas y qué te falta sin tener que contar nada.
   Primero fueron rojos; el usuario los pasó a amarillo porque el rojo resaltaba demasiado
   (ver `colorPorMejorar`).

   El detalle de cada guion sale al pasar el ratón (o con el foco del teclado): número,
   título y estrellas, en CUALQUIER guion y no solo en los amarillos — el usuario lo pidió
   así, y es lo que convierte la barra en un mapa del nivel.

   QUÉ VA EN AMARILLO LO DECIDE EL BACKEND (`porMejorar`), no un "estrellas < 2" escrito
   aquí: es la misma regla que cierra el Test Final, y si la escala cambia sigue diciendo la
   verdad. La Lluvia nunca lo está: es un juego de relajo.

   Qué pasa al hacer clic lo decide quien la usa (ResultadosView): la barra solo avisa. */

const BarraSendero = ({ nodos, actualId, destacadoId, esOscuro, onElegir }: Props) => {
  const [enfocado, setEnfocado] = useState<number | null>(null);

  const acento = esOscuro ? 'var(--color-cian)' : '#059669';
  const amarillo = colorPorMejorar(esOscuro);
  const apagado = esOscuro ? 'rgba(255,255,255,0.10)' : '#E2E8F0';
  /* El Test Final sin hacer va en un dorado MUY apagado: con los ejercicios de una estrella
     ya en dorado pleno, el del 45% de antes se confundía con ellos. */
  const oroApagado = esOscuro ? 'var(--color-oro-apagado)' : 'rgba(255,197,61,0.45)';
  // Del examen cerrado solo se habla al llegar a él (ver llegoAlTestFinal).
  const alTestFinal = llegoAlTestFinal(nodos);
  const pendientes = nodos.filter((n) => n.porMejorar).length;

  const colorDe = (n: ProgresoEjercicioResponse) => {
    if (n.porMejorar) return amarillo;
    if (n.completado) return acento;
    // El Test Final sin hacer va en dorado, igual que en el sendero: ahí se juega el nivel.
    if (n.rolEnNivel === 'TEST_FINAL') return oroApagado;
    return apagado;
  };

  /* Lo que dice el aviso del guion, en una línea. El orden importa: "le faltan estrellas"
     manda sobre las estrellas mismas, porque es lo único accionable. */
  const estadoDe = (n: ProgresoEjercicioResponse) => {
    if (n.rolEnNivel === 'TEST_FINAL') {
      if (n.completado) return null;
      if (!alTestFinal) return 'Sin hacer';
      return pendientes > 0
        ? `Cerrado: ${pendientes === 1 ? 'falta 1 ejercicio' : `faltan ${pendientes} ejercicios`}`
        : 'Listo para darlo';
    }
    if (n.porMejorar) return 'Le faltan estrellas';
    if (!n.completado) return 'Sin hacer';
    if (n.estrellas == null) return 'Sin nota';
    return null;
  };

  const nodoEnfocado = enfocado !== null ? nodos[enfocado] : null;
  /* Dónde cae el aviso: centrado sobre su guion, salvo en los bordes, donde se ancla al
     lado para no salirse de la tarjeta. */
  const pctCentro = enfocado !== null ? ((enfocado + 0.5) / nodos.length) * 100 : 0;
  const anclaje = pctCentro < 18 ? 'izquierda' : pctCentro > 82 ? 'derecha' : 'centro';

  return (
    <div className="relative">
      <div className="flex items-end gap-[3px]" role="group" aria-label="Ejercicios del nivel">
        {nodos.map((n, i) => {
          const esActual = n.ejercicioId === actualId;
          const esDestacado = n.ejercicioId === destacadoId;
          return (
            <button
              key={n.ejercicioId}
              type="button"
              aria-label={`Ejercicio ${n.orden}: ${n.titulo}`}
              onMouseEnter={() => setEnfocado(i)}
              onMouseLeave={() => setEnfocado((actual) => (actual === i ? null : actual))}
              onFocus={() => setEnfocado(i)}
              onBlur={() => setEnfocado((actual) => (actual === i ? null : actual))}
              onClick={() => onElegir(n)}
              /* El área de clic es más alta que el guion: con 6 px de alto no se le acierta
                 con el ratón, y tampoco hace falta verlo más grueso para leerlo. */
              className="flex flex-1 cursor-pointer items-end py-2">
              <span
                className={`block w-full rounded-full transition-[height] duration-150 ${
                  esDestacado ? 'parpadeo-segmento' : ''
                }`}
                style={{
                  height: esActual || esDestacado || enfocado === i ? 10 : 6,
                  background: colorDe(n),
                  boxShadow: esActual
                    ? `0 0 0 2px ${esOscuro ? 'rgba(255,255,255,0.75)' : '#0F172A'}`
                    : esDestacado
                      ? `0 0 10px ${colorDe(n)}`
                      : undefined,
                }} />
            </button>
          );
        })}
      </div>

      {nodoEnfocado && (
        <div
          className={`pointer-events-none absolute bottom-full z-20 mb-1 w-64 rounded-xl border px-3 py-2.5 shadow-xl ${
            esOscuro ? 'border-white/10 bg-[rgba(10,20,28,0.97)]' : 'border-slate-200 bg-white'
          }`}
          style={
            anclaje === 'izquierda' ? { left: 0 }
              : anclaje === 'derecha' ? { right: 0 }
                /* Centrado con `left` y un margen negativo, no con transform: así nada que
                   anime `transform` puede pisarlo (la trampa del aviso de racha). */
                : { left: `${pctCentro}%`, marginLeft: -128 }
          }
          role="tooltip">
          <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${
            esOscuro ? 'text-gris-texto' : 'text-slate-400'
          }`}>
            {nodoEnfocado.rolEnNivel === 'TEST_FINAL' ? 'Test Final' : `Ejercicio ${nodoEnfocado.orden}`}
            {nodoEnfocado.tipo === 'LLUVIA_LETRAS' && ' · juego de relajo'}
          </p>
          <p className={`mt-0.5 truncate text-sm font-semibold ${esOscuro ? 'text-white' : 'text-slate-900'}`}>
            {nodoEnfocado.titulo}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            {nodoEnfocado.completado && nodoEnfocado.estrellas != null && (
              <Estrellas cantidad={nodoEnfocado.estrellas} tamano={14} />
            )}
            {estadoDe(nodoEnfocado) && (
              <span className="text-xs font-semibold"
                style={{
                  color: nodoEnfocado.porMejorar
                    ? amarillo
                    : (esOscuro ? 'var(--color-gris-texto)' : '#64748B'),
                }}>
                {estadoDe(nodoEnfocado)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BarraSendero;
