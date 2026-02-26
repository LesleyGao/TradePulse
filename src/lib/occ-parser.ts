import type { CallPut } from './types';

export interface OccParsed {
  underlying: string;
  expiration: string; // YYYY-MM-DD
  callPut: CallPut;
  strike: number;
}

export function parseOccSymbol(symbol: string): OccParsed {
  // Format: [UNDERLYING][YYMMDD][C/P][STRIKE * 1000, zero-padded to 8 digits]
  // Example: QQQ260226P00604000
  const underlying = symbol.slice(0, 3);
  const dateStr = symbol.slice(3, 9); // YYMMDD
  const callPut = symbol.slice(9, 10) as CallPut;
  const strikeRaw = symbol.slice(10);
  const strike = parseInt(strikeRaw, 10) / 1000;
  const expiration = `20${dateStr.slice(0, 2)}-${dateStr.slice(2, 4)}-${dateStr.slice(4, 6)}`;

  if (!underlying || !expiration || (callPut !== 'C' && callPut !== 'P') || isNaN(strike)) {
    throw new Error(`Invalid OCC symbol: ${symbol}`);
  }

  return { underlying, expiration, callPut, strike };
}

export function formatContract(parsed: OccParsed): string {
  const type = parsed.callPut === 'C' ? 'Call' : 'Put';
  return `${parsed.underlying} ${parsed.expiration} $${parsed.strike} ${type}`;
}
