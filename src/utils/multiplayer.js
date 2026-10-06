// 基于 MQTT over WebSocket 的超高可用、零配置多人实时联机管理器
// 适配国内移动网络 (4G/5G/Wi-Fi/跨运营商)，无需公网 IP 与穿透中继
import mqtt from 'mqtt';
import { deriveRoomKey, encryptJson, decryptJson } from './crypto.js';

export const ROOM_PREFIX = 'csmj-v1-';

// 国内高可用与海外双通道 WebSocket MQTT Broker 列表
export const BROKER_URLS = [
  'wss://broker.emqx.io:8084/mqtt',      // 杭州 EMQX 公共集群 (国内直连超低延迟，50-100ms)
  'wss://broker.hivemq.com:8884/mqtt',   // HiveMQ 国际高可用公共集群 (备选容灾通道)
];

// 生成 6 位房间号（P0-3 ②：旧版 4 位可被暴力枚举）
export function generateRoomCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export class NetworkManager {
  constructor() {
    this.client = null;
    this.isHost = false;
    this.roomCode = '';
    this.roomKey = null; // 房间密钥（由房间号派生，见 utils/crypto.js）
    this.mySeatId = 0; // 0: 东(房主), 1: 南, 2: 西, 3: 北
    this.playerName = '我';
    this.guestTempId = '';

    // 内部映射与心跳跟踪
    this.guestToSeat = new Map(); // guestTempId -> seatId
    this.seatToGuest = new Map(); // seatId -> guestTempId
    this.lastHeartbeat = [0, 0, 0, 0]; // 记录真人玩家最后活动时间戳

    this.joinTimeout = null;
    this.heartbeatTimer = null;
    this.presenceCheckTimer = null;

    // 回调函数
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

  // 辅助方法：生成 MQTT Topic
  _getTopic(sub) {
    return `csmj/v1/${this.roomCode}/${sub}`;
  }

  // 辅助方法：发布消息（一律加密后再上路，公共 broker 上只有密文）
  async _publish(topic, message, opts = { qos: 1 }) {
    if (!this.client || !this.client.connected) return;
    if (!this.roomKey) {
      console.warn('[CSMJ Network] 房间密钥未就绪，消息未发送');
      return;
    }
    try {
      const payload = await encryptJson(this.roomKey, message);
      this.client.publish(topic, payload, opts);
    } catch (e) {
      console.warn('[CSMJ Network] 加密发送失败:', e.message);
    }
  }

  // 辅助方法：解密入站载荷（密钥不对/被篡改/旧版明文 → null，直接忽略）
  async _parsePayload(payload) {
    const data = await decryptJson(this.roomKey, payload);
    if (!data) {
      console.warn('[CSMJ Network] 收到无法解密的消息（密钥不匹配或非本协议载荷），已忽略');
    }
    return data;
  }

  // 辅助方法：带自动故障转移的 MQTT 连接
  _connectWithFallback(brokerList, options, onConnected, onFailed) {
    let index = 0;

    const tryNext = () => {
      if (index >= brokerList.length) {
        if (onFailed) onFailed(new Error('无法连接到联机服务器，请检查网络设置'));
        return;
      }

      const brokerUrl = brokerList[index];
      console.log(`[CSMJ Network] 正在连接通信通道 (${index + 1}/${brokerList.length}):`, brokerUrl);

      let isConnected = false;
      const client = mqtt.connect(brokerUrl, {
        ...options,
        connectTimeout: 4000,
        reconnectPeriod: 3000,
        keepalive: 30,
        clean: true,
        clientId: 'csmj_' + Math.random().toString(36).substring(2, 10),
      });

      // 4.5秒未连上则尝试备选 broker
      const timeoutTimer = setTimeout(() => {
        if (!isConnected) {
          console.warn(`[CSMJ Network] 连接 ${brokerUrl} 超时，切换备用通道...`);
          try { client.end(true); } catch (_) {}
          index++;
          tryNext();
        }
      }, 4500);

      client.on('connect', () => {
        isConnected = true;
        clearTimeout(timeoutTimer);
        console.log(`[CSMJ Network] 成功接入联机通道: ${brokerUrl}`);
        onConnected(client);
      });

      client.on('error', (err) => {
        console.warn(`[CSMJ Network] 节点 ${brokerUrl} 异常:`, err.message);
        if (!isConnected) {
          clearTimeout(timeoutTimer);
          try { client.end(true); } catch (_) {}
          index++;
          tryNext();
        }
      });
    };

    tryNext();
  }

  // 1. 房主创建房间
  async createRoom(roomCode, hostName = '房主', onReady = null, onError = null) {
    this.cleanup();
    this.isHost = true;
    this.roomCode = roomCode.toUpperCase().trim();
    this.playerName = hostName;
    this.mySeatId = 0;

    // 房间密钥由房间号派生（P0-2 缓解）：此后所有载荷都是密文，公共 broker 上的旁听者读不到
    try {
      this.roomKey = await deriveRoomKey(this.roomCode);
    } catch (e) {
      if (onError) onError(e);
      if (this.onErrorCallback) this.onErrorCallback(e.message);
      return;
    }

    this.seats = [
      { id: 0, name: hostName, isHost: true, isHuman: true, isConnected: true, isReady: true },
      { id: 1, name: '电脑 AI 1', isHost: false, isHuman: false, isConnected: true, isReady: true },
      { id: 2, name: '电脑 AI 2', isHost: false, isHuman: false, isConnected: true, isReady: true },
      { id: 3, name: '电脑 AI 3', isHost: false, isHuman: false, isConnected: true, isReady: true }
    ];

    // 房主掉线时自动向广播频道发送房间解散遗嘱（同样加密）
    const willTopic = this._getTopic('b');
    const willPayload = await encryptJson(this.roomKey, { type: 'ROOM_CLOSED', message: '房主已断开连接，房间已解散' });

    this._connectWithFallback(
      BROKER_URLS,
      { will: { topic: willTopic, payload: willPayload, qos: 1, retain: false } },
      (client) => {
        this.client = client;

        // 订阅房主信箱
        const hostTopic = this._getTopic('host');
        client.subscribe(hostTopic, { qos: 1 }, (err) => {
          if (err) {
            console.error('[CSMJ Network] 订阅房主信箱失败:', err);
            if (onError) onError(err);
            return;
          }
          console.log('[CSMJ Network] 房主已就绪，房间号:', this.roomCode);
          if (onReady) onReady(this.roomCode);
        });

        // 监听来自访客的指令
        client.on('message', async (topic, payload) => {
          const data = await this._parsePayload(payload);
          if (!data) return;

          if (topic === hostTopic) {
            this._handleHostMessage(data);
          }
        });

        // 启动在线心跳看门狗：每 4 秒检查一次访客存活状态
        this.presenceCheckTimer = setInterval(() => {
          const now = Date.now();
          for (let i = 1; i < 4; i++) {
            if (this.seats[i].isHuman && this.lastHeartbeat[i] > 0) {
              if (now - this.lastHeartbeat[i] > 14000) {
                console.warn(`[CSMJ Network] 座位 ${i} (${this.seats[i].name}) 心跳超时，自动替补为电脑 AI`);
                this._revertSeatToAI(i);
              }
            }
          }
        }, 4000);
      },
      (err) => {
        if (onError) onError(err);
        if (this.onErrorCallback) this.onErrorCallback(err.message || '网络连接失败');
      }
    );
  }

  // 房主处理收到的信箱消息
  _handleHostMessage(data) {
    if (data.type === 'JOIN_REQUEST') {
      const guestId = data.guestTempId;
      if (!guestId) return;

      // 检查是否已有分配座位或寻找空位
      let assignSeat = this.guestToSeat.has(guestId) ? this.guestToSeat.get(guestId) : -1;
      if (assignSeat === undefined || assignSeat === -1) {
        for (let i = 1; i < 4; i++) {
          if (!this.seats[i].isHuman || !this.seats[i].isConnected) {
            assignSeat = i;
            break;
          }
        }
      }

      const guestRespTopic = this._getTopic(`guest/${guestId}`);

      if (assignSeat === -1) {
        // 房间已满
        void this._publish(guestRespTopic, {
          type: 'ROOM_FULL',
          message: '房间人数已满（最多4人）'
        });
        return;
      }

      // 分配座位
      this.guestToSeat.set(guestId, assignSeat);
      this.seatToGuest.set(assignSeat, guestId);
      this.lastHeartbeat[assignSeat] = Date.now();

      this.seats[assignSeat] = {
        id: assignSeat,
        name: data.playerName || `玩家 ${assignSeat + 1}`,
        isHost: false,
        isHuman: true,
        isConnected: true,
        isReady: true
      };

      // 回复该访客加入成功
      void this._publish(guestRespTopic, {
        type: 'JOIN_SUCCESS',
        seatId: assignSeat,
        roomCode: this.roomCode,
        seats: this.seats
      });

      // 广播更新大厅状态
      this.broadcastLobbyState();
    } else if (data.type === 'HEARTBEAT') {
      const s = data.fromSeatId;
      if (s >= 1 && s <= 3) {
        this.lastHeartbeat[s] = Date.now();
      }
    } else if (data.type === 'LEAVE') {
      const s = data.fromSeatId;
      if (s >= 1 && s <= 3) {
        this._revertSeatToAI(s);
      }
    } else {
      // 业务游戏指令 (DISCARD_ACTION, RESPOND_ACTION, ACK_STARTING_HU 等)
      const s = data.fromSeatId;
      if (s >= 1 && s <= 3) {
        this.lastHeartbeat[s] = Date.now();
      }
      if (this.onMessageCallback) {
        this.onMessageCallback(data, data.fromSeatId);
      }
    }
  }

  // 2. 访客加入房间
  async joinRoom(roomCode, playerName = '玩家', onJoined = null, onError = null) {
    this.cleanup();
    this.isHost = false;
    this.roomCode = roomCode.toUpperCase().trim();
    this.playerName = playerName;
    this.guestTempId = 'g_' + Math.random().toString(36).substring(2, 9);

    // 与房主同一房间号 → 同一把密钥（P0-2 缓解：载荷在公共 broker 上只以密文出现）
    try {
      this.roomKey = await deriveRoomKey(this.roomCode);
    } catch (e) {
      if (onError) onError(e);
      if (this.onErrorCallback) this.onErrorCallback(e.message);
      return;
    }

    let hasJoined = false;

    this._connectWithFallback(
      BROKER_URLS,
      {},
      (client) => {
        this.client = client;

        const broadcastTopic = this._getTopic('b');
        const guestRespTopic = this._getTopic(`guest/${this.guestTempId}`);
        const hostTopic = this._getTopic('host');

        // 订阅广播频道与自己的临时应答频道
        client.subscribe([broadcastTopic, guestRespTopic], { qos: 1 }, (err) => {
          if (err) {
            console.error('[CSMJ Network] 订阅频道失败:', err);
            if (onError) onError(err);
            return;
          }

          // 向房主发送加入请求
          void this._publish(hostTopic, {
            type: 'JOIN_REQUEST',
            guestTempId: this.guestTempId,
            playerName: this.playerName
          });

          // 启动 6 秒等待应答超时
          this.joinTimeout = setTimeout(() => {
            if (!hasJoined) {
              const err = new Error('未找到该房间或房主未在线，请检查房间号');
              if (onError) onError(err);
              if (this.onErrorCallback) this.onErrorCallback(err.message);
              this.cleanup();
            }
          }, 6000);
        });

        // 监听房主发来的消息
        client.on('message', async (topic, payload) => {
          const data = await this._parsePayload(payload);
          if (!data) return;

          if (topic === guestRespTopic) {
            if (data.type === 'JOIN_SUCCESS') {
              hasJoined = true;
              if (this.joinTimeout) {
                clearTimeout(this.joinTimeout);
                this.joinTimeout = null;
              }

              this.mySeatId = data.seatId;
              this.seats = data.seats;

              // 订阅属于自己的私密手牌/出牌指令信箱
              const seatTopic = this._getTopic(`seat/${this.mySeatId}`);
              client.unsubscribe(guestRespTopic);
              client.subscribe(seatTopic, { qos: 1 }, (subErr) => {
                if (subErr) {
                  console.warn('[CSMJ Network] 订阅私有信箱警告:', subErr);
                }

                // 启动心跳包：每 3 秒向房主发送一次心跳维持在线
                this.heartbeatTimer = setInterval(() => {
                  this.sendToHost({ type: 'HEARTBEAT' });
                }, 3000);

                if (onJoined) onJoined(data.seatId, data.seats);
                if (this.onLobbyChangeCallback) this.onLobbyChangeCallback(data.seats);
              });
            } else if (data.type === 'ROOM_FULL') {
              if (this.joinTimeout) clearTimeout(this.joinTimeout);
              if (onError) onError(new Error(data.message || '房间已满'));
              if (this.onErrorCallback) this.onErrorCallback(data.message || '房间已满');
              this.cleanup();
            }
          } else if (topic === broadcastTopic || topic === this._getTopic(`seat/${this.mySeatId}`)) {
            if (data.type === 'LOBBY_STATE') {
              this.seats = data.seats;
              if (this.onLobbyChangeCallback) this.onLobbyChangeCallback(data.seats);
            } else if (data.type === 'ROOM_CLOSED') {
              if (this.onErrorCallback) this.onErrorCallback(data.message || '房主已解散房间');
              this.cleanup();
            } else if (data.type === 'KICKED') {
              if (this.onErrorCallback) this.onErrorCallback('您已被房主移出房间');
              this.cleanup();
            } else {
              // 业务游戏事件分发
              if (this.onMessageCallback) {
                this.onMessageCallback(data, 0);
              }
            }
          }
        });
      },
      (err) => {
        if (onError) onError(err);
        if (this.onErrorCallback) this.onErrorCallback(err.message || '连接服务器失败');
      }
    );
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

  // 房主将某座位玩家替换为电脑 AI
  toggleSeatAI(seatId) {
    if (!this.isHost || seatId === 0) return;
    this.sendToSeat(seatId, { type: 'KICKED' });
    this._revertSeatToAI(seatId);
  }

  _revertSeatToAI(seatId) {
    const guestId = this.seatToGuest.get(seatId);
    if (guestId) {
      this.guestToSeat.delete(guestId);
      this.seatToGuest.delete(seatId);
    }
    this.lastHeartbeat[seatId] = 0;
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

  // 房主向所有人广播数据 (例如开始游戏、打出牌、碰杠通知)
  broadcast(message) {
    if (this.isHost && this.client && this.client.connected) {
      void this._publish(this._getTopic('b'), message);
    }
  }

  // 房主向特定座位发送私密消息 (例如发专属暗手牌、摸牌通知)
  sendToSeat(seatId, message) {
    if (this.isHost && this.client && this.client.connected) {
      void this._publish(this._getTopic(`seat/${seatId}`), message);
    }
  }

  // 访客向房主发送动作指令 (打牌、碰杠胡确认、心跳)
  sendToHost(message) {
    if (!this.isHost && this.client && this.client.connected) {
      void this._publish(this._getTopic('host'), {
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

  // 清理所有连接与定时器
  cleanup() {
    if (this.joinTimeout) {
      clearTimeout(this.joinTimeout);
      this.joinTimeout = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.presenceCheckTimer) {
      clearInterval(this.presenceCheckTimer);
      this.presenceCheckTimer = null;
    }

    if (this.client) {
      try {
        if (this.isHost && this.roomCode && this.client.connected) {
          void this._publish(this._getTopic('b'), { type: 'ROOM_CLOSED', message: '房主已解散房间' });
        } else if (!this.isHost && this.roomCode && this.client.connected) {
          void this._publish(this._getTopic('host'), { type: 'LEAVE', fromSeatId: this.mySeatId });
        }
        this.client.end(true);
      } catch (_) {}
      this.client = null;
    }

    this.guestToSeat.clear();
    this.seatToGuest.clear();
    this.lastHeartbeat = [0, 0, 0, 0];
    this.isHost = false;
    this.roomCode = '';
    this.roomKey = null;
  }
}

export const network = new NetworkManager();
