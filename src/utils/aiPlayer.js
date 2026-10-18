// 智能 AI 玩家决策引擎，符合长沙麻将战术逻辑
import { isJiangTile, getTileKey, compareTiles } from '../types/mahjong.js';
import { checkHu, getKongOptions, canPeng, getChiOptions, countTiles, analyzeTingCards } from './mahjongLogic.js';

/**
 * AI 选择一张最佳手牌打出
 * @param {Array} handTiles 手牌 (14张)
 * @param {Array} melds 面子
 * @param {Object} config 规则配置
 * @param {Array} allKnownTiles 所有已知明牌
 * @returns {Object} 选中的手牌对象
 */
export function chooseAiDiscard(handTiles, melds = [], config = {}, allKnownTiles = []) {
  if (!handTiles || handTiles.length === 0) return null;
  if (handTiles.length === 1) return handTiles[0];

  // 1. 优先检查打出哪张牌能立刻听牌，且听的张数最多
  const tingMap = analyzeTingCards(handTiles, melds, config, allKnownTiles);
  if (tingMap.size > 0) {
    let bestTileId = null;
    let maxRemainingCount = -1;

    tingMap.forEach((winningTiles, tileId) => {
      const totalRemaining = winningTiles.reduce((sum, w) => sum + w.remaining, 0);
      if (totalRemaining > maxRemainingCount) {
        maxRemainingCount = totalRemaining;
        bestTileId = tileId;
      }
    });

    const chosen = handTiles.find(t => t.id === bestTileId);
    if (chosen) return chosen;
  }

  // 2. 无立时听牌时，按照牌的孤立度与保留价值进行权衡打分
  const counts = countTiles(handTiles);

  // 为每张手牌计算保留权重 (分数越低越优先打出)
  let lowestScore = Infinity;
  let bestCandidate = handTiles[0];

  handTiles.forEach(tile => {
    let score = 0;
    const count = counts.get(getTileKey(tile))?.count || 1;

    // 刻子(3张)权重极高，不轻易拆
    if (count >= 3) {
      score += 100;
    } else if (count === 2) {
      // 对子：若为258将牌，加分更高（长沙麻将平胡必须258将）
      score += isJiangTile(tile) ? 65 : 45;
    }

    // 将牌 (2, 5, 8) 战略价值高
    if (isJiangTile(tile)) {
      score += 15;
    }

    // 顺子搭子评估：寻找同花色的相邻牌
    const val = tile.value;
    const sameSuitNeighbors = handTiles.filter(t => t.suit === tile.suit && t.id !== tile.id);

    // 两面搭子 (如 4-5) 价值高
    const hasAdjacentMinus = sameSuitNeighbors.some(t => t.value === val - 1);
    const hasAdjacentPlus = sameSuitNeighbors.some(t => t.value === val + 1);
    const hasSkipMinus = sameSuitNeighbors.some(t => t.value === val - 2);
    const hasSkipPlus = sameSuitNeighbors.some(t => t.value === val + 2);

    if (hasAdjacentMinus && hasAdjacentPlus) {
      score += 35; // 夹张已成或两边通
    } else if (hasAdjacentMinus || hasAdjacentPlus) {
      // 1-2 或 8-9 边张搭子稍弱，3-7 中张两面搭子价值高
      if ((val === 1 && hasAdjacentPlus) || (val === 9 && hasAdjacentMinus)) {
        score += 18;
      } else {
        score += 26;
      }
    }

    // 嵌张搭子 (如 1-3, 4-6)
    if (hasSkipMinus || hasSkipPlus) {
      score += 12;
    }

    // 幺九孤张最易打出
    if (count === 1 && !hasAdjacentMinus && !hasAdjacentPlus && !hasSkipMinus && !hasSkipPlus) {
      if (val === 1 || val === 9) {
        score -= 20;
      } else {
        score -= 10;
      }
    }

    // 寻找分数最低的打出
    if (score < lowestScore) {
      lowestScore = score;
      bestCandidate = tile;
    }
  });

  return bestCandidate;
}

/**
 * AI 面对他人出牌做出的响应决策 (胡 > 杠 > 碰 > 吃 > 过)
 * @param {Array} handTiles 手牌
 * @param {Array} melds 面子
 * @param {Object} discardedTile 打出的牌
 * @param {boolean} isFromPreviousPlayer 是否来自上家
 * @param {Object} config 规则配置
 * @param {Object} context 上下文 (如开杠打出)
 * @returns {{ action: 'hu'|'gang'|'peng'|'chi'|'pass', payload?: any }}
 */
export function decideAiResponse(handTiles, melds = [], discardedTile, isFromPreviousPlayer = false, config = {}, context = {}) {
  // 1. 优先判定胡牌
  const huResult = checkHu(handTiles, melds, discardedTile, false, context);
  if (huResult.canHu) {
    return { action: 'hu', huResult };
  }

  // 2. 检查直杠 (明杠) - 需遵循“开杠需不需要将”规则
  const kongOptions = getKongOptions(handTiles, melds, discardedTile, config);
  if (kongOptions.length > 0) {
    // AI 在有较大概率或大牌时不放弃杠牌
    return { action: 'gang', kongOption: kongOptions[0] };
  }

  // 3. 检查碰牌
  if (canPeng(handTiles, discardedTile)) {
    // 评估碰牌收益：如果已有较多顺子且碰后不破坏手牌结构
    const matching = handTiles.filter(t => t.suit === discardedTile.suit && t.value === discardedTile.value);
    // 碰 258 或形成碰碰胡倾向
    const isJiang = isJiangTile(discardedTile);
    const shouldPeng = isJiang || matching.length === 2;
    if (shouldPeng) {
      return { action: 'peng', tiles: [matching[0], matching[1], discardedTile] };
    }
  }

  // 4. 检查吃牌 (仅限上家)
  if (isFromPreviousPlayer) {
    const chiOptions = getChiOptions(handTiles, discardedTile);
    if (chiOptions.length > 0) {
      // 随机或择优吃顺子 (不拆已有刻子)
      const nonTripChi = chiOptions.find(chiGroup => {
        return chiGroup.every(t => {
          const c = handTiles.filter(h => h.suit === t.suit && h.value === t.value).length;
          return c < 3;
        });
      });
      if (nonTripChi) {
        return { action: 'chi', tiles: nonTripChi };
      }
    }
  }

  return { action: 'pass' };
}

/**
 * AI 摸牌后自摸回合的决策 (自摸胡 > 暗杠/补杠 > 出牌)
 * @param {Array} handTiles 手牌 (14张)
 * @param {Array} melds 面子
 * @param {Object} drawnTile 本次自摸摸到的牌
 * @param {Object} config 规则配置
 * @param {Object} context 上下文 (如杠上摸牌)
 * @returns {{ action: 'hu'|'gang'|'discard', payload?: any }}
 */
export function decideAiTurnAction(handTiles, melds = [], drawnTile, config = {}, context = {}) {
  // 1. 自摸胡判定
  const huResult = checkHu(handTiles, melds, drawnTile, true, context);
  if (huResult.canHu) {
    return { action: 'hu', huResult };
  }

  // 2. 暗杠与补杠判定 (遵循开杠需不需要将规则)
  const kongOptions = getKongOptions(handTiles, melds, null, config);
  if (kongOptions.length > 0) {
    return { action: 'gang', kongOption: kongOptions[0] };
  }

  // 3. 正常出牌
  const tileToDiscard = chooseAiDiscard(handTiles, melds, config, []);
  return { action: 'discard', tile: tileToDiscard };
}
