// === /herohealth/vr-groups/ui.js ===
// HUD สำหรับ Groups VR — แสดง Goal + Mini Quest แบบ emoji-friendly 🥦🍎🎯
// 2025-12-05

(function (ns) {
  'use strict';

  let wrap = null, goalBox = null, miniBox = null, questText = null;

  function el(tag, cls, text) {
    const x = document.createElement(tag);
    if (cls) x.className = cls;
    if (text) x.textContent = text;
    return x;
  }

  function ensureUI() {
    if (wrap) return wrap;

    wrap = el('div', 'quest-hud');
    goalBox = el('div', 'quest-goal');
    miniBox = el('div', 'quest-mini');
    questText = el('div', 'quest-status');

    wrap.append(goalBox, miniBox, questText);
    document.body.appendChild(wrap);

    const style = document.createElement('style');
    style.textContent = `
      .quest-hud {
        position: fixed;
        top: 8px;
        left: 50%;
        transform: translateX(-50%);
        text-align: center;
        font-family: system-ui, sans-serif;
        color: #fff;
        background: rgba(0,0,0,0.45);
        padding: 8px 14px;
        border-radius: 14px;
        line-height: 1.3;
        z-index: 20;
        max-width: 90%;
      }
      .quest-goal, .quest-mini {
        font-size: 15px;
        margin: 2px 0;
      }
      .quest-status {
        font-size: 13px;
        color: #d1d5db;
      }
      .quest-hud span.emoji {
        margin-right: 4px;
      }
    `;
    document.head.appendChild(style);

    return wrap;
  }

  function emojiFor(label) {
    label = label || '';
    if (label.includes('ผัก')) return '🥦';
    if (label.includes('ผลไม้')) return '🍎';
    if (label.includes('โปรตีน')) return '🍗';
    if (label.includes('นม')) return '🥛';
    if (label.includes('ข้าว')) return '🍚';
    if (label.includes('จังค์') || label.includes('ของไม่ดี')) return '🍩';
    if (label.includes('หมู่')) return '🌈';
    return '🎯';
  }

  function setQuest(goal, mini) {
    ensureUI();
    if (goal) {
      goalBox.innerHTML = `<span class="emoji">${emojiFor(goal.label)}</span>${goal.label} (${goal.prog || 0}/${goal.target})`;
    } else {
      goalBox.innerHTML = '';
    }

    if (mini) {
      miniBox.innerHTML = `<span class="emoji">${emojiFor(mini.label)}</span>${mini.label} (${mini.prog || 0}/${mini.target})`;
    } else {
      miniBox.innerHTML = '';
    }

    const total = `${goal ? goal.prog || 0 : 0}/${goal ? goal.target : 0}`;
    questText.textContent = goal ? `ภารกิจหลัก: ${total}` : '';
  }

  function attach() {
    ensureUI();
    window.addEventListener('quest:update', (ev) => {
      const d = ev.detail || {};
      setQuest(d.goal, d.mini);
    });
  }

  ns.foodGroupsUI = { attach };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));