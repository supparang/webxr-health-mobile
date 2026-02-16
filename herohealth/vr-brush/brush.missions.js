// === /herohealth/vr-brush/brush.missions.js ===
// Daily Missions v20260216c
// Stores: HHA_DAILY_MISSIONS::YYYY-MM-DD + emits hha:mission

(function(){
  'use strict';
  const WIN = window, DOC = document;
  const $id = (id)=>DOC.getElementById(id);

  function ymd(){
    const d = new Date();
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,'0');
    const day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function emit(detail){
    try{ WIN.dispatchEvent(new CustomEvent('hha:mission', { detail })); }catch(_){}
  }

  const KEY = `HHA_DAILY_MISSIONS::${ymd()}`;
  const DEF = [
    { id:'brush_play',     title:'เล่นให้จบ 1 รอบ', done:false, type:'play' },
    { id:'brush_acc_70',   title:'Accuracy ≥ 70%', done:false, type:'acc', v:70 },
    { id:'brush_combo_12', title:'Max Combo ≥ 12', done:false, type:'combo', v:12 },
    { id:'brush_clean_85', title:'Clean ≥ 85%', done:false, type:'clean', v:85 }
  ];

  const M = {
    data: null,
    load(){
      try{
        const raw = localStorage.getItem(KEY);
        if(raw){ this.data = JSON.parse(raw); return; }
      }catch(_){}
      this.data = { date: ymd(), items: DEF };
      this.save();
    },
    save(){
      try{ localStorage.setItem(KEY, JSON.stringify(this.data)); }catch(_){}
    },
    ensurePanel(){
      let el = $id('br-missions');
      if(el) return el;

      el = DOC.createElement('section');
      el.id = 'br-missions';
      el.style.position='fixed';
      el.style.right='12px';
      el.style.bottom='12px';
      el.style.zIndex='58';
      el.style.width='min(360px, 92vw)';
      el.style.border='1px solid rgba(148,163,184,.18)';
      el.style.borderRadius='20px';
      el.style.padding='10px 12px';
      el.style.background='rgba(2,6,23,.72)';
      el.style.backdropFilter='blur(10px)';
      el.style.boxShadow='0 18px 60px rgba(0,0,0,.35)';
      el.style.pointerEvents='none';

      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div style="font-weight:950;">🎯 Daily Missions</div>
          <div id="br-mis-p" style="color:rgba(148,163,184,1);font-size:12px;font-weight:900;">0/0</div>
        </div>
        <div id="br-mis-list" style="margin-top:8px;display:flex;flex-direction:column;gap:6px;"></div>
      `;
      DOC.body.appendChild(el);
      return el;
    },
    render(){
      this.ensurePanel();
      const list = $id('br-mis-list');
      const p = $id('br-mis-p');
      if(!list || !p) return;

      const items = this.data?.items || [];
      list.innerHTML = items.map(it=>{
        const ok = it.done;
        return `
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:18px;text-align:center;">${ok?'✅':'⬜'}</div>
            <div style="flex:1;min-width:0;color:rgba(229,231,235,.92);font-size:13px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${it.title}
            </div>
          </div>
        `;
      }).join('');

      const done = items.filter(x=>x.done).length;
      p.textContent = `${done}/${items.length}`;
    },
    mark(id){
      const it = (this.data?.items||[]).find(x=>x.id===id);
      if(!it || it.done) return;
      it.done = true;
      this.save();
      this.render();
      emit({ game:'brush', date:this.data.date, missionId:id, title:it.title, ts:Date.now() });
    },
    onEnd(summary){
      this.mark('brush_play');

      const acc = Number(summary?.accuracyPct||0);
      const clean = Number(summary?.cleanPct||0);
      const combo = Number(summary?.comboMax||0);

      if(acc >= 70) this.mark('brush_acc_70');
      if(combo >= 12) this.mark('brush_combo_12');
      if(clean >= 85) this.mark('brush_clean_85');

      // if all done => store flag for HUB
      const items = this.data.items || [];
      if(items.length && items.every(x=>x.done)){
        try{ localStorage.setItem(`HHA_MISSIONS_DONE::hygiene::${this.data.date}`, '1'); }catch(_){}
      }
    }
  };

  M.load();
  M.render();

  WIN.addEventListener('hha:end', (ev)=>{
    const sum = ev?.detail || {};
    if(String(sum.game)!=='brush') return;
    M.onEnd(sum);
  });

})();