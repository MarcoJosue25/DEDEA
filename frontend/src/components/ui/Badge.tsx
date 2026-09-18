interface BadgeProps {
  texto: string;
  variante?: 'facil' | 'medio' | 'dificil' | 'bigrama' | 'trigrama' | 'ia';
}

const Badge = ({ texto, variante = 'facil' }: BadgeProps) => {
  const estilos = {
    facil:    'bg-emerald-100 text-emerald-700 border border-emerald-200',
    medio:    'bg-sky-100 text-sky-700 border border-sky-200',
    dificil:  'bg-rose-100 text-rose-700 border border-rose-200',
    bigrama:  'bg-rose-100 text-rose-600',
    trigrama: 'bg-sky-100 text-sky-600',
    ia:       'bg-purple-100 text-purple-700 border border-purple-200',
  };

  return (
    <span className={`text-xs font-bold px-3 py-1 rounded-full ${estilos[variante]}`}>
      {texto}
    </span>
  );
};

export default Badge;