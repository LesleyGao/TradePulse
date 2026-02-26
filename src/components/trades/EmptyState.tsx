'use client';
import React from 'react';
import { Upload, Shield, Zap, LineChart as LineChartIcon, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';

interface EmptyStateProps {
    isDragging: boolean;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => void;
    onLoadSample: () => void;
    error: string | null;
    setIsDragging: (b: boolean) => void;
}

export const EmptyState = ({
    isDragging,
    onFileUpload,
    onLoadSample,
    error,
    setIsDragging,
}: EmptyStateProps) => {
    return (
        <div className="max-w-4xl mx-auto py-10">
            <div className="text-center space-y-4 mb-16">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex p-3 rounded-2xl bg-stone-900 border border-stone-800 shadow-2xl mb-4"
                >
                    <Activity className="w-8 h-8 text-white" />
                </motion.div>
                <h2 className="text-4xl sm:text-5xl font-black tracking-tighter text-stone-900">
                    Professional Options <br /><span className="text-stone-400">Trade Analytics.</span>
                </h2>
                <p className="text-stone-500 text-lg max-w-xl mx-auto font-medium">
                    Securely analyze your Webull trading performance. All data is processed locally in your browser.
                </p>
            </div>

            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onFileUpload}
                className={cn(
                    'relative rounded-[2.5rem] border-2 border-dashed p-16 flex flex-col items-center justify-center gap-8 transition-all duration-500 overflow-hidden group',
                    isDragging
                        ? 'border-stone-900 bg-stone-100 scale-[1.02] shadow-2xl'
                        : 'border-stone-200 bg-white hover:border-stone-400 hover:shadow-xl'
                )}
            >
                <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={onFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />

                <div
                    className={cn(
                        'w-24 h-24 rounded-3xl flex items-center justify-center transition-all duration-500 shadow-lg',
                        isDragging ? 'bg-stone-900 rotate-12' : 'bg-stone-50 group-hover:bg-stone-100 group-hover:-rotate-3'
                    )}
                >
                    <Upload className={cn('w-10 h-10', isDragging ? 'text-white' : 'text-stone-400')} strokeWidth={2.5} />
                </div>

                <div className="text-center space-y-2">
                    <p className="text-2xl font-black text-stone-900">Drop Webull CSV here</p>
                    <p className="text-stone-500 font-bold uppercase tracking-widest text-[10px]">
                        Account → Orders → Export (Options Only)
                    </p>
                </div>

                {error && (
                    <div className="bg-rose-50 text-rose-800 px-6 py-4 rounded-2xl text-sm font-bold border border-rose-100 shadow-sm">
                        {error}
                    </div>
                )}

                <button
                    type="button"
                    onClick={onLoadSample}
                    className="relative z-20 text-xs font-black uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900 transition-colors border-b-2 border-transparent hover:border-stone-900 pb-1"
                >
                    Load sample data
                </button>
            </div>

            <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-10">
                {[
                    { icon: Shield, title: 'Local Processing', desc: 'Private and secure' },
                    { icon: Zap, title: 'Instant Analytics', desc: 'No servers involved' },
                    { icon: LineChartIcon, title: 'Equity Curve', desc: 'Visual strategy edge' },
                ].map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="flex flex-col items-center text-center gap-4 group">
                        <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center group-hover:bg-stone-900 transition-colors duration-500">
                            <Icon className="w-6 h-6 text-stone-400 group-hover:text-white transition-colors" strokeWidth={2} />
                        </div>
                        <div>
                            <p className="font-bold text-stone-900">{title}</p>
                            <p className="text-stone-500 text-sm">{desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
