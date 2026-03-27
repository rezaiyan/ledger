/**
 * Currency handler — formatting and USD conversion.
 *
 * All internal cost values are stored in USD (matching Anthropic pricing).
 * This module converts and formats them for display in any supported currency.
 *
 * Supported currencies: USD, EUR
 *
 * Exchange rates are hardcoded. Set LEDGER_CURRENCY_RATE_EUR=<rate> in your
 * environment to override the built-in EUR rate (e.g. "0.91").
 */

export type CurrencyCode = 'USD' | 'EUR';

interface CurrencyMeta {
  symbol: string;
  /** true → "$1.23", false → "1.23 €" */
  symbolBefore: boolean;
  decimals: number;
}

const CURRENCY_META: Record<CurrencyCode, CurrencyMeta> = {
  USD: { symbol: '$', symbolBefore: true,  decimals: 2 },
  EUR: { symbol: '€', symbolBefore: true,  decimals: 2 },
};

// USD → target currency rates (1 USD = X units of target).
// Override individual rates via LEDGER_CURRENCY_RATE_<CODE>=<rate>.
const DEFAULT_RATES: Record<CurrencyCode, number> = {
  USD: 1.0,
  EUR: 0.92,   // approximate — update via env var as needed
};

function loadRate(code: CurrencyCode): number {
  const envKey = `LEDGER_CURRENCY_RATE_${code}`;
  const raw = process.env[envKey];
  if (raw !== undefined) {
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    console.warn(`[currency] Invalid value for ${envKey}: "${raw}", using default`);
  }
  return DEFAULT_RATES[code];
}

const RATES: Record<CurrencyCode, number> = {
  USD: loadRate('USD'),
  EUR: loadRate('EUR'),
};

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

/**
 * Convert a USD amount to the target currency.
 *
 * Uses integer-cent arithmetic (×100, round, ÷100) to avoid floating-point
 * accumulation errors in the final display value.
 */
export function fromUSD(usdAmount: number, to: CurrencyCode): number {
  if (to === 'USD') return usdAmount;
  const converted = usdAmount * RATES[to];
  // Snap to cents — avoids display artefacts like "€0.050000000001"
  return Math.round(converted * 100) / 100;
}

/**
 * Convert from any supported currency back to USD.
 */
export function toUSD(amount: number, from: CurrencyCode): number {
  if (from === 'USD') return amount;
  const rate = RATES[from];
  if (rate === 0) throw new RangeError(`Exchange rate for ${from} is zero`);
  return Math.round((amount / rate) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a currency amount for display.
 *
 * @example
 * formatCurrency(1234.5,  'EUR')  // → '€1,234.50'
 * formatCurrency(0.05,    'USD')  // → '$0.05'
 * formatCurrency(-3.1,    'EUR')  // → '-€3.10'
 */
export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const meta = CURRENCY_META[currency];

  const negative = amount < 0;
  const abs = Math.abs(amount);

  // Round to the currency's decimal precision via integer arithmetic
  const factor = 10 ** meta.decimals;
  const rounded = Math.round(abs * factor) / factor;

  // Split into integer and decimal parts, then add thousands separators
  const fixed = rounded.toFixed(meta.decimals);          // e.g. "1234.50"
  const [intPart, decPart] = fixed.split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');  // "1,234"

  const numStr = `${intFormatted}.${decPart}`;           // "1,234.50"

  const body = meta.symbolBefore
    ? `${meta.symbol}${numStr}`                          // "$1,234.50"
    : `${numStr} ${meta.symbol}`;                        // "1,234.50 €"

  return negative ? `-${body}` : body;
}

// ---------------------------------------------------------------------------
// Active-currency singleton
// ---------------------------------------------------------------------------

const ENV_CURRENCY = process.env['LEDGER_CURRENCY']?.toUpperCase() as CurrencyCode | undefined;

function validateCurrencyCode(code: string): code is CurrencyCode {
  return code in CURRENCY_META;
}

let _active: CurrencyCode = (() => {
  if (ENV_CURRENCY && validateCurrencyCode(ENV_CURRENCY)) return ENV_CURRENCY;
  if (ENV_CURRENCY) {
    console.warn(`[currency] Unknown LEDGER_CURRENCY="${ENV_CURRENCY}", defaulting to USD`);
  }
  return 'USD';
})();

export function setActiveCurrency(code: CurrencyCode): void {
  _active = code;
}

export function getActiveCurrency(): CurrencyCode {
  return _active;
}

export const SUPPORTED_CURRENCIES: CurrencyCode[] = ['USD', 'EUR'];

// ---------------------------------------------------------------------------
// Convenience: format a USD cost using the active currency
// ---------------------------------------------------------------------------

/**
 * Convert a USD amount to the active display currency and format it.
 * Drop-in replacement for the legacy `formatCost(usd)` helper.
 */
export function formatCost(usdAmount: number): string {
  return formatCurrency(fromUSD(usdAmount, _active), _active);
}
