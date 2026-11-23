// ==========================================
// 1. คลังท่าเริ่มต้น + วิธีทำ + ข้อมูลกล้ามเนื้อ
// ==========================================
const STORAGE_KEYS = {
    LOGS: "fitTracker_workout_logs_v1",
    STEPS: "fitTracker_steps_v1",
    CUSTOM_EX: "fitTracker_user_exercises_v1",
    BUILDER_SEL: "fitTracker_custom_builder_v1"
};

const muscleThai = {
    chest: "อก",
    back: "หลัง",
    legs: "ต้นขา",
    glutes: "ก้น",
    shoulders: "ไหล่",
    arms: "แขน",
    core: "ท้อง"
};

const DEFAULT_EXERCISES = [
    {
        name: "Bodyweight Squat (สควอท)",
        muscle: "ขา & ก้น",
        reps: "15 ครั้ง × 3 เซต",
        kcalPerSet: 12,
        customPrimary: ["legs", "glutes"],
        howTo: "ยืนกางขาประมาณช่วงไหล่ ปลายเท้าชี้ออกเล็กน้อย ดันสะโพกไปด้านหลังและงอเข่าลงจนต้นขาขนานพื้น รักษาหลังตรง ไม่งอหลัง แล้วดันส้นเท้ากลับขึ้นมา"
    },
    {
        name: "Standard Push-ups (วิดพื้น)",
        muscle: "หน้าอก & แขน",
        reps: "10-15 ครั้ง × 3 เซต",
        kcalPerSet: 11,
        customPrimary: ["chest", "arms"],
        howTo: "วางมือห่างกว่าไหล่เล็กน้อย ลำตัวเป็นเส้นตรงตั้งแต่หัวถึงส้นเท้า เกร็งท้องและก้น ลดตัวลงจนอกใกล้พื้น แล้วดันขึ้นโดยไม่กระชาก"
    },
    {
        name: "Glute Bridge (นอนยกสะโพก)",
        muscle: "ก้น & ต้นขา",
        reps: "15 ครั้ง × 3 เซต",
        kcalPerSet: 10,
        customPrimary: ["glutes", "legs"],
        howTo: "นอนหงายชันเข่า วางเท้ากว้างระดับสะโพก เกร็งก้นและท้องแล้วดันสะโพกขึ้นจนลำตัวตั้งแต่ไหล่ถึงเข่าเป็นเส้นตรง ค้าง 1-2 วินาทีแล้วค่อยๆ วางลง"
    },
    {
        name: "Reverse Lunges (ก้าวถอยหลังย่อเข่า)",
        muscle: "ขา & ก้น",
        reps: "ข้างละ 10-12 ครั้ง × 3 เซต",
        kcalPerSet: 12,
        customPrimary: ["legs", "glutes"],
        howTo: "ยืนตรงแล้วก้าวขาข้างหนึ่งไปด้านหลัง ย่อตัวลงจนเข่าหน้าและเข่าหลังทำมุมประมาณ 90 องศา ไม่ให้เข่าหน้าเลยปลายเท้ามากเกินไป แล้วดันกลับขึ้นมา"
    },
    {
        name: "Wall Sit (นั่งพิงกำแพง)",
        muscle: "ต้นขา & ก้น",
        reps: "ค้างไว้ 30-45 วินาที × 3 เซต",
        kcalPerSet: 9,
        customPrimary: ["legs"],
        howTo: "พิงหลังแนบผนัง ก้าวเท้าออกมาเล็กน้อยแล้วไถตัวลงจนต้นขาขนานพื้น เกร็งหน้าท้องและค้างไว้โดยไม่ใช้มือดันเข่า"
    },
    {
        name: "Plank (แพลงก์)",
        muscle: "หน้าท้อง & แกนกลาง",
        reps: "ค้างไว้ 30-45 วินาที × 3 เซต",
        kcalPerSet: 8,
        customPrimary: ["core"],
        howTo: "วางศอกใต้หัวไหล่ เหยียดขาไปด้านหลัง เกร็งหน้าท้องและก้นให้ลำตัวเป็นเส้นตรง ไม่แอ่นหลังหรือยกก้นสูงเกินไป หายใจสม่ำเสมอ"
    }
];

function loadJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// สถานะหลักที่ใช้ร่วมกันทั้งแอป
let workoutLogs = loadJSON(STORAGE_KEYS.LOGS, [
    {
        title: "เวทเลือกท่าเอง (4 ท่า: Bodyweight Squat (สควอท), Standard Push-ups (วิดพื้น), Glute Bridge (นอนยกสะโพก), Plank (แพลงก์))",
        minutes: 6,
        kcal: -45,
        exercises: [
            { name: "Bodyweight Squat (สควอท)", sets: 1, reps: "15 ครั้ง" },
            { name: "Standard Push-ups (วิดพื้น)", sets: 1, reps: "10-15 ครั้ง" },
            { name: "Glute Bridge (นอนยกสะโพก)", sets: 1, reps: "15 ครั้ง" },
            { name: "Plank (แพลงก์)", sets: 1, reps: "30-45 วินาที" }
        ]
    }
]);

let stepCount = Number(loadJSON(STORAGE_KEYS.STEPS, 1500)) || 0;
let userCustomExercises = loadJSON(STORAGE_KEYS.CUSTOM_EX, []);
let customBuilderSelection = loadJSON(STORAGE_KEYS.BUILDER_SEL, {
    "Bodyweight Squat (สควอท)": 1,
    "Glute Bridge (นอนยกสะโพก)": 1
});

let currentMuscleFilter = "all";
let activeLogModalIndex = null;

function persistAllState() {
    saveJSON(STORAGE_KEYS.LOGS, workoutLogs);
    saveJSON(STORAGE_KEYS.STEPS, stepCount);
    saveJSON(STORAGE_KEYS.CUSTOM_EX, userCustomExercises);
    saveJSON(STORAGE_KEYS.BUILDER_SEL, customBuilderSelection);
}

function getAllExercises() {
    return [...DEFAULT_EXERCISES, ...userCustomExercises];
}

function findExerciseGuideInfo(exName) {
    const cleanName = String(exName || "").trim().toLowerCase();
    const all = getAllExercises();
    const matched = all.find(item => {
        if (!item || !item.name) return false;
        const n = item.name.toLowerCase();
        return n === cleanName || n.includes(cleanName) || cleanName.includes(n);
    });

    let muscleText = matched?.muscle || "";
    if (!muscleText && Array.isArray(matched?.customPrimary) && matched.customPrimary.length > 0) {
        muscleText = matched.customPrimary.map(m => muscleThai[m] || m).join(", ");
    }
    if (!muscleText) muscleText = "ระบุตามท่าที่เลือก";

    const howTo = matched?.howTo
        || matched?.tip
        || "รักษาแนวกระดูกสันหลังให้เป็นกลาง เกร็งแกนกลางลำตัว หายใจออกจังหวะออกแรง และควบคุมจังหวะไม่กระชาก";

    return {
        muscleText,
        howTo,
        kcalPerSet: matched?.kcalPerSet || 10,
        reps: matched?.reps || "12-15 ครั้ง"
    };
}

// ==========================================
// 2. หน้าหลัก (Dashboard)
// ==========================================
function updateSteps(val) {
    stepCount = Math.max(0, Number(val) || 0);
    persistAllState();
    renderDashboard();
}

function addSteps(delta) {
    stepCount = Math.max(0, stepCount + Number(delta || 0));
    persistAllState();
    renderDashboard();
}

function deleteWorkoutLog(index) {
    if (!workoutLogs[index]) return;
    if (!confirm("ต้องการลบรายการออกกำลังกายนี้ใช่ไหม?")) return;
    workoutLogs.splice(index, 1);
    persistAllState();
    renderDashboard();
}

function openQuickCustomExerciseModal() {
    const name = prompt("ชื่อกิจกรรมหรือท่าออกกำลังกายที่ทำ:");
    if (!name || !name.trim()) return;
    const mins = Math.max(1, Number(prompt("ใช้เวลากี่นาที:", "15")) || 15);
    const burned = Math.max(1, Number(prompt("เผาผลาญประมาณกี่ kcal:", "60")) || 60);
    const howTo = prompt("โน้ต / วิธีทำ (ถ้ามี):", "") || "";

    workoutLogs.unshift({
        title: `${name.trim()} (${mins} นาที)`,
        minutes: mins,
        kcal: -Math.abs(burned),
        exercises: [
            {
                name: name.trim(),
                sets: 1,
                reps: `${mins} นาที`,
                customHowTo: howTo.trim()
            }
        ]
    });

    persistAllState();
    renderDashboard();
}

function renderDashboard() {
    const stepInput = document.getElementById("stepCountInput");
    const stepKcalText = document.getElementById("stepKcalText");
    const stepProgressBar = document.getElementById("stepProgressBar");
    const stepPercentText = document.getElementById("stepPercentText");
    const totalBurnedBadge = document.getElementById("totalBurnedBadge");
    const logsContainer = document.getElementById("dashboardWorkoutLogs");

    if (!logsContainer) return;

    const stepBurned = Math.round(stepCount * 0.04);
    const pct = Math.min(100, Math.round((stepCount / 10000) * 100));
    const workoutBurned = workoutLogs.reduce((sum, item) => sum + Math.abs(Number(item.kcal || 0)), 0);
    const totalBurned = stepBurned + workoutBurned;

    if (stepInput && document.activeElement !== stepInput) {
        stepInput.value = stepCount;
    }
    if (stepKcalText) stepKcalText.textContent = `เผาผลาญ ${stepBurned} kcal`;
    if (stepProgressBar) stepProgressBar.style.width = `${pct}%`;
    if (stepPercentText) stepPercentText.textContent = `${pct}%`;
    if (totalBurnedBadge) totalBurnedBadge.textContent = `-${totalBurned} kcal`;

    if (workoutLogs.length === 0) {
        logsContainer.innerHTML = `<div class="py-3 text-center text-xs text-slate-500">ยังไม่มีรายการออกกำลังกายวันนี้</div>`;
        return;
    }

    logsContainer.innerHTML = workoutLogs.map((log, idx) => {
        const exCount = Array.isArray(log.exercises) && log.exercises.length > 0
            ? log.exercises.length
            : parseExercisesFromLogTitle(log.title).length;

        return `
            <div class="flex items-center justify-between gap-2 py-2.5">
                <button type="button" onclick="openWorkoutLogDetailModal(${idx})" class="text-left flex-1 min-w-0 group">
                    <div class="text-xs font-semibold text-white group-hover:text-indigo-300 transition line-clamp-2">
                        ${escapeHtml(log.title)}
                    </div>
                    <div class="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>${log.minutes || 6} นาที</span>
                        <span>•</span>
                        <span>${exCount} ท่า</span>
                        <span>•</span>
                        <span class="text-amber-400 underline">ดูท่า &amp; วิธีทำ / แก้ไข</span>
                    </div>
                </button>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="text-xs font-bold text-amber-400">${log.kcal} kcal</span>
                    <button type="button" onclick="deleteWorkoutLog(${idx})" title="ลบรายการ"
                        class="text-rose-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

// ==========================================
// 3. Modal ดูรายชื่อท่าครบ + วิธีทำ + แก้ไขรายการที่บันทึกไว้
// ==========================================
function parseExercisesFromLogTitle(title) {
    const text = String(title || "");
    const match = text.match(/:\s*([^)]+)\)?$/);
    if (!match) {
        return [{ name: text || "ท่าออกกำลังกาย", sets: 1, reps: "" }];
    }
    return match[1]
        .replace(/\.\.\.\s*$/, "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
        .map(name => ({ name, sets: 1, reps: "" }));
}

function openWorkoutLogDetailModal(logIndex) {
    const log = workoutLogs[logIndex];
    if (!log) return;

    activeLogModalIndex = logIndex;

    const items = Array.isArray(log.exercises) && log.exercises.length > 0
        ? log.exercises.map(item => ({
            name: item.name,
            sets: Math.max(1, Number(item.sets) || 1),
            reps: item.reps || "",
            customHowTo: item.customHowTo || ""
        }))
        : parseExercisesFromLogTitle(log.title);

    window._tempLogModalItems = items.map(i => ({ ...i }));

    const modalHtml = `
        <div id="workoutLogDetailModal"
             class="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3"
             onclick="if(event.target.id==='workoutLogDetailModal') closeWorkoutLogDetailModal()">
            <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden text-white shadow-2xl">
                <div class="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                    <div>
                        <div class="text-sm font-bold text-white">รายละเอียดเวทที่บันทึกไว้</div>
                        <div id="logModalSummary" class="text-[11px] text-slate-400">
                            รวม ${items.length} ท่า • เผาผลาญ ${Math.abs(Number(log.kcal || 0))} kcal
                        </div>
                    </div>
                    <button type="button" onclick="closeWorkoutLogDetailModal()"
                            class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div id="logModalItemsContainer" class="p-3 overflow-y-auto space-y-2.5 flex-1">
                    ${renderLogModalItemsHtml(window._tempLogModalItems)}
                </div>

                <div class="p-3 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-900">
                    <button type="button" onclick="closeWorkoutLogDetailModal()"
                            class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300">
                        ปิด
                    </button>
                    <button type="button" onclick="saveWorkoutLogChanges()"
                            class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white">
                        บันทึกการแก้ไข
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById("workoutLogDetailModal")?.remove();
    document.body.insertAdjacentHTML("beforeend", modalHtml);
}

function renderLogModalItemsHtml(items) {
    if (!items || items.length === 0) {
        return `<div class="text-center text-xs text-slate-400 py-6">ไม่มีท่าเหลืออยู่ในรายการนี้</div>`;
    }

    return items.map((item, idx) => {
        const info = findExerciseGuideInfo(item.name);
        const guideText = item.customHowTo || info.howTo;
        return `
            <div class="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-2">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                        <div class="text-xs font-bold text-indigo-300">${idx + 1}. ${escapeHtml(item.name)}</div>
                        <div class="text-[11px] text-slate-400 mt-0.5">
                            กล้ามเนื้อ: <span class="text-rose-400">${escapeHtml(info.muscleText)}</span>
                            ${item.reps ? ` • ${escapeHtml(item.reps)}` : ""}
                        </div>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                        <div class="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-0.5">
                            <button type="button" onclick="changeLogItemSets(${idx}, -1)"
                                    class="w-5 h-5 text-slate-300 hover:text-white font-bold">-</button>
                            <span id="logModalSets_${idx}" class="text-xs font-semibold text-amber-300 min-w-[40px] text-center">
                                ${item.sets} เซต
                            </span>
                            <button type="button" onclick="changeLogItemSets(${idx}, 1)"
                                    class="w-5 h-5 text-slate-300 hover:text-white font-bold">+</button>
                        </div>
                        <button type="button" onclick="removeLogModalItem(${idx})" title="นำท่าออกจากรายการนี้"
                                class="w-6 h-6 rounded-lg bg-slate-900 hover:bg-rose-950 text-rose-400 flex items-center justify-center">
                            <i class="fa-solid fa-xmark text-xs"></i>
                        </button>
                    </div>
                </div>

                <div class="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 text-[11px] leading-relaxed text-slate-300">
                    <div class="font-semibold text-emerald-400 mb-1">วิธีทำ &amp; ข้อควรระวัง:</div>
                    <div>${escapeHtml(guideText)}</div>
                </div>
            </div>
        `;
    }).join("");
}

function closeWorkoutLogDetailModal() {
    document.getElementById("workoutLogDetailModal")?.remove();
    window._tempLogModalItems = null;
    activeLogModalIndex = null;
}

function changeLogItemSets(idx, delta) {
    const list = window._tempLogModalItems;
    if (!list || !list[idx]) return;
    list[idx].sets = Math.max(1, (Number(list[idx].sets) || 1) + delta);
    const el = document.getElementById(`logModalSets_${idx}`);
    if (el) el.textContent = `${list[idx].sets} เซต`;
}

function removeLogModalItem(idx) {
    const list = window._tempLogModalItems;
    if (!list || !list[idx]) return;
    list.splice(idx, 1);
    const container = document.getElementById("logModalItemsContainer");
    if (container) {
        container.innerHTML = renderLogModalItemsHtml(list);
    }
    const summary = document.getElementById("logModalSummary");
    if (summary) {
        summary.textContent = `รวม ${list.length} ท่า`;
    }
}

function saveWorkoutLogChanges() {
    if (activeLogModalIndex === null || !workoutLogs[activeLogModalIndex]) {
        closeWorkoutLogDetailModal();
        return;
    }

    const updatedItems = window._tempLogModalItems || [];
    if (updatedItems.length === 0) {
        workoutLogs.splice(activeLogModalIndex, 1);
    } else {
        const targetLog = workoutLogs[activeLogModalIndex];
        const totalSets = updatedItems.reduce((sum, x) => sum + (Number(x.sets) || 1), 0);
        const totalKcal = updatedItems.reduce((sum, item) => {
            const info = findExerciseGuideInfo(item.name);
            return sum + ((Number(item.sets) || 1) * info.kcalPerSet);
        }, 0);
        const totalMinutes = Math.max(2, Math.round(totalSets * 1.5));

        targetLog.exercises = updatedItems.map(i => ({ ...i }));
        targetLog.kcal = -Math.abs(totalKcal);
        targetLog.minutes = totalMinutes;
        targetLog.title = `เวทเลือกท่าเอง (${updatedItems.length} ท่า: ${updatedItems.map(i => i.name).join(", ")})`;
    }

    persistAllState();
    closeWorkoutLogDetailModal();
    renderDashboard();
}

// ==========================================
// 4. หน้าคอร์สเวท & เลือกท่าเอง + จัดการท่าที่ใส่เอง
// ==========================================
function renderWorkoutCourseContent() {
    const filterBar = document.getElementById("muscleFilterBar");
    const listEl = document.getElementById("exerciseBuilderList");
    const saveBtn = document.getElementById("saveBuilderWorkoutBtn");
    const summaryBadge = document.getElementById("builderSummaryBadge");
    const muscleTextEl = document.getElementById("builderMuscleText");

    if (!listEl) return;

    const filters = [
        { key: "all", label: "ทั้งหมด" },
        { key: "legs", label: "ขา/ก้น" },
        { key: "chest", label: "อก" },
        { key: "back", label: "หลัง" },
        { key: "shoulders", label: "ไหล่" },
        { key: "arms", label: "แขน" },
        { key: "core", label: "ท้อง" },
        { key: "custom", label: "ท่าที่ใส่เอง" }
    ];

    if (filterBar) {
        filterBar.innerHTML = filters.map(f => {
            const active = currentMuscleFilter === f.key;
            return `
                <button type="button" onclick="setMuscleFilter('${f.key}')"
                    class="px-2.5 py-1.5 rounded-xl font-semibold whitespace-nowrap transition ${active ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">
                    ${f.label}
                </button>
            `;
        }).join("");
    }

    const allExercises = getAllExercises();
    const visibleExercises = allExercises.filter(ex => {
        if (currentMuscleFilter === "all") return true;
        if (currentMuscleFilter === "custom") {
            return userCustomExercises.some(u => u.name === ex.name);
        }
        const primary = ex.customPrimary || [];
        if (currentMuscleFilter === "legs") {
            return primary.includes("legs") || primary.includes("glutes");
        }
        return primary.includes(currentMuscleFilter);
    });

    listEl.innerHTML = visibleExercises.map(ex => {
        const isChecked = !!customBuilderSelection[ex.name];
        const isUserEx = userCustomExercises.some(u => u.name === ex.name);
        const sets = customBuilderSelection[ex.name] || 1;
        const safeAttrName = escapeAttr(ex.name);
        const primary = ex.customPrimary || ["core"];
        const pText = primary.map(m => muscleThai[m] || m).join(",");
        const repsLabel = (ex.reps || "").split("×")[0].trim();

        return `
            <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl border transition ${isChecked ? 'bg-indigo-950/40 border-indigo-500/50' : 'bg-slate-950/70 border-slate-800'}">
                <label class="flex items-start gap-2 cursor-pointer flex-1 min-w-0">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} data-ex-name="${safeAttrName}"
                        onchange="toggleBuilderExercise(this.dataset.exName)"
                        class="w-4 h-4 mt-0.5 accent-indigo-500 rounded shrink-0" />
                    <div class="min-w-0">
                        <div class="text-xs font-semibold text-white truncate">${escapeHtml(ex.name)}</div>
                        <div class="text-[10px] text-slate-400">
                            เน้น: <span class="text-rose-400">${escapeHtml(pText)}</span>${repsLabel ? ` • ${escapeHtml(repsLabel)}` : ""}
                        </div>
                    </div>
                </label>

                <div class="flex items-center gap-1.5 shrink-0" data-ex-name="${safeAttrName}">
                    <button type="button" onclick="openSingleExerciseGuide(this.parentElement.dataset.exName)" title="ดูวิธีทำ"
                        class="bg-slate-800 hover:bg-slate-700 text-emerald-400 w-6 h-6 rounded-lg flex items-center justify-center transition">
                        <i class="fa-solid fa-circle-info text-[10px]"></i>
                    </button>

                    ${isChecked ? `
                        <div class="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-0.5">
                            <button type="button" onclick="adjustBuilderSets(this.parentElement.parentElement.dataset.exName, -1)"
                                class="text-slate-300 hover:text-white w-4 h-5 flex items-center justify-center text-xs font-bold">-</button>
                            <span class="text-[11px] font-semibold text-indigo-300 min-w-[34px] text-center">${sets} เซต</span>
                            <button type="button" onclick="adjustBuilderSets(this.parentElement.parentElement.dataset.exName, 1)"
                                class="text-slate-300 hover:text-white w-4 h-5 flex items-center justify-center text-xs font-bold">+</button>
                        </div>
                    ` : ""}

                    ${isUserEx ? `
                        <button type="button" onclick="editUserCustomExercise(this.parentElement.dataset.exName)" title="แก้ไขท่าที่ใส่เอง"
                            class="bg-slate-800 hover:bg-slate-700 text-amber-400 w-6 h-6 rounded-lg flex items-center justify-center transition">
                            <i class="fa-solid fa-pen text-[10px]"></i>
                        </button>
                        <button type="button" onclick="deleteUserCustomExercise(this.parentElement.dataset.exName)" title="ลบท่าที่ใส่เอง"
                            class="bg-slate-800 hover:bg-slate-700 text-rose-400 w-6 h-6 rounded-lg flex items-center justify-center transition">
                            <i class="fa-solid fa-trash text-[10px]"></i>
                        </button>
                    ` : ""}
                </div>
            </div>
        `;
    }).join("");

    // สรุปผลด้านบนและปุ่มบันทึก
    const selectedEntries = Object.entries(customBuilderSelection).filter(([, s]) => Number(s) > 0);
    const totalEx = selectedEntries.length;
    const totalSets = selectedEntries.reduce((sum, [, s]) => sum + Number(s), 0);
    const totalKcal = selectedEntries.reduce((sum, [name, s]) => {
        const info = findExerciseGuideInfo(name);
        return sum + (Number(s) * info.kcalPerSet);
    }, 0);

    const muscleSet = new Set();
    selectedEntries.forEach(([name]) => {
        const info = findExerciseGuideInfo(name);
        info.muscleText.split(",").forEach(m => {
            if (m.trim()) muscleSet.add(m.trim());
        });
    });

    if (summaryBadge) {
        summaryBadge.textContent = `${totalEx} ท่า (${totalSets} เซต) • -${totalKcal} kcal`;
    }
    if (muscleTextEl) {
        muscleTextEl.textContent = muscleSet.size > 0
            ? `กล้ามเนื้อที่โดน: ${Array.from(muscleSet).join(", ")}`
            : "ติ๊กเลือกท่าด้านล่างเพื่อดูจุดกล้ามเนื้อและปรับจำนวนเซต";
    }
    if (saveBtn) {
        saveBtn.textContent = `✓ บันทึกเวทที่เลือกเอง (${totalEx} ท่า • -${totalKcal} kcal)`;
    }
}

function setMuscleFilter(key) {
    currentMuscleFilter = key;
    renderWorkoutCourseContent();
}

function toggleBuilderExercise(exName) {
    if (customBuilderSelection[exName]) {
        delete customBuilderSelection[exName];
    } else {
        customBuilderSelection[exName] = 1;
    }
    persistAllState();
    renderWorkoutCourseContent();
}

function adjustBuilderSets(exName, delta) {
    const current = Number(customBuilderSelection[exName] || 1);
    const next = current + Number(delta);
    if (next <= 0) {
        delete customBuilderSelection[exName];
    } else {
        customBuilderSelection[exName] = next;
    }
    persistAllState();
    renderWorkoutCourseContent();
}

function openSingleExerciseGuide(exName) {
    const info = findExerciseGuideInfo(exName);
    alert(`${exName}\n\nกล้ามเนื้อ: ${info.muscleText}\nวิธีทำ: ${info.howTo}`);
}

function addNewCustomExerciseFromUI() {
    const nameInput = document.getElementById("newCustomExName");
    const muscleSelect = document.getElementById("newCustomExMuscle");
    const howToInput = document.getElementById("newCustomExHowTo");

    const name = (nameInput?.value || "").trim();
    if (!name) {
        alert("กรุณาพิมพ์ชื่อท่าก่อนครับ");
        return;
    }

    const code = muscleSelect?.value || "core";
    const howTo = (howToInput?.value || "").trim() || "เกร็งแกนกลางลำตัว รักษาฟอร์มและหายใจสม่ำเสมอ";
    const groupMap = {
        chest: "หน้าอก",
        back: "แผ่นหลัง",
        legs: "ขา & ก้น",
        shoulders: "ไหล่",
        arms: "แขน",
        core: "หน้าท้อง & แกนกลาง"
    };

    const existingIdx = userCustomExercises.findIndex(u => u.name.toLowerCase() === name.toLowerCase());
    const itemObj = {
        name,
        muscle: groupMap[code] || "หน้าท้อง",
        reps: "12-15 ครั้ง × 3 เซต",
        kcalPerSet: 10,
        customPrimary: [code],
        howTo
    };

    if (existingIdx >= 0) {
        userCustomExercises[existingIdx] = itemObj;
    } else {
        userCustomExercises.push(itemObj);
    }

    customBuilderSelection[name] = customBuilderSelection[name] || 1;
    if (nameInput) nameInput.value = "";
    if (howToInput) howToInput.value = "";

    persistAllState();
    renderWorkoutCourseContent();
}

function editUserCustomExercise(exName) {
    const idx = userCustomExercises.findIndex(u => u.name === exName);
    if (idx === -1) return;

    const ex = userCustomExercises[idx];
    const newName = prompt("แก้ไขชื่อท่าที่ใส่เอง:", ex.name);
    if (newName === null) return;
    const trimmedName = newName.trim();
    if (!trimmedName) {
        alert("ชื่อท่าห้ามว่างครับ");
        return;
    }

    const newReps = prompt("แก้ไขจำนวนครั้ง / เซต:", ex.reps || "12-15 ครั้ง × 3 เซต");
    if (newReps === null) return;

    const newHowTo = prompt("แก้ไขวิธีทำ / คำแนะนำท่านี้:", ex.howTo || "");
    if (newHowTo === null) return;

    const curMuscle = (ex.customPrimary && ex.customPrimary[0]) || "core";
    const inputMuscle = prompt("แก้ไขกล้ามเนื้อหลัก (chest, back, legs, glutes, shoulders, arms, core):", curMuscle);
    if (inputMuscle === null) return;

    const validMuscles = ["chest", "back", "legs", "glutes", "shoulders", "arms", "core"];
    const muscleCode = validMuscles.includes(inputMuscle.trim().toLowerCase())
        ? inputMuscle.trim().toLowerCase()
        : curMuscle;

    if (customBuilderSelection[ex.name] !== undefined) {
        const sets = customBuilderSelection[ex.name];
        delete customBuilderSelection[ex.name];
        customBuilderSelection[trimmedName] = sets;
    }

    userCustomExercises[idx] = {
        ...ex,
        name: trimmedName,
        reps: newReps.trim() || ex.reps,
        howTo: newHowTo.trim() || ex.howTo,
        customPrimary: [muscleCode]
    };

    persistAllState();
    renderWorkoutCourseContent();
}

function deleteUserCustomExercise(exName) {
    if (!confirm(`ต้องการลบท่าที่ใส่เอง "${exName}" ใช่ไหม?`)) return;

    userCustomExercises = userCustomExercises.filter(u => u.name !== exName);
    delete customBuilderSelection[exName];

    persistAllState();
    renderWorkoutCourseContent();
}

function saveSelectedWorkoutToLog() {
    const entries = Object.entries(customBuilderSelection).filter(([, s]) => Number(s) > 0);
    if (entries.length === 0) {
        alert("กรุณาติ๊กเลือกอย่างน้อย 1 ท่าก่อนบันทึกครับ");
        return;
    }

    const exercises = entries.map(([name, sets]) => {
        const info = findExerciseGuideInfo(name);
        return {
            name,
            sets: Number(sets),
            reps: info.reps.split("×")[0].trim(),
            customHowTo: info.howTo
        };
    });

    const totalSets = exercises.reduce((sum, x) => sum + x.sets, 0);
    const totalKcal = exercises.reduce((sum, item) => {
        const info = findExerciseGuideInfo(item.name);
        return sum + (item.sets * info.kcalPerSet);
    }, 0);
    const minutes = Math.max(2, Math.round(totalSets * 1.5));

    workoutLogs.unshift({
        title: `เวทเลือกท่าเอง (${exercises.length} ท่า: ${exercises.map(x => x.name).join(", ")})`,
        minutes,
        kcal: -Math.abs(totalKcal),
        exercises
    });

    persistAllState();
    window.location.href = "index.html";
}

// ==========================================
// 5. ตัวช่วย Escape ข้อความ HTML
// ==========================================
function escapeHtml(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
}
