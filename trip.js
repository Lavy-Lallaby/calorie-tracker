// ==========================================================================
// trip.js — โมดูลวางแผนเที่ยว & แผนที่นำทาง (Leaflet + OpenStreetMap + OSRM)
// ==========================================================================

const DEFAULT_RAYONG_TRIP = {
    id: 'trip_rayong_2d1n',
    title: 'ทริประยอง 2 วัน 1 คืน (ทะเล & คาเฟ่)',
    startTime: '07:00',
    days: [
        {
            dayLabel: 'วันที่ 1 (ขาไป & เที่ยวชายหาด)',
            stops: [
                { id: 's1', type: 'start', name: 'จุดเริ่มต้น (บางเพรียง / บางนา-ตราด)', lat: 13.5685, lng: 100.8122, stayMin: 0, note: 'เช็กลมยาง & น้ำมันก่อนขึ้นมอเตอร์เวย์' },
                { id: 's2', type: 'gas', name: 'จุดพักรถมอเตอร์เวย์ บางปะกง (PTT / Amazon)', lat: 13.5244, lng: 101.0118, stayMin: 20, note: 'เติมน้ำมัน เข้าห้องน้ำ ซื้อกาแฟดำก่อนยิงยาว' },
                { id: 's3', type: 'food', name: 'ร้านป้ายา อาหารทะเลพื้นบ้าน (หาดแม่รำพึง)', lat: 12.6163, lng: 101.3688, stayMin: 60, note: 'มื้อเที่ยงริมทะเล เมนูแนะนำ: ปลาทูต้มเค็ม หมึกน้ำดำ' },
                { id: 's4', type: 'spot', name: 'อุทยานแห่งชาติเขาแหลมหญ้า - หมู่เกาะเสม็ด', lat: 12.5919, lng: 101.4198, stayMin: 90, note: 'เดินเส้นทางศึกษาธรรมชาติ ถ่ายรูปสะพานไม้ริมผา' },
                { id: 's5', type: 'spot', name: 'ที่พักโซนหาดแม่รำพึง / บ้านเพ', lat: 12.6258, lng: 101.4342, stayMin: 0, note: 'เช็กอิน พักผ่อน เดินเล่นรับลมทะเลช่วงเย็น' }
            ]
        },
        {
            dayLabel: 'วันที่ 2 (คาเฟ่ & ของฝากขากลับ)',
            stops: [
                { id: 's2_1', type: 'start', name: 'ออกจากที่พัก บ้านเพ ระยอง', lat: 12.6258, lng: 101.4342, stayMin: 0, note: 'เช็กเอาต์ 10:00 น.' },
                { id: 's2_2', type: 'spot', name: 'ทุ่งโปรงทอง ปากน้ำประแส', lat: 12.7042, lng: 101.7015, stayMin: 60, note: 'เดินสะพานไม้ชมป่าชายเลนสีทอง แสงเช้าสวยมาก' },
                { id: 's2_3', type: 'food', name: 'ครัวคุณป้า / ร้านอาหารทะเลปากน้ำประแส', lat: 12.7005, lng: 101.7082, stayMin: 60, note: 'แวะทานมื้อเที่ยงริมน้ำก่อนตีรถกลับ' },
                { id: 's2_4', type: 'gift', name: 'ตลาดร้อยเสา บ้านเพ (ซื้อของฝากอาหารทะเลแห้ง)', lat: 12.6295, lng: 101.4375, stayMin: 40, note: 'หมึกแห้ง กะปิระยอง น้ำปลาแท้ ทุเรียนทอด' },
                { id: 's2_5', type: 'gas', name: 'ปั๊ม PTT สาย 36 / บายพาสชลบุรี (พักรถขากลับ)', lat: 13.1532, lng: 101.0315, stayMin: 20, note: 'เติมน้ำมัน พักคนขับ ก่อนเข้ามอเตอร์เวย์กลับสมุทรปราการ' },
                { id: 's2_6', type: 'spot', name: 'ถึงบ้านโดยสวัสดิภาพ (บางเพรียง)', lat: 13.5685, lng: 100.8122, stayMin: 0, note: 'จบทริป!' }
            ]
        }
    ]
};

let initialTrips = JSON.parse(localStorage.getItem('fitTracker_trips') || 'null');
if (!Array.isArray(initialTrips) || initialTrips.length === 0) {
    initialTrips = [DEFAULT_RAYONG_TRIP];
    localStorage.setItem('fitTracker_trips', JSON.stringify(initialTrips));
}
window.savedTrips = initialTrips;

let activeTripId = window.savedTrips[0].id;
let activeTripDayIdx = 0;
let tripLeafletMap = null;
let tripLayerGroup = null;

// ------------------------------------------
// 1. Entry Point สำหรับ Render หน้า Trip ทั้งหมด
// ------------------------------------------
function renderTripPage() {
    if (!Array.isArray(window.savedTrips) || window.savedTrips.length === 0) {
        window.savedTrips = [DEFAULT_RAYONG_TRIP];
    }
    const trip = getActiveTrip();
    const curDay = trip.days[activeTripDayIdx] || trip.days[0];

    const selectEl = document.getElementById('trip-select-dropdown');
    if (selectEl) {
        selectEl.innerHTML = window.savedTrips.map(t => `<option value="${t.id}" ${t.id === trip.id ? 'selected' : ''}>${t.title}</option>`).join('');
    }

    const timeInput = document.getElementById('trip-start-time-input');
    if (timeInput) timeInput.value = trip.startTime || '07:00';

    const daysTabsEl = document.getElementById('trip-days-tabs');
    if (daysTabsEl) {
        daysTabsEl.innerHTML = trip.days.map((d, idx) => `
            <button type="button" onclick="selectTripDay(${idx})"
                class="px-3 py-1.5 rounded-xl text-xs font-semibold border shrink-0 transition ${activeTripDayIdx === idx
                    ? 'bg-sky-600 text-white border-sky-400'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'}">
                ${d.dayLabel}
            </button>
        `).join('');
    }

    const countBadge = document.getElementById('trip-stops-count-badge');
    if (countBadge) countBadge.innerText = `${(curDay.stops || []).length} จุด`;

    computeRouteAndRenderMap(curDay.stops || [], trip.startTime || '07:00');
}

function getActiveTrip() {
    return window.savedTrips.find(t => t.id === activeTripId) || window.savedTrips[0];
}

function saveTripsAndSync() {
    localStorage.setItem('fitTracker_trips', JSON.stringify(window.savedTrips));
    pushToGitHub(false);
}

function selectTrip(tripId) {
    activeTripId = tripId;
    activeTripDayIdx = 0;
    renderTripPage();
}

function selectTripDay(dayIdx) {
    activeTripDayIdx = dayIdx;
    renderTripPage();
}

function updateTripStartTime(val) {
    const trip = getActiveTrip();
    if (!trip || !val) return;
    trip.startTime = val;
    saveTripsAndSync();
    renderTripPage();
}

function createNewTrip() {
    const title = prompt('ตั้งชื่อทริปใหม่ (เช่น เที่ยวเขาใหญ่ 2 วัน 1 คืน):');
    if (!title || !title.trim()) return;
    const daysCount = Math.max(1, Math.min(10, parseInt(prompt('จำนวนกี่วัน? (ใส่ตัวเลข เช่น 2):', '2')) || 1));

    const days = [];
    for (let i = 0; i < daysCount; i++) {
        days.push({
            dayLabel: `วันที่ ${i + 1}`,
            stops: i === 0 ? [
                { id: 'st_' + Date.now(), type: 'start', name: 'จุดเริ่มต้น (บางเพรียง / สมุทรปราการ)', lat: 13.5685, lng: 100.8122, stayMin: 0, note: 'ออกเดินทาง' }
            ] : []
        });
    }

    const newTrip = { id: 'trip_' + Date.now(), title: title.trim(), startTime: '07:30', days };
    window.savedTrips.unshift(newTrip);
    activeTripId = newTrip.id;
    activeTripDayIdx = 0;
    saveTripsAndSync();
    renderTripPage();
}

function deleteActiveTrip() {
    if (window.savedTrips.length <= 1) return alert('ต้องมีทริปเหลืออย่างน้อย 1 รายการครับ');
    const trip = getActiveTrip();
    if (!confirm(`ต้องการลบทริป "${trip.title}" ใช่ไหม?`)) return;

    window.savedTrips = window.savedTrips.filter(t => t.id !== trip.id);
    activeTripId = window.savedTrips[0].id;
    activeTripDayIdx = 0;
    saveTripsAndSync();
    renderTripPage();
}

// ------------------------------------------
// 2. ค้นหาพิกัดสถานที่ & จัดการจุดแวะพัก
// ------------------------------------------
async function searchAndAddTripStop() {
    const queryEl = document.getElementById('trip-stop-query');
    const typeEl = document.getElementById('trip-stop-type');
    const stayEl = document.getElementById('trip-stop-stay');
    const noteEl = document.getElementById('trip-stop-note');
    const statusEl = document.getElementById('trip-search-status');

    const query = (queryEl?.value || '').trim();
    if (!query) return alert('พิมพ์ชื่อสถานที่ ปั๊มน้ำมัน ร้านอาหาร หรือวางพิกัดก่อนครับ');

    const stopType = typeEl?.value || 'spot';
    const stayMin = Math.max(0, parseInt(stayEl?.value) || 30);
    const note = (noteEl?.value || '').trim();

    if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังค้นหาพิกัดบนแผนที่...';

    let lat = null, lng = null, displayName = query;
    const coordMatch = query.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);

    if (coordMatch) {
        lat = parseFloat(coordMatch[1]);
        lng = parseFloat(coordMatch[2]);
        displayName = note || `พิกัด (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    } else {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=th&q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                lat = parseFloat(data[0].lat);
                lng = parseFloat(data[0].lon);
                displayName = query;
            }
        } catch (e) {}
    }

    if (lat === null || lng === null) {
        if (statusEl) statusEl.innerHTML = '<span class="text-rose-400">ไม่พบพิกัดชื่อนี้ ลองพิมพ์ชื่ออำเภอ/จังหวัดเพิ่ม หรือก๊อปปี้ตัวเลขพิกัดจาก Google Maps มาวางครับ</span>';
        return;
    }

    const trip = getActiveTrip();
    trip.days[activeTripDayIdx].stops.push({
        id: 'stop_' + Date.now(), type: stopType, name: displayName, lat, lng, stayMin, note
    });

    if (queryEl) queryEl.value = '';
    if (noteEl) noteEl.value = '';
    if (statusEl) statusEl.innerText = '';

    saveTripsAndSync();
    renderTripPage();
}

function moveTripStop(idx, dir) {
    const stops = getActiveTrip().days[activeTripDayIdx].stops;
    const target = idx + dir;
    if (target < 0 || target >= stops.length) return;
    [stops[idx], stops[target]] = [stops[target], stops[idx]];
    saveTripsAndSync();
    renderTripPage();
}

function deleteTripStop(idx) {
    getActiveTrip().days[activeTripDayIdx].stops.splice(idx, 1);
    saveTripsAndSync();
    renderTripPage();
}

// ------------------------------------------
// 3. คำนวณเส้นทางจริง (OSRM) + วาดแผนที่ Leaflet
// ------------------------------------------
function calcHaversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function addMinutesToTimeStr(timeStr, addMin) {
    const [hh, mm] = (timeStr || '07:00').split(':').map(Number);
    const total = (hh * 60 + mm + Math.round(addMin)) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function computeRouteAndRenderMap(stops, startTime) {
    const summaryEl = document.getElementById('trip-route-summary');
    const timelineEl = document.getElementById('trip-stops-timeline');

    const typeMeta = {
        start: { icon: '🚩', label: 'ออกเดินทาง', color: '#38bdf8', badge: 'bg-sky-950 text-sky-300 border-sky-700/50' },
        gas:   { icon: '⛽', label: 'ปั๊ม/จุดพักรถ', color: '#fb923c', badge: 'bg-orange-950 text-orange-300 border-orange-700/50' },
        food:  { icon: '🍽️', label: 'ร้านอาหาร/คาเฟ่', color: '#34d399', badge: 'bg-emerald-950 text-emerald-300 border-emerald-700/50' },
        gift:  { icon: '🎁', label: 'ร้านของฝาก', color: '#f472b6', badge: 'bg-pink-950 text-pink-300 border-pink-700/50' },
        spot:  { icon: '📸', label: 'จุดแวะเที่ยว/ที่พัก', color: '#a78bfa', badge: 'bg-purple-950 text-purple-300 border-purple-700/50' }
    };

    let legDistances = [], legDurations = [], routeCoords = null;

    if (stops.length >= 2) {
        try {
            const coordStr = stops.map(s => `${s.lng},${s.lat}`).join(';');
            const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`);
            const data = await res.json();
            if (data.code === 'Ok' && data.routes?.[0]) {
                const route = data.routes[0];
                routeCoords = route.geometry.coordinates.map(c => [c[1], c[0]]);
                route.legs.forEach(leg => {
                    legDistances.push(leg.distance / 1000);
                    legDurations.push(leg.duration / 60);
                });
            }
        } catch (e) {}

        if (legDistances.length === 0) {
            for (let i = 0; i < stops.length - 1; i++) {
                const km = calcHaversineKm(stops[i].lat, stops[i].lng, stops[i + 1].lat, stops[i + 1].lng) * 1.25;
                legDistances.push(km);
                legDurations.push((km / 75) * 60);
            }
        }
    }

    const totalKm = legDistances.reduce((a, b) => a + b, 0);
    const totalDriveMin = legDurations.reduce((a, b) => a + b, 0);
    const driveH = Math.floor(totalDriveMin / 60);
    const driveM = Math.round(totalDriveMin % 60);

    let gmapsAllUrl = 'https://www.google.com/maps';
    if (stops.length >= 2) {
        const origin = `${stops[0].lat},${stops[0].lng}`;
        const dest = `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`;
        const waypoints = stops.slice(1, -1).map(s => `${s.lat},${s.lng}`).join('|');
        gmapsAllUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}&travelmode=driving`;
    }

    if (summaryEl) {
        summaryEl.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-950/90 border border-slate-800 rounded-2xl p-3">
                <div class="flex items-center gap-3 text-xs">
                    <div>
                        <span class="text-[10px] text-slate-400 block">ระยะทางรวมวันนี้</span>
                        <b class="text-base text-sky-400">${totalKm.toFixed(1)} กม.</b>
                    </div>
                    <div class="h-7 w-px bg-slate-800"></div>
                    <div>
                        <span class="text-[10px] text-slate-400 block">เวลาขับรถรวม</span>
                        <b class="text-sm text-amber-300">${driveH > 0 ? `${driveH} ชม. ` : ''}${driveM} นาที</b>
                    </div>
                </div>
                <a href="${gmapsAllUrl}" target="_blank" rel="noopener"
                    class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition">
                    <i class="fa-solid fa-diamond-turn-right"></i> นำทางรวม Google Maps
                </a>
            </div>
        `;
    }

    if (timelineEl) {
        if (stops.length === 0) {
            timelineEl.innerHTML = `<div class="text-xs text-slate-500 text-center py-4">ยังไม่มีจุดแวะพักในวันนี้ เพิ่มจุดแรกจากฟอร์มด้านล่างได้เลยครับ</div>`;
        } else {
            let currentClock = startTime || '07:00';
            timelineEl.innerHTML = stops.map((s, idx) => {
                const meta = typeMeta[s.type] || typeMeta.spot;
                const legKm = idx > 0 ? legDistances[idx - 1] : 0;
                const legMin = idx > 0 ? legDurations[idx - 1] : 0;
                if (idx > 0) currentClock = addMinutesToTimeStr(currentClock, legMin);

                const arriveTime = currentClock;
                const departTime = s.stayMin > 0 ? addMinutesToTimeStr(arriveTime, s.stayMin) : arriveTime;
                currentClock = departTime;
                const singleNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=driving`;

                return `
                    <div class="relative pl-6 pb-3 last:pb-0">
                        ${idx < stops.length - 1 ? `<div class="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-800"></div>` : ''}
                        <div class="absolute left-0 top-1 w-6 h-6 rounded-full bg-slate-900 border-2 flex items-center justify-center text-xs" style="border-color:${meta.color}">${meta.icon}</div>

                        ${idx > 0 ? `<div class="text-[10px] text-sky-400 mb-1 flex items-center gap-1.5"><i class="fa-solid fa-car-side"></i> ขับต่อ ${legKm.toFixed(1)} กม. (~${Math.round(legMin)} นาที)</div>` : ''}

                        <div class="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 space-y-1.5">
                            <div class="flex items-start justify-between gap-2">
                                <div>
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <span class="text-xs font-extrabold font-mono text-amber-300 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
                                            ${idx === 0 ? `ออก ${arriveTime} น.` : `ถึง ${arriveTime} น.${s.stayMin > 0 ? ` → ออก ${departTime}` : ''}`}
                                        </span>
                                        <span class="text-[10px] px-2 py-0.5 rounded-full border ${meta.badge}">${meta.label}</span>
                                    </div>
                                    <div class="text-xs font-bold text-white mt-1">${s.name}</div>
                                </div>
                                <div class="flex items-center gap-1 shrink-0">
                                    <button type="button" onclick="moveTripStop(${idx}, -1)" class="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px]">▲</button>
                                    <button type="button" onclick="moveTripStop(${idx}, 1)" class="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px]">▼</button>
                                    <button type="button" onclick="deleteTripStop(${idx})" class="w-6 h-6 rounded bg-slate-900 hover:bg-rose-900/60 text-rose-400 text-[10px]"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                            ${s.note ? `<div class="text-[11px] text-slate-300 bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-800/80">${s.note}</div>` : ''}
                            <div class="flex justify-between items-center pt-1">
                                <span class="text-[10px] text-slate-500">พิกัด: ${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}</span>
                                <a href="${singleNavUrl}" target="_blank" rel="noopener" class="text-[11px] text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1">
                                    <i class="fa-solid fa-location-arrow"></i> นำทางจุดนี้
                                </a>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // วาดแผนที่ Leaflet
    const mapBox = document.getElementById('trip-leaflet-map');
    if (!window.L || !mapBox) return;

    if (tripLeafletMap) {
        tripLeafletMap.remove();
        tripLeafletMap = null;
    }

    const center = stops.length > 0 ? [stops[0].lat, stops[0].lng] : [13.5685, 100.8122];
    tripLeafletMap = L.map('trip-leaflet-map').setView(center, 9);

    // ✅ ใช้อันนี้แทน (OpenStreetMap ฟรี 100% ชื่อสถานที่ภาษาไทยชัด)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(tripLeafletMap);

    tripLayerGroup = L.layerGroup().addTo(tripLeafletMap);

    if (routeCoords && routeCoords.length > 1) {
        L.polyline(routeCoords, { color: '#38bdf8', weight: 4.5, opacity: 0.9 }).addTo(tripLayerGroup);
    } else if (stops.length > 1) {
        L.polyline(stops.map(s => [s.lat, s.lng]), { color: '#38bdf8', weight: 3.5, dashArray: '6,6' }).addTo(tripLayerGroup);
    }

    const bounds = [];
    stops.forEach((s, idx) => {
        const meta = typeMeta[s.type] || typeMeta.spot;
        const markerHtml = `<div style="background:#0f172a;border:2px solid ${meta.color};color:#fff;width:26px;height:26px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,0.6);">${idx + 1}</div>`;
        const icon = L.divIcon({ html: markerHtml, className: '', iconSize: [26, 26], iconAnchor: [13, 13] });

        L.marker([s.lat, s.lng], { icon })
            .bindPopup(`<b>${idx + 1}. ${s.name}</b><br><small>${s.note || meta.label}</small>`)
            .addTo(tripLayerGroup);

        bounds.push([s.lat, s.lng]);
    });

    if (bounds.length > 1) {
        tripLeafletMap.fitBounds(bounds, { padding: [28, 28] });
    } else if (bounds.length === 1) {
        tripLeafletMap.setView(bounds[0], 13);
    }
}
