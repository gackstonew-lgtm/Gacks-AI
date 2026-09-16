import React, { useState } from 'react'
import { Info, AlertTriangle } from 'lucide-react'

export interface ToggleProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  tooltip?: string
  badge?: string
}

export const SettingsToggle: React.FC<ToggleProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled,
  tooltip,
  badge,
}) => {
  return (
    <div className={`gacks-settings-row ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="gacks-settings-meta">
        <div className="flex items-center gap-1.5">
          <span className="gacks-settings-label">{label}</span>
          {badge && <span className="gacks-settings-badge">{badge}</span>}
          {tooltip && (
            <span className="gacks-settings-tooltip-icon" title={tooltip}>
              <Info className="w-3.5 h-3.5 text-gray-400" />
            </span>
          )}
        </div>
        {description && <p className="gacks-settings-desc">{description}</p>}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`gacks-toggle-switch ${checked ? 'gacks-toggle-on' : 'gacks-toggle-off'}`}
        onClick={() => onChange(!checked)}
        disabled={disabled}
      >
        <span className="gacks-toggle-knob" />
      </button>
    </div>
  )
}

export interface SelectProps {
  label: string
  description?: string
  value: string
  options: { value: string; label: string }[]
  onChange: (val: string) => void
  disabled?: boolean
  tooltip?: string
  badge?: string
}

export const SettingsSelect: React.FC<SelectProps> = ({
  label,
  description,
  value,
  options,
  onChange,
  disabled,
  tooltip,
  badge,
}) => {
  return (
    <div className="gacks-settings-row">
      <div className="gacks-settings-meta">
        <div className="flex items-center gap-1.5">
          <span className="gacks-settings-label">{label}</span>
          {badge && <span className="gacks-settings-badge">{badge}</span>}
          {tooltip && (
            <span className="gacks-settings-tooltip-icon" title={tooltip}>
              <Info className="w-3.5 h-3.5 text-gray-400" />
            </span>
          )}
        </div>
        {description && <p className="gacks-settings-desc">{description}</p>}
      </div>

      <select
        className="gacks-settings-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export interface SliderProps {
  label: string
  description?: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (val: number) => void
  disabled?: boolean
  tooltip?: string
}

export const SettingsSlider: React.FC<SliderProps> = ({
  label,
  description,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  disabled,
  tooltip,
}) => {
  return (
    <div className="gacks-settings-row gacks-settings-row-col">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-1.5">
          <span className="gacks-settings-label">{label}</span>
          {tooltip && (
            <span className="gacks-settings-tooltip-icon" title={tooltip}>
              <Info className="w-3.5 h-3.5 text-gray-400" />
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-[#00A3FF] font-semibold">
          {value}
          {unit}
        </span>
      </div>
      {description && <p className="gacks-settings-desc">{description}</p>}

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="gacks-settings-range"
      />
    </div>
  )
}

export interface InputProps {
  label: string
  description?: string
  value: string
  placeholder?: string
  onChange: (val: string) => void
  type?: 'text' | 'password'
  disabled?: boolean
  tooltip?: string
}

export const SettingsInput: React.FC<InputProps> = ({
  label,
  description,
  value,
  placeholder,
  onChange,
  type = 'text',
  disabled,
  tooltip,
}) => {
  return (
    <div className="gacks-settings-row gacks-settings-row-col">
      <div className="flex items-center gap-1.5">
        <span className="gacks-settings-label">{label}</span>
        {tooltip && (
          <span className="gacks-settings-tooltip-icon" title={tooltip}>
            <Info className="w-3.5 h-3.5 text-gray-400" />
          </span>
        )}
      </div>
      {description && <p className="gacks-settings-desc">{description}</p>}

      <input
        type={type}
        className="gacks-settings-text-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  )
}

export interface TextareaProps {
  label: string
  description?: string
  value: string
  placeholder?: string
  onChange: (val: string) => void
  rows?: number
  disabled?: boolean
  tooltip?: string
}

export const SettingsTextarea: React.FC<TextareaProps> = ({
  label,
  description,
  value,
  placeholder,
  onChange,
  rows = 3,
  disabled,
  tooltip,
}) => {
  return (
    <div className="gacks-settings-row gacks-settings-row-col">
      <div className="flex items-center gap-1.5">
        <span className="gacks-settings-label">{label}</span>
        {tooltip && (
          <span className="gacks-settings-tooltip-icon" title={tooltip}>
            <Info className="w-3.5 h-3.5 text-gray-400" />
          </span>
        )}
      </div>
      {description && <p className="gacks-settings-desc">{description}</p>}

      <textarea
        rows={rows}
        className="gacks-settings-textarea"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  )
}

export interface CardProps {
  title: string
  description?: string
  children: React.ReactNode
  badge?: string
}

export const SettingsCard: React.FC<CardProps> = ({ title, description, children, badge }) => {
  return (
    <div className="gacks-settings-card">
      <div className="gacks-settings-card-header">
        <div className="flex items-center gap-2">
          <h3 className="gacks-settings-card-title">{title}</h3>
          {badge && <span className="gacks-settings-badge">{badge}</span>}
        </div>
        {description && <p className="gacks-settings-card-desc">{description}</p>}
      </div>
      <div className="gacks-settings-card-body">{children}</div>
    </div>
  )
}

export interface DangerZoneProps {
  title: string
  description: string
  buttonLabel: string
  onConfirm: () => void
}

export const SettingsDangerZone: React.FC<DangerZoneProps> = ({
  title,
  description,
  buttonLabel,
  onConfirm,
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="gacks-settings-card gacks-danger-zone-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-red-400 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>{title}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">{description}</p>
        </div>

        {confirmOpen ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="gacks-btn-subtle text-xs"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="gacks-btn-danger text-xs"
              onClick={() => {
                onConfirm()
                setConfirmOpen(false)
              }}
            >
              Confirm Action
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="gacks-btn-danger text-xs"
            onClick={() => setConfirmOpen(true)}
          >
            {buttonLabel}
          </button>
        )}
      </div>
    </div>
  )
}


