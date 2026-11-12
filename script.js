const TARGET_CALORIES = 1500;
const TODAY_STR = '2026-11-12';

let selectedDate = localStorage.getItem('selectedDate') || TODAY_STR;
let allMealsHistory = JSON.parse(localStorage.getItem('allMealsHistory')) || {};

let calViewYear = 2026;
let calViewMonth = 10;

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

let foodCatalog = JSON.parse(localStorage.getItem('foodCatalog')) || [
    { name: "หมูย่าง", calories: 100, protein: 7, carbs: 2, fat: 6, sodium: 200, cholesterol: 30 },
    { name: "ข้าวเหนียว", calories: 155, protein: 2.5, carbs: 32.5, fat: 0, sodium: 5, cholesterol: 0 },
    { name: "ชามะนาว น้ำผึ้ง", calories: 25, protein: 0, carbs: 6.5, fat: 0, sodium: 0, cholesterol: 0 },
    { name: "ข้าวต้มหมูสับ", calories: 250, protein: 13.5, carbs: 32.5, fat: 7.5, sodium: 550, cholesterol: 40 }
];

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

// Calendar Modal Logic
const calendarModal = document.getElementById('calendarModal');
let previewDate = selectedDate;

document.getElementById('openCalendarBtn').addEventListener('click', () => {
    const [y, m] = selectedDate.split('-').map(Number);
    calViewYear = y;
    calViewMonth = m - 1;
    previewDate = selectedDate;
    renderCalendar();
    calendarModal.classList.add('active');
});

document.getElementById('closeCalendarBtn').addEventListener('click', () => {
    calendarModal.classList.remove('active');
});

document.getElementById('prevMonthBtn').addEventListener('click', () => {
    calViewMonth--;
    if (calViewMonth < 0) {
        calViewMonth = 11;
        calViewYear--;
    }
    renderCalendar();
});

document.getElementById('nextMonthBtn').addEventListener('click', () => {
    calViewMonth++;
    if (calViewMonth > 11) {
        calViewMonth = 0;
        calViewYear++;
    }
    renderCalendar();
});

function getDayStats(dateStr) {
    const meals = allMealsHistory[dateStr];
    if (!meals) return { cals: 0, protein: 0, hasData: false };
    let cals = 0, protein = 0, count = 0;
    Object.values(meals).forEach(m => {
        m.items.forEach(item => {
            const q = item.qty || 1;
            cals += item.calories * q;
            protein += item.protein * q;
            count++;
        });
    });
    return { cals: Math.round(cals), protein: Number(protein.toFixed(1)), hasData: count > 0 };
}

function renderCalendar() {
    const months = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    document.getElementById('calendarMonthYear').innerText = `${months[calViewMonth]} ${calViewYear + 543}`;

    const grid = document.getElementById('calendarDaysGrid');
    grid.innerHTML = '';

    const firstDay = new Date(calViewYear, calViewMonth, 1).getDay();
    const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'cal-day empty';
        grid.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${calViewYear}-${String(calViewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const stats = getDayStats(dateStr);

        const cell = document.createElement('div');
        cell.className = 'cal-day';
        if (dateStr === TODAY_STR) cell.classList.add('today');
        if (dateStr === previewDate) cell.classList.add('selected');

        let dotHtml = '';
        if (stats.hasData) {
            const dotColor = stats.cals <= TARGET_CALORIES ? 'green' : 'red';
            dotHtml = `<span class="dot ${dotColor}"></span>`;
        }

        cell.innerHTML = `<span>${day}</span>${dotHtml}`;
        cell.onclick = () => {
            previewDate = dateStr;
            renderCalendar();
        };
        grid.appendChild(cell);
    }

    renderDayPreview(previewDate);
}

function renderDayPreview(dateStr) {
    const previewBox = document.getElementById('selectedDayPreview');
    const stats = getDayStats(dateStr);

    previewBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div>
                <div style="font-size: 13px; font-weight: 700; color: #1f2937;">${formatThaiDate(dateStr)}</div>
                <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">
                    ${stats.hasData ? `ทานไป <strong>${stats.cals} kcal</strong> • โปรตีน <strong style="color: #059669;">${stats.protein}g</strong>` : 'ยังไม่มีบันทึกข้อมูลในวันนี้'}
                </div>
            </div>
        </div>
        <button type="button" onclick="selectDateAndClose('${dateStr}')" style="width: 100%; padding: 10px; background: #4f46e5; color: #fff; border: none; border-radius: 10px; font-weight: 600; font-size: 13px; cursor: pointer;">
            เปิดดู / บันทึกข้อมูลวันนี้
        </button>
    `;
}

function selectDateAndClose(dateStr) {
    selectedDate = dateStr;
    renderApp();
    calendarModal.classList.remove('active');
}

// Food Modal Logic
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

function deleteMealItem(mealKey, index) {
    const dailyMeals = getMealsForDate(selectedDate);
    dailyMeals[mealKey].items.splice(index, 1);
    renderApp();
}

// ฟังก์ชันเรียกใช้งานเมื่อกดปุ่มสแกนต่างๆ
function triggerScan(type) {
    const fileInput = document.getElementById('hiddenFileInput');
    if (!fileInput) return;

    if (type === 'camera') {
        // บังคับเปิดกล้องหลังมือถือ (ถ้าใช้งานบนมือถือ)
        fileInput.setAttribute('capture', 'environment');
    } else {
        // สำหรับสแกนฉลากหรือบาร์โค้ด ให้เลือกรูปจากอัลบั้มหรือถ่ายใหม่ได้
        fileInput.removeAttribute('capture');
    }

    fileInput.click(); // จำลองการคลิกเพื่อให้มือถือเปิดกล้อง/แกลเลอรี
}

// ฟังก์ชันหลังจากผู้ใช้ถ่ายรูปหรือเลือกรูปเสร็จแล้ว
function handleFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    // ตัวอย่างจำลอง: เมื่อเลือกรูปแล้ว สามารถนำรูปนี้ไปส่งต่อให้ AI หรือจำลองการกรอกข้อมูล
    alert("ได้รับรูปภาพแล้ว! (สามารถนำไปเชื่อมต่อระบบ AI Vision หรือ OCR เพื่อดึงสารอาหารอัตโนมัติในขั้นตอนต่อไป)");
    
    // เคลียร์ค่าเพื่อให้เลือกรูปเดิมซ้ำได้
    event.target.value = '';
}

window.addEventListener('DOMContentLoaded', () => {
    updateFoodDatalist();
    renderApp();
});
