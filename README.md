# BandForge

A full music studio in the browser, inspired by GarageBand, with a MuseScore-style score editor.

Built for writing original music: there are no loop libraries, auto-generated parts or song wizards. Every note is yours.

**Open it:** https://faarisaahmed.github.io/music-sequencer/

## Features
- **Songs:** home screen with templates and six demo songs. Autosaves in the browser; import/export project files and MIDI.
- **Tracks:** software instruments, drums, audio (mic) and sampler tracks. Move, copy/paste, split, join, trim/extend, loop and duplicate regions; duplicate whole tracks.
- **Instruments:** about 40 sampled and synth instruments (grand piano, guitars, basses, strings, winds, brass, mallets, synths, pads) and 11 drum kits.
- **Editors:**
  - Piano roll with a velocity lane and crescendo/fade tools.
  - Beat Sequencer with Velocity, Note Repeat and Chance modes and a channel rack: per-row mute/solo, volume, pan and tune, plus your own sounds on any row (drop an audio file on it).
  - FL Studio-style patterns: place a pattern anywhere (double-click a drum lane) and copies stay linked, so editing one edits them all; **Make Unique** separates one. **Play Pattern** loops just that pattern without touching the song.
  - Score editor (sheet music, Flat-style): click to write, click above or below a note to build a chord (or +3/+5/+8 buttons, ⌥3/⌥5), click any note to select it, drag across notes to select several, drag a note up/down to change its pitch, and pick a note value to change selected notes (longer values write over what follows, shorter leave a rest). Held notes under moving parts are shown in their own voice and long notes tie cleanly across barlines. Letters A–G, print and MusicXML export.
  - Audio editor with fades, gain, reverse and conversion to a sampler instrument.
- **Playing:** on-screen keyboard, chord strips, arpeggiator, scale lock, musical typing on the computer keyboard, drum pads and Web MIDI controllers.
- **Swing:** one click in the top bar swings the whole song (MPC 16th, Boom Bap, Triplet, Laid Back, Jazz 8th, Shuffle, Hard Shuffle, Human Feel, or your own amount and looseness). Any region can follow the song or have its own swing (Beat Sequencer, Piano Roll or right-click › Swing), and swing can be written into the notes. Exported MIDI includes it.
- **Review loops:** double-click a bar in the ruler to loop it, or press ⇧C to loop the selected regions' bars.
- **Recording:** MIDI recording with count-in and cycle overdub; microphone recording.
- **Mix:** mixer, smart controls, EQ, compressor, drive, chorus, reverb and delay; volume/pan automation and master fades.
- **Song settings:** tempo, key (with transpose) and time signature.
- **Chord track:** sketch your harmony on the timeline, try common progressions and get next-chord ideas.
- **Export:** MP3, WAV, MIDI and per-track stems.
- **Jam Sessions:** make music with friends in real time. Click the people icon, start a session and share the link; everyone edits the same song live, with presence, chat and optional synced playback. Browsers connect peer-to-peer (no account or server).

Press `?` in a song for keyboard shortcuts.

## Develop
```
npm install
npm run dev
```
