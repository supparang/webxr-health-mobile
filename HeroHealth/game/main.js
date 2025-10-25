// บอกหน้า index ว่าบูตสำเร็จ (จะถูกเช็คโดย loader)
window.__HHA_BOOT_OK = true;

// กันโหลดซ้ำกรณีมีคนเผลอแปะ <script> ซ้ำในหน้าเดียว
if (window.__HHA_MAIN_ALREADY_MOUNTED) {
  console.warn('[HHA] main.js duplicated load — skipped');
  // return โดยไม่ทำอะไรต่อ ป้องกัน 'already been declared'
} else {
  window.__HHA_MAIN_ALREADY_MOUNTED = true;

  // ===== Imports (ต้อง relative จาก /HeroHealth/game/) =====
  import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
  import { Engine }       from './core/engine.js';
  import { HUD }          from './core/hud.js';
  import { SFX }          from './core/sfx.js';
  import { PowerUpSystem }from './core/powerup.js';
  import { ScoreSystem }  from './core/score.js';
  import { FloatingFX }   from './core/fx.js';
  import { Coach }        from './core/coach.js';

  import * as goodjunk  from './modes/goodjunk.js';
  import * as groups    from './modes/groups.js';
  import * as hydration from './modes/hydration.js';
  import * as plate     from './modes/plate.js';

  // …โค้ดเกมของคุณต่อจากนี้…
}
