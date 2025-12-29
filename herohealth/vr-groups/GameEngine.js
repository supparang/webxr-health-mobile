/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — GameEngine (B++++)
✅ groups:directive supports: nojunk/magnet/bossMini/storm/bonus/urgent/tickFast/shake
✅ emits groups:progress with inRing for ring mini
✅ Boss mini: multi-hit HP, wrong/junk heals boss
✅ Storm: directive OR deterministic schedule (research) via seed
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (n,d)=>{ try{ root.dispatchEvent(new CustomEvent(n,{detail:d||{}})); }catch{} };
  const progress = (d)=> emit('groups:progress', d||{});
  const coach = (text,mood)=> emit('hha:coach', { text:String(text||''), mood:mood||'neutral' });
  const feverEmit = ()=> emit('hha:fever', { feverPct: Math.round(E.fever)|0, shield:E.shield|0 });

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }

  // RNG
  function xmur3(str){
    str = String(str||'seed');
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= (h >>> 16);
      return h >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function makeRng(seed){
    const gen = xmur3(seed);
    return sfc32(gen(), gen(), gen(), gen());
  }

  function parsePx(val){
    val = String(val||'').trim();
    const m = val.match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  // Content: เพลง 5 หมู่
  const SONG = {
    1:'หมู่ 1 กินเนื้อ นม ไข่ ถั่วเมล็ดช่วยให้เติบโตแข็งขัน 💪',
    2:'หมู่ 2 ข้าว แป้ง เผือก มัน และน้ำตาล จะให้พลัง ⚡',
    3:'หมู่ 3 กินผักต่างๆ สารอาหารมากมายกินเป็นอาจิณ 🥦',
    4:'หมู่ 4 กินผลไม้ สีเขียวเหลืองบ้างมีวิตามิน 🍎',
    5:'หมู่ 5 อย่าได้ลืมกิน ไขมันทั้งสิ้น อบอุ่นร่างกาย 🥑'
  };

  const GROUPS = {
    1: { label:'หมู่ 1', emoji:['🥛','🥚','🍗','🐟','🥜','🫘'] },
    2: { label:'หมู่ 2', emoji:['🍚','🍞','🥔','🍠','🥖','🍜'] },
    3: { label:'หมู่ 3', emoji:['🥦','🥬','🥕','🌽','🥒','🍆'] },
    4: { label:'หมู่ 4', emoji:['🍎','🍌','🍊','🍉','🍓','🍍'] },
    5: { label:'หมู่ 5', emoji:['🥑','🫒','🧈','🥥','🧀','🌰'] }
  };

  const JUNK_EMOJI  = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭'];
  const DECOY_EMOJI = ['🎭','🌀','✨','🌈','🎈'];

  function goalNeed(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff==='easy') return 6;
    if (diff==='hard') return 10;
    return 8;
  }
  function diffParams(diff){
    diff = String(diff||'normal').toLowerCase();
    const thr = goalNeed(diff);
    if (diff==='easy') return { spawnMs:900, ttl:1750, size:1.05, powerThr:thr, junk:0.10, decoy:0.08, stormDur:6 };
    if (diff==='hard') return { spawnMs:680, ttl:1450, size:0.92, powerThr:thr, junk:0.16, decoy:0.12, stormDur:7 };
    return                 { spawnMs:780, ttl:1600, size:1.00, powerThr:thr, junk:0.12, decoy:0.10, stormDur:6 };
  }

  function rankFromAcc(acc){
    if (acc >= 95) return 'SSS';
    if (acc >= 90) return 'SS';
    if (acc >= 85) return 'S';
    if (acc >= 75) return 'A';
    if (acc >= 60) return 'B';
    return 'C';
  }

  const E = {
    layer:null,
    running:false,
    ended:false,

    runMode:'play',
    diff:'normal',
    timeSec:90,
    seed:'seed',
    rng:Math.random,

    // view + shake
    vx:0, vy:0,
    dragOn:false, dragX:0, dragY:0,
    shakeUntil:0,
    shakeStrength:0,

    left:90,
    score:0,
    combo:0,
    comboMax:0,
    misses:0,
    hitGood:0,
    hitAll:0,

    groupId:1,
    groupClean:true,

    fever:0,
    shield:0,
    feverTickLast:0,

    power:0,
    powerThr:8,

    ttlMs:1600,
    sizeBase:1.0,

    adapt:{ spawnMs:780, ttl:1600, junkBias:0.12, decoyBias:0.10 },

    // buffs
    freezeUntil:0,
    overUntil:0,

    // B++++ directives
    bonusMult:1.0,

    magnetOn:false,
    magnetStrength:0,

    nojunkOn:false,
    nojunkCx:0,
    nojunkCy:0,
    nojunkR:150,

    // storm
    stormOn:false,
    stormUntil:0,
    nextStormAt:0,

    // boss mini
    bossMiniOn:false,
    bossHp:0,
    bossHpMax:0,
    bossEl:null,

    // timers
    spawnT:0,
    tickT:0,

    // cache
    _rectCacheAt:0,
    _rectCache:null,
    _dirBound:false,
  };

  function scoreMult(){
    const over = (now() < E.overUntil) ? 2 : 1;
    return over * (E.bonusMult || 1);
  }

  function updateRank(){
    const acc = E.hitAll > 0 ? Math.round((E.hitGood/E.hitAll)*100) : 0;
    emit('hha:rank', { grade: rankFromAcc(acc), accuracy: acc });
  }
  function updateScore(){
    emit('hha:score', { score:E.score|0, combo:E.combo|0, comboMax:E.comboMax|0, misses:E.misses|0 });
    updateRank();
  }
  function updateTime(){ emit('hha:time', { left:E.left|0 }); }
  function updatePower(){ emit('groups:power', { charge:E.power|0, threshold:E.powerThr|0 }); }

  // ----- safe rect -----
  function getUISafeInsets(){
    let sal=0,sar=0,sat=0,sab=0;
    try{
      const cs = getComputedStyle(DOC.documentElement);
      sal = parsePx(cs.getPropertyValue('--sal'));
      sar = parsePx(cs.getPropertyValue('--sar'));
      sat = parsePx(cs.getPropertyValue('--sat'));
      sab = parsePx(cs.getPropertyValue('--sab'));
    }catch{}
    return { sal,sar,sat,sab };
  }
  function rectOf(sel){
    try{
      const el = DOC.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r || !isFinite(r.left) || r.width<=0 || r.height<=0) return null;
      return { l:r.left, t:r.top, r:r.right, b:r.bottom };
    }catch{ return null; }
  }
  function clampRect(rc,W,H){
    if(!rc) return null;
    return { l:clamp(rc.l,0,W), t:clamp(rc.t,0,H), r:clamp(rc.r,0,W), b:clamp(rc.b,0,H) };
  }
  function pointInRect(x,y,rc){ return rc && x>=rc.l && x<=rc.r && y>=rc.t && y<=rc.b; }

  function safeSpawnRect(){
    const t = now();
    if (E._rectCache && (t - E._rectCacheAt) < 180) return E._rectCache;

    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;
    const ins = getUISafeInsets();

    const rHud   = clampRect(rectOf('.hud'), W, H);
    const rCT    = clampRect(rectOf('.centerTop'), W, H);
    const rQuest = clampRect(rectOf('.questTop'), W, H);
    const rPower = clampRect(rectOf('.powerWrap'), W, H);
    const rCoach = clampRect(rectOf('.coachWrap'), W, H);

    let topClear = 0;
    if (rHud) topClear = Math.max(topClear, rHud.b);
    if (rCT) topClear = Math.max(topClear, rCT.b);
    if (rQuest) topClear = Math.max(topClear, rQuest.b);
    if (topClear <= 0) topClear = 160 + ins.sat;
    topClear += 16;

    let bottomClear = H;
    if (rPower) bottomClear = Math.min(bottomClear, rPower.t);
    if (bottomClear >= H) bottomClear = H - (190 + ins.sab);
    bottomClear -= 16;

    let x0 = 14 + ins.sal;
    let x1 = W - 14 - ins.sar;
    let y0 = Math.max(18 + ins.sat, topClear);
    let y1 = Math.min(H - (18 + ins.sab), bottomClear);

    // keep minimum play area
    const minW=220, minH=220;
    if ((x1-x0) < minW){
      const mid=(x0+x1)*0.5;
      x0=mid-minW*0.5; x1=mid+minW*0.5;
      x0=clamp(x0,8+ins.sal,W-8-ins.sar);
      x1=clamp(x1,8+ins.sal,W-8-ins.sar);
    }
    if ((y1-y0) < minH){
      const mid=(y0+y1)*0.5;
      y0=mid-minH*0.5; y1=mid+minH*0.5;
      y0=clamp(y0,18+ins.sat,H-18-ins.sab);
      y1=clamp(y1,18+ins.sat,H-18-ins.sab);
    }

    const excludes=[];
    if (rCoach){
      const pad=10;
      excludes.push({ l:clamp(rCoach.l-pad,0,W), t:clamp(rCoach.t-pad,0,H), r:clamp(rCoach.r+pad,0,W), b:clamp(rCoach.b+pad,0,H) });
    }

    const out = { W,H,x0,x1,y0,y1,excludes };
    E._rectCacheAt=t; E._rectCache=out;
    return out;
  }

  function isBlocked(sx,sy,ex){
    if(!ex || !ex.length) return false;
    for (const rc of ex){ if(pointInRect(sx,sy,rc)) return true; }
    return false;
  }

  function applyNoJunkVars(){
    if (!E.layer) return;
    const r = safeSpawnRect();
    const cx = E.nojunkCx || ((r.x0+r.x1)*0.5);
    const cy = E.nojunkCy || ((r.y0+r.y1)*0.5);
    E.nojunkCx = cx; E.nojunkCy = cy;

    E.layer.style.setProperty('--nojunk-on', E.nojunkOn ? '1':'0');
    E.layer.style.setProperty('--nojunk-cx', cx.toFixed(1)+'px');
    E.layer.style.setProperty('--nojunk-cy', cy.toFixed(1)+'px');
    E.layer.style.setProperty('--nojunk-r',  (E.nojunkR||150).toFixed(1)+'px');
  }

  function inRingScreen(sx,sy){
    if (!E.nojunkOn) return false;
    const dx = sx - E.nojunkCx;
    const dy = sy - E.nojunkCy;
    return (dx*dx + dy*dy) <= (E.nojunkR*E.nojunkR);
  }

  function pickPos(type){
    const r = safeSpawnRect();
    if (E.nojunkOn) applyNoJunkVars();

    const x0w = r.x0 - E.vx;
    const x1w = r.x1 - E.vx;
    const y0w = r.y0 - E.vy;
    const y1w = r.y1 - E.vy;

    let x=0,y=0;
    for (let i=0;i<16;i++){
      x = x0w + E.rng()*(x1w-x0w);
      y = y0w + E.rng()*(y1w-y0w);

      const sx = x + E.vx;
      const sy = y + E.vy;

      if (isBlocked(sx,sy,r.excludes)) continue;

      // fair ring: junk cannot spawn inside ring
      if (String(type)==='junk' && inRingScreen(sx,sy)) continue;

      return {x,y};
    }
    return { x:(x0w+x1w)*0.5, y:(y0w+y1w)*0.5 };
  }

  function applyView(){
    if (!E.layer) return;
    const t = now();
    let sx=0, sy=0;
    if (t <= E.shakeUntil){
      const s = E.shakeStrength || 1;
      sx = (E.rng()-0.5)*2*s;
      sy = (E.rng()-0.5)*2*s;
    } else {
      E.shakeStrength = 0;
    }
    E.layer.style.setProperty('--vx', (E.vx+sx).toFixed(1)+'px');
    E.layer.style.setProperty('--vy', (E.vy+sy).toFixed(1)+'px');
  }

  function setupView(){
    let bound=false;
    const it=setInterval(()=>{
      if (bound || !E.layer) return;
      bound=true;
      const layer=E.layer;

      layer.addEventListener('pointerdown',(e)=>{
        E.dragOn=true; E.dragX=e.clientX; E.dragY=e.clientY;
      },{passive:true});

      root.addEventListener('pointermove',(e)=>{
        if(!E.dragOn) return;
        const dx=e.clientX-E.dragX, dy=e.clientY-E.dragY;
        E.dragX=e.clientX; E.dragY=e.clientY;
        E.vx = clamp(E.vx + dx*0.22, -90, 90);
        E.vy = clamp(E.vy + dy*0.22, -90, 90);
        applyView();
      },{passive:true});

      root.addEventListener('pointerup',()=>{ E.dragOn=false; },{passive:true});

      root.addEventListener('deviceorientation',(ev)=>{
        const gx=Number(ev.gamma)||0;
        const gy=Number(ev.beta)||0;
        E.vx = clamp(E.vx + gx*0.06, -90, 90);
        E.vy = clamp(E.vy + (gy-20)*0.02, -90, 90);
        applyView();
      },{passive:true});
    },80);
  }

  // ---------- DOM target helpers ----------
  function setXY(el,x,y){
    el.style.setProperty('--x', x.toFixed(1)+'px');
    el.style.setProperty('--y', y.toFixed(1)+'px');
    el.dataset._x = String(x);
    el.dataset._y = String(y);
  }

  function removeTarget(el){
    if(!el) return;
    try{ root.clearTimeout(el._ttlTimer); }catch{}
    el.classList.add('hit');
    root.setTimeout(()=>{ try{ el.remove(); }catch{} }, 220);
  }

  function typeClass(tp){
    tp=String(tp||'').toLowerCase();
    if(tp==='good') return 'fg-good';
    if(tp==='wrong') return 'fg-wrong';
    if(tp==='decoy') return 'fg-decoy';
    if(tp==='junk') return 'fg-junk';
    if(tp==='star') return 'fg-star';
    if(tp==='ice')  return 'fg-ice';
    if(tp==='boss') return 'fg-boss';
    return '';
  }

  function makeTarget(type, emoji, x, y, s){
    const el = DOC.createElement('div');
    el.className = 'fg-target spawn';
    el.dataset.type = String(type||'');
    el.dataset.emoji = emoji || '✨';
    el.setAttribute('data-emoji', el.dataset.emoji);

    const cls = typeClass(type);
    if (cls) el.classList.add(cls);

    // badge default
    if (type==='wrong') el.dataset.badge='⚠️';
    if (type==='decoy') el.dataset.badge='❓';
    if (type==='junk')  el.dataset.badge='🫧';

    if (type==='good') el.dataset.groupId = String(E.groupId);

    setXY(el,x,y);
    el.style.setProperty('--s', s.toFixed(3));

    el.addEventListener('pointerdown',(ev)=>{
      ev.preventDefault?.();
      hitTarget(el);
    },{passive:false});

    // ttl (boss mini: boss doesn't expire)
    if (type !== 'boss'){
      el._ttlTimer = root.setTimeout(()=>{
        if (!el.isConnected) return;
        if (type === 'good'){
          E.misses++; E.combo=0; E.groupClean=false;
          E.fever = clamp(E.fever + 10, 0, 100);
          emit('hha:judge', { kind:'MISS' });
          updateScore();
          feverEmit();
          try{ NS.Audio?.bad?.(); }catch{}
          progress({ kind:'hit_bad' });
        }
        el.classList.add('out');
        root.setTimeout(()=>{ try{ el.remove(); }catch{} },220);
      }, E.ttlMs);
    }

    return el;
  }

  function addPower(n){
    E.power = clamp(E.power + (n|0), 0, E.powerThr);
    updatePower();
    if (E.power >= E.powerThr) switchGroup();
  }

  function setGroup(id){
    E.groupId=id;
    E.groupClean=true;
    coach(SONG[id] || `ต่อไป หมู่ ${id}!`,'happy');
  }

  function perfectSwitchBonus(){
    if (!E.groupClean) return;
    emit('hha:celebrate',{kind:'mini',title:'Perfect Switch!'});
  }

  function switchGroup(){
    perfectSwitchBonus();
    setGroup((E.groupId%5)+1);
    progress({ kind:'group_swap' });
    E.power=0; updatePower();
  }

  function applyBuffClasses(){
    const t=now();
    if (t < E.overUntil) DOC.body.classList.add('groups-overdrive'); else DOC.body.classList.remove('groups-overdrive');
    if (t < E.freezeUntil) DOC.body.classList.add('groups-freeze'); else DOC.body.classList.remove('groups-freeze');
    if (E.stormOn) DOC.body.classList.add('groups-storm'); else DOC.body.classList.remove('groups-storm');
  }

  function pickupStar(el){
    emit('hha:judge',{kind:'good',text:'⭐ OVERDRIVE!'});
    E.overUntil = now()+7000;
    E.shield=1;
    feverEmit(); applyBuffClasses();
    E.combo=clamp(E.combo+1,0,9999); E.comboMax=Math.max(E.comboMax,E.combo);
    E.score += Math.round(120 * scoreMult());
    updateScore();
    try{ NS.Audio?.power?.(); }catch{}
    removeTarget(el);
  }

  function pickupIce(el){
    emit('hha:judge',{kind:'good',text:'❄️ FREEZE!'});
    E.freezeUntil = now()+6000;
    applyBuffClasses();
    E.combo=clamp(E.combo+1,0,9999); E.comboMax=Math.max(E.comboMax,E.combo);
    E.score += Math.round(80 * scoreMult());
    updateScore();
    try{ NS.Audio?.freeze?.(); }catch{}
    removeTarget(el);
  }

  // ----- boss mini helpers -----
  function spawnBoss(){
    if (!E.layer) return;
    if (E.bossEl && E.bossEl.isConnected) return;

    const p = pickPos('boss');
    const el = makeTarget('boss','👑', p.x, p.y, 1.08);
    E.bossEl = el;

    el.dataset.badge = `👑${E.bossHp}`;
    E.layer.appendChild(el);

    try{ NS.Audio?.boss?.(); }catch{}
  }

  function bossHit(){
    E.bossHp = clamp(E.bossHp - 1, 0, E.bossHpMax);
    if (E.bossEl && E.bossEl.isConnected){
      E.bossEl.classList.add('fg-boss-hurt');
      E.bossEl.dataset.badge = `👑${E.bossHp}`;
      setTimeout(()=>{ try{ E.bossEl.classList.remove('fg-boss-hurt'); }catch{} }, 220);
      if (E.bossHp <= Math.ceil(E.bossHpMax*0.35)){
        E.bossEl.classList.add('fg-boss-weak');
      }
    }
    try{ NS.Audio?.bossHurt?.(); }catch{}
    progress({ kind:'boss_hit', hpLeft:E.bossHp });
    if (E.bossHp <= 0){
      progress({ kind:'boss_down' });
      emit('hha:celebrate',{kind:'mini',title:'BOSS DOWN!'});
      try{ removeTarget(E.bossEl); }catch{}
      E.bossEl=null;
      // stop boss mini flag will be handled by directive end
    }
  }

  function bossHeal(){
    E.bossHp = clamp(E.bossHp + 1, 0, E.bossHpMax);
    if (E.bossEl && E.bossEl.isConnected){
      E.bossEl.dataset.badge = `👑${E.bossHp}`;
    }
    try{ NS.Audio?.bossHeal?.(); }catch{}
    progress({ kind:'boss_heal', hpLeft:E.bossHp });
  }

  // ----- hit logic -----
  function hitTarget(el){
    if (!E.running || E.ended) return;
    if (!el || !el.isConnected) return;

    let type = String(el.dataset.type||'').toLowerCase();

    if (type === 'star'){ pickupStar(el); return; }
    if (type === 'ice'){ pickupIce(el); return; }

    // ring info at hit moment (screen coords = world + vx/vy)
    const x = Number(el.dataset._x||0), y = Number(el.dataset._y||0);
    const sx = x + E.vx, sy = y + E.vy;
    const inRing = inRingScreen(sx,sy);

    // boss click
    if (type === 'boss'){
      bossHit();
      // score small per hit
      E.score += Math.round(90 * scoreMult());
      E.combo = clamp(E.combo+1,0,9999); E.comboMax=Math.max(E.comboMax,E.combo);
      updateScore();
      return;
    }

    // GOOD correctness by group
    if (type === 'good'){
      const gid = Number(el.dataset.groupId)||0;
      if (gid && gid !== E.groupId) type = 'wrong';
    }

    E.hitAll++;

    if (type === 'good'){
      progress({ kind:'hit_good', groupId:E.groupId, inRing });

      E.hitGood++;
      E.combo=clamp(E.combo+1,0,9999); E.comboMax=Math.max(E.comboMax,E.combo);
      E.score += Math.round((100 + E.combo*3) * scoreMult());
      E.fever = clamp(E.fever - 3, 0, 100);

      updateScore(); feverEmit();
      try{ NS.Audio?.good?.(); }catch{}
      addPower(1);
      removeTarget(el);
      return;
    }

    // bad hits
    const badLike = (type==='junk' || type==='wrong' || type==='decoy');
    if (badLike){
      // shield blocks junk once
      if (type==='junk' && E.shield>0){
        E.shield=0; feverEmit();
        emit('hha:judge',{kind:'good',text:'SHIELD BLOCK!'});
        removeTarget(el);
        return;
      }

      progress({ kind:'hit_bad', inRing });
      if (type==='junk') progress({ kind:'hit_junk' });
      if (type==='wrong') progress({ kind:'hit_wrong' });

      E.misses++; E.combo=0; E.groupClean=false;
      E.fever = clamp(E.fever + (type==='junk'?18:12), 0, 100);
      feverEmit();
      try{ NS.Audio?.bad?.(); }catch{}
      emit('hha:judge',{kind:'bad',text:(type==='junk'?'JUNK!':'WRONG!')});

      // boss mini: bad hit heals boss (กดดัน)
      if (E.bossMiniOn && E.bossHp > 0) bossHeal();

      updateScore();
      removeTarget(el);
      return;
    }
  }

  // ---------- magnet drift ----------
  function safeCenterWorld(){
    const r = safeSpawnRect();
    const cxS = (r.x0+r.x1)*0.5;
    const cyS = (r.y0+r.y1)*0.5;
    return { cxW: cxS - E.vx, cyW: cyS - E.vy };
  }

  function magnetStep(){
    const t=now();
    const over = (t < E.overUntil);
    const on = E.magnetOn || over;
    if (!on || !E.layer) return;

    const strength = clamp((E.magnetStrength||0.5) + (over?0.18:0), 0, 1);
    const {cxW,cyW} = safeCenterWorld();

    const list = E.layer.querySelectorAll('.fg-target');
    list.forEach(el=>{
      const tp = String(el.dataset.type||'').toLowerCase();
      if (tp === 'boss') return; // boss stays more stable

      const x = Number(el.dataset._x||0);
      const y = Number(el.dataset._y||0);
      if (!isFinite(x)||!isFinite(y)) return;

      const dx = cxW - x, dy = cyW - y;
      const dist = Math.max(1, Math.hypot(dx,dy));
      const step = clamp(0.8 + strength*2.2, 0.8, 3.0);

      setXY(el, x + (dx/dist)*step, y + (dy/dist)*step);
    });
  }

  // ---------- storm ----------
  function setStorm(on, durSec){
    if (on){
      E.stormOn = true;
      const d = clamp(durSec||diffParams(E.diff).stormDur, 3, 12);
      E.stormUntil = now() + d*1000;
    }else{
      E.stormOn = false;
      E.stormUntil = 0;
    }
    applyBuffClasses();
  }

  function scheduleStormResearch(){
    // deterministic by seed: every ~18s with small jitter (still deterministic)
    const base = 18000;
    const jit = Math.round((E.rng()-0.5)*2400); // ±1.2s
    E.nextStormAt = now() + base + jit;
  }

  function stormTick(){
    const t=now();
    if (E.stormOn && E.stormUntil>0 && t >= E.stormUntil){
      E.stormOn=false; E.stormUntil=0;
      applyBuffClasses();
    }

    if (E.runMode==='research'){
      if (!E.stormOn && E.nextStormAt>0 && t >= E.nextStormAt){
        setStorm(true, diffParams(E.diff).stormDur);
        scheduleStormResearch();
      }
    } else {
      // play: small random storm if combo high or fever high
      const acc = E.hitAll>0 ? (E.hitGood/E.hitAll) : 0;
      const heat = clamp((E.combo/18) + (acc-0.65) + (E.fever/140), 0, 1);
      if (!E.stormOn && heat>0.85 && E.rng()<0.035){
        setStorm(true, diffParams(E.diff).stormDur);
      }
    }
  }

  // ---------- spawning ----------
  function chooseType(){
    // boss mini: ensure boss exists; other spawns continue but lighter
    if (E.bossMiniOn){
      if (!E.bossEl || !E.bossEl.isConnected) spawnBoss();
    }

    const base = (E.runMode==='research') ? diffParams(E.diff) : E.adapt;
    const j = (E.runMode==='research') ? base.junk : base.junkBias;
    const d = (E.runMode==='research') ? base.decoy : base.decoyBias;

    // powerups reduced during boss mini
    const pu = E.bossMiniOn ? 0.006 : (E.stormOn ? 0.016 : 0.010);
    if (E.rng() < pu) return (E.rng() < 0.5) ? 'star' : 'ice';

    const r = E.rng();
    if (r < j) return 'junk';
    if (r < j + d) return 'decoy';
    if (E.rng() < (E.stormOn ? 0.18 : 0.14)) return 'wrong';
    return 'good';
  }

  function chooseEmoji(tp){
    if (tp==='junk') return JUNK_EMOJI[(E.rng()*JUNK_EMOJI.length)|0];
    if (tp==='decoy') return DECOY_EMOJI[(E.rng()*DECOY_EMOJI.length)|0];
    if (tp==='star') return '⭐';
    if (tp==='ice') return '❄️';
    if (tp==='good') return GROUPS[E.groupId].emoji[(E.rng()*GROUPS[E.groupId].emoji.length)|0];

    const other=[];
    for (let g=1;g<=5;g++){ if(g!==E.groupId) other.push(...GROUPS[g].emoji); }
    return other[(E.rng()*other.length)|0] || '✨';
  }

  function spawnOne(){
    if (!E.running || E.ended || !E.layer) return;

    // boss mini: boss already spawned, but still spawn targets for chaos
    const tp = chooseType();
    const em = chooseEmoji(tp);
    const p = pickPos(tp);
    const s = E.sizeBase;

    const el = makeTarget(tp, em, p.x, p.y, s);
    if (el) E.layer.appendChild(el);
  }

  function loopSpawn(){
    if (!E.running || E.ended) return;
    spawnOne();

    const t=now();
    const frozen = (t < E.freezeUntil);
    const base = (E.runMode==='research') ? diffParams(E.diff) : E.adapt;

    let ms = base.spawnMs;
    if (E.stormOn) ms *= 0.82;
    if (frozen) ms *= 1.25;
    if (E.bossMiniOn) ms *= 0.85;

    ms = Math.max(420, ms);
    E.spawnT = root.setTimeout(loopSpawn, ms);
  }

  // ---------- tick loop ----------
  function feverTick(){
    const t=now();
    if (!E.feverTickLast) E.feverTickLast=t;
    const dt = Math.min(0.25, Math.max(0,(t-E.feverTickLast)/1000));
    E.feverTickLast=t;

    const acc = E.hitAll>0 ? (E.hitGood/E.hitAll) : 0;
    const cool = 7.5 * (0.6 + clamp(E.combo/18,0,1)*0.6 + clamp(acc,0,1)*0.3);
    E.fever = clamp(E.fever - cool*dt, 0, 100);
    feverEmit();
  }

  function loopTick(){
    if (!E.running || E.ended) return;

    // ttl with freeze
    const t=now();
    const baseTTL = (E.runMode==='research') ? diffParams(E.diff).ttl : E.adapt.ttl;
    E.ttlMs = (t < E.freezeUntil) ? Math.round(baseTTL*1.20) : baseTTL;

    // adaptive only in play
    if (E.runMode==='play'){
      const acc = E.hitAll>0 ? (E.hitGood/E.hitAll) : 0;
      const heat = clamp((E.combo/18) + (acc-0.65), 0, 1);
      E.adapt.spawnMs = clamp(820 - heat*260, 480, 880);
      E.adapt.ttl     = clamp(1680 - heat*260, 1250, 1750);
      E.adapt.junkBias = clamp(0.11 + heat*0.06, 0.08, 0.22);
      E.adapt.decoyBias= clamp(0.09 + heat*0.05, 0.06, 0.20);
    }

    applyBuffClasses();
    feverTick();

    stormTick();
    magnetStep();

    E.left = Math.max(0, E.left - 0.14);
    updateTime();
    if (E.left <= 0){ endGame('time'); return; }

    applyView();
    E.tickT = root.setTimeout(loopTick, 140);
  }

  function clearAllTargets(){
    if (!E.layer) return;
    const list = E.layer.querySelectorAll('.fg-target');
    list.forEach(el=>{ try{ root.clearTimeout(el._ttlTimer); }catch{} try{ el.remove(); }catch{} });
    E.bossEl=null;
  }

  function endGame(reason){
    if (E.ended) return;
    E.ended=true; E.running=false;

    try{ root.clearTimeout(E.spawnT); }catch{}
    try{ root.clearTimeout(E.tickT); }catch{}
    clearAllTargets();

    DOC.body.classList.remove('groups-overdrive','groups-freeze','groups-mini-urgent','groups-storm');

    const acc = E.hitAll>0 ? Math.round((E.hitGood/E.hitAll)*100) : 0;
    const grade = rankFromAcc(acc);

    emit('hha:end', {
      reason: reason||'end',
      scoreFinal:E.score|0,
      comboMax:E.comboMax|0,
      misses:E.misses|0,
      accuracyGoodPct:acc|0,
      grade,
      diff:E.diff,
      runMode:E.runMode,
      seed:E.seed
    });
  }

  // ---------- directives ----------
  function bindDirectives(){
    if (E._dirBound) return;
    E._dirBound=true;

    root.addEventListener('groups:directive',(ev)=>{
      const d = ev && ev.detail ? ev.detail : {};

      if (typeof d.urgent === 'boolean'){
        if (d.urgent) DOC.body.classList.add('groups-mini-urgent');
        else DOC.body.classList.remove('groups-mini-urgent');
      }

      if (d.tick){
        try{
          if (d.tickFast) NS.Audio?.tickFast?.();
          else NS.Audio?.tick?.();
        }catch{}
      }

      if (d.shake){
        const s = clamp(d.shake.strength,0,5);
        const ms= clamp(d.shake.ms,60,420);
        E.shakeUntil = now()+ms;
        E.shakeStrength = Math.max(E.shakeStrength, s);
      }

      if (d.bonus && typeof d.bonus === 'object'){
        E.bonusMult = clamp(d.bonus.mult ?? 1, 1, 1.6);
      }

      if (d.magnet && typeof d.magnet === 'object'){
        E.magnetOn = !!d.magnet.on;
        E.magnetStrength = clamp(d.magnet.strength ?? 0.55, 0, 1);
      }

      if (d.nojunk && typeof d.nojunk === 'object'){
        E.nojunkOn = !!d.nojunk.on;
        E.nojunkR  = clamp(d.nojunk.r ?? 150, 90, 220);
        applyNoJunkVars();
      }

      if (d.storm && typeof d.storm === 'object'){
        if (d.storm.on) setStorm(true, d.storm.dur || diffParams(E.diff).stormDur);
        else setStorm(false);
      }

      if (d.bossMini && typeof d.bossMini === 'object'){
        E.bossMiniOn = !!d.bossMini.on;
        if (E.bossMiniOn){
          E.bossHpMax = clamp(d.bossMini.hp ?? 4, 2, 7);
          E.bossHp = E.bossHpMax;
          spawnBoss();
        } else {
          E.bossMiniOn = false;
          E.bossHp = 0; E.bossHpMax = 0;
          if (E.bossEl) { try{ removeTarget(E.bossEl); }catch{} }
          E.bossEl = null;
        }
      }
    },{passive:true});
  }

  // ---------- public ----------
  function setLayerEl(el){
    E.layer = el || null;
    if (E.layer){
      applyNoJunkVars();
      applyView();
      setupView();
      bindDirectives();
    }
  }

  function start(diff, cfg){
    cfg = cfg || {};
    E.runMode = (String(cfg.runMode||'play').toLowerCase()==='research') ? 'research' : 'play';
    E.diff = String(diff || cfg.diff || 'normal').toLowerCase();
    E.timeSec = clamp(cfg.time ?? 90, 30, 180);
    E.seed = String(cfg.seed || Date.now());
    E.rng = makeRng(E.seed);

    const dp = diffParams(E.diff);

    E.running=true; E.ended=false;
    E.left=E.timeSec;

    E.score=0; E.combo=0; E.comboMax=0;
    E.misses=0; E.hitGood=0; E.hitAll=0;

    E.groupId=1; E.groupClean=true;

    E.fever=0; E.shield=0; E.feverTickLast=0;

    E.powerThr = dp.powerThr;
    E.power=0;

    E.sizeBase = dp.size;
    E.ttlMs = dp.ttl;

    E.freezeUntil=0; E.overUntil=0;

    E.bonusMult=1.0;
    E.magnetOn=false; E.magnetStrength=0.55;
    E.nojunkOn=false; E.nojunkR=150; E.nojunkCx=0; E.nojunkCy=0;

    E.stormOn=false; E.stormUntil=0;
    E.nextStormAt=0;

    E.bossMiniOn=false; E.bossHp=0; E.bossHpMax=0; E.bossEl=null;

    E.vx=0; E.vy=0;
    E.shakeUntil=0; E.shakeStrength=0;

    E._rectCacheAt=0; E._rectCache=null;

    updateTime(); updatePower(); updateScore(); feverEmit();
    coach(SONG[1],'neutral');
    applyBuffClasses();
    applyNoJunkVars();

    // deterministic storm schedule in research
    if (E.runMode==='research'){
      // first storm around 12-16s (deterministic)
      E.nextStormAt = now() + 12000 + Math.round(E.rng()*4000);
    }

    loopSpawn();
    loopTick();
  }

  function stop(reason){ endGame(reason||'stop'); }

  NS.GameEngine = { start, stop, setLayerEl };

})(typeof window !== 'undefined' ? window : globalThis);