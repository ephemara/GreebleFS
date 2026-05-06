import React from 'react';
export function Test() {
  return (
    <>
      <style>{`
        .pro-slider { -webkit-appearance: none; width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; outline: none; }
        .pro-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 8px; height: 12px; border-radius: 2px; background: #ccc; cursor: pointer; }
        .pro-slider::-webkit-slider-thumb:hover { background: #fff; }
        .pro-input { appearance: none; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 4px 6px; border-radius: 4px; font-size: 11px; width: 100%; }
        .pro-input:focus { outline: none; border-color: rgba(255,255,255,0.3); }
        .pro-select { appearance: none; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 4px 6px; border-radius: 4px; font-size: 11px; width: 100%; cursor: pointer; }
        .pro-panel { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
        .pro-panel-header { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px; }
        .pro-label { font-size: 10px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; display: block; }
        .pro-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .pro-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .pro-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .pro-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
      <div />
    </>
  );
}
