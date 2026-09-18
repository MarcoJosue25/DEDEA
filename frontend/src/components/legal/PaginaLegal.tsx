import type { ReactNode } from 'react';
import { useApariencia } from '../../core/apariencia/useApariencia';

export interface SeccionLegal {
  titulo: string;
  contenido: ReactNode;
}

interface PaginaLegalProps {
  titulo: string;
  actualizada: string;
  secciones: SeccionLegal[];
}

/* El molde de Privacidad y Términos. Va entero dentro de una tarjeta con sus propios
   colores porque el fondo de la página no cambia con la apariencia: sin la tarjeta, el
   texto oscuro de la apariencia clara quedaría sobre el degradado oscuro.

   Los enlaces y las listas se estilan desde acá (selectores `[&_a]`, `[&_ul]`) para que
   cada página escriba solo su contenido y no tenga que saber de apariencias. */
const PaginaLegal = ({ titulo, actualizada, secciones }: PaginaLegalProps) => {
  const { apariencia } = useApariencia();
  const esOscuro = apariencia === 'oscuro';

  return (
    <article
      className={`mx-auto max-w-3xl rounded-2xl border p-8 md:p-10 ${
        esOscuro ? 'border-vidrio-borde bg-vidrio' : 'border-slate-200 bg-white'}`}>
      <h1 className={`text-3xl font-bold ${esOscuro ? 'text-white' : 'text-slate-800'}`}>{titulo}</h1>
      <p className={`mt-2 text-sm ${esOscuro ? 'text-gris-texto' : 'text-slate-500'}`}>
        Última actualización: {actualizada}
      </p>

      <div className="mt-8 flex flex-col gap-7">
        {secciones.map((s) => (
          <section key={s.titulo}>
            <h2 className={`mb-2 text-lg font-bold ${esOscuro ? 'text-cian' : 'text-slate-800'}`}>
              {s.titulo}
            </h2>
            <div className={`flex flex-col gap-2 text-[15px] leading-relaxed
              [&_a]:font-semibold [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1
              ${esOscuro ? 'text-gris-texto [&_a]:text-cian' : 'text-slate-600 [&_a]:text-sky-700'}`}>
              {s.contenido}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
};

export default PaginaLegal;
