/**
 * Jednoduché a bezpečné čtení XML (fáze 13b) pro import z MS Project a GanttProject – ČISTÁ FUNKCE s testy.
 *
 * Proč vlastní: testy běží mimo prohlížeč (bez DOMParser) a nová knihovna by byla zbytečná.
 * Umí prvky, atributy, text, CDATA, komentáře, deklaraci <?xml?> a základní entity (&amp; &#269; …).
 * Bezpečnost: DOCTYPE se odmítne (žádné vlastní entity – ochrana proti „nafouknutí“ a čtení souborů),
 * hloubka a počet prvků jsou omezené. Text se nikdy nevkládá jako HTML – jen se z něj čtou data.
 */

export interface XmlElement {
  /** Název prvku bez předpony jmenného prostoru (p:Name → Name). */
  name: string
  attrs: Record<string, string>
  children: XmlElement[]
  /** Text přímo v prvku (bez textu podřízených prvků), ořezaný o okrajové mezery. */
  text: string
}

export class XmlError extends Error {}

const MAX_DEPTH = 64
const MAX_ELEMENTS = 500_000
/** Jeden atribut: mezera, název, „=“, hodnota v uvozovkách. Čte se přesně od zadaného místa (/y). */
const ATTRIBUTE = /\s+([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/y

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole
    }
    return ENTITIES[body] ?? whole
  })
}

const localName = (name: string) => name.slice(name.indexOf(':') + 1)

export function parseXml(source: string): XmlElement {
  const xml = source.replace(/^﻿/, '')
  const stack: { el: XmlElement; text: string[] }[] = []
  let root: XmlElement | null = null
  let count = 0
  let i = 0

  const fail = (message: string): never => {
    throw new XmlError(message)
  }
  const appendText = (text: string) => {
    const top = stack.at(-1)
    if (top) top.text.push(text)
    else if (text.trim() !== '') fail('textOutsideRoot')
  }

  while (i < xml.length) {
    const lt = xml.indexOf('<', i)
    if (lt === -1) {
      appendText(decode(xml.slice(i)))
      break
    }
    if (lt > i) appendText(decode(xml.slice(i, lt)))
    if (xml.startsWith('<?', lt)) {
      const end = xml.indexOf('?>', lt)
      if (end === -1) fail('unclosedDeclaration')
      i = end + 2
    } else if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt)
      if (end === -1) fail('unclosedComment')
      i = end + 3
    } else if (xml.startsWith('<![CDATA[', lt)) {
      const end = xml.indexOf(']]>', lt)
      if (end === -1) fail('unclosedCdata')
      appendText(xml.slice(lt + 9, end))
      i = end + 3
    } else if (xml.startsWith('<!', lt)) {
      fail('doctype') // DOCTYPE a vlastní entity se nepřijímají
    } else if (xml.startsWith('</', lt)) {
      const end = xml.indexOf('>', lt)
      if (end === -1) fail('unclosedTag')
      const name = localName(xml.slice(lt + 2, end).trim())
      const top = stack.pop()
      if (!top || top.el.name !== name) fail('mismatchedTag')
      top!.el.text = top!.text.join('').trim()
      if (stack.length === 0) root = top!.el
      i = end + 1
    } else {
      const end = xml.indexOf('>', lt)
      if (end === -1) fail('unclosedTag')
      let body = xml.slice(lt + 1, end)
      const selfClosing = body.endsWith('/')
      if (selfClosing) body = body.slice(0, -1)
      const match = /^([^\s/>]+)/.exec(body)
      if (!match) fail('badTag')
      if (root !== null && stack.length === 0) fail('multipleRoots')
      if (++count > MAX_ELEMENTS) fail('tooManyElements')
      // Atributy čteme jeden po druhém od místa, kde skončil předchozí (příznak /y). Dřív se
      // hledaly kdekoli v textu značky a dlouhý text bez „=“ trval hodiny (ReDoS, audit B3).
      const attrs: Record<string, string> = {}
      let at = match![1]!.length
      while (at < body.length) {
        ATTRIBUTE.lastIndex = at
        const a = ATTRIBUTE.exec(body)
        if (!a) {
          if (body.slice(at).trim() !== '') fail('badTag') // nesmysl mezi atributy
          break
        }
        if (!a[1]!.startsWith('xmlns')) attrs[localName(a[1]!)] = decode(a[2] ?? a[3] ?? '')
        at = ATTRIBUTE.lastIndex
      }
      const el: XmlElement = { name: localName(match![1]!), attrs, children: [], text: '' }
      stack.at(-1)?.el.children.push(el)
      if (selfClosing) {
        if (stack.length === 0) root = el
      } else {
        if (stack.length >= MAX_DEPTH) fail('tooDeep')
        stack.push({ el, text: [] })
      }
      i = end + 1
    }
  }
  if (stack.length > 0) fail('unclosedTag')
  if (!root) fail('noRoot')
  return root!
}

/** První podřízený prvek daného jména. */
export const childElement = (el: XmlElement, name: string) => el.children.find((c) => c.name === name)
/** Všechny podřízené prvky daného jména. */
export const childElements = (el: XmlElement, name: string) => el.children.filter((c) => c.name === name)
/** Text prvního podřízeného prvku (prázdný řetězec, když chybí). */
export const childText = (el: XmlElement, name: string) => childElement(el, name)?.text ?? ''
