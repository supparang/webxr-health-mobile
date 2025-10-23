/* games/rhythm-boxer/game.js
   Rhythm Boxer · game.js (Fix UI Clicks: stop ray on UI, z-index/pointer-events, touch-action; Hit-Line Glow + Judge + Hit-Assist + Speed Ramp + Safe Remove + Back-to-Hub fix)
*/
(function () {
  "use strict";

  // ===== Helpers
  const byId = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const RND = () => Math.random();
  function safeRemove(el){ try{ if(!el) return; if(el.parentNode) el.parentNode.removeChild(el); else if(el.remove) el.remove(); }catch(_){} }

  // Paths
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  const HUB_URL = `${ASSET_BASE}/vr-fitness/`;

  // ===== Audio
  const SFXN = (p)=>{ const a=new Audio(p); a.onerror=()=>console.warn('SFX not found:',p); return a; };
  const SFX = {
    hit: SFXN(`${ASSET_BASE}/assets/sfx/slash.wav`),
    perfect: SFXN(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss: SFXN(`${ASSET_BASE}/assets/sfx/miss.wav`),
    good: SFXN(`${ASSET_BASE}/assets/sfx/laser.wav`),
    combo: SFXN(`${ASSET_BASE}/assets/sfx/combo.wav`),
    ui: SFXN(`${ASSET_BASE}/assets/sfx/success.wav`),
  };
  const lastPlay = new Map();
  function play(a, guardMs=80){ try{ const now=performance.now(); if(lastPlay.get(a)&&now-lastPlay.get(a)<guardMs) return; a.currentTime=0; lastPlay.set(a,now); if(a.paused) a.play(); }catch(_){} }

  // ===== State
  let running=false, paused=false;
  let spawnTimer=null, secTimer=null;
  let score=0, combo=0, maxCombo=0, timeLeft=60;

  const notes=[]; // {el, speed, judged}
  const COLORS=["#20ffa0","#9bd1ff","#ffd166","#ff6b6b","#a899ff"];
  let colorIndex=0;

  const HIT_Y=1.00;
  let hitLine=null;

  // Speed profiles
  const SPEED_MODE={
    beginner:  {fall:0.72, spawn:1100, rampEachSec:0.0008, title:'Beginner'},
    standard:  {fall:0.90, spawn:900,  rampEachSec:0.0012, title:'Standard'},
    challenge: {fall:1.05, spawn:760,  rampEachSec:0.0018, title:'Challenge'},
  };
  let SP=SPEED_MODE.standard, speedMul=1.0;

  // Judge window (กว้างขึ้น)
  const JUDGE={ perfect:0.12, good:0.22, late:0.30 };

  // ===== UI
  function updateHUD(){ byId('score')&&(byId('score').textContent=score); byId('combo')&&(byId('combo').textContent=combo); byId('time')&&(byId('time').textContent=timeLeft); }
  function badge(msg){
    let el=byId('rbToast'); if(!el){ el=document.createElement('div'); el.id='rbToast';
      Object.assign(el.style,{position:'fixed',left:'50%',top:'10px',transform:'translateX(-50%)',background:'rgba(10,16,24,.8)',color:'#e6f7ff',font:'700 13px system-ui',padding:'8px 12px',borderRadius:'12px',zIndex:'10020',opacity:'0',transition:'opacity .12s, transform .12s'}); document.body.appendChild(el); }
    el.textContent=msg; el.style.opacity='1'; el.style.transform='translateX(-50%) scale(1.03)'; clearTimeout(el._t); el._t=setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(-50%) scale(1)'; }, 900);
  }
  function ensureJudgeUI(){
    let box=document.getElementById('rbJudge'); if(box) return box;
    box=document.createElement('div'); box.id='rbJudge';
    Object.assign(box.style,{position:'fixed',left:'50%',top:'18%',transform:'translateX(-50%)',color:'#e6f7ff',font:'900 42px/1.0 system-ui, Arial',letterSpacing:'1px',padding:'6px 14px',borderRadius:'12px',background:'rgba(0,0,0,.25)',textShadow:'0 2px 8px rgba(0,0,0,.45)',opacity:'0',transition:'opacity .12s, transform .12s',zIndex:10020,pointerEvents:'none'}); document.body.appendChild(box); return box;
  }
  function showJudge(kind){
    const box=ensureJudgeUI();
    const map={perfect:['PERFECT','#20ffa0'], good:['GOOD','#9bd1ff'], miss:['MISS','#ff5577'], late:['LATE','#ffd166']};
    const [txt,col]=map[kind]||map.good;
    box.textContent=txt; box.style.color=col; box.style.opacity='1'; box.style.transform='translateX(-50%) scale(1.04)'; clearTimeout(box._t);
    box._t=setTimeout(()=>{ box.style.opacity='0'; box.style.transform='translateX(-50%) scale(1.0)'; },420);
  }

  // ===== Hit Line
  function ensureHitLine(){
    if(hitLine && hitLine.parentNode) return hitLine;
    const arena=byId('arena'); if(!arena) return null;
    const line=document.createElement('a-entity');
    line.setAttribute('geometry','primitive: box; width: 2.8; height: 0.02; depth: 0.02');
    line.setAttribute('material','color:#20ffa0; opacity:0.95; emissive:#20ffa0; emissiveIntensity:0.85; transparent:true');
    line.setAttribute('position',`0 ${HIT_Y} -2.2`);
    line.setAttribute('animation__pulse','property: scale; dir: alternate; to: 1.02 1.2 1.02; loop: true; dur: 850; easing: easeInOutSine');
    arena.appendChild(line); hitLine=line; return line;
  }
  function flashHitLine(kind){
    const ln=ensureHitLine(); if(!ln) return;
    const c= kind==='perfect'?'#20ffa0':(kind==='miss'?'#ff5577':'#9bd1ff');
    ln.setAttribute('material',`color:${c}; opacity:1; emissive:${c}; emissiveIntensity:1.1; transparent:true`);
    setTimeout(()=>{ ln.setAttribute('material','color:#20ffa0; opacity:0.95; emissive:#20ffa0; emissiveIntensity:0.85; transparent:true'); },120);
  }

  // ===== Notes
  function spawnNote(){
    const arena=byId('arena'); if(!arena) return;
    const x=(RND()*2.6-1.3).toFixed(2), y=2.2, z=-2.2;
    const el=document.createElement('a-sphere');
    const color=COLORS[colorIndex++%COLORS.length];
    el.classList.add('rb-note','clickable');
    el.setAttribute('radius','0.16');
    el.setAttribute('material',`color:${color}; metalness:.2; roughness:.35; emissive:${color}; emissiveIntensity:.25`);
    el.setAttribute('position',`${x} ${y} ${z}`);
    arena.appendChild(el);
    notes.push({ el, speed: SP.fall*speedMul, judged:false });
  }
  function missNote(i){
    const n=notes[i]; if(!n) return;
    n.judged=true; showJudge('miss'); flashHitLine('miss'); play(SFX.miss);
    combo=0; updateHUD(); safeRemove(n.el);
  }
  function applyHit(i,kind){
    const n=notes[i]; if(!n) return; n.judged=true;
    if(kind==='perfect'){ score+=30; play(SFX.perfect); }
    else if(kind==='good'){ score+=18; play(SFX.good); }
    else { score+=8; play(SFX.hit); }
    combo++; if(combo>maxCombo) maxCombo=combo; updateHUD();
    showJudge(kind); flashHitLine(kind); safeRemove(n.el);
  }
  function judgeFromDy(dy){
    if(dy<=JUDGE.perfect) return 'perfect';
    if(dy<=JUDGE.good) return 'good';
    if(dy<=JUDGE.late) return 'late';
    return 'miss';
  }

  // ===== Loop
  function loopMove(){
    if(!running || paused) return;
    for(let i=notes.length-1;i>=0;i--){
      const n=notes[i]; if(!n||!n.el||n.judged) continue;
      const o=n.el.object3D.position;
      o.y -= 0.014 * n.speed; // ความเร็วตก
      n.el.object3D.position.set(o.x,o.y,o.z);
      if(o.y < HIT_Y-0.4 && !n.judged){ missNote(i); }
    }
    requestAnimationFrame(loopMove);
  }
  function startSpawn(){
    const base=SP.spawn;
    const interval=clamp(Math.round(base / speedMul), 500, 1400);
    clearInterval(spawnTimer);
    spawnTimer=setInterval(spawnNote, interval);
  }

  // ===== Start/Pause/End
  function resetGame(){
    clearInterval(spawnTimer); clearInterval(secTimer);
    const arena=byId('arena');
    if(arena){ Array.from(arena.querySelectorAll('.rb-note')).forEach(safeRemove); safeRemove(hitLine); hitLine=null; }
    notes.length=0; score=0; combo=0; maxCombo=0; timeLeft=60; speedMul=1.0; updateHUD();
    const res=byId('results'); if(res) res.style.display='none';
  }
  function startGame(){
    if(running) return; running=true; paused=false;
    const sel=byId('speedSel'); const key=(sel&&sel.value)||'standard';
    SP=SPEED_MODE[key]||SPEED_MODE.standard;
    resetGame(); ensureHitLine(); badge(`Start · ${SP.title}`); play(SFX.ui);
    secTimer=setInterval(()=>{ if(!running||paused) return; timeLeft--; speedMul=clamp(speedMul+SP.rampEachSec,1.0,2.0); startSpawn(); updateHUD(); if(timeLeft<=0) endGame(); },1000);
    startSpawn(); requestAnimationFrame(loopMove);
  }
  function pauseGame(){
    if(!running) return; paused=!paused; badge(paused?'Paused':'Resume'); play(SFX.ui);
    if(paused) clearInterval(spawnTimer); else { startSpawn(); requestAnimationFrame(loopMove); }
  }
  function endGame(){
    running=false; clearInterval(spawnTimer); clearInterval(secTimer);
    const res=byId('results'); if(res) res.style.display='flex';
    byId('rScore')&&(byId('rScore').textContent=score);
    byId('rMaxCombo')&&(byId('rMaxCombo').textContent=maxCombo);
    const total=Math.max(1, notes.length); const acc=Math.max(0, Math.min(100, Math.round((score/(total*30))*100)));
    byId('rAcc')&&(byId('rAcc').textContent = acc+'%'); play(SFX.ui);
  }

  // ===== Pointer Raycast (Mouse/Touch) — ป้องกัน “กินคลิก” บน UI
  (function installPointer(){
    const sceneEl=document.querySelector('a-scene'); if(!sceneEl) return;
    const raycaster=new THREE.Raycaster(); const mouse=new THREE.Vector2();

    function isClickOnUI(target){
      return !!(target && (target.closest('.ui') || target.closest('button') || target.closest('select') || target.id==='rbToast' || target.id==='rbJudge'));
    }

    function pick(clientX, clientY){
      const cam=sceneEl.camera; if(!cam) return [];
      mouse.x = (clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, cam);
      const clickable=Array.from(document.querySelectorAll('.clickable')).map(el=>el.object3D).filter(Boolean);
      const objects=[]; clickable.forEach(o=>o.traverse(c=>objects.push(c)));
      return raycaster.intersectObjects(objects, true);
    }

    function hitAssistFromScreen(x, y){
      // ยิง ray ก่อน
      const hits=pick(x,y);
      // เลือกโน้ตที่ใกล้ HIT_Y ที่สุดจากผล ray
      let bestIdx=-1, bestDy=1e9;
      for(const h of hits){
        let obj=h.object; while(obj && !obj.el) obj=obj.parent;
        if(!obj||!obj.el||!obj.el.classList.contains('rb-note')) continue;
        const idx=notes.findIndex(it=>it.el===obj.el); if(idx<0||notes[idx].judged) continue;
        const pos=obj.el.object3D.getWorldPosition(new THREE.Vector3());
        const dy=Math.abs(pos.y - HIT_Y);
        if(dy<bestDy){ bestDy=dy; bestIdx=idx; }
      }
      // ไม่เจอจาก ray → ช่วยหาใกล้สุดทั้งฉาก
      if(bestIdx<0){
        for(let i=0;i<notes.length;i++){
          const n=notes[i]; if(!n||!n.el||n.judged) continue;
          const p=n.el.object3D.getWorldPosition(new THREE.Vector3());
          const dy=Math.abs(p.y - HIT_Y);
          if(dy<bestDy){ bestDy=dy; bestIdx=i; }
        }
      }
      if(bestIdx>=0){
        const kind=judgeFromDy(bestDy);
        if(kind!=='miss') applyHit(bestIdx, kind);
      }
    }

    window.addEventListener('mousedown', (e)=>{
      if(isClickOnUI(e.target)) return;         // <— สำคัญ: ถ้าเป็นปุ่ม/เมนู ให้ผ่านไป
      if(!running||paused) return;
      hitAssistFromScreen(e.clientX, e.clientY);
    }, {passive:true});

    window.addEventListener('touchstart', (e)=>{
      const t=e.touches && e.touches[0]; if(!t) return;
      const target = document.elementFromPoint(t.clientX, t.clientY);
      if(isClickOnUI(target)) return;           // <— กัน UI โดน ray
      if(!running||paused) return;
      hitAssistFromScreen(t.clientX, t.clientY);
    }, {passive:true});
  })();

  // ===== Buttons
  function wireButtons(){
    byId('startBtn')?.addEventListener('click', startGame, {passive:true});
    byId('pauseBtn')?.addEventListener('click', pauseGame, {passive:true});
    byId('replayBtn')?.addEventListener('click', startGame, {passive:true});
    byId('backBtn')?.addEventListener('click', ()=>{ window.location.href = HUB_URL; }, {passive:true});
    byId('speedSel')?.addEventListener('change', ()=>{
      const sel=byId('speedSel'); const key=(sel&&sel.value)||'standard'; const title=(SPEED_MODE[key]?.title)||'Standard';
      badge(`Speed: ${title}`); play(SFX.ui);
    }, {passive:true});
  }

  // ===== Enter VR กลางล่าง
  (function mountVRButton(){
    if(document.getElementById('enterVRBtn')) return;
    const btn=document.createElement('button'); btn.id='enterVRBtn';
    btn.textContent='Enter VR';
    Object.assign(btn.style,{position:'fixed',left:'50%',transform:'translateX(-50%)',bottom:'12px',zIndex:10010,padding:'8px 12px',borderRadius:'10px',border:'0',background:'#0e2233',color:'#e6f7ff',cursor:'pointer',touchAction:'manipulation'});
    btn.classList.add('ui');
    document.body.appendChild(btn);
    btn.addEventListener('click', ()=>{ try{ const sc=document.querySelector('a-scene'); sc?.enterVR?.(); }catch(e){ console.warn(e); } }, {passive:true});
  })();

  // ===== Lifecycle
  document.addEventListener('DOMContentLoaded', ()=>{
    wireButtons(); ensureHitLine(); updateHUD();
  });
  document.addEventListener('keydown',(e)=>{
    if(e.key===' '||e.key==='Enter'){
      // ช่วย hit กลางจอ (แต่ไม่ไปกิน UI)
      const x=window.innerWidth/2, y=(window.innerHeight*3)/4;
      const target=document.elementFromPoint(x,y);
      if(target && (target.closest('.ui')||target.closest('button')||target.closest('select'))) return;
      if(!running||paused) return;
      // ยิงช่วย
      const ev=new MouseEvent('mousedown',{clientX:x,clientY:y});
      window.dispatchEvent(ev);
    } else if(e.key==='p'||e.key==='P'){ pauseGame(); }
    else if(e.key==='s'||e.key==='S'){ startGame(); }
  });
  window.addEventListener('beforeunload', ()=>{ try{ clearInterval(spawnTimer); clearInterval(secTimer); }catch(_){} });
})();
