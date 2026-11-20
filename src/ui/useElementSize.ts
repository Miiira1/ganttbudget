/** Šířka a výška prvku – mění se s oknem i s tažením rozdělovníku (ResizeObserver). */
import { useEffect, useRef, useState } from 'react'

export function useElementSize<T extends HTMLElement>(): [React.RefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    // Celé pixely dolů: necelé rozměry (zvětšení stránky v prohlížeči) by jinak vedly k obsahu
    // o zlomek pixelu většímu než plocha a k přeblikávání posuvníků.
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const width = Math.floor(entry.contentRect.width)
      const height = Math.floor(entry.contentRect.height)
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    })
    observer.observe(element)
    // Rozměr hned při připojení (pozorovatel se ozve až při dalším vykreslení stránky).
    const rect = element.getBoundingClientRect()
    if (rect.width > 0 || rect.height > 0) setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) })
    return () => observer.disconnect()
  }, [])
  return [ref, size]
}
