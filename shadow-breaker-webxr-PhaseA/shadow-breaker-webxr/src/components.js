/* Shadow Breaker – Phase B Components (WebXR)
   - VR/Mouse raycast
   - Skill Wheel UI + VR toggle (A/X button)
   - Ritual Gestures (prototype): swipeDown, ring
   - Enemy AI + Boss 2 phases
   - Overload FX + HUD SFX (WebAudio)
   - Settings: difficulty
*/
(function(){
  const $ = (id)=>document.getElementById(id);
  const qs = (sel)=>document.querySelector(sel);
  const q = new URLSearchParams(location.search);

  // Simple SFX via WebAudio (no external files)
  const AudioBus = {
    ctx: null,
    beep(freq=880, dur=0.08, vol=0.2){
      try{
        this.ctx = this.ctx || new (window.AudioContext||window.webkitAudioContext)();
        const o=this.ctx.createOscillator(), g=this.ctx.createGain();
        o.frequency.value=freq; o.type='square';
        g.gain.value=vol; o.connect(g); g.connect(this.ctx.destination);
        o.start(); o.stop(this.ctx.currentTime+dur);
      }catch(e){}
    },
    burst(){ this.beep(220, .08, .25); this.beep(660, .1, .15); },
    warn(){ this.beep(140, .12, .25); },
    ok(){ this.beep(900, .07, .2); }
  };

  AFRAME.registerComponent('shadow-breaker-game',{
    init:function(){
      this.mode=(q.get('mode')==='timed')?'timed':'practice';
      this.dict={};
      // Load i18n then boot
      fetch('src/i18n.json').then(r=>r.json()).then(data=>{
        const cur = localStorage.getItem('sb_lang') || 'th';
        this.dict = data[cur] || data['th'] || {};
        this.st={
          playing:false, timeLeft:(this.mode==='timed')?60:9999,
          score:0, combo:1, arcane:0, overload:0, hp:100,
          last:performance.now(), spawnEveryMs:850, spawnTimer:performance.now(),
          phase:'tutorial', boss:null, diff:'normal',
          // gesture state (VR/desktop pointer fallback)
          recent:[], recentMax:18
        };
        this.wireUI();
        this.updateHUD();
        this.startGame();
        this.toastFX(this.dict['missionStart']||'Mission Start: Tutorial');
      });

      // input fallback
      window.addEventListener('click', this.manualRay.bind(this), {passive:false});
      window.addEventListener('mousedown', this.manualRay.bind(this), {passive:false});
      // desktop skill wheel
      window.addEventListener('keydown',(e)=>{
        if(e.key==='q'||e.key==='Q') this.toggleSkillWheel();
        if(e.key==='Escape') this.closeSkillWheel();
        if(e.key==='o'||e.key==='O') this.toggleSettings();
      });
      // skill wheel dispatch
      window.addEventListener('sb-cast',(ev)=> this.castSkill(ev.detail.skill));
    },

    wireUI:function(){
      const bw = $('btnSkillWheel'); if(bw){ bw.onclick=()=>this.toggleSkillWheel(); }
      // VR controller buttons (A/X) toggle skill wheel via events
      const scene = qs('a-scene');
      scene?.addEventListener('abuttondown', ()=> this.toggleSkillWheel());
      scene?.addEventListener('xbuttondown', ()=> this.toggleSkillWheel());
      // settings
      const diffSel = $('difficulty');
      if(diffSel){
        diffSel.value = this.st.diff;
        diffSel.onchange = ()=> this.st.diff = diffSel.value;
      }
    },

    startGame:function(){ this.st.playing=true; this.loop(); },
    updateHUD:function(){
      const s=this.st, d=this.dict, L=(k,def)=> (d[k]||def);
      $('hudScore').textContent = `${L('score','Score')}: ${s.score}`;
      $('hudCombo').textContent = `${L('combo','Combo')}: x${s.combo}`;
      $('hudTime').textContent  = `${L('time','Time')}: ${this.mode==='timed'?Math.ceil(s.timeLeft):'∞'}`;
      $('hudArcane').textContent= `${L('arcane','Arcane')}: ${s.arcane}%`;
      const back=$('backLink'); if(back) back.textContent=(d['back']||'Back');
      const hpEl=$('hudHP'); if(hpEl) hpEl.textContent = `${L('hp','HP')}: ${Math.max(0,Math.ceil(s.hp))}`;
      const ov=$('hudOverload'); if(ov) ov.textContent = `Overload: ${Math.round(s.overload)}%`;
      const bossEl=$('hudBoss'); if(bossEl) bossEl.textContent = s.boss? `${L('bossHP','Boss HP')}: ${Math.max(0,Math.ceil(s.boss.hp))}` : `${L('bossHP','Boss HP')}: —`;
      // Overload FX
      const fx = $('overlayFX'); if(fx){ fx.classList.toggle('overload', s.overload>=75); }
    },

    loop:function(){
      if(!this.st.playing) return;
      requestAnimationFrame(this.loop.bind(this));
      const now=performance.now(); const dt=(now-this.st.last)/1000; this.st.last=now;

      // spawn enemies with difficulty
      const mul = (this.st.diff==='hard')?0.75 : (this.st.diff==='easy')?1.1 : 0.9;
      if(now - this.st.spawnTimer > this.st.spawnEveryMs*mul){ this.st.spawnTimer=now; this.spawnTargetAI(); }

      // timer
      if(this.mode==='timed'){
        this.st.timeLeft = Math.max(0, this.st.timeLeft - dt);
        $('hudTime').textContent = `${(this.dict['time']||'Time')}: ${Math.ceil(this.st.timeLeft)}`;
        if(this.st.timeLeft<=0){ this.endGame(); }
      }

      // enemy/boss behaviors tick
      this.tickEnemies(dt);
      this.tickBoss(dt);

      // tutorial → boss
      if(this.st.phase==='tutorial' && this.st.score>=600){
        this.st.phase='boss'; this.spawnMiniBoss();
      }

      // gesture sampling (desktop = mouse; VR = controller)
      this.samplePointer();
    },

    /* === Spawner & AI === */
    spawnTargetAI:function(){
      const spawner=qs('#spawner');
      const e=document.createElement('a-entity');
      e.setAttribute('geometry','primitive: sphere; radius: 0.18');
      e.setAttribute('material','color:#16a0a0; emissive:#0af; metalness:0.2; roughness:0.4');
      const rx=(Math.random()*2-1)*1.4, ry=1+Math.random()*1.2, rz=-3.2-Math.random()*0.8;
      e.setAttribute('position',{x:rx,y:ry,z:rz});
      e.classList.add('enemy','clickable');
      e.dataset.hp=30;
      e.dataset.vx = (Math.random()*2-1)*0.4;
      e.dataset.vy = (Math.random()*2-1)*0.2;
      e.addEventListener('click',()=>{ // damage on click/hit
        if(!this.st.playing) return;
        this.hitEnemy(e, 40);
        this.onHitCommon();
      });
      spawner.appendChild(e);
    },

    tickEnemies:function(dt){
      const cam = qs('#camera');
      const enemies = Array.from(document.querySelectorAll('.enemy'));
      enemies.forEach(e=>{
        const p = e.getAttribute('position');
        const t = performance.now()/1000;
        p.x += parseFloat(e.dataset.vx||0) * dt;
        p.y += Math.sin(t*4)*0.002;
        p.z += 0.15*dt; // move toward camera (z increases)
        e.setAttribute('position', p);
        // if gets too close → damage player
        if(p.z>-0.3){
          this.st.hp = Math.max(0, this.st.hp - 10);
          e.remove();
          AudioBus.warn();
          this.updateHUD();
          if(this.st.hp<=0) this.endGame();
        }
      });
    },

    hitEnemy:function(e, dmg){
      const hp = (parseFloat(e.dataset.hp||'30') - dmg);
      if(hp<=0){ e.remove(); this.st.score += 120; this.st.combo=Math.min(9,this.st.combo+1); this.st.arcane=Math.min(100,this.st.arcane+4); AudioBus.ok(); }
      else { e.dataset.hp = hp; }
      this.updateHUD();
    },

    /* === Boss === */
    spawnMiniBoss:function(){
      if(this.st.boss) return;
      const boss = { hp:260, phase:1, el: document.createElement('a-entity'), t:0 };
      boss.el.setAttribute('geometry','primitive: icosahedron; radius: 0.7');
      boss.el.setAttribute('material','color:#0b2530; emissive:#0ff; metalness:0.2; roughness:0.2');
      boss.el.setAttribute('position',{x:0,y:1.6,z:-3.0});
      boss.el.classList.add('boss','clickable');
      boss.el.addEventListener('click',()=>{ this.damageBoss(8); this.onHitCommon(); });
      qs('#spawner').appendChild(boss.el);
      this.st.boss=boss;
      this.toastFX(this.dict['missionBoss']||'Mini Boss!');
      this.updateHUD();
    },

    tickBoss:function(dt){
      const b=this.st.boss; if(!b) return;
      b.t += dt;
      // pattern: phase 1 sine; phase 2 faster + AoE telegraph
      const p = b.el.getAttribute('position');
      p.x = Math.sin(b.t*1.2)*0.9;
      p.y = 1.4 + Math.sin(b.t*2.2)*0.2;
      b.el.setAttribute('position',p);

      if(b.hp<=120 && b.phase===1){ b.phase=2; this.toastFX('Boss Phase 2!'); AudioBus.burst(); }

      // AoE Telegraph (quick)
      if(b.phase===2 && Math.floor(b.t)%3===0 && !this._aoeActive){
        this._aoeActive=true;
        const aoe=document.createElement('a-entity');
        aoe.setAttribute('geometry','primitive: ring; radiusInner:0.05; radiusOuter:0.8');
        aoe.setAttribute('material','color:#39d3e6; opacity:0.35; side:double');
        aoe.setAttribute('rotation','-90 0 0');
        aoe.setAttribute('position','0 0 -1');
        qs('a-scene').appendChild(aoe);
        setTimeout(()=>{ // boom
          aoe.setAttribute('material','color:#ff4060; opacity:0.55');
          this.st.hp = Math.max(0, this.st.hp - 8);
          this.updateHUD();
          setTimeout(()=>{ aoe.remove(); this._aoeActive=false; }, 250);
        }, 450);
      }
    },

    damageBoss:function(amount){
      const b=this.st.boss; if(!b) return;
      b.hp -= amount; AudioBus.ok();
      if(b.hp<=0){
        try{ b.el.remove(); }catch(e){}
        this.st.boss=null;
        this.st.score += 500; this.updateHUD();
        this.toastFX(this.dict['missionClear']||'Mission Clear');
      } else {
        this.updateHUD();
      }
    },

    /* === Skills, Gestures, Overload === */
    toggleSkillWheel:function(){
      const p = $('skillWheelPanel'); p?.classList.toggle('active');
    },
    closeSkillWheel:function(){ $('skillWheelPanel')?.classList.remove('active'); },

    castSkill:function(key){
      this.closeSkillWheel();
      const need = {pulse:10, bind:15, slash:12, burst:20}[key]||10;
      if(this.st.arcane < need){ this.toastFX('Not enough Arcane'); AudioBus.warn(); return; }
      this.st.arcane -= need;
      if(key==='pulse') this.castArcanePulse();
      if(key==='bind')  this.castShadowBind();
      if(key==='slash') this.castShadowSlash();
      if(key==='burst') this.castArcaneBurst();
      this.raiseOverload( (key==='burst')?10 : (key==='bind'?6:5) );
      this.updateHUD();
    },

    castArcanePulse:function(){
      const targets = Array.from(document.querySelectorAll('.enemy'));
      targets.forEach(el=> this.hitEnemy(el, 999));
      if(this.st.boss) this.damageBoss(16);
      this.toastFX('Arcane Pulse!'); AudioBus.burst();
    },
    castShadowBind:function(){
      if(this.st.boss) this.damageBoss(10);
      this.toastFX('Shadow Bind!'); AudioBus.beep(520,.09,.2);
    },
    castShadowSlash:function(){
      // Wide slash: damage enemies in cone
      const enemies = Array.from(document.querySelectorAll('.enemy'));
      enemies.forEach(el=> this.hitEnemy(el, 60));
      if(this.st.boss) this.damageBoss(12);
      this.toastFX('Shadow Slash!'); AudioBus.burst();
    },
    castArcaneBurst:function(){
      // Big hit single target (boss favored)
      if(this.st.boss) this.damageBoss(26);
      this.toastFX('Arcane Burst!'); AudioBus.burst();
    },

    raiseOverload:function(x){
      this.st.overload = Math.min(100, this.st.overload + x);
      if(this.st.overload>=75){ this.st.hp = Math.max(0, this.st.hp - 1); }
      if(this.st.overload>=95){ this.toastFX(this.dict['overloadWarning']||'Overload Warning'); AudioBus.warn(); }
    },

    onHitCommon:function(){
      this.st.combo=Math.min(9,this.st.combo+1);
      this.st.score+=20 + this.st.combo*5;
      this.st.arcane=Math.min(100,this.st.arcane+2);
      this.updateHUD();
    },

    /* === Gestures prototype === */
    samplePointer:function(){
      // sample mouse position for pattern detect (VR: A-Frame controller can be added similarly)
      const sceneEl = qs('a-scene');
      if(!sceneEl || !sceneEl.renderer) return;
      const pt = this._lastMouse || {x:0,y:0}; // updated by mousemove
      this.st.recent.push({x:pt.x,y:pt.y,t:performance.now()});
      if(this.st.recent.length>this.st.recentMax) this.st.recent.shift();
    }
  });

  // Track mouse for simple gesture (desktop swipeDown triggers Shadow Slash)
  window.addEventListener('mousemove', (e)=>{
    window._sb_mouse = {x:e.clientX,y:e.clientY};
  });
  // Simple gesture detect: quick downward swipe = slash
  window.addEventListener('mouseup', (e)=>{
    const hist = (AFRAME.scenes[0]?.systems||{}); // not used; just keep scope
    const cur = window._sb_mouse;
    if(!cur) return;
    if(!window._sb_lastDown){ window._sb_lastDown={x:cur.x,y:cur.y,t:performance.now()}; return; }
    const dy = cur.y - window._sb_lastDown.y;
    const dt = performance.now() - window._sb_lastDown.t;
    if(dy>180 && dt<400){
      window.dispatchEvent(new CustomEvent('sb-cast',{detail:{skill:'slash'}}));
    }
  });
  window.addEventListener('mousedown', ()=>{
    const cur = window._sb_mouse || {x:0,y:0};
    window._sb_lastDown = {x:cur.x,y:cur.y,t:performance.now()};
  });

})();
