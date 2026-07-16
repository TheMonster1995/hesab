// Light/dark theme: follows the OS by default, remembers an explicit choice.
const KEY = 'hesab.theme';

export function initTheme(): void {
  const saved = localStorage.getItem(KEY);
  const dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
}

export function toggleTheme(): boolean {
  const dark = document.documentElement.classList.toggle('dark');
  localStorage.setItem(KEY, dark ? 'dark' : 'light');
  return dark;
}

export function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}
