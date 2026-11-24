// ==========================================================================
// car.js — โมดูลดูแลรถ, ระยะซ่อมบำรุง & บันทึกเติมน้ำมัน (km/L)
// ==========================================================================

const DEFAULT_CAR_DATA = {
    odometer: 50000,
    services: [
        { id: 'cs_1', icon: '🛢️', name: 'น้ำมันเครื่อง + ไส้กรอง', lastOdo: 46500, intervalKm: 10000 },
        { id: 'cs_2', icon: '🛞', name: 'สลับยาง / ถ่วงล้อ / เช็กศูนย์', lastOdo: 45000, intervalKm: 10000 },
        { id: 'cs_3', icon: '🌬️', name: 'ไส้กรองอากาศ & กรองแอร์', lastOdo: 40000, intervalKm: 20000 },
        { id: 'cs_4', icon: '⚙️', name: 'น้ำมันเกียร์ & น้ำมันเบรก', lastOdo: 30000, intervalKm: 40000 }
    ],
    fuelLogs: [],
    preTripChecks: [
        { id: 'ptc_1', label: 'เช็กลมยาง 4 ล้อ + ยางอะไหล่ (32-35 PSI)', checked: false },
        { id: 'ptc_2', label: 'ตรวจระดับน้ำมันเครื่อง & น้ำหล่อเย็นหม้อน้ำ', checked: false },
        { id: 'ptc_3', label: 'เติมน้ำฉีดกระจก & เช็กใบปัดน้ำฝน', checked: false },
        { id: 'ptc_4', label: 'เช็กไฟหน้า ไฟท้าย ไฟเบรก ไฟเลี้ยว', checked: false },
        { id: 'ptc_5', label: 'เอกสาร พ.ร.บ. / ประกันภัย / ชุดปะยางฉุกเฉิน', checked: false }
    ]
};

let carData = JSON.parse(localStorage.getItem('fitTracker_car_data') || 'null');
if (!carData || !Array.isArray(carData.services)) {
    carData = JSON.parse(JSON.stringify(DEFAULT_CAR_DATA));
    localStorage.setItem('fitTracker_car_data', JSON.stringify(carData));
}
window.carData = carData;

function saveCarAndSync() {
    localStorage.setItem('fitTracker_car_data', JSON.stringify(window.carData));
    if (typeof pushToGitHub === 'function') pushToGitHub(false);
}

function renderCarPage() {
    const odo = Number(window.carData.odometer) || 0;
    const odoEl = document.getElementById('car-odometer-display');
    if (odoEl) odoEl.innerText = odo.toLocaleString();

    const fuelOdoInput = document.getElementById('car-fuel-odo');
    if (fuelOdoInput && !fuelOdoInput.value) fuelOdoInput.placeholder = `ล่าสุด ${odo}`;

    // 1. คำนวณอัตราสิ้นเปลือง & ค่าน้ำมันเดือนนี้
    const logs = window.carData.fuelLogs || [];
    const validKmlLogs = logs.filter(l => l.kml && l.kml > 0);
    const avgKml = validKmlLogs.length
        ? (validKmlLogs.reduce((s, l) => s + l.kml, 0) / validKmlLogs.length).toFixed(1)
        : '-';
    const avgBahtKm = validKmlLogs.length
        ? (validKmlLogs.reduce((s, l) => s + l.bahtPerKm, 0) / validKmlLogs.length).toFixed(2)
        : '-';

    const monthPrefix = currentDateKey.slice(0, 7);
    const monthFuelBaht = logs
        .filter(l => (l.date || '').startsWith(monthPrefix))
        .reduce((s, l) => s + Number(l.baht || 0), 0);

    document.getElementById('car-avg-kml').innerText = avgKml !== '-' ? `${avgKml} กม./ล.` : '- กม./ล.';
    document.getElementById('car-avg-baht-km').innerText = avgBahtKm !== '-' ? `${avgBahtKm} บ./กม.` : '- บ./กม.';
    document.getElementById('car-month-fuel-cost').innerText = `${Math.round(monthFuelBaht).toLocaleString()} บ.`;

    // 2. แสดงรายการซ่อมบำรุง
    const maintEl = document.getElementById('car-maintenance-list');
    if (maintEl) {
        maintEl.innerHTML = window.carData.services.map((srv, idx) => {
            const usedKm = Math.max(0, odo - Number(srv.lastOdo || 0));
            const interval = Math.max(1000, Number(srv.intervalKm) || 10000);
            const remKm = interval - usedKm;
            const pct = Math.min(100, Math.round((usedKm / interval) * 100));

            let barColor = 'bg-emerald-400';
            let statusText = `เหลืออีก ${remKm.toLocaleString()} กม.`;
            let statusClass = 'text-emerald-400';

            if (remKm <= 0) {
                barColor = 'bg-rose-500';
                statusText = `เกินกำหนด ${Math.abs(remKm).toLocaleString()} กม.!`;
                statusClass = 'text-rose-400 font-bold';
            } else if (remKm <= 1500) {
                barColor = 'bg-amber-400';
                statusText = `ใกล้ครบกำหนด (${remKm.toLocaleString()} กม.)`;
                statusClass = 'text-amber-300 font-semibold';
            }

            return `
                <div class="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 space-y-1.5 text-xs">
                    <div class="flex items-center justify-between gap-2">
                        <div class="font-bold text-white">${srv.icon || '🔧'} ${srv.name}</div>
                        <div class="flex items-center gap-1 shrink-0">
                            <button type="button" onclick="resetCarServiceOdo(${idx})" class="bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold px-2 py-1 rounded-lg">
                                เปลี่ยนแล้ว
                            </button>
                            <button type="button" onclick="deleteCarService(${idx})" class="text-slate-500 hover:text-rose-400 px-1.5 py-1">
                                <i class="fa-solid fa-trash text-[10px]"></i>
                            </button>
                        </div>
                    </div>
                    <div class="flex justify-between text-[10px]">
                        <span class="text-slate-400">เปลี่ยนล่าสุด: ${Number(srv.lastOdo).toLocaleString()} กม. (รอบ ${interval.toLocaleString()} กม.)</span>
                        <span class="${statusClass}">${statusText}</span>
                    </div>
                    <div class="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                        <div class="${barColor} h-full rounded-full transition-all" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 3. ประวัติเติมน้ำมัน 5 ครั้งล่าสุด
    const fuelListEl = document.getElementById('car-fuel-history-list');
    if (fuelListEl) {
        if (logs.length === 0) {
            fuelListEl.innerHTML = `<div class="text-[11px] text-slate-500 text-center py-2">บันทึกเติมน้ำมัน 2 ครั้งขึ้นไปเพื่อคำนวณอัตราสิ้นเปลืองจริง (กม./ลิตร)</div>`;
        } else {
            fuelListEl.innerHTML = logs.slice(0, 5).map((l, idx) => `
                <div class="flex items-center justify-between gap-2 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 text-xs">
                    <div class="min-w-0">
                        <div class="font-semibold text-white truncate">${l.note || 'เติมน้ำมัน'} <span class="text-[10px] text-slate-400">(${l.date})</span></div>
                        <div class="text-[10px] text-slate-400">ไมล์ ${Number(l.odo).toLocaleString()} • ${l.liters} ลิตร • ${Number(l.baht).toLocaleString()} บ.</div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        ${l.kml ? `<span class="bg-emerald-950 text-emerald-300 border border-emerald-700/50 px-2 py-0.5 rounded-lg text-[10px] font-bold">${l.kml.toFixed(1)} กม./ล.</span>` : ''}
                        <button type="button" onclick="deleteCarFuelLog(${idx})" class="text-slate-500 hover:text-rose-400"><i class="fa-solid fa-trash text-[10px]"></i></button>
                    </div>
                </div>
            `).join('');
        }
    }

    // 4. เช็กลิสต์ตรวจรถก่อนออกทริป
    const preTripEl = document.getElementById('car-pretrip-list');
    if (preTripEl) {
        preTripEl.innerHTML = (window.carData.preTripChecks || []).map((item, idx) => `
            <label class="flex items-center gap-2.5 bg-slate-950/90 px-3 py-2 rounded-xl border ${item.checked ? 'border-emerald-700/40 opacity-70' : 'border-slate-800'} cursor-pointer">
                <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleCarPreTrip(${idx})" class="w-4 h-4 accent-emerald-500 rounded shrink-0" />
                <span class="${item.checked ? 'line-through text-slate-500' : 'text-slate-200'}">${item.label}</span>
            </label>
        `).join('');
    }
}

function updateCarOdometerPrompt() {
    const cur = Number(window.carData.odometer) || 0;
    const val = prompt('อัปเดตเลขไมล์รถปัจจุบัน (กม.):', cur);
    if (val === null) return;
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
        window.carData.odometer = num;
        saveCarAndSync();
        renderCarPage();
    }
}

function resetCarServiceOdo(idx) {
    const srv = window.carData.services[idx];
    if (!srv) return;
    const val = prompt(`บันทึกเลขไมล์ที่เปลี่ยน "${srv.name}" (กม.):`, window.carData.odometer);
    if (val === null) return;
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
        srv.lastOdo = num;
        if (num > window.carData.odometer) window.carData.odometer = num;
        saveCarAndSync();
        renderCarPage();
    }
}

function addCustomCarService() {
    const name = prompt('ชื่อรายการเช็กระยะ (เช่น ผ้าเบรกหน้า, แบตเตอรี่):');
    if (!name || !name.trim()) return;
    const interval = parseInt(prompt('รอบระยะเปลี่ยนทุกกี่ กม. (เช่น 30000):', '20000'), 10) || 20000;
    window.carData.services.push({
        id: 'cs_' + Date.now(),
        icon: '🔧',
        name: name.trim(),
        lastOdo: window.carData.odometer,
        intervalKm: interval
    });
    saveCarAndSync();
    renderCarPage();
}

function deleteCarService(idx) {
    if (!confirm('ลบรายการเช็กระยะนี้ใช่ไหม?')) return;
    window.carData.services.splice(idx, 1);
    saveCarAndSync();
    renderCarPage();
}

function handleCarFuelSubmit(e) {
    e.preventDefault();
    const odo = parseInt(document.getElementById('car-fuel-odo').value, 10);
    const baht = parseFloat(document.getElementById('car-fuel-baht').value);
    const liters = parseFloat(document.getElementById('car-fuel-liters').value);
    const note = (document.getElementById('car-fuel-note').value || '').trim() || 'เติมน้ำมัน';
    const syncFin = document.getElementById('car-fuel-sync-finance')?.checked;

    if (isNaN(odo) || isNaN(baht) || isNaN(liters) || liters <= 0) return;

    let kml = null, bahtPerKm = null;
    const prevLog = window.carData.fuelLogs[0];
    if (prevLog && odo > prevLog.odo) {
        const dist = odo - prevLog.odo;
        kml = fmtPrecise(dist / liters, 2);
        bahtPerKm = fmtPrecise(baht / dist, 2);
    }

    window.carData.fuelLogs.unshift({
        date: currentDateKey,
        odo,
        baht: fmtPrecise(baht, 2),
        liters: fmtPrecise(liters, 2),
        note,
        kml,
        bahtPerKm
    });

    if (odo > window.carData.odometer) window.carData.odometer = odo;

    // เชื่อมลงบัญชีรายจ่ายวันนี้ให้อัตโนมัติถ้าติ๊กเลือกไว้
    if (syncFin) {
        const dayData = getDayData(currentDateKey);
        if (!Array.isArray(dayData.finances)) dayData.finances = [];
        dayData.finances.unshift({
            type: 'expense',
            category: 'transport',
            title: `⛽ ${note} (${liters} ลิตร)`,
            amount: fmtPrecise(baht, 2)
        });
        if (typeof saveDataAndSync === 'function') saveDataAndSync();
    }

    document.getElementById('car-fuel-odo').value = '';
    document.getElementById('car-fuel-baht').value = '';
    document.getElementById('car-fuel-liters').value = '';
    document.getElementById('car-fuel-note').value = '';

    saveCarAndSync();
    renderCarPage();
}

function deleteCarFuelLog(idx) {
    window.carData.fuelLogs.splice(idx, 1);
    saveCarAndSync();
    renderCarPage();
}

function toggleCarPreTrip(idx) {
    const item = window.carData.preTripChecks[idx];
    if (item) item.checked = !item.checked;
    saveCarAndSync();
    renderCarPage();
}

function resetCarPreTripChecks() {
    window.carData.preTripChecks.forEach(i => { i.checked = false; });
    saveCarAndSync();
    renderCarPage();
}
