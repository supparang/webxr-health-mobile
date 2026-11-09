# backend/app/services/nutrition.py
from typing import Dict, List

# ฐานข้อมูลอาหารไทย 30 เมนู (ตัวอย่าง)
MENU_DATABASE: List[Dict] = [
    {"id": "m001", "name_th": "ผัดกระเพราหมูสับ", "name_en": "Stir-fried Basil with Minced Pork", "category": "ผัด", "default_weight_g": 250, "energy_kcal_per_100g": 180, "protein_g_per_100g": 12, "carb_g_per_100g": 8, "fat_g_per_100g": 11},
    {"id": "m002", "name_th": "ข้าวผัด", "name_en": "Fried Rice", "category": "ผัด", "default_weight_g": 300, "energy_kcal_per_100g": 165, "protein_g_per_100g": 5, "carb_g_per_100g": 25, "fat_g_per_100g": 5},
    {"id": "m003", "name_th": "ต้มยำกุ้ง", "name_en": "Tom Yum Goong", "category": "ต้ม", "default_weight_g": 280, "energy_kcal_per_100g": 65, "protein_g_per_100g": 8, "carb_g_per_100g": 4, "fat_g_per_100g": 2},
    {"id": "m004", "name_th": "แกงเขียวหวานไก่", "name_en": "Green Curry with Chicken", "category": "แกง", "default_weight_g": 300, "energy_kcal_per_100g": 120, "protein_g_per_100g": 9, "carb_g_per_100g": 6, "fat_g_per_100g": 7},
    {"id": "m005", "name_th": "ผัดไทยกุ้งสด", "name_en": "Pad Thai", "category": "ผัด", "default_weight_g": 320, "energy_kcal_per_100g": 145, "protein_g_per_100g": 6, "carb_g_per_100g": 22, "fat_g_per_100g": 4},
    {"id": "m006", "name_th": "ส้มตำ", "name_en": "Papaya Salad", "category": "ยำ", "default_weight_g": 200, "energy_kcal_per_100g": 55, "protein_g_per_100g": 2, "carb_g_per_100g": 10, "fat_g_per_100g": 1},
    {"id": "m007", "name_th": "ไข่ดาว", "name_en": "Fried Egg", "category": "ทอด", "default_weight_g": 50, "energy_kcal_per_100g": 196, "protein_g_per_100g": 14, "carb_g_per_100g": 1, "fat_g_per_100g": 15},
    {"id": "m008", "name_th": "ข้าวสวย", "name_en": "Steamed Rice", "category": "ข้าว", "default_weight_g": 200, "energy_kcal_per_100g": 130, "protein_g_per_100g": 2.5, "carb_g_per_100g": 28, "fat_g_per_100g": 0.3},
    {"id": "m009", "name_th": "ไก่ทอด", "name_en": "Fried Chicken", "category": "ทอด", "default_weight_g": 150, "energy_kcal_per_100g": 280, "protein_g_per_100g": 20, "carb_g_per_100g": 8, "fat_g_per_100g": 18},
    {"id": "m010", "name_th": "แกงมัสมั่นไก่", "name_en": "Massaman Curry", "category": "แกง", "default_weight_g": 300, "energy_kcal_per_100g": 135, "protein_g_per_100g": 7, "carb_g_per_100g": 9, "fat_g_per_100g": 8},
    {"id": "m011", "name_th": "ผัดซีอิ๊ว", "name_en": "Pad See Ew", "category": "ผัด", "default_weight_g": 300, "energy_kcal_per_100g": 155, "protein_g_per_100g": 5, "carb_g_per_100g": 24, "fat_g_per_100g": 5},
    {"id": "m012", "name_th": "ขนมจีนน้ำยา", "name_en": "Kanom Jeen Nam Ya", "category": "ก๋วยเตี๋ยว", "default_weight_g": 350, "energy_kcal_per_100g": 95, "protein_g_per_100g": 4, "carb_g_per_100g": 16, "fat_g_per_100g": 2},
    {"id": "m013", "name_th": "ก๋วยเตี๋ยวเรือ", "name_en": "Boat Noodles", "category": "ก๋วยเตี๋ยว", "default_weight_g": 350, "energy_kcal_per_100g": 90, "protein_g_per_100g": 6, "carb_g_per_100g": 14, "fat_g_per_100g": 2},
    {"id": "m014", "name_th": "หมูกระทะ", "name_en": "Moo Kratha", "category": "ปิ้งย่าง", "default_weight_g": 400, "energy_kcal_per_100g": 210, "protein_g_per_100g": 14, "carb_g_per_100g": 8, "fat_g_per_100g": 14},
    {"id": "m015", "name_th": "ลาบหมู", "name_en": "Spicy Minced Pork Salad", "category": "ยำ", "default_weight_g": 180, "energy_kcal_per_100g": 140, "protein_g_per_100g": 12, "carb_g_per_100g": 5, "fat_g_per_100g": 8},
    {"id": "m016", "name_th": "น้ำพริกกะปิ", "name_en": "Shrimp Paste Chili Dip", "category": "จิ้ม", "default_weight_g": 120, "energy_kcal_per_100g": 110, "protein_g_per_100g": 5, "carb_g_per_100g": 12, "fat_g_per_100g": 5},
    {"id": "m017", "name_th": "ปลาทอด", "name_en": "Fried Fish", "category": "ทอด", "default_weight_g": 150, "energy_kcal_per_100g": 220, "protein_g_per_100g": 18, "carb_g_per_100g": 5, "fat_g_per_100g": 14},
    {"id": "m018", "name_th": "แกงจืดเต้าหู้หมูสับ", "name_en": "Clear Soup with Tofu", "category": "ต้ม", "default_weight_g": 250, "energy_kcal_per_100g": 55, "protein_g_per_100g": 5, "carb_g_per_100g": 3, "fat_g_per_100g": 2},
    {"id": "m019", "name_th": "ข้าวมันไก่", "name_en": "Hainanese Chicken Rice", "category": "ข้าว", "default_weight_g": 350, "energy_kcal_per_100g": 140, "protein_g_per_100g": 7, "carb_g_per_100g": 22, "fat_g_per_100g": 3},
    {"id": "m020", "name_th": "ผัดพริกแกงหมู", "name_en": "Stir-fried Pork with Red Curry Paste", "category": "ผัด", "default_weight_g": 250, "energy_kcal_per_100g": 175, "protein_g_per_100g": 11, "carb_g_per_100g": 7, "fat_g_per_100g": 11},
    {"id": "m021", "name_th": "ยำวุ้นเส้น", "name_en": "Spicy Glass Noodle Salad", "category": "ยำ", "default_weight_g": 200, "energy_kcal_per_100g": 90, "protein_g_per_100g": 5, "carb_g_per_100g": 14, "fat_g_per_100g": 2},
    {"id": "m022", "name_th": "กุ้งอบวุ้นเส้น", "name_en": "Baked Shrimp with Glass Noodles", "category": "อบ", "default_weight_g": 250, "energy_kcal_per_100g": 125, "protein_g_per_100g": 10, "carb_g_per_100g": 12, "fat_g_per_100g": 4},
    {"id": "m023", "name_th": "ข้าวหมูแดง", "name_en": "Red Pork Rice", "category": "ข้าว", "default_weight_g": 350, "energy_kcal_per_100g": 165, "protein_g_per_100g": 8, "carb_g_per_100g": 24, "fat_g_per_100g": 4},
    {"id": "m024", "name_th": "ข้าวขาหมู", "name_en": "Stewed Pork Leg Rice", "category": "ข้าว", "default_weight_g": 400, "energy_kcal_per_100g": 185, "protein_g_per_100g": 10, "carb_g_per_100g": 22, "fat_g_per_100g": 6},
    {"id": "m025", "name_th": "ห่อหมก", "name_en": "Hor Mok", "category": "นึ่ง", "default_weight_g": 180, "energy_kcal_per_100g": 135, "protein_g_per_100g": 9, "carb_g_per_100g": 8, "fat_g_per_100g": 7},
    {"id": "m026", "name_th": "ตำข้าวโพด", "name_en": "Corn Som Tam", "category": "ยำ", "default_weight_g": 200, "energy_kcal_per_100g": 75, "protein_g_per_100g": 2, "carb_g_per_100g": 15, "fat_g_per_100g": 1},
    {"id": "m027", "name_th": "ขนมจีนซาวน้ำยาป่า", "name_en": "Kanom Jeen Nam Ya Pa", "category": "ก๋วยเตี๋ยว", "default_weight_g": 350, "energy_kcal_per_100g": 100, "protein_g_per_100g": 5, "carb_g_per_100g": 16, "fat_g_per_100g": 2},
    {"id": "m028", "name_th": "ไข่พะโล้", "name_en": "Egg with Pepper", "category": "ผัด", "default_weight_g": 200, "energy_kcal_per_100g": 160, "protein_g_per_100g": 9, "carb_g_per_100g": 6, "fat_g_per_100g": 11},
    {"id": "m029", "name_th": "ผัดผักบุ้งไฟแดง", "name_en": "Stir-fried Morning Glory", "category": "ผัด", "default_weight_g": 200, "energy_kcal_per_100g": 85, "protein_g_per_100g": 3, "carb_g_per_100g": 6, "fat_g_per_100g": 5},
    {"id": "m030", "name_th": "น้ำตกหมู", "name_en": "Grilled Pork Salad", "category": "ยำ", "default_weight_g": 180, "energy_kcal_per_100g": 150, "protein_g_per_100g": 13, "carb_g_per_100g": 5, "fat_g_per_100g": 9},
]


def get_menu_by_id(menu_id: str) -> dict:
    for menu in MENU_DATABASE:
        if menu["id"] == menu_id:
            return menu
    return MENU_DATABASE[0]


def calculate_nutrition(menu: dict, weight_g: float) -> dict:
    ratio = weight_g / 100.0
    return {
        "energy_kcal": round(menu["energy_kcal_per_100g"] * ratio, 1),
        "protein_g": round(menu["protein_g_per_100g"] * ratio, 1),
        "carb_g": round(menu["carb_g_per_100g"] * ratio, 1),
        "fat_g": round(menu["fat_g_per_100g"] * ratio, 1),
    }
