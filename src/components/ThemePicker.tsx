import { useEffect, useRef, useState } from 'react'
import { getSavedTheme, paintTheme, themes, THEME_STORAGE_KEY } from '../lib/themes'

export default function ThemePicker() {
  const [applied, setApplied] = useState(getSavedTheme)
  const [selectedId, setSelectedId] = useState(applied.id)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const selected = themes.find((theme) => theme.id === selectedId) ?? themes[0]

  const appliedRef = useRef(applied)
  useEffect(() => () => paintTheme(appliedRef.current), [])

  function apply() {
    paintTheme(selected)
    appliedRef.current = selected
    setApplied(selected)
    setPreviewId(null)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, selected.id)
      setMessage(`${selected.name} applied and saved.`)
    } catch {
      setMessage(`${selected.name} applied for this visit. Browser storage is unavailable.`)
    }
  }

  return (
    <section className="theme-picker" aria-label="Theme picker">
      <p>Applied: {applied.name}</p>
      <div className="theme-picker__list" role="radiogroup" aria-label="Album theme">
        {themes.map((theme) => (
          <label className="theme-picker__option" key={theme.id}>
            <input type="radio" name="album-theme" value={theme.id}
              checked={selectedId === theme.id} onChange={() => {
                setSelectedId(theme.id)
                paintTheme(theme)
                setPreviewId(theme.id === applied.id ? null : theme.id)
                setMessage(theme.id === applied.id ? '' : `Previewing ${theme.name}. Apply to save.`)
              }} />
            <span className="theme-picker__swatches" aria-hidden="true">
              {[theme.background, theme.primary, theme.secondary, theme.highlight].map((color, index) => (
                <i key={index} style={{ backgroundColor: color }} />
              ))}
            </span>
            <span>{theme.name}<small>{theme.mode}</small></span>
          </label>
        ))}
      </div>
      <div className="theme-picker__actions">
        <button type="button" className="theme-picker__apply" onClick={apply}>Apply</button>
        {previewId && <button type="button" onClick={() => {
          paintTheme(applied)
          setSelectedId(applied.id)
          setPreviewId(null)
          setMessage(`Restored ${applied.name}.`)
        }}>Cancel</button>}
      </div>
      <p role="status">{message}</p>
    </section>
  )
}
