/* CSAI2102 AI Quest — AR Runtime v4.0.1
   Visible in-session launcher for S1 and S2.
   Loads AR engines only after the learner presses an AR Practice button.
*/
(() => {
  'use strict';

  const VERSION = '4.0.1';
  const loaded = new Map();
  const state = { active:false, paused:false, mode:'', bootPromise:null, streams:new Set(), rafIds:new Set(), cleanups:new Set(), media:null, raf:null, caf:null, lastAt:0 };
  const q = (selector) => document.querySelector(selector);
  const small = () => window.matchMedia?.('(max-width:860px)').matches;

  function route(){
    const params = new URLSearchParams(location.search);
    const session = String(params.get('session') || params.get('mission') || '').toLowerCase();
    const ar = String(params.get('ar') || '').toLowerCase();
    if (!ar) return '';
    if (session === 's1' || session === 'm1') return 's1';
    if (session === 's2' || session === 'm2') return 's2';
    return '';
  }

  function constraints(input){
    const target = small() ? {width:640,height:480,fps:24} : {width:800,height:600,fps:30};
    const video = typeof input === 'object' ? Object.assign({}, input) : {};
    if (!video.width || !video.width.exact) video.width = {ideal:target.width,max:960};
    if (!video.height || !video.height.exact) video.height = {ideal:target.height,max:720};
    if (!video.frameRate || !video.frameRate.exact) video.frameRate = {ideal:target.fps,max:30};
    if (!video.facingMode) video.facingMode = 'user';
    return video;
  }

  function script(src){
    const full = new URL(src, document.baseURI).href;
    if (loaded.has(full)) return loaded.get(full);
    const promise = new Promise((resolve,reject) => {
      const known = [...document.scripts].find(node => node.src === full);
      const tag = known || document.createElement('script');
      const done = () => { tag.dataset.aiquestArLoaded = '1'; resolve(); };
      const fail = () => reject(new Error('AR module not found: ' + src));
      if (known?.dataset.aiquestArLoaded === '1') return done();
      tag.addEventListener('load', done, {once:true});
      tag.addEventListener('error', fail, {once:true});
      if (!known) { tag.src = src; tag.async = false; tag.dataset.aiquestArRuntime = VERSION; document.body.appendChild(tag); }
    });
    loaded.set(full,promise);
    return promise;
  }

  function dispatch(name, detail){
    window.dispatchEvent(new CustomEvent(name,{detail:Object.assign({version:VERSION,mode:state.mode},detail||{})}));
  }

  function installGuards(){
    if (!state.media && navigator.mediaDevices?.getUserMedia) {
      state.media = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (input) => {
        const stream = await state.media({video:constraints(input?.video),audio:false});
        if (state.active) state.streams.add(stream);
        return stream;
      };
    }
    if (!state.raf && window.requestAnimationFrame) {
      state.raf = window.requestAnimationFrame.bind(window);
      state.caf = window.cancelAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) => {
        let id = 0;
        id = state.raf((stamp) => { state.rafIds.delete(id); callback(stamp); });
        if (state.active) state.rafIds.add(id);
        return id;
      };
      window.cancelAnimationFrame = (id) => { state.rafIds.delete(id); return state.caf(id); };
    }
  }

  function restoreGuards(){
    if (state.media && navigator.mediaDevices) { navigator.mediaDevices.getUserMedia = state.media; state.media = null; }
    if (state.raf) { window.requestAnimationFrame = state.raf; window.cancelAnimationFrame = state.caf; state.raf = null; state.caf = null; }
  }

  function closeKnownAr(){
    try { window.AIQUEST_S1_AR_PRACTICE?.close?.(); } catch (_) {}
    const s1 = document.getElementById('s1ar368');
    if (s1) s1.classList.remove('open');
    const s2 = document.getElementById('s2ar387');
    if (s2) s2.style.display = 'none';
  }

  function release(reason){
    state.cleanups.forEach(fn => { try { fn(reason); } catch (_) {} });
    state.cleanups.clear();
    state.rafIds.forEach(id => { try { state.caf?.(id); } catch (_) {} });
    state.rafIds.clear();
    state.streams.forEach(stream => { try { stream.getTracks().forEach(track => track.stop()); } catch (_) {} });
    state.streams.clear();
    document.querySelectorAll('video[data-aiquest-ar],#s1video368,#s2v387').forEach(video => { try { video.pause(); video.srcObject = null; } catch (_) {} });
    closeKnownAr();
    restoreGuards();
  }

  function leave(reason='leave'){
    if (!state.active && !state.bootPromise) return;
    dispatch('aiquest:ar-stop',{reason});
    state.active = false; state.paused = false; release(reason); state.mode = ''; state.bootPromise = null;
  }

  function pause(reason='hidden'){
    if (!state.active || state.paused) return;
    state.paused = true;
    document.querySelectorAll('#s1video368,#s2v387').forEach(video => { try { video.pause(); } catch (_) {} });
    dispatch('aiquest:ar-pause',{reason});
  }

  function resume(reason='visible'){
    if (!state.active || !state.paused) return;
    state.paused = false;
    document.querySelectorAll('#s1video368,#s2v387').forEach(video => { if (video.srcObject) video.play().catch(()=>{}); });
    dispatch('aiquest:ar-resume',{reason});
  }

  function shouldProcessFrame(fps){
    if (!state.active || state.paused) return false;
    const cap = Math.max(12,Math.min(Number(fps)|| (small()?18:24),30));
    const now = performance.now();
    if (now-state.lastAt < 1000/cap) return false;
    state.lastAt = now;
    return true;
  }

  async function boot(forced){
    const mode = forced || route();
    if (!mode) return false;
    if (state.active && state.mode === mode && state.bootPromise) return state.bootPromise;
    if (state.active && state.mode !== mode) leave('switch-session');
    state.active = true; state.paused = false; state.mode = mode; state.lastAt = 0;
    installGuards();

    const modules = mode === 's1'
      ? [
          './js/aiquest-s1-ar-practice-v364.js?v=20260628-s1ar401',
          './js/aiquest-s1-ar-hand-hotfix-v364.js?v=20260628-s1hand401',
          './js/aiquest-s1-ar-result-bridge-v369.js?v=20260628-s1result401'
        ]
      : [
          './aiquest-s2-ar-practice-v387.js?v=20260628-s2ar401'
        ];

    state.bootPromise = (async () => {
      try {
        for (const item of modules) await script(item);
        dispatch('aiquest:ar-ready',{profile:constraints({})});
        return true;
      } catch (error) {
        console.error('[AIQuest AR] boot failed',error);
        leave('boot-failed');
        throw error;
      }
    })();
    return state.bootPromise;
  }

  function sessionFromUi(){
    const heading = String(document.getElementById('gameHeading')?.textContent || '').toLowerCase();
    if (heading.includes('ai awakening') || /^\s*1\s*:/.test(heading)) return 's1';
    if (heading.includes('agent builder') || /^\s*2\s*:/.test(heading)) return 's2';
    return '';
  }

  function arOpen(){
    if (document.getElementById('s1ar368')?.classList.contains('open')) return true;
    const s2 = document.getElementById('s2ar387');
    return Boolean(s2 && getComputedStyle(s2).display !== 'none');
  }

  function waitFor(fn){
    const started = Date.now();
    return new Promise((resolve,reject) => {
      const tick = () => {
        const value = fn();
        if (value) return resolve(value);
        if (Date.now()-started > 7000) return reject(new Error('AR practice module timed out'));
        setTimeout(tick,80);
      };
      tick();
    });
  }

  async function startPractice(mode, button){
    if (button?.dataset.busy === '1') return;
    const original = button?.textContent || '';
    if (button) { button.dataset.busy='1'; button.disabled=true; button.textContent='กำลังเตรียม AR…'; }
    try {
      await boot(mode);
      const practice = mode === 's1'
        ? await waitFor(() => window.AIQUEST_S1_AR_PRACTICE)
        : await waitFor(() => window.AIQUEST_S2_AR_PRACTICE);
      await practice.start();
    } catch (error) {
      console.error('[AIQuest AR] start failed',error);
      if (button) { button.disabled=false; button.textContent=original; }
    } finally {
      if (button) delete button.dataset.busy;
    }
  }

  function addLauncher(){
    if (arOpen()) return;
    const mode = sessionFromUi();
    const area = document.getElementById('gameArea');
    if (!mode || !area) return;
    const id = 'aiquestArLauncherV401';
    const old = document.getElementById(id);
    if (old?.dataset.mode === mode) return;
    old?.remove();
    const s1 = mode === 's1';
    const card = document.createElement('section');
    card.id=id; card.dataset.mode=mode;
    card.style.cssText='margin:0 0 14px;padding:14px 16px;border:1px solid rgba(103,232,249,.44);border-radius:20px;background:linear-gradient(135deg,rgba(20,184,166,.15),rgba(124,58,237,.14));display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap';
    const copy=document.createElement('div'); copy.style.cssText='min-width:220px;flex:1';
    const title=document.createElement('b'); title.style.fontSize='16px'; title.textContent=s1?'✋ S1 AR Practice: AI Object Scanner':'🧩 S2 AR Practice: Agent Builder';
    const desc=document.createElement('div'); desc.style.cssText='margin-top:5px;color:#dbeafe;font-size:13px;line-height:1.5'; desc.textContent=s1?'ใช้มือชี้ค้าง หรือแตะ/คลิก เพื่อแยก AI, Automation, Sensor, Rule-based และ Prediction':'ใช้มือชี้ค้าง หรือแตะ/คลิก เพื่อฝึก PEAS, percept, actuator, environment และ rational agent';
    const note=document.createElement('div'); note.style.cssText='margin-top:7px;color:#bbf7d0;font-size:12px;font-weight:800'; note.textContent='กิจกรรมเสริม • ไม่เปลี่ยนคะแนนหรือการปลดล็อก Session หลัก';
    copy.append(title,desc,note);
    const button=document.createElement('button'); button.type='button'; button.textContent=s1?'เริ่ม S1 AR Practice':'เริ่ม S2 AR Practice'; button.style.cssText='border:0;border-radius:15px;padding:12px 16px;background:linear-gradient(135deg,#a7f3d0,#67e8f9);color:#06223a;font-weight:1000;cursor:pointer'; button.onclick=()=>startPractice(mode,button);
    card.append(copy,button); area.insertAdjacentElement('afterbegin',card);
  }

  function installLauncher(){
    let timer=0;
    const refresh=()=>{ clearTimeout(timer); timer=setTimeout(addLauncher,30); };
    const area=document.getElementById('gameArea');
    if(area && !area.dataset.aiquestArLauncherObserved){
      area.dataset.aiquestArLauncherObserved='1';
      new MutationObserver(refresh).observe(area,{childList:true,subtree:false});
    }
    window.addEventListener('aiquest:ar-stop',refresh);
    refresh();
  }

  window.AIQuestARRuntime = Object.freeze({
    version:VERSION, boot, leave, pause, resume, shouldProcessFrame,
    getCameraConstraints:constraints,
    registerCleanup:(fn)=>{ if(typeof fn!=='function') return ()=>{}; state.cleanups.add(fn); return ()=>state.cleanups.delete(fn); },
    registerVideo:(video)=>{ if(video){video.dataset.aiquestAr='1'; if(video.srcObject?.getTracks) state.streams.add(video.srcObject);} return ()=>{}; },
    isActive:()=>state.active, isPaused:()=>state.paused, getMode:()=>state.mode
  });

  document.addEventListener('visibilitychange',()=>document.hidden?pause('visibilitychange'):resume('visibilitychange'));
  window.addEventListener('pagehide',()=>leave('pagehide'));
  window.addEventListener('beforeunload',()=>leave('beforeunload'));
  const begin=()=>{ installLauncher(); boot().catch(()=>{}); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',begin,{once:true}); else begin();
})();
