// ==========================================================================
// skincare.js — โมดูลดูแลผิว, การดื่มน้ำ, วินัย/อาหารเสริม & ซิงก์การนอน
// ==========================================================================

const defaultSkincareItems = [
    { id: 'sk_m1', period: 'morning', name: '[หน้า] ล้างหน้าด้วย Senka Perfect Whip Collagen In', days: [0, 1, 2, 3, 4, 5, 6] },
    { id: 'sk_m2', period: 'morning', name: '[ตัว] อาบน้ำด้วย WATERCOME White Tea Shower Gel', days: [0, 1, 2, 3, 4, 5, 6] },
    { id: 'sk_m3', period: 'morning', name: '[หน้า] เช็ดหน้าและลำคอด้วย Elite Care Lumiclear Brink Serum Pad (1 แผ่น)', days: [0, 1, 2, 3, 4, 5, 6] },
    { id: 'sk_m4', period: 'morning', name: '[หน้า] ทา MizuMi Cica Soothing Moisture Gel (2 ข้อนิ้ว)', days: [0, 1, 2, 3, 4, 5, 6] },
    { id: 'sk_m5', period: 'morning', name: '[หน้า] ทากันแดดหน้า MizuMi UV Water Serum SPF50+ PA++++ (2 ข้อนิ้ว)', days: [0, 1, 2, 3, 4, 5, 6] },
    { id: 'sk_m6', period: 'morning', name: '[ตัว] ผสมเซรั่ม WATERCOME White Tea Serum (3-4 ปั๊ม) + The Elf Nano White Dose (3-5 หยด)', days: [0, 1, 2, 3, 4, 5, 6] },
    { id: 'sk_m7', period: 'morning', name: '[ตัว] ทาโลชั่นตัว WATERCOME White Tea Lotion (3-4 ปั๊ม)', days: [0, 1, 2, 3, 4, 5, 6] },
    { id: 'sk_m8', period: 'morning', name: '[ตัว] ทากันแดดตัว MizuMi UV Cooling Body Serum SPF50+ PA++++', days: [0, 1, 2, 3, 4, 5, 6] },

    { id: 'sk_n1', period: 'night', name: '[หน้า] ล้างหน้าด้วย Senka Perfect Whip Collagen In', days: [0, 1, 2, 3, 4, 5, 6] },
    { id: 'sk_n2_shower_normal', period: 'night', name: '[ตัว] อาบน้ำด้วย WATERCOME White Tea Shower Gel', days: [0, 1, 2, 4, 5] },
    { id: 'sk_n2_shower_before_scrub', period: 'night', name: '[ตัว] อาบน้ำด้วย WATERCOME Shower Gel (2-3 ปั๊ม)', days: [3, 6] },
    { id: 'sk_n2_scrub_after_shower', period: 'night', name: '[ตัว] สครับขัดผิวด้วย WATERCOME Niacinamide Scrub Cream (1-2 ช้อนโต๊ะ)', days: [3, 6] },
    { id: 'sk_n3', period: 'night', name: '[หน้า] แปะ Elite Care Lumiclear Brink Serum Pad (3-5 นาที แล้วเช็ดเบาๆ)', days: [0, 1, 2, 3, 4, 5, 6] },
    { id: 'sk_n4_mask', period: 'night', name: '[หน้า] แปะแผ่นมาส์กหน้า Myu-Nique Sheet Mask (15-20 นาที แล้วลอกออก)', days: [0, 4] },
    { id: 'sk_n5', period: 'night', name: '[หน้า] แปะ Luna Under Eye Repair Mask ใต้ตา (10-15 นาที แล้วลอกออก)', days: [0, 1, 2, 3, 4, 5, 6] },
    { id: 'sk_n6', period: 'night', name: '[หน้า] ทา MizuMi Cica Soothing Moisture Gel (2 ข้อนิ้ว)', days: [0, 1, 2, 3, 4, 5, 6] },
    { id: 'sk_n7_aha', period: 'night', name: '[ตัว] ผสม MizuMi B3 AHA (1 ฝ่ามือ) + The Elf Nano White Dose (3-5 หยด)', days: [0, 1, 2, 4, 5] },
    { id: 'sk_n7_tea', period: 'night', name: '[ตัว] ทาเซรั่มตัว WATERCOME White Tea Serum (3-4 ปั๊ม)', days: [3, 6] },
    { id: 'sk_n8', period: 'night', name: '[ตัว] ทา Creamy Gluta Body Booster', days: [0, 1, 2, 3, 4, 5, 6] },
    { id: 'sk_n9', period: 'night', name: '[ตัว] ทาโลชั่นตัว WATERCOME White Tea Lotion ปิดท้ายผิวกาย', days: [0, 1, 2, 3, 4, 5, 6] }
];

function getSkincareItemsForDay(period, dayOfWeek) {
    return (window.skincareItems || []).filter(item => {
        if (item.period !== period) return false;
        if (!Array.isArray(item.days)) return true;
        if (item.days.length === 0) return true;
        return item.days.includes(dayOfWeek);
    });
}

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

function getSleepHoursAndMinutes(sleepHoursVal) {
    const raw = parseFloat(sleepHoursVal);
    if (isNaN(raw) || raw <= 0) return { hrs: '', mins: '', totalHours: 0 };
    const totalMins = Math.round(raw * 60);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return { hrs, mins, totalHours: totalMins / 60 };
}

function updateSleepDurationPart(part, val) {
    const wh = getWatchHealth(currentDateKey);
    const current = getSleepHoursAndMinutes(wh.sleepHours);

    let hrs = (part === 'hrs')
        ? Math.max(0, parseInt(val, 10) || 0)
        : (current.hrs === '' ? 0 : Number(current.hrs));

    let mins = (part === 'mins')
        ? Math.max(0, parseInt(val, 10) || 0)
        : (current.mins === '' ? 0 : Number(current.mins));

    if (mins >= 60) {
        hrs += Math.floor(mins / 60);
        mins = mins % 60;
    }

    if (hrs === 0 && mins === 0 && String(val).trim() === '') {
        wh.sleepHours = '';
    } else {
        wh.sleepHours = Math.round(((hrs + (mins / 60)) + Number.EPSILON) * 100) / 100;
    }

    saveDataAndSync();
}

function renderHabitsSleepBanner() {
    const banner = document.getElementById('habits-sleep-banner');
    if (!banner) return;

    const wh = getWatchHealth(currentDateKey);
    const { hrs, mins, totalHours } = getSleepHoursAndMinutes(wh.sleepHours);
    const score = parseInt(wh.sleepScore) || 0;

    let skinSleepAdvice = 'กรอกชั่วโมงและนาทีที่นอนจาก HUAWEI Watch เพื่อเช็กการฟื้นฟูผิวและฮอร์โมน';
    if (totalHours >= 7) skinSleepAdvice = '✨ นอนเต็มอิ่ม! ผิวและกล้ามเนื้อซ่อมแซมได้เต็มประสิทธิภาพ';
    else if (totalHours > 0 && totalHours < 6) skinSleepAdvice = '⚠️ นอนน้อยกว่า 6 ชม. ระวังผิวโทรม บวมน้ำ และหิวของหวานง่ายขึ้น';

    const durationSummaryText = totalHours > 0 ? `${hrs} ชม. ${mins} นาที` : 'ยังไม่กรอก';

    banner.innerHTML = `
        <div class="space-y-2">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-indigo-300"><i class="fa-solid fa-bed mr-1.5"></i> คุณภาพการนอน & ชีพจร (HUAWEI Watch)</span>
                <span class="text-[10px] text-slate-400">${currentDateKey} • ${durationSummaryText}</span>
            </div>
            <div class="grid grid-cols-4 gap-1.5 text-xs">
                <div class="bg-slate-950/90 p-2 rounded-xl border border-slate-800">
                    <span class="text-[10px] text-slate-400 block">ชม. นอน</span>
                    <input type="number" min="0" max="24" value="${hrs}" onchange="updateSleepDurationPart('hrs', this.value)" placeholder="6"
                        class="w-full bg-transparent text-sm font-bold text-indigo-300 mt-0.5 focus:outline-none">
                </div>
                <div class="bg-slate-950/90 p-2 rounded-xl border border-slate-800">
                    <span class="text-[10px] text-slate-400 block">นาที</span>
                    <input type="number" min="0" max="59" value="${mins}" onchange="updateSleepDurationPart('mins', this.value)" placeholder="20"
                        class="w-full bg-transparent text-sm font-bold text-indigo-300 mt-0.5 focus:outline-none">
                </div>
                <div class="bg-slate-950/90 p-2 rounded-xl border border-slate-800">
                    <span class="text-[10px] text-slate-400 block">Sleep Score</span>
                    <input type="number" value="${wh.sleepScore}" onchange="updateWatchHealthField('sleepScore', this.value)" placeholder="84"
                        class="w-full bg-transparent text-sm font-bold text-emerald-300 mt-0.5 focus:outline-none">
                </div>
                <div class="bg-slate-950/90 p-2 rounded-xl border border-slate-800">
                    <span class="text-[10px] text-slate-400 block">Resting HR</span>
                    <input type="number" value="${wh.rhr}" onchange="updateWatchHealthField('rhr', this.value)" placeholder="51"
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
    if (!confirm(`โหลดรายการสกินแคร์เริ่มต้นทั้ง ${defaultSkincareItems.length} ขั้นตอนกลับมาใช่ไหม?`)) return;
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
    const dayNamesFull = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
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
            const hasSpecial = window.skincareItems.some(
                item => Array.isArray(item.days) && item.days.length > 0 && item.days.length < 7 && item.days.includes(i)
            );

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

    const morningItems = getSkincareItemsForDay('morning', dayOfWeek);
    const nightItems   = getSkincareItemsForDay('night', dayOfWeek);
    const dayTotalCount = morningItems.length + nightItems.length;
    const dayCheckedCount = [...morningItems, ...nightItems].filter(item => checkedIds.includes(item.id)).length;

    const specialNotes = [];
    if (dayOfWeek === 3 || dayOfWeek === 6) specialNotes.push('สครับผิว WATERCOME');
    if (dayOfWeek === 4 || dayOfWeek === 0) specialNotes.push('แปะมาส์กหน้า Myu-Nique');

    if (alertBox) {
        alertBox.innerHTML = specialNotes.length > 0
            ? `
                <div class="bg-gradient-to-r from-pink-950/90 to-purple-950/80 border border-pink-500/40 rounded-2xl p-3 space-y-1">
                    <div class="text-xs font-bold text-pink-300 flex items-center justify-between">
                        <span><i class="fa-solid fa-sparkles text-amber-300 mr-1"></i> วัน${dayNamesFull[dayOfWeek]} (${currentDateKey})</span>
                        <span>${dayCheckedCount}/${dayTotalCount} ขั้นตอน</span>
                    </div>
                    <div class="text-[11px] text-slate-200">คิววันนี้: <b>${specialNotes.join(' • ')}</b></div>
                </div>
            `
            : `
                <div class="bg-slate-950/70 border border-slate-800/80 rounded-xl px-3 py-2 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>วัน${dayNamesFull[dayOfWeek]} (${currentDateKey})</span>
                    <span class="text-pink-400 font-semibold">${dayCheckedCount}/${dayTotalCount} ขั้นตอน</span>
                </div>
            `;
    }

    const renderGroup = (itemsArr) => {
        if (itemsArr.length === 0) return `<div class="text-[11px] text-slate-500 py-1">ไม่มีรายการในหมวดนี้</div>`;
        return itemsArr.map(item => {
            const isChecked = checkedIds.includes(item.id);
            const safeName = item.name.replace(/'/g, "\\'");
            const hasPhoto = !!window.skincarePhotosMap[item.id];

            return `
                <div class="flex items-center justify-between gap-2 bg-slate-900/90 px-3 py-2 rounded-xl border ${isChecked ? 'border-emerald-700/40 opacity-75' : 'border-slate-800'}">
                    <label class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                        <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleSkincareCheck('${item.id}')" class="w-4 h-4 accent-pink-500 rounded cursor-pointer shrink-0">
                        <span class="text-xs leading-snug ${isChecked ? 'line-through text-slate-400' : 'text-slate-100 font-medium'}">${item.name}</span>
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

    listBox.innerHTML = `
        <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
            <div class="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <i class="fa-solid fa-sun"></i> วัน${dayNamesFull[dayOfWeek]} — เช้า
            </div>
            <div class="space-y-1.5">${renderGroup(morningItems)}</div>
        </div>
        <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
            <div class="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <i class="fa-solid fa-moon"></i> วัน${dayNamesFull[dayOfWeek]} — เย็น
            </div>
            <div class="space-y-1.5">${renderGroup(nightItems)}</div>
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
