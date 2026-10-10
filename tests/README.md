# Jam Session tests

End-to-end tests drive several isolated Chromium profiles that connect over the real Nostr relays.

```
npm run dev -- --port 5391
node tests/jam-e2e.mjs <chromium-executable> http://localhost:5391/ /tmp/jam.png
node tests/jam-adversarial.mjs <chromium-executable> http://localhost:5391/ /tmp
node tests/sync-roundtrip.mjs <chromium-executable>
```

The app exposes `window.__bf` test hooks only when `navigator.webdriver` is set.
