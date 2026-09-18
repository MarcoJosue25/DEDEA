interface AroProgresoProps {
  porcentaje: number; // 0-100
  esOscuro?: boolean;
  tamano?: number; // diámetro en px
}

// Aro circular de progreso: alternativa/complemento visual al contador de caracteres,
// mismo dato (indice / texto.length) que ya se calcula en CursoPracticaView.
const AroProgreso = ({ porcentaje, esOscuro, tamano = 56 }: AroProgresoProps) => {
  const radio = (tamano - 6) / 2;
  const circunferencia = 2 * Math.PI * radio;
  const pct = Math.max(0, Math.min(100, porcentaje));
  const offset = circunferencia * (1 - pct / 100);
  const centro = tamano / 2;

  return (
    <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
      <svg width={tamano} height={tamano} className="-rotate-90">
        <circle
          cx={centro} cy={centro} r={radio} fill="none"
          strokeWidth={4}
          className={esOscuro ? 'stroke-white/10' : 'stroke-slate-200'}
        />
        <circle
          cx={centro} cy={centro} r={radio} fill="none"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={offset}
          className={`transition-[stroke-dashoffset] duration-300 ${esOscuro ? 'stroke-cian' : 'stroke-emerald-500'}`}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums ${
        esOscuro ? 'text-(--sup-texto)' : 'text-slate-700'
      }`}>
        {Math.round(pct)}%
      </span>
    </div>
  );
};

export default AroProgreso;
