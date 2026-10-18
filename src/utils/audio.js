// 牌桌声音：优先播放从本地《3D黄金岛》提取的真人长沙话与实体牌音，
// 文件缺失或被浏览器拦截时，回退到 Web Audio 合成音，保证离线也有反馈。

const BASE = import.meta.env?.BASE_URL || '/';

function assetUrl(path) {
  return `${BASE}${path}`.replace(/([^:/])\/{2,}/g, '$1/');
}

const SUIT_NAMES = { wan: '万', tiao: '条', tong: '筒' };

const FAN_VOICE = {
  清一色: 'qingyise',
  碰碰胡: 'pengpenghu',
  将将胡: 'jiangjianghu',
  七小对: 'qixiaodui',
  豪华七巧对: 'haohuaqiqiaodui',
  超豪华七巧对: 'chaohaohuaqiqiaodui',
  杠上开花: 'gangshangkaihua',
  杠上炮: 'gangshangpao',
  海底捞月: 'haidilaoyue',
  全求人: 'quanqiuren',
  板板胡: 'banbanhu',
  缺一色: 'queyise',
  六六顺: 'liuliushun',
  四喜: 'sixi',
  天胡: 'tianhu',
  地胡: 'dihu',
  黄庄: 'huang',
  黄牌: 'huang'
};

// 顺口溜：只在特定牌张、且带一点概率时播放，避免每张牌都在说话
const DISCARD_LINES = {
  'wan-4': 'line-siwansong',
  'wan-2': 'line-chugeliangwan',
  'tiao-6': 'line-chugeliutiao',
  'wan-9': 'line-jiuwan',
  'tong-8': 'line-batong',
  'wan-5': 'line-wuwan'
};

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.voice = 'f'; // 'f' | 'm' | 'off'
    this.voiceLast = 0;
    this.voiceAudio = null;
    this.cache = new Map();
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVoice(voice) {
    this.voice = ['f', 'm', 'off'].includes(voice) ? voice : 'f';
  }

  _audio(path) {
    const url = assetUrl(path);
    let audio = this.cache.get(url);
    if (!audio) {
      audio = new Audio(url);
      audio.preload = 'auto';
      audio.volume = 0.7;
      this.cache.set(url, audio);
    }
    return audio;
  }

  _playSfx(name, volume = 0.65) {
    if (!this.enabled) return false;
    try {
      const audio = this._audio(`audio/hjd/sfx/${name}.wav`);
      const node = audio.cloneNode();
      node.volume = volume;
      const p = node.play();
      if (p && p.catch) p.catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  _playVoice(key, { volume = 0.9, minGap = 0, force = false } = {}) {
    if (!this.enabled || this.voice === 'off' || !key) return false;
    const now = Date.now();
    if (!force && minGap && now - this.voiceLast < minGap) return false;
    try {
      const audio = this._audio(`audio/hjd/voice/${this.voice}/${key}.wav`);
      if (this.voiceAudio && this.voiceAudio !== audio) {
        this.voiceAudio.pause();
        this.voiceAudio.currentTime = 0;
      }
      this.voiceAudio = audio;
      audio.currentTime = 0;
      audio.volume = volume;
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
      this.voiceLast = now;
      return true;
    } catch {
      return false;
    }
  }

  // 对手摸牌：很轻的一声，给牌局节奏
  playDraw() {
    this._playSfx('soft-click', 0.16);
  }

  // 摸牌 / 选牌：轻触
  playTileTouch() {    if (!this.enabled) return;
    if (this._playSfx('soft-click', 0.28)) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.04);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  // 出牌：实体牌落桌 + 真人报牌（可关）
  playDiscard(tile = null) {
    if (!this.enabled) return;
    this.init();
    if (!this._playSfx('discard-hit', 0.55)) this._synthDiscard();

    if (!tile || this.voice === 'off') return;
    const key = `${tile.suit}-${tile.value}`;
    const line = DISCARD_LINES[key];
    const useLine = line && Math.random() < 0.18;
    this._playVoice(useLine ? line : key, { volume: 0.82, minGap: 650 });
  }

  _synthDiscard() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(800, now);
    osc1.frequency.exponentialRampToValueAtTime(220, now + 0.08);
    gain1.gain.setValueAtTime(0.32, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.08);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1400, now + 0.02);
    osc2.frequency.exponentialRampToValueAtTime(500, now + 0.07);
    gain2.gain.setValueAtTime(0.18, now + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now + 0.02);
    osc2.stop(now + 0.07);
  }

  // 吃 / 碰 / 杠
  playMeld(type = 'peng') {
    if (!this.enabled) return;
    this.init();
    const voiceKey = type === 'gang' ? 'gang' : type === 'chi' ? 'chi' : 'peng';
    const played = this._playSfx('claim', 0.6);
    if (!played) this._synthMeld(type);

    if (type === 'chi' && Math.random() < 0.22) {
      this._playVoice('line-mojiang', { volume: 0.86 });
    } else {
      this._playVoice(voiceKey, { volume: 0.9, minGap: 250 });
    }
  }

  _synthMeld(type) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const baseFreq = type === 'gang' ? 520 : type === 'chi' ? 440 : 480;
    [baseFreq, baseFreq * 1.25].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.03);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.15);
      gain.gain.setValueAtTime(0.24, now + idx * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.03);
      osc.stop(now + 0.6);
    });
  }

  playStartingHu(huTypes = []) {
    if (!this.enabled) return;
    this.init();
    if (!this._playSfx('starting-hu', 0.7)) {
      this._synthChord([523.25, 659.25, 783.99]);
    }
    const type = Array.isArray(huTypes) ? huTypes[0] : huTypes;
    if (type && this.voice !== 'off') this.announceFan(type);
  }

  playHu({ zimo = false, huTypes = [] } = {}) {
    if (!this.enabled) return;
    this.init();
    if (!this._playSfx('hu', 0.75)) {
      this._synthChord([392, 523.25, 659.25, 783.99, 1046.5]);
    }
    if (this.voice === 'off') return;
    if (zimo) this._playVoice('zimo', { volume: 0.95, force: true });
    else this._playVoice('hu', { volume: 0.95, force: true });

    const firstFan = Array.isArray(huTypes) ? huTypes.find((t) => FAN_VOICE[t]) : null;
    if (firstFan) {
      setTimeout(() => this._playVoice(FAN_VOICE[firstFan], { volume: 0.88 }), 700);
    }
  }

  // 番型播报（结算/起手胡）
  announceFan(name) {
    if (!name) return;
    const key = FAN_VOICE[name];
    if (!key) return;
    this._playVoice(key, { volume: 0.9, force: true });
  }

  // 开局：升降机/发牌/垒牌，只取一条最不吵的
  playDeal() {
    this._playSfx('deal', 0.6);
  }

  playSort() {
    this._playSfx('sort', 0.4);
  }

  playScore() {
    this._playSfx('score', 0.45);
  }

  playDice() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const delay = i * 0.05;
      osc.frequency.setValueAtTime(1200 + Math.random() * 600, now + delay);
      gain.gain.setValueAtTime(0.12, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.04);
    }
  }

  _synthChord(freqs) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    freqs.forEach((freq, index) => {
      const start = now + index * 0.07;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.7);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + 0.7);
    });
  }

  // 兼容旧接口
  speakTile(tile) {
    if (!tile) return;
    this._playVoice(`${tile.suit}-${tile.value}`, { volume: 0.82 });
  }

  speakText(text) {
    if (!text || this.voice === 'off') return;
    const key = SUIT_NAMES[text] ? null : text;
    if (key && /^[a-z]-?[0-9]+$/.test(key)) this._playVoice(key, { volume: 0.85 });
  }
}

export const sound = new SoundEngine();
export default sound;
