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
// State Management, Programs & Flexible Goals
// ==========================================
let currentDateKey = getFormattedDateKey(new Date());
let currentScanMode = 'label';
let html5QrCode = null;
let baseNutrition = null;
let activeMacroTip = null;
let currentReportDays = 7;

let pendingFoodPhotoBase64 = null;
let currentFoodPhotoPath = null;
let photoBlobCache = {};

let calendarViewYear = new Date().getFullYear();
let calendarViewMonth = new Date().getMonth();
let calendarSelectedKey = currentDateKey;

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
        setSyncStatus('local', 'บันทึกในเครื่อง');
        if (showAlert) alert("ยังไม่ได้ตั้งค่า GitHub Token ครับ");
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

        if (res.status === 404) {
            setSyncStatus('local', 'ยังไม่มีไฟล์ db.json');
            return;
        }
        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        currentFileSha = data.sha;

        const decodedText = base64ToUtf8(data.content);
        const remoteDb = JSON.parse(decodedText);

        if (remoteDb.goals) {
            userGoals = { ...userGoals, ...remoteDb.goals };
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
            skincareItems = remoteDb.skincareItems;
            localStorage.setItem('fitTracker_skincare_items', JSON.stringify(skincareItems));
        }
        if (remoteDb.skincareLogs && typeof remoteDb.skincareLogs === 'object') {
            skincareLogs = remoteDb.skincareLogs;
            localStorage.setItem('fitTracker_skincare_logs', JSON.stringify(skincareLogs));
        }
        if (remoteDb.skincarePhotosMap && typeof remoteDb.skincarePhotosMap === 'object') {
            skincarePhotosMap = remoteDb.skincarePhotosMap;
            localStorage.setItem('fitTracker_skincare_photos', JSON.stringify(skincarePhotosMap));
        }
        if (remoteDb.exercisePhotosMap && typeof remoteDb.exercisePhotosMap === 'object') {
            exercisePhotosMap = remoteDb.exercisePhotosMap;
            localStorage.setItem('fitTracker_exercise_photos', JSON.stringify(exercisePhotosMap));
        }

        if (typeof renderAllUI === 'function') {
            renderAllUI();
        } else {
            if (typeof renderDashboard === 'function') renderDashboard();
            if (typeof renderChart === 'function') renderChart();
            if (typeof renderMeals === 'function') renderMeals();
            if (typeof renderSkincareContent === 'function') renderSkincareContent();
        }
        
        setSyncStatus('synced', 'ซิงก์ GitHub แล้ว');
        if (showAlert) alert("ดึงข้อมูลจาก GitHub สำเร็จแล้ว!");
    } catch (err) {
        console.error(err);
        setSyncStatus('error', 'ดึงข้อมูลไม่สำเร็จ');
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

    const fetchLatestSha = async () => {
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
    };

    try {
        if (!currentFileSha) {
            await fetchLatestSha();
        }

        const payload = {
            updatedAt: new Date().toISOString(),
            goals: userGoals,
            history: allMealsHistory,
            catalog: foodCatalog,
            skincareItems: skincareItems,
            skincareLogs: skincareLogs,
            skincarePhotosMap: skincarePhotosMap,
            exercisePhotosMap: exercisePhotosMap
        };
        const contentBase64 = utf8ToBase64(JSON.stringify(payload, null, 2));
        const putUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`;

        const sendPut = async () => fetch(putUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update FitTracker DB (${currentDateKey})`,
                content: contentBase64,
                sha: currentFileSha || undefined
            })
        });

        let putRes = await sendPut();
        if (putRes.status === 409) {
            await fetchLatestSha();
            putRes = await sendPut();
        }

        if (!putRes.ok) {
            const errJson = await putRes.json().catch(() => ({}));
            throw new Error(errJson.message || `HTTP ${putRes.status}`);
        }

        const putData = await putRes.json();
        currentFileSha = putData.content?.sha || currentFileSha;
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
// Food Photo Reference Helpers (GitHub images/ folder)
// ==========================================
function triggerFoodPhotoUpload() {
    const input = document.getElementById('food-photo-input');
    input.value = '';
    input.click();
}

async function handleFoodPhotoSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    await setPreviewFromFile(file);
}

async function setPreviewFromFile(file) {
    const base64 = await resizeImageToBase64(file, 500);
    pendingFoodPhotoBase64 = base64;
    currentFoodPhotoPath = null;

    const previewImg = document.getElementById('food-photo-preview');
    const previewWrap = document.getElementById('food-photo-preview-wrap');
    const removeBtn = document.getElementById('remove-food-photo-btn');
    const statusEl = document.getElementById('food-photo-status');

    previewImg.src = `data:image/jpeg;base64,${base64}`;
    previewWrap.classList.remove('hidden');
    removeBtn.classList.remove('hidden');
    statusEl.innerText = "พร้อมอัปโหลดขึ้น Cloud เมื่อกดบันทึก";
}

function removeFoodPhoto() {
    pendingFoodPhotoBase64 = null;
    currentFoodPhotoPath = null;
    document.getElementById('food-photo-preview').src = '';
    document.getElementById('food-photo-preview-wrap').classList.add('hidden');
    document.getElementById('remove-food-photo-btn').classList.add('hidden');
}

async function loadFoodPhotoPreview(photoPath) {
    const previewImg = document.getElementById('food-photo-preview');
    const previewWrap = document.getElementById('food-photo-preview-wrap');
    const removeBtn = document.getElementById('remove-food-photo-btn');
    const statusEl = document.getElementById('food-photo-status');

    if (!photoPath) {
        removeFoodPhoto();
        return;
    }

    currentFoodPhotoPath = photoPath;
    pendingFoodPhotoBase64 = null;
    previewWrap.classList.remove('hidden');
    removeBtn.classList.remove('hidden');

    if (photoBlobCache[photoPath]) {
        previewImg.src = photoBlobCache[photoPath];
        statusEl.innerText = "รูปอ้างอิงที่บันทึกไว้";
        return;
    }

    const token = localStorage.getItem('fitTracker_github_token');
    if (!token) {
        statusEl.innerText = "ต้องเชื่อมต่อ GitHub Token เพื่อโหลดรูปจาก Cloud";
        return;
    }

    statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังโหลดรูปอ้างอิง...';
    try {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${photoPath}`;
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json'
            }
        });
        if (!res.ok) throw new Error("ไม่พบไฟล์รูป");
        const data = await res.json();
        const dataUrl = `data:image/jpeg;base64,${data.content.replace(/\s/g, '')}`;
        photoBlobCache[photoPath] = dataUrl;
        previewImg.src = dataUrl;
        statusEl.innerText = "รูปอ้างอิงที่บันทึกไว้";
    } catch (e) {
        statusEl.innerText = "ไม่สามารถโหลดรูปได้";
    }
}

async function uploadPhotoToGitHub(base64Content) {
    const token = localStorage.getItem('fitTracker_github_token');
    if (!token) return null;

    const fileName = `images/food_${Date.now()}.jpg`;
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
                message: `Upload food photo ${fileName}`,
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

// ==========================================
// Core App Initialization & UI Rendering
// ==========================================
function renderUIOnly() {
    const isDashboardPage = Boolean(document.getElementById('meals-list') || document.getElementById('weekly-chart'));
    const isCoursePage = Boolean(document.getElementById('course-content-container'));

    if (isDashboardPage) {
        if (typeof renderWeeklyChart === 'function') renderWeeklyChart();
        if (typeof renderDateDisplay === 'function') renderDateDisplay();
        if (typeof renderBurnModeCard === 'function') renderBurnModeCard();
        if (typeof renderMeals === 'function') renderMeals();
        if (typeof renderWaterAndWeight === 'function') renderWaterAndWeight();
        if (typeof renderActivity === 'function') renderActivity();
        if (typeof renderSummary === 'function') renderSummary();
        if (typeof renderNutritionCoach === 'function') renderNutritionCoach();
    }

    if (typeof updateCatalogDatalist === 'function') {
        updateCatalogDatalist();
    }

    if (isCoursePage && typeof renderWorkoutCourseContent === 'function') {
        renderWorkoutCourseContent();
    }
}

async function initApp() {
    renderUIOnly();
    await syncFromGitHub(false);
}

function renderDateDisplay() {
    const displayDateEl = document.getElementById('display-date');
    const currentBadgeEl = document.getElementById('current-date-badge');
    const futureBadge = document.getElementById('future-plan-badge');

    // ถ้าไม่มี Element เหล่านี้ (เช่น เปิดจากหน้า course.html) ให้ข้ามการทำงานส่วนนี้ไปเลย
    if (!displayDateEl || !currentBadgeEl) return;

    displayDateEl.innerText = formatDisplayDate(currentDateKey);
    const todayKey = getFormattedDateKey(new Date());
    currentBadgeEl.innerText = (currentDateKey === todayKey) ? 'วันนี้' : currentDateKey;

    if (futureBadge) {
        if (currentDateKey > todayKey) {
            futureBadge.classList.remove('hidden');
        } else {
            futureBadge.classList.add('hidden');
        }
    }
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

function getNextDateKey(dateKey) {
    const parts = dateKey.split('-');
    let d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + 1);
    return getFormattedDateKey(d);
}

function cloneCurrentDayToTomorrow() {
    const dayData = getDayData(currentDateKey);
    const totalItems = Object.values(dayData.meals).reduce((sum, list) => sum + list.length, 0);
    if (totalItems === 0) return;

    const nextKey = getNextDateKey(currentDateKey);
    if (!confirm(`ต้องการคัดลอกรายการอาหารทั้ง ${totalItems} รายการของวันนี้ ไปวางเป็นแผนล่วงหน้าในวันที่ ${formatDisplayDate(nextKey)} ใช่ไหม?`)) {
        return;
    }

    const nextDayData = getDayData(nextKey);
    mealTypes.forEach(type => {
        const cloned = JSON.parse(JSON.stringify(dayData.meals[type] || []));
        nextDayData.meals[type].push(...cloned);
    });

    currentDateKey = nextKey;
    saveDataAndSync();
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

// ==========================================
// Daily Min-Max Calorie Target Snapshot (เก็บประวัติเป้า Min-Max แยกรายวัน)
// ==========================================
function getDayCalorieGoals(dateKey) {
    const dayObj = allMealsHistory[dateKey];
    const fallbackMax = Number(userGoals.calories) || 1500;
    const fallbackMin = Number(userGoals.minCalories) || 1200;

    // 1. ถ้าวันนั้นเคยบันทึกเป้า Min-Max เฉพาะวันไว้แล้ว ให้ใช้ค่านั้นเลย (วันเก่าจะไม่แดง)
    if (dayObj && dayObj.targetMax !== undefined && dayObj.targetMax !== null) {
        return {
            min: Number(dayObj.targetMin ?? fallbackMin),
            max: Number(dayObj.targetMax)
        };
    }

    // 2. สำหรับข้อมูลเก่าในอดีตที่เคยบันทึกอาหารไว้ก่อนมีระบบนี้ ให้ล็อกเป้ามาตรฐานเดิม (1,200 - 1,500)
    const todayKey = getFormattedDateKey(new Date());
    if (dateKey < todayKey && dayObj && dayObj.meals && Object.values(dayObj.meals).some(l => l.length > 0)) {
        return { min: 1200, max: 1500 };
    }

    // 3. วันปัจจุบันหรือวันในอนาคตที่ยังไม่ล็อกเป้า ให้ดึงจาก userGoals ล่าสุด
    return { min: fallbackMin, max: fallbackMax };
}

function editCurrentDayCalorieRange() {
    const cur = getDayCalorieGoals(currentDateKey);
    const inputMin = prompt(`กำหนด "แคลอรีขั้นต่ำ (Min)" สำหรับวันที่ ${formatDisplayDate(currentDateKey)}:`, cur.min);
    if (inputMin === null) return;

    const inputMax = prompt(`กำหนด "แคลอรีสูงสุด (Max)" สำหรับวันที่ ${formatDisplayDate(currentDateKey)}:`, cur.max);
    if (inputMax === null) return;

    const newMin = Math.max(500, Number(inputMin) || cur.min);
    const newMax = Math.max(newMin, Number(inputMax) || cur.max);

    const dayData = getDayData(currentDateKey);
    dayData.targetMin = newMin;
    dayData.targetMax = newMax;

    saveDataAndSync();
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
        minFloor,
        yOver,
        safeTarget,
        actualDeducted,
        uncompensatedBurn
    };
}

function getNutrientAdjustments(dateKey) {
    const baseTargetCal = Number(userGoals.calories) || 1500;
    const targetCarbs = Number(userGoals.carbsMax) || Math.round((baseTargetCal * 0.50) / 4);
    const targetFat = Number(userGoals.fatMax) || Math.round((baseTargetCal * 0.30) / 9);
    const targetSugar = Number(userGoals.sugarMax) || 24;
    const targetSodium = Number(userGoals.sodiumMax) || 2000;

    const baseLimits = {
        carbs: { label: "คาร์บ", max: targetCarbs, floor: Math.min(25, Math.round(targetCarbs * 0.6)), unit: "g", dec: 1 },
        sugar: { label: "น้ำตาล", max: targetSugar, floor: 6, unit: "g", dec: 1 },
        fat: { label: "ไขมันรวม", max: targetFat, floor: Math.round(targetFat * 0.6), unit: "g", dec: 1 },
        satFat: { label: "ไขมันอิ่มตัว", max: 16, floor: 5, unit: "g", dec: 1 },
        transFat: { label: "ไขมันทรานส์", max: 0, floor: 0, unit: "g", dec: 1 },
        sodium: { label: "โซเดียม", max: targetSodium, floor: 1000, unit: "mg", dec: 0 },
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
// Weekly Calorie Chart (7 วัน + เส้นขั้นบันได Min-Max แยกรายวัน)
// ==========================================
function renderWeeklyChart() {
    const container = document.getElementById('weekly-chart-container');
    if (!container) return;

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
        let dGoals = getDayCalorieGoals(key);

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

        const effectiveLimit = dGoals.max + totalBurn;
        if (totalCal > maxVal) maxVal = totalCal;
        if (dGoals.max + 500 > maxVal) maxVal = dGoals.max + 500;

        daysData.push({
            key,
            label: dayNames[d.getDay()],
            dayNum: d.getDate(),
            cal: totalCal,
            limit: effectiveLimit,
            goalMax: dGoals.max,
            goalMin: dGoals.min,
            isSelected: key === currentDateKey
        });
    }

    // สร้างเส้น SVG แบบขั้นบันได (Step Line) ตามเป้า Min-Max ของแต่ละวัน
    const colW = 100 / 7;
    let maxStepPoints = [];
    let minStepPoints = [];
    let stepBadgesHtml = '';

    daysData.forEach((d, idx) => {
        const x1 = (idx * colW).toFixed(2);
        const x2 = ((idx + 1) * colW).toFixed(2);
        const yMax = (100 - Math.min(100, (d.goalMax / maxVal) * 100)).toFixed(2);
        const yMin = (100 - Math.min(100, (d.goalMin / maxVal) * 100)).toFixed(2);

        maxStepPoints.push(`${x1},${yMax} ${x2},${yMax}`);
        minStepPoints.push(`${x1},${yMin} ${x2},${yMin}`);

        // แสดงป้ายตัวเลขกำกับตรงวันแรก หรือวันที่เส้นมีการหักขึ้น/หักลง
        const prev = idx > 0 ? daysData[idx - 1] : null;
        if (!prev || prev.goalMax !== d.goalMax) {
            const bottomPct = Math.min(100, (d.goalMax / maxVal) * 100);
            const isLast = idx === daysData.length - 1;
            const posStyle = isLast ? 'right: 0;' : `left: ${(idx * colW).toFixed(1)}%;`;
            stepBadgesHtml += `
                <span class="absolute text-[9px] bg-slate-900/95 text-amber-400 px-1 rounded font-semibold border border-amber-500/30 z-30 pointer-events-none"
                      style="${posStyle} bottom: calc(${bottomPct}% + 3px);">
                    ${d.goalMax.toLocaleString()}
                </span>
            `;
        }
        if (!prev || prev.goalMin !== d.goalMin) {
            const bottomPct = Math.min(100, (d.goalMin / maxVal) * 100);
            const isLast = idx === daysData.length - 1;
            const posStyle = isLast ? 'right: 0;' : `left: ${(idx * colW).toFixed(1)}%;`;
            stepBadgesHtml += `
                <span class="absolute text-[9px] bg-slate-900/95 text-cyan-400 px-1 rounded font-semibold border border-cyan-500/30 z-30 pointer-events-none"
                      style="${posStyle} bottom: calc(${bottomPct}% - 14px);">
                    ${d.goalMin.toLocaleString()}
                </span>
            `;
        }
    });

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
            <!-- เลเยอร์เส้นประขั้นบันไดสูงเท่ากับแท่งกราฟ (96px) -->
            <div class="absolute left-0 right-0 h-24 pointer-events-none z-20" style="bottom: 30px;">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-full overflow-visible">
                    <polyline fill="none" stroke="#fbbf24" stroke-width="1.3" stroke-dasharray="2.5,2"
                              vector-effect="non-scaling-stroke" points="${maxStepPoints.join(' ')}" />
                    <polyline fill="none" stroke="#22d3ee" stroke-width="1.2" stroke-dasharray="2.5,2"
                              vector-effect="non-scaling-stroke" points="${minStepPoints.join(' ')}" />
                </svg>
                ${stepBadgesHtml}
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
// Meals Rendering, Copy Yesterday & Save Meal Combo
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

function saveMealAsCombo(mealType) {
    const dayData = getDayData(currentDateKey);
    const items = dayData.meals[mealType] || [];
    if (items.length < 2) {
        alert("ต้องมีรายการอาหารอย่างน้อย 2 อย่างในมื้อนี้ถึงจะรวมเป็นเซตได้ครับ");
        return;
    }

    const defaultName = `เซต${mealType} (${items.map(i => i.name.split('(')[0].trim()).join(' + ')})`;
    const comboName = prompt("ตั้งชื่อเซตอาหารรวมชุด (จะถูกบันทึกเข้าคลังเมนูเพื่อกดเลือกครั้งหน้า):", defaultName);
    if (!comboName || !comboName.trim()) return;

    const sumField = (field) => items.reduce((s, i) => s + Number(i[field] || 0), 0);
    const round1 = (v) => Math.round(v * 10) / 10;

    const comboItem = {
        name: comboName.trim(),
        photo: items.find(i => i.photo)?.photo || null,
        calories: Math.round(sumField('calories')),
        protein: round1(sumField('protein')),
        carbs: round1(sumField('carbs')),
        sugar: round1(sumField('sugar')),
        fiber: round1(sumField('fiber')),
        fat: round1(sumField('fat')),
        satFat: round1(sumField('satFat')),
        transFat: round1(sumField('transFat')),
        sodium: Math.round(sumField('sodium')),
        potassium: Math.round(sumField('potassium')),
        cholesterol: Math.round(sumField('cholesterol'))
    };

    const existingIdx = foodCatalog.findIndex(f => f.name.toLowerCase() === comboItem.name.toLowerCase());
    if (existingIdx === -1) {
        foodCatalog.push(comboItem);
    } else {
        foodCatalog[existingIdx] = comboItem;
    }

    saveDataAndSync();
    alert(`บันทึก "${comboItem.name}" (${comboItem.calories} kcal, โปรตีน ${comboItem.protein}g) เข้าคลังเมนูเรียบร้อยแล้ว!`);
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
            ? `<button type="button" onclick="copyMealFromYesterday('${mealType}')" title="ดึงรายการมื้อนี้จากเมื่อวาน" class="text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-300 px-2 py-0.5 rounded-lg border border-slate-700 transition">
                   <i class="fa-regular fa-copy"></i> เมื่อวาน
               </button>`
            : '';

        const comboBtnHtml = items.length >= 2
            ? `<button type="button" onclick="saveMealAsCombo('${mealType}')" title="มัดรวมรายการในมื้อนี้เป็นเซตเดียวเข้าคลัง" class="text-[10px] bg-slate-800 hover:bg-slate-700 text-teal-300 px-2 py-0.5 rounded-lg border border-slate-700 transition">
                   <i class="fa-solid fa-layer-group"></i> รวมเซต
               </button>`
            : '';

        let itemsHtml = items.map((item, idx) => {
            const qtyDisplay = item.qty ? (isNaN(item.qty) ? item.qty : `x${item.qty}`) : '';
            return `
            <div class="flex justify-between items-center py-2 border-b border-slate-800/40 last:border-none text-sm">
                <div>
                    <span class="text-white font-medium">${item.name}</span>
                    ${item.photo ? `<i class="fa-regular fa-image text-sky-400 text-[11px] ml-1" title="มีรูปอ้างอิง (กดรูปดินสอเพื่อดู)"></i>` : ''}
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
            <div class="flex justify-between items-center border-b border-slate-800/80 pb-2.5 gap-1.5">
                <div class="flex items-center space-x-1.5 flex-wrap gap-y-1">
                    <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    <h4 class="font-semibold text-white text-sm">${mealType}</h4>
                    ${copyBtnHtml}
                    ${comboBtnHtml}
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
// Copy Daily Summary Text for Chat/LINE
// ==========================================
function copyDailySummaryText() {
    const dayData = getDayData(currentDateKey);
    let totalCal = 0, totalProt = 0, totalCarbs = 0, totalFat = 0, totalSugar = 0, totalSodium = 0;

    Object.values(dayData.meals).forEach(mealList => {
        mealList.forEach(item => {
            totalCal += Number(item.calories || 0);
            totalProt += Number(item.protein || 0);
            totalCarbs += Number(item.carbs || 0);
            totalFat += Number(item.fat || 0);
            totalSugar += Number(item.sugar || 0);
            totalSodium += Number(item.sodium || 0);
        });
    });

    const { totalBurn } = getTotalBurned(dayData);
    const adj = getCalorieAdjustment(currentDateKey);
    const protMin = Number(userGoals.proteinMin) || 96;

    const text = [
        `📊 สรุป FitTracker (${formatDisplayDate(currentDateKey)})`,
        `🔥 พลังงาน: ${totalCal} / ${adj.safeTarget} kcal (เผาผลาญ ${totalBurn} kcal)`,
        `🥩 โปรตีน: ${totalProt.toFixed(1)} / ${protMin}g | คาร์บ: ${totalCarbs.toFixed(1)}g | ไขมัน: ${totalFat.toFixed(1)}g`,
        `🍬 น้ำตาล: ${totalSugar.toFixed(1)}g | 🧂 โซเดียม: ${Math.round(totalSodium)}mg`,
        `💧 น้ำดื่ม: ${dayData.water || 0} ml | 👟 ก้าวเดิน: ${(dayData.steps || 0).toLocaleString()} ก้าว` + (dayData.weight ? ` | ⚖️ นน.: ${dayData.weight} kg` : '')
    ].join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            alert("คัดลอกข้อความสรุปประจำวันเรียบร้อยแล้ว! สามารถนำไปวางส่งในแชทได้ทันทีครับ");
        }).catch(() => {
            prompt("คัดลอกข้อความด้านล่างนี้:", text);
        });
    } else {
        prompt("คัดลอกข้อความด้านล่างนี้:", text);
    }
}

// ==========================================
// Export All History to CSV (Excel)
// ==========================================
function exportHistoryToCSV() {
    const sortedKeys = Object.keys(allMealsHistory).sort();
    if (sortedKeys.length === 0) {
        alert("ยังไม่มีข้อมูลสำหรับส่งออกครับ");
        return;
    }

    const headers = [
        "วันที่", "แคลอรีรวม(kcal)", "เผาผลาญ(kcal)", "โปรตีน(g)", "คาร์บ(g)",
        "น้ำตาล(g)", "ไฟเบอร์(g)", "ไขมันรวม(g)", "ไขมันอิ่มตัว(g)", "ไขมันทรานส์(g)",
        "โซเดียม(mg)", "โพแทสเซียม(mg)", "คอเลสเตอรอล(mg)", "น้ำดื่ม(ml)", "ก้าวเดิน", "น้ำหนัก(kg)"
    ];

    let rows = [headers.join(",")];

    sortedKeys.forEach(key => {
        const d = allMealsHistory[key];
        if (!d) return;
        let cal = 0, prot = 0, carbs = 0, sugar = 0, fiber = 0, fat = 0, satFat = 0, transFat = 0, sodium = 0, potas = 0, chol = 0;

        if (d.meals) {
            Object.values(d.meals).forEach(list => {
                list.forEach(item => {
                    cal += Number(item.calories || 0);
                    prot += Number(item.protein || 0);
                    carbs += Number(item.carbs || 0);
                    sugar += Number(item.sugar || 0);
                    fiber += Number(item.fiber || 0);
                    fat += Number(item.fat || 0);
                    satFat += Number(item.satFat || 0);
                    transFat += Number(item.transFat || 0);
                    sodium += Number(item.sodium || 0);
                    potas += Number(item.potassium || 0);
                    chol += Number(item.cholesterol || 0);
                });
            });
        }
        const { totalBurn } = getTotalBurned(d);
        rows.push([
            key, cal, totalBurn, prot.toFixed(1), carbs.toFixed(1),
            sugar.toFixed(1), fiber.toFixed(1), fat.toFixed(1), satFat.toFixed(1), transFat.toFixed(1),
            Math.round(sodium), Math.round(potas), Math.round(chol),
            d.water || 0, d.steps || 0, d.weight || ""
        ].join(","));
    });

    const csvContent = "\uFEFF" + rows.join("\n"); // ใส่ BOM ให้ Excel อ่านภาษาไทยไม่เพี้ยน
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `FitTracker_Export_${getFormattedDateKey(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ==========================================
// BMR & TDEE Calculator
// ==========================================
let lastCalcMacros = null;

function calculateBMRandTDEE() {
    const gender = document.getElementById('bmr-gender').value;
    const age = Number(document.getElementById('bmr-age').value) || 27;
    const height = Number(document.getElementById('bmr-height').value) || 167;
    const weight = Number(document.getElementById('bmr-weight').value);
    const bodyFatEl = document.getElementById('bmr-bodyfat');
    const bodyFat = bodyFatEl ? parseFloat(bodyFatEl.value) : NaN;
    const activity = Number(document.getElementById('bmr-activity').value) || 1.375;
    const box = document.getElementById('bmr-result-box');

    if (!weight || weight <= 0) {
        box.innerHTML = `<div class="text-slate-400">กรอกน้ำหนักปัจจุบันเพื่อคำนวณค่าพลังงานและสารอาหาร</div>`;
        return;
    }

    let bmr = 0;
    let lbm = weight;
    let formulaLabel = "Mifflin-St Jeor";

    // ถ้ามีค่า % ไขมันจากเครื่องชั่งอัจฉริยะ ใช้สูตร Katch-McArdle (แม่นยำกว่า)
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

    // คำนวณสัดส่วนสารอาหารตามน้ำหนักตัว / มวลกล้ามเนื้อล้วน
    const protMin = !isNaN(bodyFat) ? Math.round(lbm * 1.8) : Math.round(weight * 1.35);
    const protMax = !isNaN(bodyFat) ? Math.round(lbm * 2.1) : Math.round(weight * 1.6);
    const fatMax = Math.max(40, Math.round((cutMax * 0.30) / 9));
    const carbsMax = Math.max(60, Math.round((cutMax - (protMin * 4) - (fatMax * 9)) / 4));

    lastCalcMacros = { cutMin, cutMax, protMin, protMax, carbsMax, fatMax };

    box.innerHTML = `
        <div class="space-y-1">
            <div class="text-[10px] text-purple-300 font-semibold">${formulaLabel}</div>
            <div class="text-slate-300">BMR: <b class="text-white">${bmr.toLocaleString()}</b> | TDEE: <b class="text-sky-400">${tdee.toLocaleString()}</b> kcal</div>
            <div class="text-emerald-400">เป้าลดไขมัน: <b>${cutMin.toLocaleString()}–${cutMax.toLocaleString()} kcal</b></div>
            <div class="text-[10px] text-slate-300">
                P: <b class="text-emerald-300">${protMin}-${protMax}g</b> | C: <b class="text-sky-300">${carbsMax}g</b> | F: <b class="text-amber-300">${fatMax}g</b>
            </div>
        </div>
        <button type="button" onclick="applyCalculatedCalories()" class="bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-semibold px-2.5 py-2 rounded-lg shrink-0 transition">
            ใช้ค่านี้ทั้งหมด
        </button>
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
    renderBodyComposition();
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
        goalLabelEl.innerHTML = `<span class="line-through text-slate-500 mr-1">${adj.minFloor.toLocaleString()}-${adj.baseTarget.toLocaleString()}</span><span class="text-amber-400 font-bold">${adj.minFloor.toLocaleString()}-${adj.safeTarget.toLocaleString()}</span>`;
    } else {
        goalLabelEl.innerText = `${adj.minFloor.toLocaleString()}-${adj.baseTarget.toLocaleString()}`;
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
        statusEl.innerText = "เกินเป้า Max";
        statusEl.className = "px-2.5 py-1 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/50 font-medium";
    } else if (totalCal > 0 && totalCal < adj.minFloor) {
        statusEl.innerText = `ต่ำกว่าขั้นต่ำ (${adj.minFloor})`;
        statusEl.className = "px-2.5 py-1 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/50 font-medium";
    } else if (adj.yOver > 0 || todayCapsFromYesterday.length > 0) {
        statusEl.innerText = "โหมดชดเชยเมื่อวาน";
        statusEl.className = "px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/50 font-medium";
    } else {
        statusEl.innerText = "อยู่ในช่วง Min-Max";
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
// Smart Nutrition Coach (รวมเมนูจาก db.json + กรองสารอาหาร + สุ่มเปลี่ยนได้)
// ==========================================
const coachProteinMenus = [
    { name: "ไข่ขาวต้ม (3 ฟอง)", calories: 50, protein: 11, carbs: 1, sugar: 0, fiber: 0, fat: 0, satFat: 0, transFat: 0, sodium: 165, potassium: 160, cholesterol: 0, note: "โปรตีนล้วน แคลต่ำมาก ไร้ไขมัน" },
    { name: "เวย์โปรตีนไอโซเลต (1 สกู๊ป)", calories: 120, protein: 25, carbs: 2, sugar: 1, fiber: 0, fat: 1, satFat: 0.5, transFat: 0, sodium: 80, potassium: 150, cholesterol: 15, note: "ดูดซึมไว โซเดียมต่ำมาก" },
    { name: "อกไก่นุ่มเซเว่น (1 ชิ้น)", calories: 130, protein: 23, carbs: 2, sugar: 1, fiber: 0, fat: 3, satFat: 0.8, transFat: 0, sodium: 390, potassium: 220, cholesterol: 65, note: "หาซื้อง่าย อิ่มท้องนาน" },
    { name: "ทูน่าในน้ำแร่ (1 กระป๋อง)", calories: 110, protein: 24, carbs: 0, sugar: 0, fiber: 0, fat: 1, satFat: 0.2, transFat: 0, sodium: 320, potassium: 210, cholesterol: 45, note: "ไขมันต่ำมาก ยำหรือกินกับสลัดได้" },
    { name: "กรีกโยเกิร์ต 0% (1 ถ้วย)", calories: 90, protein: 15, carbs: 6, sugar: 5, fiber: 0, fat: 0, satFat: 0, transFat: 0, sodium: 55, potassium: 190, cholesterol: 5, note: "โซเดียมต่ำ ช่วยระบบขับถ่าย" },
    { name: "นมถั่วเหลืองโปรตีนสูง (1 ขวด)", calories: 180, protein: 28, carbs: 6, sugar: 2, fiber: 2, fat: 4.5, satFat: 0.5, transFat: 0, sodium: 150, potassium: 350, cholesterol: 0, note: "ดื่มง่าย โปรตีนแน่น โพแทสเซียมสูง" },
    { name: "ปลานิล/ปลาทับทิมนึ่ง (1 ตัว)", calories: 220, protein: 35, carbs: 0, sugar: 0, fiber: 0, fat: 8, satFat: 2, transFat: 0, sodium: 110, potassium: 450, cholesterol: 95, note: "ย่อยง่าย เหมาะเป็นมื้อเย็น" },
    { name: "ไข่ต้มทั้งฟอง (2 ฟอง)", calories: 150, protein: 12, carbs: 1, sugar: 1, fiber: 0, fat: 10, satFat: 3.2, transFat: 0, sodium: 140, potassium: 126, cholesterol: 372, note: "ประหยัด อิ่มนาน" },
    { name: "สันในไก่ย่างเกลือพริกไทย (100g)", calories: 140, protein: 26, carbs: 0, sugar: 0, fiber: 0, fat: 3, satFat: 0.8, transFat: 0, sodium: 180, potassium: 280, cholesterol: 65, note: "นุ่มกว่าอกไก่ โปรตีนสูง" },
    { name: "เต้าหู้ขาวอ่อนนึ่งซีอิ๊ว (1 หลอด)", calories: 115, protein: 12, carbs: 4, sugar: 1, fiber: 1, fat: 6, satFat: 0.9, transFat: 0, sodium: 210, potassium: 180, cholesterol: 0, note: "โปรตีนพืช ย่อยง่ายมากตอนเย็น" },
    { name: "กุ้งต้ม/ลวก (10 ตัวกลาง)", calories: 95, protein: 20, carbs: 0, sugar: 0, fiber: 0, fat: 1, satFat: 0.2, transFat: 0, sodium: 190, potassium: 220, cholesterol: 150, note: "แคลน้อยมาก โปรตีนเน้นๆ" },
    { name: "นมโปรตีนสูงรสจืด (1 ขวด 350ml)", calories: 190, protein: 27, carbs: 10, sugar: 8, fiber: 0, fat: 4.5, satFat: 2.5, transFat: 0, sodium: 170, potassium: 420, cholesterol: 15, note: "หาซื้อได้ตามร้านสะดวกซื้อ" },
    { name: "ถั่วแระญี่ปุ่นต้ม (1 ถ้วยเล็ก)", calories: 120, protein: 11, carbs: 9, sugar: 2, fiber: 5, fat: 5, satFat: 0.6, transFat: 0, sodium: 90, potassium: 430, cholesterol: 0, note: "ได้ทั้งโปรตีน ไฟเบอร์ และโพแทสเซียม" },
    { name: "ไข่ตุ๋นทรงเครื่อง (1 ถ้วย)", calories: 135, protein: 13, carbs: 3, sugar: 1, fiber: 0, fat: 8, satFat: 2.2, transFat: 0, sodium: 280, potassium: 140, cholesterol: 210, note: "อุ่นร้อน อิ่มสบายท้อง" },
    { name: "ยำอกไก่ฉีกสมุนไพร (1 จาน)", calories: 185, protein: 28, carbs: 8, sugar: 3, fiber: 2, fat: 4, satFat: 1, transFat: 0, sodium: 350, potassium: 340, cholesterol: 60, note: "รสจัดจ้าน แก้เบื่ออาหารคลีน" }
];

let coachShuffleSeed = 0;
let currentCoachPool = [];

function shuffleCoachSuggestions() {
    coachShuffleSeed++;
    renderNutritionCoach();
}

function quickAddRecommendedFood(poolIdx) {
    const item = currentCoachPool[poolIdx];
    if (!item) return;

    const dayData = getDayData(currentDateKey);
    dayData.meals["มื้อว่าง/อื่นๆ"].push({
        name: item.name,
        qty: 1,
        photo: item.photo || null,
        calories: Number(item.calories || 0),
        protein: Number(item.protein || 0),
        carbs: Number(item.carbs || 0),
        sugar: Number(item.sugar || 0),
        fiber: Number(item.fiber || 0),
        fat: Number(item.fat || 0),
        satFat: Number(item.satFat || 0),
        transFat: Number(item.transFat || 0),
        sodium: Number(item.sodium || 0),
        potassium: Number(item.potassium || 0),
        cholesterol: Number(item.cholesterol || 0)
    });
    saveDataAndSync();
}

function renderNutritionCoach() {
    const container = document.getElementById('coach-container');
    if (!container) return;

    const dayData = getDayData(currentDateKey);
    let totalCal = 0, totalProt = 0, totalCarbs = 0, totalSugar = 0, totalFiber = 0;
    let totalFat = 0, totalSatFat = 0, totalTransFat = 0, totalSodium = 0, totalChol = 0;

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
    const highSodiumMode = totalSodium > macroAdj.sodium.adjustedMax * 0.8;
    const highCholMode = totalChol > macroAdj.cholesterol.adjustedMax * 0.8;
    const lowCarbMode = totalCarbs > macroAdj.carbs.adjustedMax * 0.85;

    if (totalSodium > macroAdj.sodium.adjustedMax) {
        warnings.push(`โซเดียมเกินโควตาแล้ว (${Math.round(totalSodium)}/${macroAdj.sodium.adjustedMax} mg) <b>ควรงด</b> ซดน้ำซุป อาหารแปรรูป บะหมี่กึ่งสำเร็จรูป และควรดื่มน้ำเปล่าเพิ่ม`);
    } else if (highSodiumMode) {
        warnings.push(`โซเดียมใกล้เต็มโควตา (${Math.round(totalSodium)}/${macroAdj.sodium.adjustedMax} mg) มื้อถัดไป <b>ควรเลี่ยง</b> อาหารปรุงรสจัดและซอสจิ้ม`);
    }

    if (totalSugar > macroAdj.sugar.adjustedMax) {
        warnings.push(`น้ำตาลเกินโควตา (${totalSugar.toFixed(1)}/${macroAdj.sugar.adjustedMax} g) <b>ควรงด</b> ชานม น้ำอัดลม ขนมหวาน และผลไม้รสหวานจัด`);
    }

    if (totalSatFat > macroAdj.satFat.adjustedMax || totalTransFat > macroAdj.transFat.adjustedMax) {
        warnings.push(`ไขมันอิ่มตัว/ทรานส์เกินเกณฑ์ <b>ควรเลี่ยง</b> ของทอด เบเกอรี่ ครีมเทียม กะทิ และเนื้อสัตว์ติดมัน`);
    }

    if (totalChol > macroAdj.cholesterol.adjustedMax) {
        warnings.push(`คอเลสเตอรอลเกินโควตา (${Math.round(totalChol)}/${macroAdj.cholesterol.adjustedMax} mg) <b>ควรเลี่ยง</b> ไข่แดงและเครื่องในสัตว์`);
    }

    if (totalFiber < 10 && totalCal > 800) {
        warnings.push(`วันนี้ยังได้ไฟเบอร์น้อย (${totalFiber.toFixed(1)}/25 g) <b>ควรเพิ่ม</b> ผักใบเขียวหรือถั่วแระในมื้อถัดไปเพื่อช่วยให้อิ่มนาน`);
    }

    if (remCal < 150 && remCal >= 0) {
        warnings.push(`แคลอรีเหลือน้อย (${remCal} kcal) <b>ควรงด</b> ของทานเล่นที่มีแป้งและไขมันสูง`);
    } else if (remCal < 0) {
        warnings.push(`ทานเกินโควตาไปแล้ว ${Math.abs(remCal)} kcal <b>ควรงดมื้อดึก</b> หรือเดินเพิ่ม ~${Math.round(Math.abs(remCal) / 0.04).toLocaleString()} ก้าวเพื่อชดเชย`);
    }

    if (warnings.length === 0) {
        const hour = new Date().getHours();
        if (hour < 12) {
            warnings.push(`เริ่มต้นวันได้ดี! ช่วงเช้าเน้นโปรตีนให้อิ่มท้อง จะช่วยลดความอยากของหวานช่วงบ่ายได้`);
        } else if (hour < 17) {
            warnings.push(`ค่าโซเดียม น้ำตาล และไขมันยังอยู่ในเกณฑ์ดี ช่วงบ่ายระวังเครื่องดื่มหวานและขนมจุกจิก`);
        } else {
            warnings.push(`คุมสารอาหารได้ดีตลอดวัน มื้อเย็นเน้นโปรตีนย่อยง่ายกับผัก เพื่อการนอนหลับและฟื้นฟูกล้ามเนื้อ`);
        }
    }

    let protHtml = "";
    if (remProt <= 0) {
        protHtml = `<div class="text-xs text-emerald-400 font-medium"><i class="fa-solid fa-circle-check mr-1"></i> ยินดีด้วย! วันนี้คุณทานโปรตีนถึงเป้าหมาย (${totalProt.toFixed(1)}g) เรียบร้อยแล้ว</div>`;
    } else {
        const userHighProtMenus = (foodCatalog || [])
            .filter(f => Number(f.protein || 0) >= 10 && Number(f.calories || 0) > 0)
            .map(f => ({
                ...f,
                isUserMenu: true,
                note: `เมนูจากคลังของคุณ (C:${f.carbs || 0}g | F:${f.fat || 0}g | Na:${f.sodium || 0}mg)`
            }));

        const systemMenus = coachProteinMenus
            .filter(sys => !userHighProtMenus.some(u => u.name.toLowerCase() === sys.name.toLowerCase()))
            .map(sys => ({ ...sys, isUserMenu: false }));

        currentCoachPool = [...userHighProtMenus, ...systemMenus];

        let pool = currentCoachPool
            .map((m, poolIdx) => ({ ...m, poolIdx }))
            .filter(m => Number(m.calories) <= Math.max(remCal, 130))
            .filter(m => !(highSodiumMode && Number(m.sodium || 0) > 250))
            .filter(m => !(highCholMode && Number(m.cholesterol || 0) > 100))
            .filter(m => !(lowCarbMode && Number(m.carbs || 0) > 6));

        if (pool.length < 3) {
            pool = currentCoachPool
                .map((m, poolIdx) => ({ ...m, poolIdx }))
                .filter(m => Number(m.calories) <= Math.max(remCal, 150));
        }

        const dateNum = Number(currentDateKey.replace(/-/g, '')) || 0;
        const startIdx = (dateNum + coachShuffleSeed * 3) % Math.max(1, pool.length);
        let rotated = [];
        for (let i = 0; i < Math.min(3, pool.length); i++) {
            rotated.push(pool[(startIdx + i) % pool.length]);
        }

        const filterBadges = [];
        if (userHighProtMenus.length > 0) filterBadges.push(`รวมเมนูในคลังคุณ (${userHighProtMenus.length})`);
        if (highSodiumMode) filterBadges.push("คัดโซเดียมต่ำ");
        if (highCholMode) filterBadges.push("คัดคอเลสเตอรอลต่ำ");
        if (lowCarbMode) filterBadges.push("คัดคาร์บต่ำ");

        protHtml = `
            <div class="flex justify-between items-center gap-2 mb-2">
                <p class="text-xs text-slate-300">
                    ขาดโปรตีน <span class="text-emerald-400 font-bold">${remProt.toFixed(1)}g</span> (งบเหลือ <span class="text-white font-semibold">${Math.max(0, remCal)} kcal</span>)
                    ${filterBadges.length > 0 ? `<span class="text-[10px] text-amber-300 block">• ${filterBadges.join(' • ')}</span>` : ''}
                </p>
                <button type="button" onclick="shuffleCoachSuggestions()" class="shrink-0 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] px-2.5 py-1 rounded-lg border border-slate-700 transition flex items-center gap-1">
                    <i class="fa-solid fa-shuffle"></i> สุ่มเมนูอื่น
                </button>
            </div>
            <div class="space-y-1.5">
                ${rotated.map(m => `
                    <div class="flex justify-between items-center bg-slate-950/70 px-3 py-2 rounded-xl border ${m.isUserMenu ? 'border-amber-500/30' : 'border-slate-800/80'} text-xs gap-2">
                        <div>
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="text-slate-100 font-medium">${m.name}</span>
                                ${m.isUserMenu ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-700/50">ในคลังคุณ</span>` : ''}
                            </div>
                            <span class="text-[10px] text-slate-400 block">${m.note}</span>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            <div class="text-right">
                                <span class="text-emerald-400 font-bold block">+${m.protein}g P</span>
                                <span class="text-[10px] text-slate-400">${m.calories} kcal</span>
                            </div>
                            <button type="button" onclick="quickAddRecommendedFood(${m.poolIdx})" class="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition">
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
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/50">วิเคราะห์เฉพาะบุคคล</span>
            </div>

            <div class="space-y-1">
                <div class="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <i class="fa-solid fa-drumstick-bite"></i> เติมโปรตีนให้ถึงเป้า (${minProt}-${maxProt}g)
                </div>
                ${protHtml}
            </div>

            <div class="space-y-1.5 pt-2 border-t border-slate-800/60">
                <div class="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                    <i class="fa-solid fa-ban"></i> คำแนะนำ & สิ่งที่ควรเลี่ยงช่วงที่เหลือของวัน
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

    await setPreviewFromFile(file);

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

    let worker = null;
    try {
        worker = await Tesseract.createWorker(['tha', 'eng']);
        const ret = await worker.recognize(file);

        const text = (ret?.data?.text || '').replace(/\s+/g, ' ');
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
        alert("เกิดข้อผิดพลาดในการอ่านตัวหนังสือ: " + (err?.message || err));
    } finally {
        if (worker) {
            try {
                await worker.terminate();
            } catch (_) {}
        }
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
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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
// Settings, Program Presets, BMR/TDEE & Food Catalog Manager
// ==========================================
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

function openSettingsModal() {
    const currentPreset = userGoals.preset || 'fat_loss';
    document.getElementById('goal-preset-select').value = goalPresets[currentPreset] ? currentPreset : 'custom';
    const descEl = document.getElementById('preset-desc-label');
    if (descEl) {
        descEl.innerText = goalPresets[currentPreset] ? goalPresets[currentPreset].desc : "โหมดกำหนดตัวเลขเอง (Custom)";
    }

    document.getElementById('goal-cal-input').value = userGoals.calories;
    document.getElementById('goal-min-cal-input').value = userGoals.minCalories;
    document.getElementById('goal-prot-min-input').value = userGoals.proteinMin;
    document.getElementById('goal-prot-max-input').value = userGoals.proteinMax;
    document.getElementById('goal-carbs-input').value = userGoals.carbsMax || 150;
    document.getElementById('goal-fat-input').value = userGoals.fatMax || 50;
    document.getElementById('goal-steps-input').value = userGoals.steps;
    document.getElementById('goal-water-input').value = userGoals.water;
    document.getElementById('goal-weight-input').value = userGoals.targetWeight || '';

    // ดึงน้ำหนักล่าสุดมาใส่ในช่องคำนวณ BMR อัตโนมัติ
    const todayData = getDayData(currentDateKey);
    if (todayData.weight) {
        document.getElementById('bmr-weight').value = todayData.weight;
        calculateBMRandTDEE();
    }

    document.getElementById('catalog-count-badge').innerText = foodCatalog.length;
    document.getElementById('github-token-input').value = localStorage.getItem('fitTracker_github_token') || '';
    document.getElementById('gemini-api-key-input').value = localStorage.getItem('fitTracker_gemini_key') || '';
    document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.add('hidden');
}

async function saveAllSettings() {
    const selectedPreset = document.getElementById('goal-preset-select').value || 'custom';
    const presetObj = goalPresets[selectedPreset];

    userGoals = {
        preset: selectedPreset,
        calories: Math.max(500, Number(document.getElementById('goal-cal-input').value) || 1500),
        minCalories: Math.max(500, Number(document.getElementById('goal-min-cal-input').value) || 1200),
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

    // ล็อกประวัติ Min-Max ของวันที่กำลังเปิดดูไว้ด้วย
    const currentDayObj = getDayData(currentDateKey);
    currentDayObj.targetMin = userGoals.minCalories;
    currentDayObj.targetMax = userGoals.calories;
    localStorage.setItem('fitTracker_history', JSON.stringify(allMealsHistory));

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
        alert("บันทึกโปรแกรมและเป้าหมายเรียบร้อยแล้ว!");
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
                <div class="text-xs font-semibold text-white flex items-center gap-1">
                    ${item.name}
                    ${item.photo ? `<i class="fa-regular fa-image text-sky-400 text-[10px]"></i>` : ''}
                </div>
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

        const catalogMatch = foodCatalog.find(f => f.name.toLowerCase() === (item.name || '').toLowerCase());
        const photoToLoad = item.photo || (catalogMatch ? catalogMatch.photo : null);
        loadFoodPhotoPreview(photoToLoad);
    } else {
        document.getElementById('food-form').reset();
        document.getElementById('food-qty').value = 1;
        baseNutrition = null;
        removeFoodPhoto();
    }

    document.getElementById('food-modal').classList.remove('hidden');
}

function closeFoodModal() {
    document.getElementById('food-modal').classList.add('hidden');
}

async function handleFoodSubmit(e) {
    e.preventDefault();
    const mealType = document.getElementById('edit-meal-type').value;
    const itemIndex = document.getElementById('edit-item-index').value;
    const rawName = (document.getElementById('food-name').value || '').trim();
    if (!rawName) return;

    const qtyNum = Math.max(0.1, extractMultiplier(document.getElementById('food-qty').value));
    const nonNeg = (id) => Math.max(0, Number(document.getElementById(id)?.value) || 0);
    const round1 = (val) => Math.round(val * 10) / 10;

    let finalPhotoPath = currentFoodPhotoPath;
    if (pendingFoodPhotoBase64) {
        setSyncStatus('syncing', 'กำลังอัปโหลดรูปอาหาร...');
        const uploadedPath = await uploadPhotoToGitHub(pendingFoodPhotoBase64);
        if (uploadedPath) {
            finalPhotoPath = uploadedPath;
        }
    }

    const newItem = {
        name: rawName,
        qty: qtyNum,
        photo: finalPhotoPath || null,
        calories: Math.round(nonNeg('food-calories')),
        protein: round1(nonNeg('food-protein')),
        carbs: round1(nonNeg('food-carbs')),
        sugar: round1(nonNeg('food-sugar')),
        fiber: round1(nonNeg('food-fiber')),
        fat: round1(nonNeg('food-fat')),
        satFat: round1(nonNeg('food-satfat')),
        transFat: round1(nonNeg('food-transfat')),
        sodium: Math.round(nonNeg('food-sodium')),
        potassium: Math.round(nonNeg('food-potassium')),
        cholesterol: Math.round(nonNeg('food-cholesterol'))
    };

    const dayData = getDayData(currentDateKey);
    if (itemIndex !== '') {
        dayData.meals[mealType][Number(itemIndex)] = newItem;
    } else {
        dayData.meals[mealType].push(newItem);
    }

    const unitItem = {
        name: newItem.name,
        photo: finalPhotoPath || null,
        calories: Math.round(newItem.calories / qtyNum),
        protein: round1(newItem.protein / qtyNum),
        carbs: round1(newItem.carbs / qtyNum),
        sugar: round1(newItem.sugar / qtyNum),
        fiber: round1(newItem.fiber / qtyNum),
        fat: round1(newItem.fat / qtyNum),
        satFat: round1(newItem.satFat / qtyNum),
        transFat: round1(newItem.transFat / qtyNum),
        sodium: Math.round(newItem.sodium / qtyNum),
        potassium: Math.round(newItem.potassium / qtyNum),
        cholesterol: Math.round(newItem.cholesterol / qtyNum)
    };

    const existingCatIdx = foodCatalog.findIndex(f => f.name.toLowerCase() === unitItem.name.toLowerCase());
    if (existingCatIdx === -1) {
        foodCatalog.push(unitItem);
    } else if (finalPhotoPath) {
        foodCatalog[existingCatIdx].photo = finalPhotoPath;
    }

    pendingFoodPhotoBase64 = null;
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
    if (!datalist) return;

    const catalog = Array.isArray(foodCatalog) ? foodCatalog : [];
    datalist.innerHTML = catalog
        .map(f => `<option value="${f.name}">(${f.calories} kcal, โปรตีน ${f.protein}g)</option>`)
        .join('');
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

        loadFoodPhotoPreview(found.photo || null);
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

    const protMin = Number(userGoals.proteinMin) || 96;

    for (let i = 0; i < firstDayOfWeek; i++) {
        container.innerHTML += `<div class="h-11"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const key = `${calendarViewYear}-${String(calendarViewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const stats = getDayStatsForCalendar(key);
        const dGoals = getDayCalorieGoals(key);
        const targetCal = dGoals.max;
        const isSelected = key === calendarSelectedKey;
        const isToday = key === todayKey;

        let dotsHtml = `<div class="h-2 flex items-center justify-center gap-1 mt-0.5"></div>`;
        if (stats && stats.totalCal > 0) {
            let calDotClass = 'bg-emerald-400';
            if (stats.totalCal > targetCal + 500) {
                calDotClass = 'bg-rose-500';
            } else if (stats.totalCal > targetCal) {
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
                    ทาน <b class="text-white">${stats.totalCal}</b> kcal (เป้า ${adj.minFloor}-${adj.safeTarget}) | เผาผลาญ <b class="text-orange-400">${stats.totalBurn}</b> kcal | น้ำ <b class="text-sky-400">${stats.water}</b> ml
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
// Weekly & Monthly Report Analytics (ตัดวันที่ยังไม่ถึงออก + Macro Ratio Bar + Min-Max รายวัน)
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

    const todayKey = getFormattedDateKey(new Date());
    const effectiveEndKey = currentDateKey > todayKey ? todayKey : currentDateKey;

    const parts = effectiveEndKey.split('-');
    const endDate = new Date(parts[0], parts[1] - 1, parts[2]);

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

        // ข้ามวันที่ยังไม่ถึง (แผนล่วงหน้าในอนาคต)
        if (key > todayKey) continue;

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
            const dGoals = getDayCalorieGoals(key);
            const { totalBurn } = getTotalBurned(dayObj);
            const effectiveLimit = dGoals.max + totalBurn;

            if (dCal > effectiveLimit) {
                calOverDays++;
            } else if (dCal < dGoals.min) {
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
                <div class="text-sm font-semibold text-slate-300">ยังไม่มีข้อมูลอาหารที่บันทึกจริงในช่วง ${daysCount} วันนี้</div>
                <div class="text-xs text-slate-500">ระบบจะไม่นำแผนล่วงหน้าในอนาคตมาคำนวณรวมจนกว่าจะถึงวันนั้นครับ</div>
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

    // คำนวณสัดส่วน Macro Ratio (%) จากพลังงานจริง
    const protKcal = sums.prot * 4;
    const carbsKcal = sums.carbs * 4;
    const fatKcal = sums.fat * 9;
    const totalMacroKcal = Math.max(1, protKcal + carbsKcal + fatKcal);
    const protRatio = Math.round((protKcal / totalMacroKcal) * 100);
    const carbsRatio = Math.round((carbsKcal / totalMacroKcal) * 100);
    const fatRatio = Math.max(0, 100 - protRatio - carbsRatio);

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

    const refGoals = getDayCalorieGoals(effectiveEndKey);
    const minCal = refGoals.min;
    const targetCal = refGoals.max;

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
                <div class="text-[11px] text-slate-400">ประเมินผลจริง <b>${activeDays} วัน</b> (คิดตามเป้า Min-Max รายวัน)</div>
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

        <!-- แถบสัดส่วนพลังงาน Macro Ratio -->
        <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
            <div class="flex justify-between items-center text-xs">
                <span class="font-bold text-slate-200"><i class="fa-solid fa-chart-bar text-indigo-400 mr-1.5"></i>สัดส่วนพลังงานจริง (Macro Ratio)</span>
                <span class="text-[10px] text-slate-400">P : C : F</span>
            </div>
            <div class="w-full h-3 bg-slate-900 rounded-full overflow-hidden flex">
                <div style="width: ${protRatio}%" class="bg-emerald-400 h-full" title="โปรตีน ${protRatio}%"></div>
                <div style="width: ${carbsRatio}%" class="bg-sky-400 h-full" title="คาร์บ ${carbsRatio}%"></div>
                <div style="width: ${fatRatio}%" class="bg-amber-400 h-full" title="ไขมัน ${fatRatio}%"></div>
            </div>
            <div class="flex justify-between text-[11px] font-medium">
                <span class="text-emerald-400">โปรตีน ${protRatio}%</span>
                <span class="text-sky-400">คาร์บ ${carbsRatio}%</span>
                <span class="text-amber-400">ไขมัน ${fatRatio}%</span>
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

// ==========================================
// Home Workout Course & Non-Machine Exercise Library
// ==========================================
let courseConfig = Object.assign(
    { equipment: ['bodyweight', 'chair'], schedule: '3days' },
    JSON.parse(localStorage.getItem('fitTracker_course') || '{}')
);
let currentCourseTab = 'today';

// เก็บแมปชื่อท่า -> พาธรูปบน GitHub (ซิงก์ร่วมกับ db.json ได้)
let exercisePhotosMap = JSON.parse(localStorage.getItem('fitTracker_ex_photos') || '{}');
let activeExerciseNameForPhoto = '';

// คลังท่าเวทเทรนนิ่งทั้งหมดแบบ "ไม่ใช้เครื่อง" แยกตามกลุ่มกล้ามเนื้อและอุปกรณ์
const nonMachineExercises = [
    // ขาและสะโพก (Legs & Glutes)
    { name: "Bodyweight Squat (สควอท)", muscle: "ขา & ก้น", eq: "bodyweight", reps: "15 ครั้ง × 3 เซต", tip: "ย่อก้นไปด้านหลัง หลังตรง เข่าไม่เลยปลายเท้ามากเกินไป" },
    { name: "Reverse Lunges (ก้าวถอยหลังย่อเข่า)", muscle: "ขา & ก้น", eq: "bodyweight", reps: "ข้างละ 10-12 ครั้ง × 3 เซต", tip: "ก้าวถอยหลังช่วยเซฟหัวเข่าได้ดีกว่าก้าวไปข้างหน้า" },
    { name: "Glute Bridge (นอนยกสะโพก)", muscle: "ขา & ก้น", eq: "bodyweight", reps: "15 ครั้ง × 3 เซต", tip: "ดันส้นเท้าขึ้น บีบก้นค้างไว้ 1-2 วินาทีจังหวะบนสุด" },
    { name: "Wall Sit (นั่งพิงกำแพง)", muscle: "ขา & ก้น", eq: "bodyweight", reps: "ค้างไว้ 30-45 วินาที × 3 เซต", tip: "พิงหลังแนบกำแพง งอเข่า 90 องศา เกร็งหน้าขา" },
    { name: "Calf Raises (ยืนเขย่งน่อง)", muscle: "ขา & ก้น", eq: "bodyweight", reps: "20 ครั้ง × 3 เซต", tip: "เขย่งขึ้นให้สุดแล้วค่อยๆ ผ่อนส้นเท้าลงช้าๆ" },
    { name: "Bulgarian Split Squat (พาดขาหลังกับเก้าอี้)", muscle: "ขา & ก้น", eq: "chair", reps: "ข้างละ 10 ครั้ง × 3 เซต", tip: "วางหลังเท้าข้างหนึ่งบนเก้าอี้ ย่อตัวลงเน้นต้นขาและก้นเต็มๆ" },
    { name: "Band Squat (สควอทต้านยางยืด)", muscle: "ขา & ก้น", eq: "band", reps: "15 ครั้ง × 3 เซต", tip: "เหยียบยางยืดไว้แล้วคล้องไหล่ เพิ่มแรงต้านตอนดันตัวขึ้น" },
    { name: "Dumbbell Goblet Squat (ถือดัมเบลสควอท)", muscle: "ขา & ก้น", eq: "dumbbell", reps: "12-15 ครั้ง × 3 เซต", tip: "ถือดัมเบล/ขวดน้ำชิดอก ย่อตัวลงลึก หลังตรง" },

    // หน้าอก (Chest)
    { name: "Standard Push-ups (วิดพื้นมาตรฐาน)", muscle: "หน้าอก", eq: "bodyweight", reps: "10-15 ครั้ง × 3 เซต", tip: "ลำตัวตรงเป็นเส้นเดียว กางศอกทำมุม 45 องศากับลำตัว" },
    { name: "Wide Push-ups (วิดพื้นกางแขนกว้าง)", muscle: "หน้าอก", eq: "bodyweight", reps: "10-12 ครั้ง × 3 เซต", tip: "วางมือกว้างกว่าหัวไหล่ เน้นกล้ามเนื้อหน้าอกด้านนอก" },
    { name: "Incline Push-ups (วิดพื้นกับขอบโต๊ะ/เก้าอี้)", muscle: "หน้าอก", eq: "chair", reps: "12-15 ครั้ง × 3 เซต", tip: "วางมือบนขอบโต๊ะที่มั่นคง เหมาะสำหรับเริ่มต้นหรือวอร์มอก" },
    { name: "Decline Push-ups (พาดเท้าบนเก้าอี้วิดพื้น)", muscle: "หน้าอก", eq: "chair", reps: "8-12 ครั้ง × 3 เซต", tip: "วางเท้าบนเก้าอี้ มือยันพื้น เน้นหน้าอกส่วนบนและหัวไหล่" },
    { name: "Band Chest Press (ดันยางยืดอ้อมหลัง)", muscle: "หน้าอก", eq: "band", reps: "15 ครั้ง × 3 เซต", tip: "คล้องยางยืดอ้อมใต้รักแร้ด้านหลัง แล้วดันแขนไปข้างหน้า" },
    { name: "Dumbbell Floor Press (นอนพื้นดันดัมเบล)", muscle: "หน้าอก", eq: "dumbbell", reps: "12 ครั้ง × 3 เซต", tip: "นอนหงายชันเข่า ดันดัมเบลขึ้นตรงๆ เหนืออก" },

    // แผ่นหลัง (Back)
    { name: "Superman Hold (นอนคว่ำยกอก-ขา)", muscle: "แผ่นหลัง", eq: "bodyweight", reps: "12-15 ครั้ง × 3 เซต", tip: "ยกอกและต้นขาขึ้นพร้อมกัน เกร็งหลังส่วนล่างค้าง 2 วินาที" },
    { name: "Reverse Snow Angels (วาดแขนบีบสะบัก)", muscle: "แผ่นหลัง", eq: "bodyweight", reps: "12 ครั้ง × 3 เซต", tip: "นอนคว่ำ ยกอกลอยเล็กน้อย วาดแขนจากข้างตัวไปเหนือหัว" },
    { name: "Table / Inverted Row (ดึงตัวใต้โต๊ะ)", muscle: "แผ่นหลัง", eq: "chair", reps: "8-12 ครั้ง × 3 เซต", tip: "นอนใต้โต๊ะที่แข็งแรง จับขอบโต๊ะแล้วดึงอกขึ้นหาโต๊ะ" },
    { name: "Seated Band Row (นั่งดึงยางยืดที่ฝ่าเท้า)", muscle: "แผ่นหลัง", eq: "band", reps: "15 ครั้ง × 3 เซต", tip: "นั่งเหยียดขา คล้องยางยืดที่ฝ่าเท้า ดึงศอกไปด้านหลังบีบสะบัก" },
    { name: "Band Pull-Aparts (ดึงยางยืดกางออกระดับอก)", muscle: "แผ่นหลัง", eq: "band", reps: "15 ครั้ง × 3 เซต", tip: "เหยียดแขนตรงระดับอก ดึงกางออกจนยางยืดแตะหน้าอก" },
    { name: "Dumbbell One-Arm Row (ดึงดัมเบลข้างลำตัว)", muscle: "แผ่นหลัง", eq: "dumbbell", reps: "ข้างละ 12 ครั้ง × 3 เซต", tip: "ยันมือกับเก้าอี้ ดึงดัมเบลขึ้นข้างเอว บีบสะบัก" },

    // หัวไหล่ & แขน (Shoulders & Arms)
    { name: "Pike Push-ups (วิดพื้นโด่งก้นเน้นไหล่)", muscle: "ไหล่ & แขน", eq: "bodyweight", reps: "8-12 ครั้ง × 3 เซต", tip: "โด่งสะโพกเป็นรูปตัว V คว่ำ งอศอกลดศีรษะลงหาพื้น" },
    { name: "Diamond Push-ups (วิดพื้นมือชิดเน้นหลังแขน)", muscle: "ไหล่ & แขน", eq: "bodyweight", reps: "8-10 ครั้ง × 3 เซต", tip: "วางมือชิดกันเป็นรูปเพชร เน้นกล้ามเนื้อหลังแขนและอกใน" },
    { name: "Chair Dips (ดิปหลังแขนกับเก้าอี้)", muscle: "ไหล่ & แขน", eq: "chair", reps: "10-15 ครั้ง × 3 เซต", tip: "หันหลังให้เก้าอี้ ใช้มือยันขอบแล้วย่อตัวงอศอกลง-ดันขึ้น" },
    { name: "Band Lateral Raises (กางแขนยางยืดไหล่ข้าง)", muscle: "ไหล่ & แขน", eq: "band", reps: "15 ครั้ง × 3 เซต", tip: "เหยียบกลางยางยืด กางแขนออกด้านข้างระดับหัวไหล่" },
    { name: "Band Bicep Curls (พับแขนยางยืดหน้าแขน)", muscle: "ไหล่ & แขน", eq: "band", reps: "15 ครั้ง × 3 เซต", tip: "ล็อกข้อศอกแนบข้างลำตัว พับแขนดึงยางยืดขึ้นหาไหล่" },
    { name: "Dumbbell Shoulder Press & Curls", muscle: "ไหล่ & แขน", eq: "dumbbell", reps: "12 ครั้ง × 3 เซต", tip: "ดันดัมเบลเหนือศีรษะสลับกับพับแขนเล่นหน้าแขน" },

    // แกนกลางลำตัว (Core & Abs)
    { name: "Forearm Plank (แพลงก์ตั้งศอก)", muscle: "หน้าท้อง & แกนกลาง", eq: "bodyweight", reps: "ค้างไว้ 30-60 วินาที × 3 เซต", tip: "เกร็งหน้าท้องและก้น อย่าให้หลังแอ่นหรือก้นโด่ง" },
    { name: "Dead Bug (นอนหงายสลับแขน-ขา)", muscle: "หน้าท้อง & แกนกลาง", eq: "bodyweight", reps: "12-16 ครั้ง × 3 เซต", tip: "กดหลังส่วนล่างให้ติดพื้นตลอดเวลาขณะเหยียดแขน-ขา" },
    { name: "Mountain Climbers (วิ่งปีนเขากับพื้น)", muscle: "หน้าท้อง & แกนกลาง", eq: "bodyweight", reps: "30 วินาที × 3 เซต", tip: "ตั้งท่าวิดพื้น แทงเข่าสลับซ้าย-ขวาเร็วๆ ได้ทั้งท้องและคาร์ดิโอ" },
    { name: "Russian Twist (นั่งบิดลำตัวซ้าย-ขวา)", muscle: "หน้าท้อง & แกนกลาง", eq: "bodyweight", reps: "20 ครั้ง × 3 เซต", tip: "เอนหลัง 45 องศา บิดไหล่ซ้าย-ขวาเน้นกล้ามเนื้อข้างเอว" }
];

function openWorkoutCourseModal() {
    document.getElementById('eq-chair').checked = courseConfig.equipment.includes('chair');
    document.getElementById('eq-band').checked = courseConfig.equipment.includes('band');
    document.getElementById('eq-dumbbell').checked = courseConfig.equipment.includes('dumbbell');
    document.getElementById('course-schedule-select').value = courseConfig.schedule || '3days';

    switchCourseTab('today');
    document.getElementById('course-modal').classList.remove('hidden');
}

function closeWorkoutCourseModal() {
    document.getElementById('course-modal').classList.add('hidden');
}

function saveCourseConfig() {
    let eq = ['bodyweight'];
    if (document.getElementById('eq-chair').checked) eq.push('chair');
    if (document.getElementById('eq-band').checked) eq.push('band');
    if (document.getElementById('eq-dumbbell').checked) eq.push('dumbbell');

    courseConfig = {
        equipment: eq,
        schedule: document.getElementById('course-schedule-select').value
    };
    localStorage.setItem('fitTracker_course', JSON.stringify(courseConfig));
    renderWorkoutCourseContent();
}

// แมปกล้ามเนื้อหลักและกล้ามเนื้อรองของแต่ละท่าสำหรับหุ่นจำลอง SVG
const exerciseMuscleMap = {
    "Bodyweight Squat (สควอท)": { primary: ["legs", "glutes"], secondary: ["core"], kcal: 14 },
    "Reverse Lunges (ก้าวถอยหลังย่อเข่า)": { primary: ["legs", "glutes"], secondary: ["core"], kcal: 15 },
    "Glute Bridge (นอนยกสะโพก)": { primary: ["glutes"], secondary: ["legs", "core"], kcal: 10 },
    "Wall Sit (นั่งพิงกำแพง)": { primary: ["legs"], secondary: ["glutes", "core"], kcal: 11 },
    "Calf Raises (ยืนเขย่งน่อง)": { primary: ["legs"], secondary: [], kcal: 8 },
    "Bulgarian Split Squat (พาดขาหลังกับเก้าอี้)": { primary: ["legs", "glutes"], secondary: ["core"], kcal: 16 },
    "Band Squat (สควอทต้านยางยืด)": { primary: ["legs", "glutes"], secondary: ["core"], kcal: 15 },
    "Dumbbell Goblet Squat (ถือดัมเบลสควอท)": { primary: ["legs", "glutes"], secondary: ["core", "arms"], kcal: 16 },

    "Standard Push-ups (วิดพื้นมาตรฐาน)": { primary: ["chest"], secondary: ["shoulders", "arms", "core"], kcal: 12 },
    "Wide Push-ups (วิดพื้นกางแขนกว้าง)": { primary: ["chest"], secondary: ["shoulders", "arms"], kcal: 12 },
    "Incline Push-ups (วิดพื้นกับขอบโต๊ะ/เก้าอี้)": { primary: ["chest"], secondary: ["shoulders", "arms"], kcal: 10 },
    "Decline Push-ups (พาดเท้าบนเก้าอี้วิดพื้น)": { primary: ["chest", "shoulders"], secondary: ["arms", "core"], kcal: 14 },
    "Band Chest Press (ดันยางยืดอ้อมหลัง)": { primary: ["chest"], secondary: ["shoulders", "arms"], kcal: 11 },
    "Dumbbell Floor Press (นอนพื้นดันดัมเบล)": { primary: ["chest"], secondary: ["arms", "shoulders"], kcal: 12 },

    "Superman Hold (นอนคว่ำยกอก-ขา)": { primary: ["back"], secondary: ["glutes"], kcal: 9 },
    "Reverse Snow Angels (วาดแขนบีบสะบัก)": { primary: ["back"], secondary: ["shoulders"], kcal: 9 },
    "Table / Inverted Row (ดึงตัวใต้โต๊ะ)": { primary: ["back"], secondary: ["arms", "shoulders"], kcal: 14 },
    "Seated Band Row (นั่งดึงยางยืดที่ฝ่าเท้า)": { primary: ["back"], secondary: ["arms"], kcal: 11 },
    "Band Pull-Aparts (ดึงยางยืดกางออกระดับอก)": { primary: ["back", "shoulders"], secondary: [], kcal: 9 },
    "Dumbbell One-Arm Row (ดึงดัมเบลข้างลำตัว)": { primary: ["back"], secondary: ["arms"], kcal: 13 },

    "Pike Push-ups (วิดพื้นโด่งก้นเน้นไหล่)": { primary: ["shoulders"], secondary: ["arms", "chest"], kcal: 12 },
    "Diamond Push-ups (วิดพื้นมือชิดเน้นหลังแขน)": { primary: ["arms", "chest"], secondary: ["shoulders"], kcal: 13 },
    "Chair Dips (ดิปหลังแขนกับเก้าอี้)": { primary: ["arms"], secondary: ["shoulders", "chest"], kcal: 11 },
    "Band Lateral Raises (กางแขนยางยืดไหล่ข้าง)": { primary: ["shoulders"], secondary: [], kcal: 9 },
    "Band Bicep Curls (พับแขนยางยืดหน้าแขน)": { primary: ["arms"], secondary: [], kcal: 9 },
    "Dumbbell Shoulder Press & Curls": { primary: ["shoulders", "arms"], secondary: ["core"], kcal: 13 },

    "Forearm Plank (แพลงก์ตั้งศอก)": { primary: ["core"], secondary: ["shoulders"], kcal: 9 },
    "Dead Bug (นอนหงายสลับแขน-ขา)": { primary: ["core"], secondary: [], kcal: 9 },
    "Mountain Climbers (วิ่งปีนเขากับพื้น)": { primary: ["core"], secondary: ["legs", "shoulders"], kcal: 15 },
    "Russian Twist (นั่งบิดลำตัวซ้าย-ขวา)": { primary: ["core"], secondary: [], kcal: 10 }
};

let customBuilderSelection = JSON.parse(localStorage.getItem('fitTracker_custom_builder') || 'null') || {
    "Bodyweight Squat (สควอท)": 3,
    "Standard Push-ups (วิดพื้นมาตรฐาน)": 3,
    "Glute Bridge (นอนยกสะโพก)": 3,
    "Forearm Plank (แพลงก์ตั้งศอก)": 3
};
let customBuilderFilter = "all";
let userCustomExercises = JSON.parse(localStorage.getItem('fitTracker_user_exercises') || '[]');

function switchCourseTab(tab) {
    currentCourseTab = tab;
    const tabs = ['today', 'custom', 'library'];
    tabs.forEach(t => {
        const el = document.getElementById(`course-tab-${t}`);
        if (!el) return;
        el.className = (t === tab)
            ? "py-1.5 rounded-lg text-[11px] font-semibold transition bg-indigo-600 text-white"
            : "py-1.5 rounded-lg text-[11px] font-semibold transition text-slate-400 hover:text-white";
    });
    renderWorkoutCourseContent();
}

function toggleBuilderExercise(exName) {
    if (customBuilderSelection[exName]) {
        delete customBuilderSelection[exName];
    } else {
        customBuilderSelection[exName] = 3;
    }
    localStorage.setItem('fitTracker_custom_builder', JSON.stringify(customBuilderSelection));
    renderWorkoutCourseContent();
}

function changeBuilderSets(exName, delta, event) {
    if (event) event.stopPropagation();
    const cur = customBuilderSelection[exName] || 3;
    customBuilderSelection[exName] = Math.max(1, Math.min(10, cur + delta));
    localStorage.setItem('fitTracker_custom_builder', JSON.stringify(customBuilderSelection));
    renderWorkoutCourseContent();
}

function setBuilderFilter(cat) {
    customBuilderFilter = cat;
    renderWorkoutCourseContent();
}

function addUserCustomExerciseToBuilder() {
    const nameEl = document.getElementById('builder-custom-name');
    const muscleEl = document.getElementById('builder-custom-muscle');
    const name = (nameEl?.value || '').trim();
    if (!name) return;

    const muscleCode = muscleEl.value;
    const muscleGroupLabel = {
        chest: "หน้าอก", back: "แผ่นหลัง", legs: "ขา & ก้น",
        shoulders: "ไหล่ & แขน", arms: "ไหล่ & แขน", core: "หน้าท้อง & แกนกลาง"
    }[muscleCode] || "หน้าท้อง & แกนกลาง";

    userCustomExercises.unshift({
        name: name,
        muscle: muscleGroupLabel,
        eq: "bodyweight",
        reps: "12-15 ครั้ง × 3 เซต",
        tip: "ท่าที่เพิ่มเอง",
        customPrimary: [muscleCode]
    });
    localStorage.setItem('fitTracker_user_exercises', JSON.stringify(userCustomExercises));

    customBuilderSelection[name] = 3;
    localStorage.setItem('fitTracker_custom_builder', JSON.stringify(customBuilderSelection));
    renderWorkoutCourseContent();
}

function saveCustomBuilderWorkout() {
    const selectedNames = Object.keys(customBuilderSelection);
    if (selectedNames.length === 0) {
        alert("กรุณาเลือกท่าที่เล่นอย่างน้อย 1 ท่าก่อนบันทึกครับ");
        return;
    }

    let totalSets = 0;
    let totalKcal = 0;
    selectedNames.forEach(name => {
        const sets = customBuilderSelection[name] || 3;
        const meta = exerciseMuscleMap[name] || { kcal: 12 };
        totalSets += sets;
        totalKcal += sets * meta.kcal;
    });

    const estMinutes = Math.max(5, Math.round(totalSets * 1.5));
    const title = `เวทเลือกท่าเอง (${selectedNames.length} ท่า: ${selectedNames.map(n => n.split('(')[0].trim()).slice(0, 3).join(', ')}${selectedNames.length > 3 ? '...' : ''})`;

    logCourseWorkoutToToday(title, estMinutes, Math.round(totalKcal));
}

function renderWorkoutCourseContent() {
    const container = document.getElementById('course-content-container');
    if (!container) return;

    const availableEq = courseConfig.equipment || ['bodyweight'];
    const filteredExercises = [
        ...userCustomExercises,
        ...nonMachineExercises.filter(ex => availableEq.includes(ex.eq))
    ];

    // ==========================================
    // แท็บ 2: เลือกท่าเอง + หุ่นจำลองวิเคราะห์จุดกล้ามเนื้อ (SVG Heatmap)
    // ==========================================
    if (currentCourseTab === 'custom') {
        const prevListEl = document.getElementById('custom-builder-list');
        const prevScrollTop = prevListEl ? prevListEl.scrollTop : 0;

        const selectedNames = Object.keys(customBuilderSelection);
        const primarySet = new Set();
        const secondarySet = new Set();
        let totalKcal = 0;
        let totalSets = 0;

        selectedNames.forEach(name => {
            const sets = customBuilderSelection[name] || 3;
            totalSets += sets;
            const userEx = userCustomExercises.find(u => u.name === name);
            const meta = exerciseMuscleMap[name] || { primary: userEx?.customPrimary || ["core"], secondary: [], kcal: 12 };
            totalKcal += sets * meta.kcal;
            meta.primary.forEach(m => primarySet.add(m));
            (meta.secondary || []).forEach(m => secondarySet.add(m));
        });

        const getPartColor = (muscleKey) => {
            if (primarySet.has(muscleKey)) return "#f43f5e";
            if (secondarySet.has(muscleKey)) return "#fbbf24";
            return "#2d334a";
        };

        const muscleThai = {
            chest: "อก", back: "หลัง", legs: "ต้นขา", glutes: "ก้น",
            shoulders: "ไหล่", arms: "แขน", core: "หน้าท้อง"
        };
        const primaryListThai = [...primarySet].map(m => muscleThai[m] || m).join(", ");
        const secondaryListThai = [...secondarySet].filter(m => !primarySet.has(m)).map(m => muscleThai[m] || m).join(", ");

        const hasUpper = primarySet.has("chest") || primarySet.has("back") || primarySet.has("shoulders") || primarySet.has("arms");
        const hasLower = primarySet.has("legs") || primarySet.has("glutes");
        const hasCore = primarySet.has("core");

        let balanceMsg = "เลือกท่าด้านล่างเพื่อดูจุดกล้ามเนื้อที่โดนวันนี้";
        if (selectedNames.length > 0) {
            if (primarySet.has("chest") && !primarySet.has("back")) {
                balanceMsg = "💡 เล่นอกแล้ว แนะนำเพิ่มท่า <b>หลัง (Superman / Row)</b> สัก 1 ท่าเพื่อกันไหล่งุ้ม";
            } else if (hasUpper && !hasLower) {
                balanceMsg = "💡 วันนี้เน้นช่วงบน รอบหน้าอย่าลืมเก็บ <b>ขา & ก้น</b> เพื่อเร่งการเผาผลาญนะครับ";
            } else if (hasLower && !hasUpper) {
                balanceMsg = "💡 วันนี้เน้นช่วงล่าง เสริม <b>วิดพื้น</b> สัก 2-3 เซตจะได้ครบทั้งตัว";
            } else if (hasUpper && hasLower && hasCore) {
                balanceMsg = "✅ <b>สมดุลยอดเยี่ยม!</b> โดนครบทั้งช่วงบน ช่วงล่าง และแกนกลางลำตัว";
            } else {
                balanceMsg = "✅ จัดสัดส่วนได้ดี! อย่าลืมเกร็งแกนกลางลำตัวทุกท่า";
            }
        }

        const catButtons = [
            { id: "all", label: "ทั้งหมด" },
            { id: "ขา & ก้น", label: "ขา/ก้น" },
            { id: "หน้าอก", label: "อก" },
            { id: "แผ่นหลัง", label: "หลัง" },
            { id: "ไหล่ & แขน", label: "ไหล่/แขน" },
            { id: "หน้าท้อง & แกนกลาง", label: "ท้อง" }
        ];

        const visibleExercises = filteredExercises.filter(ex => customBuilderFilter === "all" || ex.muscle === customBuilderFilter);

        container.innerHTML = `
            <div class="bg-slate-950/90 border border-indigo-500/30 rounded-2xl p-3 space-y-2.5">
                <div class="flex justify-between items-center text-[11px]">
                    <span class="font-bold text-white flex items-center gap-1.5">
                        <i class="fa-solid fa-child-reaching text-rose-400"></i> จุดกล้ามเนื้อที่โดนวันนี้
                    </span>
                    <div class="flex items-center gap-2 text-[10px]">
                        <span class="flex items-center gap-1 text-rose-300"><i class="w-2 h-2 rounded-full bg-rose-500 inline-block"></i>หลัก</span>
                        <span class="flex items-center gap-1 text-amber-300"><i class="w-2 h-2 rounded-full bg-amber-400 inline-block"></i>รอง</span>
                    </div>
                </div>

                <div class="grid grid-cols-12 items-center gap-2">
                    <div class="col-span-6 flex justify-center gap-2 bg-slate-900/90 py-2 px-1 rounded-xl border border-slate-800">
                        <div class="text-center">
                            <svg viewBox="0 0 100 205" class="w-16 h-32">
                                <circle cx="50" cy="18" r="10" fill="#262b3d" />
                                <path d="M35,33 Q50,29 65,33 L69,84 L61,113 L39,113 L31,84 Z" fill="#1b2030" stroke="#333a52" stroke-width="1"/>
                                <ellipse cx="29" cy="41" rx="6.5" ry="8.5" fill="${getPartColor('shoulders')}"/>
                                <ellipse cx="71" cy="41" rx="6.5" ry="8.5" fill="${getPartColor('shoulders')}"/>
                                <path d="M36,37 Q50,41 64,37 L62,57 Q50,61 38,57 Z" fill="${getPartColor('chest')}"/>
                                <rect x="41" y="60" width="18" height="40" rx="4" fill="${getPartColor('core')}"/>
                                <rect x="19" y="51" width="7.5" height="35" rx="3.5" fill="${getPartColor('arms')}"/>
                                <rect x="73.5" y="51" width="7.5" height="35" rx="3.5" fill="${getPartColor('arms')}"/>
                                <path d="M37,115 L49,115 L47,160 L36,160 Z" fill="${getPartColor('legs')}"/>
                                <path d="M51,115 L63,115 L64,160 L53,160 Z" fill="${getPartColor('legs')}"/>
                                <rect x="37" y="163" width="8.5" height="32" rx="4" fill="#262b3d"/>
                                <rect x="54.5" y="163" width="8.5" height="32" rx="4" fill="#262b3d"/>
                            </svg>
                            <span class="text-[9px] text-slate-400 block">ด้านหน้า</span>
                        </div>
                        <div class="text-center">
                            <svg viewBox="0 0 100 205" class="w-16 h-32">
                                <circle cx="50" cy="18" r="10" fill="#262b3d" />
                                <path d="M35,33 Q50,29 65,33 L69,84 L61,113 L39,113 L31,84 Z" fill="#1b2030" stroke="#333a52" stroke-width="1"/>
                                <path d="M36,37 L64,37 L59,85 L41,85 Z" fill="${getPartColor('back')}"/>
                                <rect x="19" y="51" width="7.5" height="35" rx="3.5" fill="${getPartColor('arms')}"/>
                                <rect x="73.5" y="51" width="7.5" height="35" rx="3.5" fill="${getPartColor('arms')}"/>
                                <ellipse cx="43" cy="103" rx="8.5" ry="10.5" fill="${getPartColor('glutes')}"/>
                                <ellipse cx="57" cy="103" rx="8.5" ry="10.5" fill="${getPartColor('glutes')}"/>
                                <path d="M37,116 L49,116 L47,160 L36,160 Z" fill="${getPartColor('legs')}"/>
                                <path d="M51,116 L63,116 L64,160 L53,160 Z" fill="${getPartColor('legs')}"/>
                                <rect x="37" y="163" width="8.5" height="32" rx="4" fill="#262b3d"/>
                                <rect x="54.5" y="163" width="8.5" height="32" rx="4" fill="#262b3d"/>
                            </svg>
                            <span class="text-[9px] text-slate-400 block">ด้านหลัง</span>
                        </div>
                    </div>

                    <div class="col-span-6 space-y-1.5 text-[11px]">
                        <div class="bg-slate-900 p-2 rounded-xl border border-slate-800 space-y-1">
                            <div><span class="text-slate-400">โดนหลัก:</span> <b class="text-rose-400">${primaryListThai || '-'}</b></div>
                            ${secondaryListThai ? `<div><span class="text-slate-400">กล้ามเนื้อรอง:</span> <span class="text-amber-300 font-medium">${secondaryListThai}</span></div>` : ''}
                            <div class="text-[10px] text-orange-300 pt-0.5 border-t border-slate-800/80">
                                รวม ${selectedNames.length} ท่า (${totalSets} เซต) • <b>-${totalKcal} kcal</b>
                            </div>
                        </div>
                        <div class="bg-slate-900/80 p-2 rounded-xl border border-slate-800 text-[10px] text-slate-300 leading-relaxed">
                            ${balanceMsg}
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex flex-wrap gap-1">
                ${catButtons.map(b => `
                    <button type="button" onclick="setBuilderFilter('${b.id}')"
                        class="px-2 py-1 rounded-lg text-[10px] font-semibold border transition ${customBuilderFilter === b.id
                            ? 'bg-indigo-600 text-white border-indigo-400'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'}">
                        ${b.label}
                    </button>
                `).join('')}
            </div>

            <div id="custom-builder-list" class="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                ${visibleExercises.map(ex => {
                    const isChecked = !!customBuilderSelection[ex.name];
                    const sets = customBuilderSelection[ex.name] || 3;
                    const safeName = ex.name.replace(/'/g, "\\'");
                    const meta = exerciseMuscleMap[ex.name] || { primary: ex.customPrimary || ["core"] };
                    const pText = meta.primary.map(m => muscleThai[m] || m).join(",");
                    return `
                        <div class="flex items-center justify-between gap-2 p-2 rounded-xl border transition ${isChecked ? 'bg-indigo-950/40 border-indigo-500/50' : 'bg-slate-950/70 border-slate-800'}">
                            <label class="flex items-start gap-2 cursor-pointer flex-1 min-w-0">
                                <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleBuilderExercise('${safeName}')" class="w-4 h-4 mt-0.5 accent-indigo-500 rounded shrink-0">
                                <div class="min-w-0">
                                    <div class="text-xs font-semibold text-white truncate">${ex.name}</div>
                                    <div class="text-[10px] text-slate-400">เน้น: <span class="text-rose-400">${pText}</span> • ${ex.reps.split('×')[0].trim()}</div>
                                </div>
                            </label>
                            ${isChecked ? `
                                <div class="flex items-center gap-1 shrink-0 bg-slate-900 border border-slate-700 rounded-lg px-1 py-0.5">
                                    <button type="button" onclick="changeBuilderSets('${safeName}', -1, event)" class="w-5 h-5 text-slate-300 hover:text-white text-xs font-bold">-</button>
                                    <span class="text-[11px] font-bold text-amber-300 px-1">${sets} เซต</span>
                                    <button type="button" onclick="changeBuilderSets('${safeName}', 1, event)" class="w-5 h-5 text-slate-300 hover:text-white text-xs font-bold">+</button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="flex gap-1.5 pt-1">
                <input type="text" id="builder-custom-name" placeholder="+ เพิ่มชื่อท่าเอง..." class="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none">
                <select id="builder-custom-muscle" class="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-[11px] text-slate-300">
                    <option value="chest">อก</option>
                    <option value="back">หลัง</option>
                    <option value="legs">ขา</option>
                    <option value="glutes">ก้น</option>
                    <option value="shoulders">ไหล่</option>
                    <option value="arms">แขน</option>
                    <option value="core">ท้อง</option>
                </select>
                <button type="button" onclick="addUserCustomExerciseToBuilder()" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shrink-0">เพิ่ม</button>
            </div>

            <button type="button" onclick="saveCustomBuilderWorkout()" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl shadow-lg shadow-indigo-600/25 transition">
                <i class="fa-solid fa-check mr-1"></i> บันทึกเวทที่เลือกเอง (${selectedNames.length} ท่า • -${totalKcal} kcal)
            </button>
        `;

        const nextListEl = document.getElementById('custom-builder-list');
        if (nextListEl) {
            nextListEl.scrollTop = prevScrollTop;
        }
        return;
    }

    // ==========================================
    // แท็บ 3: คลังท่าเวทเทรนนิ่งทั้งหมดที่ไม่ใช้เครื่อง
    // ==========================================
    if (currentCourseTab === 'library') {
        const groups = ["ขา & ก้น", "หน้าอก", "แผ่นหลัง", "ไหล่ & แขน", "หน้าท้อง & แกนกลาง"];
        const eqLabels = { bodyweight: "มือเปล่า", chair: "เก้าอี้/โต๊ะ", band: "ยางยืด", dumbbell: "ดัมเบล" };

        container.innerHTML = `
            <div class="text-[11px] text-slate-400 px-1">
                พบทั้งหมด <b class="text-white">${filteredExercises.length} ท่า</b> ที่เหมาะกับอุปกรณ์ที่คุณเลือก (ไม่ใช้เครื่องเล่นฟิตเนส)
            </div>
            ${groups.map(g => {
                const list = filteredExercises.filter(ex => ex.muscle === g);
                if (list.length === 0) return '';
                return `
                    <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
                        <div class="text-xs font-bold text-indigo-400">${g} (${list.length} ท่า)</div>
                        <div class="space-y-1.5">
                            ${list.map(ex => {
                                const hasPhoto = !!exercisePhotosMap[ex.name];
                                const safeName = ex.name.replace(/'/g, "\\'");
                                return `
                                    <div class="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80 text-xs">
                                        <div class="flex justify-between items-start gap-2">
                                            <span class="font-semibold text-white">${ex.name}</span>
                                            <span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 shrink-0">${eqLabels[ex.eq] || 'กำหนดเอง'}</span>
                                        </div>
                                        <div class="text-[10px] text-emerald-400 font-medium mt-0.5">${ex.reps}</div>
                                        <div class="text-[10px] text-slate-400 mt-0.5">${ex.tip}</div>
                                        <div class="mt-1.5 flex justify-end">
                                            <button type="button" onclick="openExercisePhotoModal('${safeName}')" class="text-[10px] ${hasPhoto ? 'bg-sky-950 text-sky-300 border-sky-700/50' : 'bg-slate-800 text-slate-300 border-slate-700'} px-2.5 py-1 rounded-lg border transition flex items-center gap-1">
                                                <i class="fa-regular fa-image"></i> ${hasPhoto ? 'ดูรูปสเต็ปท่า' : '+ ใส่รูปตัวอย่าง'}
                                            </button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
        `;
        return;
    }

    // ==========================================
    // แท็บ 1: ตารางวันออก & วันพัก + เลือกเน้นเฉพาะส่วนได้อิสระ
    // ==========================================
    const parts = currentDateKey.split('-');
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayOfWeek = dateObj.getDay();
    const dayNamesShort = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

    const schedules = {
        '3days': [
            { day: 1, type: 'weight', label: 'เวททั่วร่าง A', focus: 'Full Body' },
            { day: 2, type: 'cardio', label: 'เดินเร็ว/คาร์ดิโอ', focus: 'Cardio' },
            { day: 3, type: 'weight', label: 'เวททั่วร่าง B', focus: 'Full Body' },
            { day: 4, type: 'rest',   label: 'วันพักฟื้น', focus: 'Rest' },
            { day: 5, type: 'weight', label: 'เวททั่วร่าง C', focus: 'Full Body' },
            { day: 6, type: 'cardio', label: 'เดิน/กิจกรรมเบา', focus: 'Cardio' },
            { day: 0, type: 'rest',   label: 'วันพักฟื้น', focus: 'Rest' }
        ],
        '4days': [
            { day: 1, type: 'weight', label: 'ช่วงบน (อก/หลัง/แขน)', focus: 'Upper' },
            { day: 2, type: 'weight', label: 'ช่วงล่าง (ขา/ก้น/ท้อง)', focus: 'Lower' },
            { day: 3, type: 'rest',   label: 'วันพักฟื้น', focus: 'Rest' },
            { day: 4, type: 'weight', label: 'ช่วงบน (ไหล่/หลัง/อก)', focus: 'Upper' },
            { day: 5, type: 'weight', label: 'ช่วงล่าง & แกนกลาง', focus: 'Lower' },
            { day: 6, type: 'cardio', label: 'เดินเร็ว 30-40 นาที', focus: 'Cardio' },
            { day: 0, type: 'rest',   label: 'วันพักฟื้น', focus: 'Rest' }
        ],
        '5days': [
            { day: 1, type: 'weight', label: 'อก & หลังแขน', focus: 'Push' },
            { day: 2, type: 'weight', label: 'หลัง & หน้าแขน', focus: 'Pull' },
            { day: 3, type: 'weight', label: 'ขา & สะโพก', focus: 'Legs' },
            { day: 4, type: 'weight', label: 'หัวไหล่ & ท้อง', focus: 'ShouldersCore' },
            { day: 5, type: 'weight', label: 'เวททั่วร่าง + เบิร์น', focus: 'FullBurn' },
            { day: 6, type: 'rest',   label: 'วันพักฟื้น', focus: 'Rest' },
            { day: 0, type: 'rest',   label: 'วันพักฟื้น', focus: 'Rest' }
        ]
    };

    const activePlan = schedules[courseConfig.schedule] || schedules['3days'];
    const basePlan = activePlan.find(p => p.day === dayOfWeek);

    const focusPresetLabels = {
        'Legs': 'เน้นขา & สะโพก (Lower)',
        'ArmsShoulders': 'เน้นแขน & หัวไหล่ (Arms)',
        'ChestBack': 'เน้นอก & แผ่นหลัง (Torso)',
        'CoreBurn': 'เน้นหน้าท้อง & เบิร์นไขมัน',
        'Full Body': 'เวททั่วร่าง (Full Body)'
    };

    let todayPlan = basePlan;
    if (customFocusOverride && focusPresetLabels[customFocusOverride]) {
        todayPlan = {
            day: dayOfWeek,
            type: 'weight',
            label: focusPresetLabels[customFocusOverride],
            focus: customFocusOverride
        };
    }

    const orderedWeek = [1, 2, 3, 4, 5, 6, 0].map(dIdx => activePlan.find(p => p.day === dIdx));
    const weekStripHtml = `
        <div class="grid grid-cols-7 gap-1 text-center">
            ${orderedWeek.map(p => {
                const isToday = p.day === dayOfWeek;
                let badgeColor = 'bg-slate-900 text-slate-400 border-slate-800';
                let icon = '🛌';
                if (p.type === 'weight') {
                    badgeColor = 'bg-indigo-950/80 text-indigo-300 border-indigo-700/50';
                    icon = '💪';
                } else if (p.type === 'cardio') {
                    badgeColor = 'bg-orange-950/70 text-orange-300 border-orange-700/50';
                    icon = '🏃';
                }
                const ring = isToday ? 'ring-2 ring-amber-400' : '';
                return `
                    <div class="p-1.5 rounded-xl border ${badgeColor} ${ring}">
                        <div class="text-[10px] font-bold">${dayNamesShort[p.day]}</div>
                        <div class="text-xs my-0.5">${icon}</div>
                        <div class="text-[8px] leading-tight">${p.type === 'weight' ? 'เวท' : (p.type === 'cardio' ? 'คาร์ดิโอ' : 'พัก')}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    const focusSelectorHtml = `
        <div class="bg-slate-950/80 p-2.5 rounded-2xl border border-slate-800 space-y-1.5">
            <div class="flex justify-between items-center">
                <span class="text-[10px] font-semibold text-amber-300">🎯 ปรับจุดเน้นวันนี้ (เลือกเฉพาะส่วนได้):</span>
                ${customFocusOverride ? `<button type="button" onclick="setCustomWorkoutFocus(null)" class="text-[10px] text-slate-400 hover:text-white underline">รีเซ็ตตามตาราง</button>` : ''}
            </div>
            <div class="flex flex-wrap gap-1.5 text-[10px]">
                <button type="button" onclick="setCustomWorkoutFocus(null)" class="px-2 py-1 rounded-lg border transition ${!customFocusOverride ? 'bg-indigo-600 text-white border-indigo-400 font-semibold' : 'bg-slate-900 text-slate-300 border-slate-800'}">ตามตารางวัน</button>
                <button type="button" onclick="setCustomWorkoutFocus('Legs')" class="px-2 py-1 rounded-lg border transition ${customFocusOverride === 'Legs' ? 'bg-emerald-600 text-white border-emerald-400 font-semibold' : 'bg-slate-900 text-slate-300 border-slate-800'}">🦵 เน้นขา & ก้น</button>
                <button type="button" onclick="setCustomWorkoutFocus('ArmsShoulders')" class="px-2 py-1 rounded-lg border transition ${customFocusOverride === 'ArmsShoulders' ? 'bg-emerald-600 text-white border-emerald-400 font-semibold' : 'bg-slate-900 text-slate-300 border-slate-800'}">💪 เน้นแขน & ไหล่</button>
                <button type="button" onclick="setCustomWorkoutFocus('ChestBack')" class="px-2 py-1 rounded-lg border transition ${customFocusOverride === 'ChestBack' ? 'bg-emerald-600 text-white border-emerald-400 font-semibold' : 'bg-slate-900 text-slate-300 border-slate-800'}">🏋️ เน้นอก & หลัง</button>
                <button type="button" onclick="setCustomWorkoutFocus('CoreBurn')" class="px-2 py-1 rounded-lg border transition ${customFocusOverride === 'CoreBurn' ? 'bg-emerald-600 text-white border-emerald-400 font-semibold' : 'bg-slate-900 text-slate-300 border-slate-800'}">🔥 ท้อง & เบิร์น</button>
            </div>
        </div>
    `;

    let routineHtml = '';
    if (todayPlan.type === 'rest') {
        routineHtml = `
            <div class="bg-emerald-950/30 border border-emerald-800/40 rounded-2xl p-4 text-center space-y-2">
                <div class="text-2xl">🛌</div>
                <div class="text-sm font-bold text-emerald-300">วันนี้คือ "วันพักฟื้นกล้ามเนื้อ (Rest Day)"</div>
                <p class="text-xs text-slate-300 leading-relaxed">
                    กล้ามเนื้อจะเติบโตและซ่อมแซมตัวเองในวันที่พัก ควรทานโปรตีนให้ถึงเป้า ดื่มน้ำให้เพียงพอ (หรือกดปุ่มด้านบนหากต้องการฝึกเน้นเฉพาะส่วนวันนี้ครับ)
                </p>
            </div>
        `;
    } else if (todayPlan.type === 'cardio') {
        routineHtml = `
            <div class="bg-orange-950/30 border border-orange-800/40 rounded-2xl p-3.5 space-y-2.5">
                <div class="flex justify-between items-center">
                    <div class="text-sm font-bold text-orange-300">🏃 คอร์สคาร์ดิโอ & เผาผลาญไขมัน</div>
                    <span class="text-[10px] bg-orange-950 text-orange-300 px-2 py-0.5 rounded-full border border-orange-700/50">30-40 นาที</span>
                </div>
                <ul class="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                    <li><b>ตัวเลือกที่ 1:</b> เดินเร็วต่อเนื่อง 35–40 นาที (หรือเก็บให้ครบ 8,000–10,000 ก้าว)</li>
                    <li><b>ตัวเลือกที่ 2:</b> วิ่งจ๊อกกิ้งเบาๆ หรือปั่นจักรยาน 30 นาที</li>
                    <li><b>ตัวเลือกที่ 3 (ทำในห้อง):</b> เดินย่ำอยู่กับที่สลับ Mountain Climbers 20 นาที</li>
                </ul>
                <button type="button" onclick="logCourseWorkoutToToday('คอร์สเดินเร็ว/คาร์ดิโอตามตาราง', 35, 190)" class="w-full bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold py-2.5 rounded-xl transition">
                    <i class="fa-solid fa-check mr-1"></i> บันทึกจบคาร์ดิโอวันนี้ (-190 kcal)
                </button>
            </div>
        `;
    } else {
        const pickByMuscle = (muscle, count) => {
            const list = filteredExercises.filter(e => e.muscle === muscle);
            const prioritized = [
                ...list.filter(e => e.eq !== 'bodyweight'),
                ...list.filter(e => e.eq === 'bodyweight')
            ];
            return prioritized.slice(0, count);
        };

        let selectedRoutine = [];
        if (todayPlan.focus === 'Upper') {
            selectedRoutine = [...pickByMuscle('หน้าอก', 2), ...pickByMuscle('แผ่นหลัง', 2), ...pickByMuscle('ไหล่ & แขน', 2)];
        } else if (todayPlan.focus === 'Lower' || todayPlan.focus === 'Legs') {
            selectedRoutine = [...pickByMuscle('ขา & ก้น', 4), ...pickByMuscle('หน้าท้อง & แกนกลาง', 1)];
        } else if (todayPlan.focus === 'ArmsShoulders') {
            selectedRoutine = [...pickByMuscle('ไหล่ & แขน', 4), ...pickByMuscle('หน้าอก', 1)];
        } else if (todayPlan.focus === 'ChestBack') {
            selectedRoutine = [...pickByMuscle('หน้าอก', 3), ...pickByMuscle('แผ่นหลัง', 3)];
        } else if (todayPlan.focus === 'CoreBurn') {
            selectedRoutine = [...pickByMuscle('หน้าท้อง & แกนกลาง', 4), ...pickByMuscle('ขา & ก้น', 1)];
        } else if (todayPlan.focus === 'Push') {
            selectedRoutine = [...pickByMuscle('หน้าอก', 3), ...pickByMuscle('ไหล่ & แขน', 2)];
        } else if (todayPlan.focus === 'Pull') {
            selectedRoutine = [...pickByMuscle('แผ่นหลัง', 3), ...pickByMuscle('ไหล่ & แขน', 2)];
        } else if (todayPlan.focus === 'ShouldersCore') {
            selectedRoutine = [...pickByMuscle('ไหล่ & แขน', 3), ...pickByMuscle('หน้าท้อง & แกนกลาง', 3)];
        } else {
            selectedRoutine = [
                ...pickByMuscle('ขา & ก้น', 2),
                ...pickByMuscle('หน้าอก', 1),
                ...pickByMuscle('แผ่นหลัง', 1),
                ...pickByMuscle('ไหล่ & แขน', 1),
                ...pickByMuscle('หน้าท้อง & แกนกลาง', 1)
            ];
        }

        routineHtml = `
            <div class="bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-3 space-y-2.5">
                <div class="flex justify-between items-center">
                    <div>
                        <span class="text-[10px] text-indigo-400 font-semibold block">โปรแกรมวันนี้: ${todayPlan.label}</span>
                        <h4 class="text-xs font-bold text-white">ตารางท่าฝึก (${selectedRoutine.length} ท่า • พักระหว่างเซต 60 วิ)</h4>
                    </div>
                    <span class="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-700/50">~35 นาที</span>
                </div>

                <div class="space-y-1.5">
                    ${selectedRoutine.map((ex, idx) => {
                        const hasPhoto = !!exercisePhotosMap[ex.name];
                        const safeName = ex.name.replace(/'/g, "\\'");
                        return `
                            <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-xs">
                                <div class="flex justify-between items-start gap-2">
                                    <span class="font-semibold text-white"><span class="text-amber-400 mr-1">${idx + 1}.</span>${ex.name}</span>
                                    <span class="text-[10px] text-emerald-400 font-semibold shrink-0">${ex.reps}</span>
                                </div>
                                <div class="text-[10px] text-slate-400 mt-0.5">${ex.tip}</div>
                                <div class="mt-1.5 flex justify-end">
                                    <button type="button" onclick="openExercisePhotoModal('${safeName}')" class="text-[10px] ${hasPhoto ? 'bg-sky-950 text-sky-300 border-sky-700/50' : 'bg-slate-800 text-slate-300 border-slate-700'} px-2.5 py-1 rounded-lg border transition flex items-center gap-1">
                                        <i class="fa-regular fa-image"></i> ${hasPhoto ? 'ดูรูปสเต็ปท่า' : '+ ใส่รูปตัวอย่าง'}
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="space-y-1.5 pt-1">
                    <div class="text-[10px] text-slate-400 text-center">เลือกบันทึกตามจำนวนเซตที่เล่นจริงวันนี้:</div>
                    <div class="grid grid-cols-3 gap-1.5">
                        <button type="button" onclick="logCourseWorkoutToToday('คอร์ส${todayPlan.label} (1 เซต)', 12, 70)" class="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold py-2 rounded-xl transition">
                            1 เซต (-70)
                        </button>
                        <button type="button" onclick="logCourseWorkoutToToday('คอร์ส${todayPlan.label} (2 เซต)', 24, 140)" class="bg-indigo-900/80 hover:bg-indigo-800 border border-indigo-700/60 text-indigo-200 text-[11px] font-semibold py-2 rounded-xl transition">
                            2 เซต (-140)
                        </button>
                        <button type="button" onclick="logCourseWorkoutToToday('คอร์ส${todayPlan.label} (ครบ 3 เซต)', 35, 210)" class="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold py-2 rounded-xl transition">
                            3 เซต (-210)
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="space-y-1.5">
            <div class="text-[11px] font-semibold text-slate-300">ตารางสัปดาห์ (กรอบสีทอง = วันที่กำลังเปิดดู)</div>
            ${weekStripHtml}
        </div>
        ${focusSelectorHtml}
        ${routineHtml}
    `;
}

let activeLogModalIndex = null;

function openWorkoutLogDetailModal(logIndex) {
    // ปรับชื่อตัวแปร array รายการออกกำลังกายของวันนั้นให้ตรงกับโค้ดของคุณ
    const logs = window.todayWorkoutLogs || window.workoutLogs || [];
    const log = logs[logIndex];
    if (!log) return;

    activeLogModalIndex = logIndex;

    // รองรับทั้งกรณีที่ log เก็บรายละเอียดท่าไว้เป็น log.exercises หรือแปลงจากข้อความเดิม
    const items = Array.isArray(log.exercises) && log.exercises.length > 0
        ? log.exercises.map(item => ({
            name: item.name,
            sets: item.sets || 1,
            reps: item.reps || ""
        }))
        : parseExercisesFromLogTitle(log.title || log.name || "");

    const modalHtml = `
        <div id="workoutLogDetailModal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3" onclick="if(event.target.id==='workoutLogDetailModal') closeWorkoutLogDetailModal()">
            <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden text-white shadow-2xl">
                <div class="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                    <div>
                        <div class="text-sm font-bold text-white">รายละเอียดเวทที่บันทึกไว้</div>
                        <div class="text-[11px] text-slate-400">รวม ${items.length} ท่า • เผาผลาญประมาณ ${Math.abs(log.kcal || 0)} kcal</div>
                    </div>
                    <button type="button" onclick="closeWorkoutLogDetailModal()" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="p-3 overflow-y-auto space-y-2.5 flex-1">
                    ${items.map((item, idx) => {
                        const info = findExerciseGuideInfo(item.name);
                        return `
                            <div class="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-2">
                                <div class="flex items-start justify-between gap-2">
                                    <div>
                                        <div class="text-xs font-bold text-indigo-300">${idx + 1}. ${item.name}</div>
                                        <div class="text-[11px] text-slate-400 mt-0.5">
                                            กล้ามเนื้อ: <span class="text-rose-400">${info.muscleText}</span>
                                            ${item.reps ? ` • ${item.reps}` : ''}
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-0.5 shrink-0">
                                        <button type="button" onclick="changeLogItemSets(${idx}, -1)" class="w-5 h-5 text-slate-300 hover:text-white font-bold">-</button>
                                        <span id="logModalSets_${idx}" class="text-xs font-semibold text-amber-300 min-w-[42px] text-center">${item.sets} เซต</span>
                                        <button type="button" onclick="changeLogItemSets(${idx}, 1)" class="w-5 h-5 text-slate-300 hover:text-white font-bold">+</button>
                                    </div>
                                </div>

                                <div class="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 text-[11px] leading-relaxed text-slate-300">
                                    <div class="font-semibold text-emerald-400 mb-1">วิธีทำ & ข้อควรระวัง:</div>
                                    <div>${info.howTo}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="p-3 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-900">
                    <button type="button" onclick="closeWorkoutLogDetailModal()" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300">
                        ปิด
                    </button>
                    <button type="button" onclick="saveWorkoutLogChanges()" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white">
                        บันทึกการแก้ไข
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('workoutLogDetailModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    window._tempLogModalItems = items;
}

function closeWorkoutLogDetailModal() {
    document.getElementById('workoutLogDetailModal')?.remove();
    window._tempLogModalItems = null;
    activeLogModalIndex = null;
}

function changeLogItemSets(idx, delta) {
    if (!window._tempLogModalItems || !window._tempLogModalItems[idx]) return;
    const nextSets = Math.max(1, (window._tempLogModalItems[idx].sets || 1) + delta);
    window._tempLogModalItems[idx].sets = nextSets;
    const el = document.getElementById(`logModalSets_${idx}`);
    if (el) el.textContent = `${nextSets} เซต`;
}

function parseExercisesFromLogTitle(title) {
    // ดึงชื่อท่าจากข้อความรูปแบบ "... (4 ท่า: ท่า1, ท่า2, ท่า3...)"
    const match = title.match(/:\s*([^)]+)\)?$/);
    if (!match) return [{ name: title, sets: 1, reps: "" }];
    return match[1]
        .replace(/\.\.\.$/, '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(name => ({ name, sets: 1, reps: "" }));
}

function findExerciseGuideInfo(exName) {
    // ค้นหาข้อมูลท่าจากคลังท่าเริ่มต้นหรือท่าที่ผู้ใช้สร้างเอง
    const allSources = [
        ...(typeof userCustomExercises !== 'undefined' ? userCustomExercises : []),
        ...(typeof allExercises !== 'undefined' ? allExercises : []),
        ...(typeof exerciseLibrary !== 'undefined' ? exerciseLibrary : [])
    ];

    const found = allSources.find(e =>
        e && e.name && (e.name.toLowerCase() === exName.toLowerCase() || e.name.toLowerCase().includes(exName.toLowerCase()))
    );

    const muscleText = found?.muscle
        || (Array.isArray(found?.customPrimary) ? found.customPrimary.join(', ') : null)
        || "ระบุตามท่าที่เลือก";

    const howTo = found?.howTo
        || found?.guide
        || found?.instruction
        || found?.tip
        || "รักษาแนวกระดูกสันหลังให้เป็นกลาง เกร็งแกนกลางลำตัว หายใจออกจังหวะออกแรง และควบคุมความเร็วไม่กระชาก (สามารถเพิ่มคำอธิบายท่านี้ในคลังข้อมูลท่าได้ครับ)";

    return { muscleText, howTo };
}

function logCourseWorkoutToToday(title, duration, calories) {
    const dayData = getDayData(currentDateKey);
    dayData.workouts.push({
        type: title,
        duration: Number(duration) || 0,
        calories: Number(calories) || 0
    });
    closeWorkoutCourseModal();
    saveDataAndSync();
    alert(`บันทึก "${title}" (-${calories} kcal) ลงในรายการออกกำลังกายของวันที่ ${currentDateKey} เรียบร้อยแล้ว!`);
}

let customFocusOverride = null;

function setCustomWorkoutFocus(focusKey) {
    customFocusOverride = focusKey;
    renderWorkoutCourseContent();
}

function openExercisePhotoModal(exName) {
    activeExerciseNameForPhoto = exName;
    document.getElementById('ex-photo-title').innerText = exName;
    document.getElementById('exercise-photo-modal').classList.remove('hidden');
    loadExercisePhoto(exName);
}

function closeExercisePhotoModal() {
    document.getElementById('exercise-photo-modal').classList.add('hidden');
}

function triggerExercisePhotoUpload() {
    const input = document.getElementById('ex-photo-input');
    input.value = '';
    input.click();
}

async function loadExercisePhoto(exName) {
    const box = document.getElementById('ex-photo-display-box');
    const status = document.getElementById('ex-photo-status');
    const photoPath = exercisePhotosMap[exName];

    if (!photoPath) {
        box.innerHTML = `<div class="text-center p-6 space-y-1"><i class="fa-regular fa-image text-2xl text-slate-600"></i><div class="text-xs text-slate-400">ยังไม่มีรูปตัวอย่าง กดปุ่มด้านล่างเพื่อใส่รูปที่เจนไว้ได้เลย</div></div>`;
        status.innerText = "";
        return;
    }

    if (photoBlobCache[photoPath]) {
        box.innerHTML = `<img src="${photoBlobCache[photoPath]}" class="w-full max-h-[65vh] object-contain rounded-xl">`;
        status.innerText = "โหลดจากแคชแล้ว";
        return;
    }

    const token = localStorage.getItem('fitTracker_github_token');
    if (!token) {
        status.innerText = "กรุณาใส่ GitHub Token เพื่อโหลดรูป";
        return;
    }

    box.innerHTML = `<div class="text-xs text-sky-400 py-8"><i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังโหลดรูปตัวอย่าง...</div>`;
    try {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${photoPath}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const dataUrl = `data:image/jpeg;base64,${data.content.replace(/\s/g, '')}`;
        photoBlobCache[photoPath] = dataUrl;
        box.innerHTML = `<img src="${dataUrl}" class="w-full max-h-[65vh] object-contain rounded-xl">`;
        status.innerText = "ซิงก์จาก Cloud แล้ว";
    } catch (e) {
        box.innerHTML = `<div class="text-xs text-rose-400 py-6">ไม่พบไฟล์รูปบน Cloud</div>`;
    }
}

async function handleExercisePhotoSelected(event) {
    const file = event.target.files[0];
    if (!file || !activeExerciseNameForPhoto) return;

    const status = document.getElementById('ex-photo-status');
    const box = document.getElementById('ex-photo-display-box');
    status.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังอัปโหลดรูป...';

    const base64 = await resizeImageToBase64(file, 900);
    const token = localStorage.getItem('fitTracker_github_token');
    if (!token) {
        alert("กรุณาเชื่อมต่อ GitHub Token ในหน้าตั้งค่า (⚙️) ก่อนอัปโหลดรูปครับ");
        return;
    }

    const fileName = `exercises/ex_${Date.now()}.jpg`;
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
                message: `Upload exercise guide ${activeExerciseNameForPhoto}`,
                content: base64
            })
        });
        if (!res.ok) throw new Error("Upload failed");

        const dataUrl = `data:image/jpeg;base64,${base64}`;
        photoBlobCache[fileName] = dataUrl;
        exercisePhotosMap[activeExerciseNameForPhoto] = fileName;
        localStorage.setItem('fitTracker_ex_photos', JSON.stringify(exercisePhotosMap));

        box.innerHTML = `<img src="${dataUrl}" class="w-full max-h-[65vh] object-contain rounded-xl">`;
        status.innerText = "บันทึกขึ้น Cloud เรียบร้อย!";
        renderWorkoutCourseContent();
        await pushToGitHub(false);
    } catch (err) {
        status.innerText = "อัปโหลดไม่สำเร็จ";
    }
}

// ==========================================
// Skincare & Body Care Routine Reminder
// ==========================================
const defaultSkincareItems = [
    // ==========================================
    // ☀️ ตอนเช้า (ทุกวัน)
    // ==========================================
    { id: 'sk_m1', period: 'morning', name: '[หน้า] 1. ล้างหน้าด้วย Senka Perfect Whip Collagen In', days: [] },
    { id: 'sk_m2', period: 'morning', name: '[หน้า] 2. เช็ดผิวทั่วหน้าและลำคอด้วย Elite Care Serum Pad (1 แผ่น)', days: [] },
    { id: 'sk_m3', period: 'morning', name: '[หน้า] 3. ทา MizuMi Cica Soothing Gel 2 ข้อนิ้ว บริเวณใบหน้าและลำคอ', days: [] },
    { id: 'sk_m4', period: 'morning', name: '[หน้า] 4. ทากันแดด MizuMi UV Water Serum 2 ข้อนิ้ว ทั่วหน้าและลำคอ', days: [] },
    { id: 'sk_m5', period: 'morning', name: '[ตัว] 5. อาบน้ำ WATERCOME + ทาเซรั่ม & โลชั่น WATERCOME', days: [] },
    { id: 'sk_m6', period: 'morning', name: '[ตัว] 6. ทากันแดด MizuMi UV Cooling Body Serum ทั่วผิวกาย', days: [] },

    // ==========================================
    // 🌙 ก่อนนอน (ทุกวัน)
    // ==========================================
    { id: 'sk_n1', period: 'night',   name: '[หน้า] 1. ล้างหน้าด้วย Senka Perfect Whip Collagen In', days: [] },
    { id: 'sk_n2', period: 'night',   name: '[หน้า] 2. แปะ Elite Care Serum Pad ทิ้งไว้ 3-5 นาที แล้วเช็ดเบาๆ', days: [] },
    { id: 'sk_n3', period: 'night',   name: '[หน้า] 3. แปะ Luna Jelly Eye Mask ใต้ตา 10-15 นาที แล้วลอกออก', days: [] },
    { id: 'sk_n4', period: 'night',   name: '[หน้า] 4. ทา MizuMi Cica Soothing Gel 2 ข้อนิ้ว บริเวณใบหน้าและลำคอ', days: [] },
    { id: 'sk_n5', period: 'night',   name: '[ตัว] 5. อาบน้ำ WATERCOME + ทา MizuMi B3 AHA (งดคืนที่สครับผิว)', days: [] },
    { id: 'sk_n6', period: 'night',   name: '[ตัว] 6. ทาโลชั่น WATERCOME ทับทั่วผิวกายเพื่อล็อกความชุ่มชื้น', days: [] },

    // ==========================================
    // ✨ เตือนรายสัปดาห์ (สครับ & มาส์กหน้า)
    // ==========================================
    { id: 'sk_w1', period: 'weekly',  name: '[ตัว] สครับขัดผิว WATERCOME (งดทา MizuMi B3 AHA คืนนี้)', days: [3, 6] }, // พุธ, เสาร์
    { id: 'sk_w2', period: 'weekly',  name: '[หน้า] แปะแผ่นมาส์ก Myu-Nique 15-20 นาที ก่อนลง Cica Gel', days: [4, 0] }   // พฤหัสบดี, อาทิตย์
];

const savedSkincare = JSON.parse(localStorage.getItem('fitTracker_skincare_items') || 'null');
let skincareItems = (savedSkincare && savedSkincare.length > 0) ? savedSkincare : [...defaultSkincareItems];
let skincareLogs = JSON.parse(localStorage.getItem('fitTracker_skincare_logs') || '{}');

function openSkincareModal() {
    renderSkincareContent();
    document.getElementById('skincare-modal').classList.remove('hidden');
}

function closeSkincareModal() {
    document.getElementById('skincare-modal').classList.add('hidden');
}

function toggleSkincareDaysSelect() {
    const period = document.getElementById('skincare-new-period').value;
    const picker = document.getElementById('skincare-days-picker');
    if (period === 'weekly') {
        picker.classList.remove('hidden');
    } else {
        picker.classList.add('hidden');
    }
}

function toggleSkincareCheck(itemId) {
    if (!skincareLogs[currentDateKey]) skincareLogs[currentDateKey] = [];
    const idx = skincareLogs[currentDateKey].indexOf(itemId);
    if (idx > -1) {
        skincareLogs[currentDateKey].splice(idx, 1);
    } else {
        skincareLogs[currentDateKey].push(itemId);
    }
    localStorage.setItem('fitTracker_skincare_logs', JSON.stringify(skincareLogs));
    renderSkincareContent();
    if (typeof pushToGitHub === 'function') {
        pushToGitHub(false);
    }
}

function addSkincareItem() {
    const period = document.getElementById('skincare-new-period').value;
    const nameInput = document.getElementById('skincare-new-name');
    const name = nameInput.value.trim();
    if (!name) return;

    let days = [];
    if (period === 'weekly') {
        document.querySelectorAll('.sk-day-cb:checked').forEach(cb => days.push(parseInt(cb.value)));
        if (days.length === 0) {
            alert('กรุณาเลือกวันในสัปดาห์ที่ต้องการให้เตือนอย่างน้อย 1 วันครับ');
            return;
        }
    }

    skincareItems.push({
        id: 'sk_' + Date.now(),
        period: period,
        name: name,
        days: days
    });
    localStorage.setItem('fitTracker_skincare_items', JSON.stringify(skincareItems));

    nameInput.value = '';
    document.querySelectorAll('.sk-day-cb').forEach(cb => cb.checked = false);
    renderSkincareContent();
}

function deleteSkincareItem(itemId) {
    if (!confirm('ลบรายการนี้ออกจากตารางดูแลผิว?')) return;
    skincareItems = skincareItems.filter(item => item.id !== itemId);
    localStorage.setItem('fitTracker_skincare_items', JSON.stringify(skincareItems));
    renderSkincareContent();
}

function resetDefaultSkincare() {
    if (!confirm('โหลดรายการสกินแคร์เริ่มต้นทั้ง 14 ขั้นตอนกลับมาใช่ไหม?')) return;
    skincareItems = [...defaultSkincareItems];
    localStorage.setItem('fitTracker_skincare_items', JSON.stringify(skincareItems));
    renderSkincareContent();
    if (typeof pushToGitHub === 'function') pushToGitHub(false);
}

let skincarePhotosMap = JSON.parse(localStorage.getItem('fitTracker_skincare_photos') || '{}');
let activeSkincareIdForPhoto = '';

function openSkincarePhotoModal(itemId, itemName) {
    activeSkincareIdForPhoto = itemId;
    document.getElementById('sk-photo-title').innerText = itemName;
    document.getElementById('skincare-photo-modal').classList.remove('hidden');
    loadSkincarePhoto(itemId);
}

function closeSkincarePhotoModal() {
    document.getElementById('skincare-photo-modal').classList.add('hidden');
}

function triggerSkincarePhotoUpload() {
    const input = document.getElementById('sk-photo-input');
    input.value = '';
    input.click();
}

async function loadSkincarePhoto(itemId) {
    const box = document.getElementById('sk-photo-display-box');
    const status = document.getElementById('sk-photo-status');
    const photoPath = skincarePhotosMap[itemId];

    if (!photoPath) {
        box.innerHTML = `<div class="text-center p-6 space-y-1"><i class="fa-regular fa-image text-2xl text-slate-600"></i><div class="text-xs text-slate-400">ยังไม่มีรูปผลิตภัณฑ์ กดปุ่มด้านล่างเพื่อเพิ่มรูปได้เลย</div></div>`;
        status.innerText = "";
        return;
    }

    if (photoBlobCache[photoPath]) {
        box.innerHTML = `<img src="${photoBlobCache[photoPath]}" class="w-full max-h-[65vh] object-contain rounded-xl">`;
        status.innerText = "โหลดจากแคชแล้ว";
        return;
    }

    const token = localStorage.getItem('fitTracker_github_token');
    if (!token) {
        status.innerText = "กรุณาใส่ GitHub Token เพื่อโหลดรูป";
        return;
    }

    box.innerHTML = `<div class="text-xs text-pink-400 py-8"><i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังโหลดรูป...</div>`;
    try {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${photoPath}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const dataUrl = `data:image/jpeg;base64,${data.content.replace(/\s/g, '')}`;
        photoBlobCache[photoPath] = dataUrl;
        box.innerHTML = `<img src="${dataUrl}" class="w-full max-h-[65vh] object-contain rounded-xl">`;
        status.innerText = "ซิงก์จาก Cloud แล้ว";
    } catch (e) {
        box.innerHTML = `<div class="text-xs text-rose-400 py-6">ไม่พบไฟล์รูปบน Cloud</div>`;
    }
}

async function handleSkincarePhotoSelected(event) {
    const file = event.target.files[0];
    if (!file || !activeSkincareIdForPhoto) return;

    const status = document.getElementById('sk-photo-status');
    const box = document.getElementById('sk-photo-display-box');
    status.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังอัปโหลดรูป...';

    const base64 = await resizeImageToBase64(file, 900);
    const token = localStorage.getItem('fitTracker_github_token');
    if (!token) {
        alert("กรุณาเชื่อมต่อ GitHub Token ในหน้าตั้งค่า (⚙️) ก่อนอัปโหลดรูปครับ");
        return;
    }

    const fileName = `skincare/sk_${Date.now()}.jpg`;
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
                message: `Upload skincare photo ${activeSkincareIdForPhoto}`,
                content: base64
            })
        });
        if (!res.ok) throw new Error("Upload failed");

        const dataUrl = `data:image/jpeg;base64,${base64}`;
        photoBlobCache[fileName] = dataUrl;
        skincarePhotosMap[activeSkincareIdForPhoto] = fileName;
        localStorage.setItem('fitTracker_skincare_photos', JSON.stringify(skincarePhotosMap));

        box.innerHTML = `<img src="${dataUrl}" class="w-full max-h-[65vh] object-contain rounded-xl">`;
        status.innerText = "บันทึกขึ้น Cloud เรียบร้อย!";
        renderSkincareContent();
        await pushToGitHub(false);
    } catch (err) {
        status.innerText = "อัปโหลดไม่สำเร็จ";
    }
}

function selectSkincareWeekDay(dateStr) {
    currentDateKey = dateStr;
    if (typeof renderUIOnly === 'function') renderUIOnly();
    renderSkincareContent();
}

function renderSkincareContent() {
    const weekStrip = document.getElementById('skincare-week-strip');
    const alertBox = document.getElementById('skincare-today-alert');
    const listBox = document.getElementById('skincare-list-container');
    if (!listBox) return;

    const parts = currentDateKey.split('-');
    const selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayOfWeek = selectedDate.getDay(); // 0 = อาทิตย์ ... 6 = เสาร์
    const dayNamesShort = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    const dayNamesFull = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
    const checkedIds = skincareLogs[currentDateKey] || [];

    // หาวันอาทิตย์เริ่มต้นของสัปดาห์ที่กำลังเลือก
    const sundayOfWeek = new Date(selectedDate);
    sundayOfWeek.setDate(selectedDate.getDate() - dayOfWeek);

    const todayObj = new Date();
    const todayKey = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

    // สร้างแถบปฏิทิน อา - ส
    if (weekStrip) {
        let stripHtml = `<div class="grid grid-cols-7 gap-1 bg-slate-950/90 p-1.5 rounded-2xl border border-slate-800">`;
        for (let i = 0; i < 7; i++) {
            const d = new Date(sundayOfWeek);
            d.setDate(sundayOfWeek.getDate() + i);
            const dKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const isSelected = (dKey === currentDateKey);
            const isToday = (dKey === todayKey);
            const hasSpecial = skincareItems.some(item => item.period === 'weekly' && item.days.includes(i));

            stripHtml += `
                <button type="button" onclick="selectSkincareWeekDay('${dKey}')"
                    class="flex flex-col items-center py-1.5 rounded-xl border transition ${isSelected
                        ? 'bg-pink-600 border-pink-400 text-white shadow-md shadow-pink-600/20'
                        : isToday
                            ? 'bg-slate-900 border-pink-500/40 text-pink-300'
                            : 'bg-slate-900/60 border-transparent text-slate-400 hover:bg-slate-800'}">
                    <span class="text-[10px] font-medium">${dayNamesShort[i]}</span>
                    <span class="text-xs font-bold mt-0.5">${d.getDate()}</span>
                    <span class="w-1.5 h-1.5 rounded-full mt-1 ${hasSpecial ? (isSelected ? 'bg-white' : 'bg-pink-400') : 'bg-transparent'}"></span>
                </button>
            `;
        }
        stripHtml += `</div>`;
        weekStrip.innerHTML = stripHtml;
    }

    // แสดงสรุปสิ่งที่ต้องทำในวันที่เลือก (เน้นคิวพิเศษ + บำรุงปกติ)
    const dueWeeklyToday = skincareItems.filter(item => item.period === 'weekly' && item.days.includes(dayOfWeek));
    if (dueWeeklyToday.length > 0) {
        alertBox.innerHTML = `
            <div class="bg-pink-950/50 border border-pink-500/40 rounded-2xl p-3 flex items-start gap-2.5">
                <span class="text-base mt-0.5">✨</span>
                <div class="text-xs space-y-0.5">
                    <div class="font-bold text-pink-300">${dayNamesFull[dayOfWeek]}ที่ ${selectedDate.getDate()}: มีคิวพิเศษ!</div>
                    <div class="text-slate-100">${dueWeeklyToday.map(i => i.name).join('<br>')}</div>
                    <div class="text-[10px] text-pink-200/70 pt-0.5">+ บำรุงเช้า & ก่อนนอนตามปกติ</div>
                </div>
            </div>
        `;
    } else {
        alertBox.innerHTML = `
            <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 flex items-center gap-2.5">
                <span class="text-sm">🧴</span>
                <div class="text-xs text-slate-300">
                    <span class="font-bold text-white">${dayNamesFull[dayOfWeek]}ที่ ${selectedDate.getDate()}:</span> บำรุงเช้า & ก่อนนอนตามตารางปกติ (ไม่มีคิวสครับ/มาส์ก)
                </div>
            </div>
        `;
    }

    const renderGroup = (title, icon, items) => {
        if (items.length === 0) return '';
        return `
            <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
                <div class="text-xs font-bold text-slate-200 flex items-center gap-1.5">${icon} ${title}</div>
                <div class="space-y-1.5">
                    ${items.map(item => {
                        const isChecked = checkedIds.includes(item.id);
                        const hasPhoto = !!skincarePhotosMap[item.id];
                        const safeName = item.name.replace(/'/g, "\\'");
                        const dayBadge = item.period === 'weekly'
                            ? `<span class="text-[9px] bg-pink-950 text-pink-300 border border-pink-700/50 px-1.5 py-0.5 rounded ml-1.5">${item.days.map(d => dayNamesShort[d]).join(', ')}</span>`
                            : '';
                        return `
                            <div class="bg-slate-900/90 p-2.5 rounded-xl border ${isChecked ? 'border-emerald-700/50 bg-emerald-950/20' : 'border-slate-800'} space-y-1.5">
                                <div class="flex items-start justify-between gap-2">
                                    <label class="flex items-start gap-2.5 cursor-pointer flex-1">
                                        <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleSkincareCheck('${item.id}')" class="w-4 h-4 mt-0.5 accent-pink-500 rounded shrink-0">
                                        <span class="text-xs ${isChecked ? 'line-through text-slate-500' : 'text-slate-100'}">${item.name}${dayBadge}</span>
                                    </label>
                                    <button type="button" onclick="deleteSkincareItem('${item.id}')" class="text-slate-600 hover:text-rose-400 text-xs px-1 shrink-0">
                                        <i class="fa-solid fa-trash-can"></i>
                                    </button>
                                </div>
                                <div class="flex justify-end">
                                    <button type="button" onclick="openSkincarePhotoModal('${item.id}', '${safeName}')" class="text-[10px] ${hasPhoto ? 'bg-pink-950/80 text-pink-300 border-pink-700/50' : 'bg-slate-800 text-slate-300 border-slate-700'} px-2.5 py-1 rounded-lg border transition flex items-center gap-1">
                                        <i class="fa-regular fa-image"></i> ${hasPhoto ? 'ดูรูปขวด/สินค้า' : '+ เพิ่มรูปสินค้า'}
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    };

    listBox.innerHTML =
        renderGroup('บำรุงตอนเช้า (ทุกวัน)', '☀️', skincareItems.filter(i => i.period === 'morning')) +
        renderGroup('บำรุงก่อนนอน (ทุกวัน)', '🌙', skincareItems.filter(i => i.period === 'night')) +
        renderGroup('ตารางสครับ & มาส์กหน้า (รายสัปดาห์)', '✨', skincareItems.filter(i => i.period === 'weekly'));
}

// ==========================================
// Fat & Sugar Burn Mode Switcher & 7-Day Plan (7-11 & Market)
// ==========================================
let burnPlanSelectedDay = new Date().getDay(); // 0=อา, 1=จ ... 6=ส

const fatBurnWeeklyMeals = [
    {
        dayName: "อาทิตย์",
        lunch: { name: "ก๋วยเตี๋ยวเส้นหมี่น้ำใสลูกชิ้นปลา/อกไก่ (ไม่ซดน้ำ) + ไข่ต้ม 2 ฟอง", calories: 510, protein: 38, carbs: 46, sugar: 3, fiber: 2, fat: 14, satFat: 4, transFat: 0, sodium: 680, potassium: 280, cholesterol: 390 },
        snack: { name: "นมโปรตีนสูงสูตรไม่เติมน้ำตาล (1 ขวด)", calories: 150, protein: 28, carbs: 8, sugar: 6, fiber: 0, fat: 1, satFat: 0.5, transFat: 0, sodium: 150, potassium: 380, cholesterol: 15 },
        dinner: { name: "อกไก่นุ่ม 7-11 (2 ชิ้น) + ไข่ต้ม 2 ฟอง + สลัดผักล้วน + น้ำสลัดงาดำคีโต 1.5 ชต.", calories: 490, protein: 55, carbs: 13, sugar: 2, fiber: 4, fat: 23, satFat: 5, transFat: 0, sodium: 550, potassium: 420, cholesterol: 430 }
    },
    {
        dayName: "จันทร์",
        lunch: { name: "ข้าวกล้อง 1.5 ทัพพี + น้ำพริกทูน่า + ไข่ต้ม 2 ฟอง + ผักต้ม", calories: 560, protein: 42, carbs: 45, sugar: 3, fiber: 5, fat: 16, satFat: 4, transFat: 0, sodium: 620, potassium: 450, cholesterol: 395 },
        snack: { name: "นมโปรตีนสูงสูตรไม่เติมน้ำตาล (1 ขวด)", calories: 150, protein: 28, carbs: 8, sugar: 6, fiber: 0, fat: 1, satFat: 0.5, transFat: 0, sodium: 150, potassium: 380, cholesterol: 15 },
        dinner: { name: "อกไก่นุ่ม 7-11 (2 ชิ้น) + สลัดมิกซ์ออร์แกนิค + บ้านพลอยสลัดงาดำคีโต 1.5 ชต.", calories: 360, protein: 47, carbs: 13, sugar: 2, fiber: 4, fat: 13, satFat: 2.5, transFat: 0, sodium: 480, potassium: 390, cholesterol: 95 }
    },
    {
        dayName: "อังคาร",
        lunch: { name: "เกาเหลาไก่ฉีก/หมูชิ้น (ไม่เจียว) + ข้าวสวย 1 ทัพพี + ไข่ต้ม 1 ฟอง", calories: 520, protein: 38, carbs: 42, sugar: 3, fiber: 3, fat: 18, satFat: 5, transFat: 0, sodium: 780, potassium: 360, cholesterol: 240 },
        snack: { name: "เฉาก๊วยเนื้อล้วนไม่หวาน + ไซรัปหญ้าหวาน 0 kcal + เมล็ดฟักทองอบ 15g", calories: 115, protein: 5, carbs: 8, sugar: 0, fiber: 3, fat: 7, satFat: 1.2, transFat: 0, sodium: 15, potassium: 140, cholesterol: 0 },
        dinner: { name: "ปลานิล/ปลาทับทิมนึ่งหรือเผา (เนื้อ ~200g) + ผักลวก + น้ำจิ้มซีฟู้ด", calories: 480, protein: 52, carbs: 8, sugar: 2, fiber: 4, fat: 22, satFat: 5, transFat: 0, sodium: 540, potassium: 620, cholesterol: 135 }
    },
    {
        dayName: "พุธ",
        lunch: { name: "ข้าวกล้อง 1.5 ทัพพี + อกไก่ผัดพริกแกง (ผัดน้ำ) + ไข่ดาวน้ำ 1 ฟอง", calories: 550, protein: 44, carbs: 46, sugar: 3, fiber: 4, fat: 15, satFat: 3.5, transFat: 0, sodium: 690, potassium: 440, cholesterol: 245 },
        snack: { name: "นมอัลมอนด์สูตรไม่หวาน 1 กล่อง + ไข่ต้ม 7-11 (2 ฟอง)", calories: 180, protein: 14, carbs: 3, sugar: 1, fiber: 1, fat: 12, satFat: 3.4, transFat: 0, sodium: 260, potassium: 190, cholesterol: 372 },
        dinner: { name: "ยำทูน่ากระป๋องในน้ำแร่ (1 กป.) + ผักสลัด/แตงกวา/มะเขือเทศ", calories: 380, protein: 46, carbs: 10, sugar: 4, fiber: 4, fat: 14, satFat: 2, transFat: 0, sodium: 520, potassium: 480, cholesterol: 55 }
    },
    {
        dayName: "พฤหัสบดี",
        lunch: { name: "สุกี้แห้งไก่ (วุ้นเส้นครึ่งห่อ ราดน้ำจิ้มครึ่งถ้วย) + ไข่ต้ม 1 ฟอง", calories: 495, protein: 35, carbs: 46, sugar: 6, fiber: 4, fat: 14, satFat: 3.5, transFat: 0, sodium: 890, potassium: 350, cholesterol: 240 },
        snack: { name: "ชาเขียว/ชาไทยชงนมอัลมอนด์ไม่หวาน + หญ้าหวาน + ถั่วแระญี่ปุ่น", calories: 160, protein: 12, carbs: 10, sugar: 2, fiber: 5, fat: 8, satFat: 1, transFat: 0, sodium: 180, potassium: 460, cholesterol: 0 },
        dinner: { name: "สันในไก่ย่าง/อบหม้อทอด 200g + สลัดผักรวม + น้ำสลัดงาดำคีโต 1.5 ชต.", calories: 490, protein: 54, carbs: 10, sugar: 2, fiber: 4, fat: 22, satFat: 4, transFat: 0, sodium: 420, potassium: 510, cholesterol: 120 }
    },
    {
        dayName: "ศุกร์",
        lunch: { name: "ข้าวกล้อง 1.5 ทัพพี + หมูสันในอบกระเทียม + แตงกวาสด", calories: 540, protein: 40, carbs: 44, sugar: 2, fiber: 4, fat: 18, satFat: 5, transFat: 0, sodium: 610, potassium: 490, cholesterol: 115 },
        snack: { name: "นมโปรตีนสูงสูตร 0% น้ำตาล 1 ขวด + เฉาก๊วยไม่หวานราดไซรัปคีโต", calories: 185, protein: 28, carbs: 12, sugar: 6, fiber: 2, fat: 1, satFat: 0.5, transFat: 0, sodium: 160, potassium: 390, cholesterol: 15 },
        dinner: { name: "ไข่ตุ๋นทรงเครื่อง (ไข่ 3 ฟอง + อกไก่สับ 100g) + ผักกาดขาวต้ม", calories: 450, protein: 45, carbs: 7, sugar: 2, fiber: 3, fat: 24, satFat: 6.5, transFat: 0, sodium: 560, potassium: 460, cholesterol: 615 }
    },
    {
        dayName: "เสาร์",
        lunch: { name: "ข้าวไรซ์เบอร์รี่ 1.5 ทัพพี + แกงจืดเต้าหู้ไข่หมูสับ + ไข่ต้ม 1 ฟอง", calories: 530, protein: 36, carbs: 45, sugar: 3, fiber: 4, fat: 19, satFat: 5.5, transFat: 0, sodium: 720, potassium: 410, cholesterol: 255 },
        snack: { name: "HEYTEA สูตรน้ำตาลน้อย (ผสมน้ำเปล่า/โซดา) + อกไก่ฉีก 7-11 (1 ซอง)", calories: 175, protein: 22, carbs: 14, sugar: 12, fiber: 0, fat: 2, satFat: 0.5, transFat: 0, sodium: 340, potassium: 190, cholesterol: 45 },
        dinner: { name: "ปลากะพงลวกจิ้ม / ปลาซาบะย่างซีอิ๊ว (ครึ่งตัว) + ผักสด/ผักลวก", calories: 460, protein: 44, carbs: 6, sugar: 2, fiber: 4, fat: 26, satFat: 6, transFat: 0, sodium: 520, potassium: 540, cholesterol: 110 }
    }
];

function switchQuickDietMode(modeKey) {
    const p = goalPresets[modeKey] || goalPresets.fat_loss;
    userGoals = Object.assign({}, userGoals, {
        preset: modeKey,
        calories: p.calories,
        minCalories: p.minCalories,
        proteinMin: p.proteinMin,
        proteinMax: p.proteinMax,
        carbsMax: p.carbsMax,
        fatMax: p.fatMax,
        sugarMax: p.sugarMax ?? 24,
        sodiumMax: p.sodiumMax ?? 2000
    });

    const currentDayObj = getDayData(currentDateKey);
    currentDayObj.targetMin = userGoals.minCalories;
    currentDayObj.targetMax = userGoals.calories;

    saveDataAndSync();
}

function selectBurnPlanDay(dayIdx) {
    burnPlanSelectedDay = dayIdx;
    renderBurnModeCard();
}

function addBurnPlanMeal(dayIdx, mealSlot) {
    const plan = fatBurnWeeklyMeals[dayIdx];
    if (!plan || !plan[mealSlot]) return;

    const mealMap = {
        lunch: "มื้อเที่ยง",
        snack: "มื้อว่าง/อื่นๆ",
        dinner: "มื้อเย็น"
    };
    const targetMealType = mealMap[mealSlot];
    const item = plan[mealSlot];

    const dayData = getDayData(currentDateKey);
    dayData.meals[targetMealType].push({
        name: item.name,
        qty: 1,
        photo: null,
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
    alert(`เพิ่ม "${item.name}" (${item.calories} kcal) ลงใน "${targetMealType}" เรียบร้อยแล้ว!`);
}

function renderBurnModeCard() {
    const container = document.getElementById('burn-mode-card');
    if (!container) return;

    const isBurnMode = userGoals.preset === 'fat_sugar_burn';
    const plan = fatBurnWeeklyMeals[burnPlanSelectedDay] || fatBurnWeeklyMeals[1];
    const dayShortLabels = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

    container.innerHTML = `
        <div class="flex items-center justify-between gap-2">
            <div>
                <span class="text-[10px] text-slate-400 block">โหมดเผาผลาญปัจจุบัน</span>
                <div class="flex items-center gap-1.5 mt-0.5">
                    <span class="text-xs font-bold ${isBurnMode ? 'text-amber-400' : 'text-emerald-400'}">
                        ${isBurnMode ? '⚡ รีดไขมัน & น้ำตาล (IF 16/8)' : '⚖️ โหมดลดน้ำหนักปกติ'}
                    </span>
                </div>
            </div>

            <!-- ปุ่มสลับโหมด 1 คลิก -->
            <div class="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                <button type="button" onclick="switchQuickDietMode('fat_loss')"
                    class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${!isBurnMode ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}">
                    ลดปกติ
                </button>
                <button type="button" onclick="switchQuickDietMode('fat_sugar_burn')"
                    class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${isBurnMode ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}">
                    ⚡ รีดไขมัน & น้ำตาล
                </button>
            </div>
        </div>

        ${isBurnMode ? `
            <div class="space-y-2.5 pt-2 border-t border-slate-800/80">
                <!-- กรอบกติกา IF 16/8 -->
                <div class="bg-amber-950/35 border border-amber-500/30 rounded-xl p-2.5 text-[11px] space-y-1">
                    <div class="font-bold text-amber-300 flex items-center justify-between">
                        <span>⏱️ กิน 12:00 – 20:00 น. (งด 16 ชม.)</span>
                        <span class="text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-200">C ≤100g | น้ำตาล ≤20g</span>
                    </div>
                    <p class="text-slate-300 leading-relaxed">
                        • ช่วงเช้าถึงเที่ยงดื่มได้เฉพาะ <b>น้ำเปล่า / กาแฟดำ / ชา 0 kcal</b> เพื่อดึงไขมันสะสม<br>
                        • <b>มื้อเย็นตัดแป้งออกทั้งหมด</b> เน้นโปรตีน + ผักใบเขียว
                    </p>
                </div>

                <!-- แถบเลือกวันดูเมนู 7-11 & ตลาด -->
                <div class="space-y-2">
                    <div class="flex justify-between items-center">
                        <span class="text-[11px] font-semibold text-slate-300">🍱 ตารางเมนูรีดไขมัน (7-11 & ตลาด)</span>
                        <span class="text-[10px] text-slate-400">กดปุ่มเพื่อเพิ่มลงมื้อ</span>
                    </div>
                    <div class="grid grid-cols-7 gap-1">
                        ${[1, 2, 3, 4, 5, 6, 0].map(dIdx => `
                            <button type="button" onclick="selectBurnPlanDay(${dIdx})"
                                class="py-1 rounded-lg text-[11px] font-semibold transition ${burnPlanSelectedDay === dIdx
                                    ? 'bg-amber-500 text-slate-950 font-bold'
                                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'}">
                                ${dayShortLabels[dIdx]}
                            </button>
                        `).join('')}
                    </div>

                    <!-- รายการมื้ออาหารของวันที่เลือก -->
                    <div class="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800 space-y-2 text-[11px]">
                        <div class="flex justify-between items-start gap-2 border-b border-slate-800/70 pb-1.5">
                            <div class="flex-1">
                                <span class="text-amber-400 font-bold block">12:00 เที่ยง (${plan.lunch.calories} kcal | P ${plan.lunch.protein}g)</span>
                                <span class="text-slate-200">${plan.lunch.name}</span>
                            </div>
                            <button type="button" onclick="addBurnPlanMeal(${burnPlanSelectedDay}, 'lunch')" class="shrink-0 bg-slate-800 hover:bg-amber-600 hover:text-white text-amber-300 px-2 py-1 rounded-lg text-[10px] font-semibold transition">
                                + ใส่เที่ยง
                            </button>
                        </div>

                        <div class="flex justify-between items-start gap-2 border-b border-slate-800/70 pb-1.5">
                            <div class="flex-1">
                                <span class="text-sky-400 font-bold block">15:30 ว่าง (${plan.snack.calories} kcal | P ${plan.snack.protein}g)</span>
                                <span class="text-slate-200">${plan.snack.name}</span>
                            </div>
                            <button type="button" onclick="addBurnPlanMeal(${burnPlanSelectedDay}, 'snack')" class="shrink-0 bg-slate-800 hover:bg-sky-600 hover:text-white text-sky-300 px-2 py-1 rounded-lg text-[10px] font-semibold transition">
                                + ใส่ว่าง
                            </button>
                        </div>

                        <div class="flex justify-between items-start gap-2">
                            <div class="flex-1">
                                <span class="text-emerald-400 font-bold block">19:00 เย็น ไร้แป้ง (${plan.dinner.calories} kcal | P ${plan.dinner.protein}g)</span>
                                <span class="text-slate-200">${plan.dinner.name}</span>
                            </div>
                            <button type="button" onclick="addBurnPlanMeal(${burnPlanSelectedDay}, 'dinner')" class="shrink-0 bg-slate-800 hover:bg-emerald-600 hover:text-white text-emerald-300 px-2 py-1 rounded-lg text-[10px] font-semibold transition">
                                + ใส่เย็น
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        ` : ''}
    `;
}

// ==========================================
// Smart Body Composition Tracker & Evaluator (วิเคราะห์ไขมัน-กล้ามเนื้อละเอียด)
// ==========================================
let bodyCompareMode = 'prev'; // 'prev' = เทียบจากเมื่อวาน/ครั้งก่อน, 'first' = ตั้งแต่วันแรกถึงปัจจุบัน

function switchBodyCompareMode(mode) {
    bodyCompareMode = mode;
    renderBodyComposition();
}

function updateBodyComposition() {
    const dayData = getDayData(currentDateKey);
    const getNum = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const v = parseFloat(el.value);
        return (!isNaN(v) && v > 0) ? v : null;
    };

    dayData.bodyComp = {
        fatPct: getNum('bc-fat-pct'),
        muscleKg: getNum('bc-muscle-kg'),
        visceral: getNum('bc-visceral'),
        waterPct: getNum('bc-water-pct'),
        armL: getNum('bc-arm-l'),
        armR: getNum('bc-arm-r'),
        legL: getNum('bc-leg-l'),
        legR: getNum('bc-leg-r')
    };

    saveDataAndSync();
}

function editUserCustomExercise(exName) {
    const idx = userCustomExercises.findIndex(u => u.name === exName);
    if (idx === -1) return;

    const ex = userCustomExercises[idx];
    const newName = prompt("แก้ไขชื่อท่าที่ใส่เอง:", ex.name);
    if (newName === null) return;
    const trimmedName = newName.trim();
    if (!trimmedName) {
        alert("ชื่อท่าห้ามว่างครับ");
        return;
    }

    const newReps = prompt("แก้ไขจำนวนครั้ง / เซต (เช่น 12-15 ครั้ง × 3 เซต):", ex.reps || "12-15 ครั้ง × 3 เซต");
    if (newReps === null) return;

    const newTip = prompt("แก้ไขคำแนะนำ / โน้ตท่านี้:", ex.tip || "");
    if (newTip === null) return;

    const muscleOptions = "chest (อก), back (หลัง), legs (ขา), glutes (ก้น), shoulders (ไหล่), arms (แขน), core (ท้อง)";
    const curMuscle = (ex.customPrimary && ex.customPrimary[0]) || "core";
    const inputMuscle = prompt(`แก้ไขกล้ามเนื้อหลัก [${muscleOptions}]:`, curMuscle);
    if (inputMuscle === null) return;

    const validMuscles = ["chest", "back", "legs", "glutes", "shoulders", "arms", "core"];
    const muscleCode = validMuscles.includes(inputMuscle.trim().toLowerCase())
        ? inputMuscle.trim().toLowerCase()
        : curMuscle;

    const muscleGroupLabel = {
        chest: "หน้าอก",
        back: "แผ่นหลัง",
        legs: "ขา & ก้น",
        glutes: "ขา & ก้น",
        shoulders: "ไหล่ & แขน",
        arms: "ไหล่ & แขน",
        core: "หน้าท้อง & แกนกลาง"
    }[muscleCode] || ex.muscle;

    // ย้ายสถานะการเลือกและจำนวนเซตไปยังชื่อใหม่ (กรณีเปลี่ยนชื่อท่า)
    if (customBuilderSelection[ex.name] !== undefined) {
        const selectedSets = customBuilderSelection[ex.name];
        delete customBuilderSelection[ex.name];
        customBuilderSelection[trimmedName] = selectedSets;
        localStorage.setItem('fitTracker_custom_builder', JSON.stringify(customBuilderSelection));
    }

    userCustomExercises[idx] = {
        ...ex,
        name: trimmedName,
        muscle: muscleGroupLabel,
        reps: newReps.trim() || ex.reps,
        tip: newTip.trim(),
        customPrimary: [muscleCode]
    };

    localStorage.setItem('fitTracker_user_exercises', JSON.stringify(userCustomExercises));
    renderWorkoutCourseContent();
}

function deleteUserCustomExercise(exName) {
    if (!confirm(`ต้องการลบท่าที่ใส่เอง "${exName}" ใช่ไหม?`)) return;

    userCustomExercises = userCustomExercises.filter(u => u.name !== exName);
    localStorage.setItem('fitTracker_user_exercises', JSON.stringify(userCustomExercises));

    if (customBuilderSelection[exName] !== undefined) {
        delete customBuilderSelection[exName];
        localStorage.setItem('fitTracker_custom_builder', JSON.stringify(customBuilderSelection));
    }

    renderWorkoutCourseContent();
}

function formatDeltaBadge(cur, base, unit, lowerIsBetter = true) {
    if (cur === null || cur === undefined || base === null || base === undefined) return '';
    const diff = Number((cur - base).toFixed(1));
    if (diff === 0) return `<span class="text-[9px] text-slate-400 ml-1">(คงที่)</span>`;

    const isGood = lowerIsBetter ? (diff < 0) : (diff > 0);
    const color = isGood ? 'text-emerald-400' : 'text-rose-400';
    const arrow = diff > 0 ? '▲+' : '▼';
    return `<span class="text-[9px] font-bold ${color} ml-1">${arrow}${diff}${unit}</span>`;
}

function renderBodyComposition() {
    const dayData = getDayData(currentDateKey);
    const bc = dayData.bodyComp || {};

    const fieldsMap = {
        'bc-fat-pct': bc.fatPct,
        'bc-muscle-kg': bc.muscleKg,
        'bc-visceral': bc.visceral,
        'bc-water-pct': bc.waterPct,
        'bc-arm-l': bc.armL,
        'bc-arm-r': bc.armR,
        'bc-leg-l': bc.legL,
        'bc-leg-r': bc.legR
    };

    Object.entries(fieldsMap).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val ?? '';
    });

    const badgeEl = document.getElementById('body-comp-badge');
    const analysisEl = document.getElementById('body-comp-analysis');
    const mapBox = document.getElementById('body-human-map-box');
    if (!analysisEl || !mapBox) return;

    const hasAny = Object.values(fieldsMap).some(v => v !== null && v !== undefined);
    if (!hasAny) {
        if (badgeEl) badgeEl.innerText = "กดเพื่อกรอก";
        analysisEl.classList.add('hidden');
        mapBox.classList.add('hidden');
        return;
    }

    if (badgeEl) {
        badgeEl.innerHTML = `<span class="text-emerald-400 font-semibold">${bc.fatPct ? `ไขมัน ${bc.fatPct}%` : 'บันทึกแล้ว'}</span>`;
    }

    // หาวันที่เคยบันทึก BodyComp ก่อนหน้าทั้งหมดเรียงตามวันที่
    const recordedKeys = Object.keys(allMealsHistory)
        .filter(k => k < currentDateKey && allMealsHistory[k]?.bodyComp && Object.values(allMealsHistory[k].bodyComp).some(v => v !== null && v !== undefined))
        .sort();

    const prevKey = recordedKeys.length > 0 ? recordedKeys[recordedKeys.length - 1] : null;
    const firstKey = recordedKeys.length > 0 ? recordedKeys[0] : null;

    const targetCompareKey = (bodyCompareMode === 'first') ? firstKey : prevKey;
    const baseObj = targetCompareKey ? allMealsHistory[targetCompareKey] : null;
    const baseBc = baseObj ? (baseObj.bodyComp || {}) : {};
    const compareTitle = targetCompareKey
        ? (bodyCompareMode === 'first' ? `เทียบตั้งแต่วันแรก (${targetCompareKey})` : `เทียบจากครั้งก่อน (${targetCompareKey})`)
        : 'บันทึกครั้งแรก (ยังไม่มีข้อมูลเปรียบเทียบ)';

    const weight = Number(dayData.weight) || 0;
    const baseWeight = baseObj ? (Number(baseObj.weight) || 0) : 0;

    // 1. วาดหุ่นคนแบบ Vitruvian / InBody SVG + ป้ายข้อมูล 5 จุด
    const segCard = (title, val, baseVal, accentClass = 'text-white') => `
        <div class="bg-slate-900/95 border border-slate-800 rounded-xl px-2 py-1.5 text-center">
            <span class="text-[9px] text-slate-400 block">${title}</span>
            <span class="text-[11px] font-bold ${accentClass}">
                ${val !== null && val !== undefined ? `${val}%` : '-'}
            </span>
            <div class="leading-none mt-0.5">${formatDeltaBadge(val, baseVal, '%', true)}</div>
        </div>
    `;

    mapBox.innerHTML = `
        <div class="flex items-center justify-between gap-1.5 border-b border-slate-800 pb-2">
            <span class="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                <i class="fa-solid fa-person"></i> แผนภาพร่างกาย
            </span>
            <div class="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                <button type="button" onclick="switchBodyCompareMode('prev')"
                    class="px-2 py-0.5 rounded-md transition ${bodyCompareMode === 'prev' ? 'bg-purple-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}">
                    จากเมื่อวาน
                </button>
                <button type="button" onclick="switchBodyCompareMode('first')"
                    class="px-2 py-0.5 rounded-md transition ${bodyCompareMode === 'first' ? 'bg-purple-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}">
                    ตั้งแต่วันแรก
                </button>
            </div>
        </div>

        <div class="text-[10px] text-center text-slate-400">${compareTitle}</div>

        <!-- โครงสร้าง 3 คอลัมน์: ซ้าย (แขนซ้าย/ขาซ้าย) | กลาง (หุ่นคน SVG) | ขวา (แขนขวา/ขาขวา) -->
        <div class="grid grid-cols-3 items-center gap-1.5 pt-1">
            <!-- ฝั่งซ้าย -->
            <div class="space-y-4">
                ${segCard('แขนซ้าย', bc.armL, baseBc.armL, 'text-amber-300')}
                ${segCard('ขาซ้าย', bc.legL, baseBc.legL, 'text-sky-300')}
            </div>

            <!-- ตรงกลาง: หุ่นคน Vitruvian SVG -->
            <div class="flex flex-col items-center justify-center relative">
                <svg viewBox="0 0 120 155" class="w-24 h-32 text-amber-400/85">
                    <!-- ศีรษะ -->
                    <circle cx="60" cy="22" r="11" fill="#1e293b" stroke="currentColor" stroke-width="1.6"/>
                    <!-- ลำตัว -->
                    <path d="M43 39 Q60 35 77 39 L72 86 L48 86 Z" fill="#1e293b" stroke="currentColor" stroke-width="1.6"/>
                    <!-- แขน 2 ข้าง (ซ้าย - ขวา) -->
                    <path d="M43 42 L16 68" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>
                    <path d="M77 42 L104 68" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>
                    <!-- ขา 2 ข้าง (ซ้าย - ขวา) -->
                    <path d="M52 86 L44 138" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/>
                    <path d="M68 86 L76 138" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/>
                    <!-- จุดแกนกลาง (ไขมันช่องท้อง) -->
                    <circle cx="60" cy="64" r="5" fill="#f43f5e" opacity="0.9"/>
                </svg>
                <div class="bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-center -mt-1">
                    <span class="text-[9px] text-slate-400">ช่องท้อง: </span>
                    <span class="text-[10px] font-bold text-rose-400">${bc.visceral ?? '-'}</span>
                    ${formatDeltaBadge(bc.visceral, baseBc.visceral, '', true)}
                </div>
            </div>

            <!-- ฝั่งขวา -->
            <div class="space-y-4">
                ${segCard('แขนขวา', bc.armR, baseBc.armR, 'text-amber-300')}
                ${segCard('ขาขวา', bc.legR, baseBc.legR, 'text-sky-300')}
            </div>
        </div>

        <!-- แถบสรุปภาพรวม (น้ำหนัก | ไขมันรวม | กล้ามเนื้อรวม) -->
        <div class="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-800/80 text-center">
            <div class="bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                <span class="text-[9px] text-slate-400 block">น้ำหนัก</span>
                <span class="text-xs font-bold text-white">${weight > 0 ? `${weight}kg` : '-'}</span>
                <div class="leading-none mt-0.5">${weight > 0 && baseWeight > 0 ? formatDeltaBadge(weight, baseWeight, 'kg', true) : ''}</div>
            </div>
            <div class="bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                <span class="text-[9px] text-slate-400 block">ไขมันรวม</span>
                <span class="text-xs font-bold text-amber-400">${bc.fatPct ? `${bc.fatPct}%` : '-'}</span>
                <div class="leading-none mt-0.5">${formatDeltaBadge(bc.fatPct, baseBc.fatPct, '%', true)}</div>
            </div>
            <div class="bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                <span class="text-[9px] text-slate-400 block">กล้ามเนื้อ</span>
                <span class="text-xs font-bold text-emerald-400">${bc.muscleKg ? `${bc.muscleKg}kg` : '-'}</span>
                <div class="leading-none mt-0.5">${formatDeltaBadge(bc.muscleKg, baseBc.muscleKg, 'kg', false)}</div>
            </div>
        </div>
    `;
    mapBox.classList.remove('hidden');

    // 2. สรุปคำแนะนำเชิงลึกด้านล่างหุ่น
    let lines = [];
    if (weight > 0 && bc.fatPct) {
        const fatMass = (weight * (bc.fatPct / 100)).toFixed(1);
        const lbm = (weight - fatMass).toFixed(1);
        const recProtMin = Math.round(lbm * 1.8);
        const recProtMax = Math.round(lbm * 2.1);
        lines.push(`• <b>ไขมันในตัว:</b> ${fatMass} kg | <b>มวลไม่รวมไขมัน (LBM):</b> ${lbm} kg`);
        lines.push(`• <b>โปรตีนแนะนำตามกล้ามเนื้อจริง:</b> <span class="text-emerald-400 font-bold">${recProtMin}–${recProtMax} g/วัน</span>`);
    }

    if (baseObj && baseBc) {
        const dFat = (bc.fatPct && baseBc.fatPct) ? Number((bc.fatPct - baseBc.fatPct).toFixed(1)) : null;
        const dMus = (bc.muscleKg && baseBc.muscleKg) ? Number((bc.muscleKg - baseBc.muscleKg).toFixed(1)) : null;
        if (dFat !== null || dMus !== null) {
            if (dFat !== null && dFat < 0 && (dMus === null || dMus >= -0.2)) {
                lines.push(`• <span class="text-emerald-400 font-semibold">ผลลัพธ์ยอดเยี่ยม:</span> ไขมันลดลงจริงโดยที่รักษามวลกล้ามเนื้อไว้ได้ครบ!`);
            } else if (dMus !== null && dMus < -0.3) {
                lines.push(`• <span class="text-rose-400 font-semibold">คำเตือน:</span> มวลกล้ามเนื้อลดลง ${Math.abs(dMus)} kg ควรเพิ่มโปรตีนมื้อเย็นและเล่นเวทต้านแรง`);
            }
        }
    }

    if (lines.length > 0) {
        analysisEl.innerHTML = lines.join('<br>');
        analysisEl.classList.remove('hidden');
    } else {
        analysisEl.classList.add('hidden');
    }
}

// Initialize on load
window.onload = initApp;
