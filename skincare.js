// ==========================================================================
// skincare.js — โมดูลดูแลผิว, การดื่มน้ำ, วินัย/อาหารเสริม & ซิงก์การนอน
// ==========================================================================

const defaultSkincareItems = [
    { id: 'sk_m1', period: 'morning', name: '[หน้า] 1. ล้างหน้าด้วย Senka Perfect Whip Collagen In', days: [] },
    { id: 'sk_m2', period: 'morning', name: '[หน้า] 2. เช็ดผิวทั่วหน้าและลำคอด้วย Elite Care Serum Pad (1 แผ่น)', days: [] },
    { id: 'sk_m3', period: 'morning', name: '[หน้า] 3. ทา MizuMi Cica Soothing Gel 2 ข้อนิ้ว บริเวณใบหน้าและลำคอ', days: [] },
    { id: 'sk_m4', period: 'morning', name: '[หน้า] 4. ทากันแดด MizuMi UV Water Serum 2 ข้อนิ้ว ทั่วหน้าและลำคอ', days: [] },
    { id: 'sk_m5', period: 'morning', name: '[ตัว] 5. อาบน้ำ WATERCOME + ทาเซรั่ม & โลชั่น WATERCOME', days: [] },
    { id: 'sk_m6', period: 'morning', name: '[ตัว] 6. ทากันแดด MizuMi UV Cooling Body Serum ทั่วผิวกาย', days: [] },

    { id: 'sk_n1', period: 'night',   name: '[หน้า] 1. ล้างหน้าด้วย Senka Perfect Whip Collagen In', days: [] },
    { id: 'sk_n2', period: 'night',   name: '[หน้า] 2. แปะ Elite Care Serum Pad ทิ้งไว้ 3-5 นาที แล้วเช็ดเบาๆ', days: [] },
    { id: 'sk_n3', period: 'night',   name: '[หน้า] 3. แปะ Luna Jelly Eye Mask ใต้ตา 10-15 นาที แล้วลอกออก', days: [] },
    { id: 'sk_n4', period: 'night',   name: '[หน้า] 4. ทา MizuMi Cica Soothing Gel 2 ข้อนิ้ว บริเวณใบหน้าและลำคอ', days: [] },
    { id: 'sk_n5', period: 'night',   name: '[ตัว] 5. อาบน้ำ WATERCOME + ทา MizuMi B3 AHA (งดคืนที่สครับผิว)', days: [] },
    { id: 'sk_n6', period: 'night',   name: '[ตัว] 6. ทาโลชั่น WATERCOME ทับทั่วผิวกายเพื่อล็อกความชุ่มชื้น', days: [] },

    { id: 'sk_w1', period: 'weekly',  name: '[ตัว] สครับขัดผิว WATERCOME (งดทา MizuMi B3 AHA คืนนี้)', days: [3, 6] },
    { id: 'sk_w2', period: 'weekly',  name: '[หน้า] แปะแผ่นมาส์ก Myu-Nique 15-20 นาที ก่อนลง Cica Gel', days: [4, 0] }
];

const savedSkincare = JSON.parse(localStorage.getItem('fitTracker_skincare_items') || 'null');
window.skincareItems = (savedSkincare && savedSkincare.length > 0) ? savedSkincare : [...defaultSkincareItems];
window.skincareLogs = JSON.parse(localStorage.getItem('fitTracker_skincare_logs') || '{}');
window.skincarePhotosMap = JSON.parse(localStorage.getItem('fitTracker_skincare_photos') || '{}');

const defaultSupplements = [
    { id: 'sup_whey', name: '🥤 เวย์โปรตีน / โปรตีนเสริม' },
    { id: 'sup_vit',  name: '💊 วิตามินรวม (Multivitamin)' },
    { id: 'sup_fish', name: '🐟 น้ำมันปลา (Fish Oil)' }
];
let supplementLogs = JSON.parse(localStorage.getItem('fitTracker_sup_logs') || '{}');
let activeSkincareIdForPhoto = '';

// ------------------------------------------
// 1. Entry Point สำหรับ Render หน้า Skincare ทั้งหมด
// ------------------------------------------
function renderSkincarePage() {
    renderHabitsSleepBanner();
    renderWaterTracker();
    renderDailyHabitsAndSupplements();
    renderSkincareContent();
}

// ------------------------------------------
// 2. Watch Sleep & RHR Sync (ใช้ร่วมกับหน้า Summary)
// ------------------------------------------
function getWatchHealth(dateKey) {
    const dayObj = getDayData(dateKey);
    if (!dayObj.watchHealth) {
        dayObj.watchHealth = { sleepHours: '', sleepScore: '', rhr: '' };
    }
    return dayObj.watchHealth;
}

function updateWatchHealthField(field, value) {
    const wh = getWatchHealth(currentDateKey);
    wh[field] = value;
    saveDataAndSync();
}

function renderHabitsSleepBanner() {
    const banner = document.getElementById('habits-sleep-banner');
    if (!banner) return;

    const wh = getWatchHealth(currentDateKey);
    const h = parseFloat(wh.sleepHours) || 0;
    const score = parseInt(wh.sleepScore) || 0;

    let skinSleepAdvice = 'กรอกชั่วโมงนอนจาก HUAWEI Watch เพื่อเช็กการฟื้นฟูผิวและฮอร์โมน';
    if (h >= 7) skinSleepAdvice = '✨ นอนเต็มอิ่ม! ผิวและกล้ามเนื้อซ่อมแซมได้เต็มประสิทธิภาพ';
    else if (h > 0 && h < 6) skinSleepAdvice = '⚠️ นอนน้อยกว่า 6 ชม. ระวังผิวโทรม บวมน้ำ และหิวของหวานง่ายขึ้น';

    banner.innerHTML = `
        <div class="space-y-2">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-indigo-300"><i class="fa-solid fa-bed mr-1.5"></i> คุณภาพการนอน & ชีพจร (HUAWEI Watch)</span>
                <span class="text-[10px] text-slate-400">${currentDateKey}</span>
            </div>
            <div class="grid grid-cols-3 gap-2 text-xs">
                <div class="bg-slate-950/90 p-2 rounded-xl border border-slate-800">
                    <span class="text-[10px] text-slate-400 block">ชั่วโมงนอน</span>
                    <input type="number" step="0.1" value="${wh.sleepHours}" onchange="updateWatchHealthField('sleepHours', this.value)" placeholder="7.5"
                        class="w-full bg-transparent text-sm font-bold text-indigo-300 mt-0.5 focus:outline-none">
                </div>
                <div class="bg-slate-950/90 p-2 rounded-xl border border-slate-800">
                    <span class="text-[10px] text-slate-400 block">Sleep Score</span>
                    <input type="number" value="${wh.sleepScore}" onchange="updateWatchHealthField('sleepScore', this.value)" placeholder="85"
                        class="w-full bg-transparent text-sm font-bold text-emerald-300 mt-0.5 focus:outline-none">
                </div>
                <div class="bg-slate-950/90 p-2 rounded-xl border border-slate-800">
                    <span class="text-[10px] text-slate-400 block">Resting HR</span>
                    <input type="number" value="${wh.rhr}" onchange="updateWatchHealthField('rhr', this.value)" placeholder="58"
                        class="w-full bg-transparent text-sm font-bold text-rose-400 mt-0.5 focus:outline-none">
                </div>
            </div>
            <div class="text-[11px] text-slate-300 bg-slate-950/60 px-2.5 py-1.5 rounded-xl border border-slate-800/80">
                ${skinSleepAdvice} ${score > 0 ? `(คะแนน TruSleep: <b class="text-emerald-400">${score}</b>)` : ''}
            </div>
        </div>
    `;
}

// ------------------------------------------
// 3. Water Tracker
// ------------------------------------------
function addWater(ml) {
    const dayData = getDayData(currentDateKey);
    dayData.water = Math.max(0, (Number(dayData.water) || 0) + ml);
    saveDataAndSync();
}

function renderWaterTracker() {
    const dayData = getDayData(currentDateKey);
    const water = Number(dayData.water || 0);
    const goalWater = Number(userGoals.water) || 2000;
    const pct = Math.min(Math.round((water / goalWater) * 100), 100);

    const badge = document.getElementById('water-summary-badge');
    const goalLabel = document.getElementById('goal-water-label');
    const progBar = document.getElementById('water-progress-bar');
    const pctEl = document.getElementById('water-percent');

    if (badge) badge.innerText = `${water.toLocaleString()} / ${goalWater.toLocaleString()} ml`;
    if (goalLabel) goalLabel.innerText = goalWater.toLocaleString();
    if (progBar) progBar.style.width = `${pct}%`;
    if (pctEl) pctEl.innerText = `${pct}%`;
}

// ------------------------------------------
// 4. Daily Habits, Streak & Supplements
// ------------------------------------------
function toggleSupplementCheck(supId) {
    if (!supplementLogs[currentDateKey]) supplementLogs[currentDateKey] = [];
    const idx = supplementLogs[currentDateKey].indexOf(supId);
    if (idx > -1) supplementLogs[currentDateKey].splice(idx, 1);
    else supplementLogs[currentDateKey].push(supId);
    localStorage.setItem('fitTracker_sup_logs', JSON.stringify(supplementLogs));
    renderDailyHabitsAndSupplements();
}

function calculateDisciplineStreak() {
    let streak = 0;
    const parts = currentDateKey.split('-');
    let d = new Date(parts[0], parts[1] - 1, parts[2]);
    for (let i = 0; i < 60; i++) {
        const key = getFormattedDateKey(d);
        const dayObj = allMealsHistory[key];
        const hasFood = dayObj && dayObj.meals && Object.values(dayObj.meals).some(l => l.length > 0);
        const hasSkin = (window.skincareLogs[key] || []).length > 0;
        if (hasFood || hasSkin) {
            streak++;
            d.setDate(d.getDate() - 1);
        } else {
            break;
        }
    }
    return streak;
}

function renderDailyHabitsAndSupplements() {
    const box = document.getElementById('daily-habits-container');
    if (!box) return;

    const streak = calculateDisciplineStreak();
    const checkedSup = supplementLogs[currentDateKey] || [];
    const dayData = getDayData(currentDateKey);
    const waterDone = (Number(dayData.water) || 0) >= (Number(userGoals.water) || 2000);
    const stepsDone = (Number(dayData.steps) || 0) >= (Number(userGoals.steps) || 10000);

    box.innerHTML = `
        <div class="flex justify-between items-center border-b border-slate-800 pb-2.5">
            <h3 class="text-sm font-bold text-white flex items-center gap-1.5">
                <i class="fa-solid fa-fire text-amber-400"></i> วินัยต่อเนื่อง & อาหารเสริม
            </h3>
            <span class="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full text-xs font-bold">
                🔥 Streak ${streak} วัน
            </span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-slate-950/80 p-2.5 rounded-xl border ${waterDone ? 'border-emerald-600/50 text-emerald-300' : 'border-slate-800 text-slate-400'}">
                ${waterDone ? '✅' : '⬜'} ดื่มน้ำครบเป้า
            </div>
            <div class="bg-slate-950/80 p-2.5 rounded-xl border ${stepsDone ? 'border-emerald-600/50 text-emerald-300' : 'border-slate-800 text-slate-400'}">
                ${stepsDone ? '✅' : '⬜'} เดินครบ ${(Number(userGoals.steps) || 10000).toLocaleString()} ก้าว
            </div>
        </div>

        <div class="space-y-1.5 pt-1">
            <div class="text-[11px] font-semibold text-slate-300">เช็กลิสต์อาหารเสริม / วิตามินวันนี้:</div>
            ${defaultSupplements.map(s => {
                const isDone = checkedSup.includes(s.id);
                return `
                    <label class="flex items-center gap-2.5 bg-slate-950/70 p-2.5 rounded-xl border ${isDone ? 'border-emerald-700/40 opacity-75' : 'border-slate-800'} cursor-pointer">
                        <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleSupplementCheck('${s.id}')" class="w-4 h-4 accent-emerald-500 rounded">
                        <span class="text-xs ${isDone ? 'line-through text-slate-500' : 'text-slate-100'}">${s.name}</span>
                    </label>
                `;
            }).join('')}
        </div>
    `;
}

// ------------------------------------------
// 5. Skincare Routine Checklist & Photo Guide
// ------------------------------------------
function toggleSkincareDaysSelect() {
    const period = document.getElementById('skincare-new-period')?.value;
    const picker = document.getElementById('skincare-days-picker');
    if (!picker) return;
    if (period === 'weekly') picker.classList.remove('hidden');
    else picker.classList.add('hidden');
}

function toggleSkincareCheck(itemId) {
    if (!window.skincareLogs[currentDateKey]) window.skincareLogs[currentDateKey] = [];
    const idx = window.skincareLogs[currentDateKey].indexOf(itemId);
    if (idx > -1) window.skincareLogs[currentDateKey].splice(idx, 1);
    else window.skincareLogs[currentDateKey].push(itemId);

    localStorage.setItem('fitTracker_skincare_logs', JSON.stringify(window.skincareLogs));
    renderSkincareContent();
    renderDailyHabitsAndSupplements();
    pushToGitHub(false);
}

function addSkincareItem() {
    const period = document.getElementById('skincare-new-period').value;
    const nameInput = document.getElementById('skincare-new-name');
    const name = nameInput.value.trim();
    if (!name) return;

    let days = [];
    if (period === 'weekly') {
        document.querySelectorAll('.sk-day-cb:checked').forEach(cb => days.push(parseInt(cb.value)));
        if (days.length === 0) return alert('กรุณาเลือกวันในสัปดาห์ที่ต้องการให้เตือนอย่างน้อย 1 วันครับ');
    }

    window.skincareItems.push({ id: 'sk_' + Date.now(), period, name, days });
    localStorage.setItem('fitTracker_skincare_items', JSON.stringify(window.skincareItems));

    nameInput.value = '';
    document.querySelectorAll('.sk-day-cb').forEach(cb => cb.checked = false);
    renderSkincareContent();
    pushToGitHub(false);
}

function deleteSkincareItem(itemId) {
    if (!confirm('ลบรายการนี้ออกจากตารางดูแลผิว?')) return;
    window.skincareItems = window.skincareItems.filter(item => item.id !== itemId);
    localStorage.setItem('fitTracker_skincare_items', JSON.stringify(window.skincareItems));
    renderSkincareContent();
    pushToGitHub(false);
}

function resetDefaultSkincare() {
    if (!confirm('โหลดรายการสกินแคร์เริ่มต้นทั้ง 14 ขั้นตอนกลับมาใช่ไหม?')) return;
    window.skincareItems = [...defaultSkincareItems];
    localStorage.setItem('fitTracker_skincare_items', JSON.stringify(window.skincareItems));
    renderSkincareContent();
    pushToGitHub(false);
}

function selectSkincareWeekDay(dateStr) {
    currentDateKey = dateStr;
    renderActivePageUI();
}

function renderSkincareContent() {
    const weekStrip = document.getElementById('skincare-week-strip');
    const alertBox = document.getElementById('skincare-today-alert');
    const listBox = document.getElementById('skincare-list-container');
    if (!listBox) return;

    const parts = currentDateKey.split('-');
    const selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayOfWeek = selectedDate.getDay();
    const dayNamesShort = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    const dayNamesFull = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
    const checkedIds = window.skincareLogs[currentDateKey] || [];

    const sundayOfWeek = new Date(selectedDate);
    sundayOfWeek.setDate(selectedDate.getDate() - dayOfWeek);
    const todayKey = getFormattedDateKey(new Date());

    if (weekStrip) {
        let stripHtml = `<div class="grid grid-cols-7 gap-1 bg-slate-950/90 p-1.5 rounded-2xl border border-slate-800">`;
        for (let i = 0; i < 7; i++) {
            const d = new Date(sundayOfWeek);
            d.setDate(sundayOfWeek.getDate() + i);
            const dKey = getFormattedDateKey(d);
            const isSelected = (dKey === currentDateKey);
            const isToday = (dKey === todayKey);
            const hasSpecial = window.skincareItems.some(item => item.period === 'weekly' && item.days.includes(i));

            stripHtml += `
                <button type="button" onclick="selectSkincareWeekDay('${dKey}')"
                    class="flex flex-col items-center py-1.5 rounded-xl border transition ${isSelected
                        ? 'bg-pink-600 border-pink-400 text-white shadow-md shadow-pink-600/20'
                        : isToday ? 'bg-slate-900 border-pink-500/40 text-pink-300' : 'bg-slate-900/60 border-transparent text-slate-400 hover:bg-slate-800'}">
                    <span class="text-[10px] font-medium">${dayNamesShort[i]}</span>
                    <span class="text-xs font-bold mt-0.5">${d.getDate()}</span>
                    <span class="w-1.5 h-1.5 rounded-full mt-1 ${hasSpecial ? (isSelected ? 'bg-white' : 'bg-pink-400') : 'bg-transparent'}"></span>
                </button>
            `;
        }
        stripHtml += `</div>`;
        weekStrip.innerHTML = stripHtml;
    }

    const todayWeeklySpecials = window.skincareItems.filter(item => item.period === 'weekly' && item.days.includes(dayOfWeek));
    if (alertBox) {
        if (todayWeeklySpecials.length > 0) {
            alertBox.innerHTML = `
                <div class="bg-gradient-to-r from-pink-950/90 to-purple-950/80 border border-pink-500/40 rounded-2xl p-3 space-y-1">
                    <div class="text-xs font-bold text-pink-300 flex items-center gap-1.5">
                        <i class="fa-solid fa-bell text-amber-300"></i> เตือนพิเศษประจำ${dayNamesFull[dayOfWeek]} (${currentDateKey})!
                    </div>
                    <div class="text-[11px] text-slate-200">วันนี้มีคิว: <b>${todayWeeklySpecials.map(s => s.name).join(' , ')}</b></div>
                </div>
            `;
        } else {
            alertBox.innerHTML = `
                <div class="bg-slate-950/70 border border-slate-800/80 rounded-xl px-3 py-2 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>${dayNamesFull[dayOfWeek]} (${currentDateKey}) • บำรุงผิวสูตรปกติ</span>
                    <span class="text-pink-400 font-medium">${checkedIds.length}/${window.skincareItems.length} ขั้นตอน</span>
                </div>
            `;
        }
    }

    const renderGroup = (itemsArr) => {
        if (itemsArr.length === 0) return `<div class="text-[11px] text-slate-500 py-1">ยังไม่มีรายการในหมวดนี้</div>`;
        return itemsArr.map(item => {
            const isChecked = checkedIds.includes(item.id);
            const daysText = (item.days && item.days.length > 0)
                ? `<span class="text-[10px] text-pink-400 font-medium ml-1.5">(${item.days.map(d => dayNamesShort[d]).join(', ')})</span>`
                : '';
            const safeName = item.name.replace(/'/g, "\\'");
            const hasPhoto = !!window.skincarePhotosMap[item.id];

            return `
                <div class="flex items-center justify-between gap-2 bg-slate-900/90 px-3 py-2 rounded-xl border ${isChecked ? 'border-emerald-700/40 opacity-75' : 'border-slate-800'}">
                    <label class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                        <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleSkincareCheck('${item.id}')" class="w-4 h-4 accent-pink-500 rounded cursor-pointer shrink-0">
                        <span class="text-xs leading-snug ${isChecked ? 'line-through text-slate-400' : 'text-slate-100 font-medium'}">${item.name}${daysText}</span>
                    </label>
                    <div class="flex items-center gap-1 shrink-0">
                        <button type="button" onclick="openSkincarePhotoModal('${item.id}', '${safeName}')" title="ดู/เพิ่มรูปผลิตภัณฑ์" class="${hasPhoto ? 'text-pink-400 bg-pink-950/60 border-pink-700/50' : 'text-slate-400 bg-slate-800/80 border-slate-700'} hover:text-pink-300 border w-7 h-7 rounded-lg flex items-center justify-center">
                            <i class="fa-regular fa-image text-[11px]"></i>
                        </button>
                        <button type="button" onclick="deleteSkincareItem('${item.id}')" class="text-slate-500 hover:text-rose-400 p-1">
                            <i class="fa-solid fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    };

    const morningList = window.skincareItems.filter(i => i.period === 'morning');
    const nightList   = window.skincareItems.filter(i => i.period === 'night');
    const weeklyList  = window.skincareItems.filter(i => i.period === 'weekly');

    listBox.innerHTML = `
        <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
            <div class="text-xs font-bold text-amber-300 flex items-center gap-1.5"><i class="fa-solid fa-sun"></i> ตอนเช้า (Morning)</div>
            <div class="space-y-1.5">${renderGroup(morningList)}</div>
        </div>
        <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
            <div class="text-xs font-bold text-indigo-300 flex items-center gap-1.5"><i class="fa-solid fa-moon"></i> ก่อนนอน (Night)</div>
            <div class="space-y-1.5">${renderGroup(nightList)}</div>
        </div>
        <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
            <div class="text-xs font-bold text-pink-400 flex items-center gap-1.5"><i class="fa-solid fa-wand-magic-sparkles"></i> เตือนรายสัปดาห์ (สครับผิว / มาส์กหน้า)</div>
            <div class="space-y-1.5">${renderGroup(weeklyList)}</div>
        </div>
    `;
}

// Skincare Product Photo Modal
function openSkincarePhotoModal(itemId, itemName) {
    activeSkincareIdForPhoto = itemId;
    document.getElementById('sk-photo-title').innerText = itemName;
    document.getElementById('skincare-photo-modal').classList.remove('hidden');
    loadSkincarePhoto(itemId);
}
function closeSkincarePhotoModal() { document.getElementById('skincare-photo-modal').classList.add('hidden'); }
function triggerSkincarePhotoUpload() { const i = document.getElementById('sk-photo-input'); i.value = ''; i.click(); }

async function loadSkincarePhoto(itemId) {
    const box = document.getElementById('sk-photo-display-box');
    const status = document.getElementById('sk-photo-status');
    const photoPath = window.skincarePhotosMap[itemId];

    if (!photoPath) {
        box.innerHTML = `<div class="text-center p-6 space-y-1"><i class="fa-regular fa-image text-2xl text-slate-600"></i><div class="text-xs text-slate-400">ยังไม่มีรูปผลิตภัณฑ์</div></div>`;
        status.innerText = "";
        return;
    }
    if (photoBlobCache[photoPath]) {
        box.innerHTML = `<img src="${photoBlobCache[photoPath]}" class="w-full max-h-[60vh] object-contain">`;
        status.innerText = "โหลดจากแคชแล้ว";
        return;
    }
    const token = localStorage.getItem('fitTracker_github_token');
    if (!token) return;
    try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${photoPath}`, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' } });
        const data = await res.json();
        const url = `data:image/jpeg;base64,${data.content.replace(/\s/g, '')}`;
        photoBlobCache[photoPath] = url;
        box.innerHTML = `<img src="${url}" class="w-full max-h-[60vh] object-contain">`;
        status.innerText = "ซิงก์จาก Cloud แล้ว";
    } catch (e) {}
}

async function handleSkincarePhotoSelected(event) {
    const file = event.target.files[0];
    if (!file || !activeSkincareIdForPhoto) return;
    document.getElementById('sk-photo-status').innerText = "กำลังอัปโหลดรูป...";
    const base64 = await resizeImageToBase64(file, 900);
    const uploadedPath = await uploadImageToGitHubFolder('skincare', 'sk', base64);
    if (uploadedPath) {
        window.skincarePhotosMap[activeSkincareIdForPhoto] = uploadedPath;
        localStorage.setItem('fitTracker_skincare_photos', JSON.stringify(window.skincarePhotosMap));
        document.getElementById('sk-photo-display-box').innerHTML = `<img src="${photoBlobCache[uploadedPath]}" class="w-full max-h-[60vh] object-contain">`;
        document.getElementById('sk-photo-status').innerText = "บันทึกขึ้น Cloud สำเร็จ!";
        renderSkincareContent();
        pushToGitHub(false);
    }
}
