import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import zhCN from './locales/zh-CN'
import en from './locales/en'
import type { Locale } from '../game/model/types'

const dictionaries = {
  'zh-CN': zhCN,
  en
}

type Dictionary = typeof zhCN

const LOCALE_STORAGE_KEY = 'cubefight.locale'

const LocaleContext = createContext<{
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Dictionary
} | null>(null)

function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

function readStoredLocale(): Locale | null {
  if (typeof window === 'undefined') {
    return null
  }

  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  if (storedLocale === 'zh-CN' || storedLocale === 'en') {
    return storedLocale
  }

  return null
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => readStoredLocale() ?? detectLocale())

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  }, [locale])

  const value = useMemo(() => ({ locale, setLocale, t: dictionaries[locale] }), [locale])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider')
  }
  return context
}
