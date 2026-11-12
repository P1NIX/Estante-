import { hue } from '../lib/format';

/** Capa gerada a partir do título e do autor (fotos de capa chegam na fase 2). */
export function Cover({ title, author }: { title: string; author: string }) {
  return (
    <div className="cover" style={{ ['--h' as string]: hue(title + author) }}>
      <span className="ct">{title}</span>
      <span className="ca">{author}</span>
    </div>
  );
}
