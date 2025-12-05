// === hydration.safe.js (updated with coach movement) ===
import CoachVR from './hydration.coach.js';

export function safeSetup(game) {

  window.addEventListener('DOMContentLoaded', () => {
    CoachVR.init();
  });

  // ดักทุกเป้าที่ spawn
  game.on('spawn', t => {
    // auto-move coach ออกไปอีกฝั่ง
    CoachVR.avoidTarget(t.x);

    // ตรวจว่าตรงโค้ชหรือใกล้
    const dist = Math.abs(t.x - (window.innerWidth / 2));
    const near = dist < 160;
    CoachVR.nearTarget(near);
  });

  // เมื่อผ่าน mission หรือ mini quest
  game.on('mission:new', text => {
    CoachVR.bounce(`🎉 ภารกิจใหม่: ${text}`);
  });
}
