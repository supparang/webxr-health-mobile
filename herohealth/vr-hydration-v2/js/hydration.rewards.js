// === /herohealth/vr-hydration-v2/js/hydration.rewards.js ===
// Hydration V2 Uncertain Rewards
// PATCH v20260317b-HYDRATION-V2-REWARDS

export function maybeCreateReward({ state = {}, trigger = 'combo', randomFn = Math.random } = {}) {
  const chance = trigger === 'combo' ? 0.34 : 0.24;
  if (randomFn() > chance) return null;

  const pool = trigger === 'combo'
    ? [
        {
          id: 'time-bonus',
          title: 'Lucky Bubble +5s',
          text: 'ได้เวลาพิเศษเพิ่ม 5 วินาที',
          type: 'time_bonus',
          ms: 5000
        },
        {
          id: 'point-boost',
          title: 'Double Drop',
          text: 'คะแนนจากน้ำ x2 ชั่วคราว',
          type: 'point_boost',
          ms: 8000
        },
        {
          id: 'shield',
          title: 'Clean Shield',
          text: 'ป้องกันการแตะหวานผิดได้ 1 ครั้ง',
          type: 'shield',
          count: 1
        }
      ]
    : [
        {
          id: 'smart-bonus',
          title: 'Smart Sip +6',
          text: 'ได้คะแนนพิเศษทันทีจากการเล่นสม่ำเสมอ',
          type: 'smart_bonus',
          points: 6
        },
        {
          id: 'time-bonus',
          title: 'Lucky Bubble +5s',
          text: 'ได้เวลาพิเศษเพิ่ม 5 วินาที',
          type: 'time_bonus',
          ms: 5000
        },
        {
          id: 'shield',
          title: 'Clean Shield',
          text: 'ป้องกันการแตะหวานผิดได้ 1 ครั้ง',
          type: 'shield',
          count: 1
        }
      ];

  return pool[Math.floor(randomFn() * pool.length)];
}

export function showRewardPopup(root, reward) {
  if (!root || !reward) return;
  root.innerHTML = `
    <div class="reward-title">🎁 ${escapeHtml(reward.title)}</div>
    <div class="reward-text">${escapeHtml(reward.text)}</div>
  `;

  root.classList.add('show');
  window.clearTimeout(root.__rewardTimer);
  root.__rewardTimer = window.setTimeout(() => {
    root.classList.remove('show');
  }, 1500);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}