/* Registry of zones and games. Replace url with real game links. */
window.ZONES = [
{ id:"clean", name:"Clean Zone", emoji:"🧼", desc:"ล้างมือ/อาบน้ำ" },
{ id:"smile", name:"Smile Zone", emoji:"🦷", desc:"แปรงฟัน/เล็บ" },
{ id:"eat", name:"Eat Zone", emoji:"🍽️", desc:"สุขอนามัยอาหาร" },
{ id:"safe", name:"Safe Zone", emoji:"😷", desc:"หน้ากาก/มารยาท" },
{ id:"dress", name:"Dress Zone", emoji:"👕", desc:"แต่งกายสะอาด" }
];


window.GAMES = [
{ id:"cleanHands", zone:"clean", title:"Clean Hands", emoji:"🫧", desc:"ล้างมือ 7 ขั้นตอน", url:"./games/clean-hands/index.html" },
{ id:"bathTime", zone:"clean", title:"Bath Time", emoji:"🚿", desc:"อาบน้ำให้ครบส่วน", url:"./games/bath-time/index.html" },


{ id:"brushSmart", zone:"smile", title:"Brush Smart", emoji:"🪥", desc:"แปรงฟัน 2 นาที 6 โซน", url:"./games/brush-smart/index.html" },
{ id:"nailCare", zone:"smile", title:"Nail Clean", emoji:"✂️", desc:"ตัดเล็บปลอดภัย", url:"./games/nail-clean/index.html" },


{ id:"eatSmart", zone:"eat", title:"Eat Smart", emoji:"🍱", desc:"สุขลักษณะก่อน–ระหว่างกิน", url:"./games/eat-smart/index.html" },
{ id:"kitchen", zone:"eat", title:"Kitchen Clean", emoji:"🍽️", desc:"เคลียร์โต๊ะ/ล้างจาน/แยกขยะ", url:"./games/kitchen-clean/index.html" },


{ id:"maskSafe", zone:"safe", title:"Mask & Safe", emoji:"😷", desc:"สวมหน้ากาก/ระยะห่าง", url:"./games/mask-safe/index.html" },
{ id:"sneeze", zone:"safe", title:"Sneezing Manners", emoji:"🤧", desc:"มารยาทไอ–จาม", url:"./games/sneezing-manners/index.html" },


{ id:"dressClean", zone:"dress", title:"Dress Clean", emoji:"👕", desc:"เลือกชุดสะอาดเหมาะกิจกรรม", url:"./games/dress-clean/index.html" }
];
