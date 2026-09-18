import { useMemo } from 'react';
import { filaDe } from './tecladoLayout';

interface Props {
  texto: string;
  indice: number;
  errores: Set<number>;
  esOscuro?: boolean;
}

/* TRES TÚNELES: el recorrido de un dedo, dibujado.

   Un drill de un solo dedo entrena una cosa que no es horizontal: **el viaje vertical**. El
   dedo sale de la fila de reposo, alcanza la de arriba o la de abajo, y vuelve. Servido como
   una tira plana de letras —`sxs wsx ww`— ese movimiento no se ve por ningún lado y hay que
   deducirlo tecla por tecla.

   Acá cada letra viaja POR EL TÚNEL DE SU FILA, así que `wsx` baja de tubo en tubo y `sxs`
   baja y vuelve. El usuario ve el gesto ANTES de hacerlo.

   ===== POR QUÉ TÚNELES Y NO UN GRÁFICO =====

   La primera versión unía las letras con una polilínea que dibujaba la escalera. Funcionaba y
   el usuario la rechazó con el diagnóstico correcto: *"se ve muy genérico y tecnológico, como
   hecho por IA"*. Y tenía razón — rectas, líneas punteadas y nodos unidos son el lenguaje de
   una visualización de datos, no el de un juego.

   Lo que lo cambia no es quitar la línea, es el MATERIAL. Los tubos van con las puntas
   completamente redondeadas —eso es lo que los lee como tubos y no como cajas—, interior
   hundido con sombra hacia dentro, y las letras se desvanecen al entrar y al salir con una
   máscara. Un objeto que aparece por un extremo y se pierde por el otro se entiende como algo
   que atraviesa, no como un dato en un eje.

   ===== LO QUE SÍ SE CONSERVÓ DE LA PRIMERA VERSIÓN =====

   El cursor no se mueve nunca —se queda clavado en el centro— y lo que se desplaza es la
   tira: un punto fijo no se busca. Y las posiciones se CALCULAN (`i * ANCHO_SLOT`) en vez de
   medirse del DOM, lo que esquiva de entrada la trampa del `offsetLeft` que `VistaCinta` tuvo
   que resolver a golpes. */

// Paso fijo entre caracteres y geometría de los tubos. El alto manda: con tubos bajos los
// tres se leen como un renglón y el viaje deja de verse.
const ANCHO_SLOT = 52;
const ALTO_TUBO = 60;
const HUECO = 12;
const TAMANO_LETRA = 32;
const ANCHO_CANALETA = 78;   // la columna de rótulos, fuera de lo que se desplaza

const FILAS_PISTA = [1, 2, 3];        // arriba · reposo · abajo, en índices de tecladoLayout
const NOMBRE_CARRIL = ['Arriba', 'Reposo', 'Abajo'];

const ALTO_TOTAL = ALTO_TUBO * 3 + HUECO * 2;

// Borde superior y centro vertical del tubo, en el sistema de coordenadas de la pista.
const topDeTubo = (carril: number) => carril * (ALTO_TUBO + HUECO);
const yDeCarril = (carril: number) => topDeTubo(carril) + ALTO_TUBO / 2;

// Centro horizontal del slot `i`.
const xDeSlot = (i: number) => i * ANCHO_SLOT + ANCHO_SLOT / 2;

const VistaRecorrido = ({ texto, indice, errores, esOscuro }: Props) => {
  const acento = esOscuro ? 'var(--color-cian)' : '#059669';
  const fallo = esOscuro ? 'var(--color-dificil)' : '#E11D48';
  const tenue = esOscuro ? 'rgba(255,255,255,0.30)' : 'rgba(15,23,42,0.30)';

  /* Qué tecla vive en cada carril. Se deriva DEL TEXTO y no de la configuración del
     ejercicio, por el mismo criterio que `teclasDelTexto`: la configuración dice lo que se
     pidió, y el texto es lo único que no puede desincronizarse de lo que hay que teclear. */
  const teclasPorCarril = useMemo(() => {
    const porCarril: string[][] = [[], [], []];
    new Set(texto.replace(/\s/g, '')).forEach((c) => {
      const fila = filaDe(c);
      const carril = FILAS_PISTA.indexOf(fila ?? -1);
      if (carril >= 0 && !porCarril[carril].includes(c)) porCarril[carril].push(c);
    });
    return porCarril.map((t) => t.sort());
  }, [texto]);

  /* Cada carácter con su sitio ya resuelto. El espacio no tiene fila —no se teclea con
     ningún dedo de los tres túneles— así que se marca aparte y se dibuja como un corte. */
  const slots = useMemo(() => [...texto].map((caracter, i) => {
    const fila = filaDe(caracter);
    const carril = FILAS_PISTA.indexOf(fila ?? -1);
    return { caracter, i, carril, esEspacio: caracter === ' ' };
  }), [texto]);

  /* Atascado en esta letra. En este ejercicio la tecla equivocada NO avanza el cursor, así
     que "el índice actual ya está marcado como error" significa exactamente eso: fallaste
     aquí y sigues aquí. No hace falta ninguna bandera del padre — el estado ya lo dice. */
  const atascado = errores.has(indice);
  const carrilObjetivo = slots[indice]?.carril ?? -1;
  /* Y CUÁL de las teclas de ese carril, no solo cuál túnel. En el Curso cada dedo tiene ya
     una sola columna, pero el "Un dedo" de Ejercicios Base sigue sirviendo el índice con DOS
     por fila (`r` y `t` arriba, `f` y `g` en reposo), y ahí encender la fila entera deja al
     usuario eligiendo entre dos. */
  const teclaObjetivo = slots[indice]?.esEspacio ? '' : (slots[indice]?.caracter ?? '');
  const colorVivo = atascado ? fallo : acento;

  return (
    <div className="flex w-full justify-center">
      <div className="flex" style={{ height: ALTO_TOTAL }}>

        {/* ---------- La canaleta de rótulos: el mapa del dedo ----------
            Se queda quieta mientras la tira se desplaza, y es la ayuda permanente que se
            decidió dejar siempre visible: son tres teclas, no hay nada que memorizar
            escondiéndolas. */}
        <div className="shrink-0" style={{ width: ANCHO_CANALETA }}>
          {[0, 1, 2].map((carril) => {
            const esObjetivo = carril === carrilObjetivo;
            return (
              <div key={carril}
                className="flex items-center justify-end gap-1.5 pr-3"
                style={{ height: ALTO_TUBO, marginBottom: carril < 2 ? HUECO : 0 }}>
                <span className="text-[9px] font-bold uppercase tracking-wider"
                  style={{ color: esObjetivo ? colorVivo : (esOscuro ? 'rgba(255,255,255,0.3)' : '#94A3B8') }}>
                  {NOMBRE_CARRIL[carril]}
                </span>
                <div className="flex gap-1">
                  {teclasPorCarril[carril].map((t) => {
                    const esLaTecla = esObjetivo && t === teclaObjetivo;
                    return (
                      <span key={t}
                        className={`flex items-center justify-center rounded-md border-2 font-mono text-sm font-bold
                          ${esLaTecla ? 'late-objetivo' : ''}`}
                        style={{
                          width: 26, height: 26,
                          borderColor: esLaTecla ? colorVivo : tenue,
                          color: esLaTecla ? colorVivo : (esOscuro ? 'rgba(255,255,255,0.35)' : '#94A3B8'),
                          background: esLaTecla
                            ? (atascado ? 'rgba(255,0,4,0.12)' : 'rgba(0,241,253,0.10)')
                            : 'transparent',
                        }}>
                        {t}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ---------- Los tres túneles ---------- */}
        <div className="relative" style={{ width: 'min(760px, 62vw)', height: ALTO_TOTAL }}>

          {[0, 1, 2].map((carril) => {
            const esObjetivo = carril === carrilObjetivo;
            /* EL TUBO POR EL QUE VIENE LA LETRA SE ENCIENDE. Es la señal más fuerte de la
               pantalla y sustituye a la línea que unía las letras: en vez de leer un trazo,
               se ve por dónde viene lo que hay que teclear. */
            return (
              <div key={carril}
                className="absolute inset-x-0 overflow-hidden"
                style={{
                  top: topDeTubo(carril),
                  height: ALTO_TUBO,
                  // Puntas completamente redondeadas: esto es lo que lo lee como tubo.
                  borderRadius: ALTO_TUBO / 2,
                  border: `1px solid ${esObjetivo ? colorVivo : (esOscuro ? 'rgba(255,255,255,0.09)' : '#E2E8F0')}`,
                  background: esOscuro
                    ? (esObjetivo ? 'rgba(0,241,253,0.055)' : 'rgba(0,0,0,0.26)')
                    : (esObjetivo ? 'rgba(5,150,105,0.06)' : '#F1F5F9'),
                  /* La sombra HACIA DENTRO es lo que da profundidad: sin ella son tres
                     rectángulos claros, con ella son tres canales excavados. */
                  boxShadow: esOscuro
                    ? 'inset 0 3px 10px rgba(0,0,0,0.55), inset 0 -2px 8px rgba(0,0,0,0.35)'
                    : 'inset 0 3px 8px rgba(15,23,42,0.09)',
                }} />
            );
          })}

          {/* LA BOCA: dónde hay que teclear. Va SOLO en el túnel de destino y no cruzando los
              tres — una banda vertical que atraviesa todo vuelve a ser una retícula, que es
              justo el lenguaje del que se está huyendo. */}
          {carrilObjetivo >= 0 && (
            <div className="pointer-events-none absolute"
              style={{
                left: '50%',
                marginLeft: -ANCHO_SLOT / 2,
                top: topDeTubo(carrilObjetivo) + 5,
                width: ANCHO_SLOT,
                height: ALTO_TUBO - 10,
                borderRadius: (ALTO_TUBO - 10) / 2,
                background: atascado ? 'rgba(255,0,4,0.16)' : 'rgba(0,241,253,0.13)',
                boxShadow: `0 0 24px -4px ${colorVivo}`,
              }} />
          )}

          {/* LA TIRA. `left: 50%` más el desplazamiento del slot actual deja SIEMPRE el
              carácter que toca justo en el centro.

              La MÁSCARA es la mitad del efecto de túnel: las letras no aparecen ni
              desaparecen de golpe en el borde, se desvanecen al entrar y al salir. Sin ella
              la pista se ve recortada, con ella se ve profunda. */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden"
            style={{
              maskImage: 'linear-gradient(to right, transparent, #000 14%, #000 86%, transparent)',
              WebkitMaskImage: 'linear-gradient(to right, transparent, #000 14%, #000 86%, transparent)',
            }}>
            <div className="absolute top-0"
              style={{
                left: '50%',
                transform: `translateX(${-xDeSlot(indice)}px)`,
                transition: 'transform 130ms ease-out',
                height: ALTO_TOTAL,
              }}>
              {slots.map((s) => {
                const hecho = s.i < indice;
                const actual = s.i === indice;
                const fallado = errores.has(s.i);

                /* El espacio atraviesa los tres túneles como un corte, y CUANDO ES SU TURNO
                   lleva rótulo. No vive en ningún túnel —lo pulsa el pulgar— así que el
                   cajetín encendido de la canaleta no puede señalarlo: al llegar ahí los tres
                   quedaban apagados. Con el avance bloqueado eso es lo peor que puede pasar,
                   porque el ejercicio se planta y la pantalla no dice qué falta. */
                if (s.esEspacio || s.carril < 0) {
                  return (
                    <div key={s.i} className="absolute top-0 flex items-center justify-center"
                      style={{ left: s.i * ANCHO_SLOT, width: ANCHO_SLOT, height: ALTO_TOTAL }}>
                      <div style={{
                        width: 2, height: ALTO_TOTAL - 20,
                        borderLeft: `2px dotted ${actual ? colorVivo : tenue}`,
                        opacity: actual ? 1 : 0.45,
                      }} />
                      {actual && (
                        <span
                          className="late-objetivo absolute whitespace-nowrap rounded-md border-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            top: yDeCarril(1) - 12,
                            borderColor: colorVivo,
                            color: colorVivo,
                            background: esOscuro ? 'rgba(10,20,28,0.95)' : '#FFFFFF',
                          }}>
                          espacio
                        </span>
                      )}
                    </div>
                  );
                }

                const color = fallado ? fallo : (actual ? colorVivo : acento);

                return (
                  <div key={s.i}
                    className="absolute flex items-center justify-center font-mono font-bold"
                    style={{
                      left: s.i * ANCHO_SLOT,
                      top: topDeTubo(s.carril),
                      width: ANCHO_SLOT,
                      height: ALTO_TUBO,
                      fontSize: TAMANO_LETRA,
                      color,
                      /* Tres profundidades: lo ya tecleado se apaga sin desaparecer (marca por
                         dónde vienes), lo que viene espera a media luz, y la actual va entera
                         y con halo. */
                      opacity: hecho && !fallado ? 0.35 : (actual ? 1 : 0.62),
                      transform: actual ? 'scale(1.22)' : 'scale(1)',
                      transition: 'transform 130ms ease-out, opacity 220ms linear',
                      textShadow: actual ? `0 0 20px ${color}` : undefined,
                    }}>
                    {s.caracter}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VistaRecorrido;
