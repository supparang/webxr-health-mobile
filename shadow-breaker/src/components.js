// Shadow Breaker – Latest build: Overload Part 3 + Spawn Fix (QB-3, C5, BAR-C, POS-2)
(function(){
  const $=(id)=>document.getElementById(id);
  const qs=(sel)=>document.querySelector(sel);
  const toast=(m,ms=900)=>{const t=$('toast'); if(!t) return; t.textContent=m; t.style.display='block'; setTimeout(()=>t.style.display='none',ms);};

  // Minimal SFX
  const SFX={ctx:null,
    beep(f=880,d=.08,v=.2){try{this.ctx=this.ctx||new (window.AudioContext||window.webkitAudioContext)();const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='square';o.frequency.value=f;g.gain.value=v;o.connect(g);g.connect(this.ctx.destination);o.start();o.stop(this.ctx.currentTime+d);}catch(e){}},
    hit(){this.beep(900,.05,.2)}, ok(){this.beep(660,.07,.18)}, warn(){this.beep(160,.12,.25)}
  };

  /* ---------- Overload UI (BAR-C) ---------- */
  function updateOverloadUI(val){
    const wrap=$('overloadBarWrap'), fill=$('overloadBarFill'), text=$('overloadBarText');
    if(!wrap||!fill||!text) return;
    const p=Math.max(0,Math.min(100,Math.round(val)));
    fill.style.width = p+'%';
    text.textContent = 'Overload: '+p+'%';
    wrap.classList.remove('danger','critical','z2');
    if(p>=50&&p<80) wrap.classList.add('danger');
    if(p>=80&&p<100) wrap.classList.add('critical');
    if(p>=100) wrap.classList.add('z2');
  }

  // Score popup
  function spawnScorePopup(worldPos, text="+100"){
    const scene=qs('a-scene'), cam=$('camera'); if(!scene||!cam) return;
    const camera=cam.getObject3D('camera'), renderer=scene.renderer; if(!camera||!renderer) return;
    const v = new THREE.Vector3(worldPos.x,worldPos.y,worldPos.z).project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    const x=(v.x*.5+.5)*rect.width+rect.left, y=(-v.y*.5+.5)*rect.height+rect.top;
    const div=document.createElement('div'); div.className='hit-popup pop-score';
    div.style.left=x+'px'; div.style.top=y+'px'; div.textContent=text;
    document.body.appendChild(div); requestAnimationFrame(()=> div.classList.add('show'));
    setTimeout(()=>{ div.style.opacity='0'; }, 380);
    setTimeout(()=>{ try{div.remove();}catch(e){} }, 700);
  }

  AFRAME.registerComponent('shadow-breaker-game',{
    /* ---------- FX Part 2 helpers ---------- */
    applyOverloadFX:function(val){
      const fx=$('overlayFX'); if(!fx) return;
      fx.classList.remove('stage-mild','stage-danger','stage-critical','stage-z2');
      const canvas = document.querySelector('canvas'); if(canvas){ canvas.classList.remove('shake-slight','shake-strong'); }
      if(val>=50 && val<80){ fx.classList.add('stage-mild'); this.startHeartbeat(70); if(canvas) canvas.classList.add('shake-slight'); }
      if(val>=80 && val<90){ fx.classList.add('stage-danger'); this.startHeartbeat(90); if(canvas) canvas.classList.add('shake-slight'); }
      if(val>=90 && val<100){ fx.classList.add('stage-critical'); this.startHeartbeat(110); if(canvas) canvas.classList.add('shake-strong'); }
      if(val>=100){ fx.classList.add('stage-z2'); this.startHeartbeat(140); if(canvas) canvas.classList.add('shake-strong'); }
      if(val<50){ this.stopHeartbeat(); }
    },
    startHeartbeat:function(bpm){
      try{
        if(!this._hbCtx) this._hbCtx = new (window.AudioContext||window.webkitAudioContext)();
        const now = this._hbCtx.currentTime;
        this._hbBpm = bpm;
        if(this._hbNext && now < this._hbNext - 0.02) return; // already ticking
        const kick = this._hbCtx.createOscillator();
        const gain = this._hbCtx.createGain();
        kick.type='sine'; kick.frequency.setValueAtTime(60, now);
        gain.gain.setValueAtTime(0.6, now);
        kick.connect(gain); gain.connect(this._hbCtx.destination);
        kick.start(now); kick.stop(now+0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, now+0.06);
        const interval = 60/Math.max(60, Math.min(200, bpm));
        this._hbNext = now + interval;
        setTimeout(()=>{ this.startHeartbeat(this._hbBpm||bpm); }, Math.floor(interval*1000));
      }catch(e){}
    },
    stopHeartbeat:function(){ this._hbBpm = 0; },

    /* ---------- FX Part 3 helpers ---------- */
    ensureAuraRig:function(){
      const rig=$('rig'); if(!rig || this._auraRig) return;
      const wrap=document.createElement('a-entity'); wrap.setAttribute('id','auraRig');
      const ring=document.createElement('a-entity');
      ring.setAttribute('geometry','primitive: torus; radius:0.55; radiusTubular:0.02; segmentsTubular:24');
      ring.setAttribute('material','color:#27aee0; emissive:#44d4ff; opacity:0.35; metalness:0.1; roughness:0.2; transparent:true');
      ring.setAttribute('rotation','90 0 0');
      ring.setAttribute('animation__rot','property: rotation; to: 90 360 0; loop:true; dur:4500; easing:linear');
      const aura=document.createElement('a-entity');
      aura.setAttribute('geometry','primitive: cylinder; radius:0.08; height:1.2');
      aura.setAttribute('material','color:#39d3e6; emissive:#39d3e6; opacity:0.18; transparent:true');
      aura.setAttribute('position','0 -0.2 0');
      aura.setAttribute('animation__pulse','property: scale; to:1 1.08 1; dir:alternate; loop:true; dur:900');
      wrap.appendChild(ring); wrap.appendChild(aura);
      rig.appendChild(wrap);
      this._auraRig = wrap;
    },
    spawnShockwave:function(pos){
      try{
        const scene=qs('a-scene'); if(!scene) return;
        const sw=document.createElement('a-entity');
        sw.setAttribute('geometry','primitive: ring; radiusInner:0.01; radiusOuter:0.08');
        sw.setAttribute('material','color:#7fe8ff; emissive:#7fe8ff; transparent:true; opacity:0.9; side:double');
        sw.setAttribute('position',`${pos.x} ${pos.y} ${pos.z}`);
        sw.setAttribute('animation__grow','property: scale; to: 8 8 8; dur:520; easing:easeOutCubic');
        sw.setAttribute('animation__fade','property: components.material.material.opacity; to:0; dur:520; easing:linear');
        scene.appendChild(sw);
        setTimeout(()=>{ try{ sw.remove(); }catch(e){} }, 560);
      }catch(e){}
    },
    applyOverloadFX3:function(val){
      const canvas=document.querySelector('canvas');
      const haze=$('heatHaze');
      if(canvas){ canvas.classList.remove('distort1','distort2'); }
      if(haze){ haze.classList.remove('stage-on','stage-strong'); }
      if(val>=50 && val<90){ if(canvas) canvas.classList.add('distort1'); if(haze) haze.classList.add('stage-on'); }
      else if(val>=90 && val<100){ if(canvas) canvas.classList.add('distort1'); if(haze) haze.classList.add('stage-strong'); }
      else if(val>=100){ if(canvas) canvas.classList.add('distort2'); if(haze) haze.classList.add('stage-strong'); }
      if(val>=50){ this.ensureAuraRig(); }
    },
    _checkStages:function(){
      const v=this.st?.overload||0;
      const nowStage = v>=100? 'z2' : v>=90? 'critical' : v>=80? 'danger' : v>=50? 'mild':'safe';
      if(this._lastOverStage!==nowStage){
        if(nowStage==='critical' || nowStage==='z2'){
          try{ this.spawnShockwave({x:0,y:1.5,z:-2}); }catch(e){}
          SFX.warn();
        }
        this._lastOverStage = nowStage;
      }
    },

    /* ---------- Game ---------- */
    init:function(){
      this.mode=(new URLSearchParams(location.search).get('mode')==='timed')?'timed':'practice';
      fetch('src/i18n.json').then(r=>r.json()).then(data=>{
        const cur=localStorage.getItem('sb_lang')||'th'; this.dict=data[cur]||data['th']||{};
        this.st={
          playing:false, timeLeft:(this.mode==='timed')?60:9999,
          score:0, combo:1, arcane:0, overload:0, hp:100,
          last:performance.now(), spawnEveryMs:800, spawnTimer:performance.now()-801,
          phase:'tutorial', boss:null, idleTimer:0
        };
        this.updateHUD(); this.startGame();
        toast(this.dict['missionStart']||'Mission Start: Tutorial');
      });
      window.addEventListener('click', this.manualRay.bind(this), {passive:false});
      window.addEventListener('keydown',(e)=>{ if(e.key==='q'||e.key==='Q') this.openSkillWheel(); });
    },

    startGame:function(){ this.st.playing=true; this.loop(); },

    updateHUD:function(){
      const s=this.st, d=this.dict, L=(k,def)=>(d[k]||def);
      $('hudScore') && ($('hudScore').textContent = `${L('score','Score')}: ${s.score}`);
      $('hudCombo') && ($('hudCombo').textContent = `${L('combo','Combo')}: x${s.combo}`);
      $('hudTime')  && ($('hudTime').textContent  = `${L('time','Time')}: ${this.mode==='timed'?Math.ceil(s.timeLeft):'∞'}`);
      $('hudArcane')&& ($('hudArcane').textContent= `${L('arcane','Arcane')}: ${s.arcane}%`);
      $('backLink') && ($('backLink').textContent = (L('back','Back')));
      $('hudHP')    && ($('hudHP').textContent    = `${L('hp','HP')}: ${Math.max(0,Math.ceil(s.hp))}`);
      $('hudOverload') && ($('hudOverload').textContent = `Overload: ${Math.round(s.overload)}%`);
      $('hudBoss')  && ($('hudBoss').textContent  = s.boss? `${L('bossHP','Boss HP')}: ${Math.max(0,Math.ceil(s.boss.hp))}` : `${L('bossHP','Boss HP')}: —`);
      updateOverloadUI(s.overload);
      try{ this.applyOverloadFX(s.overload); }catch(_){}
      try{ this.applyOverloadFX3(s.overload); }catch(_){}
      this._checkStages && this._checkStages();
    },

    loop:function(){
      if(!this.st.playing) return;
      requestAnimationFrame(this.loop.bind(this));
      const now=performance.now(), dt=(now-this.st.last)/1000; this.st.last=now;

      // spawn
      if(now - this.st.spawnTimer > this.st.spawnEveryMs){ this.st.spawnTimer=now; this.spawnTarget(); }

      // mission -> boss
      if(this.st.phase==='tutorial' && this.st.score>=400){
        this.st.phase='boss';
        const obj=$('objective'); if(obj) obj.textContent='Objective: จัดการ Mini Boss!';
        this.spawnMiniBoss();
      }

      // timer
      if(this.mode==='timed'){
        this.st.timeLeft=Math.max(0,this.st.timeLeft-dt);
        $('hudTime') && ($('hudTime').textContent = `${(this.dict['time']||'Time')}: ${Math.ceil(this.st.timeLeft)}`);
        if(this.st.timeLeft<=0) this.endGame();
      }

      // Overload decay & punish
      this.st.idleTimer += dt;
      if(this.st.idleTimer >= 3){ this.st.overload = Math.max(0, this.st.overload - 0.5*dt); } // 0.5/sec after 3s idle
      if(this.st.overload >= 80 && this.st.overload < 100){ this.st.hp = Math.max(0, this.st.hp - 1*dt); }
      if(this.st.overload >= 100){ this.st.hp = Math.max(0, this.st.hp - 5*dt); }

      this.updateHUD();
    },

    spawnTarget:function(){
      let spawner=qs('#spawner'); if(!spawner){ spawner=document.createElement('a-entity'); spawner.id='spawner'; qs('a-scene')?.appendChild(spawner); }
      const e=document.createElement('a-entity');
      e.setAttribute('geometry','primitive: sphere; radius: 0.26');
      e.setAttribute('material','color:#39c5bb; emissive:#0af; metalness:0.1; roughness:0.4');
      const rx=(Math.random()*2-1)*0.9, ry=1.2+Math.random()*0.6, rz=-2.0-Math.random()*0.5;
      const pos={x:rx,y:ry,z:rz}; e.setAttribute('position', pos);
      e.classList.add('clickable');
      e.setAttribute('animation__pulse','property: scale; to:1.18 1.18 1.18; dir:alternate; loop:true; dur:600');

      e.addEventListener('click',()=>{
        if(!this.st.playing) return;
        this.st.combo = Math.min(9, this.st.combo+1);
        const add = 100 + (this.st.combo-1)*10;
        this.st.score += add;
        this.st.arcane = Math.min(100, this.st.arcane+3);
        // Overload: +1 + combo*0.5
        this.st.overload = Math.min(130, this.st.overload + 1 + Math.max(0,(this.st.combo-1))*0.5);
        this.st.idleTimer = 0;
        spawnScorePopup(pos, '+'+add);
        SFX.hit();
        if(this.st.boss){ this.damageBoss(3); }
        try{ this.spawnShockwave(pos); }catch(e){}
        this.updateHUD();
        e.remove();
      });

      setTimeout(()=>{
        if(e.parentNode){
          e.remove();
          this.st.combo = 1;
          this.st.overload = Math.max(0, this.st.overload - 1); // Miss reduces a bit
          this.updateHUD();
        }
      }, 3200);

      spawner.appendChild(e);
    },

    openSkillWheel:function(){
      const opts=[{k:'pulse',label:'Arcane Pulse',cost:10,over:6},{k:'bind',label:'Shadow Bind',cost:15,over:6},{k:'burst',label:'Arcane Burst',cost:20,over:12}];
      const pick=prompt('[Skill Wheel]\n'+opts.map((o,i)=>`${i+1}) ${o.label} (-${o.cost} Arcane)`).join('\n')+'\n> 1-3');
      if(!pick) return; const idx=(parseInt(pick,10)||0)-1; if(idx<0||idx>=opts.length) return;
      const choice=opts[idx];
      // Arcane corruption 90–99 → cost x2
      let cost=choice.cost;
      if(this.st.overload>=90 && this.st.overload<100) cost*=2;
      if(this.st.arcane<cost){ alert('Not enough Arcane!'); return; }
      const exec=()=>{
        if(choice.k==='pulse') this.castArcanePulse();
        if(choice.k==='bind')  this.castShadowBind();
        if(choice.k==='burst') this.castArcaneBurst();
      };
      if(this.st.overload>=100){
        if(Math.random()<0.25){ setTimeout(()=>{ try{ this.castShadowBind(); }catch(e){} },200); return; }
        setTimeout(exec,250); // input lag
        this.st.arcane -= cost;
        this.raiseOverload(2);
      }else{
        exec();
        this.st.arcane -= cost;
      }
      this.raiseOverload(choice.over);
      this.st.idleTimer=0;
      try{ this.spawnShockwave({x:0,y:1.5,z:-2}); }catch(e){}
      this.updateHUD();
    },

    castArcanePulse:function(){
      const targets=Array.from(document.querySelectorAll('.clickable')); targets.forEach(el=>{ try{ el.emit('click'); }catch(e){} });
      if(this.st.boss){ this.damageBoss(12); }
      toast('Arcane Pulse!');
    },
    castShadowBind:function(){
      if(this.st.boss){ this.damageBoss(5); }
      toast('Shadow Bind!');
    },
    castArcaneBurst:function(){
      if(this.st.boss){ this.damageBoss(20); }
      toast('Arcane Burst!');
    },

    raiseOverload:function(x){
      this.st.overload = Math.min(130, this.st.overload + x);
      this.st.idleTimer=0;
      updateOverloadUI(this.st.overload);
      try{ this.applyOverloadFX(this.st.overload); }catch(_){}
      try{ this.applyOverloadFX3(this.st.overload); }catch(_){}
      this._checkStages && this._checkStages();
    },

    // Boss
    spawnMiniBoss:function(){
      if(this.st.boss) return;
      const b={ hp:120, el:document.createElement('a-entity'), t:0 };
      b.el.setAttribute('geometry','primitive: icosahedron; radius: 0.6');
      b.el.setAttribute('material','color:#17394a; emissive:#0ff; metalness:0.2; roughness:0.2');
      b.el.setAttribute('position',{x:0,y:1.6,z:-2.6});
      b.el.classList.add('boss');
      qs('#spawner')?.appendChild(b.el);
      this.st.boss=b; this.updateHUD(); toast(this.dict['missionBoss']||'Mini Boss!');
    },
    damageBoss:function(amount){
      if(!this.st.boss) return; this.st.boss.hp -= amount;
      if(this.st.boss.hp<=0){
        try{this.st.boss.el.remove();}catch(e){}
        this.st.boss=null; this.updateHUD(); toast(this.dict['missionClear']||'Mission Clear'); SFX.ok();
      } else { this.updateHUD(); }
    },

    endGame:function(){ this.st.playing=false; toast(`${(this.dict['finished']||'Finished')} • ${(this.dict['score']||'Score')}: ${this.st.score}`,2000); },

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
      if(hits.length){ let obj=hits[0].object; while(obj && !obj.el) obj=obj.parent; if(obj && obj.el) obj.el.emit('click'); }
    }
  });
})();
