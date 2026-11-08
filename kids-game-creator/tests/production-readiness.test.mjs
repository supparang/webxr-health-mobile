import { test } from "node:test";
import assert from "node:assert/strict";
import { validateGame, AGE_LEVELS } from "../js/game-schema.js";
import { createGameFromThai } from "../js/thai-game-planner.js";
import { mountAdventure } from "../js/adventure-engine.js";
import { mountMaze } from "../js/maze-engine.js";
import { mountDodge } from "../js/dodge-engine.js";
import { mountQuiz } from "../js/quiz-engine.js";
import { createAppServer } from "../server.js";

// Minimal headless Canvas & DOM shim for engine verification
function setupHeadlessEnv() {
  let rafCallback = null;
  globalThis.window = {
    addEventListener() {},
    removeEventListener() {}
  };
  globalThis.requestAnimationFrame = (cb) => {
    rafCallback = cb;
    return 1;
  };
  globalThis.cancelAnimationFrame = () => {
    rafCallback = null;
  };

  function createElement(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      textContent: "",
      className: "",
      style: {},
      dataset: {},
      hidden: false,
      disabled: false,
      children: [],
      attributes: {},
      append(...nodes) { this.children.push(...nodes); },
      replaceChildren(...nodes) { this.children = [...nodes]; },
      setAttribute(k, v) { this.attributes[k] = String(v); },
      addEventListener(evt, fn) { this["_on_" + evt] = fn; },
      click() { if (!this.disabled && this._on_click) this._on_click(); }
    };
    return el;
  }

  globalThis.document = { createElement };

  function createMockCanvas() {
    const ctx = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      font: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      globalAlpha: 1,
      shadowColor: "",
      shadowBlur: 0,
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      scale() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      quadraticCurveTo() {},
      arc() {},
      ellipse() {},
      rect() {},
      roundRect() {},
      fillRect() {},
      fill() {},
      stroke() {},
      fillText() {},
      setLineDash() {},
      createLinearGradient() {
        return { addColorStop() {} };
      }
    };
    return {
      width: 720,
      height: 400,
      dataset: {},
      getContext(type) {
        return type === "2d" ? ctx : null;
      },
      stepFrame(ts) {
        if (rafCallback) rafCallback(ts);
      }
    };
  }

  return { createMockCanvas, createElement };
}

test("All 4 engines mount, simulate frames, handle touch controls, restart, and destroy across all 4 grades & 3 challenge tiers", () => {
  const { createMockCanvas, createElement } = setupHeadlessEnv();
  const difficulties = [1, 3, 4, 5];

  for (const age of AGE_LEVELS) {
    for (const diff of difficulties) {
      // 1. Adventure Engine
      const advCanvas = createMockCanvas();
      const advGame = validateGame({
        type: "adventure",
        ageLevel: age,
        theme: "space",
        player: { name: "หุ่นยนต์", lives: 3 },
        rules: { difficulty: diff, targetScore: 10, levels: 2, enemyCount: 4, timeLimit: 60 }
      });
      let advStatus = "";
      const advInstance = mountAdventure(advCanvas, advGame, msg => { advStatus = msg; });
      advInstance.setTouch("right", true);
      advInstance.setTouch("jump", true);
      advCanvas.stepFrame(16);
      advCanvas.stepFrame(40);
      advInstance.setTouch("right", false);
      advInstance.setTouch("jump", false);
      advInstance.restart();
      assert.equal(advStatus, "เริ่มเกมแล้ว");
      advInstance.destroy();

      // 2. Maze Engine
      const mazeCanvas = createMockCanvas();
      const mazeGame = validateGame({
        type: "maze",
        ageLevel: age,
        theme: "castle",
        player: { name: "แมว", lives: 3 },
        rules: { difficulty: diff, levels: 2, timeLimit: 60 }
      });
      let mazeStatus = "";
      const mazeInstance = mountMaze(mazeCanvas, mazeGame, msg => { mazeStatus = msg; });
      mazeInstance.setTouch("right", true);
      mazeInstance.setTouch("down", true);
      mazeCanvas.stepFrame(200);
      mazeInstance.setTouch("right", false);
      mazeInstance.setTouch("down", false);
      mazeInstance.restart();
      assert.match(mazeStatus, /เขาวงกตด่าน 1/);
      mazeInstance.destroy();

      // 3. Dodge Engine
      const dodgeCanvas = createMockCanvas();
      const dodgeGame = validateGame({
        type: "dodge",
        ageLevel: age,
        theme: "ocean",
        player: { name: "ยานอวกาศ", lives: 3 },
        rules: { difficulty: diff, targetScore: 10, levels: 2, timeLimit: 60 }
      });
      let dodgeStatus = "";
      const dodgeInstance = mountDodge(dodgeCanvas, dodgeGame, msg => { dodgeStatus = msg; });
      dodgeInstance.setTouch("left", true);
      for (let f = 1; f <= 15; f++) dodgeCanvas.stepFrame(f * 16);
      dodgeInstance.setTouch("left", false);
      dodgeInstance.restart();
      assert.equal(dodgeStatus, "เริ่มเกมหลบสิ่งกีดขวาง");
      dodgeInstance.destroy();

      // 4. Quiz Engine
      const quizContainer = createElement("section");
      const quizGame = validateGame({
        type: "quiz",
        ageLevel: age,
        rules: { difficulty: diff }
      });
      let quizStatus = "";
      const quizInstance = mountQuiz(quizContainer, quizGame, "สร้างเกมตอบคำถามวิทยาศาสตร์", msg => { quizStatus = msg; });
      assert.equal(quizStatus, "เริ่มเกมตอบคำถาม");
      assert.equal(quizContainer.hidden, false);
      quizInstance.restart();
      quizInstance.destroy();
      assert.equal(quizContainer.hidden, true);
    }
  }
});

test("Production HTTP server serves static files, healthz, and security headers", async () => {
  const server = createAppServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Health check endpoint
    const healthRes = await fetch(`${baseUrl}/healthz`);
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.headers.get("x-content-type-options"), "nosniff");
    const healthData = await healthRes.json();
    assert.equal(healthData.status, "ok");

    // 2. Index HTML
    const indexRes = await fetch(`${baseUrl}/`);
    assert.equal(indexRes.status, 200);
    assert.match(indexRes.headers.get("content-type"), /text\/html/);
    const html = await indexRes.text();
    assert.ok(html.includes("Kids Game Creator"));
    assert.ok(html.includes("modeFreeformBtn"));

    // 3. 404 Not Found
    const missingRes = await fetch(`${baseUrl}/non-existent-file.js`);
    assert.equal(missingRes.status, 404);

    // 4. 405 Method Not Allowed on POST
    const postRes = await fetch(`${baseUrl}/`, { method: "POST" });
    assert.equal(postRes.status, 405);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
