export async function createPlateSoloAdapter(ctx, shell) {
  let root;
  let score = 0;
  let done = 0;
  const total = 3;

  return {
    async mount(stage) {
      root = document.createElement('div');
      root.style.cssText = 'padding:24px;display:grid;place-items:center;min-height:100%';
      root.innerHTML = `
        <div style="max-width:680px;width:100%;padding:24px;border-radius:24px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)">
          <h2>Plate Solo Starter</h2>
          <p>โครงเริ่มต้นสำหรับเสียบเกมจริง</p>
          <button id="demoScore">+Score</button>
          <button id="demoMission">+Mission</button>
          <button id="demoEnd">End</button>
        </div>
      `;
      stage.appendChild(root);

      root.querySelector('#demoScore').addEventListener('click', () => {
        score += 100;
        shell.setScore(score);
      });

      root.querySelector('#demoMission').addEventListener('click', () => {
        done += 1;
        shell.setMission(done, total);
      });

      root.querySelector('#demoEnd').addEventListener('click', () => {
        shell.endGame({
          success: done >= total,
          stars: done >= total ? 3 : 1,
          accuracy: 92,
          miss: 1,
          bestStreak: 5,
          rewards: ['plate-starter'],
          coachFeedback: ['จัดสัดส่วนอาหารได้ดีขึ้นแล้ว'],
          nextAction: 'ลองเพิ่มความยาก normal รอบถัดไป'
        });
      });
    },
    async start() {
      shell.setScore(0);
      shell.setMission(0, total);
    },
    getSummary() {
      return {
        success: done >= total,
        stars: done >= total ? 3 : 1,
        accuracy: 92,
        miss: 1,
        bestStreak: 5,
        rewards: ['plate-starter'],
        coachFeedback: ['จัดสัดส่วนอาหารได้ดีขึ้นแล้ว'],
        nextAction: 'ลองเพิ่มความยาก normal รอบถัดไป'
      };
    }
  };
}