(function(global){
  'use strict';

  function CoreClient(options) {
    options = options || {};
    this.endpoint = options.endpoint || '';
    this.module = 'AIQ3';
    this.timeoutMs = Number(options.timeoutMs || 20000);
  }

  CoreClient.prototype.request = async function(action, payload) {
    payload = Object.assign({}, payload || {}, {
      module: this.module,
      action: action
    });

    var controller = new AbortController();
    var timer = setTimeout(function(){ controller.abort(); }, this.timeoutMs);

    try {
      var res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!res.ok) throw new Error('HTTP_' + res.status);
      var data = await res.json();
      if (!data.ok) {
        var err = new Error(data.message || data.code || 'REQUEST_FAILED');
        err.code = data.code || 'REQUEST_FAILED';
        err.allowedNode = data.allowedNode || '';
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  };

  CoreClient.prototype.getProgress = function(identity) {
    return this.request('GET_PROGRESS', identity);
  };

  CoreClient.prototype.startNode = function(identity, nodeId) {
    return this.request('START_NODE', Object.assign({}, identity, {
      nodeId: nodeId,
      eventId: global.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      clientTs: new Date().toISOString()
    }));
  };

  CoreClient.saveProfileCache = function(profile) {
    try {
      localStorage.setItem('aiq3_profile_cache', JSON.stringify({
        studentId: profile.studentId || '',
        studentName: profile.studentName || '',
        section: profile.section || '',
        savedAt: Date.now()
      }));
    } catch (err) {}
  };

  CoreClient.loadProfileCache = function() {
    try {
      return JSON.parse(localStorage.getItem('aiq3_profile_cache') || 'null');
    } catch (err) {
      return null;
    }
  };

  global.AIQ3CoreClient = CoreClient;
})(window);
