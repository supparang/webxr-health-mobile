export function saveGameRecord(gameKey, data){
  let all = [];
  try{
    all = JSON.parse(localStorage.getItem(gameKey)) || [];
  }catch(e){
    all = [];
  }
  all.unshift(data); // ใส่ล่าสุดไว้หน้า
  localStorage.setItem(gameKey, JSON.stringify(all));
}

export function loadLatestRecord(gameKey){
  try{
    const arr = JSON.parse(localStorage.getItem(gameKey));
    if(arr && arr.length > 0) return arr[0];
  }catch(e){}
  return null;
}
