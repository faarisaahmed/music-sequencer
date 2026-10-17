import { Guitar } from 'lucide-react';
import type { Chapter } from '../types';
import { Cards, Compare, Example, K, Lead, Listen, Pro, RangeChart, SectionMap, Spec, Steps, Tip, Try, Ui, Watch, Why } from '../figures';
import { at, bass, chords, drums, line, type GNote, type Part } from '../notation';

const POP_BEAT = drums({ k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 4 });

const BAND: Part[] = [
  { inst: 'kit-acoustic', label: 'Foundation: drums', notes: POP_BEAT },
  { inst: 'electric-bass', label: 'Foundation: bass', notes: bass('Am F C G', { style: 'eighths' }) },
  { inst: 'acoustic-guitar', label: 'Rhythm: guitar', notes: chords('Am F C G', { center: 60, style: 'pulse', v: 0.5 }), vol: 0.8 },
  { inst: 'warm-pad', label: 'Harmony bed: pad', notes: chords('Am F C G', { center: 55, v: 0.4 }), vol: 0.7 },
  { inst: 'flute', label: 'Lead: melody', notes: line('A4:1 C5 E5 D5 | C5:2 A4:2 | G4:1 A4 C5 E5 | D5:3 r:1') },
  { inst: 'bells', label: 'Colour: bells', notes: line('r:7 E6:0.25 D6:0.25 C6:0.5 r:7 G5:0.25 A5:0.25 C6:0.5', { v: 0.6 }) },
];

/** Verse (bars 1–2) into chorus (bars 3–4), flat or lifted. */
function verseToChorus(lifted: boolean): Part[] {
  const verseMelody = line('E4:1 D4 C4 E4 | F4:2 C4:2');
  const chorusMelody = lifted ? line('G4:1 C5:3 | B4:1 D5:3') : line('E4:1 D4 C4 E4 | D4:4');
  const verseDrums = lifted ? drums({ k: 'x.......x.......', rim: '....x.......x...', h: 'x...x...x...x...' }, { bars: 2 }) : drums({ k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 2 });
  const chorusDrums: GNote[] = lifted
    ? [...drums({ c: 'x...............' }), ...drums({ k: 'x.....x.x.....x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' }, { bars: 2 })]
    : drums({ k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 2 });
  const parts: Part[] = [
    { inst: 'flute', label: 'Melody', notes: [...verseMelody, ...at(chorusMelody, 8)] },
    { inst: 'grand-piano', label: 'Piano', notes: chords('Am F C G', { center: 60, style: 'pulse', v: 0.5 }), vol: 0.7 },
    { inst: 'electric-bass', label: 'Bass', notes: lifted ? [...bass('Am F'), ...bass('C G', { style: 'eighths', at: 8 })] : bass('Am F C G', { style: 'quarters' }) },
    { inst: 'kit-acoustic', label: 'Drums', notes: [...verseDrums, ...at(chorusDrums, 8)] },
  ];
  if (lifted) parts.push({ inst: 'string-ensemble', label: 'Strings (chorus only)', notes: chords('C G', { center: 67, at: 8, v: 0.5 }) });
  return parts;
}

const FILL_DRUMS = drums({
  k: 'x.....x.x....... x.....x......... x.....x.x.....x.',
  s: '....x.......x... ....x...x.x..... ....x.......x...',
  h: 'x.x.x.x.x.x.x.x. x.x.x.x......... .xxxxxxxxxxxxxxx',
  t1: '................ ............xx.. ................',
  t2: '................ ..............xx ................',
  c: '................ ................ x...............',
});

const chapter: Chapter = {
  id: 'arrange',
  title: 'Instruments & Arranging',
  blurb: 'Choosing instruments, giving every part a job, song structure and building energy.',
  icon: Guitar,
  color: '#3fb5a5',
  lessons: [
    // ------------------------------------------------------------------ roles
    {
      id: 'roles',
      title: 'Give every part a job',
      minutes: 9,
      summary: 'Professional arrangements sound clear because every instrument has one job and its own space. Learn the five jobs, the "one lead at a time" rule, and how to split the frequency range so parts stop fighting.',
      keywords: 'arrangement roles foundation rhythm harmony pad lead colour ear candy frequency register clutter busy mix band parts',
      body: () => (
        <>
          <Lead>
            Most beginner arrangements have the same problem: too many parts doing the same thing. The fix isn't fewer instruments, it's giving <b>each instrument a job</b> and making sure no two instruments have the same job in the same place at the same time.
          </Lead>

          <h2>The five jobs</h2>
          <p>Almost every part in almost every style of music does one of these five jobs. A small band might cover all five with four players; an orchestra might have twenty players on one job.</p>
          <Cards
            items={[
              { title: 'Foundation', tag: 'bass · kick drum · low strings', color: '#e8a33d', body: 'Defines the harmony from below and carries the groove. Usually one bass line, locked to the kick.' },
              { title: 'Rhythm', tag: 'drums · strummed guitar · piano comping', color: '#5b9be0', body: 'Keeps time and sets the feel: straight or swung, laid-back or driving.' },
              { title: 'Harmony bed', tag: 'pads · sustained strings · organ', color: '#a07ae0', body: 'Fills the middle with the chords. Mostly long notes. Felt more than heard.' },
              { title: 'Lead', tag: 'vocal · melody instrument · solo', color: '#5dbb7a', body: 'The thing people listen to and hum. Only one at a time.' },
              { title: 'Colour', tag: 'bells · fills · counter-lines · effects', color: '#e06a8f', body: 'Ear candy: short, occasional moments that make a section special. Comes and goes.' },
            ]}
          />
          <Example
            title="A small band, one job each"
            bpm={100}
            loop
            chordsAbove="Am F C G"
            parts={BAND}
            caption="Click the chips to mute parts one at a time. Each one removes a different kind of support: the groove, the movement, the warmth, the tune, or the little sparkle at the end of each phrase."
          />
          <Listen>Mute everything except the bass and drums. That's a complete groove on its own. Add the guitar: now you know the chords. Add the pad: now it feels warm and full. Add the melody: now it's a song. The bells only play twice, in the melody's gaps. Every layer is simple; the richness comes from how they stack.</Listen>

          <h2>One lead at a time</h2>
          <p>Your listener can follow one melody comfortably. Two melodies at once can work if they're very different (that's the counter-melody lesson), but two equally loud, equally busy, equally high lines just compete. The rule session arrangers follow: <b>at any moment, one thing is the lead</b>. Everything else either supports it or waits its turn.</p>
          <Compare
            items={[
              {
                label: 'Two leads fighting',
                verdict: 'worse',
                title: 'Sax riff plays all the way through the melody',
                bpm: 100,
                chordsAbove: 'Am F C G',
                parts: [
                  { inst: 'flute', label: 'Melody', notes: line('A4:1 C5 E5 D5 | C5:2 A4:2 | G4:1 A4 C5 E5 | D5:3 r:1') },
                  { inst: 'saxophone', label: 'Sax riff', notes: line('E4:0.5 A4 C5 A4 E4 A4 C5 A4 | F4 A4 C5 A4 F4 A4 C5 A4 | E4 G4 C5 G4 E4 G4 C5 G4 | D4 G4 B4 G4 D4 G4 B4 G4') },
                  { inst: 'acoustic-guitar', label: 'Guitar', notes: chords('Am F C G', { center: 58, v: 0.45 }) },
                ],
                caption: 'Both lines sit in the same octave and both are busy. Where should you listen?',
              },
              {
                label: 'Taking turns',
                verdict: 'better',
                title: 'Sax answers only when the melody rests',
                bpm: 100,
                chordsAbove: 'Am F C G',
                parts: [
                  { inst: 'flute', label: 'Melody', notes: line('A4:1 C5 E5 D5 | C5:2 A4:2 | G4:1 A4 C5 E5 | D5:3 r:1') },
                  { inst: 'saxophone', label: 'Sax fills', notes: line('r:6 E4:0.5 G4 A4:1 r:7 B3:0.5 D4 G4:1') },
                  { inst: 'acoustic-guitar', label: 'Guitar', notes: chords('Am F C G', { center: 58, v: 0.45 }) },
                ],
                caption: 'The sax only plays in the two gaps, so the melody is always clear and the sax becomes a highlight.',
              },
            ]}
          />
          <Watch>Writing a great idea and then playing it all the way through the song is one of the most common beginner habits. A guitar riff or synth line can be amazing in the intro and between vocal lines, but under the vocal it's a distraction. Mute it there, or turn it into long notes.</Watch>

          <h2>Lanes: register and frequency</h2>
          <p>Parts also need their own <b>space</b>. Instruments that play in the same register compete for the same frequencies, so even if they play different notes they mask each other. Think of the range from deep bass to high cymbals as lanes on a motorway, and give each important part its own.</p>
          <RangeChart
            unit="hz"
            rows={[
              { label: 'Kick drum', lo: 45, hi: 110, color: '#e8a33d', note: 'thump' },
              { label: 'Bass', lo: 40, hi: 300, color: '#e8a33d' },
              { label: 'Guitar / piano', lo: 100, hi: 4000, color: '#5b9be0' },
              { label: 'Pad', lo: 150, hi: 3000, color: '#a07ae0' },
              { label: 'Vocal / lead', lo: 200, hi: 5000, color: '#5dbb7a', note: 'the important middle' },
              { label: 'Snare', lo: 180, hi: 6000, color: '#e8a33d' },
              { label: 'Hi-hats, cymbals', lo: 5000, hi: 16000, color: '#45b8c4', note: 'air' },
            ]}
            caption="Where the main energy of common parts sits, in hertz (Hz). The crowded zone is roughly 200 Hz to 4 kHz: it's where the vocal, guitars, keys and pads all live, and where arrangements get cluttered."
          />
          <Spec
            title="Ways to give parts their own lane"
            rows={[
              ['Octave', 'Move one of two clashing parts up or down an octave. The simplest and most effective fix.'],
              ['Rhythm', 'If two parts must share a register, make one of them long notes and the other short.'],
              ['Time', 'Let them take turns: one plays in the verse, the other in the chorus.'],
              ['Sound', 'Choose contrasting instruments. A bright pluck and a soft pad can share an octave far better than two pianos.'],
              ['Mix', 'Pan them apart, and use EQ to trim the lows from parts that don\'t need them (see the Effects & Mixing chapter).'],
            ]}
          />
          <Why>Your ear has a limited number of "slots". Two sounds with similar pitch, timing and tone get merged into one blurry sound (masking). Separate them on any of those three dimensions and the ear can pick them apart again. Arranging and mixing are really the same skill applied at different stages.</Why>

          <Try>
            <Steps>
              <li>Play your song and write down, for each track, which of the five jobs it does. If two tracks have the same job in the same section, you've found your clutter.</li>
              <li>Solo pairs of tracks that share a job (select a track, press <K>S</K>). Decide which one wins that section and mute the other there, or move it an octave (right-click the region, <Ui>Transpose</Ui> → <Ui>Up an Octave</Ui>).</li>
              <li>Rename tracks by their job, not their instrument (double-click the track name), for example "Lead", "Pad", "Rhythm keys". It's surprising how much clearer the arrangement becomes when you can see the jobs.</li>
              <li>Use the <Ui>Mixer</Ui> (<K>X</K>) to pan parts that share a register to opposite sides with the <Ui>Pan</Ui> knob.</li>
            </Steps>
          </Try>
          <Pro>Producers often do a "mute pass" before mixing: play the song and try muting each track in each section. Anything you don't miss when it's muted gets cut from that section. Arrangements almost always get better with fewer parts playing at once, not more.</Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ instruments & ranges
    {
      id: 'instruments',
      title: 'Choosing instruments and their ranges',
      minutes: 11,
      summary: 'Every instrument has a range it can play, a sweet spot where it sounds best, and things it is great or terrible at. Know these and your parts will sound like real players instead of notes in a grid.',
      keywords: 'instrument range sweet spot register tessitura orchestration strings brass woodwind flute clarinet trumpet horn cello violin piano guitar pairing blend',
      body: () => (
        <>
          <Lead>
            In BandForge any instrument can play any note you draw. Real instruments can't. A flute can't play below middle C, a trumpet player needs to breathe, and a tuba playing high and fast sounds silly. Writing within each instrument's real abilities is the quickest way to make a virtual arrangement sound believable, even if no human will ever play it.
          </Lead>

          <h2>The ranges</h2>
          <p>Here are the playable ranges of the real instruments that BandForge's <Ui>Check</Ui> panel knows about. These are the same ranges it uses when it flags notes an instrument can't play.</p>
          <RangeChart
            sweet
            rows={[
              { label: 'Piano', lo: 21, hi: 108, color: '#939089' },
              { label: 'Tuba', lo: 26, hi: 65, color: '#e8a33d' },
              { label: 'Upright bass', lo: 28, hi: 67, color: '#e06a8f' },
              { label: 'Electric bass', lo: 28, hi: 67, color: '#e06a8f' },
              { label: 'Bassoon', lo: 34, hi: 75, color: '#5dbb7a' },
              { label: 'French horn', lo: 35, hi: 77, color: '#e8a33d' },
              { label: 'Cello', lo: 36, hi: 81, color: '#e06a8f' },
              { label: 'Trombone', lo: 40, hi: 72, color: '#e8a33d' },
              { label: 'Guitar', lo: 40, hi: 88, color: '#5b9be0' },
              { label: 'Alto sax', lo: 49, hi: 80, color: '#5dbb7a' },
              { label: 'Clarinet', lo: 50, hi: 91, color: '#5dbb7a' },
              { label: 'Trumpet', lo: 52, hi: 82, color: '#e8a33d' },
              { label: 'Violin', lo: 55, hi: 103, color: '#e06a8f' },
              { label: 'Flute', lo: 60, hi: 96, color: '#5dbb7a' },
              { label: 'Xylophone', lo: 65, hi: 108, color: '#45b8c4' },
            ]}
            caption="Playable sounding ranges. Strings in rose, woodwinds in green, brass in amber. The amber dot on the axis is middle C (C4)."
          />
          <p>The full range is what's <em>possible</em>. The <b>sweet spot</b> is usually the middle half: the lowest few notes of most wind instruments are weak or gruff, and the top few are strained and hard to play quietly. When in doubt, keep parts away from the extremes.</p>

          <h2>What each family is good (and bad) at</h2>
          <Cards
            items={[
              { title: 'Strings', tag: 'violin · cello · string ensemble · upright bass', color: '#e06a8f', body: 'Can sustain forever, swell and fade, and play very fast. The most flexible family. Weak at sharp, punchy attacks unless played pizzicato (plucked).' },
              { title: 'Brass', tag: 'trumpet · trombone · french horn · tuba', color: '#e8a33d', body: 'Power and nobility. Players need to breathe, so write rests every few bars, and avoid long fast runs. Horns are warm and blend with everything; trumpets cut through everything.' },
              { title: 'Woodwinds', tag: 'flute · clarinet · saxophone · bassoon', color: '#5dbb7a', body: 'Agile and expressive, each with a distinct colour. Flute is airy and weak in its low octave; clarinet is smooth and dark down low; bassoon is the woody, slightly comic bass of the section.' },
              { title: 'Keyboards', tag: 'piano · electric piano · organ', color: '#939089', body: 'Cover everything from bass to treble, which is exactly the danger: a two-handed piano part can fill the whole frequency range and leave no room for anyone else.' },
              { title: 'Guitars', tag: 'acoustic · electric · nylon', color: '#5b9be0', body: 'Rhythm and harmony in one. Strummed guitar fills the mid-range with movement. Chords on a guitar are naturally spread out (open voicings), which is part of why they sound good.' },
              { title: 'Mallets & bells', tag: 'marimba · xylophone · celesta · bells', color: '#45b8c4', body: 'Short, bright attacks that decay quickly. Perfect for doubling a melody to make it sparkle, terrible for long sustained lines.' },
            ]}
          />
          <Compare
            items={[
              {
                label: 'Piano: attack, then fade',
                title: 'A held chord on piano',
                bpm: 70,
                parts: [{ inst: 'grand-piano', label: 'Piano', notes: chords('C:8 Am:8', { center: 60 }) }],
                caption: 'Notes start strong and immediately begin to die away. Long notes need re-striking or pedal.',
              },
              {
                label: 'Strings: sustain',
                title: 'The same chord on strings',
                bpm: 70,
                parts: [{ inst: 'string-ensemble', label: 'Strings', notes: chords('C:8 Am:8', { center: 60 }) }],
                caption: 'The sound holds as long as the bow moves. This is why strings are the default for pads in film and ballads.',
              },
            ]}
          />
          <Tip>The two together are a classic combination for exactly this reason: piano gives each chord a clear start, strings carry it through. Write the same chords on both, keep the piano rhythmic and the strings held.</Tip>

          <h2>Combinations that blend</h2>
          <p>Some instrument pairs sound like one rich new instrument when they play together. These are the combinations orchestrators reach for again and again:</p>
          <Spec
            rows={[
              ['Flute + clarinet', 'An octave apart, or in 3rds: soft, round, perfectly blended. The classic woodwind pairing.'],
              ['Violins + flute', 'Flute an octave above the violins on the melody adds a silvery shine.'],
              ['Horn + cello', 'Both warm and singing in the same range. Doubled in unison, they make a broad, heroic tune.'],
              ['Piano + bells', 'Bells doubling the top of the piano melody an octave up: music-box sparkle.'],
              ['Strings + bass in octaves', 'Cellos and basses an octave apart: the deep, solid foundation of almost every orchestral piece.'],
            ]}
          />
          <Example
            title="Flute melody, then clarinet doubling an octave below"
            bpm={88}
            chordsAbove="F C Dm Bb"
            parts={[
              { inst: 'flute', label: 'Flute', notes: line('A5:1 G5 F5 C6 | G5:3 r:1 | F5:1 E5 D5 A5 | F5:4') },
              { inst: 'clarinet', label: 'Clarinet', notes: line('A4:1 G4 F4 C5 | G4:3 r:1 | F4:1 E4 D4 A4 | F4:4') },
              { inst: 'harp', label: 'Harp', notes: chords('F C Dm Bb', { center: 55, style: 'arp', v: 0.45 }), vol: 0.7 },
            ]}
            caption="Mute the clarinet and the flute sounds thin and pretty; unmute it and the melody becomes rounder and warmer. That's doubling in octaves."
          />

          <h2>Writing like a real player</h2>
          <Cards
            items={[
              { title: 'Let wind players breathe', body: 'Every 2–4 bars, leave at least a short rest in brass and woodwind parts. Phrases without breaths sound mechanical even to listeners who don\'t know why.' },
              { title: 'Low means slow', body: 'Low instruments speak slowly and sound muddy when busy. Keep tuba, bassoon, bass and low cello parts simpler and slower than the parts above them.' },
              { title: 'Vary the velocity', body: 'Real players never hit every note equally. Make phrase peaks louder and ends softer in the velocity lane of the piano roll.' },
              { title: 'Respect the extremes', body: 'Very high notes are for climaxes. A violin part that lives above the treble staff the whole song sounds shrill and exhausting.' },
            ]}
          />
          <Watch>"I'll just use piano for everything" is the most common beginner arrangement. Piano is wonderful, but two piano parts, plus a piano bass line, all in the same instrument, give the ear nothing to tell apart. Try moving the bass to a bass instrument and the chords to strings or a pad, and leave the piano for one role.</Watch>

          <Try>
            <Steps>
              <li>To pick a sound, click a track's instrument icon (or right-click the track, <Ui>Change Instrument…</Ui>). Instruments are grouped by family: Keyboards, Guitars &amp; Bass, Strings, Winds &amp; Brass, Mallets &amp; Bells and Synths.</li>
              <li>Write your part, then open <Ui>Check</Ui> (<K>⇧</K>+<K>W</K>) and look at the <Ui>Range</Ui> filter. It lists every stretch of notes the real instrument couldn't play, per track.</li>
              <li>Fix out-of-range notes by moving them an octave (select them and press <K>⇧</K>+<K>↑</K> or <K>⇧</K>+<K>↓</K> in the piano roll), or hand that passage to an instrument that can reach it.</li>
              <li>Turn on <Ui>Mark notes</Ui> in the Check panel to see flagged notes highlighted in the piano roll and score as you work.</li>
            </Steps>
          </Try>
          <Pro>Arrangers choose instruments by <b>role first, sound second</b>. They decide "I need a warm counter-melody below the vocal" and only then ask which instrument does that best (a cello, a horn, a low clarinet). Choosing a sound because it's cool and then looking for something for it to do is how arrangements get cluttered.</Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ structure
    {
      id: 'structure',
      title: 'Song structure',
      minutes: 9,
      summary: 'Verses, choruses, bridges and the rest each have a job. Learn the common shapes, typical lengths, and how to lay out a whole song in BandForge\'s arrangement track before you write every note.',
      keywords: 'song structure form intro verse pre-chorus chorus bridge outro AABA verse chorus sections arrangement track bars length',
      body: () => (
        <>
          <Lead>
            A great four-bar idea isn't a song yet. What turns it into one is <b>structure</b>: a plan for which ideas come back, which change, and where the big moments are. Almost every song you've heard follows one of a few shapes, and once you know them, finishing songs gets dramatically easier.
          </Lead>

          <h2>The sections and their jobs</h2>
          <Spec
            rows={[
              ['Intro', 'Sets the mood and tempo. Often 4 or 8 bars, frequently a piece of the chorus or the main riff. Short is better.'],
              ['Verse', 'Tells the story. Same music each time, new words. Lower, calmer and less busy than the chorus, so the chorus has somewhere to go. Usually 8 or 16 bars.'],
              ['Pre-chorus', 'A short ramp (often 4 bars) that builds tension: chords that feel unsettled, rising melody, the drums starting to build.'],
              ['Chorus', 'The point of the song. The hook, the title, the highest and fullest part, and identical (or nearly) every time. Usually 8 bars.'],
              ['Bridge', 'Something new, once, around two-thirds of the way through: different chords, a key change, a breakdown. It makes the last chorus feel fresh.'],
              ['Outro', 'The ending. Repeat the chorus and fade, slow down, or strip back to the intro idea. Avoid just stopping.'],
            ]}
          />

          <h2>The verse–chorus shape</h2>
          <p>This is the shape of most pop, rock, country and R&amp;B. It alternates storytelling (verse) with a payoff (chorus), adds a bridge for contrast, and finishes on the chorus one or two more times.</p>
          <SectionMap
            sections={[
              { name: 'Intro', bars: 4, energy: 1.5 },
              { name: 'Verse', bars: 8, energy: 2 },
              { name: 'Pre-Chorus', bars: 4, energy: 3 },
              { name: 'Chorus', bars: 8, energy: 4 },
              { name: 'Verse 2', bars: 8, energy: 2.5 },
              { name: 'Pre-Chorus 2', bars: 4, energy: 3.2 },
              { name: 'Chorus 2', bars: 8, energy: 4.2 },
              { name: 'Bridge', bars: 8, energy: 2.8 },
              { name: 'Chorus 3', bars: 8, energy: 5 },
              { name: 'Outro', bars: 4, energy: 2 },
            ]}
            caption="A typical modern song: 64 bars, about two and a half minutes at 100 BPM. The heights show energy. Notice the second verse is a little bigger than the first, and the bridge drops down so the last chorus can be the biggest moment."
          />
          <p>Most songs get to the first chorus within about 45–60 seconds. If your first chorus doesn't arrive until bar 32 at 90 BPM, that's almost a minute and a half of build-up, and listeners may leave first.</p>

          <h2>The AABA shape</h2>
          <p>Older popular songs, jazz standards and many Beatles songs use <b>AABA</b>: a main section (A) played twice, a contrasting section (B, also called the bridge or middle eight), then A again. There's no separate chorus; the hook usually sits at the start or end of each A section.</p>
          <SectionMap
            sections={[
              { name: 'A', bars: 8, energy: 3, note: 'the tune' },
              { name: 'A', bars: 8, energy: 3, note: 'again, new words' },
              { name: 'B', bars: 8, energy: 3.8, note: 'new chords' },
              { name: 'A', bars: 8, energy: 3.5, note: 'home' },
            ]}
            caption="32 bars in four equal parts. 'Somewhere Over the Rainbow' and 'Yesterday' both work this way."
          />
          <Cards
            items={[
              { title: 'Instrumental & electronic', tag: 'build · drop · breakdown', body: 'Dance music replaces verses and choruses with energy sections: intro, build, drop, breakdown, build, drop, outro. Each section is usually 8, 16 or 32 bars.' },
              { title: 'Classical & film', tag: 'ABA · theme and variations', body: 'A theme (A), a contrasting middle (B), and the theme returning (A), often changed. Or one theme repeated with a new arrangement each time.' },
              { title: 'Blues', tag: '12-bar', body: 'One 12-bar chord pattern repeated, with new lyrics or solos each time. The structure is the repetition.' },
            ]}
          />

          <h2>Making the chorus feel like a chorus</h2>
          <p>A chorus doesn't feel like a chorus because you've named it one; it feels like one because it's <b>different</b> from the verse in several ways at once. Compare these two sections built on related chords:</p>
          <Compare
            items={[
              {
                label: 'Verse',
                title: 'Low melody, short phrases, light accompaniment',
                bpm: 96,
                chordsAbove: 'Am F C G',
                parts: [
                  { inst: 'flute', label: 'Melody', notes: line('E4:1 E4 E4 D4 | C4:2 r:2 | E4:1 E4 G4 E4 | D4:3 r:1') },
                  { inst: 'warm-pad', label: 'Pad', notes: chords('Am F C G', { center: 55, v: 0.45 }) },
                  { inst: 'electric-bass', label: 'Bass', notes: bass('Am F C G') },
                  { inst: 'kit-acoustic', label: 'Drums', notes: drums({ k: 'x.......x.......', h: 'x...x...x...x...' }, { bars: 4 }) },
                ],
              },
              {
                label: 'Chorus',
                verdict: 'better',
                title: 'Higher melody, long notes, full band',
                bpm: 96,
                chordsAbove: 'F G C Am',
                parts: [
                  { inst: 'flute', label: 'Melody', notes: line('A4:2 C5:2 | D5:3 B4:1 | E5:2 C5:2 | C5:4') },
                  { inst: 'grand-piano', label: 'Piano', notes: chords('F G C Am', { center: 60, style: 'pulse', v: 0.55 }) },
                  { inst: 'electric-bass', label: 'Bass', notes: bass('F G C Am', { style: 'eighths' }) },
                  { inst: 'kit-acoustic', label: 'Drums', notes: [...drums({ c: 'x...............' }), ...POP_BEAT] },
                ],
              },
            ]}
          />
          <Spec
            title="Contrast checklist: verse versus chorus"
            rows={[
              ['Melody range', 'Chorus melody sits higher, often by a 4th to an octave.'],
              ['Note lengths', 'Verse: more words, shorter notes. Chorus: fewer words, longer notes.'],
              ['Chords', 'Start the chorus on a different chord from the verse. Verses often start on vi (Am), choruses on IV or I.'],
              ['Density', 'More parts, busier drums, wider stereo in the chorus.'],
              ['Rhythm', 'Hats from quarters to eighths, or bass from long notes to driving eighths.'],
            ]}
          />
          <Watch>The most common structural mistake is a verse and chorus that are too similar: same range, same rhythm, same instruments. The chorus arrives and nothing happens. Change at least three things from the checklist above.</Watch>

          <h2>Lay out the whole song first</h2>
          <p>Before writing every part, sketch the structure. Decide the sections and their lengths, write the chorus first (it's the hardest and most important), then copy material around and develop it. It's far easier to write a verse when you know what chorus it's leading to.</p>
          <Try>
            <Steps>
              <li>Make sure <Ui>Arrangement</Ui> is switched on in the timeline toolbar. It shows the arrangement track above your tracks.</li>
              <li>Click <Ui>Add a section</Ui> (the <b>+</b> on the arrangement track) to add sections one after another. Right-click a section and use <Ui>Name</Ui> to pick Intro, Verse, Pre-Chorus, Chorus, Bridge, Breakdown, Solo or Outro.</li>
              <li>Set lengths with <Ui>Add 4 Bars</Ui> and <Ui>Remove 4 Bars</Ui> from the right-click menu, or drag the section's right edge.</li>
              <li>Once a chorus is written, right-click it and choose <Ui>Duplicate Section</Ui> to copy it, with all its music, for the next chorus. Then change what should grow.</li>
              <li>Double-click a section to loop it while you work on it, and drag sections to try a different order.</li>
            </Steps>
          </Try>
          <Pro>Hit songwriters often say "don't bore us, get to the chorus". Many modern pop songs start with a short piece of the chorus as the intro, so the hook is heard in the first 10 seconds, and keep verses to 8 bars. Try timing your song: if the first chorus arrives after 60 seconds, look for something to cut.</Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ energy
    {
      id: 'energy',
      title: 'Building energy: build-ups and drops',
      minutes: 9,
      summary: 'Songs feel exciting when energy rises and falls on purpose. Learn the six levers that control energy, how a pre-chorus lifts into a chorus, why stripping back makes the last chorus hit hardest, and how to write fills that announce a new section.',
      keywords: 'energy build up drop lift dynamics contrast layers density register fill transition crash strip back breakdown arrangement climax',
      body: () => (
        <>
          <Lead>
            Listen to a song you love and pay attention not to the notes but to the <b>energy</b>: how full, loud and intense it feels at each moment. It's never flat. It rises into choruses, drops in breakdowns, and peaks near the end. That curve is planned, and you control it with a handful of levers.
          </Lead>

          <h2>The six energy levers</h2>
          <Cards
            items={[
              { title: 'Layers', tag: 'more parts = more energy', body: 'The obvious one. Add an instrument and the section grows; take one away and it shrinks.' },
              { title: 'Register', tag: 'higher = more intense', body: 'Melodies, pads and even bass moving up an octave raise energy without adding anything new.' },
              { title: 'Rhythmic density', tag: 'faster notes = more drive', body: 'Hi-hats from quarters to eighths to sixteenths. Bass from long notes to pumping eighths.' },
              { title: 'Dynamics', tag: 'velocity and volume', body: 'Harder-hit notes sound brighter and more urgent, not just louder.' },
              { title: 'Harmonic rhythm', tag: 'how often chords change', body: 'Faster chord changes push forward; one chord held for bars builds suspense.' },
              { title: 'Width', tag: 'stereo spread', body: 'Panning parts wide in the chorus and narrower in the verse makes the chorus feel bigger.' },
            ]}
          />
          <p>The trick is to use several levers at once. A chorus that only adds one instrument feels like a slightly bigger verse; a chorus that adds layers, rises in register, doubles the hi-hat speed and hits a crash cymbal feels like an arrival.</p>
          <Compare
            items={[
              {
                label: 'Flat',
                verdict: 'worse',
                title: 'Verse into chorus with nothing changing',
                bpm: 100,
                chordsAbove: 'Am F C G',
                mark: [
                  [0, 8, 'Verse'],
                  [8, 16, 'Chorus'],
                ],
                parts: verseToChorus(false),
                caption: 'Same melody range, same drums, same bass. You can\'t hear where the chorus starts.',
              },
              {
                label: 'Lifted',
                verdict: 'better',
                title: 'The same chords with four levers pulled',
                bpm: 100,
                chordsAbove: 'Am F C G',
                mark: [
                  [0, 8, 'Verse'],
                  [8, 16, 'Chorus'],
                ],
                parts: verseToChorus(true),
                caption: 'Lighter verse drums, then a crash, sixteenth-note hats, driving bass, strings and a melody a 5th higher. Same chords, unmistakable chorus.',
              },
            ]}
          />

          <h2>Plan the curve</h2>
          <p>Sketch the energy for the whole song before you arrange it. The shape almost always looks like a rising zig-zag: each chorus a bit bigger than the last, with drops in between so the rises feel like rises.</p>
          <SectionMap
            sections={[
              { name: 'Intro', bars: 4, energy: 1.5, note: 'pad + one hook' },
              { name: 'Verse', bars: 8, energy: 2, note: 'bass, light drums' },
              { name: 'Pre-Chorus', bars: 4, energy: 3, note: 'build, fill' },
              { name: 'Chorus', bars: 8, energy: 4, note: 'everyone' },
              { name: 'Verse 2', bars: 8, energy: 2.6, note: '+ counter-line' },
              { name: 'Chorus 2', bars: 8, energy: 4.3, note: '+ strings' },
              { name: 'Bridge', bars: 8, energy: 2.2, note: 'strip back' },
              { name: 'Chorus 3', bars: 8, energy: 5, note: 'biggest: + octave up' },
            ]}
          />
          <Why>The ear measures energy relative to what came just before. A loud chorus after a loud verse barely registers; the same chorus after a quiet bridge feels enormous. That's why the most powerful move before a final chorus is to take things <em>away</em>: drop to just vocal and piano for a few bars, then bring everything back at once.</Why>

          <h2>The pre-chorus lift</h2>
          <p>A pre-chorus is a ramp. Its job is to create tension that the chorus releases. Common ingredients, use two or three:</p>
          <ul>
            <li><b>Chords that avoid home</b>: lean on IV and V (F and G in C major) and don't resolve to I until the chorus.</li>
            <li><b>A rising melody</b>, each phrase starting a little higher than the last.</li>
            <li><b>Drums building</b>: kick on every beat, or snare hits getting faster in the last bar.</li>
            <li><b>A pause</b>: everything stops for half a beat or a beat right before the chorus. The silence makes the downbeat explode.</li>
          </ul>

          <h2>Fills announce new sections</h2>
          <p>A drum fill in the last beat or two before a new section tells the listener "something's about to change". Then a crash cymbal on the first beat of the new section marks the arrival. Fills are the punctuation of an arrangement.</p>
          <Example
            title="A tom fill into the chorus, crash on the downbeat"
            bpm={104}
            mark={[[6, 8, 'fill']]}
            parts={[
              { inst: 'kit-acoustic', label: 'Drums', notes: FILL_DRUMS },
              { inst: 'electric-bass', label: 'Bass', notes: [...bass('Am F'), ...bass('C', { style: 'eighths', at: 8 })] },
            ]}
            caption="Bar 2 drops the hi-hat and rolls down the toms in the last two beats; bar 3 lands on a crash with busier hats and driving bass. Keep fills short: one or two beats is usually plenty."
          />
          <Watch>Don't put a fill at the end of every 4 bars. Fills are signposts; if every bar has one, they stop meaning anything. Save them for the bar before a new section, and keep the smaller ones (a single extra snare hit) for the middle of sections.</Watch>

          <h2>Drops and breakdowns</h2>
          <p>Electronic music makes the energy curve its main event. A <b>build</b> raises tension over 8 or 16 bars (rising pitch, faster snare rolls, a filter opening, the kick dropping out), then the <b>drop</b> brings in the full beat and bass at once. A <b>breakdown</b> strips almost everything away, leaving pads and a melody, so the next drop can land again. The same principle works in any style.</p>
          <Tip>The bigger the moment you want, the more you should take away just before it. A full bar of silence (or just the vocal) before the last chorus is one of the oldest and most effective tricks in pop.</Tip>

          <Try>
            <Steps>
              <li>Sketch the energy curve using the arrangement track's sections, then decide for each section which levers it pulls.</li>
              <li>Write the biggest chorus first with everything in. Then <Ui>Duplicate Section</Ui> it for earlier choruses and <em>remove</em> parts from those, rather than building up from nothing.</li>
              <li>Use velocity to shape intensity: in the piano roll's velocity lane, make chorus notes harder than verse notes.</li>
              <li>For gradual builds and fades, use automation: click a track's <Ui>A</Ui> button to show its volume automation lane, then click to add points and draw a rise across the pre-chorus.</li>
              <li>In the step sequencer, write a separate one-bar fill pattern and place it only in the bar before each new section.</li>
            </Steps>
          </Try>
          <Pro>Listen to almost any big pop production and count the layers in the first verse and the last chorus. It's common for a last chorus to have two or three times as many parts as the first verse, added a few at a time across the song so the listener never notices the growth, only feels it.</Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ orchestration
    {
      id: 'orchestration',
      title: 'Orchestration basics',
      minutes: 10,
      summary: 'How to write for strings, woodwinds and brass so they sound like an orchestra rather than a keyboard preset: dividing the string section, doubling melodies across families, solo versus tutti, and how film composers layer a cue.',
      keywords: 'orchestration orchestra strings divisi violin cello bass woodwinds brass horn doubling tutti solo film score cinematic layering ostinato',
      body: () => (
        <>
          <Lead>
            Orchestration is arranging for many instruments at once, and the orchestra is the biggest palette of all. The good news: it follows the same principles as any arrangement (jobs, registers, contrast) with a few extra techniques that make it sound grand instead of cluttered.
          </Lead>

          <h2>The string section is a choir</h2>
          <p>Think of the strings as four or five singers: <b>violins</b> on top (often split into firsts and seconds), <b>violas</b> in the middle, <b>cellos</b> below and <b>basses</b> at the bottom. Each section plays one line, and together they make full four-part harmony. Writing each line separately, instead of one big chord, is what makes strings sound alive.</p>
          <Example
            title="Strings as four separate lines"
            bpm={66}
            chordsAbove="C Am Dm G"
            names
            parts={[
              { inst: 'violin', label: 'Violins I', notes: line('E5:2 D5:2 | C5:2 E5:2 | F5:2 D5:2 | D5:4') },
              { inst: 'violin', label: 'Violins II', notes: line('C5:2 B4:2 | A4:2 C5:2 | D5:2 A4:2 | B4:4'), vol: 0.8 },
              { inst: 'cello', label: 'Cellos', notes: line('G3:4 | E3:4 | F3:4 | G3:2 F3:2'), vol: 0.85 },
              { inst: 'upright-bass-bowed', label: 'Basses', notes: line('C2:4 | A1:4 | D2:4 | G1:4') },
            ]}
            caption="The second violins move mostly in 3rds and 6ths below the firsts; the cellos fill in the chord tones; the basses give each root. Mute them one at a time: every line matters."
          />
          <Spec
            title="String techniques worth knowing"
            rows={[
              ['Divisi', 'Splitting one section into two or more notes, e.g. violins playing a 3rd apart. Makes the sound thinner per note but richer overall.'],
              ['Octave doubling', 'Cellos and basses an octave apart on the bass line is standard. Violins doubled at the octave on the tune is the "big emotional moment" sound.'],
              ['Pizzicato', 'Plucked strings: short, light and rhythmic. Perfect for playful or tense ostinatos. BandForge has Pizzicato Strings.'],
              ['Sustain and swell', 'Long notes that grow louder then fade. Use velocity or volume automation to shape them.'],
            ]}
          />

          <h2>Woodwind and brass colours</h2>
          <Cards
            items={[
              { title: 'Flute', tag: 'airy, light', color: '#5dbb7a', body: 'Floats above everything. Best in its middle and upper octaves; the bottom octave is soft and easily covered.' },
              { title: 'Clarinet', tag: 'smooth, dark to bright', color: '#5dbb7a', body: 'Dark and velvety down low, sweet in the middle. One of the most blendable instruments in the orchestra.' },
              { title: 'Bassoon', tag: 'woody, reedy', color: '#5dbb7a', body: 'The bass of the woodwinds. Can be noble or comic. Often doubles the cellos.' },
              { title: 'French horn', tag: 'warm, heroic', color: '#e8a33d', body: 'The glue of the orchestra. Blends with strings and woodwinds and carries big film themes.' },
              { title: 'Trumpet', tag: 'bright, cutting', color: '#e8a33d', body: 'Fanfares and climaxes. Cuts through anything, so use it sparingly.' },
              { title: 'Trombone & tuba', tag: 'weight, power', color: '#e8a33d', body: 'Massive low brass. Sustained chords for grandeur, short hits for menace.' },
            ]}
          />

          <h2>Doubling across families</h2>
          <p>The defining orchestral sound is a melody doubled by instruments from <b>different families</b>, often in octaves. Each instrument adds its own colour, and together they sound like a single, huge voice.</p>
          <Compare
            items={[
              {
                label: 'Solo',
                title: 'One violin carries the tune',
                bpm: 76,
                chordsAbove: 'Dm Bb F C',
                parts: [
                  { inst: 'violin', label: 'Violin', notes: line('A4:2 D5:2 | F5:3 D5:1 | C5:2 A4:2 | G4:2 E5:2') },
                  { inst: 'string-ensemble', label: 'Strings pad', notes: chords('Dm Bb F C', { center: 55, v: 0.4 }), vol: 0.7 },
                ],
                caption: 'Intimate and personal. Right for a quiet verse or an opening statement.',
              },
              {
                label: 'Tutti',
                title: 'Violin, flute an octave up, horn and cello an octave down',
                bpm: 76,
                chordsAbove: 'Dm Bb F C',
                parts: [
                  { inst: 'violin', label: 'Violin', notes: line('A4:2 D5:2 | F5:3 D5:1 | C5:2 A4:2 | G4:2 E5:2') },
                  { inst: 'flute', label: 'Flute (8va)', notes: line('A5:2 D6:2 | F6:3 D6:1 | C6:2 A5:2 | G5:2 E6:2'), vol: 0.7 },
                  { inst: 'french-horn', label: 'Horn (8vb)', notes: line('A3:2 D4:2 | F4:3 D4:1 | C4:2 A3:2 | G3:2 E4:2'), vol: 0.8 },
                  { inst: 'cello', label: 'Cello (8vb)', notes: line('A3:2 D4:2 | F4:3 D4:1 | C4:2 A3:2 | G3:2 E4:2'), vol: 0.7 },
                  { inst: 'upright-bass-bowed', label: 'Bass', notes: bass('Dm Bb F C') },
                ],
                caption: 'The same tune, now the whole orchestra. Mute the flute or horn to hear how much colour each adds.',
              },
            ]}
          />
          <Listen>The return of the main theme in nearly every film score (the end of Star Wars, the flying sequences in E.T., Howard Shore's Shire theme in its full form) uses exactly this move: a tune first heard on a single instrument comes back doubled in octaves across strings, horns and woodwinds.</Listen>

          <h2>How film composers layer a cue</h2>
          <p>A typical action or adventure cue stacks four layers, each with a clear job: a fast <b>ostinato</b> (a repeating figure) for motion, sustained <b>low strings or brass</b> for weight, a <b>melody</b> on horns or violins, and <b>percussion</b> for impact. Add them one at a time and the cue grows on its own.</p>
          <Example
            title="Four layers of a cinematic cue"
            bpm={92}
            loop
            chordsAbove="Dm Bb F C"
            parts={[
              { inst: 'pizzicato-strings', label: 'Ostinato', notes: chords('Dm Bb F C', { center: 62, style: 'arp', v: 0.6 }) },
              { inst: 'string-ensemble', label: 'Low strings', notes: chords('Dm Bb F C', { center: 48, v: 0.55 }) },
              { inst: 'french-horn', label: 'Horn melody', notes: line('A3:2 D4:2 | F4:3 D4:1 | C4:2 A3:2 | G3:2 E4:2') },
              { inst: 'kit-acoustic', label: 'Percussion', notes: drums({ t2: 'x.....x.x.......', k: 'x.......x.......' }, { bars: 4 }) },
            ]}
            caption="Start with only the ostinato, then unmute the low strings, then the horn, then percussion. That order is how many scores build across a scene."
          />
          <Why>Each layer moves at a different speed: the ostinato in eighths, the melody in half notes, the low strings in whole bars. As in the texture lesson, different speeds in different registers give the ear a clear picture, so even a dense orchestral cue stays readable.</Why>

          <Watch>Using a single "String Ensemble" for everything, chords and melody alike, is the most common orchestral beginner sound. It's fine for a pad, but a melody needs its own instrument and its own track. Put the tune on <Ui>Violin</Ui>, <Ui>Flute</Ui> or <Ui>French Horn</Ui>, and keep the ensemble for sustained harmony underneath.</Watch>

          <Try>
            <Steps>
              <li>Start from the <Ui>Orchestral</Ui> template on the Home screen, or add tracks yourself: <Ui>Violin</Ui>, <Ui>Cello</Ui>, <Ui>Upright Bass (Bowed)</Ui>, <Ui>Flute</Ui>, <Ui>Clarinet</Ui>, <Ui>French Horn</Ui>.</li>
              <li>Write the melody on one track. To double it, right-click the track and choose <Ui>Duplicate Track</Ui>, switch the copy's instrument, then right-click its region and use <Ui>Transpose</Ui> → <Ui>Up an Octave</Ui> or <Ui>Down an Octave</Ui>.</li>
              <li>Open the <Ui>Full Score</Ui> (<K>Alt</K>+<K>F</K>) to see every part stacked like a conductor's score. It's the easiest way to spot parts crossing or doubling by accident.</li>
              <li>Run <Ui>Check</Ui> (<K>⇧</K>+<K>W</K>) for notes outside each instrument's range, which is especially easy to do with orchestral instruments.</li>
            </Steps>
          </Try>
          <Pro>Orchestrators save the full orchestra for the moments that need it. A cue that's tutti from start to finish is tiring and flat. The typical film-score shape is solo instrument, then a small group, then the full orchestra for the climax, then back to a solo for the ending: the energy curve again, written in instrument choices.</Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ sampling
    {
      id: 'sampling',
      title: 'Sampling: make an instrument out of any sound',
      minutes: 8,
      summary: 'Turn your voice, a pot lid or a drum break into something you can play. Learn which Sampler mode fits which sound, why pitching a sample too far ruins it, and how producers chop and rearrange a recording into a brand-new beat.',
      keywords: 'sampler sample sampling chop chopping slice slices break breakbeat one-shot one shot root note pitch trim fade loop my samples drum kit record import boom bap lofi hip hop',
      body: () => (
        <>
          <Lead>
            A sampler plays a recording instead of a built-in sound. That one idea built hip-hop, jungle and half of modern pop: a single word, a door slam or two bars of an old drum break becomes a playable instrument. In BandForge it's the <Ui>Sampler</Ui> track.
          </Lead>

          <h2>Three ways to play a sound</h2>
          <p>The same sample behaves very differently depending on the mode. Picking the right one is most of the skill.</p>
          <Cards
            items={[
              { title: 'Classic', tag: 'sung notes · plucks · pads · bass', color: '#5dbb7a', body: 'Every key plays the sound at a different pitch, and it stops when you let go. Use it for anything with a pitch you want to play as a melody or chords. Turn on Loop for sounds that should hold as long as the key does, like an "ahh" or a bowed note.' },
              { title: 'One-Shot', tag: 'hits · risers · vocal chops · FX', color: '#e8a33d', body: 'The whole sound always plays to the end, however short you press the key. Use it for things that should never be cut off: a cymbal swell, a reversed crash, a shouted "hey!".' },
              { title: 'Slice', tag: 'drum breaks · phrases · loops', color: '#a07ae0', body: 'The recording is chopped into pieces and each key plays one piece, from C4 upward. This is how a drum break becomes a kit, or a sung phrase becomes words you can rearrange.' },
            ]}
          />

          <h2>The root note, and why samples sound like chipmunks</h2>
          <p>
            A sampler changes pitch by playing the recording faster or slower, like speeding up a tape. Up an octave means double speed: the sound gets <b>higher and shorter</b>, and a voice's character (its formants) rises with it, which is the chipmunk effect. Down an octave is half speed: lower, longer and muddier.
          </p>
          <p>
            So the sampler has to know what note the recording already is: the <b>root</b>. BandForge listens for it when you import or record, and shows it next to <Ui>Root</Ui> (press <Ui>Detect</Ui> to check again after trimming). If the root is wrong, everything you play will be out of key with the rest of your song.
          </p>
          <Spec
            rows={[
              ['Sounds natural', 'within about 5 semitones of the root'],
              ['Noticeably "sampled"', '5 to 12 semitones away'],
              ['A special effect', 'more than an octave away'],
            ]}
          />
          <Tip>Recording your own sample? Sing or play it near the middle of the range you'll use it in. A note you'll play around C4 should be recorded around C4, not two octaves below.</Tip>

          <h2>Trim, fade, and loop</h2>
          <p>
            Drag the orange handles to cut off silence and noise. The start matters most: if there's even a twentieth of a second of air before the sound, every note will feel <b>late</b> against the beat. Trim right up to the start of the sound.
          </p>
          <p>
            A sound cut off mid-wave makes a click. A short <Ui>Fade Out</Ui> (a few hundredths of a second) removes it. A longer <Ui>Fade In</Ui> turns any sound into a soft swell, which is a quick way to make a pad from a single held note.
          </p>
          <Watch>Looping a sound that changes a lot (a strum, a word) gives an obvious "wah-wah-wah" repeat. Loop only sounds that stay steady while held: sustained vowels, organ, bowed strings, synth tones. Trim the loop to the steady middle part.</Watch>

          <h2>Chopping a break</h2>
          <p>
            Producers take a drum break, chop it at each hit, then <b>play the hits in a new order</b>. The groove and the sound come from the recording, but the rhythm is yours. That rearranging is the creative part, and it's what keeps the result from being a copy.
          </p>
          <Compare
            items={[
              {
                label: 'The break as recorded',
                title: 'Eight slices played in order: 1 2 3 4 5 6 7 8',
                bpm: 88,
                parts: [{ inst: 'kit-lofi', label: 'Break', notes: drums({ k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 2, swing: 0.12 }) }],
                caption: 'A plain, steady groove. Imagine each hit is a slice of one recording.',
              },
              {
                label: 'Chopped and rearranged',
                verdict: 'better',
                title: 'The same hits in a new order: 1 1 3 5 3 6 3 8',
                bpm: 88,
                parts: [{ inst: 'kit-lofi', label: 'Chops', notes: drums({ k: 'x..x..x.......x.', s: '....x..g.x..x...', h: 'x.x.x.x.x.x.x.xx' }, { bars: 2, swing: 0.12 }) }],
                caption: 'Nothing new was added: kicks doubled, a ghost snare before beat 3, a late snare, a quick hat at the end. Same sound, a different beat.',
              },
            ]}
          />
          <Steps>
            <li>Import the recording, switch to <Ui>Slice</Ui> and press <Ui>Auto Chop</Ui>. It puts a slice on each hit. Click a slice to hear it.</li>
            <li>Fix any slice that starts late or cuts a hit in half: drag its line, double-click to add one, double-click a line to remove it. If the break is perfectly in time, <Ui>Equal</Ui> 8 or 16 can be cleaner.</li>
            <li>Play the slices from C4 upward and write a new pattern with them in the piano roll, or press <Ui>Make Drum Kit</Ui> to put each slice on a row of the Beat Sequencer.</li>
            <li>Change the order: the kick from slice 1 on beats 1 and 3, the snare from slice 3 on 2 and 4, and a ghost note from slice 6 just before the snare. Try pitching a slice down a few semitones for a heavier hit.</li>
          </Steps>
          <Why>Real drummers never hit twice exactly alike, so chopped real drums have small changes in tone and timing that programmed drum-machine hits don't. That's why chopped breaks feel alive even when you sequence them on a rigid grid.</Why>

          <Try>
            <Steps>
              <li>Press <Ui>+</Ui> in the top bar (New Track) and choose <Ui>Sampler</Ui>.</li>
              <li>Press <Ui>Record</Ui> and make one sound: a sung "ooh", a tap on your desk, a click of your tongue. Press <Ui>Stop</Ui>.</li>
              <li>Trim it with the handles, then play it on the keyboard below. If it's a pitched sound, check the <Ui>Root</Ui>.</li>
              <li>Try all three modes on the same sound and listen to what changes. Everything you record is kept in <Ui>My Samples</Ui>, so you can reuse it in any song, including on Beat Sequencer rows (a row's ••• menu → <Ui>From My Samples</Ui>).</li>
            </Steps>
          </Try>
          <Pro>
            Sampling other people's records without permission can break copyright, even for a short chop, and streaming services do detect it. Professionals either clear their samples or use their own recordings and royalty-free packs. Your own voice, room and objects are free, and they make a sound nobody else has.
          </Pro>
        </>
      ),
    },
  ],
};

export default chapter;
