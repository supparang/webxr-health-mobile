// src/components.js — Phase A + Hit FX + Score Popup + Objective HUD (รวมข้อ 3 ทั้งหมด)
(function(){
  const $=(id)=>document.getElementById(id);
  const qs=(sel)=>document.querySelector(sel);
  const toast=(m,ms=900)=>{const t=$('toast'); if(!t) return; t.textContent=m; t.style.display='block'; setTimeout(()=>t.style.display='none',ms);};

  // ===== 3.1: เสียงสั้น + FX Helper =====
  const SFX = {
    ctx:null,
    beep(f=880,d=.08,v=.2){ try{
      this.ctx=this.ctx||new (window.AudioContext||window.webkitAudioContext)();
      const o=this.ctx.createOscillator(), g=this.ctx.createGain();
      o.type='square'; o.frequency.value=f; g.gain.value=v;
      o.connect(g); g.connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime+d);
    }catch(e){} },
    hit(){ this.beep(900,.05,.2); }, ok(){ this.beep(660,.07,.18); }, warn(){ this.beep(160,.12,.25); }
  };

  function spawnHitSpark(pos){
    const el=document.createElement('a-entity');
    el.setAttribute('geometry','primitive: ring; radiusInner:0.02; radiusOuter:0.18');
    el.setAttribute('material','color:#39d3e6; opacity:0.9; side:double');
    el.setAttribute('rotation','0 0 0');
    el.setAttribute('position', pos);
    el.setAttribute('animation__scale','property: scale; to:1.8 1.8 1.8; dur:180; easing:easeOutQuad');
    el.setAttribute('animation__fade','property: components.material.material.opacity; to:0; dur:220; delay:60');
    document.querySelector('a-scene').appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 260);
  }

  function spawnScorePopup(worldPos, text="+100"){
    // 3D -> 2D screen space popup
    const scene=document.querySelector('a-scene'); const cam=document.getElementById('camera');
    if(!scene || !cam) return;
    const camera=cam.getObject3D('camera'); const renderer=scene.renderer;
    if(!camera || !renderer) return;

    const v = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z).project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    const x = (v.x * .5 + .5) * rect.width + rect.left;
    const y = (-v.y * .5 + .5) * rect.height + rect.top;

    const div=document.createElement('div');
    div.className='hit-popup pop-score';
    div.style.position='absolute';
    div.style.left = x+'px'; div.style.top = y+'px';
    div.textContent=text;
    document.body.appendChild(div);
    requestAnimationFrame(()=> div.classList.add('show'));
    setTimeout(()=>{ div.style.opacity='0'; }, 380);
    setTimeout(()=>{ try{ div.remove(); }catch(e){} }, 700);
  }

  AFRAME.registerComponent('shadow-breaker-game',{
    init:function(){
      this.mode=(new URLSearchParams(location.search).get('mode')==='timed')?'timed':'practice';
      this.dict={};
      fetch('src/i18n.json').then(r=>r.json()).then(data=>{
        const cur = localStorage.getItem('sb_lang') || 'th';
        this.dict = data[cur] || data['th'] || {};
        this.st={
          playing:false,
          timeLeft:(this.mode==='timed')?60:9999,
          score:0, combo:1, arcane:0, overload:0, hp:100,
          last:performance.now(),
          spawnEveryMs:800,
          spawnTimer:performance.now()-801, // ให้เกิดเป้าตั้งแต่เฟรมแรก
          phase:'tutorial', boss:null
        };
        this.updateHUD();
        this.startGame();
        toast(this.dict['missionStart']||'Mission Start');

        const bw=$('btnSkillWheel'); if(bw){ bw.onclick=()=>this.openSkillWheel(); }
        window.addEventListener('keydown',(e)=>{ if(e.key==='q'||e.key==='Q') this.openSkillWheel(); });

        // ===== 3.2: ตั้ง Objective เริ่มต้น =====
        const obj = $('objective');
        if(obj) obj.textContent = 'Objective: ทำคะแนนให้ถึง 400 เพื่อเรียก Mini Boss';
      });

      // mouse ray fallback
      window.addEventListener('click', this.manualRay.bind(this), {passive:false});
    },

    startGame:function(){ this.st.playing=true; this.loop(); },

    updateHUD:function(){
      const s=this.st, d=this.dict, L=(k,def)=>(d[k]||def);
      $('hudScore').textContent = `${L('score','Score')}: ${s.score}`;
      $('hudCombo').textContent = `${L('combo','Combo')}: x${s.combo}`;
      $('hudTime').textContent  = `${L('time','Time')}: ${this.mode==='timed'?Math.ceil(s.timeLeft):'∞'}`;
      $('hudArcane').textContent= `${L('arcane','Arcane')}: ${s.arcane}%`;
      const back=$('backLink'); if(back) back.textContent=(d['back']||'Back');
      const hp=$('hudHP'); if(hp) hp.textContent=`${L('hp','HP')}: ${Math.max(0,Math.ceil(s.hp))}`;
      const ov=$('hudOverload'); if(ov) ov.textContent=`Overload: ${Math.round(s.overload)}%`;
      const bossEl=$('hudBoss'); if(bossEl) bossEl.textContent = this.st.boss ? `${L('bossHP','Boss HP')}: ${Math.max(0,Math.ceil(this.st.boss.hp))}` : `${L('bossHP','Boss HP')}: —`;
    },

    loop:function(){
      if(!this.st.playing) return;
      requestAnimationFrame(this.loop.bind(this));

      const now=performance.now();
      const dt=(now-this.st.last)/1000;
      this.st.last=now;

      if(now - this.st.spawnTimer > this.st.spawnEveryMs){
        this.st.spawnTimer = now;
        this.spawnTarget();
      }

      // ===== 3.3: mission flow + ปรับ Objective ตอนบอสเข้า =====
      if(this.st.phase==='tutorial' && this.st.score>=400){
        this.st.phase='boss';
        const obj = $('objective');
        if(obj) obj.textContent = 'Objective: จัดการ Mini Boss!';
        this.spawnMiniBoss();
      }

      if(this.mode==='timed'){
        this.st.timeLeft=Math.max(0,this.st.timeLeft-dt);
        $('hudTime').textContent = `${(this.dict['time']||'Time')}: ${Math.ceil(this.st.timeLeft)}`;
        if(this.st.timeLeft<=0) this.endGame();
      }
    },

    // ===== 3.4: spawnTarget() ใหม่ (FX + popup + กันพลาด spawner) =====
    spawnTarget:function(){
      let spawner = qs('#spawner');
      if(!spawner){
        spawner = document.createElement('a-entity'); spawner.id='spawner';
        qs('a-scene')?.appendChild(spawner);
      }

      const e=document.createElement('a-entity');
      e.setAttribute('geometry','primitive: sphere; radius: 0.26');
      e.setAttribute('material','color:#39c5bb; emissive:#0af; metalness:0.1; roughness:0.4');
      const rx=(Math.random()*2-1)*0.9, ry=1.2+Math.random()*0.6, rz=-2.0-Math.random()*0.5;
      const pos={x:rx,y:ry,z:rz};
      e.setAttribute('position', pos);
      e.classList.add('clickable');
      e.setAttribute('animation__pulse','property: scale; to:1.18 1.18 1.18; dir:alternate; loop:true; dur:600');

      e.addEventListener('click',()=>{
        if(!this.st.playing) return;
        this.st.combo = Math.min(9, this.st.combo+1);
        const add = 100 + (this.st.combo-1)*10;
        this.st.score += add;
        this.st.arcane = Math.min(100, this.st.arcane+3);
        this.updateHUD();

        // FX + เสียง + popup
        const wp = e.getAttribute('position');
        spawnHitSpark(wp);
        spawnScorePopup(wp, '+'+add);
        SFX.hit();

        if(this.st.boss){ this.damageBoss(3); }
        e.remove();
      });

      // อายุเป้า
      setTimeout(()=>{
        if(e.parentNode){
          e.remove();
          this.st.combo = 1; // หลุดคอมโบเมื่อพลาด
        }
      }, 3200);

      spawner.appendChild(e);
    },

    // ===== Skills (Phase A quick) =====
    openSkillWheel:function(){
      const opts = [
        {k:'pulse', label:(this.dict['arcanePulse']||'Arcane Pulse'), cost:10},
        {k:'bind',  label:(this.dict['shadowBind']||'Shadow Bind'),  cost:15}
      ];
      const pick = prompt(`[${this.dict['skillWheel']||'Skill Wheel'}]\n` + opts.map((o,i)=>`${i+1}) ${o.label} (-${o.cost} Arcane)`).join('\n') + `\n> 1 or 2`);
      if(!pick) return;
      const idx = (parseInt(pick,10)||0)-1;
      if(idx<0||idx>=opts.length) return;
      const choice=opts[idx];
      if(this.st.arcane < choice.cost){ alert('Not enough Arcane!'); return; }
      this.st.arcane -= choice.cost;
      if(choice.k==='pulse') this.castArcanePulse();
      if(choice.k==='bind')  this.castShadowBind();
      this.updateHUD();
    },

    castArcanePulse:function(){
      const targets = Array.from(document.querySelectorAll('.clickable'));
      targets.forEach(el=>{ try{ el.emit('click'); }catch(e){} });
      if(this.st.boss){ this.damageBoss(12); }
      this.raiseOverload(6);
      toast('Arcane Pulse!');
    },

    castShadowBind:function(){
      if(this.st.boss){ this.damageBoss(5); }
      this.raiseOverload(4);
      toast('Shadow Bind!');
    },

    // ===== Boss =====
    spawnMiniBoss:function(){
      if(this.st.boss) return;
      const boss={ hp:120, el:document.createElement('a-entity'), t:0 };
      boss.el.setAttribute('geometry','primitive: icosahedron; radius: 0.6');
      boss.el.setAttribute('material','color:#17394a; emissive:#0ff; metalness:0.2; roughness:0.2');
      boss.el.setAttribute('position',{x:0,y:1.6,z:-2.6});
      boss.el.classList.add('boss');
      qs('#spawner')?.appendChild(boss.el);
      this.st.boss=boss;
      this.updateHUD();
      toast(this.dict['missionBoss']||'Mini Boss!');
    },

    damageBoss:function(amount){
      if(!this.st.boss) return;
      this.st.boss.hp -= amount;
      if(this.st.boss.hp<=0){
        try{ this.st.boss.el.remove(); }catch(e){}
        this.st.boss=null;
        this.updateHUD();
        toast(this.dict['missionClear']||'Mission Clear');

        // ===== 3.5: Objective เคลียร์ + เสียง OK =====
        const obj = $('objective');
        if(obj) obj.textContent = 'Mission Clear! กลับเมนูหรือเล่นต่อได้';
        SFX.ok();

      }else{
        this.updateHUD();
      }
    },

    // ===== Misc =====
    raiseOverload:function(x){
      this.st.overload = Math.min(100, this.st.overload + x);
      if(this.st.overload>=75){ this.st.hp = Math.max(0, this.st.hp - 1); }
    },

    endGame:function(){
      this.st.playing=false;
      toast(`${(this.dict['finished']||'Finished')} • ${(this.dict['score']||'Score')}: ${this.st.score}`,2000);
    },

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
