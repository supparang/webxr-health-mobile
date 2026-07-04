/* EAP Hero Writing Evidence Guard v1 */
(function(){
  'use strict';
  var submitted = false;
  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function box(){ return document.getElementById('writingOutput'); }
  function writingPage(){ return /Writing Mission/i.test(String((document.getElementById('app') || document.body).innerText || '')); }
  function promptLike(v){
    var s = clean(v).toLowerCase();
    return !s || /write its simple meaning|write one short academic sentence|choose one academic word from context/.test(s);
  }
  function valid(){
    var value = clean(box() && box().value);
    return value.split(/\s+/).filter(Boolean).length >= 4 && !promptLike(value);
  }
  function notice(){
    var old = document.getElementById('eapWritingGuardNotice');
    if(old) old.remove();
    var node = document.createElement('div');
    node.id = 'eapWritingGuardNotice';
    node.textContent = 'Write one short answer of your own before submitting. The instruction itself is not writing evidence.';
    node.style.cssText = 'position:fixed;z-index:100020;left:50%;bottom:22px;transform:translateX(-50%);padding:10px 14px;border-radius:12px;background:#8d2b10;color:#fff;font:700 14px system-ui';
    document.body.appendChild(node);
    setTimeout(function(){ node.remove(); }, 3200);
  }
  document.addEventListener('click', function(event){
    var button = event.target && event.target.closest && event.target.closest('button');
    if(!button || !/submit writing/i.test(clean(button.textContent)) || !writingPage()) return;
    if(!valid()){
      event.preventDefault();
      event.stopImmediatePropagation();
      notice();
      var field = box();
      if(field) field.focus();
    }
  }, true);
  window.EAPWritingEvidenceGuardV1 = {valid:valid};
})();
