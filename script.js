const defaultPresets = [
    { name: "ข้าวสวย (1 กล่อง ~150g)", cal: 120, protein: 2 },
    { name: "ไข่ต้ม (1 ฟอง)", cal: 70, protein: 6 },
    { name: "อกไก่ 7-11", cal: 90, protein: 17 },
    { name: "ไข่ต้ม 7-11 (2 ฟอง)", cal: 150, protein: 13 },
    { name: "ข้าวมันไก่ไม่หนัง", cal: 325, protein: 24 },
    { name: "สลัดโรล (4 ชิ้น)", cal: 150, protein: 8 },
    { name: "น้ำจิ้มสลัดโรล", cal: 35, protein: 0 },
    { name: "เล้งต้มยำ / เล้งแซ่บ", cal: 350, protein: 30 },
    { name: "ไข่ตุ๋น 7-11", cal: 90, protein: 7 },
    { name: "ผัดผักหมู (ใช้น้ำมันน้อย)", cal: 275, protein: 15 },
    { name: "ข้าวหน้ากะเพราไก่คั่ว (7-11)", cal: 530, protein: 22 },
    { name: "แคนตาลูป 7-11", cal: 60, protein: 1 }
];

let presets = JSON.parse(localStorage.getItem('calorie_presets')) || defaultPresets;
let logs = JSON.parse(localStorage.getItem('calorie_logs')) || [];

let currentDate = new Date().toISOString().split('T')[0];
let selectedMeal = 'เช้า';
let currentTab = 'logs';

let calViewDate = new Date(); // สำหรับหน้าต่างปฏิทิน
let selectedCalendarDateStr = null;

function initApp() {
    updateDateDisplay();
    syncPresetsFromLogs();
    updateDashboard();
    renderLogs();
    renderLibrary();
}

function syncPresetsFromLogs() {
    let updated = false;
    logs.forEach(log => {
        const exists = presets.some(p => p.name.toLowerCase() === log.name.toLowerCase());
        if(!exists) {
            presets.push({ name: log.name, cal: log.cal, protein: log.protein });
            updated = true;
        }
    });
    if(updated) {
        localStorage.setItem('calorie_presets', JSON.stringify(presets));
    }
}

function changeDate(days) {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + days);
    currentDate = d.toISOString().split('T')[0];
    updateDateDisplay();
    updateDashboard();
    renderLogs();
}

function updateDateDisplay() {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    const dateObj = new Date(currentDate);
    const formatted = dateObj.toLocaleDateString('th-TH', options);
    
    const todayStr = new Date().toISOString().split('T')[0];
    let label = `📅 ${formatted}`;
    if(currentDate === todayStr) label = `📅 วันนี้ (${formatted})`;

    document.getElementById('current-date-display').innerText = label;
}

function switchTab(tab) {
    currentTab = tab;
    const btnLogs = document.getElementById('tab-btn-logs');
    const btnPresets = document.getElementById('tab-btn-presets');
    const divLogs = document.getElementById('tab-logs');
    const divPresets = document.getElementById('tab-presets');

    if(tab === 'logs') {
        btnLogs.className = "flex-1 py-2.5 text-xs font-bold rounded-xl bg-white text-slate-800 shadow-xs transition flex items-center justify-center gap-1.5";
        btnPresets.className = "flex-1 py-2.5 text-xs font-bold rounded-xl text-slate-500 transition flex items-center justify-center gap-1.5";
        divLogs.classList.remove('hidden');
        divPresets.classList.add('hidden');
    } else {
        btnPresets.className = "flex-1 py-2.5 text-xs font-bold rounded-xl bg-white text-slate-800 shadow-xs transition flex items-center justify-center gap-1.5";
        btnLogs.className = "flex-1 py-2.5 text-xs font-bold rounded-xl text-slate-500 transition flex items-center justify-center gap-1.5";
        divPresets.classList.remove('hidden');
        divLogs.classList.add('hidden');
        renderLibrary();
    }
}

function setMealType(meal) {
    selectedMeal = meal;
    document.querySelectorAll('.meal-btn').forEach(btn => {
        const m = btn.dataset.meal;
        if(m === meal) {
            if(m === 'เช้า') btn.className = "meal-btn py-2 text-xs font-bold rounded-xl border border-orange-300 bg-orange-50 text-orange-800 transition";
            else if(m === 'เที่ยง') btn.className = "meal-btn py-2 text-xs font-bold rounded-xl border border-rose-300 bg-rose-50 text-rose-800 transition";
            else if(m === 'เย็น') btn.className = "meal-btn py-2 text-xs font-bold rounded-xl border border-sky-300 bg-sky-50 text-sky-800 transition";
            else if(m === 'ว่าง') btn.className = "meal-btn py-2 text-xs font-bold rounded-xl border border-purple-300 bg-purple-50 text-purple-800 transition";
        } else {
            btn.className = "meal-btn py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 transition";
        }
    });
}

function renderPresetsModalList(listToRender) {
    const container = document.getElementById('preset-list-container');
    if(listToRender.length === 0) {
        container.innerHTML = `<div class="p-3 text-xs text-slate-400 text-center">ไม่พบเมนูในคลัง</div>`;
        return;
    }
    container.innerHTML = listToRender.map(item => `
        <div onclick="selectPreset('${item.name.replace(/'/g, "\\'")}', ${item.cal}, ${item.protein})" class="p-2.5 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs">
            <span class="font-bold text-slate-800">${item.name}</span>
            <span class="text-slate-500 font-medium">${item.cal} kcal | โปรตีน ${item.protein}g</span>
        </div>
    `).join('');
}

function filterPresetsModal() {
    const query = document.getElementById('menu-search').value.toLowerCase();
    const filtered = presets.filter(p => p.name.toLowerCase().includes(query));
    renderPresetsModalList(filtered);
}

function selectPreset(name, cal, protein) {
    document.getElementById('food-name').value = name;
    document.getElementById('base-cal').value = cal;
    document.getElementById('base-protein').value = protein;
    document.getElementById('food-qty').value = 1;
    document.getElementById('menu-search').value = '';
    renderPresetsModalList(presets);
    calculatePreview();
}

function calculatePreview() {
    const qty = parseFloat(document.getElementById('food-qty').value) || 0;
    const baseCal = parseFloat(document.getElementById('base-cal').value) || 0;
    const baseProtein = parseFloat(document.getElementById('base-protein').value) || 0;

    const totalCal = Math.round(qty * baseCal);
    const totalProtein = Math.round((qty * baseProtein) * 10) / 10;

    document.getElementById('preview-total-cal').innerText = totalCal;
    document.getElementById('preview-total-protein').innerText = totalProtein;
}

function renderLibrary() {
    const query = document.getElementById('library-search') ? document.getElementById('library-search').value.toLowerCase() : '';
    const filtered = presets.filter(p => p.name.toLowerCase().includes(query));
    const container = document.getElementById('preset-library-list');

    if(filtered.length === 0) {
        container.innerHTML = `<div class="text-center py-6 text-slate-400 text-xs bg-white rounded-2xl border border-slate-100">ไม่พบเมนูอาหารในคลัง</div>`;
        return;
    }

    container.innerHTML = filtered.map(item => `
        <div class="bg-white rounded-2xl p-3.5 shadow-xs border border-slate-100 flex justify-between items-center">
            <div>
                <h4 class="text-xs font-bold text-slate-800">${item.name}</h4>
                <p class="text-[11px] text-slate-500 mt-0.5">หน่วยละ: ${item.cal} kcal | โปรตีน ${item.protein}g</p>
            </div>
            <div class="flex items-center gap-1.5">
                <button onclick="openModalWithPreset('${item.name.replace(/'/g, "\\'")}', ${item.cal}, ${item.protein})" class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl transition">
                    + เลือกกิน
                </button>
                <button onclick="deletePreset('${item.name.replace(/'/g, "\\'")}')" class="p-1.5 text-slate-300 hover:text-rose-500 transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
        </div>
    `).join('');
}

function openModalWithPreset(name, cal, protein) {
    openModal();
    selectPreset(name, cal, protein);
}

function deletePreset(name) {
    if(confirm(`ต้องการลบ "${name}" ออกจากคลังเมนูใช่หรือไม่?`)) {
        presets = presets.filter(p => p.name !== name);
        localStorage.setItem('calorie_presets', JSON.stringify(presets));
        renderLibrary();
    }
}

function handleFormSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('food-name').value.trim();
    const qty = parseFloat(document.getElementById('food-qty').value) || 1;
    const baseCal = parseFloat(document.getElementById('base-cal').value) || 0;
    const baseProtein = parseFloat(document.getElementById('base-protein').value) || 0;

    const finalCal = Math.round(qty * baseCal);
    const finalProtein = Math.round((qty * baseProtein) * 10) / 10;
    const displayName = qty !== 1 ? `${name} (x${qty})` : name;

    const newLog = {
        id: Date.now(),
        date: currentDate,
        meal: selectedMeal,
        name: displayName,
        cal: finalCal,
        protein: finalProtein
    };

    logs.push(newLog);
    localStorage.setItem('calorie_logs', JSON.stringify(logs));

    if(!presets.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        presets.push({ name, cal: baseCal, protein: baseProtein });
        localStorage.setItem('calorie_presets', JSON.stringify(presets));
    }

    closeModal();
    updateDashboard();
    renderLogs();
    renderLibrary();
}

function handleCustomPresetSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('cp-name').value.trim();
    const cal = parseFloat(document.getElementById('cp-cal').value) || 0;
    const protein = parseFloat(document.getElementById('cp-protein').value) || 0;

    if(!presets.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        presets.push({ name, cal, protein });
        localStorage.setItem('calorie_presets', JSON.stringify(presets));
        renderLibrary();
        alert(`เพิ่ม "${name}" ลงในคลังเมนูสำเร็จ!`);
    } else {
        alert('มีชื่อเมนูนี้อยู่ในคลังแล้ว');
    }
    closeCustomPresetModal();
}

function deleteLog(id) {
    logs = logs.filter(l => l.id !== id);
    localStorage.setItem('calorie_logs', JSON.stringify(logs));
    updateDashboard();
    renderLogs();
}

function updateDashboard() {
    const targetLogs = logs.filter(l => l.date === currentDate);

    const totalCal = targetLogs.reduce((sum, item) => sum + item.cal, 0);
    const totalProtein = targetLogs.reduce((sum, item) => sum + item.protein, 0);
    const remaining = 1500 - totalCal;

    document.getElementById('total-cal').innerText = totalCal;
    document.getElementById('remaining-cal').innerText = remaining > 0 ? remaining : 0;
    document.getElementById('total-protein').innerText = totalProtein;

    const progressPercent = Math.min((totalCal / 1500) * 100, 100);
    const progressBar = document.getElementById('cal-progress');
    progressBar.style.width = `${progressPercent}%`;

    const statusBadge = document.getElementById('status-badge');
    const percentCal = document.getElementById('percent-cal');
    percentCal.innerText = `${Math.round((totalCal / 1500) * 100)}%`;

    if(totalCal > 1500) {
        statusBadge.innerText = "⚠️ เกินเป้าหมาย";
        statusBadge.className = "px-3 py-1.5 rounded-xl bg-rose-500 text-white text-xs font-bold backdrop-blur-sm";
    } else if(totalCal >= 1400) {
        statusBadge.innerText = "🔥 ผ่านเกณฑ์ 👍";
        statusBadge.className = "px-3 py-1.5 rounded-xl bg-white text-emerald-800 text-xs font-bold shadow-xs";
    } else {
        statusBadge.innerText = "กำลังคุมแคล";
        statusBadge.className = "px-3 py-1.5 rounded-xl bg-white/20 text-white text-xs font-bold backdrop-blur-sm";
    }

    const pStatus = document.getElementById('protein-status');
    if(totalProtein >= 96) {
        pStatus.innerText = "🎯 ถึงเป้าโปรตีนแล้ว!";
        pStatus.className = "text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-400 text-emerald-950 shadow-xs";
    } else {
        pStatus.innerText = `ต้องการอีก ${96 - totalProtein}g`;
        pStatus.className = "text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-400 text-amber-950 shadow-xs";
    }
}

function renderLogs() {
    const targetLogs = logs.filter(l => l.date === currentDate);
    const container = document.getElementById('log-list');

    document.getElementById('log-count').innerText = `${targetLogs.length} รายการ`;

    if(targetLogs.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs bg-white rounded-2xl border border-slate-100">ยังไม่มีรายการบันทึกในวันนี้</div>`;
        return;
    }

    const mealOrder = { 'เช้า': 1, 'เที่ยง': 2, 'เย็น': 3, 'ว่าง': 4 };
    const sortedLogs = [...targetLogs].sort((a, b) => (mealOrder[a.meal] || 99) - (mealOrder[b.meal] || 99));

    const grouped = {};
    sortedLogs.forEach(item => {
        if(!grouped[item.meal]) grouped[item.meal] = [];
        grouped[item.meal].push(item);
    });

    const mealDisplayOrder = ['เช้า', 'เที่ยง', 'เย็น', 'ว่าง'];
    let htmlContent = '';

    mealDisplayOrder.forEach(mealName => {
        if(grouped[mealName] && grouped[mealName].length > 0) {
            let headerBg = '', headerText = '';
            if(mealName === 'เช้า') { headerBg = 'bg-orange-50 border-orange-200'; headerText = 'text-orange-900'; }
            else if(mealName === 'เที่ยง') { headerBg = 'bg-rose-50 border-rose-200'; headerText = 'text-rose-900'; }
            else if(mealName === 'เย็น') { headerBg = 'bg-sky-50 border-sky-200'; headerText = 'text-sky-900'; }
            else if(mealName === 'ว่าง') { headerBg = 'bg-purple-50 border-purple-200'; headerText = 'text-purple-900'; }

            const mealTotalCal = grouped[mealName].reduce((sum, i) => sum + i.cal, 0);
            const mealTotalProtein = grouped[mealName].reduce((sum, i) => sum + i.protein, 0);

            htmlContent += `
                <div class="space-y-2">
                    <div class="flex justify-between items-center px-3 py-1.5 rounded-xl border ${headerBg} text-xs font-bold ${headerText}">
                        <span>🍽️ มื้อ${mealName}</span>
                        <span class="text-[11px] font-medium opacity-90">${mealTotalCal} kcal | โปรตีน ${mealTotalProtein}g</span>
                    </div>
            `;

            grouped[mealName].forEach(item => {
                let badgeStyle = "text-[10px] font-bold px-2 py-0.5 rounded-lg ";
                if(item.meal === 'เช้า') badgeStyle += "bg-orange-100 text-orange-800";
                else if(item.meal === 'เที่ยง') badgeStyle += "bg-rose-100 text-rose-800";
                else if(item.meal === 'เย็น') badgeStyle += "bg-sky-100 text-sky-800";
                else if(item.meal === 'ว่าง') badgeStyle += "bg-purple-100 text-purple-800";
                else badgeStyle += "bg-slate-100 text-slate-700";

                htmlContent += `
                    <div class="bg-white rounded-2xl p-3.5 shadow-xs border border-slate-100 flex justify-between items-center ml-2">
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <span class="${badgeStyle}">${item.meal}</span>
                                <h4 class="text-xs font-bold text-slate-800">${item.name}</h4>
                            </div>
                            <p class="text-[11px] text-slate-500">โปรตีน ${item.protein}g</p>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-xs font-extrabold text-slate-900">${item.cal} kcal</span>
                            <button onclick="deleteLog(${item.id})" class="text-slate-300 hover:text-rose-500 p-1 transition">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                        </div>
                    </div>
                `;
            });

            htmlContent += `</div>`;
        }
    });

    container.innerHTML = htmlContent;
}

// ================= CALENDAR SYSTEM =================
function openCalendarModal() {
    renderCalendar();
    document.getElementById('calendar-modal').classList.remove('hidden');
}

function closeCalendarModal() {
    document.getElementById('calendar-modal').classList.add('hidden');
    document.getElementById('cal-day-detail').classList.add('hidden');
    selectedCalendarDateStr = null;
}

function changeCalendarMonth(direction) {
    calViewDate.setMonth(calViewDate.getMonth() + direction);
    renderCalendar();
    document.getElementById('cal-day-detail').classList.add('hidden');
}

function renderCalendar() {
    const year = calViewDate.getFullYear();
    const month = calViewDate.getMonth();

    const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    document.getElementById('cal-month-title').innerText = `${monthNames[month]} ${year + 543}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const gridContainer = document.getElementById('calendar-grid');
    let html = '';

    // Blank spaces for previous month offset
    for(let i = 0; i < firstDayIndex; i++) {
        html += `<div class="h-14 bg-slate-50/40 rounded-xl"></div>`;
    }

    // Days of current month
    for(let day = 1; day <= totalDays; day++) {
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        const dateStr = `${year}-${mm}-${dd}`;

        // Calculate totals for this date
        const dayLogs = logs.filter(l => l.date === dateStr);
        const dayCal = dayLogs.reduce((sum, item) => sum + item.cal, 0);
        const dayProtein = dayLogs.reduce((sum, item) => sum + item.protein, 0);

        // Dot 1: Calorie Color
        // <=1500 green, >1500 & <=2000 orange, >2000 red
        let calDotColor = 'bg-slate-200';
        if(dayLogs.length > 0) {
            if(dayCal <= 1500) calDotColor = 'bg-emerald-500';
            else if(dayCal <= 2000) calDotColor = 'bg-amber-500';
            else calDotColor = 'bg-rose-500';
        }

        // Dot 2: Protein Color (Goal 96g)
        // <48 (50%) red, 48-71.9 (50-75%) yellow, >=72 (75%+) green
        let proDotColor = 'bg-slate-200';
        if(dayLogs.length > 0) {
            if(dayProtein < 48) proDotColor = 'bg-rose-500';
            else if(dayProtein < 72) proDotColor = 'bg-amber-400';
            else proDotColor = 'bg-emerald-500';
        }

        const isSelected = selectedCalendarDateStr === dateStr ? 'ring-2 ring-emerald-500 bg-emerald-50/50' : 'bg-white hover:bg-slate-50';
        const isToday = dateStr === new Date().toISOString().split('T')[0] ? 'border-emerald-400 font-bold' : 'border-slate-100';

        html += `
            <div onclick="selectCalendarDate('${dateStr}')" class="h-14 border ${isToday} ${isSelected} rounded-xl p-1.5 flex flex-col justify-between cursor-pointer transition relative">
                <span class="text-[11px] text-slate-700">${day}</span>
                <div class="flex justify-center gap-1 pb-0.5">
                    <div class="w-2 h-2 rounded-full ${calDotColor}" title="แคล: ${dayCal} kcal"></div>
                    <div class="w-2 h-2 rounded-full ${proDotColor}" title="โปรตีน: ${dayProtein}g"></div>
                </div>
            </div>
        `;
    }

    gridContainer.innerHTML = html;
}

function selectCalendarDate(dateStr) {
    selectedCalendarDateStr = dateStr;
    renderCalendar(); // re-render to show selection ring

    const detailBox = document.getElementById('cal-day-detail');
    const titleEl = document.getElementById('detail-date-title');
    const contentEl = document.getElementById('detail-date-content');

    const dateObj = new Date(dateStr);
    const formatted = dateObj.toLocaleDateString('th-TH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    titleEl.innerText = `📅 ${formatted}`;

    const dayLogs = logs.filter(l => l.date === dateStr);
    const totalCal = dayLogs.reduce((s, i) => s + i.cal, 0);
    const totalProtein = dayLogs.reduce((s, i) => s + i.protein, 0);

    if(dayLogs.length === 0) {
        contentEl.innerHTML = `<p class="text-slate-400 italic py-1">ไม่มีบันทึกอาหารในวันนี้</p>`;
    } else {
        let listHtml = `<div class="font-semibold text-slate-700 mb-1">รวม: ${totalCal} kcal | โปรตีน ${totalProtein}g (${dayLogs.length} รายการ)</div><div class="space-y-1 max-h-32 overflow-y-auto pr-1">`;
        dayLogs.forEach(item => {
            listHtml += `<div class="flex justify-between bg-white px-2.5 py-1 rounded-lg border border-slate-100 text-[11px]">
                <span class="font-medium text-slate-800">[${item.meal}] ${item.name}</span>
                <span class="text-slate-500">${item.cal} kcal | โปรตีน ${item.protein}g</span>
            </div>`;
        });
        listHtml += `</div>`;
        contentEl.innerHTML = listHtml;
    }

    detailBox.classList.remove('hidden');
}

function jumpToDateFromCalendar() {
    if(selectedCalendarDateStr) {
        currentDate = selectedCalendarDateStr;
        updateDateDisplay();
        updateDashboard();
        renderLogs();
        closeCalendarModal();
    }
}
// ===================================================

function openModal() {
    document.getElementById('food-modal').classList.remove('hidden');
    renderPresetsModalList(presets);
    document.getElementById('food-qty').value = 1;
    calculatePreview();
}

function closeModal() {
    document.getElementById('food-modal').classList.add('hidden');
    document.getElementById('food-form').reset();
    document.getElementById('menu-search').value = '';
    selectedMeal = 'เช้า';
    setMealType('เช้า');
}

function openCustomPresetModal() {
    document.getElementById('custom-preset-modal').classList.remove('hidden');
}

function closeCustomPresetModal() {
    document.getElementById('custom-preset-modal').classList.add('hidden');
}

function openSummaryModal() {
    const container = document.getElementById('summary-history-list');
    
    const grouped = {};
    logs.forEach(l => {
        if(!grouped[l.date]) grouped[l.date] = { cal: 0, protein: 0, count: 0 };
        grouped[l.date].cal += l.cal;
        grouped[l.date].protein += l.protein;
        grouped[l.date].count += 1;
    });

    const dates = Object.keys(grouped).sort().reverse();

    if(dates.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs">ยังไม่มีประวัติการบันทึกข้อมูล</div>`;
    } else {
        container.innerHTML = dates.map(dateStr => {
            const data = grouped[dateStr];
            const dateObj = new Date(dateStr);
            const formattedDate = dateObj.toLocaleDateString('th-TH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
            
            const isOverCal = data.cal > 1500;
            const calBadge = isOverCal 
                ? `<span class="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md font-bold">⚠️ เกิน (${data.cal} kcal)</span>`
                : `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md font-bold">✅ ${data.cal} / 1,500 kcal</span>`;
            
            const proteinDiff = 96 - data.protein;
            const proteinBadge = data.protein >= 96 
                ? `<span class="text-emerald-600 font-bold">🎯 ถึงเป้าแล้ว (${data.protein}g)</span>`
                : `<span class="text-amber-600 font-bold">ขาดอีก ${proteinDiff}g (${data.protein}/96g)</span>`;

            return `
                <div class="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-2">
                    <div class="flex justify-between items-center text-xs font-bold text-slate-800">
                        <span>📅 ${formattedDate}</span>
                        <span>${calBadge}</span>
                    </div>
                    <div class="flex justify-between items-center text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                        <span>💪 โปรตีน: ${proteinBadge}</span>
                        <span class="text-slate-400">${data.count} รายการ</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    document.getElementById('summary-modal').classList.remove('hidden');
}

function closeSummaryModal() {
    document.getElementById('summary-modal').classList.add('hidden');
}

function openExportModal() {
    document.getElementById('export-modal').classList.remove('hidden');
}

function closeExportModal() {
    document.getElementById('export-modal').classList.add('hidden');
}

function exportData() {
    const data = { presets, logs };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fit-tracker-backup-${currentDate}.json`;
    a.click();
}

function importData(event) {
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if(parsed.presets && parsed.logs) {
                presets = parsed.presets;
                logs = parsed.logs;
                localStorage.setItem('calorie_presets', JSON.stringify(presets));
                localStorage.setItem('calorie_logs', JSON.stringify(logs));
                initApp();
                alert('นำเข้าข้อมูลสำเร็จ!');
                closeExportModal();
            } else {
                alert('รูปแบบไฟล์ไม่ถูกต้อง');
            }
        } catch(err) {
            alert('เกิดข้อผิดพลาดในการอ่านไฟล์');
        }
    };
    reader.readAsText(file);
}

window.onload = initApp;
