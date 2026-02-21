/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  ReferenceLine
} from 'recharts';
import { 
  Upload, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  FileText, 
  Plus, 
  Info,
  ChevronRight,
  Download,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { parseBrokerCsv, calculatePnl, type Trade, type PnlPoint } from './utils/pnlParser';
import { SAMPLE_CSV } from './constants';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const StatCard = ({ title, value, icon: Icon, trend }: { title: string, value: string, icon: any, trend?: 'up' | 'down' | 'neutral' }) => (
  <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <span className="text-zinc-500 text-sm font-medium uppercase tracking-wider">{title}</span>
      <div className="p-2 bg-zinc-50 rounded-lg">
        <Icon className="w-4 h-4 text-zinc-600" />
      </div>
    </div>
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold text-zinc-900">{value}</span>
      {trend && (
        <span className={cn(
          "text-xs font-semibold px-1.5 py-0.5 rounded-full",
          trend === 'up' ? "bg-emerald-50 text-emerald-600" : 
          trend === 'down' ? "bg-rose-50 text-rose-600" : "bg-zinc-50 text-zinc-600"
        )}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '•'}
        </span>
      )}
    </div>
  </div>
);

export default function App() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [pnlData, setPnlData] = useState<PnlPoint[]>([]);
  const [showSma, setShowSma] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSampleData = () => {
    setError(null);
    const parsedTrades = parseBrokerCsv(SAMPLE_CSV);
    const calculatedPnl = calculatePnl(parsedTrades);
    setTrades(parsedTrades);
    setPnlData(calculatedPnl);
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    let file: File | null = null;
    if ('files' in e.target && e.target.files) {
      file = e.target.files[0];
    } else if ('dataTransfer' in e && e.dataTransfer.files) {
      file = e.dataTransfer.files[0];
    }

    if (!file) return;

    try {
      const text = await file.text();
      const newTrades = parseBrokerCsv(text);
      
      if (newTrades.length === 0) {
        setError("Could not find any valid trades in this file. Please ensure it's a CSV with columns like 'Date', 'Symbol', 'Side', and 'Quantity'.");
        return;
      }

      // Merge and de-duplicate
      setTrades(prevTrades => {
        const combined = [...prevTrades, ...newTrades];
        // Use a Map to de-duplicate based on a unique key
        const uniqueMap = new Map();
        combined.forEach(t => {
          const key = `${t.date.getTime()}-${t.symbol}-${t.type}-${t.quantity}-${t.price}`;
          uniqueMap.set(key, t);
        });
        
        const sorted = Array.from(uniqueMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
        
        // Recalculate PNL for the entire set
        const calculatedPnl = calculatePnl(sorted);
        setPnlData(calculatedPnl);
        
        return sorted;
      });
    } catch (err) {
      setError("An error occurred while reading the file. Please try again with a valid CSV.");
      console.error(err);
    }
  }, []);

  const stats = useMemo(() => {
    if (pnlData.length === 0) return null;
    const totalPnl = pnlData[pnlData.length - 1].cumulativePnl;
    const winRate = (trades.filter(t => t.pnl && t.pnl > 0).length / trades.length) * 100 || 0;
    const maxPnl = Math.max(...pnlData.map(d => d.cumulativePnl));
    const drawdown = maxPnl > 0 ? ((maxPnl - totalPnl) / maxPnl) * 100 : 0;

    return {
      totalPnl: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalPnl),
      winRate: `${winRate.toFixed(1)}%`,
      drawdown: `${drawdown.toFixed(1)}%`,
      tradeCount: trades.length,
      trend: totalPnl >= 0 ? 'up' : 'down'
    };
  }, [pnlData, trades]);

  const clearData = () => {
    setTrades([]);
    setPnlData([]);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">TradePulse</h1>
          </div>
          <div className="flex items-center gap-4">
            {trades.length > 0 && (
              <button 
                onClick={clearData}
                className="text-sm font-medium text-rose-600 hover:text-rose-700 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Clear Data
              </button>
            )}
            <a 
              href="https://github.com" 
              target="_blank" 
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              Documentation
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {trades.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto mt-12"
            >
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileUpload}
                className={cn(
                  "relative group cursor-pointer border-2 border-dashed rounded-3xl p-12 transition-all duration-300 flex flex-col items-center text-center gap-6",
                  isDragging ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-400 bg-white"
                )}
              >
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Upload className="w-8 h-8 text-zinc-400 group-hover:text-zinc-900 transition-colors" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-zinc-900">Upload Broker Statement</h2>
                  <p className="text-zinc-500 max-w-sm mx-auto">
                    Drag and drop your CSV export from Interactive Brokers, Webull, Robinhood, or Schwab to see your performance.
                  </p>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-rose-50 text-rose-600 px-6 py-3 rounded-xl text-sm font-medium border border-rose-100 max-w-md"
                  >
                    {error}
                  </motion.div>
                )}
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-400 uppercase tracking-widest">
                    <Info className="w-3 h-3" />
                    Supports CSV format
                  </div>
                  <div className="hidden sm:block w-px h-4 bg-zinc-200" />
                  <button 
                    onClick={(e) => { e.stopPropagation(); loadSampleData(); }}
                    className="text-xs font-bold text-zinc-900 uppercase tracking-widest hover:underline"
                  >
                    Load Sample Data
                  </button>
                </div>
              </div>

              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { title: "Privacy First", desc: "Data stays in your browser. We never see your trades." },
                  { title: "Smart Parsing", desc: "Automatically detects columns for major brokers." },
                  { title: "Technical Indicators", desc: "Toggle 20SMA and other overlays instantly." }
                ].map((feature, i) => (
                  <div key={i} className="space-y-2">
                    <h3 className="font-bold text-zinc-900">{feature.title}</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                  title="Total PNL" 
                  value={stats?.totalPnl || '$0.00'} 
                  icon={TrendingUp} 
                  trend={stats?.trend as any} 
                />
                <StatCard 
                  title="Win Rate" 
                  value={stats?.winRate || '0%'} 
                  icon={Activity} 
                />
                <StatCard 
                  title="Max Drawdown" 
                  value={stats?.drawdown || '0%'} 
                  icon={TrendingDown} 
                  trend="down"
                />
                <StatCard 
                  title="Total Trades" 
                  value={stats?.tradeCount.toString() || '0'} 
                  icon={FileText} 
                />
              </div>

              {/* Main Chart Section */}
              <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900">Cumulative PNL Chart</h2>
                    <p className="text-sm text-zinc-500">Performance over time with 20-day Simple Moving Average</p>
                  </div>
                  <div className="flex items-center gap-2 bg-zinc-50 p-1 rounded-xl border border-zinc-100">
                    <button 
                      onClick={() => setShowSma(!showSma)}
                      className={cn(
                        "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                        showSma ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                      )}
                    >
                      20SMA {showSma ? 'On' : 'Off'}
                    </button>
                  </div>
                </div>

                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={pnlData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#18181b" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#18181b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#71717a' }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        width={80}
                        tick={{ fontSize: 12, fill: '#71717a' }}
                        tickFormatter={(val) => `$${val.toLocaleString()}`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          borderRadius: '12px', 
                          border: '1px solid #f1f1f1',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                        formatter={(value: any) => [`$${parseFloat(value).toFixed(2)}`, '']}
                      />
                      <ReferenceLine y={0} stroke="#e4e4e7" strokeWidth={1} />
                      <Area 
                        type="monotone" 
                        dataKey="cumulativePnl" 
                        stroke="#18181b" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorPnl)" 
                        animationDuration={1500}
                      />
                      {showSma && (
                        <Line 
                          type="monotone" 
                          dataKey="sma20" 
                          stroke="#F27D26" 
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                          animationDuration={1500}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Trade List */}
              <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                  <h3 className="font-bold text-zinc-900">Recent Activity</h3>
                  <button className="text-sm font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
                    View All <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50/50">
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Symbol</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Qty</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Price</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {[...trades].reverse().slice(0, 20).map((trade, i) => (
                        <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-zinc-600">
                            {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(trade.date)}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-sm font-bold text-zinc-900">{trade.symbol}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "text-xs font-bold px-2 py-1 rounded-md",
                              trade.type === 'BUY' ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                            )}>
                              {trade.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-600">{trade.quantity}</td>
                          <td className="px-6 py-4 text-sm text-zinc-600">${trade.price.toFixed(2)}</td>
                          <td className="px-6 py-4 text-sm font-medium text-zinc-900">
                            ${Math.abs(trade.amount).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-12 border-t border-zinc-200">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-zinc-400">
            <Activity className="w-4 h-4" />
            <span className="text-sm">Built for traders, by traders.</span>
          </div>
          <div className="flex items-center gap-8">
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Privacy Policy</a>
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Terms of Service</a>
            <a href="#" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
