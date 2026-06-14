export const CURRENCIES = [
  { code: 'EUR', symbol: '€',  label: 'Euro' },
  { code: 'USD', symbol: '$',  label: 'Dollaro USA' },
  { code: 'GBP', symbol: '£',  label: 'Sterlina' },
  { code: 'CHF', symbol: 'CHF', label: 'Franco svizzero' },
  { code: 'JPY', symbol: '¥',  label: 'Yen giapponese' },
]

export function currencySymbol(code?: string | null): string {
  return CURRENCIES.find(c => c.code === code)?.symbol ?? code ?? '€'
}
