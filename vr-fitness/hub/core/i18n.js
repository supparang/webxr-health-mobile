(function () {
  const DICT = {
    en: {
      hub_title: "VR Fitness — Hub",
      hub_desc: "Select a game, mode, and difficulty — then Start.",
      ready: "Ready?",
      press_start: "Press Start to begin",
    },
    th: {
      hub_title: "VR ฟิตเนส — ฮับ",
      hub_desc: "เลือกเกม โหมด และระดับความยาก จากนั้นกด Start",
      ready: "พร้อมไหม?",
      press_start: "กด Start เพื่อเริ่มเกม",
    },
  };

  window.APP = window.APP || {};

  APP.i18n = {
    current: "en",

    // ฟังก์ชันแปลข้อความ
    t(key) {
      const data = DICT[this.current] || DICT.en;
      return data[key] || key;
    },

    // เปลี่ยนภาษา
    set(lang) {
      this.current = lang === "th" ? "th" : "en";
      document.dispatchEvent(
        new CustomEvent("i18n:change", { detail: { lang: this.current } })
      );
    },
  };
})();
