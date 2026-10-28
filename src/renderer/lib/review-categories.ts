import { CommentCategory } from '@shared/types'

export interface CategoryTheme {
  id: CommentCategory
  label: string
  color: string // Hex code for timeline markers & inline styling
  dotClass: string // Tailwind bg class for markers
  stemClass: string // Tailwind bg class for timeline stem
  badgeClass: string // Tailwind classes for card badges
  textColor: string // Hex code or class for readable text
}

export const CATEGORY_THEMES: Record<CommentCategory, CategoryTheme> = {
  SUBTITLE: {
    id: 'SUBTITLE',
    label: 'Phụ đề',
    color: '#d97706',
    dotClass: 'bg-amber-500',
    stemClass: 'bg-amber-400 group-hover:bg-amber-600',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
    textColor: '#b45309'
  },
  PACING: {
    id: 'PACING',
    label: 'Nhịp dựng',
    color: '#059669',
    dotClass: 'bg-emerald-500',
    stemClass: 'bg-emerald-400 group-hover:bg-emerald-600',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    textColor: '#047857'
  },
  AUDIO: {
    id: 'AUDIO',
    label: 'Âm thanh',
    color: '#0284c7',
    dotClass: 'bg-sky-500',
    stemClass: 'bg-sky-400 group-hover:bg-sky-600',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
    textColor: '#0369a1'
  },
  COLOR: {
    id: 'COLOR',
    label: 'Màu sắc',
    color: '#e11d48',
    dotClass: 'bg-rose-500',
    stemClass: 'bg-rose-400 group-hover:bg-rose-600',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
    textColor: '#be123c'
  },
  CUT: {
    id: 'CUT',
    label: 'Nhịp cắt',
    color: '#ea580c',
    dotClass: 'bg-orange-500',
    stemClass: 'bg-orange-400 group-hover:bg-orange-600',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200/80',
    textColor: '#c2410c'
  },
  EFFECT: {
    id: 'EFFECT',
    label: 'Hiệu ứng',
    color: '#7c3aed',
    dotClass: 'bg-violet-500',
    stemClass: 'bg-violet-400 group-hover:bg-violet-600',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200/80',
    textColor: '#6d28d9'
  },
  GRAPHICS: {
    id: 'GRAPHICS',
    label: 'Đồ họa',
    color: '#4f46e5',
    dotClass: 'bg-indigo-500',
    stemClass: 'bg-indigo-400 group-hover:bg-indigo-600',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    textColor: '#4338ca'
  },
  GENERAL: {
    id: 'GENERAL',
    label: 'Chung',
    color: '#64748b',
    dotClass: 'bg-slate-500',
    stemClass: 'bg-slate-400 group-hover:bg-slate-600',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    textColor: '#334155'
  }
}

export const categoryLabels: Record<CommentCategory, string> = {
  SUBTITLE: 'Phụ đề',
  PACING: 'Nhịp dựng',
  AUDIO: 'Âm thanh',
  COLOR: 'Màu sắc',
  CUT: 'Nhịp cắt',
  EFFECT: 'Hiệu ứng',
  GRAPHICS: 'Đồ họa',
  GENERAL: 'Chung'
}

export function getCategoryTheme(category: CommentCategory | string | undefined): CategoryTheme {
  if (!category || !(category in CATEGORY_THEMES)) {
    return CATEGORY_THEMES.GENERAL
  }
  return CATEGORY_THEMES[category as CommentCategory]
}
