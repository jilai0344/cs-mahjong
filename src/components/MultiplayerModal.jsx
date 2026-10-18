import React, { useState, useEffect } from 'react';
import { X, Users, Copy, Check, Play, UserPlus, Bot, Shield, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { generateRoomCode, network, BROKER_URLS } from '../utils/multiplayer.js';
import { buildInviteUrl, parseInviteParams } from '../utils/invite.js';
import { describeRules } from '../game/rules.js';
import { networkStatusText, statusTone } from '../utils/latency.js';
import { useModalA11y } from '../hooks/useModalA11y.js';

export default function MultiplayerModal({
  isOpen,
  onClose,
  onStartMultiplayerGame,
  rules = null,
  netStatus = { latency: null, connection: 'disconnected' },
  onHostRules = () => {},
  onLeaveRoom = () => {}
}) {
  const [activeTab, setActiveTab] = useState('create');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('cs_player_name') || '长沙麻雀王');
  const [generatedCode, setGeneratedCode] = useState(() => generateRoomCode());
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [inviteParams, setInviteParams] = useState({ roomCode: null, channelIndex: 0 });
  const [lobbySeats, setLobbySeats] = useState(network.seats);
  const [inLobby, setInLobby] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const invite = parseInviteParams(window.location.search, BROKER_URLS.length);
      if (invite.roomCode) {
        setRoomCodeInput(invite.roomCode);
        setInviteParams(invite);
        setActiveTab('join');
      }
    }
  }, []);

  useEffect(() => {
    network.setOnLobbyChange((updatedSeats, roomRules) => {
      setLobbySeats([...updatedSeats]);
      if (roomRules) onHostRules(roomRules);
    });
    network.setOnError((errText) => {
      setErrorMessage(errText);
      setIsConnecting(false);
    });
  }, [onHostRules]);

  useEffect(() => {
    if (network.isHost && rules) network.setRoomRules(rules);
  }, [rules, inLobby]);

  const modalA11y = useModalA11y(onClose);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    const code = network.roomCode || generatedCode;
    const url = buildInviteUrl(window.location, code, network.channelIndex || 0, BROKER_URLS.length);
    navigator.clipboard.writeText(url).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleCreateRoom = () => {
    setIsConnecting(true);
    setErrorMessage('');
    localStorage.setItem('cs_player_name', playerName);

    network.createRoom(
      generatedCode,
      playerName,
      () => {
        setIsConnecting(false);
        setInLobby(true);
        setLobbySeats([...network.seats]);
      },
      (err) => {
        setIsConnecting(false);
        setErrorMessage(err.message || '创建房间失败，请重试');
      }
    );
  };

  const handleJoinRoom = () => {
    if (!roomCodeInput.trim()) {
      setErrorMessage('请输入 6 位房间号');
      return;
    }

    setIsConnecting(true);
    setErrorMessage('');
    localStorage.setItem('cs_player_name', playerName);

    const typedCode = roomCodeInput.trim().toUpperCase();
    const joinOpts = (inviteParams.roomCode === typedCode && inviteParams.channelIndex > 0)
      ? { channelIndex: inviteParams.channelIndex }
      : {};

    network.joinRoom(
      roomCodeInput.trim(),
      playerName,
      (seatId, seats) => {
        setIsConnecting(false);
        setInLobby(true);
        setLobbySeats([...seats]);
      },
      (err) => {
        setIsConnecting(false);
        setErrorMessage(err.message || '加入房间失败，房间号可能不存在');
      },
      joinOpts
    );
  };

  const handleStartGame = () => {
    if (network.isHost) {
      network.broadcast({
        type: 'GAME_STARTED',
        seats: network.seats,
        rules
      });
      onStartMultiplayerGame({
        isHost: true,
        roomCode: network.roomCode,
        mySeatId: 0,
        seats: network.seats
      });
      onClose();
    }
  };

  return (
    <div {...modalA11y} className="modal-backdrop animate-fade-in select-none">
      <div className="modal-card max-w-lg animate-modal-in">
        <div className="modal-head">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-jade-600)] text-white">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-stone-900">多人联机</h2>
              <p className="mt-0.5 text-[10px] text-stone-400">免服务器 · 端到端加密 · 好友一键加入</p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close" aria-label="关闭联机">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!inLobby ? (
          <div className="modal-body space-y-3">
            <div className="segmented grid-cols-2">
              <button
                type="button"
                onClick={() => { setActiveTab('create'); setErrorMessage(''); }}
                data-active={activeTab === 'create'}
                className="seg-btn"
              >
                创建好友房
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('join'); setErrorMessage(''); }}
                data-active={activeTab === 'join'}
                className="seg-btn"
              >
                加入房间
              </button>
            </div>

            <div className="info-block">
              <label className="mb-1.5 block text-[11px] font-medium text-stone-500">对局昵称</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={10}
                placeholder="输入你的游戏昵称"
                className="field text-sm"
              />
            </div>

            {activeTab === 'create' && (
              <div className="info-block space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-stone-500">即将生成的房间号</span>
                  <button
                    onClick={() => setGeneratedCode(generateRoomCode())}
                    className="flex items-center gap-1 text-[10px] font-medium text-stone-400 transition-colors hover:text-stone-700"
                  >
                    <RefreshCw className="h-3 w-3" />
                    换一个
                  </button>
                </div>
                <div className="flex items-center justify-center rounded-xl border border-stone-200 bg-stone-50 py-3">
                  <span className="font-mono text-[28px] font-semibold tracking-[0.18em] text-stone-800">
                    {generatedCode}
                  </span>
                </div>
                <p className="text-center text-[10px] leading-relaxed text-stone-400">
                  创建后把链接或房间号发给好友，对方打开链接即可自动入座。
                </p>
                <button
                  onClick={handleCreateRoom}
                  disabled={isConnecting}
                  className="btn-primary h-10 w-full text-[13px] disabled:opacity-50"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在启动房间频道
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      立即创建房间
                    </>
                  )}
                </button>
              </div>
            )}

            {activeTab === 'join' && (
              <div className="info-block space-y-3">
                <label className="block text-[11px] font-medium text-stone-500">输入 6 位房间号</label>
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="例如：A7XK29"
                  className="field text-center font-mono text-[22px] font-semibold tracking-[0.18em] uppercase"
                />
                <button
                  onClick={handleJoinRoom}
                  disabled={isConnecting || !roomCodeInput.trim()}
                  className="btn-primary h-10 w-full text-[13px] disabled:opacity-50"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在连接房主
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      进入房间
                    </>
                  )}
                </button>
              </div>
            )}

            {errorMessage && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center text-[11px] font-medium text-rose-600">
                {errorMessage}
              </div>
            )}
          </div>
        ) : (
          <div className="modal-body space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              <div>
                <span className="block text-[9px] uppercase tracking-[0.18em] text-stone-400">房间号</span>
                <span className="font-mono text-[26px] font-semibold tracking-[0.16em] text-stone-800">
                  {network.roomCode}
                </span>
              </div>
              <button onClick={handleCopyLink} className="btn-secondary h-9 px-3 text-[11px]">
                {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {isCopied ? '已复制' : '复制链接'}
              </button>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-stone-500">房间规则</span>
                <span className="flex items-center gap-1.5">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      { ok: 'bg-[var(--color-jade-500)]', warn: 'bg-amber-400', bad: 'bg-rose-500' }[statusTone(netStatus)] || 'bg-stone-400'
                    }`}
                  />
                  <span className="font-mono text-[9px] text-stone-400">{networkStatusText(netStatus)}</span>
                </span>
              </div>
              <div className="font-mono text-[10px] leading-relaxed text-stone-500">
                {describeRules(network.isHost ? (rules || {}) : (network.roomRules || rules || {}))}
              </div>
              <div className="mt-1 text-right text-[9px] text-stone-400">
                {network.isHost ? '你设定 · 开局后锁定' : '房主设定 · 开局后锁定'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {lobbySeats.map((seat) => {
                const isMe = seat.id === network.mySeatId;
                const wind = ['东', '南', '西', '北'][seat.id] || '东';
                return (
                  <div
                    key={seat.id}
                    className={`rounded-xl border p-2.5 ${
                      seat.isHuman ? 'border-[var(--color-jade-300)] bg-[var(--color-jade-200)]/15' : 'border-stone-200 bg-stone-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-medium text-stone-400">座位 {seat.id + 1} · {wind}</span>
                      {seat.isHost && (
                        <span className="flex items-center gap-0.5 rounded-full bg-stone-800 px-1.5 py-0.5 text-[8px] font-medium text-white">
                          <Shield className="h-2.5 w-2.5" /> 房主
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                        seat.isHuman ? 'bg-[var(--color-jade-600)] text-white' : 'bg-stone-200 text-stone-500'
                      }`}>
                        {seat.isHuman ? (seat.name[0] || '人') : <Bot className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 truncate text-[11px] font-semibold text-stone-700">
                          <span className="truncate">{seat.name}</span>
                          {isMe && <span className="text-[8px] text-[var(--color-jade-600)]">(我)</span>}
                        </div>
                        <div className="text-[9px] text-stone-400">
                          {seat.isHuman ? '真人已连入' : '电脑补位'}
                        </div>
                      </div>
                    </div>
                    {network.isHost && seat.id > 0 && seat.isHuman && (
                      <button
                        onClick={() => network.toggleSeatAI(seat.id)}
                        className="mt-1.5 text-[9px] text-stone-400 underline transition-colors hover:text-rose-500"
                      >
                        替换为电脑
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {network.isHost ? (
              <button onClick={handleStartGame} className="btn-primary h-11 w-full text-[13px]">
                <Play className="h-4 w-4 fill-current" />
                全员就绪 · 房主开局
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 rounded-full border border-stone-200 bg-stone-50 py-2.5 text-[11px] font-medium text-stone-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                已入座，等待房主开局
              </div>
            )}

            <button
              onClick={() => {
                network.cleanup();
                onLeaveRoom();
                setInLobby(false);
                setErrorMessage('');
              }}
              className="w-full py-1 text-center text-[10px] font-medium text-stone-400 transition-colors hover:text-rose-500"
            >
              退出当前房间
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
