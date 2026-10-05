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
import { SUITS } from '../src/types/mahjong.js';

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

  // E. 一个五测试 (有且仅有一个五)
  const handOneFive = [
    { id: 1, suit: SUITS.WAN, value: 5, name: '五万' },
    { id: 2, suit: SUITS.TIAO, value: 1, name: '一条' },
    { id: 3, suit: SUITS.TONG, value: 9, name: '九筒' }
  ];
  const resOneFive = checkStartingHu(handOneFive, { startingHu: { yiGeWu: true } });
  assert(resOneFive.some(h => h.type === 'yiGeWu'), '全手牌有且仅有一个五应触发【一个五】');

  const handTwoFives = [
    { id: 1, suit: SUITS.WAN, value: 5, name: '五万' },
    { id: 2, suit: SUITS.TIAO, value: 5, name: '五条' }
  ];
  const resTwoFives = checkStartingHu(handTwoFives, { startingHu: { yiGeWu: true } });
  assert(!resTwoFives.some(h => h.type === 'yiGeWu'), '手牌拥有两个五时不应触发【一个五】');

  const handNoFives = [
    { id: 1, suit: SUITS.WAN, value: 1, name: '一万' },
    { id: 2, suit: SUITS.TIAO, value: 2, name: '二条' }
  ];
  const resNoFives = checkStartingHu(handNoFives, { startingHu: { yiGeWu: true } });
  assert(!resNoFives.some(h => h.type === 'yiGeWu'), '手牌无五时不应触发【一个五】');

  // F. 三五三八测试 (三个五筒，三个八筒)
  const handSanWuSanBa = [
    { id: 1, suit: SUITS.TONG, value: 5, name: '五筒' },
    { id: 2, suit: SUITS.TONG, value: 5, name: '五筒' },
    { id: 3, suit: SUITS.TONG, value: 5, name: '五筒' },
    { id: 4, suit: SUITS.TONG, value: 8, name: '八筒' },
    { id: 5, suit: SUITS.TONG, value: 8, name: '八筒' },
    { id: 6, suit: SUITS.TONG, value: 8, name: '八筒' },
    { id: 7, suit: SUITS.WAN, value: 1, name: '一万' }
  ];
  const res3538 = checkStartingHu(handSanWuSanBa, { startingHu: { sanWuSanBa: true } });
  assert(res3538.some(h => h.type === 'sanWuSanBa'), '拥有三个五筒和三个八筒应触发【三五三八】');

  const hand3528 = [
    { id: 1, suit: SUITS.TONG, value: 5, name: '五筒' },
    { id: 2, suit: SUITS.TONG, value: 5, name: '五筒' },
    { id: 3, suit: SUITS.TONG, value: 5, name: '五筒' },
    { id: 4, suit: SUITS.TONG, value: 8, name: '八筒' },
    { id: 5, suit: SUITS.TONG, value: 8, name: '八筒' }
  ];
  const res3528 = checkStartingHu(hand3528, { startingHu: { sanWuSanBa: true } });
  assert(!res3528.some(h => h.type === 'sanWuSanBa'), '仅有两个八筒时不应触发【三五三八】');

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
}

console.log('\n=== 测试 4: 扎鸟算法验证 ===');
{
  const testWall = [
    { value: 1, name: '一万' }, // 1 -> 赢家中鸟
    { value: 5, name: '五条' }, // 5 -> 赢家中鸟
    { value: 2, name: '二筒' }, // 2 -> 下家中鸟
    { value: 9, name: '九万' }  // 9 -> 赢家中鸟
  ];
  const birdRes2 = drawBirds(testWall, 2, 0); // 抓2鸟
  assert(birdRes2.birds.length === 2 && birdRes2.hitCount === 2, '前两张为1与5，抓2鸟全部命中赢家(中2鸟)');

  const birdRes4 = drawBirds(testWall, 4, 0); // 抓4鸟
  assert(birdRes4.birds.length === 4 && birdRes4.hitCount === 3, '4张牌中1、5、9共命中3只鸟');
}

console.log(`\n测试汇总: 通过 ${passed} 个, 失败 ${failed} 个\n`);
if (failed > 0) {
  process.exit(1);
}
