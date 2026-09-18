interface CronometroProps {
  ms: number;
  cuentaRegresiva?: boolean;
  /* Formato corto: minutos sin cero a la izquierda ("0:24.35" en vez de "00:24.35").
     Se usa en la práctica de noticias; el resto de las vistas sigue con mm:ss.cc. */
  formatoCorto?: boolean;
  /* Color propio de la vista. Sin esto se usa el del tema claro, que es el que
     esperan las vistas todavía no migradas. */
  claseColor?: string;
}

// Minutos:segundos grandes + centésimas a la mitad de tamaño al costado.
const Cronometro = ({ ms, cuentaRegresiva, formatoCorto, claseColor }: CronometroProps) => {
  const totalMs = Math.max(0, ms);
  const segundos = Math.floor(totalMs / 1000);

  const alerta = cuentaRegresiva && segundos <= 5;
  const color = alerta ? 'text-dificil' : (claseColor ?? 'text-slate-800');

  const centesimas = Math.floor((totalMs % 1000) / 10);
  // formatoCorto: el minuto va sin relleno ("0:24.35"). Pasada la hora crece solo.
  const minutos = Math.floor(segundos / 60);
  const m = formatoCorto ? String(minutos) : String(minutos).padStart(2, '0');
  const s = (segundos % 60).toString().padStart(2, '0');

  return (
    <span className={`font-bold ${color}`}>
      <span className="text-3xl tabular-nums">{m}:{s}</span>
      <span className="ml-0.5 align-top text-base tabular-nums">.{centesimas.toString().padStart(2, '0')}</span>
    </span>
  );
};

export default Cronometro;
