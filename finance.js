// ==========================================================================
// finance.js — โมดูลบันทึกรายรับ-รายจ่าย, ปุ่มลัดซื้อประจำ & Autocomplete
// ==========================================================================

let currentFinEntryType = 'expense';
let isFinPresetEditMode = false;

const FIN_CAT_META = {
    food:      { icon: '🍱', label: 'อาหาร & เครื่องดื่ม', color: 'bg-emerald-400', text: 'text-emerald-300' },
    transport: { icon: '⛽', label: 'เดินทาง & น้ำมัน', color: 'bg-sky-400', text: 'text-sky-300' },
    skincare:  { icon: '✨', label: 'สกินแคร์ & ของใช้', color: 'bg-pink-400', text: 'text-pink-300' },
    fitness:   { icon: '🏋️', label: 'ฟิตเนส & อาหารเสริม', color: 'bg-indigo-400', text: 'text-indigo-300' },
    trip:      { icon: '🏖️', label: 'เที่ยว & ช้อปปิ้ง', color: 'bg-purple-400', text: 'text-purple-300' },
    income:    { icon: '💵', label: 'เงินเดือน / รายรับ', color: 'bg-emerald-500', text: 'text-emerald-400' },
    other:     { icon: '📦', label: 'อื่นๆ', color: 'bg-amber-400', text: 'text-amber-300' }
};

const DEFAULT_FIN_PRESETS = [
    { title: 'อกไก่ 7-11', amount: 40, category: 'food' },
    { title: 'โทฟุซังโปรตีนสูง', amount: 45, category: 'food' },
    { title: 'ไข่ต้ม 2 ฟอง', amount: 20, category: 'food' },
    { title: 'กาแฟดำ', amount: 55, category: 'food' },
    { title: 'เติมน้ำมันรถ', amount: 500, category: 'transport' }
];

function getFinancePresets() {
    if (!Array.isArray(userGoals.financePresets) || userGoals.financePresets.length === 0) {
        userGoals.financePresets = JSON.parse(JSON.stringify(DEFAULT_FIN_PRESETS));
    }
    return userGoals.financePresets;
}

// ดึงประวัติรายการทั้งหมดที่เคยบันทึก (เรียงตามความถี่ที่ใช้บ่อยสุด)
function getFrequentFinanceHistory() {
    const map = {};
    const sortedDates = Object.keys(allMealsHistory).sort(); // เรียงเก่าไปใหม่ เพื่อให้ได้ราคาล่าสุด

    sortedDates.forEach(dateKey => {
        const list = allMealsHistory[dateKey]?.finances || [];
        list.forEach(item => {
            const cleanTitle = (item.title || '').trim();
            if (!cleanTitle) return;
            const key = `${item.type || 'expense'}::${cleanTitle.toLowerCase()}`;
            if (!map[key]) {
                map[key] = {
                    title: cleanTitle,
                    amount: Number(item.amount || 0),
                    category: item.category || 'food',
                    type: item.type || 'expense',
                    count: 0
                };
            }
            map[key].amount = Number(item.amount || 0); // อัปเดตเป็นราคาล่าสุดเสมอ
            map[key].category = item.category || map[key].category;
            map[key].count++;
        });
    });

    return Object.values(map).sort((a, b) => b.count - a.count);
}

function renderFinancePage() {
    const dayData = getDayData(currentDateKey);
    if (!Array.isArray(dayData.finances)) dayData.finances = [];

    renderFinancePresetsBar();

    const dailyBudget = Number(userGoals.dailyBudget) || 500;
    const budgetLabel = document.getElementById('fin-daily-budget-label');
    if (budgetLabel) budgetLabel.innerText = dailyBudget.toLocaleString();

    const monthPrefix = currentDateKey.slice(0, 7);
    let todayExp = 0, monthExp = 0, monthInc = 0;
    const catTotals = {};

    dayData.finances.forEach(item => {
        if (item.type === 'expense') todayExp += Number(item.amount || 0);
    });

    Object.keys(allMealsHistory).forEach(key => {
        if (!key.startsWith(monthPrefix)) return;
        const list = allMealsHistory[key]?.finances || [];
        list.forEach(item => {
            const amt = Number(item.amount || 0);
            if (item.type === 'income') {
                monthInc += amt;
            } else {
                monthExp += amt;
                const cat = item.category || 'other';
                catTotals[cat] = (catTotals[cat] || 0) + amt;
            }
        });
    });

    const netBalance = fmtPrecise(monthInc - monthExp, 2);
    const balEl = document.getElementById('fin-month-balance');
    if (balEl) {
        balEl.innerHTML = `<span class="${netBalance < 0 ? 'text-rose-400' : 'text-white'}">${netBalance.toLocaleString()}</span> <span class="text-xs font-normal text-slate-400">บาท</span>`;
    }

    document.getElementById('fin-today-expense').innerText = `${fmtPrecise(todayExp, 0).toLocaleString()} บ.`;
    document.getElementById('fin-month-expense').innerText = `${fmtPrecise(monthExp, 0).toLocaleString()} บ.`;
    document.getElementById('fin-month-income').innerText = `${fmtPrecise(monthInc, 0).toLocaleString()} บ.`;

    const pct = Math.round((todayExp / Math.max(1, dailyBudget)) * 100);
    const rem = fmtPrecise(dailyBudget - todayExp, 0);
    document.getElementById('fin-daily-pct').innerText = `${pct}%`;

    const remLabel = document.getElementById('fin-daily-rem-label');
    const progBar = document.getElementById('fin-daily-progress');
    if (rem < 0) {
        remLabel.innerText = `เกินงบ ${Math.abs(rem).toLocaleString()} บ.`;
        remLabel.className = 'text-rose-400 font-bold';
        progBar.className = 'bg-rose-500 h-full rounded-full transition-all duration-500';
    } else {
        remLabel.innerText = `เหลือ ${rem.toLocaleString()} บ.`;
        remLabel.className = 'text-emerald-400 font-semibold';
        progBar.className = pct >= 80 ? 'bg-amber-400 h-full rounded-full transition-all duration-500' : 'bg-emerald-400 h-full rounded-full transition-all duration-500';
    }
    progBar.style.width = `${Math.min(100, pct)}%`;

    // รายการวันนี้ (พร้อมปุ่มกดซื้อซ้ำ +1)
    const listEl = document.getElementById('fin-today-list');
    document.getElementById('fin-today-count').innerText = `${dayData.finances.length} รายการ`;

    if (dayData.finances.length === 0) {
        listEl.innerHTML = `<div class="text-xs text-slate-500 text-center py-3">ยังไม่มีรายการรายรับ-รายจ่ายในวันนี้</div>`;
    } else {
        listEl.innerHTML = dayData.finances.map((item, idx) => {
            const meta = FIN_CAT_META[item.category] || FIN_CAT_META.other;
            const isInc = item.type === 'income';
            const safeTitle = (item.title || '').replace(/'/g, "\\'");
            return `
                <div class="flex items-center justify-between gap-2 bg-slate-950/90 px-3 py-2.5 rounded-2xl border border-slate-800 text-xs">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <span class="text-base shrink-0">${meta.icon}</span>
                        <div class="min-w-0">
                            <div class="font-semibold text-white truncate">${item.title}</div>
                            <div class="text-[10px] ${meta.text}">${meta.label}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <b class="${isInc ? 'text-emerald-400' : 'text-rose-400'}">${isInc ? '+' : '-'}${fmtPrecise(item.amount, 2).toLocaleString()} บ.</b>
                        <button type="button" onclick="repeatFinanceItem('${safeTitle}', ${Number(item.amount)}, '${item.category}', '${item.type}')" title="บันทึกซ้ำอีกครั้ง" class="text-[10px] bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white px-2 py-1 rounded-lg transition">
                            +ซ้ำ
                        </button>
                        <button type="button" onclick="deleteFinanceItem(${idx})" class="text-slate-500 hover:text-rose-400 p-1"><i class="fa-solid fa-trash text-xs"></i></button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // กราฟสัดส่วนรายจ่ายทั้งเดือน
    const breakdownEl = document.getElementById('fin-month-breakdown');
    const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    if (sortedCats.length === 0) {
        breakdownEl.innerHTML = `<div class="text-xs text-slate-500 text-center py-2">ยังไม่มีข้อมูลรายจ่ายในเดือนนี้</div>`;
    } else {
        breakdownEl.innerHTML = sortedCats.map(([catKey, val]) => {
            const meta = FIN_CAT_META[catKey] || FIN_CAT_META.other;
            const sharePct = Math.round((val / Math.max(1, monthExp)) * 100);
            return `
                <div class="space-y-1">
                    <div class="flex justify-between text-[11px]">
                        <span class="text-slate-200">${meta.icon} ${meta.label}</span>
                        <span class="text-slate-300 font-semibold">${fmtPrecise(val, 0).toLocaleString()} บ. (${sharePct}%)</span>
                    </div>
                    <div class="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div class="${meta.color} h-full rounded-full" style="width: ${sharePct}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// ------------------------------------------
// แถบปุ่มเมนูลัดซื้อประจำ (เพิ่ม / ลบ / กดใช้งานได้)
// ------------------------------------------
function renderFinancePresetsBar() {
    const bar = document.getElementById('fin-quick-presets-bar');
    if (!bar) return;

    const presets = getFinancePresets();
    const editBtn = document.getElementById('fin-preset-edit-btn');
    if (editBtn) {
        editBtn.innerHTML = isFinPresetEditMode
            ? '<i class="fa-solid fa-check mr-0.5"></i> เสร็จสิ้น'
            : '<i class="fa-solid fa-sliders mr-0.5"></i> จัดการปุ่ม';
    }

    let html = presets.map((p, idx) => {
        const meta = FIN_CAT_META[p.category] || FIN_CAT_META.food;
        const safeTitle = (p.title || '').replace(/'/g, "\\'");
        if (isFinPresetEditMode) {
            return `
                <div class="shrink-0 flex items-center gap-1 bg-rose-950/60 border border-rose-500/40 rounded-xl px-2.5 py-1.5 text-[11px] text-rose-200">
                    <span>${meta.icon} ${p.title} (${p.amount} บ.)</span>
                    <button type="button" onclick="deleteFinancePreset(${idx})" class="ml-1 text-rose-400 hover:text-white font-bold px-1">×</button>
                </div>
            `;
        }
        return `
            <button type="button" onclick="quickAddFinance('${safeTitle}', ${Number(p.amount)}, '${p.category}')"
                class="shrink-0 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 rounded-xl px-2.5 py-1.5 text-[11px] text-slate-200 transition">
                + ${meta.icon} ${p.title} <span class="text-amber-300 font-semibold">${p.amount} บ.</span>
            </button>
        `;
    }).join('');

    html += `
        <button type="button" onclick="promptAddFinancePreset()"
            class="shrink-0 bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/40 rounded-xl px-2.5 py-1.5 text-[11px] text-indigo-300 font-semibold transition">
            <i class="fa-solid fa-plus mr-0.5"></i> เพิ่มเมนูลัด
        </button>
    `;

    bar.innerHTML = html;
}

function toggleFinPresetEditMode() {
    isFinPresetEditMode = !isFinPresetEditMode;
    renderFinancePresetsBar();
}

function promptAddFinancePreset() {
    const title = prompt('ชื่อรายการที่ซื้อประจำ (เช่น อกไก่ 7-11):');
    if (!title || !title.trim()) return;
    const amount = parseFloat(prompt(`ราคาของ "${title.trim()}" (บาท):`, '40'));
    if (isNaN(amount) || amount <= 0) return;

    const category = document.getElementById('fin-category')?.value || 'food';
    const presets = getFinancePresets();
    presets.push({ title: title.trim(), amount: fmtPrecise(amount, 2), category });
    saveDataAndSync();
}

function saveCurrentFormAsPreset() {
    const title = (document.getElementById('fin-title').value || '').trim();
    const amount = parseFloat(document.getElementById('fin-amount').value);
    const category = document.getElementById('fin-category').value || 'food';

    if (!title || isNaN(amount) || amount <= 0) {
        return promptAddFinancePreset();
    }

    const presets = getFinancePresets();
    const exists = presets.some(p => p.title.toLowerCase() === title.toLowerCase() && Number(p.amount) === amount);
    if (!exists) {
        presets.push({ title, amount: fmtPrecise(amount, 2), category });
        saveDataAndSync();
        alert(`เพิ่ม "${title} (${amount} บ.)" เป็นปุ่มเมนูลัดเรียบร้อยครับ`);
    } else {
        alert('มีเมนูนี้อยู่ในปุ่มลัดแล้วครับ');
    }
}

function deleteFinancePreset(idx) {
    const presets = getFinancePresets();
    presets.splice(idx, 1);
    saveDataAndSync();
}

// ------------------------------------------
// ระบบค้นหาและดึงราคาอัตโนมัติจากประวัติ (Autocomplete)
// ------------------------------------------
function onFinanceTitleInput(keyword) {
    const box = document.getElementById('fin-autocomplete-list');
    if (!box) return;

    const q = (keyword || '').trim().toLowerCase();
    const historyItems = getFrequentFinanceHistory();
    const filtered = q
        ? historyItems.filter(item => item.title.toLowerCase().includes(q)).slice(0, 6)
        : historyItems.slice(0, 5);

    if (filtered.length === 0) {
        box.classList.add('hidden');
        return;
    }

    box.innerHTML = filtered.map(item => {
        const meta = FIN_CAT_META[item.category] || FIN_CAT_META.other;
        const safeTitle = item.title.replace(/'/g, "\\'");
        return `
            <button type="button" onclick="selectFinanceAutocomplete('${safeTitle}', ${item.amount}, '${item.category}', '${item.type}')"
                class="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center justify-between gap-2 text-xs transition">
                <div class="truncate">
                    <span class="mr-1">${meta.icon}</span>
                    <span class="text-white font-medium">${item.title}</span>
                    <span class="text-[10px] text-slate-500 ml-1">(${item.count} ครั้ง)</span>
                </div>
                <span class="font-bold ${item.type === 'income' ? 'text-emerald-400' : 'text-amber-300'} shrink-0">${item.amount} บ.</span>
            </button>
        `;
    }).join('');
    box.classList.remove('hidden');
}

function selectFinanceAutocomplete(title, amount, category, type) {
    setFinanceEntryType(type || 'expense');
    document.getElementById('fin-title').value = title;
    document.getElementById('fin-amount').value = amount;
    const catSel = document.getElementById('fin-category');
    if (catSel && FIN_CAT_META[category]) catSel.value = category;

    const box = document.getElementById('fin-autocomplete-list');
    if (box) box.classList.add('hidden');
}

// ปิดกล่องแนะนำเมื่อคลิกพื้นที่อื่น
document.addEventListener('click', (e) => {
    const box = document.getElementById('fin-autocomplete-list');
    const input = document.getElementById('fin-title');
    if (box && input && !box.contains(e.target) && e.target !== input) {
        box.classList.add('hidden');
    }
});

// ------------------------------------------
// ฟังก์ชันจัดการรายการบัญชี
// ------------------------------------------
function setFinanceEntryType(type) {
    currentFinEntryType = type;
    const expBtn = document.getElementById('fin-type-expense');
    const incBtn = document.getElementById('fin-type-income');
    const catSel = document.getElementById('fin-category');

    if (type === 'income') {
        incBtn.className = 'px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold';
        expBtn.className = 'px-2.5 py-1 rounded-lg text-slate-400';
        if (catSel) catSel.value = 'income';
    } else {
        expBtn.className = 'px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold';
        incBtn.className = 'px-2.5 py-1 rounded-lg text-slate-400';
        if (catSel && catSel.value === 'income') catSel.value = 'food';
    }
}

function editDailyExpenseBudget() {
    const cur = Number(userGoals.dailyBudget) || 500;
    const val = prompt('กำหนดเพดานงบรายจ่ายต่อวัน (บาท):', cur);
    if (val === null) return;
    userGoals.dailyBudget = Math.max(50, Number(val) || cur);
    saveDataAndSync();
}

function quickAddFinance(title, amount, category) {
    const dayData = getDayData(currentDateKey);
    if (!Array.isArray(dayData.finances)) dayData.finances = [];
    dayData.finances.unshift({ type: 'expense', category, title, amount: Number(amount) });
    saveDataAndSync();
}

function repeatFinanceItem(title, amount, category, type) {
    const dayData = getDayData(currentDateKey);
    if (!Array.isArray(dayData.finances)) dayData.finances = [];
    dayData.finances.unshift({
        type: type || 'expense',
        category: category || 'food',
        title,
        amount: fmtPrecise(amount, 2)
    });
    saveDataAndSync();
}

function handleFinanceSubmit(e) {
    e.preventDefault();
    const title = (document.getElementById('fin-title').value || '').trim();
    const amount = parseFloat(document.getElementById('fin-amount').value);
    const category = document.getElementById('fin-category').value;
    if (!title || isNaN(amount) || amount <= 0) return;

    const dayData = getDayData(currentDateKey);
    if (!Array.isArray(dayData.finances)) dayData.finances = [];
    dayData.finances.unshift({
        type: currentFinEntryType,
        category,
        title,
        amount: fmtPrecise(amount, 2)
    });

    document.getElementById('fin-title').value = '';
    document.getElementById('fin-amount').value = '';
    const box = document.getElementById('fin-autocomplete-list');
    if (box) box.classList.add('hidden');
    saveDataAndSync();
}

function deleteFinanceItem(idx) {
    if (!confirm('ลบรายการบัญชีนี้ใช่ไหม?')) return;
    getDayData(currentDateKey).finances.splice(idx, 1);
    saveDataAndSync();
}

// ------------------------------------------
// สแกนสลิปโอนเงิน / ใบเสร็จด้วย AI (Gemini Vision)
// ------------------------------------------
async function scanReceiptWithAI(inputEl) {
    const file = inputEl?.files?.[0];
    if (!file) return;

    const statusEl = document.getElementById('fin-receipt-status');
    const apiKey = (localStorage.getItem('fitTracker_gemini_key') || '').trim();
    if (!apiKey) {
        alert('กรุณาใส่ Gemini API Key ในปุ่มตั้งค่า (⚙️) ก่อนใช้งานสแกนสลิปครับ');
        return;
    }

    if (statusEl) {
        statusEl.classList.remove('hidden');
        statusEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> AI กำลังอ่านยอดเงินและชื่อร้านจากสลิป...`;
    }

    try {
        const base64 = await resizeImageToBase64(file, 800);
        const modelName = (typeof resolveWorkingGeminiModel === 'function')
            ? await resolveWorkingGeminiModel(apiKey)
            : 'gemini-2.5-flash';

        const prompt = `อ่านสลิปโอนเงินหรือใบเสร็จในรูปนี้ แล้วตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น:
{"title":"ชื่อร้านค้าหรือรายการสั้นๆ","amount":ตัวเลขยอดเงินสุทธิ,"category":"เลือก 1 ค่าจาก food, transport, skincare, fitness, trip, income, other","type":"expense หรือ income"}`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: base64 } }] }],
                generationConfig: { response_mime_type: 'application/json' }
            })
        });

        const rawText = await res.text();
        const data = JSON.parse(rawText);
        if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);

        const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const match = aiText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('ไม่สามารถอ่านข้อมูลจากสลิปได้');

        const parsed = JSON.parse(match[0]);
        setFinanceEntryType(parsed.type === 'income' ? 'income' : 'expense');
        if (parsed.title) document.getElementById('fin-title').value = parsed.title;
        if (parsed.amount) document.getElementById('fin-amount').value = parsed.amount;
        if (parsed.category && FIN_CAT_META[parsed.category]) {
            document.getElementById('fin-category').value = parsed.category;
        }

        if (statusEl) {
            statusEl.innerHTML = `✅ อ่านสลิปสำเร็จ! ตรวจสอบความถูกต้องแล้วกดปุ่ม <b>"บันทึก"</b> ได้เลยครับ`;
        }
    } catch (err) {
        if (statusEl) {
            statusEl.innerHTML = `<span class="text-rose-400">⚠️ สแกนไม่สำเร็จ: ${err.message}</span>`;
        }
    } finally {
        inputEl.value = '';
    }
}
