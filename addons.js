// ==========================================================================
// addons.js — โมดูลตัวช่วยอัจฉริยะ (Outdoor Mode, Dinner Tetris, ตู้เย็น & เทียบโปรตีน)
// ==========================================================================

window.pantryItems = JSON.parse(localStorage.getItem('fitTracker_pantry') || 'null') || [
    { id: 'pt_1', name: 'อกไก่ต้ม (100g)', qty: 4, unit: 'ชิ้น', lowAlert: 2 },
    { id: 'pt_2', name: 'ไข่ต้ม (1 ฟอง)', qty: 8, unit: 'ฟอง', lowAlert: 3 },
    { id: 'pt_3', name: 'เวย์โปรตีนไอโซเลต (1 สกู๊ป)', qty: 15, unit: 'สกู๊ป', lowAlert: 4 }
];
let savedProteinDeals = JSON.parse(localStorage.getItem('fitTracker_pvs_deals') || '[]');
let tetrisSeed = 0;

// ------------------------------------------
// 1. Entry Point สำหรับ Render หน้า Add-ons ทั้งหมด
// ------------------------------------------
function renderAddonsPage() {
    renderOutdoorTripCard();
    renderDinnerTetrisCard();
    renderPantryCard();
    renderSavedProteinDeals();
}

function saveAddonsAndSync() {
    localStorage.setItem('fitTracker_pantry', JSON.stringify(window.pantryItems));
    localStorage.setItem('fitTracker_pvs_deals', JSON.stringify(savedProteinDeals));
    if (typeof saveDataAndSync === 'function') saveDataAndSync();
}

// ------------------------------------------
// 2. โหมดทริปปีนเขา & เที่ยวทะเล (Outdoor & Trip Mode)
// ------------------------------------------
function toggleOutdoorTripMode() {
    const dayData = getDayData(currentDateKey);
    if (!dayData.outdoorMode) {
        dayData.outdoorMode = { active: true, activityName: 'เดินป่า / ปีนเขา', altitude: '', distanceKm: '', extraBurn: 350 };
    } else {
        dayData.outdoorMode.active = !dayData.outdoorMode.active;
    }
    saveAddonsAndSync();
    renderOutdoorTripCard();
}

function updateOutdoorField(field, val) {
    const dayData = getDayData(currentDateKey);
    if (!dayData.outdoorMode) dayData.outdoorMode = { active: true, activityName: 'เดินป่า / ปีนเขา', altitude: '', distanceKm: '', extraBurn: 350 };
    dayData.outdoorMode[field] = val;
    saveAddonsAndSync();
}

function logOutdoorBurnToWorkout() {
    const dayData = getDayData(currentDateKey);
    const om = dayData.outdoorMode || {};
    const burn = Math.max(50, Number(om.extraBurn) || 350);
    const title = `🏔️ ${om.activityName || 'ทริปเดินป่า/กิจกรรมหนัก'}${om.distanceKm ? ` (${om.distanceKm} กม.)` : ''}${om.altitude ? ` สูง ${om.altitude}m` : ''}`;
    dayData.workouts.push({ type: title, duration: 90, calories: burn });
    saveAddonsAndSync();
    alert(`บันทึก "${title}" เผาผลาญ -${burn} kcal ลงตารางวันนี้เรียบร้อย!`);
}

function renderOutdoorTripCard() {
    const card = document.getElementById('addon-outdoor-card');
    if (!card) return;

    const dayData = getDayData(currentDateKey);
    const om = dayData.outdoorMode || { active: false, activityName: 'เดินป่า / ปีนเขา', altitude: '', distanceKm: '', extraBurn: 350 };

    card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
            <div>
                <h3 class="text-sm font-bold text-white flex items-center gap-1.5">
                    <i class="fa-solid fa-mountain-sun text-teal-400"></i> โหมดทริปปีนเขา & เที่ยวทะเล
                </h3>
                <span class="text-[10px] text-slate-400">ปลดล็อกเพดานคาร์บ +100g & โซเดียม +1,000mg วันใช้แรงหนัก</span>
            </div>
            <button type="button" onclick="toggleOutdoorTripMode()"
                class="text-xs px-3 py-1.5 rounded-full font-bold border transition shrink-0 ${om.active
                    ? 'bg-teal-500/25 border-teal-400 text-teal-200 shadow-md shadow-teal-500/20'
                    : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'}">
                ${om.active ? '🏔️ เปิดโหมดทริปอยู่' : 'ปิดอยู่'}
            </button>
        </div>

        ${om.active ? `
            <div class="bg-slate-950/80 border border-teal-500/30 rounded-2xl p-3 space-y-2.5 text-xs">
                <div class="text-[11px] text-teal-300 font-semibold">
                    ✅ ปลดล็อกโควตาพิเศษวันนี้แล้ว: คาร์บเพิ่มเป็น <b>${(Number(userGoals.carbsMax) || 150) + 100}g</b> • โซเดียมไม่เกิน <b>${(Number(userGoals.sodiumMax) || 2000) + 1000}mg</b>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div class="col-span-2">
                        <label class="text-[10px] text-slate-400">ชื่อกิจกรรม / สถานที่</label>
                        <input type="text" value="${om.activityName || ''}" onchange="updateOutdoorField('activityName', this.value)"
                            class="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white mt-0.5" />
                    </div>
                    <div>
                        <label class="text-[10px] text-slate-400">ระดับความสูง (เมตร)</label>
                        <input type="number" value="${om.altitude || ''}" onchange="updateOutdoorField('altitude', this.value)" placeholder="เช่น 1300"
                            class="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white mt-0.5" />
                    </div>
                    <div>
                        <label class="text-[10px] text-slate-400">ระยะทางเดินป่า (กม.)</label>
                        <input type="number" step="0.1" value="${om.distanceKm || ''}" onchange="updateOutdoorField('distanceKm', this.value)" placeholder="เช่น 6.5"
                            class="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white mt-0.5" />
                    </div>
                </div>
                <div class="flex items-center justify-between gap-2 pt-1">
                    <div class="flex items-center gap-1.5 text-[11px]">
                        <span class="text-slate-400">เผาผลาญพิเศษ:</span>
                        <input type="number" value="${om.extraBurn || 350}" onchange="updateOutdoorField('extraBurn', this.value)"
                            class="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-orange-300 font-bold text-center" />
                        <span class="text-slate-400">kcal</span>
                    </div>
                    <button type="button" onclick="logOutdoorBurnToWorkout()" class="bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl">
                        + บันทึกเผาผลาญวันนี้
                    </button>
                </div>
            </div>
        ` : `<div class="text-[11px] text-slate-400">กดเปิดโหมดนี้ในวันที่ไปเดินป่า ปีนเขา ดำน้ำ หรือเที่ยวหนัก เพื่อป้องกันระบบเตือนโซเดียม/คาร์บเกินและบันทึกสถิติจาก HUAWEI Watch</div>`}
    `;
}

// ------------------------------------------
// 3. จำลองมื้อเย็นอัตโนมัติ (Smart Dinner Tetris)
// ------------------------------------------
let currentTetrisCombo = [];

function shuffleDinnerTetris() {
    tetrisSeed++;
    renderDinnerTetrisCard();
}

function applyTetrisComboToMeal() {
    if (currentTetrisCombo.length === 0) return;
    const dayData = getDayData(currentDateKey);
    currentTetrisCombo.forEach(item => {
        dayData.meals["มื้อเย็น"].push({
            name: item.name,
            qty: item.qty || 1,
            photo: item.photo || null,
            calories: fmtPrecise(item.calories * (item.qty || 1), 1),
            protein: fmtPrecise(item.protein * (item.qty || 1), 2),
            carbs: fmtPrecise(item.carbs * (item.qty || 1), 2),
            sugar: fmtPrecise(item.sugar * (item.qty || 1), 2),
            fiber: fmtPrecise(item.fiber * (item.qty || 1), 2),
            fat: fmtPrecise(item.fat * (item.qty || 1), 2),
            satFat: fmtPrecise(item.satFat * (item.qty || 1), 2),
            transFat: fmtPrecise(item.transFat * (item.qty || 1), 2),
            sodium: fmtPrecise(item.sodium * (item.qty || 1), 1),
            potassium: fmtPrecise(item.potassium * (item.qty || 1), 1),
            cholesterol: fmtPrecise(item.cholesterol * (item.qty || 1), 1)
        });
    });
    saveAddonsAndSync();
    alert(`ลงรายการทั้ง ${currentTetrisCombo.length} อย่างเข้า "มื้อเย็น" ของวันนี้เรียบร้อยแล้ว!`);
}

function renderDinnerTetrisCard() {
    const card = document.getElementById('addon-tetris-card');
    if (!card) return;

    const dayData = getDayData(currentDateKey);
    let usedCal = 0, usedProt = 0;
    Object.values(dayData.meals || {}).forEach(list => list.forEach(i => {
        usedCal += Number(i.calories || 0);
        usedProt += Number(i.protein || 0);
    }));

    const { totalBurn } = getTotalBurned(dayData);
    const adj = getCalorieAdjustment(currentDateKey);
    const remCal = Math.max(0, Math.round((adj.safeTarget + totalBurn) - usedCal));
    const remProt = Math.max(0, fmtPrecise((Number(userGoals.proteinMin) || 96) - usedProt, 1));

    const pool = (foodCatalog || []).filter(f => Number(f.calories) > 0 && Number(f.calories) <= Math.max(200, remCal));
    currentTetrisCombo = [];

    if (pool.length > 0 && remCal >= 80) {
        let budgetCal = remCal;
        let needProt = remProt;
        const sorted = [...pool].sort((a, b) => (b.protein / Math.max(1, b.calories)) - (a.protein / Math.max(1, a.calories)));

        for (let i = 0; i < sorted.length && currentTetrisCombo.length < 3; i++) {
            const idx = (i + tetrisSeed) % sorted.length;
            const item = sorted[idx];
            if (item.calories <= budgetCal) {
                currentTetrisCombo.push({ ...item, qty: 1 });
                budgetCal -= item.calories;
                needProt -= item.protein;
                if (needProt <= 0 && budgetCal < 150) break;
            }
        }
    }

    const comboCal = fmtPrecise(currentTetrisCombo.reduce((s, i) => s + Number(i.calories), 0), 1);
    const comboProt = fmtPrecise(currentTetrisCombo.reduce((s, i) => s + Number(i.protein), 0), 1);

    card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
            <div>
                <h3 class="text-sm font-bold text-white flex items-center gap-1.5">
                    <i class="fa-solid fa-puzzle-piece text-indigo-400"></i> จำลองมื้อเย็นอัตโนมัติ (Dinner Tetris)
                </h3>
                <span class="text-[10px] text-slate-400">งบคงเหลือวันนี้: <b class="text-white">${remCal} kcal</b> • ขาดโปรตีน <b class="text-emerald-400">${remProt}g</b></span>
            </div>
            <button type="button" onclick="shuffleDinnerTetris()" class="bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-700 shrink-0">
                <i class="fa-solid fa-shuffle"></i> สุ่มเซต
            </button>
        </div>

        ${currentTetrisCombo.length > 0 ? `
            <div class="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 space-y-2">
                <div class="space-y-1">
                    ${currentTetrisCombo.map(item => `
                        <div class="flex justify-between items-center text-xs py-1 border-b border-slate-800/60 last:border-none">
                            <span class="text-slate-100 font-medium">• ${item.name}</span>
                            <span class="text-[11px] text-slate-400">${fmtPrecise(item.calories, 1)} kcal • <b class="text-emerald-400">P ${fmtPrecise(item.protein, 1)}g</b></span>
                        </div>
                    `).join('')}
                </div>
                <div class="flex items-center justify-between pt-1">
                    <div class="text-[11px] text-amber-300 font-bold">รวมเซตนี้: ${comboCal} kcal • โปรตีน ${comboProt}g</div>
                    <button type="button" onclick="applyTetrisComboToMeal()" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl">
                        + ใส่มื้อเย็นครบเซต
                    </button>
                </div>
            </div>
        ` : `<div class="text-xs text-slate-400 bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-center">งบแคลอรีวันนี้ครบตามเป้าแล้ว หรือยังไม่มีเมนูในคลังที่พอดีกับงบที่เหลือครับ</div>`}
    `;
}

// ------------------------------------------
// 4. ตู้เย็น & คลังเสบียงส่วนตัว (ตัดสต็อกอัตโนมัติ)
// ------------------------------------------
function addPantryItem() {
    const nameEl = document.getElementById('pantry-new-name');
    const qtyEl = document.getElementById('pantry-new-qty');
    const unitEl = document.getElementById('pantry-new-unit');
    const name = (nameEl?.value || '').trim();
    const qty = Math.max(1, parseFloat(qtyEl?.value) || 1);
    const unit = (unitEl?.value || 'ชิ้น').trim();
    if (!name) return;

    window.pantryItems.unshift({ id: 'pt_' + Date.now(), name, qty, unit, lowAlert: 2 });
    saveAddonsAndSync();
    renderPantryCard();
}

function adjustPantryQty(idx, delta) {
    if (!window.pantryItems[idx]) return;
    window.pantryItems[idx].qty = Math.max(0, fmtPrecise(window.pantryItems[idx].qty + delta, 2));
    saveAddonsAndSync();
    renderPantryCard();
}

function deletePantryItem(idx) {
    window.pantryItems.splice(idx, 1);
    saveAddonsAndSync();
    renderPantryCard();
}

function renderPantryCard() {
    const card = document.getElementById('addon-pantry-card');
    if (!card) return;

    const lowCount = window.pantryItems.filter(p => p.qty <= (p.lowAlert || 2)).length;

    card.innerHTML = `
        <div class="flex items-center justify-between">
            <div>
                <h3 class="text-sm font-bold text-white flex items-center gap-1.5">
                    <i class="fa-solid fa-snowflake text-sky-400"></i> ตู้เย็น & คลังเสบียงส่วนตัว
                </h3>
                <span class="text-[10px] text-slate-400">ตัดสต็อกอัตโนมัติเมื่อบันทึกชื่ออาหารที่ตรงกัน</span>
            </div>
            ${lowCount > 0 ? `<span class="text-[10px] bg-rose-950 text-rose-300 border border-rose-700/50 px-2.5 py-0.5 rounded-full font-bold">ใกล้หมด ${lowCount} อย่าง</span>` : ''}
        </div>

        <div class="space-y-1.5">
            ${window.pantryItems.map((p, idx) => {
                const isLow = p.qty <= (p.lowAlert || 2);
                return `
                    <div class="flex items-center justify-between gap-2 bg-slate-950/90 px-3 py-2 rounded-xl border ${isLow ? 'border-rose-500/50' : 'border-slate-800'} text-xs">
                        <div class="min-w-0">
                            <div class="font-semibold text-white truncate">${p.name}</div>
                            <div class="text-[10px] ${isLow ? 'text-rose-400 font-bold' : 'text-slate-400'}">
                                เหลือ: ${p.qty} ${p.unit} ${isLow ? '⚠️ ควรซื้อเติม' : ''}
                            </div>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <button type="button" onclick="adjustPantryQty(${idx}, -1)" class="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold">-1</button>
                            <button type="button" onclick="adjustPantryQty(${idx}, 1)" class="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold">+1</button>
                            <button type="button" onclick="deletePantryItem(${idx})" class="w-6 h-6 rounded-lg bg-slate-900 text-rose-400 ml-1"><i class="fa-solid fa-trash text-[10px]"></i></button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>

        <div class="flex gap-1.5 pt-1 text-xs">
            <input type="text" id="pantry-new-name" placeholder="+ เพิ่มเสบียง (เช่น อกไก่, ไข่ต้ม)"
                class="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white placeholder-slate-500" />
            <input type="number" id="pantry-new-qty" value="5" class="w-14 bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-white text-center font-bold" />
            <input type="text" id="pantry-new-unit" value="ชิ้น" class="w-14 bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-slate-300 text-center" />
            <button type="button" onclick="addPantryItem()" class="bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 py-1.5 rounded-xl">เพิ่ม</button>
        </div>
    `;
}

// ------------------------------------------
// 5. เทียบความคุ้มค่าโปรตีน (Protein Value Scanner)
// ------------------------------------------
function calcProteinValue() {
    const name = (document.getElementById('pvs-name')?.value || '').trim() || 'สินค้านี้';
    const price = parseFloat(document.getElementById('pvs-price')?.value);
    const prot = parseFloat(document.getElementById('pvs-prot')?.value);
    const cal = parseFloat(document.getElementById('pvs-cal')?.value);
    const box = document.getElementById('pvs-result-box');
    if (!box) return;

    if (!price || !prot || price <= 0 || prot <= 0) {
        box.innerHTML = `<span class="text-slate-400">กรอกราคาและปริมาณโปรตีนเพื่อคำนวณความคุ้มค่าทันที</span>`;
        return;
    }

    const bahtPerGram = fmtPrecise(price / prot, 2);
    const protCalPct = (!isNaN(cal) && cal > 0) ? Math.round(((prot * 4) / cal) * 100) : null;

    let gradeBadge = `<span class="bg-amber-950 text-amber-300 border border-amber-700/50 px-2 py-0.5 rounded-full text-[10px] font-bold">คุ้มค่าปานกลาง</span>`;
    if (bahtPerGram <= 1.6) gradeBadge = `<span class="bg-emerald-950 text-emerald-300 border border-emerald-700/50 px-2 py-0.5 rounded-full text-[10px] font-bold">🔥 โคตรคุ้มค่า!</span>`;
    else if (bahtPerGram > 2.6) gradeBadge = `<span class="bg-rose-950 text-rose-300 border border-rose-700/50 px-2 py-0.5 rounded-full text-[10px] font-bold">ราคาค่อนข้างสูง</span>`;

    box.innerHTML = `
        <div class="space-y-2 text-left">
            <div class="flex justify-between items-center">
                <span class="text-slate-300">ต้นทุนโปรตีน: <b class="text-lg text-amber-300">${bahtPerGram} บาท</b> / โปรตีน 1g</span>
                ${gradeBadge}
            </div>
            ${protCalPct !== null ? `<div class="text-[11px] text-slate-300">ความคลีน: ได้พลังงานจากโปรตีน <b class="text-emerald-400">${protCalPct}%</b> ของแคลอรีทั้งหมด</div>` : ''}
            <button type="button" onclick="saveCurrentProteinDeal('${name.replace(/'/g, "\\'")}', ${price}, ${prot}, ${bahtPerGram}, ${protCalPct || 0})"
                class="w-full bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 text-[11px] font-bold py-1.5 rounded-xl">
                + บันทึกเก็บไว้เปรียบเทียบ
            </button>
        </div>
    `;
}

function saveCurrentProteinDeal(name, price, prot, bahtPerGram, protCalPct) {
    savedProteinDeals.unshift({ name, price, prot, bahtPerGram, protCalPct });
    savedProteinDeals.sort((a, b) => a.bahtPerGram - b.bahtPerGram);
    saveAddonsAndSync();
    renderSavedProteinDeals();
}

function deleteProteinDeal(idx) {
    savedProteinDeals.splice(idx, 1);
    saveAddonsAndSync();
    renderSavedProteinDeals();
}

function renderSavedProteinDeals() {
    const listEl = document.getElementById('pvs-saved-list');
    if (!listEl) return;
    if (savedProteinDeals.length === 0) { listEl.innerHTML = ''; return; }

    listEl.innerHTML = `
        <div class="text-[11px] font-bold text-slate-300 pt-1">อันดับความคุ้มค่าที่บันทึกไว้ (เรียงจากถูกสุด):</div>
        ${savedProteinDeals.map((d, i) => `
            <div class="flex justify-between items-center bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 text-xs">
                <div>
                    <span class="text-amber-400 font-bold mr-1">#${i + 1}</span>
                    <span class="text-white font-medium">${d.name}</span>
                    <span class="text-[10px] text-slate-400 block">${d.price} บ. • โปรตีน ${d.prot}g ${d.protCalPct ? `• คลีน ${d.protCalPct}%` : ''}</span>
                </div>
                <div class="flex items-center gap-2">
                    <b class="text-emerald-400">${d.bahtPerGram} บ./g</b>
                    <button type="button" onclick="deleteProteinDeal(${i})" class="text-slate-500 hover:text-rose-400"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
        `).join('')}
    `;
}

// ------------------------------------------
// 6. Hook เชื่อมระบบอัตโนมัติ (ตัดสต็อกตู้เย็น & โหมดทริป)
// ------------------------------------------
// 6.1 ตัดสต็อกในตู้เย็นอัตโนมัติเมื่อบันทึกอาหาร
if (typeof handleFoodSubmit === 'function') {
    const _origHandleFoodSubmit = handleFoodSubmit;
    handleFoodSubmit = async function(e) {
        const rawName = (document.getElementById('food-name')?.value || '').trim().toLowerCase();
        const qtyNum = Math.max(0.01, parseFloat(document.getElementById('food-qty')?.value) || 1);
        const isNewItem = (document.getElementById('edit-item-index')?.value === '');

        await _origHandleFoodSubmit(e);

        if (isNewItem && rawName && Array.isArray(window.pantryItems)) {
            const matchIdx = window.pantryItems.findIndex(p => rawName.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(rawName));
            if (matchIdx > -1) {
                window.pantryItems[matchIdx].qty = Math.max(0, fmtPrecise(window.pantryItems[matchIdx].qty - qtyNum, 2));
                localStorage.setItem('fitTracker_pantry', JSON.stringify(window.pantryItems));
            }
        }
    };
}

// 6.2 ปลดล็อกเพดานคาร์บและโซเดียมอัตโนมัติเมื่อเปิดโหมดทริปปีนเขา/เที่ยวทะเล
if (typeof getNutrientAdjustments === 'function') {
    const _origGetNutrientAdj = getNutrientAdjustments;
    getNutrientAdjustments = function(dateKey) {
        const res = _origGetNutrientAdj(dateKey);
        const dayObj = allMealsHistory[dateKey];
        if (dayObj?.outdoorMode?.active) {
            if (res.carbs) res.carbs.adjustedMax = fmtPrecise(res.carbs.adjustedMax + 100, 2);
            if (res.sodium) res.sodium.adjustedMax = fmtPrecise(res.sodium.adjustedMax + 1000, 1);
        }
        return res;
    };
}
