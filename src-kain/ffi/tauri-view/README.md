# Kain Tauri View Bridge

This lane is live through Tauron's `tauri-plugin-kain`.

Frontend code calls `@tauri-apps/api/kain` or the injected `window.__KAIN_TAURI__`. Kain owns authored intent; Tauron owns the generic bridge; GreebleFS owns product-specific consumers.
