import React from 'react';
import { Activity, Upload, Trash2 } from 'lucide-react';
import { cn } from '../utils/cn';

interface LayoutProps {
    children: React.ReactNode;
    page: 'dashboard' | 'calculator';
    setPage: (page: 'dashboard' | 'calculator') => void;
    hasTrades: boolean;
    yearsWithData: number[];
    statsPeriod: 'total' | number;
    handlePeriodChange: (period: 'total' | number) => void;
    onUploadClick: () => void;
    onClearData: () => void;
}

export const Layout = ({
    children,
    page,
    setPage,
    hasTrades,
    yearsWithData,
    statsPeriod,
    handlePeriodChange,
    onUploadClick,
    onClearData,
}: LayoutProps) => {
    return (
        <div className="min-h-screen text-stone-900 font-sans antialiased selection:bg-stone-900 selection:text-white bg-[#fafaf9]">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-stone-200 bg-white/80 backdrop-blur-xl">
                <div className="page-width mx-auto px-5 sm:px-8 lg:px-10 h-16 sm:h-20 flex items-center justify-between">
                    <div className="flex items-center gap-10">
                        <a
                            href="#"
                            className="flex items-center gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 transition-transform active:scale-95"
                            onClick={(e) => { e.preventDefault(); setPage('dashboard'); }}
                        >
                            <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center shadow-lg shadow-stone-200">
                                <Activity className="w-5 h-5 text-white" strokeWidth={2.5} />
                            </div>
                            <span className="text-lg font-bold tracking-tight text-stone-900">TradePulse</span>
                        </a>

                        <nav className="hidden md:flex items-center gap-1 p-1 rounded-2xl bg-stone-100/50 border border-stone-200/50" role="tablist">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={page === 'dashboard'}
                                onClick={() => setPage('dashboard')}
                                className={cn(
                                    'text-sm font-semibold px-6 py-2.5 rounded-xl transition-all duration-300',
                                    page === 'dashboard'
                                        ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                                        : 'text-stone-500 hover:text-stone-800'
                                )}
                            >
                                Dashboard
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={page === 'calculator'}
                                onClick={() => setPage('calculator')}
                                className={cn(
                                    'text-sm font-semibold px-6 py-2.5 rounded-xl transition-all duration-300',
                                    page === 'calculator'
                                        ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                                        : 'text-stone-500 hover:text-stone-800'
                                )}
                            >
                                Calculator
                            </button>
                        </nav>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-5">
                        {page === 'dashboard' && hasTrades && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={onUploadClick}
                                    className="text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 border border-stone-200/60"
                                    title="Upload another CSV to replace data"
                                >
                                    <Upload className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Upload CSV</span>
                                </button>

                                {yearsWithData.length > 0 && (
                                    <div className="flex items-center gap-2 ml-2">
                                        <span className="text-xs font-bold text-stone-400 uppercase tracking-widest hidden lg:inline">Period</span>
                                        <select
                                            value={statsPeriod === 'total' ? 'total' : statsPeriod}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                handlePeriodChange(v === 'total' ? 'total' : parseInt(v, 10));
                                            }}
                                            className="text-sm font-bold text-stone-800 bg-white border border-stone-200 rounded-xl py-2.5 pl-4 pr-10 focus:ring-2 focus:ring-stone-400 cursor-pointer hover:border-stone-300 transition-colors"
                                            aria-label="View stats for period"
                                        >
                                            <option value="total">All Time</option>
                                            {yearsWithData.map((y) => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={onClearData}
                                    className="p-2.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100"
                                    title="Clear all uploaded data"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="page-width mx-auto px-5 sm:px-8 lg:px-10 py-10 sm:py-14">
                {children}
            </main>

            {/* Mobile nav */}
            <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                <nav className="flex items-center gap-1 p-1.5 rounded-2xl bg-stone-900/90 backdrop-blur-md shadow-2xl border border-stone-800" role="tablist">
                    <button
                        onClick={() => setPage('dashboard')}
                        className={cn(
                            'text-xs font-bold px-6 py-3 rounded-xl transition-all',
                            page === 'dashboard' ? 'bg-white text-stone-900' : 'text-stone-400'
                        )}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => setPage('calculator')}
                        className={cn(
                            'text-xs font-bold px-6 py-3 rounded-xl transition-all',
                            page === 'calculator' ? 'bg-white text-stone-900' : 'text-stone-400'
                        )}
                    >
                        Calculator
                    </button>
                </nav>
            </div>
        </div>
    );
};
