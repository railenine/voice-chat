export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function getAvatarGradient(idOrName: string): string {
  const gradients = [
    'from-slate-800 to-slate-950',
    'from-cyan-950 to-slate-900',
    'from-blue-950 to-slate-900',
    'from-indigo-950 to-slate-900',
    'from-teal-950 to-slate-900',
    'from-sky-950 to-slate-900',
    'from-zinc-800 to-zinc-950',
  ];
  let hash = 0;
  for (let i = 0; i < idOrName.length; i++) {
    hash = idOrName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}
