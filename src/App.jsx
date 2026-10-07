import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  PLAYERS,
  DEFAULT_CONFIG,
  generateDeck,
  compareTiles,
  getTileKey,
  isJiangTile
} from './types/mahjong.js';
import {
  checkStartingHu,
  checkMidGameSiXi,
  checkHu,
  getKongOptions,
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

import MahjongTile from './components/MahjongTile.jsx';
import TableCenter from './components/TableCenter.jsx';
import PlayerHand from './components/PlayerHand.jsx';
import OpponentHand from './components/OpponentHand.jsx';
import DiscardPool, { PlayerDiscardTray } from './components/DiscardPool.jsx';
import ActionControls from './components/ActionControls.jsx';
import TileWall from './components/TileWall.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import StartingHuModal from './components/StartingHuModal.jsx';
import KongDrawModal from './components/KongDrawModal.jsx';
import RoundResultModal from './components/RoundResultModal.jsx';
import RulesGuideModal from './components/RulesGuideModal.jsx';
import MultiplayerModal from './components/MultiplayerModal.jsx';

import { Settings, BookOpen, Volume2, VolumeX, Sparkles, Play, RotateCcw, Users, Wifi, Globe } from 'lucide-react';

// (helper 已移入 src/utils/scoring.js：normalizeScoreParams / huEntryFromTypes —— 纯函数、可单测)

export default function App() {
  // 1. 规则与配置状态
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('cs_mahjong_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          startingHu: {
            ...DEFAULT_CONFIG.startingHu,
            ...(parsed.startingHu || {})
          }
        };
      } catch (e) {
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
  const [gameState, setGameState] = useState('IDLE'); // 'IDLE' | 'DEALING' | 'STARTING_HU' | 'PLAYING' | 'KONG_DRAW' | 'ROUND_OVER'
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
  const [actionBubbles, setActionBubbles] = useState([null, null, null, null]);

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
    kongOption: null
  });
  const [roundResult, setRoundResult] = useState(null);
  const [isPortrait, setIsPortrait] = useState(false);

  // 定时器引用
  const timerRef = useRef(null);
  const aiTurnRef = useRef(null); // 指向 triggerAiTurn（掉线托管时从网络回调里调用，避免闭包过期）
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

  const handleUpdateConfig = (newConfig) => {
    // 规格 §一：联机且开局后锁定 → 房间规则字段一律以房主的为准，本机只能改偏好（理牌/音效/AI 速度）
    const next = rulesLocked ? { ...newConfig, ...pickMatchRules(config) } : newConfig;
    setConfig(next);
    sound.enabled = next.soundEnabled;
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

  const showBubble = (playerId, text, duration = 1200) => {
    setActionBubbles(prev => {
      const next = [...prev];
      next[playerId] = text;
      return next;
    });
    setTimeout(() => {
      setActionBubbles(prev => {
        const next = [...prev];
        next[playerId] = null;
        return next;
      });
    }, duration);
  };

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
        } else if (data.type === 'ACK_STARTING_HU') {
          handleAcknowledgeStartingHu();
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
          sound.playDiscard();
          setLastDiscard({ tile: data.tile, fromPlayer: data.playerId, isKongDiscard: data.isKongDiscard });
          stateRef.current.lastDiscard = { tile: data.tile, fromPlayer: data.playerId, isKongDiscard: data.isKongDiscard };
          // 更新弃牌池
          setPlayerDiscards(prev => {
            const next = [...prev];
            next[data.playerId] = [...(next[data.playerId] || []), data.tile];
            return next;
          });
          // 减少该对手的手牌数
          if (data.playerId !== network.mySeatId) {
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
                const kOptions = getKongOptions(myH, myM, null, config);
                const siXiList = checkMidGameSiXi(myH, config, declaredSiXiRef.current[mySeat]);

                setAvailableActions({
                  hu: huRes.canHu,
                  siXi: siXiList.length > 0,
                  gang: kOptions.length > 0,
                  peng: false,
                  chi: false,
                  pass: huRes.canHu || kOptions.length > 0 || siXiList.length > 0
                });
                setKongOptions(kOptions);
                setMidGameSiXiOptions(siXiList);
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
          showBubble(data.playerId, data.meldType === 'chi' ? '吃！' : data.meldType === 'peng' ? '碰！' : '杠！');
          setPlayerMelds(prev => {
            const next = [...prev];
            next[data.playerId] = [...(next[data.playerId] || []), data.meldGroup];
            return next;
          });
          // 吃碰杠从弃牌池拿牌
          if (lastDiscard && lastDiscard.fromPlayer !== undefined) {
            setPlayerDiscards(prev => {
              const next = [...prev];
              const cur = [...(next[lastDiscard.fromPlayer] || [])];
              if (cur.length > 0) cur.pop();
              next[lastDiscard.fromPlayer] = cur;
              return next;
            });
          }
          if (data.playerId === network.mySeatId) {
            setPlayerHands(prev => {
              const next = [...prev];
              let cur = [...(next[network.mySeatId] || [])];
              const deductTiles = data.meldGroup.tiles.filter(t => t.id !== data.meldGroup.tile?.id);
              deductTiles.forEach(d => {
                const idx = cur.findIndex(t => t.suit === d.suit && t.value === d.value);
                if (idx !== -1) cur.splice(idx, 1);
              });
              if (config.autoSort) cur.sort(compareTiles);
              next[network.mySeatId] = cur;
              return next;
            });
          } else {
            setPlayerHands(prev => {
              const next = [...prev];
              const cur = [...(next[data.playerId] || [])];
              const countToRemove = data.meldType === 'gang' ? 3 : 2;
              for (let i = 0; i < countToRemove && cur.length > 0; i++) cur.pop();
              next[data.playerId] = cur;
              return next;
            });
          }
        } else if (data.type === 'STARTING_HU_BROADCAST') {
          setStartingHuEvents(data.events);
          setGameState('STARTING_HU');
          // 起手胡由房主（权威端）算分，客户端只累加权威结果（规格 §九.3）
          const perSeat = [0, 0, 0, 0];
          (data.events || []).forEach(evt => {
            (evt.scoreChanges || []).forEach((c, i) => { perSeat[i] += c; });
          });
          if (perSeat.some(c => c !== 0)) {
            setPlayerScores(prev => prev.map((s, i) => s + perSeat[i]));
          }
        } else if (data.type === 'SI_XI_BROADCAST') {
          showBubble(data.playerId, data.text);
          if (data.changes) {
            setPlayerScores(prev => prev.map((s, i) => s + (data.changes[i] || 0)));
          }
        } else if (data.type === 'START_PLAYING') {
          setStartingHuEvents([]);
          setGameState('PLAYING');
          setCurrentTurn(data.dealerId);
        } else if (data.type === 'ROUND_WIN_BROADCAST') {
          setRoundResult(data.result);
          setGameState('ROUND_OVER');
          stateRef.current.gameState = 'ROUND_OVER';
          if (data.result.scoreChanges) {
            setPlayerScores(prev => prev.map((s, idx) => s + (data.result.scoreChanges[idx] || 0)));
          }
        } else if (data.type === 'BUBBLE_BROADCAST') {
          showBubble(data.playerId, data.text);
        }
      }
    });
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
    const mp = overrideMp || multiplayerRef.current;
    // 战绩裁定：开局的四个座位必须全是真人（有 AI 补位/单机练习 → 本局不计入本机记录）。
    // 本局一旦出现托管（掉线/看门狗接管），下面会在接管回调里把它置回 false。
    rankedRoundRef.current = isRankedMatch({ seats: mp.seats || [], tookOver: false });
    // D6 局数：结算后再开一局 → 递增；从大厅重新开一场 → 归 1
    roundNoRef.current = stateRef.current.gameState === 'ROUND_OVER' ? roundNoRef.current + 1 : 1;
    setRoundNumber(roundNoRef.current);
    sound.init();
    sound.playDice();

    setIsRollingDice(true);
    setGameState('DEALING');
    stateRef.current.gameState = 'DEALING';
    setLastDiscard(null);
    stateRef.current.lastDiscard = null;
    setDrawnTile(null);
    setRoundResult(null);
    setStartingHuEvents([]);
    setMidGameSiXiOptions([]);
    declaredSiXiRef.current = [new Set(), new Set(), new Set(), new Set()];
    setKongDrawState({ isOpen: false, kongPlayer: null, drawnTiles: [], count: 2, canSelfHu: false });
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
      network.broadcast({ type: 'GAME_STARTED', seats: mp.seats });
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
            huList
          });
        }
      });

      if (startingEvents.length > 0) {
        // 规格 §七.2/§八.10：每个起手胡各摇一次骰子、各自独立按「小胡自摸」结算（逐家 n + 封顶 + 2F），
        // 且不影响下一局庄。骰子数量 = 规则设置里的抓鸟数，随机源走安全随机数（联机时由服务端执行）。
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

        setPlayerScores(prevScores => prevScores.map((s, i) =>
          s + scoredEvents.reduce((sum, e) => sum + e.scoreChanges[i], 0)
        ));

        setStartingHuEvents(scoredEvents);
        setGameState('STARTING_HU');
        stateRef.current.gameState = 'STARTING_HU';

        if (mp.isMultiplayer && mp.isHost) {
          network.broadcast({ type: 'STARTING_HU_BROADCAST', events: scoredEvents });
        }
      } else {
        enterPlayingState(dealerId, hands, newDeck, mp);
      }
    }, 900);
  }, [dealerId, config]);

  const handleAcknowledgeStartingHu = () => {
    setStartingHuEvents([]);
    const mp = multiplayerRef.current;
    if (mp.isMultiplayer && !mp.isHost) {
      network.sendToHost({ type: 'ACK_STARTING_HU' });
      return;
    }
    enterPlayingState(dealerId, stateRef.current.playerHands, stateRef.current.wall, mp);
    if (mp.isMultiplayer && mp.isHost) {
      network.broadcast({ type: 'START_PLAYING', dealerId });
    }
  };

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
      const kOptions = getKongOptions(dealerHand, [], null, config);
      const siXiList = checkMidGameSiXi(dealerHand, config, declaredSiXiRef.current[0]);

      setAvailableActions({
        hu: huRes.canHu,
        siXi: siXiList.length > 0,
        gang: kOptions.length > 0,
        peng: false,
        chi: false,
        pass: huRes.canHu || kOptions.length > 0 || siXiList.length > 0
      });
      setKongOptions(kOptions);
      setMidGameSiXiOptions(siXiList);
    } else {
      // 若庄家是联机真人，通知出牌；若是 AI 则自动触发
      if (mp.isMultiplayer && mp.seats[activeDealerId]?.isHuman) {
        network.sendToSeat(activeDealerId, {
          type: 'TURN_UPDATE',
          currentTurn: activeDealerId,
          turnTimer: 15,
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
    if (gameState !== 'PLAYING') return;

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
  }, [gameState, mySeatId]);

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

    sound.playDiscard();
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
        isKongDiscard: false
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
        // 真人：只要有选项就是候选（弹不弹窗由优先级决定，不由检查顺序决定）
        want = { hu: huRes.canHu, gang: kOptions.length > 0, peng: pAllowed, chi: cOptions.length > 0 };
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
    const otherPlayers = [1, 2, 3].map(offset => (fromPlayer + offset) % 4).filter(id => id !== 0 || fromPlayer !== 0);

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
        meldGroup
      });
      network.broadcast({
        type: 'TURN_UPDATE',
        currentTurn: playerId,
        turnTimer: 15
      });
    }

    if (playerId === 0) {
      setAvailableActions({ hu: false, gang: false, peng: false, chi: false, pass: false });
    } else {
      if (mp.isMultiplayer && mp.seats[playerId]?.isHuman) {
        network.sendToSeat(playerId, {
          type: 'TURN_UPDATE',
          currentTurn: playerId,
          turnTimer: 15
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
        meldGroup
      });
      network.broadcast({
        type: 'TURN_UPDATE',
        currentTurn: playerId,
        turnTimer: 15
      });
    }

    if (playerId === 0) {
      setAvailableActions({ hu: false, gang: false, peng: false, chi: false, pass: false });
    } else {
      if (mp.isMultiplayer && mp.seats[playerId]?.isHuman) {
        network.sendToSeat(playerId, {
          type: 'TURN_UPDATE',
          currentTurn: playerId,
          turnTimer: 15
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
        meldType: type === 'an' ? 'an_gang' : 'gang',
        meldGroup: { type: type === 'an' ? 'an_gang' : 'gang', tile, tiles: kongTiles }
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
      }
    });

    if (playerId === 0) {
      setKongDrawState({
        isOpen: true,
        kongPlayer: PLAYERS[0],
        drawnTiles: drawnKongCards,
        count: drawCount,
        canSelfHu: canSelfKongHu,
        kongOption
      });
    } else {
      if (canSelfKongHu) {
        showBubble(playerId, '杠上开花！');
        handleRoundWin(playerId, playerId, kongFlowerWinTile, true, ['杠上开花']);
      } else {
        setTimeout(() => {
          discardKongTilesToPool(playerId, drawnKongCards);
        }, 1000);
      }
    }
  };

  const discardKongTilesToPool = (kongPlayerId, kongCards) => {
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
          isKongDiscard: true
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
        handleRoundWin(winners[0].seat, kongPlayerId, card, false, winners[0].huTypes, {
          method: 'tongpao',
          winners
        });
        return;
      }
    }

    passToNextPlayer(kongPlayerId);
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

    const mp = multiplayerRef.current;
    if (nextPlayerId === 0) {
      sound.playTileTouch();
      const myHand = stateRef.current.playerHands[0];
      const huRes = checkHu(myHand, stateRef.current.playerMelds[0], null, true, { isLastTile: stateRef.current.wall.length === 0 });
      const kOptions = getKongOptions(myHand, stateRef.current.playerMelds[0], null, config);
      const siXiList = checkMidGameSiXi(myHand, config, declaredSiXiRef.current[0]);

      setAvailableActions({
        hu: huRes.canHu,
        siXi: siXiList.length > 0,
        gang: kOptions.length > 0,
        peng: false,
        chi: false,
        pass: huRes.canHu || kOptions.length > 0 || siXiList.length > 0
      });
      setKongOptions(kOptions);
      setMidGameSiXiOptions(siXiList);

      if (mp.isMultiplayer && mp.isHost) {
        network.broadcast({
          type: 'TURN_UPDATE',
          currentTurn: 0,
          turnTimer: 15
        });
      }
    } else {
      if (mp.isMultiplayer && mp.seats[nextPlayerId]?.isHuman) {
        // 给该真人发送私有暗摸牌
        network.sendToSeat(nextPlayerId, {
          type: 'TURN_UPDATE',
          currentTurn: nextPlayerId,
          turnTimer: 15,
          drawnTile: drawn
        });
        // 告知其余玩家轮次变更
        for (let s = 1; s < 4; s++) {
          if (s !== nextPlayerId && mp.seats[s]?.isHuman) {
            network.sendToSeat(s, {
              type: 'TURN_UPDATE',
              currentTurn: nextPlayerId,
              turnTimer: 15
            });
          }
        }
      } else {
        if (mp.isMultiplayer && mp.isHost) {
          network.broadcast({
            type: 'TURN_UPDATE',
            currentTurn: nextPlayerId,
            turnTimer: 15
          });
        }
        triggerAiTurn(nextPlayerId);
      }
    }
  };

  const triggerAiTurn = (botId) => {
    setTimeout(() => {
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
    // 战绩裁定：只有四人对战（4 真人、全程无托管）才记入本机记录；单机/托管局一律不计
    if (rankedRoundRef.current) {
      setMyRecord(recordRound(typeof localStorage !== 'undefined' ? localStorage : null, {
        scoreDelta: changes[multiplayerState.mySeatId] || 0
      }));
    }

    setPlayerScores(prev => prev.map((s, idx) => s + changes[idx]));
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
      huTypes: (huTypes && huTypes.length > 0) ? huTypes : ['平胡'],
      score: scored.winners.reduce((sum, w) => sum + w.receives, 0),
      birdsResult: birdResult,
      handTiles: stateRef.current.playerHands[winnerId],
      melds: stateRef.current.playerMelds[winnerId],
      winningTile,
      isSelfDrawn: isSelfDrawn && !isTongPao,
      scoreChanges: changes,
      newDealerId: nextDealer,
      roundDealerId: stateRef.current.dealerId, // P2-1：本局庄，用于结算页标注「连庄」
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

    // 战绩裁定：流局也算打过一局（净变化 0），但同样只计四人对战
    if (rankedRoundRef.current) {
      setMyRecord(recordRound(typeof localStorage !== 'undefined' ? localStorage : null, { scoreDelta: 0 }));
    }

    const finalResult = {
      isHuangZhuang: true,
      scoreChanges: [0, 0, 0, 0],
      lastDrawerId: stateRef.current.lastDrawerId,
      newDealerId: nextDealer,
      roundDealerId: stateRef.current.dealerId,
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
    sound.playHu();
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

    const huRes = checkHu(myHand, myMelds, winningTile, isSelfDrawn, { isLastTile: stateRef.current.wall.length === 0 });
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
      className="relative w-screen h-screen overflow-hidden flex flex-col bg-panel text-slate-100 select-none safe-pad"
      data-theme={config.theme === 'jade' ? 'jade' : undefined} /* P0-8 双主题：jade 时覆盖 --color-* token */
    >
      {/* 竖屏提示遮罩 (仅在竖屏时显示) */}
      {isPortrait && (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 z-[100] flex flex-col items-center justify-center p-8">
        <div className="w-24 h-24 mb-8 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
          <svg className="w-16 h-16 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <h2 className="text-3xl font-black text-amber-300 mb-4 text-center">请横置手机</h2>
        <p className="text-lg text-slate-300 text-center mb-6 max-w-sm leading-relaxed">
          长沙麻将需要横屏显示才能获得最佳游戏体验
        </p>
        <div className="text-sm text-slate-400 text-center mb-6">
          旋转手机后即可开始游戏
        </div>

        {/* 手动跳过按钮 (如果自动检测失败) */}
        <button
          onClick={() => setIsPortrait(false)}
          className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-lg transition-colors"
        >
          已横屏，开始游戏
        </button>
        <div className="text-xs text-slate-500 mt-3">
          如果已经横屏但仍看到此提示，请点击上方按钮
        </div>
      </div>
      )}

      {/* 顶部黄金岛经典 HUD 导航栏 (红木描金古典风) */}
      <header className="h-14 px-4 sm:px-6 flex items-center justify-between border-b border-amber-500/30 bg-gradient-to-r from-shell-800 via-shell-500 to-shell-800 shadow-lg z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-700 flex items-center justify-center font-black text-slate-950 text-base shadow-md border border-amber-300">
            岛
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-wide text-amber-200 flex items-center gap-2 drop-shadow">
              <span>黄金岛 · 长沙麻将</span>
              <span className="text-[10px] sm:text-xs bg-amber-950/80 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/40">
                经典正版复刻
              </span>
            </h1>
            <div className="text-[11px] text-amber-300/70 flex items-center gap-1.5 mt-0.2">
              <span>开杠摸 {config.kongDrawCount} 只</span>
              <span>·</span>
              <span>{config.kongRequiresJiang ? '需将' : '免将'}</span>
              <span>·</span>
              <span>{config.birdCount > 0 ? `抓 ${config.birdCount} 鸟` : '不抓鸟'}</span>
            </div>
          </div>
        </div>

        {/* 顶部中央：对局模式与房间状态 */}
        <div className="hidden lg:flex items-center gap-3 bg-black/60 px-5 py-1.5 rounded-full border border-amber-500/30 text-xs sm:text-sm">
          {multiplayerState.isMultiplayer ? (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-bold text-amber-300">房号: {multiplayerState.roomCode}</span>
              <span className="text-amber-200/70">
                ({multiplayerState.isHost ? '房主' : '已入座'})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-200 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>标准单机练习 (AI电脑对战)</span>
            </div>
          )}
        </div>

        {/* 右侧工具按钮 (黄金岛金质圆形快捷功能组) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* P2-3：联机时的网络状况（延迟 + 连接状态） */}
          {multiplayerState.isMultiplayer && (
            <div
              data-testid="net-status"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/50 border border-emerald-500/30 text-[11px] font-bold text-slate-200"
              title={`联机网络：${networkStatusText({ latency: netLatency, connection: netConn })}（延迟取最近 5 次往返平均）`}
            >
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  { ok: 'bg-emerald-400', warn: 'bg-amber-400', bad: 'bg-red-500' }[
                    statusTone({ latency: netLatency, connection: netConn })
                  ] || 'bg-slate-500'
                }`}
              />
              <span className="font-mono whitespace-nowrap">
                {networkStatusText({ latency: netLatency, connection: netConn })}
              </span>
            </div>
          )}

          {/* 多人联机 */}
          <button
            onClick={() => setIsMultiplayerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-700 via-yellow-600 to-amber-700 hover:from-amber-600 hover:to-yellow-500 text-slate-950 text-xs font-black border border-amber-300 shadow-md transition-all active:scale-95"
          >
            <Users className="w-3.5 h-3.5" />
            <span>{multiplayerState.isMultiplayer ? `房间 ${multiplayerState.roomCode}` : '多人对战'}</span>
          </button>

          {/* 音效开关 */}
          <button
            onClick={() => handleUpdateConfig({ ...config, soundEnabled: !config.soundEnabled })}
            className="relative w-8 h-8 rounded-full bg-amber-950/70 hover:bg-amber-900/90 text-amber-300 border border-amber-500/40 flex items-center justify-center transition-colors shadow-sm after:absolute after:-inset-1.5 after:content-['']"
            title="音效开关"
          >
            {config.soundEnabled ? <Volume2 className="w-4 h-4 text-amber-300" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* 规则指南 */}
          <button
            onClick={() => setIsRulesOpen(true)}
            className="relative w-8 h-8 rounded-full bg-amber-950/70 hover:bg-amber-900/90 text-amber-300 border border-amber-500/40 flex items-center justify-center transition-colors shadow-sm after:absolute after:-inset-1.5 after:content-['']"
            title="玩法规则"
          >
            <BookOpen className="w-4 h-4 text-amber-300" />
          </button>

          {/* 规则设置 */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="relative w-8 h-8 rounded-full bg-amber-950/70 hover:bg-amber-900/90 text-amber-300 border border-amber-500/40 flex items-center justify-center transition-colors shadow-sm after:absolute after:-inset-1.5 after:content-['']"
            title="规则设置"
          >
            <Settings className="w-4 h-4 text-amber-300" />
          </button>
        </div>
      </header>

      {/* 牌桌主体核心区 (红木包边 + 金色内嵌线 + 皇家红丝绒桌面) */}
      <div className="relative flex-1 w-full h-[calc(100vh-3.5rem)] p-2 sm:p-3 bg-gradient-to-b from-shell-700 via-shell-500 to-shell-300 overflow-hidden flex flex-col">
        {/* 皇家红丝绒圆角牌桌主面板 */}
        <main className="relative flex-1 w-full h-full rounded-2xl sm:rounded-3xl border-2 sm:border-[3px] border-amber-400/80 shadow-[inset_0_0_60px_rgba(0,0,0,0.85),0_10px_35px_rgba(0,0,0,0.9)] mahjong-table overflow-hidden">
          {/* 1. 顶部：对家区域 (手牌在上，副露在右) */}
          <div className="absolute top-1.5 sm:top-2.5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
            <OpponentHand
              player={currentSeatPlayers[topSeatId]}
              handCount={playerHands[topSeatId]?.length || 0}
              melds={playerMelds[topSeatId] || []}
              isCurrentTurn={currentTurn === topSeatId}
              actionBubble={actionBubbles[topSeatId]}
              score={playerScores[topSeatId]}
              isDealer={dealerId === topSeatId}
              visualPosition="top"
              {...seatAiInfo(topSeatId)}
            />
          </div>

          {/* 2. 左侧：上家区域 (紧靠左侧桌面边框，副露在上方) */}
          <div className="absolute left-1.5 sm:left-3 top-1/2 -translate-y-1/2 z-20 flex items-center">
            <OpponentHand
              player={currentSeatPlayers[leftSeatId]}
              handCount={playerHands[leftSeatId]?.length || 0}
              melds={playerMelds[leftSeatId] || []}
              isCurrentTurn={currentTurn === leftSeatId}
              actionBubble={actionBubbles[leftSeatId]}
              score={playerScores[leftSeatId]}
              isDealer={dealerId === leftSeatId}
              visualPosition="left"
              {...seatAiInfo(leftSeatId)}
            />
          </div>

          {/* 3. 右侧：下家区域 (紧靠右侧桌面边框，副露在右侧) */}
          <div className="absolute right-1.5 sm:right-3 top-1/2 -translate-y-1/2 z-20 flex items-center">
            <OpponentHand
              player={currentSeatPlayers[rightSeatId]}
              handCount={playerHands[rightSeatId]?.length || 0}
              melds={playerMelds[rightSeatId] || []}
              isCurrentTurn={currentTurn === rightSeatId}
              actionBubble={actionBubbles[rightSeatId]}
              score={playerScores[rightSeatId]}
              isDealer={dealerId === rightSeatId}
              visualPosition="right"
              {...seatAiInfo(rightSeatId)}
            />
          </div>

          {/* 4. 黄金岛标志性四方 3D 双层黄金牌墙 (环绕中央对局出牌区) */}
          {/* 上牌墙 */}
          <div className="absolute top-[20%] sm:top-[22%] left-1/2 -translate-x-1/2 z-0 pointer-events-none opacity-90">
            <TileWall position="top" count={12} />
          </div>
          {/* 下牌墙 */}
          <div className="absolute bottom-[28%] sm:bottom-[31%] left-1/2 -translate-x-1/2 z-0 pointer-events-none opacity-90">
            <TileWall position="bottom" count={12} />
          </div>
          {/* 左牌墙 */}
          <div className="absolute left-[16%] sm:left-[19%] lg:left-[22%] top-1/2 -translate-y-1/2 z-0 pointer-events-none opacity-90">
            <TileWall position="left" count={10} />
          </div>
          {/* 右牌墙 */}
          <div className="absolute right-[16%] sm:right-[19%] lg:right-[22%] top-1/2 -translate-y-1/2 z-0 pointer-events-none opacity-90">
            <TileWall position="right" count={10} />
          </div>

          {/* 5. 正中央核心对局区：四方紧凑出牌池围绕中央八角紫金罗盘 (高度复刻黄金岛原版) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center justify-center">
            {/* 对家出牌 (罗盘正上方：6张一行横排面对对家) */}
            <div className="mb-0.5 sm:mb-1">
              <PlayerDiscardTray
                playerId={topSeatId}
                discards={playerDiscards[topSeatId] || []}
                lastDiscard={lastDiscard}
                hoveredTile={hoveredTile}
                position="top"
              />
            </div>

            {/* 中层：上家出牌 + 八角紫金罗盘 + 下家出牌 */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2.5">
              {/* 上家出牌 (罗盘正左方：6张一列竖排面对上家) */}
              <PlayerDiscardTray
                playerId={leftSeatId}
                discards={playerDiscards[leftSeatId] || []}
                lastDiscard={lastDiscard}
                hoveredTile={hoveredTile}
                position="left"
              />

              {/* 中央罗盘与桌面金印横幅 */}
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
              />

              {/* 下家出牌 (罗盘正右方：6张一列竖排面对下家) */}
              <PlayerDiscardTray
                playerId={rightSeatId}
                discards={playerDiscards[rightSeatId] || []}
                lastDiscard={lastDiscard}
                hoveredTile={hoveredTile}
                position="right"
              />
            </div>

            {/* 我家出牌 (罗盘正下方：6张一行横排面对我) */}
            <div className="mt-0.5 sm:mt-1">
              <PlayerDiscardTray
                playerId={bottomSeatId}
                discards={playerDiscards[bottomSeatId] || []}
                lastDiscard={lastDiscard}
                hoveredTile={hoveredTile}
                position="bottom"
              />
            </div>

            {/* 未开局时的居中开始对局按钮 */}
            {gameState === 'IDLE' && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 backdrop-blur-xs rounded-3xl gap-2.5 p-3">
                <button
                  onClick={() => startNewRound()}
                  className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-lg shadow-2xl hover:scale-105 active:scale-95 transition-all border-2 border-amber-200"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>开始对局</span>
                </button>

                <button
                  onClick={() => setIsMultiplayerOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 text-amber-300 font-bold text-xs border border-amber-500/40 transition-all hover:scale-105"
                >
                  <Users className="w-4 h-4" />
                  <span>多人联机对战</span>
                </button>
              </div>
            )}
          </div>

          {/* 6. 左下角：我方玩家信息胶囊牌（P2-6：占位符改为本机真实标识与昵称） */}
          <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-4 z-40 flex items-center gap-1.5 bg-gradient-to-b from-panel-800 via-panel-700 to-panel-600 border-[1.5px] border-amber-400/90 rounded-full px-3 py-1 shadow-2xl">
            {dealerId === bottomSeatId && (
              <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-red-700 to-red-500 border border-amber-300 text-white text-[10px] font-black flex items-center justify-center shadow-md">
                庄
              </span>
            )}
            <div className="flex items-center gap-1 text-red-500">
              <span className="text-xs">♥</span>
              <span className="text-xs font-mono font-black text-yellow-300 tracking-tight">{myDisplayId}</span>
            </div>
            <span className="text-xs font-black text-amber-100 ml-1">
              {myDisplayName}
            </span>
            {/* 本机战绩（裁定：只有 4 真人满座、全程无托管的对局才计入；刷电脑不涨） */}
            <span
              className="text-[10px] font-black text-amber-200 bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-500/40 whitespace-nowrap"
              title="本机记录：只统计 4 个真人满座、全程无 AI 托管的对局；打电脑不计入"
            >
              净胜 {myRecord.netScore > 0 ? '+' : ''}{myRecord.netScore} · {myRecord.matches} 局
            </span>
          </div>

          {/* 7. 底部：我的操作控制栏与立手牌 (巨幅超清，布满下方屏幕的三分之二) */}
          <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center w-full max-w-[1400px] px-2 pointer-events-none safe-pad-bottom" style={{ paddingBottom: 'var(--safe-bottom)' }}>
            {/* 人类操作按钮栏 (胡/四喜/杠/碰/吃/过) - 允许交互 */}
            <div className="pointer-events-auto mb-1">
              <ActionControls
                availableActions={availableActions}
                chiOptions={chiOptions}
                kongOptions={kongOptions}
                onHu={handleHumanHu}
                onSiXi={handleHumanSiXi}
                onGang={handleHumanGang}
                onPeng={handleHumanPeng}
                onChi={handleHumanChi}
                onPass={handleHumanPass}
              />
            </div>

            {/* 我的手牌 (副露居左，立牌居右，允许交互) */}
            <div className="pointer-events-auto w-full">
              <PlayerHand
                handTiles={playerHands[bottomSeatId] || []}
                melds={playerMelds[bottomSeatId] || []}
                drawnTile={currentTurn === bottomSeatId ? drawnTile : null}
                isMyTurn={currentTurn === bottomSeatId && gameState === 'PLAYING'}
                tingMap={tingMap}
                onDiscard={(tile) => executeDiscard(bottomSeatId, tile)}
                onHoverTile={setHoveredTile}
                showJiangBadge={config.kongRequiresJiang}
              />
            </div>
          </div>
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
      <StartingHuModal
        startingHuEvents={startingHuEvents}
        onAcknowledge={handleAcknowledgeStartingHu}
      />

      {/* 弹窗 5: 开杠补牌 (2只 或 4只) */}
      <KongDrawModal
        isOpen={kongDrawState.isOpen}
        kongPlayer={kongDrawState.kongPlayer}
        drawnKongTiles={kongDrawState.drawnTiles}
        kongCount={kongDrawState.count}
        canSelfHu={kongDrawState.canSelfHu}
        onDeclareKongHu={() => {
          handleRoundWin(0, 0, kongDrawState.drawnTiles[0], true, ['杠上开花']);
        }}
        onDiscardKongTiles={() => {
          setKongDrawState({ isOpen: false, kongPlayer: null, drawnTiles: [], count: 2, canSelfHu: false });
          const updatedHand = [...stateRef.current.playerHands[0], ...kongDrawState.drawnTiles];
          if (config.autoSort) updatedHand.sort(compareTiles);
          stateRef.current.playerHands[0] = updatedHand;
          setPlayerHands([...stateRef.current.playerHands]);
        }}
      />

      {/* 弹窗 6: 终局结算与抓鸟 */}
      <RoundResultModal
        isOpen={gameState === 'ROUND_OVER'}
        result={roundResult}
        players={currentSeatPlayers}
        onNextRound={() => startNewRound()}
        isMultiplayer={multiplayerState.isMultiplayer}
        isHost={multiplayerState.isHost}
      />
    </div>
  );
}
