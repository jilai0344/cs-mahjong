// 基于 WebRTC / PeerJS 的无服务器、零成本多人实时联机管理器
import { Peer } from 'peerjs';

export const ROOM_PREFIX = 'csmj-v1-';

// 生成 4 位大写字母/数字房间号
export function generateRoomCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 国内高可用 STUN 服务器与国际 STUN 备选
export const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.qq.com:3478' },
  { urls: 'stun:stun.miwifi.com:3478' },
  { urls: 'stun:stun.chat.bilibili.com:3478' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

export class NetworkManager {
  constructor() {
    this.peer = null;
    this.isHost = false;
    this.roomCode = '';
    this.mySeatId = 0; // 0: 东, 1: 南, 2: 西, 3: 北
    this.playerName = '我';
    this.connections = new Map(); // seatId -> DataConnection
    this.hostConnection = null;   // for guests, connection to host
    this.onMessageCallback = null;
    this.onLobbyChangeCallback = null;
    this.onErrorCallback = null;

    // 房间座位状态
    this.seats = [
      { id: 0, name: '房主 (我)', isHost: true, isHuman: true, isConnected: true, isReady: true },
      { id: 1, name: '电脑 AI 1', isHost: false, isHuman: false, isConnected: true, isReady: true },
      { id: 2, name: '电脑 AI 2', isHost: false, isHuman: false, isConnected: true, isReady: true },
      { id: 3, name: '电脑 AI 3', isHost: false, isHuman: false, isConnected: true, isReady: true }
    ];
  }

  // 1. 房主创建房间
  createRoom(roomCode, hostName = '房主', onReady = null, onError = null) {
    this.cleanup();
    this.isHost = true;
    this.roomCode = roomCode.toUpperCase();
    this.playerName = hostName;
    this.mySeatId = 0;

    this.seats = [
      { id: 0, name: hostName, isHost: true, isHuman: true, isConnected: true, isReady: true },
      { id: 1, name: '电脑 AI 1', isHost: false, isHuman: false, isConnected: true, isReady: true },
      { id: 2, name: '电脑 AI 2', isHost: false, isHuman: false, isConnected: true, isReady: true },
      { id: 3, name: '电脑 AI 3', isHost: false, isHuman: false, isConnected: true, isReady: true }
    ];

    const peerId = `${ROOM_PREFIX}${this.roomCode}`;
    this.peer = new Peer(peerId, {
      debug: 1,
      config: {
        iceServers: DEFAULT_ICE_SERVERS
      }
    });

    this.peer.on('open', (id) => {
      console.log('Room created successfully with Peer ID:', id);
      if (onReady) onReady(this.roomCode);
    });

    this.peer.on('connection', (conn) => {
      this._handleIncomingConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('Peer error on host:', err);
      if (onError) onError(err);
      if (this.onErrorCallback) this.onErrorCallback(err.type || '连接错误');
    });
  }

  // 房主处理访客连入
  _handleIncomingConnection(conn) {
    conn.on('open', () => {
      // 监听新玩家加入请求
      conn.on('data', (data) => {
        if (data.type === 'JOIN_REQUEST') {
          // 寻找第一个空座位或把 AI 替换为真人玩家
          let assignSeat = -1;
          for (let i = 1; i < 4; i++) {
            if (!this.seats[i].isHuman || !this.seats[i].isConnected) {
              assignSeat = i;
              break;
            }
          }

          if (assignSeat === -1) {
            conn.send({ type: 'ROOM_FULL', message: '房间人数已满' });
            conn.close();
            return;
          }

          // 分配座位
          conn._seatId = assignSeat;
          this.connections.set(assignSeat, conn);
          this.seats[assignSeat] = {
            id: assignSeat,
            name: data.playerName || `玩家 ${assignSeat + 1}`,
            isHost: false,
            isHuman: true,
            isConnected: true,
            isReady: true
          };

          // 回复访客：加入成功与座位号
          conn.send({
            type: 'JOIN_SUCCESS',
            seatId: assignSeat,
            roomCode: this.roomCode,
            seats: this.seats
          });

          // 广播更新大厅状态
          this.broadcastLobbyState();
        } else {
          // 转发其它消息给业务逻辑
          if (this.onMessageCallback) {
            this.onMessageCallback(data, conn._seatId);
          }
        }
      });

      conn.on('close', () => {
        // 玩家掉线/退出，恢复为 AI
        const seatId = conn._seatId;
        if (seatId !== undefined && seatId > 0) {
          this.connections.delete(seatId);
          this.seats[seatId] = {
            id: seatId,
            name: `电脑 AI ${seatId}`,
            isHost: false,
            isHuman: false,
            isConnected: true,
            isReady: true
          };
          this.broadcastLobbyState();
        }
      });
    });
  }

  // 2. 访客加入房间
  joinRoom(roomCode, playerName = '玩家', onJoined = null, onError = null) {
    this.cleanup();
    this.isHost = false;
    this.roomCode = roomCode.toUpperCase();
    this.playerName = playerName;

    this.peer = new Peer({
      debug: 1,
      config: {
        iceServers: DEFAULT_ICE_SERVERS
      }
    });

    this.peer.on('open', () => {
      const targetHostId = `${ROOM_PREFIX}${this.roomCode}`;
      console.log('Connecting to host room:', targetHostId);

      const conn = this.peer.connect(targetHostId, { reliable: true });
      this.hostConnection = conn;

      conn.on('open', () => {
        // 发送加入请求
        conn.send({
          type: 'JOIN_REQUEST',
          playerName: this.playerName
        });
      });

      conn.on('data', (data) => {
        if (data.type === 'JOIN_SUCCESS') {
          this.mySeatId = data.seatId;
          this.seats = data.seats;
          if (onJoined) onJoined(data.seatId, data.seats);
          if (this.onLobbyChangeCallback) this.onLobbyChangeCallback(data.seats);
        } else if (data.type === 'ROOM_FULL') {
          if (onError) onError(new Error(data.message || '房间已满'));
        } else if (data.type === 'LOBBY_STATE') {
          this.seats = data.seats;
          if (this.onLobbyChangeCallback) this.onLobbyChangeCallback(data.seats);
        } else {
          // 转发游戏内事件
          if (this.onMessageCallback) {
            this.onMessageCallback(data, 0);
          }
        }
      });

      conn.on('error', (err) => {
        console.error('Connection error to host:', err);
        if (onError) onError(err);
      });

      conn.on('close', () => {
        if (this.onErrorCallback) this.onErrorCallback('与房主的连接已断开');
      });
    });

    this.peer.on('error', (err) => {
      console.error('Peer error on client:', err);
      if (onError) onError(err);
      if (this.onErrorCallback) this.onErrorCallback(err.type === 'peer-unavailable' ? '房间不存在或房主已离开' : '网络连接失败');
    });
  }

  // 房主广播大厅座位变化
  broadcastLobbyState() {
    if (!this.isHost) return;
    this.broadcast({
      type: 'LOBBY_STATE',
      seats: this.seats,
      roomCode: this.roomCode
    });
    if (this.onLobbyChangeCallback) {
      this.onLobbyChangeCallback(this.seats);
    }
  }

  // 房主踢人或切换某个座位为 AI
  toggleSeatAI(seatId) {
    if (!this.isHost || seatId === 0) return;

    if (this.seats[seatId].isHuman) {
      // 断开真人连接
      const conn = this.connections.get(seatId);
      if (conn) {
        conn.close();
        this.connections.delete(seatId);
      }
      this.seats[seatId] = {
        id: seatId,
        name: `电脑 AI ${seatId}`,
        isHost: false,
        isHuman: false,
        isConnected: true,
        isReady: true
      };
    }
    this.broadcastLobbyState();
  }

  // 房主向所有人广播数据 (可针对某座位单独发送私有手牌)
  broadcast(message) {
    if (this.isHost) {
      this.connections.forEach((conn) => {
        if (conn && conn.open) {
          conn.send(message);
        }
      });
    }
  }

  // 房主向特定座位发送消息 (例如只向该玩家发送其专属的暗手牌)
  sendToSeat(seatId, message) {
    if (this.isHost) {
      const conn = this.connections.get(seatId);
      if (conn && conn.open) {
        conn.send(message);
      }
    }
  }

  // 访客向房主发送动作指令
  sendToHost(message) {
    if (!this.isHost && this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({
        ...message,
        fromSeatId: this.mySeatId
      });
    }
  }

  // 注册全局事件监听器
  setOnMessage(cb) {
    this.onMessageCallback = cb;
  }

  setOnLobbyChange(cb) {
    this.onLobbyChangeCallback = cb;
  }

  setOnError(cb) {
    this.onErrorCallback = cb;
  }

  // 清理所有连接
  cleanup() {
    if (this.connections) {
      this.connections.forEach(conn => conn.close());
      this.connections.clear();
    }
    if (this.hostConnection) {
      this.hostConnection.close();
      this.hostConnection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.isHost = false;
    this.roomCode = '';
  }
}

export const network = new NetworkManager();
