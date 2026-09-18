import type { NgramStatsRequest, TeclaStatsRequest } from '../../types';
import type { ResultadoLatido } from './latidos';

/* RETOMAR UN NODO DEL CURSO DESPUÉS DE RECARGAR LA PÁGINA.

   El problema que resuelve: un nodo de Fundamentos son un tutorial y cuatro tandas, y hasta
   ahora recargar lo devolvía entero al tutorial. Quien iba por la tercera tanda y quería
   repetirla no tenía forma de hacerlo sin rehacer el nodo desde cero — que es justo lo que
   hace que nadie lo repita.

   ===== POR QUÉ `pagehide` Y NO GUARDAR TODO EL RATO =====

   Hay que distinguir dos cosas que desde React se ven casi iguales: RECARGAR la página
   (retoma donde ibas) y SALIRSE del ejercicio (vuelve al tutorial). La diferencia está en
   `pagehide`: se dispara cuando el documento se descarga de verdad —F5, cerrar la pestaña,
   navegar fuera del sitio— y NO se dispara cuando la app navega a otra ruta, porque ahí el
   documento es el mismo.

   Así que no se guarda continuamente: se guarda UNA vez, en el momento en que la página se
   va. Salir del ejercicio por la app no escribe nada y no hay nada que retomar, que es
   exactamente lo pedido. Y de paso desaparecen dos problemas: el estado nunca queda a medio
   escribir, y el doble montaje de React en modo estricto no puede borrar nada porque no hay
   nada guardado todavía.

   ===== Y POR QUÉ SE CONSUME AL LEERLO =====

   `restaurar` borra la entrada en cuanto la devuelve. Si no, quedaría ahí para la próxima
   vez que se entrase a ese mismo nodo —ya no por recarga, sino entrando a propósito— y el
   usuario se encontraría a mitad de un nodo que creía empezar de cero. Una entrada guardada
   vale para exactamente una recarga; la siguiente recarga vuelve a escribir la suya.

   Vive en `sessionStorage` y no en `localStorage` a propósito: es estado de una sesión de
   pestaña, no una preferencia. Cerrar la pestaña lo tira, que es lo correcto. */

export interface EstadoNodo {
  version: number;
  ejercicioId: number;
  grupo: string;
  /* ⚠️ AQUÍ NO SE GUARDA NINGÚN TEXTO, y es una decisión del usuario.

     La primera versión guardaba los latidos enteros para que al recargar apareciera el
     mismo texto que había delante. Se cambió a propósito: **al reiniciar tiene que caer
     una lista de letras distinta**. Repetir la misma cadena letra por letra se memoriza —y
     un drill que se memoriza deja de entrenar la posición de los dedos para entrenar una
     secuencia—, mientras que una tanda nueva del mismo plan mide lo mismo sin ese atajo.

     Así que lo único que se guarda es DÓNDE ibas y CÓMO te fue: el contenido lo vuelve a
     generar el backend en la petición normal de la recarga. */
  indiceLatido: number;
  resultadosLatidos: ResultadoLatido[];
  tiempoNodoMs: number;
  porUltimoIntento: boolean;
  // Lo mismo para los ejercicios servidos por frases (`porTandas`): la posición, no el texto.
  tandaActual: number;
  resultadosTandas: ResultadoLatido[];
  /* La analítica acumulada del nodo. Es la parte que el usuario pidió conservar: son varias
     tandas de pulsaciones y perderlas al recargar dejaría la sesión guardada con solo la
     última. Los Map viajan como array de valores; la clave se reconstruye al volver. */
  teclas: TeclaStatsRequest[];
  ngrams: NgramStatsRequest[];
}

/* Sube cuando cambie la forma de EstadoNodo. Un estado viejo se descarta en vez de
   restaurarse a medias: el usuario pierde una tanda, no ve un ejercicio roto. */
const VERSION = 2;   // v2: dejó de guardar los textos (ver la nota de EstadoNodo)

const clave = (ejercicioId: number | string) => `curso_nodo_${ejercicioId}`;

export const guardarEstadoNodo = (estado: Omit<EstadoNodo, 'version'>) => {
  try {
    sessionStorage.setItem(clave(estado.ejercicioId),
      JSON.stringify({ ...estado, version: VERSION }));
  } catch {
    // sessionStorage puede fallar entero (modo privado, cuota). Sin él se pierde la
    // posibilidad de retomar, que es una comodidad: el ejercicio funciona igual.
  }
};

/* Devuelve el estado guardado para ese nodo y lo BORRA. `null` si no hay, si es de otra
   versión o si está ilegible. */
export const restaurarEstadoNodo = (ejercicioId: number | string): EstadoNodo | null => {
  try {
    const crudo = sessionStorage.getItem(clave(ejercicioId));
    if (!crudo) return null;
    sessionStorage.removeItem(clave(ejercicioId));
    const estado = JSON.parse(crudo) as EstadoNodo;
    if (estado.version !== VERSION) return null;
    if (String(estado.ejercicioId) !== String(ejercicioId)) return null;
    return estado;
  } catch {
    return null;
  }
};

export const olvidarEstadoNodo = (ejercicioId: number | string) => {
  try {
    sessionStorage.removeItem(clave(ejercicioId));
  } catch {
    // Ver guardarEstadoNodo.
  }
};
