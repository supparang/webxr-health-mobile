(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // เส้นทางไปยังแต่ละเกม
  const ENTRY = {
    "shadow-breaker": "../shadow-breaker/index.html",
    "rhythm-boxer": "../rhythm-boxer/index.html",
    "jump-duck": "../jump-duck/index.html",
    "balance-hold": "../balance-hold/index.html",
  };

  function navigateTo(game, params) {
    const base = ENTRY[game] || `../${game}/index.html`;
    const url = new URL(base, location.href);
    if (params) url.search = params.toString();
    location.href = url.toString();
  }

  function ready() {
    const title = document.getElementById("title");
    const desc = document.getElementById("desc");
    const pill = document.getElementById("pill");
    const status = document.getElementById("status");

    // ภาษา
    document.getElementById("btnLang").onclick = () => {
      APP.i18n.set(APP.i18n.current === "en" ? "th" : "en");
    };

    document.addEventListener("i18n:change", () => {
      title.textContent = APP.i18n.t("hub_title");
      desc.textContent = APP.i18n.t("hub_desc");
    });

    // เสียง
    document.getElementById("btnMute").onclick = () => {
      const muted = APP.audio.toggle();
      document.getElementById("btnMute").textContent = muted ? "🔇 Muted" : "🔈 Sound";
    };

    // ปุ่ม Start ของแต่ละเกม
    $$(".card").forEach((card) => {
      const game = card.getAttribute("data-game");
      const selMode = $(".selMode", card);
      const selDiff = $(".selDiff", card);
      $(".start", card).addEventListener("click", async () => {
        try {
          await APP.audio.init();
        } catch (e) {}
        const params = new URLSearchParams({
          mode: selMode.value,
          diff: selDiff.value,
          lang: APP.i18n.current,
        });
        navigateTo(game, params);
      });
    });

    function render() {
      const s = APP.state;
      pill.textContent = `lang:${s.lang}`;
      status.textContent = `scene:${s.scene}`;
    }

    document.addEventListener("app:state-change", render);
    render();
  }

  document.addEventListener("DOMContentLoaded", ready);
})();
