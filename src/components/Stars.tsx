const PATH = 'M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9z';

const Star = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" className={on ? 'on' : ''} aria-hidden="true"><path d={PATH} strokeLinejoin="round" /></svg>
);

export function Stars({ value, big }: { value: number | null; big?: boolean }) {
  if (!value) return <span className="fine">Sem nota</span>;
  return (
    <span className={`stars${big ? ' big' : ''}`} role="img" aria-label={`Nota ${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} on={i <= value} />)}
    </span>
  );
}

/** Nota editável. Tocar na estrela já marcada limpa a nota. */
export function StarsInput({ value, onChange, labelledBy }: { value: number | null; onChange: (v: number | null) => void; labelledBy: string }) {
  return (
    <div className="rating" role="radiogroup" aria-labelledby={labelledBy}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} de 5`}
          className={`star${value && i <= value ? ' on' : ''}`}
          onClick={() => onChange(value === i ? null : i)}
        >
          <Star on={!!value && i <= value} />
        </button>
      ))}
      <span className="fine">{value ? `${value} de 5` : 'Sem nota'}</span>
    </div>
  );
}
