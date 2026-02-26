import Anthropic from '@anthropic-ai/sdk';
import type { PremarketInput, AiPremarketResponse, FullStats } from './types';
import { buildPremarketSystemPrompt } from './prompts/premarket-system';
import { EDGE_REFINEMENT_SYSTEM_PROMPT } from './prompts/edge-refinement-system';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in .env.local');
    client = new Anthropic({ apiKey });
  }
  return client;
}

function buildHistoricalStatsContext(stats: FullStats | null): string {
  if (!stats || stats.overall.totalTrades === 0) {
    return 'No trading history yet. This is a new trader — recommend minimum position sizes (1-lot) and conservative setups.';
  }

  const o = stats.overall;
  const bestSetup = stats.bySetup.length > 0
    ? stats.bySetup.reduce((a, b) => a.expectancy > b.expectancy ? a : b)
    : null;
  const worstSetup = stats.bySetup.length > 0
    ? stats.bySetup.reduce((a, b) => a.expectancy < b.expectancy ? a : b)
    : null;

  return `Total trades: ${o.totalTrades}
Overall win rate: ${o.winRate}%
Expectancy per trade: $${o.expectancy}
Average winner: $${o.avgWin}
Average loser: $${o.avgLoss}
Current streak: ${o.currentStreak.count} ${o.currentStreak.type}${o.currentStreak.count > 1 ? 's' : ''}
${bestSetup ? `Best setup: ${bestSetup.label} (${bestSetup.winRate}% win rate, $${bestSetup.expectancy} expectancy, n=${bestSetup.trades})` : ''}
${worstSetup && worstSetup.label !== bestSetup?.label ? `Worst setup: ${worstSetup.label} (${worstSetup.winRate}% win rate, $${worstSetup.expectancy} expectancy, n=${worstSetup.trades})` : ''}`;
}

function buildPremarketUserMessage(data: PremarketInput, todayTradeCount: number, todayPnl: number): string {
  const gexSign = data.gexValue >= 0 ? 'positive' : 'negative';
  const dexSign = data.dexValue >= 0 ? 'positive' : 'negative';

  let msg = `## Today's Data (${data.date})

QQQ Pre-market Price: $${data.qqqPrice}
VIX: ${data.vix}${data.vixTermStructure ? ` (${data.vixTermStructure})` : ''}

## Dealer Positioning
GEX: ${data.gexValue} (${gexSign})
DEX: ${data.dexValue} (${dexSign}, trending ${data.dexTrend})

## Key Levels
Call Wall: $${data.callWall}
Put Wall: $${data.putWall}
${data.gammaFlip ? `Gamma Flip: $${data.gammaFlip}` : ''}
Vol Trigger: $${data.volTrigger}
${data.hvl ? `HVL: $${data.hvl}` : ''}
${data.zeroGamma ? `Zero Gamma: $${data.zeroGamma}` : ''}`;

  if (data.blindspots.length > 0) {
    msg += '\n\n## Blindspot / Menthor Q Levels\n';
    msg += data.blindspots.map(b => `${b.label}: $${b.level}`).join('\n');
  }

  if (data.notes) {
    msg += `\n\n## Notes\n${data.notes}`;
  }

  msg += `\n\n## Today So Far\nTrades today: ${todayTradeCount}, P/L today: $${todayPnl}`;
  msg += '\n\nAnalyze this data and provide your pre-market game plan as JSON.';

  return msg;
}

export async function analyzePremarket(
  data: PremarketInput,
  stats: FullStats | null,
  todayTradeCount: number,
  todayPnl: number
): Promise<AiPremarketResponse> {
  const c = getClient();
  const systemPrompt = buildPremarketSystemPrompt(buildHistoricalStatsContext(stats));
  const userMessage = buildPremarketUserMessage(data, todayTradeCount, todayPnl);

  const message = await c.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned) as AiPremarketResponse;
}

export async function analyzeEdge(
  tradeHistory: Array<{
    date: string; strike: number; callPut: string; side: string;
    setupType: string; regime: string; entryPrice: number; exitPrice: number;
    pnlDollar: number; pnlPercent: number; holdingMinutes: number; entryTime: string;
  }>,
  previousReport?: string
): Promise<Record<string, unknown>> {
  const c = getClient();

  let msg = `## Complete Trade History (${tradeHistory.length} trades)\n\n`;
  msg += '| # | Date | Strike | C/P | Side | Setup | Regime | Entry | Exit | P/L$ | P/L% | Hold(min) | Entry Time |\n';
  msg += '|---|------|--------|-----|------|-------|--------|-------|------|------|------|-----------|------------|\n';
  for (const [i, t] of tradeHistory.entries()) {
    msg += `| ${i + 1} | ${t.date} | ${t.strike} | ${t.callPut} | ${t.side} | ${t.setupType || 'Unknown'} | ${t.regime || 'Unknown'} | ${t.entryPrice} | ${t.exitPrice} | ${t.pnlDollar} | ${t.pnlPercent}% | ${t.holdingMinutes} | ${t.entryTime} |\n`;
  }

  if (previousReport) {
    msg += `\n## Previous Edge Refinement Report\n${previousReport}`;
  } else {
    msg += '\n## Previous Edge Refinement Report\nNone (first analysis)';
  }

  const message = await c.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: EDGE_REFINEMENT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: msg }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}
