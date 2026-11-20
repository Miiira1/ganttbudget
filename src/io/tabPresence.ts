/**
 * Je aplikace otevřená i v jiné záložce? (audit B4)
 *
 * Záloha v prohlížeči (autosave.ts) je jen jedna – dvě záložky by si ji navzájem přepisovaly
 * a práce z jedné by se po zavření tiše ztratila. Záložky se proto ohlásí přes BroadcastChannel
 * (vestavěný v prohlížeči; zprávy zůstávají v tomto prohlížeči, nic se neposílá na internet):
 * nová záložka pošle „hello“, ostatní odpoví „here“ – a obě strany uživatele varují.
 */

export interface TabChannel {
  postMessage(message: unknown): void
  onmessage: ((event: { data: unknown }) => void) | null
  close(): void
}

/** Kanál záložek aplikace, nebo null (starý prohlížeč, testy). */
export function openTabChannel(): TabChannel | null {
  try {
    // Skutečný BroadcastChannel má stejné metody, jen přesnější typ události (MessageEvent).
    return typeof BroadcastChannel === 'undefined' ? null : (new BroadcastChannel('ganttbudget-tabs') as unknown as TabChannel)
  } catch {
    return null
  }
}

/** Ohlásí záložku ostatním; `onOtherTab` se zavolá (jednou), když existuje jiná. Vrací „ukončit“. */
export function watchOtherTabs(channel: TabChannel | null, onOtherTab: () => void): () => void {
  if (!channel) return () => {}
  let warned = false
  const warn = () => {
    if (warned) return
    warned = true
    onOtherTab()
  }
  channel.onmessage = (event) => {
    const type = (event.data as { type?: unknown } | null)?.type
    if (type === 'hello') {
      channel.postMessage({ type: 'here' })
      warn()
    } else if (type === 'here') warn()
  }
  channel.postMessage({ type: 'hello' })
  return () => channel.close()
}
