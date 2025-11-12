// === Result Modal Overlay (patched Mini Quests badge + Back to Hub) ===
(function(){
  var overlay=null, listBox=null, scoreEl=null, comboEl=null, goalEl=null, titleEl=null;
  var btnAgain=null, btnMenu=null, btnClose=null, questBadge=null, timeBadge=null, missEl=null;
  var lastMode='goodjunk', lastDiff='normal', lastQuest={x:0,y:0};

  function injectStyles(){
    if (document.getElementById('hha-result-style2')) return;
    var st=document.createElement('style'); st.id='hha-result-style2';
    st.textContent =
      '.hha-result-overlay{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}'+
      '.hha-result-card{width:min(880px,94vw);max-height:86vh;overflow:auto;background:#0b1220cc;backdrop-filter:blur(8px);border:1px solid #334155;border-radius:18px;color:#e2e8f0;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.45);font:600 14px system-ui,Segoe UI,Inter,sans-serif}'+
      '.hha-result-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}'+
      '.hha-result-title{font-weight:900;font-size:20px}'+
      '.hha-head-badges{display:flex;gap:8px;align-items:center}'+
      '.badge{padding:4px 9px;border-radius:999px;border:1px solid #475569;font-weight:900}'+
      '.b-time{background:#334155;color:#cbd5e1}'+
      '.b-quest{background:#1e293b;color:#a5b4fc;border-color:#4f46e5}'+
      '.b-quest.ok{background:#052e1a;border-color:#16a34a;color:#86efac}'+
      '.b-quest.mid{background:#2a2a05;border-color:#eab308;color:#fde68a}'+
      '.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:10px 0 6px}'+
      '.kpi{background:#0f172acc;border:1px solid #334155;border-radius:12px;padding:12px} .kpi b{display:block;font-size:12px;color:#93c5fd;font-weight:800;margin-bottom:6px} .kpi .v{font-size:22px;font-weight:900;color:#f8fafc}'+
      '.quest-wrap{margin-top:12px;border-top:1px dashed #334155;padding-top:12px} .quest-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}'+
      '.quest{display:flex;gap:10px;align-items:center;background:#0f172acc;border:1px solid #263244;border-radius:12px;padding:10px} .quest .check{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center}'+
      '.quest.done .check{background:#16a34a;color:#fff;border:1px solid #15803d} .quest.fail .check{background:#334155;color:#94a3b8;border:1px solid #475569}'+
      '.actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px} .btn{appearance:none;border:1px solid #334155;background:#0b1220;color:#e2e8f0;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer} .btn.primary{background:#2563eb;border-color:#1d4ed8;color:#fff}'+
      '@media (max-width:640px){ .grid{grid-template-columns:repeat(2,minmax(0,1fr))} .quest-list{grid-template-columns:1fr} }';
    document.head.appendChild(st);
  }

  function ensure(){
    if (overlay) return;
    injectStyles();
    overlay=document.createElement('div'); overlay.className='hha-result-overlay';
    var card=document.createElement('div'); card.className='hha-result-card';

    var head=document.createElement('div'); head.className='hha-result-head';
    titleEl=document.createElement('div'); titleEl.className='hha-result-title';
    var badges=document.createElement('div'); badges.className='hha-head-badges';
    timeBadge=document.createElement('div'); timeBadge.className='badge b-time'; timeBadge.textContent='TIME 0s';
    questBadge=document.createElement('div'); questBadge.className='badge b-quest'; questBadge.textContent='QUESTS 0/0';
    badges.appendChild(questBadge); badges.appendChild(timeBadge);
    head.appendChild(titleEl); head.appendChild(badges);

    var grid=document.createElement('div'); grid.className='grid';
    function kpi(lbl){ var w=document.createElement('div'); w.className='kpi'; var b=document.createElement('b'); b.textContent=lbl; var v=document.createElement('div'); v.className='v'; w.appendChild(b); w.appendChild(v); return {w:w,v:v}; }
    var k1=kpi('คะแนนรวม'), k2=kpi('คอมโบสูงสุด'), k3=kpi('เป้าหมาย'), k4=kpi('พลาด (miss)');
    scoreEl=k1.v; comboEl=k2.v; goalEl=k3.v; missEl=k4.v;
    grid.appendChild(k1.w); grid.appendChild(k2.w); grid.appendChild(k3.w); grid.appendChild(k4.w);

    var qwrap=document.createElement('div'); qwrap.className='quest-wrap';
    var qh=document.createElement('h3'); qh.textContent='ภารกิจที่สุ่มให้รอบนี้'; qwrap.appendChild(qh);
    listBox=document.createElement('div'); listBox.className='quest-list'; qwrap.appendChild(listBox);

    var actions=document.createElement('div'); actions.className='actions';
    btnAgain=document.createElement('button'); btnAgain.className='btn primary'; btnAgain.textContent='เล่นอีกครั้ง';
    btnMenu =document.createElement('button'); btnMenu.className='btn'; btnMenu.textContent='กลับ Hub';
    btnClose=document.createElement('button'); btnClose.className='btn'; btnClose.textContent='ปิด';
    actions.appendChild(btnAgain); actions.appendChild(btnMenu); actions.appendChild(btnClose);

    card.appendChild(head); card.appendChild(grid); card.appendChild(qwrap); card.appendChild(actions);
    overlay.appendChild(card);
    (document.querySelector('.game-wrap')||document.body).appendChild(overlay);

    btnAgain.addEventListener('click', function(e){ try{e.preventDefault();}catch(_){}
      overlay.style.display='none';
      try{ if (window.hub && window.hub.startGame) window.hub.startGame(); }catch(_){}
    });
    btnMenu.addEventListener('click', function(e){ try{e.preventDefault();}catch(_){}
      // ไป hub.html พร้อม mode/diff ล่าสุด
      var url = 'hub.html?mode='+encodeURIComponent(lastMode||'goodjunk')+'&difficulty='+encodeURIComponent(lastDiff||'normal');
      location.href = url;
    });
    btnClose.addEventListener('click', function(e){ try{e.preventDefault();}catch(_){ } overlay.style.display='none'; });
    overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.style.display='none'; });
  }

  function questBadgeColor(x,y){
    questBadge.classList.remove('ok','mid');
    if (y<=0){ /* keep default */ }
    else if (x>=y){ questBadge.classList.add('ok'); }
    else if (x>0){ questBadge.classList.add('mid'); }
  }

  function clear(el){ try{ while(el.firstChild) el.removeChild(el.firstChild); }catch(_){ } }
  function row(label, level, done, prog, target){
    var r=document.createElement('div'); r.className='quest '+(done?'done':'fail');
    var c=document.createElement('div'); c.className='check'; c.textContent=done?'✓':'•';
    var t=document.createElement('div'); t.textContent=label||''; t.style.flex='1';
    var m=document.createElement('div'); m.style.color='#94a3b8'; m.style.fontWeight='700'; m.style.fontSize='12px';
    var lv = level?('['+level+'] '):''; m.textContent = lv + (target>0?`(${prog||0}/${target})`:'');
    r.appendChild(c); r.appendChild(t); r.appendChild(m); return r;
  }

  function show(detail){
    ensure();
    // capture latest mode/diff for "กลับ Hub"
    lastMode = String(detail && detail.mode || 'goodjunk');
    lastDiff = String(detail && detail.difficulty || 'normal');

    titleEl.textContent = 'สรุปผล: '+lastMode+' ('+lastDiff+')';
    scoreEl.textContent = (detail && detail.score!=null)?detail.score.toLocaleString():'0';
    comboEl.textContent = (detail && (detail.comboMax!=null?detail.comboMax:detail.combo!=null?detail.combo:0)).toLocaleString();
    missEl.textContent  = (detail && detail.misses!=null?detail.misses:0).toLocaleString();

    var ok = !!(detail && detail.goalCleared);
    var tgt = (detail && detail.goalTarget!=null) ? Number(detail.goalTarget) : null;
    goalEl.innerHTML = ok ? '<span style="color:#22c55e">ถึงเป้า'+(tgt!=null?` (${tgt.toLocaleString()})`:'')+'</span>'
                          : '<span style="color:#ef4444">ยังไม่ถึง'+(tgt!=null?` (${tgt.toLocaleString()})`:'')+'</span>';

    var dur = detail && detail.duration!=null ? Number(detail.duration) : 0;
    timeBadge.textContent = 'TIME '+(dur|0)+'s';

    // quests x/y badge + list
    var x = Number(detail && detail.questsCleared || 0);
    var y = Number(detail && detail.questsTotal   || 0);
    lastQuest = {x:x,y:y};
    questBadge.textContent = 'QUESTS '+x+'/'+y;
    questBadgeColor(x,y);

    clear(listBox);
    var arr = (detail && detail.questsSummary && detail.questsSummary.slice) ? detail.questsSummary.slice(0,12) : [];
    if (!arr.length){
      var empty=document.createElement('div'); empty.className='quest fail';
      empty.innerHTML='<div class="check">•</div><div>ไม่มีข้อมูลเควสต์จากรอบนี้</div>';
      listBox.appendChild(empty);
    } else {
      for (var i=0;i<arr.length;i++){
        var q=arr[i]||{};
        listBox.appendChild(row(String(q.label||''), String(q.level||''), !!q.done, Number(q.prog)||0, Number(q.target)||0));
      }
    }
    overlay.style.display='flex';
  }

  window.addEventListener('hha:end', function(e){ try{ show(e && e.detail ? e.detail : {}); }catch(_){ } });
})();
