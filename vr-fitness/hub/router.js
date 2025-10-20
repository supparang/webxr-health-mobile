(function () {
  function applyURLParams() {
    const p = new URLSearchParams(location.search);
    const patch = {};

    // อ่านค่าจาก URL แล้วอัปเข้า APP.state
    ["game", "mode", "diff", "lang"].forEach((key) => {
      if (p.has(key)) patch[key] = p.get(key);
    });

    if (Object.keys(patch).length > 0) {
      APP.setState(patch);
    }
  }

  document.addEventListener("DOMContentLoaded", applyURLParams);
})();
