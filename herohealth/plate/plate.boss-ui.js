// === /herohealth/plate/plate.boss-ui.js ===
// PlateVR Boss HUD — PRODUCTION
// - Listens: hha:judge {type:'boss', on, seq, pos, reset, cleared}
// - Shows sequence steps + progress dots
// - No dependency. Safe to load defer.

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!WIN || !DOC) return;

  const EMO = ['🍚','🥦','🍖','🥛','🍌'];

  function ensure(){
    let root = DOC.getElementById('bossHud');
    if(root) return root;

    root = DOC.createElement('div');
    root.id = 'bossHud';
    root.innerHTML = `
      <div class="panel">
        <div class="row">
          <div class="title">
            <span class="tag">🧟‍♂️ BOSS</span>
            <span class="hint" id="bossHint">จัดตามลำดับให้ถูก</span>
          </div>
          <div class="hint" id="bossMini">แตะให้ตรงลำดับ</div>
        </div>

        <div class="seq" id="bossSeq"></div>
        <div class="dots" id="bossDots"></div>
      </div>
    `;
    DOC.body.appendChild(root);
    return root;
  }

  function setOn(on){
    const root = ensure();
    root.classList.toggle('on', !!on);
    if(!on) root.classList.remove('panic');
  }

  function render(seq, pos){
    const root = ensure();
    const seqEl  = root.querySelector('#bossSeq');
    const dotsEl = root.querySelector('#bossDots');
    if(!seqEl || !dotsEl) return;

    seqEl.innerHTML = '';
    dotsEl.innerHTML = '';

    const n = (seq && seq.length) ? seq.length : 0;

    for(let i=0;i<n;i++){
      const gi = Number(seq[i])|0;
      const step = DOC.createElement('div');
      step.className = 'bossStep';
      step.textContent = EMO[gi] || '🍽️';

      if(i < pos) step.classList.add('done');
      if(i === pos) step.classList.add('need');

      seqEl.appendChild(step);

      const dot = DOC.createElement('div');
      dot.className = 'dot';
      if(i < pos) dot.classList.add('done');
      if(i === pos) dot.classList.add('now');
      dotsEl.appendChild(dot);
    }
  }

  function panicFlash(){
    const root = ensure();
    root.classList.add('panic');
    clearTimeout(WIN.__HHA_BOSS_PANIC_TO__);
    WIN.__HHA_BOSS_PANIC_TO__ = setTimeout(()=>root.classList.remove('panic'), 450);
  }

  WIN.addEventListener('hha:judge', (e)=>{
    const d = e.detail || {};
    if(d.type !== 'boss') return;

    if(d.on === false){
      setOn(false);
      return;
    }
    if(d.on === true){
      setOn(true);
      if(Array.isArray(d.seq)) render(d.seq, Number(d.pos||0));
      else if(typeof d.pos === 'number') render((WIN.__HHA_BOSS_SEQ__||[]), Number(d.pos||0));
      if(d.reset) panicFlash();
      if(d.cleared){
        // keep briefly then hide
        setTimeout(()=>setOn(false), 900);
      }
      if(Array.isArray(d.seq)) WIN.__HHA_BOSS_SEQ__ = d.seq;
      return;
    }
  });
})();