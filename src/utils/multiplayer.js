// 基于 MQTT over WebSocket 的超高可用、零配置多人实时联机管理器
// 适配国内移动网络 (4G/5G/Wi-Fi/跨运营商)，无需公网 IP 与穿透中继
import mqtt from 'mqtt';
import { deriveRoomKey, encryptJson, decryptJson } from './crypto.js';
import { createMessageFilter, nextMessageId } from './dedupe.js';
import { nextChannelOnRetry } from './invite.js';

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
    // 幂等与重连（P0-4）
    this.connId = 'c' + Math.random().toString(36).slice(2, 8); // 本连接的 id 前缀，避免与他端撞号
    this.inboundFilter = createMessageFilter();
    this.joined = false;   // 访客是否已成功落座
    this.reconnecting = false;
    this.channelIndex = 0; // 本端实际所在的通信通道下标（0=主通道，1=备用通道）
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

  // 辅助方法：给消息打上唯一 id 与时间戳（用于接收端幂等去重）
  _stamp(message) {
    return { ...message, msgId: nextMessageId(this.connId), ts: Date.now() };
  }

  // 辅助方法：发布消息（一律加密后再上路，公共 broker 上只有密文）
  async _publish(topic, message, opts = { qos: 1 }) {
    // 注意：await 期间 this.client 可能被 cleanup()/换通道重连清空（整局冒烟实测验到过
    // "Cannot read properties of null (reading 'publish')"）→ 先抓住本次要用的 client 引用。
    const client = this.client;
    if (!client || !client.connected) return;
    if (!this.roomKey) {
      console.warn('[CSMJ Network] 房间密钥未就绪，消息未发送');
      return;
    }
    try {
      const payload = await encryptJson(this.roomKey, this._stamp(message));
      client.publish(topic, payload, opts);
    } catch (e) {
      console.warn('[CSMJ Network] 加密发送失败:', e.message);
    }
  }

  // 辅助方法：解密入站载荷（密钥不对/被篡改/旧版明文 → null，直接忽略）
  async _parsePayload(payload) {
    const data = await decryptJson(this.roomKey, payload);
    if (!data) {
      console.warn('[CSMJ Network] 收到无法解密的消息（密钥不匹配或非本协议载荷），已忽略');
      return null;
    }
    // 幂等：QoS 1 是「至少一次」，重传/重连会让同一条消息到达多次 → 只处理第一次
    if (!this.inboundFilter.accept(data.msgId, data.ts)) {
      console.warn('[CSMJ Network] 重复消息已丢弃:', data.msgId);
      return null;
    }
    return data;
  }

  // 辅助方法：带自动故障转移的 MQTT 连接
  // startIndex：从哪条通道开始试（邀请链接会把房主所在通道带过来，见 utils/invite.js）
  _connectWithFallback(brokerList, options, onConnected, onFailed, startIndex = null) {
    const total = brokerList.length;
    const requested = startIndex === null ? (this._pendingStartChannel || 0) : startIndex;
    const start = ((Number(requested) || 0) % total + total) % total;
    // 换通道重试时只连目标通道：绕回原通道会造成「换回去又失败」的来回横跳（冒烟实测）
    const candidates = this._pendingChannelOnly
      ? brokerList.slice(start, start + 1)
      : [...brokerList.slice(start), ...brokerList.slice(0, start)];
    let index = 0;

    const tryNext = () => {
      if (index >= candidates.length) {
        if (onFailed) onFailed(new Error('无法连接到联机服务器，请检查网络设置'));
        return;
      }

      const brokerUrl = candidates[index];
      const channelIndex = this._pendingChannelOnly ? start : (start + index) % total;
      console.log(`[CSMJ Network] 正在连接通信通道 (${channelIndex + 1}/${total}):`, brokerUrl);

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
        this.channelIndex = channelIndex; // 记录本端实际所在通道（邀请链接要带上它）
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
  // opts.channelIndex：优先尝试的通道（一般不用传，房主从主通道开始试）
  async createRoom(roomCode, hostName = '房主', onReady = null, onError = null, opts = {}) {
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
    // 想从哪条通道开始（邀请链接会带过来；房主一般从主通道开始）
    this._pendingStartChannel = Number.isInteger(opts.channelIndex) ? opts.channelIndex : 0;
    this._pendingChannelOnly = false; // 房主建房不走「只连一条通道」的重试模式

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

        // 断线重连（P0-4）：clean session 会丢掉订阅，重连后必须补订阅，否则静默失聪
        client.on('connect', () => {
          if (!this.isHost || !this.roomCode) return;
          client.subscribe(this._getTopic('host'), { qos: 1 }, () => {
            console.log('[CSMJ Network] 房主重连完成，已恢复订阅并重新广播大厅状态');
            this.broadcastLobbyState();
          });
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
    } else if (data.type === 'RECONNECT') {
      // 掉线玩家重连：优先恢复原座位（可能刚被心跳看门狗降级成 AI）
      const guestId = data.guestTempId || this.seatToGuest.get(data.seatId ?? data.fromSeatId);
      const seat = data.seatId ?? data.fromSeatId;
      if (!guestId || !(seat >= 1 && seat <= 3)) return;

      const knownSeat = this.guestToSeat.get(guestId);
      const seatTaken = this.seats[seat].isHuman && this.seats[seat].isConnected && knownSeat !== seat;
      if (seatTaken) {
        void this._publish(this._getTopic(`guest/${guestId}`), {
          type: 'ROOM_FULL',
          message: '原座位已被其他玩家占用，请重新加入房间'
        });
        return;
      }

      this.guestToSeat.set(guestId, seat);
      this.seatToGuest.set(seat, guestId);
      this.lastHeartbeat[seat] = Date.now();
      this.seats[seat] = {
        id: seat,
        name: data.playerName || this.seats[seat].name,
        isHost: false,
        isHuman: true,
        isConnected: true,
        isReady: true
      };
      console.log(`[CSMJ Network] 座位 ${seat} 已由掉线玩家恢复`);
      this.broadcastLobbyState();
      void this._publish(this._getTopic(`guest/${guestId}`), {
        type: 'JOIN_SUCCESS',
        seatId: seat,
        roomCode: this.roomCode,
        seats: this.seats,
        resumed: true
      });
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
  // opts.channelIndex：优先尝试的通道（来自邀请链接的 &b=，见 utils/invite.js）
  // opts.allowChannelRetry：房主无响应时是否允许自动换到另一条通道再试一次（默认允许，只重试一次）
  async joinRoom(roomCode, playerName = '玩家', onJoined = null, onError = null, opts = {}) {
    const startChannel = Number.isInteger(opts.channelIndex) ? opts.channelIndex : 0;
    const allowChannelRetry = opts.allowChannelRetry !== false;
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
    // 优先尝试的通道（邀请链接 &b= 指定；缺省主通道）
    this._pendingStartChannel = startChannel;
    // channelOnly：只连这一条通道（换通道重试用），失败就直接报错，不再来回切换
    this._pendingChannelOnly = opts.channelOnly === true;

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
            if (hasJoined) return;

            // 两端可能落在不同通道（公共 broker 有主/备两条）：房主在主通道、访客超时落到备用通道，
            // 双方都在线却永远收不到对方 —— 界面卡在「正在连接房主...」。这里自动换到另一条通道再试一次。
            if (allowChannelRetry) {
              const altChannel = nextChannelOnRetry(this.channelIndex, BROKER_URLS.length);
              console.warn(`[CSMJ Network] 房主无响应，换通道 ${this.channelIndex + 1} → ${altChannel + 1} 重试加入`);
              this.joinRoom(this.roomCode, this.playerName, onJoined, onError, {
                channelIndex: altChannel,
                allowChannelRetry: false,
                channelOnly: true
              });
              return;
            }

            const err = new Error('未找到该房间或房主未在线，请检查房间号，或让房主发邀请链接');
            if (onError) onError(err);
            if (this.onErrorCallback) this.onErrorCallback(err.message);
            this.cleanup();
          }, 6000);
        });

        // 断线重连（P0-4）：clean session 会丢掉订阅 → 补订阅；已落座的访客同时申请抢回原座位
        client.on('connect', () => {
          if (this.isHost || !this.roomCode) return;
          if (hasJoined && this.mySeatId >= 1) {
            client.subscribe(
              [broadcastTopic, guestRespTopic, this._getTopic(`seat/${this.mySeatId}`)],
              { qos: 1 },
              () => {
                console.log('[CSMJ Network] 访客重连完成，申请恢复原座位', this.mySeatId);
                this.sendToHost({ type: 'RECONNECT', playerName: this.playerName });
              }
            );
          } else {
            client.subscribe([broadcastTopic, guestRespTopic], { qos: 1 }, () => {
              console.log('[CSMJ Network] 访客重连完成，重新发起加入请求');
              void this._publish(hostTopic, {
                type: 'JOIN_REQUEST',
                guestTempId: this.guestTempId,
                playerName: this.playerName
              });
            });
          }
        });

        // 监听房主发来的消息
        client.on('message', async (topic, payload) => {
          const data = await this._parsePayload(payload);
          if (!data) return;

          if (topic === guestRespTopic) {
            if (data.type === 'JOIN_SUCCESS') {
              hasJoined = true;
              this.joined = true;
              if (this.joinTimeout) {
                clearTimeout(this.joinTimeout);
                this.joinTimeout = null;
              }
              // 重连恢复时不要重复启动心跳计时器（否则越连越多）
              if (this.heartbeatTimer) {
                clearInterval(this.heartbeatTimer);
                this.heartbeatTimer = null;
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

  // 把座位降级为电脑 AI（心跳超时 / 房主看门狗托管）。对外公开，便于 App 侧超时接管。
  revertSeatToAI(seatId) {
    if (!this.isHost || !(seatId >= 1 && seatId <= 3)) return;
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
    // 掉线托管（P0-4）：座位降级为 AI 只改了大厅状态，若此刻正轮到该座位出牌，牌局会永久卡住。
    // 通知 App 层接管这一手（App 侧只在 PLAYING 且 currentTurn === seatId 时触发 AI 出牌）。
    try {
      this.onSeatRevertedToAI?.(seatId);
    } catch {
      // 托管回调失败不应影响网络层
    }
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
