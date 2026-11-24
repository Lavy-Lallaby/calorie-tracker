// ==========================================================================
// train.js — โมดูลก้าวเดิน, คอร์สเวท, Custom Builder, Active Player & Smart Scale
// ==========================================================================

let courseConfig = Object.assign(
    { equipment: ['bodyweight', 'chair'], schedule: '3days' },
    JSON.parse(localStorage.getItem('fitTracker_course') || '{}')
);
let currentCourseTab = 'today';
let customFocusOverride = null;
window.exercisePhotosMap = JSON.parse(localStorage.getItem('fitTracker_ex_photos') || '{}');
let activeExerciseNameForPhoto = '';
let bodyMapCompareMode = 'yesterday';

// ------------------------------------------
// 1. Entry Point สำหรับ Render หน้า Train ทั้งหมด
// ------------------------------------------
function renderTrainPage() {
    const chairEl = document.getElementById('eq-chair');
    const bandEl = document.getElementById('eq-band');
    const dbEl = document.getElementById('eq-dumbbell');
    const schEl = document.getElementById('course-schedule-select');

    if (chairEl) chairEl.checked = courseConfig.equipment.includes('chair');
    if (bandEl) bandEl.checked = courseConfig.equipment.includes('band');
    if (dbEl) dbEl.checked = courseConfig.equipment.includes('dumbbell');
    if (schEl) schEl.value = courseConfig.schedule || '3days';

    renderActivity();
    renderWorkoutCourseContent();
    renderWeightAndBodyComp();
}

// ------------------------------------------
// 2. Steps & Daily Workout Logs
// ------------------------------------------
function renderActivity() {
    const dayData = getDayData(currentDateKey);
    const steps = Number(dayData.steps || 0);
    const goalSteps = Number(userGoals.steps) || 10000;
    const { stepsCal, totalBurn } = getTotalBurned(dayData);

    const stepsInput = document.getElementById('steps-input');
    if (stepsInput && document.activeElement !== stepsInput) stepsInput.value = steps > 0 ? steps : '';
    const stepsCalEl = document.getElementById('steps-calories');
    if (stepsCalEl) stepsCalEl.innerText = stepsCal;
    const totalBurnEl = document.getElementById('activity-total-burn');
    if (totalBurnEl) totalBurnEl.innerText = totalBurn;
    const goalStepsEl = document.getElementById('goal-steps-label');
    if (goalStepsEl) goalStepsEl.innerText = goalSteps.toLocaleString();

    const pct = Math.min(Math.round((steps / goalSteps) * 100), 100);
    const progBar = document.getElementById('steps-progress-bar');
    if (progBar) progBar.style.width = `${pct}%`;
    const pctEl = document.getElementById('steps-percent');
    if (pctEl) pctEl.innerText = `${pct}%`;

    const listEl = document.getElementById('workouts-list');
    if (!listEl) return;

    if (dayData.workouts.length === 0) {
        listEl.innerHTML = `<div class="text-xs text-slate-500 py-1 text-center">ยังไม่มีรายการออกกำลังกายวันนี้</div>`;
    } else {
        listEl.innerHTML = dayData.workouts.map((w, idx) => `
            <div class="flex justify-between items-center py-2 border-b border-slate-800/40 last:border-none text-sm">
                <button type="button" onclick="openWorkoutLogDetailModal(${idx})" class="text-left flex-1 pr-2 group">
                    <span class="text-white font-medium group-hover:text-indigo-300 transition">${w.type}</span>
                    <span class="text-xs text-slate-400 ml-1.5">${w.duration} นาที</span>
                </button>
                <div class="flex items-center space-x-3 shrink-0">
                    <span class="text-orange-400 font-medium">-${w.calories} kcal</span>
                    <button type="button" onclick="deleteWorkout(${idx})" class="text-slate-500 hover:text-rose-400 p-1"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            </div>
        `).join('');
    }
}

function updateSteps(val) {
    getDayData(currentDateKey).steps = Math.max(0, Number(val) || 0);
    saveDataAndSync();
}

function addQuickSteps(amount) {
    const dayData = getDayData(currentDateKey);
    dayData.steps = (Number(dayData.steps) || 0) + amount;
    saveDataAndSync();
}

function openWorkoutModal() {
    document.getElementById('workout-duration').value = 30;
    autoCalcWorkoutCal();
    document.getElementById('workout-modal').classList.remove('hidden');
}

function closeWorkoutModal() {
    document.getElementById('workout-modal').classList.add('hidden');
}

function autoCalcWorkoutCal() {
    const select = document.getElementById('workout-type');
    const rate = Number(select.options[select.selectedIndex].dataset.rate || 5);
    const duration = Number(document.getElementById('workout-duration').value || 0);
    document.getElementById('workout-calories').value = Math.round(rate * duration);
}

function handleWorkoutSubmit(e) {
    e.preventDefault();
    getDayData(currentDateKey).workouts.push({
        type: document.getElementById('workout-type').value,
        duration: Number(document.getElementById('workout-duration').value),
        calories: Number(document.getElementById('workout-calories').value)
    });
    closeWorkoutModal();
    saveDataAndSync();
}

function deleteWorkout(index) {
    if (confirm("ต้องการลบรายการออกกำลังกายนี้ใช่ไหม?")) {
        getDayData(currentDateKey).workouts.splice(index, 1);
        saveDataAndSync();
    }
}

// ------------------------------------------
// 3. Exercise Database & Muscle Mapping
// ------------------------------------------
const nonMachineExercises = [
    { name: "Bodyweight Squat (สควอท)", muscle: "ขา & ก้น", eq: "bodyweight", reps: "15 ครั้ง × 3 เซต", tip: "ย่อก้นไปด้านหลัง หลังตรง เข่าไม่เลยปลายเท้ามากเกินไป" },
    { name: "Reverse Lunges (ก้าวถอยหลังย่อเข่า)", muscle: "ขา & ก้น", eq: "bodyweight", reps: "ข้างละ 10-12 ครั้ง × 3 เซต", tip: "ก้าวถอยหลังช่วยเซฟหัวเข่าได้ดีกว่าก้าวไปข้างหน้า" },
    { name: "Glute Bridge (นอนยกสะโพก)", muscle: "ขา & ก้น", eq: "bodyweight", reps: "15 ครั้ง × 3 เซต", tip: "ดันส้นเท้าขึ้น บีบก้นค้างไว้ 1-2 วินาทีจังหวะบนสุด" },
    { name: "Wall Sit (นั่งพิงกำแพง)", muscle: "ขา & ก้น", eq: "bodyweight", reps: "ค้างไว้ 30-45 วินาที × 3 เซต", tip: "พิงหลังแนบกำแพง งอเข่า 90 องศา เกร็งหน้าขา" },
    { name: "Calf Raises (ยืนเขย่งน่อง)", muscle: "ขา & ก้น", eq: "bodyweight", reps: "20 ครั้ง × 3 เซต", tip: "เขย่งขึ้นให้สุดแล้วค่อยๆ ผ่อนส้นเท้าลงช้าๆ" },
    { name: "Bulgarian Split Squat (พาดขาหลังกับเก้าอี้)", muscle: "ขา & ก้น", eq: "chair", reps: "ข้างละ 10 ครั้ง × 3 เซต", tip: "วางหลังเท้าข้างหนึ่งบนเก้าอี้ ย่อตัวลงเน้นต้นขาและก้นเต็มๆ" },
    { name: "Band Squat (สควอทต้านยางยืด)", muscle: "ขา & ก้น", eq: "band", reps: "15 ครั้ง × 3 เซต", tip: "เหยียบยางยืดไว้แล้วคล้องไหล่ เพิ่มแรงต้านตอนดันตัวขึ้น" },
    { name: "Dumbbell Goblet Squat (ถือดัมเบลสควอท)", muscle: "ขา & ก้น", eq: "dumbbell", reps: "12-15 ครั้ง × 3 เซต", tip: "ถือดัมเบล/ขวดน้ำชิดอก ย่อตัวลงลึก หลังตรง" },

    { name: "Standard Push-ups (วิดพื้นมาตรฐาน)", muscle: "หน้าอก", eq: "bodyweight", reps: "10-15 ครั้ง × 3 เซต", tip: "ลำตัวตรงเป็นเส้นเดียว กางศอกทำมุม 45 องศากับลำตัว" },
    { name: "Wide Push-ups (วิดพื้นกางแขนกว้าง)", muscle: "หน้าอก", eq: "bodyweight", reps: "10-12 ครั้ง × 3 เซต", tip: "วางมือกว้างกว่าหัวไหล่ เน้นกล้ามเนื้อหน้าอกด้านนอก" },
    { name: "Incline Push-ups (วิดพื้นกับขอบโต๊ะ/เก้าอี้)", muscle: "หน้าอก", eq: "chair", reps: "12-15 ครั้ง × 3 เซต", tip: "วางมือบนขอบโต๊ะที่มั่นคง เหมาะสำหรับเริ่มต้นหรือวอร์มอก" },
    { name: "Decline Push-ups (พาดเท้าบนเก้าอี้วิดพื้น)", muscle: "หน้าอก", eq: "chair", reps: "8-12 ครั้ง × 3 เซต", tip: "วางเท้าบนเก้าอี้ มือยันพื้น เน้นหน้าอกส่วนบนและหัวไหล่" },
    { name: "Band Chest Press (ดันยางยืดอ้อมหลัง)", muscle: "หน้าอก", eq: "band", reps: "15 ครั้ง × 3 เซต", tip: "คล้องยางยืดอ้อมใต้รักแร้ด้านหลัง แล้วดันแขนไปข้างหน้า" },
    { name: "Dumbbell Floor Press (นอนพื้นดันดัมเบล)", muscle: "หน้าอก", eq: "dumbbell", reps: "12 ครั้ง × 3 เซต", tip: "นอนหงายชันเข่า ดันดัมเบลขึ้นตรงๆ เหนืออก" },

    { name: "Superman Hold (นอนคว่ำยกอก-ขา)", muscle: "แผ่นหลัง", eq: "bodyweight", reps: "12-15 ครั้ง × 3 เซต", tip: "ยกอกและต้นขาขึ้นพร้อมกัน เกร็งหลังส่วนล่างค้าง 2 วินาที" },
    { name: "Reverse Snow Angels (วาดแขนบีบสะบัก)", muscle: "แผ่นหลัง", eq: "bodyweight", reps: "12 ครั้ง × 3 เซต", tip: "นอนคว่ำ ยกอกลอยเล็กน้อย วาดแขนจากข้างตัวไปเหนือหัว" },
    { name: "Table / Inverted Row (ดึงตัวใต้โต๊ะ)", muscle: "แผ่นหลัง", eq: "chair", reps: "8-12 ครั้ง × 3 เซต", tip: "นอนใต้โต๊ะที่แข็งแรง จับขอบโต๊ะแล้วดึงอกขึ้นหาโต๊ะ" },
    { name: "Seated Band Row (นั่งดึงยางยืดที่ฝ่าเท้า)", muscle: "แผ่นหลัง", eq: "band", reps: "15 ครั้ง × 3 เซต", tip: "นั่งเหยียดขา คล้องยางยืดที่ฝ่าเท้า ดึงศอกไปด้านหลังบีบสะบัก" },
    { name: "Band Pull-Aparts (ดึงยางยืดกางออกระดับอก)", muscle: "แผ่นหลัง", eq: "band", reps: "15 ครั้ง × 3 เซต", tip: "เหยียดแขนตรงระดับอก ดึงกางออกจนยางยืดแตะหน้าอก" },
    { name: "Dumbbell One-Arm Row (ดึงดัมเบลข้างลำตัว)", muscle: "แผ่นหลัง", eq: "dumbbell", reps: "ข้างละ 12 ครั้ง × 3 เซต", tip: "ยันมือกับเก้าอี้ ดึงดัมเบลขึ้นข้างเอว บีบสะบัก" },

    { name: "Pike Push-ups (วิดพื้นโด่งก้นเน้นไหล่)", muscle: "ไหล่ & แขน", eq: "bodyweight", reps: "8-12 ครั้ง × 3 เซต", tip: "โด่งสะโพกเป็นรูปตัว V คว่ำ งอศอกลดศีรษะลงหาพื้น" },
    { name: "Diamond Push-ups (วิดพื้นมือชิดเน้นหลังแขน)", muscle: "ไหล่ & แขน", eq: "bodyweight", reps: "8-10 ครั้ง × 3 เซต", tip: "วางมือชิดกันเป็นรูปเพชร เน้นกล้ามเนื้อหลังแขนและอกใน" },
    { name: "Chair Dips (ดิปหลังแขนกับเก้าอี้)", muscle: "ไหล่ & แขน", eq: "chair", reps: "10-15 ครั้ง × 3 เซต", tip: "หันหลังให้เก้าอี้ ใช้มือยันขอบแล้วย่อตัวงอศอกลง-ดันขึ้น" },
    { name: "Band Lateral Raises (กางแขนยางยืดไหล่ข้าง)", muscle: "ไหล่ & แขน", eq: "band", reps: "15 ครั้ง × 3 เซต", tip: "เหยียบกลางยางยืด กางแขนออกด้านข้างระดับหัวไหล่" },
    { name: "Band Bicep Curls (พับแขนยางยืดหน้าแขน)", muscle: "ไหล่ & แขน", eq: "band", reps: "15 ครั้ง × 3 เซต", tip: "ล็อกข้อศอกแนบข้างลำตัว พับแขนดึงยางยืดขึ้นหาไหล่" },
    { name: "Dumbbell Shoulder Press & Curls", muscle: "ไหล่ & แขน", eq: "dumbbell", reps: "12 ครั้ง × 3 เซต", tip: "ดันดัมเบลเหนือศีรษะสลับกับพับแขนเล่นหน้าแขน" },

    { name: "Forearm Plank (แพลงก์ตั้งศอก)", muscle: "หน้าท้อง & แกนกลาง", eq: "bodyweight", reps: "ค้างไว้ 30-60 วินาที × 3 เซต", tip: "เกร็งหน้าท้องและก้น อย่าให้หลังแอ่นหรือก้นโด่ง" },
    { name: "Dead Bug (นอนหงายสลับแขน-ขา)", muscle: "หน้าท้อง & แกนกลาง", eq: "bodyweight", reps: "12-16 ครั้ง × 3 เซต", tip: "กดหลังส่วนล่างให้ติดพื้นตลอดเวลาขณะเหยียดแขน-ขา" },
    { name: "Mountain Climbers (วิ่งปีนเขากับพื้น)", muscle: "หน้าท้อง & แกนกลาง", eq: "bodyweight", reps: "30 วินาที × 3 เซต", tip: "ตั้งท่าวิดพื้น แทงเข่าสลับซ้าย-ขวาเร็วๆ ได้ทั้งท้องและคาร์ดิโอ" },
    { name: "Russian Twist (นั่งบิดลำตัวซ้าย-ขวา)", muscle: "หน้าท้อง & แกนกลาง", eq: "bodyweight", reps: "20 ครั้ง × 3 เซต", tip: "เอนหลัง 45 องศา บิดไหล่ซ้าย-ขวาเน้นกล้ามเนื้อข้างเอว" }
];

const exerciseMuscleMap = {
    "Bodyweight Squat (สควอท)": { primary: ["legs", "glutes"], secondary: ["core"], kcal: 14 },
    "Reverse Lunges (ก้าวถอยหลังย่อเข่า)": { primary: ["legs", "glutes"], secondary: ["core"], kcal: 15 },
    "Glute Bridge (นอนยกสะโพก)": { primary: ["glutes"], secondary: ["legs", "core"], kcal: 10 },
    "Wall Sit (นั่งพิงกำแพง)": { primary: ["legs"], secondary: ["glutes", "core"], kcal: 11 },
    "Calf Raises (ยืนเขย่งน่อง)": { primary: ["legs"], secondary: [], kcal: 8 },
    "Bulgarian Split Squat (พาดขาหลังกับเก้าอี้)": { primary: ["legs", "glutes"], secondary: ["core"], kcal: 16 },
    "Band Squat (สควอทต้านยางยืด)": { primary: ["legs", "glutes"], secondary: ["core"], kcal: 15 },
    "Dumbbell Goblet Squat (ถือดัมเบลสควอท)": { primary: ["legs", "glutes"], secondary: ["core", "arms"], kcal: 16 },
    "Standard Push-ups (วิดพื้นมาตรฐาน)": { primary: ["chest"], secondary: ["shoulders", "arms", "core"], kcal: 12 },
    "Wide Push-ups (วิดพื้นกางแขนกว้าง)": { primary: ["chest"], secondary: ["shoulders", "arms"], kcal: 12 },
    "Incline Push-ups (วิดพื้นกับขอบโต๊ะ/เก้าอี้)": { primary: ["chest"], secondary: ["shoulders", "arms"], kcal: 10 },
    "Decline Push-ups (พาดเท้าบนเก้าอี้วิดพื้น)": { primary: ["chest", "shoulders"], secondary: ["arms", "core"], kcal: 14 },
    "Band Chest Press (ดันยางยืดอ้อมหลัง)": { primary: ["chest"], secondary: ["shoulders", "arms"], kcal: 11 },
    "Dumbbell Floor Press (นอนพื้นดันดัมเบล)": { primary: ["chest"], secondary: ["arms", "shoulders"], kcal: 12 },
    "Superman Hold (นอนคว่ำยกอก-ขา)": { primary: ["back"], secondary: ["glutes"], kcal: 9 },
    "Reverse Snow Angels (วาดแขนบีบสะบัก)": { primary: ["back"], secondary: ["shoulders"], kcal: 9 },
    "Table / Inverted Row (ดึงตัวใต้โต๊ะ)": { primary: ["back"], secondary: ["arms", "shoulders"], kcal: 14 },
    "Seated Band Row (นั่งดึงยางยืดที่ฝ่าเท้า)": { primary: ["back"], secondary: ["arms"], kcal: 11 },
    "Band Pull-Aparts (ดึงยางยืดกางออกระดับอก)": { primary: ["back", "shoulders"], secondary: [], kcal: 9 },
    "Dumbbell One-Arm Row (ดึงดัมเบลข้างลำตัว)": { primary: ["back"], secondary: ["arms"], kcal: 13 },
    "Pike Push-ups (วิดพื้นโด่งก้นเน้นไหล่)": { primary: ["shoulders"], secondary: ["arms", "chest"], kcal: 12 },
    "Diamond Push-ups (วิดพื้นมือชิดเน้นหลังแขน)": { primary: ["arms", "chest"], secondary: ["shoulders"], kcal: 13 },
    "Chair Dips (ดิปหลังแขนกับเก้าอี้)": { primary: ["arms"], secondary: ["shoulders", "chest"], kcal: 11 },
    "Band Lateral Raises (กางแขนยางยืดไหล่ข้าง)": { primary: ["shoulders"], secondary: [], kcal: 9 },
    "Band Bicep Curls (พับแขนยางยืดหน้าแขน)": { primary: ["arms"], secondary: [], kcal: 9 },
    "Dumbbell Shoulder Press & Curls": { primary: ["shoulders", "arms"], secondary: ["core"], kcal: 13 },
    "Forearm Plank (แพลงก์ตั้งศอก)": { primary: ["core"], secondary: ["shoulders"], kcal: 9 },
    "Dead Bug (นอนหงายสลับแขน-ขา)": { primary: ["core"], secondary: [], kcal: 9 },
    "Mountain Climbers (วิ่งปีนเขากับพื้น)": { primary: ["core"], secondary: ["legs", "shoulders"], kcal: 15 },
    "Russian Twist (นั่งบิดลำตัวซ้าย-ขวา)": { primary: ["core"], secondary: [], kcal: 10 }
};

let customBuilderSelection = JSON.parse(localStorage.getItem('fitTracker_custom_builder') || 'null') || {
    "Bodyweight Squat (สควอท)": 3,
    "Standard Push-ups (วิดพื้นมาตรฐาน)": 3,
    "Glute Bridge (นอนยกสะโพก)": 3,
    "Forearm Plank (แพลงก์ตั้งศอก)": 3
};
let customBuilderFilter = "all";
let userCustomExercises = JSON.parse(localStorage.getItem('fitTracker_user_exercises') || '[]');

function saveCourseConfig() {
    let eq = ['bodyweight'];
    if (document.getElementById('eq-chair')?.checked) eq.push('chair');
    if (document.getElementById('eq-band')?.checked) eq.push('band');
    if (document.getElementById('eq-dumbbell')?.checked) eq.push('dumbbell');
    courseConfig = { equipment: eq, schedule: document.getElementById('course-schedule-select')?.value || '3days' };
    localStorage.setItem('fitTracker_course', JSON.stringify(courseConfig));
    renderWorkoutCourseContent();
}

function switchCourseTab(tab) {
    currentCourseTab = tab;
    ['today', 'custom', 'library'].forEach(t => {
        const el = document.getElementById(`course-tab-${t}`);
        if (el) {
            el.className = (t === tab)
                ? "py-1.5 rounded-lg text-[11px] font-semibold bg-indigo-600 text-white"
                : "py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-white";
        }
    });
    renderWorkoutCourseContent();
}

function setCustomWorkoutFocus(focusKey) {
    customFocusOverride = focusKey;
    renderWorkoutCourseContent();
}

function toggleBuilderExercise(exName) {
    if (customBuilderSelection[exName]) delete customBuilderSelection[exName];
    else customBuilderSelection[exName] = 3;
    localStorage.setItem('fitTracker_custom_builder', JSON.stringify(customBuilderSelection));
    renderWorkoutCourseContent();
}

function changeBuilderSets(exName, delta, event) {
    if (event) event.stopPropagation();
    const cur = customBuilderSelection[exName] || 3;
    customBuilderSelection[exName] = Math.max(1, Math.min(10, cur + delta));
    localStorage.setItem('fitTracker_custom_builder', JSON.stringify(customBuilderSelection));
    renderWorkoutCourseContent();
}

function setBuilderFilter(cat) {
    customBuilderFilter = cat;
    renderWorkoutCourseContent();
}

function addUserCustomExerciseToBuilder() {
    const nameEl = document.getElementById('builder-custom-name');
    const muscleEl = document.getElementById('builder-custom-muscle');
    const name = (nameEl?.value || '').trim();
    if (!name) return;

    const muscleCode = muscleEl.value;
    const muscleGroupLabel = {
        chest: "หน้าอก", back: "แผ่นหลัง", legs: "ขา & ก้น", glutes: "ขา & ก้น",
        shoulders: "ไหล่ & แขน", arms: "ไหล่ & แขน", core: "หน้าท้อง & แกนกลาง"
    }[muscleCode] || "หน้าท้อง & แกนกลาง";

    userCustomExercises.unshift({ name, muscle: muscleGroupLabel, eq: "bodyweight", reps: "12-15 ครั้ง × 3 เซต", tip: "ท่าที่เพิ่มเอง", customPrimary: [muscleCode] });
    localStorage.setItem('fitTracker_user_exercises', JSON.stringify(userCustomExercises));
    customBuilderSelection[name] = 3;
    localStorage.setItem('fitTracker_custom_builder', JSON.stringify(customBuilderSelection));
    renderWorkoutCourseContent();
}

function saveCustomBuilderWorkout() {
    const selectedNames = Object.keys(customBuilderSelection);
    if (selectedNames.length === 0) return alert("กรุณาเลือกท่าที่เล่นอย่างน้อย 1 ท่าก่อนบันทึกครับ");

    let totalSets = 0, totalKcal = 0;
    const exercisesDetail = selectedNames.map(name => {
        const sets = customBuilderSelection[name] || 3;
        const userEx = userCustomExercises.find(u => u.name === name);
        const meta = exerciseMuscleMap[name] || { kcal: 12 };
        totalSets += sets;
        totalKcal += sets * meta.kcal;
        return { name, sets, reps: userEx?.reps || "12-15 ครั้ง" };
    });

    const estMinutes = Math.max(5, Math.round(totalSets * 1.5));
    const title = `เวทเลือกท่าเอง (${selectedNames.length} ท่า: ${selectedNames.map(n => n.split('(')[0].trim()).slice(0, 3).join(', ')}${selectedNames.length > 3 ? '...' : ''})`;
    logCourseWorkoutToToday(title, estMinutes, Math.round(totalKcal), exercisesDetail);
}

function logCourseWorkoutToToday(title, duration, calories, exercises = null) {
    const entry = { type: title, duration: Number(duration) || 0, calories: Number(calories) || 0 };
    if (Array.isArray(exercises) && exercises.length > 0) entry.exercises = exercises;
    getDayData(currentDateKey).workouts.push(entry);
    saveDataAndSync();
}

function renderWorkoutCourseContent() {
    const container = document.getElementById('course-content-container');
    if (!container) return;

    const availableEq = courseConfig.equipment || ['bodyweight'];
    const filteredExercises = [...userCustomExercises, ...nonMachineExercises.filter(ex => availableEq.includes(ex.eq))];

    if (currentCourseTab === 'custom') {
        const prevListEl = document.getElementById('custom-builder-list');
        const prevScrollTop = prevListEl ? prevListEl.scrollTop : 0;
        const selectedNames = Object.keys(customBuilderSelection);
        const primarySet = new Set(), secondarySet = new Set();
        let totalKcal = 0, totalSets = 0;

        selectedNames.forEach(name => {
            const sets = customBuilderSelection[name] || 3;
            totalSets += sets;
            const userEx = userCustomExercises.find(u => u.name === name);
            const meta = exerciseMuscleMap[name] || { primary: userEx?.customPrimary || ["core"], secondary: [], kcal: 12 };
            totalKcal += sets * meta.kcal;
            meta.primary.forEach(m => primarySet.add(m));
            (meta.secondary || []).forEach(m => secondarySet.add(m));
        });

        const getPartColor = (m) => primarySet.has(m) ? "#f43f5e" : (secondarySet.has(m) ? "#fbbf24" : "#2d334a");
        const muscleThai = { chest: "อก", back: "หลัง", legs: "ต้นขา", glutes: "ก้น", shoulders: "ไหล่", arms: "แขน", core: "หน้าท้อง" };
        const primaryListThai = [...primarySet].map(m => muscleThai[m] || m).join(", ");
        const secondaryListThai = [...secondarySet].filter(m => !primarySet.has(m)).map(m => muscleThai[m] || m).join(", ");

        const catButtons = [
            { id: "all", label: "ทั้งหมด" }, { id: "ขา & ก้น", label: "ขา/ก้น" }, { id: "หน้าอก", label: "อก" },
            { id: "แผ่นหลัง", label: "หลัง" }, { id: "ไหล่ & แขน", label: "ไหล่/แขน" }, { id: "หน้าท้อง & แกนกลาง", label: "ท้อง" }
        ];
        const visibleExercises = filteredExercises.filter(ex => customBuilderFilter === "all" || ex.muscle === customBuilderFilter);

        container.innerHTML = `
            <div class="bg-slate-950/90 border border-indigo-500/30 rounded-2xl p-3 space-y-2.5">
                <div class="flex justify-between items-center text-[11px]">
                    <span class="font-bold text-white"><i class="fa-solid fa-child-reaching text-rose-400 mr-1"></i> จุดกล้ามเนื้อที่โดนวันนี้</span>
                    <div class="flex items-center gap-2 text-[10px]">
                        <span class="flex items-center gap-1 text-rose-300"><i class="w-2 h-2 rounded-full bg-rose-500 inline-block"></i>หลัก</span>
                        <span class="flex items-center gap-1 text-amber-300"><i class="w-2 h-2 rounded-full bg-amber-400 inline-block"></i>รอง</span>
                    </div>
                </div>
                <div class="grid grid-cols-12 items-center gap-2">
                    <div class="col-span-6 flex justify-center gap-2 bg-slate-900/90 py-2 px-1 rounded-xl border border-slate-800">
                        <div class="text-center">
                            <svg viewBox="0 0 100 205" class="w-16 h-32">
                                <circle cx="50" cy="18" r="10" fill="#262b3d" />
                                <path d="M35,33 Q50,29 65,33 L69,84 L61,113 L39,113 L31,84 Z" fill="#1b2030" stroke="#333a52" stroke-width="1"/>
                                <ellipse cx="29" cy="41" rx="6.5" ry="8.5" fill="${getPartColor('shoulders')}"/><ellipse cx="71" cy="41" rx="6.5" ry="8.5" fill="${getPartColor('shoulders')}"/>
                                <path d="M36,37 Q50,41 64,37 L62,57 Q50,61 38,57 Z" fill="${getPartColor('chest')}"/>
                                <rect x="41" y="60" width="18" height="40" rx="4" fill="${getPartColor('core')}"/>
                                <rect x="19" y="51" width="7.5" height="35" rx="3.5" fill="${getPartColor('arms')}"/><rect x="73.5" y="51" width="7.5" height="35" rx="3.5" fill="${getPartColor('arms')}"/>
                                <path d="M37,115 L49,115 L47,160 L36,160 Z" fill="${getPartColor('legs')}"/><path d="M51,115 L63,115 L64,160 L53,160 Z" fill="${getPartColor('legs')}"/>
                            </svg>
                            <span class="text-[9px] text-slate-400 block">ด้านหน้า</span>
                        </div>
                        <div class="text-center">
                            <svg viewBox="0 0 100 205" class="w-16 h-32">
                                <circle cx="50" cy="18" r="10" fill="#262b3d" />
                                <path d="M35,33 Q50,29 65,33 L69,84 L61,113 L39,113 L31,84 Z" fill="#1b2030" stroke="#333a52" stroke-width="1"/>
                                <path d="M36,37 L64,37 L59,85 L41,85 Z" fill="${getPartColor('back')}"/>
                                <rect x="19" y="51" width="7.5" height="35" rx="3.5" fill="${getPartColor('arms')}"/><rect x="73.5" y="51" width="7.5" height="35" rx="3.5" fill="${getPartColor('arms')}"/>
                                <ellipse cx="43" cy="103" rx="8.5" ry="10.5" fill="${getPartColor('glutes')}"/><ellipse cx="57" cy="103" rx="8.5" ry="10.5" fill="${getPartColor('glutes')}"/>
                                <path d="M37,116 L49,116 L47,160 L36,160 Z" fill="${getPartColor('legs')}"/><path d="M51,116 L63,116 L64,160 L53,160 Z" fill="${getPartColor('legs')}"/>
                            </svg>
                            <span class="text-[9px] text-slate-400 block">ด้านหลัง</span>
                        </div>
                    </div>
                    <div class="col-span-6 space-y-1.5 text-[11px]">
                        <div class="bg-slate-900 p-2 rounded-xl border border-slate-800 space-y-1">
                            <div><span class="text-slate-400">โดนหลัก:</span> <b class="text-rose-400">${primaryListThai || '-'}</b></div>
                            ${secondaryListThai ? `<div><span class="text-slate-400">กล้ามเนื้อรอง:</span> <span class="text-amber-300 font-medium">${secondaryListThai}</span></div>` : ''}
                            <div class="text-[10px] text-orange-300 pt-0.5 border-t border-slate-800/80">รวม ${selectedNames.length} ท่า (${totalSets} เซต) • <b>-${totalKcal} kcal</b></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex flex-wrap gap-1">
                ${catButtons.map(b => `<button type="button" onclick="setBuilderFilter('${b.id}')" class="px-2 py-1 rounded-lg text-[10px] font-semibold border ${customBuilderFilter === b.id ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-slate-950 text-slate-400 border-slate-800'}">${b.label}</button>`).join('')}
            </div>

            <div id="custom-builder-list" class="v59-dark-scroll space-y-1.5 max-h-56 overflow-y-auto pr-1">
                ${visibleExercises.map(ex => {
                    const isChecked = !!customBuilderSelection[ex.name];
                    const sets = customBuilderSelection[ex.name] || 3;
                    const safeName = ex.name.replace(/'/g, "\\'");
                    const meta = exerciseMuscleMap[ex.name] || { primary: ex.customPrimary || ["core"] };
                    const pText = meta.primary.map(m => muscleThai[m] || m).join(",");
                    return `
                        <div class="flex items-center justify-between gap-2 p-2 rounded-xl border ${isChecked ? 'bg-indigo-950/40 border-indigo-500/50' : 'bg-slate-950/70 border-slate-800'}">
                            <label class="flex items-start gap-2 cursor-pointer flex-1 min-w-0">
                                <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleBuilderExercise('${safeName}')" class="w-4 h-4 mt-0.5 accent-indigo-500 rounded shrink-0">
                                <div class="min-w-0">
                                    <div class="text-xs font-semibold text-white truncate">${ex.name}</div>
                                    <div class="text-[10px] text-slate-400">เน้น: <span class="text-rose-400">${pText}</span> • ${ex.reps.split('×')[0].trim()}</div>
                                </div>
                            </label>
                            ${isChecked ? `
                                <div class="flex items-center gap-0.5 bg-slate-900 border border-slate-700 rounded-lg px-1 py-0.5 shrink-0">
                                    <button type="button" onclick="changeBuilderSets('${safeName}', -1, event)" class="w-5 h-5 text-slate-300 text-xs font-bold">-</button>
                                    <span class="text-[11px] font-bold text-amber-300 px-1">${sets} เซต</span>
                                    <button type="button" onclick="changeBuilderSets('${safeName}', 1, event)" class="w-5 h-5 text-slate-300 text-xs font-bold">+</button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="flex gap-1.5 pt-1">
                <input type="text" id="builder-custom-name" placeholder="+ เพิ่มชื่อท่าเอง..." class="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white" />
                <select id="builder-custom-muscle" class="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-[11px] text-slate-300">
                    <option value="chest">อก</option><option value="back">หลัง</option><option value="legs">ขา</option><option value="glutes">ก้น</option><option value="shoulders">ไหล่</option><option value="arms">แขน</option><option value="core">ท้อง</option>
                </select>
                <button type="button" onclick="addUserCustomExerciseToBuilder()" class="bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl">เพิ่ม</button>
            </div>

            <div class="grid grid-cols-12 gap-2 pt-1">
                <button type="button" onclick="startGuidedWorkoutPlayer()" class="col-span-7 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5">
                    <i class="fa-solid fa-play"></i> เริ่มเล่นตามคิว (${selectedNames.length} ท่า)
                </button>
                <button type="button" onclick="saveCustomBuilderWorkout()" class="col-span-5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 px-2 rounded-xl flex items-center justify-center gap-1">
                    <i class="fa-solid fa-check"></i> บันทึกเลย (-${totalKcal})
                </button>
            </div>
        `;
        const nextListEl = document.getElementById('custom-builder-list');
        if (nextListEl) nextListEl.scrollTop = prevScrollTop;
        return;
    }

    if (currentCourseTab === 'library') {
        const groups = ["ขา & ก้น", "หน้าอก", "แผ่นหลัง", "ไหล่ & แขน", "หน้าท้อง & แกนกลาง"];
        const eqLabels = { bodyweight: "มือเปล่า", chair: "เก้าอี้/โต๊ะ", band: "ยางยืด", dumbbell: "ดัมเบล" };
        container.innerHTML = groups.map(g => {
            const list = filteredExercises.filter(ex => ex.muscle === g);
            if (list.length === 0) return '';
            return `
                <div class="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
                    <div class="text-xs font-bold text-indigo-400">${g} (${list.length} ท่า)</div>
                    <div class="space-y-1.5">
                        ${list.map(ex => {
                            const hasPhoto = !!window.exercisePhotosMap[ex.name];
                            const safeName = ex.name.replace(/'/g, "\\'");
                            return `
                                <div class="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80 text-xs">
                                    <div class="flex justify-between items-start gap-2">
                                        <span class="font-semibold text-white">${ex.name}</span>
                                        <span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 shrink-0">${eqLabels[ex.eq] || 'กำหนดเอง'}</span>
                                    </div>
                                    <div class="text-[10px] text-emerald-400 font-medium mt-0.5">${ex.reps}</div>
                                    <div class="text-[10px] text-slate-400 mt-0.5">${ex.tip}</div>
                                    <div class="mt-1.5 flex justify-end">
                                        <button type="button" onclick="openExercisePhotoModal('${safeName}')" class="text-[10px] ${hasPhoto ? 'bg-sky-950 text-sky-300 border-sky-700/50' : 'bg-slate-800 text-slate-300 border-slate-700'} px-2.5 py-1 rounded-lg border">
                                            <i class="fa-regular fa-image"></i> ${hasPhoto ? 'ดูรูปสเต็ปท่า' : '+ ใส่รูปตัวอย่าง'}
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');
        return;
    }

    // Tab: 'today'
    const parts = currentDateKey.split('-');
    const dayOfWeek = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
    const dayNamesShort = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    const schedules = {
        '3days': [
            { day: 1, type: 'weight', label: 'เวททั่วร่าง A', focus: 'Full Body' }, { day: 2, type: 'cardio', label: 'เดินเร็ว/คาร์ดิโอ', focus: 'Cardio' },
            { day: 3, type: 'weight', label: 'เวททั่วร่าง B', focus: 'Full Body' }, { day: 4, type: 'rest', label: 'วันพักฟื้น', focus: 'Rest' },
            { day: 5, type: 'weight', label: 'เวททั่วร่าง C', focus: 'Full Body' }, { day: 6, type: 'cardio', label: 'เดิน/กิจกรรมเบา', focus: 'Cardio' },
            { day: 0, type: 'rest', label: 'วันพักฟื้น', focus: 'Rest' }
        ],
        '4days': [
            { day: 1, type: 'weight', label: 'ช่วงบน (อก/หลัง/แขน)', focus: 'Upper' }, { day: 2, type: 'weight', label: 'ช่วงล่าง (ขา/ก้น/ท้อง)', focus: 'Lower' },
            { day: 3, type: 'rest', label: 'วันพักฟื้น', focus: 'Rest' }, { day: 4, type: 'weight', label: 'ช่วงบน (ไหล่/หลัง/อก)', focus: 'Upper' },
            { day: 5, type: 'weight', label: 'ช่วงล่าง & แกนกลาง', focus: 'Lower' }, { day: 6, type: 'cardio', label: 'เดินเร็ว 30-40 นาที', focus: 'Cardio' },
            { day: 0, type: 'rest', label: 'วันพักฟื้น', focus: 'Rest' }
        ],
        '5days': [
            { day: 1, type: 'weight', label: 'อก & หลังแขน', focus: 'Push' }, { day: 2, type: 'weight', label: 'หลัง & หน้าแขน', focus: 'Pull' },
            { day: 3, type: 'weight', label: 'ขา & สะโพก', focus: 'Legs' }, { day: 4, type: 'weight', label: 'หัวไหล่ & ท้อง', focus: 'ShouldersCore' },
            { day: 5, type: 'weight', label: 'เวททั่วร่าง + เบิร์น', focus: 'FullBurn' }, { day: 6, type: 'rest', label: 'วันพักฟื้น', focus: 'Rest' },
            { day: 0, type: 'rest', label: 'วันพักฟื้น', focus: 'Rest' }
        ]
    };

    const activePlan = schedules[courseConfig.schedule] || schedules['3days'];
    const basePlan = activePlan.find(p => p.day === dayOfWeek);
    const focusLabels = { Legs: 'เน้นขา & สะโพก', ArmsShoulders: 'เน้นแขน & ไหล่', ChestBack: 'เน้นอก & หลัง', CoreBurn: 'เน้นท้อง & เบิร์น' };
    const todayPlan = customFocusOverride ? { day: dayOfWeek, type: 'weight', label: focusLabels[customFocusOverride], focus: customFocusOverride } : basePlan;

    const orderedWeek = [1, 2, 3, 4, 5, 6, 0].map(dIdx => activePlan.find(p => p.day === dIdx));
    const weekStripHtml = `
        <div class="grid grid-cols-7 gap-1 text-center">
            ${orderedWeek.map(p => {
                const isToday = p.day === dayOfWeek;
                const badgeColor = p.type === 'weight' ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700/50' : (p.type === 'cardio' ? 'bg-orange-950/70 text-orange-300 border-orange-700/50' : 'bg-slate-900 text-slate-400 border-slate-800');
                const icon = p.type === 'weight' ? '💪' : (p.type === 'cardio' ? '🏃' : '🛌');
                return `<div class="p-1.5 rounded-xl border ${badgeColor} ${isToday ? 'ring-2 ring-amber-400' : ''}"><div class="text-[10px] font-bold">${dayNamesShort[p.day]}</div><div class="text-xs my-0.5">${icon}</div><div class="text-[8px]">${p.type === 'weight' ? 'เวท' : (p.type === 'cardio' ? 'คาร์ดิโอ' : 'พัก')}</div></div>`;
            }).join('')}
        </div>
    `;

    const focusSelectorHtml = `
        <div class="flex flex-wrap gap-1.5 text-[10px]">
            <button type="button" onclick="setCustomWorkoutFocus(null)" class="px-2 py-1 rounded-lg border ${!customFocusOverride ? 'bg-indigo-600 text-white border-indigo-400 font-semibold' : 'bg-slate-950 text-slate-300 border-slate-800'}">ตามตาราง</button>
            <button type="button" onclick="setCustomWorkoutFocus('Legs')" class="px-2 py-1 rounded-lg border ${customFocusOverride === 'Legs' ? 'bg-emerald-600 text-white border-emerald-400 font-semibold' : 'bg-slate-950 text-slate-300 border-slate-800'}">🦵 ขา & ก้น</button>
            <button type="button" onclick="setCustomWorkoutFocus('ArmsShoulders')" class="px-2 py-1 rounded-lg border ${customFocusOverride === 'ArmsShoulders' ? 'bg-emerald-600 text-white border-emerald-400 font-semibold' : 'bg-slate-950 text-slate-300 border-slate-800'}">💪 แขน & ไหล่</button>
            <button type="button" onclick="setCustomWorkoutFocus('ChestBack')" class="px-2 py-1 rounded-lg border ${customFocusOverride === 'ChestBack' ? 'bg-emerald-600 text-white border-emerald-400 font-semibold' : 'bg-slate-950 text-slate-300 border-slate-800'}">🏋️ อก & หลัง</button>
            <button type="button" onclick="setCustomWorkoutFocus('CoreBurn')" class="px-2 py-1 rounded-lg border ${customFocusOverride === 'CoreBurn' ? 'bg-emerald-600 text-white border-emerald-400 font-semibold' : 'bg-slate-950 text-slate-300 border-slate-800'}">🔥 ท้อง & เบิร์น</button>
        </div>
    `;

    let routineHtml = '';
    if (todayPlan.type === 'rest') {
        routineHtml = `<div class="bg-emerald-950/30 border border-emerald-800/40 rounded-2xl p-4 text-center space-y-1"><div class="text-2xl">🛌</div><div class="text-xs font-bold text-emerald-300">วันพักฟื้นกล้ามเนื้อ (Rest Day)</div><p class="text-[11px] text-slate-300">ทานโปรตีนให้ถึงเป้า ดื่มน้ำให้เพียงพอ เพื่อให้กล้ามเนื้อซ่อมแซมและเติบโต</p></div>`;
    } else if (todayPlan.type === 'cardio') {
        routineHtml = `
            <div class="bg-orange-950/30 border border-orange-800/40 rounded-2xl p-3 space-y-2 text-xs">
                <div class="font-bold text-orange-300">🏃 คอร์สคาร์ดิโอ & เผาผลาญไขมัน (35-40 นาที)</div>
                <button type="button" onclick="logCourseWorkoutToToday('คอร์สเดินเร็ว/คาร์ดิโอตามตาราง', 35, 190)" class="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold py-2 rounded-xl">บันทึกจบคาร์ดิโอวันนี้ (-190 kcal)</button>
            </div>
        `;
    } else {
        const pickByMuscle = (m, count) => {
            const list = filteredExercises.filter(e => e.muscle === m);
            return [...list.filter(e => e.eq !== 'bodyweight'), ...list.filter(e => e.eq === 'bodyweight')].slice(0, count);
        };
        let selectedRoutine = [];
        if (todayPlan.focus === 'Upper') selectedRoutine = [...pickByMuscle('หน้าอก', 2), ...pickByMuscle('แผ่นหลัง', 2), ...pickByMuscle('ไหล่ & แขน', 2)];
        else if (todayPlan.focus === 'Lower' || todayPlan.focus === 'Legs') selectedRoutine = [...pickByMuscle('ขา & ก้น', 4), ...pickByMuscle('หน้าท้อง & แกนกลาง', 1)];
        else if (todayPlan.focus === 'ArmsShoulders') selectedRoutine = [...pickByMuscle('ไหล่ & แขน', 4), ...pickByMuscle('หน้าอก', 1)];
        else if (todayPlan.focus === 'ChestBack') selectedRoutine = [...pickByMuscle('หน้าอก', 3), ...pickByMuscle('แผ่นหลัง', 3)];
        else if (todayPlan.focus === 'CoreBurn') selectedRoutine = [...pickByMuscle('หน้าท้อง & แกนกลาง', 4), ...pickByMuscle('ขา & ก้น', 1)];
        else selectedRoutine = [...pickByMuscle('ขา & ก้น', 2), ...pickByMuscle('หน้าอก', 1), ...pickByMuscle('แผ่นหลัง', 1), ...pickByMuscle('ไหล่ & แขน', 1), ...pickByMuscle('หน้าท้อง & แกนกลาง', 1)];

        const routineDetail = selectedRoutine.map(ex => ({ name: ex.name, sets: 3, reps: ex.reps }));
        const routineJsonAttr = encodeURIComponent(JSON.stringify(routineDetail));

        routineHtml = `
            <div class="bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-3 space-y-2">
                <div class="text-xs font-bold text-white">โปรแกรม: <span class="text-indigo-400">${todayPlan.label}</span> (${selectedRoutine.length} ท่า)</div>
                <div class="space-y-1.5">
                    ${selectedRoutine.map((ex, idx) => {
                        const safeName = ex.name.replace(/'/g, "\\'");
                        return `
                            <div class="bg-slate-900 p-2 rounded-xl border border-slate-800 text-xs flex justify-between items-center gap-2">
                                <div>
                                    <div class="font-semibold text-white"><span class="text-amber-400 mr-1">${idx + 1}.</span>${ex.name}</div>
                                    <div class="text-[10px] text-slate-400">${ex.reps} • ${ex.tip}</div>
                                </div>
                                <button type="button" onclick="openExercisePhotoModal('${safeName}')" class="shrink-0 bg-slate-800 text-sky-300 text-[10px] px-2 py-1 rounded-lg border border-slate-700"><i class="fa-regular fa-image"></i></button>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="grid grid-cols-3 gap-1.5 pt-1">
                    <button type="button" onclick="logCourseWorkoutToToday('คอร์ส${todayPlan.label} (1 เซต)', 12, 70, JSON.parse(decodeURIComponent('${routineJsonAttr}')).map(x => ({...x, sets: 1})))" class="bg-slate-800 text-slate-200 text-[11px] font-semibold py-2 rounded-xl">1 เซต (-70)</button>
                    <button type="button" onclick="logCourseWorkoutToToday('คอร์ส${todayPlan.label} (2 เซต)', 24, 140, JSON.parse(decodeURIComponent('${routineJsonAttr}')).map(x => ({...x, sets: 2})))" class="bg-indigo-900/80 text-indigo-200 text-[11px] font-semibold py-2 rounded-xl">2 เซต (-140)</button>
                    <button type="button" onclick="logCourseWorkoutToToday('คอร์ส${todayPlan.label} (ครบ 3 เซต)', 35, 210, JSON.parse(decodeURIComponent('${routineJsonAttr}')))" class="bg-indigo-600 text-white text-[11px] font-semibold py-2 rounded-xl">3 เซต (-210)</button>
                </div>
            </div>
        `;
    }

    container.innerHTML = `${weekStripHtml}${focusSelectorHtml}${routineHtml}`;
}

// ------------------------------------------
// 4. Active Workout Player (จัดคิวสลับกลุ่มกล้ามเนื้อ + หุ่นเคลื่อนไหว SVG)
// ------------------------------------------
let activeWorkoutQueue = [], playerCurrentStepIdx = 0, playerCurrentSet = 1, playerIsResting = false, playerTimerInterval = null, playerSecondsLeft = 0, playerRestDuration = 60;

function playRestBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
}

function findExerciseGuideInfo(exName) {
    const found = [...userCustomExercises, ...nonMachineExercises].find(e => e.name.toLowerCase().includes(exName.toLowerCase()));
    return {
        muscleText: found?.muscle || "ระบุตามท่า",
        howTo: found?.tip || "รักษาแนวหลังให้ตรง เกร็งแกนกลางลำตัว หายใจออกจังหวะออกแรง"
    };
}

function buildSmartAlternatingQueue(selectedNames) {
    const items = selectedNames.map(name => {
        const sets = customBuilderSelection[name] || 3;
        const userEx = userCustomExercises.find(u => u.name === name);
        const libEx = nonMachineExercises.find(e => e.name === name);
        const meta = exerciseMuscleMap[name] || { primary: userEx?.customPrimary || ["core"], kcal: 12 };
        const guide = findExerciseGuideInfo(name);
        return { name, sets, reps: (userEx?.reps || libEx?.reps || "12-15 ครั้ง").split('×')[0].trim(), primaryKey: meta.primary[0] || "core", kcalPerSet: meta.kcal, muscleText: guide.muscleText, howTo: guide.howTo };
    });

    const ordered = [], remaining = [...items];
    let lastMuscle = null;
    while (remaining.length > 0) {
        let pickIdx = remaining.findIndex(item => item.primaryKey !== lastMuscle);
        if (pickIdx === -1) pickIdx = 0;
        const chosen = remaining.splice(pickIdx, 1)[0];
        ordered.push(chosen);
        lastMuscle = chosen.primaryKey;
    }
    return ordered;
}

function getAnimatedExerciseSvg(exName) {
    const lower = exName.toLowerCase();
    if (lower.includes('plank') || lower.includes('แพลงก์')) {
        return `<svg viewBox="0 0 200 110" class="w-48 h-28 mx-auto"><line x1="15" y1="90" x2="185" y2="90" stroke="#334155" stroke-width="2"/><g><animateTransform attributeName="transform" type="translate" values="0,0; 0,-2; 0,0" dur="2.5s" repeatCount="indefinite"/><circle cx="42" cy="58" r="9" fill="#fbbf24"/><line x1="50" y1="62" x2="115" y2="66" stroke="#38bdf8" stroke-width="6" stroke-linecap="round"/><polyline points="55,63 52,88 68,88" fill="none" stroke="#94a3b8" stroke-width="4.5" stroke-linecap="round"/><line x1="115" y1="66" x2="168" y2="87" stroke="#f43f5e" stroke-width="5" stroke-linecap="round"/></g></svg>`;
    }
    if (lower.includes('push') || lower.includes('วิดพื้น') || lower.includes('dip') || lower.includes('climber')) {
        return `<svg viewBox="0 0 200 115" class="w-48 h-28 mx-auto"><line x1="15" y1="95" x2="185" y2="95" stroke="#334155" stroke-width="2"/><g><animateTransform attributeName="transform" type="rotate" values="0 165 92; 9 165 92; 0 165 92" dur="2s" repeatCount="indefinite"/><circle cx="44" cy="48" r="9" fill="#fbbf24"/><line x1="52" y1="53" x2="165" y2="92" stroke="#f43f5e" stroke-width="6" stroke-linecap="round"/><line x1="62" y1="57" x2="58" y2="92" stroke="#38bdf8" stroke-width="4.5" stroke-linecap="round"/></g></svg>`;
    }
    return `<svg viewBox="0 0 160 130" class="w-44 h-28 mx-auto"><line x1="25" y1="115" x2="135" y2="115" stroke="#334155" stroke-width="2"/><g><animateTransform attributeName="transform" type="translate" values="0,0; 0,18; 0,0" dur="2.2s" repeatCount="indefinite"/><circle cx="80" cy="24" r="9" fill="#fbbf24"/><line x1="80" y1="34" x2="74" y2="68" stroke="#38bdf8" stroke-width="6" stroke-linecap="round"/><line x1="79" y1="42" x2="108" y2="45" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/></g><polyline points="74,68 92,90 78,113" fill="none" stroke="#f43f5e" stroke-width="5.5" stroke-linecap="round"><animate attributeName="points" values="74,68 82,90 78,113; 66,86 96,92 78,113; 74,68 82,90 78,113" dur="2.2s" repeatCount="indefinite"/></polyline></svg>`;
}

function startGuidedWorkoutPlayer() {
    const selectedNames = Object.keys(customBuilderSelection);
    if (selectedNames.length === 0) return alert("กรุณาเลือกท่าที่เล่นอย่างน้อย 1 ท่าก่อนเริ่มครับ");
    activeWorkoutQueue = buildSmartAlternatingQueue(selectedNames);
    playerCurrentStepIdx = 0;
    playerCurrentSet = 1;
    playerIsResting = false;
    clearInterval(playerTimerInterval);
    renderGuidedWorkoutPlayerModal();
}

function startPlayerRestCountdown(seconds) {
    clearInterval(playerTimerInterval);
    playerRestDuration = seconds;
    playerSecondsLeft = seconds;
    playerIsResting = true;
    renderGuidedWorkoutPlayerModal();

    playerTimerInterval = setInterval(() => {
        playerSecondsLeft--;
        const el = document.getElementById('player-rest-clock');
        if (el) el.innerText = `${String(Math.floor(playerSecondsLeft / 60)).padStart(2, '0')}:${String(playerSecondsLeft % 60).padStart(2, '0')}`;
        if (playerSecondsLeft <= 0) {
            clearInterval(playerTimerInterval);
            playRestBeep();
            if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
            advanceToNextSetOrExercise();
        }
    }, 1000);
}

function advanceToNextSetOrExercise() {
    clearInterval(playerTimerInterval);
    playerIsResting = false;
    const curEx = activeWorkoutQueue[playerCurrentStepIdx];
    if (!curEx) return;
    if (playerCurrentSet < curEx.sets) playerCurrentSet++;
    else if (playerCurrentStepIdx < activeWorkoutQueue.length - 1) { playerCurrentStepIdx++; playerCurrentSet = 1; }
    else return finishGuidedWorkout();
    renderGuidedWorkoutPlayerModal();
}

function completeCurrentPlayerSet() {
    const curEx = activeWorkoutQueue[playerCurrentStepIdx];
    if (playerCurrentStepIdx === activeWorkoutQueue.length - 1 && playerCurrentSet >= curEx.sets) finishGuidedWorkout();
    else startPlayerRestCountdown(playerRestDuration);
}

function finishGuidedWorkout() {
    clearInterval(playerTimerInterval);
    document.getElementById('guidedWorkoutModal')?.remove();
    let totalSets = 0, totalKcal = 0;
    const exercisesDetail = activeWorkoutQueue.map(item => { totalSets += item.sets; totalKcal += item.sets * item.kcalPerSet; return { name: item.name, sets: item.sets, reps: item.reps }; });
    const title = `เวทจัดคิวสลับส่วน (${activeWorkoutQueue.length} ท่า: ${activeWorkoutQueue.map(x => x.name.split('(')[0].trim()).slice(0, 3).join(', ')})`;
    logCourseWorkoutToToday(title, Math.max(5, Math.round(totalSets * 1.5)), Math.round(totalKcal), exercisesDetail);
}

function closeGuidedWorkoutModal() {
    if (confirm("ต้องการออกจากโหมดฝึกตอนนี้ใช่ไหม?")) {
        clearInterval(playerTimerInterval);
        document.getElementById('guidedWorkoutModal')?.remove();
    }
}

function renderGuidedWorkoutPlayerModal() {
    const curEx = activeWorkoutQueue[playerCurrentStepIdx];
    if (!curEx) return;
    const clock = `${String(Math.floor(playerSecondsLeft / 60)).padStart(2, '0')}:${String(playerSecondsLeft % 60).padStart(2, '0')}`;

    const html = `
        <div id="guidedWorkoutModal" class="fixed inset-0 z-[80] bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-4 text-white overflow-y-auto">
            <div class="w-full max-w-md mx-auto space-y-3">
                <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div>
                        <span class="text-[10px] text-emerald-400 font-semibold block">จัดลำดับสลับกลุ่มกล้ามเนื้ออัตโนมัติ</span>
                        <h3 class="text-sm font-bold text-white">ท่าที่ ${playerCurrentStepIdx + 1} / ${activeWorkoutQueue.length} • เซตที่ ${playerCurrentSet} / ${curEx.sets}</h3>
                    </div>
                    <button type="button" onclick="closeGuidedWorkoutModal()" class="w-8 h-8 rounded-full bg-slate-800 text-slate-300"><i class="fa-solid fa-xmark"></i></button>
                </div>

                <div class="bg-slate-900 border border-indigo-500/40 rounded-3xl p-4 space-y-3">
                    <div class="flex justify-between items-start gap-2">
                        <div><h2 class="text-base font-extrabold text-white">${curEx.name}</h2><div class="text-xs text-rose-400 font-semibold">เน้นกล้ามเนื้อ: ${curEx.muscleText}</div></div>
                        <span class="bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-xl text-xs font-bold shrink-0">${curEx.reps}</span>
                    </div>
                    <div class="bg-slate-950 rounded-2xl border border-slate-800 py-2">${getAnimatedExerciseSvg(curEx.name)}</div>
                    <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-xs"><div class="font-bold text-emerald-400 mb-1">วิธีทำ:</div><p class="text-slate-300">${curEx.howTo}</p></div>
                </div>

                ${playerIsResting ? `
                    <div class="bg-amber-950/40 border border-amber-500/50 rounded-3xl p-4 text-center space-y-3">
                        <div class="text-xs font-bold text-amber-300">⏱️ กำลังพักระหว่างเซต</div>
                        <div id="player-rest-clock" class="text-4xl font-extrabold font-mono text-white">${clock}</div>
                        <button type="button" onclick="advanceToNextSetOrExercise()" class="w-full bg-indigo-600 text-white text-xs font-bold py-3 rounded-2xl">ข้ามเวลาพัก → ลุยต่อทันที</button>
                    </div>
                ` : `
                    <button type="button" onclick="completeCurrentPlayerSet()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold py-3.5 rounded-2xl">✓ จบเซตที่ ${playerCurrentSet} → เริ่มจับเวลาพัก (${playerRestDuration} วิ)</button>
                `}
            </div>
        </div>
    `;
    document.getElementById('guidedWorkoutModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
}

// Log Detail Modal & Exercise Photo Upload
let activeLogModalIndex = null;
function openWorkoutLogDetailModal(logIndex) {
    const log = (getDayData(currentDateKey).workouts || [])[logIndex];
    if (!log) return;
    activeLogModalIndex = logIndex;
    const items = Array.isArray(log.exercises) && log.exercises.length > 0 ? log.exercises : [{ name: log.type, sets: 1, reps: `${log.duration} นาที` }];
    window._tempLogModalItems = JSON.parse(JSON.stringify(items));

    const modalHtml = `
        <div id="workoutLogDetailModal" class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3">
            <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden text-white">
                <div class="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                    <div><div class="text-sm font-bold">${log.type}</div><div class="text-[11px] text-slate-400">เผาผลาญ ${log.calories} kcal</div></div>
                    <button type="button" onclick="document.getElementById('workoutLogDetailModal').remove()" class="w-8 h-8 rounded-lg bg-slate-800 text-slate-300"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="p-3 overflow-y-auto space-y-2 flex-1">
                    ${window._tempLogModalItems.map((it, idx) => `
                        <div class="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex justify-between items-center text-xs">
                            <div><div class="font-bold text-indigo-300">${idx + 1}. ${it.name}</div><div class="text-[10px] text-slate-400">${it.reps || ''}</div></div>
                            <span class="text-amber-300 font-bold">${it.sets} เซต</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    document.getElementById('workoutLogDetailModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function openExercisePhotoModal(exName) {
    activeExerciseNameForPhoto = exName;
    document.getElementById('ex-photo-title').innerText = exName;
    document.getElementById('exercise-photo-modal').classList.remove('hidden');
    loadExercisePhoto(exName);
}
function closeExercisePhotoModal() { document.getElementById('exercise-photo-modal').classList.add('hidden'); }
function triggerExercisePhotoUpload() { const i = document.getElementById('ex-photo-input'); i.value = ''; i.click(); }

async function loadExercisePhoto(exName) {
    const box = document.getElementById('ex-photo-display-box');
    const photoPath = window.exercisePhotosMap[exName];
    if (!photoPath) { box.innerHTML = `<div class="text-xs text-slate-400 p-6">ยังไม่มีรูปตัวอย่าง</div>`; return; }
    if (photoBlobCache[photoPath]) { box.innerHTML = `<img src="${photoBlobCache[photoPath]}" class="w-full max-h-[60vh] object-contain">`; return; }
    const token = localStorage.getItem('fitTracker_github_token');
    if (!token) return;
    try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${photoPath}`, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' } });
        const data = await res.json();
        const url = `data:image/jpeg;base64,${data.content.replace(/\s/g, '')}`;
        photoBlobCache[photoPath] = url;
        box.innerHTML = `<img src="${url}" class="w-full max-h-[60vh] object-contain">`;
    } catch (e) {}
}

async function handleExercisePhotoSelected(event) {
    const file = event.target.files[0];
    if (!file || !activeExerciseNameForPhoto) return;
    document.getElementById('ex-photo-status').innerText = "กำลังอัปโหลด...";
    const base64 = await resizeImageToBase64(file, 900);
    const uploadedPath = await uploadImageToGitHubFolder('exercises', 'ex', base64);
    if (uploadedPath) {
        window.exercisePhotosMap[activeExerciseNameForPhoto] = uploadedPath;
        localStorage.setItem('fitTracker_ex_photos', JSON.stringify(window.exercisePhotosMap));
        document.getElementById('ex-photo-display-box').innerHTML = `<img src="${photoBlobCache[uploadedPath]}" class="w-full max-h-[60vh] object-contain">`;
        document.getElementById('ex-photo-status').innerText = "บันทึกขึ้น Cloud สำเร็จ!";
        renderWorkoutCourseContent();
        pushToGitHub(false);
    }
}

// ------------------------------------------
// 5. Weight & Smart Scale Body Composition
// ------------------------------------------
function updateWeight(val) {
    const num = parseFloat(val);
    getDayData(currentDateKey).weight = (!isNaN(num) && num > 0) ? num : null;
    saveDataAndSync();
}

function setBodyMapCompareMode(mode) {
    bodyMapCompareMode = mode;
    renderWeightAndBodyComp();
}

function updateBodyComposition() {
    const parseNum = (id) => { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? null : v; };
    const bc = {
        fatPct: parseNum('bc-fat-pct'), muscleKg: parseNum('bc-muscle-kg'), visceral: parseNum('bc-visceral'), waterPct: parseNum('bc-water-pct'),
        armL: parseNum('bc-arm-l'), armR: parseNum('bc-arm-r'), legL: parseNum('bc-leg-l'), legR: parseNum('bc-leg-r')
    };
    getDayData(currentDateKey).bodyComp = Object.values(bc).some(v => v !== null) ? bc : null;
    saveDataAndSync();
}

function renderWeightAndBodyComp() {
    const dayData = getDayData(currentDateKey);
    const wInput = document.getElementById('weight-input');
    if (wInput && document.activeElement !== wInput) wInput.value = dayData.weight ?? '';

    const diffLabel = document.getElementById('goal-weight-diff');
    if (diffLabel) {
        if (userGoals.targetWeight && dayData.weight) {
            const diff = fmtPrecise(Number(dayData.weight) - Number(userGoals.targetWeight), 1);
            diffLabel.innerText = diff > 0 ? `อีก ${diff} kg ถึงเป้า (${userGoals.targetWeight})` : `ถึงเป้า ${userGoals.targetWeight} kg แล้ว!`;
        } else {
            diffLabel.innerText = userGoals.targetWeight ? `เป้า ${userGoals.targetWeight} kg` : 'ตั้งเป้าใน ⚙️';
        }
    }

    // Weight 7-day trend
    const trendBox = document.getElementById('weight-trend-container');
    if (trendBox) {
        const parts = currentDateKey.split('-');
        const baseDate = new Date(parts[0], parts[1] - 1, parts[2]);
        let points = [];
        for (let i = 6; i >= 0; i--) {
            let d = new Date(baseDate);
            d.setDate(baseDate.getDate() - i);
            let w = allMealsHistory[getFormattedDateKey(d)]?.weight;
            points.push({ day: d.getDate(), weight: (w !== null && w !== undefined && w !== '') ? Number(w) : null });
        }
        const valid = points.filter(p => p.weight !== null).map(p => p.weight);
        if (valid.length === 0) {
            trendBox.innerHTML = `<div class="text-[10px] text-slate-500 text-center py-1">กรอกน้ำหนักตัวเพื่อดูแนวโน้ม 7 วัน</div>`;
        } else {
            const minW = Math.min(...valid) - 1, maxW = Math.max(...valid) + 1, range = Math.max(maxW - minW, 1);
            trendBox.innerHTML = `<div class="flex items-end justify-between gap-1 pt-1">${points.map(p => p.weight === null ? `<div class="flex-1 flex flex-col items-center"><span class="text-[8px] text-slate-600">-</span><div class="w-2 h-6 bg-slate-800/40 rounded-full"></div><span class="text-[8px] text-slate-500">${p.day}</span></div>` : `<div class="flex-1 flex flex-col items-center"><span class="text-[9px] text-purple-300 font-semibold">${p.weight}</span><div class="w-full max-w-[18px] h-7 bg-slate-900 rounded flex items-end overflow-hidden"><div class="w-full bg-purple-500" style="height:${Math.max(20, Math.round(((p.weight - minW) / range) * 100))}%"></div></div><span class="text-[8px] text-slate-400">${p.day}</span></div>`).join('')}</div>`;
        }
    }

    const bc = dayData.bodyComp || {};
    const setV = (id, v) => { const el = document.getElementById(id); if (el && document.activeElement !== el) el.value = v ?? ''; };
    setV('bc-fat-pct', bc.fatPct); setV('bc-muscle-kg', bc.muscleKg); setV('bc-visceral', bc.visceral); setV('bc-water-pct', bc.waterPct);
    setV('bc-arm-l', bc.armL); setV('bc-arm-r', bc.armR); setV('bc-leg-l', bc.legL); setV('bc-leg-r', bc.legR);

    const badge = document.getElementById('body-comp-badge');
    const hasAny = Object.values(bc).some(v => v !== null && v !== undefined);
    if (badge) badge.innerText = hasAny ? `ไขมัน ${bc.fatPct ?? '-'}% • กล้าม ${bc.muscleKg ?? '-'}kg` : 'กดเปิด ▾';

    const keys = Object.keys(allMealsHistory).filter(k => bodyMapCompareMode === 'first' ? true : k < currentDateKey).sort();
    let refStats = null;
    if (bodyMapCompareMode === 'first') {
        for (let i = 0; i < keys.length; i++) { const d = allMealsHistory[keys[i]]; if (d && (d.weight || d.bodyComp)) { refStats = { dateKey: keys[i], weight: d.weight, bc: d.bodyComp || {} }; break; } }
    } else {
        for (let i = keys.length - 1; i >= 0; i--) { const d = allMealsHistory[keys[i]]; if (d && (d.weight || d.bodyComp)) { refStats = { dateKey: keys[i], weight: d.weight, bc: d.bodyComp || {} }; break; } }
    }

    const fmtDelta = (cur, prev, unit = '', lowerIsBetter = true) => {
        if (cur == null || prev == null) return `<span class="text-slate-500">-</span>`;
        const diff = fmtPrecise(cur - prev, 1);
        if (diff === 0) return `<span class="text-slate-400">0.0${unit}</span>`;
        const isGood = lowerIsBetter ? diff < 0 : diff > 0;
        return `<span class="${isGood ? 'text-emerald-400' : 'text-rose-400'} font-bold">${diff > 0 ? '+' : ''}${diff}${unit}</span>`;
    };

    const getZoneColor = (v) => v == null ? '#334155' : (v < 18 ? '#34d399' : (v < 25 ? '#fbbf24' : (v < 32 ? '#fb923c' : '#f43f5e')));
    const mapBox = document.getElementById('body-human-map-box');
    if (mapBox) {
        const refBc = refStats?.bc || {};
        mapBox.innerHTML = `
            <div class="flex items-center justify-between gap-1.5">
                <span class="text-[11px] font-bold text-white">แผนที่หุ่น & ส่วนต่าง (${refStats ? refStats.dateKey : 'ไม่มีข้อมูลเทียบ'})</span>
                <div class="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                    <button type="button" onclick="setBodyMapCompareMode('yesterday')" class="px-2 py-0.5 rounded-md ${bodyMapCompareMode === 'yesterday' ? 'bg-purple-600 text-white' : 'text-slate-400'}">ก่อนหน้า</button>
                    <button type="button" onclick="setBodyMapCompareMode('first')" class="px-2 py-0.5 rounded-md ${bodyMapCompareMode === 'first' ? 'bg-purple-600 text-white' : 'text-slate-400'}">วันแรก</button>
                </div>
            </div>
            <div class="grid grid-cols-12 items-center gap-2">
                <div class="col-span-5 flex justify-center bg-slate-900/90 py-2 rounded-xl border border-slate-800">
                    <svg viewBox="0 0 120 210" class="w-20 h-36">
                        <circle cx="60" cy="20" r="11" fill="#475569" />
                        <path d="M42,36 Q60,32 78,36 L82,92 L72,122 L48,122 L38,92 Z" fill="${getZoneColor(bc.fatPct)}" fill-opacity="0.75" />
                        <rect x="22" y="42" width="11" height="48" rx="5" fill="${getZoneColor(bc.armR ?? bc.fatPct)}" />
                        <rect x="87" y="42" width="11" height="48" rx="5" fill="${getZoneColor(bc.armL ?? bc.fatPct)}" />
                        <rect x="44" y="124" width="13" height="62" rx="6" fill="${getZoneColor(bc.legR ?? bc.fatPct)}" />
                        <rect x="63" y="124" width="13" height="62" rx="6" fill="${getZoneColor(bc.legL ?? bc.fatPct)}" />
                    </svg>
                </div>
                <div class="col-span-7 space-y-1.5 text-[11px]">
                    <div class="bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-800 flex justify-between"><span>น้ำหนักตัว</span><span><b>${dayData.weight ?? '-'} kg</b> ${fmtDelta(dayData.weight, refStats?.weight, ' kg', true)}</span></div>
                    <div class="bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-800 flex justify-between"><span class="text-amber-300">% ไขมัน</span><span><b>${bc.fatPct ?? '-'}%</b> ${fmtDelta(bc.fatPct, refBc.fatPct, '%', true)}</span></div>
                    <div class="bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-800 flex justify-between"><span class="text-emerald-300">กล้ามเนื้อ</span><span><b>${bc.muscleKg ?? '-'} kg</b> ${fmtDelta(bc.muscleKg, refBc.muscleKg, ' kg', false)}</span></div>
                    <div class="bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-800 flex justify-between"><span class="text-rose-300">ไขมันช่องท้อง</span><span><b>${bc.visceral ?? '-'}</b> ${fmtDelta(bc.visceral, refBc.visceral, '', true)}</span></div>
                </div>
            </div>
        `;
    }
}
