// ==========================================================================
// core.js — FitTracker Core Engine, Global State, GitHub Cloud Sync & Router
// ==========================================================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
}

// ------------------------------------------
// 1. GitHub DB Config & Global Variables
// ------------------------------------------
const GITHUB_OWNER = "Lavy-Lallaby";
const GITHUB_REPO  = "fittracker-db";
const GITHUB_PATH  = "db.json";
let currentFileSha = null;

const mealTypes = ["มื้อเช้า", "มื้อเที่ยง", "มื้อเย็น", "มื้อว่าง/อื่นๆ"];
let activeMainPage = 'foodtrack';
const htmlModuleCache = {};

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

function fmtPrecise(val, maxDec = 2) {
    const num = Number(val) || 0;
    const factor = Math.pow(10, maxDec);
    return Math.round((num + Number.EPSILON) * factor) / factor;
}

let currentDateKey = getFormattedDateKey(new Date());
let photoBlobCache = {};

const goalPresets = {
    fat_loss: {
        label: "ลดไขมัน + รักษากล้ามเนื้อ",
        desc: "แคลอรีติดลบพอดี (1,500 kcal) เน้นโปรตีนสูงเพื่อรักษามวลกล้ามเนื้อขณะลดไขมัน",
        calories: 1500, minCalories: 1200, proteinMin: 96, proteinMax: 128, carbsMax: 150, fatMax: 50, sugarMax: 24, sodiumMax: 2000
    },
    fat_sugar_burn: {
        label: "รีดไขมัน & น้ำตาล (IF 16/8)",
        desc: "เว้นช่วงกิน 16 ชม. (12:00-20:00 น.) คุมคาร์บ 100g น้ำตาล 20g และตัดแป้งมื้อเย็นเพื่อดึงไขมันสะสมมาใช้ก่อน",
        calories: 1500, minCalories: 1200, proteinMin: 115, proteinMax: 125, carbsMax: 100, fatMax: 60, sugarMax: 20, sodiumMax: 1900
    },
    high_protein: {
        label: "เน้นโปรตีนสูง ลดคาร์บ",
        desc: "โปรตีนสูงพิเศษ (40%) ลดแป้งและน้ำตาล ช่วยให้อิ่มนานและเร่งเผาผลาญ",
        calories: 1500, minCalories: 1200, proteinMin: 130, proteinMax: 160, carbsMax: 95, fatMax: 58, sugarMax: 24, sodiumMax: 2000
    },
    keto_fat: {
        label: "เน้นไขมันดี ลดแป้ง (Low-Carb / Keto)",
        desc: "จำกัดคาร์บต่ำมาก (ไม่เกิน 35g) เน้นไขมันดีเป็นพลังงานหลักและโปรตีนปานกลาง",
        calories: 1550, minCalories: 1250, proteinMin: 95, proteinMax: 115, carbsMax: 35, fatMax: 112, sugarMax: 15, sodiumMax: 2000
    },
    maintain: {
        label: "รักษาน้ำหนัก & สมดุล",
        desc: "พลังงานสมดุล (1,900 kcal) สัดส่วนโปรตีน คาร์บ และไขมันพอดีสำหรับใช้ชีวิตประจำวัน",
        calories: 1900, minCalories: 1500, proteinMin: 95, proteinMax: 120, carbsMax: 225, fatMax: 63, sugarMax: 30, sodiumMax: 2000
    },
    lean_bulk: {
        label: "เพิ่มน้ำหนัก & สร้างกล้ามเนื้อ",
        desc: "เพิ่มพลังงานส่วนเกินแบบคลีน (2,300 kcal) เน้นโปรตีนและคาร์บเพื่อแรงยกเวทและสร้างกล้ามเนื้อ",
        calories: 2300, minCalories: 1900, proteinMin: 130, proteinMax: 160, carbsMax: 285, fatMax: 64, sugarMax: 35, sodiumMax: 2200
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
    sugarMax: 24,
    sodiumMax: 2000,
    steps: 10000,
    water: 2000,
    targetWeight: null,
    autoWeightMacro: false,
    autoWeightGoal: 'cut'
};

// ตารางเป้า 7 วันของโหมดรีดไขมัน (อ้างอิงตามหน้าตาราง 7 วันใน foodtrack.js)
const FAT_LOSS_DAY_TARGETS = {
    0: { code: 'D1', kcal: 890,  protein: 98, carb: 100, sugar: 20 },
    1: { code: 'D2', kcal: 880,  protein: 97, carb: 100, sugar: 20 },
    2: { code: 'D3', kcal: 815,  protein: 96, carb: 100, sugar: 20 },
    3: { code: 'D4', kcal: 865,  protein: 89, carb: 100, sugar: 20 },
    4: { code: 'D5', kcal: 810,  protein: 91, carb: 100, sugar: 20 },
    5: { code: 'D6', kcal: 765,  protein: 92, carb: 100, sugar: 20 },
    6: { code: 'D7', kcal: 920,  protein: 103, carb: 100, sugar: 20 }
};

function getDayNutritionOverride(dateKey) {
    const dayObj = allMealsHistory[dateKey];
    return (dayObj && dayObj.nutritionOverride && typeof dayObj.nutritionOverride === 'object')
        ? dayObj.nutritionOverride
        : null;
}

function applyFatLossDayTargetToDate(dayIndex, dateKey = currentDateKey, { minCal = null } = {}) {
    const plan = FAT_LOSS_DAY_TARGETS[Number(dayIndex)];
    if (!plan) return;

    const dayObj = getDayData(dateKey);
    const effectiveMin = (minCal !== null && !isNaN(Number(minCal)))
        ? Math.max(500, Number(minCal))
        : Math.min(Number(dayObj.targetMin ?? userGoals.minCalories ?? 1200), plan.kcal);

    dayObj.targetMin = effectiveMin;
    dayObj.targetMax = plan.kcal;
    dayObj.nutritionOverride = {
        source: `fat_loss_${plan.code}`,
        proteinMin: plan.protein,
        proteinMax: Math.max(plan.protein + 15, plan.protein),
        carbsMax: plan.carb,
        sugarMax: plan.sugar
    };

    userGoals.preset = 'fat_sugar_burn';
    userGoals.carbsMax = plan.carb;
    userGoals.sugarMax = plan.sugar;

    saveDataAndSync();
}

function clearDayNutritionOverride(dateKey = currentDateKey) {
    const dayObj = getDayData(dateKey);
    delete dayObj.nutritionOverride;
    delete dayObj.targetMin;
    delete dayObj.targetMax;
    saveDataAndSync();
}

let userGoals = Object.assign({}, defaultGoals, JSON.parse(localStorage.getItem('fitTracker_goals') || '{}'));
let allMealsHistory = JSON.parse(localStorage.getItem('fitTracker_history') || '{}');
let foodCatalog = JSON.parse(localStorage.getItem('fitTracker_catalog') || 'null') || [
    { name: "อกไก่ต้ม (100g)", calories: 120, protein: 25, carbs: 0, sugar: 0, fiber: 0, fat: 1.5, satFat: 0.4, transFat: 0, sodium: 60, potassium: 255, cholesterol: 50 },
    { name: "ข้าวสวย (1 ทัพพี)", calories: 80, protein: 2, carbs: 18, sugar: 0, fiber: 0.5, fat: 0.2, satFat: 0, transFat: 0, sodium: 0, potassium: 25, cholesterol: 0 },
    { name: "ไข่ต้ม (1 ฟอง)", calories: 75, protein: 6, carbs: 0.5, sugar: 0.5, fiber: 0, fat: 5, satFat: 1.6, transFat: 0, sodium: 70, potassium: 63, cholesterol: 186 }
];

// ------------------------------------------
// 2. Module Loader (โหลดไฟล์ .html ย่อยเข้า #page-slot)
// ------------------------------------------
async function loadPageModule(pageName) {
    activeMainPage = pageName;
    const slot = document.getElementById('page-slot');
    if (!slot) return;

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        const isSummary = btn.id === 'nav-btn-summary';
        btn.className = isSummary
            ? "nav-tab-btn row-span-2 col-start-5 row-start-1 flex flex-col items-center justify-center rounded-2xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:bg-slate-800 transition"
            : "nav-tab-btn flex flex-col items-center justify-center py-1.5 rounded-xl text-slate-400 hover:bg-slate-900 transition";
    });
    const activeBtn = document.getElementById(`nav-btn-${pageName}`);
    if (activeBtn) {
        activeBtn.className = pageName === 'summary'
            ? "nav-tab-btn row-span-2 col-start-5 row-start-1 flex flex-col items-center justify-center rounded-2xl bg-indigo-600/30 border border-indigo-400 text-white font-bold shadow-lg transition"
            : "nav-tab-btn flex flex-col items-center justify-center py-1.5 rounded-xl bg-indigo-600/25 border border-indigo-500/40 text-indigo-300 font-bold transition";
    }

    try {
        if (!htmlModuleCache[pageName]) {
            const res = await fetch(`./${pageName}.html?v=${Date.now()}`);
            if (!res.ok) throw new Error(`ไม่พบไฟล์ ${pageName}.html`);
            htmlModuleCache[pageName] = await res.text();
        }
        slot.innerHTML = htmlModuleCache[pageName];
    } catch (err) {
        slot.innerHTML = `<div class="bg-rose-950/50 border border-rose-500/40 text-rose-200 p-4 rounded-2xl text-xs text-center">${err.message}</div>`;
        return;
    }

    renderActivePageUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderActivePageUI() {
    renderDateDisplay();
    if (activeMainPage === 'foodtrack' && typeof renderFoodTrackPage === 'function') renderFoodTrackPage();
    if (activeMainPage === 'train' && typeof renderTrainPage === 'function') renderTrainPage();
    if (activeMainPage === 'skincare' && typeof renderSkincarePage === 'function') renderSkincarePage();
    if (activeMainPage === 'summary' && typeof renderSummaryPage === 'function') renderSummaryPage();
    if (activeMainPage === 'trip' && typeof renderTripPage === 'function') renderTripPage();
    if (activeMainPage === 'addons' && typeof renderAddonsPage === 'function') renderAddonsPage();
    if (activeMainPage === 'finance' && typeof renderFinancePage === 'function') renderFinancePage();
    if (activeMainPage === 'gear' && typeof renderGearPage === 'function') renderGearPage();
    if (activeMainPage === 'focus' && typeof renderFocusPage === 'function') renderFocusPage();
    if (activeMainPage === 'car' && typeof renderCarPage === 'function') renderCarPage();
}

// ------------------------------------------
// 3. Date & Daily Data Helpers
// ------------------------------------------
function renderDateDisplay() {
    const displayDateEl = document.getElementById('display-date');
    const currentBadgeEl = document.getElementById('current-date-badge');
    const futureBadge = document.getElementById('future-plan-badge');
    if (!displayDateEl || !currentBadgeEl) return;

    displayDateEl.innerText = formatDisplayDate(currentDateKey);
    const todayKey = getFormattedDateKey(new Date());
    currentBadgeEl.innerText = (currentDateKey === todayKey) ? 'วันนี้' : currentDateKey;

    if (futureBadge) {
        if (currentDateKey > todayKey) futureBadge.classList.remove('hidden');
        else futureBadge.classList.add('hidden');
    }
}

function changeDay(direction) {
    const parts = currentDateKey.split('-');
    let d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + direction);
    currentDateKey = getFormattedDateKey(d);
    if (typeof hideMacroTip === 'function') hideMacroTip();
    renderActivePageUI();
}

function goToToday() {
    currentDateKey = getFormattedDateKey(new Date());
    if (typeof hideMacroTip === 'function') hideMacroTip();
    renderActivePageUI();
}

function getPreviousDateKey(dateKey) {
    const parts = dateKey.split('-');
    let d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() - 1);
    return getFormattedDateKey(d);
}

function getNextDateKey(dateKey) {
    const parts = dateKey.split('-');
    let d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + 1);
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

function applyGoalChangeFromDate(effectiveDateKey, newMin, newMax) {
    const oldMin = Number(userGoals.minCalories) || 1200;
    const oldMax = Number(userGoals.calories) || 1500;

    Object.keys(allMealsHistory).forEach(k => {
        if (k < effectiveDateKey) {
            const d = allMealsHistory[k];
            if (d && (d.targetMax === undefined || d.targetMax === null)) {
                d.targetMin = oldMin;
                d.targetMax = oldMax;
            }
        }
    });

    if (!Array.isArray(userGoals.goalHistory)) {
        userGoals.goalHistory = [{ from: '2000-01-01', min: oldMin, max: oldMax }];
    }
    userGoals.goalHistory = userGoals.goalHistory.filter(g => g.from !== effectiveDateKey);
    userGoals.goalHistory.push({ from: effectiveDateKey, min: newMin, max: newMax });
    userGoals.goalHistory.sort((a, b) => a.from.localeCompare(b.from));

    userGoals.minCalories = newMin;
    userGoals.calories = newMax;

    const curDay = getDayData(effectiveDateKey);
    curDay.targetMin = newMin;
    curDay.targetMax = newMax;
}

function getDayCalorieGoals(dateKey) {
    const dayObj = allMealsHistory[dateKey];
    if (dayObj && dayObj.targetMax !== undefined && dayObj.targetMax !== null) {
        return { min: Number(dayObj.targetMin ?? 1200), max: Number(dayObj.targetMax) };
    }

    if (Array.isArray(userGoals.goalHistory) && userGoals.goalHistory.length > 0) {
        let matched = userGoals.goalHistory[0];
        for (const entry of userGoals.goalHistory) {
            if (entry.from <= dateKey) matched = entry;
            else break;
        }
        return { min: Number(matched.min), max: Number(matched.max) };
    }

    return {
        min: Number(userGoals.minCalories) || 1200,
        max: Number(userGoals.calories) || 1500
    };
}

function getTotalBurned(dayData) {
    const stepsCal = Math.round((Number(dayData.steps) || 0) * 0.04);
    const workoutCal = (dayData.workouts || []).reduce((sum, w) => sum + Number(w.calories || 0), 0);
    return { stepsCal, workoutCal, totalBurn: stepsCal + workoutCal };
}

// ------------------------------------------
// 4. Calorie & Nutrient Rollover Compensation
// ------------------------------------------
function getCalorieAdjustment(dateKey) {
    const todayGoals = getDayCalorieGoals(dateKey);
    const baseTarget = todayGoals.max;
    const minFloor = todayGoals.min;

    const yKey = getPreviousDateKey(dateKey);
    const yData = allMealsHistory[yKey];
    const yGoals = getDayCalorieGoals(yKey);
    let yOver = 0;

    if (yData && yData.meals) {
        let yCal = 0;
        Object.values(yData.meals).forEach(list => {
            list.forEach(item => { yCal += Number(item.calories || 0); });
        });
        if (yCal > 0) {
            const { totalBurn: yBurn } = getTotalBurned(yData);
            const yLimit = yGoals.max + yBurn;
            if (yCal > yLimit) yOver = yCal - yLimit;
        }
    }

    const rawAdjusted = baseTarget - yOver;
    const safeTarget = yOver > 0 ? Math.max(minFloor, rawAdjusted) : baseTarget;
    const actualDeducted = baseTarget - safeTarget;
    const uncompensatedBurn = Math.max(0, yOver - actualDeducted);

    return { baseTarget, minFloor, yOver, safeTarget, actualDeducted, uncompensatedBurn };
}

function getNutrientAdjustments(dateKey) {
    // ใน getNutrientAdjustments(dateKey):
    const dayOverride = getDayNutritionOverride(dateKey);
    const baseTargetCal = Number(userGoals.calories) || 1500;
    const targetCarbs = Number(dayOverride?.carbsMax ?? userGoals.carbsMax) || Math.round((baseTargetCal * 0.50) / 4);
    const targetFat = Number(dayOverride?.fatMax ?? userGoals.fatMax) || Math.round((baseTargetCal * 0.30) / 9);
    const targetSugar = Number(dayOverride?.sugarMax ?? userGoals.sugarMax) || 24;
    const targetSodium = Number(dayOverride?.sodiumMax ?? userGoals.sodiumMax) || 2000;

    const baseLimits = {
        carbs: { label: "คาร์บ", max: targetCarbs, floor: Math.min(25, Math.round(targetCarbs * 0.6)), unit: "g", dec: 2 },
        sugar: { label: "น้ำตาล", max: targetSugar, floor: 6, unit: "g", dec: 2 },
        fat: { label: "ไขมันรวม", max: targetFat, floor: Math.round(targetFat * 0.6), unit: "g", dec: 2 },
        satFat: { label: "ไขมันอิ่มตัว", max: 16, floor: 5, unit: "g", dec: 2 },
        transFat: { label: "ไขมันทรานส์", max: 0, floor: 0, unit: "g", dec: 2 },
        sodium: { label: "โซเดียม", max: targetSodium, floor: 1000, unit: "mg", dec: 1 },
        cholesterol: { label: "คอเลสเตอรอล", max: 300, floor: 100, unit: "mg", dec: 1 }
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
            adjustedMax: fmtPrecise(adjustedMax, cfg.dec)
        };
    });
    return result;
}

// ------------------------------------------
// 5. GitHub REST API Sync (Auto Push + ปุ่ม Upload / Download แยก ไม่เด้ง alert)
// ------------------------------------------
let _isSyncBusy = false;
let _queuedAutoPush = false;

function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binString = "";
    bytes.forEach((b) => { binString += String.fromCharCode(b); });
    return btoa(binString);
}

function base64ToUtf8(base64Str) {
    const clean = (base64Str || '').replace(/\s+/g, '');
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
}

function setSyncStatus(type, text) {
    const badge = document.getElementById('sync-status-badge');
    const icon = document.getElementById('sync-icon');
    if (!badge) return;

    if (type === 'syncing') {
        badge.innerHTML = `<i class="fa-solid fa-rotate fa-spin text-sky-400"></i> ${text}`;
        badge.className = "text-[10px] text-sky-400 block mt-0.5 truncate";
        if (icon) icon.classList.add('fa-spin');
    } else if (type === 'synced') {
        badge.innerHTML = `<i class="fa-solid fa-cloud-check text-emerald-400"></i> ${text}`;
        badge.className = "text-[10px] text-emerald-400 block mt-0.5 truncate";
        if (icon) icon.classList.remove('fa-spin');
    } else if (type === 'error') {
        badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-400"></i> ${text}`;
        badge.className = "text-[10px] text-rose-400 block mt-0.5 truncate";
        if (icon) icon.classList.remove('fa-spin');
    } else {
        badge.innerHTML = `<i class="fa-solid fa-hard-drive"></i> ${text}`;
        badge.className = "text-[10px] text-slate-400 block mt-0.5 truncate";
        if (icon) icon.classList.remove('fa-spin');
    }
}

function setActionIconState(btnId, busy) {
    const icon = document.getElementById(btnId);
    if (!icon) return;
    if (busy) icon.classList.add('fa-spin');
    else icon.classList.remove('fa-spin');
}

function applyDownloadedDbToState(remoteDb) {
    if (!remoteDb || typeof remoteDb !== 'object') return;

    if (remoteDb.goals) {
        userGoals = { ...defaultGoals, ...remoteDb.goals };
        localStorage.setItem('fitTracker_goals', JSON.stringify(userGoals));
    }
    if (remoteDb.history && typeof remoteDb.history === 'object') {
        allMealsHistory = remoteDb.history;
        localStorage.setItem('fitTracker_history', JSON.stringify(allMealsHistory));
    }
    if (Array.isArray(remoteDb.catalog)) {
        foodCatalog = remoteDb.catalog;
        localStorage.setItem('fitTracker_catalog', JSON.stringify(foodCatalog));
    }
    if (Array.isArray(remoteDb.skincareItems)) {
        window.skincareItems = remoteDb.skincareItems;
        localStorage.setItem('fitTracker_skincare_items', JSON.stringify(remoteDb.skincareItems));
    }
    if (remoteDb.skincareLogs) {
        window.skincareLogs = remoteDb.skincareLogs;
        localStorage.setItem('fitTracker_skincare_logs', JSON.stringify(remoteDb.skincareLogs));
    }
    if (remoteDb.skincarePhotosMap) {
        window.skincarePhotosMap = remoteDb.skincarePhotosMap;
        localStorage.setItem('fitTracker_skincare_photos', JSON.stringify(remoteDb.skincarePhotosMap));
    }
    if (remoteDb.exercisePhotosMap) {
        window.exercisePhotosMap = remoteDb.exercisePhotosMap;
        localStorage.setItem('fitTracker_ex_photos', JSON.stringify(remoteDb.exercisePhotosMap));
    }
    if (Array.isArray(remoteDb.trips)) {
        window.savedTrips = remoteDb.trips;
        localStorage.setItem('fitTracker_trips', JSON.stringify(remoteDb.trips));
    }
    if (Array.isArray(remoteDb.pantry)) {
        window.pantryItems = remoteDb.pantry;
        localStorage.setItem('fitTracker_pantry', JSON.stringify(remoteDb.pantry));
    }
    if (remoteDb.gear) {
        window.gearState = remoteDb.gear;
        localStorage.setItem('fitTracker_gear_state', JSON.stringify(remoteDb.gear));
    }
    if (remoteDb.car) {
        window.carData = remoteDb.car;
        localStorage.setItem('fitTracker_car_data', JSON.stringify(remoteDb.car));
    }
}

function buildDbPayload() {
    return {
        updatedAt: new Date().toISOString(),
        goals: userGoals,
        history: allMealsHistory,
        catalog: foodCatalog,
        skincareItems: window.skincareItems || JSON.parse(localStorage.getItem('fitTracker_skincare_items') || '[]'),
        skincareLogs: window.skincareLogs || JSON.parse(localStorage.getItem('fitTracker_skincare_logs') || '{}'),
        skincarePhotosMap: window.skincarePhotosMap || JSON.parse(localStorage.getItem('fitTracker_skincare_photos') || '{}'),
        exercisePhotosMap: window.exercisePhotosMap || JSON.parse(localStorage.getItem('fitTracker_ex_photos') || '{}'),
        trips: window.savedTrips || JSON.parse(localStorage.getItem('fitTracker_trips') || '[]'),
        pantry: window.pantryItems,
        gear: window.gearState,
        car: window.carData
    };
}

async function fetchLatestDbSha(token) {
    const getUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}?t=${Date.now()}`;
    const res = await fetch(getUrl, {
        cache: 'no-store',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json'
        }
    });
    if (res.status === 404) return null;
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`ดึง SHA ไม่สำเร็จ (HTTP ${res.status}) ${errText.slice(0, 120)}`);
    }
    const json = await res.json();
    return json.sha || null;
}

// Auto Push / Upload ขึ้น GitHub (ไม่เด้ง alert)
async function pushToGitHub(_showAlert = false) {
    const token = (localStorage.getItem('fitTracker_github_token') || '').trim();
    if (!token) {
        setSyncStatus('local', 'บันทึกในเครื่อง');
        return;
    }

    if (_isSyncBusy) {
        _queuedAutoPush = true;
        return;
    }

    _isSyncBusy = true;
    setActionIconState('btn-upload-icon', true);
    setSyncStatus('syncing', 'กำลังอัปเดตขึ้น Cloud...');

    try {
        const latestSha = await fetchLatestDbSha(token);
        if (latestSha) currentFileSha = latestSha;

        const contentBase64 = utf8ToBase64(JSON.stringify(buildDbPayload(), null, 2));
        const putUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`;

        const sendPut = async (shaToUse) => fetch(putUrl, {
            method: 'PUT',
            cache: 'no-store',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Sync FitTracker DB (${currentDateKey})`,
                content: contentBase64,
                ...(shaToUse ? { sha: shaToUse } : {})
            })
        });

        let putRes = await sendPut(currentFileSha);
        if (putRes.status === 409) {
            currentFileSha = await fetchLatestDbSha(token);
            putRes = await sendPut(currentFileSha);
        }

        if (!putRes.ok) {
            const errBody = await putRes.text().catch(() => '');
            throw new Error(`HTTP ${putRes.status} - ${errBody.slice(0, 140)}`);
        }

        const putData = await putRes.json();
        currentFileSha = putData.content?.sha || currentFileSha;
        setSyncStatus('synced', 'อัปเดต GitHub แล้ว');
    } catch (err) {
        console.error('[pushToGitHub]:', err);
        setSyncStatus('error', `อัปเดตไม่สำเร็จ: ${err.message}`);
    } finally {
        _isSyncBusy = false;
        setActionIconState('btn-upload-icon', false);
        if (_queuedAutoPush) {
            _queuedAutoPush = false;
            pushToGitHub(false);
        }
    }
}

// Download ข้อมูลจาก GitHub มาทับข้อมูลในเครื่อง (ไม่เด้ง alert)
async function downloadFromGitHub(_silentOnLoad = true) {
    const token = (localStorage.getItem('fitTracker_github_token') || '').trim();
    if (!token) {
        setSyncStatus('local', 'บันทึกในเครื่อง');
        return;
    }

    if (_isSyncBusy) return;
    _isSyncBusy = true;
    setActionIconState('btn-download-icon', true);
    setSyncStatus('syncing', 'กำลังดึงข้อมูล...');

    try {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}?t=${Date.now()}`;
        const res = await fetch(url, {
            cache: 'no-store',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json'
            }
        });

        if (res.status === 404) {
            setSyncStatus('local', 'ยังไม่มีไฟล์ db.json');
            return;
        }
        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`HTTP ${res.status} - ${errText.slice(0, 120)}`);
        }

        const data = await res.json();
        currentFileSha = data.sha;
        const remoteDb = JSON.parse(base64ToUtf8(data.content));

        applyDownloadedDbToState(remoteDb);
        renderActivePageUI();
        setSyncStatus('synced', 'ดึงข้อมูลสำเร็จแล้ว');
    } catch (err) {
        console.error('[downloadFromGitHub]:', err);
        setSyncStatus('error', `ดึงข้อมูลไม่สำเร็จ: ${err.message}`);
    } finally {
        _isSyncBusy = false;
        setActionIconState('btn-download-icon', false);
    }
}

const uploadToGitHub = () => pushToGitHub(false);
const syncFromGitHub = (_showAlert = false) => downloadFromGitHub(true);

// ------------------------------------------
// 6. Image Resize & GitHub Image Upload Helper
// ------------------------------------------
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

async function uploadImageToGitHubFolder(folderName, prefix, base64Content) {
    const token = localStorage.getItem('fitTracker_github_token');
    if (!token) return null;

    const fileName = `${folderName}/${prefix}_${Date.now()}.jpg`;
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${fileName}`;

    try {
        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Upload ${fileName}`,
                content: base64Content
            })
        });
        if (!res.ok) throw new Error("Upload image failed");
        photoBlobCache[fileName] = `data:image/jpeg;base64,${base64Content}`;
        return fileName;
    } catch (err) {
        console.error(err);
        return null;
    }
}

// ------------------------------------------
// 7. Global Settings, BMR/TDEE & CSV Export
// ------------------------------------------
let lastCalcMacros = null;

function applyGoalPreset(presetKey) {
    const descEl = document.getElementById('preset-desc-label');
    if (presetKey === 'custom' || !goalPresets[presetKey]) {
        if (descEl) descEl.innerText = "ปรับแต่งเป้าหมายแคลอรี โปรตีน คาร์บ และไขมันเองตามต้องการ";
        return;
    }
    const p = goalPresets[presetKey];
    document.getElementById('goal-cal-input').value = p.calories;
    document.getElementById('goal-min-cal-input').value = p.minCalories;
    document.getElementById('goal-prot-min-input').value = p.proteinMin;
    document.getElementById('goal-prot-max-input').value = p.proteinMax;
    document.getElementById('goal-carbs-input').value = p.carbsMax;
    document.getElementById('goal-fat-input').value = p.fatMax;
    if (descEl) descEl.innerText = p.desc;
}

function markPresetCustom() {
    const sel = document.getElementById('goal-preset-select');
    const descEl = document.getElementById('preset-desc-label');
    if (sel) sel.value = 'custom';
    if (descEl) descEl.innerText = "โหมดกำหนดตัวเลขเอง (Custom)";
}

function calculateBMRandTDEE() {
    const gender = document.getElementById('bmr-gender').value;
    const age = Number(document.getElementById('bmr-age').value) || 27;
    const height = Number(document.getElementById('bmr-height').value) || 167;
    const weight = Number(document.getElementById('bmr-weight').value);
    const bodyFat = parseFloat(document.getElementById('bmr-bodyfat')?.value);
    const activity = Number(document.getElementById('bmr-activity').value) || 1.375;
    const box = document.getElementById('bmr-result-box');

    if (!weight || weight <= 0) {
        box.innerHTML = `<div class="text-slate-400">กรอกน้ำหนักปัจจุบันเพื่อคำนวณค่าพลังงานและสารอาหาร</div>`;
        return;
    }

    let bmr = 0, lbm = weight, formulaLabel = "Mifflin-St Jeor";
    if (!isNaN(bodyFat) && bodyFat > 2 && bodyFat < 65) {
        lbm = weight * (1 - (bodyFat / 100));
        bmr = Math.round(370 + (21.6 * lbm));
        formulaLabel = `Katch-McArdle (กล้ามเนื้อล้วน ${lbm.toFixed(1)} kg)`;
    } else {
        bmr = Math.round((10 * weight) + (6.25 * height) - (5 * age) + (gender === 'male' ? 5 : -161));
    }

    const tdee = Math.round(bmr * activity);
    const cutMax = Math.max(1300, tdee - 500);
    const cutMin = Math.max(1200, cutMax - 200);
    const protMin = !isNaN(bodyFat) ? Math.round(lbm * 1.8) : Math.round(weight * 1.35);
    const protMax = !isNaN(bodyFat) ? Math.round(lbm * 2.1) : Math.round(weight * 1.6);
    const fatMax = Math.max(40, Math.round((cutMax * 0.30) / 9));
    const carbsMax = Math.max(60, Math.round((cutMax - (protMin * 4) - (fatMax * 9)) / 4));

    lastCalcMacros = { cutMin, cutMax, protMin, protMax, carbsMax, fatMax };
    box.innerHTML = `
        <div class="space-y-0.5">
            <div class="text-[10px] text-purple-300 font-semibold">${formulaLabel}</div>
            <div class="text-slate-300">BMR: <b class="text-white">${bmr.toLocaleString()}</b> | TDEE: <b class="text-sky-400">${tdee.toLocaleString()}</b> kcal</div>
            <div class="text-emerald-400">เป้าลดไขมัน: <b>${cutMin.toLocaleString()}–${cutMax.toLocaleString()} kcal</b></div>
            <div class="text-[10px] text-slate-300">P: <b class="text-emerald-300">${protMin}-${protMax}g</b> | C: <b class="text-sky-300">${carbsMax}g</b> | F: <b class="text-amber-300">${fatMax}g</b></div>
        </div>
        <button type="button" onclick="applyCalculatedCalories()" class="bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-semibold px-2.5 py-2 rounded-lg shrink-0">ใช้ค่านี้</button>
    `;
}

function applyCalculatedCalories() {
    if (!lastCalcMacros) return;
    document.getElementById('goal-cal-input').value = lastCalcMacros.cutMax;
    document.getElementById('goal-min-cal-input').value = lastCalcMacros.cutMin;
    document.getElementById('goal-prot-min-input').value = lastCalcMacros.protMin;
    document.getElementById('goal-prot-max-input').value = lastCalcMacros.protMax;
    document.getElementById('goal-carbs-input').value = lastCalcMacros.carbsMax;
    document.getElementById('goal-fat-input').value = lastCalcMacros.fatMax;
    markPresetCustom();
}

function onSettingsAutoWeightToggle(isChecked) {
    if (isChecked) {
        userGoals.autoWeightMacro = true;
        if (!userGoals.autoWeightGoal) userGoals.autoWeightGoal = 'cut';
        if (typeof recalcGoalsByCurrentWeight === 'function') {
            recalcGoalsByCurrentWeight(false);
            document.getElementById('goal-cal-input').value = userGoals.calories;
            document.getElementById('goal-min-cal-input').value = userGoals.minCalories;
            document.getElementById('goal-prot-min-input').value = userGoals.proteinMin;
            document.getElementById('goal-prot-max-input').value = userGoals.proteinMax;
            document.getElementById('goal-carbs-input').value = userGoals.carbsMax;
            document.getElementById('goal-fat-input').value = userGoals.fatMax;
        }
    } else {
        userGoals.autoWeightMacro = false;
    }
}

function openSettingsModal() {
    const autoToggle = document.getElementById('goal-auto-weight-toggle');
    if (autoToggle) autoToggle.checked = Boolean(userGoals.autoWeightMacro);

    const currentPreset = userGoals.preset || 'fat_loss';
    document.getElementById('goal-preset-select').value = goalPresets[currentPreset] ? currentPreset : 'custom';
    const descEl = document.getElementById('preset-desc-label');
    if (descEl) descEl.innerText = goalPresets[currentPreset] ? goalPresets[currentPreset].desc : "โหมดกำหนดตัวเลขเอง (Custom)";

    document.getElementById('goal-cal-input').value = userGoals.calories;
    document.getElementById('goal-min-cal-input').value = userGoals.minCalories;
    document.getElementById('goal-prot-min-input').value = userGoals.proteinMin;
    document.getElementById('goal-prot-max-input').value = userGoals.proteinMax;
    document.getElementById('goal-carbs-input').value = userGoals.carbsMax || 150;
    document.getElementById('goal-fat-input').value = userGoals.fatMax || 50;
    document.getElementById('goal-steps-input').value = userGoals.steps;
    document.getElementById('goal-water-input').value = userGoals.water;
    document.getElementById('goal-weight-input').value = userGoals.targetWeight || '';

    const todayData = getDayData(currentDateKey);
    if (todayData.weight) {
        document.getElementById('bmr-weight').value = todayData.weight;
        calculateBMRandTDEE();
    }

    document.getElementById('github-token-input').value = localStorage.getItem('fitTracker_github_token') || '';
    document.getElementById('gemini-api-key-input').value = localStorage.getItem('fitTracker_gemini_key') || '';
    document.getElementById('settings-modal').classList.remove('hidden');
}

function hasLocalData() {
    const rawHistory = JSON.parse(localStorage.getItem('fitTracker_history') || '{}');
    const hasHistory = Object.keys(rawHistory).some((dateKey) => {
        const day = rawHistory[dateKey];
        if (!day) return false;
        const hasMeals = day.meals && Object.values(day.meals).some((arr) => Array.isArray(arr) && arr.length > 0);
        const hasWorkouts = Array.isArray(day.workouts) && day.workouts.length > 0;
        const hasMetrics = (Number(day.steps) > 0) || (Number(day.water) > 0) || (day.weight !== null && day.weight !== undefined && day.weight !== '');
        return hasMeals || hasWorkouts || hasMetrics;
    });

    const rawCatalog = JSON.parse(localStorage.getItem('fitTracker_catalog') || '[]');
    const hasCustomCatalog = Array.isArray(rawCatalog) && rawCatalog.length > 3;

    return hasHistory || hasCustomCatalog;
}

async function saveAllSettings() {
    const selectedPreset = document.getElementById('goal-preset-select').value || 'custom';
    const presetObj = goalPresets[selectedPreset];
    const isAutoWeight = Boolean(document.getElementById('goal-auto-weight-toggle')?.checked);

    const newMaxCal = Math.max(500, Number(document.getElementById('goal-cal-input').value) || 1500);
    const newMinCal = Math.max(500, Number(document.getElementById('goal-min-cal-input').value) || 1200);

    applyGoalChangeFromDate(currentDateKey, newMinCal, newMaxCal);

    userGoals = {
        ...userGoals,
        preset: selectedPreset,
        autoWeightMacro: isAutoWeight,
        calories: newMaxCal,
        minCalories: newMinCal,
        proteinMin: Math.max(10, Number(document.getElementById('goal-prot-min-input').value) || 96),
        proteinMax: Math.max(10, Number(document.getElementById('goal-prot-max-input').value) || 128),
        carbsMax: Math.max(10, Number(document.getElementById('goal-carbs-input').value) || 150),
        fatMax: Math.max(10, Number(document.getElementById('goal-fat-input').value) || 50),
        sugarMax: presetObj ? presetObj.sugarMax : (userGoals.sugarMax || 24),
        sodiumMax: presetObj ? presetObj.sodiumMax : (userGoals.sodiumMax || 2000),
        steps: Math.max(1000, Number(document.getElementById('goal-steps-input').value) || 10000),
        water: Math.max(500, Number(document.getElementById('goal-water-input').value) || 2000),
        targetWeight: parseFloat(document.getElementById('goal-weight-input').value) || null
    };

    localStorage.setItem('fitTracker_goals', JSON.stringify(userGoals));
    localStorage.setItem('fitTracker_history', JSON.stringify(allMealsHistory));
    localStorage.setItem('fitTracker_catalog', JSON.stringify(foodCatalog));

    const ghToken = (document.getElementById('github-token-input')?.value || '').trim();
    const geminiKey = (document.getElementById('gemini-api-key-input')?.value || '').trim();

    if (ghToken) localStorage.setItem('fitTracker_github_token', ghToken);
    else localStorage.removeItem('fitTracker_github_token');

    if (geminiKey) localStorage.setItem('fitTracker_gemini_key', geminiKey);
    else localStorage.removeItem('fitTracker_gemini_key');

    closeSettingsModal();
    renderActivePageUI();

    if (!ghToken) {
        setSyncStatus('local', 'บันทึกในเครื่อง');
        return;
    }

    // ถ้าในเครื่องยังไม่มีข้อมูลจริง -> ดึงจาก db.json ก่อน ไม่เอาค่าว่างไปทับ
    if (!hasLocalData()) {
        await downloadFromGitHub(true);
    } else {
        await pushToGitHub(false);
    }
}

function saveDataAndSync() {
    localStorage.setItem('fitTracker_history', JSON.stringify(allMealsHistory));
    localStorage.setItem('fitTracker_catalog', JSON.stringify(foodCatalog));
    localStorage.setItem('fitTracker_goals', JSON.stringify(userGoals));
    renderActivePageUI();

    // Auto push เฉพาะตอนที่ในเครื่องมีข้อมูลจริงแล้วเท่านั้น
    if (hasLocalData()) {
        pushToGitHub(false);
    } else {
        setSyncStatus('local', 'ยังไม่มีข้อมูลในเครื่อง (กด Download เพื่อดึง)');
    }
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.add('hidden');
}

function exportHistoryToCSV() {
    const sortedKeys = Object.keys(allMealsHistory).sort();
    if (sortedKeys.length === 0) return alert("ยังไม่มีข้อมูลสำหรับส่งออกครับ");

    const headers = ["วันที่", "แคลอรีรวม(kcal)", "เผาผลาญ(kcal)", "โปรตีน(g)", "คาร์บ(g)", "น้ำตาล(g)", "ไฟเบอร์(g)", "ไขมันรวม(g)", "ไขมันอิ่มตัว(g)", "โซเดียม(mg)", "น้ำดื่ม(ml)", "ก้าวเดิน", "น้ำหนัก(kg)"];
    let rows = [headers.join(",")];

    sortedKeys.forEach(key => {
        const d = allMealsHistory[key];
        if (!d) return;
        let cal = 0, prot = 0, carbs = 0, sugar = 0, fiber = 0, fat = 0, satFat = 0, sodium = 0;
        if (d.meals) {
            Object.values(d.meals).forEach(list => list.forEach(item => {
                cal += Number(item.calories || 0);
                prot += Number(item.protein || 0);
                carbs += Number(item.carbs || 0);
                sugar += Number(item.sugar || 0);
                fiber += Number(item.fiber || 0);
                fat += Number(item.fat || 0);
                satFat += Number(item.satFat || 0);
                sodium += Number(item.sodium || 0);
            }));
        }
        const { totalBurn } = getTotalBurned(d);
        rows.push([key, fmtPrecise(cal, 1), totalBurn, fmtPrecise(prot, 2), fmtPrecise(carbs, 2), fmtPrecise(sugar, 2), fmtPrecise(fiber, 2), fmtPrecise(fat, 2), fmtPrecise(satFat, 2), Math.round(sodium), d.water || 0, d.steps || 0, d.weight || ""].join(","));
    });

    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FitTracker_Export_${getFormattedDateKey(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ------------------------------------------
// Theme Switcher (Dark / Light Mode)
// ------------------------------------------
function applyAppTheme(theme) {
    const isLight = (theme === 'light');
    document.documentElement.classList.toggle('light-theme', isLight);

    const icon = document.getElementById('theme-toggle-icon');
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (icon) {
        icon.className = isLight
            ? 'fa-solid fa-moon text-xs text-indigo-500'
            : 'fa-solid fa-sun text-xs text-amber-300';
    }
    if (metaTheme) {
        metaTheme.setAttribute('content', isLight ? '#f1f5f9' : '#0f172a');
    }
}

function toggleAppTheme() {
    const current = localStorage.getItem('fitTracker_theme') || 'dark';
    const next = (current === 'dark') ? 'light' : 'dark';
    localStorage.setItem('fitTracker_theme', next);
    applyAppTheme(next);
}

// ==========================================================================
// gemini_chat.js — Private Chat Storage + Nutrition Parser + Meal Importer
// ==========================================================================

function getPrivateUserScopeId() {
    const ghToken = (localStorage.getItem('fitTracker_github_token') || '').trim();
    const gemKey = (localStorage.getItem('fitTracker_gemini_key') || '').trim();
    const seed = `${GITHUB_OWNER}:${GITHUB_REPO}:${ghToken.slice(-8)}:${gemKey.slice(-8)}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }
    return `private_u_${Math.abs(hash)}`;
}

function getCurrentChatDateKey() {
    if (typeof currentDateKey === 'string' && currentDateKey) return currentDateKey;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getPrivateChatStorageKey(dateKey = getCurrentChatDateKey()) {
    return `fitTracker_private_chat_${getPrivateUserScopeId()}_${dateKey}`;
}

function loadPrivateChatMessages() {
    const scopeId = getPrivateUserScopeId();
    const dateKey = getCurrentChatDateKey();
    const raw = JSON.parse(localStorage.getItem(getPrivateChatStorageKey(dateKey)) || '[]');

    privateChatMessages = Array.isArray(raw)
        ? raw.filter((m) => (!m.ownerId || m.ownerId === scopeId) && (!m.dateKey || m.dateKey === dateKey))
        : [];
    return privateChatMessages;
}

function savePrivateChatMessages() {
    const scopeId = getPrivateUserScopeId();
    const dateKey = getCurrentChatDateKey();
    const scoped = (privateChatMessages || [])
        .slice(-30)
        .map((m) => ({
            ...m,
            ownerId: scopeId,
            dateKey
        }));

    localStorage.setItem(getPrivateChatStorageKey(dateKey), JSON.stringify(scoped));

    if (typeof allMealsHistory === 'object' && allMealsHistory !== null) {
        const dayObj = getDayData(dateKey);
        if (!dayObj.privateChatByScope) dayObj.privateChatByScope = {};
        dayObj.privateChatByScope[scopeId] = scoped;
        localStorage.setItem('fitTracker_history', JSON.stringify(allMealsHistory));
    }
}

function parseNutritionFromText(rawText, fallbackName = "รายการจากแชท Gemini") {
    const text = String(rawText || '');
    const pick = (patterns) => {
        for (const re of patterns) {
            const m = text.match(re);
            if (m && m[1] !== undefined) return parseFloat(m[1]);
        }
        return null;
    };

    const calories = pick([/พลังงาน\s*[:：]?\s*(\d+(?:\.\d+)?)\s*kcal/i, /calories?\s*[:：]?\s*(\d+(?:\.\d+)?)/i]);
    const protein = pick([/โปรตีน\s*[:：]?\s*(\d+(?:\.\d+)?)\s*g/i, /protein\s*[:：]?\s*(\d+(?:\.\d+)?)/i]);
    const fat = pick([/ไขมันรวม\s*[:：]?\s*(\d+(?:\.\d+)?)\s*g/i, /ไขมัน\s*[:：]?\s*(\d+(?:\.\d+)?)\s*g/i, /fat\s*[:：]?\s*(\d+(?:\.\d+)?)/i]);
    const carbs = pick([/คาร์บ(?:คาร์โบไฮเดรต)?\s*[:：]?\s*(\d+(?:\.\d+)?)\s*g/i, /carbs?\s*[:：]?\s*(\d+(?:\.\d+)?)/i]);
    const sugar = pick([/น้ำตาล\s*[:：]?\s*(\d+(?:\.\d+)?)\s*g/i, /sugar\s*[:：]?\s*(\d+(?:\.\d+)?)/i]);
    const fiber = pick([/ไฟเบอร์|ใยอาหาร\s*[:：]?\s*(\d+(?:\.\d+)?)\s*g/i, /fiber\s*[:：]?\s*(\d+(?:\.\d+)?)/i]);
    const cholesterol = pick([/คอเลสเตอรอล\s*[:：]?\s*(\d+(?:\.\d+)?)\s*mg/i, /cholesterol\s*[:：]?\s*(\d+(?:\.\d+)?)/i]);
    const sodium = pick([/โซเดียม\s*[:：]?\s*(\d+(?:\.\d+)?)\s*mg/i, /sodium\s*[:：]?\s*(\d+(?:\.\d+)?)/i]);
    const potassium = pick([/โพแทสเซียม\s*[:：]?\s*(\d+(?:\.\d+)?)\s*mg/i, /potassium\s*[:：]?\s*(\d+(?:\.\d+)?)/i]);

    const hasAny = [calories, protein, fat, carbs, sugar, fiber, cholesterol, sodium, potassium].some(v => v !== null && !isNaN(v));
    if (!hasAny) return null;

    const firstLine = text.split('\n').map(s => s.trim()).find(s => s && !s.includes(':') && s.length < 60);
    return {
        name: firstLine || fallbackName,
        qty: 1,
        calories: fmtPrecise(calories || 0, 1),
        protein: fmtPrecise(protein || 0, 2),
        carbs: fmtPrecise(carbs || 0, 2),
        sugar: fmtPrecise(sugar || 0, 2),
        fiber: fmtPrecise(fiber || 0, 2),
        fat: fmtPrecise(fat || 0, 2),
        satFat: 0,
        transFat: 0,
        sodium: fmtPrecise(sodium || 0, 1),
        potassium: fmtPrecise(potassium || 0, 1),
        cholesterol: fmtPrecise(cholesterol || 0, 1)
    };
}

function importNutritionToMeal(msgIndex) {
    const msg = privateChatMessages[msgIndex];
    if (!msg || !msg.nutrition) return;

    const selectEl = document.getElementById('gemini-target-meal');
    const targetMeal = (selectEl && mealTypes.includes(selectEl.value))
        ? selectEl.value
        : ((typeof activeMealTab === 'string' && mealTypes.includes(activeMealTab)) ? activeMealTab : "มื้อเที่ยง");

    const dayData = getDayData(currentDateKey);
    dayData.meals[targetMeal].push({ ...msg.nutrition });
    saveDataAndSync();
    alert(`ดึง "${msg.nutrition.name}" เข้า "${targetMeal}" เรียบร้อยแล้วครับ`);
}

function toggleGeminiChatDrawer() {
    const drawer = document.getElementById('gemini-chat-drawer');
    if (!drawer) return;

    const willOpen = drawer.classList.contains('hidden');
    if (willOpen) {
        const apiKey = (localStorage.getItem('fitTracker_gemini_key') || '').trim();
        if (!apiKey) {
            alert("กรุณาใส่ Gemini API Key ส่วนตัวในหน้าตั้งค่า (⚙️) ก่อนใช้งานแชทครับ");
            openSettingsModal();
            return;
        }
        const mealSel = document.getElementById('gemini-target-meal');
        if (mealSel && typeof activeMealTab === 'string' && mealTypes.includes(activeMealTab)) {
            mealSel.value = activeMealTab;
        }
        renderPrivateGeminiChat();
    }
    drawer.classList.toggle('hidden');
}

function clearPrivateGeminiChat() {
    if (!confirm("ต้องการลบประวัติแชทส่วนตัวในเครื่องนี้ใช่ไหม?")) return;
    privateChatMessages = [];
    localStorage.removeItem(getPrivateChatStorageKey());
    renderPrivateGeminiChat();
}

async function sendGeminiChatMessage(e) {
    e.preventDefault();
    const input = document.getElementById('gemini-chat-input');
    if (!input) return;

    if (typeof isPreparingGeminiChatImage !== 'undefined' && isPreparingGeminiChatImage) {
        alert("กำลังเตรียมรูป รอสักครู่แล้วค่อยกดส่งครับ");
        return;
    }

    const text = input.value.trim();
    const imageToSend = (typeof pendingGeminiChatImageBase64 !== 'undefined' && pendingGeminiChatImageBase64)
        ? pendingGeminiChatImageBase64
        : null;

    if (!text && !imageToSend) return;

    const apiKey = (localStorage.getItem('fitTracker_gemini_key') || '').trim();
    if (!apiKey) {
        alert("ไม่พบ Gemini API Key ส่วนตัว กรุณาตั้งค่าที่ปุ่ม ⚙️ ก่อนครับ");
        if (typeof openSettingsModal === 'function') openSettingsModal();
        return;
    }

    const messageLabel = text || "วิเคราะห์รูปที่แนบนี้";

    loadPrivateChatMessages();

    let uploadedChatImagePath = null;
    if (imageToSend && typeof uploadImageToGitHubFolder === 'function') {
        uploadedChatImagePath = await uploadImageToGitHubFolder('images/ai-chat', 'chat', imageToSend);
    }

    const userParsed = parseNutritionFromText(text, text ? text.slice(0, 32) : "รายการจากรูปในแชท");
    privateChatMessages.push({
        role: 'user',
        text: messageLabel,
        imageBase64: imageToSend,
        imagePath: uploadedChatImagePath,
        nutrition: userParsed,
        at: new Date().toISOString()
    });
    savePrivateChatMessages();

    input.value = '';
    if (typeof clearGeminiChatPendingImage === 'function') clearGeminiChatPendingImage();
    renderPrivateGeminiChat();

    let modelName = 'gemini-2.5-flash';

    try {
        if (typeof resolveWorkingGeminiModel === 'function') {
            const resolved = await resolveWorkingGeminiModel(apiKey);
            if (resolved && typeof resolved === 'string') {
                modelName = resolved.trim();
            }
        }

        const activeDateKey = (typeof currentDateKey === 'string' && currentDateKey)
            ? currentDateKey
            : getCurrentChatDateKey();
        const activeDateText = (typeof formatDisplayDate === 'function')
            ? formatDisplayDate(activeDateKey)
            : activeDateKey;

        const prompt = `คุณเป็นผู้ช่วยโภชนาการไทย ตอบกระชับ ชัดเจน
                        วันที่ในระบบปัจจุบันคือ: ${activeDateText} (${activeDateKey})
                        
                        หากมีการประเมินสารอาหารของเมนู ให้ระบุบรรทัดตัวเลขชัดเจนด้วยรูปแบบ:
                        พลังงาน: ... kcal
                        โปรตีน: ... g
                        ไขมันรวม: ... g
                        คาร์บ: ... g
                        น้ำตาล: ... g
                        ไฟเบอร์: ... g
                        คอเลสเตอรอล: ... mg
                        โซเดียม: ... mg
                        
                        ข้อความผู้ใช้: ${messageLabel}`;

        const parts = [{ text: prompt }];
        if (imageToSend) {
            parts.push({
                inline_data: {
                    mime_type: "image/jpeg",
                    data: imageToSend
                }
            });
        }

        if (typeof callGeminiWithModelFallback !== 'function') {
            throw new Error("ไม่พบฟังก์ชัน callGeminiWithModelFallback ใน foodtrack.js");
        }

        const { data } = await callGeminiWithModelFallback(apiKey, {
            contents: [{ parts }]
        });

        const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'ไม่ได้รับคำตอบจาก Gemini';
        const fallbackTitle = text ? text.slice(0, 32) : "รายการจากรูปในแชท";
        privateChatMessages.push({
            role: 'assistant',
            text: replyText,
            nutrition: parseNutritionFromText(replyText, fallbackTitle),
            at: new Date().toISOString()
        });
        savePrivateChatMessages();
        renderPrivateGeminiChat();
    } catch (err) {
        privateChatMessages.push({
            role: 'assistant',
            text: `ส่งข้อความไม่สำเร็จ: ${err.message}`,
            nutrition: null,
            at: new Date().toISOString()
        });
        savePrivateChatMessages();
        renderPrivateGeminiChat();
    }
}

function attachGeminiChatPasteImageSupport() {
    const drawer = document.getElementById('gemini-chat-drawer');
    if (!drawer || drawer.dataset.pasteBound === 'true') return;

    drawer.addEventListener('paste', async (e) => {
        const items = e.clipboardData?.items;
        if (!items || !items.length) return;

        for (const item of items) {
            if (item.type && item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                if (!blob) continue;

                e.preventDefault();
                const ext = (item.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
                const pastedFile = new File([blob], `pasted_${Date.now()}.${ext}`, { type: item.type });

                if (typeof handleGeminiChatImageSelected === 'function') {
                    await handleGeminiChatImageSelected({
                        target: { files: [pastedFile], value: '' }
                    });
                }
                break;
            }
        }
    });

    drawer.dataset.pasteBound = 'true';
}

document.addEventListener('DOMContentLoaded', attachGeminiChatPasteImageSupport);

async function hydrateGeminiChatImage(msgIndex, imgPath) {
    if (!imgPath) return;
    if (typeof photoBlobCache !== 'undefined' && photoBlobCache[imgPath]) {
        const el = document.getElementById(`chat-img-${msgIndex}`);
        if (el) el.src = photoBlobCache[imgPath];
        return;
    }

    const token = (localStorage.getItem('fitTracker_github_token') || '').trim();
    if (!token || typeof GITHUB_OWNER === 'undefined' || typeof GITHUB_REPO === 'undefined') return;

    try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${imgPath}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json'
            }
        });
        if (!res.ok) return;
        const data = await res.json();
        const dataUrl = `data:image/jpeg;base64,${String(data.content || '').replace(/\s+/g, '')}`;
        if (typeof photoBlobCache !== 'undefined') photoBlobCache[imgPath] = dataUrl;
        const el = document.getElementById(`chat-img-${msgIndex}`);
        if (el) el.src = dataUrl;
    } catch (_) {}
}

function renderPrivateGeminiChat() {
    const box = document.getElementById('gemini-chat-messages');
    const ownerLabel = document.getElementById('gemini-chat-owner-label');
    if (!box) return;

    if (ownerLabel) {
        ownerLabel.textContent = `ห้องส่วนตัว (${getPrivateUserScopeId()}) • แยกสิทธิ์เฉพาะผู้ใช้`;
    }

    loadPrivateChatMessages();
    if (privateChatMessages.length === 0) {
        box.innerHTML = `<div class="text-center text-slate-400 py-6 text-[11px]">พิมพ์ถามเมนู หรือวางข้อความสรุปสารอาหารจากแชทที่นี่ แล้วกดปุ่มดึงเข้ามื้ออาหารได้เลยครับ</div>`;
        return;
    }

    box.innerHTML = privateChatMessages.map((m, idx) => {
        const isUser = m.role === 'user';
        const imgSrc = m.imageBase64
            ? `data:image/jpeg;base64,${m.imageBase64}`
            : (m.imagePath && typeof photoBlobCache !== 'undefined' && photoBlobCache[m.imagePath] ? photoBlobCache[m.imagePath] : '');

        const attachedImgHtml = (m.imageBase64 || m.imagePath)
            ? `<img id="chat-img-${idx}" src="${imgSrc}" alt="รูปแชท" class="mt-1.5 max-h-44 rounded-xl object-contain border border-white/20" />`
            : '';

        const nutriCard = m.nutrition ? `
            <div class="mt-2 bg-slate-950/90 border border-emerald-500/40 rounded-xl p-2 space-y-1.5">
                <div class="font-bold text-emerald-300 text-[11px]">${m.nutrition.name}</div>
                <div class="text-[10px] text-slate-300">
                    ${m.nutrition.calories} kcal • P ${m.nutrition.protein}g • C ${m.nutrition.carbs}g • F ${m.nutrition.fat}g • Na ${m.nutrition.sodium}mg • Chol ${m.nutrition.cholesterol}mg
                </div>
                <button type="button" onclick="importNutritionToMeal(${idx})"
                    class="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold py-1.5 rounded-lg">
                    <i class="fa-solid fa-file-import mr-1"></i> ดึงสารอาหารเข้ามื้อที่เลือก
                </button>
            </div>
        ` : '';

        return `
            <div class="flex ${isUser ? 'justify-end' : 'justify-start'}">
                <div class="max-w-[88%] rounded-2xl px-3 py-2 ${isUser ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-100 border border-slate-700'}">
                    <div class="whitespace-pre-line leading-relaxed">${m.text}</div>
                    ${attachedImgHtml}
                    ${nutriCard}
                </div>
            </div>
        `;
    }).join('');

    privateChatMessages.forEach((m, idx) => {
        if (!m.imageBase64 && m.imagePath) {
            hydrateGeminiChatImage(idx, m.imagePath);
        }
    });

    box.scrollTop = box.scrollHeight;
}

function openDateCalendarPicker() {
    const picker = document.getElementById('header-date-picker');
    if (!picker) return;
    if (typeof currentDateKey === 'string' && currentDateKey) {
        picker.value = currentDateKey;
    }
    try {
        if (typeof picker.showPicker === 'function') {
            picker.showPicker();
        } else {
            picker.click();
        }
    } catch (_) {
        picker.click();
    }
}

function onCalendarDatePicked(pickedDateKey) {
    if (!pickedDateKey || typeof pickedDateKey !== 'string') return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pickedDateKey)) return;
    currentDateKey = pickedDateKey;
    if (typeof hideMacroTip === 'function') hideMacroTip();
    renderActivePageUI();
}

applyAppTheme(localStorage.getItem('fitTracker_theme') || 'dark');

// ------------------------------------------
// 8. Initialize App on Load
// ------------------------------------------
window.addEventListener('DOMContentLoaded', async () => {
    await loadPageModule('foodtrack');
    await downloadFromGitHub(true);
});
