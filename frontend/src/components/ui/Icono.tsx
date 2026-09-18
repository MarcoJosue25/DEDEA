import type { CSSProperties } from 'react';

interface Props {
  // Nombre de la ligadura de Material Symbols, p. ej. "trophy" o "play_arrow".
  nombre: string;
  // Lado en px. Va SIEMPRE en línea — ver la nota de abajo.
  tamano?: number;
  // Relleno del glifo (0 = contorno, 1 = macizo).
  relleno?: boolean;
  className?: string;
  style?: CSSProperties;
}

/* Un icono de Material Symbols con el tamaño que uno pide.

   ⚠️ EL MOTIVO DE QUE ESTE COMPONENTE EXISTA: en esta app las clases de tamaño de
   Tailwind NO tienen ningún efecto sobre un icono. Medido en el navegador el 2-sep-2026:
   `text-[18px]`, `text-[28px]` y hasta `text-7xl` computan todas 24px.

   La causa es la cascada, no un error de escritura. Tailwind v4 emite sus utilidades
   dentro de `@layer utilities`, y la hoja de Material Symbols que se carga desde
   fonts.googleapis.com trae `.material-symbols-outlined { font-size: 24px }` SIN capa.
   El CSS sin capa le gana a cualquier CSS en capa, sin importar el orden ni la
   especificidad — así que la utilidad nunca llega a aplicarse y el fallo es mudo: no hay
   error en consola, el icono simplemente sale de 24px.

   Un `style` en línea sí gana, porque es el estilo del elemento y no una regla de hoja.
   Por eso el tamaño va acá y no en una clase.

   El resto de la app sigue usando `<span className="material-symbols-outlined text-[N]">`
   y por lo tanto sigue mostrando todos sus iconos a 24px. Arreglarlo de golpe cambiaría
   el tamaño de cada icono de cada pantalla, así que es una decisión de diseño aparte —
   está anotada como hallazgo, no aplicada por las nuestras. */
const Icono = ({ nombre, tamano = 24, relleno = false, className = '', style }: Props) => (
  <span
    aria-hidden="true"
    className={`material-symbols-outlined leading-none ${className}`}
    style={{
      fontSize: tamano,
      // Sin esto el glifo reserva la caja de 24px y desalinea todo lo que tenga al lado.
      width: tamano,
      height: tamano,
      fontVariationSettings: `'FILL' ${relleno ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${tamano}`,
      ...style,
    }}>
    {nombre}
  </span>
);

export default Icono;
