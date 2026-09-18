interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

const Card = ({ children, className = '', padding = true }: CardProps) => {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 ${padding ? 'p-6' : ''} ${className}`}
      style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.03)' }}>
      {children}
    </div>
  );
};

export default Card;