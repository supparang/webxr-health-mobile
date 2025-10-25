// ทำให้ index รู้ว่าโหลดสำเร็จ
window.__HHA_BOOT_OK = true;

// ป้องกันคนเผลอใส่สคริปต์ซ้ำในหน้าเดียว (hard guard)
if (window.__HHA_MAIN_ALREADY_MOUNTED) {
  // ถ้าเผลอโหลดซ้ำ ให้หยุดทำงานส่วนประกาศตัวแปร/ระบบ
  console.warn('[HHA] main.js duplicated load — skipping second mount');
} else {
  window.__HHA_MAIN_ALREADY_MOUNTED = true;

  // ===== imports (ต้องอยู่ top-level) =====
  import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
  import { Engine } from './core/engine.js';
  import { HUD } from './core/hud.js';
  import { SFX } from './core/sfx.js';
  import { PowerUpSystem } from './core/powerup.js';
  import { ScoreSystem } from './core/score.js';
  import { FloatingFX } from './core/fx.js';
  import { Coach } from './core/coach.js';
  import * as goodjunk  from './modes/goodjunk.js';
  import * as groups    from './modes/groups.js';
  import * as hydration from './modes/hydration.js';
  import * as plate     from './modes/plate.js';

  // …โค้ดเกมเดิมทั้งหมดของคุณ…
}
