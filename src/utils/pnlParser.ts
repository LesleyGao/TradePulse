import Papa from 'papaparse';
import { format, parse, isValid } from 'date-fns';

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

export const parseBrokerCsv = (csvString: string): Trade[] => {
  const { data } = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
  });

  const trades: Trade[] = [];

  // Helper to find column by common names
  const findCol = (row: any, aliases: string[]) => {
    const keys = Object.keys(row);
    // Try exact matches first
    for (const alias of aliases) {
      const found = keys.find(k => k.toLowerCase() === alias.toLowerCase());
      if (found) return row[found];
    }
    // Try partial matches
    for (const alias of aliases) {
      const found = keys.find(k => k.toLowerCase().includes(alias.toLowerCase()));
      if (found) return row[found];
    }
    return null;
  };

  const sanitizeNum = (val: any): string => {
    if (typeof val !== 'string') return String(val || '0');
    // Remove @, $, commas, and other non-numeric chars except . and -
    return val.replace(/[^0-9.-]/g, '') || '0';
  };

  (data as any[]).forEach((row) => {
    const dateStr = findCol(row, ['filled time', 'date', 'time', 'timestamp', 'trade date']);
    const symbol = findCol(row, ['symbol', 'ticker', 'asset', 'instrument', 'name']) || 'UNKNOWN';
    const action = findCol(row, ['side', 'action', 'type', 'description']) || '';
    const qty = parseFloat(sanitizeNum(findCol(row, ['filled', 'quantity', 'qty', 'shares', 'amount', 'total qty'])));
    const price = parseFloat(sanitizeNum(findCol(row, ['avg price', 'price', 'execution price'])));
    const totalVal = findCol(row, ['total', 'net amount', 'value', 'proceeds', 'total amount']);
    const total = totalVal ? parseFloat(sanitizeNum(totalVal)) : 0;

    if (!dateStr || isNaN(qty) || isNaN(price) || qty === 0) return;

    // Try parsing date
    // Webull format: 02/18/2026 09:44:29 EST
    // Strip timezone if present for better parsing
    const cleanDateStr = dateStr.replace(/\s[A-Z]{3,4}$/, '');
    let date = new Date(cleanDateStr);
    
    if (!isValid(date)) {
      // Try some common formats if standard Date fails
      const formats = ['MM/dd/yyyy HH:mm:ss', 'MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yy'];
      for (const f of formats) {
        try {
          const p = parse(cleanDateStr, f, new Date());
          if (isValid(p)) {
            date = p;
            break;
          }
        } catch (e) {}
      }
    }

    if (!isValid(date)) return;

    // Improved type detection
    let type: 'BUY' | 'SELL' = 'BUY';
    const actionUpper = action.toUpperCase();
    if (actionUpper.includes('SELL') || actionUpper.includes('SHORT') || actionUpper.includes('SL')) {
      type = 'SELL';
    } else if (actionUpper.includes('BUY') || actionUpper.includes('LONG') || actionUpper.includes('BY')) {
      type = 'BUY';
    } else if (total > 0) {
      type = 'SELL';
    }

    const pnlVal = findCol(row, ['realized p/l', 'profit', 'pnl', 'gain/loss', 'realized profit']);
    const realizedPnl = pnlVal ? parseFloat(sanitizeNum(pnlVal)) : 0;

    trades.push({
      date,
      symbol,
      type,
      quantity: Math.abs(qty),
      price,
      amount: !isNaN(total) && total !== 0 ? total : (qty * price),
      pnl: !isNaN(realizedPnl) ? realizedPnl : 0
    });
  });

  // Sort trades by date
  return trades.sort((a, b) => a.date.getTime() - b.date.getTime());
};

export const calculatePnl = (trades: Trade[]): PnlPoint[] => {
  const pnlPoints: PnlPoint[] = [];
  let cumulative = 0;
  
  // Group trades by date to show daily PNL
  const dailyGroups: { [key: string]: Trade[] } = {};
  
  trades.forEach(trade => {
    const day = format(trade.date, 'yyyy-MM-dd');
    if (!dailyGroups[day]) dailyGroups[day] = [];
    dailyGroups[day].push(trade);
  });

  const sortedDays = Object.keys(dailyGroups).sort();

  sortedDays.forEach((day, index) => {
    const dayTrades = dailyGroups[day];
    
    let dayPnl = 0;
    dayTrades.forEach(t => {
      if (t.pnl !== 0) {
        dayPnl += t.pnl;
      } else {
        // Fallback: if no PNL column, we assume SELL - BUY for the same symbol
        // This is still very simplified but better than nothing
        dayPnl += t.type === 'SELL' ? Math.abs(t.amount) : -Math.abs(t.amount);
      }
    });

    cumulative += dayPnl;
    
    pnlPoints.push({
      date: day,
      timestamp: new Date(day).getTime(),
      pnl: dayPnl,
      cumulativePnl: cumulative,
    });
  });

  // Calculate 20SMA
  for (let i = 0; i < pnlPoints.length; i++) {
    if (i >= 19) {
      const slice = pnlPoints.slice(i - 19, i + 1);
      const sum = slice.reduce((acc, curr) => acc + curr.cumulativePnl, 0);
      pnlPoints[i].sma20 = sum / 20;
    }
  }

  return pnlPoints;
};
