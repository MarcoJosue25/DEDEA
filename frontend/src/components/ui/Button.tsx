interface ButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  variante?: 'primary' | 'secondary' | 'outline';
  children: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit';
}

const Button = ({
  onClick,
  disabled = false,
  variante = 'primary',
  children,
  className = '',
  type = 'button',
}: ButtonProps) => {
  const estilos = {
    primary:   'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg hover:shadow-xl hover:-translate-y-1',
    secondary: 'bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50',
    outline:   'border border-slate-200 text-slate-500 hover:border-emerald-400 hover:text-emerald-600',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        px-6 py-3 rounded-full font-bold transition-all active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
        ${estilos[variante]} ${className}
      `}>
      {children}
    </button>
  );
};

export default Button;