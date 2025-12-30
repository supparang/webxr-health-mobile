/* === /herohealth/vr-groups/audio.js ===
GroupsVR WebAudio SFX — AUTO HOOK (PATCHED)
✅ tick (mini urgent)
✅ good / bad / boss / storm / overdrive
✅ auto-listen events:
   - groups:progress (hit_good/hit_bad/boss_spawn/boss_down/storm_on)
   - groups:buff (overdrive/freeze/shield)
   - hha:judge fallback
   - quest:update -> mini urgent tick
✅ throttle + mute (?sfx=0) + key 'M'
Expose: window.GroupsVR.Audio.{unlock, setEnabled, tick, good, bad, boss, storm, overdrive}
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const q = (()=>{ try{ return new URLSearchParams(location.search); }catch{ return new URLSearchParams(); }})();

  let ctx = null;
  let master = null;
  let unlocked = false;

  // ---- settings ----
  let enabled = (q.get('sfx') !== '0');     // ?sfx=0 => mute
  let masterVol = 0.22;

  // ---- throttles ----
  const lastAt = Object.create(null);
  function gate(key, ms){
    const t = (root.performance && performance.now) ? performance.now() : Date.now();
    const p = lastAt[key] || 0;
    if (t - p < ms) return false;
    lastAt[key] = t;
    return true;
  }

  function ensure(){
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = masterVol;
    master.connect(ctx.destination);
    return ctx;
  }

  function setEnabled(on){
    enabled = !!on;
    // ถ้าปิด ก็ยังคง ctx ไว้ได้ ไม่ต้อง destroy
    // แต่ลด gain ลงทันที
    if (master) master.gain.value = enabled ? masterVol : 0.00001;
  }

  function unlock(){
    const c = ensure();
    if (!c) return false;
    if (!enabled) {
      // still resume context if needed (บางมือถือ resume ต้อง gesture)
      if (c.state === 'suspended') c.resume().catch(()=>{});
      unlocked = true;
      return true;
    }
    if (c.state === 'suspended') c.resume().catch(()=>{});
    unlocked = true;
    return true;
  }

  function tone(freq, durMs, type, gain, sweepTo){
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    unlock();
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), t0 + (durMs/1000));

    // envelope
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain||0.12), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (durMs/1000));

    o.connect(g); g.connect(master);
    o.start(t0);
    o.stop(t0 + (durMs/1000) + 0.02);
  }

  // ---- sfx primitives (ใช้ throttle กัน spam) ----
  function tick(){
    if (!gate('tick', 120)) return;
    tone(880, 70, 'square', 0.08, 760);
  }
  function good(){
    if (!gate('good', 55)) return;
    tone(660, 90, 'triangle', 0.10, 990);
  }
  function bad(){
    if (!gate('bad', 90)) return;
    tone(220, 130, 'sawtooth', 0.12, 160);
  }
  function boss(){
    if (!gate('boss', 180)) return;
    tone(180, 160, 'sawtooth', 0.14, 360);
    tone(480, 120, 'square', 0.10, 520);
  }
  function storm(){
    if (!gate('storm', 160)) return;
    tone(420, 120, 'square', 0.10, 250);
  }
  function overdrive(){
    if (!gate('over', 220)) return;
    tone(520, 120, 'triangle', 0.12, 980);
    tone(980, 120, 'triangle', 0.10, 1200);
  }

  // ---- AUTO HOOK ----
  function bindAuto(){
    if (bindAuto._done) return;
    bindAuto._done = true;

    // (1) groups:progress from GameEngine
    root.addEventListener('groups:progress', (ev)=>{
      const d = ev?.detail || {};
      const k = String(d.kind||'').toLowerCase();

      if (k === 'hit_good') good();
      else if (k === 'hit_bad') bad();
      else if (k === 'boss_spawn') boss();
      else if (k === 'boss_down') boss();
      else if (k === 'storm_on') storm();
      // storm_off ไม่ต้องก็ได้ (เงียบ)
    }, { passive:true });

    // (2) groups:buff from Quest (overdrive, etc.)
    root.addEventListener('groups:buff', (ev)=>{
      const d = ev?.detail || {};
      const t = String(d.type||'').toLowerCase();
      if (t === 'overdrive') overdrive();
      else if (t === 'freeze') { if (gate('freeze', 220)) tone(300, 130, 'triangle', 0.10, 220); }
      else if (t === 'shield') { if (gate('shield', 220)) tone(740, 90, 'square', 0.08, 980); }
    }, { passive:true });

    // (3) hha:judge fallback (ถ้า engine ส่ง judge แทน)
    root.addEventListener('hha:judge', (ev)=>{
      const d = ev?.detail || {};
      const kind = String(d.kind||'').toLowerCase();
      if (kind === 'good' || kind === 'perfect') good();
      if (kind === 'miss' || kind === 'bad') bad();
    }, { passive:true });

    // (4) quest:update -> mini urgent tick (เหลือ <= 3 วิ)
    // กันติ๊กถี่เกิน: จะติ๊ก 2Hz ตอน <=2s และ 1Hz ตอน <=3s
    let lastMiniLeft = 999;
    root.addEventListener('quest:update', (ev)=>{
      const d = ev?.detail || {};
      const left = Number(d.miniTimeLeftSec ?? 0);

      if (!Number.isFinite(left) || left <= 0) { lastMiniLeft = 999; return; }

      // เมื่อเลขลดลงผ่าน threshold
      if (left <= 3 && left !== lastMiniLeft){
        if (left <= 2){
          if (gate('urgent2', 240)) tick(); // ~2Hz
        }else{
          if (gate('urgent3', 520)) tick(); // ~1Hz
        }
      }
      lastMiniLeft = left;
    }, { passive:true });

    // (5) key toggle mute
    root.addEventListener('keydown', (e)=>{
      if (!e) return;
      const k = String(e.key||'').toLowerCase();
      if (k === 'm'){
        setEnabled(!enabled);
        try{
          root.dispatchEvent(new CustomEvent('hha:judge', { detail:{ kind:'good', text: enabled ? 'SFX ON' : 'SFX OFF' } }));
        }catch{}
      }
    }, true);
  }

  // ---- auto-unlock on first gesture (มือถือ/VR) ----
  function bindUnlock(){
    if (bindUnlock._done) return;
    bindUnlock._done = true;

    const fn = ()=>{
      unlock();
      root.removeEventListener('pointerdown', fn, true);
      root.removeEventListener('touchstart', fn, true);
      root.removeEventListener('keydown', fn, true);
    };
    root.addEventListener('pointerdown', fn, true);
    root.addEventListener('touchstart', fn, true);
    root.addEventListener('keydown', fn, true);
  }

  // init
  bindUnlock();
  bindAuto();

  // export
  NS.Audio = { unlock, setEnabled, tick, good, bad, boss, storm, overdrive };

})(typeof window !== 'undefined' ? window : globalThis);