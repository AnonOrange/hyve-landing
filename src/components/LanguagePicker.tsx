'use client'

// Tiny custom language picker that drives Google Translate underneath.
//
// The official google.translate.TranslateElement widget is bulky (a wide
// "Select Language" dropdown + Google branding). We hide it with CSS but
// keep the script loaded — its real job is to monkey-patch the page's
// text on load. Translation is triggered by setting the `googtrans` cookie
// to `/en/<targetCode>` and reloading; the script reads that on next mount
// and applies the translation transparently.
//
// What the user sees: a small 32×32 gold globe icon top-right. Click it,
// pick a language, page reloads in the new language. Click again, switch
// back to English. Total visible footprint: one icon + a dropdown only
// when open.

import { useEffect, useState } from 'react'

type Lang = { code: string; flag: string; label: string }

const LANGUAGES: Lang[] = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'it', flag: '🇮🇹', label: 'Italiano' },
  { code: 'pt', flag: '🇵🇹', label: 'Português' },
  { code: 'zh-CN', flag: '🇨🇳', label: '中文' },
  { code: 'ja', flag: '🇯🇵', label: '日本語' },
  { code: 'ko', flag: '🇰🇷', label: '한국어' },
  { code: 'ar', flag: '🇸🇦', label: 'العربية' },
  { code: 'ru', flag: '🇷🇺', label: 'Русский' },
  { code: 'hi', flag: '🇮🇳', label: 'हिन्दी' },
]

function readActive(): string {
  if (typeof document === 'undefined') return 'en'
  const m = document.cookie.match(/googtrans=\/en\/([a-zA-Z\-]+)/)
  return m?.[1] || 'en'
}

function setActive(code: string) {
  // Cookie domains: set on both bare and apex so both www.hyveapp.co and
  // any subdomain see the choice. The Google Translate script reads this
  // cookie on every page load and applies the matching translation.
  const value = code === 'en' ? '' : `/en/${code}`
  const expires = code === 'en' ? 'Thu, 01 Jan 1970 00:00:00 GMT' : ''
  const exp = expires ? `; expires=${expires}` : ''
  document.cookie = `googtrans=${value}; path=/${exp}`
  document.cookie = `googtrans=${value}; path=/; domain=.hyveapp.co${exp}`
  document.cookie = `googtrans=${value}; path=/; domain=hyveapp.co${exp}`
  // Reload — the Google script picks up the cookie on next mount.
  window.location.reload()
}

export default function LanguagePicker() {
  const [open, setOpen] = useState(false)
  const [active, setActiveState] = useState('en')

  useEffect(() => {
    setActiveState(readActive())
  }, [])

  const activeLang = LANGUAGES.find((l) => l.code === active) || LANGUAGES[0]

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
          right: 8,
          zIndex: 9999,
        }}
      >
        <button
          aria-label="Change language"
          onClick={() => setOpen((o) => !o)}
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(8,7,10,0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #2a2135',
            borderRadius: 6,
            cursor: 'pointer',
            color: '#E8C456',
            fontSize: 14,
            padding: 0,
          }}
        >
          {active === 'en' ? '🌐' : activeLang.flag}
        </button>
        {open && (
          <div
            style={{
              position: 'absolute',
              top: 38,
              right: 0,
              minWidth: 160,
              background: 'rgba(8,7,10,0.97)',
              backdropFilter: 'blur(10px)',
              border: '1px solid #2a2135',
              borderRadius: 8,
              padding: 4,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            {LANGUAGES.map((l) => {
              const isActive = l.code === active
              return (
                <button
                  key={l.code}
                  onClick={() => setActive(l.code)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: isActive ? 'rgba(232,196,86,0.12)' : 'transparent',
                    border: 'none',
                    borderRadius: 5,
                    padding: '6px 10px',
                    color: isActive ? '#E8C456' : '#ede8d8',
                    fontSize: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>{l.flag}</span>
                  <span style={{ flex: 1 }}>{l.label}</span>
                  {isActive && <span style={{ color: '#E8C456', fontSize: 10 }}>●</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
      {/* Backdrop for outside-click-to-close */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background: 'transparent',
          }}
        />
      )}
    </>
  )
}
