export function qs(key, fallback=''){
  try{
    const u = new URL(location.href);
    const v = u.searchParams.get(key);
    return v == null ? fallback : v;
  }catch(_){
    return fallback;
  }
}

export function qbool(key, fallback=false){
  const v = String(qs(key, fallback ? '1' : '0')).toLowerCase();
  return ['1','true','yes','y','on'].includes(v);
}

export function qnum(key, fallback=0){
  const n = Number(qs(key, fallback));
  return Number.isFinite(n) ? n : fallback;
}

export function clamp(v, a, b){
  v = Number(v) || 0;
  return Math.max(a, Math.min(b, v));
}

export function seedFrom(str=''){
  let h = 2166136261 >>> 0;
  const s = String(str);
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function todayKey(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

export function safeHub(){
  const v = qs('hub', './hub.html');
  try{
    return new URL(v, location.href).toString();
  }catch(_){
    return new URL('./hub.html', location.href).toString();
  }
}

export function safeNext(){
  const v = qs('next', '');
  if(!v) return '';
  try{
    return new URL(v, location.href).toString();
  }catch(_){
    return '';
  }
}

export function makeDailyKey(ctx){
  return [
    'HHA_GATE_DAILY',
    ctx.mode,
    ctx.cat,
    ctx.game,
    ctx.pid || 'anon',
    todayKey()
  ].join('|');
}

export function getDailyDone(ctx){
  try{
    return localStorage.getItem(makeDailyKey(ctx)) === '1';
  }catch(_){
    return false;
  }
}

export function setDailyDone(ctx, value=true){
  try{
    localStorage.setItem(makeDailyKey(ctx), value ? '1' : '0');
  }catch(_){}
}

export function buildCtx(){
  const gatePhase = qs('gatePhase', qs('phase', 'warmup')).toLowerCase();
  const mode = gatePhase === 'cooldown' ? 'cooldown' : 'warmup';
  const game = qs('game', qs('theme', 'bath')).toLowerCase();
  const cat = qs('cat', 'hygiene').toLowerCase();

  const seedRaw = qs('seed', '');
  const seed = seedRaw ? Number(seedRaw) || seedFrom(seedRaw) : seedFrom(`${game}|${mode}|${Date.now()}`);

  return {
    mode,
    cat,
    theme: qs('theme', game),
    game,
    pid: qs('pid', 'anon'),
    run: qs('run', 'play'),
    diff: qs('diff', 'normal'),
    time: qnum('time', 20),
    view: qs('view', 'mobile'),
    seed,
    hub: safeHub(),
    next: safeNext(),
    dailyDone: false
  };
}

export function setText(elOrSel, value){
  const el = typeof elOrSel === 'string' ? document.querySelector(elOrSel) : elOrSel;
  if(el) el.textContent = String(value);
}

export function pct(a, b){
  return b > 0 ? Math.round((a / b) * 100) : 0;
}
