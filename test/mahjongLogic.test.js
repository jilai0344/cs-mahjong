// 针对长沙麻将核心算法逻辑的自动化单元测试
import {
  checkStartingHu,
  checkMidGameSiXi,
  checkHu,
  getKongOptions,
  canPeng,
  getChiOptions,
  drawBirds
} from '../src/utils/mahjongLogic.js';
import { SUITS, DEFAULT_CONFIG } from '../src/types/mahjong.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('=== 测试 1: 起手胡 (小胡) 检测 ===');
{
  // A. 大四喜测试 (起手拥有4张一万)
  const handDaSiXi = [
    { id: 1, suit: SUITS.WAN, value: 1, name: '一万' },
    { id: 2, suit: SUITS.WAN, value: 1, name: '一万' },
    { id: 3, suit: SUITS.WAN, value: 1, name: '一万' },
    { id: 4, suit: SUITS.WAN, value: 1, name: '一万' },
    { id: 5, suit: SUITS.TIAO, value: 2, name: '二条' },
    { id: 6, suit: SUITS.TONG, value: 5, name: '五筒' },
    { id: 7, suit: SUITS.WAN, value: 7, name: '七万' }
  ];
  const res1 = checkStartingHu(handDaSiXi, { startingHu: { daSiXi: true } });
  assert(res1.some(h => h.type === 'daSiXi'), '起手手牌有4张相同牌应触发【大四喜】');

  const res1Off = checkStartingHu(handDaSiXi, { startingHu: { daSiXi: false } });
  assert(!res1Off.some(h => h.type === 'daSiXi'), '关闭大四喜开关后不应触发');

  // B. 板板胡测试 (无 2、5、8)
  const handBanBan = [
    { id: 1, suit: SUITS.WAN, value: 1, name: '一万' },
    { id: 2, suit: SUITS.WAN, value: 3, name: '三万' },
    { id: 3, suit: SUITS.TIAO, value: 4, name: '四条' },
    { id: 4, suit: SUITS.TONG, value: 9, name: '九筒' }
  ];
  const res2 = checkStartingHu(handBanBan, { startingHu: { banBanHu: true } });
  assert(res2.some(h => h.type === 'banBanHu'), '手牌无258应触发【板板胡】');

  const handWithJiang = [
    { id: 1, suit: SUITS.WAN, value: 2, name: '二万' },
    { id: 2, suit: SUITS.WAN, value: 3, name: '三万' }
  ];
  const res2No = checkStartingHu(handWithJiang, { startingHu: { banBanHu: true } });
  assert(!res2No.some(h => h.type === 'banBanHu'), '手牌有2万不应触发【板板胡】');

  // C. 缺一色测试 (无筒子)
  const handQueYiSe = [
    { id: 1, suit: SUITS.WAN, value: 1, name: '一万' },
    { id: 2, suit: SUITS.TIAO, value: 3, name: '三条' }
  ];
  const res3 = checkStartingHu(handQueYiSe, { startingHu: { queYiSe: true } });
  assert(res3.some(h => h.type === 'queYiSe'), '手牌缺少某一门花色应触发【缺一色】');

  // D. 六六顺测试 (两组3张相同牌)
  const handLiuLiu = [
    { id: 1, suit: SUITS.WAN, value: 3, name: '三万' },
    { id: 2, suit: SUITS.WAN, value: 3, name: '三万' },
    { id: 3, suit: SUITS.WAN, value: 3, name: '三万' },
    { id: 4, suit: SUITS.TIAO, value: 6, name: '六条' },
    { id: 5, suit: SUITS.TIAO, value: 6, name: '六条' },
    { id: 6, suit: SUITS.TIAO, value: 6, name: '六条' },
    { id: 7, suit: SUITS.TONG, value: 2, name: '二筒' }
  ];
  const res4 = checkStartingHu(handLiuLiu, { startingHu: { liuLiuShun: true } });
  assert(res4.some(h => h.type === 'liuLiuShun'), '拥有两组3张相同牌应触发【六六顺】');

  // E. 一个五测试 (某一门起手只有一张且为五)
  const handOneFive = [
    { id: 1, suit: SUITS.WAN, value: 5, name: '五万' }, // 万字门仅此一张5
    { id: 2, suit: SUITS.TIAO, value: 1, name: '一条' },
    { id: 3, suit: SUITS.TIAO, value: 2, name: '二条' },
    { id: 4, suit: SUITS.TONG, value: 8, name: '八筒' },
    { id: 5, suit: SUITS.TONG, value: 9, name: '九筒' }
  ];
  const resOneFive = checkStartingHu(handOneFive, { startingHu: { yiGeWu: true } });
  assert(resOneFive.some(h => h.type === 'yiGeWu' && h.name === '一个五'), '万字门仅有一张五万应触发【一个五】');

  const handTwoWanTiles = [
    { id: 1, suit: SUITS.WAN, value: 5, name: '五万' },
    { id: 2, suit: SUITS.WAN, value: 6, name: '六万' }, // 万字门有两张，不满足起手只有一张五
    { id: 3, suit: SUITS.TIAO, value: 1, name: '一条' }
  ];
  const resTwoWan = checkStartingHu(handTwoWanTiles, { startingHu: { yiGeWu: true } });
  assert(!resTwoWan.some(h => h.type === 'yiGeWu'), '同一门有其它牌(5万+6万)不应触发【一个五】');

  const handOneSeven = [
    { id: 1, suit: SUITS.WAN, value: 7, name: '七万' }, // 仅有一张但不是五
    { id: 2, suit: SUITS.TIAO, value: 1, name: '一条' },
    { id: 3, suit: SUITS.TIAO, value: 2, name: '二条' }
  ];
  const resOneSeven = checkStartingHu(handOneSeven, { startingHu: { yiGeWu: true } });
  assert(!resOneSeven.some(h => h.type === 'yiGeWu'), '起手独张不是五(七万)不应触发【一个五】');

  // F. 三个五三个八测试 (3个五筒胡1把，3个八筒胡1把，如果都有胡3把含六六顺)
  const handOnly35 = [
    { id: 1, suit: SUITS.TONG, value: 5, name: '五筒' },
    { id: 2, suit: SUITS.TONG, value: 5, name: '五筒' },
    { id: 3, suit: SUITS.TONG, value: 5, name: '五筒' },
    { id: 4, suit: SUITS.WAN, value: 1, name: '一万' }
  ];
  const resOnly35 = checkStartingHu(handOnly35, { startingHu: { sanWuSanBa: true, liuLiuShun: true } });
  assert(resOnly35.some(h => h.name === '三个五'), '起手有3个五筒应触发【三个五】');

  const handOnly38 = [
    { id: 1, suit: SUITS.TONG, value: 8, name: '八筒' },
    { id: 2, suit: SUITS.TONG, value: 8, name: '八筒' },
    { id: 3, suit: SUITS.TONG, value: 8, name: '八筒' },
    { id: 4, suit: SUITS.WAN, value: 1, name: '一万' }
  ];
  const resOnly38 = checkStartingHu(handOnly38, { startingHu: { sanWuSanBa: true, liuLiuShun: true } });
  assert(resOnly38.some(h => h.name === '三个八'), '起手有3个八筒应触发【三个八】');

  const handBoth3538 = [
    { id: 1, suit: SUITS.TONG, value: 5, name: '五筒' },
    { id: 2, suit: SUITS.TONG, value: 5, name: '五筒' },
    { id: 3, suit: SUITS.TONG, value: 5, name: '五筒' },
    { id: 4, suit: SUITS.TONG, value: 8, name: '八筒' },
    { id: 5, suit: SUITS.TONG, value: 8, name: '八筒' },
    { id: 6, suit: SUITS.TONG, value: 8, name: '八筒' },
    { id: 7, suit: SUITS.WAN, value: 2, name: '二万' }
  ];
  const resBoth3538 = checkStartingHu(handBoth3538, { startingHu: { sanWuSanBa: true, liuLiuShun: true } });
  const has35 = resBoth3538.some(h => h.name === '三个五');
  const has38 = resBoth3538.some(h => h.name === '三个八');
  const hasLiuLiu = resBoth3538.some(h => h.type === 'liuLiuShun');
  assert(has35 && has38 && hasLiuLiu && resBoth3538.length === 3, '同时有3个五筒和3个八筒应胡3把(三个五+三个八+六六顺叠加)');

  // 4个五筒测试 (三个五筒胡一次，四喜胡一次，共胡2次)
  const hand4_5 = [
    { id: 1, suit: SUITS.TONG, value: 5, name: '五筒' },
    { id: 2, suit: SUITS.TONG, value: 5, name: '五筒' },
    { id: 3, suit: SUITS.TONG, value: 5, name: '五筒' },
    { id: 4, suit: SUITS.TONG, value: 5, name: '五筒' },
    { id: 5, suit: SUITS.WAN, value: 1, name: '一万' }
  ];
  const res4_5 = checkStartingHu(hand4_5, { startingHu: { daSiXi: true, sanWuSanBa: true } });
  const has4_5_siXi = res4_5.some(h => h.type === 'daSiXi');
  const has4_5_35 = res4_5.some(h => h.name === '三个五');
  assert(has4_5_siXi && has4_5_35 && res4_5.length === 2, '起手拥有4个五筒应胡2次(大四喜胡一次+三个五胡一次)');

  // 4个八筒测试 (三个八筒胡一次，四喜胡一次，共胡2次)
  const hand4_8 = [
    { id: 1, suit: SUITS.TONG, value: 8, name: '八筒' },
    { id: 2, suit: SUITS.TONG, value: 8, name: '八筒' },
    { id: 3, suit: SUITS.TONG, value: 8, name: '八筒' },
    { id: 4, suit: SUITS.TONG, value: 8, name: '八筒' },
    { id: 5, suit: SUITS.WAN, value: 1, name: '一万' }
  ];
  const res4_8 = checkStartingHu(hand4_8, { startingHu: { daSiXi: true, sanWuSanBa: true } });
  const has4_8_siXi = res4_8.some(h => h.type === 'daSiXi');
  const has4_8_38 = res4_8.some(h => h.name === '三个八');
  assert(has4_8_siXi && has4_8_38 && res4_8.length === 2, '起手拥有4个八筒应胡2次(大四喜胡一次+三个八胡一次)');

  // 4个五筒 + 4个八筒同时存在测试 (2次大四喜 + 1次六六顺 + 1次三个五 + 1次三个八，共胡5把)
  const handBoth4_5_8 = [
    ...hand4_5.slice(0, 4),
    ...hand4_8.slice(0, 4),
    { id: 9, suit: SUITS.WAN, value: 2, name: '二万' }
  ];
  const resBoth4_5_8 = checkStartingHu(handBoth4_5_8, { startingHu: { daSiXi: true, sanWuSanBa: true, liuLiuShun: true } });
  assert(resBoth4_5_8.length === 5, '拥有4个五筒和4个八筒应胡5把(大四喜×2+三个五+三个八+六六顺)');

  // G. 三连对测试 (同门三副连续的对子)
  const handSanLianDui = [
    { id: 1, suit: SUITS.WAN, value: 2, name: '二万' },
    { id: 2, suit: SUITS.WAN, value: 2, name: '二万' },
    { id: 3, suit: SUITS.WAN, value: 3, name: '三万' },
    { id: 4, suit: SUITS.WAN, value: 3, name: '三万' },
    { id: 5, suit: SUITS.WAN, value: 4, name: '四万' },
    { id: 6, suit: SUITS.WAN, value: 4, name: '四万' },
    { id: 7, suit: SUITS.TIAO, value: 9, name: '九条' }
  ];
  const resLianDui = checkStartingHu(handSanLianDui, { startingHu: { sanLianDui: true } });
  assert(resLianDui.some(h => h.type === 'sanLianDui'), '手牌拥有223344万应触发【三连对】');

  const handBrokenLianDui = [
    { id: 1, suit: SUITS.WAN, value: 2, name: '二万' },
    { id: 2, suit: SUITS.WAN, value: 2, name: '二万' },
    { id: 3, suit: SUITS.WAN, value: 3, name: '三万' },
    { id: 4, suit: SUITS.WAN, value: 3, name: '三万' },
    { id: 5, suit: SUITS.WAN, value: 5, name: '五万' },
    { id: 6, suit: SUITS.WAN, value: 5, name: '五万' }
  ];
  const resBrokenLianDui = checkStartingHu(handBrokenLianDui, { startingHu: { sanLianDui: true } });
  assert(!resBrokenLianDui.some(h => h.type === 'sanLianDui'), '非连续三对(223355)不应触发【三连对】');

  // H. 三同测试 (筒条万同点数各一对)
  const handSanTong = [
    { id: 1, suit: SUITS.WAN, value: 2, name: '二万' },
    { id: 2, suit: SUITS.WAN, value: 2, name: '二万' },
    { id: 3, suit: SUITS.TIAO, value: 2, name: '二条' },
    { id: 4, suit: SUITS.TIAO, value: 2, name: '二条' },
    { id: 5, suit: SUITS.TONG, value: 2, name: '二筒' },
    { id: 6, suit: SUITS.TONG, value: 2, name: '二筒' }
  ];
  const resSanTong = checkStartingHu(handSanTong, { startingHu: { sanTong: true } });
  assert(resSanTong.some(h => h.type === 'sanTong'), '手牌拥有2万2条2筒各一对相同牌应触发【三同】');

  const handNotSanTong = [
    { id: 1, suit: SUITS.WAN, value: 2, name: '二万' },
    { id: 2, suit: SUITS.WAN, value: 2, name: '二万' },
    { id: 3, suit: SUITS.TIAO, value: 2, name: '二条' },
    { id: 4, suit: SUITS.TIAO, value: 2, name: '二条' },
    { id: 5, suit: SUITS.TONG, value: 3, name: '三筒' },
    { id: 6, suit: SUITS.TONG, value: 3, name: '三筒' }
  ];
  const resNotSanTong = checkStartingHu(handNotSanTong, { startingHu: { sanTong: true } });
  assert(!resNotSanTong.some(h => h.type === 'sanTong'), '筒子点数不同(2万2条3筒)不应触发【三同】');

  // I. 二筒二条测试 (一对二筒一对二条)
  const handErTongErTiao = [
    { id: 1, suit: SUITS.TONG, value: 2, name: '二筒' },
    { id: 2, suit: SUITS.TONG, value: 2, name: '二筒' },
    { id: 3, suit: SUITS.TIAO, value: 2, name: '二条' },
    { id: 4, suit: SUITS.TIAO, value: 2, name: '二条' },
    { id: 5, suit: SUITS.WAN, value: 9, name: '九万' }
  ];
  const resErTongErTiao = checkStartingHu(handErTongErTiao, { startingHu: { erTongErTiao: true } });
  assert(resErTongErTiao.some(h => h.type === 'erTongErTiao'), '手牌拥有一对二筒和一对二条应触发【二筒二条】');

  // J. 中途四喜检测
  const handMidGameSiXi = [
    { id: 1, suit: SUITS.WAN, value: 7, name: '七万' },
    { id: 2, suit: SUITS.WAN, value: 7, name: '七万' },
    { id: 3, suit: SUITS.WAN, value: 7, name: '七万' },
    { id: 4, suit: SUITS.WAN, value: 7, name: '七万' },
    { id: 5, suit: SUITS.TIAO, value: 1, name: '一条' }
  ];
  const resMidSiXi = checkMidGameSiXi(handMidGameSiXi, { startingHu: { zhongTuSiXi: true } }, new Set());
  assert(resMidSiXi.length === 1 && resMidSiXi[0].name === '中途四喜', '手牌有4张相同七万未声明应检测出【中途四喜】');

  const resMidSiXiDeclared = checkMidGameSiXi(handMidGameSiXi, { startingHu: { zhongTuSiXi: true } }, new Set(['wan-7']));
  assert(resMidSiXiDeclared.length === 0, '已声明过的四喜不应重复触发【中途四喜】');

  const resMidSiXiOff = checkMidGameSiXi(handMidGameSiXi, { startingHu: { zhongTuSiXi: false } }, new Set());
  assert(resMidSiXiOff.length === 0, '关闭中途四喜开关时不应检测出中途四喜');
}

console.log('\n=== 测试 2: 开杠需不需要将规则验证 ===');
{
  // 手牌：4张一万，外加2张三条（无258）
  const handWithoutJiang = [
    { id: 1, suit: SUITS.WAN, value: 1, name: '一万' },
    { id: 2, suit: SUITS.WAN, value: 1, name: '一万' },
    { id: 3, suit: SUITS.WAN, value: 1, name: '一万' },
    { id: 4, suit: SUITS.WAN, value: 1, name: '一万' },
    { id: 5, suit: SUITS.TIAO, value: 3, name: '三条' },
    { id: 6, suit: SUITS.TIAO, value: 3, name: '三条' }
  ];

  // 严格规则：开杠需要将
  const optionsWithStrict = getKongOptions(handWithoutJiang, [], null, { kongRequiresJiang: true });
  assert(optionsWithStrict.length === 0, '开杠需将且手牌无258将牌时，禁止开杠');

  // 宽松规则：开杠免将
  const optionsWithRelaxed = getKongOptions(handWithoutJiang, [], null, { kongRequiresJiang: false });
  assert(optionsWithRelaxed.length === 1 && optionsWithRelaxed[0].type === 'an', '开杠无需将时，允许正常暗杠一万');

  // 手牌附带五万 (258将牌)
  const handWithJiang = [
    ...handWithoutJiang,
    { id: 7, suit: SUITS.WAN, value: 5, name: '五万' }
  ];
  const optionsWithJiang = getKongOptions(handWithJiang, [], null, { kongRequiresJiang: true });
  assert(optionsWithJiang.length === 1, '手牌持有258将牌时，开杠需将规则下允许开杠');
}

console.log('\n=== 测试 3: 长沙麻将胡牌判定 (二五八做将 & 大胡) ===');
{
  // A. 普通平胡：1-2-3万, 4-5-6条, 7-8-9筒, 1-2-3筒，外加一对 二条 (2是有效将牌)
  const pingHuHand = [
    { suit: SUITS.WAN, value: 1 }, { suit: SUITS.WAN, value: 2 }, { suit: SUITS.WAN, value: 3 },
    { suit: SUITS.TIAO, value: 4 }, { suit: SUITS.TIAO, value: 5 }, { suit: SUITS.TIAO, value: 6 },
    { suit: SUITS.TONG, value: 7 }, { suit: SUITS.TONG, value: 8 }, { suit: SUITS.TONG, value: 9 },
    { suit: SUITS.TONG, value: 1 }, { suit: SUITS.TONG, value: 2 }, { suit: SUITS.TONG, value: 3 },
    { suit: SUITS.TIAO, value: 2 }, { suit: SUITS.TIAO, value: 2 } // 将牌为二条 (258将)
  ];
  const pingHuRes = checkHu(pingHuHand, [], null, true, {});
  assert(pingHuRes.canHu && pingHuRes.huTypes.includes('平胡'), '二条做将的4副1对牌型可成功判定为【平胡】');

  // B. 无效平胡：将牌改为 三条 (非258将)
  const invalidJiangHand = [
    { suit: SUITS.WAN, value: 1 }, { suit: SUITS.WAN, value: 2 }, { suit: SUITS.WAN, value: 3 },
    { suit: SUITS.TIAO, value: 4 }, { suit: SUITS.TIAO, value: 5 }, { suit: SUITS.TIAO, value: 6 },
    { suit: SUITS.TONG, value: 7 }, { suit: SUITS.TONG, value: 8 }, { suit: SUITS.TONG, value: 9 },
    { suit: SUITS.TONG, value: 1 }, { suit: SUITS.TONG, value: 2 }, { suit: SUITS.TONG, value: 3 },
    { suit: SUITS.TIAO, value: 3 }, { suit: SUITS.TIAO, value: 3 } // 将牌为三条 (非258将)
  ];
  const invalidHuRes = checkHu(invalidJiangHand, [], null, true, {});
  assert(!invalidHuRes.canHu, '非258做将的普通牌型在长沙麻将中不可胡牌');

  // C. 大胡：将将胡 (全部牌都是 2、5、8)
  const jiangJiangHand = [
    { suit: SUITS.WAN, value: 2 }, { suit: SUITS.WAN, value: 2 }, { suit: SUITS.WAN, value: 2 },
    { suit: SUITS.TIAO, value: 5 }, { suit: SUITS.TIAO, value: 5 }, { suit: SUITS.TIAO, value: 5 },
    { suit: SUITS.TONG, value: 8 }, { suit: SUITS.TONG, value: 8 }, { suit: SUITS.TONG, value: 8 },
    { suit: SUITS.WAN, value: 5 }, { suit: SUITS.WAN, value: 5 }, { suit: SUITS.WAN, value: 5 },
    { suit: SUITS.TIAO, value: 8 }, { suit: SUITS.TIAO, value: 8 }
  ];
  const jiangRes = checkHu(jiangJiangHand, [], null, true, {});
  assert(jiangRes.canHu && jiangRes.huTypes.includes('将将胡'), '全258牌型成功判定为大胡【将将胡】');

  // D. 大胡：清一色 (全万字，乱将，七万做将)
  const qingYiSeHand = [
    { suit: SUITS.WAN, value: 1 }, { suit: SUITS.WAN, value: 2 }, { suit: SUITS.WAN, value: 3 },
    { suit: SUITS.WAN, value: 4 }, { suit: SUITS.WAN, value: 5 }, { suit: SUITS.WAN, value: 6 },
    { suit: SUITS.WAN, value: 7 }, { suit: SUITS.WAN, value: 8 }, { suit: SUITS.WAN, value: 9 },
    { suit: SUITS.WAN, value: 1 }, { suit: SUITS.WAN, value: 1 }, { suit: SUITS.WAN, value: 1 },
    { suit: SUITS.WAN, value: 7 }, { suit: SUITS.WAN, value: 7 } // 七万做将
  ];
  const qingRes = checkHu(qingYiSeHand, [], null, true, {});
  assert(qingRes.canHu && qingRes.huTypes.includes('清一色'), '全同一花色且成型成功判定为大胡【清一色】(允许乱将)');

  // E. 番型计数：checkHu 只给 { isBigHu, k, huTypes }，金额一律交给 src/utils/scoring.js
  //    （规格 §三/§六：大胡每多一个番型 +7B，线性相加，不是翻番）
  assert(pingHuRes.isBigHu === false && pingHuRes.k === 0, '平胡：isBigHu=false、k=0');
  assert(jiangRes.isBigHu === true && jiangRes.huTypes.includes('将将胡'), '将将胡：isBigHu=true');
  // 该牌型同为「4 刻子 + 1 对」，因此【碰碰胡】也成立、各算一个番型 → k=2（规格 §六）
  assert(jiangRes.huTypes.includes('碰碰胡') && jiangRes.k === 2, '将将胡 + 碰碰胡 同时成立：k=2（每项大胡各算一个，线性相加）');
  assert(qingRes.isBigHu === true && qingRes.k === 1, '清一色：k=1');
  assert(!('score' in pingHuRes) && !('score' in qingRes), '旧计分字段 score（平胡1 / 大胡 k×6）已从 checkHu 返回值中删除');
  assert(!invalidHuRes.isBigHu && invalidHuRes.k === 0, '不能胡时 isBigHu=false、k=0（不返回 undefined）');

  // F. 大胡叠加：清一色 + 碰碰胡 → k=2（对应规格第八节示例 8 的牌型，Base = 14B）
  const qingPengHand = [
    { suit: SUITS.WAN, value: 1 }, { suit: SUITS.WAN, value: 1 }, { suit: SUITS.WAN, value: 1 },
    { suit: SUITS.WAN, value: 2 }, { suit: SUITS.WAN, value: 2 }, { suit: SUITS.WAN, value: 2 },
    { suit: SUITS.WAN, value: 3 }, { suit: SUITS.WAN, value: 3 }, { suit: SUITS.WAN, value: 3 },
    { suit: SUITS.WAN, value: 9 }, { suit: SUITS.WAN, value: 9 }, { suit: SUITS.WAN, value: 9 },
    { suit: SUITS.WAN, value: 5 }, { suit: SUITS.WAN, value: 5 } // 五万做将
  ];
  const qingPengRes = checkHu(qingPengHand, [], null, true, {});
  assert(qingPengRes.canHu && qingPengRes.huTypes.includes('清一色') && qingPengRes.huTypes.includes('碰碰胡'),
    '清一色 + 碰碰胡 同时成立（各算一个番型）');
  assert(qingPengRes.isBigHu === true && qingPengRes.k === 2, '清一色 + 碰碰胡：k=2（线性相加 2×7B，非翻番）');
}

console.log('\n=== 测试 4: 房间规则默认值（规格 §一/§六 + S3/S4 裁定）===');
{
  const j = (v) => JSON.stringify(v);
  assert(DEFAULT_CONFIG.baseScore === 1 && DEFAULT_CONFIG.fixedScore === 1, '基础分 B 默认 1、固定分 F 默认 1');
  assert(j([DEFAULT_CONFIG.startingHu.daSiXi, DEFAULT_CONFIG.startingHu.banBanHu,
    DEFAULT_CONFIG.startingHu.queYiSe, DEFAULT_CONFIG.startingHu.liuLiuShun, DEFAULT_CONFIG.startingHu.zhongTuSiXi]) === j([true, true, true, true, true]),
    '规格 §六 的 4 种起手胡 + 中途四喜默认开启');
  assert(j([DEFAULT_CONFIG.startingHu.yiGeWu, DEFAULT_CONFIG.startingHu.sanWuSanBa,
    DEFAULT_CONFIG.startingHu.sanLianDui, DEFAULT_CONFIG.startingHu.sanTong, DEFAULT_CONFIG.startingHu.erTongErTiao]) === j([false, false, false, false, false]),
    'S3 裁定：规格外 6 种起手胡默认关闭（可在设置里打开）');
}

console.log('\n=== 测试 5: 扎鸟算法验证（S2 裁定：翻牌墙取末尾）===');
{
  // 牌墙：头部即将被摸的牌，末尾才是扎鸟取的牌
  const testWall = [
    { value: 3, name: '三条' }, // 头部：会被摸走
    { value: 7, name: '七万' },
    { value: 1, name: '一万' }, // 末尾倒数第 3 张
    { value: 5, name: '五条' }, // 末尾倒数第 2 张
    { value: 2, name: '二筒' }, // 末尾倒数第 1 张
    { value: 9, name: '九万' }  // 末尾最后一张
  ];
  const birdRes2 = drawBirds(testWall, 2, 0); // 庄位=0，抓末尾 2 张（保持牌墙顺序）：2、9
  assert(birdRes2.birds.length === 2 && birdRes2.source === 'tail', '抓鸟取牌墙末尾');
  assert(birdRes2.birds[0].tile.value === 2 && birdRes2.birds[1].tile.value === 9, '抓 2 鸟取到末尾的 2、9（不是头部的 3、7）');
  assert(birdRes2.birdValues.join(',') === '2,9', '输出鸟点序列供计分模块使用');
  assert(birdRes2.birds.map(b => b.targetSeat).join(',') === '1,0', '庄位=0 时：2→下家、9→庄位');
  assert(birdRes2.hitCount === 1, '中庄位的鸟只有 9，共 1 只');

  const birdRes4 = drawBirds(testWall, 4, 0); // 抓末尾 4 张：1、5、2、9
  assert(birdRes4.birds.length === 4 && birdRes4.hitCount === 3, '末尾 4 张中 1、5、9 共命中庄位 3 只鸟');

  const birdRes0 = drawBirds(testWall, 0, 0);
  assert(birdRes0.birds.length === 0 && birdRes0.hitCount === 0 && birdRes0.birdValues.length === 0, '不抓鸟（0 只）时返回空结果');
}

console.log(`\n测试汇总: 通过 ${passed} 个, 失败 ${failed} 个\n`);
if (failed > 0) {
  process.exit(1);
}
