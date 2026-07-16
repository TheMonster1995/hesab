import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { isDark, toggleTheme } from './theme';

// Small set of Tailwind-styled primitives shared across screens.

export function Screen({ children }: { children: ReactNode }) {
  return <div className="flex min-h-full items-center justify-center p-6">{children}</div>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`w-full rounded-2xl border border-line bg-card p-8 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">{children}</p>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-ink outline-none ring-accent/40 focus:border-accent focus:ring-2"
    />
  );
}

export function Button({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="w-full rounded-lg bg-accent px-4 py-2 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'accent' }) {
  const tones = {
    muted: 'border-line text-muted',
    accent: 'border-accent/40 bg-accent/10 text-accent',
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState(isDark());
  return (
    <button
      onClick={() => setDark(toggleTheme())}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className="rounded-lg border border-line px-2.5 py-1.5 text-sm text-muted transition hover:text-ink"
    >
      {dark ? '☾' : '☀'}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
      {message}
    </p>
  );
}
