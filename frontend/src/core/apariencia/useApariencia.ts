import { useCallback, useEffect, useState } from 'react';
import { leerApariencia, guardarApariencia, type Apariencia } from './apariencia';

/* Evento propio para que dos componentes montados a la vez (por ejemplo el selector
   del header y la vista de práctica) se enteren del cambio. El evento 'storage' del
   navegador NO sirve acá: solo se dispara en OTRAS pestañas, nunca en la que escribe. */
const EVENTO = 'dedea:apariencia';

export const useApariencia = () => {
  const [apariencia, setEstado] = useState<Apariencia>(leerApariencia);

  const cambiar = useCallback((valor: Apariencia) => {
    guardarApariencia(valor);
    setEstado(valor);
    window.dispatchEvent(new CustomEvent<Apariencia>(EVENTO, { detail: valor }));
  }, []);

  useEffect(() => {
    const alCambiar = (e: Event) => setEstado((e as CustomEvent<Apariencia>).detail);
    window.addEventListener(EVENTO, alCambiar);
    return () => window.removeEventListener(EVENTO, alCambiar);
  }, []);

  return { apariencia, cambiar };
};
