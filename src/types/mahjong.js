// 长沙麻将牌型与规则类型定义

export const SUITS = {
  WAN: 'wan',   // 万
  TIAO: 'tiao', // 条
  TONG: 'tong'  // 筒
};

export const SUIT_NAMES = {
  wan: '万',
  tiao: '条',
  tong: '筒'
};

export const NUMBER_NAMES = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

// 长沙麻将中特殊的“将牌”：2、5、8
export const JIANG_NUMBERS = [2, 5, 8];

export function isJiangTile(tile) {
  if (!tile) return false;
  return JIANG_NUMBERS.includes(tile.value);
}

// 玩家方位
export const PLAYERS = [
  { id: 0, name: '我 (东家)', isHuman: true, position: 'bottom' },
  { id: 1, name: '下家 (南家)', isHuman: false, position: 'right' },
  { id: 2, name: '对家 (西家)', isHuman: false, position: 'top' },
  { id: 3, name: '上家 (北家)', isHuman: false, position: 'left' }
];

export const WIND_NAMES = ['东', '南', '西', '北'];

// 默认规则配置
export const DEFAULT_CONFIG = {
  // 开杠摸牌数：2只 或 4只
  kongDrawCount: 2, // 2 | 4
  // 开杠需不需要将：true(需要有258将) | false(不需要)
  kongRequiresJiang: true,
  // 起手胡牌选项（包括哪些可以选择）
  startingHu: {
    daSiXi: true,     // 大四喜 (起手有4张相同的牌)
    banBanHu: true,    // 板板胡 (起手无2、5、8)
    queYiSe: true,     // 缺一色 (起手缺少一门花色)
    liuLiuShun: true   // 六六顺 (起手有两组3张相同的牌)
  },
  // 抓鸟数量：0(不抓) | 2 | 4
  birdCount: 2,
  // 辅助功能
  autoSort: true,
  showHints: true,
  soundEnabled: true,
  aiSpeed: 700 // 毫秒
};

// 生成长沙麻将标准一副牌：108张（万、条、筒各36张，无字牌花牌）
export function generateDeck() {
  const deck = [];
  let idCounter = 1;

  const suits = [SUITS.WAN, SUITS.TIAO, SUITS.TONG];
  suits.forEach(suit => {
    for (let value = 1; value <= 9; value++) {
      for (let copy = 0; copy < 4; copy++) {
        deck.push({
          id: idCounter++,
          suit,
          value,
          name: `${NUMBER_NAMES[value]}${SUIT_NAMES[suit]}`,
          isJiang: JIANG_NUMBERS.includes(value)
        });
      }
    }
  });

  // 洗牌 Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// 牌序排序比较函数：按 万 -> 条 -> 筒，同花色按点数 1 -> 9
export function compareTiles(a, b) {
  const suitOrder = { [SUITS.WAN]: 1, [SUITS.TIAO]: 2, [SUITS.TONG]: 3 };
  if (suitOrder[a.suit] !== suitOrder[b.suit]) {
    return suitOrder[a.suit] - suitOrder[b.suit];
  }
  return a.value - b.value;
}

// 牌转换为唯一特征 key，例如 'wan-5'
export function getTileKey(tile) {
  if (!tile) return '';
  return `${tile.suit}-${tile.value}`;
}
