/* Apariencia de las pantallas de práctica y resultados.

   El degradado del fondo es siempre el mismo; lo que cambia acá es el juego de
   superficies que va encima (tarjetas, teclado, colores de texto). Se implementa
   con variables CSS declaradas en index.css bajo [data-apariencia="..."], así que
   agregar una apariencia nueva es sumar una entrada a esta lista y su bloque de
   variables — sin tocar las vistas. */

export type Apariencia = 'claro' | 'oscuro';

export interface OpcionApariencia {
  id: Apariencia;
  nombre: string;
  descripcion: string;
  /* Colores de la miniatura del selector: [superficie, acento].
     Son solo para la vista previa del panel, no para pintar la pantalla. */
  muestra: [string, string];
}

export const APARIENCIAS: OpcionApariencia[] = [
  {
    id: 'claro',
    nombre: 'Tarjetas claras',
    descripcion: 'Superficies blancas sobre el degradado.',
    muestra: ['#FFFFFF', '#0F172A'],
  },
  {
    id: 'oscuro',
    nombre: 'Tarjetas oscuras',
    descripcion: 'Superficies translúcidas y acentos cian.',
    muestra: ['#0A141C', '#00F1FD'],
  },
];

const CLAVE = 'dedea_apariencia';
const POR_DEFECTO: Apariencia = 'claro';

export const leerApariencia = (): Apariencia => {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === 'claro' || valor === 'oscuro' ? valor : POR_DEFECTO;
  } catch {
    return POR_DEFECTO; // modo privado o storage bloqueado
  }
};

export const guardarApariencia = (valor: Apariencia) => {
  try {
    localStorage.setItem(CLAVE, valor);
  } catch { /* sin storage: la elección dura solo esta sesión */ }
};
