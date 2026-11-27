// ==========================================================================
// foodtrack.js — โมดูลจัดการอาหาร, สารอาหารทศนิยม 2 ตำแหน่ง, สแกนฉลาก/AI, โค้ช & IF
// ==========================================================================

let activeMealTab = null;
let baseNutrition = null;
let activeMacroTip = null;
let currentScanMode = 'label';
let html5QrCode = null;
let pendingFoodPhotoBase64 = null;
let currentFoodPhotoPath = null;
let mealPlanDayIndex = 0;
let coachShuffleSeed = 0;
let currentCoachPool = [];

// ------------------------------------------
// 1. Entry Point สำหรับ Render หน้า FoodTrack ทั้งหมด
// ------------------------------------------
function renderFoodTrackPage() {
    if (userGoals.autoWeightMacro) {
        recalcGoalsByCurrentWeight(false);
    }
    renderWaterUI();
    renderSummary();
    applyWorkoutAwareMacros();
    renderIfTimerCard();
    renderBurnModeCard();
    renderMeals();
    renderSmartMacroSyncCard();
    renderDailyMacroChart();
    renderNutritionCoach();
    updateCatalogDatalist();
    renderFoodBudgetMiniBar();
}

// ------------------------------------------
// 2. Summary & Rollover Compensation (ทศนิยม 2 ตำแหน่ง)
// ------------------------------------------
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

function cloneCurrentDayToTomorrow() {
    const dayData = getDayData(currentDateKey);
    const totalItems = Object.values(dayData.meals).reduce((sum, list) => sum + list.length, 0);
    if (totalItems === 0) return alert("วันนี้ยังไม่มีรายการอาหารให้คัดลอกครับ");

    const nextKey = getNextDateKey(currentDateKey);
    if (!confirm(`ต้องการคัดลอกรายการอาหารทั้ง ${totalItems} รายการของวันนี้ ไปวางเป็นแผนล่วงหน้าในวันที่ ${formatDisplayDate(nextKey)} ใช่ไหม?`)) return;

    const nextDayData = getDayData(nextKey);
    mealTypes.forEach(type => {
        const cloned = JSON.parse(JSON.stringify(dayData.meals[type] || []));
        nextDayData.meals[type].push(...cloned);
    });
    currentDateKey = nextKey;
    saveDataAndSync();
}

function getActiveProteinRange(dateKey = currentDateKey) {
    const ov = getDayNutritionOverride(dateKey);
    const protMin = Number(ov?.proteinMin ?? userGoals.proteinMin) || 96;
    const protMax = Number(ov?.proteinMax ?? userGoals.proteinMax) || Math.max(protMin, 128);
    return { protMin, protMax, isOverridden: Boolean(ov?.proteinMin) };
}

function renderSummary() {
    if (!document.getElementById('calories-remaining')) return;

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
    const { protMin, protMax } = getActiveProteinRange(currentDateKey);

    const effectiveBudget = adj.safeTarget + totalBurn;
    const remaining = fmtPrecise(effectiveBudget - totalCal, 1);

    const goalLabelEl = document.getElementById('goal-cal-label');
    if (goalLabelEl) {
        goalLabelEl.innerHTML = adj.actualDeducted > 0
            ? `<span class="line-through text-slate-500 mr-1">${adj.minFloor.toLocaleString()}-${adj.baseTarget.toLocaleString()}</span><span class="text-amber-400 font-bold">${adj.minFloor.toLocaleString()}-${adj.safeTarget.toLocaleString()}</span>`
            : `${adj.minFloor.toLocaleString()}-${adj.baseTarget.toLocaleString()}`;
    }

    document.getElementById('calories-remaining').innerHTML = `${remaining} <span class="text-sm font-normal text-slate-400">kcal</span>`;
    document.getElementById('calories-consumed').innerText = `${fmtPrecise(totalCal, 1)} kcal`;
    document.getElementById('calories-burned').innerText = `${totalBurn} kcal`;
    document.getElementById('protein-summary').innerHTML = `${fmtPrecise(totalProt, 2)} / <span class="text-xs font-normal text-slate-400">${protMin}-${protMax} g</span>`;

    document.getElementById('carbs-total').innerText = `${fmtPrecise(totalCarbs, 2)}g`;
    document.getElementById('sugar-total').innerText = `${fmtPrecise(totalSugar, 2)}g`;
    document.getElementById('fiber-total').innerText = `${fmtPrecise(totalFiber, 2)}g`;
    document.getElementById('fats-total').innerText = `${fmtPrecise(totalFat, 2)}g`;
    document.getElementById('satfat-total').innerText = `${fmtPrecise(totalSatFat, 2)}g`;
    document.getElementById('transfat-total').innerText = `${fmtPrecise(totalTransFat, 2)}g`;
    document.getElementById('sodium-total').innerText = `${fmtPrecise(totalSodium, 1)}mg`;
    document.getElementById('potassium-total').innerText = `${fmtPrecise(totalPotassium, 1)}mg`;
    document.getElementById('cholesterol-total').innerText = `${fmtPrecise(totalChol, 1)}mg`;

    const percent = Math.min(Math.round((totalCal / Math.max(1, effectiveBudget)) * 100), 100);
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
            const nextLimit = fmtPrecise(Math.max(m.floor, m.max - over), m.dec);
            tomorrowCaps.push(`${m.label}ไม่เกิน <b>${nextLimit}${m.unit}</b>`);
        }
    });

    let todayCapsFromYesterday = [];
    Object.keys(macroAdj).forEach(k => {
        const m = macroAdj[k];
        if (m.yOver > 0) todayCapsFromYesterday.push(`${m.label}ไม่เกิน <b>${m.adjustedMax}${m.unit}</b>`);
    });

    let alertLines = [];
    if (remaining < 0) {
        const overToday = fmtPrecise(Math.abs(remaining), 1);
        const minFloor = Number(userGoals.minCalories) || 1200;
        const tomorrowTarget = Math.max(minFloor, Math.round(adj.baseTarget - overToday));
        alertLines.push(`พลังงานวันนี้เกิน <b>${overToday} kcal</b> → พรุ่งนี้ปรับเป้าเหลือ <b>${tomorrowTarget.toLocaleString()} kcal</b>`);
    }
    if (tomorrowCaps.length > 0) alertLines.push(`สารอาหารวันนี้เกินเกณฑ์ → พรุ่งนี้ควรคุม: ${tomorrowCaps.join(', ')}`);
    if (adj.yOver > 0) alertLines.push(`ชดเชยพลังงานเมื่อวาน (เกิน ${fmtPrecise(adj.yOver, 1)} kcal) → วันนี้โควตาเหลือ <b>${adj.safeTarget.toLocaleString()} kcal</b>`);
    if (todayCapsFromYesterday.length > 0) alertLines.push(`ชดเชยสารอาหารเมื่อวาน → วันนี้ควรคุม: ${todayCapsFromYesterday.join(', ')}`);

    if (remaining < 0) {
        statusEl.innerText = "เกินเป้า Max";
        statusEl.className = "text-[10px] px-2.5 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/50 font-medium";
    } else if (totalCal > 0 && totalCal < adj.minFloor) {
        statusEl.innerText = `ต่ำกว่าขั้นต่ำ (${adj.minFloor})`;
        statusEl.className = "text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/50 font-medium";
    } else if (adj.yOver > 0 || todayCapsFromYesterday.length > 0) {
        statusEl.innerText = "โหมดชดเชยเมื่อวาน";
        statusEl.className = "text-[10px] px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/50 font-medium";
    } else {
        statusEl.innerText = "อยู่ในช่วง Min-Max";
        statusEl.className = "text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 font-medium";
    }

    if (alertLines.length > 0) {
        const isDanger = remaining < 0 || tomorrowCaps.length > 0;
        rolloverBox.className = isDanger
            ? "bg-rose-950/60 border-rose-500/40 text-rose-200 text-[11px] px-3 py-2 rounded-xl border flex items-start gap-2"
            : "bg-amber-950/50 border-amber-500/40 text-amber-200 text-[11px] px-3 py-2 rounded-xl border flex items-start gap-2";
        rolloverBox.innerHTML = `<i class="fa-solid fa-scale-unbalanced ${isDanger ? 'text-rose-400' : 'text-amber-400'} mt-0.5 shrink-0"></i><div class="space-y-1">${alertLines.map(l => `<div>• ${l}</div>`).join('')}</div>`;
    } else {
        rolloverBox.classList.add('hidden');
    }
}

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
        `🔥 พลังงาน: ${fmtPrecise(totalCal, 1)} / ${adj.safeTarget} kcal (เผาผลาญ ${totalBurn} kcal)`,
        `🥩 โปรตีน: ${fmtPrecise(totalProt, 2)} / ${protMin}g | คาร์บ: ${fmtPrecise(totalCarbs, 2)}g | ไขมัน: ${fmtPrecise(totalFat, 2)}g`,
        `🍬 น้ำตาล: ${fmtPrecise(totalSugar, 2)}g | 🧂 โซเดียม: ${fmtPrecise(totalSodium, 1)}mg`,
        `💧 น้ำดื่ม: ${dayData.water || 0} ml | 👟 ก้าวเดิน: ${(dayData.steps || 0).toLocaleString()} ก้าว` + (dayData.weight ? ` | ⚖️ นน.: ${dayData.weight} kg` : '')
    ].join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => alert("คัดลอกข้อความสรุปประจำวันเรียบร้อยแล้ว!"));
    } else {
        prompt("คัดลอกข้อความด้านล่างนี้:", text);
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
    Object.values(dayData.meals).forEach(list => list.forEach(item => {
        Object.keys(totals).forEach(k => { totals[k] += Number(item[k] || 0); });
    }));

    if (type === 'fiber' || type === 'potassium') {
        const isFiber = type === 'fiber';
        const title = isFiber ? "ไฟเบอร์ (Fiber)" : "โพแทสเซียม (Potassium)";
        const target = isFiber ? 25 : 3500;
        const unit = isFiber ? "g" : "mg";
        const cur = totals[type];
        const rem = fmtPrecise(Math.max(0, target - cur), 2);
        content.innerHTML = `
            <div class="font-bold text-white">${title}: <span class="text-amber-300">ควรได้ ${target.toLocaleString()}${unit} / วัน</span></div>
            <div class="text-[11px] text-slate-300 mt-0.5">วันนี้ทานไป <b>${fmtPrecise(cur, 2)}${unit}</b> (${rem === 0 ? '<span class="text-emerald-400 font-bold">ถึงเกณฑ์แล้ว!</span>' : `<span class="text-sky-400 font-semibold">ขาดอีก ${rem}${unit}</span>`})</div>
        `;
        box.className = "bg-slate-950/90 border border-indigo-500/40 rounded-xl px-3 py-2 text-xs flex justify-between items-start gap-2";
        return;
    }

    const m = getNutrientAdjustments(currentDateKey)[type];
    if (!m) return;
    const cur = totals[type];
    const isAlert = cur > m.adjustedMax;
    const rem = fmtPrecise(Math.max(0, m.adjustedMax - cur), m.dec);

    content.innerHTML = `
        <div class="font-bold text-white">${m.label}: <span class="text-amber-300">ไม่เกิน ${m.adjustedMax}${m.unit} / วัน</span></div>
        <div class="text-[11px] text-slate-300 mt-0.5">วันนี้ทานไป <b>${fmtPrecise(cur, m.dec)}${m.unit}</b> (${isAlert ? `<span class="text-rose-400 font-bold">เกินเกณฑ์ ${fmtPrecise(cur - m.adjustedMax, m.dec)}${m.unit}</span>` : `<span class="text-emerald-400 font-semibold">เหลือโควตา ${rem}${m.unit}</span>`})</div>
    `;
    box.className = isAlert
        ? "bg-rose-950/60 border border-rose-500/50 rounded-xl px-3 py-2 text-xs flex justify-between items-start gap-2"
        : "bg-slate-950/90 border border-indigo-500/40 rounded-xl px-3 py-2 text-xs flex justify-between items-start gap-2";
}

function hideMacroTip() {
    document.getElementById('macro-tip-box')?.classList.add('hidden');
    activeMacroTip = null;
}

function applyWorkoutAwareMacros() {
    const dayData = getDayData(currentDateKey);
    const hasStrengthWorkout = (dayData.workouts || []).some(w => (w.type || '').includes('เวท') || (w.type || '').includes('คอร์ส'));
    const badge = document.getElementById('workout-macro-badge');
    if (!badge) return;

    if (hasStrengthWorkout) {
        const boostedMin = Math.max(Number(userGoals.proteinMin) || 96, 110);
        const boostedMax = Math.max(Number(userGoals.proteinMax) || 128, 130);
        badge.classList.remove('hidden');
        badge.innerHTML = `💪 วันเล่นเวท: แนะนำโปรตีน ${boostedMin}-${boostedMax}g`;
    } else {
        badge.classList.add('hidden');
    }
}

// ------------------------------------------
// 3. Smart Auto-Sync Macro ตามน้ำหนักจริง & Quick Meal Presets
// ------------------------------------------
function getLatestRecordedWeightUpTo(dateKey) {
    const todayObj = allMealsHistory[dateKey];
    if (todayObj && todayObj.weight !== null && todayObj.weight !== undefined && todayObj.weight !== '') return Number(todayObj.weight);
    const keys = Object.keys(allMealsHistory).filter(k => k <= dateKey).sort();
    for (let i = keys.length - 1; i >= 0; i--) {
        const w = allMealsHistory[keys[i]]?.weight;
        if (w !== null && w !== undefined && w !== '') return Number(w);
    }
    return null;
}

function toggleSmartWeightMacroSync() {
    userGoals.autoWeightMacro = !userGoals.autoWeightMacro;
    if (userGoals.autoWeightMacro) {
        if (!userGoals.autoWeightGoal) userGoals.autoWeightGoal = 'cut';
        recalcGoalsByCurrentWeight(true);
    } else {
        saveDataAndSync();
    }
}

function setSmartWeightGoalMode(mode) {
    userGoals.autoWeightMacro = true;
    userGoals.autoWeightGoal = mode;
    recalcGoalsByCurrentWeight(true);
}

function recalcGoalsByCurrentWeight(triggerSave = false) {
    if (!userGoals.autoWeightMacro) return;
    const w = getLatestRecordedWeightUpTo(currentDateKey);
    if (!w || w <= 0) return;

    const mode = userGoals.autoWeightGoal || 'cut';
    let targetCal = Math.round(w * 28);
    let protMin = Math.round(w * 1.8);
    let protMax = Math.round(w * 2.0);

    if (mode === 'cut') {
        targetCal = Math.max(1200, Math.round(w * 28 - 350));
        protMin = Math.round(w * 1.9);
        protMax = Math.round(w * 2.1);
    } else if (mode === 'bulk') {
        targetCal = Math.round(w * 30 + 250);
        protMin = Math.round(w * 1.8);
        protMax = Math.round(w * 2.0);
    } else {
        targetCal = Math.round(w * 29);
        protMin = Math.round(w * 1.7);
        protMax = Math.round(w * 1.9);
    }

    const fatMax = Math.max(40, Math.round((targetCal * 0.28) / 9));
    const carbsMax = Math.max(50, Math.round((targetCal - (protMin * 4) - (fatMax * 9)) / 4));

    userGoals.calories = targetCal;
    userGoals.minCalories = Math.max(1150, targetCal - 250);
    userGoals.proteinMin = protMin;
    userGoals.proteinMax = protMax;
    userGoals.carbsMax = carbsMax;
    userGoals.fatMax = fatMax;

    const dayObj = getDayData(currentDateKey);
    dayObj.targetMin = userGoals.minCalories;
    dayObj.targetMax = userGoals.calories;

    if (triggerSave) saveDataAndSync();
}

function quickAddCatalogItemToActiveMeal(catalogIdx) {
    const item = foodCatalog[catalogIdx];
    if (!item) return;

    const targetMeal = (typeof activeMealTab === 'string' && mealTypes.includes(activeMealTab)) ? activeMealTab : "มื้อเช้า";
    const dayData = getDayData(currentDateKey);
    dayData.meals[targetMeal].push({
        name: item.name,
        qty: 1,
        photo: item.photo || null,
        calories: fmtPrecise(item.calories, 1),
        protein: fmtPrecise(item.protein, 2),
        carbs: fmtPrecise(item.carbs, 2),
        sugar: fmtPrecise(item.sugar, 2),
        fiber: fmtPrecise(item.fiber, 2),
        fat: fmtPrecise(item.fat, 2),
        satFat: fmtPrecise(item.satFat, 2),
        transFat: fmtPrecise(item.transFat, 2),
        sodium: fmtPrecise(item.sodium, 1),
        potassium: fmtPrecise(item.potassium, 1),
        cholesterol: fmtPrecise(item.cholesterol, 1)
    });
    saveDataAndSync();
}

function renderSmartMacroSyncCard() {
    const card = document.getElementById('smart-macro-sync-card');
    if (!card) return;

    const latestW = getLatestRecordedWeightUpTo(currentDateKey);
    const isAuto = Boolean(userGoals.autoWeightMacro);
    const mode = userGoals.autoWeightGoal || 'cut';
    const currentMealLabel = (typeof activeMealTab === 'string' && mealTypes.includes(activeMealTab)) ? activeMealTab : 'มื้อเช้า';
    const quickItems = (foodCatalog || []).slice(0, 12);

    card.innerHTML = `
        <div class="space-y-3">
            <div class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                    <div class="text-xs font-bold text-white flex items-center gap-1.5">
                        <i class="fa-solid fa-scale-balanced text-emerald-400"></i>
                        ปรับโปรตีน & แคลตามน้ำหนักจริง
                        <span class="text-[11px] text-emerald-300 font-semibold">${latestW ? `(${latestW} kg)` : '(ยังไม่กรอก นน.)'}</span>
                    </div>
                    <button type="button" onclick="toggleSmartWeightMacroSync()"
                        class="text-[11px] px-2.5 py-1 rounded-full font-semibold border transition ${isAuto
                            ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}">
                        ${isAuto ? 'Auto-Sync: เปิด' : 'Auto-Sync: ปิด'}
                    </button>
                </div>

                ${isAuto ? `
                    <div class="grid grid-cols-3 gap-1.5 text-[11px]">
                        <button type="button" onclick="setSmartWeightGoalMode('cut')" class="py-1.5 rounded-xl border transition ${mode === 'cut' ? 'bg-rose-500/20 border-rose-500/60 text-rose-200 font-bold' : 'bg-slate-950/70 border-slate-800 text-slate-400'}">🔥 ลดไขมัน (2g/kg)</button>
                        <button type="button" onclick="setSmartWeightGoalMode('recomp')" class="py-1.5 rounded-xl border transition ${mode === 'recomp' ? 'bg-sky-500/20 border-sky-500/60 text-sky-200 font-bold' : 'bg-slate-950/70 border-slate-800 text-slate-400'}">⚖️ คงหุ่น (1.8g/kg)</button>
                        <button type="button" onclick="setSmartWeightGoalMode('bulk')" class="py-1.5 rounded-xl border transition ${mode === 'bulk' ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 font-bold' : 'bg-slate-950/70 border-slate-800 text-slate-400'}">💪 เพิ่มกล้าม (1.9g/kg)</button>
                    </div>
                ` : `<div class="text-[11px] text-slate-400">เปิด Auto-Sync เพื่อให้ระบบปรับแคลอรีและโปรตีนตามน้ำหนักล่าสุดอัตโนมัติ</div>`}
            </div>

            ${quickItems.length > 0 ? `
                <div class="pt-2.5 border-t border-slate-800/80 space-y-2">
                    <div class="flex items-center justify-between text-xs">
                        <span class="font-bold text-amber-300 flex items-center gap-1.5">
                            <i class="fa-solid fa-star"></i> เมนูประจำ (แตะใส่ <b class="text-white underline">${currentMealLabel}</b>)
                        </span>
                        <button type="button" onclick="openCatalogManagerModal()" class="text-[10px] text-slate-400 hover:text-white underline">คลังเมนู (${foodCatalog.length})</button>
                    </div>
                    <div class="v59-dark-scroll flex gap-2 overflow-x-auto pb-2 snap-x">
                        ${quickItems.map((item, idx) => `
                            <button type="button" onclick="quickAddCatalogItemToActiveMeal(${idx})"
                                class="snap-start shrink-0 bg-slate-950/90 hover:bg-slate-800 active:scale-95 border border-slate-800 hover:border-amber-500/50 rounded-xl px-3 py-2 text-left transition">
                                <div class="text-[11px] font-semibold text-slate-100 max-w-[145px] truncate">+ ${item.name}</div>
                                <div class="text-[9px] text-emerald-400 mt-0.5">${fmtPrecise(item.calories, 1)} kcal • P ${fmtPrecise(item.protein, 2)}g</div>
                            </button>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// ------------------------------------------
// 4. Meals Tabs & Detail Card
// ------------------------------------------
function selectMealTab(mealType) {
    activeMealTab = mealType;
    renderMeals();
    renderSmartMacroSyncCard();
}

function copyMealFromYesterday(mealType) {
    const yesterdayKey = getPreviousDateKey(currentDateKey);
    const yesterdayItems = allMealsHistory[yesterdayKey]?.meals?.[mealType] || [];
    if (yesterdayItems.length === 0) return alert(`เมื่อวาน (${yesterdayKey}) ไม่มีรายการอาหารใน "${mealType}" ให้คัดลอกครับ`);

    const dayData = getDayData(currentDateKey);
    dayData.meals[mealType].push(...JSON.parse(JSON.stringify(yesterdayItems)));
    saveDataAndSync();
}

function saveMealAsCombo(mealType) {
    const items = getDayData(currentDateKey).meals[mealType] || [];
    if (items.length < 2) return alert("ต้องมีรายการอาหารอย่างน้อย 2 อย่างในมื้อนี้ถึงจะรวมเป็นเซตได้ครับ");

    const defaultName = `เซต${mealType} (${items.map(i => i.name.split('(')[0].trim()).join(' + ')})`;
    const comboName = prompt("ตั้งชื่อเซตอาหารรวมชุด:", defaultName);
    if (!comboName || !comboName.trim()) return;

    const sumField = (f) => items.reduce((s, i) => s + Number(i[f] || 0), 0);
    const comboItem = {
        name: comboName.trim(),
        photo: items.find(i => i.photo)?.photo || null,
        calories: fmtPrecise(sumField('calories'), 1),
        protein: fmtPrecise(sumField('protein'), 2),
        carbs: fmtPrecise(sumField('carbs'), 2),
        sugar: fmtPrecise(sumField('sugar'), 2),
        fiber: fmtPrecise(sumField('fiber'), 2),
        fat: fmtPrecise(sumField('fat'), 2),
        satFat: fmtPrecise(sumField('satFat'), 2),
        transFat: fmtPrecise(sumField('transFat'), 2),
        sodium: fmtPrecise(sumField('sodium'), 1),
        potassium: fmtPrecise(sumField('potassium'), 1),
        cholesterol: fmtPrecise(sumField('cholesterol'), 1)
    };

    const existingIdx = foodCatalog.findIndex(f => f.name.toLowerCase() === comboItem.name.toLowerCase());
    if (existingIdx === -1) foodCatalog.unshift(comboItem);
    else foodCatalog[existingIdx] = comboItem;

    saveDataAndSync();
    alert(`บันทึก "${comboItem.name}" เข้าคลังเมนูเรียบร้อยแล้ว!`);
}

function renderMeals() {
    const container = document.getElementById('meals-container');
    if (!container) return;
    const dayData = getDayData(currentDateKey);

    if (!activeMealTab || !mealTypes.includes(activeMealTab)) {
        const todayKey = getFormattedDateKey(new Date());
        if (currentDateKey === todayKey) {
            const hr = new Date().getHours();
            if (hr < 11) activeMealTab = "มื้อเช้า";
            else if (hr < 15) activeMealTab = "มื้อเที่ยง";
            else if (hr < 20) activeMealTab = "มื้อเย็น";
            else activeMealTab = "มื้อว่าง/อื่นๆ";
        } else {
            activeMealTab = "มื้อเช้า";
        }
    }

    const shortLabels = {
        "มื้อเช้า": { title: "เช้า", icon: "☀️" },
        "มื้อเที่ยง": { title: "กลางวัน", icon: "🌤️" },
        "มื้อเย็น": { title: "เย็น", icon: "🌙" },
        "มื้อว่าง/อื่นๆ": { title: "ว่าง", icon: "🍎" }
    };

    const tabsHtml = `
        <div class="grid grid-cols-4 gap-1.5">
            ${mealTypes.map(mType => {
                const items = dayData.meals[mType] || [];
                const cal = fmtPrecise(items.reduce((s, i) => s + Number(i.calories || 0), 0), 1);
                const prot = fmtPrecise(items.reduce((s, i) => s + Number(i.protein || 0), 0), 1);
                const isActive = (mType === activeMealTab);
                const info = shortLabels[mType];

                return `
                    <button type="button" onclick="selectMealTab('${mType}')"
                        class="p-2 rounded-2xl border text-center transition flex flex-col items-center justify-center ${
                            isActive ? 'bg-indigo-950/90 border-indigo-400 text-white shadow-lg shadow-indigo-500/20 -translate-y-0.5' : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:bg-slate-800/80'
                        }">
                        <span class="text-[11px] font-bold flex items-center gap-1 ${isActive ? 'text-indigo-300' : ''}"><span>${info.icon}</span><span>${info.title}</span></span>
                        <span class="text-xs font-extrabold mt-0.5 ${cal > 0 ? 'text-white' : 'text-slate-600'}">${cal} <span class="text-[9px] font-normal">kcal</span></span>
                        <span class="text-[9px] ${prot > 0 ? 'text-emerald-400' : 'text-slate-600'}">P ${prot}g</span>
                        ${isActive ? '<span class="w-4 h-1 rounded-full bg-indigo-400 mt-1"></span>' : '<span class="w-4 h-1 mt-1"></span>'}
                    </button>
                `;
            }).join('')}
        </div>
    `;

    const mealType = activeMealTab;
    const items = dayData.meals[mealType] || [];
    const totalCal = fmtPrecise(items.reduce((s, i) => s + Number(i.calories || 0), 0), 1);
    const totalProt = fmtPrecise(items.reduce((s, i) => s + Number(i.protein || 0), 0), 2);

    const yesterdayKey = getPreviousDateKey(currentDateKey);
    const hasYesterday = (allMealsHistory[yesterdayKey]?.meals?.[mealType] || []).length > 0;

    const copyBtnHtml = hasYesterday ? `<button type="button" onclick="copyMealFromYesterday('${mealType}')" class="text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-300 px-2 py-0.5 rounded-lg border border-slate-700"><i class="fa-regular fa-copy"></i> เมื่อวาน</button>` : '';
    const comboBtnHtml = items.length >= 2 ? `<button type="button" onclick="saveMealAsCombo('${mealType}')" class="text-[10px] bg-slate-800 hover:bg-slate-700 text-teal-300 px-2 py-0.5 rounded-lg border border-slate-700"><i class="fa-solid fa-layer-group"></i> รวมเซต</button>` : '';

    let itemsHtml = items.map((item, idx) => {
        const cal = fmtPrecise(item.calories || 0, 1);
        const prot = fmtPrecise(item.protein || 0, 2);
        const carbs = fmtPrecise(item.carbs || 0, 2);
        const sugar = fmtPrecise(item.sugar || 0, 2);
        const fiber = fmtPrecise(item.fiber || 0, 2);
        const fat = fmtPrecise(item.fat || 0, 2);
        const satFat = fmtPrecise(item.satFat || 0, 2);
        const sodium = fmtPrecise(item.sodium || 0, 1);
        const chol = fmtPrecise(item.cholesterol || 0, 1);

        return `
            <div class="py-2.5 px-3 rounded-xl bg-slate-950/75 border border-slate-800/80 space-y-1.5">
                <div class="flex justify-between items-start gap-2">
                    <div class="min-w-0">
                        <span class="text-xs sm:text-sm text-white font-semibold">${item.name}</span>
                        ${item.photo ? `<i class="fa-regular fa-image text-sky-400 text-[11px] ml-1"></i>` : ''}
                        <span class="text-[11px] text-amber-300 font-semibold ml-1">x${item.qty || 1}</span>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <span class="text-xs font-extrabold text-white bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg">${cal} kcal</span>
                        <button type="button" onclick="openFoodModal('${mealType}', ${idx})" class="text-slate-500 hover:text-amber-400 p-1"><i class="fa-solid fa-pen text-xs"></i></button>
                        <button type="button" onclick="deleteMealItem('${mealType}', ${idx})" class="text-slate-500 hover:text-rose-400 p-1"><i class="fa-solid fa-trash text-xs"></i></button>
                    </div>
                </div>

                <div class="flex flex-wrap gap-1.5 text-[10px]">
                    <span class="px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-800/40 text-emerald-300 font-semibold">P ${prot}g</span>
                    <span class="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300">C ${carbs}g</span>
                    <span class="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-pink-300">น้ำตาล ${sugar}g</span>
                    <span class="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-teal-300">ไฟเบอร์ ${fiber}g</span>
                    <span class="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-amber-200">ไขมัน ${fat}g</span>
                    <span class="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-orange-300">อิ่มตัว ${satFat}g</span>
                    <span class="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-amber-300">Na ${sodium}mg</span>
                    <span class="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-purple-300">Chol ${chol}mg</span>
                </div>
            </div>
        `;
    }).join('');

    if (items.length === 0) itemsHtml = `<div class="text-xs text-slate-500 py-2 text-center">ยังไม่มีรายการอาหารใน${mealType}</div>`;

    container.innerHTML = `
        <div class="space-y-2.5">
            ${tabsHtml}
            <div class="bg-slate-900 rounded-2xl p-4 border border-indigo-500/40 shadow-md space-y-3">
                <div class="flex justify-between items-center border-b border-slate-800/80 pb-2.5 gap-1.5">
                    <div class="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span class="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                        <h4 class="font-bold text-white text-sm">${mealType}</h4>
                        ${copyBtnHtml}
                        ${comboBtnHtml}
                    </div>
                    <div class="text-xs text-slate-300 font-semibold shrink-0">${totalCal} kcal | <span class="text-emerald-400">P ${totalProt}g</span></div>
                </div>
                <div class="space-y-2">${itemsHtml}</div>
                <button type="button" onclick="openFoodModal('${mealType}')" class="w-full mt-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5">
                    <i class="fa-solid fa-plus text-indigo-400"></i> เพิ่มรายการใน${mealType}
                </button>
            </div>
        </div>
    `;
}

// ------------------------------------------
// 5. IF 16/8 Timer & 7-Day Burn Meal Plan
// ------------------------------------------
let ifState = JSON.parse(localStorage.getItem('fitTracker_if_state') || 'null') || { mode: 'fasting', lastMealTime: null };

function toggleFastingState() {
    if (ifState.mode === 'fasting') {
        ifState.mode = 'eating';
        ifState.eatStartTime = Date.now();
    } else {
        ifState.mode = 'fasting';
        ifState.lastMealTime = Date.now();
    }
    localStorage.setItem('fitTracker_if_state', JSON.stringify(ifState));
    renderIfTimerCard();
}

function renderIfTimerCard() {
    const card = document.getElementById('if-timer-card');
    if (!card) return;
    if (userGoals.preset !== 'fat_sugar_burn') {
        card.classList.add('hidden');
        return;
    }
    card.classList.remove('hidden');

    const now = new Date();
    const hour = now.getHours(), min = now.getMinutes();
    let statusTitle = "", statusSub = "", timerText = "";

    if (ifState.lastMealTime && ifState.mode === 'fasting') {
        const diffMs = Date.now() - ifState.lastMealTime;
        const hrs = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        statusTitle = hrs >= 16 ? "🔥 ครบ 16 ชม. แล้ว! พร้อมเปิดมื้อแรก" : "⏳ กำลังฟาสติ้ง (ดึงไขมันสะสม)";
        statusSub = `อดมาแล้ว ${hrs} ชม. ${mins} นาที`;
        timerText = hrs >= 16 ? "00:00" : `${String(Math.max(0, 15 - hrs)).padStart(2, '0')}:${String(59 - mins).padStart(2, '0')}`;
    } else if (hour >= 12 && hour < 20) {
        statusTitle = "🍽️ ช่วงเวลาทานอาหาร (12:00 – 20:00 น.)";
        statusSub = "เน้นโปรตีนให้ถึงเป้า • ตัดแป้งมื้อเย็น";
        timerText = `${String(19 - hour).padStart(2, '0')}:${String(59 - min).padStart(2, '0')}`;
    } else {
        statusTitle = "🔥 ช่วงฟาสติ้ง (ดื่มได้เฉพาะน้ำเปล่า/กาแฟดำ)";
        statusSub = "เหลือเวลาถึง 12:00 น.";
        timerText = `${String(hour < 12 ? (11 - hour) : (35 - hour)).padStart(2, '0')}:${String(59 - min).padStart(2, '0')}`;
    }

    card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
            <div>
                <div class="text-xs font-bold text-amber-400">${statusTitle}</div>
                <div class="text-[10px] text-slate-400 mt-0.5">${statusSub}</div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <span class="text-base font-extrabold font-mono text-white bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">${timerText}</span>
                <button type="button" onclick="toggleFastingState()" class="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-semibold px-2.5 py-1.5 rounded-xl">
                    ${ifState.mode === 'fasting' ? 'เริ่มมื้อแรก' : 'จบมื้อสุดท้าย'}
                </button>
            </div>
        </div>
    `;
}

function setBurnMode(mode) {
    if (mode === 'burn') {
        Object.assign(userGoals, { preset: 'fat_sugar_burn', calories: 1500, minCalories: 1200, proteinMin: 115, proteinMax: 125, carbsMax: 100, fatMax: 60, sugarMax: 20, sodiumMax: 1900 });
    } else {
        Object.assign(userGoals, { preset: 'fat_loss', calories: 1500, minCalories: 1200, proteinMin: 96, proteinMax: 128, carbsMax: 150, fatMax: 50, sugarMax: 24, sodiumMax: 2000 });
    }
    saveDataAndSync();
}

function selectMealPlanDay(idx) {
    mealPlanDayIndex = idx;
    renderBurnModeCard();
}

function addPlannedMealToToday(mealType, name, calories, protein, carbs, fat, sugar, sodium) {
    const dayData = getDayData(currentDateKey);
    dayData.meals[mealType].push({
        name, qty: 1, calories: Number(calories), protein: Number(protein), carbs: Number(carbs),
        sugar: Number(sugar), fiber: 2, fat: Number(fat), satFat: 1, transFat: 0, sodium: Number(sodium), potassium: 250, cholesterol: 50
    });
    saveDataAndSync();
}

function renderBurnModeCard() {
    const card = document.getElementById('burn-mode-card');
    if (!card) return;
    const isBurnMode = userGoals.preset === 'fat_sugar_burn';
    const dayOverride = getDayNutritionOverride(currentDateKey);
    const activePlanCode = `D${mealPlanDayIndex + 1}`;

    const sevenDayPlans = [
        { day: "วันที่ 1", theme: "เริ่มรีดน้ำตาล & ล้างโซเดียม", meals: [
            { type: "มื้อเที่ยง", name: "อกไก่นึ่ง/ย่าง + ข้าวกล้อง 1 ทัพพี + ผักลวก", cal: 390, p: 36, c: 28, f: 11, s: 2, na: 320 },
            { type: "มื้อว่าง/อื่นๆ", name: "ไข่ต้ม 2 ฟอง + กรีกโยเกิร์ต 0%", cal: 240, p: 27, c: 7, f: 10, s: 5, na: 195 },
            { type: "มื้อเย็น", name: "ปลานิลนึ่งสมุนไพร + ผักต้ม (งดข้าว)", cal: 260, p: 35, c: 6, f: 9, s: 2, na: 240 }
        ]},
        { day: "วันที่ 2", theme: "เน้นโปรตีนสูง ลดแป้งขัดสี", meals: [
            { type: "มื้อเที่ยง", name: "กะเพราอกไก่ไม่ใส่น้ำมัน + ไข่ดาวน้ำ + ข้าว 1 ทัพพี", cal: 410, p: 39, c: 26, f: 13, s: 2, na: 420 },
            { type: "มื้อว่าง/อื่นๆ", name: "นมถั่วเหลืองโปรตีนสูง 1 ขวด + อัลมอนด์ 10 เม็ด", cal: 250, p: 30, c: 8, f: 11, s: 2, na: 155 },
            { type: "มื้อเย็น", name: "ยำทูน่าน้ำแร่ + แตงกวา/ผักสด (งดข้าว)", cal: 220, p: 28, c: 7, f: 7, s: 2, na: 380 }
        ]},
        { day: "วันที่ 3", theme: "ตัดคาร์บมื้อเย็น กระตุ้นดึงไขมัน", meals: [
            { type: "มื้อเที่ยง", name: "เกาเหลาหมูสับไม่ใส่กระเทียมเจียว + ข้าว 1 ทัพพี", cal: 420, p: 34, c: 30, f: 15, s: 3, na: 520 },
            { type: "มื้อว่าง/อื่นๆ", name: "เวย์โปรตีน 1 สกู๊ป + ไข่ขาวต้ม 2 ฟอง", cal: 155, p: 32, c: 3, f: 1, s: 1, na: 190 },
            { type: "มื้อเย็น", name: "เต้าหู้อ่อนนึ่งซีอิ๊ว + กุ้งลวก + ผักกาดขาว", cal: 240, p: 30, c: 7, f: 9, s: 2, na: 350 }
        ]},
        { day: "วันที่ 4", theme: "โฟกัสไขมันดี & ไฟเบอร์สูง", meals: [
            { type: "มื้อเที่ยง", name: "ข้าวหน้าสันในไก่ย่าง + ผักสลัดน้ำใส", cal: 400, p: 36, c: 32, f: 12, s: 2, na: 340 },
            { type: "มื้อว่าง/อื่นๆ", name: "ถั่วแระญี่ปุ่นต้ม 1 ถ้วย + ไข่ต้ม 1 ฟอง", cal: 195, p: 17, c: 10, f: 10, s: 2, na: 160 },
            { type: "มื้อเย็น", name: "ปลาทับทิมนึ่งมะนาว + บรอกโคลีลวก", cal: 270, p: 36, c: 8, f: 9, s: 2, na: 290 }
        ]},
        { day: "วันที่ 5", theme: "คุมน้ำตาลต่ำพิเศษ ลดบวมน้ำ", meals: [
            { type: "มื้อเที่ยง", name: "สุกี้น้ำอกไก่ + วุ้นเส้นครึ่งทัพพี", cal: 370, p: 35, c: 28, f: 11, s: 3, na: 460 },
            { type: "มื้อว่าง/อื่นๆ", name: "นมโปรตีนสูงรสจืด 1 ขวด", cal: 190, p: 27, c: 10, f: 4.5, s: 8, na: 170 },
            { type: "มื้อเย็น", name: "ไข่ตุ๋นหมูสับไม่ติดมัน + ผักโขมลวก", cal: 250, p: 29, c: 6, f: 11, s: 1, na: 330 }
        ]},
        { day: "วันที่ 6", theme: "รักษาสมดุลพลังงาน & โปรตีนถึงเป้า", meals: [
            { type: "มื้อเที่ยง", name: "สเต๊กอกไก่พริกไทยดำ + ข้าวกล้อง 1 ทัพพี", cal: 410, p: 38, c: 29, f: 13, s: 2, na: 310 },
            { type: "มื้อว่าง/อื่นๆ", name: "กรีกโยเกิร์ต 0% + ไข่ขาวต้ม 2 ฟอง", cal: 125, p: 22, c: 7, f: 0, s: 5, na: 165 },
            { type: "มื้อเย็น", name: "ต้มยำน้ำใสอกไก่/เห็ดรวม", cal: 230, p: 32, c: 8, f: 7, s: 2, na: 410 }
        ]},
        { day: "วันที่ 7", theme: "รีเซ็ตระบบพร้อมรับสัปดาห์ใหม่", meals: [
            { type: "มื้อเที่ยง", name: "ข้าวคลุกกะปิอกไก่ลีน + ผักครบ", cal: 420, p: 35, c: 32, f: 14, s: 4, na: 450 },
            { type: "มื้อว่าง/อื่นๆ", name: "นมถั่วเหลืองโปรตีนสูง 1 ขวด + ไข่ต้ม 1 ฟอง", cal: 255, p: 34, c: 7, f: 9.5, s: 2, na: 220 },
            { type: "มื้อเย็น", name: "ปลากะพงนึ่งขิง + ผักลวก (งดแป้ง)", cal: 245, p: 34, c: 5, f: 9, s: 1, na: 270 }
        ]}
    ];

    const curPlan = sevenDayPlans[mealPlanDayIndex] || sevenDayPlans[0];
    const planTotalCal = curPlan.meals.reduce((s, m) => s + m.cal, 0);
    const planTotalP = curPlan.meals.reduce((s, m) => s + m.p, 0);

    card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
            <div>
                <div class="text-xs font-bold text-white flex items-center gap-1.5">
                    <i class="fa-solid fa-fire-flame-curved ${isBurnMode ? 'text-amber-400' : 'text-emerald-400'}"></i> โหมดการกินปัจจุบัน
                </div>
                <div class="text-[10px] text-slate-400 mt-0.5">${isBurnMode ? '⚡ รีดไขมัน & น้ำตาล (คุมคาร์บ 100g • น้ำตาล 20g)' : '🔥 ลดไขมันมาตรฐาน (1,500 kcal • คาร์บ 150g)'}</div>
            </div>
            <div class="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0 text-[11px]">
                <button type="button" onclick="setBurnMode('normal')" class="px-2.5 py-1 rounded-lg font-semibold transition ${!isBurnMode ? 'bg-emerald-600 text-white' : 'text-slate-400'}">ปกติ</button>
                <button type="button" onclick="setBurnMode('burn')" class="px-2.5 py-1 rounded-lg font-semibold transition ${isBurnMode ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}">⚡ รีดไขมัน</button>
            </div>
        </div>
        <details class="bg-slate-950/70 rounded-2xl border border-slate-800/90 p-2.5" ${isBurnMode ? 'open' : ''}>
            <summary class="text-xs font-bold text-amber-300 cursor-pointer select-none flex items-center justify-between">
                <span><i class="fa-solid fa-calendar-week mr-1.5"></i> ตารางอาหาร 7 วัน (เน้นรีดไขมัน & ลดน้ำตาล)</span>
                <span class="text-[10px] text-slate-400">พับ/กาง ▾</span>
            </summary>
            <div class="pt-2.5 space-y-2">
                <div class="grid grid-cols-7 gap-1">
                    ${sevenDayPlans.map((_, idx) => `<button type="button" onclick="selectMealPlanDay(${idx})" class="py-1 rounded-lg text-[10px] font-bold border ${mealPlanDayIndex === idx ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-900 text-slate-400 border-slate-800'}">D${idx + 1}</button>`).join('')}
                </div>
                <div class="flex items-center justify-between gap-2 bg-slate-900/80 px-2.5 py-2 rounded-xl border border-slate-800/90">
                    <div class="text-[10px] text-slate-300">
                        ปรับเป้าวันนี้ตาม <b class="text-amber-300">${activePlanCode}</b>:
                        <b class="text-white">${planTotalCal} kcal</b> • <b class="text-emerald-400">P ${planTotalP}g</b>
                        ${dayOverride ? `<span class="text-amber-400 ml-1">(ใช้อยู่)</span>` : ''}
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <button type="button" onclick="applyFatLossDayTargetToDate(${mealPlanDayIndex}, currentDateKey)"
                            class="bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold px-2.5 py-1 rounded-lg transition">
                            ใช้เป็นเป้าวันนี้
                        </button>
                        ${dayOverride ? `
                            <button type="button" onclick="clearDayNutritionOverride(currentDateKey)"
                                class="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold px-2 py-1 rounded-lg border border-slate-700">
                                คืนค่า
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="space-y-1.5">
                    ${curPlan.meals.map(m => {
                        const safeName = m.name.replace(/'/g, "\\'");
                        return `
                            <div class="flex items-center justify-between gap-2 bg-slate-900/90 p-2 rounded-xl border border-slate-800/80 text-xs">
                                <div class="min-w-0">
                                    <div class="text-[10px] text-indigo-400 font-semibold">${m.type}</div>
                                    <div class="text-slate-100 font-medium leading-snug">${m.name}</div>
                                    <div class="text-[10px] text-slate-400">${m.cal} kcal • P ${m.p}g • C ${m.c}g • F ${m.f}g</div>
                                </div>
                                <button type="button" onclick="addPlannedMealToToday('${m.type}', '${safeName}', ${m.cal}, ${m.p}, ${m.c}, ${m.f}, ${m.s}, ${m.na})" class="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg">+ ใส่</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </details>
    `;
}

// ------------------------------------------
// 6. Daily Macro Ceiling Bars & Nutrition Coach
// ------------------------------------------
function renderDailyMacroChart() {
    const card = document.getElementById('daily-macro-chart-card');
    if (!card) return;

    const dayData = getDayData(currentDateKey);
    let totals = { protein: 0, carbs: 0, sugar: 0, fiber: 0, fat: 0, satFat: 0, sodium: 0, potassium: 0, cholesterol: 0 };
    Object.values(dayData.meals || {}).forEach(list => list.forEach(item => {
        Object.keys(totals).forEach(k => { totals[k] += Number(item[k] || 0); });
    }));

    const macroAdj = getNutrientAdjustments(currentDateKey);
    const protMin = Number(userGoals.proteinMin) || 96;

    const limitItems = [
        { label: "คาร์บ", cur: totals.carbs, max: macroAdj.carbs.adjustedMax, unit: "g", dec: 2 },
        { label: "น้ำตาล", cur: totals.sugar, max: macroAdj.sugar.adjustedMax, unit: "g", dec: 2 },
        { label: "ไขมันรวม", cur: totals.fat, max: macroAdj.fat.adjustedMax, unit: "g", dec: 2 },
        { label: "ไขมันอิ่มตัว", cur: totals.satFat, max: macroAdj.satFat.adjustedMax, unit: "g", dec: 2 },
        { label: "โซเดียม", cur: totals.sodium, max: macroAdj.sodium.adjustedMax, unit: "mg", dec: 1 },
        { label: "คอเลสเตอรอล", cur: totals.cholesterol, max: macroAdj.cholesterol.adjustedMax, unit: "mg", dec: 1 }
    ];

    const goalItems = [
        { label: "โปรตีน", cur: totals.protein, target: protMin, unit: "g", dec: 2, color: "bg-emerald-400" },
        { label: "ไฟเบอร์", cur: totals.fiber, target: 25, unit: "g", dec: 2, color: "bg-teal-400" },
        { label: "โพแทสเซียม", cur: totals.potassium, target: 3500, unit: "mg", dec: 1, color: "bg-lime-400" }
    ];

    const overCount = limitItems.filter(i => i.cur > i.max).length;

    card.innerHTML = `
        <details open>
            <summary class="flex justify-between items-center cursor-pointer select-none">
                <span class="text-xs font-bold text-white flex items-center gap-1.5"><i class="fa-solid fa-bars-progress text-indigo-400"></i> กราฟเช็กเพดานสารอาหารวันนี้</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold ${overCount > 0 ? 'bg-rose-950 text-rose-300 border border-rose-700/50' : 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'}">${overCount > 0 ? `เกินเกณฑ์ ${overCount} รายการ` : 'ยังไม่เกินเกณฑ์'}</span>
            </summary>
            <div class="pt-3 space-y-3">
                <div class="space-y-2">
                    ${limitItems.map(item => {
                        const pct = item.max > 0 ? Math.round((item.cur / item.max) * 100) : 0;
                        const isOver = item.cur > item.max;
                        const barColor = isOver ? "bg-rose-500" : (pct >= 80 ? "bg-amber-400" : "bg-sky-400");
                        return `
                            <div class="space-y-1">
                                <div class="flex justify-between items-center text-[11px]">
                                    <span class="text-slate-200 font-medium">${item.label} ${isOver ? `<span class="bg-rose-950 text-rose-300 text-[9px] px-1.5 rounded ml-1">เกิน +${fmtPrecise(item.cur - item.max, item.dec)}${item.unit}</span>` : ''}</span>
                                    <span class="${isOver ? 'text-rose-400 font-bold' : 'text-slate-300'}">${fmtPrecise(item.cur, item.dec)} / ${item.max}${item.unit}</span>
                                </div>
                                <div class="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
                                    <div class="${barColor} h-full rounded-full transition-all" style="width: ${Math.min(100, pct)}%"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-800/80">
                    ${goalItems.map(item => {
                        const pct = Math.min(100, Math.round((item.cur / item.target) * 100));
                        return `
                            <div class="bg-slate-950/70 p-2 rounded-xl border border-slate-800 space-y-1">
                                <div class="flex justify-between text-[10px]"><span class="text-slate-300">${item.label}</span><span class="text-emerald-400 font-bold">${pct}%</span></div>
                                <div class="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden"><div class="${item.color} h-full" style="width:${pct}%"></div></div>
                                <div class="text-[9px] text-slate-400 text-right">${fmtPrecise(item.cur, item.dec)}/${item.target}${item.unit}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </details>
    `;
}

const coachProteinMenus = [
    { name: "ไข่ขาวต้ม (3 ฟอง)", calories: 50, protein: 11, carbs: 1, sugar: 0, fiber: 0, fat: 0, satFat: 0, transFat: 0, sodium: 165, potassium: 160, cholesterol: 0, note: "โปรตีนล้วน แคลต่ำมาก ไร้ไขมัน" },
    { name: "เวย์โปรตีนไอโซเลต (1 สกู๊ป)", calories: 120, protein: 25, carbs: 2, sugar: 1, fiber: 0, fat: 1, satFat: 0.5, transFat: 0, sodium: 80, potassium: 150, cholesterol: 15, note: "ดูดซึมไว โซเดียมต่ำมาก" },
    { name: "อกไก่นุ่มเซเว่น (1 ชิ้น)", calories: 130, protein: 23, carbs: 2, sugar: 1, fiber: 0, fat: 3, satFat: 0.8, transFat: 0, sodium: 390, potassium: 220, cholesterol: 65, note: "หาซื้อง่าย อิ่มท้องนาน" },
    { name: "ทูน่าในน้ำแร่ (1 กระป๋อง)", calories: 110, protein: 24, carbs: 0, sugar: 0, fiber: 0, fat: 1, satFat: 0.2, transFat: 0, sodium: 320, potassium: 210, cholesterol: 45, note: "ไขมันต่ำมาก ยำหรือกินกับสลัดได้" },
    { name: "กรีกโยเกิร์ต 0% (1 ถ้วย)", calories: 90, protein: 15, carbs: 6, sugar: 5, fiber: 0, fat: 0, satFat: 0, transFat: 0, sodium: 55, potassium: 190, cholesterol: 5, note: "โซเดียมต่ำ ช่วยระบบขับถ่าย" },
    { name: "นมถั่วเหลืองโปรตีนสูง (1 ขวด)", calories: 180, protein: 28, carbs: 6, sugar: 2, fiber: 2, fat: 4.5, satFat: 0.5, transFat: 0, sodium: 150, potassium: 350, cholesterol: 0, note: "ดื่มง่าย โปรตีนแน่น โพแทสเซียมสูง" }
];

function shuffleCoachSuggestions() {
    coachShuffleSeed++;
    renderNutritionCoach();
}

function quickAddRecommendedFood(poolIdx) {
    const item = currentCoachPool[poolIdx];
    if (!item) return;
    getDayData(currentDateKey).meals["มื้อว่าง/อื่นๆ"].push({ ...item, qty: 1 });
    saveDataAndSync();
}

function renderNutritionCoach() {
    const container = document.getElementById('coach-container');
    if (!container) return;

    const dayData = getDayData(currentDateKey);
    let totalCal = 0, totalProt = 0;
    Object.values(dayData.meals).forEach(list => list.forEach(i => {
        totalCal += Number(i.calories || 0);
        totalProt += Number(i.protein || 0);
    }));

    const { totalBurn } = getTotalBurned(dayData);
    const adj = getCalorieAdjustment(currentDateKey);
    const { protMin: minProt } = getActiveProteinRange(currentDateKey);
    const remCal = Math.max(0, Math.round((adj.safeTarget + totalBurn) - totalCal));
    const remProt = fmtPrecise(Math.max(0, minProt - totalProt), 2);

    if (remProt <= 0) {
        container.innerHTML = `<div class="bg-slate-900 rounded-2xl p-3.5 border border-emerald-700/40 text-xs text-emerald-400 font-semibold"><i class="fa-solid fa-circle-check mr-1"></i> ยินดีด้วย! วันนี้ทานโปรตีนถึงเป้าหมาย (${fmtPrecise(totalProt, 2)}g) เรียบร้อยแล้ว</div>`;
        return;
    }

    const userMenus = (foodCatalog || []).filter(f => Number(f.protein || 0) >= 12).map(f => ({ ...f, note: `จากคลังเมนูคุณ (${f.calories} kcal)` }));
    currentCoachPool = [...userMenus, ...coachProteinMenus];
    const start = (coachShuffleSeed * 3) % currentCoachPool.length;
    const picks = [0, 1, 2].map(i => ({ ...currentCoachPool[(start + i) % currentCoachPool.length], poolIdx: (start + i) % currentCoachPool.length }));

    container.innerHTML = `
        <div class="bg-slate-900 rounded-2xl p-3.5 border border-slate-800 space-y-2.5">
            <div class="flex justify-between items-center">
                <span class="text-xs font-bold text-emerald-400"><i class="fa-solid fa-drumstick-bite mr-1"></i> เติมโปรตีนอีก ${remProt}g (งบเหลือ ${remCal} kcal)</span>
                <button type="button" onclick="shuffleCoachSuggestions()" class="bg-slate-800 text-indigo-300 text-[10px] px-2.5 py-1 rounded-lg border border-slate-700"><i class="fa-solid fa-shuffle"></i> สุ่มอื่น</button>
            </div>
            <div class="space-y-1.5">
                ${picks.map(m => `
                    <div class="flex justify-between items-center bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 text-xs gap-2">
                        <div>
                            <div class="text-slate-100 font-medium">${m.name}</div>
                            <div class="text-[10px] text-slate-400">${m.note || ''}</div>
                        </div>
                        <button type="button" onclick="quickAddRecommendedFood(${m.poolIdx})" class="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shrink-0">+${fmtPrecise(m.protein, 1)}g P</button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ------------------------------------------
// 7. Food Modal, 2-Decimal Multiplier, OCR, Barcode & Gemini AI
// ------------------------------------------
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
    if (!baseNutrition) setBaseNutritionFromCurrentInputs();
    const mult = extractMultiplier(document.getElementById('food-qty').value);

    document.getElementById('food-calories').value = fmtPrecise(baseNutrition.calories * mult, 1);
    document.getElementById('food-protein').value = fmtPrecise(baseNutrition.protein * mult, 2);
    document.getElementById('food-carbs').value = fmtPrecise(baseNutrition.carbs * mult, 2);
    document.getElementById('food-sugar').value = fmtPrecise(baseNutrition.sugar * mult, 2);
    document.getElementById('food-fiber').value = fmtPrecise(baseNutrition.fiber * mult, 2);
    document.getElementById('food-fat').value = fmtPrecise(baseNutrition.fat * mult, 2);
    document.getElementById('food-satfat').value = fmtPrecise(baseNutrition.satFat * mult, 2);
    document.getElementById('food-transfat').value = fmtPrecise(baseNutrition.transFat * mult, 2);
    document.getElementById('food-sodium').value = fmtPrecise(baseNutrition.sodium * mult, 1);
    document.getElementById('food-potassium').value = fmtPrecise(baseNutrition.potassium * mult, 1);
    document.getElementById('food-cholesterol').value = fmtPrecise(baseNutrition.cholesterol * mult, 1);
}

function calcGramMultiplier() {
    const baseG = parseFloat(document.getElementById('food-base-grams')?.value) || 100;
    const actualG = parseFloat(document.getElementById('food-actual-grams')?.value);
    if (!actualG || actualG <= 0) return;

    const mult = fmtPrecise(actualG / baseG, 3);
    document.getElementById('food-qty').value = mult;
    applyQuantityMultiplier();
}

function openFoodModal(mealType, itemIndex = null) {
    document.getElementById('edit-meal-type').value = mealType;
    document.getElementById('edit-item-index').value = itemIndex !== null ? itemIndex : '';
    document.getElementById('modal-title').innerText = itemIndex !== null ? `แก้ไขรายการ (${mealType})` : `เพิ่มรายการ (${mealType})`;

    if (itemIndex !== null) {
        const item = allMealsHistory[currentDateKey].meals[mealType][itemIndex];
        document.getElementById('food-name').value = item.name || '';
        document.getElementById('food-qty').value = extractMultiplier(item.qty);
        document.getElementById('food-calories').value = item.calories ?? '';
        document.getElementById('food-protein').value = item.protein ?? '';
        document.getElementById('food-carbs').value = item.carbs ?? '';
        document.getElementById('food-sugar').value = item.sugar ?? '';
        document.getElementById('food-fiber').value = item.fiber ?? '';
        document.getElementById('food-fat').value = item.fat ?? '';
        document.getElementById('food-satfat').value = item.satFat ?? '';
        document.getElementById('food-transfat').value = item.transFat ?? '';
        document.getElementById('food-sodium').value = item.sodium ?? '';
        document.getElementById('food-potassium').value = item.potassium ?? '';
        document.getElementById('food-cholesterol').value = item.cholesterol ?? '';
        setBaseNutritionFromCurrentInputs();
        loadFoodPhotoPreview(item.photo || null);
    } else {
        document.getElementById('food-form').reset();
        document.getElementById('food-qty').value = 1;
        document.getElementById('food-base-grams').value = 100;
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

    const qtyNum = Math.max(0.01, extractMultiplier(document.getElementById('food-qty').value));
    const nonNeg = (id) => Math.max(0, Number(document.getElementById(id)?.value) || 0);

    let finalPhotoPath = currentFoodPhotoPath;
    if (pendingFoodPhotoBase64) {
        setSyncStatus('syncing', 'กำลังอัปโหลดรูปอาหาร...');
        const uploadedPath = await uploadImageToGitHubFolder('images', 'food', pendingFoodPhotoBase64);
        if (uploadedPath) finalPhotoPath = uploadedPath;
    }

    const newItem = {
        name: rawName,
        qty: qtyNum,
        photo: finalPhotoPath || null,
        calories: fmtPrecise(nonNeg('food-calories'), 1),
        protein: fmtPrecise(nonNeg('food-protein'), 2),
        carbs: fmtPrecise(nonNeg('food-carbs'), 2),
        sugar: fmtPrecise(nonNeg('food-sugar'), 2),
        fiber: fmtPrecise(nonNeg('food-fiber'), 2),
        fat: fmtPrecise(nonNeg('food-fat'), 2),
        satFat: fmtPrecise(nonNeg('food-satfat'), 2),
        transFat: fmtPrecise(nonNeg('food-transfat'), 2),
        sodium: fmtPrecise(nonNeg('food-sodium'), 1),
        potassium: fmtPrecise(nonNeg('food-potassium'), 1),
        cholesterol: fmtPrecise(nonNeg('food-cholesterol'), 1)
    };

    const dayData = getDayData(currentDateKey);
    if (itemIndex !== '') dayData.meals[mealType][Number(itemIndex)] = newItem;
    else dayData.meals[mealType].push(newItem);

    const unitItem = {
        name: newItem.name,
        photo: finalPhotoPath || null,
        calories: fmtPrecise(newItem.calories / qtyNum, 2),
        protein: fmtPrecise(newItem.protein / qtyNum, 2),
        carbs: fmtPrecise(newItem.carbs / qtyNum, 2),
        sugar: fmtPrecise(newItem.sugar / qtyNum, 2),
        fiber: fmtPrecise(newItem.fiber / qtyNum, 2),
        fat: fmtPrecise(newItem.fat / qtyNum, 2),
        satFat: fmtPrecise(newItem.satFat / qtyNum, 2),
        transFat: fmtPrecise(newItem.transFat / qtyNum, 2),
        sodium: fmtPrecise(newItem.sodium / qtyNum, 2),
        potassium: fmtPrecise(newItem.potassium / qtyNum, 2),
        cholesterol: fmtPrecise(newItem.cholesterol / qtyNum, 2)
    };

    const existingCatIdx = foodCatalog.findIndex(f => f.name.toLowerCase() === unitItem.name.toLowerCase());
    if (existingCatIdx === -1) foodCatalog.push(unitItem);
    else if (finalPhotoPath) foodCatalog[existingCatIdx].photo = finalPhotoPath;

    pendingFoodPhotoBase64 = null;
    closeFoodModal();
    saveDataAndSync();
}

function deleteMealItem(mealType, index) {
    if (confirm("ต้องการลบรายการนี้ใช่ไหม?")) {
        getDayData(currentDateKey).meals[mealType].splice(index, 1);
        saveDataAndSync();
    }
}

function updateCatalogDatalist() {
    const datalist = document.getElementById('food-catalog-list');
    if (!datalist) return;
    datalist.innerHTML = (foodCatalog || []).map(f => `<option value="${f.name}">(${fmtPrecise(f.calories, 1)} kcal, โปรตีน ${fmtPrecise(f.protein, 2)}g)</option>`).join('');
}

function autofillFoodCatalog(name) {
    const found = foodCatalog.find(f => f.name.toLowerCase() === name.toLowerCase());
    if (found) {
        fillFormWithNutritionData(found);
        loadFoodPhotoPreview(found.photo || null);
    }
}

function fillFormWithNutritionData(item) {
    if (item.name) document.getElementById('food-name').value = item.name;
    document.getElementById('food-qty').value = 1;
    document.getElementById('food-calories').value = fmtPrecise(item.calories ?? 0, 1);
    document.getElementById('food-protein').value = fmtPrecise(item.protein ?? 0, 2);
    document.getElementById('food-carbs').value = fmtPrecise(item.carbs ?? 0, 2);
    document.getElementById('food-sugar').value = fmtPrecise(item.sugar ?? 0, 2);
    document.getElementById('food-fiber').value = fmtPrecise(item.fiber ?? 0, 2);
    document.getElementById('food-fat').value = fmtPrecise(item.fat ?? 0, 2);
    document.getElementById('food-satfat').value = fmtPrecise(item.satFat ?? 0, 2);
    document.getElementById('food-transfat').value = fmtPrecise(item.transFat ?? 0, 2);
    document.getElementById('food-sodium').value = fmtPrecise(item.sodium ?? 0, 1);
    document.getElementById('food-potassium').value = fmtPrecise(item.potassium ?? 0, 1);
    document.getElementById('food-cholesterol').value = fmtPrecise(item.cholesterol ?? 0, 1);
    setBaseNutritionFromCurrentInputs();
}

// Photo Preview, OCR, Barcode & Gemini AI
function triggerFoodPhotoUpload() {
    const input = document.getElementById('food-photo-input');
    input.value = '';
    input.click();
}

async function handleFoodPhotoSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    const base64 = await resizeImageToBase64(file, 500);
    pendingFoodPhotoBase64 = base64;
    currentFoodPhotoPath = null;
    document.getElementById('food-photo-preview').src = `data:image/jpeg;base64,${base64}`;
    document.getElementById('food-photo-preview-wrap').classList.remove('hidden');
    document.getElementById('food-photo-status').innerText = "พร้อมอัปโหลดขึ้น Cloud เมื่อกดบันทึก";
}

function removeFoodPhoto() {
    pendingFoodPhotoBase64 = null;
    currentFoodPhotoPath = null;
    document.getElementById('food-photo-preview-wrap')?.classList.add('hidden');
}

async function loadFoodPhotoPreview(photoPath) {
    if (!photoPath) return removeFoodPhoto();
    currentFoodPhotoPath = photoPath;
    pendingFoodPhotoBase64 = null;
    document.getElementById('food-photo-preview-wrap').classList.remove('hidden');
    if (photoBlobCache[photoPath]) {
        document.getElementById('food-photo-preview').src = photoBlobCache[photoPath];
        return;
    }
    const token = localStorage.getItem('fitTracker_github_token');
    if (!token) return;
    try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${photoPath}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
        });
        if (!res.ok) return;
        const data = await res.json();
        const dataUrl = `data:image/jpeg;base64,${data.content.replace(/\s/g, '')}`;
        photoBlobCache[photoPath] = dataUrl;
        document.getElementById('food-photo-preview').src = dataUrl;
    } catch (e) {}
}

function triggerImageCapture(mode) {
    if (mode === 'food' && !localStorage.getItem('fitTracker_gemini_key')) {
        alert("ปุ่มถ่ายรูปอาหารต้องใส่ Gemini API Key ในปุ่มตั้งค่า (⚙️) ก่อนครับ");
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
    await handleFoodPhotoSelected(event);
    if (currentScanMode === 'label') await scanLabelOfflineOCR(file);
    else await scanFoodWithGemini(file);
}

async function scanLabelOfflineOCR(file) {
    const loader = document.getElementById('ai-loading-indicator');
    loader.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังอ่านฉลากโภชนาการ...';
    loader.classList.remove('hidden');
    let worker = null;
    try {
        worker = await Tesseract.createWorker(['tha', 'eng']);
        const ret = await worker.recognize(file);
        const text = (ret?.data?.text || '').replace(/\s+/g, ' ');
        const ext = (re) => { const m = text.match(re); return m ? parseFloat(m[1]) : 0; };

        fillFormWithNutritionData({
            name: "สินค้าจากฉลาก",
            calories: ext(/(?:พลังงานทั้งหมด|พลังงาน|Energy|Calories)[^\d]*(\d+(?:\.\d+)?)/i),
            protein: ext(/(?:โปรตีน|Protein)[^\d]*(\d+(?:\.\d+)?)/i),
            carbs: ext(/(?:คาร์โบไฮเดรตทั้งหมด|คาร์โบไฮเดรต|Carbohydrate)[^\d]*(\d+(?:\.\d+)?)/i),
            sugar: ext(/(?:น้ำตาล|Sugar)[^\d]*(\d+(?:\.\d+)?)/i),
            fiber: ext(/(?:ใยอาหาร|Dietary Fiber|Fiber)[^\d]*(\d+(?:\.\d+)?)/i),
            fat: ext(/(?:ไขมันทั้งหมด|ไขมัน|Total Fat|Fat)[^\d]*(\d+(?:\.\d+)?)/i),
            satFat: ext(/(?:ไขมันอิ่มตัว|Saturated Fat)[^\d]*(\d+(?:\.\d+)?)/i),
            transFat: ext(/(?:ไขมันทรานส์|Trans Fat)[^\d]*(\d+(?:\.\d+)?)/i),
            sodium: ext(/(?:โซเดียม|Sodium)[^\d]*(\d+(?:\.\d+)?)/i),
            potassium: ext(/(?:โพแทสเซียม|Potassium)[^\d]*(\d+(?:\.\d+)?)/i),
            cholesterol: ext(/(?:โคเลสเตอรอล|คอเลสเตอรอล|Cholesterol)[^\d]*(\d+(?:\.\d+)?)/i)
        });
    } catch (err) {
        alert("อ่านฉลากไม่สำเร็จ: " + err.message);
    } finally {
        if (worker) await worker.terminate().catch(() => {});
        loader.classList.add('hidden');
    }
}

function openBarcodeScanner() {
    document.getElementById('barcode-modal').classList.remove('hidden');
    html5QrCode = new Html5Qrcode("barcode-reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 150 } }, async (code) => {
        await closeBarcodeScanner();
        const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
        const data = await res.json();
        if (data.status === 1 && data.product) {
            const p = data.product, n = p.nutriments || {};
            const sfx = n['energy-kcal_serving'] !== undefined ? '_serving' : '_100g';
            fillFormWithNutritionData({
                name: `${p.product_name_th || p.product_name || code}`,
                calories: n[`energy-kcal${sfx}`] || 0,
                protein: n[`proteins${sfx}`] || 0,
                carbs: n[`carbohydrates${sfx}`] || 0,
                sugar: n[`sugars${sfx}`] || 0,
                fiber: n[`fiber${sfx}`] || 0,
                fat: n[`fat${sfx}`] || 0,
                satFat: n[`saturated-fat${sfx}`] || 0,
                sodium: (n[`sodium${sfx}`] || 0) * 1000
            });
        } else {
            alert("ไม่พบบาร์โค้ดในฐานข้อมูล ลองสแกนฉลากแทนครับ");
        }
    }, () => {}).catch(() => {});
}

async function closeBarcodeScanner() {
    if (html5QrCode && html5QrCode.isScanning) await html5QrCode.stop().catch(() => {});
    document.getElementById('barcode-modal').classList.add('hidden');
}

// Catalog Manager
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
    const kw = (document.getElementById('catalog-search-input').value || '').toLowerCase();
    const filtered = foodCatalog.map((item, idx) => ({ ...item, idx })).filter(i => i.name.toLowerCase().includes(kw));
    listEl.innerHTML = filtered.map(item => `
        <div class="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex justify-between items-center gap-2 text-xs">
            <div>
                <div class="font-semibold text-white">${item.name}</div>
                <div class="text-[10px] text-slate-400">${fmtPrecise(item.calories, 1)} kcal | P: <span class="text-emerald-400">${fmtPrecise(item.protein, 2)}g</span> | C: ${fmtPrecise(item.carbs, 2)}g | F: ${fmtPrecise(item.fat, 2)}g</div>
            </div>
            <button type="button" onclick="if(confirm('ลบเมนูนี้?')){foodCatalog.splice(${item.idx},1); renderCatalogManagerList(); saveDataAndSync();}" class="bg-slate-800 text-rose-400 w-7 h-7 rounded-lg"><i class="fa-solid fa-trash text-[11px]"></i></button>
        </div>
    `).join('');
}

// ------------------------------------------
// 8. Water Tracker (อัปเดตตัวเลข + หลอดน้ำทันที)
// ------------------------------------------
function renderWaterUI() {
    const dayData = getDayData(currentDateKey);
    const water = Math.max(0, Number(dayData.water) || 0);
    const goal = Math.max(1, Number(userGoals.water) || 2000);
    const pct = Math.min(100, Math.round((water / goal) * 100));

    const badge = document.getElementById('water-summary-badge');
    const goalLabel = document.getElementById('goal-water-label');
    const bar = document.getElementById('water-progress-bar');
    const pctEl = document.getElementById('water-percent');

    if (goalLabel) goalLabel.textContent = goal.toLocaleString();
    if (badge) badge.textContent = `${water.toLocaleString()} / ${goal.toLocaleString()} ml`;
    if (bar) bar.style.width = `${pct}%`;
    if (pctEl) pctEl.textContent = `${pct}%`;
}

function addWater(amount) {
    const dayData = getDayData(currentDateKey);
    const currentWater = Math.max(0, Number(dayData.water) || 0);
    dayData.water = Math.max(0, currentWater + Number(amount || 0));

    // อัปเดตตัวเลขและหลอดน้ำบนหน้าจอทันที
    renderWaterUI();

    // บันทึกลง localStorage ทันที
    localStorage.setItem('fitTracker_history', JSON.stringify(allMealsHistory));
    localStorage.setItem('fitTracker_goals', JSON.stringify(userGoals));

    // ซิงก์ขึ้น GitHub ถ้ามีฟังก์ชันอยู่
    if (typeof pushToGitHub === 'function') {
        pushToGitHub(false);
    }
}

// ------------------------------------------
// 9. แถบงบค่าอาหารรายวัน (เชื่อมข้อมูลกับหน้า Finance)
// ------------------------------------------
function renderFoodBudgetMiniBar() {
    const box = document.getElementById('food-budget-mini-bar');
    if (!box) return;

    const dayData = getDayData(currentDateKey);
    const finances = Array.isArray(dayData.finances) ? dayData.finances : [];
    const foodSpent = finances
        .filter(f => f.type === 'expense' && (f.category === 'food' || !f.category))
        .reduce((sum, f) => sum + Number(f.amount || 0), 0);

    const foodBudget = Number(userGoals.foodDailyBudget) || 200;
    const rem = fmtPrecise(foodBudget - foodSpent, 0);
    const pct = Math.min(100, Math.round((foodSpent / Math.max(1, foodBudget)) * 100));
    const isOver = rem < 0;

    const barColor = isOver ? 'bg-rose-500' : (pct >= 80 ? 'bg-amber-400' : 'bg-emerald-400');
    const textClass = isOver ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold';

    box.innerHTML = `
        <div class="flex items-center justify-between gap-2 text-[11px]">
            <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-slate-300 font-semibold">🍱 งบค่าอาหาร:</span>
                <button type="button" onclick="editFoodDailyBudget()" class="text-amber-300 hover:underline font-bold">
                    ${fmtPrecise(foodSpent, 0).toLocaleString()} / ${foodBudget.toLocaleString()} บ. <i class="fa-solid fa-pen text-[9px]"></i>
                </button>
                <span class="${textClass}">(${isOver ? `เกิน ${Math.abs(rem)} บ.` : `เหลือ ${rem} บ.`})</span>
            </div>
            <button type="button" onclick="quickLogFoodExpenseFromFoodTrack()"
                class="bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0">
                + ค่าข้าว
            </button>
        </div>
        <div class="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
            <div class="${barColor} h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
        </div>
    `;
}

function editFoodDailyBudget() {
    const cur = Number(userGoals.foodDailyBudget) || 200;
    const val = prompt('กำหนดงบค่าอาหารต่อวัน (บาท):', cur);
    if (val === null) return;
    userGoals.foodDailyBudget = Math.max(20, Number(val) || cur);
    saveDataAndSync();
}

function quickLogFoodExpenseFromFoodTrack() {
    const title = prompt('ชื่อค่าอาหาร / เครื่องดื่ม:', 'ค่าอาหาร');
    if (!title || !title.trim()) return;
    const amt = parseFloat(prompt(`จำนวนเงินสำหรับ "${title.trim()}" (บาท):`, '60'));
    if (isNaN(amt) || amt <= 0) return;

    const dayData = getDayData(currentDateKey);
    if (!Array.isArray(dayData.finances)) dayData.finances = [];
    dayData.finances.unshift({
        type: 'expense',
        category: 'food',
        title: title.trim(),
        amount: fmtPrecise(amt, 2)
    });
    saveDataAndSync();
}

const GEMINI_MODEL_PRIORITY = [
    'gemini-3.8-flash-lite',
    'gemini-3.8-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-3-flash'
];

async function getAvailableGeminiModels(apiKey) {
    let available = [...GEMINI_MODEL_PRIORITY];
    try {
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (listRes.ok) {
            const listData = await listRes.json();
            const fetched = (listData.models || [])
                .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
                .map(m => m.name.replace('models/', ''));

            if (fetched.length > 0) {
                const ordered = GEMINI_MODEL_PRIORITY.filter(m => fetched.includes(m));
                const extraFlash = fetched.filter(
                    m => !ordered.includes(m) && m.includes('flash') && !m.includes('audio') && !m.includes('tts') && !m.includes('2.5-flash')
                );
                available = [...ordered, ...extraFlash];
            }
        }
    } catch (e) {
        console.warn('Model list lookup failed, using priority fallback:', e);
    }
    return available.length > 0 ? available : ['gemini-3.8-flash'];
}

async function resolveWorkingGeminiModel(apiKey) {
    const models = await getAvailableGeminiModels(apiKey);
    return models[0] || 'gemini-3.8-flash';
}

async function callGeminiWithModelFallback(apiKey, requestBody) {
    const models = await getAvailableGeminiModels(apiKey);
    let lastError = null;

    for (const modelName of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        for (let attempt = 0; attempt < 2; attempt++) {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const rawResponseText = await res.text();
            let data = null;
            try {
                data = JSON.parse(rawResponseText);
            } catch (_) {
                lastError = new Error(`[${modelName}] เซิร์ฟเวอร์ตอบกลับไม่ใช่ JSON (HTTP ${res.status})`);
                break;
            }

            if (res.ok) {
                return { data, modelName };
            }

            const errMsg = data?.error?.message || `HTTP ${res.status}`;
            lastError = new Error(`[${modelName}] ${errMsg}`);

            const isTransientOverload =
                res.status === 503 ||
                res.status === 500 ||
                res.status === 502 ||
                res.status === 504 ||
                /high demand|overloaded|unavailable|try again later/i.test(errMsg);

            const isQuotaOrMissing =
                res.status === 429 ||
                res.status === 404 ||
                /quota|rate.?limit|no longer available|not found|not supported/i.test(errMsg);

            if (isTransientOverload && attempt === 0) {
                await new Promise(r => setTimeout(r, 700));
                continue;
            }

            if (isTransientOverload || isQuotaOrMissing) {
                break;
            }

            throw lastError;
        }
    }

    throw lastError || new Error("ไม่สามารถเชื่อมต่อโมเดล Gemini ได้ในขณะนี้");
}

async function scanFoodWithGemini(file) {
    const loader = document.getElementById('ai-loading-indicator');
    loader.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> AI กำลังวิเคราะห์อาหาร...';
    loader.classList.remove('hidden');

    try {
        const apiKey = (localStorage.getItem('fitTracker_gemini_key') || '').trim();
        if (!apiKey) throw new Error("ไม่พบ Gemini API Key กรุณากดปุ่มตั้งค่า (⚙️) เพื่อใส่คีย์ก่อนครับ");

        const base64Data = await resizeImageToBase64(file, 800);
        const promptText = `วิเคราะห์ภาพอาหารจานนี้ ประเมินชื่อเมนูภาษาไทย (ระบุปริมาณต่อ 1 หน่วยไว้ในวงเล็บ) และสารอาหาร ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่น:
{"name": "ชื่อเมนูภาษาไทย (1 จาน)", "calories": ตัวเลข, "protein": ตัวเลข, "carbs": ตัวเลข, "sugar": ตัวเลข, "fiber": ตัวเลข, "fat": ตัวเลข, "satFat": ตัวเลข, "transFat": ตัวเลข, "sodium": ตัวเลข, "potassium": ตัวเลข, "cholesterol": ตัวเลข}`;

        const { data } = await callGeminiWithModelFallback(apiKey, {
            contents: [{
                parts: [
                    { text: promptText },
                    { inline_data: { mime_type: "image/jpeg", data: base64Data } }
                ]
            }],
            generationConfig: { response_mime_type: "application/json" }
        });

        const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI ไม่ได้ส่งข้อมูลสารอาหารกลับมา กรุณาลองถ่ายใหม่อีกครั้ง");

        fillFormWithNutritionData(JSON.parse(jsonMatch[0]));
    } catch (error) {
        alert("AI วิเคราะห์ไม่สำเร็จ: " + error.message);
    } finally {
        loader.classList.add('hidden');
    }
}
