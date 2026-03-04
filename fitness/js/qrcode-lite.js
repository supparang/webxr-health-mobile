// === /fitness/js/qrcode-lite.js ===
// Lightweight QR generator (canvas) — minimal wrapper around a small QR algorithm
// API: QRLite.toCanvas(canvas, text, { size, margin })

'use strict';

/* eslint-disable */
(function(global){
  // ---- Minimal QR (based on small qrcode-generator style; compact build) ----
  // This is a compact QR encoder sufficient for URLs (Byte mode).
  // Not a full-featured QR toolbox, but stable for our use: short/medium URLs.

  // ====== BEGIN tiny QR implementation ======
  // (Keep this file as-is; do not edit unless necessary)

  function QRMath(){
    const EXP_TABLE = new Array(256);
    const LOG_TABLE = new Array(256);
    for(let i=0;i<8;i++) EXP_TABLE[i] = 1 << i;
    for(let i=8;i<256;i++) EXP_TABLE[i] = EXP_TABLE[i-4]^EXP_TABLE[i-5]^EXP_TABLE[i-6]^EXP_TABLE[i-8];
    for(let i=0;i<255;i++) LOG_TABLE[EXP_TABLE[i]] = i;
    this.gexp = function(n){
      while(n<0) n += 255;
      while(n>=256) n -= 255;
      return EXP_TABLE[n];
    };
    this.glog = function(n){
      if(n<1) throw new Error("glog");
      return LOG_TABLE[n];
    };
  }
  const QR_MATH = new QRMath();

  function QRPolynomial(num, shift){
    let offset = 0;
    while(offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + (shift||0));
    for(let i=0;i<num.length - offset;i++) this.num[i] = num[i+offset];
    this.get = (i)=> this.num[i];
    this.getLength = ()=> this.num.length;
    this.multiply = (e)=>{
      const r = new Array(this.getLength() + e.getLength() - 1).fill(0);
      for(let i=0;i<this.getLength();i++){
        for(let j=0;j<e.getLength();j++){
          r[i+j] ^= QR_MATH.gexp(QR_MATH.glog(this.get(i)) + QR_MATH.glog(e.get(j)));
        }
      }
      return new QRPolynomial(r,0);
    };
    this.mod = (e)=>{
      if(this.getLength() - e.getLength() < 0) return this;
      const ratio = QR_MATH.glog(this.get(0)) - QR_MATH.glog(e.get(0));
      const r = this.num.slice();
      for(let i=0;i<e.getLength();i++){
        r[i] ^= QR_MATH.gexp(QR_MATH.glog(e.get(i)) + ratio);
      }
      return new QRPolynomial(r,0).mod(e);
    };
  }

  const QRMode = { MODE_8BIT_BYTE: 1<<2 };

  const QRErrorCorrectLevel = { L:1, M:0, Q:3, H:2 }; // (we'll use M)

  function QRBitBuffer(){
    this.buffer = [];
    this.length = 0;
    this.get = function(i){
      const b = Math.floor(i/8);
      return ((this.buffer[b] >>> (7 - i%8)) & 1) === 1;
    };
    this.put = function(num, len){
      for(let i=0;i<len;i++) this.putBit(((num >>> (len-i-1)) & 1) === 1);
    };
    this.putBit = function(bit){
      const b = Math.floor(this.length/8);
      if(this.buffer.length <= b) this.buffer.push(0);
      if(bit) this.buffer[b] |= (0x80 >>> (this.length % 8));
      this.length++;
    };
  }

  function QRRSBlock(totalCount, dataCount){
    this.totalCount = totalCount;
    this.dataCount = dataCount;
  }

  // RS blocks for Version 4, EC=M (good for medium URLs)
  // v4-M: total 100 codewords, data 64, ec 36 (single block)
  function getRSBlocks(){
    return [ new QRRSBlock(100, 64) ];
  }

  function getErrorCorrectPolynomial(ecLen){
    let a = new QRPolynomial([1],0);
    for(let i=0;i<ecLen;i++){
      a = a.multiply(new QRPolynomial([1, QR_MATH.gexp(i)],0));
    }
    return a;
  }

  function createData(text){
    const rsBlocks = getRSBlocks();
    const buffer = new QRBitBuffer();

    // mode
    buffer.put(QRMode.MODE_8BIT_BYTE, 4);

    // length (for v1..v9 => 8 bits)
    buffer.put(text.length, 8);

    // bytes
    for(let i=0;i<text.length;i++){
      buffer.put(text.charCodeAt(i), 8);
    }

    // terminator
    const totalDataCount = rsBlocks.reduce((s,b)=>s+b.dataCount,0);
    if(buffer.length + 4 <= totalDataCount*8) buffer.put(0,4);

    // pad to byte
    while(buffer.length % 8 !== 0) buffer.putBit(false);

    // pad bytes
    const PAD0 = 0xEC, PAD1 = 0x11;
    while(buffer.buffer.length < totalDataCount){
      buffer.put(PAD0,8);
      if(buffer.buffer.length >= totalDataCount) break;
      buffer.put(PAD1,8);
    }

    // create codewords with EC
    let offset = 0;
    const dcdata = [];
    const ecdata = [];

    for(const rs of rsBlocks){
      const dcCount = rs.dataCount;
      const ecCount = rs.totalCount - rs.dataCount;

      const dc = new Array(dcCount);
      for(let i=0;i<dcCount;i++) dc[i] = 0xff & buffer.buffer[i+offset];
      offset += dcCount;
      dcdata.push(dc);

      const rsPoly = getErrorCorrectPolynomial(ecCount);
      const rawPoly = new QRPolynomial(dc, rsPoly.getLength()-1);
      const modPoly = rawPoly.mod(rsPoly);

      const ec = new Array(ecCount).fill(0);
      const modLen = modPoly.getLength();
      for(let i=0;i<ecCount;i++){
        const p = i + modLen - ecCount;
        ec[i] = p >= 0 ? modPoly.get(p) : 0;
      }
      ecdata.push(ec);
    }

    // interleave
    const totalCodeCount = rsBlocks.reduce((s,b)=>s+b.totalCount,0);
    const data = new Array(totalCodeCount);
    let index = 0;
    for(let i=0;i<rsBlocks[0].dataCount;i++){
      data[index++] = dcdata[0][i];
    }
    for(let i=0;i<ecdata[0].length;i++){
      data[index++] = ecdata[0][i];
    }
    return data;
  }

  // QR matrix for Version 4 (size 33)
  function QRCodeModel(text){
    this.typeNumber = 4;
    this.errorCorrectLevel = QRErrorCorrectLevel.M;
    this.modules = null;
    this.moduleCount = 0;

    this.make = ()=>{
      this.moduleCount = this.typeNumber*4 + 17; // 33
      this.modules = new Array(this.moduleCount);
      for(let row=0; row<this.moduleCount; row++){
        this.modules[row] = new Array(this.moduleCount).fill(null);
      }
      setupPositionProbePattern(this, 0, 0);
      setupPositionProbePattern(this, this.moduleCount - 7, 0);
      setupPositionProbePattern(this, 0, this.moduleCount - 7);
      setupTimingPattern(this);
      setupAlignmentPattern(this);
      setupTypeInfo(this, 0); // mask 0
      mapData(this, createData(text), 0);
    };

    this.isDark = (r,c)=> this.modules[r][c] === true;
    this.getModuleCount = ()=> this.moduleCount;
  }

  function setupPositionProbePattern(qr, row, col){
    for(let r=-1;r<=7;r++){
      if(row+r<=-1 || qr.moduleCount<=row+r) continue;
      for(let c=-1;c<=7;c++){
        if(col+c<=-1 || qr.moduleCount<=col+c) continue;
        const inBox = (0<=r && r<=6 && (c===0||c===6)) || (0<=c && c<=6 && (r===0||r===6)) || (2<=r && r<=4 && 2<=c && c<=4);
        qr.modules[row+r][col+c] = inBox;
      }
    }
  }
  function setupTimingPattern(qr){
    for(let i=8;i<qr.moduleCount-8;i++){
      if(qr.modules[i][6] === null) qr.modules[i][6] = (i%2===0);
      if(qr.modules[6][i] === null) qr.modules[6][i] = (i%2===0);
    }
  }
  function setupAlignmentPattern(qr){
    // Version 4 alignment center at 26
    const pos = [6, 26];
    for(let i=0;i<pos.length;i++){
      for(let j=0;j<pos.length;j++){
        const row = pos[i], col = pos[j];
        if(qr.modules[row][col] !== null) continue;
        for(let r=-2;r<=2;r++){
          for(let c=-2;c<=2;c++){
            qr.modules[row+r][col+c] = (Math.max(Math.abs(r),Math.abs(c)) !== 1);
          }
        }
      }
    }
  }
  function setupTypeInfo(qr, maskPattern){
    // errorCorrect=M, mask=0 => type info bits precomputed for simplicity
    // We'll use fixed type info for (M,0): 101010000010010 (15 bits)
    const bits = 0b101010000010010;
    for(let i=0;i<15;i++){
      const mod = ((bits >>> i) & 1) === 1;
      // vertical
      if(i<6) qr.modules[i][8] = mod;
      else if(i<8) qr.modules[i+1][8] = mod;
      else qr.modules[qr.moduleCount-15+i][8] = mod;
      // horizontal
      if(i<8) qr.modules[8][qr.moduleCount - i - 1] = mod;
      else if(i<9) qr.modules[8][15 - i - 1 + 1] = mod;
      else qr.modules[8][15 - i - 1] = mod;
    }
    qr.modules[qr.moduleCount-8][8] = true;
  }
  function mapData(qr, data, maskPattern){
    let inc = -1;
    let row = qr.moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;

    for(let col = qr.moduleCount - 1; col > 0; col -= 2){
      if(col === 6) col--;
      while(true){
        for(let c=0;c<2;c++){
          if(qr.modules[row][col-c] === null){
            let dark = false;
            if(byteIndex < data.length){
              dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
            }
            // mask 0
            if(((row + (col-c)) % 2) === 0) dark = !dark;
            qr.modules[row][col-c] = dark;
            bitIndex--;
            if(bitIndex === -1){
              byteIndex++;
              bitIndex = 7;
            }
          }
        }
        row += inc;
        if(row < 0 || qr.moduleCount <= row){
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  }
  // ====== END tiny QR implementation ======

  function toCanvas(canvas, text, opts){
    opts = opts || {};
    const size = Math.max(120, Math.min(820, Number(opts.size)||220));
    const margin = Math.max(2, Math.min(18, Number(opts.margin)||8));

    const qr = new QRCodeModel(String(text||''));
    qr.make();

    const count = qr.getModuleCount();
    const cells = count + margin*2;
    const scale = Math.floor(size / cells);
    const realSize = cells * scale;

    canvas.width = realSize;
    canvas.height = realSize;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,realSize,realSize);

    // background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,realSize,realSize);

    // modules
    ctx.fillStyle = '#000000';
    for(let r=0;r<count;r++){
      for(let c=0;c<count;c++){
        if(qr.isDark(r,c)){
          const x = (c + margin) * scale;
          const y = (r + margin) * scale;
          ctx.fillRect(x,y,scale,scale);
        }
      }
    }
  }

  global.QRLite = { toCanvas };
})(typeof window !== 'undefined' ? window : globalThis);