import { describe, expect, it } from 'vitest'
import { childElement, childElements, childText, parseXml, XmlError } from './xml'

describe('čtení XML (bez knihovny)', () => {
  it('prvky, atributy v obou uvozovkách, prázdné prvky, text a entity', () => {
    const root = parseXml(`<?xml version="1.0" encoding="UTF-8"?>
<!-- komentář -->
<project name="Hala &amp; linka" version='3'>
  <task id="1" meeting="true"/>
  <task id="2"><notes><![CDATA[a < b & c]]></notes></task>
  <name>A &lt;B&gt; &quot;C&quot; &#269;&#x0159;</name>
</project>`)
    expect(root.name).toBe('project')
    expect(root.attrs).toEqual({ name: 'Hala & linka', version: '3' })
    expect(childElements(root, 'task').map((t) => t.attrs.id)).toEqual(['1', '2'])
    expect(childElements(root, 'task')[0]!.children).toEqual([])
    expect(childText(childElements(root, 'task')[1]!, 'notes')).toBe('a < b & c')
    expect(childText(root, 'name')).toBe('A <B> "C" čř')
    expect(childElement(root, 'missing')).toBeUndefined()
  })

  it('jmenný prostor ve výchozím tvaru nevadí, předpona se u názvu prvku odstraní', () => {
    const root = parseXml('<Project xmlns="http://schemas.microsoft.com/project"><p:Name xmlns:p="x">X</p:Name></Project>')
    expect(root.name).toBe('Project')
    expect(childText(root, 'Name')).toBe('X')
  })

  it('chyby: neuzavřený prvek, nesouhlasný konec, žádný kořen, DOCTYPE (ochrana proti entitám)', () => {
    expect(() => parseXml('<a><b></a>')).toThrow(XmlError)
    expect(() => parseXml('<a>')).toThrow(XmlError)
    expect(() => parseXml('jen text')).toThrow(XmlError)
    expect(() => parseXml('<!DOCTYPE a [<!ENTITY x "y">]><a>&x;</a>')).toThrow(XmlError)
    expect(() => parseXml('<a></a><b></b>')).toThrow(XmlError)
  })

  it('atributy: mezery kolem „=“, víc atributů, nový řádek mezi nimi', () => {
    const root = parseXml('<a x = "1"\n   y=\'2\'\tz="tři"/>')
    expect(root.attrs).toEqual({ x: '1', y: '2', z: 'tři' })
  })

  it('dlouhá značka bez „=“ se zpracuje rychle a odmítne (ochrana proti ReDoS, audit B3)', () => {
    // Dřív: 80 000 znaků = 11,5 s (čas rostl s druhou mocninou délky).
    const started = performance.now()
    expect(() => parseXml(`<Project ${'b'.repeat(200_000)}/>`)).toThrow(XmlError)
    expect(() => parseXml(`<Project a="1" ${'b'.repeat(200_000)}></Project>`)).toThrow(XmlError)
    expect(performance.now() - started).toBeLessThan(500)
  })

  it('nesmysl mezi atributy se odmítne (neplatné XML)', () => {
    expect(() => parseXml('<a x="1" y></a>')).toThrow(XmlError)
    expect(() => parseXml('<a x="1"y="2"></a>')).toThrow(XmlError)
  })
})
