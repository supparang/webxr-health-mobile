/* CSAI2102 S2 Reflection Evidence Case Picker v6.8.7
   Replaces the native 15-item select popup with a compact, readable dark picker.
   Keeps the original select in sync so Reflection Evidence validation continues unchanged.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_EVIDENCE_CASE_PICKER_V687__)return;
  window.__AIQUEST_S2_EVIDENCE_CASE_PICKER_V687__=true;

  const $=id=>document.getElementById(id);
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const clean=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();

  const style=document.createElement('style');
  style.id='aiquestS2EvidencePickerStyleV687';
  style.textContent=`
    #s2EvidenceCase{position:absolute!important;inline-size:1px!important;block-size:1px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important}
    #s2EvidencePickerV687{margin-top:9px}
    #s2EvidencePickerV687 .ep-open{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;padding:12px 13px;border:1px solid rgba(56,189,248,.74);border-radius:13px;background:#16253a;color:#f8fbff;font:700 15px system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer}
    #s2EvidencePickerV687 .ep-open:hover{border-color:#67e8f9;background:#19304a}
    #s2EvidencePickerV687 .ep-open b{display:block;font-size:13px;line-height:1.35;color:#f8fbff}
    #s2EvidencePickerV687 .ep-open small{display:block;margin-top:2px;color:#b9d9f4;font-weight:600;line-height:1.35}
    #s2EvidencePickerV687 .ep-arrow{font-size:18px;transition:transform .18s ease}
    #s2EvidencePickerV687.open .ep-arrow{transform:rotate(180deg)}
    #s2EvidencePickerV687 .ep-panel{display:none;margin-top:8px;padding:9px;border:1px solid rgba(100,116,139,.55);border-radius:14px;background:#0c1727;box-shadow:0 16px 36px rgba(0,0,0,.32)}
    #s2EvidencePickerV687.open .ep-panel{display:block}
    #s2EvidencePickerV687 .ep-caption{font-size:12px;color:#b9d9f4;margin:2px 3px 8px;line-height:1.45}
    #s2EvidencePickerV687 .ep-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;max-block-size:330px;overflow:auto;padding:2px}
    #s2EvidencePickerV687 .ep-case{min-height:72px;padding:10px;border:1px solid rgba(148,163,184,.26);border-radius:11px;background:#132238;color:#f8fbff;text-align:left;font:inherit;cursor:pointer;line-height:1.35}
    #s2EvidencePickerV687 .ep-case:hover{border-color:#60a5fa;background:#19304a}
    #s2EvidencePickerV687 .ep-case.selected{border-color:#34d399;background:rgba(6,78,59,.48);box-shadow:inset 0 0 0 1px rgba(52,211,153,.28)}
    #s2EvidencePickerV687 .ep-num{display:inline-flex;padding:2px 6px;border-radius:999px;background:rgba(96,165,250,.18);color:#bfdbfe;font-size:11px;font-weight:800}
    #s2EvidencePickerV687 .ep-context{display:block;margin-top:5px;color:#fff;font-weight:800}
    #s2EvidencePickerV687 .ep-meta{display:block;margin-top:3px;color:#b9d9f4;font-size:11px;font-weight:650}
    @media(max-width:700px){#s2EvidencePickerV687 .ep-list{grid-template-columns:1fr;max-block-size:310px}}
  `;
  document.head.appendChild(style);

  function optionData(select){
    return [...select.options].slice(1).map((option,index)=>({
      value:option.value,
      label:clean(option.textContent),
      index:index+1
    }));
  }
  function parts(item){
    const text=item.label.replace(/^Case\s+\d+\s*•\s*/i,'');
    const seg=text.split(' — ');
    return {context:seg[0]||text,meta:seg.slice(1).join(' — ')||'Case จาก Deck นี้'};
  }
  function selectedLabel(select){
    const opt=select.options[select.selectedIndex];
    if(!opt||!opt.value)return {title:'เลือก Case ที่ใช้เป็นหลักฐาน',meta:'เลือก 1 Case จาก 15 Case ใน Deck นี้'};
    const item={label:clean(opt.textContent)};
    const p=parts(item);
    return {title:p.context,meta:p.meta};
  }
  function sync(picker,select){
    const picked=selectedLabel(select);
    const title=picker.querySelector('.ep-title');
    const meta=picker.querySelector('.ep-current-meta');
    if(title)title.textContent=picked.title;
    if(meta)meta.textContent=picked.meta;
    picker.querySelectorAll('.ep-case').forEach(button=>{
      const chosen=String(button.dataset.value)===String(select.value||'');
      button.classList.toggle('selected',chosen);
      button.setAttribute('aria-pressed',chosen?'true':'false');
    });
  }
  function mount(){
    const select=$('s2EvidenceCase');
    if(!select)return;
    let picker=$('s2EvidencePickerV687');
    if(picker&&picker.dataset.forSelect===select.id){sync(picker,select);return;}
    picker?.remove();
    const items=optionData(select);
    if(!items.length)return;
    select.setAttribute('aria-hidden','true');
    const panel=document.createElement('div');
    panel.id='s2EvidencePickerV687';
    panel.dataset.forSelect=select.id;
    panel.innerHTML='<button type="button" class="ep-open" aria-expanded="false"><span><b class="ep-title">เลือก Case ที่ใช้เป็นหลักฐาน</b><small class="ep-current-meta">เลือก 1 Case จาก Deck นี้</small></span><span class="ep-arrow">⌄</span></button>'+
      '<div class="ep-panel"><div class="ep-caption">เลือกเพียง 1 Case แล้วระบบจะใช้ Context, Skill และ Policy นี้ตรวจ Reflection ทั้งสามข้อ</div><div class="ep-list">'+items.map(item=>{const p=parts(item);return '<button type="button" class="ep-case" data-value="'+esc(item.value)+'" aria-pressed="false"><span class="ep-num">Case '+item.index+'</span><span class="ep-context">'+esc(p.context)+'</span><span class="ep-meta">'+esc(p.meta)+'</span></button>'}).join('')+'</div></div>';
    select.insertAdjacentElement('afterend',panel);
    const open=panel.querySelector('.ep-open');
    open.addEventListener('click',()=>{
      const now=!panel.classList.contains('open');
      panel.classList.toggle('open',now);
      open.setAttribute('aria-expanded',now?'true':'false');
    });
    panel.querySelectorAll('.ep-case').forEach(button=>button.addEventListener('click',()=>{
      select.value=button.dataset.value;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      panel.classList.remove('open');open.setAttribute('aria-expanded','false');
      sync(panel,select);
    }));
    select.addEventListener('change',()=>sync(panel,select));
    sync(panel,select);
  }
  new MutationObserver(()=>setTimeout(mount,0)).observe(document.body,{childList:true,subtree:true});
  setInterval(mount,350);mount();
})();