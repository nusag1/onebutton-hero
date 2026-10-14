'use strict';

// ===== 定数（世界座標：y は下向き、地面の高さが 0） =====
const G = 2000;            // 重力
const JUMP_V = -680;       // ジャンプの初速
const DIVE_V = 1150;       // 急降下の速さ
const BOUNCE_V = -600;     // 踏んだときの跳ね返り
const DIVE_BOUNCE_V = -740;
const PX = 4;              // ドット1つの大きさ
const M = 20;              // 20 = 1m
const BIOME_LEN = 300;     // ステージの長さ（m）
const SAVE_KEY = 'obhero.save.v1';
const PREF_KEY = 'obhero.prefs';

// ===== ドット絵（すべてオリジナル） =====
// K:輪郭 H:かぶと h:かぶとの影 S:肌 E:目 R:マフラー B:服 b:服の影 Y:ベルト L:くつ
const HERO_TOP = [
  '....KKKK....',
  '...KHHHHK...',
  '..KHHHHHHK..',
  '..KHhhhhhK..',
  '..KSSSESEK..',
  '..KSSSSSSK..',
  '...KSSSSK...',
  '.RRKKBBKK...',
  'RRRKBBBBKK..',
  'R..KBYBBSK..',
  '...KbBBbKK..',
  '...KbbbbK...',
];
const HERO_LEGS = {
  run1: ['..KLLKKLLK..', '..KK....KK..'],
  run2: ['....KLLK....', '....KKKK....'],
  jump: ['...KLKKLK...', '....K..K....'],
};
const HERO_PAL = { K: '#2b2340', H: '#d5deea', h: '#8c9ab0', S: '#ffd2a8', E: '#2b2340', R: '#ff5a3c', B: '#4d7cff', b: '#3152c0', Y: '#ffcf3f', L: '#7a4a2a' };

const SLIME = [
  ['...KKKK...', '..KCCCCK..', '.KCWCCWCK.', '.KCECCECK.', 'KCCCCCCCCK', 'KcCCCCCCcK', '.KKKKKKKK.'],
  ['..........', '...KKKK...', '.KKCCCCKK.', 'KCWCCCCWCK', 'KCECCCCECK', 'KcCCCCCCcK', 'KKKKKKKKKK'],
];
const BAT = [
  ['K..........K', 'KK..K..K..KK', 'KPK.KKKK.KPK', 'KPPKPWPWKPPK', '.KPPPEPEPPK.', '..KKpPPpKK..', '....KKKK....'],
  ['............', '....K..K....', '....KKKK....', '.KKKPWPWKKK.', 'KPPPPEPEPPPK', 'KPK.pPPp.KPK', 'K...KKKK...K'],
];

const spriteCache = {};
function sprite(key, rows, pal) {
  if (spriteCache[key]) return spriteCache[key];
  const c = document.createElement('canvas');
  c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const col = ch === 'W' ? '#ffffff' : pal[ch];
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }));
  return (spriteCache[key] = c);
}

// ===== ステージ =====
const BIOMES = [
  { name: '草原', sky: ['#8fd3ff', '#dff4ff'], far: '#a3d9b0', near: '#6fc276', top: '#5cb85c', dirt: '#8b5a3c', dirt2: '#7a4d33', slime: ['#7be07b', '#4fb34f'], bat: ['#9a6bd6', '#6d47a8'] },
  { name: '砂漠', sky: ['#ffcf8a', '#fff1d6'], far: '#efc283', near: '#e0a75c', top: '#f2cd7e', dirt: '#c98f4a', dirt2: '#b77f3f', slime: ['#ffa64d', '#d97b26'], bat: ['#b0703a', '#80502a'] },
  { name: '洞窟', sky: ['#231d38', '#3b3156'], far: '#352c52', near: '#463b68', top: '#7a6bb0', dirt: '#3b3355', dirt2: '#332c4a', slime: ['#c77dff', '#9150d6'], bat: ['#5f8cff', '#3a5fd0'] },
  { name: '雪原', sky: ['#b5d3f0', '#f0f7ff'], far: '#dbe8f5', near: '#c3d8ee', top: '#ffffff', dirt: '#8aa3bf', dirt2: '#7a92ad', slime: ['#6fd3ff', '#3aa6d9'], bat: ['#8f9bb3', '#636e88'] },
  { name: '魔王城', sky: ['#320c1b', '#6e2034'], far: '#45182a', near: '#5a2032', top: '#8a3a3a', dirt: '#3a1a1f', dirt2: '#2e1418', slime: ['#ff5c5c', '#c23030'], bat: ['#2b2340', '#16111f'] },
];

// ===== 保存 =====
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
};
const save = Object.assign({ coins: 0, best: 0, helpSeen: false, up: {} }, store.get(SAVE_KEY, {}));
save.up = Object.assign({ heart: 0, magnet: 0, sword: 0, charm: 0, dash: 0 }, save.up);
const prefs = Object.assign({ se: true, bgm: false }, store.get(PREF_KEY, {}));
let saveTimer = 0;
function persist(now = false) {
  if (now) { store.set(SAVE_KEY, save); return; }
  if (!saveTimer) saveTimer = setTimeout(() => { saveTimer = 0; store.set(SAVE_KEY, save); }, 800);
}

const UPGRADES = [
  { id: 'heart', icon: '❤️', name: 'ハート', desc: lv => `最大HP ${3 + lv} → ${4 + lv}`, costs: [60, 180, 450] },
  { id: 'magnet', icon: '🧲', name: 'マグネット', desc: () => '近くのコインを吸い寄せる', costs: [50, 150, 380] },
  { id: 'sword', icon: '🗡️', name: '剣みがき', desc: lv => `敵を倒したコイン ${1 + lv} → ${2 + lv}`, costs: [70, 200, 500] },
  { id: 'charm', icon: '🧿', name: '復活のお守り', desc: () => '1回の冒険で1度だけ復活', costs: [600] },
  { id: 'dash', icon: '👟', name: 'スタートダッシュ', desc: lv => `${[150, 300, 500][lv] ?? 500}m 地点から出発`, costs: [90, 280, 650] },
];
const DASH_M = [0, 150, 300, 500];
const MAGNET_R = [0, 70, 120, 180];

// ===== ゲーム状態 =====
// title / playing / paused / dead / result
let state = 'title';
let hero, gaps, spikes, enemies, coins, popups, particles;
let genX, startX, runCoins, kills, combo, charmReady, shake = 0, time = 0;
let lastHurtAt = 0;

function newRun() {
  startX = DASH_M[save.up.dash] * M;
  hero = {
    x: startX, y: 0, vy: 0, onGround: true, diving: false, coyote: 0,
    hp: 3 + save.up.heart, maxHp: 3 + save.up.heart, inv: 0, float: 0, anim: 0, dead: false, rot: 0,
  };
  gaps = []; spikes = []; enemies = []; coins = []; popups = []; particles = [];
  genX = startX + 500;
  runCoins = 0; kills = 0; combo = 0;
  charmReady = save.up.charm > 0;
}

function dist() { return Math.max(0, Math.floor((hero.x) / M)); }
function speed() {
  const m = hero.x / M;
  return 230 + Math.min(m, 1500) / 1500 * 190 + Math.max(0, m - 1500) * 0.04;
}

// ===== ステージ自動生成 =====
function generate(untilX) {
  while (genX < untilX) {
    const m = genX / M;
    const d = Math.min(1, m / 1200);
    const sp = 230 + Math.min(m, 1500) / 1500 * 190;
    const rest = sp * (0.5 - d * 0.12) + Math.random() * sp * 0.45;
    if (Math.random() < 0.55) coinRow(genX + 30, Math.max(0, rest - 60), -24 - (Math.random() < 0.3 ? 80 : 0));
    genX += rest;

    const table = [
      ['gap', m > 20 ? 1.2 + d * 1.5 : 0],
      ['spike', 2],
      ['slime', 2.2],
      ['bat', m > 60 ? 1.2 + d * 1.2 : 0],
      ['slime2', d > 0.35 ? 1 + d : 0],
      ['batRow', d > 0.4 ? 0.7 + d * 0.5 : 0],
      ['gapSlime', d > 0.3 ? 0.8 + d : 0],
    ];
    let r = Math.random() * table.reduce((a, t) => a + t[1], 0);
    let kind = 'slime';
    for (const [k, w] of table) { r -= w; if (r <= 0) { kind = k; break; } }

    if (kind === 'gap' || kind === 'gapSlime') {
      const w = sp * (0.26 + d * 0.18 + Math.random() * 0.08);
      gaps.push({ x0: genX, x1: genX + w });
      coinArc(genX - 10, w + 20, 80);
      genX += w;
      if (kind === 'gapSlime') {
        genX += 40;
        enemies.push(makeSlime(genX + 60, genX, genX + 140));
        genX += 140;
      }
    } else if (kind === 'spike') {
      const n = 1 + (Math.random() < d ? (Math.random() < 0.5 ? 1 : 2) : 0);
      spikes.push({ x: genX, n });
      coinArc(genX - 20, n * 28 + 40, 90);
      genX += n * 28;
    } else if (kind === 'slime') {
      enemies.push(makeSlime(genX + 80, genX, genX + 170));
      genX += 170;
    } else if (kind === 'bat') {
      // コウモリは下をくぐれる高さ。ジャンプで踏めばコイン
      enemies.push(makeBat(genX + 40, -88 - Math.random() * 20));
      genX += 90;
    } else if (kind === 'slime2') {
      // 2匹続けて踏むとコンボ
      enemies.push(makeSlime(genX + 50, genX, genX + 110));
      enemies.push(makeSlime(genX + 170, genX + 120, genX + 230));
      genX += 230;
    } else if (kind === 'batRow') {
      // 並んだコウモリ：急降下で連続して踏むとコンボ
      for (let i = 0; i < 3; i++) enemies.push(makeBat(genX + 40 + i * 70, -96));
      genX += 230;
    }
  }
}

function makeSlime(x, x0, x1) { return { type: 'slime', x, y: 0, w: 40, h: 28, vx: -40, x0, x1, t: Math.random() * 3 }; }
function makeBat(x, y) { return { type: 'bat', x, y, baseY: y, w: 44, h: 26, vx: -70, t: Math.random() * 3 }; }
function coinRow(x, w, y) {
  for (let cx = x; cx < x + w; cx += 34) coins.push({ x: cx, y, t: Math.random() * 6 });
}
function coinArc(x, w, hgt) {
  const n = Math.max(3, Math.round(w / 36));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    coins.push({ x: x + w * t, y: -30 - Math.sin(Math.PI * t) * hgt, t: Math.random() * 6 });
  }
}

function overGround(x) {
  for (const g of gaps) if (x > g.x0 && x < g.x1) return false;
  return true;
}
function supported(x) { return overGround(x - 9) || overGround(x + 9); }

// ===== プレイヤー行動 =====
function onTap() {
  audio.unlock();
  if (state === 'title') { startRun(); return; }
  if (state === 'paused') { setPaused(false); return; }
  if (state !== 'playing' || hero.float > 0) return;
  // 着地直前のタップはジャンプとして扱う（先行入力）
  const nearLanding = hero.vy > 0 && -hero.y < hero.vy * 0.09 && supported(hero.x);
  if (hero.onGround || hero.coyote > 0 || nearLanding) {
    if (nearLanding && !hero.onGround) { hero.jumpBuffer = 0.12; return; }
    jump();
  } else if (!hero.diving) {
    hero.diving = true;
    hero.vy = DIVE_V;
    sfx.dive();
  }
}

function jump() {
  hero.vy = JUMP_V; hero.onGround = false; hero.coyote = 0; hero.diving = false;
  sfx.jump();
  dust(hero.x, 0, 4);
}

function startRun() {
  newRun();
  state = 'playing';
  $('title-panel').hidden = true;
  $('btn-pause').hidden = false;
  generate(hero.x + 1200);
}

function hurt() {
  if (hero.inv > 0 || state !== 'playing') return;
  hero.hp--;
  hero.inv = 1.3;
  hero.vy = Math.min(hero.vy, -380);
  hero.diving = false; hero.onGround = false;
  combo = 0; shake = 10;
  lastHurtAt = time;
  sfx.hurt();
  vibrate([30, 40, 30]);
  if (hero.hp <= 0) {
    if (charmReady) {
      charmReady = false;
      hero.hp = 2; hero.inv = 2.2;
      popup('お守りが守ってくれた！', hero.x + 40, hero.y - 90, '#7fd6ff', 1.1);
      sfx.revive();
    } else {
      die();
    }
  }
}

function die() {
  state = 'dead';
  hero.dead = true;
  hero.vy = -650;
  $('btn-pause').hidden = true;
  const d = dist();
  const record = d > save.best;
  if (record) save.best = d;
  persist(true);
  sfx.over();
  setTimeout(() => {
    $('result-title').textContent = ['ユウは倒れた…', 'また挑もう！', 'くっ…ここまでか'][Math.floor(Math.random() * 3)];
    $('result-dist').textContent = d;
    $('result-record').hidden = !record;
    $('result-coins').textContent = '+' + runCoins;
    $('result-kills').textContent = kills;
    $('result-best').textContent = save.best + 'm';
    state = 'result';
    $('result').hidden = false;
  }, 1300);
}

function addCoins(n) {
  save.coins += n; runCoins += n;
  persist();
}

function popup(text, x, y, color = '#fff', size = 1) {
  popups.push({ text, x, y, color, size, t0: time });
}
function dust(x, y, n, color = 'rgba(255,255,255,.8)') {
  for (let i = 0; i < n; i++) {
    particles.push({ x: x + (Math.random() - .5) * 20, y: y - 4, vx: (Math.random() - .5) * 160, vy: -Math.random() * 160, life: 0.5, max: 0.5, size: 4 + Math.random() * 4, color, g: 400 });
  }
}
function burst(x, y, color) {
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 220;
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 100, life: 0.6, max: 0.6, size: 5 + Math.random() * 5, color, g: 900 });
  }
}

// ===== 更新 =====
function update(dt) {
  time += dt;
  if (state === 'paused') return;
  shake *= 0.85;

  if (state === 'title') {
    hero.x += 160 * dt;
    hero.anim += dt;
    updateParticles(dt);
    return;
  }
  if (state === 'dead' || state === 'result') {
    if (hero.dead && hero.y < 3000) { hero.vy += G * dt; hero.y += hero.vy * dt; hero.rot += dt * 8; }
    updateParticles(dt);
    updatePopups();
    return;
  }

  const sp = speed();
  const prevY = hero.y;
  hero.x += sp * dt;
  hero.anim += dt * sp / 230;
  hero.inv = Math.max(0, hero.inv - dt);
  hero.coyote = Math.max(0, hero.coyote - dt);

  if (hero.float > 0) {
    // 穴に落ちたあと：空中に浮かんで、地面の上に来たら復帰
    hero.float -= dt;
    hero.y += (-110 - hero.y) * Math.min(1, dt * 8);
    hero.vy = 0;
    if (hero.float <= 0 && !supported(hero.x)) hero.float = 0.05;
  } else {
    hero.vy += G * dt;
    hero.y += hero.vy * dt;
    const wasGround = hero.onGround;
    hero.onGround = false;
    if (prevY <= 0.5 && hero.y >= 0 && supported(hero.x)) {
      hero.y = 0;
      if (!wasGround) {
        if (hero.diving) { shake = 6; dust(hero.x, 0, 8); sfx.land(); }
        hero.diving = false;
        combo = 0;
      }
      hero.vy = 0;
      hero.onGround = true;
      if (hero.jumpBuffer > 0) { hero.jumpBuffer = 0; jump(); }
    } else if (wasGround && !supported(hero.x)) {
      hero.coyote = 0.08;
    }
    if (hero.jumpBuffer > 0) hero.jumpBuffer -= dt;
    if (hero.y > 320) {
      // 穴に落ちた
      hurtFall();
    }
  }

  // 敵
  const hx0 = hero.x - 14, hx1 = hero.x + 14, hy0 = hero.y - 50, hy1 = hero.y;
  for (const e of enemies) {
    if (e.dead) { e.deadT += dt; continue; }
    e.t += dt;
    e.x += e.vx * dt;
    if (e.type === 'slime') {
      if (e.x < e.x0 + 20 || e.x > e.x1 - 20) e.vx = -e.vx;
    } else {
      e.y = e.baseY + Math.sin(e.t * 3) * 10;
    }
    if (e.x < hero.x - 400 || e.x > hero.x + 900) continue;
    const ex0 = e.x - e.w / 2 + 4, ex1 = e.x + e.w / 2 - 4, ey0 = e.y - e.h, ey1 = e.y;
    if (hx1 > ex0 && hx0 < ex1 && hy1 > ey0 && hy0 < ey1) {
      if (hero.vy > 0 && prevY <= ey0 + 14) {
        stomp(e);
      } else if (hero.inv <= 0) {
        hurt();
      }
    }
  }

  // トゲ
  for (const s of spikes) {
    const sx0 = s.x + 6, sx1 = s.x + s.n * 28 - 6;
    if (hx1 > sx0 && hx0 < sx1 && hy1 > -18) hurt();
  }

  // コイン
  const magR = MAGNET_R[save.up.magnet];
  for (const c of coins) {
    if (c.taken) continue;
    const dx = hero.x - c.x, dy = (hero.y - 25) - c.y;
    const d2 = dx * dx + dy * dy;
    if (magR && d2 < magR * magR) {
      const d = Math.sqrt(d2) || 1;
      c.x += dx / d * 520 * dt; c.y += dy / d * 520 * dt;
    }
    if (d2 < 30 * 30) {
      c.taken = true;
      addCoins(1);
      sfx.coin();
      particles.push({ x: c.x, y: c.y, vx: 0, vy: -60, life: 0.3, max: 0.3, size: 10, color: '#ffe066', g: 0 });
    }
  }

  // 画面外を掃除して、先を生成
  const left = hero.x - 300;
  gaps = gaps.filter(g => g.x1 > left);
  spikes = spikes.filter(s => s.x + s.n * 28 > left);
  enemies = enemies.filter(e => e.x > left && (!e.dead || e.deadT < 0.6));
  coins = coins.filter(c => c.x > left && !c.taken);
  generate(hero.x + viewW() + 400);

  updateParticles(dt);
  updatePopups();
}

function hurtFall() {
  hero.inv = 0;
  hurt();
  if (state !== 'playing') return;
  hero.float = 0.6;
  hero.y = -110; hero.vy = 0; hero.diving = false;
  hero.inv = Math.max(hero.inv, 1.6);
}

function stomp(e) {
  e.dead = true; e.deadT = 0;
  kills++;
  combo++;
  const diveBonus = hero.diving ? 2 : 1;
  const gain = (1 + save.up.sword) * diveBonus * Math.min(combo, 5);
  addCoins(gain);
  hero.vy = hero.diving ? DIVE_BOUNCE_V : BOUNCE_V;
  shake = hero.diving ? 8 : 5;
  hero.diving = false;
  const b = biomeAt(e.x / M);
  burst(e.x, e.y - e.h / 2, e.type === 'slime' ? b.slime[0] : b.bat[0]);
  popup('+' + gain, e.x, e.y - e.h - 10, '#ffe066');
  if (combo >= 2) popup(combo + ' コンボ！', e.x, e.y - e.h - 44, '#ff8a5c', 0.9);
  if (diveBonus > 1) popup('急降下！', e.x, e.y - e.h - (combo >= 2 ? 78 : 44), '#7fd6ff', 0.8);
  sfx.stomp(combo);
  vibrate(18);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
function updatePopups() {
  for (let i = popups.length - 1; i >= 0; i--) if (time - popups[i].t0 > 0.9) popups.splice(i, 1);
}

// ===== 描画 =====
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = 0, H = 0, dpr = 1, scale = 1, groundSY = 0, safeTop = 0;
const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top)';
document.body.appendChild(safeProbe);

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  W = cv.clientWidth; H = cv.clientHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  scale = Math.min(W / 420, H / 560);
  groundSY = H * 0.7;
  safeTop = parseFloat(getComputedStyle(safeProbe).paddingTop) || 0;
}
function viewW() { return W / scale; }
function camX() { return hero.x - viewW() * 0.26; }
function sx(x) { return (x - camX()) * scale; }
function sy(y) { return groundSY + y * scale; }

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = [16, 8, 0].map(s => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * t));
  return '#' + r.map(v => v.toString(16).padStart(2, '0')).join('');
}
function biomeAt(m) {
  const i = Math.floor(m / BIOME_LEN);
  const a = BIOMES[((i % 5) + 5) % 5], b = BIOMES[(((i + 1) % 5) + 5) % 5];
  const into = m - i * BIOME_LEN;
  const t = Math.max(0, (into - (BIOME_LEN - 30)) / 30);
  if (t <= 0) return a;
  const out = {};
  for (const k of Object.keys(a)) {
    if (k === 'name') out[k] = a[k];
    else if (Array.isArray(a[k])) out[k] = a[k].map((c, j) => mix(c, b[k][j], t));
    else out[k] = mix(a[k], b[k], t);
  }
  return out;
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const cx = camX();
  const m = hero.x / M;
  const bio = biomeAt(m);
  const bIndex = Math.floor(m / BIOME_LEN) % 5;

  // 空
  const g = ctx.createLinearGradient(0, 0, 0, groundSY);
  g.addColorStop(0, bio.sky[0]); g.addColorStop(1, bio.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 遠くの山・近くの丘（パララックス）
  drawHills(cx * 0.15, bio.far, groundSY - 150 * scale, 60, 0.006, 0.017);
  drawHills(cx * 0.4, bio.near, groundSY - 70 * scale, 34, 0.011, 0.029);

  // 雪・火の粉
  if (bIndex === 3 || bIndex === 4) drawAmbient(bIndex);

  ctx.save();
  if (shake > 0.5) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);

  // 地面（穴の部分は描かない）
  const x0 = cx - 40, x1 = cx + viewW() + 40;
  const holes = gaps.filter(gp => gp.x1 > x0 && gp.x0 < x1).sort((a, b) => a.x0 - b.x0);
  let from = x0;
  for (const h of holes) { drawGround(from, h.x0, bio); from = h.x1; }
  drawGround(from, x1, bio);

  // トゲ
  for (const s of spikes) {
    for (let i = 0; i < s.n; i++) {
      const bx = sx(s.x + i * 28), by = sy(0);
      ctx.fillStyle = '#2b2340';
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 14 * scale, by - 30 * scale); ctx.lineTo(bx + 28 * scale, by); ctx.fill();
      ctx.fillStyle = '#cfd6e3';
      ctx.beginPath(); ctx.moveTo(bx + 4 * scale, by); ctx.lineTo(bx + 14 * scale, by - 23 * scale); ctx.lineTo(bx + 24 * scale, by); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(bx + 11 * scale, by - 10 * scale); ctx.lineTo(bx + 14 * scale, by - 21 * scale); ctx.lineTo(bx + 15 * scale, by - 10 * scale); ctx.fill();
    }
  }

  // コイン
  for (const c of coins) {
    const px = sx(c.x), py = sy(c.y);
    if (px < -30 || px > W + 30) continue;
    const w = Math.abs(Math.cos(time * 4 + c.t)) * 9 * scale + 2;
    ctx.fillStyle = '#c98a00';
    ctx.beginPath(); ctx.ellipse(px, py, w + 1.5, 11 * scale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath(); ctx.ellipse(px, py, w, 9.5 * scale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(px - w * 0.3, py - 6 * scale, Math.max(1.5, w * 0.3), 8 * scale);
  }

  // 敵
  for (const e of enemies) {
    const px = sx(e.x), py = sy(e.y);
    if (px < -60 || px > W + 60) continue;
    const frame = Math.floor(e.t * (e.type === 'bat' ? 8 : 4)) % 2;
    const bkey = Math.floor(e.x / M / BIOME_LEN) % 5;
    const b = BIOMES[bkey];
    const spr = e.type === 'slime'
      ? sprite(`slime${bkey}${frame}`, SLIME[frame], { K: '#2b2340', C: b.slime[0], c: b.slime[1], E: '#2b2340' })
      : sprite(`bat${bkey}${frame}`, BAT[frame], { K: '#2b2340', P: b.bat[0], p: b.bat[1], E: '#2b2340' });
    const w = spr.width * PX * scale, h = spr.height * PX * scale;
    if (e.dead) {
      const t = e.deadT / 0.6;
      ctx.globalAlpha = 1 - t;
      ctx.drawImage(spr, px - w / 2, py - h * (1 - t * 0.7), w, h * (1 - t * 0.7));
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(spr, px - w / 2, py - h, w, h);
    }
  }

  drawHero();

  // パーティクル
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    const s = p.size * scale;
    ctx.fillRect(sx(p.x) - s / 2, sy(p.y) - s / 2, s, s);
  }
  ctx.globalAlpha = 1;

  // ポップアップ
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of popups) {
    const t = (time - p.t0) / 0.9;
    ctx.globalAlpha = t > 0.6 ? (1 - t) / 0.4 : 1;
    ctx.font = `900 ${Math.round(20 * p.size * Math.max(1, scale))}px system-ui, sans-serif`;
    const px = sx(p.x), py = sy(p.y) - t * 40;
    ctx.lineWidth = 4; ctx.strokeStyle = '#2b2340';
    ctx.strokeText(p.text, px, py);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, px, py);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  drawHud(bio, bIndex);
}

function drawHills(offset, color, baseY, amp, f1, f2) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, groundSY);
  for (let x = 0; x <= W + 8; x += 8) {
    const wx = x / scale + offset;
    const y = baseY - (Math.sin(wx * f1) * 0.6 + Math.sin(wx * f2 + 1.7) * 0.4 + 1) * amp * scale;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, groundSY);
  ctx.closePath();
  ctx.fill();
}

function drawGround(a, b, bio) {
  if (b <= a) return;
  const px0 = sx(a), px1 = sx(b);
  const top = sy(0);
  ctx.fillStyle = bio.dirt;
  ctx.fillRect(px0, top, px1 - px0, H - top);
  // 土の模様（座標から決まるので、スクロールしても同じ模様）
  ctx.fillStyle = bio.dirt2;
  const step = 24;
  for (let x = Math.ceil(a / step) * step; x < b; x += step) {
    const hsh = Math.sin(x * 12.9898) * 43758.5453;
    const r = hsh - Math.floor(hsh);
    ctx.fillRect(sx(x), top + (18 + r * 60) * scale, 8 * scale, 6 * scale);
    ctx.fillRect(sx(x + 12), top + (60 + r * 90) * scale, 6 * scale, 6 * scale);
  }
  ctx.fillStyle = bio.top;
  ctx.fillRect(px0, top, px1 - px0, 10 * scale);
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  ctx.fillRect(px0, top + 10 * scale, px1 - px0, 3 * scale);
  // 穴のふち
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ctx.fillRect(px0, top, 3 * scale, H - top);
  ctx.fillRect(px1 - 3 * scale, top, 3 * scale, H - top);
}

const AMBIENT = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 0.5 + 0.5 }));
function drawAmbient(kind) {
  for (const a of AMBIENT) {
    let x, y;
    if (kind === 3) {
      x = ((a.x + Math.sin(time * a.s + a.y * 6) * 0.02 - time * 0.03 * a.s) % 1 + 1) % 1 * W;
      y = ((a.y + time * 0.06 * a.s) % 1) * H;
      ctx.fillStyle = 'rgba(255,255,255,.9)';
    } else {
      x = ((a.x - time * 0.02 * a.s) % 1 + 1) % 1 * W;
      y = (1 - ((a.y + time * 0.05 * a.s) % 1)) * H;
      ctx.fillStyle = `rgba(255,${120 + a.s * 80},60,.8)`;
    }
    const s = (2 + a.s * 3) * scale;
    ctx.fillRect(x, y, s, s);
  }
}

function drawHero() {
  if (hero.inv > 0 && state === 'playing' && Math.floor(time * 16) % 2 === 0) return;
  const air = !hero.onGround || hero.float > 0 || state === 'dead';
  const legs = air ? HERO_LEGS.jump : (Math.floor(hero.anim * 9) % 2 ? HERO_LEGS.run1 : HERO_LEGS.run2);
  const key = air ? 'heroJ' : legs === HERO_LEGS.run1 ? 'heroR1' : 'heroR2';
  const spr = sprite(key, HERO_TOP.concat(legs), HERO_PAL);
  const w = spr.width * PX * scale, h = spr.height * PX * scale;
  const px = sx(hero.x), py = sy(hero.y);
  const bob = !air ? (Math.floor(hero.anim * 9) % 2) * scale * 2 : 0;

  ctx.save();
  ctx.translate(px, py - h / 2 - bob);
  if (state === 'dead') ctx.rotate(hero.rot);
  // 剣（急降下中は下向き）
  ctx.fillStyle = '#2b2340';
  if (hero.diving) {
    ctx.fillRect(-4 * scale, h / 2 - 4 * scale, 8 * scale, 34 * scale);
    ctx.fillStyle = '#eef3fb'; ctx.fillRect(-2 * scale, h / 2 - 2 * scale, 4 * scale, 30 * scale);
    ctx.fillStyle = '#ffcf3f'; ctx.fillRect(-8 * scale, h / 2 - 8 * scale, 16 * scale, 5 * scale);
  } else {
    const sxp = 14 * scale, syp = -h / 2 + 10 * scale;
    ctx.fillRect(sxp - 2 * scale, syp - 2 * scale, 8 * scale, 30 * scale);
    ctx.fillStyle = '#eef3fb'; ctx.fillRect(sxp, syp, 4 * scale, 24 * scale);
    ctx.fillStyle = '#ffcf3f'; ctx.fillRect(sxp - 4 * scale, syp + 22 * scale, 12 * scale, 4 * scale);
  }
  if (hero.float > 0) {
    ctx.strokeStyle = 'rgba(160,220,255,.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, h * 0.7, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.drawImage(spr, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function heartPath(x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
}

function drawHud(bio, bIndex) {
  const top = safeTop + 12;
  ctx.textBaseline = 'middle';
  const dark = bIndex === 2 || bIndex === 4;
  const fg = dark ? '#ffffff' : '#2b2340';

  if (state === 'title') {
    ctx.textAlign = 'center';
    const tSize = Math.min(48, W * 0.115);
    ctx.font = `900 ${tSize}px system-ui, sans-serif`;
    ctx.lineWidth = 8; ctx.strokeStyle = '#2b2340';
    ctx.strokeText('ワンボタン勇者', W / 2, H * 0.2);
    ctx.fillStyle = '#ffcf3f';
    ctx.fillText('ワンボタン勇者', W / 2, H * 0.2);
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = fg;
    ctx.fillText(`最高記録 ${save.best}m`, W / 2, H * 0.2 + tSize * 0.95);
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 4);
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.fillText('タップでスタート', W / 2, H * 0.42);
    ctx.globalAlpha = 1;
    return;
  }

  // ハート
  for (let i = 0; i < hero.maxHp; i++) {
    const x = 26 + i * 30, y = top + 4;
    heartPath(x, y, 22);
    ctx.fillStyle = '#2b2340'; ctx.fill();
    heartPath(x, y + 2.5, 17);
    ctx.fillStyle = i < hero.hp ? '#ff4d6d' : 'rgba(255,255,255,.35)';
    ctx.fill();
  }
  if (charmReady) { ctx.font = '18px system-ui'; ctx.textAlign = 'left'; ctx.fillText('🧿', 14 + hero.maxHp * 30, top + 14); }
  // コイン
  ctx.textAlign = 'left';
  ctx.font = '800 17px system-ui, sans-serif';
  ctx.fillStyle = fg;
  ctx.fillText('🪙 ' + runCoins, 14, top + 46);
  // 距離
  ctx.textAlign = 'center';
  ctx.font = `900 ${Math.round(Math.min(46, W * 0.11))}px system-ui, sans-serif`;
  ctx.lineWidth = 6; ctx.strokeStyle = dark ? '#2b2340' : 'rgba(255,255,255,.8)';
  ctx.strokeText(dist() + 'm', W / 2, top + 92);
  ctx.fillStyle = fg;
  ctx.fillText(dist() + 'm', W / 2, top + 92);
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillText(BIOMES[bIndex].name, W / 2, top + 124);

  if (state === 'paused') {
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = '900 28px system-ui, sans-serif';
    ctx.fillText('一時停止中', W / 2, H * 0.42);
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText('タップで再開', W / 2, H * 0.42 + 38);
  }
}

// ===== ループ =====
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

// ===== 操作 =====
cv.addEventListener('pointerdown', e => { e.preventDefault(); onTap(); });
window.addEventListener('keydown', e => {
  if ((e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') && !e.repeat && allClosed()) { e.preventDefault(); onTap(); }
});
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

function allClosed() { return ['help', 'result', 'shop'].every(id => $(id).hidden); }

function setPaused(p) {
  if (p && state === 'playing') state = 'paused';
  else if (!p && state === 'paused') { state = 'playing'; last = performance.now(); }
  $('btn-pause').textContent = state === 'paused' ? '▶' : '⏸';
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    setPaused(true);
    persist(true);
    bgm.stop();
    if (audio.ctx) audio.ctx.suspend();
  } else if (audio.ctx) {
    audio.ctx.resume();
    if (prefs.bgm) bgm.start();
  }
});

function vibrate(p) {
  if (prefs.se && navigator.vibrate) try { navigator.vibrate(p); } catch {}
}

// ===== サウンド（WebAudio で合成） =====
const audio = {
  ctx: null, master: null, bgmGain: null,
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch {}
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.3;
      this.bgmGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (prefs.bgm) bgm.start();
  },
  tone(freq, dur, { type = 'square', vol = 0.2, when = 0, slide = 0, out } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(out || this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },
};
// レトロゲーム風の効果音
const sfx = {
  jump() { if (prefs.se) audio.tone(330, 0.15, { type: 'square', vol: 0.1, slide: 2 }); },
  dive() { if (prefs.se) audio.tone(900, 0.12, { type: 'sawtooth', vol: 0.08, slide: 0.3 }); },
  land() { if (prefs.se) audio.tone(120, 0.12, { type: 'triangle', vol: 0.35, slide: 0.5 }); },
  coin() { if (prefs.se) { audio.tone(988, 0.06, { vol: 0.07 }); audio.tone(1319, 0.12, { vol: 0.07, when: 0.05 }); } },
  stomp(c) {
    if (!prefs.se) return;
    const f = 440 * Math.pow(2, Math.min(c - 1, 8) / 12 * 2);
    audio.tone(f, 0.08, { vol: 0.12 });
    audio.tone(f * 1.5, 0.14, { vol: 0.1, when: 0.06 });
  },
  hurt() { if (prefs.se) audio.tone(220, 0.25, { type: 'sawtooth', vol: 0.12, slide: 0.4 }); },
  revive() { if (prefs.se) [523, 659, 784, 1047].forEach((f, i) => audio.tone(f, 0.15, { vol: 0.08, when: i * 0.08 })); },
  over() { if (prefs.se) [392, 330, 262, 196].forEach((f, i) => audio.tone(f, 0.25, { type: 'triangle', vol: 0.25, when: 0.2 + i * 0.17 })); },
  buy() { if (prefs.se) [660, 880, 1320].forEach((f, i) => audio.tone(f, 0.1, { vol: 0.08, when: i * 0.06 })); },
};

// 冒険っぽいBGM（ベースとメロディを自動生成）
const bgm = {
  timer: 0, step: 0,
  bass: [130.81, 130.81, 174.61, 196],
  scale: [523.25, 587.33, 659.25, 783.99, 880, 1046.5],
  start() { if (!this.timer && audio.ctx) this.timer = setInterval(() => this.tick(), 150); },
  stop() { clearInterval(this.timer); this.timer = 0; },
  tick() {
    if (!audio.ctx || audio.ctx.state !== 'running') return;
    const bar = Math.floor(this.step / 16) % 4, k = this.step % 16;
    if (k % 4 === 0) audio.tone(this.bass[bar], 0.2, { type: 'triangle', vol: 0.3, out: audio.bgmGain });
    if (k % 4 === 2) audio.tone(this.bass[bar] * 2, 0.1, { type: 'triangle', vol: 0.15, out: audio.bgmGain });
    if (k % 2 === 0 && Math.random() < 0.6) {
      const n = this.scale[(Math.floor(Math.sin(this.step * 0.7 + bar) * 3 + 3) + bar) % this.scale.length];
      audio.tone(n, 0.12, { type: 'square', vol: 0.035, out: audio.bgmGain });
    }
    this.step++;
  },
};

// ===== 画面（ボタン・ショップ） =====
const $ = id => document.getElementById(id);

function refreshCoins() {
  document.querySelectorAll('.coin-count').forEach(el => { el.textContent = save.coins; });
}
function updateButtons() {
  $('btn-se').classList.toggle('off', !prefs.se);
  $('btn-bgm').classList.toggle('off', !prefs.bgm);
}

function renderShop() {
  refreshCoins();
  const list = $('shop-list');
  list.innerHTML = '';
  for (const u of UPGRADES) {
    const lv = save.up[u.id];
    const maxed = lv >= u.costs.length;
    const cost = u.costs[lv];
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="icon">${u.icon}</div>
      <div class="info">
        <div class="name">${u.name}</div>
        <div class="desc">${maxed ? '最大まで強化済み' : u.desc(lv)}</div>
        <div class="lv">${'●'.repeat(lv)}${'○'.repeat(u.costs.length - lv)}</div>
      </div>`;
    const btn = document.createElement('button');
    btn.textContent = maxed ? 'MAX' : `🪙 ${cost}`;
    btn.disabled = maxed || save.coins < cost;
    btn.addEventListener('click', () => {
      if (save.coins < cost || maxed) return;
      audio.unlock();
      save.coins -= cost;
      save.up[u.id]++;
      persist(true);
      sfx.buy();
      vibrate(15);
      renderShop();
    });
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function goTitle() {
  state = 'title';
  newRun();
  hero.y = 0;
  $('result').hidden = true;
  $('title-panel').hidden = false;
  $('btn-pause').hidden = true;
  refreshCoins();
}

$('btn-pause').addEventListener('click', () => setPaused(state !== 'paused'));
$('btn-again').addEventListener('click', () => { $('result').hidden = true; startRun(); });
$('btn-shop-result').addEventListener('click', () => { goTitle(); renderShop(); $('shop').hidden = false; });
$('btn-shop-title').addEventListener('click', () => { renderShop(); $('shop').hidden = false; });
$('btn-shop-close').addEventListener('click', () => { $('shop').hidden = true; refreshCoins(); });
$('btn-help').addEventListener('click', () => { $('help').hidden = false; });
$('btn-help-close').addEventListener('click', () => {
  $('help').hidden = true;
  save.helpSeen = true;
  persist(true);
  audio.unlock();
});
$('btn-se').addEventListener('click', () => {
  prefs.se = !prefs.se; store.set(PREF_KEY, prefs);
  audio.unlock(); updateButtons();
  if (prefs.se) sfx.coin();
});
$('btn-bgm').addEventListener('click', () => {
  prefs.bgm = !prefs.bgm; store.set(PREF_KEY, prefs);
  audio.unlock();
  if (prefs.bgm) bgm.start(); else bgm.stop();
  updateButtons();
});
window.addEventListener('resize', resize);

// ===== 起動 =====
resize();
goTitle();
updateButtons();
if (!save.helpSeen) $('help').hidden = false;
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
