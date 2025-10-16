// Shadow Breaker – 4 Game Modes (combat/dash/impact/flow) + Kid-Friendly Combat Patch
// - โหมด combat ได้รับการปรับให้เหมาะกับ ป.5 เมื่อเล่นความยาก "easy":
//   * เป้าใหญ่ขึ้น อยู่ทนขึ้น, ไม่เสียพลังจากพลาดเป้า, ฟื้น ENERGY เป็นจังหวะ,
//     Overload กร่อนช้าลง, บอสโผล่ช้าลงและโจมตีช้าลง, Tutorial 20 วิแรก
(function(){
  const $=(id)=>document.getElementById(id);
  const qs=(sel)=>document.querySelector(sel);
  const T=(d,k,def)=>(d&&d[k])||def||k;
  const toast=(m,ms=900)=>{const t=$('toast'); if(!t) return; t.textContent=m; t.style.display='block'; setTimeout(()=>t.style.display='none',ms);};

  // ===== Utility =====
  const SFX={ctx:null,
    beep(f=880,d=.08,v=.2){try{this.ctx=this.ctx||new (window.AudioContext||window.webkitAudioContext)();const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='square';o.frequency.value=f;g.gain.value=v;o.connect(g);g.connect(this.ctx.destination);o.start();o.stop(this.ctx.currentTime+d);}catch(e){}},
    hit(){this.beep(920,.05,.2)}, ok(){this.beep(660,.07,.18)}, warn(){this.beep(160,.12,.25)}, crit(){this.beep(1400,.06,.25)}
  };
  function updateOverloadUI(v){const w=$('overloadBarWrap'),f=$('overloadBarFill'),t=$('overloadBarText');if(!w||!f||!t)return;const p=Math.max(0,Math.min(100,Math.round(v)));f.style.width=p+'%';t.textContent='Overload: '+p+'%';w.className='';w.id='overloadBarWrap';if(p>=50&&p<80)w.classList.add('danger');else if(p>=80&&p<100)w.classList.add('critical');else if(p>=100)w.classList.add('z2');}

  // ===== Difficulty (ใช้ร่วมทุกโหมด) =====
  const DIFF={
    // kid-friendly easy (แพตช์แล้ว)
    easy:   {spawnMs:950, lifeMs:3800, timedSec:75, missHP:0, bossHit:3,  clickMissHP:0},
    normal: {spawnMs:800, lifeMs:3200, timedSec:60, missHP:3, bossHit:6,  clickMissHP:1},
    hard:   {spawnMs:650, lifeMs:2800, timedSec:50, missHP:5, bossHit:10, clickMissHP:2}
  };

  // ===== Daily Quests (ย่อ) =====
  const QUEST_KEY='sb_daily_v1';
  const genDaily=()=>{const today=new Date().toISOString().slice(0,10);const ex=JSON.parse(localStorage.getItem(QUEST_KEY)||'{}');if(ex.date===today) return ex;const q={date:today,list:[{id:'score1500',name:{th:'ทำคะแนนรวม 1,500',en:'Reach total score 1,500'},goal:1500,cur:0,done:false},{id:'combo8',name:{th:'ทำคอมโบ x8',en:'Reach combo x8'},goal:8,cur:0,done:false},{id:'boss1',name:{th:'ชนะบอส 1 ครั้ง',en:'Defeat 1 boss'},goal:1,cur:0,done:false}]};localStorage.setItem(QUEST_KEY,JSON.stringify(q));return q;};
  const saveDaily=(q)=>localStorage.setItem(QUEST_KEY,JSON.stringify(q));
  function updateQuestUI(dict,q){const box=$('qList'), title=$('qTitle'); if(!box) return; title.textContent=T(dict,'dailyQuests','Daily Quests'); box.innerHTML=''; q.list.forEach(it=>{const nm=it.name[(localStorage.getItem('sb_lang')||'th')]; const line=document.createElement('div'); line.textContent=`• ${nm} — ${it.cur}/${it.goal} ${it.done?'✓':''}`; box.appendChild(line);});}

  // ===== Component =====
  AFRAME.registerComponent('shadow-breaker-game',{
    init:function(){
      const q=new URLSearchParams(location.search);
      this.game = q.get('game')||'combat'; // combat|dash|impact|flow
      this.mode=(q.get('mode')==='timed')?'timed':'practice';
      this.diff=q.get('diff')||'normal';
      this.cfg=DIFF[this.diff]||DIFF.normal;

      fetch('src/i18n.json').then(r=>r.json()).then(data=>{
        const cur=localStorage.getItem('sb_lang')||'th';
        this.i18n=data; this.dict=data[cur]||data['th']||{};
        window.__shadowBreakerSetLang=(v)=>{ localStorage.setItem('sb_lang',v); this.dict=this.i18n[v]||this.i18n['th']; this.updateHUD(); };

        // kid-easy flag (แพตช์)
        this.kid = (this.game==='combat' && this.diff==='easy');

        // state หลัก
        this.st={
          playing:false, timeLeft:(this.mode==='timed')?this.cfg.timedSec:9999,
          score:0, combo:1, arcane:0, overload:0, hp:100,
          last:performance.now(), spawnEveryMs:this.cfg.spawnMs, spawnTimer:performance.now()-this.cfg.spawnMs-1,
          dmgCD:0, olTick:0, idleTimer:0, recoverCD:0,
          // โหมดเฉพาะ
          jumpT:0, crouch:false,             // dash
          chargeStart:0, _impactAlive:false, // impact
          flowNotes:[], flowBeat:0, flowNext:0 // flow
        };
        this.daily=genDaily(); updateQuestUI(this.dict,this.daily);

        // ชื่อโหมดบน HUD
        const nameMap={
          combat:T(this.dict,'modeCombat','Arcane Combat'),
          dash:T(this.dict,'modeDash','Rift Dash'),
          impact:T(this.dict,'modeImpact','Impact Breaker'),
          flow:T(this.dict,'modeFlow','Spirit Flow')
        };
        $('hudGame').textContent = nameMap[this.game]||'—';

        // คีย์ควบคุมเสริมสำหรับโหมดต่าง ๆ
        window.addEventListener('keydown', (e)=>{
          if(this.game==='dash'){
            if(e.key==='ArrowUp' && this.st.jumpT<=0) this.st.jumpT=0.6; // กระโดด 0.6s
            if(e.key==='ArrowDown') this.st.crouch=true;
          }
          if(this.game==='flow'){
            if('aA'.includes(e.key)) this.checkFlowHit('A');
            if('sS'.includes(e.key)) this.checkFlowHit('S');
            if('dD'.includes(e.key)) this.checkFlowHit('D');
          }
        });
        window.addEventListener('keyup',(e)=>{ if(this.game==='dash' && e.key==='ArrowDown') this.st.crouch=false; });

        // เมาส์ค้างสำหรับ impact
        window.addEventListener('mousedown', (e)=>{ if(this.game==='impact') this.st.chargeStart=performance.now(); });
        window.addEventListener('mouseup',   (e)=>{ if(this.game==='impact') this.releaseImpact(); });

        // manual ray (combat ใช้อยู่)
        window.addEventListener('click', this.manualRay.bind(this), {passive:false});

        this.updateObjective();
        this.startGame();

        // Tutorial 20 วิแรก (เฉพาะ combat)
        if(this.game==='combat') this.showCombatTutorial();
      });
    },

    startGame:function(){ this.st.playing=true; this.loop(); },

    updateObjective:function(){
      const o=$('objective'); if(!o) return;
      const obj={
        combat:'ทำคะแนนถึง 400 (หรืิอ 600 ใน Easy) เพื่อเรียก Mini Boss',
        dash:'กด ↑ กระโดด, ↓ ย่อตัว — หลบแท่งพลัง',
        impact:'กดเมาส์ค้างเพื่อชาร์จ แล้วปล่อยทำลายแกนพลัง',
        flow:'กด A / S / D ให้ตรงสัญญาณจังหวะ'
      };
      o.textContent = obj[this.game];
    },

    updateHUD:function(){
      const s=this.st, d=this.dict, L=(k,def)=>(d&&d[k])||def;
      $('hudScore') && ($('hudScore').textContent = `${L('score','Score')}: ${s.score}`);
      $('hudCombo') && ($('hudCombo').textContent = `${L('combo','Combo')}: x${s.combo}`);
      $('hudTime')  && ($('hudTime').textContent  = `${L('time','Time')}${this.mode==='timed'?' ⏱':''}: ${this.mode==='timed'?Math.ceil(s.timeLeft):'∞'}`);
      $('hudArcane')&& ($('hudArcane').textContent= `${L('arcane','Arcane')}: ${s.arcane}%`);
      $('backLink') && ($('backLink').textContent = (L('back','Back')));
      $('hudHP')    && ($('hudHP').textContent    = `${L('hp','ENERGY')}: ${Math.max(0,Math.ceil(s.hp))}`);
      $('hudOverload') && ($('hudOverload').textContent = `Overload: ${Math.round(s.overload)}%`);
      $('hudBoss')  && ($('hudBoss').textContent  = this.game==='combat' && s.boss? `${L('bossHP','Boss HP')}: ${Math.max(0,Math.ceil(s.boss.hp))}` : `${L('bossHP','Boss HP')}: —`);
      updateOverloadUI(s.overload);
      const hpFill=$('hpBarFill'); if(hpFill){ hpFill.style.width=Math.max(0,Math.min(100,s.hp))+'%'; }
      updateQuestUI(this.dict,this.daily);
    },

    takeDamage:function(amount,label){
      if(amount<=0) return;
      if(this.st.dmgCD>0) return;
      this.st.hp=Math.max(0,this.st.hp-amount);
      this.st.dmgCD=0.6; this.st.recoverCD=0; // รีเซ็ตรีเจนเมื่อโดน
      toast(`-${Math.round(amount)} HP (${label||'Hit'})`);
      this.updateHUD();
    },

    loop:function(){
      if(!this.st.playing) return;
      requestAnimationFrame(this.loop.bind(this));
      const now=performance.now(), dt=(now-this.st.last)/1000; this.st.last=now;

      if(this.mode==='timed'){
        this.st.timeLeft=Math.max(0,this.st.timeLeft-dt);
        if(this.st.timeLeft<=0) return this.endGame();
      }

      // Overload drain — เบาลงถ้า kid-easy
      this.st.olTick += dt;
      if(this.st.overload>=80 && this.st.overload<100 && this.st.olTick>=0.5){
        this.takeDamage((this.kid?0.2:0.4),'Overload');
        this.st.olTick=0;
      }
      if(this.st.overload>=100 && this.st.olTick>=0.4){
        this.takeDamage((this.kid?0.6:1.2),'Overload+');
        this.st.olTick=0;
      }
      if(this.st.dmgCD>0) this.st.dmgCD=Math.max(0,this.st.dmgCD-dt);

      // Energy Regen (เฉพาะ combat + easy)
      if(this.kid && this.game==='combat'){
        this.st.recoverCD += dt;
        if(this.st.recoverCD >= 1.5 && this.st.hp < 90){
          this.st.hp = Math.min(100, this.st.hp + 2);
          this.st.recoverCD = 0;
        }
      }

      // สวิตช์ตามโหมด
      if(this.game==='combat') this.tickCombat(now,dt);
      if(this.game==='dash')   this.tickDash(now,dt);
      if(this.game==='impact') this.tickImpact(now,dt);
      if(this.game==='flow')   this.tickFlow(now,dt);

      this.updateHUD();
      if(this.st.hp<=0) this.endGame();
    },

    /* ========== MODE 1: COMBAT (ปรับ kid-easy) ========== */
    tickCombat:function(now,dt){
      if(now-this.st.spawnTimer>this.st.spawnEveryMs){ this.st.spawnTimer=now; this.spawnTarget(); }
      // boss threshold: easy = 600, ปกติ = 400
      const needScore = this.kid ? 600 : 400;
      if(this.st.phase!=='boss' && this.st.score>=needScore){
        this.st.phase='boss';
        this.spawnMiniBoss();
      }
    },
    spawnTarget:function(){
      const sp=qs('#spawner'); const e=document.createElement('a-entity');
      // base target
      e.setAttribute('geometry','primitive: sphere; radius: 0.25');
      e.setAttribute('material','color:#39c5bb; emissive:#0af; metalness:0.1; roughness:0.4');
      const rx=(Math.random()*2-1)*0.9, ry=1.2+Math.random()*0.6, rz=-2.0-Math.random()*0.5;
      const pos={x:rx,y:ry,z:rz}; e.setAttribute('position',pos); e.classList.add('clickable');

      // kid-easy: bigger & longer
      if(this.kid){
        e.setAttribute('geometry','primitive: sphere; radius: 0.29');
      }

      e.addEventListener('click',()=>{
        if(!this.st.playing) return;
        this.st.combo=Math.min(20,this.st.combo+1);
        const add=100+(this.st.combo-1)*10; this.st.score+=add; this.st.arcane=Math.min(100,this.st.arcane+3);
        if(this.st.boss){ this.st.boss.hp-=3; if(this.st.boss.hp<=0){ try{this.st.boss.el.remove();}catch(_){ } this.st.boss=null; toast(T(this.dict,'missionClear','Mission Clear')); } }
        SFX.hit(); e.remove();
      });

      const lifeMs = this.kid ? Math.floor(this.cfg.lifeMs * 1.2) : this.cfg.lifeMs;
      setTimeout(()=>{ if(e.parentNode){
        e.remove(); this.st.combo=1;
        // ใน easy เราไม่หักพลังเมื่อพลาด (missHP=0) แต่โหมดอื่นยังทำงานปกติ
        if(!this.kid) this.takeDamage(this.cfg.missHP, (this.dict && this.dict['miss'])||'Miss');
        this.updateHUD();
      } }, lifeMs);

      sp.appendChild(e);
    },
    spawnMiniBoss:function(){
      const b={ hp:140, el:document.createElement('a-entity') };
      b.el.setAttribute('geometry','primitive: icosahedron; radius: 0.6');
      b.el.setAttribute('material','color:#17394a; emissive:#0ff; metalness:0.2; roughness:0.2');
      b.el.setAttribute('position',{x:0,y:1.6,z:-2.6}); b.el.classList.add('boss');
      qs('#spawner').appendChild(b.el); this.st.boss=b; toast(T(this.dict,'missionBoss','Mini Boss!'));

      const atk=()=>{ if(!this.st.boss||!this.st.playing||this.st.hp<=0) return;
        const dmg=this.cfg.bossHit + Math.floor(this.st.overload/50);
        this.takeDamage(dmg,T(this.dict,'bossAttack','Boss attack'));
        if(this.st.hp>0 && this.st.boss) setTimeout(atk, this.kid ? 2200 : 1800); // ช้าลงใน easy
      };
      setTimeout(atk, this.kid ? 1600 : 1200); // เริ่มช้าลงใน easy
    },

    /* ========== MODE 2: DASH (Cardio – Jump/Crouch) ========== */
    tickDash:function(now,dt){
      // กระโดด/ย่อ
      if(this.st.jumpT>0){ this.st.jumpT=Math.max(0,this.st.jumpT-dt); }
      const rig=$('#rig'); if(rig){ const base=1.6; const y = (this.st.jumpT>0) ? base + 0.4*Math.sin((0.6-this.st.jumpT)/0.6*Math.PI) : base - (this.st.crouch?0.35:0); rig.setAttribute('position',`0 ${y.toFixed(3)} 0`); }
      // spawn bars
      if(now-this.st.spawnTimer>Math.max(650,this.cfg.spawnMs)){ this.st.spawnTimer=now; this.spawnDashBar(); }
      // move & collide
      document.querySelectorAll('.hazard').forEach(h=>{
        const z=Number(h.dataset.z||-3); const speed=1.8; const nz=z+speed*dt; h.dataset.z=nz;
        h.setAttribute('position',`0 0 ${nz.toFixed(3)}`);
        if(nz>-0.2 && !h.dataset.hit){
          h.dataset.hit='1';
          const type=h.dataset.type; // low/high/mid
          const ok = (type==='low'  && this.st.jumpT>0) ||
                     (type==='high' && this.st.crouch) ||
                     (type==='mid'  && !this.st.crouch && this.st.jumpT<=0);
          if(ok){ this.st.score+=120; this.st.combo=Math.min(20,this.st.combo+1); SFX.ok(); }
          else { this.st.combo=1; this.takeDamage(this.cfg.missHP,'Dash Miss'); SFX.warn(); }
          setTimeout(()=>{ try{h.remove();}catch(_){ } }, 50);
        }
      });
    },
    spawnDashBar:function(){
      const e=document.createElement('a-entity'); e.classList.add('hazard');
      const r=Math.random(); const type = r<0.33?'low':(r<0.66?'high':'mid'); e.dataset.type=type; e.dataset.z=-3.2;
      let y=1.0, h=0.3;
      if(type==='low'){ y=0.3; h=0.3; }      // ต้องกระโดด
      else if(type==='high'){ y=1.35; h=0.3;} // ต้องย่อ
      else { y=0.8; h=0.5; }                  // ยืนปกติ
      e.setAttribute('geometry',`primitive: box; width: 2.2; height:${h}; depth:0.2`);
      e.setAttribute('material','color:#8bd8ff; emissive:#3cf; opacity:0.8; transparent:true');
      e.setAttribute('position',`0 ${y} -3.2`);
      qs('#spawner').appendChild(e);
    },

    /* ========== MODE 3: IMPACT (Strength – Charge & Release) ========== */
    tickImpact:function(now,dt){
      if(!this._impactAlive){ this.spawnImpactCore(); }
      if(this.st.chargeStart>0){
        const t=(now-this.st.chargeStart)/1000; const pct=Math.min(100,Math.round(t/2*100));
        $('hudArcane').textContent=`CHARGE: ${pct}%`;
      }
    },
    spawnImpactCore:function(){
      const e=document.createElement('a-entity');
      e.setAttribute('geometry','primitive: dodecahedron; radius:0.6');
      e.setAttribute('material','color:#ffb36b; emissive:#f80; metalness:0.2; roughness:0.2');
      e.setAttribute('position','0 1.3 -2.2'); e.classList.add('impact-core');
      this._impactAlive=true; qs('#spawner').appendChild(e);
      $('objective').textContent='ชาร์จให้เต็มแล้วปล่อยทำลายแกนพลัง (0–2s)';
    },
    releaseImpact:function(){
      if(!this._impactAlive) return;
      const e=qs('.impact-core'); if(!e) return;
      const held = this.st.chargeStart>0 ? (performance.now()-this.st.chargeStart)/1000 : 0;
      this.st.chargeStart=0;
      const clamped=Math.max(0,Math.min(2,held));
      const dmg=Math.round(200*clamped); // 0–400 score
      this.st.score+=dmg; this.st.combo=Math.min(20,this.st.combo+1);
      try{ e.remove(); }catch(_){}
      this._impactAlive=false; $('objective').textContent='ดีมาก! สร้างแกนถัดไป...';
      SFX.ok();
      setTimeout(()=>this.spawnImpactCore(), 800);
    },

    /* ========== MODE 4: FLOW (Rhythm – A/S/D) ========== */
    tickFlow:function(now,dt){
      if(!this.st.flowNext) this.st.flowNext=now+800;
      if(now>=this.st.flowNext){
        const lanes=['A','S','D']; const L=lanes[Math.floor(Math.random()*lanes.length)];
        this.spawnFlowNote(L, now);
        this.st.flowNext = now + 900; // 0.9s ต่อโน้ต (เริ่มง่าย)
      }
      document.querySelectorAll('.flow-note').forEach(n=>{
        const born=Number(n.dataset.t0||0); const age=now-born; const life=900;
        const y = Math.min(100, (age/life)*100);
        n.style.top = (10+y*0.6)+'%';
        if(age>life+200){ n.remove(); this.st.combo=1; this.takeDamage(0.5,'Late'); }
      });
    },
    spawnFlowNote:function(lane, now){
      let wrap=$('#flowWrap');
      if(!wrap){
        wrap=document.createElement('div'); wrap.id='flowWrap';
        wrap.style.position='fixed'; wrap.style.left='50%'; wrap.style.transform='translateX(-50%)';
        wrap.style.top='12%'; wrap.style.zIndex='10006'; wrap.style.pointerEvents='none'; wrap.style.width='360px';
        wrap.innerHTML=`<div style="display:flex;gap:14px;justify-content:center">
          <div class="badge">A</div><div class="badge">S</div><div class="badge">D</div>
        </div>`;
        document.body.appendChild(wrap);
      }
      const n=document.createElement('div'); n.className='flow-note badge'; n.dataset.t0=String(now); n.dataset.key=lane;
      n.style.position='absolute'; n.style.left = lane==='A'?'20%':(lane==='S'?'45%':'70%'); n.style.top='10%';
      n.style.background='rgba(0,0,0,.55)'; n.style.border='1px solid #49b'; n.textContent=lane;
      wrap.appendChild(n);
      $('objective').textContent='กด A/S/D ให้ตรงกับสัญลักษณ์ตกลงมา';
    },
    checkFlowHit:function(key){
      const notes=[...document.querySelectorAll('.flow-note')].filter(n=>n.dataset.key===key);
      if(!notes.length) return;
      notes.sort((a,b)=>parseFloat(b.style.top)-parseFloat(a.style.top));
      const n=notes[0]; const now=performance.now(); const born=Number(n.dataset.t0||0);
      const age=now-born; const life=900; const delta=Math.abs(age-life);
      if(delta<=200){
        this.st.score += delta<80 ? 150 : 100;
        this.st.combo = Math.min(20, this.st.combo+1);
        SFX.hit(); n.remove();
      }else{
        this.st.combo=1; this.takeDamage(0.3,'Off-beat'); SFX.warn();
      }
    },

    /* ===== End / Manual Ray (combat uses) ===== */
    endGame:function(){ this.st.playing=false; toast(`${T(this.dict,'finished','Finished')} • ${T(this.dict,'score','Score')}: ${this.st.score}`,2000); },
    manualRay:function(evt){
      if(this.game!=='combat') return; // ยิงเฉพาะโหมด combat
      const sceneEl=qs('a-scene'), camEl=$('camera');
      const renderer=sceneEl && sceneEl.renderer, camera=camEl && camEl.getObject3D('camera');
      if(!renderer||!camera||!this.st.playing) return;
      const rect=renderer.domElement.getBoundingClientRect();
      const mouse=new THREE.Vector2(((evt.clientX-rect.left)/rect.width)*2-1,-((evt.clientY-rect.top)/rect.height)*2+1);
      const raycaster=new THREE.Raycaster(); raycaster.setFromCamera(mouse,camera);
      const nodes=Array.from(document.querySelectorAll('.clickable')).map(el=>el.object3D).filter(Boolean);
      const hits=raycaster.intersectObjects(nodes,true);
      if(hits.length){ let obj=hits[0].object; while(obj && !obj.el) obj=obj.parent; if(obj && obj.el) obj.el.emit('click'); }
      else{ this.takeDamage(this.cfg.clickMissHP,T(this.dict,'reflect','Reflect')); }
    },

    // ===== Tutorial (เฉพาะ combat) =====
    showCombatTutorial:function(){
      try{
        const el=document.createElement('div');
        el.id='tutorialTip';
        el.style.position='fixed';
        el.style.left='50%'; el.style.top='14%';
        el.style.transform='translateX(-50%)';
        el.style.zIndex='10010';
        el.style.background='rgba(0,0,0,.65)';
        el.style.border='1px solid rgba(255,255,255,.15)';
        el.style.padding='10px 14px';
        el.style.borderRadius='12px';
        el.style.color='#cfefff';
        el.style.fontWeight='700';
        el.style.letterSpacing='.3px';
        el.textContent='คลิกเป้าพลังเพื่อเก็บคะแนน • โหมด Easy: เป้าใหญ่ขึ้น อยู่ทนนาน และ ENERGY ฟื้นทีละนิด';
        document.body.appendChild(el);
        setTimeout(()=>{ el.style.opacity='0'; }, 18000);
        setTimeout(()=>{ try{el.remove();}catch(_){ } }, 20000);
      }catch(_){}
    }
  });
})();
