import React, { useState } from 'react';
import { Plus, X, Calendar, Hash, DollarSign, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { type Trade } from '../utils/pnlParser';
import { cn } from '../utils/cn';

interface TradeEntryFormProps {
    onAddTrade: (trade: Trade) => void;
    onClose: () => void;
}

export const TradeEntryForm = ({ onAddTrade, onClose }: TradeEntryFormProps) => {
    const [symbol, setSymbol] = useState('');
    const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const q = parseFloat(quantity);
        const p = parseFloat(price);
        if (!symbol || isNaN(q) || isNaN(p)) return;

        const newTrade: Trade = {
            symbol: symbol.toUpperCase().trim(),
            type,
            quantity: q,
            price: p,
            date: new Date(date),
            amount: q * p * (/^[A-Z]{1,6}\d{6}[CP]\d{8}$/i.test(symbol) ? 100 : 1)
        };

        onAddTrade(newTrade);
        onClose();
        // Reset
        setSymbol('');
        setQuantity('');
        setPrice('');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl shadow-stone-900/20 overflow-hidden animate-in zoom-in-95 duration-300 border border-stone-100">
                <div className="px-8 pt-8 pb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-stone-900 tracking-tight">Add Trade</h2>
                        <p className="text-sm text-stone-500 font-medium">Input your manual fill details.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400 hover:text-stone-900"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-8 pb-10 space-y-6">
                    <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-2xl border border-stone-200/50">
                        <button
                            type="button"
                            onClick={() => setType('BUY')}
                            className={cn(
                                "py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                                type === 'BUY' ? "bg-stone-900 text-white shadow-lg" : "text-stone-500 hover:text-stone-700"
                            )}
                        >
                            Buy / Long
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('SELL')}
                            className={cn(
                                "py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                                type === 'SELL' ? "bg-rose-600 text-white shadow-lg shadow-rose-200" : "text-stone-500 hover:text-stone-700"
                            )}
                        >
                            Sell / Short
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Symbol / OCC</label>
                            <div className="relative">
                                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="AAPL or AAPL260224C00200000"
                                    value={symbol}
                                    onChange={(e) => setSymbol(e.target.value)}
                                    className="w-full pl-11 pr-4 py-4 bg-stone-50 border border-stone-200 rounded-2xl text-stone-900 font-bold placeholder-stone-300 focus:ring-2 focus:ring-stone-900 focus:border-stone-900 outline-none transition-all shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Quantity</label>
                                <div className="relative">
                                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="0"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        className="w-full pl-11 pr-4 py-4 bg-stone-50 border border-stone-200 rounded-2xl text-stone-900 font-bold placeholder-stone-300 focus:ring-2 focus:ring-stone-900 focus:border-stone-900 outline-none transition-all shadow-inner"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Price</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        className="w-full pl-11 pr-4 py-4 bg-stone-50 border border-stone-200 rounded-2xl text-stone-900 font-bold placeholder-stone-300 focus:ring-2 focus:ring-stone-900 focus:border-stone-900 outline-none transition-all shadow-inner"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Fill Date & Time</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                <input
                                    type="datetime-local"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full pl-11 pr-4 py-4 bg-stone-50 border border-stone-200 rounded-2xl text-stone-900 font-bold focus:ring-2 focus:ring-stone-900 focus:border-stone-900 outline-none transition-all shadow-inner"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-5 bg-stone-900 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest hover:bg-stone-800 transition-all shadow-xl shadow-stone-200 flex items-center justify-center gap-2 group"
                    >
                        <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        Add to Performance History
                    </button>
                </form>
            </div>
        </div>
    );
};
