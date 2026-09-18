import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Icono from '../ui/Icono';

interface Props {
  /* Lo que hay que teclear, en orden. Un ítem puede ser UNA TECLA o UNA PALABRA entera, y
     el componente no los trata distinto: teclea cada ítem carácter a carácter y avanza al
     terminarlo — una tecla suelta es el caso de un ítem de un solo carácter.

     Las teclas las manda el backend AL AZAR (f f j f j j…) y no alternadas: alternar creaba
     un patrón que se teclea sin mirar, y mirar cuál toca es justo lo que el tutorial
     entrena. Ver teclasDelTutorial en el backend. */
  items: string[];
  /* El rótulo de arriba. Sin él va el genérico de las teclas. Lo usan los nodos de
     palabras, donde lo que se presenta no es una tecla nueva ("Es hora de teclear tus
     primeras palabras"). */
  mensaje?: string;
  /* Una leyenda por ítem (mismo largo que `items`), para cuando la tecla sola no dice
     dónde va el dedo — hoy solo "Fila de números" la trae ("Meñique izquierdo"...). Un
     ítem sin leyenda (`null` o string vacío) no muestra nada, así que no hace falta que
     TODOS los ítems la traigan. */
  captions?: (string | null)[];
  esOscuro: boolean;
  onCompletar: () => void;
  onSaltar: () => void;
}

/* El tutorial de un nodo del Curso: sus ítems en cuadros grandes, de a uno.

   DOS USOS CON UNA SOLA MECÁNICA. En Fundamentos los ítems son diez TECLAS sueltas; en
   "Palabras de la línea base" son cinco PALABRAS enteras. No hay modo ni bandera que los
   separe: un ítem se completa cuando se han tecleado todos sus caracteres, y una tecla
   suelta es el caso de longitud uno. Lo único que cambia con palabras es el tamaño de
   letra y que el cuadro crece a lo ancho — si no, cinco palabras de siete letras a 58 px
   se parten en dos filas.

   No es una vista previa pasiva — hay que pulsarlas. Esa diferencia importa: leer "ahora
   toca la d" no mueve ningún dedo, y lo que el nodo enseña es un gesto, no un dato. Diez
   pulsaciones guiadas antes de la primera tanda cronometrada.

   NO PUNTÚA. No cuenta pulsaciones, no mide precisión y no entra en la sesión: es la
   demostración, y medir al usuario mientras se le explica algo sería medirlo antes de
   enseñarle.

   TODOS LOS CUADROS SON GRANDES; EN EL ACTIVO LO QUE CRECE ES LA LETRA.

   Los diez van a 76 px, casi el doble de los 46 originales: a ese tamaño el tutorial es
   lo único que hay en pantalla, que es lo que corresponde cuando se está presentando una
   tecla nueva. Y el ACTIVO apenas se agranda —1,08— mientras su letra sube de 58 a 70.

   Esa asimetría es deliberada y costó un intento entender por qué: si el cuadro activo
   crece mucho, empuja a los vecinos y la fila se desordena en cada pulsación. Creciendo
   la LETRA se señala igual de fuerte cuál toca, sin que nada se mueva de sitio.

   La separación queda en 10 px y no en 18 por aritmética: con cuadros de 76 la fila mide
   850 px (10 × 76 + 9 × 10) contra los 911 de interior de la tarjeta. Con 18 se iría a
   922 y el `flex-wrap` la partiría en dos líneas.

   El peso sube a 800: en monoespaciada el `font-bold` de Tailwind (700) se queda corto
   a este tamaño y la letra se ve hueca al lado del borde de 2 px. */
const LADO_CUADRO = 76;
const TAMANO_LETRA = 58;
const GROSOR_LETRA = 800;

/* Una PALABRA no puede ir a 58 px: a ese tamaño no queda margen para separarlas bien y
   `flex-wrap` las parte en dos filas, que es justo lo que rompe la lectura de "estos son
   los cinco que vienen". Las cinco que sirve este tutorial salen del pool de palabras de
   la fila central (las dieciocho más frecuentes, ver `cantidad` en el sembrado); ahí la
   más larga mide 5 letras (`hagas`, `salga`, `salsa`, `falsa`, `gafas`) y no 7 como se
   pensó al principio. A 40 px una palabra de cinco letras mide unos 148 px de
   monoespaciada, así que las cinco caben con margen de sobra incluso con la separación
   más ancha de abajo (SEPARACION_PALABRAS).

   El cuadro deja de ser cuadrado y pasa a crecer con el contenido (`minWidth`), que es lo
   único que cambia respecto de las teclas. */
const TAMANO_PALABRA = 40;
const TAMANO_PALABRA_ACTIVA = 46;
/* El cuadro activo crece POCO y su letra MUCHO: escalar el cuadro empuja a los vecinos,
   y la letra tiene su propio tamaño en vez de estirarse, que la dejaría borrosa. */
const ESCALA_ACTIVA = 1.08;
const TAMANO_LETRA_ACTIVA = 70;

// La separación entre cuadros. Con palabras el ancho lo da el contenido y sobra margen
// (ver la nota de arriba), así que aguantan más aire que las teclas.
const SEPARACION_LETRAS = 10;
const SEPARACION_PALABRAS = 18;

/* EL CUADRO DEL ESPACIO, entre palabra y palabra. Hasta ahora el tutorial de palabras
   pasaba de una a la otra sin que nada representara el espacio, así que se podía terminar
   entero sin tocar la barra espaciadora — y la tanda cronometrada que viene justo después
   sí la exige. Pedido del usuario: un cuadrito chico que también hay que "tocar" con la
   barra espaciadora antes de que la palabra siguiente se vuelva la activa.

   Chico y no del tamaño de una letra: no es un carácter que haya que leer, es el gesto del
   pulgar entre dos palabras. La altura sí iguala a la de las palabras (mismo `LADO_CUADRO`)
   para que la fila quede alineada.

   ⚠️ REESCRITO el 11-sep-2026: con 32/40 px de ancho contra 86 de alto (`LADO_CUADRO+10`)
   se veía como una franja vertical, no como un cuadro — el usuario lo notó de inmediato.
   Más ancho, más cerca de cuadrado, sin llegar al ancho de una palabra: seguiría leyéndose
   como "una casilla más" del tutorial en vez del gesto aparte que es. */
const ANCHO_ESPACIO = 56;
const ANCHO_ESPACIO_ACTIVO = 64;

/* EL DESTELLO DE ERROR. Fallar en el tutorial no penaliza —no cuenta pulsaciones ni entra
   en la sesion— pero hasta ahora tampoco DECIA nada: la tecla equivocada no producia
   ningun efecto y el usuario no podia distinguir 'me equivoque' de 'no se registro la
   pulsacion'. Eso es lo que arregla.

   Dos niveles y no uno: el primer fallo es ambar —un aviso— y del segundo en adelante
   rojo. Insistir en la tecla equivocada significa que no se encontro la correcta, y ahi
   el color tiene que subir de tono; con un solo color, el decimo fallo se ve igual que el
   primero.

   Se SUPERPONE y se va: es un velo encima del cuadro que aparece y se desvanece, no un
   cambio de estado. El cuadro activo conserva su relleno cian debajo, asi que la
   instruccion de cual toca nunca se pierde por haber fallado. */
const AMBAR_FALLO = '#FFC53D';
const ROJO_FALLO = 'var(--color-dificil)';
/* Sube de 0.55 a 0.72 porque el velo dejó de taparle la letra: cuando pasaba por encima,
   subirlo la borraba, así que había que dejarlo a medias y el ámbar salía turbio sobre
   el cian. Ahora el velo solo sustituye el FONDO y puede ser el color que toca. */
const OPACIDAD_AMBAR = 0.72;
const OPACIDAD_ROJO = 0.92;

/* ENTRA RÁPIDO Y SE VA LENTO. La primera versión duraba 550 ms con la cima al 12%, y
   se desvanecía tan deprisa que el color apenas se registraba: para cuando el ojo iba
   al cuadro, ya casi no había nada. Ahora la cima llega en el 8% —unos 90 ms, sigue
   siendo instantáneo— y el resto del segundo se gasta en el desvanecido.

   La SACUDIDA es hacia arriba y de 6 px: un movimiento corto capta la atención sin que
   el cuadro parezca romperse, y hacia arriba porque hacia abajo se lee como 'la tecla
   se hundió', que es justo lo que NO pasó. */
const DURACION_FALLO_MS = 1000;
const SALTO_FALLO_PX = 6;

/* El pulso que señala qué letra toca. Corto a propósito: es un parpadeo que llama la
   atención y se quita de en medio, no una animación que siga corriendo mientras se teclea
   —eso último cansa y encima compite con el destello de fallo. */
const DURACION_LATIDO_MS = 340;

/* El color de reposo de la letra del cuadro activo, resuelto a un valor CONCRETO.

   `inherit` no es un color: la Web Animations API no puede interpolar hacia él, así que
   trataba la transición como discreta —mantenía el blanco todo el trayecto y saltaba al
   final— y la letra seguía blanca medio segundo después de que el fondo ya se hubiera
   apagado. Con un valor real interpola en RGB y la letra se va oscureciendo a la vez que
   el velo se desvanece.

   Se lee del documento y no se escribe a fuego para que siga valiendo si la paleta
   cambia; el respaldo es el valor de hoy de --color-ground. */
const colorDeReposo = () => {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-ground').trim();
  return v || '#060E17';
};

const TutorialTeclas = ({ items, mensaje, captions, esOscuro, onCompletar, onSaltar }: Props) => {
  const [indice, setIndice] = useState(0);
  /* Cuántos caracteres del ítem actual van tecleados. Con teclas sueltas vale siempre 0 y
     el componente se comporta exactamente como antes; con palabras es lo que deja avanzar
     letra a letra dentro del mismo cuadro. */
  const [letra, setLetra] = useState(0);
  /* Terminaste la palabra `indice` y el cuadrito del espacio que sigue es el activo: ya no
     se compara contra `item[letra]`, se compara contra la barra espaciadora sola. Solo
     tiene sentido con palabras — con teclas sueltas nunca se enciende. */
  const [enEspacio, setEnEspacio] = useState(false);
  const hayPalabras = items.some((i) => i.length > 1);
  // El velo del cuadro que toca ahora. Solo el activo lo lleva.
  const veloRef = useRef<HTMLSpanElement | null>(null);
  // El velo del cuadrito de espacio activo — mismo mecanismo, elemento aparte.
  const espacioVeloRef = useRef<HTMLSpanElement | null>(null);
  /* La LETRA que toca pulsar dentro del cuadro activo. En un ítem de una tecla es el ítem
     entero; en una palabra es una sola de sus letras, y ahí está la razón de que exista:
     hasta ahora el fallo pintaba de blanco la palabra completa y el usuario no podía saber
     por cuál de las siete letras iba. */
  const letraActualRef = useRef<HTMLSpanElement | null>(null);
  // Fallos seguidos EN ESTA tecla. Vuelve a cero al acertar.
  const fallosRef = useRef(0);

  /* Con la Web Animations API y no con una clase CSS, por el mismo motivo que la sacudida
     de los carriles de la lluvia: hay que poder RE-disparar la misma animacion en fallos
     seguidos, y volver a poner una clase que ya esta no reinicia nada. */
  const destellarFallo = useCallback((fallos: number) => {
    const el = veloRef.current;
    if (!el || typeof el.animate !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const primero = fallos <= 1;
    el.style.background = primero ? AMBAR_FALLO : ROJO_FALLO;
    el.animate(
      [
        { opacity: 0 },
        { opacity: primero ? OPACIDAD_AMBAR : OPACIDAD_ROJO, offset: 0.08 },
        { opacity: primero ? OPACIDAD_AMBAR : OPACIDAD_ROJO, offset: 0.25 },
        { opacity: 0 },
      ],
      { duration: DURACION_FALLO_MS, easing: 'ease-out' },
    );

    /* A BLANCO **SOLO LA LETRA QUE TOCA**, con EXACTAMENTE los mismos tiempos que el velo.

       Antes se animaba el CUADRO entero, así que en una palabra se ponían blancas las siete
       letras a la vez y el aviso no decía nada sobre dónde estabas. Pintando solo la que
       hay que pulsar, el fallo señala además la respuesta.

       Costó dos intentos que el color y el velo se fueran a la vez, y el segundo fallo no
       era de tiempos: aunque los fotogramas ya coincidían —0, 0.08, 0.25, 1— el último era
       `inherit`, y eso hace la transición DISCRETA. Con el color de reposo resuelto a un
       valor concreto la interpolación es real y los dos se apagan juntos.

       El salto vive en esta misma animación porque comparte elemento con el color, pero se
       acaba en el 25%: es un tirón, no un desplazamiento. */
    const letra = letraActualRef.current;
    if (letra) {
      const reposo = colorDeReposo();
      letra.animate(
        [
          { color: reposo, transform: 'scale(1) translateY(0)' },
          { color: '#FFFFFF',
            transform: `scale(1.15) translateY(-${SALTO_FALLO_PX}px)`,
            offset: 0.08 },
          { color: '#FFFFFF', transform: 'scale(1) translateY(0)', offset: 0.25 },
          { color: reposo, transform: 'scale(1) translateY(0)' },
        ],
        { duration: DURACION_FALLO_MS, easing: 'ease-out' },
      );
    }
  }, []);

  /* Mismo destello que destellarFallo, pero sobre el cuadrito del espacio: no hay ninguna
     "letra" que pintar de blanco, así que es la mitad de simple. */
  const destellarFalloEspacio = useCallback((fallos: number) => {
    const el = espacioVeloRef.current;
    if (!el || typeof el.animate !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const primero = fallos <= 1;
    el.style.background = primero ? AMBAR_FALLO : ROJO_FALLO;
    el.animate(
      [
        { opacity: 0 },
        { opacity: primero ? OPACIDAD_AMBAR : OPACIDAD_ROJO, offset: 0.08 },
        { opacity: primero ? OPACIDAD_AMBAR : OPACIDAD_ROJO, offset: 0.25 },
        { opacity: 0 },
      ],
      { duration: DURACION_FALLO_MS, easing: 'ease-out' },
    );
  }, []);

  /* EL LATIDO DE LA LETRA QUE TOCA. Un pulso corto cada vez que cambia cuál es.

     En una palabra no basta con atenuar lo ya tecleado: la letra siguiente es simplemente
     "la primera que no está apagada", y eso hay que buscarlo con la vista. Un crecimiento
     de 340 ms la señala sin que haya que leer la palabra entera, que es justo lo que se
     pierde cuando el usuario todavía está aprendiendo dónde queda cada tecla.

     Va con la Web Animations API por lo mismo que el resto del archivo: hay que poder
     RE-disparar la misma animación en letras seguidas, y volver a poner una clase que ya
     está no reinicia nada. `transform` sobre un `inline-block` no descoloca a las vecinas,
     así que la palabra no se mueve mientras el pulso corre. */
  useEffect(() => {
    const el = letraActualRef.current;
    if (!el || typeof el.animate !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    /* Se cancela lo que hubiera antes en ESTE elemento. Dos motivos: el destello de un
       fallo anterior ya no viene a cuento —la letra cambió porque se acertó— y, sin esto,
       cada cambio deja su animación viva y se van apilando (medido: tres corriendo a la
       vez sobre la misma letra). Visualmente gana la última, así que no se veía; es
       basura acumulándose. */
    el.getAnimations().forEach((a) => a.cancel());
    el.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.28)', offset: 0.35 },
        { transform: 'scale(1)' },
      ],
      { duration: DURACION_LATIDO_MS, easing: 'ease-out' },
    );
  }, [indice, letra]);

  useEffect(() => {
    const manejar = (e: KeyboardEvent) => {
      // Las repeticiones automáticas del sistema no son pulsaciones: ver la nota de
      // e.repeat en CursoPracticaView.
      if (e.repeat) return;
      /* Enter salta el tutorial, y NO el espacio. El espacio es una tecla del ejercicio:
         si saltara con espacio, la misma pulsación que cierra el tutorial se colaría como
         primera pulsación del latido 1 y contaría en la precisión. */
      if (e.key === 'Enter') {
        e.preventDefault();
        onSaltar();
        return;
      }

      /* Esperando el espacio entre dos palabras: acá no hay `item[letra]` contra qué
         comparar, se compara contra la barra espaciadora sola. Cualquier otra tecla falla
         igual que una letra equivocada, pero sobre el cuadrito del espacio y no sobre la
         palabra — que ya quedó marcada como hecha. */
      if (enEspacio) {
        if (e.ctrlKey || e.metaKey) return;
        if (e.altKey && !e.getModifierState('AltGraph')) return;
        e.preventDefault();
        if (e.key === ' ') {
          fallosRef.current = 0;
          setEnEspacio(false);
          setLetra(0);
          setIndice(indice + 1);
          return;
        }
        fallosRef.current += 1;
        destellarFalloEspacio(fallosRef.current);
        return;
      }

      // Los atajos del navegador y las teclas sin carácter no son intentos fallidos.
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey) return;
      if (e.altKey && !e.getModifierState('AltGraph')) return;

      const item = items[indice];
      if (!item) return;
      const esperada = item[letra];
      if (!esperada) return;
      e.preventDefault();

      /* Fallar no penaliza NI retrocede: el tutorial se pasa acertando, y si el usuario
         pulsa otra cosa simplemente no avanza. Es la única parte del Curso donde
         equivocarse no tiene ningún costo, y es a propósito. Lo que sí hace ahora es
         AVISAR — ver la nota del destello. */
      if (e.key.toLowerCase() !== esperada.toLowerCase()) {
        fallosRef.current += 1;
        destellarFallo(fallosRef.current);
        return;
      }

      fallosRef.current = 0;

      /* Dentro del ítem primero, y solo al terminarlo se pasa al siguiente. Con teclas
         sueltas la primera rama nunca se cumple y el flujo es el de siempre. */
      if (letra + 1 < item.length) {
        setLetra(letra + 1);
        return;
      }

      /* Palabra terminada. Si viene otra detrás y estamos en modo palabras, primero el
         cuadrito del espacio — saltar directo a la palabra siguiente es lo que enseñaba a
         teclear todo pegado. Con teclas sueltas, o en la última palabra, no hay espacio que
         marcar y el flujo sigue igual que siempre. */
      const siguiente = indice + 1;
      if (hayPalabras && siguiente < items.length) {
        setEnEspacio(true);
        return;
      }

      setLetra(0);
      setIndice(siguiente);
      if (siguiente >= items.length) onCompletar();
    };

    window.addEventListener('keydown', manejar);
    return () => window.removeEventListener('keydown', manejar);
  }, [indice, letra, enEspacio, items, hayPalabras, onCompletar, onSaltar,
      destellarFallo, destellarFalloEspacio]);

  return (
    <div className="flex flex-col items-center gap-5">
      <p className={`text-center ${hayPalabras ? 'text-xl font-bold' : 'text-sm'} ${
        hayPalabras
          ? (esOscuro ? 'text-white' : 'text-slate-900')
          : (esOscuro ? 'text-gris-texto' : 'text-slate-500')
      }`}>
        {mensaje ?? 'Pulsa estas diez teclas para empezar. Sin prisa: aquí no se mide nada.'}
      </p>
      {mensaje && (
        <p className={`-mt-3 text-center text-base ${esOscuro ? 'text-gris-texto' : 'text-slate-500'}`}>
          Sin prisa: aquí no se mide nada.
        </p>
      )}

      {/* `py-3` deja sitio para que el cuadro activo crezca sin recortarse contra el borde
          de la fila. El hueco sale de SEPARACION_LETRAS/SEPARACION_PALABRAS (ver la nota
          de arriba de los tamaños). */}
      <div className="flex flex-wrap items-center justify-center py-3"
        style={{ gap: hayPalabras ? SEPARACION_PALABRAS : SEPARACION_LETRAS }}>
        {items.map((item, i) => {
          // Con el espacio activo la palabra `indice` ya está hecha: lo que falta es el
          // espacio, no ella.
          const hecha = i < indice || (i === indice && enEspacio);
          const actual = i === indice && !enEspacio;
          const tamano = hayPalabras
            ? (actual ? TAMANO_PALABRA_ACTIVA : TAMANO_PALABRA)
            : (actual ? TAMANO_LETRA_ACTIVA : TAMANO_LETRA);
          // El cuadrito de espacio que sigue a ESTA palabra, si no es la última.
          const espacioActivo = hayPalabras && enEspacio && i === indice;
          const espacioHecho = hayPalabras && i < indice;
          return (
            <Fragment key={i}>
            <div
              aria-current={actual ? 'step' : undefined}
              className="relative flex items-center justify-center rounded-2xl border-2 font-mono transition-all"
              style={{
                /* Cuadrado con una tecla; con palabras crece a lo ancho y el mínimo solo
                   evita que "la" o "da" queden como una pastilla diminuta al lado de
                   "hagas". El alto no cambia: es lo que mantiene la fila alineada. */
                width: hayPalabras ? undefined : LADO_CUADRO,
                minWidth: LADO_CUADRO,
                paddingLeft: hayPalabras ? 14 : 0,
                paddingRight: hayPalabras ? 14 : 0,
                height: LADO_CUADRO + 10,
                fontSize: tamano,
                fontWeight: GROSOR_LETRA,
                transform: actual ? `scale(${ESCALA_ACTIVA})` : undefined,
                zIndex: actual ? 2 : undefined,
                // El actual con relleno macizo, igual que la tecla esperada del teclado:
                // el usuario aprende un solo lenguaje de "esto es lo que toca ahora".
                borderColor: actual
                  ? 'var(--color-cian)'
                  : hecha
                    ? 'transparent'
                    : (esOscuro ? 'rgba(255,255,255,0.10)' : '#E2E8F0'),
                background: actual
                  ? 'var(--color-cian)'
                  : hecha
                    ? (esOscuro ? 'rgba(0,241,253,0.10)' : '#ECFDF5')
                    : 'transparent',
                color: actual
                  ? 'var(--color-ground)'
                  : hecha
                    ? (esOscuro ? 'var(--color-cian)' : '#059669')
                    : (esOscuro ? 'var(--color-faint)' : '#CBD5E1'),
                boxShadow: actual ? '0 0 0 5px rgba(0,241,253,0.18)' : undefined,
              }}>
              {/* El velo del fallo. Solo lo lleva el cuadro activo: es el único donde
                  se puede fallar, y montarlo en los diez sería tener nueve elementos
                  esperando un evento que nunca les llega.

                  VA DETRÁS DE LA LETRA. Un elemento `absolute` se pinta por encima del
                  texto en flujo normal aunque vaya antes en el DOM, así que el velo le
                  caía encima y la letra blanca salía apagada bajo una capa de ámbar. Con
                  el velo en z-0 y la letra en z-10 el color sustituye solo el FONDO, que
                  es lo único que tiene que cambiar: la letra ya se pone blanca sola. */}
              {actual && (
                <span
                  ref={veloRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-0 rounded-2xl"
                  style={{ opacity: 0 }}
                />
              )}
              {/* TRES TRAMOS en el cuadro activo: lo ya tecleado se apaga, LO QUE TOCA va a
                  plena intensidad y late, y lo que viene después queda a media luz. Sin el
                  tramo del medio la letra siguiente era "la primera que no está apagada", y
                  eso hay que buscarlo con la vista.

                  El `inline-block` no es decorativo: es lo que deja que el pulso escale la
                  letra sin empujar a las de al lado. En los cuadros no activos no hay
                  progreso que marcar, así que va el ítem entero de una pieza. */}
              <span className="relative z-10 whitespace-pre">
                {actual
                  ? (
                    <>
                      <span style={{ opacity: 0.4 }}>{item.slice(0, letra)}</span>
                      <span ref={letraActualRef} className="inline-block">
                        {item[letra]}
                      </span>
                      <span style={{ opacity: item.length > 1 ? 0.7 : 1 }}>
                        {item.slice(letra + 1)}
                      </span>
                    </>
                  )
                  : item}
              </span>
            </div>
            {hayPalabras && i < items.length - 1 && (
              <div
                aria-hidden="true"
                className="relative flex shrink-0 items-center justify-center rounded-xl border-2 transition-all"
                style={{
                  width: espacioActivo ? ANCHO_ESPACIO_ACTIVO : ANCHO_ESPACIO,
                  height: LADO_CUADRO + 10,
                  borderColor: espacioActivo
                    ? 'var(--color-cian)'
                    : espacioHecho
                      ? 'transparent'
                      : (esOscuro ? 'rgba(255,255,255,0.10)' : '#E2E8F0'),
                  background: espacioActivo
                    ? 'var(--color-cian)'
                    : espacioHecho
                      ? (esOscuro ? 'rgba(0,241,253,0.10)' : '#ECFDF5')
                      : 'transparent',
                }}>
                {espacioActivo && (
                  <span
                    ref={espacioVeloRef}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-0 rounded-xl"
                    style={{ opacity: 0 }}
                  />
                )}
                <Icono nombre="space_bar" tamano={espacioActivo ? 20 : 16} className="relative z-10"
                  style={{
                    color: espacioActivo
                      ? 'var(--color-ground)'
                      : espacioHecho
                        ? (esOscuro ? 'var(--color-cian)' : '#059669')
                        : (esOscuro ? 'var(--color-faint)' : '#CBD5E1'),
                  }} />
              </div>
            )}
            </Fragment>
          );
        })}
      </div>

      {/* La leyenda del ítem activo ("Meñique izquierdo"...). Sin `-mt-2` quedaba pegada
          al hueco que ya deja `gap-5` del contenedor, y con dos leyendas de largo distinto
          el botón de abajo saltaba de sitio — por eso tiene su propia altura mínima. */}
      {captions && (
        <p className="-mt-2 flex min-h-[1.5rem] items-center justify-center text-center text-base font-semibold"
          style={{ color: 'var(--color-cian)' }}>
          {captions[indice] ?? ''}
        </p>
      )}

      <button
        onClick={onSaltar}
        className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
          esOscuro
            ? 'border-white/10 bg-carta text-gris-texto hover:text-white'
            : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600'
        }`}>
        <span className="rounded border border-current px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
          Enter
        </span>
        {hayPalabras ? 'Saltar' : 'Saltar el tutorial'}
      </button>
    </div>
  );
};

export default TutorialTeclas;
