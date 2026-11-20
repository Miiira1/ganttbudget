import { describe, expect, it } from 'vitest'
import { createWorkCalendar } from '../engine/calendar'
import { schedule } from '../engine/schedule'
import { wbsNumbers, treeOrder } from '../model/hierarchy'
import { createEmptyProject, createTask, type Project, type Task } from '../model/schema'
import { createSampleProject } from '../samples/automatizace'
import { translateCs } from '../samples/translateForTests'
import { escapeXml, GANTT_SVG_COLORS, renderGanttSvg, type GanttSvgInput } from './exportSvg'
import { contrastRatio } from '../ui/contrast'
import { HEADER_HEIGHT, ROW_HEIGHT } from './geometry'

const LABELS: GanttSvgInput['labels'] = {
  title: 'Projekt',
  subtitle: 'Začátek 2026-11-23',
  columns: { number: '#', wbs: 'WBS', name: 'Název', start: 'Začátek', finish: 'Konec', duration: 'Délka' },
  formatDate: (iso) => iso,
  segmentLabel: (s) => `${s.unit}${s.value}`,
}

function input(project: Project, patch: Partial<GanttSvgInput> = {}): GanttSvgInput {
  return {
    project,
    scheduled: schedule(project),
    rows: treeOrder(project),
    wbs: wbsNumbers(project),
    percents: new Map(project.tasks.map((t) => [t.id, t.percentComplete])),
    calendar: createWorkCalendar(project.calendar),
    zoom: 'week',
    critical: false,
    labels: LABELS,
    ...patch,
  }
}

const count = (text: string, needle: string) => text.split(needle).length - 1
const sample = () => createSampleProject(translateCs, 'cs', '2026-11-23')

describe('export Gantta do SVG', () => {
  it('samostatné SVG s rozměry, názvem projektu a všemi řádky', () => {
    const p = sample()
    const { svg, width, height } = renderGanttSvg(input(p))
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg).toContain(`width="${width}"`)
    expect(svg).toContain(`height="${height}"`)
    expect(svg).toContain('Projekt')
    for (const task of p.tasks.slice(0, 5)) expect(svg).toContain(task.name.slice(0, 20))
    // Každá položka s termínem má úsečku, každá vazba šipku.
    expect(count(svg, 'data-bar=')).toBe(p.tasks.length)
    expect(count(svg, 'data-dep=')).toBe(p.tasks.reduce((n, t) => n + t.dependencies.length, 0))
  })

  it('text se escapuje – žádný kód z názvu činnosti se nedostane do SVG', () => {
    const p = createEmptyProject({ name: 'P', language: 'cs', startDate: '2026-11-23' })
    p.tasks = [{ ...createTask({ id: 'a', name: '<script>alert("x")</script> & „A“', order: 0 }) } as Task]
    const { svg } = renderGanttSvg(input(p))
    expect(svg).not.toContain('<script')
    expect(svg).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; „A“')
  })

  it('popisky vedle úseček: jsou v SVG, escapované, a osa se kvůli nim prodlouží', () => {
    const p = createEmptyProject({ name: 'P', language: 'cs', startDate: '2026-11-23' })
    p.tasks = [{ ...createTask({ id: 'a', name: 'A', order: 0 }) } as Task]
    const plain = renderGanttSvg(input(p))
    const long = '<b>Montáž</b> & ' + 'x'.repeat(120)
    const labelled = renderGanttSvg(input(p, { barLabels: new Map([['a', long]]) }))
    expect(labelled.svg).not.toContain('<b>')
    expect(labelled.svg).toContain('&lt;b&gt;Montáž&lt;/b&gt; &amp; ')
    expect(labelled.width).toBeGreaterThan(plain.width)
    expect(plain.svg).not.toContain('Montáž')
  })

  it('úsporná varianta pro telefon: bez tabulky a nadpisu, užší a nižší, úsečky zůstanou', () => {
    const p = sample()
    const full = renderGanttSvg(input(p))
    const compact = renderGanttSvg(input(p, { compact: true }))
    expect(compact.width).toBeLessThan(full.width)
    expect(compact.height).toBeLessThan(full.height)
    expect(compact.svg).not.toContain('>Projekt<')
    expect(compact.svg).not.toContain('>WBS<')
    expect(count(compact.svg, 'data-bar=')).toBe(p.tasks.length)
  })

  it('dlouhý název se zkrátí výpustkou', () => {
    const p = createEmptyProject({ name: 'P', language: 'cs', startDate: '2026-11-23' })
    p.tasks = [createTask({ id: 'a', name: 'x'.repeat(120), order: 0 })]
    const { svg } = renderGanttSvg(input(p))
    expect(svg).not.toContain('x'.repeat(120))
    expect(svg).toContain('…')
  })

  it('rozsah řádků (stránka): jen vybrané řádky, výška podle jejich počtu', () => {
    const p = sample()
    const all = renderGanttSvg(input(p))
    const page = renderGanttSvg(input(p, { rowRange: { from: 0, to: 5 } }))
    expect(count(page.svg, 'data-bar=')).toBe(5)
    expect(all.height - page.height).toBe((p.tasks.length - 5) * ROW_HEIGHT)
    expect(page.height).toBeGreaterThan(HEADER_HEIGHT + 5 * ROW_HEIGHT)
  })

  it('kritická cesta jen když je zapnutá', () => {
    const p = sample()
    expect(renderGanttSvg(input(p, { critical: true })).svg).toContain('data-critical="true"')
    expect(renderGanttSvg(input(p)).svg).not.toContain('data-critical="true"')
  })

  it('kritická činnost má průsvitnou žlutou výplň (víkendy prosvítají), milník zůstává plný', () => {
    const p = sample()
    const { svg } = renderGanttSvg(input(p, { critical: true }))
    expect(svg).toContain(`fill="${GANTT_SVG_COLORS.light.criticalTask}"`)
    expect(GANTT_SVG_COLORS.light.criticalTask).toMatch(/^rgba\(255,192,0,0\.\d+\)$/)
    expect(GANTT_SVG_COLORS.dark.criticalTask).toMatch(/^rgba\(255,192,0,0\.\d+\)$/)
    // Kritická úsečka činnosti už nemá plnou žlutou (ta zůstává jen milníkům).
    expect(svg).not.toMatch(/<rect[^>]*data-critical="true"[^>]*fill="#ffc000"/)
  })

  it('stejný vstup dá stejný výstup', () => {
    const p = sample()
    expect(renderGanttSvg(input(p)).svg).toBe(renderGanttSvg(input(p)).svg)
  })
})

describe('tmavý obrázek pro mobil (audit U24)', () => {
  const hex = (color: string) => (color.startsWith('#') ? color : null)

  it('výchozí (export, tisk) zůstává světlý; tmavý jen na požádání', () => {
    const p = sample()
    expect(renderGanttSvg(input(p)).svg).toContain('fill="#ffffff"')
    const dark = renderGanttSvg({ ...input(p), theme: 'dark' }).svg
    expect(dark).toContain('fill="#262626"')
    expect(dark).not.toContain('fill="#ffffff"')
  })

  it.each(['light', 'dark'] as const)('kontrast palety %s: text ≥ 4,5 : 1, čáry a obrysy ≥ 3 : 1', (theme) => {
    const c = GANTT_SVG_COLORS[theme]
    for (const text of [c.ink, c.muted]) expect(contrastRatio(text, c.background)).toBeGreaterThanOrEqual(4.5)
    for (const line of [c.taskStroke, c.arrow, c.criticalArrow, c.phase, c.criticalStroke].map(hex).filter((x) => x !== null)) {
      expect(contrastRatio(line, c.background)).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('escapování textu do SVG', () => {
  it('speciální znaky XML se nahradí entitami', () => {
    expect(escapeXml(`a < b & "c" > 'd'`)).toBe('a &lt; b &amp; &quot;c&quot; &gt; &#39;d&#39;')
  })

  it('řídicí znaky (v XML 1.0 zakázané) se vynechají, tabulátor a nový řádek zůstanou (audit B7)', () => {
    expect(escapeXml('A\u0000B\u0007C\u000BD\u000CE\u001FF￾G')).toBe('ABCDEFG')
    expect(escapeXml('a\tb\nc\rd')).toBe('a\tb\nc\rd')
  })
})
