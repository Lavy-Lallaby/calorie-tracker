// ==========================================================================
// summary.js — โมดูลสรุปผล, กราฟ 7 วัน, ปฏิทินรายเดือน, รายงานสุขภาพ & Watch Trend
// ==========================================================================

let calendarViewYear = new Date().getFullYear();
let calendarViewMonth = new Date().getMonth();
let calendarSelectedKey = currentDateKey;
let currentReportDays = 7;
let v59TrendMode = 'cal'; // 'cal' | 'sleep'

// ------------------------------------------
// 1. Entry Point สำหรับ Render หน้า Summary ทั้งหมด
// ------------------------------------------
function renderSummaryPage() {
    const parts = currentDateKey.split('-');
    calendarViewYear = parseInt(parts[0], 10);
    calendarViewMonth = parseInt(parts[1], 10) - 1;
    calendarSelectedKey = currentDateKey;

    renderWeeklyChart();
    renderCalendarMonth();
    renderCalendarDayDetail(calendarSelectedKey);
    renderSleepRhrCard();
    renderWeeklyTrendDualCard();
    renderHealthReport(currentReportDays);
}

// ------------------------------------------
// 2. กราฟแท่งแคลอรี 7 วัน + เส้นขั้นบันได Min-Max
// ------------------------------------------
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
            totalBurn = getTotalBurned(dayObj).totalBurn;
        }

        const effectiveLimit = dGoals.max + totalBurn;
        if (totalCal > maxVal) maxVal = totalCal;
        if (dGoals.max + 500 > maxVal) maxVal = dGoals.max + 500;

        daysData.push({
            key,
            label: dayNames[d.getDay()],
            dayNum: d.getDate(),
            cal: fmtPrecise(totalCal, 0),
            limit: effectiveLimit,
            goalMax: dGoals.max,
            goalMin: dGoals.min,
            isSelected: key === currentDateKey
        });
    }

    const colW = 100 / 7;
    let maxStepPoints = [], minStepPoints = [], stepBadgesHtml = '';

    daysData.forEach((d, idx) => {
        const x1 = (idx * colW).toFixed(2);
        const x2 = ((idx + 1) * colW).toFixed(2);
        const yMax = (100 - Math.min(100, (d.goalMax / maxVal) * 100)).toFixed(2);
        const yMin = (100 - Math.min(100, (d.goalMin / maxVal) * 100)).toFixed(2);

        maxStepPoints.push(`${x1},${yMax} ${x2},${yMax}`);
        minStepPoints.push(`${x1},${yMin} ${x2},${yMin}`);

        const prev = idx > 0 ? daysData[idx - 1] : null;
        if (!prev || prev.goalMax !== d.goalMax) {
            const bottomPct = Math.min(100, (d.goalMax / maxVal) * 100);
            const posStyle = idx === daysData.length - 1 ? 'right: 0;' : `left: ${(idx * colW).toFixed(1)}%;`;
            stepBadgesHtml += `<span class="absolute text-[9px] bg-slate-900/95 text-amber-400 px-1 rounded font-semibold border border-amber-500/30 z-30 pointer-events-none" style="${posStyle} bottom: calc(${bottomPct}% + 3px);">${d.goalMax.toLocaleString()}</span>`;
        }
        if (!prev || prev.goalMin !== d.goalMin) {
            const bottomPct = Math.min(100, (d.goalMin / maxVal) * 100);
            const posStyle = idx === daysData.length - 1 ? 'right: 0;' : `left: ${(idx * colW).toFixed(1)}%;`;
            stepBadgesHtml += `<span class="absolute text-[9px] bg-slate-900/95 text-cyan-400 px-1 rounded font-semibold border border-cyan-500/30 z-30 pointer-events-none" style="${posStyle} bottom: calc(${bottomPct}% - 14px);">${d.goalMin.toLocaleString()}</span>`;
        }
    });

    const barsHtml = daysData.map(d => {
        const barHeightPct = Math.min(100, Math.round((d.cal / maxVal) * 100));
        const isOver = d.cal > d.limit;
        const barColor = d.cal > 0 ? (isOver ? 'bg-rose-500' : 'bg-emerald-400') : 'bg-slate-700';
        const activeRing = d.isSelected ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-900' : 'opacity-85 hover:opacity-100';

        return `
            <button type="button" onclick="selectChartDay('${d.key}')" class="flex-1 flex flex-col items-center group focus:outline-none">
                <span class="text-[9px] font-semibold mb-1 ${isOver ? 'text-rose-400' : (d.cal > 0 ? 'text-slate-300' : 'text-slate-600')}">${d.cal > 0 ? d.cal : '-'}</span>
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
            <div class="absolute left-0 right-0 h-24 pointer-events-none z-20" style="bottom: 30px;">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-full overflow-visible">
                    <polyline fill="none" stroke="#fbbf24" stroke-width="1.3" stroke-dasharray="2.5,2" vector-effect="non-scaling-stroke" points="${maxStepPoints.join(' ')}" />
                    <polyline fill="none" stroke="#22d3ee" stroke-width="1.2" stroke-dasharray="2.5,2" vector-effect="non-scaling-stroke" points="${minStepPoints.join(' ')}" />
                </svg>
                ${stepBadgesHtml}
            </div>
            <div class="flex items-end justify-between gap-1.5">${barsHtml}</div>
        </div>
    `;
}

function selectChartDay(dateKey) {
    currentDateKey = dateKey;
    renderActivePageUI();
}

// ------------------------------------------
// 3. ปฏิทินรายเดือนแบบจุดสถานะคู่
// ------------------------------------------
function changeCalendarMonth(delta) {
    calendarViewMonth += delta;
    if (calendarViewMonth < 0) { calendarViewMonth = 11; calendarViewYear--; }
    else if (calendarViewMonth > 11) { calendarViewMonth = 0; calendarViewYear++; }
    renderCalendarMonth();
}

function getDayStatsForCalendar(dateKey) {
    const dayObj = allMealsHistory[dateKey];
    if (!dayObj) return null;

    let totalCal = 0, totalProt = 0, totalCarbs = 0, totalFat = 0, itemCount = 0;
    if (dayObj.meals) {
        Object.values(dayObj.meals).forEach(list => list.forEach(item => {
            totalCal += Number(item.calories || 0);
            totalProt += Number(item.protein || 0);
            totalCarbs += Number(item.carbs || 0);
            totalFat += Number(item.fat || 0);
            itemCount++;
        }));
    }

    const steps = Number(dayObj.steps || 0);
    const water = Number(dayObj.water || 0);
    const totalBurn = getTotalBurned(dayObj).totalBurn;
    if (itemCount === 0 && steps === 0 && totalBurn === 0 && water === 0 && !dayObj.weight) return null;

    return { totalCal, totalProt, totalCarbs, totalFat, steps, water, weight: dayObj.weight, totalBurn, dayObj };
}

function renderCalendarMonth() {
    const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    const titleEl = document.getElementById('calendar-month-title');
    if (titleEl) titleEl.innerText = `${monthNames[calendarViewMonth]} ${calendarViewYear + 543}`;

    const container = document.getElementById('calendar-grid-container');
    if (!container) return;
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
        const targetCal = getDayCalorieGoals(key).max;
        const isSelected = key === calendarSelectedKey;
        const isToday = key === todayKey;

        let dotsHtml = `<div class="h-2 flex items-center justify-center gap-1 mt-0.5"></div>`;
        if (stats && stats.totalCal > 0) {
            const calDot = stats.totalCal > targetCal + 500 ? 'bg-rose-500' : (stats.totalCal > targetCal ? 'bg-orange-400' : 'bg-emerald-400');
            const protPct = (stats.totalProt / protMin) * 100;
            const protDot = protPct < 50 ? 'bg-rose-500' : (protPct < 75 ? 'bg-amber-300' : 'bg-emerald-400');
            dotsHtml = `<div class="h-2 flex items-center justify-center gap-1 mt-0.5"><span class="w-1.5 h-1.5 rounded-full ${calDot}"></span><span class="w-1.5 h-1.5 rounded-full ${protDot}"></span></div>`;
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
    if (!detailBox) return;
    const stats = getDayStatsForCalendar(dateKey);

    if (!stats) {
        detailBox.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <div class="text-xs font-bold text-white">${formatDisplayDate(dateKey)}</div>
                    <div class="text-[11px] text-slate-500 mt-0.5">ยังไม่มีข้อมูลบันทึกในวันนี้</div>
                </div>
                <button type="button" onclick="currentDateKey='${dateKey}'; loadPageModule('foodtrack');" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-2 rounded-xl font-semibold shrink-0">เปิดวันนี้</button>
            </div>
        `;
        return;
    }

    const adj = getCalorieAdjustment(dateKey);
    const protMin = Number(userGoals.proteinMin) || 96;
    const protPct = Math.round((stats.totalProt / protMin) * 100);
    const remaining = fmtPrecise((adj.safeTarget + stats.totalBurn) - stats.totalCal, 1);

    let mealsBreakdown = '';
    mealTypes.forEach(mType => {
        const list = stats.dayObj.meals?.[mType] || [];
        if (list.length > 0) {
            mealsBreakdown += `<div class="text-[11px] text-slate-300"><span class="text-indigo-400 font-semibold">${mType}:</span> ${list.map(i => `${i.name} (${fmtPrecise(i.calories, 1)} kcal, P:${fmtPrecise(i.protein, 2)}g)`).join(', ')}</div>`;
        }
    });

    detailBox.innerHTML = `
        <div class="flex justify-between items-start gap-2 border-b border-slate-800 pb-2">
            <div>
                <div class="text-xs font-bold text-white">${formatDisplayDate(dateKey)}</div>
                <div class="text-[11px] text-slate-400 mt-0.5">
                    ทาน <b class="text-white">${fmtPrecise(stats.totalCal, 1)}</b> kcal | เผาผลาญ <b class="text-orange-400">${stats.totalBurn}</b> kcal | น้ำ <b class="text-sky-400">${stats.water}</b> ml
                    ${stats.weight ? `| นน. <b class="text-purple-400">${stats.weight}</b> kg` : ''}
                </div>
            </div>
            <button type="button" onclick="currentDateKey='${dateKey}'; loadPageModule('foodtrack');" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-xl font-semibold shrink-0">แก้ไขวันนั้น</button>
        </div>

        <div class="grid grid-cols-4 gap-1.5 text-center text-[11px]">
            <div class="bg-slate-900 p-1.5 rounded-lg border border-slate-800"><span class="text-[9px] text-slate-400 block">โปรตีน (${protPct}%)</span><span class="font-bold text-emerald-400">${fmtPrecise(stats.totalProt, 2)}g</span></div>
            <div class="bg-slate-900 p-1.5 rounded-lg border border-slate-800"><span class="text-[9px] text-slate-400 block">คาร์บ</span><span class="font-bold text-slate-200">${fmtPrecise(stats.totalCarbs, 2)}g</span></div>
            <div class="bg-slate-900 p-1.5 rounded-lg border border-slate-800"><span class="text-[9px] text-slate-400 block">ไขมัน</span><span class="font-bold text-slate-200">${fmtPrecise(stats.totalFat, 2)}g</span></div>
            <div class="bg-slate-900 p-1.5 rounded-lg border border-slate-800"><span class="text-[9px] text-slate-400 block">คงเหลือ</span><span class="font-bold ${remaining < 0 ? 'text-rose-400' : 'text-sky-400'}">${remaining}</span></div>
        </div>

        <details class="pt-1">
            <summary class="text-[11px] text-amber-400 font-medium cursor-pointer select-none hover:underline">กดเพื่อขยายดูรายการอาหารทั้งหมดของวันนี้</summary>
            <div class="mt-2 space-y-1 pl-2 border-l-2 border-slate-800">${mealsBreakdown || '<div class="text-[11px] text-slate-500">ไม่มีรายการอาหาร</div>'}</div>
        </details>
    `;
}

// ------------------------------------------
// 4. HUAWEI Watch Sleep/RHR Card & Dual Trend Chart
// ------------------------------------------
function renderSleepRhrCard() {
    const card = document.getElementById('sleep-rhr-card');
    if (!card) return;

    const dayObj = getDayData(currentDateKey);
    if (!dayObj.watchHealth) dayObj.watchHealth = { sleepHours: '', sleepScore: '', rhr: '' };
    const wh = dayObj.watchHealth;

    const h = parseFloat(wh.sleepHours) || 0;
    const score = parseInt(wh.sleepScore) || 0;
    let readiness = 'กรอกข้อมูลการนอนและชีพจรจาก HUAWEI Watch เพื่อประเมินการฟื้นตัว';
    let readinessColor = 'text-slate-400';

    if (h >= 7 && score >= 75) { readiness = '🟢 ฟื้นตัวดีเยี่ยม! พร้อมเล่นเวทหนักและเพิ่มน้ำหนักเวทได้'; readinessColor = 'text-emerald-400'; }
    else if (h > 0 && h < 6) { readiness = '🟠 นอนน้อยกว่า 6 ชม. ระวังความล้าและอาการอยากของหวาน'; readinessColor = 'text-amber-400'; }
    else if (h >= 6) { readiness = '🟡 ฟื้นตัวปานกลาง เล่นเวทตามตารางปกติได้'; readinessColor = 'text-sky-400'; }

    card.innerHTML = `
        <div class="space-y-2.5">
            <div class="text-xs font-bold text-indigo-300 flex items-center justify-between">
                <span><i class="fa-solid fa-heart-pulse mr-1.5"></i> คุณภาพการนอน & ชีพจร (HUAWEI Watch)</span>
                <span class="text-[10px] text-slate-400">${currentDateKey}</span>
            </div>
            <div class="grid grid-cols-3 gap-2 text-xs">
                <div class="bg-slate-950/90 p-2 rounded-xl border border-slate-800">
                    <span class="text-[10px] text-slate-400 block">ชั่วโมงนอน</span>
                    <input type="number" step="0.1" value="${wh.sleepHours}" onchange="getDayData(currentDateKey).watchHealth.sleepHours=this.value; saveDataAndSync();" placeholder="7.5"
                        class="w-full bg-transparent text-sm font-bold text-indigo-300 mt-0.5 focus:outline-none">
                </div>
                <div class="bg-slate-950/90 p-2 rounded-xl border border-slate-800">
                    <span class="text-[10px] text-slate-400 block">TruSleep Score</span>
                    <input type="number" value="${wh.sleepScore}" onchange="getDayData(currentDateKey).watchHealth.sleepScore=this.value; saveDataAndSync();" placeholder="85"
                        class="w-full bg-transparent text-sm font-bold text-emerald-300 mt-0.5 focus:outline-none">
                </div>
                <div class="bg-slate-950/90 p-2 rounded-xl border border-slate-800">
                    <span class="text-[10px] text-slate-400 block">Resting HR (bpm)</span>
                    <input type="number" value="${wh.rhr}" onchange="getDayData(currentDateKey).watchHealth.rhr=this.value; saveDataAndSync();" placeholder="58"
                        class="w-full bg-transparent text-sm font-bold text-rose-400 mt-0.5 focus:outline-none">
                </div>
            </div>
            <div class="text-[11px] ${readinessColor} bg-slate-950/60 px-2.5 py-1.5 rounded-xl border border-slate-800/80">${readiness}</div>
        </div>
    `;
}

function renderWeeklyTrendDualCard() {
    const card = document.getElementById('weekly-trend-dual-card');
    if (!card) return;

    const parts = currentDateKey.split('-');
    const baseDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const trendDays = [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i);
        const key = getFormattedDateKey(d);
        const dayObj = allMealsHistory[key];

        let cal = 0;
        if (dayObj?.meals) Object.values(dayObj.meals).forEach(list => list.forEach(m => { cal += Number(m.calories || 0); }));
        const burn = dayObj ? getTotalBurned(dayObj).totalBurn : 0;
        const netCal = cal > 0 ? Math.max(0, Math.round(cal - burn)) : 0;
        const w = (dayObj?.weight !== null && dayObj?.weight !== undefined && dayObj?.weight !== '') ? Number(dayObj.weight) : null;
        const slp = dayObj?.watchHealth?.sleepHours ? Number(dayObj.watchHealth.sleepHours) : null;

        trendDays.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, weight: w, netCal, sleep: slp });
    }

    const validW = trendDays.filter(d => d.weight !== null);
    const avgW = validW.length ? (validW.reduce((s, d) => s + d.weight, 0) / validW.length).toFixed(1) : '-';
    const validNet = trendDays.filter(d => d.netCal > 0);
    const avgNet = validNet.length ? Math.round(validNet.reduce((s, d) => s + d.netCal, 0) / validNet.length) : 0;
    const validSlp = trendDays.filter(d => d.sleep !== null);
    const avgSlp = validSlp.length ? (validSlp.reduce((s, d) => s + d.sleep, 0) / validSlp.length).toFixed(1) : '-';

    const minW = validW.length ? Math.min(...validW.map(d => d.weight)) - 0.5 : 60;
    const maxW = validW.length ? Math.max(...validW.map(d => d.weight)) + 0.5 : 70;
    const secMax = Math.max(...trendDays.map(d => v59TrendMode === 'cal' ? d.netCal : (d.sleep || 0)), v59TrendMode === 'cal' ? 1800 : 9);

    const svgW = 320, svgH = 115, padX = 22, padY = 16;
    const stepX = (svgW - padX * 2) / 6;
    const wPts = [], sPts = [];

    trendDays.forEach((d, i) => {
        const x = padX + i * stepX;
        if (d.weight !== null) {
            const yW = svgH - padY - ((d.weight - minW) / (maxW - minW || 1)) * (svgH - padY * 2);
            wPts.push(`${x},${yW.toFixed(1)}`);
        }
        const sv = v59TrendMode === 'cal' ? d.netCal : (d.sleep || 0);
        const yS = svgH - padY - (sv / (secMax || 1)) * (svgH - padY * 2);
        sPts.push(`${x},${yS.toFixed(1)}`);
    });

    const svgChart = `
        <svg viewBox="0 0 ${svgW} ${svgH + 18}" class="w-full h-36">
            <line x1="${padX}" y1="${svgH - padY}" x2="${svgW - padX}" y2="${svgH - padY}" stroke="#334155" stroke-width="1"/>
            <polyline fill="none" stroke="${v59TrendMode === 'cal' ? '#fbbf24' : '#818cf8'}" stroke-width="2" stroke-dasharray="3,3" points="${sPts.join(' ')}"/>
            ${wPts.length > 1 ? `<polyline fill="none" stroke="#34d399" stroke-width="2.5" points="${wPts.join(' ')}"/>` : ''}
            ${trendDays.map((d, i) => {
                const x = padX + i * stepX;
                const sv = v59TrendMode === 'cal' ? d.netCal : (d.sleep || 0);
                const yS = svgH - padY - (sv / (secMax || 1)) * (svgH - padY * 2);
                const yW = d.weight !== null ? svgH - padY - ((d.weight - minW) / (maxW - minW || 1)) * (svgH - padY * 2) : null;
                return `
                    <circle cx="${x}" cy="${yS.toFixed(1)}" r="2.8" fill="${v59TrendMode === 'cal' ? '#fbbf24' : '#818cf8'}"/>
                    ${yW !== null ? `<circle cx="${x}" cy="${yW.toFixed(1)}" r="3.5" fill="#34d399"/>` : ''}
                    <text x="${x}" y="${svgH + 10}" text-anchor="middle" fill="#94a3b8" font-size="9">${d.label}</text>
                `;
            }).join('')}
        </svg>
    `;

    card.innerHTML = `
        <div class="space-y-2.5">
            <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold text-emerald-400"><i class="fa-solid fa-chart-line mr-1"></i> แนวโน้มน้ำหนัก vs การนอน/แคล (7 วัน)</span>
                <div class="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                    <button type="button" onclick="v59TrendMode='cal'; renderWeeklyTrendDualCard();" class="px-2 py-0.5 rounded ${v59TrendMode === 'cal' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400'}">นน. vs Net Kcal</button>
                    <button type="button" onclick="v59TrendMode='sleep'; renderWeeklyTrendDualCard();" class="px-2 py-0.5 rounded ${v59TrendMode === 'sleep' ? 'bg-indigo-500/20 text-indigo-300 font-bold' : 'text-slate-400'}">นน. vs การนอน</button>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-1.5 text-center text-xs">
                <div class="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800"><span class="text-[9px] text-slate-400 block">น้ำหนักเฉลี่ย</span><b class="text-emerald-400">${avgW} kg</b></div>
                <div class="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800"><span class="text-[9px] text-slate-400 block">Net Kcal เฉลี่ย</span><b class="text-amber-300">${avgNet} kcal</b></div>
                <div class="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800"><span class="text-[9px] text-slate-400 block">นอนเฉลี่ย</span><b class="text-indigo-300">${avgSlp} ชม.</b></div>
            </div>
            <div class="bg-slate-950/90 rounded-xl p-2 border border-slate-800">
                <div class="flex justify-end gap-3 text-[10px] px-1">
                    <span class="text-emerald-400">● น้ำหนัก (kg)</span>
                    <span class="${v59TrendMode === 'cal' ? 'text-amber-400' : 'text-indigo-400'}">-- ${v59TrendMode === 'cal' ? 'แคลอรีสุทธิ' : 'ชั่วโมงนอน'}</span>
                </div>
                ${svgChart}
            </div>
        </div>
    `;
}

// ------------------------------------------
// 5. รายงานประเมินผลสุขภาพ (7 วัน / 30 วัน)
// ------------------------------------------
function switchReportPeriod(days) {
    currentReportDays = days;
    const tab7 = document.getElementById('report-tab-7');
    const tab30 = document.getElementById('report-tab-30');
    if (tab7 && tab30) {
        tab7.className = days === 7 ? "px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600 text-white" : "px-3 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-white";
        tab30.className = days === 30 ? "px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600 text-white" : "px-3 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-white";
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

    let activeDays = 0, calOnTargetDays = 0, calTooLowDays = 0, calOverDays = 0, protPassDays = 0;
    let sums = { cal: 0, burn: 0, prot: 0, carbs: 0, sugar: 0, fiber: 0, fat: 0, satFat: 0, sodium: 0, water: 0 };
    let weights = [], foodFrequency = {};

    for (let i = daysCount - 1; i >= 0; i--) {
        let d = new Date(endDate);
        d.setDate(endDate.getDate() - i);
        let key = getFormattedDateKey(d);
        if (key > todayKey) continue;

        let dayObj = allMealsHistory[key];
        if (dayObj?.weight) weights.push({ date: key, weight: Number(dayObj.weight) });
        if (!dayObj || !dayObj.meals) continue;

        let dCal = 0, dProt = 0, dCarbs = 0, dSugar = 0, dFiber = 0, dFat = 0, dSatFat = 0, dSodium = 0;
        Object.values(dayObj.meals).forEach(list => list.forEach(item => {
            const c = Number(item.calories || 0);
            dCal += c; dProt += Number(item.protein || 0); dCarbs += Number(item.carbs || 0);
            dSugar += Number(item.sugar || 0); dFiber += Number(item.fiber || 0); dFat += Number(item.fat || 0);
            dSatFat += Number(item.satFat || 0); dSodium += Number(item.sodium || 0);

            const cleanName = (item.name || '').trim();
            if (cleanName) {
                if (!foodFrequency[cleanName]) foodFrequency[cleanName] = { count: 0, totalCal: 0 };
                foodFrequency[cleanName].count++;
                foodFrequency[cleanName].totalCal += c;
            }
        }));

        if (dCal > 0) {
            activeDays++;
            const dGoals = getDayCalorieGoals(key);
            const totalBurn = getTotalBurned(dayObj).totalBurn;
            if (dCal > dGoals.max + totalBurn) calOverDays++;
            else if (dCal < dGoals.min) calTooLowDays++;
            else calOnTargetDays++;

            if (dProt >= protMin) protPassDays++;
            sums.cal += dCal; sums.burn += totalBurn; sums.prot += dProt; sums.carbs += dCarbs;
            sums.sugar += dSugar; sums.fiber += dFiber; sums.fat += dFat; sums.satFat += dSatFat;
            sums.sodium += dSodium; sums.water += Number(dayObj.water || 0);
        }
    }

    if (activeDays === 0) {
        container.innerHTML = `<div class="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 text-center text-xs text-slate-400">ยังไม่มีข้อมูลอาหารที่บันทึกจริงในช่วง ${daysCount} วันนี้</div>`;
        return;
    }

    const avg = {
        cal: Math.round(sums.cal / activeDays), burn: Math.round(sums.burn / activeDays),
        prot: fmtPrecise(sums.prot / activeDays, 1), carbs: fmtPrecise(sums.carbs / activeDays, 1),
        sugar: fmtPrecise(sums.sugar / activeDays, 1), fiber: fmtPrecise(sums.fiber / activeDays, 1),
        fat: fmtPrecise(sums.fat / activeDays, 1), satFat: fmtPrecise(sums.satFat / activeDays, 1),
        sodium: Math.round(sums.sodium / activeDays), water: Math.round(sums.water / activeDays)
    };

    const totalMacroKcal = Math.max(1, (sums.prot * 4) + (sums.carbs * 4) + (sums.fat * 9));
    const protRatio = Math.round(((sums.prot * 4) / totalMacroKcal) * 100);
    const carbsRatio = Math.round(((sums.carbs * 4) / totalMacroKcal) * 100);
    const fatRatio = Math.max(0, 100 - protRatio - carbsRatio);

    const overallScore = Math.round((((calOnTargetDays + calTooLowDays) / activeDays) * 60) + ((protPassDays / activeDays) * 40));
    let grade = 'C', gradeColor = 'text-amber-400', gradeDesc = 'ยังหลุดเป้าบ่อย ค่อยๆ ปรับทีละมื้อ';
    if (overallScore >= 85) { grade = 'A+'; gradeColor = 'text-emerald-400'; gradeDesc = 'คุมวินัยได้ดีเยี่ยมมาก! รักษามาตรฐานนี้ไว้'; }
    else if (overallScore >= 70) { grade = 'A'; gradeColor = 'text-emerald-400'; gradeDesc = 'ทำได้ดีมาก ภาพรวมอยู่ในเกณฑ์คุมน้ำหนัก'; }
    else if (overallScore >= 50) { grade = 'B'; gradeColor = 'text-sky-400'; gradeDesc = 'อยู่ในเกณฑ์ดี เพิ่มโปรตีนอีกนิดจะสมบูรณ์แบบ'; }

    const topFoods = Object.entries(foodFrequency).map(([name, info]) => ({ name, ...info })).sort((a, b) => b.count - a.count).slice(0, 5);

    container.innerHTML = `
        <div class="bg-gradient-to-br from-slate-950 to-indigo-950/40 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
            <div>
                <div class="text-[11px] text-slate-400">ประเมินผลจริง <b>${activeDays} วัน</b></div>
                <div class="text-xs font-semibold text-white mt-0.5">${gradeDesc}</div>
                <div class="flex flex-wrap gap-1.5 mt-2 text-[10px]">
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

        <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
            <div class="flex justify-between items-center text-xs"><span class="font-bold text-slate-200">สัดส่วนพลังงานจริง (P : C : F)</span></div>
            <div class="w-full h-3 bg-slate-900 rounded-full overflow-hidden flex">
                <div style="width: ${protRatio}%" class="bg-emerald-400 h-full"></div>
                <div style="width: ${carbsRatio}%" class="bg-sky-400 h-full"></div>
                <div style="width: ${fatRatio}%" class="bg-amber-400 h-full"></div>
            </div>
            <div class="flex justify-between text-[11px] font-medium">
                <span class="text-emerald-400">โปรตีน ${protRatio}%</span>
                <span class="text-sky-400">คาร์บ ${carbsRatio}%</span>
                <span class="text-amber-400">ไขมัน ${fatRatio}%</span>
            </div>
        </div>

        <div class="grid grid-cols-3 gap-1.5 text-center text-xs">
            <div class="bg-slate-950/80 p-2 rounded-xl border border-slate-800"><span class="text-[10px] text-slate-400 block">พลังงานเฉลี่ย</span><b class="text-white">${avg.cal} kcal</b></div>
            <div class="bg-slate-950/80 p-2 rounded-xl border border-slate-800"><span class="text-[10px] text-slate-400 block">โปรตีนเฉลี่ย</span><b class="text-emerald-400">${avg.prot}g</b></div>
            <div class="bg-slate-950/80 p-2 rounded-xl border border-slate-800"><span class="text-[10px] text-slate-400 block">น้ำดื่มเฉลี่ย</span><b class="text-sky-400">${avg.water} ml</b></div>
        </div>

        <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-1.5">
            <div class="text-xs font-bold text-slate-200"><i class="fa-solid fa-ranking-star text-amber-400 mr-1"></i> 5 อันดับเมนูที่ทานบ่อยที่สุด</div>
            ${topFoods.map((f, i) => `
                <div class="flex justify-between items-center text-xs bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800/60">
                    <div class="truncate pr-2"><span class="text-amber-400 font-bold mr-1">#${i + 1}</span><span class="text-slate-200">${f.name}</span></div>
                    <div class="shrink-0 text-[11px] text-indigo-300 font-semibold">${f.count} ครั้ง (${Math.round(f.totalCal).toLocaleString()} kcal)</div>
                </div>
            `).join('')}
        </div>
    `;
}
