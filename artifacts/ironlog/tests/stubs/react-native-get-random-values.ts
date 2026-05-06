// In Node (vitest), `crypto.getRandomValues` exists natively on the global
// `crypto` object since Node 19+. The real RN polyfill is unparseable here
// (Flow / RN-only syntax) — we just need this import to be a no-op.
export {};
