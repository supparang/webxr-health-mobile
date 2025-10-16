/* Shadow Breaker – Mixed Signature Fitness Build (G5 Glow)
   Components: A-Frame runtime for 4 games (combat/dash/impact/flow)
   Updates:
   - Default mode 'timed' so time always shows & decrements
   - HUD time forced visible (anti-hide)
   - Arcane Combat: Multi-Gate boss spawn (Score OR Kills OR Assist), Safety Gate
   - Boss Debug HUD (shows S/K/A gates live)
   - Force Boss (press B) for testing
   - Fitness (calories + level), Daily quests
*/
(function(){
  // ---------- helpers ----------
  const $  =(id)=>document.getElementById(id);
  const qs =(sel)=>document.querySelector(sel);
  const T  =(d,k,def)=>(d&&d[k])||def||k;
  const tr =(d,k,f,v)=>{let s=(d&&d[k])||f||k; if(v) Object.keys(v).forEach(x=>s=s.replaceAll('{'+x+'}',String(v[x]))); return s; };

  const toast=(m,ms=900)=>{ const t=$('toast'); if(!t) return; t.textContent=m; t.style.display='block'; setTimeout(()=>t.style.display='none',ms); };

  const SFX={ctx:null,
    beep(f=880,d=.08,v=.2){try{this.ctx=this.ctx||new (window.AudioContext||window.webkitAudioContext)();const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='square';o.frequency.value=f;g.gain.value=v;o.connect(g);g.connect(this.ctx.destination);o.start();o.stop(this.ctx.currentTime+d);}catch(_){ } },
    hit(){this.beep(920,.05,.2)}, ok(){this.beep(660,.07,.18)}, warn(){this.beep(200,.11,.22)}
  };

  function updateOverloadUI(v){
    const w=$('overloadBarWrap'),f=$('overloadBarFill'),t=$('overloadBarText'); if(!w) return;
    const p=Math.max(0,Math.min(100,Math.round(v)));
    if(f) f.style.width=p+'%';
    if(t) t.textContent='Overload: '+p+'%';
    w.className=''; w.id='overloadBarWrap';
    if(p>=50&&p<80) w.classList.add('danger'); else if(p>=80&&p<100) w.classList.add('critical'); else if(p>=100) w.classList.add('z2');
  }

  function ensureWarnDOM(){
    let w=$('warnWrap');
    if(!w){
      w=document.createElement('div'); w.id='warnWrap'; w.className='warn-wrap';
      w.innerHTML=`<div id="warnL" class="warn-arrow" style="visibility:hidden">← DASH</div>
                   <div id="warnU" class="warn-arrow" style="visibility:hidden">JUMP ↑</div>
                   <div id="warnD" class="warn-arrow" style="visibility:hidden">DUCK ↓</div>
                   <div id="warnR" class="warn-arrow" style="visibility:hidden">DASH →</div>`;
      document.body.appendChild(w);
      const mid=document.createElement('div'); mid.id='warnMid'; mid.className='warn-mid';
      mid.innerHTML=`<div id="warnShift" class="warn-arrow" style="visibility:hidden">SHIFT – BURST!</div>`;
      document.body.appendChild(mid);
    }
  }
  function showWarn(which,ms=800){
    ensureWarnDOM();
    const el={left:$('warnL'),right:$('warnR'),up:$('warnU'),down:$('warnD'),burst:$('warnShift')}[which];
    if(!el) return; el.style.visibility='visible'; el.classList.add('flash');
    setTimeout(()=>{el.style.visibility='hidden'; el.classList.remove('flash');},ms);
  }

  const DIFF={
    easy:   { spawnMs:950, lifeMs:3800, timedSec:80, missHP:0, bossHit:3,  clickMissHP:0, olTickMinor:0.25, olTickMajor:0.8 },
    normal: { spawnMs:780, lifeMs:3200, timedSec:65, missHP:3, bossHit:6,  clickMissHP:1, olTickMinor:0.35, olTickMajor:1.0 },
    hard:   { spawnMs:650, lifeMs:2800, timedSec:55, missHP:5, bossHit:10, clickMissHP:2, olTickMinor:0.45, olTickMajor:1.25 }
  };

  const QUEST_KEY='sb_daily_v1';
  const genDaily=()=>{ const today=new Date().toISOString().slice(0,10);
    const ex=JSON.parse(localStorage.getItem(QUEST_KEY)||'{}'); if(ex.date===today) return ex;
    const q={date:today,list:[
      {id:'score1500',name:{th:'ทำคะแนนรวม 1,500',en:'Reach total score 1,500'},goal:1500,cur:0,done:false},
      {id:'combo8',   name:{th:'ทำคอมโบ x8',       en:'Reach combo x8'},          goal:8,   cur:0,done:false},
      {id:'boss1',    name:{th:'ชนะบอส 1 ครั้ง',  en:'Defeat 1 boss'},           goal:1,   cur:0,done:false}
    ]}; localStorage.setItem(QUEST_KEY,JSON.stringify(q)); return q;
  };
  const saveDaily=q=>localStorage.setItem(QUEST_KEY,JSON.stringify(q));
  function updateQuestUI(dict,q){
    const box=$('qList'),title=$('qTitle'); if(!box) return;
    title.textContent=T(dict,'dailyQuests','Daily Quests');
    box.innerHTML='';
    q.list.forEach(it=>{
      const nm=it.name[(localStorage.getItem('sb_lang')||'th')];
      const line=document.createElement('div'); line.textContent=`• ${nm} — ${it.cur}/${it.goal} ${it.done?'✓':''}`;
      box.appendChild(line);
    });
  }

  function kcalFromActivity(ptsPerSec, bodyMass=40){ const MET=Math.min(8,2+ptsPerSec*0.04); return (MET*bodyMass/3600); }
  function levelFromScore(score){ if(score<800) return 1; if(score<1800) return 2; if(score<3200) return 3; if(score<5200) return 4; if(score<8000) return 5; return 6; }

  // ---------- component ----------
  AFRAME.registerComponent('shadow-breaker-game',{
    init:function(){
      const q=new URLSearchParams(location.search);
      this.game=q.get('game')||'combat';
      const rawMode=q.get('mode'); this.mode=(rawMode==='practice')?'practice':'timed'; // default timed
      this.diff=q.get('diff')||'normal'; this.cfg=DIFF[this.diff]||DIFF.normal;
      this.ibMode=(q.get('ib')||'count').toLowerCase();

      fetch('src/i18n.json').then(r=>r.json()).then(data=>{
        const cur=localStorage.getItem('sb_lang')||'th';
        this.i18n=data; this.dict=data[cur]||data['th']||{};
        window.__shadowBreakerSetLang=(v)=>{ localStorage.setItem('sb_lang',v); this.dict=this.i18n[v]||this.i18n['th']||{}; this.updateHUD(); this.updateObjective(); };

        this.st={
          playing:false,
          timeLeft:(this.mode==='timed')?(this.cfg.timedSec||60):9999,
          score:0, combo:1, arcane:0, overload:0, hp:100,
          last:performance.now(), spawnEveryMs:this.cfg.spawnMs, spawnTimer:performance.now()-this.cfg.spawnMs-1,
          dmgCD:0, olTick:0, idleTimer:0,
          // combat
          kills:0, phase:'tutorial', boss:null,
          _dbg:{scoreGate:false,killGate:false,assistGate:false}, // << Debug gate flags
          // dash
          jumpT:0, crouch:false, side:0, sideT:0, burst:0, burstCD:0,
          // impact
          chargeStart:0, _impactAlive:false, cores:0, reps:0, bossHP:0, bossAlive:false,
          // flow
          flowNext:0,
          // fitness
          kcal:0, level:1
        };

        this.updateHUD(); this.updateObjective(); this.startGame();
        if(this.game==='combat') this.showCombatTutorial();
        try{ console.info('[SB] game=%s mode=%s diff=%s time=%s', this.game, this.mode, this.diff, this.st.timeLeft); }catch(_){}
      });

      window.addEventListener('keydown',(e)=>{
        if(this.game==='dash'){
          if(e.key==='ArrowUp'||e.code==='Space'){ if(this.st.jumpT<=0) this.st.jumpT=0.6; }
          if(e.key==='ArrowDown'){ this.st.crouch=true; }
          if(e.key==='ArrowLeft'){ this.st.side=-1; this.st.sideT=0.35; }
          if(e.key==='ArrowRight'){ this.st.side=1; this.st.sideT=0.35; }
          if(e.key==='Shift'&&this.st.burstCD<=0){ this.st.burst=0.28; this.st.burstCD=2.0; showWarn('burst',480); SFX.ok(); }
        }
        if(this.game==='flow'){
          if('aA'.includes(e.key)) this.checkFlowHit('A');
          if('sS'.includes(e.key)) this.checkFlowHit('S');
          if('dD'.includes(e.key)) this.checkFlowHit('D');
        }
        if(this.game==='impact' && (e.key==='m'||e.key==='M')){
          const order=['count','timed','boss','endless','fitness'];
          const i=Math.max(0,order.indexOf(this.ibMode));
          this.ibMode=order[(i+1)%order.length); this.st.cores=0; this.st.reps=0; this.st.bossHP=0; this.st.bossAlive=false;
          if(this.ibMode==='timed') this.st.timeLeft=60;
          this.updateObjective(); this.updateHUD();
          toast(tr(this.dict,'ibModeSwitch','Impact mode: {MODE} (press M)',{MODE:this.ibMode.toUpperCase()}),1200);
        }
        // TEST: Force Boss (Combat) – press B
        if(this.game==='combat' && (e.key==='b'||e.key==='B')){
          if(!this.st.boss){ this.st.phase='boss'; this.spawnMiniBoss(); toast('FORCE BOSS (Test)',900); }
        }
      });
      window.addEventListener('keyup',(e)=>{ if(this.game==='dash' && e.key==='ArrowDown') this.st.crouch=false; });
      window.addEventListener('mousedown', e=>{ if(this.game==='impact') this.st.chargeStart=performance.now(); });
      window.addEventListener('mouseup',   e=>{ if(this.game==='impact') this.releaseImpact(); });

      window.addEventListener('click', this.manualRay && this.manualRay.bind(this), {passive:false});
    },

    startGame:function(){ this.st.playing=true; this.loop(); },

    updateObjective:function(){
      const o=$('objective'); if(!o) return;
      if(this.game==='combat'){
        const gateTxt=(this.diff==='easy')
          ? 'ทำคะแนน ≥ 300 หรือ ยิงโดน ≥ 8 ลูก เพื่อเรียกบอส'
          : (this.diff==='hard'
              ? 'ทำคะแนน ≥ 420 หรือ ยิงโดน ≥ 12 ลูก เพื่อเรียกบอส'
              : 'ทำคะแนน ≥ 360 หรือ ยิงโดน ≥ 10 ลูก เพื่อเรียกบอส');
        o.textContent = gateTxt + ' • ใกล้หมดเวลามีโอกาสปล่อยบอสด่วน';
        return;
      }
      if(this.game==='dash'){ o.textContent=T(this.dict,'objectiveDash','Avoid walls/lasers: ↑ Jump • ↓ Duck • ←/→ Side • SHIFT Burst'); return; }
      if(this.game==='impact'){
        const d=this.dict,m=this.ibMode;
        if(m==='count')   return o.textContent=tr(d,'ibObjectiveA','Destroy {N} cores',{N:10});
        if(m==='timed')   return o.textContent=tr(d,'ibObjectiveB','High score before time ends ({T}s)',{T:60});
        if(m==='boss')    return o.textContent=tr(d,'ibObjectiveC','Break {X} cores to summon the boss, then defeat it!',{X:5});
        if(m==='endless') return o.textContent=tr(d,'ibObjectiveD','Endless training for high score');
        if(m==='fitness') return o.textContent=tr(d,'ibObjectiveE','Do charge-release for {R} reps',{R:50});
        return;
      }
      if(this.game==='flow'){ o.textContent=T(this.dict,'objectiveFlow','Press A / S / D on beat'); return; }
    },

    updateHUD:function(){
      const s=this.st||{}, d=this.dict||{}, L=(k,def)=>(d&&d[k])||def, timed=(this.mode==='timed');
      const set=(id,txt)=>{ const el=$(id); if(!el) return; el.style.display='inline-flex'; el.style.visibility='visible'; el.textContent=txt; };

      set('hudScore', `${L('score','Score')}: ${s.score||0}`);
      set('hudCombo', `${L('combo','Combo')}: x${s.combo||1}`);
      set('hudTime',  `${L('time','Time')}${timed?' ⏱':''}: ${timed?Math.ceil(s.timeLeft||0):'∞'}`);
      set('hudArcane',`${L('arcane','Arcane')}: ${Math.round(s.arcane||0)}%`);
      set('hudHP',    `${L('hp','ENERGY')}: ${Math.max(0,Math.ceil(s.hp||0))}`);
      set('hudOverload', `Overload: ${Math.round(s.overload||0)}%`);
      const bossTxt=(this.game==='combat' && s.boss)?`${L('bossHP','Boss HP')}: ${Math.max(0,Math.ceil(s.boss.hp||0))}`:`${L('bossHP','Boss HP')}: —`;
      set('hudBoss', bossTxt);

      const calEl=$('hudCal'); if(calEl){ calEl.style.display='inline-flex'; calEl.style.visibility='visible'; calEl.textContent = `${L('calories','Calories')}: ${(s.kcal||0).toFixed(1)}`; }
      const lvlEl=$('hudLvl'); if(lvlEl){ const lvl=levelFromScore(s.score||0); s.level=lvl; lvlEl.style.display='inline-flex'; lvlEl.style.visibility='visible'; lvlEl.textContent = `${L('level','Level')}: ${lvl}`; }

      const back=$('backLink'); if(back) back.textContent=L('back','Back');
      const hpFill=$('hpBarFill'); if(hpFill) hpFill.style.width=Math.max(0,Math.min(100,s.hp||0))+'%';
      updateOverloadUI(s.overload||0);

      if(this.daily) updateQuestUI(this.dict,this.daily); else { this.daily=genDaily(); updateQuestUI(this.dict,this.daily); }

      // --- DEBUG HUD (Boss Gates Live) ---
      const dbg=$('hudDBG');
      if(dbg){
        const S=this.st.score|0, K=this.st.kills|0, T=(this.mode==='timed')?Math.ceil(this.st.timeLeft||0):Infinity;
        const g=this.st._dbg||{scoreGate:false,killGate:false,assistGate:false};
        dbg.style.display='inline-flex'; dbg.style.visibility='visible';
        dbg.textContent=`Boss? S:${g.scoreGate?'✓':'-'} K:${g.killGate?'✓':'-'} A:${g.assistGate?'✓':'-'} • ${S} / K${K} / ${isFinite(T)?(T+'s'):'∞'}`;
      }
    },

    takeDamage:function(amount,label){
      if(amount<=0||this.st.dmgCD>0) return;
      this.st.hp=Math.max(0,this.st.hp-amount); this.st.dmgCD=0.5;
      toast(`-${Math.round(amount)} HP${label?(' ('+label+')'):''}`); this.updateHUD();
    },

    loop:function(){
      if(!this.st || !this.st.playing) return;
      requestAnimationFrame(this.loop.bind(this));
      const now=performance.now(); let dt=(now-this.st.last)/1000; if(dt<0||dt>0.25) dt=0.016; this.st.last=now;

      if(this.mode==='timed'){
        this.st.timeLeft=Math.max(0,(this.st.timeLeft||0)-dt);
        if(this.st.timeLeft<=0){ this.endGame(); this.updateHUD(); return; }
      }

      const ptsRate=Math.max(0, ((this.st.combo||1)-1)*8 + (this.st.overload||0)/10);
      this.st.kcal += kcalFromActivity(ptsRate);

      this.st.olTick+=dt;
      if(this.st.overload>=80 && this.st.overload<100 && this.st.olTick>=0.6){ this.takeDamage(this.cfg.olTickMinor,'Overload'); this.st.olTick=0; }
      if(this.st.overload>=100 && this.st.olTick>=0.5){ this.takeDamage(this.cfg.olTickMajor,'Overload+'); this.st.olTick=0; }

      if(this.game==='combat') this.tickCombat(now,dt);
      if(this.game==='dash')   this.tickDash(now,dt);
      if(this.game==='impact') this.tickImpact(now,dt);
      if(this.game==='flow')   this.tickFlow(now,dt);

      this.updateHUD();
      if((this.st.hp||0)<=0) this.endGame();
    },

    // ===== COMBAT =====
    tickCombat:function(now,dt){
      if(now-this.st.spawnTimer>this.st.spawnEveryMs){ this.st.spawnTimer=now; this.spawnTarget(); }

      const gates={
        easy:   { score:300, kills:8,  assistTime:18, assistScoreRatio:0.55, safetyAt:25, safetyScore:180, safetyKills:6 },
        normal: { score:360, kills:10, assistTime:18, assistScoreRatio:0.60, safetyAt:25, safetyScore:220, safetyKills:8  },
        hard:   { score:420, kills:12, assistTime:20, assistScoreRatio:0.65, safetyAt:28, safetyScore:260, safetyKills:10 }
      }[this.diff] || { score:360, kills:10, assistTime:18, assistScoreRatio:0.60, safetyAt:25, safetyScore:220, safetyKills:8 };

      if(this.mode==='timed' && this.st.timeLeft <= gates.assistTime+10){
        this.st.spawnEveryMs = Math.max(500, this.cfg.spawnMs*0.85);
      }

      const scoreGate  = (this.st.score >= gates.score);
      const killGate   = (this.st.kills >= gates.kills);
      const assistGate = (this.mode==='timed' && this.st.timeLeft <= gates.assistTime &&
                          this.st.score >= Math.floor(gates.score * gates.assistScoreRatio));

      // DEBUG flags
      this.st._dbg={scoreGate,killGate,assistGate};

      // Safety Gate
      let safetyGate=false;
      if(this.mode==='timed'){
        const total=(this.cfg.timedSec||60);
        const elapsed=Math.max(0,total-(this.st.timeLeft||0));
        if(elapsed>=gates.safetyAt && (this.st.score>=gates.safetyScore || this.st.kills>=gates.safetyKills)){
          safetyGate=true;
        }
      }

      if(this.st.phase!=='boss' && (scoreGate||killGate||assistGate||safetyGate)){
        this.st.phase='boss';
        this.spawnMiniBoss();
      }
    },

    spawnTarget:function(){
      const sp=qs('#spawner'); if(!sp) return;
      const e=document.createElement('a-entity');
      e.setAttribute('geometry','primitive: sphere; radius: 0.25');
      e.setAttribute('material','color:#39c5bb; emissive:#0af; metalness:0.1; roughness:0.4');
      const rx=(Math.random()*2-1)*0.9, ry=1.2+Math.random()*0.6, rz=-2.0-Math.random()*0.5;
      e.setAttribute('position',{x:rx,y:ry,z:rz}); e.classList.add('clickable');
      e.setAttribute('animation__pulse','property: scale; to:1.12 1.12 1.12; dir:alternate; loop:true; dur:650');

      e.addEventListener('click',()=>{ if(!this.st.playing) return;
        this.st.combo=Math.min(20,this.st.combo+1);
        const add=120+(this.st.combo-1)*12;
        this.st.score+=add; this.st.arcane=Math.min(100,this.st.arcane+3);
        this.st.overload=Math.min(130,this.st.overload+0.9); this.st.idleTimer=0;
        this.st.kills++; // << important
        if(this.st.boss){ this.damageBoss(3); }
        SFX.hit(); e.remove(); this.updateHUD();
      });

      setTimeout(()=>{ if(e.parentNode){ e.remove(); this.st.combo=1;
        if(this.diff!=='easy') this.takeDamage(this.cfg.missHP, T(this.dict,'miss','Miss'));
        this.st.overload=Math.max(0,this.st.overload-0.6); this.updateHUD(); } }, this.cfg.lifeMs);

      sp.appendChild(e);
    },

    spawnMiniBoss:function(){
      if(this.st.boss) return;
      const b={hp:140, el:document.createElement('a-entity')};
      b.el.setAttribute('geometry','primitive: icosahedron; radius: 0.6');
      b.el.setAttribute('material','color:#17394a; emissive:#0ff; metalness:0.2; roughness:0.2');
      b.el.setAttribute('position',{x:0,y:1.6,z:-2.6}); b.classList.add('boss');
      qs('#spawner').appendChild(b.el); this.st.boss=b; toast(T(this.dict,'missionBoss','Mini Boss!'));
      const atk=()=>{ if(!this.st.boss||!this.st.playing||this.st.hp<=0) return;
        const dmg=this.cfg.bossHit + Math.floor(this.st.overload/50); this.takeDamage(dmg,T(this.dict,'bossAttack','Boss attack'));
        if(this.st.hp>0 && this.st.boss) setTimeout(atk,1800);
      };
      setTimeout(atk,1200);
    },

    damageBoss:function(amount){
      if(!this.st.boss) return;
      this.st.boss.hp -= amount;
      if(this.st.boss.hp<=0){
        try{ this.st.boss.el.remove(); }catch(_){}
        this.st.boss=null; toast(T(this.dict,'missionClear','Mission Clear'));
        if(this.daily){ const it=this.daily.list.find(x=>x.id==='boss1'); if(it && !it.done){ it.cur=1; it.done=true; saveDaily(this.daily); } }
      }
      this.updateHUD();
    },

    manualRay:function(evt){
      const sceneEl=qs('a-scene'), camEl=$('camera');
      const renderer=sceneEl && sceneEl.renderer, camera=camEl && camEl.getObject3D('camera');
      if(!renderer||!camera||!this.st.playing) return;
      const rect=renderer.domElement.getBoundingClientRect();
      const mouse=new THREE.Vector2(((evt.clientX-rect.left)/rect.width)*2-1,-((evt.clientY-rect.top)/rect.height)*2+1);
      const raycaster=new THREE.Raycaster(); raycaster.setFromCamera(mouse,camera);
      const nodes=[...document.querySelectorAll('.clickable')].map(el=>el.object3D).filter(Boolean);
      const hits=raycaster.intersectObjects(nodes,true);
      if(hits.length){ let obj=hits[0].object; while(obj && !obj.el) obj=obj.parent; if(obj && obj.el) obj.el.emit('click'); }
    },

    showCombatTutorial:function(){
      try{ const el=document.createElement('div'); el.id='tutorialTip';
        Object.assign(el.style,{position:'fixed',left:'50%',top:'14%',transform:'translateX(-50%)',zIndex:'10010',background:'rgba(0,0,0,.65)',border:'1px solid rgba(255,255,255,.15)',padding:'10px 14px',borderRadius:'12px',color:'#cfefff',fontWeight:'700',letterSpacing:'.3px'});
        el.textContent=T(this.dict,'missionStart','Mission Start: Tutorial'); document.body.appendChild(el);
        setTimeout(()=>{el.style.opacity='0';},18000); setTimeout(()=>{ try{el.remove();}catch(_){ } },20000);
      }catch(_){}
    },

    // ===== DASH =====
    tickDash:function(now,dt){
      if(this.st.jumpT>0) this.st.jumpT=Math.max(0,this.st.jumpT-dt);
      if(this.st.sideT>0) this.st.sideT=Math.max(0,this.st.sideT-dt); else this.st.side=0;
      if(this.st.burst>0) this.st.burst=Math.max(0,this.st.burst-dt);
      if(this.st.burstCD>0) this.st.burstCD=Math.max(0,this.st.burstCD-dt);

      const rig=$('rig');
      if(rig){
        const baseY=1.6;
        const y=(this.st.jumpT>0)?baseY+0.42*Math.sin((0.6-this.st.jumpT)/0.6*Math.PI):(this.st.crouch?baseY-0.38:baseY);
        const x=(this.st.side!==0?this.st.side*0.6*(this.st.sideT/0.35):0)+(this.st.burst>0?(this.st.side||1)*0.25:0);
        rig.setAttribute('position',`${x.toFixed(3)} ${y.toFixed(3)} 0`);
      }

      const spawnGap=Math.max(520,this.cfg.spawnMs);
      if(now-this.st.spawnTimer>spawnGap){ this.st.spawnTimer=now; this.spawnDashObstacle(now); }

      document.querySelectorAll('.hazard').forEach(h=>{
        const z=Number(h.dataset.z||-3.5), speed=2.4, nz=z+speed*dt*(this.st.burst>0?1.25:1.0);
        h.dataset.z=nz; h.setAttribute('position',`${h.dataset.x||0} ${h.dataset.y||0} ${nz.toFixed(3)}`);
        if(!h.dataset.warned && nz>-2.6){ h.dataset.warned='1'; const t=h.dataset.type;
          if(t==='low')showWarn('up',700); if(t==='high')showWarn('down',700); if(t==='leftBeam')showWarn('right',700); if(t==='rightBeam')showWarn('left',700); if(t==='shock')showWarn('burst',700); }
        if(nz>-0.2 && !h.dataset.hit){
          h.dataset.hit='1';
          const ok=this.checkDashPose(h.dataset.type);
          if(ok){ this.st.score+=150; this.st.combo=Math.min(20,this.st.combo+1); this.st.overload=Math.min(130,this.st.overload+1.0); this.st.idleTimer=0; SFX.ok(); }
          else { this.st.combo=1; const dmg=this.cfg.missHP+1; this.takeDamage(dmg,'Rift Hit'); this.st.overload=Math.max(0,this.st.overload-0.5); SFX.warn(); }
          setTimeout(()=>{ try{h.remove();}catch(_){ } },40);
        }
      });
    },

    spawnDashObstacle:function(){
      const e=document.createElement('a-entity'); e.classList.add('hazard');
      const r=Math.random(); let type='mid';
      if(r<0.25) type='low'; else if(r<0.5) type='high'; else if(r<0.7) type='leftBeam'; else if(r<0.9) type='rightBeam'; else type='shock';
      e.dataset.type=type;
      let x=0,y=0,geo='',mat='';
      if(type==='low'){ y=0.35; geo='primitive: box; width: 2.2; height:0.32; depth:0.22'; mat='color:#8bd8ff; emissive:#3cf; opacity:0.9; transparent:true'; }
      else if(type==='high'){ y=1.45; geo='primitive: box; width: 2.2; height:0.32; depth:0.22'; mat='color:#8bd8ff; emissive:#3cf; opacity:0.9; transparent:true'; }
      else if(type==='leftBeam'){ x=-0.7; y=1.0; geo='primitive: box; width: 0.25; height:1.8; depth:0.25'; mat='color:#ff8b8b; emissive:#f55; opacity:0.95; transparent:true'; }
      else if(type==='rightBeam'){ x=0.7; y=1.0; geo='primitive: box; width: 0.25; height:1.8; depth:0.25'; mat='color:#ff8b8b; emissive:#f55; opacity:0.95; transparent:true'; }
      else { y=0.95; geo='primitive: dodecahedron; radius:0.38'; mat='color:#ffd36b; emissive:#fa0; metalness:0.2; roughness:0.2'; }
      e.dataset.x=x; e.dataset.y=y; e.dataset.z=-3.5;
      e.setAttribute('geometry',geo); e.setAttribute('material',mat);
      e.setAttribute('position',`${x} ${y} -3.5`);
      e.setAttribute('animation__pulse','property: scale; dir: alternate; loop:true; dur:600; to:1.08 1.08 1.08');
      qs('#spawner').appendChild(e);
    },

    checkDashPose:function(type){
      const isJump=this.st.jumpT>0, isDuck=this.st.crouch, isLeft=this.st.side<0&&this.st.sideT>0, isRight=this.st.side>0&&this.st.sideT>0, burst=this.st.burst>0;
      if(type==='low') return isJump; if(type==='high') return isDuck; if(type==='leftBeam') return isRight||burst; if(type==='rightBeam') return isLeft||burst; if(type==='shock') return burst; return false;
    },

    // ===== IMPACT =====
    tickImpact:function(now,dt){
      if(!this._impactAlive){ this.spawnImpactCore(); }
      if(this.st.chargeStart>0){
        const t=(now-this.st.chargeStart)/1000; const pct=Math.min(100,Math.round(t/2*100));
        const arc=$('hudArcane'); if(arc) arc.textContent=`CHARGE: ${pct}%`;
      }
    },
    spawnImpactCore:function(){
      const e=document.createElement('a-entity');
      e.setAttribute('geometry','primitive: dodecahedron; radius:0.62');
      e.setAttribute('material','color:#ffb36b; emissive:#f80; metalness:0.2; roughness:0.2');
      e.setAttribute('position','0 1.3 -2.2'); e.classList.add('impact-core');
      this._impactAlive=true; qs('#spawner').appendChild(e);
      if(this.ibMode==='boss' && this.st.bossAlive){ try{e.remove();}catch(_){ } this._impactAlive=false; }
    },
    releaseImpact:function(){
      const e=qs('.impact-core'); const held=this.st.chargeStart>0?(performance.now()-this.st.chargeStart)/1000:0; this.st.chargeStart=0;
      const clamped=Math.max(0,Math.min(2,held)); const dmg=Math.round(200*clamped); const olGain=1.1*(clamped/2); const good=clamped>=0.12;
      if(this.ibMode==='fitness'){ const need=0.3; if(clamped>=need) this.st.reps++; }
      if(this.ibMode==='boss' && this.st.bossAlive){
        const dealt=Math.max(20,Math.round(dmg*0.8)); this.st.bossHP=Math.max(0,this.st.bossHP-dealt);
        this.st.score+=Math.round(dealt*0.4); this.st.overload=Math.min(130,this.st.overload+olGain);
        const hb=$('hudBoss'); if(hb) hb.textContent=`${T(this.dict,'bossHP','Boss HP')}: ${this.st.bossHP}`;
        if(this.st.bossHP<=0){ this.killImpactBoss(); return this.finishImpact(); }
        this.updateHUD(); return;
      }
      if(good){
        this.st.score+=dmg; this.st.combo=Math.min(20,this.st.combo+1);
        this.st.overload=Math.min(130,this.st.overload+olGain); this.st.idleTimer=0;
        if(e){ try{e.remove();}catch(_){ } } this._impactAlive=false; this.st.cores++;
        if(this.ibMode==='boss' && !this.st.bossAlive && this.st.cores>=5){ this.summonImpactBoss(); return; }
        if(this.ibMode==='count' && this.st.cores>=10) return this.finishImpact();
        if(this.ibMode==='fitness' && this.st.reps>=50) return this.finishImpact();
        setTimeout(()=>this.spawnImpactCore(),650); this.updateHUD();
      }
    },
    summonImpactBoss:function(){
      this.st.bossAlive=true; this.st.bossHP=600;
      const b=document.createElement('a-entity');
      b.setAttribute('geometry','primitive: icosahedron; radius: 0.95');
      b.setAttribute('material','color:#2b1144; emissive:#a0f; metalness:0.3; roughness:0.2');
      b.setAttribute('position','0 1.6 -2.4'); b.id='impact-boss';
      b.setAttribute('animation__float','property: position; to: 0 1.7 -2.4; dir: alternate; loop:true; dur:900; easing:easeInOutSine');
      qs('#spawner').appendChild(b); toast(tr(this.dict,'ibBossSummoned','Boss summoned!'),1200);
      const hb=$('hudBoss'); if(hb) hb.textContent=`${T(this.dict,'bossHP','Boss HP')}: ${this.st.bossHP}`;
    },
    killImpactBoss:function(){ const b=$('impact-boss'); if(b){ try{b.remove();}catch(_){ } } this.st.bossAlive=false; this.st.bossHP=0; toast(T(this.dict,'missionClear','Mission Clear'),1200); },
    finishImpact:function(){ this.st.playing=false; const msg=tr(this.dict,'ibFinished','Finished • Score: {SCORE}',{SCORE:this.st.score}); toast(msg,2200); this.updateHUD(); },

    // ===== FLOW =====
    tickFlow:function(now,dt){
      if(!this.st.flowNext) this.st.flowNext=now+800;
      if(now>=this.st.flowNext){ const lanes=['A','S','D']; const L=lanes[Math.floor(Math.random()*lanes.length)]; this.spawnFlowNote(L,now); this.st.flowNext=now+900; }
      document.querySelectorAll('.flow-note').forEach(n=>{
        const born=Number(n.dataset.t0||0), age=now-born, life=900, y=Math.min(100,(age/life)*100);
        n.style.top=(10+y*0.6)+'%'; if(age>life+200){ n.remove(); this.st.combo=1; this.takeDamage(0.4,'Late'); }
      });
    },
    spawnFlowNote:function(lane,now){
      let wrap=$('flowWrap'); if(!wrap){ wrap=document.createElement('div'); wrap.id='flowWrap';
        Object.assign(wrap.style,{position:'fixed',left:'50%',transform:'translateX(-50%)',top:'12%',zIndex:'10006',pointerEvents:'none',width:'360px'});
        wrap.innerHTML=`<div style="display:flex;gap:14px;justify-content:center"><div class="badge">A</div><div class="badge">S</div><div class="badge">D</div></div>`;
        document.body.appendChild(wrap);
      }
      const n=document.createElement('div'); n.className='flow-note badge'; n.dataset.t0=String(now); n.dataset.key=lane;
      Object.assign(n.style,{position:'absolute',left:lane==='A'?'20%':(lane==='S'?'45%':'70%'),top:'10%',background:'rgba(0,0,0,.55)',border:'1px solid #49b'}); n.textContent=lane; wrap.appendChild(n);
      const obj=$('objective'); if(obj) obj.textContent=T(this.dict,'objectiveFlow','Press A/S/D on beat');
    },
    checkFlowHit:function(key){
      const notes=[...document.querySelectorAll('.flow-note')].filter(n=>n.dataset.key===key); if(!notes.length) return;
      notes.sort((a,b)=>parseFloat(b.style.top)-parseFloat(a.style.top)); const n=notes[0];
      const now=performance.now(), born=Number(n.dataset.t0||0), age=now-born, life=900, delta=Math.abs(age-life);
      if(delta<=200){ this.st.score += (delta<80?150:100); this.st.combo=Math.min(20,this.st.combo+1); this.st.overload=Math.min(130,this.st.overload+0.5); this.st.idleTimer=0; SFX.hit(); n.remove(); this.updateHUD(); }
      else{ this.st.combo=1; this.takeDamage(0.25,'Off-beat'); this.st.overload=Math.max(0,this.st.overload-0.2); SFX.warn(); this.updateHUD(); }
    },

    endGame:function(){ this.st.playing=false; toast(`${T(this.dict,'finished','Finished')} • ${T(this.dict,'score','Score')}: ${this.st.score}`,2000); }
  });
})();
