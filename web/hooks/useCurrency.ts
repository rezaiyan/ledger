import { createContext, useContext } from 'react'

export const CurrencyContext = createContext('USD')

export function useCurrency(): string {
  return useContext(CurrencyContext)
}
