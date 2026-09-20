const adjectives = [
  'Быстрый', 'Тихий', 'Мудрый', 'Смелый', 'Весёлый',
  'Добрый', 'Храбрый', 'Ловкий', 'Грозный', 'Спокойный',
  'Яркий', 'Тёмный', 'Золотой', 'Серебряный', 'Огненный',
  'Ледяной', 'Громовой', 'Ветреный', 'Звёздный', 'Лунный',
  'Солнечный', 'Таинственный', 'Невидимый', 'Могучий', 'Свободный',
  'Swift', 'Silent', 'Brave', 'Mighty', 'Cosmic',
  'Neon', 'Pixel', 'Cyber', 'Retro', 'Hyper'
];

const nouns = [
  'Волк', 'Тигр', 'Орёл', 'Дракон', 'Феникс',
  'Лев', 'Медведь', 'Ястреб', 'Пантера', 'Лис',
  'Кот', 'Пёс', 'Сова', 'Дельфин', 'Кит',
  'Тигр', 'Рысь', 'Ворон', 'Сокол', 'Змей',
  'Wolf', 'Tiger', 'Eagle', 'Dragon', 'Phoenix',
  'Lion', 'Hawk', 'Panther', 'Fox', 'Owl'
];

export function generateNickname(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

export function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Extracts a clean room ID from a raw string, URL (e.g. https://rvxis.site?room=8BH5DA),
 * query parameter, or path.
 */
export function extractRoomId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  // 1. If it's a URL or contains query parameters
  try {
    const urlString = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://dummy.com/${trimmed.startsWith('?') ? '' : '?'}${trimmed}`;
    const url = new URL(urlString);
    const roomParam = url.searchParams.get('room');
    if (roomParam) {
      return roomParam.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    }

    // Check path segments (e.g. /room/8BH5DA or /8BH5DA)
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      const last = segments[segments.length - 1];
      if (last.length >= 4 && last.length <= 10 && /^[a-zA-Z0-9]+$/.test(last)) {
        return last.toUpperCase().slice(0, 10);
      }
    }
  } catch {}

  // 2. Regex fallback for room=XXXX
  const match = trimmed.match(/[?&]room=([a-zA-Z0-9]+)/i);
  if (match && match[1]) {
    return match[1].toUpperCase().slice(0, 10);
  }

  // 3. Raw input: keep only alphanumeric characters, uppercase, up to 10 chars
  return trimmed.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
}
