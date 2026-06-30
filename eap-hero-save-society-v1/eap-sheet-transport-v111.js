/* EAP Hero Sheet Transport v111
   Intercepts the core's exact submit_attempt fetch and delivers it as a hidden GET form.
   This preserves the core's real session/skill/score payload and avoids result-page parsing.
*/
(function(){
  'use strict';
  var cfg = window.EAP_SHEET_CONFIG || {};
  if (!cfg.enabled || !cfg.webAppUrl || !window.fetch) return;
  var nativeFetch = window.fetch.bind(window);
  var frameName = 'eap_sheet_receiver_v111';
  function frame(){
    var f = document.getElementById(frameName);
    if(!f){
      f = document.createElement('iframe');
      f.id = frameName;
      f.name = frameName;
      f.style.cssText='display:none;width:1px;height:1px;border:0';
      document.body.appendChild(f);
    }
    return f;
  }
  function submit(urlText){
    try{
      var u = new URL(urlText, location.href);
      if (u.origin !== new URL(cfg.webAppUrl).origin) return false;
      if (u.searchParams.get('action') !== 'submit_attempt') return false;
      frame();
      var form = document.createElement('form');
      form.method = 'GET';
      form.action = cfg.webAppUrl;
      form.target = frameName;
      u.searchParams.forEach(function(value,key){
        var input = document.createElement('input');
        input.type='hidden'; input.name=key; input.value=value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
      setTimeout(function(){ try{ form.remove(); }catch(_){} }, 0);
      return true;
    }catch(_){ return false; }
  }
  window.fetch = function(input, init){
    var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if(submit(url)) return Promise.resolve(new Response('', {status:204}));
    return nativeFetch(input, init);
  };
})();
