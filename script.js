// ตั้งค่าเป้าหมายแคลอรีประจำวัน
const TARGET_CALORIES = 1500;

// โครงสร้างข้อมูลมื้ออาหารและคลังอาหาร
let dailyMeals = JSON.parse(localStorage.getItem('dailyMeals')) || {
    breakfast: { title: "มื้อเช้า", items: [] },
    lunch: { title: "มื้อเที่ยง", items: [] },
    dinner: { title: "มื้อเย็น", items: [] },
    snack: { title: "ของว่าง / อื่นๆ", items: [] }
};

let foodCatalog = JSON.parse(localStorage.getItem('foodCatalog')) || [
    { name: "หมูย่าง", calories: 100, protein: 7, carbs: 2, fat: 6, sodium: 200, cholesterol: 30 },
    { name: "ข้าวเหนียว", calories: 155, protein: 2.5, carbs: 32.5, fat: 0, sodium: 5, cholesterol: 0 },
    { name: "ชามะนาว น้ำผึ้ง", calories: 25, protein: 0, carbs: 6.5, fat: 0, sodium: 0, cholesterol: 0 },
    { name: "ข้าวต้มหมูสับ", calories: 250, protein: 13.5, carbs: 32.5, fat: 7.5, sodium: 550, cholesterol: 40 }
];

// อัปเดตรายการใน datalist (ให้ระบบพิมพ์ค้นหาทำงาน)
function updateFoodDatalist() {
    const datalist = document.getElementById('food-list');
    if (!datalist) return;
    datalist.innerHTML = '';
    foodCatalog.forEach(item => {
        const option = document.createElement('option');
        option.value = item.name;
        datalist.appendChild(option);
    });
}

// เรนเดอร์หน้าจอหลักและคำนวณผลรวม
function renderApp() {
    const container = document.getElementById('mealSectionsContainer');
    container.innerHTML = '';

    let totalCals = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalSodium = 0;
    let totalCholesterol = 0;

    Object.keys(dailyMeals).forEach(mealKey => {
        const meal = dailyMeals[mealKey];
        let mealCals = 0;
        let mealProtein = 0;

        meal.items.forEach(item => {
            const qty = item.qty || 1;
            mealCals += (item.calories * qty);
            mealProtein += (item.protein * qty);

            totalCals += (item.calories * qty);
            totalProtein += (item.protein * qty);
            totalCarbs += (item.carbs * qty);
            totalFat += (item.fat * qty);
            totalSodium += (item.sodium * qty);
            totalCholesterol += (item.cholesterol * qty);
        });

        // สร้าง HTML แต่ละมื้อ
        const mealCard = document.createElement('div');
        mealCard.style.cssText = "background: #fff; border: 1px solid #f3f4f6; border-radius: 16px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);";
        
        let itemsHtml = '';
        if (meal.items.length === 0) {
            itemsHtml = `<div style="color: #9ca3af; font-size: 14px; padding: 8px 0;">ยังไม่มีรายการอาหาร</div>`;
        } else {
            meal.items.forEach((item, index) => {
                itemsHtml += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f9fafb;">
                        <div>
                            <span style="font-weight: 500; font-size: 14px;">${item.name}</span>
                            <span style="color: #6b7280; font-size: 12px; margin-left: 4px;">x${item.qty || 1}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 13px; font-weight: 500;">${item.calories * (item.qty || 1)} kcal <span style="color: #059669;">(${item.protein * (item.qty || 1)}g)</span></span>
                            <button onclick="openEditModal('${mealKey}', ${index})" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 14px;">✏️</button>
                            <button onclick="deleteMealItem('${mealKey}', ${index})" style="background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 14px;">🗑️</button>
                        </div>
                    </div>
                `;
            });
        }

        mealCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-weight: 600; font-size: 15px; color: #374151;">${meal.title}</span>
                <span style="font-size: 13px; color: #6b7280;">${mealCals} kcal | โปรตีน ${mealProtein}g</span>
            </div>
            <div style="margin-bottom: 12px;">${itemsHtml}</div>
            <button onclick="openAddModal('${mealKey}')" style="width: 100%; padding: 8px; background: #f9fafb; border: 1px dashed #d1d5db; border-radius: 8px; color: #4f46e5; font-weight: 500; font-size: 13px; cursor: pointer;">+ เพิ่ม${meal.title}</button>
        `;
        container.appendChild(mealCard);
    });

    // อัปเดตส่วนสรุปด้านบน
    const remaining = TARGET_CALORIES - totalCals;
    document.getElementById('remainingCalories').innerHTML = `${remaining} <span style="font-size: 16px; font-weight: normal;">kcal</span>`;
    document.getElementById('totalProtein').innerHTML = `${totalProtein.toFixed(1)} <span style="font-size: 14px; font-weight: normal; color: #9ca3af;">/ 96–128 g</span>`;
    document.getElementById('totalCarbs\x27') // (ปรับแก้ชื่อตัวแปรสั้นๆ)
    document.getElementById('totalCarbs').innerText = `${totalCarbs.toFixed(1)}g`;
    document.getElementById('totalFat').innerText = `${totalFat.toFixed(1)}g`;
    document.getElementById('totalSodium').innerText = `${totalSodium}mg`;
    document.getElementById('totalCholesterol').innerText = `${totalCholesterol}mg`;

    // บันทึกลง LocalStorage ของวัน
    localStorage.setItem('dailyMeals', JSON.stringify(dailyMeals));
}

// จัดการ Modal
const modal = document.getElementById('foodModal');

function openAddModal(mealKey) {
    document.getElementById('modalTitle').innerText = `เพิ่มอาหาร (${dailyMeals[mealKey].title})`;
    document.getElementById('editMealType').value = mealKey;
    document.getElementById('editItemIndex').value = "";
    document.getElementById('foodForm').reset();
    document.getElementById('qtyInput').value = 1;
    modal.classList.add('active');
}

function openEditModal(mealKey, index) {
    const item = dailyMeals[mealKey].items[index];
    document.getElementById('modalTitle').innerText = `แก้ไขรายการอาหาร`;
    document.getElementById('editMealType').value = mealKey;
    document.getElementById('editItemIndex').value = index;

    document.getElementById('foodNameInput').value = item.name;
    document.getElementById('caloriesInput').value = item.calories;
    document.getElementById('proteinInput').value = item.protein;
    document.getElementById('carbsInput').value = item.carbs;
    document.getElementById('fatInput').value = item.fat;
    document.getElementById('sodiumInput').value = item.sodium;
    document.getElementById('cholesterolInput').value = item.cholesterol;
    document.getElementById('qtyInput').value = item.qty || 1;

    modal.classList.add('active');
}

document.getElementById('closeModalBtn').addEventListener('click', () => {
    modal.classList.remove('active');
});

// ฟังก์ชัน Auto-fill ข้อมูลเมื่อพิมพ์หรือเลือกชื่ออาหารจากคลัง
document.getElementById('foodNameInput').addEventListener('input', function(e) {
    const selectedName = e.target.value.trim().toLowerCase();
    const foundItem = foodCatalog.find(item => item.name.toLowerCase() === selectedName);

    if (foundItem) {
        document.getElementById('caloriesInput').value = foundItem.calories;
        document.getElementById('proteinInput').value = foundItem.protein;
        document.getElementById('carbsInput').value = foundItem.carbs;
        document.getElementById('fatInput').value = foundItem.fat;
        document.getElementById('sodiumInput').value = foundItem.sodium;
        document.getElementById('cholesterolInput').value = foundItem.cholesterol;
    }
});

// บันทึกฟอร์ม (เพิ่มหรือแก้ไขรายการ)
document.getElementById('foodForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const mealKey = document.getElementById('editMealType').value;
    const editIndex = document.getElementById('editItemIndex').value;

    const newItem = {
        name: document.getElementById('foodNameInput').value.trim(),
        calories: Number(document.getElementById('caloriesInput').value) || 0,
        protein: Number(document.getElementById('proteinInput').value) || 0,
        carbs: Number(document.getElementById('carbsInput').value) || 0,
        fat: Number(document.getElementById('fatInput').value) || 0,
        sodium: Number(document.getElementById('sodiumInput').value) || 0,
        cholesterol: Number(document.getElementById('cholesterolInput').value) || 0,
        qty: Number(document.getElementById('qtyInput').value) || 1
    };

    // อัปเดตคลังอาหารอัตโนมัติถ้ายังไม่มีในระบบ
    const catalogExists = foodCatalog.some(item => item.name.toLowerCase() === newItem.name.toLowerCase());
    if (!catalogExists) {
        foodCatalog.push({
            name: newItem.name,
            calories: newItem.calories,
            protein: newItem.protein,
            carbs: newItem.carbs,
            fat: newItem.fat,
            sodium: newItem.sodium,
            cholesterol: newItem.cholesterol
        });
        localStorage.setItem('foodCatalog', JSON.stringify(foodCatalog));
        updateFoodDatalist();
    }

    if (editIndex === "") {
        dailyMeals[mealKey].items.push(newItem);
    } else {
        dailyMeals[mealKey].items[editIndex] = newItem;
    }

    modal.classList.remove('active');
    renderApp();
});

// ลบรายการอาหารในมื้อ
function deleteMealItem(mealKey, index) {
    dailyMeals[mealKey].items.splice(index, 1);
    renderApp();
}

// รีเซ็ตข้อมูลทั้งวัน
document.getElementById('resetDayBtn').addEventListener('click', () => {
    if (confirm('ต้องการล้างข้อมูลการกินทั้งหมดของวันนี้ใช่หรือไม่?')) {
        Object.keys(dailyMeals).forEach(key => {
            dailyMeals[key].items = [];
        });
        renderApp();
    }
});

// โหลดระบบครั้งแรก
window.addEventListener('DOMContentLoaded', () => {
    updateFoodDatalist();
    renderApp();
});
