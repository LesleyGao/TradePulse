import type { CallPut } from './types';

export interface OccParsed {
  underlying: string;
  expiration: string; // YYYY-MM-DD
  callPut: CallPut;
  strike: number;
}

export function parseOccSymbol(symbol: string): OccParsed | null {
  // OCC format: [UNDERLYING 1-6 letters][YYMMDD][C/P][STRIKE * 1000, 8 digits]
  // Examples: QQQ260226P00604000, NVDA260213C00195000, GOOGL260130C00340000
  const match = symbol.match(/^([A-Z]{1,6})(\d{6})([CP])(\d{8})$/i);
  if (!match) return null;

  const underlying = match[1].toUpperCase();
  const dateStr = match[2]; // YYMMDD
  const callPut = match[3].toUpperCase() as CallPut;
  const strike = parseInt(match[4], 10) / 1000;
  const expiration = `20${dateStr.slice(0, 2)}-${dateStr.slice(2, 4)}-${dateStr.slice(4, 6)}`;

  if (isNaN(strike)) return null;

  return { underlying, expiration, callPut, strike };
}

export function formatContract(parsed: OccParsed): string {
  const type = parsed.callPut === 'C' ? 'Call' : 'Put';
  return `${parsed.underlying} ${parsed.expiration} $${parsed.strike} ${type}`;
}
