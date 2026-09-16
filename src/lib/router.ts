import { type NavRoute } from '../store'

export type SettingsCategory =
  | 'general'
  | 'ai'
  | 'performance'
  | 'integrations'
  | 'automation'
  | 'security'
  | 'advanced'
  | 'desktop'
  | 'usage'
  | 'developer'
  | 'experimental'
  | 'help'

const ROUTE_MAP: Record<string, NavRoute> = {
  '': 'dashboard',
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/business': 'business',
  '/chat': 'chat',
  '/tasks': 'tasks',
  '/files': 'files',
  '/calendar': 'calendar',
  '/search': 'websearch',
  '/websearch': 'websearch',
  '/system': 'system',
  '/settings': 'settings',
}

/**
 * Parse current browser URL pathname and search params into active route and optional category.
 */
export function getRouteFromLocation(): { route: NavRoute; category?: SettingsCategory } {
  if (typeof window === 'undefined') return { route: 'dashboard' }

  const path = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/'
  const searchParams = new URLSearchParams(window.location.search)
  const categoryParam = searchParams.get('category') as SettingsCategory | null

  // Direct path match
  let route: NavRoute = ROUTE_MAP[path] ?? 'dashboard'

  // Subpath handling like /settings/ai
  if (path.startsWith('/settings')) {
    route = 'settings'
    const sub = path.split('/')[2] as SettingsCategory | undefined
    const category = sub || categoryParam || 'general'
    return { route: 'settings', category }
  }

  return { route, category: categoryParam ?? undefined }
}

/**
 * Convert route and settings category into a canonical path.
 */
export function getPathForRoute(route: NavRoute, category?: SettingsCategory): string {
  switch (route) {
    case 'dashboard':
      return '/dashboard'
    case 'business':
      return '/business'
    case 'chat':
      return '/chat'
    case 'tasks':
      return '/tasks'
    case 'files':
      return '/files'
    case 'calendar':
      return '/calendar'
    case 'websearch':
      return '/search'
    case 'system':
      return '/system'
    case 'settings':
      return category && category !== 'general' ? `/settings?category=${category}` : '/settings'
    default:
      return '/dashboard'
  }
}

type RouteListener = (route: NavRoute, category?: SettingsCategory) => void
const listeners = new Set<RouteListener>()

/**
 * Navigate to a new route, updating browser address bar and history.
 */
export function navigate(route: NavRoute, category?: SettingsCategory, replace = false): void {
  if (typeof window === 'undefined') return

  const targetPath = getPathForRoute(route, category)
  const currentPath = window.location.pathname + window.location.search

  if (targetPath !== currentPath) {
    if (replace) {
      window.history.replaceState({ route, category }, '', targetPath)
    } else {
      window.history.pushState({ route, category }, '', targetPath)
    }
  }

  listeners.forEach((listener) => listener(route, category))
}

/**
 * Initialize router listener for popstate (browser back/forward).
 */
export function initRouter(onRoute: RouteListener): () => void {
  listeners.add(onRoute)

  const handlePopState = () => {
    const { route, category } = getRouteFromLocation()
    onRoute(route, category)
  }

  window.addEventListener('popstate', handlePopState)

  // Initial dispatch
  const initial = getRouteFromLocation()
  onRoute(initial.route, initial.category)

  return () => {
    listeners.delete(onRoute)
    window.removeEventListener('popstate', handlePopState)
  }
}
