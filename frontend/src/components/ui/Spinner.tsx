interface SpinnerProps {
  texto?: string;
}

const Spinner = ({ texto = 'Cargando...' }: SpinnerProps) => {
  return (
    <div className="flex justify-center items-center py-24">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-semibold">{texto}</p>
      </div>
    </div>
  );
};

export default Spinner;