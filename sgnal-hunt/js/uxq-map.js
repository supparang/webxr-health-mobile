(function(){
 const p=UXQ.get(), lv=UXQ.level(p.dxp); const w1=p.missions.w1||{};
 document.getElementById('playerName').textContent=p.name; document.getElementById('avatarInitial').textContent=(p.name||'D').trim().slice(0,1).toUpperCase(); document.getElementById('dxpValue').textContent=p.dxp; document.getElementById('playerLevel').textContent=`${lv.name} • Lv.${lv.n}`;
 document.getElementById('w1Stars').textContent='★'.repeat(w1.stars||0)+'☆'.repeat(3-(w1.stars||0));
 for(const key of ['empathy','clarity','flow']){const val=Math.min(100,p.skills[key]||0);document.getElementById(`${key}Value`).textContent=val;document.getElementById(`${key}Bar`).style.width=`${val}%`;}
 if(w1.cleared){const n=document.getElementById('nodeW2');n.classList.remove('locked');n.classList.add('available');n.querySelector('.node-stars').textContent='◉ W2 พร้อมเมื่อเพิ่ม Mission Pack';n.querySelector('button').textContent='กำลังเตรียม Mission';}
 document.getElementById('resetProgressBtn').addEventListener('click',()=>{if(confirm('ต้องการรีเซ็ต DXP ดาว และความคืบหน้าทั้งหมดหรือไม่?')){UXQ.reset();location.reload();}});
})();
