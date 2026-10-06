// 房间端到端加密（P0-2/P0-3 的无服务端缓解方案）
//
// 背景：联机走**公共 MQTT broker**（broker.emqx.io / broker.hivemq.com）且主题是
// `csmj/v1/<房间号>/...` —— 任何人订阅 `csmj/v1/+/b` 就能读到全部载荷（审计已实测复现：
// 第三方可读到所有手牌）。在「不上服务端」的前提下，客户端能做的硬缓解是：
// **把密钥从房间号派生出来，所有载荷 AES-GCM 加密**——没有房间号的旁听者只能拿到密文。
//
// 说明（不夸大）：这挡的是「房间外的人」。房间内的玩家仍然互相可见房主下发的载荷，
// 要根治需要服务端按座位裁剪 + 座位令牌（见 docs/ROADMAP.md P0-2/P0-3，需另择宿主）。

const PBKDF2_ITERATIONS = 60000;
const SALT_PREFIX = 'csmj-v1|room|';
const ENVELOPE_VERSION = 1;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 房间号规范化（与 UI 一致：大写、去空白） */
export function normalizeRoomCode(roomCode) {
  return String(roomCode || '').toUpperCase().trim();
}

/**
 * 由房间号派生房间密钥（PBKDF2-SHA256 → AES-GCM 256）
 * @param {string} roomCode 房间号（≥6 位，房间号本身就是共享秘密）
 * @returns {Promise<CryptoKey>}
 */
export async function deriveRoomKey(roomCode) {
  const code = normalizeRoomCode(roomCode);
  if (code.length < 6) {
    throw new Error('房间号至少 6 位（旧版 4/5 位房间号已停用）');
  }
  const material = await crypto.subtle.importKey(
    'raw', encoder.encode(code), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SALT_PREFIX + code),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 加密任意 JSON 载荷 → 信封字符串 {v, iv, ct}
 * @param {CryptoKey} key
 * @param {object} obj
 * @returns {Promise<string>}
 */
export async function encryptJson(key, obj) {
  if (!key) throw new Error('encryptJson: 缺少房间密钥');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(obj))
  );
  return JSON.stringify({ v: ENVELOPE_VERSION, iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) });
}

/**
 * 解密信封；密钥不对 / 载荷被改动 / 不是本协议的信封 → 返回 null（调用方直接忽略该消息）
 * @param {CryptoKey} key
 * @param {string|Buffer|Uint8Array} payload
 * @returns {Promise<object|null>}
 */
export async function decryptJson(key, payload) {
  if (!key) return null;
  try {
    const text = typeof payload === 'string' ? payload : decoder.decode(payload);
    const env = JSON.parse(text);
    if (!env || env.v !== ENVELOPE_VERSION || typeof env.iv !== 'string' || typeof env.ct !== 'string') {
      return null;
    }
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(env.iv) }, key, fromBase64(env.ct)
    );
    return JSON.parse(decoder.decode(plain));
  } catch {
    return null;
  }
}

/** 判断一段载荷是否是本协议的信封（用于测试与排查） */
export function isEncryptedEnvelope(payload) {
  try {
    const text = typeof payload === 'string' ? payload : decoder.decode(payload);
    const env = JSON.parse(text);
    return !!env && env.v === ENVELOPE_VERSION && typeof env.ct === 'string';
  } catch {
    return false;
  }
}
