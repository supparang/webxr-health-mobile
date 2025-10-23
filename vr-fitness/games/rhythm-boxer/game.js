/* games/rhythm-boxer/game.js
   Rhythm Boxer · Song Select + BPM Sync + Slower start → ramp up + Big colorful notes + Neon HIT LINE + Good/Perfect/Miss + Clickable buttons + Correct Hub link
*/
(function(){
  "use strict";

  // -------------------- Helpers / Paths --------------------
  const byId = (id)=>document.getElementById(id);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  const HUB_URL = ASSET_BASE + '/';

  // -------------------- Songs (เพิ่ม/แก้พาธไฟล์ตามจริงได้) --------------------
  // noteOffset: ms ก่อนเริ่มนับจังหวะ (เผื่อ latency)
  // bpm: ใช้คำนวณช่วงโน้ต (1/2 beat, 1/1 beat ฯลฯ)
  const SONGS = [
    { id:'pulse',   title:'Neon Pulse',   file:`${ASSET_BASE}/assets/music/rb_pulse.mp3`,   bpm:120, offset:300 },
    { id:'rush',    title:'Sky Rush',     file:`${ASSET_BASE}/assets/music/rb_sky_rush.mp3`, bpm:135, offset:260 },
    { id:'mirror',  title:'Mirror Drive', file:`${ASSET_BASE}/assets/music/rb_mirror.mp3`,   bpm:150, offset:220 },
  ];

  // เติม <option> ในหน้า
  (function fillSongSelect(){
    const sel = byId('songSel');
    if(!sel) return;
    const last = localStorage.getItem('rb_song') || 'pulse';
    sel.innerHTML = SONGS.map(s=>`<option value="${s.id}">${s.title} (${s.bpm} BPM)</option>`).join('');
    sel.value = SONGS.find(s=>s.id===last) ? last : 'pulse';
  })();

  // -------------------- Difficulty / Speed preset --------------------
  const url = new URL(location.href);
  const DIFF_KEY   = (url.searchParams.get('diff')   || localStorage.getItem('rb_diff')   || 'normal').toLowerCase();
  const SPEED_VER  = (url.searchParams.get('speed')  || localStorage.getItem('rb_speed')  || 'standard').toLowerCase();
  const SONG_ID    = (url.searchParams.get('song')   || localStorage.getItem('rb_song')   || 'pulse').toLowerCase();

  const DIFF_PRESET = {
    beginner: { speedMul: 0.85, windowMul: 1.25, rampSecs: 80 },
    standard: { speedMul: 1.00, windowMul: 1.00, rampSecs: 60 },
    challenge:{ speedMul: 1.15, windowMul: 0.85, rampSecs: 45 }
  };
  const PRESET = DIFF_PRESET[SPEED_VER] || DIFF_PRESET.standard;

  // -------------------- Scene / Visual --------------------
  const LANES = [-1.2, -0.4, 0.4, 1.2];
  const HIT_LINE_Y = 1.0;
  const SPAWN_Y = 3.0;
  const NOTE_RADIUS = 0.25;
  const NOTE_COLORS = ['#00e5ff','#ff7a66','#ffd166','#8cff66','#c792ea','#00ffa3'];

  // Ramp / windows / gaps
  const SPEED_BASE = 0.75, SPEED_MAX = 2.2, RAMP_SECS_DEFAULT = 60;
  const HIT_WINDOW = { perfect: 0.18, good: 0.30 };
  const START_GAP = 900, END_GAP = 340, GAP_RAMP_SECS = 60;

  // SFX
  const SFXN = (p)=>{ const a=new Audio(p); a.onerror=()=>console.warn('SFX not found:',p); return a; };
  const SFX = {
    hitGood:    SFXN(`${ASSET_BASE}/assets/sfx/slash.wav`),
    hitPerfect: SFXN(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss:       SFXN(`${ASSET_BASE}/assets/sfx/miss.wav`),
    start:      SFXN(`${ASSET_BASE}/assets/sfx/success.wav`),
    combo:      SFXN(`${ASSET_BASE}/assets/sfx/combo.wav`)
  };

  // -------------------- State --------------------
  let sceneEl=null, hitLineEl=null, audioEl=null, currentSong=null;
  let running=false, paused=false;
  let score=0, combo=0, maxCombo=0, total=0, hitCount=0;
  let spawnTimer=null, hudTimer=null;
  let tStart=0, rngSeed=Date.now()>>>0;

  // -------------------- Utils --------------------
  function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
  function RND(){ rngSeed = (rngSeed*1664525 + 1013904223)>>>0; return (rngSeed & 0x7fffffff)/0x80000000; }
  function ramp01(){
    const t = (performance.now() - tStart)/1000;
    const rampSecs = PRESET.rampSecs || RAMP_SECS_DEFAULT;
    return clamp(t / rampSecs, 0, 1);
  }
  function speedNow(){
    const r = ramp01();
    const s = SPEED_BASE + (SPEED_MAX - SPEED_BASE) * r;
    return s * (PRESET.speedMul || 1);
  }
  function windowNow(){
    const mul = PRESET.windowMul || 1;
    return { perfect: HIT_WINDOW.perfect*mul, good: HIT_WINDOW.good*mul };
  }
  function gapNow(){
    const r = clamp((performance.now()-tStart)/1000 / (GAP_RAMP_SECS), 0, 1);
    const gap = START_GAP + (END_GAP - START_GAP)*r;
    return Math.max(220, gap);
  }
  function addScore(v){ score += Math.round(v); updateHUD(); }
  function setBadge(msg){
    let el=byId('toast'); if(!el){
      el=document.createElement('div'); el.id='toast'; document.body.appendChild(el);
      Object.assign(el.style,{position:'fixed',left:'50%',top:'10px',transform:'translateX(-50%)',background:'rgba(0,0,0,.7)',color:'#e6f7ff',padding:'8px 12px',borderRadius:'10px',font:'600 13px system-ui',zIndex:9999});
    }
    el.textContent=msg; el.style.opacity='1'; setTimeout(()=>{ el.style.opacity='0'; }, 900);
  }

  // -------------------- HUD --------------------
  function updateHUD(){
    byId('score')&&(byId('score').textContent=score);
    byId('combo')&&(byId('combo').textContent=combo);
    byId('acc')&&(byId('acc').textContent= total? (Math.round(hitCount/total*100)+'%') : '0%');
    byId('diffNow')&&(byId('diffNow').textContent=DIFF_KEY.toUpperCase());
    byId('spdNow')&&(byId('spdNow').textContent=SPEED_VER.charAt(0).toUpperCase()+SPEED_VER.slice(1));
    byId('songNow')&&(byId('songNow').textContent=(currentSong?.title||'—'));
  }
  function onComboChange(){
    if(combo>0 && combo%10===0){ SFX.combo.play?.(); setBadge('Combo x'+(1+Math.floor(combo/10))); }
    if(combo>maxCombo) maxCombo=combo;
  }

  // -------------------- A-Frame Components --------------------
  function ensureScene(){
    sceneEl = document.querySelector('a-scene');
  }
  function buildHitLine(){
    if(!sceneEl) return;
    if(byId('hitLine')) return;
    const g=document.createElement('a-entity');
    g.setAttribute('id','hitLine');
    g.setAttribute('position', `0 ${HIT_LINE_Y} -2.4`);
    g.setAttribute('geometry','primitive: plane; width: 3.0; height: 0.02');
    g.setAttribute('material','color:#00ffa3; opacity:.85; shader:flat');
    g.setAttribute('animation__glow','property: material.opacity; dir: alternate; to: 1; loop:true; dur:650; easing:easeInOutSine');
    sceneEl.appendChild(g);
    hitLineEl=g;
  }

  AFRAME.registerComponent('rb-note',{
    schema:{ lane:{type:'int',default:0}, speed:{type:'number',default:1}, color:{type:'string',default:'#00e5ff'}, shape:{type:'string',default:'circle'} },
    init(){
      const el=this.el, d=this.data;
      if(d.shape==='diamond') el.setAttribute('geometry',{primitive:'octahedron', radius:NOTE_RADIUS});
      else el.setAttribute('geometry',{primitive:'sphere', radius:NOTE_RADIUS});
      el.setAttribute('material',{color:d.color, opacity:.95, shader:'flat'});
      el.setAttribute('class','rb-note clickable');
      el.setAttribute('position', `${LANES[d.lane] || 0} ${SPAWN_Y} -2.4`);
      el.addEventListener('click', ()=>{ tryHit(el, true); });
      this.dead=false;
    },
    tick(time,dt){
      if(this.dead) return;
      const el=this.el, d=this.data, pos=el.object3D.position;
      pos.y -= (d.speed * (dt/1000));
      if(pos.y <= HIT_LINE_Y - 0.8){
        miss(el); this.dead=true; el.parentNode && el.parentNode.removeChild(el);
      }
    }
  });

  // -------------------- Spawner : BPM sync --------------------
  // สร้างแพทเทิร์นง่าย ๆ จาก BPM: สุ่ม lane / สลับรูปทรง / สี / จังหวะ 1/1, 1/2, 3/4 beat
  function scheduleSongBeats(){
    if(!running || !currentSong) return;
    const bpm = currentSong.bpm;
    const beatMs = 60000 / bpm;
    const now = audioEl.currentTime * 1000;
    const base = now + 30; // เลื่อนล่วงหน้าเล็กน้อย

    // เลือก subdivision ตามเวลาที่ผ่านไป (เริ่ม 1/1 → 1/2 → สลับ 3/4)
    const prog = ramp01();
    let sub;
    if(prog < 0.33) sub = 1;       // ช่วงแรก โน้ตห่าง
    else if(prog < 0.66) sub = 2;  // กลางเพลง ถี่ขึ้นนิด
    else sub = (RND()<0.5? 2 : 1.5); // ปลายเพลง มี 1/2 กับ 2/3 (ประมาณ 3/4) สลับ

    const step = beatMs / sub;
    // สร้าง 1 ก้อนล่วงหน้า 1 ช่วง
    spawnBeatBatch(base, step);

    // วนต่อ
    spawnTimer = setTimeout(scheduleSongBeats, step);
  }
  function spawnBeatBatch(t0, step){
    if(!running || paused) return;
    // สุ่ม 1–3 โน้ตภายในช่วงเดียว เพื่อสร้าง “คอร์ด” บางครั้ง
    const notes = (RND()<0.15)? 2 : 1;
    for(let i=0;i<notes;i++){
      const lane = (Math.random()*LANES.length)|0;
      const shape = (RND()<0.5)? 'circle':'diamond';
      const col = NOTE_COLORS[(Math.random()*NOTE_COLORS.length)|0];
      spawnOne(lane, shape, col);
    }
    // บางครั้งสปินเพิ่มอีก 1 ตัวดีเลย์เล็กน้อย
    if(RND()<0.12){ setTimeout(()=>spawnOne((Math.random()*LANES.length)|0,(RND()<0.5?'circle':'diamond'), NOTE_COLORS[(Math.random()*NOTE_COLORS.length)|0]), step*0.5); }
  }

  function spawnOne(lane, shape, color){
    if(!running || paused) return;
    total++;
    const note=document.createElement('a-entity');
    sceneEl.appendChild(note);
    note.setAttribute('rb-note',{
      lane,
      speed: speedNow(),
      color,
      shape
    });
  }

  // -------------------- Hit detection --------------------
  function tryHit(el){
    if(!el || !el.parentNode) return;
    const pos = el.object3D.position;
    const dy = Math.abs(pos.y - HIT_LINE_Y);
    const W = windowNow();
    if(dy <= W.perfect){ onHit('perfect', el); }
    else if(dy <= W.good){ onHit('good', el); }
    else if(dy <= W.good + 0.08){ onHit('good', el); } // assist
    else setBadge('Too Early/Late');
  }
  function miss(el){
    combo=0; onComboChange(); SFX.miss.play?.();
    textFloat('MISS','#ff5577', el.object3D.position);
  }
  function onHit(kind, el){
    if(kind==='perfect'){ SFX.hitPerfect.play?.(); addScore(100); combo++; onComboChange(); textFloat('PERFECT','#00ffa3', el.object3D.position); }
    else { SFX.hitGood.play?.(); addScore(50); combo++; onComboChange(); textFloat('GOOD','#9bd1ff', el.object3D.position); }
    hitCount++;
    el.parentNode && el.parentNode.removeChild(el);
  }
  function textFloat(txt, color, worldPos){
    const e=document.createElement('a-entity');
    const p=worldPos.clone?worldPos.clone():new THREE.Vector3(worldPos.x,worldPos.y,worldPos.z);
    p.y+=0.15;
    e.setAttribute('text',{value:txt,color,align:'center',width:2.2});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__up',{property:'position',to:`${p.x} ${p.y+0.4} ${p.z}`,dur:550,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:450,delay:120,easing:'linear'});
    sceneEl.appendChild(e);
    setTimeout(()=>{ e.parentNode && e.parentNode.removeChild(e); }, 820);
  }

  // -------------------- Pointer Raycast --------------------
  function installPointerRaycast(){
    if(!sceneEl) return;
    const raycaster=new THREE.Raycaster();
    const mouse=new THREE.Vector2();
    function pick(cx,cy){
      if(!sceneEl?.camera) return;
      mouse.x =  (cx / window.innerWidth) * 2 - 1;
      mouse.y = -(cy / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, sceneEl.camera);
      const clickable = Array.from(document.querySelectorAll('.clickable')).map(el=>el.object3D).filter(Boolean);
      const objects=[]; clickable.forEach(o=>o.traverse(c=>objects.push(c)));
      const hits=raycaster.intersectObjects(objects,true);
      if(hits && hits.length){
        let obj=hits[0].object; while(obj && !obj.el) obj=obj.parent;
        if(obj?.el) obj.el.emit('click');
      }
    }
    window.addEventListener('mousedown', e=>pick(e.clientX,e.clientY), {passive:true});
    window.addEventListener('touchstart', e=>{ const t=e.touches&&e.touches[0]; if(!t) return; pick(t.clientX,t.clientY); }, {passive:true});
  }

  // -------------------- Flow --------------------
  function loadCurrentSong(){
    currentSong = SONGS.find(s=>s.id===SONG_ID) || SONGS[0];
    // เตรียม <audio>
    if(!audioEl){
      audioEl = new Audio();
      audioEl.preload = 'auto';
    }
    audioEl.src = currentSong.file;
  }
  function startGame(){
    if(running) return;
    running=true; paused=false;
    score=0; combo=0; maxCombo=0; total=0; hitCount=0;
    tStart = performance.now();
    updateHUD(); SFX.start.play?.();

    clearNotes();
    buildHitLine();

    // เริ่มเพลงหลัง offset
    audioEl.currentTime = 0;
    audioEl.play().catch(()=>{}); // บางเบราว์เซอร์ต้อง gesture ก่อน

    // รอ offset ก่อนเริ่มสปอนตาม BPM
    const offset = currentSong.offset || 0;
    if(spawnTimer) clearTimeout(spawnTimer);
    spawnTimer = setTimeout(scheduleSongBeats, offset);

    if(hudTimer) clearInterval(hudTimer);
    hudTimer = setInterval(updateHUD, 500);

    setBadge('START');
  }
  function pauseGame(){
    if(!running) return;
    paused=!paused;
    if(paused){ audioEl.pause(); setBadge('PAUSED'); }
    else { audioEl.play().catch(()=>{}); setBadge('RESUME'); }
  }
  function endGame(){
    if(!running) return;
    running=false; paused=false;
    if(spawnTimer) clearTimeout(spawnTimer);
    if(hudTimer) clearInterval(hudTimer);
    try{ audioEl.pause(); }catch(_){}
    const acc = total? Math.round(hitCount/total*100):0;
    const stars = (acc>=95?3: acc>=85?2: acc>=70?1: 0);
    const rBox=byId('results');
    if(rBox){
      byId('rSong')  && (byId('rSong').textContent = currentSong?.title||'-');
      byId('rScore') && (byId('rScore').textContent = score);
      byId('rCombo') && (byId('rCombo').textContent = maxCombo);
      byId('rAcc')   && (byId('rAcc').textContent   = acc+'%');
      byId('rStars') && (byId('rStars').textContent = '★'.repeat(stars)+'☆'.repeat(3-stars));
      rBox.style.display='flex';
    }
  }
  function clearNotes(){
    document.querySelectorAll('.rb-note').forEach(n=>{ n.parentNode && n.parentNode.removeChild(n); });
  }

  // -------------------- Buttons --------------------
  function wireButtons(){
    byId('startBtn')?.addEventListener('click', startGame, {passive:true});
    byId('pauseBtn')?.addEventListener('click', pauseGame, {passive:true});
    byId('endBtn')?.addEventListener('click', endGame, {passive:true});
    byId('backBtn')?.addEventListener('click', ()=>{ location.href = HUB_URL; }, {passive:true});
    byId('replayBtn')?.addEventListener('click', ()=>{ byId('results').style.display='none'; startGame(); }, {passive:true});
    byId('hubBtn')?.addEventListener('click', ()=>{ location.href = HUB_URL; }, {passive:true});

    // diff/speed/song selectors
    const diffSel = byId('diffSel');
    if(diffSel){
      diffSel.value = DIFF_KEY;
      diffSel.onchange = (e)=>{
        const v=e.target.value;
        try{ localStorage.setItem('rb_diff', v); }catch(_){}
        const u = new URL(location.href); u.searchParams.set('diff', v);
        location.href = u.pathname + '?' + u.searchParams.toString();
      };
    }
    const speedSel = byId('speedSel');
    if(speedSel){
      speedSel.value = (SPEED_VER==='beginner'||SPEED_VER==='standard'||SPEED_VER==='challenge')?SPEED_VER:'standard';
      speedSel.onchange = (e)=>{
        const v=e.target.value;
        try{ localStorage.setItem('rb_speed', v); }catch(_){}
        const u = new URL(location.href); u.searchParams.set('speed', v);
        location.href = u.pathname + '?' + u.searchParams.toString();
      };
    }
    const songSel = byId('songSel');
    if(songSel){
      songSel.value = SONG_ID;
      songSel.onchange = (e)=>{
        const v=e.target.value;
        try{ localStorage.setItem('rb_song', v); }catch(_){}
        const u = new URL(location.href); u.searchParams.set('song', v);
        location.href = u.pathname + '?' + u.searchParams.toString();
      };
    }
  }

  // -------------------- Boot --------------------
  document.addEventListener('DOMContentLoaded', ()=>{
    ensureScene();
    buildHitLine();
    installPointerRaycast();
    loadCurrentSong();
    updateHUD();
    wireButtons();
  });

})();
