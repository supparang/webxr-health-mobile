// EXO Metrics System (Basic Version)
window.EXO_METRICS = (function () {

  class Recorder {
    constructor(moduleName = "UNKNOWN") {
      this.module = moduleName;
      this.events = [];
    }

    // เก็บข้อมูลแต่ละ event
    log(event) {
      this.events.push({
        t: EXO.now(),
        ...event
      });
    }

    // สรุปข้อมูลง่าย ๆ
    summary() {
      return {
        module: this.module,
        totalEvents: this.events.length
      };
    }
  }

  return {
    Recorder
  };
})();
