let guard: (() => boolean) | null = null

export function confirmNavigation(): boolean {
  return guard ? guard() : true
}

export function registerNavigationGuard(next: () => boolean): () => void {
  guard = next
  return () => { if (guard === next) guard = null }
}
