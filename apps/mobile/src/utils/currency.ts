import * as SecureStore from 'expo-secure-store';

const CURRENCY_KEY = 'nivas_hotel_currency';
let cachedSymbol: string | null = null;

export async function setCurrencySymbol(symbol: string) {
  cachedSymbol = symbol;
  await SecureStore.setItemAsync(CURRENCY_KEY, symbol);
}

export async function getCurrencySymbol(): Promise<string> {
  if (cachedSymbol) return cachedSymbol;
  const stored = await SecureStore.getItemAsync(CURRENCY_KEY);
  cachedSymbol = stored || 'NPR';
  return cachedSymbol;
}

export function formatAmount(amount: number | string, symbol?: string): string {
  const sym = symbol || cachedSymbol || 'NPR';
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (isNaN(num)) return `${sym} 0`;
  return `${sym} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
