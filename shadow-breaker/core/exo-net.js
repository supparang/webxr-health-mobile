// EXO_NET — P2P WebRTC DataChannel (manual copy/paste signaling)
window.EXO_NET = (function(){
  const iceServers=[{urls:'stun:stun.l.google.com:19302'}];
  let pc, ch, onmsg=()=>{}, onstate=()=>{};

  async function create(){
    pc = new RTCPeerConnection({iceServers});
    ch = pc.createDataChannel('exo');
    ch.onmessage = (e)=>onmsg && onmsg(JSON.parse(e.data));
    pc.onconnectionstatechange = ()=> onstate(pc.connectionState);
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    // รอ ICE gather เสร็จ
    await new Promise(res=>{
      if (pc.iceGatheringState === 'complete') return res();
      pc.onicegatheringstatechange = ()=> (pc.iceGatheringState==='complete') && res();
    });
    return btoa(JSON.stringify(pc.localDescription));
  }

  async function acceptAnswer(answerB64){
    const ans = JSON.parse(atob(answerB64));
    await pc.setRemoteDescription(ans);
  }

  async function join(offerB64){
    pc = new RTCPeerConnection({iceServers});
    pc.ondatachannel = (e)=>{ ch=e.channel; ch.onmessage=(ev)=>onmsg && onmsg(JSON.parse(ev.data)); };
    pc.onconnectionstatechange = ()=> onstate(pc.connectionState);
    const off = JSON.parse(atob(offerB64));
    await pc.setRemoteDescription(off);
    const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
    await new Promise(res=>{
      if (pc.iceGatheringState === 'complete') return res();
      pc.onicegatheringstatechange = ()=> (pc.iceGatheringState==='complete') && res();
    });
    return btoa(JSON.stringify(pc.localDescription));
  }

  function send(obj){ try{ ch && ch.readyState==='open' && ch.send(JSON.stringify(obj)); }catch(e){} }
  function onMessage(fn){ onmsg = fn; }
  function onState(fn){ onstate = fn; }
  function connected(){ return ch && ch.readyState==='open'; }

  return { create, acceptAnswer, join, send, onMessage, onState, connected };
})();
