import { useAuthStore } from '../store/authStore'
import { currencySymbol } from '../utils/currency'

export function useCurrency(): string {
  const currency = useAuthStore(s => s.user?.currency)
  return currencySymbol(currency)
}
