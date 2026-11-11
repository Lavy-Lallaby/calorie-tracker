// ตั้งค่า Gemini API Key (ใส่คีย์ของคุณที่นี่)
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";

const DAILY_TARGET_CAL = 1500;
let currentDate = new Date().toISOString().split('T')[0];
let allData = JSON.parse(localStorage.getItem('fit_tracker_data') || '{}');

const mealConfig = {
    morning: { title: 'มื้อเช้า', color: 'orange', border: 'border-orange-100', text: 'text-orange-600', badge: 'bg-orange-50' },
    lunch: { title: 'มื้อเที่ยง', color: 'red', border: 'border-rose-100', text: 'text-rose-600', badge: 'bg-rose-50' },
    dinner: { title: 'มื้อเย็น', color: 'sky', border: 'border-sky-100', text: 'text-sky-600', badge: 'bg-sky-50' },
    snack: { title: 'ของว่าง / อื่นๆ', color: 'purple', border: 'border-purple-100', text: 'text-purple-600', badge: 'bg-purple-50' }
};

function initApp() {
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    document.getElementById('current-date-display').innerText = new Date(currentDate).toLocaleDateString('th-TH', options);
    renderMeals();
    updateDashboard();
}

function getTodayData() {
    if (!allData[currentDate]) {
        allData[currentDate] = { morning: [], lunch: [], dinner: [], snack: [] };
    }
    return allData[currentDate];
}

function saveData() {
    localStorage.setItem('fit_tracker_data', JSON.stringify(allData));
    updateDashboard();
}

function renderMeals() {
    const container = document.getElementById('meals-container');
    container.innerHTML = '';
    const data = getTodayData();

    Object.keys(mealConfig).forEach(mealKey => {
        const config = mealConfig[mealKey];
        const items = data[mealKey] || [];
        const totalCal = items.reduce((sum, item) => sum + (item.cal * item.qty), 0);
        const totalProtein = items.reduce((sum, item) => sum + (item.protein * item.qty), 0);

        let itemsHtml = items.length === 0 
            ? `<p class="text-xs text-slate-400 italic py-1">ยังไม่มีรายการอาหาร</p>`
            : items.map((item, idx) => `
                <div class="flex justify-between items-center py-2 border-b border-slate-100 last:border-none text-xs">
                    <div>
                        <span class="font-bold text-slate-700">${item.name}</span>
                        <span class="text-slate-400 ml-1">x${item.qty}</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="font-semibold text-slate-600">${Math.round(item.cal * item.qty)} kcal <span class="text-emerald-600">(${Math.round(item.protein * item.qty)}g)</span></span>
                        <button onclick="editItem('${mealKey}', ${idx})" class="text-slate-400 hover:text-indigo-600">✏️</button>
                        <button onclick="deleteItem('${mealKey}', ${idx})" class="text-slate-400 hover:text-rose-600">🗑️</button>
                    </div>
                </div>
            `).join('');

        container.innerHTML += `
            <div class="bg-white border ${config.border} rounded-2xl p-4 shadow-sm">
                <div class="flex justify-between items-center mb-3">
                    <span class="text-xs font-extrabold px-2.5 py-1 rounded-xl ${config.badge} ${config.text}">${config.title}</span>
                    <span class="text-xs font-bold text-slate-500">${Math.round(totalCal)} kcal | โปรตีน ${Math.round(totalProtein)}g</span>
                </div>
                <div class="space-y-1">${itemsHtml}</div>
                <button onclick="openAddFoodModal('${mealKey}')" class="mt-3 w-full py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-xl text-xs transition">
                    + เพิ่ม ${config.title}
                </button>
            </div>
        `;
    });
}

function updateDashboard() {
    const data = getTodayData();
    let totalCal = 0;
    let totalProtein = 0;

    Object.keys(mealConfig).forEach(mealKey => {
        const items = data[mealKey] || [];
        totalCal += items.reduce((sum, item) => sum + (item.cal * item.qty), 0);
        totalProtein += items.reduce((sum, item) => sum + (item.protein * item.qty), 0);
    });

    const remaining = DAILY_TARGET_CAL - totalCal;
    document.getElementById('remaining-cal').innerText = remaining;
    document.getElementById('total-protein').innerText = Math.round(totalProtein);
    document.getElementById('consumed-cal-text').innerText = `ทานไป ${Math.round(totalCal)} kcal`;

    let percent = Math.min((totalCal / DAILY_TARGET_CAL) * 100, 100);
    document.getElementById('calorie-progress-bar').style.width = `${percent}%`;

    const badge = document.getElementById('status-badge');
    if (totalCal >= 1200 && totalCal <= 1500) {
        badge.innerText = "ผ่านเกณฑ์ดีมาก 👍";
        badge.className = "px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]";
    } else if (totalCal > 1500) {
        badge.innerText = "เกินเป้าหมาย ⚠️";
        badge.className = "px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px]";
    } else {
        badge.innerText = "ต่ำกว่าเกณฑ์ / กำลังคุม";
        badge.className = "px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px]";
    }
}

// Modal Management
function openAddFoodModal(defaultMeal = 'morning') {
    document.getElementById('modal-title').innerText = "บันทึกมื้ออาหาร";
    document.getElementById('meal-type').value = defaultMeal;
    document.getElementById('food-name').value = '';
    document.getElementById('base-cal').value = '';
    document.getElementById('base-protein').value = '';
    document.getElementById('food-qty').value = 1;
    document.getElementById('edit-index').value = '';
    document.getElementById('edit-meal-type').value = '';
    calculatePreview();
    document.getElementById('food-modal').classList.remove('hidden');
    document.getElementById('food-modal').classList.add('flex');
}

function closeAddFoodModal() {
    document.getElementById('food-modal').classList.add('hidden');
    document.getElementById('food-modal').classList.remove('flex');
}

function calculatePreview() {
    const cal = parseFloat(document.getElementById('base-cal').value) || 0;
    const protein = parseFloat(document.getElementById('base-protein').value) || 0;
    const qty = parseFloat(document.getElementById('food-qty').value) || 1;
    document.getElementById('preview-cal').innerText = Math.round(cal * qty);
    document.getElementById('preview-protein').innerText = Math.round(protein * qty * 10) / 10;
}

function saveFoodItem(e) {
    e.preventDefault();
    const mealType = document.getElementById('meal-type').value;
    const name = document.getElementById('food-name').value;
    const cal = parseFloat(document.getElementById('base-cal').value);
    const protein = parseFloat(document.getElementById('base-protein').value);
    const qty = parseFloat(document.getElementById('food-qty').value);
    const editIndex = document.getElementById('edit-index').value;
    const editMealType = document.getElementById('edit-meal-type').value;

    const data = getTodayData();

    if (editIndex !== "" && editMealType !== "") {
        data[editMealType].splice(editIndex, 1);
    }

    if (!data[mealType]) data[mealType] = [];
    data[mealType].push({ name, cal, protein, qty });

    saveData();
    renderMeals();
    closeAddFoodModal();
}

function editItem(mealKey, idx) {
    const item = allData[currentDate][mealKey][idx];
    document.getElementById('modal-title').innerText = "แก้ไขรายการอาหาร";
    document.getElementById('meal-type').value = mealKey;
    document.getElementById('food-name').value = item.name;
    document.getElementById('base-cal').value = item.cal;
    document.getElementById('base-protein').value = item.protein;
    document.getElementById('food-qty').value = item.qty;
    document.getElementById('edit-index').value = idx;
    document.getElementById('edit-meal-type').value = mealKey;
    calculatePreview();
    document.getElementById('food-modal').classList.remove('hidden');
    document.getElementById('food-modal').classList.add('flex');
}

function deleteItem(mealKey, idx) {
    if (confirm('ต้องการลบรายการนี้ใช่หรือไม่?')) {
        allData[currentDate][mealKey].splice(idx, 1);
        saveData();
        renderMeals();
    }
}

// History & Calendar Modal
function openHistoryModal() {
    const container = document.getElementById('calendar-container');
    container.innerHTML = '';
    
    const dates = Object.keys(allData).sort().reverse();
    if (dates.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">ยังไม่มีประวัติการบันทึกย้อนหลัง</p>`;
    } else {
        dates.forEach(date => {
            const dayData = allData[date];
            let totalCal = 0;
            let totalProtein = 0;
            Object.keys(mealConfig).forEach(m => {
                (dayData[m] || []).forEach(i => {
                    totalCal += i.cal * i.qty;
                    totalProtein += i.protein * i.qty;
                });
            });

            container.innerHTML += `
                <div class="bg-slate-50 p-3.5 rounded-2xl flex justify-between items-center border border-slate-100">
                    <div>
                        <span class="text-xs font-bold text-slate-800 block">${date}</span>
                        <span class="text-[10px] text-slate-500">แคล: ${Math.round(totalCal)} kcal | โปรตีน: ${Math.round(totalProtein)}g</span>
                    </div>
                    <button onclick="selectDate('${date}')" class="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 transition">เลือกดู</button>
                </div>
            `;
        });
    }

    document.getElementById('history-modal').classList.remove('hidden');
    document.getElementById('history-modal').classList.add('flex');
}

function closeHistoryModal() {
    document.getElementById('history-modal').classList.add('hidden');
    document.getElementById('history-modal').classList.remove('flex');
}

function selectDate(date) {
    currentDate = date;
    closeHistoryModal();
    initApp();
}

// Settings Modal
function openSettingsModal() {
    document.getElementById('settings-modal').classList.remove('hidden');
    document.getElementById('settings-modal').classList.add('flex');
}
function closeSettingsModal() {
    document.getElementById('settings-modal').classList.add('hidden');
    document.getElementById('settings-modal').classList.remove('flex');
}

function exportDataJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allData));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `fit_tracker_backup_${currentDate}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
}

function importDataJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            allData = JSON.parse(e.target.result);
            localStorage.setItem('fit_tracker_data', JSON.stringify(allData));
            initApp();
            alert('✨ กู้คืนข้อมูลสำเร็จ!');
            closeSettingsModal();
        } catch (err) {
            alert('ไฟล์ JSON ไม่ถูกต้อง');
        }
    };
    reader.readAsText(file);
}

// ==========================================
// AI & Scanner Functions (Gemini & Barcode)
// ==========================================
async function analyzeFoodImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    const btnText = document.getElementById('ai-btn-text');
    if (btnText) btnText.innerText = 'กำลังวิเคราะห์...';

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Image = e.target.result.split(',')[1];
        const prompt = "Analyze this food image. Estimate food name in Thai, calories (kcal), and protein (grams). Return strictly ONLY a JSON object with keys: food_name (string), calories (number), protein (number).";

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: file.type, data: base64Image } }
                        ]
                    }],
                    generationConfig: { response_mime_type: "application/json" }
                })
            });

            const data = await response.json();
            const resultText = data.candidates[0].content.parts[0].text;
            const result = JSON.parse(resultText);

            document.getElementById('food-name').value = result.food_name || '';
            document.getElementById('base-cal').value = result.calories || 0;
            document.getElementById('base-protein').value = result.protein || 0;
            document.getElementById('food-qty').value = 1;
            calculatePreview();

            if (btnText) btnText.innerText = 'ถ่ายรูปอาหาร';
            alert(`✨ วิเคราะห์สำเร็จ: ${result.food_name} (${result.calories} kcal)`);
        } catch (error) {
            console.error(error);
            alert('ไม่สามารถวิเคราะห์รูปภาพได้ กรุณาลองใหม่อีกครั้ง');
            if (btnText) btnText.innerText = 'ถ่ายรูปอาหาร';
        }
    };
    reader.readAsDataURL(file);
}

async function analyzeNutritionLabel(event) {
    const file = event.target.files[0];
    if (!file) return;

    alert('⏳ กำลังอ่านตารางโภชนาการจากฉลาก...');

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Image = e.target.result.split(',')[1];
        const prompt = "Analyze this nutrition facts label image. Extract the food name, calories (kcal), and protein (grams) per serving. Return strictly ONLY a JSON object with keys: food_name (string), calories (number), protein (number).";

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: file.type, data: base64Image } }
                        ]
                    }],
                    generationConfig: { response_mime_type: "application/json" }
                })
            });

            const data = await response.json();
            const resultText = data.candidates[0].content.parts[0].text;
            const result = JSON.parse(resultText);

            document.getElementById('food-name').value = result.food_name || 'อาหารจากฉลาก';
            document.getElementById('base-cal').value = result.calories || 0;
            document.getElementById('base-protein').value = result.protein || 0;
            document.getElementById('food-qty').value = 1;
            calculatePreview();

            alert('✨ อ่านฉลากโภชนาการสำเร็จ!');
        } catch (error) {
            console.error(error);
            alert('ไม่สามารถอ่านข้อมูลจากภาพฉลากได้ กรุณาลองใหม่อีกครั้ง');
        }
    };
    reader.readAsDataURL(file);
}

let html5QrCode = null;

function startBarcodeScanner() {
    const container = document.getElementById('barcode-scanner-container');
    container.classList.remove('hidden');

    html5QrCode = new Html5Qrcode("interactive");
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        async (decodedText) => {
            stopBarcodeScanner();
            await fetchProductByBarcode(decodedText);
        },
        (errorMessage) => {}
    ).catch(err => {
        alert("ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบสิทธิ์การอนุญาตใช้กล้อง");
        container.classList.add('hidden');
    });
}

function stopBarcodeScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('barcode-scanner-container').classList.add('hidden');
        }).catch(err => console.error(err));
    }
}

async function fetchProductByBarcode(barcode) {
    alert(`🔍 กำลังค้นหาข้อมูลสินค้าบาร์โค้ด: ${barcode}...`);
    try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
        const data = await response.json();

        if (data.status === 1) {
            const product = data.product;
            const name = product.product_name || 'สินค้าไม่ระบุชื่อ';
            const nutriments = product.nutriments || {};
            
            const cal = nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0;
            const protein = nutriments['proteins_100g'] || nutriments['proteins'] || 0;

            document.getElementById('food-name').value = name;
            document.getElementById('base-cal').value = Math.round(cal);
            document.getElementById('base-protein').value = Math.round(protein * 10) / 10;
            document.getElementById('food-qty').value = 1;
            calculatePreview();

            alert(`✨ พบสินค้า: ${name}`);
        } else {
            alert('ไม่พบข้อมูลสินค้าชิ้นนี้ในระบบฐานข้อมูล สามารถพิมพ์ชื่อและแคลอรีเองได้เลยครับ');
        }
    } catch (err) {
        console.error(err);
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูลบาร์โค้ด');
    }
}

// Run app
window.onload = initApp;
