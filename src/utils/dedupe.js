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
