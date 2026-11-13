// ==========================================
// GitHub DB Config (Lavy-Lallaby/fittracker-db)
// ==========================================
const GITHUB_OWNER = "Lavy-Lallaby";
const GITHUB_REPO  = "fittracker-db";
const GITHUB_PATH  = "db.json";
let currentFileSha = null;

// Helper Date Formatter (ต้องประกาศก่อนใช้สร้าง currentDateKey)
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

// ==========================================
// State Management
// ==========================================
let currentDateKey = getFormattedDateKey(new Date());
let currentScanMode = 'label';
let html5QrCode = null;
let baseNutrition = null;

// Calendar State
let calendarViewYear = new Date().getFullYear();
let calendarViewMonth = new Date().getMonth();
let calendarSelectedKey = currentDateKey;

const defaultHistory = {
    "2026-11-12": {
        steps: 4500,
        workouts: [],
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
            "มื้อเย็น": [],
            "มื้อว่าง/อื่นๆ": []
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

// ==========================================
// UTF-8 Safe Base64 Helpers for GitHub API
// ==========================================
function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binString = "";
    bytes.forEach((b) => { binString += String.fromCharCode(b); });
    return btoa(binString);
}

function base64ToUtf8(base64) {
    const binString = atob(base64.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0));
    return new TextDecoder().decode(bytes);
}

function setSyncStatus(type, text) {
    const badge = document.getElementById('sync-status-badge');
    const icon = document.getElementById('sync-icon');
    if (!badge) return;

    if (type === 'syncing') {
        badge.innerHTML = `<i class="fa-solid fa-rotate fa-spin text-sky-400"></i> ${text}`;
        badge.className = "text-[10px] text-sky-400 block mt-0.5";
        if (icon) icon.classList.add('fa-spin');
    } else if (type === 'synced') {
        badge.innerHTML = `<i class="fa-solid fa-cloud-check text-emerald-400"></i> ${text}`;
        badge.className = "text-[10px] text-emerald-400 block mt-0.5";
        if (icon) icon.classList.remove('fa-spin');
    } else if (type === 'error') {
        badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-400"></i> ${text}`;
        badge.className = "text-[10px] text-rose-400 block mt-0.5";
        if (icon) icon.classList.remove('fa-spin');
    } else {
        badge.innerHTML = `<i class="fa-solid fa-hard-drive"></i> ${text}`;
        badge.className = "text-[10px] text-slate-400 block mt-0.5";
        if (icon) icon.classList.remove('fa-spin');
    }
}

// ==========================================
// GitHub REST API Sync (Pull & Push)
// ==========================================
async function syncFromGitHub(showAlert = false) {
    const token = localStorage.getItem('fitTracker_github_token');
    if (!token) {
        setSyncStatus('local', 'บันทึกในเครื่อง (ยังไม่เชื่อม GitHub)');
        if (showAlert) {
            alert("กรุณาใส่ GitHub Token ในหน้าตั้งค่า (⚙️) ก่อนซิงก์ข้อมูลครับ");
            openSettingsModal();
        }
        return;
    }

    setSyncStatus('syncing', 'กำลังดึงข้อมูล...');
    try {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}?t=${Date.now()}`;
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json'
            }
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status} - ตรวจสอบ Token หรือสิทธิ์ไฟล์ db.json`);
        }

        const data = await res.json();
        currentFileSha = data.sha;
        const decodedText = base64ToUtf8(data.content);
        const cloudData = JSON.parse(decodedText || '{}');

        if (cloudData.history && Object.keys(cloudData.history).length > 0) {
            allMealsHistory = cloudData.history;
            localStorage.setItem('fitTracker_history', JSON.stringify(allMealsHistory));
            if (cloudData.catalog && cloudData.catalog.length > 0) {
                foodCatalog = cloudData.catalog;
                localStorage.setItem('fitTracker_catalog', JSON.stringify(foodCatalog));
            }
            renderUIOnly();
            setSyncStatus('synced', 'ซิงก์ GitHub แล้ว');
            if (showAlert) alert("ดึงข้อมูลล่าสุดจาก GitHub เรียบร้อยแล้ว!");
        } else {
            await pushToGitHub(false);
            if (showAlert) alert("อัปโหลดข้อมูลเริ่มต้นขึ้น GitHub เรียบร้อยแล้ว!");
        }
    } catch (err) {
        console.error(err);
        setSyncStatus('error', 'ซิงก์ไม่สำเร็จ');
        if (showAlert) alert("ดึงข้อมูลจาก GitHub ไม่สำเร็จ: " + err.message);
    }
}

async function pushToGitHub(showAlert = false) {
    const token = localStorage.getItem('fitTracker_github_token');
    if (!token) {
        setSyncStatus('local', 'บันทึกในเครื่อง');
        return;
    }

    setSyncStatus('syncing', 'กำลังบันทึกขึ้น Cloud...');
    try {
        const getUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}?t=${Date.now()}`;
        const getRes = await fetch(getUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json'
            }
        });
        if (getRes.ok) {
            const getData = await getRes.json();
            currentFileSha = getData.sha;
        }

        const payload = {
            updatedAt: new Date().toISOString(),
            history: allMealsHistory,
            catalog: foodCatalog
        };
        const contentBase64 = utf8ToBase64(JSON.stringify(payload, null, 2));

        const putUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`;
        const putRes = await fetch(putUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update FitTracker DB (${currentDateKey})`,
                content: contentBase64,
                sha: currentFileSha
            })
        });

        if (!putRes.ok) {
            const errJson = await putRes.json();
            throw new Error(errJson.message || `HTTP ${putRes.status}`);
        }

        const putData = await putRes.json();
        currentFileSha = putData.content.sha;
        setSyncStatus('synced', 'ซิงก์ GitHub แล้ว');
        if (showAlert) alert("ส่งข้อมูลขึ้น GitHub เรียบร้อยแล้ว!");
    } catch (err) {
        console.error(err);
        setSyncStatus('error', 'อัปโหลดล้มเหลว');
        if (showAlert) alert("ส่งข้อมูลขึ้น GitHub ไม่สำเร็จ: " + err.message);
    }
}

function saveDataAndSync() {
    localStorage.setItem('fitTracker_history', JSON.stringify(allMealsHistory));
    localStorage.setItem('fitTracker_catalog', JSON.stringify(foodCatalog));
    renderUIOnly();
    pushToGitHub(false);
}

// ==========================================
// Core App Initialization & UI Rendering
// ==========================================
function renderUIOnly() {
    renderWeeklyChart();
    renderDateDisplay();
    renderMeals();
    renderActivity();
    renderSummary();
    renderNutritionCoach();
    updateCatalogDatalist();
}

async function initApp() {
    renderUIOnly();
    await syncFromGitHub(false);
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
    renderUIOnly();
}

function getDayData(dateKey) {
    if (!allMealsHistory[dateKey]) {
        allMealsHistory[dateKey] = { steps: 0, workouts: [], meals: {} };
    }
    if (!allMealsHistory[dateKey].meals) {
        allMealsHistory[dateKey].meals = {};
    }
    if (allMealsHistory[dateKey].steps === undefined) {
        allMealsHistory[dateKey].steps = 0;
    }
    if (!allMealsHistory[dateKey].workouts) {
        allMealsHistory[dateKey].workouts = [];
    }
    mealTypes.forEach(type => {
        if (!allMealsHistory[dateKey].meals[type]) {
            allMealsHistory[dateKey].meals[type] = [];
        }
    });
    return allMealsHistory[dateKey];
}

function getTotalBurned(dayData) {
    const stepsCal = Math.round((Number(dayData.steps) || 0) * 0.04);
    const workoutCal = (dayData.workouts || []).reduce((sum, w) => sum + Number(w.calories || 0), 0);
    return { stepsCal, workoutCal, totalBurn: stepsCal + workoutCal };
}

// ==========================================
// Weekly Calorie Chart (7 วัน + เส้น 1,500 & 1,200)
// ==========================================
function renderWeeklyChart() {
    const container = document.getElementById('weekly-chart-container');
    if (!container) return;

    const targetCal = 1500;
    const minCal = 1200;
    const parts = currentDateKey.split('-');
    const baseDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

    let daysData = [];
    let maxVal = 2000;

    for (let i = 6; i >= 0; i--) {
        let d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i);
        let key = getFormattedDateKey(d);
        let dayObj = allMealsHistory[key];

        let totalCal = 0;
        let totalBurn = 0;
        if (dayObj) {
            if (dayObj.meals) {
                Object.values(dayObj.meals).forEach(list => {
                    list.forEach(item => { totalCal += Number(item.calories || 0); });
                });
            }
            const stepsCal = Math.round((Number(dayObj.steps) || 0) * 0.04);
            const workoutCal = (dayObj.workouts || []).reduce((s, w) => s + Number(w.calories || 0), 0);
            totalBurn = stepsCal + workoutCal;
        }

        const effectiveLimit = targetCal + totalBurn;
        if (totalCal > maxVal) maxVal = totalCal;

        daysData.push({
            key,
            label: dayNames[d.getDay()],
            dayNum: d.getDate(),
            cal: totalCal,
            limit: effectiveLimit,
            isSelected: key === currentDateKey
        });
    }

    const targetLineBottomPct = Math.min(100, Math.round((targetCal / maxVal) * 100));
    const minLineBottomPct = Math.min(100, Math.round((minCal / maxVal) * 100));

    const barsHtml = daysData.map(d => {
        const barHeightPct = Math.min(100, Math.round((d.cal / maxVal) * 100));
        const isOver = d.cal > d.limit;

        let barColor = 'bg-slate-700';
        if (d.cal > 0) {
            barColor = isOver ? 'bg-rose-500' : 'bg-emerald-400';
        }
        const activeRing = d.isSelected ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-900' : 'opacity-85 hover:opacity-100';

        return `
            <button type="button" onclick="selectChartDay('${d.key}')" class="flex-1 flex flex-col items-center group focus:outline-none">
                <span class="text-[9px] font-semibold mb-1 ${isOver ? 'text-rose-400' : (d.cal > 0 ? 'text-slate-300' : 'text-slate-600')}">
                    ${d.cal > 0 ? d.cal : '-'}
                </span>
                <div class="w-full max-w-[24px] h-24 bg-slate-950/80 rounded-t-lg flex items-end justify-center overflow-hidden relative z-10 ${activeRing} transition">
                    <div class="w-full ${barColor} rounded-t-md transition-all duration-500" style="height: ${barHeightPct}%;"></div>
                </div>
                <div class="mt-1.5 text-center leading-tight">
                    <span class="text-[10px] block font-bold ${d.isSelected ? 'text-indigo-400' : 'text-slate-400'}">${d.label}</span>
                    <span class="text-[9px] block ${d.isSelected ? 'text-white font-semibold' : 'text-slate-500'}">${d.dayNum}</span>
                </div>
            </button>
        `;
    }).join('');

    container.innerHTML = `
        <div class="relative pt-3">
            <div class="absolute left-0 right-0 border-t border-dashed border-amber-400/80 z-20 pointer-events-none flex justify-end"
                 style="bottom: calc(30px + (96px * ${targetLineBottomPct / 100}));">
                <span class="text-[9px] bg-slate-900/95 text-amber-400 px-1 rounded -mt-2.5 font-semibold border border-amber-500/30">
                    1,500
                </span>
            </div>
            <div class="absolute left-0 right-0 border-t border-dashed border-cyan-400/70 z-20 pointer-events-none flex justify-end"
                 style="bottom: calc(30px + (96px * ${minLineBottomPct / 100}));">
                <span class="text-[9px] bg-slate-900/95 text-cyan-400 px-1 rounded -mt-2.5 font-semibold border border-cyan-500/30">
                    1,200
                </span>
            </div>
            <div class="flex items-end justify-between gap-1.5">
                ${barsHtml}
            </div>
        </div>
    `;
}

function selectChartDay(dateKey) {
    currentDateKey = dateKey;
    renderUIOnly();
}

// ==========================================
// Meals Rendering
// ==========================================
function renderMeals() {
    const container = document.getElementById('meals-container');
    container.innerHTML = '';
    const dayData = getDayData(currentDateKey);

    mealTypes.forEach(mealType => {
        const items = dayData.meals[mealType] || [];
        const totalCal = items.reduce((sum, item) => sum + Number(item.calories), 0);
        const totalProt = items.reduce((sum, item) => sum + Number(item.protein || 0), 0);

        let itemsHtml = items.map((item, idx) => {
            const qtyDisplay = item.qty ? (isNaN(item.qty) ? item.qty : `x${item.qty}`) : '';
            return `
            <div class="flex justify-between items-center py-2 border-b border-slate-800/40 last:border-none text-sm">
                <div>
                    <span class="text-white font-medium">${item.name}</span>
                    <span class="text-xs text-slate-400 ml-1.5">${qtyDisplay}</span>
                </div>
                <div class="flex items-center space-x-3">
                    <span class="text-slate-300 font-medium">${item.calories} kcal <span class="text-xs text-emerald-400">(${item.protein || 0}g)</span></span>
                    <div class="flex space-x-1.5">
                        <button onclick="openFoodModal('${mealType}', ${idx})" class="text-slate-500 hover:text-amber-400 transition p-1"><i class="fa-solid fa-pen text-xs"></i></button>
                        <button onclick="deleteMealItem('${mealType}', ${idx})" class="text-slate-500 hover:text-rose-400 transition p-1"><i class="fa-solid fa-trash text-xs"></i></button>
                    </div>
                </div>
            </div>
        `}).join('');

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

// ==========================================
// Steps & Workouts Controls
// ==========================================
function renderActivity() {
    const dayData = getDayData(currentDateKey);
    const steps = Number(dayData.steps || 0);
    const { stepsCal, totalBurn } = getTotalBurned(dayData);

    document.getElementById('steps-input').value = steps > 0 ? steps : '';
    document.getElementById('steps-calories').innerText = stepsCal;
    document.getElementById('activity-total-burn').innerText = totalBurn;

    const pct = Math.min(Math.round((steps / 10000) * 100), 100);
    document.getElementById('steps-progress-bar').style.width = `${pct}%`;
    document.getElementById('steps-percent').innerText = `${pct}%`;

    const listEl = document.getElementById('workouts-list');
    if (dayData.workouts.length === 0) {
        listEl.innerHTML = `<div class="text-xs text-slate-500 py-1">ยังไม่มีรายการออกกำลังกาย</div>`;
    } else {
        listEl.innerHTML = dayData.workouts.map((w, idx) => `
            <div class="flex justify-between items-center py-2 border-b border-slate-800/40 last:border-none text-sm">
                <div>
                    <span class="text-white font-medium">${w.type}</span>
                    <span class="text-xs text-slate-400 ml-1.5">${w.duration} นาที</span>
                </div>
                <div class="flex items-center space-x-3">
                    <span class="text-orange-400 font-medium">-${w.calories} kcal</span>
                    <button onclick="deleteWorkout(${idx})" class="text-slate-500 hover:text-rose-400 transition p-1"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            </div>
        `).join('');
    }
}

function updateSteps(val) {
    const dayData = getDayData(currentDateKey);
    dayData.steps = Math.max(0, Number(val) || 0);
    saveDataAndSync();
}

function addQuickSteps(amount) {
    const dayData = getDayData(currentDateKey);
    dayData.steps = (Number(dayData.steps) || 0) + amount;
    saveDataAndSync();
}

function openWorkoutModal() {
    document.getElementById('workout-duration').value = 30;
    autoCalcWorkoutCal();
    document.getElementById('workout-modal').classList.remove('hidden');
}

function closeWorkoutModal() {
    document.getElementById('workout-modal').classList.add('hidden');
}

function autoCalcWorkoutCal() {
    const select = document.getElementById('workout-type');
    const rate = Number(select.options[select.selectedIndex].dataset.rate || 5);
    const duration = Number(document.getElementById('workout-duration').value || 0);
    document.getElementById('workout-calories').value = Math.round(rate * duration);
}

function handleWorkoutSubmit(e) {
    e.preventDefault();
    const dayData = getDayData(currentDateKey);
    dayData.workouts.push({
        type: document.getElementById('workout-type').value,
        duration: Number(document.getElementById('workout-duration').value),
        calories: Number(document.getElementById('workout-calories').value)
    });
    closeWorkoutModal();
    saveDataAndSync();
}

function deleteWorkout(index) {
    if (confirm("ต้องการลบรายการออกกำลังกายนี้ใช่ไหม?")) {
        const dayData = getDayData(currentDateKey);
        dayData.workouts.splice(index, 1);
        saveDataAndSync();
    }
}

// ==========================================
// Summary & Smart Nutrition Coach
// ==========================================
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

    const { totalBurn } = getTotalBurned(dayData);
    const targetCal = 1500;
    const effectiveBudget = targetCal + totalBurn;
    const remaining = effectiveBudget - totalCal;

    document.getElementById('calories-remaining').innerHTML = `${remaining} <span class="text-sm font-normal text-slate-400">kcal</span>`;
    document.getElementById('calories-consumed').innerText = `${totalCal} kcal`;
    document.getElementById('calories-burned').innerText = `${totalBurn} kcal`;
    document.getElementById('protein-summary').innerHTML = `${totalProt.toFixed(1)} / <span class="text-xs font-normal text-slate-400">96-128 g</span>`;
    document.getElementById('carbs-total').innerText = `${totalCarbs.toFixed(1)}g`;
    document.getElementById('sugar-total').innerText = `${totalSugar.toFixed(1)}g`;
    document.getElementById('fats-total').innerText = `${totalFat.toFixed(1)}g`;
    document.getElementById('satfat-total').innerText = `${totalSatFat.toFixed(1)}g`;
    document.getElementById('transfat-total').innerText = `${totalTransFat.toFixed(1)}g`;
    document.getElementById('sodium-total').innerText = `${Math.round(totalSodium)}mg`;
    document.getElementById('cholesterol-total').innerText = `${Math.round(totalChol)}mg`;

    const percent = Math.min(Math.round((totalCal / effectiveBudget) * 100), 100);
    document.getElementById('calorie-progress-bar').style.width = `${percent}%`;

    const statusEl = document.getElementById('calorie-status');
    if (remaining < 0) {
        statusEl.innerText = "เกินเป้าหมาย";
        statusEl.className = "px-2.5 py-1 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/50 font-medium";
    } else {
        statusEl.innerText = "ต่ำกว่าเกณฑ์ / กำลังคุม";
        statusEl.className = "px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 font-medium";
    }
}

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

    const { totalBurn } = getTotalBurned(dayData);
    const targetCal = 1500;
    const minProt = 96;
    const remCal = (targetCal + totalBurn) - totalCal;
    const remProt = Math.max(0, minProt - totalProt);

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
        warnings.push(`คอเลสเตอรอลใกล้เกิน 300 mg <b>ควรเลี่ยง</b> ไข่แดง เครื่องในสัตว์ (เลือกกินเฉพาะไข่ขาวแทน)`);
    }
    if (remCal < 150 && remCal >= 0) {
        warnings.push(`แคลอรีเหลือน้อย (${remCal} kcal) <b>ควรงด</b> ของทานเล่นที่มีแป้งและไขมันสูง`);
    } else if (remCal < 0) {
        warnings.push(`ทานเกินโควตาไปแล้ว ${Math.abs(remCal)} kcal <b>ควรงดมื้อดึก</b> หรือเดินเพิ่มอีกนิดเพื่อชดเชย`);
    }

    if (warnings.length === 0) {
        warnings.push(`ค่าโซเดียม น้ำตาล และไขมันยังอยู่ในเกณฑ์ดี <b>เลี่ยง</b> ของทอดและน้ำหวานเพื่อรักษาสมดุลต่อ`);
    }

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

            <div class="space-y-1">
                <div class="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <i class="fa-solid fa-drumstick-bite"></i> เติมโปรตีนให้ถึงเป้า (96-128g)
                </div>
                ${protHtml}
            </div>

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

// ==========================================
// Quantity Multiplier (คูณสารอาหารตามตัวเลขจำนวน)
// ==========================================
function extractMultiplier(qtyVal) {
    if (!qtyVal) return 1;
    const match = String(qtyVal).match(/(\d+(?:\.\d+)?)/);
    const num = match ? parseFloat(match[1]) : 1;
    return (!isNaN(num) && num > 0) ? num : 1;
}

function setBaseNutritionFromCurrentInputs() {
    const mult = extractMultiplier(document.getElementById('food-qty').value);
    baseNutrition = {
        calories: (Number(document.getElementById('food-calories').value) || 0) / mult,
        protein: (Number(document.getElementById('food-protein').value) || 0) / mult,
        carbs: (Number(document.getElementById('food-carbs').value) || 0) / mult,
        sugar: (Number(document.getElementById('food-sugar').value) || 0) / mult,
        fat: (Number(document.getElementById('food-fat').value) || 0) / mult,
        satFat: (Number(document.getElementById('food-satfat').value) || 0) / mult,
        transFat: (Number(document.getElementById('food-transfat').value) || 0) / mult,
        sodium: (Number(document.getElementById('food-sodium').value) || 0) / mult,
        cholesterol: (Number(document.getElementById('food-cholesterol').value) || 0) / mult
    };
}

function updateBaseNutritionFromInputs() {
    setBaseNutritionFromCurrentInputs();
}

function applyQuantityMultiplier() {
    if (!baseNutrition) {
        setBaseNutritionFromCurrentInputs();
    }
    const mult = extractMultiplier(document.getElementById('food-qty').value);
    const round1 = (val) => Math.round(val * 10) / 10;

    document.getElementById('food-calories').value = Math.round(baseNutrition.calories * mult);
    document.getElementById('food-protein').value = round1(baseNutrition.protein * mult);
    document.getElementById('food-carbs').value = round1(baseNutrition.carbs * mult);
    document.getElementById('food-sugar').value = round1(baseNutrition.sugar * mult);
    document.getElementById('food-fat').value = round1(baseNutrition.fat * mult);
    document.getElementById('food-satfat').value = round1(baseNutrition.satFat * mult);
    document.getElementById('food-transfat').value = round1(baseNutrition.transFat * mult);
    document.getElementById('food-sodium').value = Math.round(baseNutrition.sodium * mult);
    document.getElementById('food-cholesterol').value = Math.round(baseNutrition.cholesterol * mult);
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

async function scanLabelOfflineOCR(file) {
    const loader = document.getElementById('ai-loading-indicator');
    loader.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังอ่านฉลาก...';
    loader.classList.remove('hidden');

    try {
        const worker = await Tesseract.createWorker(['tha', 'eng']);
        const ret = await worker.recognize(file);
        await worker.terminate();

        const text = ret.data.text.replace(/\s+/g, ' ');
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
            calories,
            protein,
            carbs: carbs || sugar,
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
        alert("เกิดข้อผิดพลาดในการอ่านตัวหนังสือ: " + err.message);
    } finally {
        loader.classList.add('hidden');
    }
}

async function scanFoodWithGemini(file) {
    const loader = document.getElementById('ai-loading-indicator');
    loader.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> AI กำลังวิเคราะห์...';
    loader.classList.remove('hidden');

    try {
        const base64Data = await resizeImageToBase64(file, 800);
        const apiKey = localStorage.getItem('fitTracker_gemini_key');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

        const promptText = `วิเคราะห์ภาพอาหารจานนี้ ประเมินชื่อเมนูภาษาไทย (ระบุปริมาณต่อ 1 หน่วยไว้ในวงเล็บ) และสารอาหาร ตอบกลับเป็น JSON เท่านั้น:
           {"name": "ชื่อเมนูภาษาไทย (1 จาน)", "calories": ตัวเลข, "protein": ตัวเลข, "carbs": ตัวเลข, "sugar": ตัวเลข, "fat": ตัวเลข, "satFat": ตัวเลข, "transFat": ตัวเลข, "sodium": ตัวเลข, "cholesterol": ตัวเลข}`;

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
            const unitLabel = hasServing ? (p.serving_size || "1 หน่วย") : "100g";
            const rawName = p.product_name_th || p.product_name || `สินค้า (${barcode})`;

            fillFormWithNutritionData({
                name: `${rawName} (${unitLabel})`,
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
    document.getElementById('food-qty').value = 1;
    document.getElementById('food-calories').value = item.calories ?? 0;
    document.getElementById('food-protein').value = item.protein ?? 0;
    document.getElementById('food-carbs').value = item.carbs ?? 0;
    document.getElementById('food-sugar').value = item.sugar ?? 0;
    document.getElementById('food-fat').value = item.fat ?? 0;
    document.getElementById('food-satfat').value = item.satFat ?? 0;
    document.getElementById('food-transfat').value = item.transFat ?? 0;
    document.getElementById('food-sodium').value = item.sodium ?? 0;
    document.getElementById('food-cholesterol').value = item.cholesterol ?? 0;
    setBaseNutritionFromCurrentInputs();
}

// ==========================================
// Settings & Food Modal Controls
// ==========================================
function openSettingsModal() {
    document.getElementById('github-token-input').value = localStorage.getItem('fitTracker_github_token') || '';
    document.getElementById('gemini-api-key-input').value = localStorage.getItem('fitTracker_gemini_key') || '';
    document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.add('hidden');
}

async function saveAllSettings() {
    const ghToken = document.getElementById('github-token-input').value.trim();
    const geminiKey = document.getElementById('gemini-api-key-input').value.trim();

    if (ghToken) {
        localStorage.setItem('fitTracker_github_token', ghToken);
    } else {
        localStorage.removeItem('fitTracker_github_token');
    }

    if (geminiKey) {
        localStorage.setItem('fitTracker_gemini_key', geminiKey);
    } else {
        localStorage.removeItem('fitTracker_gemini_key');
    }

    closeSettingsModal();
    if (ghToken) {
        await syncFromGitHub(true);
    } else {
        setSyncStatus('local', 'บันทึกในเครื่อง');
        alert("บันทึกการตั้งค่าเรียบร้อยแล้ว!");
    }
}

function openFoodModal(mealType, itemIndex = null) {
    document.getElementById('edit-meal-type').value = mealType;
    document.getElementById('edit-item-index').value = itemIndex !== null ? itemIndex : '';
    document.getElementById('modal-title').innerText = itemIndex !== null ? `แก้ไขรายการ (${mealType})` : `เพิ่มรายการ (${mealType})`;

    if (itemIndex !== null) {
        const item = allMealsHistory[currentDateKey].meals[mealType][itemIndex];
        document.getElementById('food-name').value = item.name || '';
        document.getElementById('food-qty').value = extractMultiplier(item.qty);
        document.getElementById('food-calories').value = item.calories || '';
        document.getElementById('food-protein').value = item.protein || '';
        document.getElementById('food-carbs').value = item.carbs || '';
        document.getElementById('food-sugar').value = item.sugar || '';
        document.getElementById('food-fat').value = item.fat || '';
        document.getElementById('food-satfat').value = item.satFat || '';
        document.getElementById('food-transfat').value = item.transFat || '';
        document.getElementById('food-sodium').value = item.sodium || '';
        document.getElementById('food-cholesterol').value = item.cholesterol || '';
        setBaseNutritionFromCurrentInputs();
    } else {
        document.getElementById('food-form').reset();
        document.getElementById('food-qty').value = 1;
        baseNutrition = null;
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
    const qtyNum = extractMultiplier(document.getElementById('food-qty').value);

    const newItem = {
        name: document.getElementById('food-name').value,
        qty: qtyNum,
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

    const unitItem = {
        name: newItem.name,
        calories: Math.round(newItem.calories / qtyNum),
        protein: Math.round((newItem.protein / qtyNum) * 10) / 10,
        carbs: Math.round((newItem.carbs / qtyNum) * 10) / 10,
        sugar: Math.round((newItem.sugar / qtyNum) * 10) / 10,
        fat: Math.round((newItem.fat / qtyNum) * 10) / 10,
        satFat: Math.round((newItem.satFat / qtyNum) * 10) / 10,
        transFat: Math.round((newItem.transFat / qtyNum) * 10) / 10,
        sodium: Math.round(newItem.sodium / qtyNum),
        cholesterol: Math.round(newItem.cholesterol / qtyNum)
    };
    if (!foodCatalog.some(f => f.name.toLowerCase() === unitItem.name.toLowerCase())) {
        foodCatalog.push(unitItem);
    }

    closeFoodModal();
    saveDataAndSync();
}

function deleteMealItem(mealType, index) {
    if (confirm("ต้องการลบรายการนี้ใช่ไหม?")) {
        const dayData = getDayData(currentDateKey);
        dayData.meals[mealType].splice(index, 1);
        saveDataAndSync();
    }
}

function updateCatalogDatalist() {
    const datalist = document.getElementById('food-catalog-list');
    datalist.innerHTML = foodCatalog.map(f => `<option value="${f.name}">(${f.calories} kcal, โปรตีน ${f.protein}g)</option>`).join('');
}

function autofillFoodCatalog(name) {
    const found = foodCatalog.find(f => f.name.toLowerCase() === name.toLowerCase());
    if (found) {
        document.getElementById('food-qty').value = 1;
        document.getElementById('food-calories').value = found.calories;
        document.getElementById('food-protein').value = found.protein;
        document.getElementById('food-carbs').value = found.carbs;
        document.getElementById('food-sugar').value = found.sugar ?? 0;
        document.getElementById('food-fat').value = found.fat;
        document.getElementById('food-satfat').value = found.satFat ?? 0;
        document.getElementById('food-transfat').value = found.transFat ?? 0;
        document.getElementById('food-sodium').value = found.sodium;
        document.getElementById('food-cholesterol').value = found.cholesterol;
        setBaseNutritionFromCurrentInputs();
    }
}

// ==========================================
// Monthly Calendar with Dual Status Dots & Detail Expand
// ==========================================
function openCalendarModal() {
    const parts = currentDateKey.split('-');
    calendarViewYear = parseInt(parts[0], 10);
    calendarViewMonth = parseInt(parts[1], 10) - 1;
    calendarSelectedKey = currentDateKey;

    renderCalendarMonth();
    renderCalendarDayDetail(calendarSelectedKey);
    document.getElementById('calendar-modal').classList.remove('hidden');
}

function closeCalendarModal() {
    document.getElementById('calendar-modal').classList.add('hidden');
}

function changeCalendarMonth(delta) {
    calendarViewMonth += delta;
    if (calendarViewMonth < 0) {
        calendarViewMonth = 11;
        calendarViewYear--;
    } else if (calendarViewMonth > 11) {
        calendarViewMonth = 0;
        calendarViewYear++;
    }
    renderCalendarMonth();
}

function getDayStatsForCalendar(dateKey) {
    const dayObj = allMealsHistory[dateKey];
    if (!dayObj) return null;

    let totalCal = 0, totalProt = 0, totalCarbs = 0, totalFat = 0, totalSugar = 0, totalSodium = 0;
    let itemCount = 0;

    if (dayObj.meals) {
        Object.values(dayObj.meals).forEach(list => {
            list.forEach(item => {
                totalCal += Number(item.calories || 0);
                totalProt += Number(item.protein || 0);
                totalCarbs += Number(item.carbs || 0);
                totalFat += Number(item.fat || 0);
                totalSugar += Number(item.sugar || 0);
                totalSodium += Number(item.sodium || 0);
                itemCount++;
            });
        });
    }

    const steps = Number(dayObj.steps || 0);
    const stepsCal = Math.round(steps * 0.04);
    const workoutCal = (dayObj.workouts || []).reduce((s, w) => s + Number(w.calories || 0), 0);
    const totalBurn = stepsCal + workoutCal;

    if (itemCount === 0 && steps === 0 && workoutCal === 0) return null;

    return { totalCal, totalProt, totalCarbs, totalFat, totalSugar, totalSodium, steps, totalBurn, dayObj };
}

function renderCalendarMonth() {
    const monthNames = [
        "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    document.getElementById('calendar-month-title').innerText = `${monthNames[calendarViewMonth]} ${calendarViewYear + 543}`;

    const container = document.getElementById('calendar-grid-container');
    container.innerHTML = '';

    const firstDayOfWeek = new Date(calendarViewYear, calendarViewMonth, 1).getDay();
    const daysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate();
    const todayKey = getFormattedDateKey(new Date());

    for (let i = 0; i < firstDayOfWeek; i++) {
        container.innerHTML += `<div class="h-11"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const key = `${calendarViewYear}-${String(calendarViewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const stats = getDayStatsForCalendar(key);
        const isSelected = key === calendarSelectedKey;
        const isToday = key === todayKey;

        let dotsHtml = `<div class="h-2 flex items-center justify-center gap-1 mt-0.5"></div>`;
        if (stats && stats.totalCal > 0) {
            let calDotClass = 'bg-emerald-400';
            if (stats.totalCal > 2000) {
                calDotClass = 'bg-rose-500';
            } else if (stats.totalCal >= 1500) {
                calDotClass = 'bg-orange-400';
            }

            const protPct = (stats.totalProt / 96) * 100;
            let protDotClass = 'bg-emerald-400';
            if (protPct < 50) {
                protDotClass = 'bg-rose-500';
            } else if (protPct < 75) {
                protDotClass = 'bg-amber-300';
            }

            dotsHtml = `
                <div class="h-2 flex items-center justify-center gap-1 mt-0.5">
                    <span class="w-1.5 h-1.5 rounded-full ${calDotClass}"></span>
                    <span class="w-1.5 h-1.5 rounded-full ${protDotClass}"></span>
                </div>
            `;
        }

        const btnClass = isSelected
            ? 'bg-indigo-600 text-white font-bold ring-2 ring-indigo-400'
            : (isToday ? 'bg-slate-800 text-amber-300 font-bold border border-amber-500/40' : 'bg-slate-950/60 hover:bg-slate-800 text-slate-200');

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `h-11 rounded-xl flex flex-col items-center justify-center transition ${btnClass}`;
        btn.innerHTML = `<span class="text-xs leading-none">${day}</span>${dotsHtml}`;
        btn.onclick = () => {
            calendarSelectedKey = key;
            renderCalendarMonth();
            renderCalendarDayDetail(key);
        };
        container.appendChild(btn);
    }
}

function renderCalendarDayDetail(dateKey) {
    const detailBox = document.getElementById('calendar-day-detail');
    const stats = getDayStatsForCalendar(dateKey);

    if (!stats) {
        detailBox.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <div class="text-xs font-bold text-white">${formatDisplayDate(dateKey)}</div>
                    <div class="text-[11px] text-slate-500 mt-0.5">ยังไม่มีข้อมูลบันทึกในวันนี้</div>
                </div>
                <button type="button" onclick="jumpToDate('${dateKey}')" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-2 rounded-xl font-semibold transition shrink-0">
                    เปิดวันนี้
                </button>
            </div>
        `;
        return;
    }

    const protPct = Math.round((stats.totalProt / 96) * 100);
    const remaining = (1500 + stats.totalBurn) - stats.totalCal;

    let mealsBreakdown = '';
    mealTypes.forEach(mType => {
        const list = (stats.dayObj.meals && stats.dayObj.meals[mType]) || [];
        if (list.length > 0) {
            const itemsStr = list.map(i => `${i.name} (${i.calories} kcal, P:${i.protein || 0}g)`).join(', ');
            mealsBreakdown += `<div class="text-[11px] text-slate-300"><span class="text-indigo-400 font-semibold">${mType}:</span> ${itemsStr}</div>`;
        }
    });

    detailBox.innerHTML = `
        <div class="flex justify-between items-start gap-2 border-b border-slate-800 pb-2">
            <div>
                <div class="text-xs font-bold text-white">${formatDisplayDate(dateKey)}</div>
                <div class="text-[11px] text-slate-400 mt-0.5">
                    ทาน <b class="text-white">${stats.totalCal}</b> kcal | เผาผลาญ <b class="text-orange-400">${stats.totalBurn}</b> kcal (${stats.steps.toLocaleString()} ก้าว)
                </div>
            </div>
            <button type="button" onclick="jumpToDate('${dateKey}')" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-xl font-semibold transition shrink-0">
                ดู/แก้ไขวันนั้น
            </button>
        </div>

        <div class="grid grid-cols-4 gap-1.5 text-center text-[11px]">
            <div class="bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                <span class="text-[9px] text-slate-400 block">โปรตีน (${protPct}%)</span>
                <span class="font-bold text-emerald-400">${stats.totalProt.toFixed(1)}g</span>
            </div>
            <div class="bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                <span class="text-[9px] text-slate-400 block">คาร์บ</span>
                <span class="font-bold text-slate-200">${stats.totalCarbs.toFixed(1)}g</span>
            </div>
            <div class="bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                <span class="text-[9px] text-slate-400 block">ไขมัน</span>
                <span class="font-bold text-slate-200">${stats.totalFat.toFixed(1)}g</span>
            </div>
            <div class="bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                <span class="text-[9px] text-slate-400 block">คงเหลือ</span>
                <span class="font-bold ${remaining < 0 ? 'text-rose-400' : 'text-sky-400'}">${remaining}</span>
            </div>
        </div>

        <details class="pt-1">
            <summary class="text-[11px] text-amber-400 font-medium cursor-pointer select-none hover:underline">
                กดเพื่อขยายดูรายการอาหารทั้งหมดของวันนี้
            </summary>
            <div class="mt-2 space-y-1 pl-2 border-l-2 border-slate-800">
                ${mealsBreakdown || '<div class="text-[11px] text-slate-500">ไม่มีรายการอาหาร</div>'}
            </div>
        </details>
    `;
}

function jumpToDate(dateKey) {
    currentDateKey = dateKey;
    closeCalendarModal();
    renderUIOnly();
}

// Initialize on load
window.onload = initApp;
