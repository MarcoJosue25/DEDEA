import { APARIENCIA_V1, type Apariencia } from './apariencia';

/* Devuelve la apariencia vigente. En V1 es siempre la oscura (ver apariencia.ts); se
   conserva como hook para que las 36 vistas que la leen no cambien, y para que el día
   que vuelva a poder elegirse solo haya que tocar este archivo. Lo que un usuario haya
   guardado antes en `dedea_apariencia` se ignora. */
export const useApariencia = (): { apariencia: Apariencia } => ({ apariencia: APARIENCIA_V1 });
