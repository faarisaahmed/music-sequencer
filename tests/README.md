# Jam Session tests

End-to-end tests drive several isolated Chromium profiles that connect over the real Nostr relays.

```
npm run dev -- --port 5391
node tests/jam-e2e.mjs <chromium-executable> http://localhost:5391/ /tmp/jam.png   # main flows
node tests/jam-adversarial.mjs <chromium-executable> http://localhost:5391/ /tmp    # big songs, offline, play-together
node tests/sync-roundtrip.mjs <chromium-executable>                                 # delta/apply property test
node tests/jam-qa-edge.mjs <chromium-executable>        # same-entity drags, delete under editor, undo storms, stalls, 4 peers
node tests/jam-qa-ux.mjs <chromium-executable> http://localhost:5391/ /tmp   # UI states + screenshots, error paths, navigation
node tests/jam-qa-split.mjs <chromium-executable>       # network split & heal keeps both sides' edits
node tests/jam-qa-leave.mjs <chromium-executable>       # edit-then-leave, same-tab rejoin, chat right after joining
node tests/jam-qa-long.mjs <chromium-executable> http://localhost:5391/ 300   # frozen tab, recording, big join, soak
```

Don't edit app source while a run is in progress: Vite hot-reloads the pages under test.
The app exposes `window.__bf` test hooks only when `navigator.webdriver` is set.
