// === modes/hydration.js (zone sim + clicks: water/sweet; quest hooks)
export const name = 'hydration';

// โซน: LOW < OK < HIGH
const Z = { LOW:'LOW', OK:'OK', HIGH:'HIGH' };

export function create({ engine, hud, coach }){
  const host = document.getElementById('spawnHost');
  let ended=false, secAcc=0;

  // ค่า “สมดุลน้ำ” 0..100 (เริ่มกลาง)
  let meter = 50;
  let zone  = Z.OK;

  // UI: ปุ่มจิบ (น้ำ/หวาน) + เกจข้อความ
  function buildUI(){
    host.innerHTML = `
      <div style="position:absolute;left:50%;top:24px;transform:translateX(-50%);display:flex;gap:10px;z-index:90">
        <button id="btn_water" class="chip">💧 Water</button>
        <button id="btn_sweet" class="chip">🍬 Sweet</button>
      </div>
      <div id="hydroHud" style="position:absolute;left:50%;top:64px;transform:translateX(-50%);z-index:90;font:900 14px ui-rounded"></div>
    `;
    document.getElementById('btn_water')?.addEventListener('click', ()=>{
      const beforeZone = zone;
      meter = Math.min(100, meter + 9);
      window.HHA?.bus?.hydrationClick?.('water', beforeZone);
      coach?.say?.('จิบพอดี ๆ');
      checkZoneCross(beforeZone);
      render();
    });
    document.getElementById('btn_sweet')?.addEventListener('click', ()=>{
      const beforeZone = zone;
      meter = Math.max(0, meter - 14);
      window.HHA?.bus?.hydrationClick?.('sweet', beforeZone);
      coach?.say?.('หวานช่วยลดได้เมื่อสูง');
      checkZoneCross(beforeZone);
      render();
    });
  }

  function zoneOf(v){
    if (v < 35) return Z.LOW;
    if (v > 70) return Z.HIGH;
    return Z.OK;
  }

  function checkZoneCross(before){
    const after = zoneOf(meter);
    if (after !== zone){
      // cross
      window.HHA?.bus?.hydrationCross?.(zone, after);
      // นับ quest (recover low: LOW -> OK)
      // treat high: click sweet while HIGH handled via click meta
      zone = after;
    }
  }

  function render(){
    const el = document.getElementById('hydroHud');
    if (!el) return;
    el.textContent = `Hydration: ${meter|0} • Zone: ${zone}`;
  }

  return {
    start(){
      ended=false; buildUI(); meter=50; zone=Z.OK; render();
      coach?.say?.((navigator.language||'th').startsWith('th') ? 'รักษาโซน OK ให้นานที่สุด' : 'Stay in OK zone!');
    },
    update(dt){
      if (ended) return;
      secAcc += dt;
      // ไหลเองทีละน้อย
      if (secAcc >= 1){
        secAcc = 0;
        // แนวโน้มไหลกลับเข้า OK
        if (zone === Z.LOW)  meter = Math.min(100, meter + 3);
        if (zone === Z.HIGH) meter = Math.max(0,   meter - 4);
        // tick & zone report
        window.HHA?.bus?.hydrationTick?.(zone);
        render();
      }
      // โอกาสสุ่มเบี่ยงเบนเล็กน้อย
      if (Math.random()<0.02){ const before=zone; meter = Math.max(0, Math.min(100, meter + (Math.random()*8-4))); checkZoneCross(before); }
    },
    stop(){ ended=true; try{ host.innerHTML=''; }catch{}; }
  };
}
