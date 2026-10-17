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
node tests/beat-patterns.mjs <chromium-executable> http://localhost:5391/ /tmp   # linked patterns, pattern play, swing, row mix, own sounds
node tests/groove.mjs <chromium-executable> http://localhost:5391/ /tmp        # swing: maths, render timing, song vs region, bake, MIDI, pickers
node tests/score-editing.mjs <chromium-executable> http://localhost:5391/ /tmp # score: write, chords, select, values, voices
node tests/shortcuts.mjs <chromium-executable> http://localhost:5391/ /tmp     # tooltips, rebinding, clashes, persistence, score arrows
node tests/grace-notes.mjs <chromium-executable> http://localhost:5391/ /tmp   # grace detection, ⌥G, select/move/delete, MusicXML
node tests/export.mjs <chromium-executable> http://localhost:5391/ /tmp        # MP3/M4A/FLAC/WAV/OGG tags + cover, MIDI instruments/key/markers, remembered settings
node tests/youtube.mjs <chromium-executable> http://localhost:5391/ /tmp       # YouTube publish against a fake Google: setup, channel, metadata, upload, thumbnail, playlist
node tests/safety.mjs <chromium-executable> http://localhost:5391/ /tmp        # versions (auto, named, restore+undo, copy), backups + restore, folder, reminder
node tests/mobile.mjs <chromium-executable> http://localhost:5391/ /tmp        # phone layout, touch gestures (double-tap, hold, pinch), sheets, install, landscape, iPad
node tests/tempo-meter.mjs <chromium-executable> http://localhost:5391/ /tmp   # tempo/meter math, render timing, Tempo lane, LCD, score measures, MIDI/MusicXML
node tests/repeats.mjs <chromium-executable> http://localhost:5391/ /tmp       # repeat/ending/D.S./D.C. order, engine jumps, export, MIDI, score, MusicXML
node tests/parts.mjs <chromium-executable> http://localhost:5391/ /tmp         # print parts: transposed, multi-bar rests, full score, paper, MusicXML per part, ⌘P
node tests/review.mjs <chromium-executable> http://localhost:5391/ /tmp        # writing check: range, rubs, chord clashes, parallels, marks in the score
node tests/guides.mjs <chromium-executable> http://localhost:5391/ /tmp       # guides: every lesson renders, examples play/mute/stop, search, read tracking, ⇧G, phone
node tests/takes.mjs <chromium-executable> http://localhost:5391/ /tmp        # takes: cycle-recorded audio passes, adding takes, take chip/menu, comping by splitting, reopen
node tests/automation.mjs <chromium-executable> http://localhost:5391/ /tmp   # automation lanes for filter, reverb and echo: drawing, playback, knob hand-back, menus, export
node tests/resize-jitter.mjs <chromium-executable> http://localhost:5391/ /tmp # resizing/opening panels never paints a frame at the old size (tracks, piano roll, score, full score, steps, mixer)
node tests/topbar-fit.mjs <chromium-executable> http://localhost:5391/ /tmp # the top bar and tracks toolbar fit any window width (compact in steps, ⋯ menu), never paint an overflowing frame
node tests/sound-search.mjs <chromium-executable> http://localhost:5391/ /tmp # sound library search (tags, synonyms, typos, ranking), filter chips, keyboard choose, preview without changing the track, favourites/recents, New Track search
node tests/sampler.mjs <chromium-executable> http://localhost:5391/ /tmp # Sampler: pitch detection, trim/fades/reverse, Classic vs One-Shot (rendered audio), Slice + Auto Chop, Make Drum Kit, My Samples
node tests/browser-smoke.mjs firefox   # real Firefox: studio, score, render, all export formats, video, MIDI, versions, timeline
node tests/browser-smoke.mjs safari    # real Safari (run `sudo safaridriver --enable` once and allow Remote Automation)
node tests/jam-qa-long.mjs <chromium-executable> http://localhost:5391/ 300   # frozen tab, recording, big join, soak
```

Don't edit app source while a run is in progress: Vite hot-reloads the pages under test.
The app exposes `window.__bf` test hooks only when `navigator.webdriver` is set.
