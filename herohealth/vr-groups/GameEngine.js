    // ---------- spawn target (emoji sprite) ----------
    spawnTarget: function () {
      const emojiMod = ns.foodGroupsEmoji;
      let item = null;

      if (emojiMod && typeof emojiMod.pickRandom === 'function') {
        item = emojiMod.pickRandom(); // {emoji, group, isGood, name, ...}
      }
      if (!item) {
        item = { emoji: '🍎', group: 1, isGood: true, name: 'ผลไม้' };
      }

      const scale = this.cfg.scale || 1.0;

      // ===== พื้นที่สุ่มเป้าให้โผล่กลางจอ =====
      // คุมขอบซ้ายขวา
      const xMin = -1.6;
      const xMax =  1.6;
      // ดันขึ้นจากขอบล่าง ให้เล่นกลางจอมากขึ้น
      const yMin = 0.9;
      const yMax = 2.0;

      let x = xMin + Math.random() * (xMax - xMin);
      let y = yMin + Math.random() * (yMax - yMin);
      const z = -2.3;

      // กันเป้าซ้อนกันเกินไป (เช็คระยะห่างจากเป้าอื่น)
      const minDist2 = 0.7 * 0.7;
      for (let tries = 0; tries < 6; tries++) {
        let ok = true;
        for (let i = 0; i < this.targets.length; i++) {
          const t = this.targets[i];
          const p = t.object3D ? t.object3D.position : t.getAttribute('position');
          if (!p) continue;
          const dx = p.x - x;
          const dy = p.y - y;
          if (dx * dx + dy * dy < minDist2) {
            ok = false;
            break;
          }
        }
        if (ok) break;
        x = xMin + Math.random() * (xMax - xMin);
        y = yMin + Math.random() * (yMax - yMin);
      }

      const el = document.createElement('a-entity');
      el.setAttribute('data-hha-tgt', '1');
      el.setAttribute('position', { x, y, z });

      // ฐานวงกลม
      const baseColor = item.isGood ? '#16a34a' : '#ea580c';
      el.setAttribute('geometry', {
        primitive: 'circle',
        radius: 0.45 * scale,
        segments: 48
      });
      el.setAttribute('material', {
        color: baseColor,
        opacity: 1.0,
        shader: 'flat',
        side: 'double'
      });

      // ขอบเข้ม
      const rim = document.createElement('a-entity');
      rim.setAttribute('geometry', {
        primitive: 'ring',
        radiusInner: 0.47 * scale,
        radiusOuter: 0.55 * scale,
        segmentsTheta: 64
      });
      rim.setAttribute('material', {
        color: '#020617',
        shader: 'flat',
        side: 'double'
      });
      rim.setAttribute('position', { x: 0, y: 0, z: 0.001 });
      el.appendChild(rim);

      // ===== emoji การ์ตูน =====
      const emojiChar = item.emoji || '🍎';
      let emojiTex = null;
      if (window.emojiImage && typeof window.emojiImage === 'function') {
        try {
          emojiTex = window.emojiImage(emojiChar);
        } catch (e) {
          console.warn('[GroupsVR] emojiImage error', e);
        }
      }

      if (emojiTex) {
        const sprite = document.createElement('a-entity');
        sprite.setAttribute('geometry', {
          primitive: 'circle',
          radius: 0.33 * scale,
          segments: 48
        });
        sprite.setAttribute('material', {
          src: emojiTex,
          transparent: true,
          side: 'double'
        });
        sprite.setAttribute('position', { x: 0, y: 0, z: 0.002 });
        sprite.setAttribute('look-at', '[camera]');
        el.appendChild(sprite);
      } else {
        // fallback เป็นตัวอักษร emoji ถ้ายังไม่มี texture
        const txt = document.createElement('a-entity');
        txt.setAttribute('text', {
          value: emojiChar,
          align: 'center',
          color: '#ffffff',
          width: 2.0 * scale,
          baseline: 'center'
        });
        txt.setAttribute('position', { x: 0, y: 0, z: 0.01 });
        txt.setAttribute('look-at', '[camera]');
        el.appendChild(txt);
      }

      const groupId = item && item.group != null ? item.group : 0;
      const isGood = item && item.isGood ? 1 : 0;
      el.setAttribute('data-group', String(groupId));
      el.setAttribute('data-good', String(isGood));

      el._life = 3200;
      el._age = 0;
      el._spawnTime = performance.now();
      el._metaItem = item || {};

      const self = this;
      el.addEventListener('click', function () {
        self.onHit(el);
      });

      this.el.sceneEl.appendChild(el);
      this.targets.push(el);
    },
