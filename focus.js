// ==========================================================================
// focus.js — โมดูลจับเวลาโฟกัส (Pomodoro), To-Do List & จดบันทึกด่วน
// ==========================================================================

let focusPresetMin = 25;
let focusModeType = 'focus'; // 'focus' | 'break'
let focusSecondsLeft = 25 * 60;
let focusTimerInterval = null;
let isFocusRunning = false;

function playFocusFinishBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(784, ctx.currentTime);
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
    } catch (e) {}
}

function renderFocusPage() {
    const dayData = getDayData(currentDateKey);
    if (!Array.isArray(dayData.todos)) dayData.todos = [];
    if (dayData.focusMinutes === undefined) dayData.focusMinutes = 0;

    // อัปเดตเวลาสะสม & นาฬิกา
    const minEl = document.getElementById('focus-today-minutes');
    if (minEl) minEl.innerText = `${dayData.focusMinutes} นาที`;
    updateFocusClockUI();

    // อัปเดตปุ่มโหมดเวลา
    [25, 45, 5].forEach(m => {
        const btn = document.getElementById(`focus-mode-${m}`);
        if (!btn) return;
        btn.className = (focusPresetMin === m)
            ? 'px-2 py-1 rounded-lg bg-indigo-600 text-white font-bold'
            : 'px-2 py-1 rounded-lg text-slate-400';
    });

    // อัปเดต To-Do List
    const todos = dayData.todos;
    const doneCount = todos.filter(t => t.done).length;
    const badgeEl = document.getElementById('focus-todo-badge');
    if (badgeEl) badgeEl.innerText = `${doneCount}/${todos.length} งาน`;

    const listEl = document.getElementById('focus-todo-list');
    if (listEl) {
        if (todos.length === 0) {
            listEl.innerHTML = `<div class="text-xs text-slate-500 text-center py-2">ยังไม่มีรายการงานวันนี้</div>`;
        } else {
            listEl.innerHTML = todos.map((t, idx) => `
                <div class="flex items-center justify-between gap-2 bg-slate-950/90 px-3 py-2 rounded-xl border ${t.done ? 'border-emerald-700/40 opacity-70' : 'border-slate-800'}">
                    <label class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                        <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleFocusTodo(${idx})" class="w-4 h-4 accent-emerald-500 rounded shrink-0">
                        <span class="text-xs leading-snug ${t.done ? 'line-through text-slate-500' : 'text-slate-100 font-medium'}">${t.text}</span>
                    </label>
                    <button type="button" onclick="deleteFocusTodo(${idx})" class="text-slate-500 hover:text-rose-400 p-1 shrink-0">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>
            `).join('');
        }
    }

    // อัปเดตสมุดโน้ตประจำวัน
    const noteEl = document.getElementById('focus-daily-note');
    if (noteEl && document.activeElement !== noteEl) {
        noteEl.value = dayData.dailyNote || '';
    }
}

function updateFocusClockUI() {
    const clockEl = document.getElementById('focus-clock-display');
    const toggleBtn = document.getElementById('focus-toggle-btn');
    const statusEl = document.getElementById('focus-status-label');

    if (clockEl) {
        const mm = String(Math.floor(focusSecondsLeft / 60)).padStart(2, '0');
        const ss = String(focusSecondsLeft % 60).padStart(2, '0');
        clockEl.innerText = `${mm}:${ss}`;
    }

    if (statusEl) {
        if (focusModeType === 'break') {
            statusEl.innerText = isFocusRunning ? '☕ กำลังพักสายตา...' : '☕ โหมดพักเบรก 5 นาที';
            statusEl.className = 'text-[11px] font-semibold text-emerald-300';
        } else {
            statusEl.innerText = isFocusRunning ? '🔥 กำลังโฟกัส ห้ามหลุดสมาธิ!' : '🎯 พร้อมลุยงาน / อ่านหนังสือ';
            statusEl.className = 'text-[11px] font-semibold text-indigo-300';
        }
    }

    if (toggleBtn) {
        if (isFocusRunning) {
            toggleBtn.innerHTML = `<i class="fa-solid fa-pause"></i> หยุดชั่วคราว`;
            toggleBtn.className = 'col-span-8 bg-amber-600 hover:bg-amber-500 text-white font-extrabold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5';
        } else {
            toggleBtn.innerHTML = `<i class="fa-solid fa-play"></i> เริ่มจับเวลา`;
            toggleBtn.className = 'col-span-8 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5';
        }
    }
}

function setFocusPreset(minutes, type) {
    clearInterval(focusTimerInterval);
    isFocusRunning = false;
    focusPresetMin = minutes;
    focusModeType = type;
    focusSecondsLeft = minutes * 60;
    renderFocusPage();
}

function toggleFocusTimer() {
    if (isFocusRunning) {
        clearInterval(focusTimerInterval);
        isFocusRunning = false;
        updateFocusClockUI();
        return;
    }

    isFocusRunning = true;
    updateFocusClockUI();

    focusTimerInterval = setInterval(() => {
        focusSecondsLeft--;
        updateFocusClockUI();

        if (focusSecondsLeft <= 0) {
            clearInterval(focusTimerInterval);
            isFocusRunning = false;
            playFocusFinishBeep();
            if (navigator.vibrate) navigator.vibrate([300, 150, 300]);

            if (focusModeType === 'focus') {
                const dayData = getDayData(currentDateKey);
                dayData.focusMinutes = (Number(dayData.focusMinutes) || 0) + focusPresetMin;
                saveDataAndSync();
                alert(`🎉 ยอดเยี่ยม! โฟกัสครบ ${focusPresetMin} นาทีแล้ว`);
            } else {
                alert('⏰ หมดเวลาพักเบรกแล้ว กลับมาลุยต่อกันครับ!');
            }
            focusSecondsLeft = focusPresetMin * 60;
            renderFocusPage();
        }
    }, 1000);
}

function resetFocusTimer() {
    clearInterval(focusTimerInterval);
    isFocusRunning = false;
    focusSecondsLeft = focusPresetMin * 60;
    updateFocusClockUI();
}

function handleAddFocusTodo(e) {
    e.preventDefault();
    const input = document.getElementById('focus-todo-input');
    const text = (input.value || '').trim();
    if (!text) return;

    const dayData = getDayData(currentDateKey);
    if (!Array.isArray(dayData.todos)) dayData.todos = [];
    dayData.todos.unshift({ text, done: false });
    input.value = '';
    saveDataAndSync();
}

function toggleFocusTodo(idx) {
    const todos = getDayData(currentDateKey).todos || [];
    if (todos[idx]) todos[idx].done = !todos[idx].done;
    saveDataAndSync();
}

function deleteFocusTodo(idx) {
    getDayData(currentDateKey).todos.splice(idx, 1);
    saveDataAndSync();
}

function saveFocusDailyNote(val) {
    getDayData(currentDateKey).dailyNote = val;
    const badge = document.getElementById('focus-note-saved-badge');
    if (badge) badge.innerText = 'ซิงก์แล้ว ✓';
    saveDataAndSync();
}
