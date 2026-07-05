/* CSAI2102 Teacher Console Sheets timeout bridge v6.7.0
   The safe console owns a 15s AbortController. Apps Script can cold-start
   or aggregate a growing audit sheet for longer than that. For this one GET
   route only, ignore that short abort signal and provide a 45s hard ceiling.
*/
(()=>{'use strict';
  const nativeFetch=window.fetch&&window.fetch.bind(window);
  if(!nativeFetch||window.__AIQUEST_TEACHER_TIMEOUT_V670__)return;
  window.__AIQUEST_TEACHER_TIMEOUT_V670__=true;
  const isTeacherConsole=url=>{
    const text=String(url||'');
    return text.indexOf('script.google.com/macros/')>=0 &&
      /[?&]action=teacherConsole(?:&|$)/.test(text);
  };
  window.fetch=function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!isTeacherConsole(url))return nativeFetch(input,init);
    const options=Object.assign({},init||{});
    delete options.signal;
    let timer=null;
    const request=nativeFetch(input,options);
    const ceiling=new Promise((_,reject)=>{
      timer=setTimeout(()=>{
        const error=new Error('Teacher Console timeout after 45 seconds');
        error.name='AbortError';
        reject(error);
      },45000);
    });
    return Promise.race([request,ceiling]).finally(()=>clearTimeout(timer));
  };
  console.log('[AIQuest] Teacher Console timeout bridge active (45s)');
})();