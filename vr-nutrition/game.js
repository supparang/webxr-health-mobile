AFRAME.registerComponent('button', {
  schema: { label:{type:'string'}, color:{type:'string', default:'#3DDC84'}, action:{type:'string'} },
  init: function(){
    const el=this.el, d=this.data;
    const bg=document.createElement('a-plane'); bg.setAttribute('width','1.9'); bg.setAttribute('height','0.36');
    bg.setAttribute('color',d.color); bg.setAttribute('opacity','0.98'); bg.setAttribute('material','shader: flat'); bg.classList.add('clickable');
    const tx=document.createElement('a-text'); tx.setAttribute('value',d.label); tx.setAttribute('align','center'); tx.setAttribute('width','1.8'); tx.setAttribute('color','#fff'); tx.setAttribute('position','0 0 0.01');
    el.appendChild(bg); el.appendChild(tx);
    const press=()=>el.object3D.scale.set(0.95,0.95,0.95); const rel=()=>el.object3D.scale.set(1,1,1);
    el.addEventListener('mousedown',press); el.addEventListener('mouseup',rel);
    el.addEventListener('mouseenter',()=>document.body.style.cursor='pointer'); el.addEventListener('mouseleave',()=>document.body.style.cursor='default');
    el.addEventListener('click',()=>el.sceneEl.emit('ui-action',{action:d.action}));
  }
});

AFRAME.registerComponent('food-item', {
  schema:{ kind:{default:'healthy'}, label:{default:''}, meta:{default:''} },
  init: function(){
    const el=this.el, d=this.data;
    const base=document.createElement('a-cylinder'); base.setAttribute('radius','0.18'); base.setAttribute('height','0.05'); base.setAttribute('color', d.kind==='healthy' ? '#C9FCE1' : '#FFD6D6');
    const body=document.createElement('a-sphere'); body.setAttribute('radius','0.14'); body.setAttribute('position','0 0.16 0'); body.setAttribute('color', d.kind==='healthy' ? '#3DDC84' : '#FF6B6B');
    const tx=document.createElement('a-text'); tx.setAttribute('value', d.label || (d.kind==='healthy' ? 'อาหารสุขภาพ' : 'อาหารขยะ')); tx.setAttribute('width','0.9'); tx.setAttribute('align','center'); tx.setAttribute('color','#1A202C'); tx.setAttribute('position','0 0.34 0');
    el.appendChild(base); el.appendChild(body); el.appendChild(tx);
    el.classList.add('clickable');
    el.addEventListener('click', ()=> el.sceneEl.emit('food-picked', { kind:d.kind, label:d.label, entity:el, meta:d.meta }));
  }
});

AFRAME.registerComponent('game-manager', {
  init: function(){
    const scene=this.el;
    this.hudText=document.getElementById('hudText'); this.splash=document.getElementById('splash');
    this.howto=document.getElementById('howto'); this.howBody=document.getElementById('howBody');
    this.result=document.getElementById('result'); this.resultBody=document.getElementById('resultBody'); this.resultTitle=document.getElementById('resultTitle');
    this.settings=document.getElementById('settings'); this.gameRoot=document.getElementById('gameRoot'); this.spawnArea=document.getElementById('spawnArea');
    this.gameTitle=document.getElementById('gameTitle'); this.pauseBtn=document.getElementById('pauseBtn');

    this.mode=null; this.state='splash'; this.score=0; this.timeLeft=60;
    this.timerId=null; this.spawnInterval=null; this.selectedItem=null; this.selectedEntity=null; this.totalKcal=0; this.paused=false;

    this.dataLib = {
      healthy: ['ผักสลัด','แอปเปิล','นมจืด','ปลาอบ','เต้าหู้','ข้าวกล้อง','กล้วย','แกงจืด','ถั่วลิสง','โยเกิร์ตรสธรรมชาติ'],
      junk: ['น้ำอัดลม','เฟรนช์ฟรายส์','โดนัท','ไส้กรอกทอด','มันฝรั่งแผ่น','เค้กครีม','ชานมไข่มุกหวานจัด','ไอศกรีม','คุกกี้เนย','น้ำหวานสีสด'],
      groups: {'ข้าว-แป้ง':['ข้าวกล้อง','ขนมปังโฮลวีต','ข้าวโอ๊ต'],'ผัก':['คะน้า','ผักกาดหอม','แครอท'],'ผลไม้':['กล้วย','แอปเปิล','ส้ม'],'นม':['นมจืด','โยเกิร์ตรสธรรมชาติ','ชีสพาสเจอไรส์ไขมันต่ำ'],'เนื้อ/ถั่ว':['อกไก่ย่าง','ปลาอบ','เต้าหู้']},
      labels: [
        { name:'ซีเรียลกรุบกรอบ', kcal:180, sugar_g:12, sodium_mg:190, q:'น้ำตาลจัดหรือไม่?', ans:'ใช่'},
        { name:'นมจืด 200ml', kcal:130, sugar_g:9, sodium_mg:120, q:'โซเดียมสูงกว่า 200mg หรือไม่?', ans:'ไม่ใช่'},
        { name:'ขนมมันฝรั่ง 1 ซอง', kcal:250, sugar_g:2, sodium_mg:270, q:'โซเดียมสูงหรือไม่?', ans:'ใช่'},
        { name:'โยเกิร์ตรสหวาน 1 ถ้วย', kcal:160, sugar_g:18, sodium_mg:75, q:'น้ำตาลมากกว่า 15g หรือไม่?', ans:'ใช่'}
      ],
      kcalMenu: [
        { label:'ข้าวกล้อง 1 ทัพพี', kcal:120 },{ label:'อกไก่ย่าง 100g', kcal:165 },{ label:'ปลาอบ 100g', kcal:140 },{ label:'สลัดผัก', kcal:90 },{ label:'กล้วย 1 ผล', kcal:105 },{ label:'แอปเปิล 1 ผล', kcal:95 },{ label:'นมจืด 1 แก้ว', kcal:130 },{ label:'โยเกิร์ตรสธรรมชาติ', kcal:100 },{ label:'น้ำอัดลม 1 แก้ว', kcal:140 },{ label:'เฟรนช์ฟรายส์ ถุงเล็ก', kcal:220 }
      ]
    };

    scene.addEventListener('ui-action', (e)=> this.onAction(e.detail.action));
    scene.addEventListener('food-picked', (e)=> this.onFoodPicked(e));

    this.pauseBtn.addEventListener('click', ()=> this.togglePause());

    this.updateHUD(true); this.showSplash();
  },

  onAction: function(a){
    if(a==='how') return this.showHow();
    if(a==='settings') return this.showSettings();
    if(a==='back') return this.showSplash();
    if(a==='replay') return this.startMode(this.mode);
    if(a==='pause') return this.togglePause();
    if(['modeA','modeB','modeC','modeD'].includes(a)){ this.mode = a.slice(-1).toUpperCase(); this.startMode(this.mode); return; }
    if(a && a.startsWith('bin:')){ const group=a.split(':')[1]; if(this.state==='playing' && this.mode==='B' && this.selectedItem){ const ok=(this.selectedItem.meta===group); this.applyScore(ok?+10:-5); this.flash(this.selectedEntity, ok?'#8EFFC1':'#FFC9C9'); this.clearSelected(); } }
    if(a && a.startsWith('label:')){ if(this.state==='playing' && this.mode==='C'){ const ans=a.split(':')[1]; const correct=(ans===this.currentLabel.ans); this.applyScore(correct?+10:-5); this.nextLabelQuiz(); } }
    if(a && a.startsWith('kcal:')){ if(this.state==='playing' && this.mode==='D'){ const idx=Number(a.split(':')[1]); const item=this.dataLib.kcalMenu[idx]; this.totalKcal+=item.kcal; this.updateHUD(); } }
    if(a==='kcal-end' && this.mode==='D'){ this.endCalorie(); }
  },

  onFoodPicked: function(e){
    if(this.state!=='playing') return;
    if(this.mode==='A'){ const kind=e.detail.kind; const target=e.detail.entity; this.applyScore(kind==='healthy'?+10:-5); this.flash(target, kind==='healthy'?'#8EFFC1':'#FFC9C9'); target.parentNode && target.parentNode.removeChild(target); }
    else if(this.mode==='B'){ this.clearSelected(); this.selectedItem=e.detail; this.selectedEntity=e.detail.entity; this.highlightEntity(this.selectedEntity,true); }
  },

  showSplash: function(){ this.state='splash'; this.paused=false; this.stopAllTimers(); this.clearArea(); this.splash.setAttribute('visible',true); this.howto.setAttribute('visible',false); this.result.setAttribute('visible',false); this.settings.setAttribute('visible',false); this.gameRoot.setAttribute('visible',false); this.updateHUD(true); },
  showHow: function(){ this.splash.setAttribute('visible',false); this.result.setAttribute('visible',false); this.settings.setAttribute('visible',false); this.gameRoot.setAttribute('visible',false); this.howto.setAttribute('visible',true); this.howBody.setAttribute('value','• โหมด A: เลือกเฉพาะอาหารสุขภาพ (+10) เลี่ยงอาหารขยะ (−5) ภายใน 60 วินาที\\n• โหมด B: คลิกเลือกอาหาร แล้วคลิก “ถังหมวดหมู่” ที่ถูกต้อง (+10/−5)\\n• โหมด C: อ่านฉลาก แล้วตอบ ใช่/ไม่ใช่ (+10/−5)\\n• โหมด D: เลือกเมนูให้รวม ~1800–2000 kcal แล้วกด “สรุปแคลอรี่”'); },
  showSettings: function(){ this.splash.setAttribute('visible',false); this.howto.setAttribute('visible',false); this.result.setAttribute('visible',false); this.gameRoot.setAttribute('visible',false); this.settings.setAttribute('visible',true); },

  startMode: function(mode){
    this.state='playing'; this.paused=false; this.score=0; this.timeLeft=60; this.updateHUD();
    this.splash.setAttribute('visible',false); this.howto.setAttribute('visible',false); this.result.setAttribute('visible',false); this.settings.setAttribute('visible',false); this.gameRoot.setAttribute('visible',true);
    this.clearArea(); this.stopAllTimers();
    if(mode==='A'){ this.gameTitle.setAttribute('value','โหมด A: เลือกอาหารสุขภาพ'); this.startTimer(); this.spawnModeA(); }
    if(mode==='B'){ this.gameTitle.setAttribute('value','โหมด B: จัดหมวดหมู่ 5 หมู่'); this.setupGroupBins(); this.startTimer(); this.spawnGroupItems(); }
    if(mode==='C'){ this.gameTitle.setAttribute('value','โหมด C: อ่านฉลากโภชนาการ'); this.setupLabelQuiz(); this.startTimer(); this.nextLabelQuiz(); }
    if(mode==='D'){ this.gameTitle.setAttribute('value','โหมด D: วางแผนแคลอรี่รายวัน (~1800–2000 kcal)'); this.totalKcal=0; this.setupCaloriePlanner(); }
  },
  endGame: function(){ this.state='result'; this.stopAllTimers(); this.gameRoot.setAttribute('visible',false); const stars=this.calcStars(this.score); const starStr='★'.repeat(stars)+'☆'.repeat(3-stars); this.resultTitle.setAttribute('value','สรุปผล'); this.resultBody.setAttribute('value',`คะแนน: ${this.score}\\nดาว: ${starStr}`); this.result.setAttribute('visible',true); },

  togglePause: function(){ if(this.state!=='playing') return; this.paused=!this.paused; const btn=this.pauseBtn.querySelector('a-text'); btn && btn.setAttribute('value', this.paused ? 'เล่นต่อ' : 'หยุดชั่วคราว'); if(this.paused){ this.stopTimerOnly(); this.stopSpawnOnly(); } else { this.startTimer(); if(this.mode==='A'){ this.spawnModeA(); } } },

  startTimer: function(){ this.stopTimerOnly(); this.timerId=setInterval(()=>{ if(this.paused) return; if(this.timeLeft<=0){ this.endGame(); return; } this.timeLeft--; this.updateHUD(); },1000); },
  stopAllTimers: function(){ this.stopTimerOnly(); this.stopSpawnOnly(); },
  stopTimerOnly: function(){ if(this.timerId){ clearInterval(this.timerId); this.timerId=null; } },
  stopSpawnOnly: function(){ if(this.spawnInterval){ clearInterval(this.spawnInterval); this.spawnInterval=null; } },
  updateHUD: function(){ const extra=(this.mode==='D')? `  แคลอรี่รวม: ${this.totalKcal} kcal` : ''; this.hudText.setAttribute('value', `โหมด: ${this.mode||'-'}  คะแนน: ${this.score}  เวลา: ${this.timeLeft}s${extra}`); },

  spawnModeA: function(){
    const spawnOnce=()=>{ if(this.state!=='playing'||this.mode!=='A'||this.paused) return; const healthy=Math.random()<0.6; const label=healthy? this.pick(this.dataLib.healthy): this.pick(this.dataLib.junk); const ent=document.createElement('a-entity'); ent.setAttribute('food-item', { kind: healthy?'healthy':'junk', label }); const p=this.randomPos(1.8,1.0); ent.setAttribute('position', `${p.x} 0 ${p.z}`); this.spawnArea.appendChild(ent); setTimeout(()=>{ ent.parentNode && ent.parentNode.removeChild(ent); },6000); };
    this.stopSpawnOnly(); this.spawnInterval=setInterval(()=>{ spawnOnce(); if(Math.random()<0.45) spawnOnce(); },1200);
  },

  setupGroupBins: function(){ const groups=Object.keys(this.dataLib.groups); const startX=-1.6, gap=0.8; groups.forEach((g,i)=>{ const bin=document.createElement('a-box'); bin.setAttribute('width','0.7'); bin.setAttribute('height','0.32'); bin.setAttribute('depth','0.7'); bin.setAttribute('color','#E0EDFF'); bin.setAttribute('position', `${startX + i*gap} 0.05 0.9`); const label=document.createElement('a-text'); label.setAttribute('value', g); label.setAttribute('align','center'); label.setAttribute('width','0.95'); label.setAttribute('color','#1E40AF'); label.setAttribute('position','0 0.26 0.31'); const btn=document.createElement('a-entity'); btn.classList.add('clickable','button'); btn.setAttribute('position','0 0.18 0.31'); btn.setAttribute('button', `label: วางที่นี่; color:#4F86F7; action: bin:${g}`); bin.appendChild(label); bin.appendChild(btn); this.spawnArea.appendChild(bin); }); },
  spawnGroupItems: function(){ const pool=[].concat(...Object.entries(this.dataLib.groups).map(([grp,items])=>items.map(it=>({grp,it})))); pool.forEach((obj,idx)=>{ const ent=document.createElement('a-entity'); ent.setAttribute('food-item',{kind:'group',label:obj.it,meta:obj.grp}); const p=this.randomPos(1.8,0.45); ent.setAttribute('position', `${p.x} 0 ${-0.3 + (idx%3)*0.3}`); this.spawnArea.appendChild(ent); }); },
  clearSelected: function(){ if(this.selectedEntity){ this.highlightEntity(this.selectedEntity,false); } this.selectedItem=null; this.selectedEntity=null; },
  highlightEntity: function(ent,on){ ent.setAttribute('scale', on?'1.2 1.2 1.2':'1 1 1'); },

  setupLabelQuiz: function(){ const panel=document.createElement('a-plane'); panel.setAttribute('width','3.1'); panel.setAttribute('height','1.25'); panel.setAttribute('color','#fff'); panel.setAttribute('position','0 0.45 0'); this.spawnArea.appendChild(panel); const title=document.createElement('a-text'); title.setAttribute('value','ฉลากโภชนาการ'); title.setAttribute('align','center'); title.setAttribute('width','2.8'); title.setAttribute('color','#3DDC84'); title.setAttribute('position','0 0.45 0.01'); panel.appendChild(title); const body=document.createElement('a-text'); body.setAttribute('id','labelBody'); body.setAttribute('value','-'); body.setAttribute('align','left'); body.setAttribute('width','2.8'); body.setAttribute('color','#1A202C'); body.setAttribute('position','-1.4 0.1 0.01'); panel.appendChild(body); const btnY=document.createElement('a-entity'); btnY.classList.add('clickable','button'); btnY.setAttribute('position','-0.6 -0.35 0.02'); btnY.setAttribute('button','label: ใช่; color:#3DDC84; action: label:ใช่'); panel.appendChild(btnY); const btnN=document.createElement('a-entity'); btnN.classList.add('clickable','button'); btnN.setAttribute('position','0.6 -0.35 0.02'); btnN.setAttribute('button','label: ไม่ใช่; color:#FF6B6B; action: label:ไม่ใช่'); panel.appendChild(btnN); this.labelBody=body; },
  nextLabelQuiz: function(){ const item=this.pick(this.dataLib.labels); this.currentLabel=item; const txt=`สินค้า: ${item.name}\\nพลังงาน: ${item.kcal} kcal  น้ำตาล: ${item.sugar_g} g  โซเดียม: ${item.sodium_mg} mg\\nคำถาม: ${item.q}`; this.labelBody.setAttribute('value',txt); },

  setupCaloriePlanner: function(){ const inst=document.createElement('a-text'); inst.setAttribute('value','เป้าหมาย: รวม ~1800–2000 kcal แล้วกดสรุป'); inst.setAttribute('align','center'); inst.setAttribute('width','3.4'); inst.setAttribute('color','#1E40AF'); inst.setAttribute('position','0 0.65 0.01'); this.spawnArea.appendChild(inst); this.dataLib.kcalMenu.forEach((item,idx)=>{ const btn=document.createElement('a-entity'); btn.classList.add('clickable','button'); const col=item.kcal<=140?'#3DDC84':(item.kcal<=180?'#4F86F7':'#FF9F1C'); btn.setAttribute('button', `label: ${item.label} (+${item.kcal} kcal); color:${col}; action: kcal:${idx}`); const row=Math.floor(idx/2), colx=(idx%2===0)? -0.7:0.7; btn.setAttribute('position', `${colx} ${0.35 - row*0.25} 0.01`); this.spawnArea.appendChild(btn); }); const sumBtn=document.createElement('a-entity'); sumBtn.classList.add('clickable','button'); sumBtn.setAttribute('button','label: สรุปแคลอรี่; color:#9B59B6; action: kcal-end'); sumBtn.setAttribute('position','0 -0.6 0.01'); this.spawnArea.appendChild(sumBtn); this.updateHUD(); },
  endCalorie: function(){ const center=1900, diff=Math.abs(this.totalKcal-center); if(diff<=100) this.applyScore(+30); else if(diff<=250) this.applyScore(+15); this.endGame(); },

  applyScore: function(delta){ this.score+=delta; this.updateHUD(); },
  calcStars: function(score){ if(score>=120) return 3; if(score>=70) return 2; if(score>=30) return 1; return 0; },
  flash: function(entity,color){ const old=entity.getAttribute('material')?.color || '#FFFFFF'; entity.setAttribute('material',`color:${color}`); setTimeout(()=>entity.setAttribute('material',`color:${old}`),150); },
  randomPos: function(w,d){ return { x:(Math.random()* (w*2) - w), z:(Math.random()* (d*2) - d) }; },
  clearArea: function(){ while(this.spawnArea.firstChild){ this.spawnArea.removeChild(this.spawnArea.firstChild); } },
  pick: function(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
});

document.addEventListener('DOMContentLoaded', ()=>{ document.querySelector('a-scene').setAttribute('game-manager',''); });
