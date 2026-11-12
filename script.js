const TARGET_CALORIES = 1500;

// ตั้งวันที่ปัจจุบัน (ค่าเริ่มต้น: 2026-11-12 ตามหน้าจอของคุณ)
let selectedDate = localStorage.getItem('selectedDate') || '2026-11-12';

// โหลดประวัติรายวันทั้งหมดจาก LocalStorage
let allMealsHistory = JSON.parse(localStorage.getItem('allMealsHistory')) || {};

// กู้คืนข้อมูลเก่าจาก key 'dailyMeals' ถ้ามีอยู่
const legacyDailyMeals = JSON.parse(localStorage.getItem('dailyMeals'));
if (legacyDailyMeals && !allMealsHistory[selectedDate]) {
    const hasItems = Object.values(legacyDailyMeals).some(m => m.items && m.items.length > 0);
    if (hasItems) {
        allMealsHistory[selectedDate] = legacyDailyMeals;
        localStorage.setItem('allMealsHistory', JSON.stringify(allMealsHistory));
    }
}

// ฟังก์ชันดึงข้อมูลมื้ออาหารของวันที่เลือก
function getMealsForDate(dateStr) {
    if (!allMealsHistory[dateStr]) {
        allMealsHistory[dateStr] = {
            breakfast: { title: "มื้อเช้า", items: [] },
            lunch: { title: "มื้อเที่ยง", items: [] },
            dinner: { title: "มื้อเย็น", items: [] },
            snack: { title: "ของว่าง / อื่นๆ", items: [] }
        };
    }
    return allMealsHistory[dateStr];
}

// แปลงวันที่ YYYY-MM-DD เป็นภาษาไทย (เช่น วันพฤหัสบดีที่ 12 พฤศจิกายน 2569)
function formatThaiDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const months = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    return `วัน${days[dateObj.getDay()]}ที่ ${d} ${months[m - 1]} ${y + 543}`;
}

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

// เรนเดอร์หน้าจอหลัก
function renderApp() {
    document.getElementById('currentDateText').innerText = formatThaiDate(selectedDate);
    const dailyMeals = getMealsForDate(selectedDate);

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
        mealCard.className = `meal-card ${mealKey}`;
        
        let itemsHtml = '';
        if (meal.items.length === 0) {
            itemsHtml = `<div style="color: #9ca3af; font-size: 13px; font-style: italic; padding: 4px 0;">ยังไม่มีรายการอาหาร</div>`;
        } else {
            meal.items.forEach((item, index) => {
                itemsHtml += `
                    <div class="meal-item-row">
                        <div>
                            <span style="font-weight: 600;">${item.name}</span>
                            <span style="color: #9ca3af; font-size: 12px; margin-left: 4px;">x${item.qty || 1}</span>
                        </div>
                        <div class="item-actions">
                            <span style="font-size: 13px; font-weight: 500;">${Math.round(item.calories * (item.qty || 1))} kcal <span style="color: #059669; font-weight: 600;">(${Number((item.protein * (item.qty || 1)).toFixed(1))}g)</span></span>
                            <button class="action-btn" onclick="openEditModal('${mealKey}', ${index})" title="แก้ไข">✏️</button>
                            <button class="action-btn" onclick="deleteMealItem('${mealKey}', ${index})" title="ลบ" style="color: #9ca3af;">🗑️</button>
                        </div>
                    </div>
                `;
            });
        }

        mealCard.innerHTML = `
            <div class="meal-header">
                <span class="meal-title ${mealKey}">${meal.title}</span>
                <span class="meal-subtotal">${Math.round(mealCals)} kcal | โปรตีน ${Number(mealProtein.toFixed(1))}g</span>
            </div>
            <div class="meal-items-list">${itemsHtml}</div>
            <button class="add-meal-btn" onclick="openAddModal('${mealKey}')">+ เพิ่ม ${meal.title}</button>
        `;
        container.appendChild(mealCard);
    });

    // อัปเดตส่วน Summary ด้านบน
    const remaining = Math.round(TARGET_CALORIES - totalCals);
    document.getElementById('remainingCalories').innerHTML = `${remaining} <span>kcal</span>`;
    document.getElementById('totalProtein').innerHTML = `${Number(totalProtein.toFixed(1))} <span>/ 96–128 g</span>`;
    document.getElementById('totalCarbs').innerText = `${Math.round(totalCarbs)}g`;
    document.getElementById('totalFat').innerText = `${Math.round(totalFat)}g`;
    document.getElementById('totalSodium').innerText = `${Math.round(totalSodium)}mg`;
    document.getElementById('totalCholesterol').innerText = `${Math.round(totalCholesterol)}mg`;

    document.getElementById('consumedText').innerText = `ทานไป ${Math.round(totalCals)} kcal`;

    const progressBar = document.getElementById('progressBar');
    const percent = Math.min((totalCals / TARGET_CALORIES) * 100, 100);
    progressBar.style.width = `${percent}%`;

    const statusBadge = document.getElementById('statusBadge');
    if (totalCals <= TARGET_CALORIES) {
        statusBadge.innerText = "ต่ำกว่าเกณฑ์ / กำลังคุม";
        statusBadge.style.color = "#fbbf24";
        statusBadge.style.background = "rgba(251, 191, 36, 0.15)";
    } else {
        statusBadge.innerText = "เกินเป้าหมาย";
        statusBadge.style.color = "#f87171";
        statusBadge.style.background = "rgba(248, 113, 113, 0.15)";
    }

    localStorage.setItem('selectedDate', selectedDate);
    localStorage.setItem('allMealsHistory', JSON.stringify(allMealsHistory));
}

// ==========================================
// จัดการ Modal ปฏิทิน & สรุปย้อนหลัง
// ==========================================
const calendarModal = document.getElementById('calendarModal');
const datePickerInput = document.getElementById('datePickerInput');

document.getElementById('openCalendarBtn').addEventListener('click', () => {
    datePickerInput.value = selectedDate;
    renderHistorySummary();
    calendarModal.classList.add('active');
});

document.getElementById('closeCalendarBtn').addEventListener('click', () => {
    calendarModal.classList.remove('active');
});

datePickerInput.addEventListener('change', (e) => {
    if (e.target.value) {
        selectedDate = e.target.value;
        renderApp();
        calendarModal.classList.remove('active');
    }
});

function renderHistorySummary() {
    const listEl = document.getElementById('historySummaryList');
    listEl.innerHTML = '';

    const dates = Object.keys(allMealsHistory).sort().reverse();
    if (dates.length === 0) {
        listEl.innerHTML = `<div style="color: #9ca3af; font-size: 13px; text-align: center; padding: 12px;">ยังไม่มีประวัติการบันทึก</div>`;
        return;
    }

    dates.forEach(dateStr => {
        const meals = allMealsHistory[dateStr];
        let dayCals = 0;
        let dayPro = 0;

        Object.values(meals).forEach(m => {
            m.items.forEach(item => {
                const q = item.qty || 1;
                dayCals += item.calories * q;
                dayPro += item.protein * q;
            });
        });

        const itemDiv = document.createElement('div');
        itemDiv.className = `history-item ${dateStr === selectedDate ? 'active' : ''}`;
        itemDiv.innerHTML = `
            <div>
                <div style="font-size: 13px; font-weight: 600; color: #1f2937;">${formatThaiDate(dateStr)}</div>
                <div style="font-size: 12px; color: #6b7280;">โปรตีน ${Number(dayPro.toFixed(1))}g</div>
            </div>
            <div style="font-size: 14px; font-weight: 700; color: #4f46e5;">${Math.round(dayCals)} kcal</div>
        `;
        itemDiv.onclick = () => {
            selectedDate = dateStr;
            renderApp();
            calendarModal.classList.remove('active');
        };
        listEl.appendChild(itemDiv);
    });
}

// ==========================================
// จัดการ Modal เพิ่ม/แก้ไขอาหาร
// ==========================================
const modal = document.getElementById('foodModal');

function openAddModal(mealKey) {
    const dailyMeals = getMealsForDate(selectedDate);
    document.getElementById('modalTitle').innerText = `เพิ่มอาหาร (${dailyMeals[mealKey].title})`;
    document.getElementById('editMealType').value = mealKey;
    document.getElementById('editItemIndex').value = "";
    document.getElementById('foodForm').reset();
    document.getElementById('qtyInput').value = 1;
    modal.classList.add('active');
}

function openEditModal(mealKey, index) {
    const dailyMeals = getMealsForDate(selectedDate);
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

// Auto-fill ข้อมูลเมื่อพิมพ์หรือเลือกชื่ออาหารจากคลัง
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
    const dailyMeals = getMealsForDate(selectedDate);
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
    const dailyMeals = getMealsForDate(selectedDate);
    dailyMeals[mealKey].items.splice(index, 1);
    renderApp();
}

// โหลดระบบครั้งแรก
window.addEventListener('DOMContentLoaded', () => {
    updateFoodDatalist();
    renderApp();
});
