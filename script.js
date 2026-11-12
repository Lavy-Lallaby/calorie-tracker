const TARGET_CALORIES = 1500;

// โหลดข้อมูลอาหารในแต่ละวันจาก LocalStorage
let dailyMeals = JSON.parse(localStorage.getItem('dailyMeals')) || {
    breakfast: { title: "มื้อเช้า", items: [] },
    lunch: { title: "มื้อเที่ยง", items: [] },
    dinner: { title: "มื้อเย็น", items: [] },
    snack: { title: "ของว่าง / อื่นๆ", items: [] }
};

// คลังเมนูอาหารอัตโนมัติ (จำค่าข้ามวัน)
let foodCatalog = JSON.parse(localStorage.getItem('foodCatalog')) || [
    { name: "หมูย่าง", calories: 100, protein: 7, carbs: 2, fat: 6, sodium: 200, cholesterol: 30 },
    { name: "ข้าวเหนียว", calories: 155, protein: 2.5, carbs: 32.5, fat: 0, sodium: 5, cholesterol: 0 },
    { name: "ชามะนาว น้ำผึ้ง", calories: 25, protein: 0, carbs: 6.5, fat: 0, sodium: 0, cholesterol: 0 },
    { name: "ข้าวต้มหมูสับ", calories: 250, protein: 13.5, carbs: 32.5, fat: 7.5, sodium: 550, cholesterol: 40 }
];

// อัปเดตรายชื่อใน Datalist พิมพ์ค้นหา
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

// เรนเดอร์หน้าจอหลักและคำนวณสรุป
function renderApp() {
    const container = document.getElementById('mealSectionsContainer');
    if (!container) return;
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

        const mealCard = document.createElement('div');
        mealCard.className = 'meal-card';
        
        let itemsHtml = '';
        if (meal.items.length === 0) {
            itemsHtml = `<div style="color: #9ca3af; font-size: 14px; padding: 4px 0;">ยังไม่มีรายการอาหาร</div>`;
        } else {
            meal.items.forEach((item, index) => {
                itemsHtml += `
                    <div class="meal-item-row">
                        <div>
                            <span style="font-weight: 500;">${item.name}</span>
                            <span style="color: #6b7280; font-size: 12px; margin-left: 4px;">x${item.qty || 1}</span>
                        </div>
                        <div class="item-actions">
                            <span style="font-size: 13px; font-weight: 500;">${item.calories * (item.qty || 1)} kcal <span style="color: #059669;">(${item.protein * (item.qty || 1)}g)</span></span>
                            <button class="action-btn" onclick="openEditModal('${mealKey}', ${index})" title="แก้ไข">✏️</button>
                            <button class="action-btn" onclick="deleteMealItem('${mealKey}', ${index})" title="ลบ" style="color: #9ca3af;">🗑️</button>
                        </div>
                    </div>
                `;
            });
        }

        mealCard.innerHTML = `
            <div class="meal-header">
                <span class="meal-title">${meal.title}</span>
                <span class="meal-subtotal">${mealCals} kcal | โปรตีน ${mealProtein}g</span>
            </div>
            <div class="meal-items-list">${itemsHtml}</div>
            <button class="add-meal-btn" onclick="openAddModal('${mealKey}')">+ เพิ่ม${meal.title}</button>
        `;
        container.appendChild(mealCard);
    });

    // อัปเดตส่วน Summary ด้านบน
    const remaining = TARGET_CALORIES - totalCals;
    document.getElementById('remainingCalories').innerHTML = `${remaining} <span>kcal</span>`;
    document.getElementById('totalProtein').innerHTML = `${totalProtein.toFixed(1)} <span>/ 96–128 g</span>`;
    document.getElementById('totalCarbs').innerText = `${totalCarbs.toFixed(1)}g`;
    document.getElementById('totalFat').innerText = `${totalFat.toFixed(1)}g`;
    document.getElementById('totalSodium').innerText = `${totalSodium}mg`;
    document.getElementById('totalCholesterol').innerText = `${totalCholesterol}mg`;

    document.getElementById('consumedText').innerText = `ทานไป ${totalCals} kcal`;

    const progressBar = document.getElementById('progressBar');
    const percent = Math.min((totalCals / TARGET_CALORIES) * 100, 100);
    progressBar.style.width = `${percent}%`;

    const statusBadge = document.getElementById('statusBadge');
    if (totalCals <= TARGET_CALORIES) {
        statusBadge.innerText = "กำลังคุม";
        statusBadge.style.color = "#fbbf24";
    } else {
        statusBadge.innerText = "เกินเป้าหมาย";
        statusBadge.style.color = "#f87171";
    }

    localStorage.setItem('dailyMeals', JSON.stringify(dailyMeals));
}

// จัดการ Modal
const modal = document.getElementById('foodModal');

function openAddModal(mealKey) {
    document.getElementById('modalTitle').innerText = `เพิ่มอาหาร`;
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

// บันทึกฟอร์ม
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

    // เพิ่มเข้าคลังอัตโนมัติถ้ายังไม่มี
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

// ลบรายการ
function deleteMealItem(mealKey, index) {
    dailyMeals[mealKey].items.splice(index, 1);
    renderApp();
}

// โหลดระบบครั้งแรก
window.addEventListener('DOMContentLoaded', () => {
    updateFoodDatalist();
    renderApp();
});
