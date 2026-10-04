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
    'from-blue-600 to-indigo-800',
    'from-violet-600 to-purple-800',
    'from-cyan-600 to-blue-800',
    'from-emerald-600 to-teal-800',
    'from-amber-600 to-orange-800',
    'from-rose-600 to-pink-800',
    'from-fuchsia-600 to-indigo-800',
  ];
  let hash = 0;
  for (let i = 0; i < idOrName.length; i++) {
    hash = idOrName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}
