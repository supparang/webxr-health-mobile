(function () {
  window.APP = window.APP || {};
  const THEMES = {
    "shadow-breaker": [
      { sky: "#0e0f12", ground: "#222", fog: "color: #0e0f12; near: 2; far: 20", light: { amb: 0.6, dir: 0.9 } },
      { sky: "#141016", ground: "#1f1f25", fog: "color: #141016; near: 2; far: 18", light: { amb: 0.7, dir: 0.8 } },
    ],
    "rhythm-boxer": [
      { sky: "#080818", ground: "#1c1c2c", fog: "color: #080818; near: 3; far: 22", light: { amb: 0.8, dir: 1.0 } },
      { sky: "#0a0a20", ground: "#181828", fog: "color: #0a0a20; near: 3; far: 20", light: { amb: 0.7, dir: 1.1 } },
    ],
    "jump-duck": [
      { sky: "#101018", ground: "#262626", fog: "color: #101018; near: 4; far: 26", light: { amb: 0.7, dir: 0.9 } },
      { sky: "#0f1418", ground: "#22282a", fog: "color: #0f1418; near: 4; far: 24", light: { amb: 0.8, dir: 0.8 } },
    ],
    "balance-hold": [
      { sky: "#0f1210", ground: "#203020", fog: "color: #0f1210; near: 3; far: 20", light: { amb: 0.75, dir: 0.9 } },
      { sky: "#10140f", ground: "#1e2a1e", fog: "color: #10140f; near: 3; far: 22", light: { amb: 0.8, dir: 0.85 } },
    ],
  };

  function apply(gameKey) {
    const arr = THEMES[gameKey] || THEMES["shadow-breaker"];
    const pick = arr[Math.floor(Math.random() * arr.length)];

    const scene = document.querySelector("a-scene");
    if (!scene) return;

    // background sky
    scene.setAttribute("background", `color: ${pick.sky}`);
    // fog
    scene.setAttribute("fog", pick.fog);

    // ground plane
    const ground = document.querySelector("a-plane");
    if (ground) ground.setAttribute("color", pick.ground);

    // lights
    const amb = document.querySelector("a-entity[light^='type:ambient']");
    const dir = document.querySelector("a-entity[light^='type:directional']");
    if (amb) amb.setAttribute("light", `type:ambient; intensity:${pick.light.amb}`);
    if (dir) dir.setAttribute("light", `type:directional; intensity:${pick.light.dir}`);
  }

  APP.theme = { apply };
})();
