// Shadow Breaker – Phase C Packs + HP Rebalance:
// - C1: Critical Hit + Combo Alert + Hit FX
// - C2: Enemies: Heavy / Split / Trap (+ Speed / Shield / Curse)
// - C3: Score System Pro: Grade + Best Score persist
// - HP Rebalance: damage cooldown + softer OL drain + lower damage presets
(function(){
  const $=(id)=>document.getElementById(id);
  const qs=(sel)=>document.querySelector(sel);
  const T=(dict,k,def)=> (dict && dict[k]) || def || k;
  const toast=(m,ms=900)=>{const t=$('toast'); if(!t) return; t.textContent=m; t.style.display='block'; setTimeout(()=>t.style.display='none',ms);};

  // ===== SFX =====
  const SFX={ctx:null,
    beep(f=880,d=.08,v=.2){try{this.ctx=this.ctx||new (window.AudioContext||window.webkitAudioContext)();const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='square';o.frequency.value=f;g.gain.value=v;o.connect(g);g.connect(this.ctx.destination);o.start();o.stop(this.ctx.currentTime+d);}catch(e){}},
    hit(){this.beep(920,.05,.2)}, ok(){this.beep(660,.07,.18)}, warn(){this.beep(160,.12,.25)}, crit(){this.beep(1400,.06,.25)}
  };

  // ===== Overload bar UI =====
  function updateOverloadUI(val){
    const wrap=$('overloadBarWrap'), fill=$('overloadBarFill'), text=$('overloadBarText');
    if(!wrap||!fill||!text) return;
    const p=Math.max(0,Math.min(100,Math.round(val)));
    fill.style.width=p+'%'; text.textContent='Overload: '+p+'%';
    wrap.className=''; wrap.id='overloadBarWrap';
    if(p>=50&&p<80) wrap.classList.add('danger');
    else if(p>=80&&p<100) wrap.classList.add('critical');
    else if(p>=100) wrap.classList.add('z2');
  }

  // ===== Score popup (supports crit) =====
  function spawnScorePopup(worldPos, text="+100", cls="pop-score"){
    const scene=qs('a-scene'), cam=$('camera'); if(!scene||!cam) return;
    const camera=cam.getObject3D('camera'), renderer=scene.renderer; if(!camera||!renderer) return;
    const v=new THREE.Vector3(worldPos.x,worldPos.y,worldPos.z).project(camera);
    const rect=renderer.domElement.getBoundingClientRect();
    const x=(v.x*.5+.5)*rect.width+rect.left, y=(-v.y*.5+.5)*rect.height+rect.top;
    const div=document.createElement('div'); div.className=`hit-popup ${cls}`;
    div.style.left=x+'px'; div.style.top=y+'px'; div.textContent=text;
    document.body.appendChild(div); requestAnimationFrame(()=>div.classList.add('show'));
    setTimeout(()=>{ div.style.opacity='0'; },380); setTimeout(()=>{ try{div.remove();}catch(e){} },700);
  }

  // ===== Combo Alert (C1) =====
  function comboAlert(combo, dict){
    const el=document.createElement('div');
    el.className='combo-alert';
    el.textContent=`${(dict&&dict.combo)||'Combo'} x${combo}!`;
    document.body.appendChild(el);
    requestAnimationFrame(()=> el.classList.add('show'));
    setTimeout(()=>{ el.classList.remove('show'); el.style.opacity='0'; }, 500);
    setTimeout(()=>{ try{el.remove();}catch(e){} }, 800);
  }

  // ===== Daily Quests =====
  const QUEST_KEY='sb_daily_v1';
  function genDaily(){
    const today=new Date().toISOString().slice(0,10);
    const exist=JSON.parse(localStorage.getItem(QUEST_KEY)||'{}');
    if(exist.date===today) return exist;
    const q={ date:today, list:[
      {id:'score1500', name:{th:'ทำคะแนนรวม 1,500', en:'Reach total score 1,500'}, goal:1500, cur:0, done:false, type:'score'},
      {id:'combo8',    name:{th:'ทำคอมโบ x8',       en:'Reach combo x8'},        goal:8,    cur:0, done:false, type:'combo'},
      {id:'boss1',     name:{th:'ชนะบอส 1 ครั้ง',   en:'Defeat 1 boss'},         goal:1,    cur:0, done:false, type:'boss'}
    ]};
    localStorage.setItem(QUEST_KEY, JSON.stringify(q)); return q;
  }
  function saveDaily(q){ localStorage.setItem(QUEST_KEY, JSON.stringify(q)); }
  function updateQuestUI(dict,q){
    const box=$('qList'); const title=$('qTitle'); if(!box) return;
    title.textContent=T(dict,'dailyQuests','Daily Quests');
    box.innerHTML='';
    q.list.forEach(it=>{
      const nm = it.name[(localStorage.getItem('sb_lang')||'th')];
      const line=document.createElement('div');
      line.textContent=`• ${nm} — ${it.cur}/${it.goal} ${it.done?'✓':''}`;
      box.appendChild(line);
    });
  }

  // ===== Difficulty presets (HP-reduced damage) =====
  const DIFF={
    easy:   {spawnMs:900, lifeMs:3400, timedSec:70, missHP:1, bossHit:4,  clickMissHP:0, critBase:0.08},
    normal: {spawnMs:800, lifeMs:3200, timedSec:60, missHP:3, bossHit:6,  clickMissHP:1, critBase:0.10},
    hard:   {spawnMs:650, lifeMs:2800, timedSec:50, missHP:5, bossHit:10, clickMissHP:2, critBase:0.12}
  };

  // ===== Enemy types (C2 add Heavy/Split/Trap) =====
  const ENEMY={
    speed:{radius:0.22, color:'#46ffc8', lifeMul:0.7, score:120},
    shield:{radius:0.28, color:'#6ad1ff', hp:3, score:150},
    curse:{radius:0.25, color:'#ab6aff', effect:'+OL', score:110},
    heavy:{radius:0.32, color:'#ff7b5a', hp:4, lifeMul:1.2, score:170},
    split:{radius:0.24, color:'#ffd257', hp:1, lifeMul:0.9, score:90},
    trap: {radius:0.24, color:'#ff3fa7', hp:1, lifeMul:1.0, score:130} // on click → +Overload & small self-dmg
  };

  // ===== Overload FX helpers =====
  function applyOverloadFX(val){
    const fx=$('overlayFX'); if(!fx) return;
    fx.classList.remove('stage-mild','stage-danger','stage-critical','stage-z2');
    const canvas=document.querySelector('canvas'); if(canvas){ canvas.classList.remove('shake-slight','shake-strong'); }
    if(val>=50 && val<80){ fx.classList.add('stage-mild'); startHeartbeat(70);  canvas&&canvas.classList.add('shake-slight'); }
    else if(val>=80 && val<90){ fx.classList.add('stage-danger'); startHeartbeat(90); canvas&&canvas.classList.add('shake-slight'); }
    else if(val>=90 && val<100){ fx.classList.add('stage-critical'); startHeartbeat(110); canvas&&canvas.classList.add('shake-strong'); }
    else if(val>=100){ fx.classList.add('stage-z2'); startHeartbeat(140); canvas&&canvas.classList.add('shake-strong'); }
    else stopHeartbeat();
  }
  let _hbCtx,_hbNext,_hbBpm;
  function startHeartbeat(bpm){
    try{
      _hbCtx=_hbCtx||new (window.AudioContext||window.webkitAudioContext)();
      const now=_hbCtx.currentTime; _hbBpm=bpm;
      if(_hbNext && now<_hbNext-0.02) return;
      const o=_hbCtx.createOscillator(), g=_hbCtx.createGain();
      o.type='sine'; o.frequency.setValueAtTime(60,now); g.gain.setValueAtTime(0.6,now);
      o.connect(g); g.connect(_hbCtx.destination); o.start(now); o.stop(now+0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, now+0.06);
      const interval=60/Math.max(60,Math.min(200,bpm)); _hbNext=now+interval;
      setTimeout(()=>startHeartbeat(_hbBpm||bpm), Math.floor(interval*1000));
    }catch(e){}
  }
  function stopHeartbeat(){ _hbBpm=0; }
  function applyOverloadFX3(val){
    const canvas=document.querySelector('canvas'), haze=$('heatHaze');
    if(canvas){ canvas.classList.remove('distort1','distort2'); }
    if(haze){ haze.classList.remove('stage-on','stage-strong'); }
    if(val>=50 && val<90){ canvas&&canvas.classList.add('distort1'); haze&&haze.classList.add('stage-on'); }
    else if(val>=90 && val<100){ canvas&&canvas.classList.add('distort1'); haze&&haze.classList.add('stage-strong'); }
    else if(val>=100){ canvas&&canvas.classList.add('distort2'); haze&&haze.classList.add('stage-strong'); }
  }
  function spawnShockwave(pos){
    try{
      const scene=qs('a-scene'); if(!scene) return;
      const sw=document.createElement('a-entity');
      sw.setAttribute('geometry','primitive: ring; radiusInner:0.01; radiusOuter:0.08');
      sw.setAttribute('material','color:#7fe8ff; emissive:#7fe8ff; transparent:true; opacity:0.9; side:double');
      sw.setAttribute('position',`${pos.x} ${pos.y} ${pos.z}`);
      sw.setAttribute('animation__grow','property: scale; to: 8 8 8; dur:520; easing:easeOutCubic');
      sw.setAttribute('animation__fade','property: components.material.material.opacity; to:0; dur:520; easing:linear');
      scene.appendChild(sw); setTimeout(()=>{ try{sw.remove();}catch(e){} },560);
    }catch(e){}
  }

  // ===== Component =====
  AFRAME.registerComponent('shadow-breaker-game',{
    init:function(){
      const q=new URLSearchParams(location.search);
      this.mode=(q.get('mode')==='timed')?'timed':'practice';
      this.diff=q.get('diff')||'normal';
      this.cfg=DIFF[this.diff]||DIFF.normal;

      fetch('src/i18n.json').then(r=>r.json()).then(data=>{
        const cur=localStorage.getItem('sb_lang')||'th';
        this.i18n=data; this.dict=data[cur]||data['th']||{};
        window.__shadowBreakerSetLang=(v)=>{ localStorage.setItem('sb_lang',v); this.dict=this.i18n[v]||this.i18n['th']; this.updateHUD(); const obj=$('objective'); if(obj) obj.textContent=v==='th'?'Objective: ทำคะแนนให้ถึง 400 เพื่อเรียก Mini Boss':'Objective: Reach 400 to summon Mini Boss'; updateQuestUI(this.dict,this.daily); };
        this.st={
          playing:false, timeLeft:(this.mode==='timed')?this.cfg.timedSec:9999,
          score:0, combo:1, arcane:0, overload:0, hp:100,
          last:performance.now(), spawnEveryMs:this.cfg.spawnMs, spawnTimer:performance.now()-this.cfg.spawnMs-1,
          phase:'tutorial', boss:null, idleTimer:0,
          best: Number(localStorage.getItem('sb_best')||0),
          dmgCD:0, olTick:0 // <<< HP cooldown + overload tick timer
        };
        this.daily=genDaily(); updateQuestUI(this.dict,this.daily);
        this.updateHUD(); this.startGame();
        toast(T(this.dict,'missionStart','Mission Start: Tutorial'));
        $('btnTH') && ($('btnTH').textContent='ไทย'); $('btnEN') && ($('btnEN').textContent='English');
      });

      window.addEventListener('click', this.manualRay.bind(this), {passive:false});
      window.addEventListener('keydown',(e)=>{ if(e.key==='q'||e.key==='Q') this.openSkillWheel(); });
      $('qClose') && $('qClose').addEventListener('click', ()=>$('questPanel').classList.add('hidden'));
    },

    startGame:function(){ this.st.playing=true; this.loop(); },

    updateHUD:function(){
      const s=this.st, d=this.dict, L=(k,def)=>(d && d[k]) || def;
      $('hudScore') && ($('hudScore').textContent = `${L('score','Score')}: ${s.score}`);
      $('hudCombo') && ($('hudCombo').textContent = `${L('combo','Combo')}: x${s.combo}`);
      $('hudTime')  && ($('hudTime').textContent  = `${L('time','Time')}${this.mode==='timed'?' ⏱':''}: ${this.mode==='timed'?Math.ceil(s.timeLeft):'∞'}`);
      $('hudArcane')&& ($('hudArcane').textContent= `${L('arcane','Arcane')}: ${s.arcane}%`);
      $('backLink') && ($('backLink').textContent = (L('back','Back')));
      $('hudHP')    && ($('hudHP').textContent    = `${L('hp','HP')}: ${Math.max(0,Math.ceil(s.hp))}`);
      $('hudOverload') && ($('hudOverload').textContent = `Overload: ${Math.round(s.overload)}%`);
      $('hudBoss')  && ($('hudBoss').textContent  = s.boss? `${L('bossHP','Boss HP')}: ${Math.max(0,Math.ceil(s.boss.hp))}` : `${L('bossHP','Boss HP')}: —`);
      updateOverloadUI(s.overload); applyOverloadFX(s.overload); applyOverloadFX3(s.overload);
      const hpFill=$('hpBarFill'); if(hpFill){ hpFill.style.width=Math.max(0,Math.min(100,s.hp))+'%'; }
      updateQuestUI(this.dict,this.daily);
    },

    // === New: damage intake with cooldown ===
    takeDamage:function(amount,label){
      if(amount<=0) return;
      if(this.st.dmgCD>0) return;           // brief invulnerability window
      this.st.hp = Math.max(0, this.st.hp - amount);
      this.st.dmgCD = 0.6;                   // 0.6s cooldown between damage ticks
      if(label){ toast(`-${Math.round(amount)} HP (${label})`); }
      this.updateHUD();
    },

    loop:function(){
      if(!this.st.playing) return;
      requestAnimationFrame(this.loop.bind(this));
      const now=performance.now(), dt=(now-this.st.last)/1000; this.st.last=now;

      if(now - this.st.spawnTimer > this.st.spawnEveryMs){ this.st.spawnTimer=now; this.spawnTarget(); }

      if(this.st.phase==='tutorial' && this.st.score>=400){
        this.st.phase='boss';
        const obj=$('objective'); if(obj) obj.textContent=(this.dict && this.dict['objectiveBoss'])||'Objective: Defeat Mini Boss!';
        this.spawnMiniBoss();
      }

      if(this.mode==='timed'){
        this.st.timeLeft=Math.max(0,this.st.timeLeft-dt);
        $('hudTime') && ($('hudTime').textContent = `${(this.dict && this.dict['time'])||'Time'} ⏱: ${Math.ceil(this.st.timeLeft)}`);
        if(this.st.timeLeft<=0){ this.endGame(); return; }
      }

      // idle lowers OL a bit
      this.st.idleTimer += dt;
      if(this.st.idleTimer >= 3){ this.st.overload = Math.max(0, this.st.overload - 0.5*dt); }

      // Overload drains HP in pulses (SOFTER) + damage cooldown ticking
      this.st.olTick += dt;
      if(this.st.overload>=80 && this.st.overload<100 && this.st.olTick>=0.5){
        this.takeDamage(0.4, 'Overload');   // softer than before
        this.st.olTick = 0;
      } else if(this.st.overload>=100 && this.st.olTick>=0.4){
        this.takeDamage(1.2, 'Overload+');  // softer than before
        this.st.olTick = 0;
      }

      if(this.st.dmgCD>0) this.st.dmgCD = Math.max(0, this.st.dmgCD - dt);

      this.updateHUD();
      if(this.st.hp<=0){ this.endGame(); return; }
    },

    // === Enemy spawn (Speed/Shield/Curse + Heavy/Split/Trap) ===
    spawnTarget:function(){
      const spawner=qs('#spawner');
      // distribution
      const r=Math.random();
      let type='normal';
      if(r<0.16) type='speed';
      else if(r<0.30) type='shield';
      else if(r<0.43) type='curse';
      else if(r<0.55) type='heavy';
      else if(r<0.70) type='split';
      else if(r<0.82) type='trap';

      const e=document.createElement('a-entity');
      let radius=0.26, color='#39c5bb', life=this.cfg.lifeMs, hp=1, scoreBase=100;

      if(type==='speed'){ radius=ENEMY.speed.radius; color=ENEMY.speed.color; life=this.cfg.lifeMs*ENEMY.speed.lifeMul; scoreBase=ENEMY.speed.score; }
      if(type==='shield'){ radius=ENEMY.shield.radius; color=ENEMY.shield.color; hp=ENEMY.shield.hp; scoreBase=ENEMY.shield.score; }
      if(type==='curse'){ radius=ENEMY.curse.radius;  color=ENEMY.curse.color; scoreBase=ENEMY.curse.score; }
      if(type==='heavy'){ radius=ENEMY.heavy.radius;  color=ENEMY.heavy.color; hp=ENEMY.heavy.hp; life=this.cfg.lifeMs*ENEMY.heavy.lifeMul; scoreBase=ENEMY.heavy.score; }
      if(type==='split'){ radius=ENEMY.split.radius;  color=ENEMY.split.color; life=this.cfg.lifeMs*ENEMY.split.lifeMul; scoreBase=ENEMY.split.score; }
      if(type==='trap'){  radius=ENEMY.trap.radius;   color=ENEMY.trap.color;  life=this.cfg.lifeMs*ENEMY.trap.lifeMul;  scoreBase=ENEMY.trap.score; }

      e.setAttribute('geometry',`primitive: sphere; radius: ${radius}`);
      e.setAttribute('material',`color:${color}; emissive:#0af; metalness:0.1; roughness:0.4`);
      const rx=(Math.random()*2-1)*0.9, ry=1.2+Math.random()*0.6, rz=-2.0-Math.random()*0.5;
      const pos={x:rx,y:ry,z:rz}; e.setAttribute('position', pos);
      e.classList.add('clickable');
      e.setAttribute('animation__pulse','property: scale; to:1.18 1.18 1.18; dir:alternate; loop:true; dur:600');
      e.dataset.type=type; e.dataset.hp=hp;

      e.addEventListener('click',()=>{
        if(!this.st.playing) return;

        // TRAP: on click → punish small
        if(type==='trap'){
          this.st.overload = Math.min(130, this.st.overload + 6);
          this.takeDamage(3,'Trap');
          toast(`Trap! +OL`);
        }

        // SHIELD/HEAVY: multi-hit
        if(type==='shield' || type==='heavy'){
          let shp=Number(e.dataset.hp||1);
          shp -= 1;
          if(shp>0){
            e.dataset.hp=shp;
            e.setAttribute('material','color:#bfe8ff; emissive:#4cf; metalness:0.2; roughness:0.2');
            SFX.hit(); spawnShockwave(pos);
            this.st.overload = Math.min(130, this.st.overload + (type==='heavy'?0.8:0.6)); // small OL per ping
            this.updateHUD(); return;
          }
        }

        // CRITICAL (C1)
        const critChance = this.cfg.critBase + Math.min(0.15, (this.st.combo-1)*0.01);
        const isCrit = Math.random() < critChance;
        const critMul = isCrit ? 1.75 : 1.0;

        // scoring
        this.st.combo = Math.min(20, this.st.combo+1);
        const add = Math.round((scoreBase + (this.st.combo-1)*10) * critMul);
        this.st.score += add;

        // Combo alert thresholds
        if(this.st.combo===5 || this.st.combo===10 || this.st.combo===15){ comboAlert(this.st.combo, this.dict); }

        // quests
        const q=this.daily;
        q.list.find(x=>x.id==='score1500').cur = Math.min(99999, (q.list.find(x=>x.id==='score1500').cur||0)+add);
        q.list.find(x=>x.id==='combo8').cur    = Math.max(q.list.find(x=>x.id==='combo8').cur||0, this.st.combo);
        if(this.st.boss && (this.st.boss.hp<=0)) q.list.find(x=>x.id==='boss1').cur=1;
        q.list.forEach(it=>{ if(!it.done && it.cur>=it.goal) it.done=true; }); saveDaily(q);

        // resources & overload
        this.st.arcane = Math.min(100, this.st.arcane+3);
        let olGain = 1 + Math.max(0,(this.st.combo-1))*0.5 + (isCrit?0.5:0);
        if(type==='curse') olGain += 2;
        this.st.overload = Math.min(130, this.st.overload + olGain);

        this.st.idleTimer = 0;
        spawnScorePopup(pos, (isCrit?`${T(this.dict,'crit','CRIT!')} +${add}`:`+${add}`), isCrit?'pop-crit':'pop-score');
        isCrit? SFX.crit() : SFX.hit();

        // Boss damage
        if(this.st.boss){ this.damageBoss(isCrit ? 6 : (type==='curse'?4:3)); }

        // Split: spawn two small children on kill
        if(type==='split'){
          try{
            const child = (dx)=> {
              const ch=document.createElement('a-entity');
              ch.setAttribute('geometry','primitive: sphere; radius: 0.18');
              ch.setAttribute('material','color:#ffe48f; emissive:#ffda6a; metalness:0.1; roughness:0.4');
              ch.setAttribute('position',`${pos.x+dx} ${pos.y} ${pos.z-0.1}`);
              ch.classList.add('clickable');
              ch.setAttribute('animation__pulse','property: scale; to:1.14 1.14 1.14; dir:alternate; loop:true; dur:550');
              ch.addEventListener('click',()=>{
                if(!this.st.playing) return;
                this.st.combo=Math.min(20,this.st.combo+1);
                const add2=80 + (this.st.combo-1)*8; this.st.score+=add2;
                this.st.arcane=Math.min(100,this.st.arcane+2);
                this.st.overload=Math.min(130,this.st.overload+0.8);
                spawnScorePopup(ch.object3D.position, `+${add2}`);
                SFX.hit(); ch.remove(); this.updateHUD();
              });
              setTimeout(()=>{ if(ch.parentNode){ ch.remove(); this.st.combo=1; this.takeDamage(this.cfg.missHP, T(this.dict,'miss','Miss')); this.updateHUD(); } }, this.cfg.lifeMs*0.6);
              qs('#spawner').appendChild(ch);
            };
            child(-0.12); child(0.12);
          }catch(e){}
        }

        try{ spawnShockwave(pos); }catch(e){}
        this.updateHUD();
        e.remove();
      });

      setTimeout(()=>{
        if(e.parentNode){
          e.remove();
          this.st.combo = 1;
          this.st.overload = Math.max(0, this.st.overload - 1);
          this.takeDamage(this.cfg.missHP, T(this.dict,'miss','Miss'));
          this.updateHUD();
        }
      }, life);

      spawner.appendChild(e);
    },

    // === Skill wheel ===
    openSkillWheel:function(){
      const opts=[
        {k:'pulse',label:'Arcane Pulse',cost:10,over:6},
        {k:'bind', label:'Shadow Bind', cost:15,over:6},
        {k:'burst',label:'Arcane Burst',cost:20,over:12}
      ];
      const pick=prompt('[Skill Wheel]\n'+opts.map((o,i)=>`${i+1}) ${o.label} (-${o.cost} Arcane)`).join('\n')+'\n> 1-3');
      if(!pick) return; const idx=(parseInt(pick,10)||0)-1; if(idx<0||idx>=opts.length) return;
      const c=opts[idx]; let cost=c.cost;
      if(this.st.overload>=90 && this.st.overload<100) cost*=2;
      if(this.st.arcane<cost){ alert('Not enough Arcane!'); return; }
      const exec=()=>{ if(c.k==='pulse') this.castArcanePulse(); if(c.k==='bind') this.castShadowBind(); if(c.k==='burst') this.castArcaneBurst(); };
      if(this.st.overload>=100){
        if(Math.random()<0.25){ setTimeout(()=>{ try{ this.castShadowBind(); }catch(e){} },200); return; }
        setTimeout(exec,250); this.st.arcane-=cost; this.raiseOverload(2);
      }else{ exec(); this.st.arcane-=cost; }
      this.raiseOverload(c.over); this.st.idleTimer=0; try{ spawnShockwave({x:0,y:1.5,z:-2}); }catch(e){}
      this.updateHUD();
    },
    castArcanePulse:function(){ Array.from(document.querySelectorAll('.clickable')).forEach(el=>{ try{ el.emit('click'); }catch(e){} }); if(this.st.boss){ this.damageBoss(12); } toast('Arcane Pulse!'); },
    castShadowBind:function(){ if(this.st.boss){ this.damageBoss(5); } toast('Shadow Bind!'); },
    castArcaneBurst:function(){ if(this.st.boss){ this.damageBoss(20); } toast('Arcane Burst!'); },

    raiseOverload:function(x){
      this.st.overload = Math.min(130, this.st.overload + x);
      this.st.idleTimer=0; updateOverloadUI(this.st.overload); applyOverloadFX(this.st.overload); applyOverloadFX3(this.st.overload);
    },

    // === Boss ===
    spawnMiniBoss:function(){
      if(this.st.boss) return;
      const b={ hp:160, el:document.createElement('a-entity'), t:0 };
      b.el.setAttribute('geometry','primitive: icosahedron; radius: 0.6');
      b.el.setAttribute('material','color:#17394a; emissive:#0ff; metalness:0.2; roughness:0.2');
      b.el.setAttribute('position',{x:0,y:1.6,z:-2.6});
      b.el.classList.add('boss');
      qs('#spawner')?.appendChild(b.el);
      this.st.boss=b; this.updateHUD(); toast(T(this.dict,'missionBoss','Mini Boss!'));
      const atk=()=>{
        if(!this.st.boss || !this.st.playing || this.st.hp<=0) return;
        const dmg=this.cfg.bossHit + Math.floor(this.st.overload/50);
        this.takeDamage(dmg, T(this.dict,'bossAttack','Boss attack'));
        try{ spawnShockwave({x:0,y:1.5,z:-2.2}); }catch(e){}
        this.updateHUD();
        if(this.st.hp>0 && this.st.boss) setTimeout(atk, 1800);
      };
      setTimeout(atk, 1200);
    },
    damageBoss:function(amount){
      if(!this.st.boss) return; this.st.boss.hp-=amount;
      if(this.st.boss.hp<=0){
        try{this.st.boss.el.remove();}catch(e){}
        this.st.boss=null; this.updateHUD(); toast(T(this.dict,'missionClear','Mission Clear')); SFX.ok();
        const q=this.daily; const it=q.list.find(x=>x.id==='boss1'); if(it){ it.cur=1; it.done=true; saveDaily(q); }
      } else { this.updateHUD(); }
    },

    // === End + Grade + Best Score persist (C3) ===
    endGame:function(){
      this.st.playing=false;
      const best = Number(localStorage.getItem('sb_best')||0);
      if(this.st.score > best){ localStorage.setItem('sb_best', String(this.st.score)); this.st.best = this.st.score; }
      const s=this.st.score, combo=this.st.combo;
      const grade = (s>=3000 || (s>=2200 && combo>=12)) ? 'S' :
                    (s>=1800 || (s>=1400 && combo>=10)) ? 'A' :
                    (s>=900) ? 'B' : 'C';
      const msg = `${(this.dict&&this.dict['finished'])||'Finished'} • ${(this.dict&&this.dict['score'])||'Score'}: ${s} • ${(this.dict&&this.dict['grade'])||'Grade'}: ${grade} • ${(this.dict&&this.dict['best'])||'Best'}: ${Math.max(best,this.st.score)}`;
      toast(msg, 2800);
    },

    // === Manual ray + click-miss damage uses cooldown ===
    manualRay:function(evt){
      this.st.idleTimer=0;
      const sceneEl=qs('a-scene'), camEl=$('camera');
      const renderer=sceneEl && sceneEl.renderer, camera=camEl && camEl.getObject3D('camera');
      if(!renderer||!camera||!this.st.playing) return;
      const rect=renderer.domElement.getBoundingClientRect();
      const mouse=new THREE.Vector2(((evt.clientX-rect.left)/rect.width)*2-1,-((evt.clientY-rect.top)/rect.height)*2+1);
      const raycaster=new THREE.Raycaster(); raycaster.setFromCamera(mouse,camera);
      const nodes=Array.from(document.querySelectorAll('.clickable')).map(el=>el.object3D).filter(Boolean);
      const hits=raycaster.intersectObjects(nodes,true);
      if(hits.length){
        let obj=hits[0].object; while(obj && !obj.el) obj=obj.parent;
        if(obj && obj.el) obj.el.emit('click');
      }else{
        this.takeDamage(this.cfg.clickMissHP, T(this.dict,'reflect','Reflect'));
        this.updateHUD();
      }
    }
  });

  window.__SB_DEBUG__ = {};
})();
