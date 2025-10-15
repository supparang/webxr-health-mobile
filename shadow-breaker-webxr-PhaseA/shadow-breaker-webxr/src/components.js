(function(){
  const $=(id)=>document.getElementById(id);
  const qs=(sel)=>document.querySelector(sel);
  const q=new URLSearchParams(location.search);
  const mode=(q.get('mode')==='timed')?'timed':'practice';
  let dict={}; let cur='th';
  async function loadI18n(){ const res=await fetch('src/i18n.json'); const data=await res.json(); cur=localStorage.getItem('sb_lang')||'th'; dict=data[cur]||{}; }
  const T=(k)=> dict[k]||k;
  const toast=(m,ms=900)=>{const t=$('toast'); t.textContent=m; t.style.display='block'; setTimeout(()=>t.style.display='none',ms);};

  AFRAME.registerComponent('shadow-breaker-game',{
    init:function(){
      this.mode=(new URLSearchParams(location.search).get('mode')==='timed')?'timed':'practice';
      this.dict={};
      // Load i18n and start
      fetch('src/i18n.json').then(r=>r.json()).then(data=>{
        const cur = localStorage.getItem('sb_lang') || 'th';
        this.dict = data[cur] || data['th'] || {};
        this.st={playing:false,timeLeft:(this.mode==='timed')?60:9999,score:0,combo:1,arcane:0,overload:0,hp:100,last:performance.now(),spawnEveryMs:1000,spawnTimer:performance.now(),phase:'tutorial',boss:null};
        this.updateHUD();
        this.startGame();
        this.toastFX(this.dict['missionStart']||'Mission Start');
        const bw=document.getElementById('btnSkillWheel'); if(bw){ bw.onclick=()=>this.openSkillWheel(); }
        window.addEventListener('keydown',(e)=>{ if(e.key==='q'||e.key==='Q') this.openSkillWheel(); });
      });

      // Fallback manual ray
      window.addEventListener('click', this.manualRay.bind(this), {passive:false});
      window.addEventListener('mousedown', this.manualRay.bind(this), {passive:false});
    },
    startGame:function(){ this.st.playing=true; this.loop(); },
    updateHUD:function(){
      const s=this.st, d=this.dict;
      const L=(k,def)=> (d[k]||def);
      document.getElementById('hudScore').textContent = `${L('score','Score')}: ${s.score}`;
      document.getElementById('hudCombo').textContent = `${L('combo','Combo')}: x${s.combo}`;
      document.getElementById('hudTime').textContent  = `${L('time','Time')}: ${this.mode==='timed'?Math.ceil(s.timeLeft):'∞'}`;
      document.getElementById('hudArcane').textContent= `${L('arcane','Arcane')}: ${s.arcane}%`;
      const back = document.getElementById('backLink'); if(back) back.textContent = (d['back']||'Back');
      const hpEl=document.getElementById('hudHP'); if(hpEl) hpEl.textContent = `${L('hp','HP')}: ${Math.max(0,Math.ceil(s.hp))}`;
      const ov=document.getElementById('hudOverload'); if(ov) ov.textContent = `Overload: ${Math.round(s.overload)}%`;
      const bossEl=document.getElementById('hudBoss'); if(bossEl){ bossEl.textContent = s.boss? `${L('bossHP','Boss HP')}: ${Math.max(0,Math.ceil(s.boss.hp))}` : `${L('bossHP','Boss HP')}: —`; }
    },
    loop:function(){
      if(!this.st.playing) return;
      requestAnimationFrame(this.loop.bind(this));
      const now=performance.now(); const dt=(now-this.st.last)/1000; this.st.last=now;
      if(now-this.st.spawnTimer>this.st.spawnEveryMs){ this.st.spawnTimer=now; this.spawnTarget(); }
      // mission flow
      if(this.st.phase==='tutorial' && this.st.score>=400){ this.st.phase='boss'; this.spawnMiniBoss(); }
      if(mode==='timed'){
        this.st.timeLeft=Math.max(0,this.st.timeLeft-dt);
        document.getElementById('hudTime').textContent = `${(this.dict['time']||'Time')}: ${Math.ceil(this.st.timeLeft)}`;
        if(this.st.timeLeft<=0){ this.endGame(); }
      }
    },
    spawnTarget:function(){
      const spawner=qs('#spawner');
      const e=document.createElement('a-entity');
      e.setAttribute('geometry','primitive: sphere; radius: 0.22');
      e.setAttribute('material','color:#39c5bb; emissive:#0af; metalness:0.1; roughness:0.4');
      const rx=(Math.random()*2-1)*1.2, ry=1+Math.random()*1.2, rz=-2.2-Math.random()*0.6;
      e.setAttribute('position',{x:rx,y:ry,z:rz});
      e.classList.add('clickable');
      e.setAttribute('animation__pulse','property: scale; to:1.15 1.15 1.15; dir:alternate; loop:true; dur:650');
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
      setTimeout(()=>{ if(e.parentNode){ e.remove(); this.st.combo=1; } }, 1800);
      spawner.appendChild(e);
    },
    
    openSkillWheel:function(){
      // Simple prompt-based wheel for Phase A (VR: later radial menu)
      const opts = [
        {k:'pulse', label: (this.dict['arcanePulse']||'Arcane Pulse'), cost:10},
        {k:'bind',  label: (this.dict['shadowBind']||'Shadow Bind'), cost:15}
      ];
      const pick = prompt(`[${this.dict['skillWheel']||'Skill Wheel'}]\n` + opts.map((o,i)=>`${i+1}) ${o.label} (-${o.cost} Arcane)`).join('\n') + `\n> 1 or 2`);
      if(!pick) return;
      const idx = parseInt(pick,10)-1;
      if(idx<0||idx>=opts.length) return;
      const choice=opts[idx];
      if(this.st.arcane < choice.cost){ alert('Not enough Arcane!'); return; }
      this.st.arcane -= choice.cost;
      if(choice.k==='pulse') this.castArcanePulse();
      if(choice.k==='bind')  this.castShadowBind();
      this.updateHUD();
    },
    castArcanePulse:function(){
      // Damage all targets and boss light damage
      const targets = Array.from(document.querySelectorAll('.clickable'));
      targets.forEach(el=>{ try{ el.emit('click'); }catch(e){} });
      if(this.st.boss){ this.damageBoss(12); }
      this.raiseOverload(6);
      this.toastFX('Arcane Pulse!');
    },
    castShadowBind:function(){
      // Slow boss (phase A: just damage over time tick)
      if(this.st.boss){
        this.damageBoss(5);
      }
      this.raiseOverload(4);
      this.toastFX('Shadow Bind!');
    },
    toastFX:function(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.style.display='block'; setTimeout(()=>t.style.display='none',800); },
    spawnMiniBoss:function(){
      if(this.st.boss) return;
      const boss = { hp:120, el: document.createElement('a-entity'), t:0 };
      boss.el.setAttribute('geometry','primitive: icosahedron; radius: 0.6');
      boss.el.setAttribute('material','color:#17394a; emissive:#0ff; metalness:0.2; roughness:0.2');
      boss.el.setAttribute('position',{x:0,y:1.6,z:-2.6});
      boss.el.classList.add('boss');
      const spawner = document.querySelector('#spawner');
      spawner.appendChild(boss.el);
      this.st.boss=boss;
      this.updateHUD();
      this.toastFX((this.dict['missionBoss']||'Mini Boss!'));
    },
    damageBoss:function(amount){
      if(!this.st.boss) return;
      this.st.boss.hp -= amount;
      if(this.st.boss.hp<=0){
        try{ this.st.boss.el.remove(); }catch(e){}
        this.st.boss=null;
        this.updateHUD();
        this.toastFX((this.dict['missionClear']||'Mission Clear'));
      }else{
        this.updateHUD();
      }
    },
    raiseOverload:function(x){
      this.st.overload = Math.min(100, this.st.overload + x);
      if(this.st.overload>=75){
        // mild HP drain to simulate risk
        this.st.hp = Math.max(0, this.st.hp - 1);
      }
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