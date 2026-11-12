// State Management
let currentDateKey = getFormattedDateKey(new Date());
let currentScanMode = 'label';
let html5QrCode = null;

// Mock data initialization if empty
const defaultHistory = {
    "2026-11-12": {
        meals: {
            "มื้อเช้า": [
                { name: "หมูย่าง", qty: "x3", calories: 300, protein: 21, carbs: 0, sugar: 0, fat: 15, satFat: 5, transFat: 0, sodium: 400, cholesterol: 80 },
                { name: "ข้าวเหนียว", qty: "x1", calories: 155, protein: 2.5, carbs: 34, sugar: 0, fat: 1, satFat: 0.2, transFat: 0, sodium: 10, cholesterol: 0 },
                { name: "ชามะนาว น้ำผึ้ง", qty: "x1", calories: 25, protein: 0, carbs: 6, sugar: 6, fat: 0, satFat: 0, transFat: 0, sodium: 5, cholesterol: 0 }
            ],
            "มื้อเที่ยง": [
                { name: "หมูย่าง", qty: "x1", calories: 100, protein: 7, carbs: 0, sugar: 0, fat: 5, satFat: 1.5, transFat: 0, sodium: 130, cholesterol: 25 },
                { name: "เกาเหลาหมู", qty: "x1", calories: 400, protein: 30, carbs: 14, sugar: 4, fat: 23, satFat: 8, transFat: 0, sodium: 1760, cholesterol: 115 }
            ],
            "มื้อเย็น": []
        }
    }
};

let allMealsHistory = JSON.parse(localStorage.getItem('fitTracker_history')) || defaultHistory;
let foodCatalog = JSON.parse(localStorage.getItem('fitTracker_catalog')) || [
    { name: "อกไก่ต้ม (100g)", calories: 120, protein: 25, carbs: 0, sugar: 0, fat: 1.5, satFat: 0.4, transFat: 0, sodium: 60, cholesterol: 50 },
    { name: "ข้าวสวย (1 ทัพพี)", calories: 80, protein: 2, carbs: 18, sugar: 0, fat: 0.2, satFat: 0, transFat: 0, sodium: 0, cholesterol: 0 },
    { name: "ไข่ต้ม (1 ฟอง)", calories: 75, protein: 6, carbs: 0.5, sugar: 0.5, fat: 5, satFat: 1.6, transFat: 0, sodium: 70, cholesterol: 186 }
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
    renderNutritionCoach();
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

// ✅ แก้เป็น (เช็กให้ครบทั้ง 4 มื้อ แม้จะเป็นข้อมูลเก่าที่เคยเซฟไว้แล้ว)
function getDayData(dateKey) {
    if (!allMealsHistory[dateKey]) {
        allMealsHistory[dateKey] = { meals: {} };
    }
    if (!allMealsHistory[dateKey].meals) {
        allMealsHistory[dateKey].meals = {};
    }
    mealTypes.forEach(type => {
        if (!allMealsHistory[dateKey].meals[type]) {
            allMealsHistory[dateKey].meals[type] = [];
        }
    });
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
    let totalCal = 0, totalProt = 0, totalCarbs = 0, totalSugar = 0;
    let totalFat = 0, totalSatFat = 0, totalTransFat = 0;
    let totalSodium = 0, totalChol = 0;

    Object.values(dayData.meals).forEach(mealList => {
        mealList.forEach(item => {
            totalCal += Number(item.calories || 0);
            totalProt += Number(item.protein || 0);
            totalCarbs += Number(item.carbs || 0);
            totalSugar += Number(item.sugar || 0);
            totalFat += Number(item.fat || 0);
            totalSatFat += Number(item.satFat || 0);
            totalTransFat += Number(item.transFat || 0);
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
    document.getElementById('sugar-total').innerText = `${totalSugar.toFixed(1)}g`;
    document.getElementById('fats-total').innerText = `${totalFat.toFixed(1)}g`;
    document.getElementById('satfat-total').innerText = `${totalSatFat.toFixed(1)}g`;
    document.getElementById('transfat-total').innerText = `${totalTransFat.toFixed(1)}g`;
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
// Image Capture Router (Tesseract OCR vs AI)
// ==========================================
function triggerImageCapture(mode) {
    if (mode === 'food') {
        const apiKey = localStorage.getItem('fitTracker_gemini_key');
        if (!apiKey) {
            alert("ปุ่มถ่ายรูปอาหารต้องใส่ Gemini API Key ในปุ่มตั้งค่า (⚙️) ก่อนครับ\n(แต่ปุ่ม 'สแกนฉลาก' และ 'บาร์โค้ด' กดใช้ได้เลยไม่ต้องใส่ Key)");
            openSettingsModal();
            return;
        }
    }
    currentScanMode = mode;
    const input = document.getElementById('ai-image-input');
    input.value = '';
    input.click();
}

async function handleImageSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (currentScanMode === 'label') {
        await scanLabelOfflineOCR(file);
    } else {
        await scanFoodWithGemini(file);
    }
}

// ==========================================
// 1. Offline Label OCR (Tesseract.js)
// ==========================================
async function scanLabelOfflineOCR(file) {
    const loader = document.getElementById('ai-loading-indicator');
    loader.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังอ่านฉลาก...';
    loader.classList.remove('hidden');

    try {
        const worker = await Tesseract.createWorker(['tha', 'eng']);
        const ret = await worker.recognize(file);
        await worker.terminate();

        const text = ret.data.text.replace(/\s+/g, ' ');
        console.log("OCR Text:", text);

        const extractValue = (regex) => {
            const match = text.match(regex);
            return match ? parseFloat(match[1]) : 0;
        };

        const calories = extractValue(/(?:พลังงานทั้งหมด|พลังงาน|Energy|Calories)[^\d]*(\d+(?:\.\d+)?)/i);
        const protein  = extractValue(/(?:โปรตีน|Protein)[^\d]*(\d+(?:\.\d+)?)/i);
        const carbs    = extractValue(/(?:คาร์โบไฮเดรตทั้งหมด|คาร์โบไฮเดรต|Carbohydrate)[^\d]*(\d+(?:\.\d+)?)/i);
        const sugar    = extractValue(/(?:น้ำตาล|Sugar)[^\d]*(\d+(?:\.\d+)?)/i);
        const fat      = extractValue(/(?:ไขมันทั้งหมด|ไขมัน|Total Fat|Fat)[^\d]*(\d+(?:\.\d+)?)/i);
        const satFat   = extractValue(/(?:ไขมันอิ่มตัว|Saturated Fat)[^\d]*(\d+(?:\.\d+)?)/i);
        const transFat = extractValue(/(?:ไขมันทรานส์|Trans Fat)[^\d]*(\d+(?:\.\d+)?)/i);
        const sodium   = extractValue(/(?:โซเดียม|Sodium)[^\d]*(\d+(?:\.\d+)?)/i);
        const chol     = extractValue(/(?:โคเลสเตอรอล|คอเลสเตอรอล|Cholesterol)[^\d]*(\d+(?:\.\d+)?)/i);

        fillFormWithNutritionData({
            name: "สินค้าจากฉลาก",
            qty: "1 หน่วยบริโภค",
            calories,
            protein,
            carbs: carbs || sugar, // กรณีเป็นฉลาก 4 ช่องที่มีแต่น้ำตาล
            sugar,
            fat,
            satFat,
            transFat,
            sodium,
            cholesterol: chol
        });

        if (calories === 0 && protein === 0 && carbs === 0 && sugar === 0 && fat === 0 && sodium === 0) {
            alert("ไม่พบตัวเลขสารอาหารที่ชัดเจนบนภาพ ลองถ่ายให้ตัวหนังสือในตารางตรงและชัดขึ้นนะครับ");
        }
    } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาดในการอ่านตัวหนังสือ: " + err.message);
    } finally {
        loader.classList.add('hidden');
    }
}

// ==========================================
// 2. Gemini AI Food Photo Scanner
// ==========================================
async function scanFoodWithGemini(file) {
    const loader = document.getElementById('ai-loading-indicator');
    loader.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> AI กำลังวิเคราะห์...';
    loader.classList.remove('hidden');

    try {
        const base64Data = await resizeImageToBase64(file, 800);
        const apiKey = localStorage.getItem('fitTracker_gemini_key');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

        const promptText = `วิเคราะห์ภาพอาหารจานนี้ ประเมินชื่อเมนูภาษาไทย ปริมาณ และสารอาหาร ตอบกลับเป็น JSON เท่านั้น:
           {"name": "ชื่อเมนูภาษาไทย", "qty": "ปริมาณ เช่น 1 จาน", "calories": ตัวเลข, "protein": ตัวเลข, "carbs": ตัวเลข, "sugar": ตัวเลข, "fat": ตัวเลข, "satFat": ตัวเลข, "transFat": ตัวเลข, "sodium": ตัวเลข, "cholesterol": ตัวเลข}`;

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
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || "เชื่อมต่อ Gemini API ไม่สำเร็จ");
        }

        const data = await response.json();
        const result = JSON.parse(data.candidates[0].content.parts[0].text);
        if (result) fillFormWithNutritionData(result);
    } catch (error) {
        alert("เกิดข้อผิดพลาดจาก AI: " + error.message);
    } finally {
        loader.classList.add('hidden');
    }
}

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
                resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ==========================================
// 3. Barcode Scanner & Open Food Facts API
// ==========================================
function openBarcodeScanner() {
    document.getElementById('barcode-modal').classList.remove('hidden');
    document.getElementById('barcode-status').innerText = "กำลังเปิดกล้อง...";

    html5QrCode = new Html5Qrcode("barcode-reader");
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        async (decodedText) => {
            document.getElementById('barcode-status').innerText = `พบบาร์โค้ด: ${decodedText} กำลังค้นหาข้อมูล...`;
            await stopBarcodeCamera();
            document.getElementById('barcode-modal').classList.add('hidden');
            fetchBarcodeProduct(decodedText);
        },
        () => {}
    ).catch(() => {
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
        } catch (e) {}
    }
}

async function fetchBarcodeProduct(barcode) {
    const loader = document.getElementById('ai-loading-indicator');
    loader.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังค้นหาข้อมูลบาร์โค้ด...';
    loader.classList.remove('hidden');

    try {
        const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
        const data = await res.json();

        if (data.status === 1 && data.product) {
            const p = data.product;
            const n = p.nutriments || {};
            const hasServing = n['energy-kcal_serving'] !== undefined;
            const suffix = hasServing ? '_serving' : '_100g';

            fillFormWithNutritionData({
                name: p.product_name_th || p.product_name || `สินค้า (${barcode})`,
                qty: hasServing ? (p.serving_size || "1 หน่วยบริโภค") : "100g",
                calories: Math.round(n[`energy-kcal${suffix}`] || 0),
                protein: Number((n[`proteins${suffix}`] || 0).toFixed(1)),
                carbs: Number((n[`carbohydrates${suffix}`] || 0).toFixed(1)),
                sugar: Number((n[`sugars${suffix}`] || 0).toFixed(1)),
                fat: Number((n[`fat${suffix}`] || 0).toFixed(1)),
                satFat: Number((n[`saturated-fat${suffix}`] || 0).toFixed(1)),
                transFat: Number((n[`trans-fat${suffix}`] || 0).toFixed(1)),
                sodium: Math.round((n[`sodium${suffix}`] || 0) * 1000),
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
    document.getElementById('food-sugar').value = item.sugar ?? 0;
    document.getElementById('food-fat').value = item.fat ?? 0;
    document.getElementById('food-satfat').value = item.satFat ?? 0;
    document.getElementById('food-transfat').value = item.transFat ?? 0;
    document.getElementById('food-sodium').value = item.sodium ?? 0;
    document.getElementById('food-cholesterol').value = item.cholesterol ?? 0;
}

// ==========================================
// Settings & Existing Modal Controls
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
        document.getElementById('food-sugar').value = item.sugar || '';
        document.getElementById('food-fat').value = item.fat || '';
        document.getElementById('food-satfat').value = item.satFat || '';
        document.getElementById('food-transfat').value = item.transFat || '';
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
        sugar: Number(document.getElementById('food-sugar').value || 0),
        fat: Number(document.getElementById('food-fat').value || 0),
        satFat: Number(document.getElementById('food-satfat').value || 0),
        transFat: Number(document.getElementById('food-transfat').value || 0),
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
        document.getElementById('food-sugar').value = found.sugar ?? 0;
        document.getElementById('food-fat').value = found.fat;
        document.getElementById('food-satfat').value = found.satFat ?? 0;
        document.getElementById('food-transfat').value = found.transFat ?? 0;
        document.getElementById('food-sodium').value = found.sodium;
        document.getElementById('food-cholesterol').value = found.cholesterol;
    }
}

// ==========================================
// Smart Nutrition Coach (ใต้มื้อว่าง)
// ==========================================
function renderNutritionCoach() {
    const container = document.getElementById('coach-container');
    if (!container) return;

    const dayData = getDayData(currentDateKey);
    let totalCal = 0, totalProt = 0, totalSugar = 0, totalSatFat = 0, totalTransFat = 0, totalSodium = 0, totalChol = 0;

    Object.values(dayData.meals).forEach(mealList => {
        mealList.forEach(item => {
            totalCal += Number(item.calories || 0);
            totalProt += Number(item.protein || 0);
            totalSugar += Number(item.sugar || 0);
            totalSatFat += Number(item.satFat || 0);
            totalTransFat += Number(item.transFat || 0);
            totalSodium += Number(item.sodium || 0);
            totalChol += Number(item.cholesterol || 0);
        });
    });

    const targetCal = 1500;
    const minProt = 96;
    const remCal = targetCal - totalCal;
    const remProt = Math.max(0, minProt - totalProt);

    // 1. วิเคราะห์สิ่งที่ควรเลี่ยง / ระวังวันนี้
    let warnings = [];
    if (totalSodium > 2000) {
        warnings.push(`โซเดียมสูงแล้ว (${Math.round(totalSodium)}/2,000 mg) <b>ควรงด</b> ซดน้ำซุป อาหารแปรรูป บะหมี่กึ่งสำเร็จรูป และของหมักดอง`);
    }
    if (totalSugar > 24) {
        warnings.push(`น้ำตาลเกินเกณฑ์ (${totalSugar.toFixed(1)}/24 g) <b>ควรเลี่ยง</b> ชานม น้ำอัดลม ขนมหวาน และผลไม้รสหวานจัด`);
    }
    if (totalSatFat > 15 || totalTransFat > 0) {
        warnings.push(`ไขมันอิ่มตัว/ทรานส์เริ่มสูง <b>ควรเลี่ยง</b> ของทอด เบเกอรี่ ครีมเทียม กะทิ และเนื้อสัตว์ติดมัน`);
    }
    if (totalChol > 250) {
        warnings.push(`คอเลสเตอรอลใกล้เกิน 300 mg <b>ควรเลี่ยง</b> ไข่แดง เครื่องในสัตว์ และอาหารทะเลบางชนิด (เลือกกินเฉพาะไข่ขาวแทน)`);
    }
    if (remCal < 150 && remCal >= 0) {
        warnings.push(`แคลอรีเหลือน้อย (${remCal} kcal) <b>ควรงด</b> ของทานเล่นที่มีแป้งและไขมันสูง`);
    } else if (remCal < 0) {
        warnings.push(`ทานเกินโควตาไปแล้ว ${Math.abs(remCal)} kcal <b>ควรงดมื้อดึก</b> และดื่มน้ำเปล่าแทน`);
    }

    if (warnings.length === 0) {
        warnings.push(`ค่าโซเดียม น้ำตาล และไขมันยังอยู่ในเกณฑ์ดี <b>เลี่ยง</b> ของทอดและน้ำหวานเพื่อรักษาสมดุลต่อ`);
    }

    // 2. แนะนำเมนูเพิ่มโปรตีนให้ถึงเป้า (เลือกเมนูที่แคลอรีพอดีกับงบที่เหลือ)
    const proteinMenus = [
        { name: "ไข่ขาวต้ม 3 ฟอง", cal: 50, prot: 11, note: "โปรตีนล้วน แคลต่ำมาก ไร้ไขมัน" },
        { name: "เวย์โปรตีนไอโซเลต 1 สกู๊ป", cal: 120, prot: 25, note: "ดูดซึมไว เติมโปรตีนได้เยอะในแคลน้อย" },
        { name: "อกไก่นุ่มเซเว่น 1 ชิ้น", cal: 130, prot: 23, note: "หาซื้อง่าย อิ่มท้องนาน" },
        { name: "ทูน่าในน้ำแร่ 1 กระป๋อง", cal: 110, prot: 24, note: "ไขมันต่ำมาก ยำหรือกินกับสลัดได้" },
        { name: "กรีกโยเกิร์ต 0% 1 ถ้วย", cal: 90, prot: 15, note: "ช่วยเรื่องขับถ่ายและลดอยากของหวาน" },
        { name: "นมถั่วเหลืองโปรตีนสูง (ไม่หวาน) 1 ขวด", cal: 180, prot: 28, note: "ดื่มง่าย โปรตีนแน่น" },
        { name: "ปลาทับทิม/ปลานิลนึ่ง 1 ตัวกลาง", cal: 220, prot: 35, note: "ย่อยง่าย เหมาะเป็นมื้อเย็น" },
        { name: "ไข่ต้มทั้งฟอง 2 ฟอง", cal: 150, prot: 12, note: "ประหยัด อิ่มนาน" }
    ];

    let protHtml = "";
    if (remProt <= 0) {
        protHtml = `<div class="text-xs text-emerald-400 font-medium"><i class="fa-solid fa-circle-check mr-1"></i> ยินดีด้วย! วันนี้คุณทานโปรตีนถึงเป้าหมาย (${totalProt.toFixed(1)}g) เรียบร้อยแล้ว</div>`;
    } else {
        // กรองเมนูที่แคลอรีไม่เกินงบที่เหลือ (หรือถ้าเหลือน้อยมากให้แนะนำเมนูแคลต่ำสุด)
        let suitable = proteinMenus.filter(m => m.cal <= Math.max(remCal, 130)).slice(0, 3);
        protHtml = `
            <p class="text-xs text-slate-300 mb-2">
                ยังขาดโปรตีนอีก <span class="text-emerald-400 font-bold">${remProt.toFixed(1)}g</span> (งบพลังงานเหลือ <span class="text-white font-semibold">${Math.max(0, remCal)} kcal</span>) แนะนำเมนูนี้:
            </p>
            <div class="space-y-1.5">
                ${suitable.map(m => `
                    <div class="flex justify-between items-center bg-slate-950/70 px-3 py-2 rounded-xl border border-slate-800/80 text-xs">
                        <div>
                            <span class="text-slate-100 font-medium">${m.name}</span>
                            <span class="text-[10px] text-slate-400 block">${m.note}</span>
                        </div>
                        <div class="text-right shrink-0 ml-2">
                            <span class="text-emerald-400 font-bold block">+${m.prot}g โปรตีน</span>
                            <span class="text-[10px] text-slate-400">${m.cal} kcal</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    container.innerHTML = `
        <section class="bg-gradient-to-br from-slate-900 to-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-sm space-y-3.5">
            <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <h4 class="font-bold text-white text-sm flex items-center gap-2">
                    <i class="fa-solid fa-lightbulb text-amber-400"></i> คำแนะนำ & เมนูเสริมวันนี้
                </h4>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/50">อัปเดตอัตโนมัติ</span>
            </div>

            <!-- ส่วนแนะนำโปรตีน -->
            <div class="space-y-1">
                <div class="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <i class="fa-solid fa-drumstick-bite"></i> เติมโปรตีนให้ถึงเป้า (96-128g)
                </div>
                ${protHtml}
            </div>

            <!-- ส่วนเตือนสิ่งที่ไม่ควรกิน -->
            <div class="space-y-1.5 pt-2 border-t border-slate-800/60">
                <div class="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                    <i class="fa-solid fa-ban"></i> สิ่งที่ควรเลี่ยงในช่วงที่เหลือของวัน
                </div>
                <ul class="space-y-1 text-xs text-slate-300 list-disc list-inside">
                    ${warnings.map(w => `<li>${w}</li>`).join('')}
                </ul>
            </div>
        </section>
    `;
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
