import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Level } from '../core/mastery';

type Variant = 'primary' | 'secondary' | 'ghost';

export function Button({ variant = 'secondary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={`btn btn-${variant} ${className}`.trim()} {...rest} />;
}

export function Chip({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  return <span className={mono ? 'chip num' : 'chip'}>{children}</span>;
}

/** Renders `backtick` spans in content copy as inline code. */
export function Rich({ text }: { text: string }) {
  return <>{text.split(/`([^`]+)`/).map((part, i) => (i % 2 === 1 ? <code key={i} className="code-inline">{part}</code> : part))}</>;
}

const FILL: Record<Level, string> = { insufficient: 'fill-none', weak: 'fill-weak', learning: 'fill-learning', solid: 'fill-solid' };

export function MasteryBar({ value, level }: { value: number | null; level: Level }) {
  return (
    <div className="bar" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={value ?? undefined}>
      <div className={`bar-fill ${FILL[level]}`} style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
    </div>
  );
}

export type SegmentState = 'correct' | 'wrong' | 'current' | 'todo';

export function Segments({ states }: { states: SegmentState[] }) {
  return (
    <div className="segments" style={{ gridTemplateColumns: `repeat(${states.length}, minmax(0, 1fr))` }}>
      {states.map((s, i) => (
        <span key={i} className={`seg seg-${s}`} />
      ))}
    </div>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stack" style={{ gap: 0 }}>
      <span className="stat">{value}</span>
      <span className="muted">{label}</span>
    </div>
  );
}
