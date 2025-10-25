// ต้องมีบรรทัดนี้ เพื่อให้ index รู้ว่าโหลดสำเร็จ
window.__HHA_BOOT_OK = true;

// imports ต้อง relative จากโฟลเดอร์ /HeroHealth/game/
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

// …โค้ดเกมคุณต่อจากนี้…
