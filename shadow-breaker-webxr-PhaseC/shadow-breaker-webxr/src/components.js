// Shadow Breaker – Phase C (C1 Hybrid) Components
(function(){
  const $=(id)=>document.getElementById(id);
  const qs=(sel)=>document.querySelector(sel);
  const q=new URLSearchParams(location.search);

  const AudioBus={ctx:null,
    beep(f=880,d=.08,v=.2){try{this.ctx=this.ctx||new (window.AudioContext||window.webkitAudioContext)();const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.frequency.value=f;o.type='square';g.gain.value=v;o.connect(g);g.connect(this.ctx.destination);o.start();o.stop(this.ctx.currentTime+d);}catch(e){}},
    burst(){this.beep(220,.08,.25); this.beep(660,.1,.15);},
    warn(){this.beep(140,.12,.25);},
    ok(){this.beep(900,.07,.2);}
  };

  AFRAME.registerComponent('shadow-breaker-game',{
    init:function(){
      this.mode=(q.get('mode')==='timed')?'timed':'practice';
      this.dict={};
      fetch('src/i18n.json').then(r=>r.json()).then(data=>{
        const cur=localStorage.getItem('sb_lang')||'th';
        this.dict=data[cur]||data['th']||{};
        this.st={
          playing:false,timeLeft:(this.mode==='timed')?60:9999,
          score:0,combo:1,arcane:0,overload:0,hp:100,
          last:performance.now(),spawnEveryMs:800,spawnTimer:performance.now(),
          phase:'tutorial',boss:null,diff:'normal',
        };
        this.createPool();
        this.wireUI();
        this.updateHUD();
        this.startGame();
        this.toastFX(this.dict['missionStart']||'Mission Start: Tutorial');
      });

      window.addEventListener('click', this.manualRay.bind(this), {passive:false});
      window.addEventListener('mousedown', this.manualRay.bind(this), {passive:false});
      window.addEventListener('keydown',(e)=>{
        if(e.key==='q'||e.key==='Q') this.toggleSkillWheel();
        if(e.key==='Escape') this.closeSkillWheel();
        if(e.key==='o'||e.key==='O') this.toggleSettings();
      });
      window.addEventListener('sb-cast',(ev)=> this.castSkill(ev.detail.skill));
    },

    createPool:function(){
      this.pool={enemies:[],active:new Set(),
        get:()=>{
          let el=this.pool.enemies.pop();
          if(!el){
            el=document.createElement('a-entity');
            el.setAttribute('geometry','primitive: sphere; radius: 0.18');
            el.setAttribute('material','color:#16a0a0; emissive:#0af; metalness:0.2; roughness:0.4');
            el.classList.add('enemy','clickable');
            el.addEventListener('click',()=>{ if(this.st.playing){ this.hitEnemy(el,40); this.onHitCommon(); }});
          }
          this.pool.active.add(el);
          qs('#spawner').appendChild(el);
          el.object3D.visible=true;
          return el;
        },
        put:(el)=>{
          if(!el) return;
          this.pool.active.delete(el);
          el.object3D.visible=false;
          el.removeAttribute('position');
          this.pool.enemies.push(el);
        }
      };
    },

    wireUI:function(){
      const bw=$('btnSkillWheel'); if(bw){ bw.onclick=()=>this.toggleSkillWheel(); }
      const bs=$('btnSettings'); if(bs){ bs.onclick=()=>this.toggleSettings(); }
      const scene=qs('a-scene');
      scene?.addEventListener('abuttondown', ()=> this.toggleSkillWheel());
      scene?.addEventListener('xbuttondown', ()=> this.toggleSkillWheel());
      const diffSel=$('difficulty');
      if(diffSel){ diffSel.value=this.st.diff; diffSel.onchange=()=> this.st.diff=diffSel.value; }
    },

    startGame:function(){ this.st.playing=true; this.loop(); },

    updateHUD:function(){
      const s=this.st,d=this.dict,L=(k,def)=>(d[k]||def);
      $('hudScore').textContent=`${L('score','Score')}: ${s.score}`;
      $('hudCombo').textContent=`${L('combo','Combo')}: x${s.combo}`;
      $('hudTime').textContent =`${L('time','Time')}: ${this.mode==='timed'?Math.ceil(s.timeLeft):'∞'}`;
      $('hudArcane').textContent=`${L('arcane','Arcane')}: ${s.arcane}%`;
      const back=$('backLink'); if(back) back.textContent=(d['back']||'Back');
      const hp=$('hudHP'); if(hp) hp.textContent=`${L('hp','HP')}: ${Math.max(0,Math.ceil(s.hp))}`;
      const ov=$('hudOverload'); if(ov) ov.textContent=`Overload: ${Math.round(s.overload)}%`;
      const bossEl=$('hudBoss'); if(bossEl) bossEl.textContent = s.boss? `${L('bossHP','Boss HP')}: ${Math.max(0,Math.ceil(s.boss.hp))}` : `${L('bossHP','Boss HP')}: —`;
      const fx=$('overlayFX'); if(fx) fx.classList.toggle('overload', s.overload>=75);
    },

    loop:function(){
  if(!this.st.playing) return;
  requestAnimationFrame(this.loop.bind(this));

  const now = performance.now();
  const dt  = (now - this.st.last) / 1000;
  this.st.last = now;

  // สปอว์นเป้าทุก ๆ ~0.8–1.0 วินาที (ปรับจากค่าเริ่มต้นได้)
  if(now - this.st.spawnTimer > this.st.spawnEveryMs){
    this.st.spawnTimer = now;
    this.spawnTarget(); // ใช้ชื่อฟังก์ชันนี้ให้ตรงกับที่ประกาศจริง
  }

  // flow -> mini boss
  if(this.st.phase === 'tutorial' && this.st.score >= 400){
    this.st.phase = 'boss';
    this.spawnMiniBoss();
  }

  // ใช้ this.mode เสมอ
  if(this.mode === 'timed'){
    this.st.timeLeft = Math.max(0, this.st.timeLeft - dt);
    document.getElementById('hudTime').textContent =
      `${(this.dict['time']||'Time')}: ${Math.ceil(this.st.timeLeft)}`;
    if(this.st.timeLeft <= 0){ this.endGame(); }
  }
},


  spawnTarget:function(){
  let spawner = qs('#spawner');
  if(!spawner){
    // กันเคสไม่มี spawner ใน HTML
    spawner = document.createElement('a-entity');
    spawner.id = 'spawner';
    const scene = document.querySelector('a-scene');
    scene && scene.appendChild(spawner);
  }

  const e = document.createElement('a-entity');
  e.setAttribute('geometry','primitive: sphere; radius: 0.26'); // ใหญ่ขึ้น มองง่าย
  e.setAttribute('material','color:#39c5bb; emissive:#0af; metalness:0.1; roughness:0.4');

  // ใกล้ขึ้นและกึ่งกลางกว่าเดิม
  const rx = (Math.random()*2-1)*0.9;
  const ry = 1.2 + Math.random()*0.6;
  const rz = -2.0 - Math.random()*0.5;
  e.setAttribute('position',{x:rx,y:ry,z:rz});

  e.classList.add('clickable');
  e.setAttribute('animation__pulse','property: scale; to:1.18 1.18 1.18; dir:alternate; loop:true; dur:600');

  e.addEventListener('click', ()=>{
    if(!this.st.playing) return;
    this.st.combo  = Math.min(9, this.st.combo+1);
    this.st.score += 100 + (this.st.combo-1)*10;
    this.st.arcane = Math.min(100, this.st.arcane+3);
    this.updateHUD();
    if(this.st.boss){ this.damageBoss(3); }
    e.remove();
    toast((this.dict['great']||'Great! +100'));
  });

  // อายุเป้าให้นานขึ้นหน่อย (3.2s)
  setTimeout(()=>{
    if(e.parentNode){
      e.remove();
      this.st.combo = 1;
    }
  }, 3200);

  spawner.appendChild(e);
},


    tickEnemies:function(dt){
      const list=Array.from(this.pool.active||[]);
      list.forEach(e=>{
        const p=e.getAttribute('position'); const t=performance.now()/1000;
        p.x += parseFloat(e.dataset.vx||0)*dt;
        p.y += Math.sin(t*4)*0.002;
        p.z += 0.16*dt;
        e.setAttribute('position',p);
        if(p.z>-0.3){
          this.st.hp=Math.max(0,this.st.hp-10);
          this.pool.put(e);
          AudioBus.warn(); this.updateHUD();
          if(this.st.hp<=0) this.endGame();
        }
      });
    },

    hitEnemy:function(e,dmg){
      const hp=(parseFloat(e.dataset.hp||'30')-dmg);
      if(hp<=0){
        this.pool.put(e);
        this.st.score+=120; this.st.combo=Math.min(9,this.st.combo+1);
        this.st.arcane=Math.min(100,this.st.arcane+4);
        AudioBus.ok();
      } else { e.dataset.hp=hp; }
      this.updateHUD();
    },

    spawnMiniBoss:function(){
      if(this.st.boss) return;
      const b={ hp:260, phase:1, el:document.createElement('a-entity'), t:0 };
      b.el.setAttribute('geometry','primitive: icosahedron; radius: 0.7');
      b.el.setAttribute('material','color:#0b2530; emissive:#0ff; metalness:0.2; roughness:0.2');
      b.el.setAttribute('position',{x:0,y:1.6,z:-3.0});
      b.el.classList.add('boss','clickable');
      b.el.addEventListener('click',()=>{ this.damageBoss(8); this.onHitCommon(); });
      qs('#spawner').appendChild(b.el);
      this.st.boss=b; this.toastFX(this.dict['missionBoss']||'Mini Boss!'); this.updateHUD();
    },

    tickBoss:function(dt){
      const b=this.st.boss; if(!b) return;
      b.t += dt;
      const p=b.el.getAttribute('position');
      p.x=Math.sin(b.t*1.2)*0.9; p.y=1.4+Math.sin(b.t*2.2)*0.2;
      b.el.setAttribute('position',p);
      if(b.hp<=120 && b.phase===1){ b.phase=2; this.toastFX('Boss Phase 2!'); AudioBus.burst(); }
      if(b.phase===2 && Math.floor(b.t)%3===0 && !this._aoeActive){
        this._aoeActive=true;
        const aoe=document.createElement('a-entity');
        aoe.setAttribute('geometry','primitive: ring; radiusInner:0.05; radiusOuter:0.8');
        aoe.setAttribute('material','color:#39d3e6; opacity:0.35; side:double');
        aoe.setAttribute('rotation','-90 0 0'); aoe.setAttribute('position','0 0 -1');
        qs('a-scene').appendChild(aoe);
        setTimeout(()=>{ aoe.setAttribute('material','color:#ff4060; opacity:0.55'); this.st.hp=Math.max(0,this.st.hp-8); this.updateHUD(); setTimeout(()=>{ aoe.remove(); this._aoeActive=false; }, 250); }, 450);
      }
    },

    damageBoss:function(amount){
      const b=this.st.boss; if(!b) return; b.hp-=amount; AudioBus.ok();
      if(b.hp<=0){ try{ b.el.remove(); }catch(e){} this.st.boss=null; this.st.score+=500; this.updateHUD(); this.toastFX(this.dict['missionClear']||'Mission Clear'); }
      else { this.updateHUD(); }
    },

    toggleSkillWheel:function(){ const p=$('skillWheelPanel'); p&&p.classList.toggle('active'); },
    closeSkillWheel:function(){ $('skillWheelPanel')?.classList.remove('active'); },
    toggleSettings:function(){ $('settingsModal')?.classList.toggle('active'); },

    castSkill:function(key){
      this.closeSkillWheel();
      const need={pulse:10,bind:15,slash:12,burst:20}[key]||10;
      if(this.st.arcane<need){ this.toastFX('Not enough Arcane'); AudioBus.warn(); return; }
      this.st.arcane -= need;
      if(key==='pulse') this.castArcanePulse();
      if(key==='bind')  this.castShadowBind();
      if(key==='slash') this.castShadowSlash();
      if(key==='burst') this.castArcaneBurst();
      this.raiseOverload((key==='burst')?10:(key==='bind'?6:5));
      this.updateHUD();
    },

    castArcanePulse:function(){
      const enemies=Array.from(this.pool.active||[]);
      enemies.forEach(el=> this.hitEnemy(el,999));
      if(this.st.boss) this.damageBoss(16);
      this.toastFX('Arcane Pulse!'); AudioBus.burst();
    },
    castShadowBind:function(){ if(this.st.boss) this.damageBoss(10); this.toastFX('Shadow Bind!'); AudioBus.beep(520,.09,.2); },
    castShadowSlash:function(){ const enemies=Array.from(this.pool.active||[]); enemies.forEach(el=> this.hitEnemy(el,60)); if(this.st.boss) this.damageBoss(12); this.toastFX('Shadow Slash!'); AudioBus.burst(); },
    castArcaneBurst:function(){ if(this.st.boss) this.damageBoss(26); this.toastFX('Arcane Burst!'); AudioBus.burst(); },

    raiseOverload:function(x){
      this.st.overload=Math.min(100,this.st.overload+x);
      if(this.st.overload>=75){ this.st.hp=Math.max(0,this.st.hp-1); }
      if(this.st.overload>=95){ this.toastFX(this.dict['overloadWarning']||'Overload Warning'); AudioBus.warn(); }
      const fx=$('overlayFX'); if(fx) fx.classList.toggle('overload', this.st.overload>=75);
    },

    onHitCommon:function(){
      this.st.combo=Math.min(9,this.st.combo+1);
      this.st.score+=20+this.st.combo*5;
      this.st.arcane=Math.min(100,this.st.arcane+2);
      this.updateHUD();
    },

    enterCinematic:function(txt='BOSS APPROACH'){
      this.st.playing=false;
      const fx=$('overlayFX'); if(fx){ fx.classList.add('overload'); fx.style.opacity=.18; }
      this.toastFX(txt); setTimeout(()=>{ if(fx){ fx.style.opacity=0; fx.classList.remove('overload'); } this.st.playing=true; },1600);
    },

    toastFX:function(msg){ const t=$('toast'); t.textContent=msg; t.style.display='block'; setTimeout(()=> t.style.display='none',900); },

    manualRay:function(evt){
      const sceneEl=qs('a-scene'); const camEl=qs('#camera');
      const renderer=sceneEl && sceneEl.renderer; const camera=camEl && camEl.getObject3D('camera');
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
