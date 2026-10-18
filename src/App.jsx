import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  PLAYERS,
  DEFAULT_CONFIG,
  generateDeck,
  compareTiles,
  getTileKey
} from './types/mahjong.js';
import {
  checkStartingHu,
  checkMidGameSiXi,
  checkHu,
  getKongOptions,
  isTingHand,
  canPeng,
  getChiOptions,
  analyzeTingCards,
  drawBirds
} from './utils/mahjongLogic.js';
import { nextDealerSeat, drawDealerSeat, scoreRound, rollBirdDice, secureRandomInt, normalizeScoreParams, huEntryFromTypes } from './utils/scoring.js';
import { hasPendingResponse, resolveTimeoutAction, hostTurnWatchdogDelay } from './game/actions.js';
import { resolveDiscardResponses } from './game/priority.js';
import { isRankedMatch, loadRecord, recordRound } from './game/record.js';
import { pickMatchRules, applyHostRules, rulesEqual, describeRules } from './game/rules.js';
import { getLocalDisplayId } from './utils/localId.js';
import { networkStatusText, statusTone } from './utils/latency.js';
import {
  chooseAiDiscard,
  decideAiResponse,
  decideAiTurnAction
} from './utils/aiPlayer.js';
import { sound } from './utils/audio.js';
import { network } from './utils/multiplayer.js';

import TableCenter from './components/TableCenter.jsx';
import PlayerHand from './components/PlayerHand.jsx';
import OpponentHand from './components/OpponentHand.jsx';
import { PlayerDiscardTray } from './components/DiscardPool.jsx';
import ActionControls from './components/ActionControls.jsx';
import TileWall from './components/TileWall.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import RoundResultModal from './components/RoundResultModal.jsx';
import RulesGuideModal from './components/RulesGuideModal.jsx';
import MultiplayerModal from './components/MultiplayerModal.jsx';
import UpdatePrompt from './components/UpdatePrompt.jsx';
import { checkForAppUpdate } from './utils/appUpdate.js';
import LobbyOverlay from './components/LobbyOverlay.jsx';
import ActionCallout from './components/ActionCallout.jsx';

import { Settings, BookOpen, Volume2, VolumeX, Users } from 'lucide-react';

// 把座位气泡文案映射成桌心大字印章：吃/碰/杠/胡/喜
function calloutForBubble(text) {
  const raw = String(text || '');
  const clean = raw.replace(/[！!]/g, '').trim();
  if (/四喜/.test(clean)) return { char: '喜', tone: 'xi', label: clean };
  if (/胡|自摸|开花|抢杠|杠上炮/.test(clean)) return { char: '胡', tone: 'hu', label: clean };
  if (/杠/.test(clean)) return { char: '杠', tone: 'gang', label: clean };
  if (/碰/.test(clean)) return { char: '碰', tone: 'peng', label: clean };
  if (/吃/.test(clean)) return { char: '吃', tone: 'chi', label: clean };
  return null;
}

// (helper 已移入 src/utils/scoring.js：normalizeScoreParams / huEntryFromTypes —— 纯函数、可单测)

export default function App() {
  // 1. 规则与配置状态
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('cs_mahjong_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const theme = ['mist', 'sand', 'ink'].includes(parsed.theme)
          ? parsed.theme
          : (parsed.theme === 'jade' ? 'ink' : 'mist');
        const voice = ['f', 'm', 'off'].includes(parsed.voice)
          ? parsed.voice
          : (parsed.voiceEnabled === false ? 'off' : 'f');
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          theme,
          voice,
          startingHu: {
            ...DEFAULT_CONFIG.startingHu,
            ...(parsed.startingHu || {})
          }
        };
      } catch {
        // ignore
      }
    }
    return DEFAULT_CONFIG;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isMultiplayerOpen, setIsMultiplayerOpen] = useState(false);

  // 联机状态管理
  const [multiplayerState, setMultiplayerState] = useState({
    isMultiplayer: false,
    isHost: false,
    roomCode: '',
    mySeatId: 0,
    seats: PLAYERS
  });
  const multiplayerRef = useRef(multiplayerState);
  multiplayerRef.current = multiplayerState;

  // P2-6：胶囊牌原先写死 5 位数字与固定昵称两个占位符，这里改成「本机固定标识 + 真实昵称」。
  // 标识首次进入时随机生成并存 localStorage（不跨设备，也不上传），生成逻辑抽到 utils/localId.js
  // 用 useState 惰性初始化，避免在渲染期直接调用随机数（oxlint react(purity)）。
  const [myDisplayId] = useState(getLocalDisplayId);

  // 相对本地视角的座位编号计算 (以我的视角为基准，我永远在底部)
  const mySeatId = multiplayerState.isMultiplayer ? multiplayerState.mySeatId : 0;
  const bottomSeatId = mySeatId;
  const rightSeatId = (mySeatId + 1) % 4;
  const topSeatId = (mySeatId + 2) % 4;
  const leftSeatId = (mySeatId + 3) % 4;

  // P2-3：某个座位现在是不是电脑在打 —— 只在联机时标注（单机三个座位本来就是电脑，标了是噪音）
  const seatAiInfo = (seat) => {
    if (!multiplayerState.isMultiplayer) return { isAi: false, aiLabel: '电脑' };
    if (multiplayerState.seats?.[seat]?.isHuman !== false) return { isAi: false, aiLabel: '电脑' };
    return { isAi: true, aiLabel: takenOverSeats.includes(seat) ? '托管' : '电脑' };
  };

  // P2-6：胶囊牌显示的昵称 —— 联机取自己座位的名字，单机取玩家在设置里保存的昵称
  const myDisplayName = multiplayerState.isMultiplayer
    ? (multiplayerState.seats[bottomSeatId]?.name || '我')
    : ((typeof localStorage !== 'undefined' && localStorage.getItem('cs_player_name')) || '我');

  // 2. 牌局展示状态 (UI 驱动)
  const [gameState, setGameState] = useState('IDLE'); // 'IDLE' | 'DEALING' | 'PLAYING' | 'KONG_DRAW' | 'ROUND_OVER'
  const [dealerId, setDealerId] = useState(0);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [turnTimer, setTurnTimer] = useState(15);
  const [wall, setWall] = useState([]);
  const [diceValues, setDiceValues] = useState([3, 4]);
  const [isRollingDice, setIsRollingDice] = useState(false);

  const [playerHands, setPlayerHands] = useState([[], [], [], []]);
  const [playerMelds, setPlayerMelds] = useState([[], [], [], []]);
  const [playerDiscards, setPlayerDiscards] = useState([[], [], [], []]);
  const [playerScores, setPlayerScores] = useState([1000, 1000, 1000, 1000]);
  const [tableCallout, setTableCallout] = useState(null);
  const tableCalloutTimerRef = useRef(null);

  const [drawnTile, setDrawnTile] = useState(null);
  const [lastDiscard, setLastDiscard] = useState(null);
  const [hoveredTile, setHoveredTile] = useState(null);

  // 人类玩家操作控制
  const [availableActions, setAvailableActions] = useState({
    hu: false,
    siXi: false,
    gang: false,
    peng: false,
    chi: false,
    pass: false
  });
  const [chiOptions, setChiOptions] = useState([]);
  const [kongOptions, setKongOptions] = useState([]);
  const [buOptions, setBuOptions] = useState([]);
  const [midGameSiXiOptions, setMidGameSiXiOptions] = useState([]);
  const declaredSiXiRef = useRef([new Set(), new Set(), new Set(), new Set()]);

  // 特殊事件弹窗
  const [startingHuEvents, setStartingHuEvents] = useState([]);
  const [kongDrawState, setKongDrawState] = useState({
    isOpen: false,
    kongPlayer: null,
    drawnTiles: [],
    count: 2,
    canSelfHu: false,
    kongOption: null,
    kongFlowerHuTypes: [],
    kongFlowerWinTile: null
  });
  const [roundResult, setRoundResult] = useState(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [appUpdate, setAppUpdate] = useState(null);
  const kongDrawOpenRef = useRef(false);

  // 定时器引用
  const timerRef = useRef(null);
  const aiTurnRef = useRef(null); // 指向 triggerAiTurn（掉线托管时从网络回调里调用，避免闭包过期）
  const aiTurnTokenRef = useRef(0); // 取消过期的 AI 定时器，避免结束后/换手后补刀
  const showBubbleRef = useRef(null);
  const startingHuPendingRef = useRef([]);
  // P1-2：桌上还有真人能胡时，全部胡家（含 AI）先挂起等待真人决定，决定后再一次性结算
  const pendingHuRef = useRef(null);
  // 战绩裁定（2026-10）：只有「4 个真人满座且全程无托管」的对局才计入本机记录；刷 AI 不计
  const rankedRoundRef = useRef(false);
  const [myRecord, setMyRecord] = useState(() => loadRecord());
  // D6：桌心要显示「第 N 局 / 庄家 / 牌墙进度」——局数只在同一场里递增，从大厅重新开局归 1
  const [roundNumber, setRoundNumber] = useState(0);
  const roundNoRef = useRef(0);
  const [wallTotal, setWallTotal] = useState(108);
  // 规格 §一：B/F 等房间规则联机时由房主同步、开局后锁定；客人离开房间后恢复自己的规则
  const [rulesLocked, setRulesLocked] = useState(false);
  const [roomRules, setRoomRulesState] = useState(null);
  const preMatchConfigRef = useRef(null);
  // 网络事件分发 effect 故意不随依赖重注册（见文件里既有的 aiTurnRef/actionsRef 模式），
  // 所以用 ref 暴露给分发器，避免新增 exhaustive-deps 告警。
  const hostRulesRef = useRef(null);
  // P2-3：局内标识 —— 哪些座位是被「托管」的（真人掉线被电脑接管，区别于一开始就补位的电脑）
  const [takenOverSeats, setTakenOverSeats] = useState([]);
  // P2-3：网络状况（往返延迟 + 连接状态），联机时显示在顶栏
  const [netLatency, setNetLatency] = useState(null);
  const [netConn, setNetConn] = useState('disconnected');
  const applyHostRulesIfAny = useCallback((incoming) => {
    if (!incoming) return;
    setRoomRulesState(incoming);
    setConfig((prev) => {
      if (rulesEqual(prev, incoming)) return prev;
      if (!preMatchConfigRef.current) preMatchConfigRef.current = prev; // 记住客人自己的规则，离房后还原
      return applyHostRules(prev, incoming);
    });
    setRulesLocked(true);
    console.log(`[CSMJ] 已套用房主规则：${describeRules(incoming)}`);
  }, []);
  hostRulesRef.current = applyHostRulesIfAny;
  // P0-5：倒计时回调里要读「当前是否处于响应窗口」与「超时该调用谁」，
  // 用 ref 同步（避免把处理器塞进 effect 依赖数组导致闭包读到旧状态）。
  const actionsRef = useRef({});
  const timeoutRef = useRef({});

  // 3. 【核心稳定基石】单一权威状态引用，彻底杜绝闭包过期引起的碰牌/出牌 BUG
  const stateRef = useRef({
    playerHands: [[], [], [], []],
    playerMelds: [[], [], [], []],
    playerDiscards: [[], [], [], []],
    wall: [],
    currentTurn: 0,
    dealerId: 0,
    lastDiscard: null,
    // 规格 §二.4：流局时「最后一张牌由谁摸谁做庄」，因此记录本局最后一次从牌墙取牌的座位
    lastDrawerId: null,
    gameState: 'IDLE'
  });

  useEffect(() => {
    kongDrawOpenRef.current = kongDrawState.isOpen;
  }, [kongDrawState.isOpen]);

  // 联机访客的权威引用同步：访客只收到广播，不会走本地的 stateRef 赋值；
  // 若不镜像，访客的自动出牌/海底判断会一直读到空的牌墙与手牌。
  useEffect(() => {
    const s = stateRef.current;
    s.playerHands = playerHands;
    s.playerMelds = playerMelds;
    s.playerDiscards = playerDiscards;
    s.wall = wall;
    s.currentTurn = currentTurn;
    s.dealerId = dealerId;
    s.lastDiscard = lastDiscard;
    s.gameState = gameState;
  }, [playerHands, playerMelds, playerDiscards, wall, currentTurn, dealerId, lastDiscard, gameState]);

  const handleUpdateConfig = (newConfig) => {
    // 规格 §一：联机且开局后锁定 → 房间规则字段一律以房主的为准，本机只能改偏好（理牌/音效/AI 速度）
    const next = rulesLocked ? { ...newConfig, ...pickMatchRules(config) } : newConfig;
    setConfig(next);
    sound.enabled = next.soundEnabled;
    sound.setVoice(next.voice || 'f');
    localStorage.setItem('cs_mahjong_config', JSON.stringify(next));
  };

  // 离开联机房间 → 回到单机：解开规则锁定并还原客人自己的规则（否则会把房主的规则永久留在本机）
  const handleLeaveRoom = useCallback(() => {
    setRulesLocked(false);
    setRoomRulesState(null);
    setTakenOverSeats([]);
    if (preMatchConfigRef.current) {
      setConfig(preMatchConfigRef.current);
      preMatchConfigRef.current = null;
    }
    const backToSingle = { isMultiplayer: false, isHost: false, roomCode: '', mySeatId: 0, seats: PLAYERS };
    multiplayerRef.current = backToSingle;
    setMultiplayerState(backToSingle);
    setGameState('IDLE');
  }, []);

  // P2-3：订阅网络状况（延迟为最近 5 次 PING/PONG 往返平均，连接状态来自 MQTT 生命周期）
  useEffect(() => {
    network.setOnConnectionState(setNetConn);
    network.setOnLatency((avg) => setNetLatency(avg));
  }, []);

  // 真人语音音色（本机偏好，不参与联机规则同步）
  useEffect(() => {
    sound.enabled = config.soundEnabled !== false;
    sound.setVoice(config.voice || 'f');
  }, [config.soundEnabled, config.voice]);

  useEffect(() => () => {
    if (tableCalloutTimerRef.current) clearTimeout(tableCalloutTimerRef.current);
  }, []);

  const showBubble = (playerId, text, duration = 1200) => {
    // 桌心大字：吃/碰/杠/胡/喜
    const callout = calloutForBubble(text);
    if (callout) {
      const seatName = (multiplayerState.seats?.[playerId]?.name || PLAYERS[playerId]?.name || '')
        .replace(/[（(].*$/, '')
        .trim();
      setTableCallout({
        ...callout,
        seatName,
        key: `${Date.now()}-${Math.random()}`
      });
      if (tableCalloutTimerRef.current) clearTimeout(tableCalloutTimerRef.current);
      tableCalloutTimerRef.current = setTimeout(
        () => setTableCallout(null),
        Math.max(900, Math.min(duration, 1500))
      );
    }
  };
  showBubbleRef.current = showBubble;

  // 听牌分析计算 (我当前手牌)
  const tingMap = useMemo(() => {
    if (!config.showHints || currentTurn !== mySeatId || gameState !== 'PLAYING') {
      return new Map();
    }
    const myHand = playerHands[mySeatId];
    const myMelds = playerMelds[mySeatId];
    if (!myHand || myHand.length % 3 !== 2) return new Map();

    const allKnown = [
      ...myHand,
      ...playerMelds.flat().flatMap(m => m.tiles),
      ...playerDiscards.flat()
    ];
    return analyzeTingCards(myHand, myMelds, config, allKnown);
  }, [playerHands, playerMelds, playerDiscards, currentTurn, gameState, config, mySeatId]);

  // 检测 URL 是否有 ?room=XXXX 邀请链接，有则自动弹起联机窗
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('room')) {
        setIsMultiplayerOpen(true);
      }
    }
  }, []);

  // 原生 APK 每次启动检查 GitHub latest release；网页版无操作。
  useEffect(() => {
    let cancelled = false;
    checkForAppUpdate().then((update) => {
      if (!cancelled && update) setAppUpdate(update);
    });
    return () => { cancelled = true; };
  }, []);

  // -------------------------------------------------------------------------
  // 联机网络事件调度处理 (支持房主与访客双向同步)
  // -------------------------------------------------------------------------
  useEffect(() => {
    network.setOnMessage((data, fromSeatId) => {
      if (network.isHost) {
        // 房主接收访客玩家的指令
        if (data.type === 'DISCARD_ACTION') {
          executeDiscard(data.fromSeatId, data.tile);
        } else if (data.type === 'RESPOND_ACTION') {
          handleGuestActionResponse(data.fromSeatId, data.action, data.payload);
        }
      } else {
        // 访客接收房主广播的游戏状态
        if (data.type === 'GAME_STARTED') {
          const nextMp = {
            isMultiplayer: true,
            isHost: false,
            roomCode: network.roomCode,
            mySeatId: network.mySeatId,
            seats: data.seats || network.seats
          };
          multiplayerRef.current = nextMp;
          setMultiplayerState(nextMp);
          setIsMultiplayerOpen(false);
          hostRulesRef.current?.(data.rules);
          if (typeof data.roundNumber === 'number') setRoundNumber(data.roundNumber);
          rankedRoundRef.current = isRankedMatch({ seats: data.seats || network.seats || [], tookOver: false });
          setGameState('DEALING');
          setIsRollingDice(true);
          sound.playDice();
        } else if (data.type === 'DEAL_HAND') {
          setIsRollingDice(false);
          // 规格 §一：开局这一份载荷带房主的房间规则，客人据此锁定（B/F/抓鸟/开杠/起手胡）
          hostRulesRef.current?.(data.rules);
          setGameState('PLAYING');
          stateRef.current.gameState = 'PLAYING';
          setDealerId(data.dealerId);
          stateRef.current.dealerId = data.dealerId;
          setWall(new Array(data.wallRemaining).fill({}));
          stateRef.current.wall = new Array(data.wallRemaining).fill({});
          setPlayerDiscards([[], [], [], []]);
          setPlayerMelds([[], [], [], []]);

          const mySeat = network.mySeatId;
          setPlayerHands(() => {
            const next = [[], [], [], []];
            for (let i = 0; i < 4; i++) {
              if (i === mySeat) {
                next[i] = data.myHand;
              } else {
                const count = i === data.dealerId ? 14 : 13;
                next[i] = new Array(count).fill({ isBack: true });
              }
            }
            return next;
          });
        } else if (data.type === 'TILE_DISCARDED') {
          sound.playDiscard(data.tile);
          setLastDiscard({ tile: data.tile, fromPlayer: data.playerId, isKongDiscard: data.isKongDiscard });
          stateRef.current.lastDiscard = { tile: data.tile, fromPlayer: data.playerId, isKongDiscard: data.isKongDiscard };
          if (typeof data.wallRemaining === 'number') {
            setWall(new Array(data.wallRemaining).fill({}));
          }
          // 更新弃牌池
          setPlayerDiscards(prev => {
            const next = [...prev];
            next[data.playerId] = [...(next[data.playerId] || []), data.tile];
            return next;
          });
          // 减少该对手的手牌数（开杠补牌进入牌池的牌不是手牌，不能扣）
          if (data.playerId !== network.mySeatId && !data.isKongDiscard) {
            setPlayerHands(prev => {
              const next = [...prev];
              const cur = [...(next[data.playerId] || [])];
              if (cur.length > 0) cur.pop();
              next[data.playerId] = cur;
              return next;
            });
          }
        } else if (data.type === 'PROMPT_ACTION') {
          setAvailableActions(data.availableActions);
          setChiOptions(data.chiOptions || []);
          setKongOptions(data.kongOptions || []);
        } else if (data.type === 'TURN_UPDATE') {
          setCurrentTurn(data.currentTurn);
          stateRef.current.currentTurn = data.currentTurn;
          setTurnTimer(data.turnTimer || 15);
          if (typeof data.wallRemaining === 'number') {
            setWall(new Array(data.wallRemaining).fill({}));
          }
          const mySeat = network.mySeatId;
          if (data.currentTurn === mySeat) {
            if (data.drawnTile) {
              setDrawnTile(data.drawnTile);
              sound.playTileTouch();
              setPlayerHands(prev => {
                const next = [...prev];
                const cur = [...(next[mySeat] || [])];
                if (!cur.some(t => t.id === data.drawnTile.id)) {
                  next[mySeat] = [...cur, data.drawnTile];
                }
                return next;
              });

              // 访客摸牌后，本地自动扫描是否能自摸/暗杠/中途四喜
              setPlayerHands(currentHands => {
                const myH = currentHands[mySeat] || [];
                const myM = playerMelds[mySeat] || [];
                const huRes = checkHu(myH, myM, null, true, {});
                const siXiList = checkMidGameSiXi(myH, config, declaredSiXiRef.current[mySeat]);

                applySelfTurnOptions(myH, myM, huRes, siXiList);
                return currentHands;
              });
            }
          } else {
            setDrawnTile(null);
            // 对手摸牌，其手牌增加一张暗牌
            setPlayerHands(prev => {
              const next = [...prev];
              const cur = [...(next[data.currentTurn] || [])];
              if (cur.length < 14) {
                next[data.currentTurn] = [...cur, { isBack: true }];
              }
              return next;
            });
          }
        } else if (data.type === 'MELD_BROADCAST') {
          sound.playMeld(data.meldType);
          showBubbleRef.current?.(data.playerId, data.meldType === 'chi' ? '吃！' : data.meldType === 'peng' ? '碰！' : '杠！');
          setPlayerMelds(prev => {
            const next = [...prev];
            next[data.playerId] = [...(next[data.playerId] || []), data.meldGroup];
            return next;
          });
          // 吃/碰/明杠从弃牌池拿牌；暗杠/补杠不经过弃牌池
          const claimFromDiscard = data.fromDiscard !== undefined
            ? data.fromDiscard
            : !['an_gang', 'bu_gang'].includes(data.meldType);
          const claimFromPlayer = data.fromPlayer ?? lastDiscard?.fromPlayer;
          if (claimFromDiscard && claimFromPlayer !== undefined) {
            setPlayerDiscards(prev => {
              const next = [...prev];
              const cur = [...(next[claimFromPlayer] || [])];
              if (cur.length > 0) cur.pop();
              next[claimFromPlayer] = cur;
              return next;
            });
          }
          const handDelta = Number.isInteger(data.handDelta)
            ? data.handDelta
            : data.meldType === 'an_gang'
              ? 4
              : data.meldType === 'bu_gang'
                ? 1
                : data.meldType === 'gang'
                  ? 3
                  : 2;
          setPlayerHands(prev => {
            const next = [...prev];
            let cur = [...(next[data.playerId] || [])];

            if (data.playerId === network.mySeatId) {
              if (data.meldType === 'chi') {
                // 吃：从手牌里扣掉除「被吃的那张」之外的两张
                const claimedId = data.meldGroup?.tile?.id;
                (data.meldGroup?.tiles || []).forEach(t => {
                  if (t.id === claimedId) return;
                  let idx = cur.findIndex(x => x.id === t.id);
                  if (idx === -1) idx = cur.findIndex(x => x.suit === t.suit && x.value === t.value);
                  if (idx !== -1) cur.splice(idx, 1);
                });
              } else {
                // 碰 / 明杠 / 暗杠 / 补杠：按 handDelta 扣同点数的牌
                const key = data.meldGroup?.tile ? getTileKey(data.meldGroup.tile) : null;
                for (let i = 0; i < handDelta; i++) {
                  const idx = key ? cur.findIndex(t => getTileKey(t) === key) : -1;
                  if (idx === -1) break;
                  cur.splice(idx, 1);
                }
              }
              if (config.autoSort) cur.sort(compareTiles);
            } else {
              for (let i = 0; i < handDelta && cur.length > 0; i++) cur.pop();
            }

            next[data.playerId] = cur;
            return next;
          });
        } else if (data.type === 'STARTING_HU_BROADCAST') {
          // 起手胡只做「座位横幅 + 局终结算」，不再弹窗拦停牌局，也不再立即加分
          const events = data.events || [];
          setStartingHuEvents(events);
          startingHuPendingRef.current = events;
        } else if (data.type === 'SI_XI_BROADCAST') {
          showBubbleRef.current?.(data.playerId, data.text);
          if (data.changes) {
            setPlayerScores(prev => prev.map((s, i) => s + (data.changes[i] || 0)));
          }
        } else if (data.type === 'ROUND_WIN_BROADCAST') {
          setRoundResult(data.result);
          setGameState('ROUND_OVER');
          stateRef.current.gameState = 'ROUND_OVER';
          if (data.result.scoreChanges) {
            setPlayerScores(prev => prev.map((s, idx) => s + (data.result.scoreChanges[idx] || 0)));
            if (rankedRoundRef.current) {
              setMyRecord(recordRound(
                typeof localStorage !== 'undefined' ? localStorage : null,
                { scoreDelta: data.result.scoreChanges[network.mySeatId] || 0 }
              ));
            }
          }
        } else if (data.type === 'BUBBLE_BROADCAST') {
          showBubbleRef.current?.(data.playerId, data.text);
        }
      }
    });
    // 网络调度只注册一次，处理器从 ref/最新闭包读取；这是既有的单一长连接模式。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, lastDiscard]);

  // 房主处理访客的胡碰吃过响应
  const handleGuestActionResponse = (seatId, action, payload = {}) => {
    if (action === 'hu') {
      // P1-2：多人能胡时按通炮一次结算（含其他座位的胡家）
      if (resolvePendingHu(seatId, true)) return;
      const isSelfDrawn = stateRef.current.currentTurn === seatId;
      const tile = isSelfDrawn
        ? stateRef.current.playerHands[seatId][stateRef.current.playerHands[seatId].length - 1]
        : stateRef.current.lastDiscard?.tile;
      const loserId = isSelfDrawn ? seatId : (stateRef.current.lastDiscard?.fromPlayer ?? 0);
      const huRes = checkHu(stateRef.current.playerHands[seatId], stateRef.current.playerMelds[seatId], tile, isSelfDrawn, { isLastTile: stateRef.current.wall.length === 0 });
      handleRoundWin(seatId, loserId, tile, isSelfDrawn, huRes.huTypes);
    } else if (action === 'peng') {
      executePeng(seatId, stateRef.current.lastDiscard.tile, stateRef.current.lastDiscard.fromPlayer);
    } else if (action === 'chi') {
      executeChi(seatId, payload.sequenceTiles, stateRef.current.lastDiscard.tile, stateRef.current.lastDiscard.fromPlayer);
    } else if (action === 'gang') {
      executeKong(seatId, payload.kongOption, stateRef.current.lastDiscard?.tile);
    } else if (action === 'bu') {
      executeBu(seatId);
    } else if (action === 'siXi') {
      executeMidGameSiXi(seatId, payload.siXiOption);
    } else if (action === 'pass') {
      // P1-2：这位访客「过」了，其他人（含电脑）的胡照常结算；都放弃了才轮到下家
      if (resolvePendingHu(seatId, false)) return;
      // 访客点“过”，继续让后续玩家评估
      processAiResponses(stateRef.current.lastDiscard);
    }
  };

  // 启动多人游戏
  const handleStartMultiplayerGame = (roomConfig) => {
    const nextMp = {
      isMultiplayer: true,
      isHost: roomConfig.isHost,
      roomCode: roomConfig.roomCode,
      mySeatId: roomConfig.mySeatId,
      seats: roomConfig.seats
    };
    multiplayerRef.current = nextMp;
    setMultiplayerState(nextMp);
    startNewRound(nextMp);
  };

  // -------------------------------------------------------------------------
  // 开局发牌与起手胡流程
  // -------------------------------------------------------------------------
  const startNewRound = useCallback((overrideMp = null) => {
    aiTurnTokenRef.current += 1;
    const mp = overrideMp || multiplayerRef.current;
    // 战绩裁定：开局的四个座位必须全是真人（有 AI 补位/单机练习 → 本局不计入本机记录）。
    // 本局一旦出现托管（掉线/看门狗接管），下面会在接管回调里把它置回 false。
    rankedRoundRef.current = isRankedMatch({ seats: mp.seats || [], tookOver: false });
    // D6 局数：结算后再开一局 → 递增；从大厅重新开一场 → 归 1
    roundNoRef.current = stateRef.current.gameState === 'ROUND_OVER' ? roundNoRef.current + 1 : 1;
    setRoundNumber(roundNoRef.current);
    sound.init();
    sound.playDice();
    sound.playDeal();

    setIsRollingDice(true);
    setGameState('DEALING');
    stateRef.current.gameState = 'DEALING';
    setLastDiscard(null);
    stateRef.current.lastDiscard = null;
    setDrawnTile(null);
    setRoundResult(null);
    setStartingHuEvents([]);
    startingHuPendingRef.current = [];
    setMidGameSiXiOptions([]);
    declaredSiXiRef.current = [new Set(), new Set(), new Set(), new Set()];
    setKongDrawState({ isOpen: false, kongPlayer: null, drawnTiles: [], count: 2, canSelfHu: false });
    setTableCallout(null);
    if (tableCalloutTimerRef.current) clearTimeout(tableCalloutTimerRef.current);
    setAvailableActions({ hu: false, siXi: false, gang: false, peng: false, chi: false, pass: false });

    stateRef.current.playerDiscards = [[], [], [], []];
    stateRef.current.playerMelds = [[], [], [], []];
    stateRef.current.lastDrawerId = null;
    setPlayerDiscards([[], [], [], []]);
    setPlayerMelds([[], [], [], []]);

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    setDiceValues([d1, d2]);

    // 若是联机房主，向所有人广播开局
    if (mp.isMultiplayer && mp.isHost) {
      network.broadcast({ type: 'GAME_STARTED', seats: mp.seats, roundNumber: roundNoRef.current });
    }

    setTimeout(() => {
      setIsRollingDice(false);

      const newDeck = generateDeck();
      setWallTotal(newDeck.length);
      const hands = [[], [], [], []];
      for (let i = 0; i < 4; i++) {
        const count = i === dealerId ? 14 : 13;
        hands[i] = newDeck.splice(0, count);
        hands[i].sort(compareTiles);
      }

      stateRef.current.playerHands = hands;
      stateRef.current.wall = newDeck;
      stateRef.current.currentTurn = dealerId;
      stateRef.current.dealerId = dealerId;

      setWall(newDeck);
      setPlayerHands([...hands]);
      setCurrentTurn(dealerId);

      // 若联机，房主向每个真人座位安全发送各自手牌
      if (mp.isMultiplayer && mp.isHost) {
        for (let s = 1; s < 4; s++) {
          if (mp.seats[s]?.isHuman) {
            network.sendToSeat(s, {
              type: 'DEAL_HAND',
              myHand: hands[s],
              dealerId,
              wallRemaining: newDeck.length,
              rules: pickMatchRules(config)
            });
          }
        }
      }

      // 起手胡扫描
      const startingEvents = [];
      hands.forEach((hand, pIdx) => {
        const huList = checkStartingHu(hand, config);
        huList.forEach(item => {
          if (item.type === 'daSiXi') {
            declaredSiXiRef.current[pIdx].add(getTileKey(item.tiles[0]));
          }
        });
        if (huList.length > 0) {
          const playerName = mp.isMultiplayer ? mp.seats[pIdx]?.name : PLAYERS[pIdx].name;
          startingEvents.push({
            player: { ...PLAYERS[pIdx], name: playerName },
            // 起手胡要摊牌给其余三家看；完整手牌由座位横幅直接展示
            hand: [...hand],
            huList
          });
        }
      });

      if (startingEvents.length > 0) {
        // 规格 §七.2/§八.10：每个起手胡各摇一次骰子、各自独立按「小胡自摸」结算。
        // 这里只算好分数挂起，局终再和胡牌/流局一起结算，不在开局时弹窗拦停。
        const { B, F } = normalizeScoreParams(config);
        const scoredEvents = startingEvents.map(evt => {
          const perHu = evt.huList.map(hu => {
            const birdValues = rollBirdDice(config.birdCount || 0, secureRandomInt);
            const scored = scoreRound({ method: 'qishou', B, F, winner: { seat: evt.player.id }, birdValues });
            return {
              name: hu.name,
              birdValues,
              changes: scored.changes,
              details: scored.details,
              birdDetail: scored.birdDetail,
              cap: scored.cap
            };
          });
          const changes = [0, 0, 0, 0];
          perHu.forEach(p => p.changes.forEach((c, i) => { changes[i] += c; }));
          return { ...evt, perHuScores: perHu, scoreChanges: changes };
        });

        setStartingHuEvents(scoredEvents);
        startingHuPendingRef.current = scoredEvents;

        if (mp.isMultiplayer && mp.isHost) {
          network.broadcast({ type: 'STARTING_HU_BROADCAST', events: scoredEvents });
        }
      }

      // 起手胡不再阻塞开局：直接进入行牌，座位横幅一直提示到本局结束
      enterPlayingState(dealerId, hands, newDeck, mp);
    }, 900);
  }, [dealerId, config]);

  const enterPlayingState = (activeDealerId, hands, currentWall, mp = multiplayerRef.current) => {
    setGameState('PLAYING');
    stateRef.current.gameState = 'PLAYING';
    setCurrentTurn(activeDealerId);
    stateRef.current.currentTurn = activeDealerId;
    setTurnTimer(15);

    const dealerHand = hands[activeDealerId];
    const initialDrawn = dealerHand[dealerHand.length - 1];
    setDrawnTile(initialDrawn);

    if (activeDealerId === 0) {
      const huRes = checkHu(dealerHand, [], null, true, {});
      const siXiList = checkMidGameSiXi(dealerHand, config, declaredSiXiRef.current[0]);

      applySelfTurnOptions(dealerHand, [], huRes, siXiList);
    } else {
      // 若庄家是联机真人，通知出牌；若是 AI 则自动触发
      if (mp.isMultiplayer && mp.seats[activeDealerId]?.isHuman) {
        network.sendToSeat(activeDealerId, {
          type: 'TURN_UPDATE',
          currentTurn: activeDealerId,
          turnTimer: 15,
          wallRemaining: currentWall.length,
          drawnTile: initialDrawn
        });
      } else {
        triggerAiTurn(activeDealerId);
      }
    }
  };

  // -------------------------------------------------------------------------
  // 倒计时
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (gameState !== 'PLAYING' || kongDrawState.isOpen) return;

    timerRef.current = setInterval(() => {
      setTurnTimer(prev => {
        if (prev <= 1) {
          // P0-5：响应窗口也要有超时兜底，否则本地玩家不点「过」就整局卡死。
          // 处理器经 ref 调用，避免把 handleHumanPass/handleTimeoutAutoDiscard 加进依赖数组。
          const action = resolveTimeoutAction({
            currentTurn: stateRef.current.currentTurn,
            mySeatId,
            pendingResponse: hasPendingResponse(actionsRef.current)
          });
          if (action === 'discard') {
            timeoutRef.current.autoDiscard?.();
          } else if (action === 'pass') {
            timeoutRef.current.pass?.();
          }
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [gameState, mySeatId, kongDrawState.isOpen]);

  // 监听屏幕方向变化 (双重检测：matchMedia + 窗口尺寸)
  useEffect(() => {
    const checkOrientation = () => {
      // 方法1: matchMedia API
      const mediaQuery = window.matchMedia('(orientation: portrait)');
      const isPortraitByMedia = mediaQuery.matches;

      // 方法2: 窗口尺寸 (作为fallback)
      const isPortraitBySize = window.innerHeight > window.innerWidth;

      // 优先用 matchMedia，如果不支持则用尺寸判断
      const isPortraitMode = isPortraitByMedia !== undefined ? isPortraitByMedia : isPortraitBySize;

      console.log('[Orientation] matchMedia:', isPortraitByMedia, 'size:', isPortraitBySize, 'final:', isPortraitMode);
      setIsPortrait(isPortraitMode);
    };

    // 初始化
    checkOrientation();

    // 监听多种事件 (某些浏览器只触发其中一种)
    const mediaQuery = window.matchMedia('(orientation: portrait)');

    const handleChange = () => {
      console.log('[Orientation] Event triggered');
      checkOrientation();
    };

    // matchMedia change事件
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    // resize 和 orientationchange 作为fallback
    window.addEventListener('resize', handleChange);
    window.addEventListener('orientationchange', handleChange);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
      window.removeEventListener('resize', handleChange);
      window.removeEventListener('orientationchange', handleChange);
    };
  }, []);

  const handleTimeoutAutoDiscard = () => {
    if (stateRef.current.gameState !== 'PLAYING' || kongDrawOpenRef.current) return;
    // Use stateRef for current game state, not stale closure variables
    const curHand = stateRef.current.playerHands[mySeatId];
    if (!curHand || curHand.length === 0) return;

    // If we're not actually the current turn, bail (multiplayer race condition)
    if (stateRef.current.currentTurn !== mySeatId) return;

    // Pick the last tile in hand (if we just drew, it's at the end)
    const tileToDiscard = curHand[curHand.length - 1];
    executeDiscard(mySeatId, tileToDiscard);
  };

  // -------------------------------------------------------------------------
  // 出牌逻辑
  // -------------------------------------------------------------------------
  const executeDiscard = (playerId, tile) => {
    if (!tile) return;
    if (stateRef.current.gameState !== 'PLAYING') return;

    sound.playDiscard(tile);
    setTurnTimer(15);
    setAvailableActions({ hu: false, gang: false, peng: false, chi: false, pass: false });
    setDrawnTile(null);

    const mp = multiplayerRef.current;
    // 如果我是访客，向房主发送出牌意图
    if (mp.isMultiplayer && !mp.isHost) {
      network.sendToHost({ type: 'DISCARD_ACTION', tile });
      // 客户端乐观更新自身手牌
      setPlayerHands(prev => {
        const next = [...prev];
        const cur = [...(next[playerId] || [])];
        const idx = cur.findIndex(t => t.id === tile.id);
        if (idx !== -1) cur.splice(idx, 1);
        else cur.pop();
        if (config.autoSort) cur.sort(compareTiles);
        next[playerId] = cur;
        return next;
      });
      return;
    }

    // 1. 房主/本地模式从权威引用中剔除该牌
    const curHand = [...stateRef.current.playerHands[playerId]];
    const idx = curHand.findIndex(t => t.id === tile.id);
    if (idx !== -1) {
      curHand.splice(idx, 1);
    } else {
      const matchIdx = curHand.findIndex(t => t.suit === tile.suit && t.value === tile.value);
      if (matchIdx !== -1) {
        curHand.splice(matchIdx, 1);
      } else {
        curHand.pop();
      }
    }

    if (playerId === 0 && config.autoSort) {
      curHand.sort(compareTiles);
    }
    stateRef.current.playerHands[playerId] = curHand;
    setPlayerHands([...stateRef.current.playerHands]);

    // 2. 放入出牌池
    stateRef.current.playerDiscards[playerId] = [
      ...stateRef.current.playerDiscards[playerId],
      tile
    ];
    setPlayerDiscards([...stateRef.current.playerDiscards]);

    const discardEvent = {
      tile,
      fromPlayer: playerId,
      isKongDiscard: false
    };
    stateRef.current.lastDiscard = discardEvent;
    setLastDiscard(discardEvent);

    // 广播出牌给联机所有人
    if (mp.isMultiplayer && mp.isHost) {
      network.broadcast({
        type: 'TILE_DISCARDED',
        playerId,
        tile,
        isKongDiscard: false,
        wallRemaining: stateRef.current.wall.length
      });
    }

    // 3. 询问三家反应 (胡 > 杠 > 碰 > 吃)
    processDiscardResponses(discardEvent);
  };

  // P1-2：统一结算胡家 —— 一家 = 点炮，多家 = 一炮多响（通炮，逐家按各自番型、各自 k/n 结算）
  const settleWinners = (winners, payer, tile, discardEvent) => {
    pendingHuRef.current = null;
    if (!winners || winners.length === 0) {
      if (discardEvent) passToNextPlayer(discardEvent.fromPlayer);
      return;
    }
    if (winners.length === 1) {
      const w = winners[0];
      handleRoundWin(w.seat, payer, tile, false, w.huTypes);
      return;
    }
    const entries = winners.map(w => huEntryFromTypes(w.seat, w.huTypes));
    handleRoundWin(entries[0].seat, payer, tile, false, entries[0].huTypes, {
      method: 'tongpao',
      winners: entries
    });
  };

  // 真人胡家做决定（胡 / 过）。全部真人都决定完才结算 —— 期间电脑胡家一并挂起，
  // 这样「真人过牌」不会吞掉别家的胡（ROADMAP P1-2 ③）。
  // @returns {boolean} 是否消费了这次决定（true = 调用方不要再往下走）
  const resolvePendingHu = (seat, accepted) => {
    const pending = pendingHuRef.current;
    if (!pending || !pending.pendingHumans.has(seat)) return false;

    pending.pendingHumans.delete(seat);
    if (accepted) pending.accepted.push(seat);
    if (pending.pendingHumans.size > 0) return true; // 还有真人没决定，继续挂着

    const winners = pending.winners.filter(w => !w.isHuman || pending.accepted.includes(w.seat));
    const { discardEvent, payer } = pending;
    pendingHuRef.current = null;
    if (winners.length === 0) {
      passToNextPlayer(discardEvent.fromPlayer);
      return true;
    }
    settleWinners(winners, payer, discardEvent.tile, discardEvent);
    return true;
  };

  // P1-2：一张牌的响应判定 —— 先把四家的选项一次算清，再按「胡 > 杠 > 碰 > 吃」定谁响应。
  // 旧实现在这里「本地真人只要有选项就 return」，会让真人的碰/吃吞掉别家的胡（ROADMAP P1-2 ①③）。
  const processDiscardResponses = (discardEvent) => {
    const { tile, fromPlayer } = discardEvent;
    const mp = multiplayerRef.current;
    const isLastTile = stateRef.current.wall.length === 0;
    const isHumanSeat = (s) => s === 0 || (mp.isMultiplayer && mp.seats[s]?.isHuman === true);

    const candidates = [];
    for (let s = 0; s < 4; s++) {
      if (s === fromPlayer) continue;
      const hand = stateRef.current.playerHands[s];
      const melds = stateRef.current.playerMelds[s];
      if (!Array.isArray(hand) || hand.length === 0) continue;

      const distance = (s - fromPlayer + 4) % 4; // 1 = 下家
      const isFromPrev = distance === 1;         // 只有下家能吃
      const huRes = checkHu(hand, melds, tile, false, { isKongDiscard: discardEvent.isKongDiscard, isLastTile });
      const kOptions = getKongOptions(hand, melds, tile, config);
      const pAllowed = canPeng(hand, tile);
      const cOptions = isFromPrev ? getChiOptions(hand, tile) : [];

      let aiDecision = null;
      let want;
      if (isHumanSeat(s)) {
        // 真人：明杠也必须先听牌；其他选项照常弹
        want = { hu: huRes.canHu, gang: kOptions.length > 0 && isTingHand(hand, melds, config), peng: pAllowed, chi: cOptions.length > 0 };
      } else {
        // 电脑：尊重 AI 自己的意愿（它也可能选择不碰/不吃）
        aiDecision = decideAiResponse(hand, melds, tile, isFromPrev, config, {
          isKongDiscard: discardEvent.isKongDiscard,
          isLastTile
        });
        want = {
          hu: aiDecision.action === 'hu',
          gang: aiDecision.action === 'gang',
          peng: aiDecision.action === 'peng',
          chi: aiDecision.action === 'chi'
        };
      }

      if (!want.hu && !want.gang && !want.peng && !want.chi) continue;
      candidates.push({ seat: s, distance, isHuman: isHumanSeat(s), huTypes: huRes.huTypes, kOptions, cOptions, aiDecision, ...want });
    }

    const plan = resolveDiscardResponses(candidates);
    const findCand = (seat) => candidates.find(c => c.seat === seat);

    // 0. 谁都不能响应 → 轮到下家摸牌
    if (plan.action === 'pass') {
      passToNextPlayer(fromPlayer);
      return;
    }

    // 1. 有人能胡 → 胡优先于一切吃碰杠；多家能胡即一炮多响
    if (plan.action === 'hu') {
      const winners = plan.winners.map(findCand).filter(Boolean);
      const humanWinners = winners.filter(w => w.isHuman);
      setChiOptions([]);
      setKongOptions([]);
      setAvailableActions({ hu: false, gang: false, peng: false, chi: false, pass: false });

      if (humanWinners.length === 0) {
        settleWinners(winners, fromPlayer, tile, discardEvent);
        return;
      }

      // 有真人胡家：全部胡家（含电脑）先挂起，等真人决定；这期间不给任何人弹吃碰杠
      pendingHuRef.current = {
        discardEvent,
        winners,
        payer: fromPlayer,
        pendingHumans: new Set(humanWinners.map(w => w.seat)),
        accepted: []
      };
      humanWinners.forEach(w => {
        if (w.seat === 0) {
          setAvailableActions({ hu: true, gang: false, peng: false, chi: false, pass: true });
          return;
        }
        network.sendToSeat(w.seat, {
          type: 'PROMPT_ACTION',
          availableActions: { hu: true, gang: false, peng: false, chi: false, pass: true },
          chiOptions: [],
          kongOptions: []
        });
      });
      return;
    }

    // 2. 杠 / 碰 / 吃：同级按顺位，只由最近的一家响应
    const claim = findCand(plan.seat);
    if (!claim) {
      passToNextPlayer(fromPlayer);
      return;
    }

    if (claim.isHuman) {
      const actions = { hu: false, gang: claim.gang, peng: claim.peng, chi: claim.chi, pass: true };
      if (claim.seat === 0) {
        setAvailableActions(actions);
        setChiOptions(claim.cOptions);
        setKongOptions(claim.kOptions);
      } else {
        network.sendToSeat(claim.seat, {
          type: 'PROMPT_ACTION',
          availableActions: actions,
          chiOptions: claim.cOptions,
          kongOptions: claim.kOptions
        });
      }
      return;
    }

    if (plan.action === 'gang') {
      showBubble(claim.seat, '杠！');
      executeKong(claim.seat, claim.aiDecision?.kongOption || claim.kOptions[0], tile);
      return;
    }
    if (plan.action === 'peng') {
      showBubble(claim.seat, '碰！');
      executePeng(claim.seat, tile, fromPlayer);
      return;
    }
    if (plan.action === 'chi') {
      showBubble(claim.seat, '吃！');
      executeChi(claim.seat, claim.aiDecision?.tiles || claim.cOptions[0], tile, fromPlayer);
      return;
    }
    passToNextPlayer(fromPlayer);
  };

  const processAiResponses = (discardEvent) => {
    const { tile, fromPlayer } = discardEvent;
    const mp = multiplayerRef.current;
    const otherPlayers = [1, 2, 3]
      .map(offset => (fromPlayer + offset) % 4)
      .filter(id => id !== 0);

    // A. 评估是否有人点炮胡牌
    for (const pId of otherPlayers) {
      // 如果该座位是真人，跳过 AI
      if (mp.isMultiplayer && mp.seats[pId]?.isHuman) continue;

      const hand = stateRef.current.playerHands[pId];
      const melds = stateRef.current.playerMelds[pId];
      const decision = decideAiResponse(hand, melds, tile, false, config, {
        isKongDiscard: discardEvent.isKongDiscard,
        isLastTile: stateRef.current.wall.length === 0
      });
      if (decision.action === 'hu') {
        showBubble(pId, '胡！');
        handleRoundWin(pId, fromPlayer, tile, false, decision.huResult.huTypes);
        return;
      }
    }

    // B. 评估是否有人开杠或碰牌
    for (const pId of otherPlayers) {
      if (mp.isMultiplayer && mp.seats[pId]?.isHuman) continue;

      const hand = stateRef.current.playerHands[pId];
      const melds = stateRef.current.playerMelds[pId];
      const isPrev = ((fromPlayer + 1) % 4 === pId);
      const decision = decideAiResponse(hand, melds, tile, isPrev, config, { isLastTile: stateRef.current.wall.length === 0 });

      if (decision.action === 'gang') {
        showBubble(pId, '杠！');
        executeKong(pId, decision.kongOption, tile);
        return;
      }
      if (decision.action === 'peng') {
        showBubble(pId, '碰！');
        executePeng(pId, tile, fromPlayer);
        return;
      }
    }

    // C. 评估下家吃牌
    const nextPlayerId = (fromPlayer + 1) % 4;
    if (nextPlayerId !== 0 && (!mp.isMultiplayer || !mp.seats[nextPlayerId]?.isHuman)) {
      const hand = stateRef.current.playerHands[nextPlayerId];
      const melds = stateRef.current.playerMelds[nextPlayerId];
      const decision = decideAiResponse(hand, melds, tile, true, config, { isLastTile: stateRef.current.wall.length === 0 });
      if (decision.action === 'chi') {
        showBubble(nextPlayerId, '吃！');
        executeChi(nextPlayerId, decision.tiles, tile, fromPlayer);
        return;
      }
    }

    // 无人碰杠吃胡，轮到下家正常摸牌
    passToNextPlayer(fromPlayer);
  };

  // -------------------------------------------------------------------------
  // 吃 / 碰 / 杠 执行
  // -------------------------------------------------------------------------
  const executePeng = (playerId, tile, fromPlayer) => {
    if (stateRef.current.gameState !== 'PLAYING') return;
    sound.playMeld('peng');
    showBubble(playerId, '碰！');

    const fromDiscards = [...stateRef.current.playerDiscards[fromPlayer]];
    if (fromDiscards.length > 0) {
      fromDiscards.pop();
      stateRef.current.playerDiscards[fromPlayer] = fromDiscards;
      setPlayerDiscards([...stateRef.current.playerDiscards]);
    }

    const currentHand = [...stateRef.current.playerHands[playerId]];
    const matching = currentHand.filter(t => t.suit === tile.suit && t.value === tile.value);
    if (matching.length < 2) return;

    const tile1 = matching[0];
    const tile2 = matching[1];
    const newHand = currentHand.filter(t => t.id !== tile1.id && t.id !== tile2.id);

    stateRef.current.playerHands[playerId] = newHand;
    setPlayerHands([...stateRef.current.playerHands]);

    const meldGroup = {
      type: 'peng',
      tile,
      tiles: [tile1, tile, tile2]
    };
    stateRef.current.playerMelds[playerId] = [
      ...stateRef.current.playerMelds[playerId],
      meldGroup
    ];
    setPlayerMelds([...stateRef.current.playerMelds]);

    stateRef.current.currentTurn = playerId;
    stateRef.current.lastDiscard = null;
    setCurrentTurn(playerId);
    setTurnTimer(15);
    setDrawnTile(null);
    setLastDiscard(null);

    // 广播面子给所有联机客户端
    const mp = multiplayerRef.current;
    if (mp.isMultiplayer && mp.isHost) {
      network.broadcast({
        type: 'MELD_BROADCAST',
        playerId,
        meldType: 'peng',
        handDelta: 2,
        fromDiscard: true,
        fromPlayer,
        meldGroup
      });
      network.broadcast({
        type: 'TURN_UPDATE',
        currentTurn: playerId,
        turnTimer: 15,
        wallRemaining: stateRef.current.wall.length
      });
    }

    if (playerId === 0) {
      setAvailableActions({ hu: false, gang: false, peng: false, chi: false, pass: false });
    } else {
      if (mp.isMultiplayer && mp.seats[playerId]?.isHuman) {
        network.sendToSeat(playerId, {
          type: 'TURN_UPDATE',
          currentTurn: playerId,
          turnTimer: 15,
          wallRemaining: stateRef.current.wall.length
        });
      } else {
        setTimeout(() => {
          const botHand = stateRef.current.playerHands[playerId];
          const botMelds = stateRef.current.playerMelds[playerId];
          const tileToDiscard = chooseAiDiscard(botHand, botMelds, config) || botHand[0];
          executeDiscard(playerId, tileToDiscard);
        }, config.aiSpeed);
      }
    }
  };

  const executeChi = (playerId, sequenceTiles, discardedTile, fromPlayer) => {
    if (stateRef.current.gameState !== 'PLAYING') return;
    sound.playMeld('chi');
    showBubble(playerId, '吃！');

    const fromDiscards = [...stateRef.current.playerDiscards[fromPlayer]];
    if (fromDiscards.length > 0) {
      fromDiscards.pop();
      stateRef.current.playerDiscards[fromPlayer] = fromDiscards;
      setPlayerDiscards([...stateRef.current.playerDiscards]);
    }

    const tilesToDeduct = sequenceTiles.filter(t => t.id !== discardedTile.id);
    let curHand = [...stateRef.current.playerHands[playerId]];

    tilesToDeduct.forEach(d => {
      const idx = curHand.findIndex(t => t.suit === d.suit && t.value === d.value);
      if (idx !== -1) curHand.splice(idx, 1);
    });

    stateRef.current.playerHands[playerId] = curHand;
    setPlayerHands([...stateRef.current.playerHands]);
    // 用户需求：吃牌要把吃的牌放中间！
    // 两个手牌按点数排序分别置于两侧，被吃的牌（discardedTile）严格置于中间（索引为1）
    let foundTarget = false;
    const otherTiles = [];
    sequenceTiles.forEach(t => {
      const isTarget = t.id ? t.id === discardedTile.id : (t.suit === discardedTile.suit && t.value === discardedTile.value);
      if (isTarget && !foundTarget) {
        foundTarget = true;
      } else {
        otherTiles.push(t);
      }
    });
    otherTiles.sort((a, b) => a.value - b.value);
    const orderedChiTiles = otherTiles.length === 2 
      ? [otherTiles[0], discardedTile, otherTiles[1]]
      : sequenceTiles;

    const meldGroup = {
      type: 'chi',
      tile: discardedTile,
      tiles: orderedChiTiles
    };
    stateRef.current.playerMelds[playerId] = [
      ...stateRef.current.playerMelds[playerId],
      meldGroup
    ];
    setPlayerMelds([...stateRef.current.playerMelds]);

    stateRef.current.currentTurn = playerId;
    stateRef.current.lastDiscard = null;
    setCurrentTurn(playerId);
    setTurnTimer(15);
    setDrawnTile(null);
    setLastDiscard(null);

    const mp = multiplayerRef.current;
    if (mp.isMultiplayer && mp.isHost) {
      network.broadcast({
        type: 'MELD_BROADCAST',
        playerId,
        meldType: 'chi',
        handDelta: 2,
        fromDiscard: true,
        fromPlayer,
        meldGroup
      });
      network.broadcast({
        type: 'TURN_UPDATE',
        currentTurn: playerId,
        turnTimer: 15,
        wallRemaining: stateRef.current.wall.length
      });
    }

    if (playerId === 0) {
      setAvailableActions({ hu: false, gang: false, peng: false, chi: false, pass: false });
    } else {
      if (mp.isMultiplayer && mp.seats[playerId]?.isHuman) {
        network.sendToSeat(playerId, {
          type: 'TURN_UPDATE',
          currentTurn: playerId,
          turnTimer: 15,
          wallRemaining: stateRef.current.wall.length
        });
      } else {
        setTimeout(() => {
          const botHand = stateRef.current.playerHands[playerId];
          const botMelds = stateRef.current.playerMelds[playerId];
          const tileToDiscard = chooseAiDiscard(botHand, botMelds, config) || botHand[0];
          executeDiscard(playerId, tileToDiscard);
        }, config.aiSpeed);
      }
    }
  };

  const executeKong = (playerId, kongOption, targetTile = null) => {
    if (stateRef.current.gameState !== 'PLAYING') return;
    sound.playMeld('gang');
    showBubble(playerId, '杠！');

    const { type, tile } = kongOption;
    let curHand = [...stateRef.current.playerHands[playerId]];
    let kongTiles = [];

    if (type === 'ming' && targetTile) {
      const fromPlayer = stateRef.current.lastDiscard?.fromPlayer ?? (playerId + 3) % 4;
      const fromDiscards = [...stateRef.current.playerDiscards[fromPlayer]];
      if (fromDiscards.length > 0) {
        fromDiscards.pop();
        stateRef.current.playerDiscards[fromPlayer] = fromDiscards;
        setPlayerDiscards([...stateRef.current.playerDiscards]);
      }

      let removed = 0;
      curHand = curHand.filter(t => {
        if (removed < 3 && t.suit === tile.suit && t.value === tile.value) {
          removed++;
          return false;
        }
        return true;
      });

      kongTiles = [tile, tile, tile, tile];
      stateRef.current.playerMelds[playerId] = [
        ...stateRef.current.playerMelds[playerId],
        { type: 'gang', tile, tiles: kongTiles }
      ];
    } else if (type === 'an') {
      curHand = curHand.filter(t => getTileKey(t) !== getTileKey(tile));
      kongTiles = [tile, tile, tile, tile];
      stateRef.current.playerMelds[playerId] = [
        ...stateRef.current.playerMelds[playerId],
        { type: 'an_gang', tile, tiles: kongTiles }
      ];
    } else if (type === 'bu') {
      // 抢杠胡（Q11）：补杠的这张牌，其他家可以抢胡；抢胡成立则本次补杠不成立
      const robbers = [0, 1, 2, 3]
        .filter(s => s !== playerId)
        .map(s => ({
          seat: s,
          huRes: checkHu(
            stateRef.current.playerHands[s],
            stateRef.current.playerMelds[s],
            tile, false,
            { isRobbingKong: true, isLastTile: stateRef.current.wall.length === 0 }
          )
        }))
        .filter(r => r.huRes.canHu)
        .map(r => ({ seat: r.seat, huTypes: r.huRes.huTypes }));

      if (robbers.length > 0) {
        robbers.forEach(r => showBubble(r.seat, '抢杠胡！'));
        const winners = robbers.map(r => huEntryFromTypes(r.seat, ['抢杠胡', ...r.huTypes.filter(t => t !== '平胡')]));
        if (winners.length === 1) {
          handleRoundWin(robbers[0].seat, playerId, tile, false, winners[0].huTypes);
        } else {
          handleRoundWin(winners[0].seat, playerId, tile, false, winners[0].huTypes, { method: 'tongpao', winners });
        }
        return;
      }

      const idx = curHand.findIndex(t => t.id === tile.id);
      if (idx !== -1) curHand.splice(idx, 1);

      stateRef.current.playerMelds[playerId] = stateRef.current.playerMelds[playerId].map(m => {
        if (m.type === 'peng' && m.tile.suit === tile.suit && m.tile.value === tile.value) {
          return { type: 'gang', tile, tiles: [...m.tiles, tile] };
        }
        return m;
      });
      kongTiles = [tile, tile, tile, tile];
    }

    stateRef.current.playerHands[playerId] = curHand;
    setPlayerHands([...stateRef.current.playerHands]);
    setPlayerMelds([...stateRef.current.playerMelds]);

    const mp = multiplayerRef.current;
    if (mp.isMultiplayer && mp.isHost) {
      network.broadcast({
        type: 'MELD_BROADCAST',
        playerId,
        meldType: type === 'an' ? 'an_gang' : type === 'bu' ? 'bu_gang' : 'gang',
        handDelta: type === 'an' ? 4 : type === 'bu' ? 1 : 3,
        fromDiscard: type === 'ming' && !!targetTile,
        fromPlayer: type === 'ming' ? (stateRef.current.lastDiscard?.fromPlayer ?? null) : null,
        meldGroup: { type: type === 'an' ? 'an_gang' : type === 'bu' ? 'bu_gang' : 'gang', tile, tiles: kongTiles }
      });
    }

    const drawCount = Math.min(config.kongDrawCount || 2, stateRef.current.wall.length);
    if (drawCount === 0) {
      handleHuangZhuang();
      return;
    }

    const curWall = [...stateRef.current.wall];
    const drawnKongCards = curWall.splice(curWall.length - drawCount, drawCount);
    stateRef.current.wall = curWall;
    stateRef.current.lastDrawerId = playerId; // 开杠补牌也是「从牌墙摸走牌」
    setWall([...curWall]);

    let canSelfKongHu = false;
    let kongFlowerWinTile = null;
    let kongFlowerHuTypes = [];
    drawnKongCards.forEach(drawnCard => {
      const huRes = checkHu(curHand, stateRef.current.playerMelds[playerId], drawnCard, true, {
        isKongFlower: true,
        // 补牌单独传入（手牌是补牌前的张数），由 checkHu 追加后再按「杠折算 3 张」判定
        includeWinningTile: true,
        isLastTile: stateRef.current.wall.length === 0
      });
      if (huRes.canHu && !canSelfKongHu) {
        canSelfKongHu = true;
        kongFlowerWinTile = drawnCard;
        kongFlowerHuTypes = huRes.huTypes || [];
      }
    });

    if (playerId === 0) {
      // 开杠后手牌已经锁定，不能再改牌：能杠上开花就自动胡，没胡就直接把补牌丢进牌池
      if (canSelfKongHu) {
        showBubble(0, '杠上开花！');
        handleRoundWin(0, 0, kongFlowerWinTile, true,
          kongFlowerHuTypes.length > 0 ? kongFlowerHuTypes : ['杠上开花']);
      } else {
        setTimeout(() => {
          discardKongTilesToPool(0, drawnKongCards);
        }, 220);
      }
    } else {
      if (canSelfKongHu) {
        showBubble(playerId, '杠上开花！');
        handleRoundWin(playerId, playerId, kongFlowerWinTile, true,
          kongFlowerHuTypes.length > 0 ? kongFlowerHuTypes : ['杠上开花']);
      } else {
        setTimeout(() => {
          discardKongTilesToPool(playerId, drawnKongCards);
        }, 1000);
      }
    }
  };

  const executeBu = (playerId) => {
    if (stateRef.current.gameState !== 'PLAYING') return;
    if (stateRef.current.wall.length === 0) {
      handleHuangZhuang();
      return;
    }

    // 补桩：不把四张牌开成杠，只从牌墙尾部补 1 张，手牌增加到 15 张后正常打出一张。
    const wall = [...stateRef.current.wall];
    const drawn = wall.pop();
    stateRef.current.wall = wall;
    setWall([...wall]);
    stateRef.current.playerHands[playerId] = [
      ...stateRef.current.playerHands[playerId],
      drawn
    ];
    setPlayerHands([...stateRef.current.playerHands]);
    setDrawnTile(drawn);
    setCurrentTurn(playerId);
    stateRef.current.currentTurn = playerId;
    setTurnTimer(15);
    setAvailableActions({ hu: false, gang: false, bu: false, peng: false, chi: false, pass: false });
    setKongOptions([]);
    setBuOptions([]);
    sound.playDraw();
    showBubble(playerId, '补桩');

    const mp = multiplayerRef.current;
    if (mp.isMultiplayer && mp.isHost && mp.seats[playerId]?.isHuman) {
      network.sendToSeat(playerId, {
        type: 'TURN_UPDATE',
        currentTurn: playerId,
        turnTimer: 15,
        wallRemaining: wall.length,
        drawnTile: drawn
      });
    }
  };

  const handleHumanBu = (option) => {
    sound.playTileTouch();
    const mp = multiplayerRef.current;
    if (mp.isMultiplayer && !mp.isHost) {
      network.sendToHost({ type: 'RESPOND_ACTION', action: 'bu' });
      setAvailableActions({ hu: false, gang: false, bu: false, peng: false, chi: false, pass: false });
      setBuOptions([]);
      return;
    }
    executeBu(0, option);
  };

  const discardKongTilesToPool = (kongPlayerId, kongCards) => {
    if (stateRef.current.gameState !== 'PLAYING') return;
    setKongDrawState({ isOpen: false, kongPlayer: null, drawnTiles: [], count: 2, canSelfHu: false });
    const mp = multiplayerRef.current;

    for (const card of kongCards) {
      stateRef.current.playerDiscards[kongPlayerId] = [
        ...stateRef.current.playerDiscards[kongPlayerId],
        card
      ];
      setPlayerDiscards([...stateRef.current.playerDiscards]);

      if (mp.isMultiplayer && mp.isHost) {
        network.broadcast({
          type: 'TILE_DISCARDED',
          playerId: kongPlayerId,
          tile: card,
          isKongDiscard: true,
          wallRemaining: stateRef.current.wall.length
        });
      }

      const kongWinners = [];
      for (let i = 0; i < 4; i++) {
        if (i !== kongPlayerId) {
          const hand = stateRef.current.playerHands[i];
          const melds = stateRef.current.playerMelds[i];
          const huRes = checkHu(hand, melds, card, false, { isKongDiscard: true, isLastTile: stateRef.current.wall.length === 0 });
          if (huRes.canHu) {
            kongWinners.push({ id: i, huRes });
          }
        }
      }
      if (kongWinners.length > 0) {
        kongWinners.forEach(w => showBubble(w.id, '杠上炮！'));
        // 规格 §四 通炮：每位胡牌者按各自的牌型、各自的 k 与 n 单独结算，出杠者总付 = ΣP
        // （Q9 裁定：真·一炮多响；原来的「只取顺位最近一家」已被替换）
        const winners = kongWinners.map(w =>
          huEntryFromTypes(w.id, ['杠上炮', ...w.huRes.huTypes.filter(t => t !== '平胡')])
        );
        if (winners.length === 1) {
          // 单家杠上炮 = 普通点炮：庄位、抓鸟基准都按胡牌者，不能按通炮算
          handleRoundWin(winners[0].seat, kongPlayerId, card, false, winners[0].huTypes);
        } else {
          handleRoundWin(winners[0].seat, kongPlayerId, card, false, winners[0].huTypes, {
            method: 'tongpao',
            winners
          });
        }
        return;
      }
    }

    passToNextPlayer(kongPlayerId);
  };

  const applySelfTurnOptions = (hand, melds, huRes, siXiList = []) => {
    const allKongOptions = getKongOptions(hand, melds, null, config);
    const ting = allKongOptions.length > 0 ? isTingHand(hand, melds, config) : false;
    // 开杠前必须听牌；不听牌时不能杠，只能补桩。
    const legalGangOptions = ting ? allKongOptions : [];
    setAvailableActions({
      hu: Boolean(huRes?.canHu),
      siXi: siXiList.length > 0,
      gang: legalGangOptions.length > 0,
      bu: allKongOptions.length > 0,
      peng: false,
      chi: false,
      pass: Boolean(huRes?.canHu) || legalGangOptions.length > 0 || siXiList.length > 0
    });
    setKongOptions(legalGangOptions);
    setBuOptions(allKongOptions);
    setMidGameSiXiOptions(siXiList);
  };

  const passToNextPlayer = (prevPlayerId) => {
    const nextPlayerId = (prevPlayerId + 1) % 4;
    stateRef.current.currentTurn = nextPlayerId;
    setCurrentTurn(nextPlayerId);
    setTurnTimer(15);
    setAvailableActions({ hu: false, gang: false, peng: false, chi: false, pass: false });

    if (stateRef.current.wall.length === 0) {
      handleHuangZhuang();
      return;
    }

    const curWall = [...stateRef.current.wall];
    const drawn = curWall.shift();
    stateRef.current.wall = curWall;
    stateRef.current.lastDrawerId = nextPlayerId; // 规格 §二.4：记下本局最后一张牌是谁摸走的
    setWall([...curWall]);
    setDrawnTile(drawn);

    stateRef.current.playerHands[nextPlayerId] = [
      ...stateRef.current.playerHands[nextPlayerId],
      drawn
    ];
    setPlayerHands([...stateRef.current.playerHands]);

    if (nextPlayerId !== 0) sound.playDraw();

    const mp = multiplayerRef.current;
    if (nextPlayerId === 0) {
      sound.playTileTouch();
      const myHand = stateRef.current.playerHands[0];
      const huRes = checkHu(myHand, stateRef.current.playerMelds[0], null, true, { isLastTile: stateRef.current.wall.length === 0 });
      const siXiList = checkMidGameSiXi(myHand, config, declaredSiXiRef.current[0]);

      applySelfTurnOptions(myHand, stateRef.current.playerMelds[0], huRes, siXiList);

      if (mp.isMultiplayer && mp.isHost) {
        network.broadcast({
          type: 'TURN_UPDATE',
          currentTurn: 0,
          turnTimer: 15,
          wallRemaining: curWall.length
        });
      }
    } else {
      if (mp.isMultiplayer && mp.seats[nextPlayerId]?.isHuman) {
        // 给该真人发送私有暗摸牌
        network.sendToSeat(nextPlayerId, {
          type: 'TURN_UPDATE',
          currentTurn: nextPlayerId,
          turnTimer: 15,
          wallRemaining: curWall.length,
          drawnTile: drawn
        });
        // 告知其余玩家轮次变更
        for (let s = 1; s < 4; s++) {
          if (s !== nextPlayerId && mp.seats[s]?.isHuman) {
            network.sendToSeat(s, {
              type: 'TURN_UPDATE',
              currentTurn: nextPlayerId,
              turnTimer: 15,
              wallRemaining: curWall.length
            });
          }
        }
      } else {
        if (mp.isMultiplayer && mp.isHost) {
          network.broadcast({
            type: 'TURN_UPDATE',
            currentTurn: nextPlayerId,
            turnTimer: 15,
            wallRemaining: curWall.length
          });
        }
        triggerAiTurn(nextPlayerId);
      }
    }
  };

  const triggerAiTurn = (botId) => {
    const token = ++aiTurnTokenRef.current;
    setTimeout(() => {
      if (token !== aiTurnTokenRef.current) return;
      if (stateRef.current.gameState !== 'PLAYING' || stateRef.current.currentTurn !== botId) return;
      const hand = stateRef.current.playerHands[botId];
      const melds = stateRef.current.playerMelds[botId];
      const drawn = hand[hand.length - 1];

      // 评估 AI 中途四喜
      const siXiList = checkMidGameSiXi(hand, config, declaredSiXiRef.current[botId]);
      if (siXiList.length > 0) {
        executeMidGameSiXi(botId, siXiList[0]);
      }

      const decision = decideAiTurnAction(hand, melds, drawn, config, { isLastTile: stateRef.current.wall.length === 0 });

      if (decision.action === 'hu') {
        showBubble(botId, '自摸！');
        handleRoundWin(botId, botId, drawn, true, decision.huResult.huTypes);
      } else if (decision.action === 'gang') {
        showBubble(botId, '杠！');
        executeKong(botId, decision.kongOption, null);
      } else {
        executeDiscard(botId, decision.tile);
      }
    }, config.aiSpeed);
  };

  // -------------------------------------------------------------------------
  // 终局结算与扎鸟
  // -------------------------------------------------------------------------
  // 规格 §四/§六：番型 → 大胡标记与 k（k = 大胡番型个数）的换算见 scoring.js 的 huEntryFromTypes
  const handleRoundWin = (winnerId, loserId, winningTile, isSelfDrawn, huTypes, opts = {}) => {
    if (stateRef.current.gameState === 'ROUND_OVER') return;
    aiTurnTokenRef.current += 1;
    const roundDealerId = stateRef.current.dealerId;
    const { B, F } = normalizeScoreParams(config);
    setGameState('ROUND_OVER');
    stateRef.current.gameState = 'ROUND_OVER';
    setAvailableActions({ hu: false, gang: false, peng: false, chi: false, pass: false });

    // 通炮（一炮多响）：opts.winners 给多位胡牌者，每位按各自牌型、各自的 k 与 n 单独结算（规格 §四）
    const method = opts.method || (isSelfDrawn ? 'zimo' : 'dianpao');
    const isTongPao = method === 'tongpao';
    const winnerList = (opts.winners && opts.winners.length > 0)
      ? opts.winners
      : [huEntryFromTypes(winnerId, huTypes)];

    // 终局抓鸟（S2 裁定）：仍翻牌墙，取末尾并移除；座位基准 = 本次结算的庄位
    // （自摸/点炮 = 胡牌者，通炮 = 放炮者）
    const birdBaseSeat = isTongPao ? loserId : winnerId;
    const birdResult = drawBirds(stateRef.current.wall, config.birdCount, birdBaseSeat);
    if (birdResult.birds.length > 0) {
      stateRef.current.wall = stateRef.current.wall.slice(0, -birdResult.birds.length);
      setWall([...stateRef.current.wall]);
    }

    // 计分一律走纯函数模块（规格 §九.2）：P = min(Base × (n+1), 42B) + 2F
    const scored = scoreRound(isTongPao
      ? { method, B, F, winners: winnerList, discarderSeat: loserId, birdValues: birdResult.birdValues }
      : { method, B, F, winner: winnerList[0], discarderSeat: method === 'dianpao' ? loserId : null, birdValues: birdResult.birdValues });
    const changes = scored.changes;
    // 起手胡挂起到局终一起算：与本次胡牌/流局得分合并后只落一次账
    const pendingStartingHuEvents = startingHuPendingRef.current || [];
    const startingHuChanges = [0, 0, 0, 0];
    pendingStartingHuEvents.forEach(evt => {
      (evt.scoreChanges || []).forEach((c, i) => { startingHuChanges[i] += c; });
    });
    const totalChanges = changes.map((c, i) => c + startingHuChanges[i]);
    // 战绩裁定：只有四人对战（4 真人、全程无托管）才记入本机记录；单机/托管局一律不计
    if (rankedRoundRef.current) {
      setMyRecord(recordRound(typeof localStorage !== 'undefined' ? localStorage : null, {
        scoreDelta: totalChanges[multiplayerState.mySeatId] || 0
      }));
    }

    setPlayerScores(prev => prev.map((s, idx) => s + totalChanges[idx]));
    // 规格 §二.1/§二.3：谁胡牌谁做庄；通炮时放炮者做庄
    const nextDealer = isTongPao
      ? nextDealerSeat({ outcome: 'tongpao', discarderSeat: loserId })
      : nextDealerSeat({ outcome: 'win', winnerSeat: winnerId });
    setDealerId(nextDealer);
    stateRef.current.dealerId = nextDealer;

    const mp = multiplayerRef.current;
    const winnerName = mp.isMultiplayer ? mp.seats[winnerId]?.name : PLAYERS[winnerId].name;
    const loserName = loserId !== null ? (mp.isMultiplayer ? mp.seats[loserId]?.name : PLAYERS[loserId].name) : '';
    // 结算页需要四位座位名逐项展示明细（规格 §九.5）
    const seatNames = [0, 1, 2, 3].map(i => (mp.isMultiplayer ? (mp.seats[i]?.name || PLAYERS[i].name) : PLAYERS[i].name));

    const finalResult = {
      isHuangZhuang: false,
      winner: { ...PLAYERS[winnerId], name: winnerName },
      loser: (isSelfDrawn && !isTongPao) ? null : { ...PLAYERS[loserId], name: loserName },
      huTypes: [...new Set((huTypes && huTypes.length > 0) ? huTypes : ['平胡'])],
      score: scored.winners.reduce((sum, w) => sum + w.receives, 0),
      birdsResult: birdResult,
      handTiles: (isSelfDrawn && winningTile)
        ? stateRef.current.playerHands[winnerId].filter(t => t.id !== winningTile.id)
        : stateRef.current.playerHands[winnerId],
      melds: stateRef.current.playerMelds[winnerId],
      winningTile,
      isSelfDrawn: isSelfDrawn && !isTongPao,
      scoreChanges: totalChanges,
      startingHuEvents: pendingStartingHuEvents,
      startingHuChanges,
      newDealerId: nextDealer,
      roundDealerId,
      seatNames,
      // 逐项明细（规格 §九.5）：番型与 k、B、F、每家 n 与乘数、封顶前后、应付、得失、骰子/鸟
      scoring: {
        method,
        B,
        F,
        cap: scored.cap,
        dealerSeat: scored.dealerSeat,
        details: scored.details,
        winners: scored.winners,
        birdDetail: scored.birdDetail,
        zeroSum: scored.zeroSum
      }
    };

    setRoundResult(finalResult);

    if (mp.isMultiplayer && mp.isHost) {
      network.broadcast({
        type: 'ROUND_WIN_BROADCAST',
        result: finalResult
      });
    }
  };

  const handleHuangZhuang = () => {
    if (stateRef.current.gameState === 'ROUND_OVER') return;
    aiTurnTokenRef.current += 1;
    const roundDealerId = stateRef.current.dealerId;
    setGameState('ROUND_OVER');
    stateRef.current.gameState = 'ROUND_OVER';
    // 规格 §二.4：流局不计分；下一局庄 = 本局最后一张牌由谁摸走（正常摸牌与开杠补牌都算）。
    // 若本局从未有人从牌墙摸过牌（异常路径），退回当前庄，避免静默顺移。
    const nextDealer = drawDealerSeat({
      lastDrawerSeat: stateRef.current.lastDrawerId,
      currentDealerSeat: dealerId
    });
    setDealerId(nextDealer);
    stateRef.current.dealerId = nextDealer;

    const mp = multiplayerRef.current;
    const seatNames = [0, 1, 2, 3].map(i => (mp.isMultiplayer ? (mp.seats[i]?.name || PLAYERS[i].name) : PLAYERS[i].name));
    const pendingStartingHuEvents = startingHuPendingRef.current || [];
    const startingHuChanges = [0, 0, 0, 0];
    pendingStartingHuEvents.forEach(evt => {
      (evt.scoreChanges || []).forEach((c, i) => { startingHuChanges[i] += c; });
    });
    if (startingHuChanges.some(c => c !== 0)) {
      setPlayerScores(prev => prev.map((s, i) => s + startingHuChanges[i]));
    }

    // 战绩裁定：流局也算打过一局；起手胡挂账在局终结算，所以净变化不是恒 0
    if (rankedRoundRef.current) {
      setMyRecord(recordRound(
        typeof localStorage !== 'undefined' ? localStorage : null,
        { scoreDelta: startingHuChanges[multiplayerState.mySeatId] || 0 }
      ));
    }

    const finalResult = {
      isHuangZhuang: true,
      scoreChanges: startingHuChanges,
      startingHuEvents: pendingStartingHuEvents,
      startingHuChanges,
      lastDrawerId: stateRef.current.lastDrawerId,
      newDealerId: nextDealer,
      roundDealerId,
      seatNames
    };
    setRoundResult(finalResult);

    if (mp.isMultiplayer && mp.isHost) {
      network.broadcast({
        type: 'ROUND_WIN_BROADCAST',
        result: finalResult
      });
    }
  };

  // 中途四喜结算与执行
  const executeMidGameSiXi = (playerId, siXiOption) => {
    sound.playHu({ zimo: true, huTypes: ['四喜'] });
    declaredSiXiRef.current[playerId].add(siXiOption.key);

    // 规格 §七.3/§八.11：按「小胡自摸」结算（触发者即该次结算的庄），摇骰子抓鸟；
    // 结算后牌局继续、不改庄；同一组 4 张只触发一次（declaredSiXiRef 去重）
    const { B, F } = normalizeScoreParams(config);
    const birdValues = rollBirdDice(config.birdCount || 0, secureRandomInt);
    const scored = scoreRound({ method: 'siji', B, F, winner: { seat: playerId }, birdValues });
    setPlayerScores(prev => prev.map((s, i) => s + scored.changes[i]));

    const gain = scored.changes[playerId];
    showBubble(playerId, `中途四喜！ +${gain} 分`, 2500);

    const mp = multiplayerRef.current;
    if (mp.isMultiplayer && mp.isHost) {
      // 联机时由房主（权威端）算分并广播结果，客户端只累加（规格 §九.3）
      network.broadcast({
        type: 'SI_XI_BROADCAST',
        playerId,
        text: `中途四喜！ +${gain} 分`,
        changes: scored.changes,
        details: scored.details,
        birdValues
      });
    }

    if (playerId === 0) {
      setMidGameSiXiOptions([]);
      setAvailableActions(prev => ({
        ...prev,
        siXi: false,
        pass: prev.hu || prev.gang
      }));
    }
  };

  const handleHumanSiXi = () => {
    if (midGameSiXiOptions.length === 0) return;
    const mp = multiplayerRef.current;
    if (mp.isMultiplayer && !mp.isHost) {
      network.sendToHost({ type: 'RESPOND_ACTION', action: 'siXi', payload: { siXiOption: midGameSiXiOptions[0] } });
      setMidGameSiXiOptions([]);
      setAvailableActions(prev => ({ ...prev, siXi: false }));
      return;
    }
    executeMidGameSiXi(0, midGameSiXiOptions[0]);
  };

  // 人类操作
  const handleHumanHu = () => {
    const mp = multiplayerRef.current;
    if (mp.isMultiplayer && !mp.isHost) {
      const isSelfDrawn = currentTurn === mySeatId;
      network.sendToHost({ type: 'RESPOND_ACTION', action: 'hu', payload: { isSelfDrawn } });
      setAvailableActions({ hu: false, siXi: false, gang: false, peng: false, chi: false, pass: false });
      return;
    }
    const isSelfDrawn = currentTurn === 0;
    const myHand = stateRef.current.playerHands[0];
    const myMelds = stateRef.current.playerMelds[0];
    const winningTile = isSelfDrawn ? drawnTile : stateRef.current.lastDiscard?.tile;

    // P1-2：这一手若是「多家能胡」挂起的（含电脑胡家），一次把全部胡家结算掉（通炮）
    if (!isSelfDrawn && resolvePendingHu(0, true)) return;

    const huRes = checkHu(myHand, myMelds, winningTile, isSelfDrawn, {
      isLastTile: stateRef.current.wall.length === 0,
      isKongDiscard: !isSelfDrawn && !!stateRef.current.lastDiscard?.isKongDiscard
    });
    handleRoundWin(0, isSelfDrawn ? 0 : stateRef.current.lastDiscard.fromPlayer, winningTile, isSelfDrawn, huRes.huTypes);
  };

  const handleHumanGang = (selectedOption) => {
    const mp = multiplayerRef.current;
    if (mp.isMultiplayer && !mp.isHost) {
      network.sendToHost({ type: 'RESPOND_ACTION', action: 'gang', payload: { kongOption: selectedOption } });
      setAvailableActions({ hu: false, siXi: false, gang: false, peng: false, chi: false, pass: false });
      return;
    }
    executeKong(0, selectedOption, stateRef.current.lastDiscard?.tile);
  };

  const handleHumanPeng = () => {
    const mp = multiplayerRef.current;
    if (mp.isMultiplayer && !mp.isHost) {
      network.sendToHost({ type: 'RESPOND_ACTION', action: 'peng' });
      setAvailableActions({ hu: false, siXi: false, gang: false, peng: false, chi: false, pass: false });
      return;
    }
    if (stateRef.current.lastDiscard) {
      executePeng(0, stateRef.current.lastDiscard.tile, stateRef.current.lastDiscard.fromPlayer);
    }
  };

  const handleHumanChi = (selectedSequence) => {
    const mp = multiplayerRef.current;
    if (mp.isMultiplayer && !mp.isHost) {
      network.sendToHost({ type: 'RESPOND_ACTION', action: 'chi', payload: { sequenceTiles: selectedSequence } });
      setAvailableActions({ hu: false, siXi: false, gang: false, peng: false, chi: false, pass: false });
      return;
    }
    if (stateRef.current.lastDiscard) {
      executeChi(0, selectedSequence, stateRef.current.lastDiscard.tile, stateRef.current.lastDiscard.fromPlayer);
    }
  };

  const handleHumanPass = () => {
    if (stateRef.current.gameState !== 'PLAYING') return;
    setAvailableActions({ hu: false, siXi: false, gang: false, peng: false, chi: false, pass: false });
    setMidGameSiXiOptions([]);
    const mp = multiplayerRef.current;
    if (mp.isMultiplayer && !mp.isHost) {
      network.sendToHost({ type: 'RESPOND_ACTION', action: 'pass' });
      return;
    }
    // P1-2：真人「过」不吞掉别家的胡 —— 挂起的胡家里除自己以外照常结算
    if (resolvePendingHu(0, false)) return;
    if (currentTurn !== 0 && stateRef.current.lastDiscard) {
      processAiResponses(stateRef.current.lastDiscard);
    }
  };

  // P0-5：把「当前可用操作」与「超时处理器」同步进 ref，供倒计时兜底使用
  useEffect(() => {
    actionsRef.current = availableActions;
  }, [availableActions]);

  useEffect(() => {
    timeoutRef.current = {
      autoDiscard: handleTimeoutAutoDiscard,
      pass: handleHumanPass
    };
  });

  // ---------------------------------------------------------------------------
  // P0-4 掉线托管
  // ---------------------------------------------------------------------------
  // triggerAiTurn 每次渲染都是新函数，用 ref 保持最新，供网络回调（托管接管）调用。
  useEffect(() => {
    aiTurnRef.current = triggerAiTurn;
  });

  // 座位被降级为电脑 AI 时（心跳超时、房主手动替换、托管看门狗），若此刻正轮到该座位，
  // 立刻由 AI 接管这一手 —— 否则牌局会永久停在「等一个已经不在的人出牌」。
  useEffect(() => {
    network.onSeatRevertedToAI = (seatId, reason = 'timeout') => {
      // 有人被托管 → 本局不再算「四人对战」，不计入本机记录
      rankedRoundRef.current = false;
      // P2-3：只有「掉线托管」才标托管；玩家自己退出 / 房主主动替换都只标「电脑」
      if (reason === 'timeout') {
        setTakenOverSeats((prev) => (prev.includes(seatId) ? prev : [...prev, seatId]));
      }
      if (stateRef.current.gameState !== 'PLAYING') return;
      if (stateRef.current.currentTurn !== seatId) return;
      console.log(`[CSMJ] 托管接管：座位 ${seatId} 改由电脑 AI 出牌`);
      aiTurnRef.current?.(seatId);
    };
    return () => {
      network.onSeatRevertedToAI = null;
    };
  }, []);

  // 房主看门狗：轮到的真人迟迟不出牌（客户端挂了 / 标签页被浏览器冻结 / 网络断了）→ 降级为 AI 并托管。
  // 客户端自己的出牌倒计时只管「轮到我」，管不了「轮到别人」（见 game/actions.js 注释）。
  useEffect(() => {
    const mp = multiplayerRef.current;
    const seats = multiplayerState.seats || [];
    const delay = hostTurnWatchdogDelay({
      isHost: !!mp.isHost,
      gameState,
      currentTurn,
      mySeatId,
      seatIsHuman: !!seats[currentTurn]?.isHuman
    });
    if (delay == null) return;

    const watchedSeat = currentTurn;
    const watchdog = setTimeout(() => {
      if (stateRef.current.currentTurn !== watchedSeat) return; // 已经正常出牌了
      console.warn(`[CSMJ] 座位 ${watchedSeat} 超时未出牌，自动托管为电脑 AI`);
      network.revertSeatToAI(watchedSeat);
    }, delay);
    return () => clearTimeout(watchdog);
  }, [gameState, currentTurn, mySeatId, multiplayerState.seats]);

  // 获得座位对应的展示信息 (单机或联机)
  const currentSeatPlayers = useMemo(() => {
    if (multiplayerState.isMultiplayer && multiplayerState.seats) {
      return multiplayerState.seats.map((s, idx) => ({
        id: idx,
        name: s.name,
        isHuman: s.isHuman,
        position: PLAYERS[idx].position
      }));
    }
    return PLAYERS;
  }, [multiplayerState]);

  return (
    <div
      className="relative flex h-screen w-screen select-none flex-col overflow-hidden bg-page text-stone-800 safe-pad"
      data-theme={config.theme || 'mist'} /* 只换毛毡色：mist / sand / ink */
      data-layout={isPortrait ? 'portrait' : 'landscape'} /* P0-7 竖屏专用布局：竖屏时走 [data-layout="portrait"] 样式 */
    >
      {/* 顶部：一块轻薄的纸面导航，不抢牌桌 */}
      <header className="relative z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-stone-200/80 bg-[rgba(251,249,244,0.92)] px-3 backdrop-blur-md sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white shadow-sm">
            <span className="font-serif text-lg font-semibold leading-none text-stone-800">长</span>
            <span className="absolute bottom-1 right-1 h-1 w-1 rounded-full bg-rose-500" />
          </div>
          <div className="min-w-0">
            <h1 className="hdr-title flex items-center gap-2 truncate font-serif text-[17px] font-semibold tracking-tight text-stone-900">
              <span>长沙麻将</span>
              <span className="hdr-badge rounded-full bg-[var(--color-jade-200)]/45 px-2 py-0.5 text-[10px] font-medium text-[var(--color-jade-600)]">
                青瓷
              </span>
            </h1>
            <div className="hdr-sub mt-0.5 flex items-center gap-1.5 text-[10px] text-stone-400">
              <span>开杠 {config.kongDrawCount} 只</span>
              <span className="text-stone-300">·</span>
              <span>{config.kongRequiresJiang ? '需将' : '免将'}</span>
              <span className="text-stone-300">·</span>
              <span>{config.birdCount > 0 ? `抓 ${config.birdCount} 鸟` : '不抓鸟'}</span>
            </div>
          </div>
        </div>

        {/* 对局模式 */}
        <div className="hidden items-center gap-2 rounded-full border border-stone-200 bg-white/55 px-3.5 py-1.5 text-[11px] text-stone-500 lg:flex">
          {multiplayerState.isMultiplayer ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-jade-600)]" />
              <span className="font-semibold text-stone-700">房间 {multiplayerState.roomCode}</span>
              <span className="text-stone-300">·</span>
              <span>{multiplayerState.isHost ? '房主' : '已入座'}</span>
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-jade-600)]" />
              <span>单机练习 · 三位电脑</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {multiplayerState.isMultiplayer && (
            <div
              data-testid="net-status"
              className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white/60 px-2.5 py-1.5 text-[10px] font-medium text-stone-600"
              title={`联机网络：${networkStatusText({ latency: netLatency, connection: netConn })}（延迟取最近 5 次往返平均）`}
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  { ok: 'bg-[var(--color-jade-500)]', warn: 'bg-amber-400', bad: 'bg-rose-500' }[
                    statusTone({ latency: netLatency, connection: netConn })
                  ] || 'bg-stone-400'
                }`}
              />
              <span className="whitespace-nowrap font-mono">
                {networkStatusText({ latency: netLatency, connection: netConn })}
              </span>
            </div>
          )}

          <button
            onClick={() => setIsMultiplayerOpen(true)}
            className="hdr-multi btn-secondary h-9 px-3 text-[11px] font-semibold"
          >
            <Users className="h-3.5 w-3.5" />
            <span>{multiplayerState.isMultiplayer ? `房间 ${multiplayerState.roomCode}` : '多人联机'}</span>
          </button>

          <button
            onClick={() => handleUpdateConfig({ ...config, soundEnabled: !config.soundEnabled })}
            className="icon-btn"
            title="音效开关"
            aria-label="音效开关"
          >
            {config.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          <button
            onClick={() => setIsRulesOpen(true)}
            className="icon-btn"
            title="玩法说明"
            aria-label="玩法说明"
          >
            <BookOpen className="h-4 w-4" />
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="icon-btn"
            title="规则设置"
            aria-label="规则设置"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* 牌桌：青瓷毛毡 + 一圈很轻的亮边 */}
      <div className="relative flex h-[calc(100vh-3.5rem)] w-full flex-1 flex-col overflow-hidden bg-page p-2 sm:p-3">
        <main className="mahjong-table table-rim relative h-full w-full flex-1 overflow-hidden rounded-[24px] border border-white/25 sm:rounded-[30px]">
          {/* 1. 顶部：对家区域 (手牌在上，副露在右) */}
          <div className="absolute top-1.5 sm:top-2.5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
            <OpponentHand
              key={`top-${roundNumber}`}
              player={currentSeatPlayers[topSeatId]}
              handCount={playerHands[topSeatId]?.length || 0}
              melds={playerMelds[topSeatId] || []}
              isCurrentTurn={currentTurn === topSeatId}
              score={playerScores[topSeatId]}
              isDealer={dealerId === topSeatId}
              visualPosition="top"
              startingHu={startingHuEvents.find(e => e.player.id === topSeatId) || null}
              {...seatAiInfo(topSeatId)}
            />
          </div>

          {/* 2. 左侧：上家区域 (紧靠左侧桌面边框，副露在上方) */}
          <div className="absolute left-1.5 sm:left-3 top-1/2 -translate-y-1/2 z-20 flex items-center">
            <OpponentHand
              key={`left-${roundNumber}`}
              player={currentSeatPlayers[leftSeatId]}
              handCount={playerHands[leftSeatId]?.length || 0}
              melds={playerMelds[leftSeatId] || []}
              isCurrentTurn={currentTurn === leftSeatId}
              score={playerScores[leftSeatId]}
              isDealer={dealerId === leftSeatId}
              visualPosition="left"
              startingHu={startingHuEvents.find(e => e.player.id === leftSeatId) || null}
              {...seatAiInfo(leftSeatId)}
            />
          </div>

          {/* 3. 右侧：下家区域 (紧靠右侧桌面边框，副露在右侧) */}
          <div className="absolute right-1.5 sm:right-3 top-1/2 -translate-y-1/2 z-20 flex items-center">
            <OpponentHand
              key={`right-${roundNumber}`}
              player={currentSeatPlayers[rightSeatId]}
              handCount={playerHands[rightSeatId]?.length || 0}
              melds={playerMelds[rightSeatId] || []}
              isCurrentTurn={currentTurn === rightSeatId}
              score={playerScores[rightSeatId]}
              isDealer={dealerId === rightSeatId}
              visualPosition="right"
              startingHu={startingHuEvents.find(e => e.player.id === rightSeatId) || null}
              {...seatAiInfo(rightSeatId)}
            />
          </div>

          {/* 4. 四方牌墙：数量随真实余牌缩短，不再固定 12 垛 */}
          {/* 上牌墙 */}
          <div className="pointer-events-none absolute left-1/2 top-[19%] z-0 -translate-x-1/2 opacity-90 sm:top-[21%]">
            <TileWall position="top" count={Math.max(4, Math.min(14, Math.ceil((wall.length || wallTotal) / 8)))} />
          </div>
          {/* 下牌墙 */}
          <div className="pointer-events-none absolute bottom-[27%] left-1/2 z-0 -translate-x-1/2 opacity-90 sm:bottom-[30%]">
            <TileWall position="bottom" count={Math.max(4, Math.min(14, Math.ceil((wall.length || wallTotal) / 8)))} />
          </div>
          {/* 左牌墙 */}
          <div className="pointer-events-none absolute left-[15%] top-1/2 z-0 -translate-y-1/2 opacity-90 sm:left-[18%] lg:left-[21%]">
            <TileWall position="left" count={Math.max(4, Math.min(12, Math.ceil((wall.length || wallTotal) / 10)))} />
          </div>
          {/* 右牌墙 */}
          <div className="pointer-events-none absolute right-[15%] top-1/2 z-0 -translate-y-1/2 opacity-90 sm:right-[18%] lg:right-[21%]">
            <TileWall position="right" count={Math.max(4, Math.min(12, Math.ceil((wall.length || wallTotal) / 10)))} />
          </div>

          {/* 5. 正中央核心对局区：四方出牌池围着一枚瓷盘，行/列对齐罗盘中心 */}
          <div className="absolute left-1/2 top-1/2 z-10 grid -translate-x-1/2 -translate-y-1/2 grid-cols-[auto_auto_auto] grid-rows-[auto_auto_auto] items-center justify-items-center gap-x-1.5 gap-y-0.5 sm:gap-x-2.5 sm:gap-y-1">
            {/* 对家出牌（罗盘正上方） */}
            <div className="col-start-2 row-start-1">
              <PlayerDiscardTray
                playerId={topSeatId}
                discards={playerDiscards[topSeatId] || []}
                lastDiscard={lastDiscard}
                hoveredTile={hoveredTile}
                position="top"
              />
            </div>

            {/* 上家出牌（罗盘正左） */}
            <div className="col-start-1 row-start-2">
              <PlayerDiscardTray
                playerId={leftSeatId}
                discards={playerDiscards[leftSeatId] || []}
                lastDiscard={lastDiscard}
                hoveredTile={hoveredTile}
                position="left"
              />
            </div>

            {/* 中央瓷盘 */}
            <div className="col-start-2 row-start-2">
              <TableCenter
                currentTurn={currentTurn}
                dealerId={dealerId}
                wallRemaining={wall.length}
                turnTimer={turnTimer}
                diceValues={diceValues}
                isRollingDice={isRollingDice}
                mySeatId={bottomSeatId}
                roomLabel={multiplayerState.isMultiplayer ? `房间 ${multiplayerState.roomCode}` : '单机练习（不计记录）'}
                wallTotal={wallTotal}
                roundNumber={roundNumber}
                dealerName={multiplayerState.seats?.[dealerId]?.name || PLAYERS[dealerId]?.name || ''}
                statusText={
                  gameState === 'PLAYING'
                    ? (currentTurn === bottomSeatId
                      ? '轮到你出牌'
                      : `${currentSeatPlayers[currentTurn]?.name || '对手'} 思考中`)
                    : ''
                }
              />
            </div>

            {/* 下家出牌（罗盘正右） */}
            <div className="col-start-3 row-start-2">
              <PlayerDiscardTray
                playerId={rightSeatId}
                discards={playerDiscards[rightSeatId] || []}
                lastDiscard={lastDiscard}
                hoveredTile={hoveredTile}
                position="right"
              />
            </div>

            {/* 我的出牌（罗盘正下） */}
            <div className="col-start-2 row-start-3">
              <PlayerDiscardTray
                playerId={bottomSeatId}
                discards={playerDiscards[bottomSeatId] || []}
                lastDiscard={lastDiscard}
                hoveredTile={hoveredTile}
                position="bottom"
              />
            </div>
          </div>

          {/* 6. 左下角：我方信息 */}
          <div className="my-capsule glass-pill absolute left-3 top-3 z-40 flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 sm:left-4">
            {dealerId === bottomSeatId && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold text-white">
                庄
              </span>
            )}
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-jade-600)] text-[11px] font-bold text-white">
              {['东', '南', '西', '北'][bottomSeatId] || '东'}
            </span>
            <span className="max-w-[7rem] truncate text-xs font-semibold text-stone-800">
              {myDisplayName}
            </span>
            <span className="hidden font-mono text-[10px] text-stone-400 sm:inline">
              #{myDisplayId}
            </span>
            <span
              className="capsule-record whitespace-nowrap rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-medium text-stone-500"
              title="本机记录：只统计 4 个真人满座、全程无 AI 托管的对局；打电脑不计入"
            >
              净胜 {myRecord.netScore > 0 ? '+' : ''}{myRecord.netScore} · {myRecord.matches} 局
            </span>
          </div>

          {/* 7. 底部：操作栏 + 手牌 */}
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 flex w-full max-w-[1400px] -translate-x-1/2 flex-col items-center px-2 safe-pad-bottom sm:bottom-6" style={{ paddingBottom: 'var(--safe-bottom)' }}>
            <div className="pointer-events-auto mb-2">
              <ActionControls
                availableActions={availableActions}
                chiOptions={chiOptions}
                kongOptions={kongOptions}
                buOptions={buOptions}
                onHu={handleHumanHu}
                onSiXi={handleHumanSiXi}
                onGang={handleHumanGang}
                onBu={handleHumanBu}
                onPeng={handleHumanPeng}
                onChi={handleHumanChi}
                onPass={handleHumanPass}
              />
            </div>

            <div className="pointer-events-auto w-full">
              <PlayerHand
                key={roundNumber}
                handTiles={playerHands[bottomSeatId] || []}
                melds={playerMelds[bottomSeatId] || []}
                drawnTile={currentTurn === bottomSeatId ? drawnTile : null}
                isMyTurn={currentTurn === bottomSeatId && gameState === 'PLAYING'}
                tingMap={tingMap}
                onDiscard={(tile) => executeDiscard(bottomSeatId, tile)}
                onHoverTile={setHoveredTile}
                showJiangBadge={config.kongRequiresJiang}
                startingHu={startingHuEvents.find(e => e.player.id === bottomSeatId) || null}
              />
            </div>
          </div>

          {gameState === 'IDLE' && (
            <LobbyOverlay
              config={config}
              record={myRecord}
              onStart={() => startNewRound()}
              onMultiplayer={() => setIsMultiplayerOpen(true)}
              onSettings={() => setIsSettingsOpen(true)}
              onRules={() => setIsRulesOpen(true)}
            />
          )}

          <ActionCallout event={tableCallout} />
        </main>
      </div>

      {/* 弹窗 1: 多人实时联机房间大厅 */}
      <MultiplayerModal
        isOpen={isMultiplayerOpen}
        onClose={() => setIsMultiplayerOpen(false)}
        onStartMultiplayerGame={handleStartMultiplayerGame}
        currentRoom={multiplayerState}
        rules={pickMatchRules(config)}
        onHostRules={applyHostRulesIfAny}
        onLeaveRoom={handleLeaveRoom}
        netStatus={{ latency: netLatency, connection: netConn }}
      />

      {/* 弹窗 2: 规则设置 */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        rulesLocked={rulesLocked}
        lockNote={rulesLocked ? `联机中：规则由房主设定，开局后锁定 · ${describeRules(roomRules || config)}` : ''}
        onUpdateConfig={handleUpdateConfig}
      />

      {/* 弹窗 3: 玩法指南 */}
      <RulesGuideModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />

      {/* 弹窗 4: 起手胡祥瑞通知 */}
      {/* 开杠补牌不再弹窗：能胡自动胡，未胡直接丢补牌 */}

      {/* 弹窗 6: 终局结算与抓鸟 */}
      <RoundResultModal
        isOpen={gameState === 'ROUND_OVER'}
        result={roundResult}
        players={currentSeatPlayers}
        onNextRound={() => startNewRound()}
        isMultiplayer={multiplayerState.isMultiplayer}
        isHost={multiplayerState.isHost}
        mySeatId={bottomSeatId}
      />

      <UpdatePrompt update={appUpdate} onClose={() => setAppUpdate(null)} />
    </div>
  );
}
