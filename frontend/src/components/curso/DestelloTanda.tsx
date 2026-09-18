import Icono from '../ui/Icono';

interface Props {
  // Precisión de la tanda que acaba de terminar, 0-100.
  precision: number;
  esOscuro: boolean;
}

/* El corte entre una frase y la siguiente: un destello de segundo y medio.

   NO ES UN RESUMEN NI UN MODAL. ResumenLatido para el ejercicio, tapa la tarjeta y espera
   un Enter, y eso está bien cuando cierra una tanda cronometrada de las que deciden
   estrellas. Aquí el corte es solo de lectura —tres frases que sin punto se leerían como un
   párrafo corrido— así que interrumpir con una ventana costaría más de lo que aporta.

   Aparece, dice una cosa y se va sola mientras el texto cambia por debajo. El usuario no
   tiene que hacer nada: si estaba escribiendo rápido, apenas lo registra; si venía dudando,
   le da un segundo de aire. Es el mismo gesto que un aviso al pasar el ratón.

   El umbral es el del nivel (85%), el mismo que gobierna las estrellas y la alerta de
   ResumenLatido: si aquí felicitara con un 70% estaría contradiciendo lo que el mismo curso
   le dirá al terminar. */
const UMBRAL_ELOGIO = 85;

const DestelloTanda = ({ precision, esOscuro }: Props) => {
  const bien = precision >= UMBRAL_ELOGIO;
  const color = bien
    ? (esOscuro ? 'var(--color-cian)' : '#059669')
    : 'var(--color-oro)';

  return (
    /* `pointer-events-none`: el destello nunca puede robar un clic ni el foco, porque el
       ejercicio sigue vivo debajo aunque el texto se esté cambiando. */
    <div className="destello-tanda pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="flex items-center gap-3 rounded-2xl border px-7 py-5"
        style={{
          borderColor: color,
          background: esOscuro ? 'rgba(6,14,23,0.92)' : 'rgba(255,255,255,0.95)',
          boxShadow: `0 0 0 6px ${bien ? 'rgba(0,241,253,0.10)' : 'rgba(255,197,61,0.12)'}`,
        }}>
        <Icono nombre={bien ? 'check_circle' : 'target'} tamano={34} relleno style={{ color }} />
        <p className="text-2xl font-bold" style={{ color }}>
          {bien ? '¡Muy bien!' : 'Casi, prioriza tu precisión'}
        </p>
      </div>
    </div>
  );
};

export default DestelloTanda;
