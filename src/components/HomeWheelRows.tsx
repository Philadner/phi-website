import type { CSSProperties } from 'react'
import type { Category, WheelItem } from '../lib/homeNavigation'
import { classNames, wordClassName } from '../lib/homeWheel'
import type { WordRow } from '../lib/homeWheel'
import { themes } from '../lib/themes'

const SWATCHES = ['background', 'primary', 'secondary', 'highlight'] as const

function SettingText({ label, enabled }: { label: string; enabled: boolean }) {
  return <span className="home-setting-text" data-enabled={enabled}>
    <span className="home-setting-outline">{label}</span>
    <span className="home-setting-fill" aria-hidden="true">{label}</span>
    <span className="home-setting-strike" aria-hidden="true">{label}</span>
  </span>
}

function ThemeSwatches({ themeId }: { themeId: string }) {
  const theme = themes.find(value => value.id === themeId)
  return <span className="home-theme-swatches" aria-hidden="true">
    {theme && SWATCHES.map(key => <i key={key} style={{ backgroundColor: theme[key] }} />)}
  </span>
}

function JayBanner() {
  return <span className="gameshow-banner home-jay-banner" aria-hidden="true">
    <span className="gameshow-text">Jay Game</span>
    <span className="gameshow-divider">Play in browser</span>
  </span>
}

export function WheelInk({ item }: { item: WheelItem }) {
  return <span className="home-item-ink">
    {item.settingValue === undefined ? <span>{item.label}</span> : <SettingText label={item.label} enabled={item.settingValue} />}
    {item.themeId && <ThemeSwatches themeId={item.themeId} />}
    {item.id === 'jay' && <JayBanner />}
  </span>
}

function buttonLabel(item: WheelItem) {
  if (item.themeId) return `Apply ${item.label} theme`
  if (item.settingValue === undefined) return item.label
  return `${item.label}: ${item.settingValue ? 'on' : 'off'}`
}

function WheelWord({ item, className, interactive, focused }: {
  item: WheelItem; className: string; interactive: boolean; focused: boolean
}) {
  const ink = <WheelInk item={item} />
  if (!interactive) return <span className={className}>{ink}</span>
  const tabIndex = focused ? 0 : -1
  if (item.href) return <a className={className} href={item.href} tabIndex={tabIndex} aria-label={item.label}>{ink}</a>
  return <button type="button" className={className} tabIndex={tabIndex}
    aria-pressed={item.settingValue} aria-expanded={item.expanded} aria-label={buttonLabel(item)}>{ink}</button>
}

function closestRow(rows: WordRow[]) {
  return rows.reduce<WordRow | undefined>((best, row) => !best || row.distance < best.distance ? row : best, undefined)
}

// Outgoing rows are inert snapshots left by a category change; they stay
// centred on whichever row was closest when the snapshot was taken.
export function WheelRows({ rows, group, selectedIndex, outgoing = false }: {
  rows: WordRow[]; group: Category; selectedIndex: number; outgoing?: boolean
}) {
  const centreIndex = outgoing ? closestRow(rows)?.index ?? 0 : selectedIndex
  return <>
    {rows.map(row => {
      const focused = !outgoing && row.index === selectedIndex
      const style = {
        '--word-scale': row.scale,
        '--ripple-offset': `${Math.sign(row.y) * 18}px`,
        '--ripple-delay': `${Math.min(4, Math.abs(row.index - centreIndex)) * 22}ms`,
        opacity: row.opacity,
        transform: `translate3d(var(--home-phrase-x), ${row.y}px, 0)`,
        zIndex: focused ? 10 : 1,
      } as CSSProperties
      return <div key={row.item.id} style={style} aria-hidden={!focused}
        className={classNames('home-wheel-row', group === 'Settings' && 'home-setting-row', row.item.small && 'home-setting-child')}>
        <WheelWord item={row.item} focused={focused} interactive={!outgoing && group !== 'phi'}
          className={wordClassName(row.item, group === 'phi', row.index === centreIndex)} />
      </div>
    })}
  </>
}
