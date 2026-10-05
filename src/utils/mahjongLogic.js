// 长沙麻将核心算法与判牌规则引擎
import { SUITS, SUIT_NAMES, NUMBER_NAMES, JIANG_NUMBERS, isJiangTile, getTileKey, compareTiles } from '../types/mahjong.js';

/**
 * 统计手牌中各牌的出现数量
 * @param {Array} tiles 
 * @returns {Map<string, { tile: Object, count: number }>}
 */
export function countTiles(tiles) {
  const map = new Map();
  tiles.forEach(t => {
    const key = getTileKey(t);
    if (!map.has(key)) {
      map.set(key, { tile: t, count: 0 });
    }
    map.get(key).count++;
  });
  return map;
}

/**
 * 1. 起手胡检测 (起手小胡)
 * 根据用户设置开关判断：大四喜、板板胡、缺一色、六六顺、一个五、三五三八、三连对、三同、二筒二条
 * @param {Array} handTiles 手牌 (庄家14张，闲家13张)
 * @param {Object} config 游戏规则配置
 * @returns {Array<{ type: string, name: string, desc: string, tiles: Array }>}
 */
export function checkStartingHu(handTiles, config) {
  const result = [];
  if (!handTiles || handTiles.length === 0) return result;

  const ruleConfig = config?.startingHu || {
    daSiXi: true,
    banBanHu: true,
    queYiSe: true,
    liuLiuShun: true,
    yiGeWu: true,
    sanWuSanBa: true,
    sanLianDui: true,
    sanTong: true,
    erTongErTiao: true,
    zhongTuSiXi: true
  };

  const counts = countTiles(handTiles);

  // A. 大四喜：起手有4张相同的牌
  if (ruleConfig.daSiXi) {
    counts.forEach(({ tile, count }) => {
      if (count >= 4) {
        let note = '';
        if (ruleConfig.sanWuSanBa && tile.suit === SUITS.TONG && (tile.value === 5 || tile.value === 8)) {
          note = `（与${tile.value === 5 ? '三个五' : '三个八'}叠加胡2次）`;
        }
        result.push({
          type: 'daSiXi',
          name: '大四喜',
          desc: `起手拥有4张相同的【${tile.name}】${note}`,
          tiles: handTiles.filter(t => getTileKey(t) === getTileKey(tile))
        });
      }
    });
  }

  // B. 板板胡：起手手牌没有任何一张 2、5、8
  if (ruleConfig.banBanHu) {
    const hasJiang = handTiles.some(t => isJiangTile(t));
    if (!hasJiang) {
      result.push({
        type: 'banBanHu',
        name: '板板胡',
        desc: '起手手牌无一张2、5、8将牌',
        tiles: [...handTiles]
      });
    }
  }

  // C. 缺一色：起手手牌至少缺少一门花色 (即最多只有2门花色)
  if (ruleConfig.queYiSe) {
    const suitsPresent = new Set(handTiles.map(t => t.suit));
    if (suitsPresent.size <= 2) {
      const missingSuits = [SUITS.WAN, SUITS.TIAO, SUITS.TONG].filter(s => !suitsPresent.has(s));
      const missingNames = missingSuits.map(s => s === SUITS.WAN ? '万' : s === SUITS.TIAO ? '条' : '筒').join('与');
      result.push({
        type: 'queYiSe',
        name: '缺一色',
        desc: `起手缺少【${missingNames}】门子`,
        tiles: [...handTiles]
      });
    }
  }

  // D. 六六顺：起手手牌有两组刻子 (即两组各有3张相同的牌)
  if (ruleConfig.liuLiuShun) {
    const triplets = [];
    counts.forEach(({ tile, count }) => {
      if (count >= 3) {
        triplets.push(tile);
      }
    });
    if (triplets.length >= 2) {
      const names = triplets.slice(0, 2).map(t => t.name).join('与');
      result.push({
        type: 'liuLiuShun',
        name: '六六顺',
        desc: `起手拥有两组刻子【${names}】`,
        tiles: handTiles.filter(t => triplets.some(trip => getTileKey(trip) === getTileKey(t)))
      });
    }
  }

  // E. 一个五：某一门花色（筒/条/万）起手有且仅有1张牌，且该张牌必须为五
  if (ruleConfig.yiGeWu) {
    const suits = [SUITS.WAN, SUITS.TIAO, SUITS.TONG];
    suits.forEach(suit => {
      const suitTiles = handTiles.filter(t => t.suit === suit);
      if (suitTiles.length === 1 && suitTiles[0].value === 5) {
        result.push({
          type: 'yiGeWu',
          name: '一个五',
          desc: `起手【${SUIT_NAMES[suit]}】门仅有一张牌且为五【${suitTiles[0].name}】`,
          tiles: suitTiles
        });
      }
    });
  }

  // F. 三个五三个八：起手有3个五筒或者3个八筒 (可独立胡牌并与大四喜/六六顺叠加)
  if (ruleConfig.sanWuSanBa) {
    const tong5 = handTiles.filter(t => t.suit === SUITS.TONG && t.value === 5);
    const tong8 = handTiles.filter(t => t.suit === SUITS.TONG && t.value === 8);
    if (tong5.length >= 3) {
      result.push({
        type: 'sanWuSanBa',
        name: '三个五',
        desc: tong5.length >= 4
          ? (ruleConfig.daSiXi ? `起手拥有4个五筒【五筒】×4（与大四喜叠加胡2次）` : `起手拥有4个五筒【五筒】×4`)
          : `起手拥有3个五筒【五筒】×3`,
        tiles: tong5
      });
    }
    if (tong8.length >= 3) {
      result.push({
        type: 'sanWuSanBa',
        name: '三个八',
        desc: tong8.length >= 4
          ? (ruleConfig.daSiXi ? `起手拥有4个八筒【八筒】×4（与大四喜叠加胡2次）` : `起手拥有4个八筒【八筒】×4`)
          : `起手拥有3个八筒【八筒】×3`,
        tiles: tong8
      });
    }
  }

  // G. 三连对：起手拥有同门三副连续的对子 (如 223344条/筒/万)
  if (ruleConfig.sanLianDui) {
    const suits = [SUITS.WAN, SUITS.TIAO, SUITS.TONG];
    suits.forEach(suit => {
      let v = 1;
      while (v <= 7) {
        const p1 = handTiles.filter(t => t.suit === suit && t.value === v);
        const p2 = handTiles.filter(t => t.suit === suit && t.value === v + 1);
        const p3 = handTiles.filter(t => t.suit === suit && t.value === v + 2);
        if (p1.length >= 2 && p2.length >= 2 && p3.length >= 2) {
          const matched = [...p1.slice(0, 2), ...p2.slice(0, 2), ...p3.slice(0, 2)];
          const sName = SUIT_NAMES[suit];
          result.push({
            type: 'sanLianDui',
            name: '三连对',
            desc: `起手拥有同门三连对【${NUMBER_NAMES[v]}${NUMBER_NAMES[v+1]}${NUMBER_NAMES[v+2]}${sName}对】`,
            tiles: matched
          });
          v += 3; // 避免重叠误判
        } else {
          v += 1;
        }
      }
    });
  }

  // H. 三同：筒子、条子、万子一样一对相同的 (如 2万一对、2条一对、2筒一对)
  if (ruleConfig.sanTong) {
    for (let v = 1; v <= 9; v++) {
      const wans = handTiles.filter(t => t.suit === SUITS.WAN && t.value === v);
      const tiaos = handTiles.filter(t => t.suit === SUITS.TIAO && t.value === v);
      const tongs = handTiles.filter(t => t.suit === SUITS.TONG && t.value === v);
      if (wans.length >= 2 && tiaos.length >= 2 && tongs.length >= 2) {
        result.push({
          type: 'sanTong',
          name: '三同',
          desc: `起手万、条、筒同点数各有一对【${NUMBER_NAMES[v]}万/条/筒各一对】`,
          tiles: [...wans.slice(0, 2), ...tiaos.slice(0, 2), ...tongs.slice(0, 2)]
        });
      }
    }
  }

  // I. 二筒二条：起手手牌拥有一对二筒和一对二条
  if (ruleConfig.erTongErTiao) {
    const tong2 = handTiles.filter(t => t.suit === SUITS.TONG && t.value === 2);
    const tiao2 = handTiles.filter(t => t.suit === SUITS.TIAO && t.value === 2);
    if (tong2.length >= 2 && tiao2.length >= 2) {
      result.push({
        type: 'erTongErTiao',
        name: '二筒二条',
        desc: '起手手牌拥有一对二筒与一对二条',
        tiles: [...tong2.slice(0, 2), ...tiao2.slice(0, 2)]
      });
    }
  }

  return result;
}

/**
 * 2. 检查吃牌选项
 * 长沙麻将只能吃上家打出的牌
 * @param {Array} handTiles 手牌 (未包含 targetTile)
 * @param {Object} targetTile 上家打出的牌
 * @returns {Array<Array<Object>>} 可组合的吃牌顺子 (每组3张牌)
 */
export function getChiOptions(handTiles, targetTile) {
  if (!targetTile || !handTiles) return [];

  const val = targetTile.value;
  const suit = targetTile.suit;
  const sameSuitTiles = handTiles.filter(t => t.suit === suit);

  const valMap = new Map();
  sameSuitTiles.forEach(t => {
    if (!valMap.has(t.value)) {
      valMap.set(t.value, t);
    }
  });

  const combinations = [];

  // 1) targetTile 在中间: [val-1, targetTile, val+1]
  if (valMap.has(val - 1) && valMap.has(val + 1)) {
    combinations.push([valMap.get(val - 1), targetTile, valMap.get(val + 1)]);
  }

  // 2) targetTile 在头部: [targetTile, val+1, val+2]
  if (valMap.has(val + 1) && valMap.has(val + 2)) {
    combinations.push([targetTile, valMap.get(val + 1), valMap.get(val + 2)]);
  }

  // 3) targetTile 在尾部: [val-2, val-1, targetTile]
  if (valMap.has(val - 2) && valMap.has(val - 1)) {
    combinations.push([valMap.get(val - 2), valMap.get(val - 1), targetTile]);
  }

  return combinations;
}

/**
 * 3. 检查碰牌
 * 任何玩家打出的牌，只要手牌有至少2张相同即可碰
 */
export function canPeng(handTiles, targetTile) {
  if (!targetTile || !handTiles) return false;
  const matching = handTiles.filter(t => t.suit === targetTile.suit && t.value === targetTile.value);
  return matching.length >= 2;
}

/**
 * 4. 检查开杠选项 (开杠需不需要将规则由 config.kongRequiresJiang 决定)
 * 包括：
 * - 明杠 (直杠)：别人打出，手牌已有3张
 * - 暗杠：自己摸牌回合，手牌有4张相同
 * - 补杠：自己摸牌回合，手牌摸到一张已碰过的牌
 * 
 * @param {Array} handTiles 手牌
 * @param {Array} melds 已经吃碰杠的面子
 * @param {Object|null} targetTile 别人打出的牌 (若为自己回合摸牌则为 null)
 * @param {Object} config 游戏规则配置
 * @returns {Array<{ type: 'ming'|'an'|'bu', tile: Object, tiles: Array }>}
 */
export function getKongOptions(handTiles, melds = [], targetTile = null, config = {}) {
  const requiresJiang = config.kongRequiresJiang ?? true;
  const options = [];

  // 判断剩余手牌中是否含有将牌 (2、5、8)
  const satisfiesJiangRequirement = (remainingTiles) => {
    if (!requiresJiang) return true;
    // 开杠需将：手牌中剩余牌必须持有至少一张或一对 2、5、8 将牌
    return remainingTiles.some(t => isJiangTile(t));
  };

  // 情况 1: 别人出牌 -> 检查能否直杠 (明杠)
  if (targetTile) {
    const matching = handTiles.filter(t => t.suit === targetTile.suit && t.value === targetTile.value);
    if (matching.length >= 3) {
      const remaining = handTiles.filter(t => !(t.suit === targetTile.suit && t.value === targetTile.value));
      if (satisfiesJiangRequirement(remaining)) {
        options.push({
          type: 'ming',
          tile: targetTile,
          tiles: [matching[0], matching[1], matching[2], targetTile]
        });
      }
    }
  } else {
    // 情况 2: 自己回合 -> 检查暗杠与补杠
    const counts = countTiles(handTiles);

    // 暗杠：手中有4张相同的牌
    counts.forEach(({ tile, count }) => {
      if (count >= 4) {
        const remaining = handTiles.filter(t => getTileKey(t) !== getTileKey(tile));
        if (satisfiesJiangRequirement(remaining)) {
          options.push({
            type: 'an',
            tile,
            tiles: handTiles.filter(t => getTileKey(t) === getTileKey(tile)).slice(0, 4)
          });
        }
      }
    });

    // 补杠：已碰的面子中，手中摸到了第4张
    melds.forEach(meld => {
      if (meld.type === 'peng') {
        const matchingInHand = handTiles.find(t => t.suit === meld.tile.suit && t.value === meld.tile.value);
        if (matchingInHand) {
          const remaining = handTiles.filter(t => t.id !== matchingInHand.id);
          if (satisfiesJiangRequirement(remaining)) {
            options.push({
              type: 'bu',
              tile: matchingInHand,
              tiles: [...meld.tiles, matchingInHand]
            });
          }
        }
      }
    });
  }

  return options;
}

/**
 * 递归判断剩余牌是否能完全拆解成顺子和刻子
 * @param {Array<number>} sortedValues 某一花色排序后的牌点数列表
 * @returns {boolean}
 */
function canDecomposeToMelds(sortedValues) {
  if (sortedValues.length === 0) return true;
  if (sortedValues.length % 3 !== 0) return false;

  const first = sortedValues[0];
  const countFirst = sortedValues.filter(v => v === first).length;

  // 尝试拆成刻子 (3张相同)
  if (countFirst >= 3) {
    const nextList = [...sortedValues];
    nextList.splice(0, 3);
    if (canDecomposeToMelds(nextList)) return true;
  }

  // 尝试拆成顺子 (first, first + 1, first + 2)
  const idx1 = sortedValues.indexOf(first + 1);
  const idx2 = sortedValues.indexOf(first + 2);
  if (idx1 !== -1 && idx2 !== -1) {
    const nextList = [...sortedValues];
    // 必须从后往前删索引
    const indices = [0, idx1, idx2].sort((a, b) => b - a);
    indices.forEach(idx => nextList.splice(idx, 1));
    if (canDecomposeToMelds(nextList)) return true;
  }

  return false;
}

/**
 * 5. 核心胡牌检测 (长沙麻将标准判胡)
 * 包括：
 * - 将将胡 (大胡): 全由 2, 5, 8 组成
 * - 清一色 (大胡): 同一花色，乱将
 * - 碰碰胡 (大胡): 全刻子，乱将
 * - 全求人 (大胡): 4副吃碰杠全亮，手中剩1张点炮
 * - 平胡: 4副牌 + 1对将，且【将牌必须为 2、5、8】
 * 
 * @param {Array} handTiles 手牌
 * @param {Array} melds 已经形成的吃碰杠面子
 * @param {Object} winningTile 待判定胡的牌 (自摸手牌中已有，或别人点炮/开杠摸出的牌)
 * @param {boolean} isSelfDrawn 是否自摸
 * @param {Object} context 附加场景上下文 { isKongFlower, isKongDiscard, isRobbingKong, isLastTile }
 * @returns {{ canHu: boolean, huTypes: string[], score: number, desc: string }}
 */
export function checkHu(handTiles, melds = [], winningTile = null, isSelfDrawn = false, context = {}) {
  // 组装完整用于判定的所有牌 (手牌 + 待胡牌)
  const allTilesInHand = winningTile && !isSelfDrawn 
    ? [...handTiles, winningTile] 
    : [...handTiles];

  // 全部牌（包括吃碰杠），总数应为 14 张
  const allTilesEver = [...allTilesInHand];
  melds.forEach(m => allTilesEver.push(...m.tiles));

  if (allTilesEver.length !== 14) {
    return { canHu: false, huTypes: [], score: 0, desc: '' };
  }

  const huTypes = [];
  let isBigHu = false;

  // ----------------------------------------------------
  // 大胡判定 1: 将将胡 (全部牌张都是 2、5、8)
  // 长沙麻将中，只要所有手牌与面子全由2、5、8组成，不限牌型直接胡牌！
  // ----------------------------------------------------
  const isAllJiang = allTilesEver.every(t => isJiangTile(t));
  if (isAllJiang) {
    huTypes.push('将将胡');
    isBigHu = true;
  }

  // ----------------------------------------------------
  // 大胡判定 2: 清一色 (手牌和面子全部为同一种花色，乱将)
  // ----------------------------------------------------
  const firstSuit = allTilesEver[0].suit;
  const isPureSuit = allTilesEver.every(t => t.suit === firstSuit);

  // ----------------------------------------------------
  // 大胡判定 3: 碰碰胡 (全部由刻子/杠子加一对将组成，乱将)
  // ----------------------------------------------------
  let isPengPengHu = false;
  // 碰碰胡必须保证所有面子都是碰或杠
  const allMeldsAreTriplets = melds.every(m => m.type === 'peng' || m.type === 'gang' || m.type === 'an_gang');
  if (allMeldsAreTriplets) {
    const counts = countTiles(allTilesInHand);
    let pairCount = 0;
    let tripletCount = 0;
    counts.forEach(({ count }) => {
      if (count === 2) pairCount++;
      else if (count === 3) tripletCount++;
      else if (count === 4) tripletCount++; // 4张也可算刻子加一张(但在判胡时不应有单张)
    });
    if (pairCount === 1 && (tripletCount * 3 + 2 === allTilesInHand.length)) {
      isPengPengHu = true;
    }
  }

  if (isPengPengHu) {
    huTypes.push('碰碰胡');
    isBigHu = true;
  }

  // ----------------------------------------------------
  // 判定是否能按 4面子 + 1对子 组合
  // ----------------------------------------------------
  // 分别按花色归类
  const suitMap = {
    [SUITS.WAN]: [],
    [SUITS.TIAO]: [],
    [SUITS.TONG]: []
  };
  allTilesInHand.forEach(t => {
    suitMap[t.suit].push(t.value);
  });
  Object.keys(suitMap).forEach(s => suitMap[s].sort((a, b) => a - b));

  // 遍历所有可能的将对
  let canStandardDecompose = false;
  let hasValid258Jiang = false;

  const countsInHand = countTiles(allTilesInHand);
  const candidatePairs = [];
  countsInHand.forEach(({ tile, count }) => {
    if (count >= 2) {
      candidatePairs.push(tile);
    }
  });

  for (const pairTile of candidatePairs) {
    const suit = pairTile.suit;
    const val = pairTile.value;

    // 拷贝并扣除一对
    const curSuitMap = {
      [SUITS.WAN]: [...suitMap[SUITS.WAN]],
      [SUITS.TIAO]: [...suitMap[SUITS.TIAO]],
      [SUITS.TONG]: [...suitMap[SUITS.TONG]]
    };

    const idx1 = curSuitMap[suit].indexOf(val);
    curSuitMap[suit].splice(idx1, 1);
    const idx2 = curSuitMap[suit].indexOf(val);
    curSuitMap[suit].splice(idx2, 1);

    // 检查三个花色是否全都能被拆解成顺子或刻子
    const wanOk = canDecomposeToMelds(curSuitMap[SUITS.WAN]);
    const tiaoOk = canDecomposeToMelds(curSuitMap[SUITS.TIAO]);
    const tongOk = canDecomposeToMelds(curSuitMap[SUITS.TONG]);

    if (wanOk && tiaoOk && tongOk) {
      canStandardDecompose = true;
      if (isJiangTile(pairTile)) {
        hasValid258Jiang = true;
      }
    }
  }

  // 若清一色且能拆解（清一色乱将）
  if (isPureSuit && (canStandardDecompose || isPengPengHu)) {
    huTypes.push('清一色');
    isBigHu = true;
  }

  // 全求人：已亮4副吃碰杠，手牌仅剩1张点炮成胡，必须258将
  if (melds.length === 4 && allTilesInHand.length === 2 && !isSelfDrawn) {
    if (hasValid258Jiang) {
      huTypes.push('全求人');
      isBigHu = true;
    }
  }

  // 附加特殊大胡状态
  if (context.isKongFlower && (canStandardDecompose || isBigHu)) {
    huTypes.push('杠上开花');
    isBigHu = true;
  }
  if (context.isKongDiscard && (canStandardDecompose || isBigHu)) {
    huTypes.push('杠上炮');
    isBigHu = true;
  }
  if (context.isRobbingKong && (canStandardDecompose || isBigHu)) {
    huTypes.push('抢杠胡');
    isBigHu = true;
  }
  if (context.isLastTile && (canStandardDecompose || isBigHu)) {
    huTypes.push(isSelfDrawn ? '海底捞月' : '海底炮');
    isBigHu = true;
  }

  // ----------------------------------------------------
  // 平胡判定：
  // 必须满足 4面子+1对将，且【将牌必须为 2、5、8】！
  // ----------------------------------------------------
  if (!isBigHu && canStandardDecompose && hasValid258Jiang) {
    huTypes.push('平胡');
  }

  if (huTypes.length === 0) {
    return { canHu: false, huTypes: [], score: 0, desc: '' };
  }

  // 计分规则：平胡 1分（或2分），大胡每项番数累加（每项大胡 6 分）
  let score = 0;
  if (isBigHu) {
    const bigTypes = huTypes.filter(t => t !== '平胡');
    score = bigTypes.length * 6; // 大胡每个番种 6 番
  } else {
    score = 1; // 平胡 1 番
  }

  return {
    canHu: true,
    huTypes,
    score,
    isSelfDrawn,
    desc: huTypes.join(' · ')
  };
}

/**
 * 6. 听牌分析与提示
 * 针对手牌计算打出哪张牌后能进入听牌状态，以及听哪些牌
 * @param {Array} handTiles 手牌 (14张)
 * @param {Array} melds 面子
 * @param {Object} config 规则
 * @returns {Map<number, Array<{ tile: Object, remaining: number }>>}
 */
export function analyzeTingCards(handTiles, melds = [], config = {}, allKnownTiles = []) {
  const tingMap = new Map(); // tile.id -> array of winning tiles
  if (handTiles.length % 3 !== 2) {
    return tingMap;
  }

  // 计算已知牌数 (弃牌池+面子+手牌)
  const knownCountMap = new Map();
  allKnownTiles.forEach(t => {
    const key = getTileKey(t);
    knownCountMap.set(key, (knownCountMap.get(key) || 0) + 1);
  });

  // 试打每张手牌
  const distinctKeysChecked = new Set();

  handTiles.forEach((discardCandidate) => {
    const key = getTileKey(discardCandidate);
    if (distinctKeysChecked.has(key)) return;
    distinctKeysChecked.add(key);

    const remainingHand = handTiles.filter(t => t.id !== discardCandidate.id);
    const winningTiles = [];

    // 试探所有27种麻将牌
    const suits = [SUITS.WAN, SUITS.TIAO, SUITS.TONG];
    for (const suit of suits) {
      for (let value = 1; value <= 9; value++) {
        const testTile = { suit, value, name: `${value}${suit}` };
        const huResult = checkHu(remainingHand, melds, testTile, false, {});
        if (huResult.canHu) {
          const usedCount = knownCountMap.get(getTileKey(testTile)) || 0;
          const remaining = Math.max(0, 4 - usedCount);
          winningTiles.push({
            tile: testTile,
            remaining,
            huTypes: huResult.huTypes,
            score: huResult.score
          });
        }
      }
    }

    if (winningTiles.length > 0) {
      // 记录所有同特征的牌
      handTiles.filter(t => getTileKey(t) === key).forEach(matchingTile => {
        tingMap.set(matchingTile.id, winningTiles);
      });
    }
  });

  return tingMap;
}

/**
 * 7. 扎鸟判定 (抓鸟 / 中鸟结算)
 * 长沙麻将扎鸟规则：
 * 牌点数 1, 5, 9 为胡牌者（庄家位）中鸟；
 * 2, 6 为下家中鸟；
 * 3, 7 为对家中鸟；
 * 4, 8 为上家中鸟。
 * 中鸟者每只鸟多算 1 番或翻倍。
 * 
 * @param {Array} wall 牌墙
 * @param {number} birdCount 抓鸟数量 (0, 2, 4)
 * @param {number} winnerId 赢家方位 (0~3)
 * @returns {{ birds: Array<{ tile: Object, hitsWinner: boolean, seat: number }>, hitCount: number }}
 */
export function drawBirds(wall, birdCount = 2, winnerId = 0) {
  if (birdCount <= 0 || !wall || wall.length === 0) {
    return { birds: [], hitCount: 0 };
  }

  const birds = [];
  const actualCount = Math.min(birdCount, wall.length);
  let hitCount = 0;

  for (let i = 0; i < actualCount; i++) {
    const tile = wall[i];
    // 鸟的座位分配：以赢家为基准算 1,5,9
    const val = tile.value;
    const hitOffset = (val - 1) % 4; // 0: 赢家, 1: 下家, 2: 对家, 3: 上家
    const targetSeat = (winnerId + hitOffset) % 4;
    const hitsWinner = (targetSeat === winnerId);

    if (hitsWinner) {
      hitCount++;
    }

    birds.push({
      tile,
      targetSeat,
      hitsWinner
    });
  }

  return { birds, hitCount };
}

/**
 * 8. 检查中途四喜 (打牌摸牌过程中手牌凑齐4张相同牌)
 * @param {Array} handTiles 手牌
 * @param {Object} config 游戏规则配置
 * @param {Set<string>|Array<string>} declaredKeys 已经声明过的四喜牌key集合
 * @returns {Array<{ type: string, name: string, key: string, tile: Object, desc: string, tiles: Array }>}
 */
export function checkMidGameSiXi(handTiles, config = {}, declaredKeys = new Set()) {
  if (!config?.startingHu?.zhongTuSiXi) return [];
  if (!handTiles || handTiles.length === 0) return [];

  const declaredSet = declaredKeys instanceof Set ? declaredKeys : new Set(declaredKeys);
  const counts = countTiles(handTiles);
  const results = [];

  counts.forEach(({ tile, count }) => {
    const key = getTileKey(tile);
    if (count >= 4 && !declaredSet.has(key)) {
      results.push({
        type: 'zhongTuSiXi',
        name: '中途四喜',
        key,
        tile,
        desc: `打牌摸中第4张【${tile.name}】达成中途四喜！`,
        tiles: handTiles.filter(t => getTileKey(t) === key).slice(0, 4)
      });
    }
  });

  return results;
}

