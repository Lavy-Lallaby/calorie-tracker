// ==========================================================================
// gear.js — โมดูลจัดกระเป๋า & เช็กลิสต์อุปกรณ์ออกทริป
// ==========================================================================

const DEFAULT_GEAR_PROFILES = {
    beach: [
        { id: 'gb_1', cat: 'clothes', name: 'เสื้อยืด / เสื้อเชิ้ตใส่สบาย + ชุดนอน', checked: false },
        { id: 'gb_2', cat: 'clothes', name: 'กางเกงขาสั้น / ชุดว่ายน้ำ / กางเกงใน', checked: false },
        { id: 'gb_3', cat: 'clothes', name: 'รองเท้าแตะลุยน้ำ + แว่นกันแดด + หมวก', checked: false },
        { id: 'gb_4', cat: 'skincare', name: 'กันแดดหน้า MizuMi UV Water Serum', checked: false },
        { id: 'gb_5', cat: 'skincare', name: 'กันแดดตัว MizuMi UV Cooling Body Serum', checked: false },
        { id: 'gb_6', cat: 'skincare', name: 'MizuMi Cica Soothing Gel (ทาปลอบประโลมหลังออกแดด)', checked: false },
        { id: 'gb_7', cat: 'skincare', name: 'โฟมล้างหน้า + แปรงสีฟัน + ยาสีฟัน + โรลออน', checked: false },
        { id: 'gb_8', cat: 'nutrition', name: 'เวย์โปรตีนแบบซอง + เชคเกอร์', checked: false },
        { id: 'gb_9', cat: 'nutrition', name: 'วิตามินรวม + น้ำมันปลา + เกลือแร่ซอง', checked: false },
        { id: 'gb_10', cat: 'tech', name: 'สายชาร์จมือถือ + สายชาร์จ HUAWEI Watch + เพาเวอร์แบงก์', checked: false },
        { id: 'gb_11', cat: 'tech', name: 'บัตรประชาชน + ใบขับขี่ + ยาแก้แพ้/พาราฯ', checked: false }
    ],
    hike: [
        { id: 'gh_1', cat: 'clothes', name: 'เสื้อแห้งไว (Dry-Fit) + เสื้อกันลม/กันหนาว', checked: false },
        { id: 'gh_2', cat: 'clothes', name: 'กางเกงเดินป่า + ถุงเท้าหนา + รองเท้าเทรล/ผ้าใบดอกยางลึก', checked: false },
        { id: 'gh_3', cat: 'skincare', name: 'กันแดดหน้า-ตัว + สเปรย์กันยุง/ทาก', checked: false },
        { id: 'gh_4', cat: 'skincare', name: 'ทิชชู่เปียก + เจลล้างมือ + ลิปมัน', checked: false },
        { id: 'gh_5', cat: 'nutrition', name: 'เกลือแร่ซอง (ป้องกันตะคริว) + น้ำดื่มสำรอง', checked: false },
        { id: 'gh_6', cat: 'nutrition', name: 'โปรตีนบาร์ / ถั่วอัลมอนด์ / กล้วยตากให้พลังงาน', checked: false },
        { id: 'gh_7', cat: 'tech', name: 'ไฟฉายคาดหัว (Headlamp) + เพาเวอร์แบงก์ + สายชาร์จ', checked: false },
        { id: 'gh_8', cat: 'tech', name: 'ชุดปฐมพยาบาล (พลาสเตอร์, ยาแก้ปวด, ยาดม, ถุงขยะพกพา)', checked: false }
    ],
    general: [
        { id: 'gg_1', cat: 'clothes', name: 'ชุดลำลองตามจำนวนวัน + ชุดออกกำลังกาย', checked: false },
        { id: 'gg_2', cat: 'skincare', name: 'เซ็ตล้างหน้า + ครีมบำรุง + กันแดด + น้ำหอม', checked: false },
        { id: 'gg_3', cat: 'nutrition', name: 'เวย์โปรตีน + วิตามินประจำวัน', checked: false },
        { id: 'gg_4', cat: 'tech', name: 'สายชาร์จ + เพาเวอร์แบงก์ + หูฟัง + บัตร/เอกสารสำคัญ', checked: false }
    ]
};

let gearState = JSON.parse(localStorage.getItem('fitTracker_gear_state') || 'null');
if (!gearState || !gearState.profiles) {
    gearState = {
        activeProfile: 'beach',
        profiles: JSON.parse(JSON.stringify(DEFAULT_GEAR_PROFILES))
    };
    localStorage.setItem('fitTracker_gear_state', JSON.stringify(gearState));
}
window.gearState = gearState;

const GEAR_CAT_META = {
    clothes:   { icon: '👕', title: 'เสื้อผ้า & รองเท้า', color: 'text-sky-300' },
    skincare:  { icon: '🧴', title: 'สกินแคร์ & ของใช้ส่วนตัว', color: 'text-pink-300' },
    nutrition: { icon: '🥤', title: 'เสบียง & อาหารเสริม', color: 'text-emerald-300' },
    tech:      { icon: '🔌', title: 'อิเล็กทรอนิกส์, เอกสาร & ยา', color: 'text-amber-300' }
};

function saveGearAndSync() {
    localStorage.setItem('fitTracker_gear_state', JSON.stringify(window.gearState));
    if (typeof pushToGitHub === 'function') pushToGitHub(false);
}

function renderGearPage() {
    const profileKey = window.gearState.activeProfile || 'beach';
    const items = window.gearState.profiles[profileKey] || [];

    // อัปเดตปุ่มเลือกโปรไฟล์
    ['beach', 'hike', 'general'].forEach(key => {
        const btn = document.getElementById(`gear-profile-${key}`);
        if (!btn) return;
        btn.className = (key === profileKey)
            ? 'py-2 rounded-xl border font-bold transition bg-sky-600/25 border-sky-400 text-sky-200'
            : 'py-2 rounded-xl border font-semibold transition bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white';
    });

    // คำนวณความคืบหน้า
    const total = items.length;
    const checked = items.filter(i => i.checked).length;
    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

    document.getElementById('gear-checked-count').innerText = `${checked}/${total}`;
    document.getElementById('gear-progress-pct').innerText = `${pct}%`;
    document.getElementById('gear-progress-bar').style.width = `${pct}%`;

    // แสดงรายการแยกตามหมวดหมู่
    const container = document.getElementById('gear-categories-container');
    if (!container) return;

    const catOrder = ['clothes', 'skincare', 'nutrition', 'tech'];
    container.innerHTML = catOrder.map(catKey => {
        const meta = GEAR_CAT_META[catKey];
        const catItems = items.filter(i => i.cat === catKey);
        if (catItems.length === 0) return '';

        return `
            <div class="bg-slate-900 rounded-3xl p-4 border border-slate-800 shadow-lg space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold ${meta.color}">${meta.icon} ${meta.title}</span>
                    <span class="text-[10px] text-slate-400">${catItems.filter(i => i.checked).length}/${catItems.length}</span>
                </div>
                <div class="space-y-1.5">
                    ${catItems.map(item => `
                        <div class="flex items-center justify-between gap-2 bg-slate-950/90 px-3 py-2 rounded-xl border ${item.checked ? 'border-emerald-700/40 opacity-70' : 'border-slate-800'}">
                            <label class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                                <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleGearItem('${item.id}')" class="w-4 h-4 accent-sky-500 rounded shrink-0">
                                <span class="text-xs leading-snug ${item.checked ? 'line-through text-slate-500' : 'text-slate-100 font-medium'}">${item.name}</span>
                            </label>
                            <button type="button" onclick="deleteGearItem('${item.id}')" class="text-slate-500 hover:text-rose-400 p-1 shrink-0">
                                <i class="fa-solid fa-trash text-xs"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function switchGearProfile(profileKey) {
    window.gearState.activeProfile = profileKey;
    saveGearAndSync();
    renderGearPage();
}

function toggleGearItem(itemId) {
    const items = window.gearState.profiles[window.gearState.activeProfile] || [];
    const target = items.find(i => i.id === itemId);
    if (target) target.checked = !target.checked;
    saveGearAndSync();
    renderGearPage();
}

function resetGearChecks() {
    if (!confirm('ล้างเครื่องหมายติ๊กถูกทั้งหมดในทริปนี้เพื่อเริ่มจัดกระเป๋าใหม่ใช่ไหม?')) return;
    const items = window.gearState.profiles[window.gearState.activeProfile] || [];
    items.forEach(i => { i.checked = false; });
    saveGearAndSync();
    renderGearPage();
}

function handleAddGearItem(e) {
    e.preventDefault();
    const cat = document.getElementById('gear-new-cat').value;
    const nameEl = document.getElementById('gear-new-name');
    const name = (nameEl.value || '').trim();
    if (!name) return;

    const profileKey = window.gearState.activeProfile;
    if (!window.gearState.profiles[profileKey]) window.gearState.profiles[profileKey] = [];
    window.gearState.profiles[profileKey].push({
        id: 'g_' + Date.now(),
        cat,
        name,
        checked: false
    });

    nameEl.value = '';
    saveGearAndSync();
    renderGearPage();
}

function deleteGearItem(itemId) {
    const profileKey = window.gearState.activeProfile;
    window.gearState.profiles[profileKey] = (window.gearState.profiles[profileKey] || []).filter(i => i.id !== itemId);
    saveGearAndSync();
    renderGearPage();
}
