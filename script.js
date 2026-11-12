// State Management
let currentDateKey = getFormattedDateKey(new Date());
let currentScanMode = 'food'; // 'food' or 'label'
let html5QrCode = null;

// Mock data initialization if empty
const defaultHistory = {
    "2026-11-12": {
        meals: {
            "มื้อเช้า": [
                { name: "หมูย่าง", qty: "x3", calories: 300, protein: 21, carbs: 0, fat: 15, sodium: 400, cholesterol: 80 },
                { name: "ข้าวเหนียว", qty: "x1", calories: 155, protein: 2.5, carbs: 34, fat: 1, sodium: 10, cholesterol: 0 },
                { name: "ชามะนาว น้ำผึ้ง", qty: "x1", calories: 25, protein: 0, carbs: 6, fat: 0, sodium: 5, cholesterol: 0 }
            ],
            "มื้อเที่ยง": [
                { name: "หมูย่าง", qty: "x1", calories: 100, protein: 7, carbs: 0, fat: 5, sodium: 130, cholesterol: 25 },
                { name: "เกาเหลาหมู", qty: "x1", calories: 400, protein: 30, carbs: 14, fat: 23, sodium: 1760, cholesterol: 115 }
            ],
            "มื้อเย็น": []
        }
    }
};

let allMealsHistory = JSON.parse(localStorage.getItem('fitTracker_history')) || defaultHistory;
let foodCatalog = JSON.parse(localStorage.getItem('fitTracker_catalog')) || [
    { name: "อกไก่ต้ม (100g)", calories: 120, protein: 25, carbs: 0, fat: 1.5, sodium: 60, cholesterol: 50 },
    { name: "ข้าวสวย (1 ทัพพี)", calories: 80, protein: 2, carbs: 18, fat: 0.2, sodium: 0, cholesterol: 0 },
    { name: "ไข่ต้ม (1 ฟอง)", calories: 75, protein: 6, carbs: 0.5, fat: 5, sodium: 70, cholesterol: 186 }
];

const mealTypes = ["มื้อเช้า", "มื้อเที่ยง", "มื้อเย็น", "มื้อว่าง/อื่นๆ"];

function getFormattedDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateKey) {
    const parts = dateKey.split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('th-TH', options);
}

function initApp() {
    renderDateDisplay();
    renderMeals();
    renderSummary();
    updateCatalogDatalist();
}

function renderDateDisplay() {
    document.getElementById('display-date').innerText = formatDisplayDate(currentDateKey);
    const todayKey = getFormattedDateKey(new Date());
    document.getElementById('current-date-badge').innerText = (currentDateKey === todayKey) ? "วันนี้" : currentDateKey;
}

function changeDay(direction) {
    const parts = currentDateKey.split('-');
    let d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + direction);
    currentDateKey = getFormattedDateKey(d);
    initApp();
}

function getDayData(dateKey) {
    if (!allMealsHistory[dateKey]) {
        allMealsHistory[dateKey] = { meals: { "มื้อเช้า": [], "มื้อเที่ยง": [], "มื้อเย็น": [], "มื้อว่าง/อื่นๆ": [] } };
    }
    return allMealsHistory[dateKey];
}

function renderMeals() {
    const container = document.getElementById('meals-container');
    container.innerHTML = '';
    const dayData = getDayData(currentDateKey);

    mealTypes.forEach(mealType => {
        const items = dayData.meals[mealType] || [];
        const totalCal = items.reduce((sum, item) => sum + Number(item.calories), 0);
        const totalProt = items.reduce((sum, item) => sum + Number(item.protein || 0), 0);

        let itemsHtml = items.map((item, idx) => `
            <div class="flex justify-between items-center py-2 border-b border-slate-800/40 last:border-none text-sm">
                <div>
                    <span class="text-white font-medium">${item.name}</span>
                    <span class="text-xs text-slate-400 ml-1.5">${item.qty || ''}</span>
                </div>
                <div class="flex items-center space-x-3">
                    <span class="text-slate-300 font-medium">${item.calories} kcal <span class="text-xs text-emerald-400">(${item.protein || 0}g)</span></span>
                    <div class="flex space-x-1.5">
                        <button onclick="openFoodModal('${mealType}', ${idx})" class="text-slate-500 hover:text-amber-400 transition p-1"><i class="fa-solid fa-pen text-xs"></i></button>
                        <button onclick="deleteMealItem('${mealType}', ${idx})" class="text-slate-500 hover:text-rose-400 transition p-1"><i class="fa-solid fa-trash text-xs"></i></button>
                    </div>
                </div>
            </div>
        `).join('');

        if (items.length === 0) {
            itemsHtml = `<div class="text-xs text-slate-500 py-1">ยังไม่มีรายการอาหารในมื้อนี้</div>`;
        }

        const card = document.createElement('div');
        card.className = "bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-sm space-y-3";
        card.innerHTML = `
            <div class="flex justify-between items-center border-b border-slate-800/80 pb-2.5">
                <div class="flex items-center space-x-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    <h4 class="font-semibold text-white text-sm">${mealType}</h4>
                </div>
                <div class="text-xs text-slate-400 font-medium">
                    ${totalCal} kcal | โปรตีน ${totalProt.toFixed(1)}g
                </div>
            </div>
            <div class="space-y-1">
                ${itemsHtml}
            </div>
            <button onclick="openFoodModal('${mealType}')" class="w-full mt-2 bg-slate-950 hover:bg-slate-800/80 border border-slate-800/80 text-slate-300 text-xs font-medium py-2 rounded-xl transition flex items-center justify-center gap-1.5">
                <i class="fa-solid fa-plus text-indigo-400"></i> เพิ่ม ${mealType}
            </button>
        `;
        container.appendChild(card);
    });
}

function renderSummary() {
    const dayData = getDayData(currentDateKey);
    let totalCal = 0, totalProt = 0, totalCarbs = 0, totalFat = 0, totalSodium = 0, totalChol = 0;

    Object.values(dayData.meals).forEach(mealList => {
        mealList.forEach(item => {
            totalCal += Number(item.calories || 0);
            totalProt += Number(item.protein || 0);
            totalCarbs += Number(item.carbs || 0);
            totalFat += Number(item.fat || 0);
            totalSodium += Number(item.sodium || 0);
            totalChol += Number(item.cholesterol || 0);
        });
    });

    const targetCal = 1500;
    const remaining = targetCal - totalCal;

    document.getElementById('calories-remaining').innerHTML = `${remaining} <span class="text-sm font-normal text-slate-400">kcal</span>`;
    document.getElementById('calories-consumed').innerText = `${totalCal} kcal`;
    document.getElementById('protein-summary').innerHTML = `${totalProt.toFixed(1)} / <span class="text-xs font-normal text-slate-400">96-128 g</span>`;
    document.getElementById('carbs-total').innerText = `${totalCarbs.toFixed(1)}g`;
    document.getElementById('fats-total').innerText = `${totalFat.toFixed(1)}g`;
    document.getElementById('sodium-total').innerText = `${Math.round(totalSodium)}mg`;
    document.getElementById('cholesterol-total').innerText = `${Math.round(totalChol)}mg`;

    const percent = Math.min(Math.round((totalCal / targetCal) * 100), 100);
    document.getElementById('calorie-progress-bar').style.width = `${percent}%`;

    const statusEl = document.getElementById('calorie-status');
    if (totalCal > targetCal) {
        statusEl.innerText = "เกินเป้าหมาย";
        statusEl.className = "px-2.5 py-1 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/50 font-medium";
    } else {
        statusEl.innerText = "ต่ำกว่าเกณฑ์ / กำลังคุม";
        statusEl.className = "px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 font-medium";
    }
}

// ==========================================
// AI Image & Nutrition Label Scanner
// ==========================================
function triggerImageCapture(mode) {
    const apiKey = localStorage.getItem('fitTracker_gemini_key');
    if (!apiKey) {
        alert("กรุณาใส่ Gemini API Key ในปุ่มตั้งค่า (รูปฟันเฟืองมุมขวาบน) ก่อนใช้งานฟีเจอร์ AI ครับ");
        openSettingsModal();
        return;
    }
    currentScanMode = mode;
    const input = document.getElementById('ai-image-input');
    input.value = '';
    input.click();
}

async function handleImageSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    const loader = document.getElementById('ai-loading-indicator');
    loader.classList.remove('hidden');

    try {
        const base64Image = await resizeImageToBase64(file, 800);
        const result = await analyzeImageWithGemini(base64Image, currentScanMode);
        
        if (result) {
            fillFormWithNutritionData(result);
        }
    } catch (error) {
        console.error(error);
        alert("เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพ: " + error.message);
    } finally {
        loader.classList.add('hidden');
    }
}

// ย่อขนาดภาพก่อนส่งเพื่อให้ทำงานเร็วขึ้นและประหยัดเน็ต
function resizeImageToBase64(file, maxWidth) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                resolve(dataUrl.split(',')[1]);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function analyzeImageWithGemini(base64Data, mode) {
    const apiKey = localStorage.getItem('fitTracker_gemini_key');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptText = mode === 'label'
        ? `อ่านข้อมูลจากภาพฉลากโภชนาการหรือฉลาก GDA (หวาน มัน เค็ม) นี้ สรุปค่าโภชนาการต่อ 1 หน่วยบริโภค (หรือต่อ 1 ซอง/ขวด/กล่อง ตามที่ระบุเด่นชัดที่สุด) ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่น:
           {"name": "ชื่อสินค้าหรืออาหาร (ถ้าไม่เห็นให้ใส่ว่า สินค้าจากฉลาก)", "qty": "ปริมาณต่อหน่วย เช่น 1 กล่อง, 1 ขวด", "calories": ตัวเลขพลังงาน kcal, "protein": ตัวเลขโปรตีน g, "carbs": ตัวเลขคาร์โบไฮเดรตหรือน้ำตาล g, "fat": ตัวเลขไขมัน g, "sodium": ตัวเลขโซเดียม mg, "cholesterol": ตัวเลขคอเลสเตอรอล mg} (ถ้าช่องไหนไม่มีข้อมูลให้ใส่ 0)`
        : `วิเคราะห์ภาพอาหารจานนี้ ประเมินชื่อเมนูภาษาไทย ปริมาณ และสารอาหารโดยประมาณ ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่น:
           {"name": "ชื่อเมนูอาหารภาษาไทย", "qty": "ปริมาณ เช่น 1 จาน, 1 ชาม", "calories": ตัวเลขพลังงาน kcal, "protein": ตัวเลขโปรตีน g, "carbs": ตัวเลขคาร์โบไฮเดรต g, "fat": ตัวเลขไขมัน g, "sodium": ตัวเลขโซเดียม mg, "cholesterol": ตัวเลขคอเลสเตอรอล mg}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: promptText },
                    { inline_data: { mime_type: "image/jpeg", data: base64Data } }
                ]
            }],
            generationConfig: {
                response_mime_type: "application/json"
            }
        })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || "เชื่อมต่อ Gemini API ไม่สำเร็จ");
    }

    const data = await response.json();
    const rawText = data.candidates[0].content.parts[0].text;
    return JSON.parse(rawText);
}

// ==========================================
// Barcode Scanner & Open Food Facts API
// ==========================================
function openBarcodeScanner() {
    document.getElementById('barcode-modal').classList.remove('hidden');
    document.getElementById('barcode-status').innerText = "กำลังเปิดกล้อง...";

    html5QrCode = new Html5Qrcode("barcode-reader");
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        async (decodedText) => {
            // เมื่อสแกนเจอเลขบาร์โค้ด
            document.getElementById('barcode-status').innerText = `พบบาร์โค้ด: ${decodedText} กำลังค้นหาข้อมูล...`;
            await stopBarcodeCamera();
            document.getElementById('barcode-modal').classList.add('hidden');
            fetchBarcodeProduct(decodedText);
        },
        (errorMessage) => { /* ข้าม error ระหว่างเล็งกล้อง */ }
    ).catch(err => {
        document.getElementById('barcode-status').innerText = "ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง";
    });
}

async function closeBarcodeScanner() {
    await stopBarcodeCamera();
    document.getElementById('barcode-modal').classList.add('hidden');
}

async function stopBarcodeCamera() {
    if (html5QrCode && html5QrCode.isScanning) {
        try {
            await html5QrCode.stop();
            html5QrCode.clear();
        } catch (e) {
            console.error(e);
        }
    }
}

async function fetchBarcodeProduct(barcode) {
    const loader = document.getElementById('ai-loading-indicator');
    loader.classList.remove('hidden');

    try {
        const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
        const data = await res.json();

        if (data.status === 1 && data.product) {
            const p = data.product;
            const n = p.nutriments || {};
            
            // ดึงค่าต่อ 1 หน่วยบริโภค (serving) ถ้าไม่มีให้ดึงต่อ 100g
            const hasServing = n['energy-kcal_serving'] !== undefined;
            const suffix = hasServing ? '_serving' : '_100g';

            fillFormWithNutritionData({
                name: p.product_name_th || p.product_name || `สินค้า (${barcode})`,
                qty: hasServing ? (p.serving_size || "1 หน่วยบริโภค") : "100g",
                calories: Math.round(n[`energy-kcal${suffix}`] || 0),
                protein: Number((n[`proteins${suffix}`] || 0).toFixed(1)),
                carbs: Number((n[`carbohydrates${suffix}`] || 0).toFixed(1)),
                fat: Number((n[`fat${suffix}`] || 0).toFixed(1)),
                sodium: Math.round((n[`sodium${suffix}`] || 0) * 1000), // แปลงจาก g เป็น mg
                cholesterol: Math.round((n[`cholesterol${suffix}`] || 0) * 1000)
            });
        } else {
            alert(`ไม่พบข้อมูลสินค้าบาร์โค้ด ${barcode} ในฐานข้อมูล ลองใช้ปุ่ม "สแกนฉลาก" แทนได้เลยครับ`);
        }
    } catch (error) {
        alert("เกิดข้อผิดพลาดในการค้นหาบาร์โค้ด");
    } finally {
        loader.classList.add('hidden');
    }
}

function fillFormWithNutritionData(item) {
    if (item.name) document.getElementById('food-name').value = item.name;
    if (item.qty) document.getElementById('food-qty').value = item.qty;
    document.getElementById('food-calories').value = item.calories ?? 0;
    document.getElementById('food-protein').value = item.protein ?? 0;
    document.getElementById('food-carbs').value = item.carbs ?? 0;
    document.getElementById('food-fat').value = item.fat ?? 0;
    document.getElementById('food-sodium').value = item.sodium ?? 0;
    document.getElementById('food-cholesterol').value = item.cholesterol ?? 0;
}

// ==========================================
// Settings Modal Controls
// ==========================================
function openSettingsModal() {
    const savedKey = localStorage.getItem('fitTracker_gemini_key') || '';
    document.getElementById('gemini-api-key-input').value = savedKey;
    document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.add('hidden');
}

function saveApiKey() {
    const key = document.getElementById('gemini-api-key-input').value.trim();
    if (key) {
        localStorage.setItem('fitTracker_gemini_key', key);
        alert("บันทึก API Key เรียบร้อยแล้ว!");
    } else {
        localStorage.removeItem('fitTracker_gemini_key');
        alert("ลบ API Key เรียบร้อยแล้ว");
    }
    closeSettingsModal();
}

// ==========================================
// Existing Modal & Data Controls
// ==========================================
function openFoodModal(mealType, itemIndex = null) {
    document.getElementById('edit-meal-type').value = mealType;
    document.getElementById('edit-item-index').value = itemIndex !== null ? itemIndex : '';
    document.getElementById('modal-title').innerText = itemIndex !== null ? `แก้ไขรายการ (${mealType})` : `เพิ่มรายการ (${mealType})`;

    if (itemIndex !== null) {
        const item = allMealsHistory[currentDateKey].meals[mealType][itemIndex];
        document.getElementById('food-name').value = item.name || '';
        document.getElementById('food-qty').value = item.qty || '';
        document.getElementById('food-calories').value = item.calories || '';
        document.getElementById('food-protein').value = item.protein || '';
        document.getElementById('food-carbs').value = item.carbs || '';
        document.getElementById('food-fat').value = item.fat || '';
        document.getElementById('food-sodium').value = item.sodium || '';
        document.getElementById('food-cholesterol').value = item.cholesterol || '';
    } else {
        document.getElementById('food-form').reset();
    }

    document.getElementById('food-modal').classList.remove('hidden');
}

function closeFoodModal() {
    document.getElementById('food-modal').classList.add('hidden');
}

function handleFoodSubmit(e) {
    e.preventDefault();
    const mealType = document.getElementById('edit-meal-type').value;
    const itemIndex = document.getElementById('edit-item-index').value;

    const newItem = {
        name: document.getElementById('food-name').value,
        qty: document.getElementById('food-qty').value,
        calories: Number(document.getElementById('food-calories').value),
        protein: Number(document.getElementById('food-protein').value || 0),
        carbs: Number(document.getElementById('food-carbs').value || 0),
        fat: Number(document.getElementById('food-fat').value || 0),
        sodium: Number(document.getElementById('food-sodium').value || 0),
        cholesterol: Number(document.getElementById('food-cholesterol').value || 0)
    };

    const dayData = getDayData(currentDateKey);
    if (itemIndex !== '') {
        dayData.meals[mealType][itemIndex] = newItem;
    } else {
        dayData.meals[mealType].push(newItem);
    }

    if (!foodCatalog.some(f => f.name.toLowerCase() === newItem.name.toLowerCase())) {
        foodCatalog.push(newItem);
        localStorage.setItem('fitTracker_catalog', JSON.stringify(foodCatalog));
        updateCatalogDatalist();
    }

    localStorage.setItem('fitTracker_history', JSON.stringify(allMealsHistory));
    closeFoodModal();
    initApp();
}

function deleteMealItem(mealType, index) {
    if (confirm("ต้องการลบรายการนี้ใช่ไหม?")) {
        const dayData = getDayData(currentDateKey);
        dayData.meals[mealType].splice(index, 1);
        localStorage.setItem('fitTracker_history', JSON.stringify(allMealsHistory));
        initApp();
    }
}

function updateCatalogDatalist() {
    const datalist = document.getElementById('food-catalog-list');
    datalist.innerHTML = foodCatalog.map(f => `<option value="${f.name}">(${f.calories} kcal, โปรตีน ${f.protein}g)</option>`).join('');
}

function autofillFoodCatalog(name) {
    const found = foodCatalog.find(f => f.name.toLowerCase() === name.toLowerCase());
    if (found) {
        document.getElementById('food-calories').value = found.calories;
        document.getElementById('food-protein').value = found.protein;
        document.getElementById('food-carbs').value = found.carbs;
        document.getElementById('food-fat').value = found.fat;
        document.getElementById('food-sodium').value = found.sodium;
        document.getElementById('food-cholesterol').value = found.cholesterol;
    }
}

function openCalendarModal() {
    const container = document.getElementById('calendar-grid-container');
    container.innerHTML = '';
    
    const today = new Date();
    for (let i = -3; i <= 3; i++) {
        let d = new Date(today);
        d.setDate(today.getDate() + i);
        let key = getFormattedDateKey(d);
        let isCurrent = key === currentDateKey;

        let btn = document.createElement('button');
        btn.className = `w-full text-left px-4 py-2.5 rounded-xl text-sm flex justify-between items-center transition ${isCurrent ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300'}`;
        btn.innerHTML = `<span>${formatDisplayDate(key)}</span> ${isCurrent ? '<i class="fa-solid fa-check text-xs"></i>' : ''}`;
        btn.onclick = () => {
            currentDateKey = key;
            closeCalendarModal();
            initApp();
        };
        container.appendChild(btn);
    }
    document.getElementById('calendar-modal').classList.remove('hidden');
}

function closeCalendarModal() {
    document.getElementById('calendar-modal').classList.add('hidden');
}

// Initialize on load
window.onload = initApp;
