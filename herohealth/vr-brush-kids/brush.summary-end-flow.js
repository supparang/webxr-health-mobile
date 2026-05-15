/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.summary-end-flow.js
 * PATCH v20260515-P51-BRUSH-KIDS-SUMMARY-END-FLOW
 *
 * Purpose:
 * - หลังจบเกมต้องมีทางไปต่อชัดเจน
 * - ใส่ปุ่ม: ใส่ยาสีฟันใหม่ / Cooldown / กลับ Hygiene Zone
 * - Replay ต้องกลับ brush.html?run=menu ไม่ใช่ launcher อื่น
 * - Cooldown ต้องไป warmup-gate.html?phase=cooldown แล้วกลับ Hygiene Zone
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const PATCH_ID = 'v20260515-P51-BRUSH-KIDS-SUMMARY-END-FLOW';

  function $(id){
    return DOC.getElementById(id);
  }

  function qs(){
    try{ return new URLSearchParams(WIN.location.search || ''); }
    catch(_){ return new URLSearchParams(); }
  }

  function param(k, fallback){
    const p = qs();
    const v = p.get(k);
    return v === null || v === '' ? fallback : v;
  }

  function baseHero(){
    try{
      const path = WIN.location.pathname || '';
      const marker = '/herohealth/';
      const idx = path.indexOf(marker);
      if(idx >= 0){
        return WIN.location.origin + path.slice(0, idx + marker.length);
      }
    }catch(_){}
    return WIN.location.origin + '/herohealth/';
  }

  function cleanUrl(raw){
    try{
      const s = String(raw || '').trim();
      if(!s) return '';
      return new URL(decodeURIComponent(s), baseHero()).toString();
    }catch(_){
      try{ return new URL(String(raw || ''), baseHero()).toString(); }
      catch(__){ return ''; }
    }
  }

  function toQuery(obj){
    const q = new URLSearchParams();

    Object.keys(obj || {}).forEach(k => {
      const v = obj[k];
      if(v === undefined || v === null || v === '') return;
      q.set(k, String(v));
    });

    return q.toString();
  }

  function hubV2Url(){
    return baseHero() + 'hub-v2.html';
  }

  function hygieneZoneUrl(){
    const currentHub = cleanUrl(param('hub', ''));

    /*
     * ถ้า hub ปัจจุบันเป็น hygiene-zone.html อยู่แล้ว ใช้ต่อเลย
     */
    if(currentHub && /hygiene-zone\.html/i.test(currentHub)){
      return currentHub;
    }

    const zoneCtx = {
      pid: param('pid', 'anon'),
      name: param('name', 'Hero'),
      diff: param('diff', 'normal'),
      time: param('time', '90'),
      view: param('view', 'pc'),
      hub: currentHub || hubV2Url()
    };

    return baseHero() + 'hygiene-zone.html?' + toQuery(zoneCtx);
  }

  function replayMenuUrl(){
    const ctx = {
      pid: param('pid', 'anon'),
      name: param('name', 'Hero'),
      diff: param('diff', 'normal'),
      time: param('time', '90'),
      view: param('view', 'pc'),

      zone: 'hygiene',
      cat: 'hygiene',
      game: 'brush',
      gameId: 'brush',
      variant: 'kids-vr',
      mode: param('mode', 'learn'),
      entry: 'brush-kids',
      theme: 'brush',

      /*
       * สำคัญ:
       * กลับหน้า menu/prep เพื่อให้เริ่มใส่ยาสีฟันใหม่
       */
      seed: String(Date.now()),
      run: 'menu',
      hub: hygieneZoneUrl()
    };

    return baseHero() + 'vr-brush-kids/brush.html?' + toQuery(ctx);
  }

  function cooldownUrl(){
    const zone = hygieneZoneUrl();

    const ctx = {
      pid: param('pid', 'anon'),
      name: param('name', 'Hero'),
      diff: param('diff', 'normal'),
      time: param('time', '90'),
      view: param('view', 'pc'),

      zone: 'hygiene',
      cat: 'hygiene',
      game: 'brush',
      gameId: 'brush',
      variant: 'kids-vr',
      mode: param('mode', 'learn'),
      entry: 'brush-kids',
      theme: 'brush',

      run: 'cooldown',
      phase: 'cooldown',
      cooldown: '1',
      once: '1',
      next: zone,
      back: zone,
      return: zone,
      hub: zone
    };

    return baseHero() + 'warmup-gate.html?' + toQuery(ctx);
  }

  function go(url){
    try{ WIN.location.href = url; }
    catch(_){
      try{ WIN.location.assign(url); }catch(__){}
    }
  }

  function isSummaryOpen(){
    const modal = $('summaryModal');
    if(!modal) return false;
    if(modal.hidden) return false;

    const cs = WIN.getComputedStyle ? WIN.getComputedStyle(modal) : null;
    if(cs && cs.display === 'none') return false;

    return true;
  }

  function ensureStyle(){
    if($('hha-summary-end-flow-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-summary-end-flow-style';
    style.textContent = `
      #summaryModal.hha-end-flow-ready .summaryActions{
        display:none !important;
      }

      #hha-summary-end-flow-actions{
        display:grid;
        grid-template-columns:1.1fr .9fr 1fr;
        gap:10px;
        margin-top:4px;
      }

      .hha-end-flow-btn{
        min-height:58px;
        border:0;
        border-radius:20px;
        padding:10px 14px;
        font-size:clamp(15px,2vw,21px);
        font-weight:1000;
        cursor:pointer;
        color:#17384f;
        box-shadow:0 10px 24px rgba(23,56,79,.12);
        touch-action:manipulation;
      }

      .hha-end-flow-btn.replay{
        background:linear-gradient(180deg,#fff2a8,#ffd84d);
        color:#5b4200;
      }

      .hha-end-flow-btn.cooldown{
        background:linear-gradient(180deg,#effcff,#fff);
        border:2px solid #bdf4ff;
        color:#0f766e;
      }

      .hha-end-flow-btn.zone{
        background:linear-gradient(180deg,#dcfff2,#baf4cf);
        color:#14532d;
      }

      #hha-summary-end-flow-note{
        margin-top:8px;
        border-radius:18px;
        border:2px dashed #bdf4ff;
        background:#fff;
        color:#37566e;
        padding:10px 12px;
        font-size:14px;
        line-height:1.45;
        font-weight:900;
        text-align:center;
      }

      @media (max-width:640px){
        #hha-summary-end-flow-actions{
          grid-template-columns:1fr;
        }

        .hha-end-flow-btn{
          min-height:50px;
          font-size:16px;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function mountActions(){
    if(!isSummaryOpen()) return;

    const modal = $('summaryModal');
    const card = modal ? modal.querySelector('.summaryCard') : null;
    if(!modal || !card) return;

    modal.classList.add('hha-end-flow-ready');
    modal.setAttribute('data-end-flow-patch', PATCH_ID);

    let actions = $('hha-summary-end-flow-actions');

    if(!actions){
      actions = DOC.createElement('nav');
      actions.id = 'hha-summary-end-flow-actions';
      actions.setAttribute('aria-label', 'Brush summary next actions');

      actions.innerHTML = `
        <button type="button" class="hha-end-flow-btn replay" id="hhaBtnReplayMenu">
          🪥 ใส่ยาสีฟันใหม่
        </button>
        <button type="button" class="hha-end-flow-btn cooldown" id="hhaBtnCooldown">
          🧘 Cooldown
        </button>
        <button type="button" class="hha-end-flow-btn zone" id="hhaBtnBackZone">
          🏠 กลับ Hygiene Zone
        </button>
      `;

      const oldActions = card.querySelector('.summaryActions');
      if(oldActions){
        oldActions.insertAdjacentElement('afterend', actions);
      }else{
        card.appendChild(actions);
      }
    }

    let note = $('hha-summary-end-flow-note');
    if(!note){
      note = DOC.createElement('div');
      note.id = 'hha-summary-end-flow-note';
      note.textContent = 'จบเกมแล้ว เลือกใส่ยาสีฟันใหม่เพื่อเล่นอีกรอบ หรือทำ Cooldown ก่อนกลับโซนสุขอนามัย';
      actions.insertAdjacentElement('afterend', note);
    }

    const replay = $('hhaBtnReplayMenu');
    const cooldown = $('hhaBtnCooldown');
    const zone = $('hhaBtnBackZone');

    if(replay && !replay.__hhaEndFlowBound){
      replay.__hhaEndFlowBound = true;
      replay.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        go(replayMenuUrl());
      }, true);
    }

    if(cooldown && !cooldown.__hhaEndFlowBound){
      cooldown.__hhaEndFlowBound = true;
      cooldown.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        go(cooldownUrl());
      }, true);
    }

    if(zone && !zone.__hhaEndFlowBound){
      zone.__hhaEndFlowBound = true;
      zone.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        go(hygieneZoneUrl());
      }, true);
    }

    /*
     * bind ปุ่มเดิมด้วย เผื่อ style หรือ browser ยังคลิกได้
     */
    const btnReplay = $('btnReplay');
    if(btnReplay && !btnReplay.__hhaEndReplayOverride){
      btnReplay.__hhaEndReplayOverride = true;
      btnReplay.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        go(replayMenuUrl());
      }, true);
    }

    const btnSummaryBack = $('btnSummaryBack');
    if(btnSummaryBack && !btnSummaryBack.__hhaEndBackOverride){
      btnSummaryBack.__hhaEndBackOverride = true;
      btnSummaryBack.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        go(hygieneZoneUrl());
      }, true);
    }

    try{
      WIN.HHA_BRUSH_SUMMARY_END_FLOW_STATE = {
        patch: PATCH_ID,
        replay: replayMenuUrl(),
        cooldown: cooldownUrl(),
        zone: hygieneZoneUrl()
      };
    }catch(_){}
  }

  function apply(){
    if(!isSummaryOpen()) return;
    ensureStyle();
    mountActions();
  }

  function observe(){
    let timer = null;

    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 90);
    };

    try{
      const modal = $('summaryModal');
      if(modal){
        const moModal = new MutationObserver(run);
        moModal.observe(modal, {
          attributes:true,
          attributeFilter:['hidden','class','style'],
          childList:true,
          subtree:true,
          characterData:true
        });
      }

      const moBody = new MutationObserver(run);
      moBody.observe(DOC.body || DOC.documentElement, {
        childList:true,
        subtree:true,
        attributes:true,
        characterData:true
      });
    }catch(_){}

    setTimeout(apply, 120);
    setTimeout(apply, 400);
    setTimeout(apply, 900);
    setTimeout(apply, 1600);
  }

  function expose(){
    WIN.HHA_BRUSH_SUMMARY_END_FLOW = {
      patch: PATCH_ID,
      apply,
      replayMenuUrl,
      cooldownUrl,
      hygieneZoneUrl
    };
  }

  function boot(){
    expose();
    observe();
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();
