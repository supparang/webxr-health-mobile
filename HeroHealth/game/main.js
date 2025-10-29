/* ----- Imports (core) ----- */
import { HUD }            from './core/hud.js';
import { SFX, sfx }       from './core/sfx.js';
import { ScoreSystem }    from './core/score.js';
import { PowerUpSystem }  from './core/powerup.js';
import { MissionSystem }  from './core/mission-system.js';
import { Quests }         from './core/quests.js';
import { Progress }       from './core/progression.js';
import { Leaderboard }    from './core/leaderboard.js';
import { VRInput }        from './core/vrinput.js';
import FX                 from './core/fx.js';           // ★ ใช้ default namespace

// ... โค้ดเดิมทั้งหมดของคุณ

// (ถ้ามีที่ใดอ้าง add3DTilt/shatter3D โดยตรง เปลี่ยนเป็นใช้ผ่าน FX.*)
const EngineFX = {
  popText(txt, {x,y,ms=700}={}){
    try{
      const el=document.createElement('div');
      el.textContent=txt;
      el.style.cssText=`position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
        pointer-events:none;z-index:120;font:900 14px ui-rounded;color:#dbfffb;text-shadow:0 2px 8px #0009`;
      document.body.appendChild(el);
      el.animate([{opacity:1, transform:'translate(-50%,-50%) scale(1)'},
                  {opacity:0, transform:'translate(-50%,-80%) scale(.9)'}],
                 {duration:ms, easing:'ease-out'}).onfinish=()=>{try{el.remove();}catch{}};
    }catch{}
  },
  add3DTilt: FX.add3DTilt,      // ★ map ผ่าน namespace
  shatter3D: FX.shatter3D
};

// จากนั้นจุดที่ main เคยส่ง engine.fx ให้โหมดต่าง ๆ ให้ใช้ EngineFX
// ตัวอย่าง (ถ้าคุณมี object/ตัวแปร engine อยู่แล้ว):
// engine.fx = EngineFX;
// หรือเวลาส่งใน create({ engine, hud, coach }) ของแต่ละโหมด ให้ส่ง { fx: EngineFX }
try { window.__HHA_FX_NS__ = EngineFX; } catch {}
