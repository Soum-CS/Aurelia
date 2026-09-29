/**
 * Aurelia GPS Watcher registry
 * Manages active Geolocation watch IDs and ensures clean teardown on logout.
 */

const activeWatchIds = new Set<number>();

export function registerGpsWatch(watchId: number) {
  activeWatchIds.add(watchId);
}

export function unregisterGpsWatch(watchId: number) {
  activeWatchIds.delete(watchId);
}

/**
 * Stop any active GPS watchers across the entire client application.
 * Called automatically during user logout.
 */
export function stopAllGpsWatchers() {
  if (typeof window === "undefined" || !("geolocation" in navigator)) return;

  for (const id of activeWatchIds) {
    try {
      navigator.geolocation.clearWatch(id);
    } catch {
      // Ignore errors if watch ID was already cleared
    }
  }
  activeWatchIds.clear();

  // Dispatch an event so any mounted components can reset their local watch states
  try {
    window.dispatchEvent(new CustomEvent("aurelia:logout"));
  } catch {
    // Ignore in non-DOM test environments
  }
}
