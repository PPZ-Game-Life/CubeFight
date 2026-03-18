import React, { createContext, useContext, useMemo } from 'react'
import zhCN from './locales/zh-CN'
import en from './locales/en'
import type { Locale } from '../game/model/types'

const dictionaries = {
  'zh-CN': zhCN,
  en
}

type Dictionary = typeof zhCN

const LocaleContext = createContext<{ locale: Locale; t: Dictionary } | null>(null)

function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = detectLocale()
  const value = useMemo(() => ({ locale, t: dictionaries[locale] }), [locale])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider')
  }
  return context
}
