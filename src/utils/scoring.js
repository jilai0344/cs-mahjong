// 长沙麻将 · 计分规则（纯函数模块）
//
// 本文件是所有计分逻辑的**唯一真相源**：无 React、无 DOM、无网络、无隐式随机。
// 规格见 docs/SCORING.md（对应任务《重写长沙麻将计分系统》）。
//
// 符号：
//   B 基础分（房间规则可配）      F 固定分（房间规则可配）
//   k 本次胡牌所含大胡番型个数（k ≥ 1）    n 某位付分者对应的中鸟数
//   M = n + 1 鸟翻倍乘数          封顶 = 42B = 6 × 7B
//
// 公式：
//   小胡 Base = 2B          大胡 Base = 7B × k（线性相加，非翻番）
//   某位付分者应付 P = min(Base × (n+1), 42B) + 2F
//   （2F 不参与叠加、不参与翻番、不受封顶；单家应付上限 = 42B + 2F）
//
// 座位约定：0 庄位 / 1 庄位下家 / 2 庄位对家 / 3 庄位上家（相对「计分庄位」而言）。

/** 封顶系数：CAP = 42B = 6 × 7B */
export const CAP_BASE_MULTIPLIER = 42;

/** 大胡单番系数：每个大胡番型 7B */
export const BIG_HU_BASE_MULTIPLIER = 7;

/** 小胡系数：2B */
export const SMALL_HU_BASE_MULTIPLIER = 2;

export const SEAT_NAMES = ['庄位', '下家', '对家', '上家'];

/** 鸟点/骰子点数 → 相对座位的偏移：1/5/9→庄位(0)，2/6→下家(1)，3/7→对家(2)，4/8→上家(3) */
export function birdSeatOffset(value) {
  return (((value - 1) % 4) + 4) % 4;
}

/**
 * 鸟点对应的绝对座位（以「计分庄位」为基准）
 * @param {number} dealerSeat 计分庄位（0..3）
 * @param {number|{value:number}} bird 鸟点（翻牌牌点或骰子点数，也可传牌对象）
 */
export function birdSeat(dealerSeat, bird) {
  const value = typeof bird === 'number' ? bird : bird?.value;
  if (!Number.isFinite(value)) return null;
  return (dealerSeat + birdSeatOffset(value)) % 4;
}

/** 封顶金额 */
export function capAmount(B) {
  return CAP_BASE_MULTIPLIER * B;
}

/** 小胡底分 */
export function smallHuBase(B) {
  return SMALL_HU_BASE_MULTIPLIER * B;
}

/** 大胡底分：7B × k */
export function bigHuBase(B, k) {
  return BIG_HU_BASE_MULTIPLIER * B * k;
}

/**
 * 中鸟数 n：落在「有效座位」上的鸟数，有几个算几个（同一座位被多只鸟命中可累加）。
 * 有效座位按结算方式不同：
 *   · 自摸 / 起手胡 / 中途四喜：{计分庄位(=胡牌者/触发者), 当前付分者}
 *   · 点炮：{计分庄位(=胡牌者), 放炮者}
 *   · 通炮：{计分庄位(=放炮者), 当前正在结算的胡牌者}
 * 因此在通炮场景下，`otherSeat` 传的是「当前结算的胡牌者座位」。
 * @param {Array<number|object>} birdValues 鸟点列表
 * @param {number} dealerSeat 计分庄位
 * @param {number} otherSeat 另一位有效座位
 */
export function countEffectiveBirds(birdValues, dealerSeat, otherSeat) {
  if (!birdValues || birdValues.length === 0) return 0;
  const valid = new Set([dealerSeat, otherSeat]);
  let n = 0;
  for (const bird of birdValues) {
    if (valid.has(birdSeat(dealerSeat, bird))) n++;
  }
  return n;
}

/**
 * 单家应付明细
 * @returns {{base:number, multiplier:number, beforeCap:number, cap:number, capped:number, cappedHit:boolean, fixed:number, P:number}}
 */
export function payerAmount({ isBigHu, k = 1, B, F, n = 0 }) {
  const base = isBigHu ? bigHuBase(B, k) : smallHuBase(B);
  const multiplier = n + 1;
  const beforeCap = base * multiplier;
  const cap = capAmount(B);
  const cappedHit = beforeCap > cap;
  const capped = cappedHit ? cap : beforeCap;
  const fixed = 2 * F;
  return { base, multiplier, beforeCap, cap, capped, cappedHit, fixed, P: capped + fixed };
}

const ZERO_CHANGES = () => [0, 0, 0, 0];

/**
 * 一次结算（自摸 / 点炮 / 通炮 / 起手胡 / 中途四喜）
 *
 * @param {object} input
 * @param {'zimo'|'dianpao'|'tongpao'|'qishou'|'siji'} input.method
 * @param {number} input.B 基础分
 * @param {number} input.F 固定分
 * @param {number} [input.dealerSeat] 计分庄位；自摸/点炮/起手胡/中途四喜缺省取胡牌者座位
 * @param {{seat:number,isBigHu?:boolean,k?:number,huTypes?:string[]}} [input.winner] 单赢家（非通炮）
 * @param {Array<{seat:number,isBigHu?:boolean,k?:number,huTypes?:string[]}>} [input.winners] 通炮：多位赢家
 * @param {number} [input.discarderSeat] 放炮者座位（点炮 / 通炮必填）
 * @param {Array<number|object>} [input.birdValues] 鸟点（翻牌牌点或骰子点数）
 * @returns {{method:string,B:number,F:number,dealerSeat:number,cap:number,changes:number[],
 *            details:Array<object>, winners:Array<object>, birdDetail:Array<object>, zeroSum:boolean}}
 */
export function scoreRound({
  method,
  B,
  F,
  dealerSeat = null,
  winner = null,
  winners = null,
  discarderSeat = null,
  birdValues = []
}) {
  if (!Number.isFinite(B) || !Number.isFinite(F)) {
    throw new Error('scoreRound: B 与 F 必须是数字');
  }
  const changes = ZERO_CHANGES();
  const details = [];
  const winnerSummaries = [];
  const isTongPao = method === 'tongpao';
  const isDiscardMethod = method === 'dianpao' || isTongPao;

  if (isDiscardMethod && discarderSeat === null) {
    throw new Error(`scoreRound: method=${method} 必须提供 discarderSeat（放炮者）`);
  }
  if (discarderSeat !== null) {
    validateSeat('discarderSeat', discarderSeat);
  }
  if (dealerSeat !== null) {
    validateSeat('dealerSeat', dealerSeat);
  }

  // 统一走 normalizeWinner：非通炮与通炮共用同一套 k / isBigHu 兜底与校验
  const list = (isTongPao ? winners : [winner]).map((w) => normalizeWinner(w, method));
  if (list.length === 0) throw new Error(`scoreRound: method=${method} 缺少赢家`);

  // 计分庄位：通炮 = 放炮者；其余 = 胡牌者 / 触发者
  const effectiveDealerSeat = isTongPao
    ? discarderSeat
    : (dealerSeat !== null ? dealerSeat : list[0].seat);

  for (const w of list) {
    const payers = isTongPao
      ? [discarderSeat]
      : (method === 'dianpao' ? [discarderSeat] : otherSeats(w.seat));
    let receives = 0;
    const winnerDetails = [];

    for (const payerSeat of payers) {
      // 有效座位是「两位」：
      //  · 自摸/起手胡/中途四喜：{庄位=胡牌者, 该付分者}
      //  · 点炮：{庄位=胡牌者, 放炮者}（此时 payerSeat 就是放炮者）
      //  · 通炮：{庄位=放炮者, 当前正在结算的胡牌者}（此时另一位是赢家座位）
      const otherSeat = isTongPao ? w.seat : payerSeat;
      const n = countEffectiveBirds(birdValues, effectiveDealerSeat, otherSeat);
      const amount = payerAmount({ isBigHu: w.isBigHu, k: w.k, B, F, n });
      const detail = {
        method,
        winnerSeat: w.seat,
        payerSeat,
        isBigHu: w.isBigHu,
        k: w.isBigHu ? w.k : 0,
        huTypes: w.huTypes,
        base: amount.base,
        n,
        multiplier: amount.multiplier,
        beforeCap: amount.beforeCap,
        cap: amount.cap,
        capped: amount.capped,
        cappedHit: amount.cappedHit,
        fixed: amount.fixed,
        P: amount.P
      };
      details.push(detail);
      winnerDetails.push(detail);
      changes[payerSeat] -= amount.P;
      receives += amount.P;
    }

    changes[w.seat] += receives;
    winnerSummaries.push({
      seat: w.seat,
      isBigHu: w.isBigHu,
      k: w.isBigHu ? w.k : 0,
      huTypes: w.huTypes,
      receives,
      payers: payers.slice(),
      details: winnerDetails
    });
  }

  const birdDetail = birdValues.map((bird, index) => {
    const value = typeof bird === 'number' ? bird : bird?.value;
    const targetSeat = birdSeat(effectiveDealerSeat, bird);
    const effectiveFor = [];
    for (const d of details) {
      const other = isTongPao ? d.winnerSeat : d.payerSeat;
      if (targetSeat === effectiveDealerSeat || targetSeat === other) effectiveFor.push(d.payerSeat);
    }
    return { index, value, targetSeat, seatName: SEAT_NAMES[birdSeatOffset(value)], effectiveFor };
  });

  return {
    method,
    B,
    F,
    dealerSeat: effectiveDealerSeat,
    cap: capAmount(B),
    changes,
    details,
    winners: winnerSummaries,
    birdDetail,
    zeroSum: changes.reduce((a, b) => a + b, 0) === 0
  };
}

function validateSeat(name, value) {
  if (!Number.isInteger(value) || value < 0 || value > 3) {
    throw new Error(`scoreRound: ${name} 必须是 0..3 的整数（实际 ${JSON.stringify(value)}）`);
  }
}

function normalizeWinner(winner, method) {
  if (!winner || !Number.isInteger(winner.seat)) {
    throw new Error(`scoreRound: method=${method} 缺少有效的 winner.seat（0..3 的整数，实际 ${JSON.stringify(winner && winner.seat)}）`);
  }
  validateSeat('winner.seat', winner.seat);
  // 起手胡 / 中途四喜 按小胡（自摸口径）结算
  const forceSmall = method === 'qishou' || method === 'siji';
  const isBigHu = forceSmall ? false : !!winner.isBigHu;
  let k = 0;
  if (isBigHu) {
    k = (winner.k === undefined || winner.k === null) ? 1 : winner.k;
    if (!Number.isInteger(k) || k < 1) {
      throw new Error(`scoreRound: 大胡的 k 必须是 >= 1 的整数（实际 ${JSON.stringify(k)}）`);
    }
  }
  return {
    seat: winner.seat,
    isBigHu,
    k,
    huTypes: Array.isArray(winner.huTypes) ? winner.huTypes : (isBigHu || forceSmall ? [] : ['平胡'])
  };
}

function otherSeats(seat) {
  return [0, 1, 2, 3].filter((s) => s !== seat);
}

/**
 * 流局（黄庄）庄家：规格 §二.4 —— 最后一张牌由谁摸，谁就是庄。
 * 流局不计分，因此这里只决定下一局庄位。
 * @param {{lastDrawerSeat?: number|null, currentDealerSeat?: number}} input
 *   lastDrawerSeat = 本局最后一次从牌墙摸走牌的座位（正常摸牌与开杠补牌都算）；
 *   currentDealerSeat = 本局的庄位，仅当「本局从未有人从牌墙摸过牌」这一异常路径才回退使用。
 * @returns {number} 下一局庄位（0..3）
 */
export function drawDealerSeat({ lastDrawerSeat = null, currentDealerSeat = 0 }) {
  if (!Number.isInteger(currentDealerSeat) || currentDealerSeat < 0 || currentDealerSeat > 3) {
    throw new Error(`drawDealerSeat: currentDealerSeat 必须是 0..3 的整数（实际 ${JSON.stringify(currentDealerSeat)}）`);
  }
  const seat = (lastDrawerSeat === null || lastDrawerSeat === undefined) ? currentDealerSeat : lastDrawerSeat;
  validateSeat('drawDealerSeat.lastDrawerSeat', seat);
  return seat;
}

/**
 * 下一局庄家
 * · 'win'     谁胡牌谁做庄
 * · 'tongpao' 通炮（一炮多响）：放炮者做庄
 * · 'draw'    流局：最后一张牌由谁摸，谁做庄
 * · 起手胡 / 中途四喜 的结算**不影响**下一局庄，调用方不应使用本函数更新
 */
export function nextDealerSeat({ outcome, winnerSeat = null, discarderSeat = null, lastDrawerSeat = null }) {
  if (outcome === 'win') { validateSeat('winnerSeat', winnerSeat); return winnerSeat; }
  if (outcome === 'tongpao') { validateSeat('discarderSeat', discarderSeat); return discarderSeat; }
  if (outcome === 'draw') { validateSeat('lastDrawerSeat', lastDrawerSeat); return lastDrawerSeat; }
  throw new Error(`nextDealerSeat: 未知 outcome=${outcome}`);
}

/**
 * 摇骰子抓鸟：骰子数量 = 规则设置中的抓鸟数（0/2/4），点数直接当鸟点。
 * ⚠️ 随机源必须由调用方注入：联机时由服务端用安全随机源（如 crypto.randomInt）提供，
 *    客户端只负责展示动画与结果。缺省实现仅供单机练习使用。
 * @param {number} count 骰子数量
 * @param {(maxExclusive:number)=>number} [randomInt]
 * @returns {number[]} 1..6 的点数列表
 */
export function rollBirdDice(count, randomInt = defaultRandomInt) {
  const out = [];
  for (let i = 0; i < Math.max(0, count); i++) {
    const v = randomInt(6);
    if (!Number.isInteger(v) || v < 0 || v > 5) {
      throw new Error('rollBirdDice: randomInt 必须返回 [0, n) 的整数');
    }
    out.push(v + 1);
  }
  return out;
}

function defaultRandomInt(maxExclusive) {
  return Math.floor(Math.random() * maxExclusive);
}

/** 中鸟落点描述（供 UI 展示，如「3 只中鸟：庄位 2、下家 1」） */
export function describeBirdHits(birdDetail = []) {
  const bySeat = [0, 0, 0, 0];
  birdDetail.forEach((b) => {
    if (b.targetSeat !== null && b.targetSeat !== undefined) bySeat[b.targetSeat]++;
  });
  return bySeat
    .map((count, seat) => (count > 0 ? `${SEAT_NAMES[seat] ?? seat}×${count}` : null))
    .filter(Boolean)
    .join(' · ');
}
