/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.toothpaste-prep-restore.js
 * PATCH v20260518-P56-BRUSH-KIDS-TOOTHPASTE-PREP-RESTORE
 *
 * Purpose:
 * - เอาขั้น “ใส่ยาสีฟัน” กลับมาใน Prep
 * - ห้ามเริ่มแปรงจนกว่าจะใส่ยาสีฟันพอดี
 * - ถ้าใส่น้อยไป/มากไป ต้องบอกเด็กชัด ๆ
 * - ใช้คู่กับ P55 แต่ต้องโหลดก่อน P55
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const PATCH_ID = 'v20260518-P56-BRUSH-KIDS-TOOTHPASTE-PREP-RESTORE';

  let pasteAmount = 0;
  let pasteReady = false;
  let pasteTooMuch = false;
  let started = false;

  const MIN_READY = 65;
  const MAX_READY = 105;
  const TOO_MUCH = 125;

  function $(id){
    return DOC.getElementById(id);
  }

  function text(el){
    try{ return el ? String(el.textContent || '').trim() : ''; }
    catch(_){ return ''; }
  }

  function isSummaryOpen(){
    const modal = $('summaryModal');
    if(!modal || modal.hidden) return false;

    try{
      const cs = WIN.getComputedStyle(modal);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    }catch(_){
      return true;
    }
  }

  function isPrepStage(){
    if(isSummaryOpen()) return false;
    if(started) return false;

    const body = DOC.body;
    const stage =
      body && body.getAttribute('data-brush-flow-stage') ||
      DOC.documentElement.getAttribute('data-brush-flow-stage') ||
      '';

    const scoreText = text($('scoreText'));
    const cleanText = text($('cleanText'));
    const zoneText = text($('zoneText'));

    const score = Number((scoreText.match(/\d+/) || ['0'])[0]) || 0;
    const clean = Number((cleanText.match(/\d+/) || ['0'])[0]) || 0;
    const zone = Number((zoneText.match(/\d+/) || ['0'])[0]) || 0;

    if(stage === 'prep') return true;
    if(score <= 0 && clean <= 0 && zone <= 0) return true;

    return false;
  }

  function ensureStyle(){
    if($('hha-toothpaste-prep-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-toothpaste-prep-style';
    style.textContent = `
      #hhaToothpastePrepCard{
        border-radius:26px;
        border:3px solid #bbf7d0;
        background:linear-gradient(180deg,#f0fdf4,#ffffff);
        padding:14px;
        display:grid;
        gap:12px;
        box-shadow:0 12px 30px rgba(23,56,79,.10);
      }

      .hha-paste-title{
        color:#14532d;
        font-size:22px;
        font-weight:1000;
        line-height:1.12;
      }

      .hha-paste-text{
        color:#37566e;
        font-size:14px;
        font-weight:900;
        line-height:1.45;
      }

      .hha-paste-area{
        min-height:118px;
        border-radius:24px;
        border:3px solid #bdf4ff;
        background:
          radial-gradient(circle at 72% 30%,rgba(255,255,255,.85),transparent 22%),
          linear-gradient(180deg,#ecfeff,#ffffff);
        position:relative;
        overflow:hidden;
        display:grid;
        place-items:center;
        cursor:pointer;
        user-select:none;
        touch-action:manipulation;
      }

      .hha-paste-brush{
        width:220px;
        height:54px;
        position:relative;
        transform:rotate(-8deg);
      }

      .hha-paste-brush::before{
        content:"";
        position:absolute;
        left:0;
        top:19px;
        width:150px;
        height:18px;
        border-radius:999px;
        background:linear-gradient(90deg,#60a5fa 0 64%,#dbeafe 64% 100%);
        border:3px solid rgba(23,56,79,.12);
      }

      .hha-paste-brush::after{
        content:"";
        position:absolute;
        right:18px;
        top:8px;
        width:58px;
        height:34px;
        border-radius:12px;
        background:
          repeating-linear-gradient(90deg,#ffffff 0 7px,#bdf4ff 7px 12px);
        border:3px solid rgba(14,116,144,.16);
      }

      #hhaPasteBlob{
        position:absolute;
        right:42px;
        top:2px;
        width:0;
        height:22px;
        border-radius:999px;
        background:linear-gradient(90deg,#ffffff,#dcfce7,#86efac);
        border:2px solid rgba(22,163,74,.20);
        box-shadow:0 6px 16px rgba(22,163,74,.16);
        transition:width .16s ease, background .16s ease;
        z-index:3;
      }

      #hhaPasteBlob.too-much{
        background:linear-gradient(90deg,#ffffff,#fee2e2,#fb7185);
        border-color:rgba(220,38,38,.28);
      }

      .hha-paste-meter{
        height:18px;
        border-radius:999px;
        border:2px solid #d7f0fb;
        background:#e9f7fd;
        overflow:hidden;
      }

      #hhaPasteMeterBar{
        height:100%;
        width:0%;
        border-radius:999px;
        background:linear-gradient(90deg,#22c55e,#8be8ff,#ffd95d);
        transition:width .16s ease, background .16s ease;
      }

      #hhaPasteMeterBar.too-much{
        background:linear-gradient(90deg,#fbbf24,#fb7185,#ef4444);
      }

      .hha-paste-actions{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      }

      .hha-paste-btn{
        min-height:54px;
        border:0;
        border-radius:18px;
        padding:10px 12px;
        font-size:15px;
        font-weight:1000;
        cursor:pointer;
        box-shadow:0 10px 24px rgba(23,56,79,.10);
      }

      .hha-paste-add{
        background:linear-gradient(180deg,#fff2a8,#ffd84d);
        color:#5b4200;
      }

      .hha-paste-reset{
        background:#ffffff;
        border:2px solid #bdf4ff;
        color:#0f766e;
      }

      .hha-paste-ready{
        border-radius:18px;
        border:2px solid #bbf7d0;
        background:#ecfdf5;
        color:#166534;
        padding:10px 12px;
        font-size:14px;
        font-weight:1000;
        text-align:center;
      }

      .hha-paste-ready.warn{
        border-color:#fde68a;
        background:#fffbeb;
        color:#6b4f00;
      }

      .hha-paste-ready.danger{
        border-color:#fecaca;
        background:#fff1f2;
        color:#991b1b;
      }

      body[data-paste-ready="0"] #btnStart{
        opacity:.55 !important;
      }

      body[data-paste-ready="0"] #btnStart::after{
        content:" • ใส่ยาสีฟันก่อน";
      }

      body[data-paste-ready="1"] #btnStart{
        opacity:1 !important;
      }

      @media (max-width:640px){
        .hha-paste-actions{
          grid-template-columns:1fr;
        }

        .hha-paste-brush{
          width:190px;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function mountCard(){
    if(!isPrepStage()) return;

    let card = $('hhaToothpastePrepCard');
    if(card) return card;

    card = DOC.createElement('section');
    card.id = 'hhaToothpastePrepCard';
    card.innerHTML = `
      <div class="hha-paste-title">🪥 เตรียมแปรงก่อนนะ</div>
      <div class="hha-paste-text">
        แตะหรือกดปุ่มเพื่อใส่ยาสีฟันบนขนแปรง ให้แถบอยู่ช่วงสีเขียว แล้วค่อยเริ่มแปรงฟัน
      </div>

      <div class="hha-paste-area" id="hhaPasteArea" role="button" tabindex="0" aria-label="ใส่ยาสีฟัน">
        <div class="hha-paste-brush">
          <div id="hhaPasteBlob"></div>
        </div>
      </div>

      <div class="hha-paste-meter" aria-hidden="true">
        <div id="hhaPasteMeterBar"></div>
      </div>

      <div id="hhaPasteStatus" class="hha-paste-ready warn">
        0% • ยังไม่ได้ใส่ยาสีฟัน
      </div>

      <div class="hha-paste-actions">
        <button class="hha-paste-btn hha-paste-add" id="hhaPasteAddBtn" type="button">
          🧴 ใส่ยาสีฟัน
        </button>
        <button class="hha-paste-btn hha-paste-reset" id="hhaPasteResetBtn" type="button">
          ↻ ลองใส่ใหม่
        </button>
      </div>
    `;

    const helper =
      $('helperCard') ||
      $('sceneInstructionCard') ||
      $('objectiveCard') ||
      DOC.querySelector('.leftStack');

    if(helper && helper.parentElement){
      helper.parentElement.insertBefore(card, helper);
    }else{
      const left = DOC.querySelector('.leftStack');
      if(left) left.insertBefore(card, left.firstChild);
      else DOC.body.appendChild(card);
    }

    bindCard();
    updateUi();

    return card;
  }

  function removeCardIfNotPrep(){
    if(isPrepStage()) return;

    const card = $('hhaToothpastePrepCard');
    if(card){
      try{ card.remove(); }catch(_){ card.style.display = 'none'; }
    }
  }

  function updateUi(){
    pasteReady = pasteAmount >= MIN_READY && pasteAmount <= MAX_READY;
    pasteTooMuch = pasteAmount >= TOO_MUCH;

    if(pasteTooMuch) pasteReady = false;

    const amount = Math.max(0, Math.min(140, pasteAmount));
    const pct = Math.round(amount);

    const bar = $('hhaPasteMeterBar');
    const blob = $('hhaPasteBlob');
    const status = $('hhaPasteStatus');

    if(bar){
      bar.style.width = `${Math.min(100, pct)}%`;
      bar.classList.toggle('too-much', pasteTooMuch);
    }

    if(blob){
      blob.style.width = `${Math.min(86, Math.max(0, pct * .72))}px`;
      blob.classList.toggle('too-much', pasteTooMuch);
    }

    if(status){
      status.classList.remove('warn','danger');

      if(pasteTooMuch){
        status.classList.add('danger');
        status.textContent = `${pct}% • เยอะไปนิด ลองใส่ใหม่`;
      }else if(pasteReady){
        status.textContent = `${pct}% • พอดีแล้ว เริ่มแปรงฟันได้เลย`;
      }else{
        status.classList.add('warn');
        status.textContent = `${pct}% • ใส่ยาสีฟันเพิ่มอีกนิด`;
      }
    }

    const body = DOC.body;
    if(body){
      body.setAttribute('data-paste-ready', pasteReady ? '1' : '0');
      body.setAttribute('data-paste-amount', String(pct));
    }

    const start = $('btnStart');
    if(start && isPrepStage()){
      start.disabled = false;
      start.style.pointerEvents = 'auto';
      start.style.visibility = 'visible';
      start.style.display = '';
      start.textContent = pasteReady ? '▶ เริ่มแปรงฟัน' : '🧴 ใส่ยาสีฟันก่อน';
    }

    const coach = $('coachLine');
    if(coach && isPrepStage()){
      if(pasteTooMuch){
        coach.textContent = 'ยาสีฟันเยอะไปนิด ลองใส่ใหม่ให้พอดีนะ';
      }else if(pasteReady){
        coach.textContent = 'ยาสีฟันพอดีแล้ว กดเริ่มแปรงฟันได้เลย';
      }else{
        coach.textContent = 'แตะหรือกดใส่ยาสีฟันให้แถบอยู่ช่วงสีเขียวก่อนนะ';
      }
    }

    try{
      WIN.HHA_BRUSH_TOOTHPASTE_PREP_STATE = {
        patch: PATCH_ID,
        pasteAmount,
        pasteReady,
        pasteTooMuch,
        started,
        at: new Date().toISOString()
      };
    }catch(_){}
  }

  function addPaste(amount){
    if(started) return;

    pasteAmount += amount || 22;
    pasteAmount = Math.max(0, Math.min(150, pasteAmount));
    updateUi();
  }

  function resetPaste(){
    pasteAmount = 0;
    pasteReady = false;
    pasteTooMuch = false;
    updateUi();
  }

  function bindCard(){
    const area = $('hhaPasteArea');
    const add = $('hhaPasteAddBtn');
    const reset = $('hhaPasteResetBtn');

    if(area && !area.__hhaPasteBound){
      area.__hhaPasteBound = true;

      area.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        addPaste(22);
      }, true);

      area.addEventListener('keydown', function(ev){
        if(ev.key === 'Enter' || ev.key === ' '){
          ev.preventDefault();
          addPaste(22);
        }
      }, true);
    }

    if(add && !add.__hhaPasteBound){
      add.__hhaPasteBound = true;
      add.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        addPaste(22);
      }, true);
    }

    if(reset && !reset.__hhaPasteBound){
      reset.__hhaPasteBound = true;
      reset.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        resetPaste();
      }, true);
    }
  }

  function isStartButton(el){
    if(!el) return false;
    if(el.id === 'btnStart') return true;

    const label = text(el);
    return /เริ่มแปรงฟัน|ใส่ยาสีฟันก่อน|พร้อมแล้ว|ไปเล่นจริง/i.test(label);
  }

  function closestButton(el){
    try{ return el && el.closest ? el.closest('button,a,[role="button"]') : null; }
    catch(_){ return null; }
  }

  function blockStartIfNotReady(ev){
    const btn = closestButton(ev.target);
    if(!isStartButton(btn)) return;
    if(!isPrepStage()) return;

    if(!pasteReady){
      ev.preventDefault();
      ev.stopPropagation();
      if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      if(pasteTooMuch){
        resetPaste();
      }else{
        addPaste(22);
      }

      return false;
    }

    started = true;

    if(DOC.body){
      DOC.body.setAttribute('data-paste-ready', '1');
      DOC.body.setAttribute('data-brush-real-started', '1');
      DOC.body.setAttribute('data-brush-hard-prep', '0');
      DOC.body.setAttribute('data-brush-flow-stage', 'brush');
    }

    DOC.documentElement.setAttribute('data-brush-flow-stage', 'brush');

    try{
      WIN.dispatchEvent(new CustomEvent('hha:brush-toothpaste-ready-start', {
        detail:{
          patch: PATCH_ID,
          pasteAmount,
          pasteReady:true
        }
      }));
    }catch(_){}
  }

  function bindStartGuard(){
    if(DOC.__hhaToothpasteStartGuardBound) return;
    DOC.__hhaToothpasteStartGuardBound = true;

    DOC.addEventListener('pointerdown', blockStartIfNotReady, true);
    DOC.addEventListener('click', blockStartIfNotReady, true);
  }

  function apply(){
    ensureStyle();

    if(isPrepStage()){
      mountCard();
      bindCard();
      updateUi();
    }else{
      removeCardIfNotPrep();
    }
  }

  function observe(){
    let timer = null;

    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 80);
    };

    try{
      const mo = new MutationObserver(run);
      mo.observe(DOC.body || DOC.documentElement, {
        childList:true,
        subtree:true,
        attributes:true,
        characterData:true
      });
    }catch(_){}

    setInterval(apply, 400);

    setTimeout(apply, 80);
    setTimeout(apply, 300);
    setTimeout(apply, 900);
  }

  function expose(){
    WIN.HHA_BRUSH_TOOTHPASTE_PREP = {
      patch: PATCH_ID,
      add: addPaste,
      reset: resetPaste,
      ready: () => pasteReady,
      state: () => ({
        patch: PATCH_ID,
        pasteAmount,
        pasteReady,
        pasteTooMuch,
        started
      })
    };
  }

  function boot(){
    expose();
    bindStartGuard();
    apply();
    observe();

    try{
      console.log('[BrushToothpastePrep]', PATCH_ID, 'booted');
    }catch(_){}
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();