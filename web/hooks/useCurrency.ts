import { createContext, useContext } from 'react'
import { fmtCost, fmtCostAxis } from '../utils'

export interface CurrencyContextValue {
  currency: string
  fmt: (v: number) => string
  fmtAxis: (v: number) => string
}

const DEFAULT_CURRENCY = 'USD'

export const CurrencyContext = createContext<CurrencyContextValue>({
  currency: DEFAULT_CURRENCY,
  fmt: (v) => fmtCost(v, DEFAULT_CURRENCY),
  fmtAxis: (v) => fmtCostAxis(v, DEFAULT_CURRENCY),
})

export function useCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext)
}
