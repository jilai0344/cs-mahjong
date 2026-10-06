import React, { useState, useEffect } from 'react';
import { X, Users, Copy, Check, Play, UserPlus, Bot, Shield, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { generateRoomCode, network, BROKER_URLS } from '../utils/multiplayer.js';
import { buildInviteUrl, parseInviteParams } from '../utils/invite.js';
import { useModalA11y } from '../hooks/useModalA11y.js';

export default function MultiplayerModal({
  isOpen,
  onClose,
  onStartMultiplayerGame, // (roomConfig) => void
  currentRoom = null // { inRoom: boolean, isHost: boolean, roomCode: string, mySeatId: number, seats: [] }
}) {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'join'
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('cs_player_name') || '长沙麻雀王');
  const [generatedCode, setGeneratedCode] = useState(() => generateRoomCode());
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  // 邀请链接解析结果（房间号 + 房主所在通道），见 utils/invite.js
  const [inviteParams, setInviteParams] = useState({ roomCode: null, channelIndex: 0 });

  // 房间大厅座位
  const [lobbySeats, setLobbySeats] = useState(network.seats);
  const [inLobby, setInLobby] = useState(false);

  // 自动从 URL 参数读取 ?room=XXXX&b=N（b = 房主所在的联机通道，见 utils/invite.js）
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
    network.setOnLobbyChange((updatedSeats) => {
      setLobbySeats([...updatedSeats]);
    });
    network.setOnError((errText) => {
      setErrorMessage(errText);
      setIsConnecting(false);
    });
  }, []);

  // 弹窗无障碍（P2-6）：Esc 关闭 + role/aria + 焦点循环。必须放在提前 return 之前。
  const modalA11y = useModalA11y(onClose);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    const code = network.roomCode || generatedCode;
    // 链接里带上房主实际所在的通道（否则访客可能连到另一条 broker，双方永远碰不上）
    const url = buildInviteUrl(window.location, code, network.channelIndex || 0, BROKER_URLS.length);
    navigator.clipboard.writeText(url).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  // 1. 点击创建房间
  const handleCreateRoom = () => {
    setIsConnecting(true);
    setErrorMessage('');
    localStorage.setItem('cs_player_name', playerName);

    network.createRoom(
      generatedCode,
      playerName,
      (code) => {
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

  // 2. 点击加入房间
  const handleJoinRoom = () => {
    if (!roomCodeInput.trim()) {
      setErrorMessage('请输入 6 位房间号');
      return;
    }

    setIsConnecting(true);
    setErrorMessage('');
    localStorage.setItem('cs_player_name', playerName);

    // 从邀请链接进来、且房间号没被改成别的房间时，直接连同房主那条通道
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

  // 房主开始对战
  const handleStartGame = () => {
    if (network.isHost) {
      network.broadcast({
        type: 'GAME_STARTED',
        seats: network.seats
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
    <div {...modalA11y} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg rounded-2xl bg-gradient-to-b from-slate-900 via-emerald-950/90 to-slate-900 border-2 border-emerald-500/40 p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between pb-4 border-b border-emerald-500/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md">
              <Users className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-wide">
                长沙麻将 · 多人实时联机
              </h2>
              <p className="text-[11px] text-emerald-300/70">
                全国极速通道 · 免服务器秒连 · 手机电脑好友一键加入
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 模式切换 (仅在未进入大厅时显示) */}
        {!inLobby ? (
          <div className="mt-4 space-y-4">
            {/* 标签栏 */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-black/40 border border-emerald-500/20">
              <button
                type="button"
                onClick={() => { setActiveTab('create'); setErrorMessage(''); }}
                className={`py-2 rounded-lg font-bold text-xs transition-all ${
                  activeTab === 'create'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                创建好友房 (我是房主)
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('join'); setErrorMessage(''); }}
                className={`py-2 rounded-lg font-bold text-xs transition-all ${
                  activeTab === 'join'
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                加入房间 (输入房间号)
              </button>
            </div>

            {/* 玩家昵称输入 */}
            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-emerald-500/20">
              <label className="block text-xs font-bold text-emerald-300 mb-1.5">
                我的对局昵称
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={10}
                placeholder="输入你的游戏昵称"
                className="w-full px-3 py-2 rounded-lg bg-black/50 border border-emerald-500/30 text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {/* TAB 1: 创建房间 */}
            {activeTab === 'create' && (
              <div className="p-4 rounded-xl bg-slate-800/40 border border-emerald-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300 font-semibold">即将生成的房间号：</span>
                  <button
                    onClick={() => setGeneratedCode(generateRoomCode())}
                    className="flex items-center gap-1 text-[11px] text-emerald-300 hover:text-emerald-100"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>更换房间号</span>
                  </button>
                </div>

                <div className="flex items-center justify-center p-3 rounded-xl bg-black/60 border border-amber-400/40">
                  <span className="text-3xl font-black font-mono tracking-widest text-amber-300 drop-shadow">
                    {generatedCode}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                  创建后即可把房间链接或房间号发给好友，朋友打开链接即可自动进入房间！
                </p>

                <button
                  onClick={handleCreateRoom}
                  disabled={isConnecting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>正在启动房间频道...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>立即创建房间</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* TAB 2: 加入房间 */}
            {activeTab === 'join' && (
              <div className="p-4 rounded-xl bg-slate-800/40 border border-emerald-500/20 space-y-3">
                <label className="block text-xs font-bold text-teal-300">
                  输入 6 位房间号
                </label>
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="例如：A7XK29"
                  className="w-full px-4 py-3 rounded-xl bg-black/60 border-2 border-teal-500/40 text-center font-mono font-black text-2xl tracking-widest text-amber-300 focus:outline-hidden focus:border-teal-400"
                />

                <button
                  onClick={handleJoinRoom}
                  disabled={isConnecting || !roomCodeInput.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-sm shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>正在连接房主...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>进入房间</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* 错误提示 */}
            {errorMessage && (
              <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-500/40 text-red-200 text-xs text-center font-bold">
                {errorMessage}
              </div>
            )}
          </div>
        ) : (
          /* 已在房间大厅：展示 4 人座位席与就绪状态 */
          <div className="mt-4 space-y-4">
            {/* 房间号与复制分享链接 */}
            <div className="p-4 rounded-2xl bg-black/50 border border-amber-400/40 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block">房间邀请号</span>
                <span className="text-3xl font-black font-mono tracking-widest text-amber-300">
                  {network.roomCode}
                </span>
              </div>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all active:scale-95"
              >
                {isCopied ? <Check className="w-4 h-4 text-amber-300" /> : <Copy className="w-4 h-4" />}
                <span>{isCopied ? '已复制链接' : '复制房间链接'}</span>
              </button>
            </div>

            <p className="text-[11px] text-emerald-300/80 text-center">
              复制链接直接发微信/QQ好友，好友在浏览器中打开即可自动进入本房间！
            </p>

            {/* 4 个座位席位卡片 */}
            <div className="grid grid-cols-2 gap-2.5">
              {lobbySeats.map((seat) => {
                const isMe = seat.id === network.mySeatId;

                return (
                  <div
                    key={seat.id}
                    className={`p-3 rounded-xl border flex flex-col justify-between ${
                      seat.isHuman
                        ? 'bg-emerald-950/60 border-emerald-400/50 shadow-md'
                        : 'bg-slate-800/40 border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-emerald-300 font-mono">
                        座位 {seat.id + 1} ({seat.id === 0 ? '东家' : seat.id === 1 ? '南家' : seat.id === 2 ? '西家' : '北家'})
                      </span>
                      {seat.isHost && (
                        <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                          <Shield className="w-2.5 h-2.5" /> 房主
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 my-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                        seat.isHuman ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {seat.isHuman ? (seat.name[0] || '人') : <Bot className="w-4 h-4" />}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                          <span>{seat.name}</span>
                          {isMe && <span className="text-[9px] text-amber-300">(我)</span>}
                        </div>
                        <div className="text-[10px] text-emerald-300/70">
                          {seat.isHuman ? '真人已连入' : '智能电脑补位'}
                        </div>
                      </div>
                    </div>

                    {/* 房主可以切换空座位的 AI 状态 */}
                    {network.isHost && seat.id > 0 && seat.isHuman && (
                      <button
                        onClick={() => network.toggleSeatAI(seat.id)}
                        className="mt-2 text-[10px] text-red-300 hover:text-red-100 underline text-left"
                      >
                        替换为电脑 AI
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 房主控制开始 */}
            {network.isHost ? (
              <button
                onClick={handleStartGame}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-base shadow-2xl flex items-center justify-center gap-2 transition-transform hover:scale-102 active:scale-95 animate-pulse"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>全员就绪 · 房主开局</span>
              </button>
            ) : (
              <div className="p-3.5 rounded-xl bg-black/40 border border-emerald-500/20 text-center text-xs text-amber-200 flex items-center justify-center gap-2 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>已进入房间，等待房主点击开始游戏...</span>
              </div>
            )}

            {/* 退出房间按钮 */}
            <button
              onClick={() => {
                network.cleanup();
                setInLobby(false);
                setErrorMessage('');
              }}
              className="w-full py-2 text-xs font-bold text-slate-400 hover:text-red-300 transition-colors text-center"
            >
              退出当前房间
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
