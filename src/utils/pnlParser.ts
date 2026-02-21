import Papa from 'papaparse';
import { format, parse, isValid } from 'date-fns';

/** US equity option contract size (1 contract = 100 shares). */
const OPTION_CONTRACT_MULTIPLIER = 100;

export interface Trade {
  date: Date;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  amount: number;
  pnl?: number;
}

export interface PnlPoint {
  date: string;
  timestamp: number;
  pnl: number;
  cumulativePnl: number;
  sma20?: number;
}

function findCol(row: Record<string, unknown>, aliases: string[]): string | null {
  const keys = Object.keys(row);
  const raw = (v: unknown) => (v != null ? String(v).trim() : '');
  for (const alias of aliases) {
    const key = keys.find((k) => k.toLowerCase() === alias.toLowerCase());
    if (key) {
      const v = raw(row[key]);
      if (v !== '') return v;
    }
  }
  for (const alias of aliases) {
    const key = keys.find((k) => k.toLowerCase().includes(alias.toLowerCase()));
    if (key) {
      const v = raw(row[key]);
      if (v !== '') return v;
    }
  }
  return null;
}

/** Find any column whose name contains one of the fragments (for flexible matching). */
function findColByFragment(row: Record<string, unknown>, fragments: string[]): string | null {
  const keys = Object.keys(row);
  const raw = (v: unknown) => (v != null ? String(v).trim() : '');
  for (const frag of fragments) {
    const key = keys.find((k) => k.toLowerCase().includes(frag.toLowerCase()));
    if (key) {
      const v = raw(row[key]);
      if (v !== '' && v !== '-' && v.toLowerCase() !== 'n/a') return v;
    }
  }
  return null;
}

/** Parse number from CSV; (1,234.56) or -1,234.56 → number. */
function parseNum(val: unknown): number {
  if (val == null) return 0;
  const s = String(val).trim();
  const wrapped = /^\((.+)\)$/.exec(s);
  const toParse = wrapped ? `-${wrapped[1]}` : s;
  const cleaned = toParse.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-') return 0;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

function sanitizeNum(val: unknown): string {
  if (val == null) return '0';
  const s = String(val).trim();
  const wrapped = /^\((.+)\)$/.exec(s);
  const toParse = wrapped ? `-${wrapped[1]}` : s;
  const out = toParse.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  return out === '' || out === '-' ? '0' : out;
}

function parseDate(dateStr: string): Date | null {
  const cleaned = dateStr.replace(/\s+[A-Z]{3,4}$/i, '').trim();
  let d = new Date(cleaned);
  if (isValid(d)) return d;
  const formats = [
    'MM/dd/yyyy HH:mm:ss',
    'MM/dd/yyyy H:mm:ss',
    'MM/dd/yyyy HH:mm',
    'MM/dd/yyyy',
    'yyyy-MM-dd HH:mm:ss',
    'yyyy-MM-dd',
    'M/d/yyyy H:mm:ss',
    'M/d/yyyy',
  ];
  for (const f of formats) {
    try {
      const p = parse(cleaned, f, new Date());
      if (isValid(p)) return p;
    } catch {
      // continue
    }
  }
  return null;
}

/**
 * Parse a Webull options order list CSV (or similar broker CSV).
 * Supports: Filled Time, Date, Symbol, Side, Action, Filled/Qty, Avg Price/Price, Total, Realized P/L.
 */
export function parseBrokerCsv(csvString: string): Trade[] {
  const trimmed = csvString.startsWith('\uFEFF') ? csvString.slice(1) : csvString;
  const { data } = Papa.parse(trimmed, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const trades: Trade[] = [];
  const rows = Array.isArray(data) ? data : [];

  for (const row of rows as Record<string, unknown>[]) {
    const dateStr = findCol(row, [
      'filled time',
      'time',
      'date',
      'trade date',
      'timestamp',
      'execution time',
    ]);
    if (!dateStr) continue;

    const date = parseDate(dateStr);
    if (!date) continue;

    const symbol =
      findCol(row, ['symbol', 'ticker', 'underlying', 'instrument', 'name']) ?? 'UNKNOWN';
    const action =
      findCol(row, ['side', 'action', 'type', 'direction', 'description']) ??
      findColByFragment(row, ['side', 'action', 'direction', 'buy', 'sell']) ??
      '';

    const qtyRaw = findCol(row, [
      'filled',
      'filled qty',
      'quantity',
      'qty',
      'shares',
      'contracts',
      'filled quantity',
      'size',
    ]);
    const qty = parseNum(qtyRaw);
    if (qty === 0) continue;

    const priceRaw = findCol(row, [
      'avg price',
      'average price',
      'price',
      'execution price',
      'fill price',
      'last price',
      'premium',
      'option price',
    ]);
    const price = priceRaw != null && priceRaw !== '' ? parseNum(priceRaw) : NaN;
    if (Number.isNaN(price)) continue;

    const totalRaw =
      findCol(row, [
        'total',
        'net amount',
        'value',
        'proceeds',
        'total amount',
        'amount',
        'net value',
        'cash flow',
      ]) ?? findColByFragment(row, ['total', 'amount', 'value', 'proceeds', 'net']);
    const total = totalRaw ? parseNum(totalRaw) : NaN;

    let type: 'BUY' | 'SELL' = 'BUY';
    const a = action.toUpperCase();
    if (a.includes('SELL') || a.includes('SHORT') || a.includes('CLOSE') || a === 'S') {
      type = 'SELL';
    } else if (a.includes('BUY') || a.includes('LONG') || a.includes('OPEN') || a === 'B') {
      type = 'BUY';
    } else if (!Number.isNaN(total) && total !== 0) {
      type = total > 0 ? 'SELL' : 'BUY';
    }

    const pnlRaw =
      findCol(row, [
        'realized p/l',
        'realized p&l',
        'realized pnl',
        'profit',
        'pnl',
        'gain/loss',
        'realized profit',
        'realized gain',
        'closed p/l',
        'closed p&l',
      ]) ?? findColByFragment(row, ['realized', 'profit', 'pnl', 'gain', 'loss', 'p/l', 'p&l', 'closed']);
    const realizedPnl = pnlRaw ? parseNum(pnlRaw) : 0;

    const optionAmount = Math.abs(qty) * price * OPTION_CONTRACT_MULTIPLIER;
    const amount =
      !Number.isNaN(total) && total !== 0
        ? total
        : optionAmount;
    const finalAmount = amount !== 0 ? amount : optionAmount;

    trades.push({
      date,
      symbol,
      type,
      quantity: Math.abs(qty),
      price,
      amount: finalAmount,
      pnl: realizedPnl,
    });
  }

  return trades.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Compute realized P/L per day from option contracts.
 * Daily PnL = (sum of SELL proceeds) − (sum of BUY cost) for that day.
 * Always uses contracts × price × 100 per trade (option contract multiplier).
 */
export function calculatePnl(trades: Trade[]): PnlPoint[] {
  if (trades.length === 0) return [];

  const byDay: Record<string, Trade[]> = {};
  for (const t of trades) {
    const day = format(t.date, 'yyyy-MM-dd');
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(t);
  }

  const days = Object.keys(byDay).sort();
  const points: PnlPoint[] = [];
  let cumulative = 0;

  for (const day of days) {
    const dayTrades = byDay[day];
    const premium = (t: Trade) =>
      t.quantity * t.price * OPTION_CONTRACT_MULTIPLIER;
    const sellPremium = dayTrades
      .filter((t) => t.type === 'SELL')
      .reduce((s, t) => s + premium(t), 0);
    const buyPremium = dayTrades
      .filter((t) => t.type === 'BUY')
      .reduce((s, t) => s + premium(t), 0);
    const dayPnl = sellPremium - buyPremium;

    cumulative += dayPnl;
    points.push({
      date: day,
      timestamp: new Date(day + 'T12:00:00').getTime(),
      pnl: dayPnl,
      cumulativePnl: cumulative,
    });
  }

  for (let i = 0; i < points.length; i++) {
    if (i >= 19) {
      const window = points.slice(i - 19, i + 1);
      points[i].sma20 =
        window.reduce((a, p) => a + p.cumulativePnl, 0) / window.length;
    }
  }

  return points;
}
