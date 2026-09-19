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
