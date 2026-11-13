// ==========================================
// Register PWA Service Worker
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
}

// ==========================================
// GitHub DB Config (Lavy-Lallaby/fittracker-db)
// ==========================================
const GITHUB_OWNER = "Lavy-Lallaby";
const GITHUB_REPO  = "fittracker-db";
const GITHUB_PATH  = "db.json";
let currentFileSha = null;

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
// State Management & Flexible Goals
// ==========================================
let currentDateKey = getFormattedDateKey(new Date());
let currentScanMode = 'label';
let html5QrCode = null;
let baseNutrition = null;
let activeMacroTip = null;
let currentReportDays = 7;

let calendarViewYear = new Date().getFullYear();
let calendarViewMonth = new Date().getMonth();
let calendarSelectedKey = currentDateKey;

const goalPresets = {
    fat_loss: {
        label: "ลดไขมัน + รักษากล้ามเนื้อ",
        desc: "แคลอรีติดลบพอดี (1,500 kcal) เน้นโปรตีนสูงเพื่อรักษามวลกล้ามเนื้อขณะลดไขมัน",
        calories: 1500, minCalories: 1200, proteinMin: 96, proteinMax: 128, carbsMax: 150, fatMax: 50
    },
    high_protein: {
        label: "เน้นโปรตีนสูง ลดคาร์บ",
        desc: "โปรตีนสูงพิเศษ (40%) ลดแป้งและน้ำตาล ช่วยให้อิ่มนานและเร่งเผาผลาญ",
        calories: 1500, minCalories: 1200, proteinMin: 130, proteinMax: 160, carbsMax: 95, fatMax: 58
    },
    keto_fat: {
        label: "เน้นไขมันดี ลดแป้ง (Low-Carb / Keto)",
        desc: "จำกัดคาร์บต่ำมาก (ไม่เกิน 35g) เน้นไขมันดีเป็นพลังงานหลักและโปรตีนปานกลาง",
        calories: 1550, minCalories: 1250, proteinMin: 95, proteinMax: 115, carbsMax: 35, fatMax: 112
    },
    maintain: {
        label: "รักษาน้ำหนัก & สมดุล",
        desc: "พลังงานสมดุล (1,900 kcal) สัดส่วนโปรตีน คาร์บ และไขมันพอดีสำหรับใช้ชีวิตประจำวัน",
        calories: 1900, minCalories: 1500, proteinMin: 95, proteinMax: 120, carbsMax: 225, fatMax: 63
    },
    lean_bulk: {
        label: "เพิ่มน้ำหนัก & สร้างกล้ามเนื้อ",
        desc: "เพิ่มพลังงานส่วนเกินแบบคลีน (2,300 kcal) เน้นโปรตีนและคาร์บเพื่อแรงยกเวทและสร้างกล้ามเนื้อ",
        calories: 2300, minCalories: 1900, proteinMin: 130, proteinMax: 160, carbsMax: 285, fatMax: 64
    }
};

const defaultGoals = {
    preset: "fat_loss",
    calories: 1500,
    minCalories: 1200,
    proteinMin: 96,
    proteinMax: 128,
    carbsMax: 150,
    fatMax: 50,
    steps: 10000,
    water: 2000,
    targetWeight: null
};

let userGoals = Object.assign({}, defaultGoals, JSON.parse(localStorage.getItem('fitTracker_goals') || '{}'));

const defaultHistory = {
    "2026-11-12": {
        steps: 4500,
        water: 1500,
        weight: null,
        workouts: [],
        meals: {
            "มื้อเช้า": [
                { name: "หมูย่าง", qty: 3, calories: 300, protein: 21, carbs: 0, sugar: 0, fiber: 0, fat: 15, satFat: 5, transFat: 0, sodium: 400, potassium: 250, cholesterol: 80 },
                { name: "ข้าวเหนียว", qty: 1, calories: 155, protein: 2.5, carbs: 34, sugar: 0, fiber: 1, fat: 1, satFat: 0.2, transFat: 0, sodium: 10, potassium: 35, cholesterol: 0 },
                { name: "ชามะนาว น้ำผึ้ง", qty: 1, calories: 25, protein: 0, carbs: 6, sugar: 6, fiber: 0, fat: 0, satFat: 0, transFat: 0, sodium: 5, potassium: 20, cholesterol: 0 }
            ],
            "มื้อเที่ยง": [
                { name: "หมูย่าง", qty: 1, calories: 100, protein: 7, carbs: 0, sugar: 0, fiber: 0, fat: 5, satFat: 1.5, transFat: 0, sodium: 130, potassium: 85, cholesterol: 25 },
                { name: "เกาเหลาหมู", qty: 1, calories: 400, protein: 30, carbs: 14, sugar: 4, fiber: 2, fat: 23, satFat: 8, transFat: 0, sodium: 1760, potassium: 420, cholesterol: 115 }
            ],
            "มื้อเย็น": [],
            "มื้อว่าง/อื่นๆ": []
        }
    }
};

let allMealsHistory = JSON.parse(localStorage.getItem('fitTracker_history')) || defaultHistory;
let foodCatalog = JSON.parse(localStorage.getItem('fitTracker_catalog')) || [
    { name: "อกไก่ต้ม (100g)", calories: 120, protein: 25, carbs: 0, sugar: 0, fiber: 0, fat: 1.5, satFat: 0.4, transFat: 0, sodium: 60, potassium: 255, cholesterol: 50 },
    { name: "ข้าวสวย (1 ทัพพี)", calories: 80, protein: 2, carbs: 18, sugar: 0, fiber: 0.5, fat: 0.2, satFat: 0, transFat: 0, sodium: 0, potassium: 25, cholesterol: 0 },
    { name: "ไข่ต้ม (1 ฟอง)", calories: 75, protein: 6, carbs: 0.5, sugar: 0.5, fiber: 0, fat: 5, satFat: 1.6, transFat: 0, sodium: 70, potassium: 63, cholesterol: 186 }
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
            if (cloudData.goals) {
                userGoals = Object.assign({}, defaultGoals, cloudData.goals);
                localStorage.setItem('fitTracker_goals', JSON.stringify(userGoals));
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
            goals: userGoals,
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
    localStorage.setItem('fitTracker_goals', JSON.stringify(userGoals));
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
    renderWaterAndWeight();
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
    hideMacroTip();
    renderUIOnly();
}

function getPreviousDateKey(dateKey) {
    const parts = dateKey.split('-');
    let d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() - 1);
    return getFormattedDateKey(d);
}

function getDayData(dateKey) {
    if (!allMealsHistory[dateKey]) {
        allMealsHistory[dateKey] = { steps: 0, water: 0, weight: null, workouts: [], meals: {} };
    }
    if (!allMealsHistory[dateKey].meals) allMealsHistory[dateKey].meals = {};
    if (allMealsHistory[dateKey].steps === undefined) allMealsHistory[dateKey].steps = 0;
    if (allMealsHistory[dateKey].water === undefined) allMealsHistory[dateKey].water = 0;
    if (!allMealsHistory[dateKey].workouts) allMealsHistory[dateKey].workouts = [];

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
// Calorie & Nutrient Rollover Compensation (ชดเชยข้ามวันอัตโนมัติ)
// ==========================================
function getCalorieAdjustment(dateKey) {
    const baseTarget = Number(userGoals.calories) || 1500;
    const minFloor = Number(userGoals.minCalories) || 1200;

    const yKey = getPreviousDateKey(dateKey);
    const yData = allMealsHistory[yKey];
    let yOver = 0;

    if (yData && yData.meals) {
        let yCal = 0;
        Object.values(yData.meals).forEach(list => {
            list.forEach(item => { yCal += Number(item.calories || 0); });
        });
        if (yCal > 0) {
            const { totalBurn: yBurn } = getTotalBurned(yData);
            const yLimit = baseTarget + yBurn;
            if (yCal > yLimit) {
                yOver = yCal - yLimit;
            }
        }
    }

    const rawAdjusted = baseTarget - yOver;
    const safeTarget = yOver > 0 ? Math.max(minFloor, rawAdjusted) : baseTarget;
    const actualDeducted = baseTarget - safeTarget;
    const uncompensatedBurn = Math.max(0, yOver - actualDeducted);

    return {
        baseTarget,
        yOver,
        safeTarget,
        actualDeducted,
        uncompensatedBurn
    };
}

function getNutrientAdjustments(dateKey) {
    const baseTargetCal = Number(userGoals.calories) || 1500;
    const baseLimits = {
        carbs: { label: "คาร์บ", max: Math.round((baseTargetCal * 0.50) / 4), floor: 80, unit: "g", dec: 1 },
        sugar: { label: "น้ำตาล", max: 24, floor: 6, unit: "g", dec: 1 },
        fat: { label: "ไขมันรวม", max: Math.round((baseTargetCal * 0.30) / 9), floor: 25, unit: "g", dec: 1 },
        satFat: { label: "ไขมันอิ่มตัว", max: 16, floor: 5, unit: "g", dec: 1 },
        transFat: { label: "ไขมันทรานส์", max: 0, floor: 0, unit: "g", dec: 1 },
        sodium: { label: "โซเดียม", max: 2000, floor: 1000, unit: "mg", dec: 0 },
        cholesterol: { label: "คอเลสเตอรอล", max: 300, floor: 100, unit: "mg", dec: 0 }
    };

    const yKey = getPreviousDateKey(dateKey);
    const yData = allMealsHistory[yKey];
    let yTotals = { carbs: 0, sugar: 0, fat: 0, satFat: 0, transFat: 0, sodium: 0, cholesterol: 0 };

    if (yData && yData.meals) {
        Object.values(yData.meals).forEach(list => {
            list.forEach(item => {
                yTotals.carbs += Number(item.carbs || 0);
                yTotals.sugar += Number(item.sugar || 0);
                yTotals.fat += Number(item.fat || 0);
                yTotals.satFat += Number(item.satFat || 0);
                yTotals.transFat += Number(item.transFat || 0);
                yTotals.sodium += Number(item.sodium || 0);
                yTotals.cholesterol += Number(item.cholesterol || 0);
            });
        });
    }

    let result = {};
    Object.keys(baseLimits).forEach(key => {
        const cfg = baseLimits[key];
        const yVal = yTotals[key];
        const yOver = Math.max(0, yVal - cfg.max);
        const adjustedMax = yOver > 0 ? Math.max(cfg.floor, cfg.max - yOver) : cfg.max;

        result[key] = {
            ...cfg,
            yVal,
            yOver,
            adjustedMax: cfg.dec === 0 ? Math.round(adjustedMax) : Math.round(adjustedMax * 10) / 10
        };
    });

    return result;
}

// ==========================================
// Weekly Calorie Chart (7 วัน + เส้นเป้าหมาย & ขั้นต่ำ)
// ==========================================
function renderWeeklyChart() {
    const container = document.getElementById('weekly-chart-container');
    if (!container) return;

    const targetCal = Number(userGoals.calories) || 1500;
    const minCal = Number(userGoals.minCalories) || 1200;
    const parts = currentDateKey.split('-');
    const baseDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

    let daysData = [];
    let maxVal = Math.max(2000, targetCal + 500);

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
                    ${targetCal.toLocaleString()}
                </span>
            </div>
            <div class="absolute left-0 right-0 border-t border-dashed border-cyan-400/70 z-20 pointer-events-none flex justify-end"
                 style="bottom: calc(30px + (96px * ${minLineBottomPct / 100}));">
                <span class="text-[9px] bg-slate-900/95 text-cyan-400 px-1 rounded -mt-2.5 font-semibold border border-cyan-500/30">
                    ${minCal.toLocaleString()}
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
    hideMacroTip();
    renderUIOnly();
}

// ==========================================
// Meals Rendering & Copy Yesterday Feature
// ==========================================
function copyMealFromYesterday(mealType) {
    const yesterdayKey = getPreviousDateKey(currentDateKey);
    const yesterdayData = allMealsHistory[yesterdayKey];
    const yesterdayItems = yesterdayData && yesterdayData.meals ? (yesterdayData.meals[mealType] || []) : [];

    if (yesterdayItems.length === 0) {
        alert(`เมื่อวาน (${yesterdayKey}) ไม่มีรายการอาหารใน "${mealType}" ให้คัดลอกครับ`);
        return;
    }

    const dayData = getDayData(currentDateKey);
    const cloned = JSON.parse(JSON.stringify(yesterdayItems));
    dayData.meals[mealType].push(...cloned);
    saveDataAndSync();
}

function renderMeals() {
    const container = document.getElementById('meals-container');
    container.innerHTML = '';
    const dayData = getDayData(currentDateKey);

    const yesterdayKey = getPreviousDateKey(currentDateKey);
    const yesterdayData = allMealsHistory[yesterdayKey];

    mealTypes.forEach(mealType => {
        const items = dayData.meals[mealType] || [];
        const totalCal = items.reduce((sum, item) => sum + Number(item.calories), 0);
        const totalProt = items.reduce((sum, item) => sum + Number(item.protein || 0), 0);

        const hasYesterday = yesterdayData && yesterdayData.meals && (yesterdayData.meals[mealType] || []).length > 0;
        const copyBtnHtml = hasYesterday
            ? `<button type="button" onclick="copyMealFromYesterday('${mealType}')" title="ดึงรายการมื้อนี้จากเมื่อวาน" class="text-[11px] bg-slate-800 hover:bg-slate-700 text-amber-300 px-2 py-0.5 rounded-lg border border-slate-700 transition">
                   <i class="fa-regular fa-copy mr-0.5"></i> คัดลอกเมื่อวาน
               </button>`
            : '';

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
            <div class="flex justify-between items-center border-b border-slate-800/80 pb-2.5 gap-2">
                <div class="flex items-center space-x-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    <h4 class="font-semibold text-white text-sm">${mealType}</h4>
                    ${copyBtnHtml}
                </div>
                <div class="text-xs text-slate-400 font-medium shrink-0">
                    ${totalCal} kcal | P ${totalProt.toFixed(1)}g
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
// Water & Weight Tracker
// ==========================================
function renderWaterAndWeight() {
    const dayData = getDayData(currentDateKey);
    const water = Number(dayData.water || 0);
    const goalWater = Number(userGoals.water) || 2000;
    const pct = Math.min(Math.round((water / goalWater) * 100), 100);

    document.getElementById('water-summary-badge').innerText = `${water.toLocaleString()} / ${goalWater.toLocaleString()} ml`;
    document.getElementById('goal-water-label').innerText = goalWater.toLocaleString();
    document.getElementById('water-progress-bar').style.width = `${pct}%`;
    document.getElementById('water-percent').innerText = `${pct}%`;

    const weightInput = document.getElementById('weight-input');
    weightInput.value = (dayData.weight !== null && dayData.weight !== undefined && dayData.weight !== '') ? dayData.weight : '';

    const diffLabel = document.getElementById('goal-weight-diff');
    if (userGoals.targetWeight && dayData.weight) {
        const diff = (Number(dayData.weight) - Number(userGoals.targetWeight)).toFixed(1);
        if (diff > 0) {
            diffLabel.innerText = `อีก ${diff} kg ถึงเป้า (${userGoals.targetWeight})`;
            diffLabel.className = "text-[10px] text-amber-300 shrink-0";
        } else {
            diffLabel.innerText = `ถึงเป้า ${userGoals.targetWeight} kg แล้ว!`;
            diffLabel.className = "text-[10px] text-emerald-400 font-semibold shrink-0";
        }
    } else if (userGoals.targetWeight) {
        diffLabel.innerText = `เป้า ${userGoals.targetWeight} kg`;
        diffLabel.className = "text-[10px] text-slate-400 shrink-0";
    } else {
        diffLabel.innerText = `ตั้งเป้าใน ⚙️`;
        diffLabel.className = "text-[10px] text-slate-500 shrink-0";
    }

    renderWeightTrend();
}

function addWater(ml) {
    const dayData = getDayData(currentDateKey);
    dayData.water = Math.max(0, (Number(dayData.water) || 0) + ml);
    saveDataAndSync();
}

function updateWeight(val) {
    const dayData = getDayData(currentDateKey);
    const num = parseFloat(val);
    dayData.weight = (!isNaN(num) && num > 0) ? num : null;
    saveDataAndSync();
}

function renderWeightTrend() {
    const container = document.getElementById('weight-trend-container');
    if (!container) return;

    const parts = currentDateKey.split('-');
    const baseDate = new Date(parts[0], parts[1] - 1, parts[2]);
    let points = [];

    for (let i = 6; i >= 0; i--) {
        let d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i);
        let key = getFormattedDateKey(d);
        let w = allMealsHistory[key] ? allMealsHistory[key].weight : null;
        points.push({
            day: d.getDate(),
            weight: (w !== null && w !== undefined && w !== '') ? Number(w) : null
        });
    }

    const validWeights = points.filter(p => p.weight !== null).map(p => p.weight);
    if (validWeights.length === 0) {
        container.innerHTML = `<div class="text-[10px] text-slate-500 text-center py-1">กรอกน้ำหนักตัวเพื่อดูแนวโน้ม 7 วัน</div>`;
        return;
    }

    const minW = Math.min(...validWeights) - 1;
    const maxW = Math.max(...validWeights) + 1;
    const range = Math.max(maxW - minW, 1);

    container.innerHTML = `
        <div class="flex items-end justify-between gap-1 pt-1">
            ${points.map(p => {
                if (p.weight === null) {
                    return `<div class="flex-1 flex flex-col items-center"><span class="text-[8px] text-slate-600 mb-0.5">-</span><div class="w-2 h-6 bg-slate-800/40 rounded-full"></div><span class="text-[8px] text-slate-500 mt-0.5">${p.day}</span></div>`;
                }
                const hPct = Math.max(20, Math.round(((p.weight - minW) / range) * 100));
                return `
                    <div class="flex-1 flex flex-col items-center">
                        <span class="text-[9px] text-purple-300 font-semibold mb-0.5">${p.weight}</span>
                        <div class="w-full max-w-[18px] h-7 bg-slate-900 rounded flex items-end justify-center overflow-hidden">
                            <div class="w-full bg-purple-500 rounded-t" style="height: ${hPct}%;"></div>
                        </div>
                        <span class="text-[8px] text-slate-400 mt-0.5">${p.day}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ==========================================
// Steps & Workouts Controls
// ==========================================
function renderActivity() {
    const dayData = getDayData(currentDateKey);
    const steps = Number(dayData.steps || 0);
    const goalSteps = Number(userGoals.steps) || 10000;
    const { stepsCal, totalBurn } = getTotalBurned(dayData);

    document.getElementById('steps-input').value = steps > 0 ? steps : '';
    document.getElementById('steps-calories').innerText = stepsCal;
    document.getElementById('activity-total-burn').innerText = totalBurn;
    document.getElementById('goal-steps-label').innerText = goalSteps.toLocaleString();

    const pct = Math.min(Math.round((steps / goalSteps) * 100), 100);
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
// Summary (รวมระบบชดเชยแคลอรี & สารอาหาร) & Macro Tooltip Label
// ==========================================
function renderSummary() {
    const dayData = getDayData(currentDateKey);
    let totalCal = 0, totalProt = 0, totalCarbs = 0, totalSugar = 0, totalFiber = 0;
    let totalFat = 0, totalSatFat = 0, totalTransFat = 0;
    let totalSodium = 0, totalPotassium = 0, totalChol = 0;

    Object.values(dayData.meals).forEach(mealList => {
        mealList.forEach(item => {
            totalCal += Number(item.calories || 0);
            totalProt += Number(item.protein || 0);
            totalCarbs += Number(item.carbs || 0);
            totalSugar += Number(item.sugar || 0);
            totalFiber += Number(item.fiber || 0);
            totalFat += Number(item.fat || 0);
            totalSatFat += Number(item.satFat || 0);
            totalTransFat += Number(item.transFat || 0);
            totalSodium += Number(item.sodium || 0);
            totalPotassium += Number(item.potassium || 0);
            totalChol += Number(item.cholesterol || 0);
        });
    });

    const { totalBurn } = getTotalBurned(dayData);
    const adj = getCalorieAdjustment(currentDateKey);
    const macroAdj = getNutrientAdjustments(currentDateKey);
    const protMin = Number(userGoals.proteinMin) || 96;
    const protMax = Number(userGoals.proteinMax) || 128;

    const effectiveBudget = adj.safeTarget + totalBurn;
    const remaining = effectiveBudget - totalCal;

    const goalLabelEl = document.getElementById('goal-cal-label');
    if (adj.actualDeducted > 0) {
        goalLabelEl.innerHTML = `<span class="line-through text-slate-500 mr-1">${adj.baseTarget.toLocaleString()}</span><span class="text-amber-400 font-bold">${adj.safeTarget.toLocaleString()}</span>`;
    } else {
        goalLabelEl.innerText = adj.baseTarget.toLocaleString();
    }

    document.getElementById('calories-remaining').innerHTML = `${remaining} <span class="text-sm font-normal text-slate-400">kcal</span>`;
    document.getElementById('calories-consumed').innerText = `${totalCal} kcal`;
    document.getElementById('calories-burned').innerText = `${totalBurn} kcal`;
    document.getElementById('protein-summary').innerHTML = `${totalProt.toFixed(1)} / <span class="text-xs font-normal text-slate-400">${protMin}-${protMax} g</span>`;

    document.getElementById('carbs-total').innerText = `${totalCarbs.toFixed(1)}g`;
    document.getElementById('sugar-total').innerText = `${totalSugar.toFixed(1)}g`;
    document.getElementById('fiber-total').innerText = `${totalFiber.toFixed(1)}g`;
    document.getElementById('fats-total').innerText = `${totalFat.toFixed(1)}g`;
    document.getElementById('satfat-total').innerText = `${totalSatFat.toFixed(1)}g`;
    document.getElementById('transfat-total').innerText = `${totalTransFat.toFixed(1)}g`;
    document.getElementById('sodium-total').innerText = `${Math.round(totalSodium)}mg`;
    document.getElementById('potassium-total').innerText = `${Math.round(totalPotassium)}mg`;
    document.getElementById('cholesterol-total').innerText = `${Math.round(totalChol)}mg`;

    const percent = Math.min(Math.round((totalCal / effectiveBudget) * 100), 100);
    document.getElementById('calorie-progress-bar').style.width = `${percent}%`;

    const statusEl = document.getElementById('calorie-status');
    const rolloverBox = document.getElementById('rollover-alert-box');

    // รวบรวมรายการที่วันนี้กินเกิน (เพื่อบอกโควตาวันพรุ่งนี้)
    const todayTotalsMap = {
        carbs: totalCarbs, sugar: totalSugar, fat: totalFat,
        satFat: totalSatFat, transFat: totalTransFat, sodium: totalSodium, cholesterol: totalChol
    };
    let tomorrowCaps = [];
    Object.keys(macroAdj).forEach(k => {
        const m = macroAdj[k];
        const cur = todayTotalsMap[k];
        if (cur > m.adjustedMax) {
            const over = cur - m.adjustedMax;
            const nextLimit = m.dec === 0
                ? Math.round(Math.max(m.floor, m.max - over))
                : Math.round(Math.max(m.floor, m.max - over) * 10) / 10;
            tomorrowCaps.push(`${m.label}ไม่เกิน <b>${nextLimit}${m.unit}</b>`);
        }
    });

    // รวบรวมรายการที่เมื่อวานกินเกิน (เพื่อบอกโควตาวันนี้ที่ถูกหักลดลง)
    let todayCapsFromYesterday = [];
    Object.keys(macroAdj).forEach(k => {
        const m = macroAdj[k];
        if (m.yOver > 0) {
            todayCapsFromYesterday.push(`${m.label}ไม่เกิน <b>${m.adjustedMax}${m.unit}</b>`);
        }
    });

    let alertLines = [];
    if (remaining < 0) {
        const overToday = Math.abs(remaining);
        const minFloor = Number(userGoals.minCalories) || 1200;
        const tomorrowTarget = Math.max(minFloor, adj.baseTarget - overToday);
        const tomorrowExtraBurn = Math.max(0, overToday - (adj.baseTarget - tomorrowTarget));
        alertLines.push(`พลังงานวันนี้เกิน <b>${overToday} kcal</b> → พรุ่งนี้ปรับเป้าเหลือ <b>${tomorrowTarget.toLocaleString()} kcal</b>${tomorrowExtraBurn > 0 ? ` (และแนะนำเดินเพิ่ม <b>${tomorrowExtraBurn} kcal</b>)` : ''}`);
    }
    if (tomorrowCaps.length > 0) {
        alertLines.push(`สารอาหารวันนี้เกินเกณฑ์ → พรุ่งนี้ควรคุม: ${tomorrowCaps.join(', ')}`);
    }
    if (adj.yOver > 0) {
        alertLines.push(`ชดเชยพลังงานเมื่อวาน (เกิน ${adj.yOver} kcal) → วันนี้โควตาเหลือ <b>${adj.safeTarget.toLocaleString()} kcal</b>${adj.uncompensatedBurn > 0 ? ` (แนะนำเดินเพิ่ม ~${Math.round(adj.uncompensatedBurn / 0.04).toLocaleString()} ก้าว)` : ''}`);
    }
    if (todayCapsFromYesterday.length > 0) {
        alertLines.push(`ชดเชยสารอาหารเมื่อวาน → วันนี้ควรคุม: ${todayCapsFromYesterday.join(', ')}`);
    }

    if (remaining < 0) {
        statusEl.innerText = "เกินเป้าหมาย";
        statusEl.className = "px-2.5 py-1 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/50 font-medium";
    } else if (adj.yOver > 0 || todayCapsFromYesterday.length > 0) {
        statusEl.innerText = "โหมดชดเชยเมื่อวาน";
        statusEl.className = "px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/50 font-medium";
    } else {
        statusEl.innerText = "ต่ำกว่าเกณฑ์ / กำลังคุม";
        statusEl.className = "px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 font-medium";
    }

    if (alertLines.length > 0) {
        const isDanger = remaining < 0 || tomorrowCaps.length > 0;
        rolloverBox.className = isDanger
            ? "bg-rose-950/60 border-rose-500/40 text-rose-200 text-[11px] px-3 py-2 rounded-xl border flex items-start gap-2"
            : "bg-amber-950/50 border-amber-500/40 text-amber-200 text-[11px] px-3 py-2 rounded-xl border flex items-start gap-2";
        rolloverBox.innerHTML = `
            <i class="fa-solid fa-scale-unbalanced ${isDanger ? 'text-rose-400' : 'text-amber-400'} mt-0.5 shrink-0"></i>
            <div class="space-y-1">${alertLines.map(line => `<div>• ${line}</div>`).join('')}</div>
        `;
    } else {
        rolloverBox.classList.add('hidden');
    }
}

function showMacroTip(type) {
    const box = document.getElementById('macro-tip-box');
    const content = document.getElementById('macro-tip-content');
    if (!box || !content) return;

    if (activeMacroTip === type && !box.classList.contains('hidden')) {
        hideMacroTip();
        return;
    }
    activeMacroTip = type;

    const dayData = getDayData(currentDateKey);
    let totals = { carbs: 0, sugar: 0, fiber: 0, fat: 0, satFat: 0, transFat: 0, sodium: 0, potassium: 0, cholesterol: 0 };
    Object.values(dayData.meals).forEach(list => {
        list.forEach(item => {
            totals.carbs += Number(item.carbs || 0);
            totals.sugar += Number(item.sugar || 0);
            totals.fiber += Number(item.fiber || 0);
            totals.fat += Number(item.fat || 0);
            totals.satFat += Number(item.satFat || 0);
            totals.transFat += Number(item.transFat || 0);
            totals.sodium += Number(item.sodium || 0);
            totals.potassium += Number(item.potassium || 0);
            totals.cholesterol += Number(item.cholesterol || 0);
        });
    });

    const macroAdj = getNutrientAdjustments(currentDateKey);

    if (type === 'fiber' || type === 'potassium') {
        const isFiber = type === 'fiber';
        const title = isFiber ? "ไฟเบอร์ (Fiber)" : "โพแทสเซียม (Potassium)";
        const target = isFiber ? 25 : 3500;
        const unit = isFiber ? "g" : "mg";
        const dec = isFiber ? 1 : 0;
        const cur = totals[type];
        const rem = Math.max(0, target - cur);
        const tip = isFiber ? "ช่วยให้อิ่มนานและขับถ่ายดี" : "ช่วยขับโซเดียม ลดบวมน้ำ (ผักใบเขียว กล้วย)";

        content.innerHTML = `
            <div class="font-bold text-white flex items-center gap-1.5">
                <i class="fa-solid fa-circle-info text-indigo-400"></i> ${title}: <span class="text-amber-300">ควรได้ ${target.toLocaleString()}${unit} / วัน</span>
            </div>
            <div class="text-[11px] text-slate-300 mt-0.5">
                วันนี้ทานไป <b>${cur.toFixed(dec)}${unit}</b> (${rem === 0 ? '<span class="text-emerald-400 font-bold">ถึงเกณฑ์แล้ว!</span>' : `<span class="text-sky-400 font-semibold">ขาดอีก ${rem.toFixed(dec)}${unit}</span>`}) — <span class="text-slate-400">${tip}</span>
            </div>
        `;
        box.className = "bg-slate-950/90 border border-indigo-500/40 rounded-xl px-3 py-2.5 text-xs flex justify-between items-start gap-2 transition-all";
        return;
    }

    const m = macroAdj[type];
    if (!m) return;

    const cur = totals[type];
    const dec = m.dec;
    const isAlert = cur > m.adjustedMax;
    const limitDisplay = m.yOver > 0
        ? `<span class="line-through text-slate-500 mr-1">${m.max}${m.unit}</span><span class="text-amber-300 font-bold">${m.adjustedMax}${m.unit}</span> <span class="text-[10px] text-amber-400">(ลดชดเชยเมื่อวาน)</span>`
        : `<span class="text-amber-300">ไม่เกิน ${m.max}${m.unit} / วัน</span>`;

    let statusDetail = "";
    if (isAlert) {
        const overNow = cur - m.adjustedMax;
        const tomorrowCap = dec === 0
            ? Math.round(Math.max(m.floor, m.max - overNow))
            : Math.round(Math.max(m.floor, m.max - overNow) * 10) / 10;
        statusDetail = `<span class="text-rose-400 font-bold">เกินเกณฑ์แล้ว ${overNow.toFixed(dec)}${m.unit}</span> → พรุ่งนี้ไม่ควรทานเกิน <b class="text-white underline">${tomorrowCap}${m.unit}</b>`;
    } else {
        const rem = Math.max(0, m.adjustedMax - cur);
        statusDetail = `<span class="text-emerald-400 font-semibold">เหลือโควตาวันนี้ ${rem.toFixed(dec)}${m.unit}</span>`;
    }

    content.innerHTML = `
        <div class="font-bold text-white flex items-center gap-1.5 flex-wrap">
            <i class="fa-solid fa-circle-info text-indigo-400"></i> ${m.label}: ${limitDisplay}
        </div>
        <div class="text-[11px] text-slate-300 mt-0.5">
            วันนี้ทานไป <b>${cur.toFixed(dec)}${m.unit}</b> (${statusDetail})
        </div>
    `;

    box.className = isAlert
        ? "bg-rose-950/60 border border-rose-500/50 rounded-xl px-3 py-2.5 text-xs flex justify-between items-start gap-2 transition-all"
        : "bg-slate-950/90 border border-indigo-500/40 rounded-xl px-3 py-2.5 text-xs flex justify-between items-start gap-2 transition-all";
}

function hideMacroTip() {
    const box = document.getElementById('macro-tip-box');
    if (box) box.classList.add('hidden');
    activeMacroTip = null;
}

// ==========================================
// Smart Nutrition Coach (1-Click Add + อิงโควตาชดเชย)
// ==========================================
const coachProteinMenus = [
    { name: "ไข่ขาวต้ม (3 ฟอง)", calories: 50, protein: 11, carbs: 1, sugar: 0, fiber: 0, fat: 0, satFat: 0, transFat: 0, sodium: 165, potassium: 160, cholesterol: 0, note: "โปรตีนล้วน แคลต่ำมาก ไร้ไขมัน" },
    { name: "เวย์โปรตีนไอโซเลต (1 สกู๊ป)", calories: 120, protein: 25, carbs: 2, sugar: 1, fiber: 0, fat: 1, satFat: 0.5, transFat: 0, sodium: 80, potassium: 150, cholesterol: 15, note: "ดูดซึมไว เติมโปรตีนได้เยอะในแคลน้อย" },
    { name: "อกไก่นุ่มเซเว่น (1 ชิ้น)", calories: 130, protein: 23, carbs: 2, sugar: 1, fiber: 0, fat: 3, satFat: 0.8, transFat: 0, sodium: 390, potassium: 220, cholesterol: 65, note: "หาซื้อง่าย อิ่มท้องนาน" },
    { name: "ทูน่าในน้ำแร่ (1 กระป๋อง)", calories: 110, protein: 24, carbs: 0, sugar: 0, fiber: 0, fat: 1, satFat: 0.2, transFat: 0, sodium: 320, potassium: 210, cholesterol: 45, note: "ไขมันต่ำมาก ยำหรือกินกับสลัดได้" },
    { name: "กรีกโยเกิร์ต 0% (1 ถ้วย)", calories: 90, protein: 15, carbs: 6, sugar: 5, fiber: 0, fat: 0, satFat: 0, transFat: 0, sodium: 55, potassium: 190, cholesterol: 5, note: "ช่วยเรื่องขับถ่ายและลดอยากของหวาน" },
    { name: "นมถั่วเหลืองโปรตีนสูง (1 ขวด)", calories: 180, protein: 28, carbs: 6, sugar: 2, fiber: 2, fat: 4.5, satFat: 0.5, transFat: 0, sodium: 150, potassium: 350, cholesterol: 0, note: "ดื่มง่าย โปรตีนแน่น" },
    { name: "ปลานิล/ปลาทับทิมนึ่ง (1 ตัว)", calories: 220, protein: 35, carbs: 0, sugar: 0, fiber: 0, fat: 8, satFat: 2, transFat: 0, sodium: 110, potassium: 450, cholesterol: 95, note: "ย่อยง่าย เหมาะเป็นมื้อเย็น" },
    { name: "ไข่ต้มทั้งฟอง (2 ฟอง)", calories: 150, protein: 12, carbs: 1, sugar: 1, fiber: 0, fat: 10, satFat: 3.2, transFat: 0, sodium: 140, potassium: 126, cholesterol: 372, note: "ประหยัด อิ่มนาน" }
];

function quickAddRecommendedFood(idx) {
    const item = coachProteinMenus[idx];
    if (!item) return;

    const dayData = getDayData(currentDateKey);
    dayData.meals["มื้อว่าง/อื่นๆ"].push({
        name: item.name,
        qty: 1,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        sugar: item.sugar,
        fiber: item.fiber,
        fat: item.fat,
        satFat: item.satFat,
        transFat: item.transFat,
        sodium: item.sodium,
        potassium: item.potassium,
        cholesterol: item.cholesterol
    });
    saveDataAndSync();
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
    const adj = getCalorieAdjustment(currentDateKey);
    const macroAdj = getNutrientAdjustments(currentDateKey);
    const minProt = Number(userGoals.proteinMin) || 96;
    const maxProt = Number(userGoals.proteinMax) || 128;

    const remCal = (adj.safeTarget + totalBurn) - totalCal;
    const remProt = Math.max(0, minProt - totalProt);

    let warnings = [];
    if (totalSodium > macroAdj.sodium.adjustedMax) {
        warnings.push(`โซเดียมเกินโควตาแล้ว (${Math.round(totalSodium)}/${macroAdj.sodium.adjustedMax} mg) <b>ควรงด</b> ซดน้ำซุป อาหารแปรรูป บะหมี่กึ่งสำเร็จรูป และของหมักดอง`);
    }
    if (totalSugar > macroAdj.sugar.adjustedMax) {
        warnings.push(`น้ำตาลเกินโควตา (${totalSugar.toFixed(1)}/${macroAdj.sugar.adjustedMax} g) <b>ควรเลี่ยง</b> ชานม น้ำอัดลม ขนมหวาน และผลไม้รสหวานจัด`);
    }
    if (totalSatFat > macroAdj.satFat.adjustedMax || totalTransFat > macroAdj.transFat.adjustedMax) {
        warnings.push(`ไขมันอิ่มตัว/ทรานส์เกินเกณฑ์ <b>ควรเลี่ยง</b> ของทอด เบเกอรี่ ครีมเทียม กะทิ และเนื้อสัตว์ติดมัน`);
    }
    if (totalChol > macroAdj.cholesterol.adjustedMax) {
        warnings.push(`คอเลสเตอรอลเกินโควตา (${Math.round(totalChol)}/${macroAdj.cholesterol.adjustedMax} mg) <b>ควรเลี่ยง</b> ไข่แดง เครื่องในสัตว์ (เลือกกินเฉพาะไข่ขาวแทน)`);
    }
    if (remCal < 150 && remCal >= 0) {
        warnings.push(`แคลอรีเหลือน้อย (${remCal} kcal) <b>ควรงด</b> ของทานเล่นที่มีแป้งและไขมันสูง`);
    } else if (remCal < 0) {
        warnings.push(`ทานเกินโควตาไปแล้ว ${Math.abs(remCal)} kcal <b>ควรงดมื้อดึก</b> หรือเดินเพิ่มอีกนิดเพื่อชดเชย`);
    }

    if (warnings.length === 0) {
        warnings.push(`ค่าโซเดียม น้ำตาล และไขมันยังอยู่ในเกณฑ์ดี <b>เลี่ยง</b> ของทอดและน้ำหวานเพื่อรักษาสมดุลต่อ`);
    }

    let protHtml = "";
    if (remProt <= 0) {
        protHtml = `<div class="text-xs text-emerald-400 font-medium"><i class="fa-solid fa-circle-check mr-1"></i> ยินดีด้วย! วันนี้คุณทานโปรตีนถึงเป้าหมาย (${totalProt.toFixed(1)}g) เรียบร้อยแล้ว</div>`;
    } else {
        let suitableWithIdx = coachProteinMenus
            .map((m, originalIdx) => ({ ...m, originalIdx }))
            .filter(m => m.calories <= Math.max(remCal, 130))
            .slice(0, 3);

        protHtml = `
            <p class="text-xs text-slate-300 mb-2">
                ยังขาดโปรตีนอีก <span class="text-emerald-400 font-bold">${remProt.toFixed(1)}g</span> (งบพลังงานเหลือ <span class="text-white font-semibold">${Math.max(0, remCal)} kcal</span>) กดเพิ่มเข้ามื้อว่างได้ทันที:
            </p>
            <div class="space-y-1.5">
                ${suitableWithIdx.map(m => `
                    <div class="flex justify-between items-center bg-slate-950/70 px-3 py-2 rounded-xl border border-slate-800/80 text-xs gap-2">
                        <div>
                            <span class="text-slate-100 font-medium">${m.name}</span>
                            <span class="text-[10px] text-slate-400 block">${m.note}</span>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            <div class="text-right">
                                <span class="text-emerald-400 font-bold block">+${m.protein}g P</span>
                                <span class="text-[10px] text-slate-400">${m.calories} kcal</span>
                            </div>
                            <button type="button" onclick="quickAddRecommendedFood(${m.originalIdx})" class="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition">
                                + เพิ่ม
                            </button>
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
                    <i class="fa-solid fa-drumstick-bite"></i> เติมโปรตีนให้ถึงเป้า (${minProt}-${maxProt}g)
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
// Quantity Multiplier
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
        fiber: (Number(document.getElementById('food-fiber').value) || 0) / mult,
        fat: (Number(document.getElementById('food-fat').value) || 0) / mult,
        satFat: (Number(document.getElementById('food-satfat').value) || 0) / mult,
        transFat: (Number(document.getElementById('food-transfat').value) || 0) / mult,
        sodium: (Number(document.getElementById('food-sodium').value) || 0) / mult,
        potassium: (Number(document.getElementById('food-potassium').value) || 0) / mult,
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
    document.getElementById('food-fiber').value = round1(baseNutrition.fiber * mult);
    document.getElementById('food-fat').value = round1(baseNutrition.fat * mult);
    document.getElementById('food-satfat').value = round1(baseNutrition.satFat * mult);
    document.getElementById('food-transfat').value = round1(baseNutrition.transFat * mult);
    document.getElementById('food-sodium').value = Math.round(baseNutrition.sodium * mult);
    document.getElementById('food-potassium').value = Math.round(baseNutrition.potassium * mult);
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

        const calories  = extractValue(/(?:พลังงานทั้งหมด|พลังงาน|Energy|Calories)[^\d]*(\d+(?:\.\d+)?)/i);
        const protein   = extractValue(/(?:โปรตีน|Protein)[^\d]*(\d+(?:\.\d+)?)/i);
        const carbs     = extractValue(/(?:คาร์โบไฮเดรตทั้งหมด|คาร์โบไฮเดรต|Carbohydrate)[^\d]*(\d+(?:\.\d+)?)/i);
        const sugar     = extractValue(/(?:น้ำตาล|Sugar)[^\d]*(\d+(?:\.\d+)?)/i);
        const fiber     = extractValue(/(?:ใยอาหาร|Dietary Fiber|Fiber)[^\d]*(\d+(?:\.\d+)?)/i);
        const fat       = extractValue(/(?:ไขมันทั้งหมด|ไขมัน|Total Fat|Fat)[^\d]*(\d+(?:\.\d+)?)/i);
        const satFat    = extractValue(/(?:ไขมันอิ่มตัว|Saturated Fat)[^\d]*(\d+(?:\.\d+)?)/i);
        const transFat  = extractValue(/(?:ไขมันทรานส์|Trans Fat)[^\d]*(\d+(?:\.\d+)?)/i);
        const sodium    = extractValue(/(?:โซเดียม|Sodium)[^\d]*(\d+(?:\.\d+)?)/i);
        const potassium = extractValue(/(?:โพแทสเซียม|Potassium)[^\d]*(\d+(?:\.\d+)?)/i);
        const chol      = extractValue(/(?:โคเลสเตอรอล|คอเลสเตอรอล|Cholesterol)[^\d]*(\d+(?:\.\d+)?)/i);

        fillFormWithNutritionData({
            name: "สินค้าจากฉลาก",
            calories,
            protein,
            carbs: carbs || sugar,
            sugar,
            fiber,
            fat,
            satFat,
            transFat,
            sodium,
            potassium,
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
           {"name": "ชื่อเมนูภาษาไทย (1 จาน)", "calories": ตัวเลข, "protein": ตัวเลข, "carbs": ตัวเลข, "sugar": ตัวเลข, "fiber": ตัวเลข, "fat": ตัวเลข, "satFat": ตัวเลข, "transFat": ตัวเลข, "sodium": ตัวเลข, "potassium": ตัวเลข, "cholesterol": ตัวเลข}`;

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
                fiber: Number((n[`fiber${suffix}`] || 0).toFixed(1)),
                fat: Number((n[`fat${suffix}`] || 0).toFixed(1)),
                satFat: Number((n[`saturated-fat${suffix}`] || 0).toFixed(1)),
                transFat: Number((n[`trans-fat${suffix}`] || 0).toFixed(1)),
                sodium: Math.round((n[`sodium${suffix}`] || 0) * 1000),
                potassium: Math.round((n[`potassium${suffix}`] || 0) * 1000),
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
    document.getElementById('food-fiber').value = item.fiber ?? 0;
    document.getElementById('food-fat').value = item.fat ?? 0;
    document.getElementById('food-satfat').value = item.satFat ?? 0;
    document.getElementById('food-transfat').value = item.transFat ?? 0;
    document.getElementById('food-sodium').value = item.sodium ?? 0;
    document.getElementById('food-potassium').value = item.potassium ?? 0;
    document.getElementById('food-cholesterol').value = item.cholesterol ?? 0;
    setBaseNutritionFromCurrentInputs();
}

// ==========================================
// Settings, Goals & Food Catalog Manager
// ==========================================
function openSettingsModal() {
    document.getElementById('goal-cal-input').value = userGoals.calories;
    document.getElementById('goal-min-cal-input').value = userGoals.minCalories;
    document.getElementById('goal-prot-min-input').value = userGoals.proteinMin;
    document.getElementById('goal-prot-max-input').value = userGoals.proteinMax;
    document.getElementById('goal-steps-input').value = userGoals.steps;
    document.getElementById('goal-water-input').value = userGoals.water;
    document.getElementById('goal-weight-input').value = userGoals.targetWeight || '';

    document.getElementById('catalog-count-badge').innerText = foodCatalog.length;
    document.getElementById('github-token-input').value = localStorage.getItem('fitTracker_github_token') || '';
    document.getElementById('gemini-api-key-input').value = localStorage.getItem('fitTracker_gemini_key') || '';
    document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.add('hidden');
}

async function saveAllSettings() {
    userGoals = {
        calories: Math.max(500, Number(document.getElementById('goal-cal-input').value) || 1500),
        minCalories: Math.max(500, Number(document.getElementById('goal-min-cal-input').value) || 1200),
        proteinMin: Math.max(10, Number(document.getElementById('goal-prot-min-input').value) || 96),
        proteinMax: Math.max(10, Number(document.getElementById('goal-prot-max-input').value) || 128),
        steps: Math.max(1000, Number(document.getElementById('goal-steps-input').value) || 10000),
        water: Math.max(500, Number(document.getElementById('goal-water-input').value) || 2000),
        targetWeight: parseFloat(document.getElementById('goal-weight-input').value) || null
    };
    localStorage.setItem('fitTracker_goals', JSON.stringify(userGoals));

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
    renderUIOnly();

    if (ghToken) {
        await pushToGitHub(true);
    } else {
        setSyncStatus('local', 'บันทึกในเครื่อง');
        alert("บันทึกเป้าหมายและการตั้งค่าเรียบร้อยแล้ว!");
    }
}

function openCatalogManagerModal() {
    document.getElementById('catalog-search-input').value = '';
    renderCatalogManagerList();
    document.getElementById('catalog-modal').classList.remove('hidden');
}

function closeCatalogManagerModal() {
    document.getElementById('catalog-modal').classList.add('hidden');
}

function renderCatalogManagerList() {
    const listEl = document.getElementById('catalog-manager-list');
    const keyword = (document.getElementById('catalog-search-input').value || '').toLowerCase();

    const filtered = foodCatalog
        .map((item, idx) => ({ ...item, idx }))
        .filter(item => item.name.toLowerCase().includes(keyword));

    if (filtered.length === 0) {
        listEl.innerHTML = `<div class="text-xs text-slate-500 text-center py-6">ไม่พบเมนูในคลัง</div>`;
        return;
    }

    listEl.innerHTML = filtered.map(item => `
        <div class="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex justify-between items-center gap-2">
            <div>
                <div class="text-xs font-semibold text-white">${item.name}</div>
                <div class="text-[10px] text-slate-400 mt-0.5">
                    ${item.calories} kcal | P: <span class="text-emerald-400">${item.protein}g</span> | C: ${item.carbs}g | F: ${item.fat}g
                </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
                <button type="button" onclick="editCatalogItem(${item.idx})" class="bg-slate-800 hover:bg-slate-700 text-amber-400 w-7 h-7 rounded-lg flex items-center justify-center transition">
                    <i class="fa-solid fa-pen text-[11px]"></i>
                </button>
                <button type="button" onclick="deleteCatalogItem(${item.idx})" class="bg-slate-800 hover:bg-slate-700 text-rose-400 w-7 h-7 rounded-lg flex items-center justify-center transition">
                    <i class="fa-solid fa-trash text-[11px]"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function editCatalogItem(idx) {
    const item = foodCatalog[idx];
    if (!item) return;

    const newCal = prompt(`แก้ไขแคลอรีต่อ 1 หน่วยของ "${item.name}":`, item.calories);
    if (newCal === null) return;
    const newProt = prompt(`แก้ไขโปรตีน (g) ต่อ 1 หน่วยของ "${item.name}":`, item.protein);
    if (newProt === null) return;

    foodCatalog[idx].calories = Math.max(0, Number(newCal) || 0);
    foodCatalog[idx].protein = Math.max(0, Number(newProt) || 0);
    renderCatalogManagerList();
    saveDataAndSync();
}

function deleteCatalogItem(idx) {
    const item = foodCatalog[idx];
    if (!item) return;
    if (confirm(`ต้องการลบ "${item.name}" ออกจากรายการแนะนำใช่ไหม?`)) {
        foodCatalog.splice(idx, 1);
        document.getElementById('catalog-count-badge').innerText = foodCatalog.length;
        renderCatalogManagerList();
        saveDataAndSync();
    }
}

// ==========================================
// Food Modal Controls
// ==========================================
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
        document.getElementById('food-fiber').value = item.fiber || '';
        document.getElementById('food-fat').value = item.fat || '';
        document.getElementById('food-satfat').value = item.satFat || '';
        document.getElementById('food-transfat').value = item.transFat || '';
        document.getElementById('food-sodium').value = item.sodium || '';
        document.getElementById('food-potassium').value = item.potassium || '';
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
        fiber: Number(document.getElementById('food-fiber').value || 0),
        fat: Number(document.getElementById('food-fat').value || 0),
        satFat: Number(document.getElementById('food-satfat').value || 0),
        transFat: Number(document.getElementById('food-transfat').value || 0),
        sodium: Number(document.getElementById('food-sodium').value || 0),
        potassium: Number(document.getElementById('food-potassium').value || 0),
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
        fiber: Math.round((newItem.fiber / qtyNum) * 10) / 10,
        fat: Math.round((newItem.fat / qtyNum) * 10) / 10,
        satFat: Math.round((newItem.satFat / qtyNum) * 10) / 10,
        transFat: Math.round((newItem.transFat / qtyNum) * 10) / 10,
        sodium: Math.round(newItem.sodium / qtyNum),
        potassium: Math.round(newItem.potassium / qtyNum),
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
        document.getElementById('food-fiber').value = found.fiber ?? 0;
        document.getElementById('food-fat').value = found.fat;
        document.getElementById('food-satfat').value = found.satFat ?? 0;
        document.getElementById('food-transfat').value = found.transFat ?? 0;
        document.getElementById('food-sodium').value = found.sodium;
        document.getElementById('food-potassium').value = found.potassium ?? 0;
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
    const water = Number(dayObj.water || 0);
    const stepsCal = Math.round(steps * 0.04);
    const workoutCal = (dayObj.workouts || []).reduce((s, w) => s + Number(w.calories || 0), 0);
    const totalBurn = stepsCal + workoutCal;

    if (itemCount === 0 && steps === 0 && workoutCal === 0 && water === 0 && !dayObj.weight) return null;

    return { totalCal, totalProt, totalCarbs, totalFat, totalSugar, totalSodium, steps, water, weight: dayObj.weight, totalBurn, dayObj };
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

    const targetCal = Number(userGoals.calories) || 1500;
    const protMin = Number(userGoals.proteinMin) || 96;

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
            if (stats.totalCal > targetCal + 500) {
                calDotClass = 'bg-rose-500';
            } else if (stats.totalCal >= targetCal) {
                calDotClass = 'bg-orange-400';
            }

            const protPct = (stats.totalProt / protMin) * 100;
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

    const adj = getCalorieAdjustment(dateKey);
    const protMin = Number(userGoals.proteinMin) || 96;
    const protPct = Math.round((stats.totalProt / protMin) * 100);
    const remaining = (adj.safeTarget + stats.totalBurn) - stats.totalCal;

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
                    ทาน <b class="text-white">${stats.totalCal}</b> kcal | เผาผลาญ <b class="text-orange-400">${stats.totalBurn}</b> kcal | น้ำ <b class="text-sky-400">${stats.water}</b> ml
                    ${stats.weight ? `| นน. <b class="text-purple-400">${stats.weight}</b> kg` : ''}
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
    hideMacroTip();
    closeCalendarModal();
    renderUIOnly();
}

// ==========================================
// Weekly & Monthly Report Analytics (7 วัน / 30 วัน)
// ==========================================
function openReportModal() {
    currentReportDays = 7;
    switchReportPeriod(7);
    document.getElementById('report-modal').classList.remove('hidden');
}

function closeReportModal() {
    document.getElementById('report-modal').classList.add('hidden');
}

function switchReportPeriod(days) {
    currentReportDays = days;
    const tab7 = document.getElementById('report-tab-7');
    const tab30 = document.getElementById('report-tab-30');

    if (days === 7) {
        tab7.className = "py-1.5 rounded-lg text-xs font-semibold transition bg-indigo-600 text-white";
        tab30.className = "py-1.5 rounded-lg text-xs font-semibold transition text-slate-400 hover:text-white";
    } else {
        tab30.className = "py-1.5 rounded-lg text-xs font-semibold transition bg-indigo-600 text-white";
        tab7.className = "py-1.5 rounded-lg text-xs font-semibold transition text-slate-400 hover:text-white";
    }

    renderHealthReport(days);
}

function renderHealthReport(daysCount) {
    const container = document.getElementById('report-content-container');
    if (!container) return;

    const parts = currentDateKey.split('-');
    const endDate = new Date(parts[0], parts[1] - 1, parts[2]);

    const targetCal = Number(userGoals.calories) || 1500;
    const minCal = Number(userGoals.minCalories) || 1200;
    const protMin = Number(userGoals.proteinMin) || 96;
    const goalWater = Number(userGoals.water) || 2000;

    let activeDays = 0;
    let calOnTargetDays = 0;
    let calTooLowDays = 0;
    let calOverDays = 0;
    let protPassDays = 0;

    let sums = {
        cal: 0, burn: 0, prot: 0, carbs: 0, sugar: 0, fiber: 0,
        fat: 0, satFat: 0, transFat: 0, sodium: 0, potassium: 0, chol: 0,
        water: 0, steps: 0
    };
    let weights = [];
    let foodFrequency = {};

    for (let i = daysCount - 1; i >= 0; i--) {
        let d = new Date(endDate);
        d.setDate(endDate.getDate() - i);
        let key = getFormattedDateKey(d);
        let dayObj = allMealsHistory[key];

        if (dayObj && dayObj.weight) {
            weights.push({ date: key, weight: Number(dayObj.weight) });
        }

        if (!dayObj || !dayObj.meals) continue;

        let dCal = 0, dProt = 0, dCarbs = 0, dSugar = 0, dFiber = 0;
        let dFat = 0, dSatFat = 0, dTransFat = 0, dSodium = 0, dPotas = 0, dChol = 0;

        Object.values(dayObj.meals).forEach(list => {
            list.forEach(item => {
                const c = Number(item.calories || 0);
                dCal += c;
                dProt += Number(item.protein || 0);
                dCarbs += Number(item.carbs || 0);
                dSugar += Number(item.sugar || 0);
                dFiber += Number(item.fiber || 0);
                dFat += Number(item.fat || 0);
                dSatFat += Number(item.satFat || 0);
                dTransFat += Number(item.transFat || 0);
                dSodium += Number(item.sodium || 0);
                dPotas += Number(item.potassium || 0);
                dChol += Number(item.cholesterol || 0);

                const cleanName = (item.name || '').trim();
                if (cleanName) {
                    if (!foodFrequency[cleanName]) {
                        foodFrequency[cleanName] = { count: 0, totalCal: 0, totalProt: 0 };
                    }
                    foodFrequency[cleanName].count += 1;
                    foodFrequency[cleanName].totalCal += c;
                    foodFrequency[cleanName].totalProt += Number(item.protein || 0);
                }
            });
        });

        if (dCal > 0) {
            activeDays++;
            const { totalBurn } = getTotalBurned(dayObj);
            const effectiveLimit = targetCal + totalBurn;

            if (dCal > effectiveLimit) {
                calOverDays++;
            } else if (dCal < minCal) {
                calTooLowDays++;
            } else {
                calOnTargetDays++;
            }

            if (dProt >= protMin) {
                protPassDays++;
            }

            sums.cal += dCal;
            sums.burn += totalBurn;
            sums.prot += dProt;
            sums.carbs += dCarbs;
            sums.sugar += dSugar;
            sums.fiber += dFiber;
            sums.fat += dFat;
            sums.satFat += dSatFat;
            sums.transFat += dTransFat;
            sums.sodium += dSodium;
            sums.potassium += dPotas;
            sums.chol += dChol;
            sums.water += Number(dayObj.water || 0);
            sums.steps += Number(dayObj.steps || 0);
        }
    }

    if (activeDays === 0) {
        container.innerHTML = `
            <div class="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 text-center space-y-2">
                <i class="fa-solid fa-folder-open text-2xl text-slate-500"></i>
                <div class="text-sm font-semibold text-slate-300">ยังไม่มีข้อมูลอาหารในช่วง ${daysCount} วันนี้</div>
                <div class="text-xs text-slate-500">เริ่มบันทึกมื้ออาหารเพื่อให้ระบบวิเคราะห์แนวโน้มสุขภาพของคุณครับ</div>
            </div>
        `;
        return;
    }

    const avg = {
        cal: Math.round(sums.cal / activeDays),
        burn: Math.round(sums.burn / activeDays),
        prot: (sums.prot / activeDays).toFixed(1),
        carbs: (sums.carbs / activeDays).toFixed(1),
        sugar: (sums.sugar / activeDays).toFixed(1),
        fiber: (sums.fiber / activeDays).toFixed(1),
        fat: (sums.fat / activeDays).toFixed(1),
        satFat: (sums.satFat / activeDays).toFixed(1),
        sodium: Math.round(sums.sodium / activeDays),
        potassium: Math.round(sums.potassium / activeDays),
        chol: Math.round(sums.chol / activeDays),
        water: Math.round(sums.water / activeDays),
        steps: Math.round(sums.steps / activeDays)
    };

    const calSuccessRate = Math.round(((calOnTargetDays + calTooLowDays) / activeDays) * 100);
    const protSuccessRate = Math.round((protPassDays / activeDays) * 100);
    const overallScore = Math.round((calSuccessRate * 0.6) + (protSuccessRate * 0.4));

    let grade = 'C', gradeColor = 'text-amber-400', gradeDesc = 'ยังหลุดเป้าบ่อย ค่อยๆ ปรับทีละมื้อ';
    if (overallScore >= 85) {
        grade = 'A+'; gradeColor = 'text-emerald-400'; gradeDesc = 'คุมวินัยได้ดีเยี่ยมมาก! รักษามาตรฐานนี้ไว้';
    } else if (overallScore >= 70) {
        grade = 'A'; gradeColor = 'text-emerald-400'; gradeDesc = 'ทำได้ดีมาก ภาพรวมอยู่ในเกณฑ์คุมน้ำหนัก';
    } else if (overallScore >= 50) {
        grade = 'B'; gradeColor = 'text-sky-400'; gradeDesc = 'อยู่ในเกณฑ์ดี เพิ่มโปรตีนอีกนิดจะสมบูรณ์แบบ';
    }

    let goodPoints = [];
    let tooLowPoints = [];
    let tooHighPoints = [];

    if (avg.cal < minCal) {
        tooLowPoints.push(`<b>แคลอรีเฉลี่ย (${avg.cal} kcal/วัน)</b> ต่ำกว่าเกณฑ์ขั้นต่ำ (${minCal} kcal) ระวังระบบเผาผลาญลดลงและเสียมวลกล้ามเนื้อ`);
    } else if (avg.cal > targetCal + avg.burn) {
        tooHighPoints.push(`<b>แคลอรีเฉลี่ย (${avg.cal} kcal/วัน)</b> สูงกว่างบพลังงานรวมเผาผลาญ (${targetCal + avg.burn} kcal)`);
    } else {
        goodPoints.push(`<b>แคลอรีเฉลี่ย (${avg.cal} kcal/วัน)</b> อยู่ในโซนลดไขมันที่เหมาะสม (${minCal}–${targetCal} kcal)`);
    }

    if (Number(avg.prot) < protMin) {
        tooLowPoints.push(`<b>โปรตีนเฉลี่ย (${avg.prot}g/วัน)</b> น้อยกว่าเป้าขั้นต่ำ (${protMin}g) ควรเพิ่มอกไก่ ไข่ขาว หรือเวย์`);
    } else {
        goodPoints.push(`<b>โปรตีนเฉลี่ย (${avg.prot}g/วัน)</b> ถึงเป้าหมาย (${protMin}g+) ช่วยรักษามวลกล้ามเนื้อได้ดี`);
    }

    if (Number(avg.fiber) < 15) {
        tooLowPoints.push(`<b>ไฟเบอร์เฉลี่ย (${avg.fiber}g/วัน)</b> ค่อนข้างน้อย (ควรได้ 25g/วัน) ควรเพิ่มผักใบเขียวหรือธัญพืช`);
    } else {
        goodPoints.push(`<b>ไฟเบอร์เฉลี่ย (${avg.fiber}g/วัน)</b> อยู่ในเกณฑ์ดีต่อระบบขับถ่าย`);
    }

    if (avg.water < goalWater * 0.75) {
        tooLowPoints.push(`<b>น้ำดื่มเฉลี่ย (${avg.water.toLocaleString()} ml/วัน)</b> น้อยกว่าเป้า (${goalWater.toLocaleString()} ml)`);
    } else {
        goodPoints.push(`<b>น้ำดื่มเฉลี่ย (${avg.water.toLocaleString()} ml/วัน)</b> ดื่มน้ำได้เพียงพอ`);
    }

    if (Number(avg.sugar) > 24) {
        tooHighPoints.push(`<b>น้ำตาลเฉลี่ย (${avg.sugar}g/วัน)</b> เกินเกณฑ์ 24g/วัน ควรลดเครื่องดื่มหวานหรือขนม`);
    }
    if (avg.sodium > 2000) {
        tooHighPoints.push(`<b>โซเดียมเฉลี่ย (${avg.sodium.toLocaleString()}mg/วัน)</b> เกิน 2,000mg/วัน เสี่ยงตัวบวมน้ำ`);
    }
    if (Number(avg.satFat) > 16) {
        tooHighPoints.push(`<b>ไขมันอิ่มตัวเฉลี่ย (${avg.satFat}g/วัน)</b> เกิน 16g/วัน ควรเลี่ยงของทอดและเนื้อติดมัน`);
    }
    if (avg.chol > 300) {
        tooHighPoints.push(`<b>คอเลสเตอรอลเฉลี่ย (${avg.chol}mg/วัน)</b> เกิน 300mg/วัน`);
    }

    let weightChangeHtml = '';
    if (weights.length >= 2) {
        const firstW = weights[0].weight;
        const lastW = weights[weights.length - 1].weight;
        const diff = (lastW - firstW).toFixed(1);
        const diffText = diff < 0 ? `<span class="text-emerald-400 font-bold">${diff} kg</span>` : (diff > 0 ? `<span class="text-rose-400 font-bold">+${diff} kg</span>` : `<span class="text-slate-300 font-bold">คงที่ (0.0 kg)</span>`);
        weightChangeHtml = `
            <div class="bg-slate-950/70 px-3 py-2 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <span class="text-slate-400"><i class="fa-solid fa-weight-scale text-purple-400 mr-1.5"></i>แนวโน้มน้ำหนัก (${firstW} → ${lastW} kg)</span>
                ${diffText}
            </div>
        `;
    }

    const topFoods = Object.entries(foodFrequency)
        .map(([name, info]) => ({ name, ...info }))
        .sort((a, b) => b.count - a.count || b.totalCal - a.totalCal)
        .slice(0, 5);

    container.innerHTML = `
        <div class="bg-gradient-to-br from-slate-950 to-indigo-950/40 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
            <div>
                <div class="text-[11px] text-slate-400">ประเมินผลจากข้อมูลที่บันทึก <b>${activeDays} วัน</b> (ในรอบ ${daysCount} วัน)</div>
                <div class="text-xs font-semibold text-white mt-1">${gradeDesc}</div>
                <div class="flex flex-wrap gap-2 mt-2 text-[10px]">
                    <span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/50">ตามเป้า: ${calOnTargetDays} วัน</span>
                    <span class="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/50">กินน้อย: ${calTooLowDays} วัน</span>
                    <span class="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/50">เกินเป้า: ${calOverDays} วัน</span>
                </div>
            </div>
            <div class="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700 flex flex-col items-center justify-center shrink-0">
                <span class="text-[9px] text-slate-400">เกรด</span>
                <span class="text-2xl font-extrabold ${gradeColor} leading-none">${grade}</span>
            </div>
        </div>

        ${weightChangeHtml}

        <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
            <div class="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <i class="fa-solid fa-calculator text-sky-400"></i> ค่าเฉลี่ยต่อวัน (ช่วง ${daysCount} วัน)
            </div>
            <div class="grid grid-cols-3 gap-1.5 text-center text-xs">
                <div class="bg-slate-900 p-2 rounded-xl border border-slate-800/80">
                    <span class="text-[10px] text-slate-400 block">พลังงานเฉลี่ย</span>
                    <span class="font-bold text-white">${avg.cal} <span class="text-[9px] font-normal">kcal</span></span>
                </div>
                <div class="bg-slate-900 p-2 rounded-xl border border-slate-800/80">
                    <span class="text-[10px] text-slate-400 block">โปรตีนเฉลี่ย</span>
                    <span class="font-bold text-emerald-400">${avg.prot}g</span>
                </div>
                <div class="bg-slate-900 p-2 rounded-xl border border-slate-800/80">
                    <span class="text-[10px] text-slate-400 block">เผาผลาญเฉลี่ย</span>
                    <span class="font-bold text-orange-400">${avg.burn} <span class="text-[9px] font-normal">kcal</span></span>
                </div>
                <div class="bg-slate-900 p-2 rounded-xl border border-slate-800/80">
                    <span class="text-[10px] text-slate-400 block">คาร์บ / น้ำตาล</span>
                    <span class="font-semibold text-slate-200">${avg.carbs}g <span class="text-pink-400">/ ${avg.sugar}g</span></span>
                </div>
                <div class="bg-slate-900 p-2 rounded-xl border border-slate-800/80">
                    <span class="text-[10px] text-slate-400 block">ไขมัน / อิ่มตัว</span>
                    <span class="font-semibold text-slate-200">${avg.fat}g <span class="text-orange-300">/ ${avg.satFat}g</span></span>
                </div>
                <div class="bg-slate-900 p-2 rounded-xl border border-slate-800/80">
                    <span class="text-[10px] text-slate-400 block">โซเดียมเฉลี่ย</span>
                    <span class="font-semibold text-amber-400">${avg.sodium.toLocaleString()}mg</span>
                </div>
            </div>
        </div>

        <div class="space-y-2">
            ${goodPoints.length > 0 ? `
                <div class="bg-emerald-950/30 border border-emerald-800/40 rounded-2xl p-3 space-y-1">
                    <div class="text-xs font-bold text-emerald-400"><i class="fa-solid fa-circle-check mr-1"></i> สิ่งที่ทำได้ดี (อยู่ในเกณฑ์เหมาะสม)</div>
                    <ul class="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
                        ${goodPoints.map(p => `<li>${p}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}

            ${tooLowPoints.length > 0 ? `
                <div class="bg-amber-950/30 border border-amber-800/40 rounded-2xl p-3 space-y-1">
                    <div class="text-xs font-bold text-amber-400"><i class="fa-solid fa-arrow-trend-down mr-1"></i> สิ่งที่ยังน้อยเกินไป (ควรเพิ่ม)</div>
                    <ul class="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
                        ${tooLowPoints.map(p => `<li>${p}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}

            ${tooHighPoints.length > 0 ? `
                <div class="bg-rose-950/30 border border-rose-800/40 rounded-2xl p-3 space-y-1">
                    <div class="text-xs font-bold text-rose-400"><i class="fa-solid fa-triangle-exclamation mr-1"></i> สิ่งที่มากเกินไป (ควรลด)</div>
                    <ul class="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
                        ${tooHighPoints.map(p => `<li>${p}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>

        <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
            <div class="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <i class="fa-solid fa-ranking-star text-amber-400"></i> 5 อันดับเมนูที่ทานบ่อยที่สุด
            </div>
            <div class="space-y-1.5">
                ${topFoods.map((f, i) => `
                    <div class="flex justify-between items-center text-xs bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800/60">
                        <div class="truncate pr-2">
                            <span class="text-amber-400 font-bold mr-1.5">#${i + 1}</span>
                            <span class="text-slate-200 font-medium">${f.name}</span>
                        </div>
                        <div class="text-right shrink-0 text-[11px]">
                            <span class="text-indigo-300 font-semibold">${f.count} ครั้ง</span>
                            <span class="text-slate-400 ml-1">(${f.totalCal.toLocaleString()} kcal)</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Initialize on load
window.onload = initApp;
