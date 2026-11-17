/** Šířka a výška prvku – mění se s oknem i s tažením rozdělovníku (ResizeObserver). */
import { useEffect, useRef, useState } from 'react'

export function useElementSize<T extends HTMLElement>(): [React.RefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize((prev) => (Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1 ? prev : { width, height }))
    })
    observer.observe(element)
    // Rozměr hned při připojení (pozorovatel se ozve až při dalším vykreslení stránky).
    const rect = element.getBoundingClientRect()
    if (rect.width > 0 || rect.height > 0) setSize({ width: rect.width, height: rect.height })
    return () => observer.disconnect()
  }, [])
  return [ref, size]
}
