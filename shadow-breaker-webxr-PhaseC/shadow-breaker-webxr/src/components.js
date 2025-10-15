// src/components.js  — Minimal Stable (Phase A) ✔ spawns for sure
(function(){
  const $=(id)=>document.getElementById(id);
  const qs=(sel)=>document.querySelector(sel);
  const toast=(m,ms=900)=>{const t=$('toast'); if(!t) return; t.textContent=m; t.style.display='block'; setTimeout(()=>t.style.display='none',ms);};

  AFRAME.registerComponent('shadow-breaker-game',{
    init:function(){
      this.mode=(new URLSearchParams(location.search).get('mode')==='timed')?'timed':'practice';
      this.dict={};
      // load i18n
      fetch('src/i18n.json').then(r=>r.json()).then(data=>{
        const cur = localStorage.getItem('sb_lang') || 'th';
        this.dict = data[cur] || data['th'] || {};
        // game state
        this.st={
          playing:false,
          timeLeft:(this.mode==='timed')?60:9999,
          score:0, combo:1, arcane:0, overload:0, hp:100,
          last:performance.now(),
          spawnEveryMs:800,                 // เร็วขึ้นนิด
          spawnTimer:performance.now()-801, // บังคับให้สปอว์นตั้งแต่เฟรมแรก
          phase:'tutorial', boss:null
        };
        this.updateHUD();
        this.startGame();
        toast(this.dict['missionStart']||'Mission Start');
        const bw=$('btnSkillWheel'); if(bw){ bw.onclick=()=>this.openSkillWheel(); }
        window.addEventListener('keydown',(e)=>{ if(e.key==='q'||e.key==='Q') this.openSkillWheel(); });
      });

      // Fallback mouse ray (นอกจาก cursor/laser ของ A-Frame)
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

      // สปอว์นแน่นอน
      if(now - this.st.spawnTimer > this.st.spawnEveryMs){
        this.st.spawnTimer = now;
        this.spawnTarget();
      }

      // mini boss
      if(this.st.phase==='tutorial' && this.st.score>=400){
        this.st.phase='boss';
        this.spawnMiniBoss();
      }

      // จับเวลาใช้ this.mode เท่านั้น
      if(this.mode==='timed'){
        this.st.timeLeft=Math.max(0,this.st.timeLeft-dt);
        $('hudTime').textContent = `${(this.dict['time']||'Time')}: ${Math.ceil(this.st.timeLeft)}`;
        if(this.st.timeLeft<=0) this.endGame();
      }
    },

    // ===== Targets =====
    spawnTarget:function(){
      let spawner = qs('#spawner');
      if(!spawner){
        // กันพลาดถ้าไม่มี spawner ใน HTML
        spawner = document.createElement('a-entity');
        spawner.id='spawner';
        const scene=qs('a-scene'); scene && scene.appendChild(spawner);
      }

      const e=document.createElement('a-entity');
      e.setAttribute('geometry','primitive: sphere; radius: 0.26'); // ใหญ่ขึ้น
      e.setAttribute('material','color:#39c5bb; emissive:#0af; metalness:0.1; roughness:0.4');
      const rx=(Math.random()*2-1)*0.9, ry=1.2+Math.random()*0.6, rz=-2.0-Math.random()*0.5;
      e.setAttribute('position',{x:rx,y:ry,z:rz});
      e.classList.add('clickable');
      e.setAttribute('animation__pulse','property: scale; to:1.18 1.18 1.18; dir:alternate; loop:true; dur:600');

      e.addEventListener('click',()=>{
        if(!this.st.playing) return;
        this.st.combo=Math.min(9,this.st.combo+1);
        this.st.score+=100+(this.st.combo-1)*10;
        this.st.arcane=Math.min(100,this.st.arcane+3);
        this.updateHUD();
        if(this.st.boss){ this.damageBoss(3); }
        e.remove();
        toast((this.dict['great']||'Great! +100'));
      });

      // อายุเป้า 3.2s เพื่อให้เห็นชัด
      setTimeout(()=>{ if(e.parentNode){ e.remove(); this.st.combo=1; } }, 3200);

      spawner.appendChild(e);
      // DEBUG: เปิดดูได้ในคอนโซล
      // console.log('[ShadowBreaker] spawnTarget');
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
      const spawner=qs('#spawner'); spawner && spawner.appendChild(boss.el);
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
