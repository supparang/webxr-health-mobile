(function () {
  // ส่ง event เปลี่ยนสถานะให้ UI หรือระบบอื่นรู้
  const emit = (name, detail) =>
    document.dispatchEvent(new CustomEvent(name, { detail }));

  // ค่าเริ่มต้นของ state ทั้งระบบ
  const defaultState = {
    scene: "hub",
    game: "",
    mode: "timed",
    diff: "normal",
    lang: "en",
  };

  // ประกาศ namespace APP (กันตัวแปรหลุด global)
  window.APP = window.APP || {};
  APP.state = { ...defaultState };

  // ฟังก์ชันอัปเดต state
  APP.setState = function (partial) {
    APP.state = { ...APP.state, ...partial };
    emit("app:state-change", { state: APP.state });
  };
})();
