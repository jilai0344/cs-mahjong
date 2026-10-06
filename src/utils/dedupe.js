// 消息去重（ROADMAP P0-4「幂等」）
//
// MQTT QoS 1 是「至少一次」投递：网络抖动/重连/重传时，同一条消息可能被投递两次。
// 旧实现直接处理每条入站消息，重复的 TILE_DISCARDED / MELD_BROADCAST 会造成重复打牌、
// 重复吃碰杠（表现为「牌莫名其妙少一张」）。这里提供有界的消息去重过滤器。
//
// 设计取舍：只保留最近 N 条 id（Map 保序，逐出最旧）。超过窗口的老消息可能被再次处理——
// 对局消息都是短时间内的实时事件，N=200 足够覆盖重传窗口；不做无限增长，避免长时间对局内存膨胀。

/**
 * @param {{limit?:number}} [options]
 * @returns {{accept:(id?:string, ts?:number)=>boolean, size:()=>number, has:(id:string)=>boolean}}
 */
export function createMessageFilter({ limit = 200 } = {}) {
  const seen = new Map();

  return {
    /** 首次见到该 id → true（应当处理）；重复 → false（丢弃）。没有 id 的消息一律放行（兼容旧载荷） */
    accept(id, ts = Date.now()) {
      if (!id || typeof id !== 'string') return true;
      if (seen.has(id)) return false;
      seen.set(id, ts);
      while (seen.size > limit) {
        const oldest = seen.keys().next().value;
        seen.delete(oldest);
      }
      return true;
    },
    size() {
      return seen.size;
    },
    has(id) {
      return seen.has(id);
    }
  };
}

let localSeq = 0;

/**
 * 生成进程内单调递增的消息 id（联机时前缀用连接标识，避免不同客户端撞号）
 * @param {string} prefix
 * @returns {string}
 */
export function nextMessageId(prefix = 'm') {
  localSeq += 1;
  return `${prefix}#${localSeq}`;
}

/**
 * 序号追踪的键 = 发送者 + 话题。
 *
 * 为什么必须带上话题：同一个发送者会往**多个话题**发消息（host 信箱 / 广播 / 各自座位信箱），
 * 客户端也是按多个订阅收的，broker **不保证跨话题的先后顺序**。若按「每发送者一个全局序号」判定，
 * 后收到的小序号会被误判成「过期消息」而丢掉（三真人冒烟实测到过一次：
 * 房主广播 seq=1 比座位信令 seq=2 晚到 → 广播被丢弃）。
 * 话题内 MQTT 保序，所以按「发送者+话题」计数既安全又能挡住重放/乱序。
 */
export function sequenceKey(senderId, topic) {
  if (!senderId) return null;
  return `${senderId}|${topic || ''}`;
}

/**
 * 每发送者的单调序号追踪（ROADMAP P0-4③：下行消息带单调递增 seq，重放/乱序自动丢弃）
 *
 * 与 msgId 去重的分工：
 *   · msgId 去重解决「同一条消息被投递多次」（QoS 1 至少一次 / 重传）；
 *   · seq 追踪解决「同一话题内消息乱序或旧消息迟到」（重连后的残留包、broker 重排），
 *     同一个 key（发送者+话题）的 seq 只接受**严格递增**的，比已见过的序号小或相等的直接丢弃。
 *     传 key 时请用 sequenceKey(senderId, topic)，别只传发送者。
 *
 * senderId 建议带上连接/会话标识（如 `host:ab12cd`）：客户端刷新后是新的会话，
 * 序号会从 1 重新开始，用不同 senderId 就不会被误判成「旧消息」。
 */
export function createSequenceTracker({ maxSenders = 16 } = {}) {
  const lastSeq = new Map(); // senderId -> 已见过的最大 seq

  return {
    /** @returns {boolean} true = 应当处理；false = 乱序/重放，丢弃 */
    accept(senderId, seq) {
      if (!senderId || !Number.isInteger(seq)) return true; // 没有序号字段的老载荷照常放行
      const prev = lastSeq.get(senderId);
      if (prev !== undefined && seq <= prev) return false;
      lastSeq.delete(senderId); // 重新插入以维持「最近活跃者在后」的顺序
      lastSeq.set(senderId, seq);
      while (lastSeq.size > maxSenders) {
        const oldest = lastSeq.keys().next().value;
        lastSeq.delete(oldest);
      }
      return true;
    },
    lastSeqOf(senderId) {
      return lastSeq.get(senderId);
    },
    size() {
      return lastSeq.size;
    }
  };
}

