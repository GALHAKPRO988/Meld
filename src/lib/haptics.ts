export function haptic(ms = 12): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(ms);
    }
  } catch {
    // Vibration may be unavailable or blocked by the browser.
  }
}
