import { pct } from '../lib/format';

export function Progress({ page, total, label }: { page: number; total: number | null; label: string }) {
  const p = pct(page, total);
  return (
    <div className="bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p}>
      <div className="fill" style={{ width: `${p}%` }} />
    </div>
  );
}
