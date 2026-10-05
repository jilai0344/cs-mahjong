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
import DiscardPool from './components/DiscardPool.jsx';
import ActionControls from './components/ActionControls.jsx';
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
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
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
    gang: false,
    peng: false,
    chi: false,
    pass: false
  });
  const [chiOptions, setChiOptions] = useState([]);
  const [kongOptions, setKongOptions] = useState([]);

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
    if (!config.showHints || currentTurn !== 0 || gameState !== 'PLAYING') {
      return new Map();
    }
    const myHand = playerHands[0];
    const myMelds = playerMelds[0];
    if (!myHand || myHand.length % 3 !== 2) return new Map();

    const allKnown = [
      ...myHand,
      ...playerMelds.flat().flatMap(m => m.tiles),
      ...playerDiscards.flat()
    ];
    return analyzeTingCards(myHand, myMelds, config, allKnown);
  }, [playerHands, playerMelds, playerDiscards, currentTurn, gameState, config]);

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
        }
      } else {
        // 访客接收房主广播的游戏状态
        if (data.type === 'GAME_STARTED') {
          setGameState('DEALING');
          setIsRollingDice(true);
          sound.playDice();
        } else if (data.type === 'DEAL_HAND') {
          setIsRollingDice(false);
          setGameState('PLAYING');
          setDealerId(data.dealerId);
          setWall(new Array(data.wallRemaining).fill({}));
          setPlayerHands(prev => {
            const next = [...prev];
            next[0] = data.myHand; // 访客本地视角永远置于下方 (座位 0)
            return next;
          });
        } else if (data.type === 'TILE_DISCARDED') {
          sound.playDiscard();
          setLastDiscard({ tile: data.tile, fromPlayer: data.playerId, isKongDiscard: data.isKongDiscard });
          // 更新弃牌池
          setPlayerDiscards(prev => {
            const next = [...prev];
            next[data.playerId] = [...next[data.playerId], data.tile];
            return next;
          });
        } else if (data.type === 'PROMPT_ACTION') {
          setAvailableActions(data.availableActions);
          setChiOptions(data.chiOptions || []);
          setKongOptions(data.kongOptions || []);
        } else if (data.type === 'TURN_UPDATE') {
          setCurrentTurn(data.currentTurn);
          setTurnTimer(data.turnTimer || 15);
          if (data.drawnTile && data.currentTurn === 0) {
            setDrawnTile(data.drawnTile);
            sound.playTileTouch();
          } else {
            setDrawnTile(null);
          }
        } else if (data.type === 'MELD_BROADCAST') {
          sound.playMeld(data.meldType);
          showBubble(data.playerId, data.meldType === 'chi' ? '吃！' : data.meldType === 'peng' ? '碰！' : '杠！');
          setPlayerMelds(prev => {
            const next = [...prev];
            next[data.playerId] = [...next[data.playerId], data.meldGroup];
            return next;
          });
        } else if (data.type === 'STARTING_HU_BROADCAST') {
          setStartingHuEvents(data.events);
          setGameState('STARTING_HU');
        } else if (data.type === 'ROUND_WIN_BROADCAST') {
          setRoundResult(data.result);
          setGameState('ROUND_OVER');
        } else if (data.type === 'BUBBLE_BROADCAST') {
          showBubble(data.playerId, data.text);
        }
      }
    });
  }, []);

  // 房主处理访客的胡碰吃过响应
  const handleGuestActionResponse = (seatId, action, payload) => {
    if (action === 'hu') {
      const tile = stateRef.current.lastDiscard?.tile;
      const huRes = checkHu(stateRef.current.playerHands[seatId], stateRef.current.playerMelds[seatId], tile, false, {});
      handleRoundWin(seatId, stateRef.current.lastDiscard.fromPlayer, tile, false, huRes.huTypes);
    } else if (action === 'peng') {
      executePeng(seatId, stateRef.current.lastDiscard.tile, stateRef.current.lastDiscard.fromPlayer);
    } else if (action === 'chi') {
      executeChi(seatId, payload.sequenceTiles, stateRef.current.lastDiscard.tile, stateRef.current.lastDiscard.fromPlayer);
    } else if (action === 'gang') {
      executeKong(seatId, payload.kongOption, stateRef.current.lastDiscard?.tile);
    } else if (action === 'pass') {
      // 访客点“过”，继续让后续玩家评估
      processAiResponses(stateRef.current.lastDiscard);
    }
  };

  // 启动多人游戏
  const handleStartMultiplayerGame = (roomConfig) => {
    setMultiplayerState({
      isMultiplayer: true,
      isHost: roomConfig.isHost,
      roomCode: roomConfig.roomCode,
      mySeatId: roomConfig.mySeatId,
      seats: roomConfig.seats
    });
    startNewRound();
  };

  // -------------------------------------------------------------------------
  // 开局发牌与起手胡流程
  // -------------------------------------------------------------------------
  const startNewRound = useCallback(() => {
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
    setKongDrawState({ isOpen: false, kongPlayer: null, drawnTiles: [], count: 2, canSelfHu: false });
    setAvailableActions({ hu: false, gang: false, peng: false, chi: false, pass: false });

    stateRef.current.playerDiscards = [[], [], [], []];
    stateRef.current.playerMelds = [[], [], [], []];
    setPlayerDiscards([[], [], [], []]);
    setPlayerMelds([[], [], [], []]);

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    setDiceValues([d1, d2]);

    // 若是联机房主，向所有人广播开局
    if (multiplayerState.isMultiplayer && multiplayerState.isHost) {
      network.broadcast({ type: 'GAME_STARTED' });
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
      if (multiplayerState.isMultiplayer && multiplayerState.isHost) {
        for (let s = 1; s < 4; s++) {
          if (multiplayerState.seats[s]?.isHuman) {
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
        if (huList.length > 0) {
          const playerName = multiplayerState.isMultiplayer ? multiplayerState.seats[pIdx]?.name : PLAYERS[pIdx].name;
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

        if (multiplayerState.isMultiplayer && multiplayerState.isHost) {
          network.broadcast({ type: 'STARTING_HU_BROADCAST', events: startingEvents });
        }
      } else {
        enterPlayingState(dealerId, hands, newDeck);
      }
    }, 900);
  }, [dealerId, config, multiplayerState]);

  const handleAcknowledgeStartingHu = () => {
    setStartingHuEvents([]);
    enterPlayingState(dealerId, stateRef.current.playerHands, stateRef.current.wall);
  };

  const enterPlayingState = (activeDealerId, hands, currentWall) => {
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

      setAvailableActions({
        hu: huRes.canHu,
        gang: kOptions.length > 0,
        peng: false,
        chi: false,
        pass: huRes.canHu || kOptions.length > 0
      });
      setKongOptions(kOptions);
    } else {
      // 若庄家是联机真人，通知出牌；若是 AI 则自动触发
      if (multiplayerState.isMultiplayer && multiplayerState.seats[activeDealerId]?.isHuman) {
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
          if (stateRef.current.currentTurn === 0) {
            handleTimeoutAutoDiscard();
          }
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [gameState]);

  const handleTimeoutAutoDiscard = () => {
    const myHand = stateRef.current.playerHands[0];
    if (myHand && myHand.length > 0) {
      const tileToDiscard = drawnTile || myHand[myHand.length - 1];
      executeDiscard(0, tileToDiscard);
    }
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

    // 如果我是访客，向房主发送出牌意图
    if (multiplayerState.isMultiplayer && !multiplayerState.isHost) {
      network.sendToHost({ type: 'DISCARD_ACTION', tile });
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
    if (multiplayerState.isMultiplayer && multiplayerState.isHost) {
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
    if (multiplayerState.isMultiplayer && multiplayerState.isHost) {
      for (let s = 1; s < 4; s++) {
        if (s !== fromPlayer && multiplayerState.seats[s]?.isHuman) {
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
    const otherPlayers = [1, 2, 3].filter(id => id !== fromPlayer);

    // A. 评估是否有人点炮胡牌
    for (const pId of otherPlayers) {
      // 如果该座位是真人，跳过 AI
      if (multiplayerState.isMultiplayer && multiplayerState.seats[pId]?.isHuman) continue;

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
      if (multiplayerState.isMultiplayer && multiplayerState.seats[pId]?.isHuman) continue;

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
    if (nextPlayerId !== 0 && (!multiplayerState.isMultiplayer || !multiplayerState.seats[nextPlayerId]?.isHuman)) {
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
    if (multiplayerState.isMultiplayer && multiplayerState.isHost) {
      network.broadcast({
        type: 'MELD_BROADCAST',
        playerId,
        meldType: 'peng',
        meldGroup
      });
    }

    if (playerId === 0) {
      setAvailableActions({ hu: false, gang: false, peng: false, chi: false, pass: false });
    } else {
      if (multiplayerState.isMultiplayer && multiplayerState.seats[playerId]?.isHuman) {
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

    const meldGroup = {
      type: 'chi',
      tile: discardedTile,
      tiles: sequenceTiles
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

    if (multiplayerState.isMultiplayer && multiplayerState.isHost) {
      network.broadcast({
        type: 'MELD_BROADCAST',
        playerId,
        meldType: 'chi',
        meldGroup
      });
    }

    if (playerId === 0) {
      setAvailableActions({ hu: false, gang: false, peng: false, chi: false, pass: false });
    } else {
      if (multiplayerState.isMultiplayer && multiplayerState.seats[playerId]?.isHuman) {
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
    drawnKongCards.forEach(drawnCard => {
      const huRes = checkHu(curHand, stateRef.current.playerMelds[playerId], drawnCard, true, {
        isKongFlower: true
      });
      if (huRes.canHu) {
        canSelfKongHu = true;
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
        handleRoundWin(playerId, playerId, drawnKongCards[0], true, ['杠上开花']);
      } else {
        setTimeout(() => {
          discardKongTilesToPool(playerId, drawnKongCards);
        }, 1000);
      }
    }
  };

  const discardKongTilesToPool = (kongPlayerId, kongCards) => {
    setKongDrawState({ isOpen: false, kongPlayer: null, drawnTiles: [], count: 2, canSelfHu: false });

    for (const card of kongCards) {
      stateRef.current.playerDiscards[kongPlayerId] = [
        ...stateRef.current.playerDiscards[kongPlayerId],
        card
      ];
      setPlayerDiscards([...stateRef.current.playerDiscards]);

      for (let i = 0; i < 4; i++) {
        if (i !== kongPlayerId) {
          const hand = stateRef.current.playerHands[i];
          const melds = stateRef.current.playerMelds[i];
          const huRes = checkHu(hand, melds, card, false, { isKongDiscard: true });
          if (huRes.canHu) {
            showBubble(i, '杠上炮！');
            handleRoundWin(i, kongPlayerId, card, false, ['杠上炮', ...huRes.huTypes.filter(t => t !== '平胡')]);
            return;
          }
        }
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

    if (nextPlayerId === 0) {
      sound.playTileTouch();
      const myHand = stateRef.current.playerHands[0];
      const huRes = checkHu(myHand, stateRef.current.playerMelds[0], null, true, {});
      const kOptions = getKongOptions(myHand, stateRef.current.playerMelds[0], null, config);

      setAvailableActions({
        hu: huRes.canHu,
        gang: kOptions.length > 0,
        peng: false,
        chi: false,
        pass: huRes.canHu || kOptions.length > 0
      });
      setKongOptions(kOptions);
    } else {
      if (multiplayerState.isMultiplayer && multiplayerState.seats[nextPlayerId]?.isHuman) {
        network.sendToSeat(nextPlayerId, {
          type: 'TURN_UPDATE',
          currentTurn: nextPlayerId,
          turnTimer: 15,
          drawnTile: drawn
        });
      } else {
        triggerAiTurn(nextPlayerId);
      }
    }
  };

  const triggerAiTurn = (botId) => {
    setTimeout(() => {
      const hand = stateRef.current.playerHands[botId];
      const melds = stateRef.current.playerMelds[botId];
      const drawn = hand[hand.length - 1];

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

    const winnerName = multiplayerState.isMultiplayer ? multiplayerState.seats[winnerId]?.name : PLAYERS[winnerId].name;
    const loserName = loserId !== null ? (multiplayerState.isMultiplayer ? multiplayerState.seats[loserId]?.name : PLAYERS[loserId].name) : '';

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

    if (multiplayerState.isMultiplayer && multiplayerState.isHost) {
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

    if (multiplayerState.isMultiplayer && multiplayerState.isHost) {
      network.broadcast({
        type: 'ROUND_WIN_BROADCAST',
        result: finalResult
      });
    }
  };

  // 人类操作
  const handleHumanHu = () => {
    if (multiplayerState.isMultiplayer && !multiplayerState.isHost) {
      network.sendToHost({ type: 'RESPOND_ACTION', action: 'hu' });
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
    if (multiplayerState.isMultiplayer && !multiplayerState.isHost) {
      network.sendToHost({ type: 'RESPOND_ACTION', action: 'gang', payload: { kongOption: selectedOption } });
      return;
    }
    executeKong(0, selectedOption, stateRef.current.lastDiscard?.tile);
  };

  const handleHumanPeng = () => {
    if (multiplayerState.isMultiplayer && !multiplayerState.isHost) {
      network.sendToHost({ type: 'RESPOND_ACTION', action: 'peng' });
      return;
    }
    if (stateRef.current.lastDiscard) {
      executePeng(0, stateRef.current.lastDiscard.tile, stateRef.current.lastDiscard.fromPlayer);
    }
  };

  const handleHumanChi = (selectedSequence) => {
    if (multiplayerState.isMultiplayer && !multiplayerState.isHost) {
      network.sendToHost({ type: 'RESPOND_ACTION', action: 'chi', payload: { sequenceTiles: selectedSequence } });
      return;
    }
    if (stateRef.current.lastDiscard) {
      executeChi(0, selectedSequence, stateRef.current.lastDiscard.tile, stateRef.current.lastDiscard.fromPlayer);
    }
  };

  const handleHumanPass = () => {
    setAvailableActions({ hu: false, gang: false, peng: false, chi: false, pass: false });
    if (multiplayerState.isMultiplayer && !multiplayerState.isHost) {
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
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-[#03140e] text-slate-100 select-none mahjong-table">
      {/* 顶部现代水晶 HUD 导航栏 */}
      <header className="h-16 px-4 sm:px-6 flex items-center justify-between border-b border-emerald-500/20 bg-slate-950/70 backdrop-blur-md z-30 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-lg shadow-md">
            麻
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wide text-white flex items-center gap-2">
              <span>长沙麻将</span>
              <span className="text-xs bg-emerald-900/60 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                现代清澈版
              </span>
            </h1>
            <div className="text-xs text-emerald-300/80 flex items-center gap-2 mt-0.5">
              <span>开杠摸 {config.kongDrawCount} 只</span>
              <span>·</span>
              <span>{config.kongRequiresJiang ? '开杠需将' : '开杠免将'}</span>
              <span>·</span>
              <span>{config.birdCount > 0 ? `抓 ${config.birdCount} 鸟` : '不抓鸟'}</span>
            </div>
          </div>
        </div>

        {/* 顶部中央：对局模式与房间状态 */}
        <div className="hidden lg:flex items-center gap-3 bg-black/50 px-5 py-2 rounded-full border border-emerald-500/30 text-sm">
          {multiplayerState.isMultiplayer ? (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-bold text-amber-300">房间: {multiplayerState.roomCode}</span>
              <span className="text-emerald-300/70">
                ({multiplayerState.isHost ? '我是房主' : '已连入'})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
              <span>单机练习模式 (电脑AI对局)</span>
            </div>
          )}
        </div>

        {/* 右侧工具按钮 */}
        <div className="flex items-center gap-2.5">
          {/* 多人实时联机按钮 */}
          <button
            onClick={() => setIsMultiplayerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-600 hover:to-emerald-600 text-white text-sm font-bold border border-emerald-400/40 shadow-md transition-all active:scale-95"
          >
            <Users className="w-4 h-4 text-emerald-300" />
            <span>{multiplayerState.isMultiplayer ? `房间 ${multiplayerState.roomCode}` : '多人联机'}</span>
          </button>

          {/* 音效开关 */}
          <button
            onClick={() => handleUpdateConfig({ ...config, soundEnabled: !config.soundEnabled })}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="音效开关"
          >
            {config.soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* 规则指南 */}
          <button
            onClick={() => setIsRulesOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-bold border border-slate-700 transition-colors"
          >
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>玩法规则</span>
          </button>

          {/* 规则设置 */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-black shadow-md transition-transform active:scale-95"
          >
            <Settings className="w-4 h-4" />
            <span>设置</span>
          </button>
        </div>
      </header>

      {/* 牌桌主体核心区 */}
      <main className="relative flex-1 w-full h-[calc(100vh-4rem)] flex flex-col justify-between items-center p-2 overflow-hidden">
        {/* 对家 (西/顶) */}
        <OpponentHand
          player={currentSeatPlayers[2]}
          handCount={playerHands[2].length}
          melds={playerMelds[2]}
          isCurrentTurn={currentTurn === 2}
          actionBubble={actionBubbles[2]}
          score={playerScores[2]}
          isDealer={dealerId === 2}
        />

        {/* 上家 (北/左) 与 下家 (南/右) */}
        <OpponentHand
          player={currentSeatPlayers[3]}
          handCount={playerHands[3].length}
          melds={playerMelds[3]}
          isCurrentTurn={currentTurn === 3}
          actionBubble={actionBubbles[3]}
          score={playerScores[3]}
          isDealer={dealerId === 3}
        />
        <OpponentHand
          player={currentSeatPlayers[1]}
          handCount={playerHands[1].length}
          melds={playerMelds[1]}
          isCurrentTurn={currentTurn === 1}
          actionBubble={actionBubbles[1]}
          score={playerScores[1]}
          isDealer={dealerId === 1}
        />

        {/* 牌桌中心核心区域：左侧一行12张的弃牌池 + 右侧方位轮盘与倒计时 */}
        <div className="relative my-auto flex items-center justify-between w-[820px] max-w-[96vw] h-[370px] rounded-3xl bg-emerald-950/50 border-2 border-emerald-500/30 shadow-2xl p-3 sm:p-4 gap-3">
          {/* 左侧区域：四位玩家各自一行12张的弃牌行 */}
          <div className="flex-1 h-full flex flex-col justify-center overflow-hidden">
            <DiscardPool
              discardsByPlayer={playerDiscards}
              lastDiscard={lastDiscard}
              hoveredTile={hoveredTile}
            />
          </div>

          {/* 右侧：精致的东南西北罗盘与倒计时 */}
          <div className="shrink-0 flex items-center justify-center pl-2 border-l border-emerald-500/20">
            <TableCenter
              currentTurn={currentTurn}
              dealerId={dealerId}
              wallRemaining={wall.length}
              turnTimer={turnTimer}
              diceValues={diceValues}
              isRollingDice={isRollingDice}
              statusText={gameState === 'PLAYING' ? (currentTurn === 0 ? '轮到你出牌' : '思考中') : ''}
            />
          </div>

          {/* 开局按钮 (未开局时居中展示) */}
          {gameState === 'IDLE' && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/50 backdrop-blur-xs rounded-3xl gap-3">
              <button
                onClick={startNewRound}
                className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-lg shadow-2xl hover:scale-105 active:scale-95 transition-all"
              >
                <Play className="w-6 h-6 fill-current" />
                <span>洗牌发牌 · 开始对局</span>
              </button>

              <button
                onClick={() => setIsMultiplayerOpen(true)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-emerald-300 font-bold text-xs border border-emerald-500/30 transition-all hover:scale-105"
              >
                <Users className="w-4 h-4" />
                <span>创建房间 · 邀请好友实时联机</span>
              </button>
            </div>
          )}
        </div>

        {/* 人类操作按钮栏 (胡/杠/碰/吃/过) */}
        <ActionControls
          availableActions={availableActions}
          chiOptions={chiOptions}
          kongOptions={kongOptions}
          onHu={handleHumanHu}
          onGang={handleHumanGang}
          onPeng={handleHumanPeng}
          onChi={handleHumanChi}
          onPass={handleHumanPass}
        />

        {/* 底部：人类手牌 */}
        <div className="w-full flex flex-col items-center z-20 pb-2 shrink-0">
          <PlayerHand
            handTiles={playerHands[0]}
            melds={playerMelds[0]}
            drawnTile={currentTurn === 0 ? drawnTile : null}
            isMyTurn={currentTurn === 0 && gameState === 'PLAYING'}
            tingMap={tingMap}
            onDiscard={(tile) => executeDiscard(0, tile)}
            onHoverTile={setHoveredTile}
            showJiangBadge={config.kongRequiresJiang}
          />
        </div>
      </main>

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
        onNextRound={startNewRound}
      />
    </div>
  );
}
