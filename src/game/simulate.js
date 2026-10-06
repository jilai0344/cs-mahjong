// 长沙麻将 · 无界面牌局模拟器（规格 §九.7）
//
// 目的：用**纯规则模块**（牌墙生成 / 胡牌判定 / AI 决策 / 计分）驱动完整牌局，
// 校验「零和、n 与 k 统计正确、单家应付不超过 42B+2F、中途四喜后牌局能继续到结算」。
//
// 边界：本模块**不驱动 React**，因此它校验的是规则与计分的不变量，而不是 UI 交互；
//       UI 级 E2E 需要把 App.jsx 的牌局推进抽成 engine（见 docs/SCORING.md §6 的 S6）。
import { generateDeck, getTileKey } from '../types/mahjong.js';
import {
  checkStartingHu,
  checkMidGameSiXi,
  checkHu,
  canPeng,
  drawBirds
} from '../utils/mahjongLogic.js';
import { chooseAiDiscard } from '../utils/aiPlayer.js';
import {
  scoreRound,
  rollBirdDice,
  huEntryFromTypes
} from '../utils/scoring.js';

/** 可复现的伪随机源（种子固定 → 同一 seed 必然复现同一局） */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledDeck(rand) {
  // 先按 id 还原成规范顺序，再用**种子随机源**洗牌 —— 否则 generateDeck() 内部的
  // Math.random 会让「同一 seed」不可复现（同一种子会给出不同的牌序）。
  const deck = generateDeck().sort((a, b) => a.id - b.id);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

const OTHERS = (seat) => [0, 1, 2, 3].filter((s) => s !== seat);

/**
 * 模拟一局（四家全部由 AI 决策；起手胡 / 中途四喜 / 自摸 / 点炮 / 通炮 / 流局 都会出现）
 * @param {{seed:number, B:number, F:number, config:object}} input
 * @returns {object} 牌局记录（changes / settlements / outcome / stats）
 */
export function playSimulatedGame({ seed, B, F, config }) {
  const rand = mulberry32(seed);
  const randomInt = (maxExclusive) => Math.floor(rand() * maxExclusive);
  const deck = shuffledDeck(rand);

  const dealerSeat = Math.floor(rand() * 4);
  const hands = [[], [], [], []];
  for (let i = 0; i < 4; i++) {
    const count = i === dealerSeat ? 14 : 13;
    hands[i] = deck.splice(0, count);
  }
  let wall = deck;
  const melds = [[], [], [], []];
  const declared = [new Set(), new Set(), new Set(), new Set()];

  const changes = [0, 0, 0, 0];
  const settlements = [];
  const stats = {
    qishou: 0, siji: 0, zimo: 0, dianpao: 0, tongpao: 0,
    kDistribution: {}, nDistribution: {}, bigHuSettlements: 0, smallHuSettlements: 0
  };
  let outcome = null;
  let draws = 0;
  let drawsAfterSiXi = 0;
  let eventsAfterSiXi = 0;
  let siXiSeen = false;

  const apply = (method, scored, extra = {}) => {
    if (siXiSeen) eventsAfterSiXi += 1;
    scored.changes.forEach((c, i) => { changes[i] += c; });
    settlements.push({
      method,
      changes: scored.changes,
      details: scored.details,
      winners: scored.winners,
      birdValues: extra.birdValues || [],
      dealerSeat: scored.dealerSeat,
      cap: scored.cap,
      ...extra
    });
    stats[method] += 1;
    scored.details.forEach((d) => {
      stats.kDistribution[d.k] = (stats.kDistribution[d.k] || 0) + 1;
      stats.nDistribution[d.n] = (stats.nDistribution[d.n] || 0) + 1;
      if (d.isBigHu) stats.bigHuSettlements += 1;
      else stats.smallHuSettlements += 1;
    });
  };

  // 1. 起手胡：每个起手胡各摇一次骰子、各自独立结算（规格 §七）
  for (let seat = 0; seat < 4; seat++) {
    for (const _hu of checkStartingHu(hands[seat], config)) {
      const birdValues = rollBirdDice(config?.birdCount || 0, randomInt);
      apply('qishou', scoreRound({ method: 'qishou', B, F, winner: { seat }, birdValues }), { seat, birdValues });
    }
  }

  // 2. 行牌：摸 → 中途四喜 / 自摸 → 打 → 他家和牌/碰 → 顺移
  let turn = dealerSeat;
  let guard = 0;
  while (wall.length > 0 && guard < 400 && !outcome) {
    guard += 1;

    const drawn = wall.shift();
    hands[turn].push(drawn);
    draws += 1;
    if (siXiSeen) { drawsAfterSiXi += 1; eventsAfterSiXi += 1; }

    // 中途四喜：同一组 4 张只触发一次，结算后牌局继续
    for (const sx of checkMidGameSiXi(hands[turn], config, declared[turn])) {
      declared[turn].add(sx.key);
      const birdValues = rollBirdDice(config?.birdCount || 0, randomInt);
      apply('siji', scoreRound({ method: 'siji', B, F, winner: { seat: turn }, birdValues }), { seat: turn, birdValues });
      siXiSeen = true;
      drawsAfterSiXi = 0;
    }

    // 自摸
    const selfHu = checkHu(hands[turn], melds[turn], null, true, {});
    if (selfHu.canHu) {
      const birdValues = drawBirds(wall, config?.birdCount || 0, turn).birdValues;
      wall = wall.slice(0, wall.length - birdValues.length);
      apply('zimo', scoreRound({
        method: 'zimo', B, F,
        winner: huEntryFromTypes(turn, selfHu.huTypes),
        birdValues
      }), { seat: turn, birdValues });
      outcome = 'win';
      break;
    }

    // 打牌（AI 决策；必须来自手牌，且只移除这一张）
    const tile = chooseAiDiscard(hands[turn], melds[turn], config, []) || hands[turn][hands[turn].length - 1];
    let discarded = false;
    hands[turn] = hands[turn].filter((t) => {
      if (!discarded && t === tile) { discarded = true; return false; }
      return true;
    });
    if (siXiSeen) eventsAfterSiXi += 1;

    // 他家和牌：一家 = 点炮，多家 = 通炮（一炮多响）
    const huSeats = [];
    for (const s of OTHERS(turn)) {
      const huRes = checkHu(hands[s], melds[s], tile, false, {});
      if (huRes.canHu) huSeats.push({ seat: s, huTypes: huRes.huTypes });
    }
    if (huSeats.length === 1) {
      const birdValues = drawBirds(wall, config?.birdCount || 0, huSeats[0].seat).birdValues;
      wall = wall.slice(0, wall.length - birdValues.length);
      apply('dianpao', scoreRound({
        method: 'dianpao', B, F,
        winner: huEntryFromTypes(huSeats[0].seat, huSeats[0].huTypes),
        discarderSeat: turn,
        birdValues
      }), { seat: huSeats[0].seat, discarderSeat: turn, birdValues });
      outcome = 'win';
      break;
    }
    if (huSeats.length > 1) {
      const birdValues = drawBirds(wall, config?.birdCount || 0, turn).birdValues;
      wall = wall.slice(0, wall.length - birdValues.length);
      apply('tongpao', scoreRound({
        method: 'tongpao', B, F,
        winners: huSeats.map((w) => huEntryFromTypes(w.seat, w.huTypes)),
        discarderSeat: turn,
        birdValues
      }), { discarderSeat: turn, birdValues });
      outcome = 'tongpao';
      break;
    }

    // 碰：按座次顺序第一家能碰的碰（碰后由该玩家出牌，不再摸牌）
    let pongSeat = null;
    for (let k = 1; k <= 3; k++) {
      const s = (turn + k) % 4;
      if (canPeng(hands[s], tile)) { pongSeat = s; break; }
    }
    if (pongSeat !== null) {
      const key = getTileKey(tile);
      let removed = 0;
      hands[pongSeat] = hands[pongSeat].filter((t) => {
        if (removed < 2 && getTileKey(t) === key) { removed++; return false; }
        return true;
      });
      melds[pongSeat].push({ type: 'peng', tiles: [tile, tile, tile] });
      const ownDiscard = chooseAiDiscard(hands[pongSeat], melds[pongSeat], config, []) || hands[pongSeat][hands[pongSeat].length - 1];
      hands[pongSeat] = hands[pongSeat].filter((t) => t !== ownDiscard);
      turn = (pongSeat + 1) % 4;
      continue;
    }

    turn = (turn + 1) % 4;
  }

  if (!outcome) outcome = 'draw'; // 牌墙摸完 → 流局（不计分，庄家由最后摸牌者决定）

  return {
    seed,
    outcome,
    changes,
    zeroSum: changes.reduce((a, b) => a + b, 0) === 0,
    settlements,
    stats,
    draws,
    drawsAfterSiXi,
    eventsAfterSiXi,
    siXiSeen,
    dealerSeat,
    guardHit: guard >= 400
  };
}
