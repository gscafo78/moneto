import { useState } from 'react'

export function useNumpad(initial = '0') {
  const [val, setVal] = useState(initial)

  function press(key: string) {
    setVal(prev => {
      if (key === '⌫') return prev.length <= 1 ? '0' : prev.slice(0, -1)
      if (key === '.') {
        if (prev.includes('.')) return prev
        return prev + '.'
      }
      const [, dec] = prev.split('.')
      if (dec !== undefined && dec.length >= 2) return prev
      if (prev === '0') return key
      return prev + key
    })
  }

  function reset(v = '0') { setVal(v) }
  const amount = parseFloat(val) || 0
  return { val, amount, press, reset, setVal }
}

export const NUMPAD_KEYS = ['1','2','3','4','5','6','7','8','9','.','0','⌫']
