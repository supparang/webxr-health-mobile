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
      this.st={playing:false,timeLeft:(mode==='timed')?60:9999,score:0,combo:1,arcane:0,last:performance.now(),spawnEveryMs:1000,spawnTimer:performance.now()};
      loadI18n().then(()=>{ this.updateHUD(); this.startGame(); });
      window.addEventListener('click', this.manualRay.bind(this), {passive:false});
      window.addEventListener('mousedown', this.manualRay.bind(this), {passive:false});
    },
    startGame:function(){ this.st.playing=true; this.loop(); },
    updateHUD:function(){
      $('hudScore').textContent = `Score ${T('score')==='คะแนน'?'คะแนน':''}: ${this.st.score}`;
      $('hudCombo').textContent = `Combo ${T('combo')==='คอมโบ'?'คอมโบ':''}: x${this.st.combo}`;
      $('hudTime').textContent  = `Time ${T('time')==='เวลา'?'เวลา':''}: ${mode==='timed'?Math.ceil(this.st.timeLeft):'∞'}`;
      $('hudArcane').textContent= `Arcane ${T('arcane')==='พลัง'?'พลัง':''}: ${this.st.arcane}%`;
    },
    loop:function(){
      if(!this.st.playing) return;
      requestAnimationFrame(this.loop.bind(this));
      const now=performance.now(); const dt=(now-this.st.last)/1000; this.st.last=now;
      if(now-this.st.spawnTimer>this.st.spawnEveryMs){ this.st.spawnTimer=now; this.spawnTarget(); }
      if(mode==='timed'){
        this.st.timeLeft=Math.max(0,this.st.timeLeft-dt);
        $('hudTime').textContent=`Time ${T('time')==='เวลา'?'เวลา':''}: ${Math.ceil(this.st.timeLeft)}`;
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
        e.remove();
        toast(dict['great']||'Great! +100');
      });
      setTimeout(()=>{ if(e.parentNode){ e.remove(); this.st.combo=1; } }, 1800);
      spawner.appendChild(e);
    },
    endGame:function(){
      this.st.playing=false;
      toast(`${dict['finished']||'Finished'} • Score: ${this.st.score}`,2000);
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