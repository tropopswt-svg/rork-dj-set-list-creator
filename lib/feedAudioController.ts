// Simple controller to manage feed actions from anywhere in the app.
// This is a plain module (not a route file) so it's guaranteed to be
// a single shared instance across all importers.

let _stopFn: (() => void) | null = null;
let _refreshFn: (() => void) | null = null;

export function registerFeedAudioStop(fn: () => void) {
  _stopFn = fn;
}

export function unregisterFeedAudioStop() {
  _stopFn = null;
}

export function stopFeedAudio() {
  _stopFn?.();
}

export function registerFeedRefresh(fn: () => void) {
  _refreshFn = fn;
}

export function unregisterFeedRefresh() {
  _refreshFn = null;
}

export function refreshFeed() {
  _refreshFn?.();
}
