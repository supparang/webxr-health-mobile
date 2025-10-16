/*  Shadow Breaker – 4 Modes: combat / dash / impact / flow
    - Combat: ใช้ไฟล์ legacy ได้ผ่าน ?legacy=1 (โหลด components_arcane_legacy.js)
    - Dash: Hyper + Warning (M2) + Burst
    - Impact: ชาร์จ-ปล่อยพลัง
    - Flow: จังหวะ A/S/D
*/
(function(){
  const $=(id)=>document.getElementById(id);
  const qs=(sel)=>document.querySelector(sel);
  const T=(d,k,def)=>(d&&d[k])||def||k;
  const toast=(m,ms=900)=>{const t=$('toast'); if(!t) return; t.textContent=m; t.style.display='block'; setTimeout(()=>t.style.display='none',ms);};

  // ===== SFX =====
  const SFX={ctx:null,
    beep(f=880,d=.08,v=.2){try{this.ctx=this.ctx||new (window.AudioContext||window.webkitAudioContext)();const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='square';o.frequency.value=f;g.gain.value=v;o.connect(g);g.connect(this.ctx.destination);o.start();o.stop(this.ctx.currentTime+d);}catch(e){}},
    hit(){this.beep(920,.05,.2)}, ok(){this.beep(660,.07,.18)}, warn(){this.beep(160,.12,.25)}, crit(){this.beep(1400,.06,.25)}
  };

  // ===== Overload HUD =====
  function updateOverloadUI(v){
    const w=$('overloadBarWrap'),f=$('overloadBarFill'),t=$('overloadBarText');
    if(!w||!f||!t) return; const p=Math.max(0,Math.min(100,Math.round(v)));
    f.style.width=p+'%'; t.textContent='Overload: '+p+'%';
    w.className=''; w.id='overloadBarWrap';
    if(p>=50&&p<80) w.classList.add('danger'); else if(p>=80&&p<100) w.classList.add('critical'); else if(p>=100) w.classList.add('z2');
  }

  // ===== Rift Dash Warning UI (M2) =====
  function ensureWarnDOM(){
    let w=document.getElementById('warnWrap');
    if(!w){
      w=document.createElement('div'); w.id='warnWrap'; w.className='warn-wrap';
      w.innerHTML = `
        <div id="warnL" class="warn-arrow" style="visibility:hidden">← DASH</div>
        <div id="warnU" class="warn-arrow" style="visibility:hidden">JUMP ↑</div>
        <div id="warnD" class="warn-arrow" style="visibility:hidden">DUCK ↓</div>
        <div id="warnR" class="warn-arrow" style="visibility:hidden">DASH →</div>
      `;
      document.body.appendChild(w);
      const mid=document.createElement('div'); mid.id='warnMid'; mid.className='warn-mid';
      mid.innerHTML=`<div id="warnShift" class="warn-arrow" style="visibility:hidden">SHIFT – BURST!</div>`;
      document.body.appendChild(mid);
    }
  }
  function showWarn(which, ms=800){
    ensureWarnDOM();
    const el = {
      left:  document.getElementById('warnL'),
      right: document.getElementById('warnR'),
      up:    document.getElementById('warnU'),
      down:  document.getElementById('warnD'),
      burst: document.getElementById('warnShift')
    }[which];
    if(!el) return;
    el.style.visibility='visible'; el.classList.add('flash');
    setTimeout(()=>{ el.style.visibility='hidden'; el.classList.remove('flash'); }, ms);
  }

  // ===== Difficulty =====
  const DIFF={
    easy:   {spawnMs:950, lifeMs:3800, timedSec:75, missHP:0, bossHit:3,  clickMissHP:0},
    normal: {spawnMs:800, lifeMs:3200, timedSec:60, missHP:3, bossHit:6,  clickMissHP:1},
    hard:   {spawnMs:650, lifeMs:2800, timedSec:50, missHP:5, bossHit:10, clickMissHP:2}
  };

  // ===== Daily Quests (ย่อ) =====
  const QUEST_KEY='sb_daily_v1';
  const genDaily=()=>{const today=new Date().toISOString().slice(0,10);const ex=JSON.parse(localStorage.getItem(QUEST_KEY)||'{}');if(ex.date===today) return ex;const q={date:today,list:[{id:'score1500',name:{th:'ทำคะแนนรวม 1,500',en:'Reach total score 1,500'},goal:1500,cur:0,done:false},{id:'combo8',name:{th:'ทำคอมโบ x8',en:'Reach combo x8'},goal:8,cur:0,done:false},{id:'boss1',name:{th:'ชนะบอส 1 ครั้ง',en:'Defeat 1 boss'},goal:1,cur:0,done:false}]};localStorage.setItem(QUEST_KEY,JSON.stringify(q));return q;};
  const saveDaily=(q)=>localStorage.setItem(QUEST_KEY,JSON.stringify(q));
  function updateQuestUI(dict,q){const box=$('qList'), title=$('qTitle'); if(!box) return; title.textContent=T(dict,'dailyQuests','Daily Quests'); box.innerHTML=''; q.list.forEach(it=>{const nm=it.name[(localStorage.getItem('sb_lang')||'th')]; const line=document.createElement('div'); line.textContent=`• ${nm} — ${it.cur}/${it.goal} ${it.done?'✓':''}`; box.appendChild(line);});}

  // ===== Component =====
  AFRAME.registerComponent('shadow-breaker-game',{
    init:function(){
      const q=new URLSearchParams(location.search);
      this.game = q.get('game')||'combat'; // combat|dash|impact|flow
      this.mode=(q.get('mode')==='timed')?'timed':'practice';
      this.diff=q.get('diff')||'normal';
      this.cfg=DIFF[this.diff]||DIFF.normal;

      fetch('src/i18n.json').then(r=>r.json()).then(data=>{
        const cur=localStorage.getItem('sb_lang')||'th';
        this.i18n=data; this.dict=data[cur]||data['th']||{};
        window.__shadowBreakerSetLang=(v)=>{ localStorage.setItem('sb_lang',v); this.dict=this.i18n[v]||this.i18n['th']; this.updateHUD(); };

        // kid-easy flag (ใช้ใน combat ถ้าโหลดเวอร์ชันนี้)
        this.kid = (this.game==='combat' && this.diff==='easy');

        // state หลัก
        this.st={
          playing:false, timeLeft:(this.mode==='timed')?this.cfg.timedSec:9999,
          score:0, combo:1, arcane:0, overload:0, hp:100,
          last:performance.now(), spawnEveryMs:this.cfg.spawnMs, spawnTimer:performance.now()-this.cfg.spawnMs-1,
          dmgCD:0, olTick:0, idleTimer:0, recoverCD:0,
          // dash movement
          jumpT:0, crouch:false, side:0, sideT:0, burst:0, burstCD:0,
          // impact
          chargeStart:0, _impactAlive:false,
          // flow
          flowNotes:[], flowBeat:0, flowNext:0
        };
        this.daily=genDaily(); updateQuestUI(this.dict,this.daily);

        const nameMap={
          combat:T(this.dict,'modeCombat','Arcane Combat'),
          dash:T(this.dict,'modeDash','Rift Dash'),
          impact:T(this.dict,'modeImpact','Impact Breaker'),
          flow:T(this.dict,'modeFlow','Spirit Flow')
        };
        $('hudGame').textContent = nameMap[this.game]||'—';

        // Controls
        window.addEventListener('keydown', (e)=>{
          if(this.game==='dash'){
            if(e.key==='ArrowUp' || e.code==='Space') { if(this.st.jumpT<=0) this.st.jumpT=0.6; }
            if(e.key==='ArrowDown') { this.st.crouch=true; }
            if(e.key==='ArrowLeft')  { this.st.side=-1; this.st.sideT=0.35; }
            if(e.key==='ArrowRight') { this.st.side= 1; this.st.sideT=0.35; }
            if(e.key==='Shift' && this.st.burstCD<=0){ this.st.burst=0.25; this.st.burstCD=2.2; showWarn('burst',400); SFX.ok(); }
          }
          if(this.game==='flow'){
            if('aA'.includes(e.key)) this.checkFlowHit('A');
            if('sS'.includes(e.key)) this.checkFlowHit('S');
            if('dD'.includes(e.key)) this.checkFlowHit('D');
          }
        });
        window.addEventListener('keyup',(e)=>{ if(this.game==='dash' && (e.key==='ArrowDown')) this.st.crouch=false; });

        // impact press
        window.addEventListener('mousedown', (e)=>{ if(this.game==='impact') this.st.chargeStart=performance.now(); });
        window.addEventListener('mouseup',   (e)=>{ if(this.game==='impact') this.releaseImpact(); });

        // manual ray (combat ในไฟล์นี้ ถ้าคุณไม่ได้ใช้ legacy)
        window.addEventListener('click', this.manualRay && this.manualRay.bind(this), {passive:false});

        this.updateObjective();
        this.startGame();

        if(this.game==='combat' && this.showCombatTutorial) this.showCombatTutorial();
      });
    },

    startGame:function(){ this.st.playing=true; this.loop(); },

    updateObjective:function(){
      const o=$('objective'); if(!o) return;
      const obj={
        combat:'ทำคะแนนถึง 400 (หรือ 600 ใน Easy) เพื่อเรียก Mini Boss',
        dash:'หลบกำแพง/เลเซอร์: ↑ กระโดด • ↓ ก้ม • ←/→ หลบข้าง • SHIFT Burst',
        impact:'กดเมาส์ค้างเพื่อชาร์จ แล้วปล่อยทำลายแกนพลัง',
        flow:'กด A / S / D ให้ตรงสัญญาณจังหวะ'
      };
      o.textContent = obj[this.game];
    },

    updateHUD:function(){
      const s=this.st, d=this.dict, L=(k,def)=>(d&&d[k])||def;
      $('hudScore') && ($('hudScore').textContent = `${L('score','Score')}: ${s.score}`);
      $('hudCombo') && ($('hudCombo').textContent = `${L('combo','Combo')}: x${s.combo}`);
      $('hudTime')  && ($('hudTime').textContent  = `${L('time','Time')}${this.mode==='timed'?' ⏱':''}: ${this.mode==='timed'?Math.ceil(s.timeLeft):'∞'}`);
      $('hudArcane')&& ($('hudArcane').textContent= `${L('arcane','Arcane')}: ${s.arcane}%`);
      $('backLink') && ($('backLink').textContent = (L('back','Back')));
      $('hudHP')    && ($('hudHP').textContent    = `${L('hp','ENERGY')}: ${Math.max(0,Math.ceil(s.hp))}`);
      $('hudOverload') && ($('hudOverload').textContent = `Overload: ${Math.round(s.overload)}%`);
      $('hudBoss')  && ($('hudBoss').textContent  = (this.game==='combat' && s.boss)? `${L('bossHP','Boss HP')}: ${Math.max(0,Math.ceil(s.boss.hp))}` : `${L('bossHP','Boss HP')}: —`);
      updateOverloadUI(s.overload);
      const hpFill=$('hpBarFill'); if(hpFill){ hpFill.style.width=Math.max(0,Math.min(100,s.hp))+'%'; }
      updateQuestUI(this.dict,this.daily);
    },

    takeDamage:function(amount,label){
      if(amount<=0) return;
      if(this.st.dmgCD>0) return;
      this.st.hp=Math.max(0,this.st.hp-amount);
      this.st.dmgCD=0.6; this.st.recoverCD=0;
      toast(`-${Math.round(amount)} HP (${label||'Hit'})`);
      this.updateHUD();
    },

    loop:function(){
      if(!this.st.playing) return;
      requestAnimationFrame(this.loop.bind(this));
      const now=performance.now(), dt=(now-this.st.last)/1000; this.st.last=now;

      if(this.mode==='timed'){
        this.st.timeLeft=Math.max(0,this.st.timeLeft-dt);
        if(this.st.timeLeft<=0) return this.endGame();
      }

      // Overload pulse damage (ใช้ร่วมทุกโหมด)
      this.st.olTick += dt;
      if(this.st.overload>=80 && this.st.overload<100 && this.st.olTick>=0.5){ this.takeDamage(0.4,'Overload'); this.st.olTick=0; }
      if(this.st.overload>=100 && this.st.olTick>=0.4){ this.takeDamage(1.2,'Overload+'); this.st.olTick=0; }
      if(this.st.dmgCD>0) this.st.dmgCD=Math.max(0,this.st.dmgCD-dt);

      // Idle ลด Overload ช้า ๆ
      this.st.idleTimer = (this.st.idleTimer||0) + dt;
      if(this.st.idleTimer > 2 && this.st.overload > 0){
        this.st.overload = Math.max(0, this.st.overload - 0.35*dt);
      }

      // สวิตช์ตามโหมด
      if(this.game==='combat'){ this.tickCombat && this.tickCombat(now,dt); }
      if(this.game==='dash')   this.tickDash(now,dt);
      if(this.game==='impact') this.tickImpact(now,dt);
      if(this.game==='flow')   this.tickFlow(now,dt);

      this.updateHUD();
      if(this.st.hp<=0) this.endGame();
    },

    /* ===== MODE: DASH (Hyper + M2) ===== */
    tickDash:function(now,dt){
      if(this.st.jumpT>0) this.st.jumpT=Math.max(0,this.st.jumpT-dt);
      if(this.st.sideT>0) this.st.sideT=Math.max(0,this.st.sideT-dt); else this.st.side=0;
      if(this.st.burst>0) this.st.burst=Math.max(0,this.st.burst-dt);
      if(this.st.burstCD>0) this.st.burstCD=Math.max(0,this.st.burstCD-dt);

      const rig=$('#rig');
      if(rig){
        const baseY=1.6;
        const y = (this.st.jumpT>0) ? baseY + 0.42*Math.sin((0.6-this.st.jumpT)/0.6*Math.PI) : (this.st.crouch ? baseY-0.38 : baseY);
        const x = (this.st.side!==0 ? this.st.side*0.6*(this.st.sideT/0.35) : 0) + (this.st.burst>0 ? (this.st.side||1)*0.25 : 0);
        rig.setAttribute('position',`${x.toFixed(3)} ${y.toFixed(3)} 0`);
      }

      const spawnGap = Math.max(520, this.cfg.spawnMs);
      if(now-this.st.spawnTimer>spawnGap){ this.st.spawnTimer=now; this.spawnDashObstacle(now); }

      document.querySelectorAll('.hazard').forEach(h=>{
        const z = Number(h.dataset.z||-3.5);
        const speed = 2.4;
        const nz = z + speed*dt*(this.st.burst>0?1.25:1.0);
        h.dataset.z = nz;
        h.setAttribute('position',`${h.dataset.x||0} ${h.dataset.y||0} ${nz.toFixed(3)}`);

        if(!h.dataset.warned && nz>-2.6){
          h.dataset.warned='1';
          const t=h.dataset.type;
          if(t==='low')  showWarn('up', 700);
          if(t==='high') showWarn('down',700);
          if(t==='leftBeam')  showWarn('right',700);
          if(t==='rightBeam') showWarn('left',700);
          if(t==='shock') showWarn('burst',700);
        }

        if(nz>-0.2 && !h.dataset.hit){
          h.dataset.hit='1';
          const ok = this.checkDashPose(h.dataset.type);
          if(ok){
            this.st.score += 150;
            this.st.combo = Math.min(20, this.st.combo+1);
            this.st.overload = Math.min(130, this.st.overload + 1.0);
            this.st.idleTimer = 0;
            SFX.ok();
          }else{
            this.st.combo=1;
            const dmg = this.cfg.missHP + 1;
            this.takeDamage(dmg, 'Rift Hit');
            this.st.overload = Math.max(0, this.st.overload - 0.5);
            SFX.warn();
          }
          setTimeout(()=>{ try{h.remove();}catch(_){ } }, 40);
        }
      });
    },
    spawnDashObstacle:function(now){
      const e=document.createElement('a-entity'); e.classList.add('hazard');
      const r=Math.random();
      let type='mid';
      if(r<0.25) type='low';
      else if(r<0.5) type='high';
      else if(r<0.7) type='leftBeam';
      else if(r<0.9) type='rightBeam';
      else type='shock';

      e.dataset.type = type;
      let x=0,y=0,geo='',mat='';
      if(type==='low'){ y=0.35; geo='primitive: box; width: 2.2; height:0.32; depth:0.22'; mat='color:#8bd8ff; emissive:#3cf; opacity:0.9; transparent:true'; }
      else if(type==='high'){ y=1.45; geo='primitive: box; width: 2.2; height:0.32; depth:0.22'; mat='color:#8bd8ff; emissive:#3cf; opacity:0.9; transparent:true'; }
      else if(type==='leftBeam'){ x=-0.7; y=1.0; geo='primitive: box; width: 0.25; height:1.8; depth:0.25'; mat='color:#ff8b8b; emissive:#f55; opacity:0.95; transparent:true'; }
      else if(type==='rightBeam'){ x=0.7; y=1.0; geo='primitive: box; width: 0.25; height:1.8; depth:0.25'; mat='color:#ff8b8b; emissive:#f55; opacity:0.95; transparent:true'; }
      else { y=0.95; geo='primitive: dodecahedron; radius:0.38'; mat='color:#ffd36b; emissive:#fa0; metalness:0.2; roughness:0.2'; }

      e.dataset.x=x; e.dataset.y=y; e.dataset.z=-3.5;
      e.setAttribute('geometry',geo); e.setAttribute('material',mat);
      e.setAttribute('position',`${x} ${y} -3.5`);
      e.setAttribute('animation__pulse','property: scale; dir: alternate; loop:true; dur:600; to: 1.08 1.08 1.08');
      qs('#spawner').appendChild(e);
    },
    checkDashPose:function(type){
      const isJump = this.st.jumpT>0;
      const isDuck = this.st.crouch;
      const isLeft = this.st.side<0 && this.st.sideT>0;
      const isRight= this.st.side>0 && this.st.sideT>0;
      const burst  = this.st.burst>0;

      if(type==='low')      return isJump;
      if(type==='high')     return isDuck;
      if(type==='leftBeam') return isRight || burst;
      if(type==='rightBeam')return isLeft  || burst;
      if(type==='shock')    return burst;
      return false;
    },

    /* ===== MODE: IMPACT ===== */
    tickImpact:function(now,dt){
      if(!this._impactAlive){ this.spawnImpactCore(); }
      if(this.st.chargeStart>0){
        const t=(now-this.st.chargeStart)/1000; const pct=Math.min(100,Math.round(t/2*100));
        $('hudArcane').textContent=`CHARGE: ${pct}%`;
      }
    },
    spawnImpactCore:function(){
      const e=document.createElement('a-entity');
      e.setAttribute('geometry','primitive: dodecahedron; radius:0.6');
      e.setAttribute('material','color:#ffb36b; emissive:#f80; metalness:0.2; roughness:0.2');
      e.setAttribute('position','0 1.3 -2.2'); e.classList.add('impact-core');
      this._impactAlive=true; qs('#spawner').appendChild(e);
      $('objective').textContent='ชาร์จให้เต็มแล้วปล่อยทำลายแกนพลัง (0–2s)';
    },
    releaseImpact:function(){
      if(!this._impactAlive) return;
      const e=qs('.impact-core'); if(!e) return;
      const held = this.st.chargeStart>0 ? (performance.now()-this.st.chargeStart)/1000 : 0;
      this.st.chargeStart=0;
      const clamped=Math.max(0,Math.min(2,held));
      const dmg=Math.round(200*clamped); // 0–400 score
      this.st.score+=dmg; this.st.combo=Math.min(20,this.st.combo+1);
      // ขยับแล้ว OL ขึ้นเล็กน้อยตามเวลาชาร์จ
      const olGain = 1.2 * (clamped/2); // 0–1.2
      this.st.overload = Math.min(130, this.st.overload + olGain);
      this.st.idleTimer = 0;

      try{ e.remove(); }catch(_){}
      this._impactAlive=false; $('objective').textContent='ดีมาก! สร้างแกนถัดไป...';
      SFX.ok(); this.updateHUD();
      setTimeout(()=>this.spawnImpactCore(), 800);
    },

    /* ===== MODE: FLOW ===== */
    tickFlow:function(now,dt){
      if(!this.st.flowNext) this.st.flowNext=now+800;
      if(now>=this.st.flowNext){
        const lanes=['A','S','D']; const L=lanes[Math.floor(Math.random()*lanes.length)];
        this.spawnFlowNote(L, now);
        this.st.flowNext = now + 900; // เริ่มง่าย
      }
      document.querySelectorAll('.flow-note').forEach(n=>{
        const born=Number(n.dataset.t0||0); const age=now-born; const life=900;
        const y = Math.min(100, (age/life)*100);
        n.style.top = (10+y*0.6)+'%';
        if(age>life+200){ n.remove(); this.st.combo=1; this.takeDamage(0.5,'Late'); }
      });
    },
    spawnFlowNote:function(lane, now){
      let wrap=$('#flowWrap');
      if(!wrap){
        wrap=document.createElement('div'); wrap.id='flowWrap';
        wrap.style.position='fixed'; wrap.style.left='50%'; wrap.style.transform='translateX(-50%)';
        wrap.style.top='12%'; wrap.style.zIndex='10006'; wrap.style.pointerEvents='none'; wrap.style.width='360px';
        wrap.innerHTML=`<div style="display:flex;gap:14px;justify-content:center">
          <div class="badge">A</div><div class="badge">S</div><div class="badge">D</div>
        </div>`;
        document.body.appendChild(wrap);
      }
      const n=document.createElement('div'); n.className='flow-note badge'; n.dataset.t0=String(now); n.dataset.key=lane;
      n.style.position='absolute'; n.style.left = lane==='A'?'20%':(lane==='S'?'45%':'70%'); n.style.top='10%';
      n.style.background='rgba(0,0,0,.55)'; n.style.border='1px solid #49b'; n.textContent=lane;
      wrap.appendChild(n);
      $('objective').textContent='กด A/S/D ให้ตรงกับสัญลักษณ์ตกลงมา';
    },
    checkFlowHit:function(key){
      const notes=[...document.querySelectorAll('.flow-note')].filter(n=>n.dataset.key===key);
      if(!notes.length) return;
      notes.sort((a,b)=>parseFloat(b.style.top)-parseFloat(a.style.top));
      const n=notes[0]; const now=performance.now(); const born=Number(n.dataset.t0||0);
      const age=now-born; const life=900; const delta=Math.abs(age-life);
      if(delta<=200){
        this.st.score += (delta<80 ? 150 : 100);
        this.st.combo = Math.min(20, this.st.combo+1);
        this.st.overload = Math.min(130, this.st.overload + 0.5);
        this.st.idleTimer = 0;
        SFX.hit(); n.remove(); this.updateHUD();
      }else{
        this.st.combo=1; this.takeDamage(0.3,'Off-beat');
        this.st.overload = Math.max(0, this.st.overload - 0.2);
        SFX.warn(); this.updateHUD();
      }
    },

    /* ===== Shared End / (optional) manualRay for combat if not legacy ===== */
    endGame:function(){ this.st.playing=false; toast(`${T(this.dict,'finished','Finished')} • ${T(this.dict,'score','Score')}: ${this.st.score}`,2000); }
  });
})();
