// ==========================================================================
// finance.js — โมดูลบันทึกรายรับ-รายจ่าย, งบประมาณ & สรุปรายเดือน
// ==========================================================================

let currentFinEntryType = 'expense';

const FIN_CAT_META = {
    food:      { icon: '🍱', label: 'อาหาร & เครื่องดื่ม', color: 'bg-emerald-400', text: 'text-emerald-300' },
    transport: { icon: '⛽', label: 'เดินทาง & น้ำมัน', color: 'bg-sky-400', text: 'text-sky-300' },
    skincare:  { icon: '✨', label: 'สกินแคร์ & ของใช้', color: 'bg-pink-400', text: 'text-pink-300' },
    fitness:   { icon: '🏋️', label: 'ฟิตเนส & อาหารเสริม', color: 'bg-indigo-400', text: 'text-indigo-300' },
    trip:      { icon: '🏖️', label: 'เที่ยว & ช้อปปิ้ง', color: 'bg-purple-400', text: 'text-purple-300' },
    income:    { icon: '💵', label: 'เงินเดือน / รายรับ', color: 'bg-emerald-500', text: 'text-emerald-400' },
    other:     { icon: '📦', label: 'อื่นๆ', color: 'bg-amber-400', text: 'text-amber-300' }
};

function renderFinancePage() {
    const dayData = getDayData(currentDateKey);
    if (!Array.isArray(dayData.finances)) dayData.finances = [];

    const dailyBudget = Number(userGoals.dailyBudget) || 500;
    const budgetLabel = document.getElementById('fin-daily-budget-label');
    if (budgetLabel) budgetLabel.innerText = dailyBudget.toLocaleString();

    // คำนวณยอดวันนี้ & ยอดทั้งเดือน
    const monthPrefix = currentDateKey.slice(0, 7); // YYYY-MM
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

    // หลอดงบประมาณรายวัน
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

    // รายการวันนี้
    const listEl = document.getElementById('fin-today-list');
    document.getElementById('fin-today-count').innerText = `${dayData.finances.length} รายการ`;

    if (dayData.finances.length === 0) {
        listEl.innerHTML = `<div class="text-xs text-slate-500 text-center py-3">ยังไม่มีรายการรายรับ-รายจ่ายในวันนี้</div>`;
    } else {
        listEl.innerHTML = dayData.finances.map((item, idx) => {
            const meta = FIN_CAT_META[item.category] || FIN_CAT_META.other;
            const isInc = item.type === 'income';
            return `
                <div class="flex items-center justify-between gap-2 bg-slate-950/90 px-3 py-2.5 rounded-2xl border border-slate-800 text-xs">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <span class="text-base shrink-0">${meta.icon}</span>
                        <div class="min-w-0">
                            <div class="font-semibold text-white truncate">${item.title}</div>
                            <div class="text-[10px] ${meta.text}">${meta.label}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2.5 shrink-0">
                        <b class="${isInc ? 'text-emerald-400' : 'text-rose-400'}">${isInc ? '+' : '-'}${fmtPrecise(item.amount, 2).toLocaleString()} บ.</b>
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
    saveDataAndSync();
}

function deleteFinanceItem(idx) {
    if (!confirm('ลบรายการบัญชีนี้ใช่ไหม?')) return;
    getDayData(currentDateKey).finances.splice(idx, 1);
    saveDataAndSync();
}
