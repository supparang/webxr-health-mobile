/* CSAI2601 UX Quest • Mission Identity v1
 * Makes each W/B feel visibly different while keeping the core learning loop stable.
 */
(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const text = (el) => String(el?.textContent || '').trim();
  const qp = () => new URLSearchParams(location.search || '');
  const nodeId = () => String(qp().get('node') || qp().get('id') || 'W1').toUpperCase();

  const profiles = {
    W1:['🔎','UX Problem Scanner','ตามล่าจุดติดขัด UI/UX จาก task จริง','หา friction → goal → impact → fix → proof'],
    W2:['🧭','HCD Evidence Lab','หยุดเดา แล้วใช้หลักฐานผู้ใช้ก่อนออกแบบ','evidence → assumption trap → research target → small test'],
    W3:['🧠','Psychology Signal','อ่านสัญญาณสมองผู้ใช้: attention, memory, feedback, mental model','concept → cognitive load → repair → validate'],
    W4:['🕵️','Research Detective','แยก research question, pain point, persona need','question → pain point → need → evidence → observation'],
    W5:['💡','Problem/HMW Studio','เปลี่ยน insight เป็น root cause, problem statement และ HMW','insight → root cause → problem → HMW → concept'],
    W6:['🗺️','Flow Mapper','จัด IA, sitemap, navigation, happy path และ error path','group → nav → happy path → error path → bottleneck'],
    W7:['📐','Wireframe Forge','จัด priority, layout, CTA และ mobile wireframe','priority → layout → CTA → mobile → hierarchy trap'],
    W8:['🧩','Midterm Blueprint Review','ตรวจ chain ของ blueprint ให้ problem/persona/flow/wireframe ไม่หลุด','evidence chain → mismatch → critique → revision → rationale'],
    W9:['🧱','Pattern Keeper','รวม component ซ้ำ สร้าง state และ naming ให้เป็นระบบ','component → state → naming → system rule → consistency'],
    W10:['📱','Responsive Guardian','แก้ layout มือถือและ accessibility ให้ task ใช้ได้จริง','responsive → a11y → breakpoint → touch/contrast → check'],
    W11:['🎨','Visual Signal Control','ใช้สี ตัวอักษร spacing และ contrast สื่อความหมาย','color → typography → contrast → spacing → visual decision'],
    W12:['⚡','Interaction Signal','ออกแบบ state, feedback, microcopy และ recovery หลัง action','state → prevention → microcopy → feedback → recovery'],
    W13:['🔗','Prototype Builder','ทำ prototype ที่คลิกทดสอบ task จริงได้ ไม่ใช่ภาพนิ่ง','task → link → interaction → error path → rationale'],
    W14:['🧪','Evidence Lab','อ่านผลทดสอบ จัด severity เลือก fix และ retest','evidence → finding → severity → fix → retest'],
    W15:['🏁','Portfolio Finalizer','เล่า case study ให้เห็น evidence-decision-design-test ครบ','narrative → evidence gap → story → proof → defense'],
    B1:['👹','Boss B1 Foundation Gate','รวม UI/UX + HCD + Psychology เพื่อผ่านประตูแรก','UX issue → HCD evidence → psychology → fix → proof'],
    B2:['🐉','Boss B2 Flow/Wireframe Gate','ป้องกัน chain จาก evidence ถึง wireframe','persona → problem/HMW → flow → wireframe → defense'],
    B3:['🛡️','Boss B3 Interface System Gate','รวม design system + responsive + accessibility','pattern → responsive → accessibility → visual system → defense'],
    B4:['🔥','Boss B4 Validation Gate','พิสูจน์ prototype ด้วย evidence และ iteration','state → prototype → severity → iteration → retest']
  };

  function style(){
    if($('#uxq-mission-identity-style')) return;
    const s=document.createElement('style');
    s.id='uxq-mission-identity-style';
    s.textContent=`.uxqMissionIdentity{border:1px solid rgba(110,231,255,.32);border-radius:18px;background:linear-gradient(135deg,rgba(110,231,255,.10),rgba(155,140,255,.11));padding:12px 14px;margin:0 0 14px;display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center}.uxqMissionIdentity .miIcon{font-size:1.75rem;line-height:1}.uxqMissionIdentity b{display:block;color:#fff;font-size:1rem}.uxqMissionIdentity span{display:block;color:#cfe0ff;line-height:1.45;font-size:.9rem}.uxqMissionIdentity small{display:block;color:#8fdfff;margin-top:3px;font-weight:800}.uxqMissionChip{display:inline-flex;gap:6px;align-items:center;border:1px solid rgba(110,231,255,.35);border-radius:999px;padding:6px 9px;background:rgba(110,231,255,.08);color:#dff7ff;font-weight:850;font-size:.78rem;margin-left:6px}`;
    document.head.appendChild(s);
  }
  function profile(){ return profiles[nodeId()] || profiles.W1; }
  function injectGame(){
    const p=profile();
    const game=$('.game');
    if(!game || game.dataset.missionIdentity===nodeId()) return;
    const id=document.createElement('section');
    id.className='uxqMissionIdentity';
    id.innerHTML=`<div class="miIcon">${p[0]}</div><div><b>${p[1]}</b><span>${p[2]}</span><small>${p[3]}</small></div>`;
    game.insertBefore(id, game.firstChild);
    game.dataset.missionIdentity=nodeId();
    const brand=$('.top .brand span:last-child');
    if(brand && !text(brand).includes(p[1])) brand.textContent=`${nodeId()} • ${p[1]}`;
  }
  function injectIntro(){
    const p=profile();
    const hero=$('.hero');
    if(!hero || hero.dataset.missionIdentity===nodeId()) return;
    const title=$('.title', hero);
    if(title) title.textContent=`${p[0]} ${nodeId()} • ${p[1]}`;
    const lede=$('.lede', hero);
    if(lede) lede.textContent=`${p[2]} — ${p[3]}`;
    hero.dataset.missionIdentity=nodeId();
  }
  function apply(){ style(); injectIntro(); injectGame(); }
  let timer=0; function schedule(){ clearTimeout(timer); timer=setTimeout(apply,30); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',schedule,{once:true}); else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
