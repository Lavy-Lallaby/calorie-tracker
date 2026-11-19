import React, { useState } from 'react';
import { DIET_MODES } from './fatBurnModeData';

export default function DietModeSwitcher({ currentMode, onModeChange }) {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const activeData = DIET_MODES[currentMode] || DIET_MODES.normal;

  return (
    <div className="bg-[#121629] text-white p-4 rounded-2xl border border-slate-800 space-y-4">
      {/* ส่วนหัวและปุ่มสลับโหมด */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs text-slate-400">โหมดการเผาผลาญปัจจุบัน</span>
          <div className="flex items-center gap-2 mt-0.5">
            <h3 className="text-lg font-bold text-white">{activeData.name}</h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                currentMode === 'fatBurn'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {activeData.badge}
            </span>
          </div>
        </div>

        {/* ปุ่ม Toggle สลับโหมด */}
        <div className="flex bg-[#0B0E1A] p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => onModeChange('normal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              currentMode === 'normal'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ลดปกติ
          </button>
          <button
            onClick={() => onModeChange('fatBurn')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              currentMode === 'fatBurn'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🔥 รีดไขมัน & น้ำตาล
          </button>
        </div>
      </div>

      {/* แสดงเป้าหมายสารอาหารใหม่เมื่อเปลี่ยนโหมด */}
      <div className="grid grid-cols-4 gap-2 bg-[#0B0E1A] p-3 rounded-xl border border-slate-800/80 text-center">
        <div>
          <p className="text-[11px] text-slate-400">แคลอรี</p>
          <p className="text-sm font-bold text-white">{activeData.targets.calories}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">โปรตีน</p>
          <p className="text-sm font-bold text-emerald-400">
            {activeData.targets.proteinMin}-{activeData.targets.proteinMax}g
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">คาร์บไม่เกิน</p>
          <p className="text-sm font-bold text-sky-400">{activeData.targets.carbsMax}g</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">น้ำตาลไม่เกิน</p>
          <p className="text-sm font-bold text-pink-400">{activeData.targets.sugarMax}g</p>
        </div>
      </div>

      {/* แสดงตาราง IF และเมนู 7-11/ตลาด เฉพาะตอนเปิดโหมดรีดไขมัน */}
      {currentMode === 'fatBurn' && (
        <div className="space-y-3 pt-2 border-t border-slate-800">
          {/* ตารางเวลา IF */}
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 text-xs space-y-1">
            <p className="font-semibold text-amber-300">
              ⏱️ ตาราง IF 16/8: กิน {activeData.fastingSchedule.feedingWindow} | งด {activeData.fastingSchedule.fastingWindow}
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-0.5">
              {activeData.fastingSchedule.rules.map((rule, idx) => (
                <li key={idx}>{rule}</li>
              ))}
            </ul>
          </div>

          {/* เลือกดูเมนูแนะนำรายวัน */}
          <div>
            <p className="text-xs font-semibold text-slate-300 mb-2">
              🍱 เมนูแนะนำ (7-11 & ตลาดทั่วไป)
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {activeData.weeklyMealPlan.map((item, index) => (
                <button
                  key={item.day}
                  onClick={() => setSelectedDayIndex(index)}
                  className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition ${
                    selectedDayIndex === index
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-[#0B0E1A] text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {item.day}
                </button>
              ))}
            </div>

            {/* รายละเอียดมื้ออาหารของวันที่เลือก */}
            {(() => {
              const plan = activeData.weeklyMealPlan[selectedDayIndex];
              return (
                <div className="mt-2 bg-[#0B0E1A] p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-amber-400 font-semibold shrink-0">12:00 เที่ยง:</span>
                    <span className="text-slate-200 flex-1">{plan.lunch.menu}</span>
                    <span className="text-slate-400 shrink-0">{plan.lunch.kcal} kcal</span>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-sky-400 font-semibold shrink-0">15:30 ว่าง:</span>
                    <span className="text-slate-200 flex-1">{plan.snack.menu}</span>
                    <span className="text-slate-400 shrink-0">{plan.snack.kcal} kcal</span>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-emerald-400 font-semibold shrink-0">19:00 เย็น:</span>
                    <span className="text-slate-200 flex-1">{plan.dinner.menu}</span>
                    <span className="text-slate-400 shrink-0">{plan.dinner.kcal} kcal</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
