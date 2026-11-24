const htmlCache = {}; // แคช HTML ไว้จะได้สลับหน้าไวทันใจไม่ต้องโหลดซ้ำ

async function loadPageModule(pageName) {
    const slot = document.getElementById('page-slot');
    if (!slot) return;

    // 1. ดึงไฟล์ HTML ย่อย (เช่น foodtrack.html) มาใส่ใน #page-slot
    if (!htmlCache[pageName]) {
        const res = await fetch(`./${pageName}.html?v=${Date.now()}`);
        htmlCache[pageName] = await res.text();
    }
    slot.innerHTML = htmlCache[pageName];

    // 2. สั่งให้ฟังก์ชัน Render ของหน้านั้นทำงานทันที
    if (pageName === 'foodtrack' && typeof renderFoodTrackPage === 'function') renderFoodTrackPage();
    if (pageName === 'train' && typeof renderTrainPage === 'function') renderTrainPage();
    if (pageName === 'skincare' && typeof renderSkincarePage === 'function') renderSkincarePage();
    if (pageName === 'summary' && typeof renderSummaryPage === 'function') renderSummaryPage();
    if (pageName === 'trip' && typeof renderTripPage === 'function') renderTripPage();
}
