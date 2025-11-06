
export async function boot({host, duration=60, difficulty='normal'}){
  const zone = host || document.getElementById('spawnZone');
  while(zone.firstChild) zone.removeChild(zone.firstChild);
  const txt = document.createElement('a-entity');
  txt.setAttribute('troika-text','value: โหมดนี้อยู่ระหว่างพัฒนา; color:#ffd54f; fontSize:0.09;');
  txt.setAttribute('position','-0.6 0.0 0.02');
  zone.appendChild(txt);
  return { pause(){}, resume(){}, destroy(){ while(zone.firstChild) zone.removeChild(zone.firstChild); } };
}
