import { parseOccSymbol } from './occ-parser';
import type { WebullOrder, RoundTrip, CsvParseResult, TradeSide } from './types';

export function parseWebullCsv(csvText: string): CsvParseResult {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return { roundTrips: [], unmatched: [] };

  const headers = lines[0].split(',').map(h => h.trim());

  const orders: WebullOrder[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length < headers.length) continue;

    const row = Object.fromEntries(headers.map((h, idx) => [h, values[idx]?.trim() || '']));
    if (row['Status'] !== 'Filled') continue;

    orders.push({
      name: row['Name'] || '',
      symbol: row['Symbol'] || '',
      side: row['Side'] as 'Buy' | 'Sell',
      status: row['Status'],
      filled: parseInt(row['Filled'] || '0', 10),
      totalQty: parseInt(row['Total Qty'] || '0', 10),
      price: parseFloat(row['Price'] || '0'),
      avgPrice: parseFloat(row['Avg Price'] || '0'),
      timeInForce: row['Time-in-Force'] || '',
      placedTime: row['Placed Time'] || '',
      filledTime: row['Filled Time'] || '',
    });
  }

  return pairRoundTrips(orders);
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseFilledTime(timeStr: string): Date {
  // Format: MM/DD/YYYY HH:MM:SS EST
  const cleaned = timeStr.replace(' EST', '').replace(' EDT', '').trim();
  const [datePart, timePart] = cleaned.split(' ');
  if (!datePart || !timePart) return new Date(0);
  const [month, day, year] = datePart.split('/');
  return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}`);
}

function pairRoundTrips(orders: WebullOrder[]): CsvParseResult {
  // Group by exact symbol
  const groups = new Map<string, WebullOrder[]>();
  for (const order of orders) {
    const key = order.symbol;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(order);
  }

  const roundTrips: RoundTrip[] = [];
  const unmatched: WebullOrder[] = [];

  for (const [symbol, symbolOrders] of groups) {
    // Sort by filled time
    symbolOrders.sort((a, b) => parseFilledTime(a.filledTime).getTime() - parseFilledTime(b.filledTime).getTime());

    const buys: WebullOrder[] = [];
    const sells: WebullOrder[] = [];

    for (const order of symbolOrders) {
      if (order.side === 'Buy') buys.push(order);
      else sells.push(order);
    }

    // Pair buys with sells chronologically
    const minPairs = Math.min(buys.length, sells.length);
    for (let i = 0; i < minPairs; i++) {
      const buy = buys[i];
      const sell = sells[i];
      const parsed = parseOccSymbol(symbol);
      const entryTime = parseFilledTime(buy.filledTime);
      const exitTime = parseFilledTime(sell.filledTime);

      let side: TradeSide;
      let entryPrice: number;
      let exitPrice: number;
      let entryTimeActual: Date;
      let exitTimeActual: Date;

      if (entryTime <= exitTime) {
        // Long trade: Buy first, Sell later
        side = 'Long';
        entryPrice = buy.avgPrice;
        exitPrice = sell.avgPrice;
        entryTimeActual = entryTime;
        exitTimeActual = exitTime;
      } else {
        // Short trade: Sell first, Buy later
        side = 'Short';
        entryPrice = sell.avgPrice;
        exitPrice = buy.avgPrice;
        entryTimeActual = exitTime;
        exitTimeActual = entryTime;
      }

      const qty = Math.min(buy.filled, sell.filled);
      const pnlDollar = side === 'Long'
        ? (exitPrice - entryPrice) * qty * 100
        : (entryPrice - exitPrice) * qty * 100;
      const pnlPercent = entryPrice > 0
        ? ((side === 'Long' ? exitPrice - entryPrice : entryPrice - exitPrice) / entryPrice) * 100
        : 0;
      const holdingMinutes = (exitTimeActual.getTime() - entryTimeActual.getTime()) / 60000;

      const dateStr = entryTimeActual.toISOString().slice(0, 10);

      roundTrips.push({
        symbol,
        underlying: parsed.underlying,
        expiration: parsed.expiration,
        strike: parsed.strike,
        callPut: parsed.callPut,
        side,
        qty,
        entryPrice: Math.round(entryPrice * 100) / 100,
        exitPrice: Math.round(exitPrice * 100) / 100,
        entryTime: entryTimeActual.toISOString(),
        exitTime: exitTimeActual.toISOString(),
        pnlDollar: Math.round(pnlDollar * 100) / 100,
        pnlPercent: Math.round(pnlPercent * 100) / 100,
        holdingMinutes: Math.round(holdingMinutes * 10) / 10,
        date: dateStr,
      });
    }

    // Unmatched orders
    for (let i = minPairs; i < buys.length; i++) unmatched.push(buys[i]);
    for (let i = minPairs; i < sells.length; i++) unmatched.push(sells[i]);
  }

  // Sort round-trips by entry time
  roundTrips.sort((a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime());

  return { roundTrips, unmatched };
}
