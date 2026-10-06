// 联机邀请参数（纯函数，供 App / MultiplayerModal / 单测共用）
//
// 背景：公共 MQTT broker 有主/备两条通道（见 multiplayer.js 的 BROKER_URLS）。
// 两端各自「连不上就换通道」，于是会出现：房主在主通道、访客超时后落到备通道，
// 双方都在线却互相收不到消息 —— 界面永远停在「正在连接房主...」，没有任何错误提示。
// 整局冒烟实测踩到过：房主 emqx、访客 hivemq。
//
// 解决：邀请链接里带上房主所在的通道号，访客打开链接就直接连同一条通道。

/** URL 参数名 */
export const INVITE_PARAM_ROOM = 'room';
export const INVITE_PARAM_CHANNEL = 'b';

/**
 * 生成邀请链接（房主侧）
 * @param {{origin:string, pathname:string}} locationLike window.location 或其等价物
 * @param {string} roomCode
 * @param {number} channelIndex 房主当前所在通道下标（0 为主通道）
 * @param {number} totalChannels 通道总数，用于校验下标合法性
 * @returns {string}
 */
export function buildInviteUrl(locationLike, roomCode, channelIndex = 0, totalChannels = 2) {
  const origin = (locationLike && locationLike.origin) || '';
  const pathname = (locationLike && locationLike.pathname) || '/';
  const code = String(roomCode || '').toUpperCase().trim();
  const idx = normalizeChannelIndex(channelIndex, totalChannels);

  let url = `${origin}${pathname}?${INVITE_PARAM_ROOM}=${encodeURIComponent(code)}`;
  if (idx > 0) url += `&${INVITE_PARAM_CHANNEL}=${idx}`;
  return url;
}

/**
 * 解析邀请参数（访客侧）
 * @param {string} search 形如 '?room=ABC123&b=1'
 * @param {number} totalChannels
 * @returns {{roomCode:string|null, channelIndex:number}}
 */
export function parseInviteParams(search, totalChannels = 2) {
  const params = new URLSearchParams(search || '');
  const room = params.get(INVITE_PARAM_ROOM);
  const channel = params.get(INVITE_PARAM_CHANNEL);
  return {
    roomCode: room ? room.toUpperCase().trim() : null,
    channelIndex: normalizeChannelIndex(channel, totalChannels)
  };
}

/**
 * 通道下标规整：非法/缺省/越界一律回到 0（主通道）
 * @param {unknown} value
 * @param {number} totalChannels
 * @returns {number}
 */
export function normalizeChannelIndex(value, totalChannels = 2) {
  const total = Number.isInteger(totalChannels) && totalChannels > 0 ? totalChannels : 1;
  const n = typeof value === 'string' ? parseInt(value, 10) : Number(value);
  if (!Number.isInteger(n) || n < 0 || n >= total) return 0;
  return n;
}

/**
 * 换一条通道重试（环形）：房主无响应时，访客自动改连另一条通道再试一次
 * @param {number} channelIndex
 * @param {number} totalChannels
 * @returns {number}
 */
export function nextChannelOnRetry(channelIndex, totalChannels = 2) {
  const total = Number.isInteger(totalChannels) && totalChannels > 0 ? totalChannels : 1;
  const cur = normalizeChannelIndex(channelIndex, total);
  return (cur + 1) % total;
}
