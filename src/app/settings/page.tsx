'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Save, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';

interface Setup {
  id: number;
  name: string;
  description: string | null;
  trigger_criteria: string | null;
  entry_rules: string | null;
  target_rules: string | null;
  stop_rules: string | null;
  best_regime: string | null;
  is_active: boolean;
}

interface AppSettings {
  dailyLossLimit: number;
  maxTradesPerDay: number;
  tradingWindowStart: string;
  tradingWindowEnd: string;
  defaultTimezone: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    dailyLossLimit: 100,
    maxTradesPerDay: 3,
    tradingWindowStart: '09:30',
    tradingWindowEnd: '11:30',
    defaultTimezone: 'America/New_York',
  });
  const [setups, setSetups] = useState<Setup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, setupsRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/setups'),
      ]);
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        if (data && typeof data === 'object') setSettings(prev => ({ ...prev, ...data }));
      }
      if (setupsRes.ok) {
        const data = await setupsRes.json();
        setSetups(Array.isArray(data) ? data : []);
      }
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { }
    setSaving(false);
  };

  const labelClass = "text-[10px] font-black uppercase tracking-[0.25em] text-stone-400 block mb-1.5";
  const inputClass = "w-full bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-900 focus:ring-2 focus:ring-stone-400 transition-all";

  if (loading) return <div className="card p-12 text-center"><div className="w-6 h-6 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-black text-stone-900 tracking-tighter">Settings</h1>
        <p className="text-stone-500 font-medium mt-1">Capital rules and setup catalog</p>
      </div>

      {/* Capital Rules */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-black text-stone-800 flex items-center gap-2"><Settings className="w-4 h-4" /> Capital Protection Rules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Daily Loss Limit ($)</label>
            <input type="number" value={settings.dailyLossLimit} onChange={e => setSettings(prev => ({ ...prev, dailyLossLimit: parseFloat(e.target.value) || 0 }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Max Trades Per Day</label>
            <input type="number" value={settings.maxTradesPerDay} onChange={e => setSettings(prev => ({ ...prev, maxTradesPerDay: parseInt(e.target.value) || 0 }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Trading Window Start (ET)</label>
            <input type="time" value={settings.tradingWindowStart} onChange={e => setSettings(prev => ({ ...prev, tradingWindowStart: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Trading Window End (ET)</label>
            <input type="time" value={settings.tradingWindowEnd} onChange={e => setSettings(prev => ({ ...prev, tradingWindowEnd: e.target.value }))} className={inputClass} />
          </div>
        </div>
        <button onClick={saveSettings} disabled={saving} className={cn(
          "text-xs font-semibold px-5 py-3 rounded-xl transition-all flex items-center gap-2",
          saved ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-stone-900 text-white hover:bg-stone-800 shadow-lg shadow-stone-200"
        )}>
          {saved ? 'Saved!' : saving ? 'Saving...' : <><Save className="w-3.5 h-3.5" /> Save Settings</>}
        </button>
      </div>

      {/* Setup Catalog */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-black text-stone-800">Setup Catalog</h2>
        <div className="space-y-3">
          {setups.filter(s => s.is_active).map(setup => (
            <div key={setup.id} className="p-4 rounded-xl bg-stone-50 border border-stone-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-stone-900">{setup.name}</h3>
                {setup.best_regime && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-200 text-stone-600">Best: {setup.best_regime}</span>
                )}
              </div>
              {setup.description && <p className="text-xs text-stone-500 mb-2">{setup.description}</p>}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {setup.trigger_criteria && <div><span className="font-bold text-stone-400">Trigger:</span> <span className="text-stone-600">{setup.trigger_criteria}</span></div>}
                {setup.entry_rules && <div><span className="font-bold text-stone-400">Entry:</span> <span className="text-stone-600">{setup.entry_rules}</span></div>}
                {setup.target_rules && <div><span className="font-bold text-stone-400">Target:</span> <span className="text-stone-600">{setup.target_rules}</span></div>}
                {setup.stop_rules && <div><span className="font-bold text-stone-400">Stop:</span> <span className="text-stone-600">{setup.stop_rules}</span></div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
