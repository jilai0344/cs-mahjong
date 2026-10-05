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

  // 相对本地视角的座位编号计算 (以我的视角为基准，我永远在底部)
  const mySeatId = multiplayerState.isMultiplayer ? multiplayerState.mySeatId : 0;
  const bottomSeatId = mySeatId;
  const rightSeatId = (mySeatId + 1) % 4;
  const topSeatId = (mySeatId + 2) % 4;
  const leftSeatId = (mySeatId + 3) % 4;

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

  // 定时器引用
  const timerRef = useRef(null);

  // 3. 【核心稳定基石】单一权威状态引用，彻底杜绝闭包过期引起的碰牌/出牌 BUG
  const stateRef = useRef({
    playerHands: [[], [], [], []],
    playerMelds: [[], [], [], []],
    playerDiscards: [[], [], [], []],
    wall: [],
    currentTurn: 0,
    dealerId: 0,
    lastDiscard: null,
    gameState: 'IDLE'
  });

  const handleUpdateConfig = (newConfig) => {
    setConfig(newConfig);
    sound.enabled = newConfig.soundEnabled;
    localStorage.setItem('cs_mahjong_config', JSON.stringify(newConfig));
  };

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
          setGameState('DEALING');
          setIsRollingDice(true);
          sound.playDice();
        } else if (data.type === 'DEAL_HAND') {
          setIsRollingDice(false);
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
      const isSelfDrawn = stateRef.current.currentTurn === seatId;
      const tile = isSelfDrawn
        ? stateRef.current.playerHands[seatId][stateRef.current.playerHands[seatId].length - 1]
        : stateRef.current.lastDiscard?.tile;
      const loserId = isSelfDrawn ? seatId : (stateRef.current.lastDiscard?.fromPlayer ?? 0);
      const huRes = checkHu(stateRef.current.playerHands[seatId], stateRef.current.playerMelds[seatId], tile, isSelfDrawn, {});
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
              wallRemaining: newDeck.length
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
        setPlayerScores(prevScores => {
          const nextScores = [...prevScores];
          startingEvents.forEach(evt => {
            const pId = evt.player.id;
            const ptsPerHu = 2;
            const totalGain = evt.huList.length * ptsPerHu * 3;
            nextScores[pId] += totalGain;
            for (let i = 0; i < 4; i++) {
              if (i !== pId) {
                nextScores[i] -= evt.huList.length * ptsPerHu;
              }
            }
          });
          return nextScores;
        });

        setStartingHuEvents(startingEvents);
        setGameState('STARTING_HU');
        stateRef.current.gameState = 'STARTING_HU';

        if (mp.isMultiplayer && mp.isHost) {
          network.broadcast({ type: 'STARTING_HU_BROADCAST', events: startingEvents });
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
          if (stateRef.current.currentTurn === mySeatId) {
            handleTimeoutAutoDiscard();
          }
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [gameState, mySeatId]);

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

  const processDiscardResponses = (discardEvent) => {
    const { tile, fromPlayer } = discardEvent;
    const mp = multiplayerRef.current;

    // 1. 人类玩家优先判定
    if (fromPlayer !== 0) {
      const myHand = stateRef.current.playerHands[0];
      const myMelds = stateRef.current.playerMelds[0];

      const huRes = checkHu(myHand, myMelds, tile, false, { isKongDiscard: discardEvent.isKongDiscard });
      const kOptions = getKongOptions(myHand, myMelds, tile, config);
      const pAllowed = canPeng(myHand, tile);
      const isFromPrev = (fromPlayer === 3);
      const cOptions = isFromPrev ? getChiOptions(myHand, tile) : [];

      const canAct = huRes.canHu || kOptions.length > 0 || pAllowed || cOptions.length > 0;

      if (canAct) {
        setAvailableActions({
          hu: huRes.canHu,
          gang: kOptions.length > 0,
          peng: pAllowed,
          chi: cOptions.length > 0,
          pass: true
        });
        setChiOptions(cOptions);
        setKongOptions(kOptions);
        return;
      }
    }

    // 2. 检查联机真人玩家是否有响应
    if (mp.isMultiplayer && mp.isHost) {
      for (let s = 1; s < 4; s++) {
        if (s !== fromPlayer && mp.seats[s]?.isHuman) {
          const guestHand = stateRef.current.playerHands[s];
          const guestMelds = stateRef.current.playerMelds[s];
          const huRes = checkHu(guestHand, guestMelds, tile, false, {});
          const kOptions = getKongOptions(guestHand, guestMelds, tile, config);
          const pAllowed = canPeng(guestHand, tile);
          const isFromPrev = ((fromPlayer + 1) % 4 === s);
          const cOptions = isFromPrev ? getChiOptions(guestHand, tile) : [];

          if (huRes.canHu || kOptions.length > 0 || pAllowed || cOptions.length > 0) {
            network.sendToSeat(s, {
              type: 'PROMPT_ACTION',
              availableActions: {
                hu: huRes.canHu,
                gang: kOptions.length > 0,
                peng: pAllowed,
                chi: cOptions.length > 0,
                pass: true
              },
              chiOptions: cOptions,
              kongOptions: kOptions
            });
          }
        }
      }
    }

    // 3. AI 评估
    processAiResponses(discardEvent);
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
        isKongDiscard: discardEvent.isKongDiscard
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
      const decision = decideAiResponse(hand, melds, tile, isPrev, config, {});

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
      const decision = decideAiResponse(hand, melds, tile, true, config, {});
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
    setWall([...curWall]);

    let canSelfKongHu = false;
    let kongFlowerWinTile = null;
    drawnKongCards.forEach(drawnCard => {
      const huRes = checkHu(curHand, stateRef.current.playerMelds[playerId], drawnCard, true, {
        isKongFlower: true
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
          const huRes = checkHu(hand, melds, card, false, { isKongDiscard: true });
          if (huRes.canHu) {
            kongWinners.push({ id: i, huRes });
          }
        }
      }
      if (kongWinners.length > 0) {
        kongWinners.forEach(w => showBubble(w.id, '杠上炮！'));
        // 按座位顺序，以出杠者下家优先结算（一炮多响取顺位最近者）
        const first = kongWinners.sort((a, b) =>
          ((a.id - kongPlayerId + 4) % 4) - ((b.id - kongPlayerId + 4) % 4)
        )[0];
        handleRoundWin(first.id, kongPlayerId, card, false, ['杠上炮', ...first.huRes.huTypes.filter(t => t !== '平胡')]);
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
      const huRes = checkHu(myHand, stateRef.current.playerMelds[0], null, true, {});
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

      const decision = decideAiTurnAction(hand, melds, drawn, config, {});

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
  const handleRoundWin = (winnerId, loserId, winningTile, isSelfDrawn, huTypes) => {
    setGameState('ROUND_OVER');
    stateRef.current.gameState = 'ROUND_OVER';
    setAvailableActions({ hu: false, gang: false, peng: false, chi: false, pass: false });

    const birdResult = drawBirds(stateRef.current.wall, config.birdCount, winnerId);

    let baseScore = 1;
    const isBig = huTypes.some(t => t !== '平胡');
    if (isBig) {
      baseScore = huTypes.filter(t => t !== '平胡').length * 6;
    }

    const finalScorePerLoser = baseScore * (1 + birdResult.hitCount);
    const changes = [0, 0, 0, 0];

    if (isSelfDrawn) {
      for (let i = 0; i < 4; i++) {
        if (i === winnerId) {
          changes[i] = finalScorePerLoser * 3;
        } else {
          changes[i] = -finalScorePerLoser;
        }
      }
    } else {
      changes[winnerId] = finalScorePerLoser * 3;
      changes[loserId] = -finalScorePerLoser * 3;
    }

    setPlayerScores(prev => prev.map((s, idx) => s + changes[idx]));
    setDealerId(winnerId);
    stateRef.current.dealerId = winnerId;

    const mp = multiplayerRef.current;
    const winnerName = mp.isMultiplayer ? mp.seats[winnerId]?.name : PLAYERS[winnerId].name;
    const loserName = loserId !== null ? (mp.isMultiplayer ? mp.seats[loserId]?.name : PLAYERS[loserId].name) : '';

    const finalResult = {
      isHuangZhuang: false,
      winner: { ...PLAYERS[winnerId], name: winnerName },
      loser: isSelfDrawn ? null : { ...PLAYERS[loserId], name: loserName },
      huTypes: huTypes.length > 0 ? huTypes : ['平胡'],
      score: finalScorePerLoser,
      birdsResult: birdResult,
      handTiles: stateRef.current.playerHands[winnerId],
      melds: stateRef.current.playerMelds[winnerId],
      winningTile,
      isSelfDrawn,
      scoreChanges: changes
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
    const nextDealer = (dealerId + 1) % 4;
    setDealerId(nextDealer);
    stateRef.current.dealerId = nextDealer;

    const finalResult = {
      isHuangZhuang: true,
      scoreChanges: [0, 0, 0, 0]
    };
    setRoundResult(finalResult);

    const mp = multiplayerRef.current;
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
    showBubble(playerId, '中途四喜！', 2500);
    declaredSiXiRef.current[playerId].add(siXiOption.key);

    const ptsPerOther = 2;
    const totalGain = ptsPerOther * 3;
    setPlayerScores(prevScores => {
      const nextScores = [...prevScores];
      nextScores[playerId] += totalGain;
      for (let i = 0; i < 4; i++) {
        if (i !== playerId) {
          nextScores[i] -= ptsPerOther;
        }
      }
      return nextScores;
    });

    const mp = multiplayerRef.current;
    if (mp.isMultiplayer && mp.isHost) {
      network.broadcast({
        type: 'BUBBLE_BROADCAST',
        playerId,
        text: '中途四喜！'
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

    const huRes = checkHu(myHand, myMelds, winningTile, isSelfDrawn, {});
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
    if (currentTurn !== 0 && stateRef.current.lastDiscard) {
      processAiResponses(stateRef.current.lastDiscard);
    }
  };

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
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-[#1f0604] text-slate-100 select-none">
      {/* 竖屏提示遮罩 (仅在竖屏时显示) */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 z-[100] flex flex-col items-center justify-center p-8 portrait:flex landscape:hidden">
        <div className="w-24 h-24 mb-8 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
          <svg className="w-16 h-16 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <h2 className="text-3xl font-black text-amber-300 mb-4 text-center">请横置手机</h2>
        <p className="text-lg text-slate-300 text-center mb-6 max-w-sm leading-relaxed">
          长沙麻将需要横屏显示才能获得最佳游戏体验
        </p>
        <div className="text-sm text-slate-400 text-center">
          旋转手机后即可开始游戏
        </div>
      </div>

      {/* 顶部黄金岛经典 HUD 导航栏 (红木描金古典风) */}
      <header className="h-14 px-4 sm:px-6 flex items-center justify-between border-b border-amber-500/30 bg-gradient-to-r from-[#3b0e08] via-[#240804] to-[#3b0e08] shadow-lg z-30 shrink-0">
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
            className="w-8 h-8 rounded-full bg-amber-950/70 hover:bg-amber-900/90 text-amber-300 border border-amber-500/40 flex items-center justify-center transition-colors shadow-sm"
            title="音效开关"
          >
            {config.soundEnabled ? <Volume2 className="w-4 h-4 text-amber-300" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* 规则指南 */}
          <button
            onClick={() => setIsRulesOpen(true)}
            className="w-8 h-8 rounded-full bg-amber-950/70 hover:bg-amber-900/90 text-amber-300 border border-amber-500/40 flex items-center justify-center transition-colors shadow-sm"
            title="玩法规则"
          >
            <BookOpen className="w-4 h-4 text-amber-300" />
          </button>

          {/* 规则设置 */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-8 h-8 rounded-full bg-amber-950/70 hover:bg-amber-900/90 text-amber-300 border border-amber-500/40 flex items-center justify-center transition-colors shadow-sm"
            title="规则设置"
          >
            <Settings className="w-4 h-4 text-amber-300" />
          </button>
        </div>
      </header>

      {/* 牌桌主体核心区 (红木包边 + 金色内嵌线 + 皇家红丝绒桌面) */}
      <div className="relative flex-1 w-full h-[calc(100vh-3.5rem)] p-2 sm:p-3 bg-gradient-to-b from-[#380e08] via-[#240804] to-[#140302] overflow-hidden flex flex-col">
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

          {/* 6. 左下角：我方玩家黄金岛专属信息胶囊牌 (复刻原图 djdodkj / 39482) */}
          <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-4 z-40 flex items-center gap-1.5 bg-gradient-to-b from-[#4a180e] via-[#2b0c07] to-[#140503] border-[1.5px] border-amber-400/90 rounded-full px-3 py-1 shadow-2xl">
            {dealerId === bottomSeatId && (
              <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-red-700 to-red-500 border border-amber-300 text-white text-[10px] font-black flex items-center justify-center shadow-md">
                庄
              </span>
            )}
            <div className="flex items-center gap-1 text-red-500">
              <span className="text-xs">♥</span>
              <span className="text-xs font-mono font-black text-yellow-300 tracking-tight">39482</span>
            </div>
            <span className="text-xs font-black text-amber-100 ml-1">
              {multiplayerState.isMultiplayer ? (multiplayerState.seats[bottomSeatId]?.name || '我') : 'djdodkj'}
            </span>
            <span className="text-[10px] font-black italic text-amber-300 bg-amber-950/80 px-1 py-0.2 rounded border border-amber-500/40">
              V8
            </span>
          </div>

          {/* 7. 底部：我的操作控制栏与立手牌 (巨幅超清，布满下方屏幕的三分之二) */}
          <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center w-full max-w-[1400px] px-2 pointer-events-none" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
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
      />

      {/* 弹窗 2: 规则设置 */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
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
          discardKongTilesToPool(0, kongDrawState.drawnTiles);
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
