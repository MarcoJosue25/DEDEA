/* Apariencia de las pantallas de práctica y resultados.

   V1 SALE SOLO CON LA OSCURA (decisión del usuario, 19-sep-2026). Hasta entonces había
   dos —tarjetas claras y oscuras— con un selector de paleta en cada ejercicio, y la clara
   era la que veía cualquier usuario nuevo. El selector se borró y la apariencia quedó
   fija acá; la luna del menú avisa que vienen más temas de color.

   Las vistas conservan sus ramas `esOscuro ? … : …`: son ~500 referencias en 36 archivos,
   y borrarlas no cambia nada de lo que se ve. Quedan inalcanzables, y el día que lleguen
   los temas nuevos se reemplazan por variables CSS (index.css, [data-apariencia]) en vez
   de condicionales en el JSX. */

export type Apariencia = 'claro' | 'oscuro';

export const APARIENCIA_V1: Apariencia = 'oscuro';
