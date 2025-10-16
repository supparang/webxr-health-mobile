// Arcane Combat (LEGACY – Safe Minimal Build)
// ทำงานกับ play.html ที่ใช้ A-Frame 1.5.0 และมี HUD id: hudScore/hudCombo/hudTime/hudArcane/hudHP/hudOverload/hudBoss
(function(){
  const $ = (id)=>document.getElementById(id);
  const qs=(sel)=>document.querySelector(sel);
  const toast=(m,ms=900)=>{const t=$('toast'); if(!t) return; t.textContent=m; t.style.display='block'; setTimeout(()=>t.style.display='none',ms);};

  // ค่าความยากแบบง่าย
  const DIFF={
    easy:   {spawnMs:950, lifeMs:3800, timedSec:75, missHP:0, bossHit:3},
    normal: {spawnMs:800, lifeMs:3200, timedSec:60, missHP:3, bossHit:6},
    hard:   {spawnMs:650, lifeMs:2800, timedSec:50, missHP:5, bossHit:10}
  };

  // SFX ง่าย ๆ
  const SFX={ctx:null,
    beep(f=880,d=.08,v=.2){try{this.ctx=this.ctx||new (window.AudioContext||window.webkitAudioContext)();const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='square';o.frequency.value=f;g.gain.value=v;o.connect(g);g.connect(this.ctx.destination);o.start();o.stop(this.ctx.currentTime+d);}catch(e){}},
    hit(){this.beep(920,.05,.2)}, ok(){this.beep(660,.07,.18)}, warn(){this.beep(160,.12,.25)}
  };

  // อัปเดต Overload bar (ใช้ element ใน play.html)
  function updateOverloadUI(v){
    const w=$('overloadBarWrap'), f=$('overloadBarFill'), t=$('overloadBarText');
    if(!w||!f||!t) return;
    const p=Math.max(0,Math.min(100,Math.round(v)));
    f.style.width=p+'%'; t.textContent='Overload: '+p+'%';
    w.className=''; w.id='overloadBarWrap';
    if(p>=50&&p<80) w.classList.add('danger');
    else if(p>=80&&p<100) w.classList.add('critical');
    else if(p>=100) w.classList.add('z2');
  }

  AFRAME.registerComponent('shadow-breaker-game',{
    init:function(){
      const q=new URLSearchParams(location.search);
      this.mode=(q.get('mode')==='timed')?'timed':'practice';
      this.diff=q.get('diff')||'normal';
      this.cfg=DIFF[this.diff]||DIFF.normal;

      // สถานะเกม
      this.st={
        playing:false, timeLeft:(this.mode==='timed')?this.cfg.timedSec:9999,
        score:0, combo:1, arcane:0, overload:0, hp:100,
        last:performance.now(), spawnEveryMs:this.cfg.spawnMs, spawnTimer:performance.now()-this.cfg.spawnMs-1,
        olTick:0, dmgCD:0, boss:null
      };

      // HUD หัวข้อเกม
      const gv=$('hudGame'); if(gv) gv.textContent='Arcane Combat';

      // ยิงด้วยเมาส์ (manual ray) — เผื่อกรณี cursor/laser ไม่ทำงาน
      window.addEventListener('click', this.manualRay.bind(this), {passive:false});

      this.updateHUD();
      toast('Mission Start');
      this.st.playing=true;
      this.loop();
    },

    // วนเกม
    loop:function(){
      if(!this.st.playing) return;
      requestAnimationFrame(this.loop.bind(this));
      const now=performance.now(), dt=(now-this.st.last)/1000; this.st.last=now;

      // จับเวลา
      if(this.mode==='timed'){
        this.st.timeLeft=Math.max(0,this.st.timeLeft-dt);
        if(this.st.timeLeft<=0){ return this.endGame(); }
      }

      // สุ่มสปอว์นเป้า
      if(now-this.st.spawnTimer>this.st.spawnEveryMs){
        this.st.spawnTimer=now; this.spawnTarget();
      }

      // ดาเมจจาก Overload (พัลส์เบา ๆ)
      this.st.olTick+=dt;
      if(this.st.overload>=80 && this.st.overload<100 && this.st.olTick>=0.5){ this.takeDamage(0.4,'Overload'); this.st.olTick=0; }
      if(this.st.overload>=100 && this.st.olTick>=0.4){ this.takeDamage(1.0,'Overload+'); this.st.olTick=0; }
      if(this.st.dmgCD>0) this.st.dmgCD=Math.max(0,this.st.dmgCD-dt);

      // เงื่อนไขเรียกบอส (แต้มถึง)
      if(!this.st.boss && this.st.score>=400){
        this.spawnMiniBoss();
      }

      this.updateHUD();
      if(this.st.hp<=0) this.endGame();
    },

    // สร้างเป้าให้ยิง
    spawnTarget:function(){
      const sp=qs('#spawner'); if(!sp) return;
      const e=document.createElement('a-entity');
      e.setAttribute('geometry','primitive: sphere; radius: 0.25');
      e.setAttribute('material','color:#39c5bb; emissive:#0af; metalness:0.1; roughness:0.4');
      const rx=(Math.random()*2-1)*0.9, ry=1.2+Math.random()*0.6, rz=-2.0-Math.random()*0.5;
      e.setAttribute('position',{x:rx,y:ry,z:rz});
      e.classList.add('clickable');
      e.setAttribute('animation__pulse','property: scale; to:1.12 1.12 1.12; dir:alternate; loop:true; dur:650');

      // คลิก = ได้คะแนน
      e.addEventListener('click',()=>{
        if(!this.st.playing) return;
        this.st.combo=Math.min(20,this.st.combo+1);
        const add=100+(this.st.combo-1)*10;
        this.st.score+=add;
        this.st.arcane=Math.min(100,this.st.arcane+3);
        this.st.overload=Math.min(130,this.st.overload+0.9); // ขยับ OL เล็กน้อย
        if(this.st.boss){ this.damageBoss(3); }
        SFX.hit(); try{e.remove();}catch(_){}
        this.updateHUD();
      });

      // เป้าหมดเวลา = คอมโบตก + โดนเล็กน้อย (ยกเว้น easy)
      setTimeout(()=>{
        if(e.parentNode){
          e.remove(); this.st.combo=1;
          if(this.diff!=='easy'){ this.takeDamage(this.cfg.missHP,'Miss'); }
          this.overloadDown(0.4);
          this.updateHUD();
        }
      }, this.cfg.lifeMs);

      sp.appendChild(e);
    },

    // สร้างบอสเล็ก ๆ
    spawnMiniBoss:function(){
      const sp=qs('#spawner'); if(!sp) return;
      const el=document.createElement('a-entity');
      el.setAttribute('geometry','primitive: icosahedron; radius: 0.6');
      el.setAttribute('material','color:#17394a; emissive:#0ff; metalness:0.2; roughness:0.2');
      el.setAttribute('position',{x:0,y:1.6,z:-2.6});
      el.classList.add('boss');
      sp.appendChild(el);
      this.st.boss={hp:140, el};
      toast('Mini Boss!');

      // โจมตีเป็นจังหวะ
      const attack=()=>{
        if(!this.st.playing || !this.st.boss || this.st.hp<=0) return;
        const dmg=this.cfg.bossHit + Math.floor(this.st.overload/50);
        this.takeDamage(dmg,'Boss');
        if(this.st.boss && this.st.hp>0) setTimeout(attack, 1600);
      };
      setTimeout(attack, 1200);
      this.updateHUD();
    },

    damageBoss:function(amount){
      if(!this.st.boss) return;
      this.st.boss.hp-=amount;
      if(this.st.boss.hp<=0){
        try{ this.st.boss.el.remove(); }catch(_){}
        this.st.boss=null;
        toast('Mission Clear');
      }
      this.updateHUD();
    },

    // HUD
    updateHUD:function(){
      const s=this.st;
      const hpEl=$('hudHP'), scEl=$('hudScore'), coEl=$('hudCombo'), tiEl=$('hudTime'), arEl=$('hudArcane'), ovEl=$('hudOverload'), bEl=$('hudBoss');
      if(scEl) scEl.textContent = `Score: ${s.score}`;
      if(coEl) coEl.textContent = `Combo: x${s.combo}`;
      if(tiEl) tiEl.textContent = `Time: ${this.mode==='timed'?Math.ceil(s.timeLeft):'∞'}`;
      if(arEl) arEl.textContent = `Arcane: ${s.arcane}%`;
      if(hpEl) hpEl.textContent = `ENERGY: ${Math.max(0,Math.ceil(s.hp))}`;
      if(ovEl) ovEl.textContent = `Overload: ${Math.round(s.overload)}%`;
      if(bEl)  bEl.textContent  = this.st.boss? `Boss HP: ${Math.max(0,Math.ceil(this.st.boss.hp))}` : `Boss HP: —`;
      updateOverloadUI(s.overload);
      const hpFill=$('hpBarFill'); if(hpFill) hpFill.style.width=Math.max(0,Math.min(100,s.hp))+'%';
    },

    // ดาเมจ + ป้องกันยิงรัว
    takeDamage:function(amount,label){
      if(amount<=0) return;
      if(this.st.dmgCD>0) return;
      this.st.hp=Math.max(0,this.st.hp-amount);
      this.st.dmgCD=0.5;
      toast(`-${Math.round(amount)} HP (${label||'Hit'})`);
      this.updateHUD();
    },
    overloadDown:function(x){ this.st.overload=Math.max(0,this.st.overload-(x||0.3)); },

    // จบเกม
    endGame:function(){
      this.st.playing=false;
      toast(`Finished • Score: ${this.st.score}`, 2000);
    },

    // ยิงด้วยเมาส์ (raycaster manual)
    manualRay:function(evt){
      const sceneEl=qs('a-scene'), camEl=$('camera');
      const renderer=sceneEl && sceneEl.renderer, camera=camEl && camEl.getObject3D('camera');
      if(!renderer||!camera||!this.st.playing) return;
      const rect=renderer.domElement.getBoundingClientRect();
      const mouse=new THREE.Vector2(((evt.clientX-rect.left)/rect.width)*2-1,-((evt.clientY-rect.top)/rect.height)*2+1);
      const raycaster=new THREE.Raycaster(); raycaster.setFromCamera(mouse,camera);
      const nodes=Array.from(document.querySelectorAll('.clickable')).map(el=>el.object3D).filter(Boolean);
      const hits=raycaster.intersectObjects(nodes,true);
      if(hits.length){ let obj=hits[0].object; while(obj && !obj.el) obj=obj.parent; if(obj && obj.el) obj.el.emit('click'); SFX.ok(); }
      else { this.takeDamage(0,''); } // ไม่ทำอะไร แต่กัน error
    }
  });
})();
