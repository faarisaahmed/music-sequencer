import { SlidersHorizontal } from 'lucide-react';
import type { Chapter } from '../types';
import { Cards, Compare, Example, K, Lead, Listen, Pro, RangeChart, Spec, Steps, Tip, Try, Ui, Watch, Why } from '../figures';
import { bass, chords, drums, line, type Part, type PartFx } from '../notation';

// A small four-bar band (A minor: Am F C G) reused across the mixing lessons, so the
// reader hears the same music with only the mix changing.
const PROG = 'Am F C G';
const DRUMS = drums({ h: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', k: 'x.......x.x.....' }, { bars: 4 });
const BASS = bass(PROG, { style: 'eighths' });
const KEYS = chords(PROG, { style: 'pulse', center: 60 });
const PAD = chords(PROG, { center: 58 });
const LEAD = line('E5:1 C5:0.5 D5:0.5 E5:2 | F5:1 E5:0.5 D5:0.5 C5:2 | E5:1 G5:1 E5:1 D5:1 | D5:2 B4:2');

interface Mix {
  drums?: number;
  bass?: number;
  keys?: number;
  lead?: number;
  pad?: number;
  fx?: Partial<Record<'drums' | 'bass' | 'keys' | 'lead' | 'pad', PartFx>>;
}

/** The demo band with chosen levels and effects. Leave a level out to drop that part. */
function band(m: Mix): Part[] {
  const out: Part[] = [];
  if (m.drums !== undefined) out.push({ inst: 'kit-acoustic', label: 'Drums', notes: DRUMS, vol: m.drums, fx: m.fx?.drums });
  if (m.bass !== undefined) out.push({ inst: 'electric-bass', label: 'Bass', notes: BASS, vol: m.bass, fx: m.fx?.bass });
  if (m.keys !== undefined) out.push({ inst: 'grand-piano', label: 'Piano', notes: KEYS, vol: m.keys, fx: m.fx?.keys });
  if (m.pad !== undefined) out.push({ inst: 'warm-pad', label: 'Pad', notes: PAD, vol: m.pad, fx: m.fx?.pad });
  if (m.lead !== undefined) out.push({ inst: 'analog-lead', label: 'Lead', notes: LEAD, vol: m.lead, fx: m.fx?.lead });
  return out;
}

const chapter: Chapter = {
  id: 'mix',
  title: 'Effects & Mixing',
  blurb: 'Levels, panning, EQ, compression, reverb and delay, and getting a mix that holds together.',
  icon: SlidersHorizontal,
  color: '#7a86e6',
  lessons: [
    // ------------------------------------------------------------------ 1
    {
      id: 'levels',
      title: 'Levels and panning first',
      minutes: 9,
      summary: 'Most of a good mix is just volume and left-right placement. How to set a starting balance, leave headroom, decide what goes in the centre and spread the rest.',
      keywords: 'mix mixing level volume fader balance pan panning stereo headroom clipping gain staging mono centre center wide LCR meter',
      body: () => (
        <>
          <Lead>
            Beginners reach for effects first. Engineers reach for the faders. If the volumes and the left-right positions are right, a mix already sounds 80% finished; if they're wrong, no plugin will save it.
          </Lead>

          <h2>Hear the difference</h2>
          <Compare
            items={[
              {
                label: 'Everything up, everything centre',
                verdict: 'worse',
                bpm: 100,
                chordsAbove: PROG,
                parts: band({ drums: 1.3, bass: 1.3, keys: 1.3, pad: 1.3, lead: 1.3 }),
                caption: 'All five parts at full volume in the middle. They pile on top of each other and the melody has to fight to be heard.',
              },
              {
                label: 'Balanced and placed',
                verdict: 'better',
                bpm: 100,
                chordsAbove: PROG,
                parts: band({ drums: 1, bass: 0.95, keys: 0.55, pad: 0.4, lead: 0.9, fx: { keys: { pan: -0.5 }, pad: { pan: 0.45 } } }),
                caption: 'Drums, bass and lead stay centre and loud; piano moves left, pad moves right, both quieter. Every part is now audible.',
              },
            ]}
          />
          <Why>
            Your ears judge importance by loudness and by position. Whatever is loudest and in the middle reads as "the main thing". When everything is equally loud and central, nothing is the main thing, so the ear gets tired trying to follow five parts at once.
          </Why>

          <h2>A starting balance that works for almost anything</h2>
          <Steps>
            <li>
              Pull every fader down. Bring up the <b>drums</b> (kick and snare especially) until the master meter peaks around two-thirds of the way up, roughly −10 to −6 dB.
            </li>
            <li>
              Add the <b>bass</b> until it feels like it's holding the drums up, not floating above them. Kick and bass should feel like one instrument.
            </li>
            <li>
              Add the <b>lead</b> (vocal or melody). It should sit clearly on top: you can hear every note without it sounding pasted on.
            </li>
            <li>
              Now bring in chords, pads and extras <b>only as loud as needed</b>. A useful test: turn a part up until you clearly notice it, then back off a little.
            </li>
          </Steps>
          <Spec
            title="Rough relative levels"
            rows={[
              ['Kick and snare', 'Loudest elements, the anchor of the mix.'],
              ['Bass', 'Just under the kick. Felt as much as heard.'],
              ['Lead vocal / melody', 'As loud as the snare, or a touch louder.'],
              ['Chords (piano, guitar)', '4–8 dB below the lead.'],
              ['Pads, strings, textures', '8–14 dB below the lead. Often you only notice them when they stop.'],
            ]}
          />
          <Watch>
            Turning everything up. Each time one part seems too quiet, the instinct is to push it up. After ten rounds of this every fader is at the top and the master is clipping. The better question is almost always "what can I turn <em>down</em>?"
          </Watch>

          <h2>Headroom: leave space at the top</h2>
          <p>
            Digital audio has a hard ceiling at 0 dB. Anything louder gets chopped off (<b>clipping</b>), which sounds like crackle and harshness. While mixing, keep the loudest moments of the master around <b>−6 dB</b>. That leaves room for the final loudness stage later (see the mastering lesson) and stops sudden peaks from distorting.
          </p>

          <h2>Panning: building a stage</h2>
          <p>Imagine the band on a stage in front of you. Some things are always in the middle; everything else spreads out so each part has its own spot.</p>
          <Cards
            items={[
              { title: 'Always centre', tag: 'the foundation', color: '#e8a33d', body: 'Kick, snare, bass and the lead vocal or main melody. Low frequencies and the most important part belong in the middle so they hit hard on any speaker.' },
              { title: 'A little off centre', tag: '15–40%', color: '#5dbb7a', body: 'Toms, a second vocal, a lead guitar answering the melody. Close to the action but out of the way.' },
              { title: 'Wide', tag: '50–100%', color: '#5b9be0', body: 'Rhythm guitars, piano, hi-hats, percussion, backing harmonies. Pair them: something on the left wants a partner on the right.' },
              { title: 'Spread across', tag: 'stereo sounds', color: '#a07ae0', body: 'Pads, strings, room reverb. They fill the space behind everything else.' },
            ]}
          />
          <Example
            title="Two guitar parts panned hard left and right"
            bpm={100}
            chordsAbove={PROG}
            parts={[
              { inst: 'electric-guitar', label: 'Guitar L', notes: chords(PROG, { style: 'offbeat', center: 58 }), vol: 0.7, fx: { pan: -0.9 } },
              { inst: 'acoustic-guitar', label: 'Guitar R', notes: chords(PROG, { style: 'pulse', center: 62 }), vol: 0.7, fx: { pan: 0.9 } },
              { inst: 'electric-bass', label: 'Bass', notes: BASS },
              { inst: 'kit-acoustic', label: 'Drums', notes: DRUMS },
            ]}
            caption="On headphones you'll hear one guitar in each ear with the drums and bass solid in the middle. Mute one guitar and the mix suddenly feels lopsided."
          />
          <Tip title="Check in mono">
            Many people hear your music on one phone speaker or a mono Bluetooth box. Every so often, listen through a single speaker. If a part disappears or the bass goes thin, the mix leans too heavily on stereo tricks. A quick alternative: briefly set every pan knob to centre and make sure the balance still works.
          </Tip>

          <h2>In BandForge</h2>
          <Try>
            <Steps>
              <li>
                Open the <Ui>Mixer</Ui> (<K>X</K>). Each track has a strip with a fader, a meter, its level in dB at the bottom, and a <b>Pan</b> knob. Double-click a knob to reset it.
              </li>
              <li>
                Use <Ui>M</Ui> and <Ui>S</Ui> on each strip (or <K>M</K> and <K>S</K> for the selected track) to mute and solo while you balance. Solo is for finding problems; always make the final decision with everything playing.
              </li>
              <li>
                Watch the <b>Master</b> strip's meter on the right of the mixer and the small meter in the top bar. If it turns red at the top, lower the faders on the tracks, not just the master.
              </li>
              <li>
                Drum tracks have a volume and pan knob on every row of the <Ui>Step Sequencer</Ui>, so you can place hi-hats slightly right and toms across the stereo field like a real kit.
              </li>
            </Steps>
          </Try>
          <Pro>
            Mix engineers do most of their balancing at a low listening level, about as loud as a normal conversation. At high volume everything sounds exciting and the ear stops judging balance accurately. If the mix works quietly, it works loud.
          </Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ 2
    {
      id: 'eq',
      title: 'EQ: carving space',
      minutes: 10,
      summary: 'Where every instrument lives in the frequency spectrum, why mixes get muddy, and how cutting rather than boosting gives each part its own room.',
      keywords: 'eq equaliser equalizer frequency hz bass mids treble low cut high pass low pass mud boomy harsh air presence shelf masking',
      body: () => (
        <>
          <Lead>
            EQ (equalisation) turns frequency ranges up or down. It is how you stop the bass and the piano fighting, make a vocal cut through, and turn a muddy mix clear. It is also the effect beginners overuse most.
          </Lead>

          <h2>The map: from rumble to air</h2>
          <p>Human hearing runs from about 20 Hz (felt more than heard) to 20,000 Hz (20 kHz). Every frequency range has its own character:</p>
          <RangeChart
            unit="hz"
            rows={[
              { label: 'Sub', lo: 20, hi: 60, color: '#7a86e6', note: 'felt' },
              { label: 'Bass', lo: 60, hi: 250, color: '#5b9be0', note: 'weight' },
              { label: 'Low mids', lo: 250, hi: 500, color: '#e05a4a', note: 'mud' },
              { label: 'Mids', lo: 500, hi: 2000, color: '#e8a33d', note: 'body' },
              { label: 'Presence', lo: 2000, hi: 5000, color: '#5dbb7a', note: 'clarity' },
              { label: 'Brilliance', lo: 5000, hi: 10000, color: '#45b8c4', note: 'bite' },
              { label: 'Air', lo: 10000, hi: 20000, color: '#a07ae0', note: 'sparkle' },
            ]}
            caption="Most musical problems happen in the low mids (250–500 Hz, where things pile up into mud) and the presence range (2–5 kHz, where things get harsh or, if missing, dull)."
          />
          <p>And here is roughly where common instruments put their energy:</p>
          <RangeChart
            unit="hz"
            rows={[
              { label: 'Kick drum', lo: 40, hi: 120, color: '#e06a8f', note: 'thump' },
              { label: 'Bass', lo: 40, hi: 400, color: '#5b9be0' },
              { label: 'Snare', lo: 150, hi: 5000, color: '#e8a33d' },
              { label: 'Piano', lo: 30, hi: 4200, color: '#5dbb7a' },
              { label: 'Guitar', lo: 80, hi: 5000, color: '#3fb5a5' },
              { label: 'Voice', lo: 100, hi: 8000, color: '#a07ae0' },
              { label: 'Pads', lo: 150, hi: 8000, color: '#7a86e6' },
              { label: 'Hi-hats', lo: 5000, hi: 16000, color: '#45b8c4' },
            ]}
            caption="Look at how much overlaps between 100 and 500 Hz. That crowded zone is why mixes turn muddy, and why most EQ work is about clearing it."
          />

          <h2>Masking: when parts hide each other</h2>
          <p>
            When two sounds share the same frequencies at the same time, the louder one hides the quieter one. This is called <b>masking</b>. The classic case: a warm pad with lots of low end sitting on top of the bass. Neither is clear.
          </p>
          <Compare
            items={[
              {
                label: 'Pad with full low end',
                verdict: 'worse',
                bpm: 92,
                chordsAbove: PROG,
                parts: [
                  { inst: 'electric-bass', label: 'Bass', notes: BASS },
                  { inst: 'warm-pad', label: 'Pad', notes: chords(PROG, { center: 50 }), vol: 1 },
                ],
                caption: 'The pad sits low, right on top of the bass. The bass notes lose their edges.',
              },
              {
                label: 'Pad with its lows cut',
                verdict: 'better',
                bpm: 92,
                chordsAbove: PROG,
                parts: [
                  { inst: 'electric-bass', label: 'Bass', notes: BASS },
                  { inst: 'warm-pad', label: 'Pad', notes: chords(PROG, { center: 50 }), vol: 1, fx: { highpass: 380 } },
                ],
                caption: 'Same pad, with everything below about 380 Hz removed. Alone it sounds thinner; in the mix the bass is suddenly clear and the pad still fills the space.',
              },
            ]}
          />
          <Why>
            Your ear only needs a sound's most characteristic frequencies to recognise it. A pad is mostly about its mid and high shimmer; its low end adds nothing the bass isn't already doing. Removing it costs nothing and gives the bass its space back. Engineers call this "cutting so others can be heard".
          </Why>

          <h2>Three rules that fix most mixes</h2>
          <Cards
            items={[
              { title: '1. Cut the lows on everything that isn\'t bass', tag: 'the single biggest win', color: '#5b9be0', body: 'Pads, keys, guitars, vocals and hi-hats all carry low rumble that muddies the bottom. Cut below 100–300 Hz on them and the kick and bass get clearer instantly.' },
              { title: '2. Cut before you boost', tag: 'subtractive EQ', color: '#e05a4a', body: 'If something sounds dull, it is usually because something else is too loud in its range. Cut 2–4 dB of mud (250–400 Hz) before reaching for a treble boost.' },
              { title: '3. Small moves, in context', tag: '±1–4 dB', color: '#5dbb7a', body: 'Judge EQ with the whole mix playing, not soloed. Moves bigger than 6 dB usually mean the part or the sound choice is wrong, not the EQ.' },
            ]}
          />

          <h2>Pushing parts back with a low-pass</h2>
          <p>
            Cutting the highs (a <b>low-pass filter</b>) makes a sound duller and further away, because high frequencies fade over distance in real rooms. It is a great way to tuck a busy part behind the lead.
          </p>
          <Compare
            items={[
              {
                label: 'Arpeggio at full brightness',
                bpm: 100,
                chordsAbove: PROG,
                parts: [
                  { inst: 'pluck', label: 'Arp', notes: chords(PROG, { style: 'arp', center: 64 }), vol: 0.8 },
                  { inst: 'analog-lead', label: 'Lead', notes: LEAD, vol: 0.9 },
                ],
                caption: 'Both parts are bright, so the arp competes with the melody.',
              },
              {
                label: 'Arpeggio low-passed',
                verdict: 'better',
                bpm: 100,
                chordsAbove: PROG,
                parts: [
                  { inst: 'pluck', label: 'Arp', notes: chords(PROG, { style: 'arp', center: 64 }), vol: 0.8, fx: { lowpass: 1600 } },
                  { inst: 'analog-lead', label: 'Lead', notes: LEAD, vol: 0.9 },
                ],
                caption: 'Highs above about 1.6 kHz removed from the arp. It moves behind the lead without getting quieter.',
              },
            ]}
          />

          <Spec
            title="Fix-it cheat sheet"
            rows={[
              ['Muddy, boomy, woolly', 'Cut 2–4 dB around 250–400 Hz on pads, guitars, piano.'],
              ['Boxy, like a cardboard tube', 'Cut around 400–800 Hz.'],
              ['Thin, no warmth', 'Boost 1–3 dB around 100–200 Hz, or cut the lows of competing parts less.'],
              ['Dull, buried', 'Cut the mud first; then boost 1–3 dB around 3–5 kHz.'],
              ['Harsh, tiring', 'Cut 2–3 dB around 2.5–4 kHz, often on bright synths and guitars.'],
              ['Hissy "s" sounds', 'Cut around 5–8 kHz on the vocal, or use a de-esser.'],
              ['Lacks sparkle', 'Gentle high shelf, +1–3 dB above 10 kHz.'],
            ]}
          />

          <h2>EQ in BandForge</h2>
          <Try>
            <Steps>
              <li>
                Every strip in the <Ui>Mixer</Ui> (<K>X</K>) has three EQ knobs, each ±12 dB: <b>Low</b> shapes everything below about 220 Hz, <b>Mid</b> works around 1.2 kHz, and <b>High</b> shapes everything above about 5 kHz.
              </li>
              <li>
                To clear mud from a pad, piano or guitar, turn its <b>Low</b> knob down (−4 to −12 dB). BandForge's Low control is a shelf rather than a full low-cut, so it reduces the lows instead of removing them entirely, which is usually what you want on keys.
              </li>
              <li>
                Open <Ui>Smart Controls</Ui> (<K>B</K>) for bigger knobs: the <b>Channel EQ</b> card and a <b>Filter</b> card. Turning the Filter down is a low-pass, perfect for pushing an arpeggio or pad behind the melody.
              </li>
              <li>
                Try the <b>Radio</b> preset in Smart Controls on a single part (lows and highs cut hard) for a telephone-style effect in an intro or breakdown.
              </li>
            </Steps>
          </Try>
          <Watch>
            Boosting the bass and treble on everything. Each part sounds "better" soloed, but together they pile up into a loud, harsh, boomy mess with nowhere for anything to sit. When in doubt, cut.
          </Watch>
          <Pro>
            The best EQ happens when you write the part. If the piano left hand plays in the same octave as the bass, no EQ fully fixes it; move the left hand up an octave instead. Arrangers spread instruments across registers (low, middle, high) precisely so mixers have less to fix.
          </Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ 3
    {
      id: 'compression',
      title: 'Compression without the mystery',
      minutes: 9,
      summary: 'What a compressor actually does, the four controls in plain English, when compression helps (bass, vocals, drums) and when it just squashes the life out.',
      keywords: 'compressor compression dynamics threshold ratio attack release makeup gain glue squash punch limiter pumping',
      body: () => (
        <>
          <Lead>
            A compressor is an automatic volume knob. When a sound gets loud, it turns it down a bit; then you turn the whole thing back up. The result: quiet details become louder, loud peaks get tamed, and the part sits steadily in the mix.
          </Lead>

          <h2>Hear it on an uneven bass line</h2>
          <Compare
            items={[
              {
                label: 'Uncompressed',
                bpm: 96,
                parts: [
                  { inst: 'electric-bass', label: 'Bass', notes: line('A1:1! A1:0.5? A1:0.5 C2:1? E2:1! | F1:1 F1:0.5? A1:0.5! C2:1? F1:1', { v: 0.6 }) },
                  { inst: 'kit-acoustic', label: 'Drums', notes: drums({ h: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', k: 'x.......x.x.....' }, { bars: 2 }), vol: 0.8 },
                ],
                caption: 'Some notes leap out, some disappear. You keep losing the bass.',
              },
              {
                label: 'Compressed',
                verdict: 'better',
                bpm: 96,
                parts: [
                  { inst: 'electric-bass', label: 'Bass', notes: line('A1:1! A1:0.5? A1:0.5 C2:1? E2:1! | F1:1 F1:0.5? A1:0.5! C2:1? F1:1', { v: 0.6 }), fx: { comp: true } },
                  { inst: 'kit-acoustic', label: 'Drums', notes: drums({ h: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', k: 'x.......x.x.....' }, { bars: 2 }), vol: 0.8 },
                ],
                caption: 'The loud notes are pulled down, the whole line brought up. Every note now holds its place under the drums.',
              },
            ]}
          />

          <h2>The four controls, in plain words</h2>
          <Spec
            rows={[
              ['Threshold', 'How loud a sound has to get before the compressor starts working. Lower threshold = more of the sound gets compressed.'],
              ['Ratio', 'How hard it turns down anything over the threshold. 2:1 is gentle (for every 2 dB over, 1 dB comes out). 4:1 is firm. 10:1 and above is a limiter: a brick wall.'],
              ['Attack', 'How fast it reacts. Slow attack (20–30 ms) lets the initial hit of a drum through before clamping down, so it punches. Fast attack (1–5 ms) catches everything and softens the hit.'],
              ['Release', 'How fast it lets go. Too short sounds jittery; too long and it never recovers between notes. 100–200 ms is a safe start for most parts.'],
              ['Make-up gain', 'Turns the whole part back up afterwards, since compression made it quieter overall.'],
            ]}
          />
          <Why>
            Real instruments are uneven: a bass player hits some strings harder, a singer leans into some words. In a quiet room your ear adjusts. In a dense mix the quiet moments get covered by the drums and guitars. Compression narrows the gap between loud and quiet so the part stays audible all the time.
          </Why>

          <h2>Where compression helps, and where it doesn't</h2>
          <Cards
            items={[
              { title: 'Bass', tag: 'almost always', color: '#5b9be0', body: 'A steady bass is the foundation of a modern mix. Moderate compression (4:1, 3–6 dB of reduction) is standard.' },
              { title: 'Vocals and lead lines', tag: 'almost always', color: '#a07ae0', body: 'Keeps every word or note at the front. Pop vocals are often compressed heavily; folk and jazz vocals much less.' },
              { title: 'Drums', tag: 'for punch or glue', color: '#e8a33d', body: 'Slow attack makes drums punchier. Compressing the whole kit together glues it into one instrument.' },
              { title: 'Orchestral, solo piano, acoustic', tag: 'lightly or not at all', color: '#5dbb7a', body: 'The rise and fall of the performance is the point. Heavy compression flattens the emotion out of a crescendo.' },
            ]}
          />
          <Compare
            items={[
              {
                label: 'Dynamic piano',
                verdict: 'better',
                bpm: 72,
                parts: [{ inst: 'grand-piano', label: 'Piano', notes: chords('C:2 G/B:2 Am:2 F:2', { style: 'broken', center: 60 }).map((x) => ({ ...x, v: 0.25 + (x.t / 8) * 0.7 })) }],
                caption: 'A slow crescendo from soft to loud. The swell is the emotional moment.',
              },
              {
                label: 'Squashed piano',
                verdict: 'worse',
                bpm: 72,
                parts: [{ inst: 'grand-piano', label: 'Piano', notes: chords('C:2 G/B:2 Am:2 F:2', { style: 'broken', center: 60 }).map((x) => ({ ...x, v: 0.25 + (x.t / 8) * 0.7 })), fx: { comp: true } }],
                caption: 'With heavy compression the crescendo nearly disappears. Louder overall, but flatter.',
              },
            ]}
          />
          <Listen>
            Compare the start of each piano version. In the squashed one, the quiet opening is almost as loud as the end. That is the trade-off: compression buys consistency by spending dynamics. Spend it where consistency matters (bass, vocals, drums) and save it where the dynamics are the music.
          </Listen>

          <h2>Compression in BandForge</h2>
          <Try>
            <Steps>
              <li>
                Each mixer strip has a <b>Comp</b> knob, and <Ui>Smart Controls</Ui> (<K>B</K>) has a larger <b>Compressor</b> card. It's a one-knob compressor: turning it up lowers the threshold (down to −32 dB) and raises the ratio (up to 8:1) together, and adds make-up gain for you.
              </li>
              <li>
                Start around <b>30–50%</b> on bass and lead parts, 20% (the default) on most others, and listen with the full mix. If the part stops moving up and down but still breathes, you're there.
              </li>
              <li>
                The <b>Punchy</b> preset in Smart Controls combines heavy compression with a little drive and low-end boost: a fast way to make drums or bass hit harder.
              </li>
              <li>
                For overall glue, the <b>Mastering</b> card on the mixer has a <b>Glue</b> knob: a gentle 2:1 compressor across the whole song.
              </li>
            </Steps>
          </Try>
          <Watch>
            Pumping and breathing. If you can hear the volume of a part (or the whole song) duck every time the kick hits, and swell back up in between, the compression is too heavy. Unless that's the effect you want (it is in some dance music), turn it down until the motion stops.
          </Watch>
          <Pro>
            Engineers often use two gentle compressors instead of one heavy one, each doing 2–3 dB of work. It sounds more natural than one compressor doing 8 dB. You can get a similar effect in BandForge with moderate track compression plus a little Glue on the master.
          </Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ 4
    {
      id: 'space',
      title: 'Reverb and delay: space and depth',
      minutes: 10,
      summary: 'How reverb and echo place sounds near or far, choosing room, plate, hall or cathedral, tempo-matched delay times, and keeping the low end clean.',
      keywords: 'reverb delay echo space depth room plate hall cathedral pre-delay send insert ping pong tempo sync dotted eighth decay wet dry',
      body: () => (
        <>
          <Lead>
            Levels and panning place sounds left to right. Reverb and delay add the third dimension: front to back. A mix with depth sounds like a band in a real space instead of five parts stacked on a flat wall.
          </Lead>

          <h2>Dry versus wet</h2>
          <Compare
            items={[
              {
                label: 'Dry',
                bpm: 80,
                parts: [{ inst: 'grand-piano', label: 'Piano', notes: line('E4:1 G4:1 C5:2 | B4:1 G4:1 D5:2 | C5:1 A4:1 E4:1 F4:1 | E4:4') }],
                caption: 'Close and intimate, like the piano is in your living room. Also a bit lifeless.',
              },
              {
                label: 'Hall reverb',
                verdict: 'better',
                bpm: 80,
                parts: [{ inst: 'grand-piano', label: 'Piano', notes: line('E4:1 G4:1 C5:2 | B4:1 G4:1 D5:2 | C5:1 A4:1 E4:1 F4:1 | E4:4'), fx: { reverb: 0.55 } }],
                caption: 'The notes bloom and overlap into the room. Further away, more emotional.',
              },
            ]}
          />

          <h2>Depth: front, middle and back</h2>
          <p>
            In a real room, a sound far away is quieter, duller (the highs fade first) and has more reflections compared with its direct sound. You can fake distance with exactly those three things: <b>volume</b>, <b>a little low-pass</b> and <b>more reverb</b>.
          </p>
          <Example
            title="Three layers placed at three distances"
            bpm={100}
            chordsAbove={PROG}
            parts={[
              { inst: 'analog-lead', label: 'Front: lead', notes: LEAD, vol: 0.9, fx: { reverb: 0.1 } },
              { inst: 'grand-piano', label: 'Middle: piano', notes: KEYS, vol: 0.55, fx: { reverb: 0.3, pan: -0.35 } },
              { inst: 'string-ensemble', label: 'Back: strings', notes: PAD, vol: 0.5, fx: { reverb: 0.75, lowpass: 2500, pan: 0.3 } },
              { inst: 'electric-bass', label: 'Bass (dry)', notes: BASS, vol: 0.9 },
            ]}
            caption="The lead is dry and loud (in your face), the piano has a little room, the strings are quieter, darker and drenched (far away). Mute each to hear its place."
          />
          <Why>
            Your brain uses the ratio of direct sound to reflections to judge distance. That's why a whisper in an empty church sounds far away even when the person is close. In a mix, the parts with the least reverb feel closest, which is why lead vocals in pop are often surprisingly dry.
          </Why>

          <h2>Choosing a reverb</h2>
          <Spec
            rows={[
              ['Room', 'Short, natural, 0.3–1 second. Makes drums and guitars sound like they were played in a real space without adding obvious tail.'],
              ['Plate', 'Bright, smooth, 1–2 seconds. The classic vocal and snare reverb of 60s–80s records.'],
              ['Hall', 'Big and lush, 2–3 seconds. Strings, piano, ballads, anything orchestral.'],
              ['Cathedral', 'Huge, 4+ seconds. Ambient, choirs, cinematic swells. Easy to overdo.'],
            ]}
          />
          <Tip title="Pre-delay keeps things clear">
            Pre-delay is a short gap (20–60 ms) before the reverb starts. It lets the dry note be heard cleanly first, then the space blooms behind it, so a vocal stays close and intelligible even with a big reverb. If your reverb makes words blur, more pre-delay (or less reverb) is the fix.
          </Tip>

          <h2>Delay: echoes in time</h2>
          <p>
            A delay repeats the sound after a set time. Timed to the tempo, echoes fall on the beat grid and become part of the rhythm. To work out timings in milliseconds: <b>60,000 ÷ BPM</b> gives one beat.
          </p>
          <Spec
            title="Delay times at 100 BPM"
            rows={[
              ['1/4 note', '600 ms: big, obvious repeats on the next beat.'],
              ['1/8 dotted', '450 ms: the U2 / "The Edge" rhythmic shimmer. Echoes land between beats and create a galloping pattern.'],
              ['1/8 note', '300 ms: tight, adds movement.'],
              ['1/16 note', '150 ms: a thickening "slap" rather than a clear echo.'],
              ['Slapback (not synced)', '80–120 ms, one repeat: rockabilly vocals and guitars.'],
            ]}
          />
          <Compare
            items={[
              {
                label: 'Lead drowned in reverb',
                verdict: 'worse',
                bpm: 100,
                chordsAbove: PROG,
                parts: band({ drums: 0.9, bass: 0.9, keys: 0.5, lead: 0.9, fx: { lead: { reverb: 0.9 } } }),
                caption: 'Lots of reverb on the lead blurs the notes and pushes it backwards.',
              },
              {
                label: 'Lead with dotted-8th echo',
                verdict: 'better',
                bpm: 100,
                chordsAbove: PROG,
                parts: band({ drums: 0.9, bass: 0.9, keys: 0.5, lead: 0.9, fx: { lead: { delay: 0.35, reverb: 0.12 } } }),
                caption: 'Echoes keep the lead in front while adding space in the gaps between phrases.',
              },
            ]}
          />
          <Listen>
            The echo version still sounds big, but the lead stays crisp. Echoes happen <em>between</em> the notes rather than smearing on top of them. That is why so many pop and rock vocals use delay as their main "space" effect and only a touch of reverb.
          </Listen>

          <h2>Space in BandForge</h2>
          <Try>
            <Steps>
              <li>
                In the <Ui>Mixer</Ui> (<K>X</K>), the <b>Master</b> strip has a <b>Reverb</b> type menu (Room, Plate, Hall or Cathedral) and an <b>Echo</b> time menu (1/4, 1/4 dotted, 1/8, 1/8 dotted, 1/16) with a <b>Feedback</b> knob for how many repeats.
              </li>
              <li>
                Each track's <b>Verb</b> and <b>Delay</b> knobs send some of it into that shared reverb and echo. Because all tracks share one space, the band sounds like it's in the same room.
              </li>
              <li>
                Start with very little: 10–20% Verb on most tracks, more on pads and strings, less on drums and bass. Push the lead's Delay up instead of its Verb when you want space without losing clarity.
              </li>
              <li>
                Smart Controls (<K>B</K>) has presets that set space for you as a starting point: <b>Dry</b>, <b>Big Room</b> and <b>Ambient</b>.
              </li>
            </Steps>
          </Try>
          <Watch>
            Reverb on the low end. Reverb on bass and kick makes the bottom of the mix swim. BandForge's shared reverb already filters out everything below about 180 Hz to help, but the best habit is still to keep the bass Verb knob at zero or close to it.
          </Watch>
          <Pro>
            Engineers use sends, not inserts, for reverb: one or two shared reverbs that many tracks feed, exactly like BandForge's master reverb. It's not just efficient: a shared space is what makes separate recordings sound like one performance. Put a different reverb on every track and the band sounds like it's in five different rooms.
          </Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ 5
    {
      id: 'balance',
      title: 'Balancing a full arrangement',
      minutes: 9,
      summary: 'Fixing crowded mixes at the source: registers, the mute test, making room for the lead, automating volume through the song and checking against reference tracks.',
      keywords: 'mix balance arrangement masking crowded busy mute test automation volume rides reference track listening phone speakers ear fatigue harmony',
      body: () => (
        <>
          <Lead>
            When a mix sounds crowded, the instinct is to reach for EQ and compression. Most of the time the real problem is the <b>arrangement</b>: too many parts playing in the same range, at the same time. Fix that first and mixing becomes easy.
          </Lead>

          <h2>Registers: give every part its own floor</h2>
          <p>Think of the pitch range as a building with floors. Two parts on the same floor fight; parts on different floors stack cleanly.</p>
          <Compare
            items={[
              {
                label: 'Everything in the middle',
                verdict: 'worse',
                bpm: 96,
                chordsAbove: PROG,
                parts: [
                  { inst: 'grand-piano', label: 'Piano', notes: chords(PROG, { style: 'pulse', center: 67 }), vol: 0.7 },
                  { inst: 'electric-guitar', label: 'Guitar', notes: chords(PROG, { style: 'offbeat', center: 69 }), vol: 0.7 },
                  { inst: 'analog-lead', label: 'Lead', notes: LEAD.map((x) => ({ ...x, p: x.p - 12 })), vol: 0.85 },
                  { inst: 'electric-bass', label: 'Bass', notes: BASS },
                ],
                caption: 'Piano, guitar and melody all sit around the same octave. The melody keeps getting lost.',
              },
              {
                label: 'Spread across registers',
                verdict: 'better',
                bpm: 96,
                chordsAbove: PROG,
                parts: [
                  { inst: 'grand-piano', label: 'Piano', notes: chords(PROG, { style: 'pulse', center: 55 }), vol: 0.7 },
                  { inst: 'electric-guitar', label: 'Guitar', notes: chords(PROG, { style: 'offbeat', center: 64 }), vol: 0.55 },
                  { inst: 'analog-lead', label: 'Lead', notes: LEAD, vol: 0.85 },
                  { inst: 'electric-bass', label: 'Bass', notes: BASS },
                ],
                caption: 'Piano moves down, guitar sits in the middle, melody floats above. Same parts, same volumes, no EQ, and it is clear.',
              },
            ]}
          />
          <RangeChart
            rows={[
              { label: 'Bass', lo: 'E1', hi: 'C3', color: '#5b9be0' },
              { label: 'Piano chords', lo: 'G3', hi: 'D4', color: '#5dbb7a' },
              { label: 'Guitar', lo: 'C4', hi: 'G4', color: '#3fb5a5' },
              { label: 'Lead melody', lo: 'B4', hi: 'G5', color: '#e8a33d' },
            ]}
            sweet
            caption="A well-spread arrangement: each part mostly owns its own range, with small overlaps where parts hand over to each other."
          />

          <h2>The mute test</h2>
          <p>Play the busiest section of your song and mute each part in turn. For each one, ask:</p>
          <Steps>
            <li>
              <b>Did I miss it?</b> If muting it makes the song feel empty, it stays.
            </li>
            <li>
              <b>Did it get clearer?</b> If the song sounds better without it, cut it, or move it to a section where there's room.
            </li>
            <li>
              <b>Did I not notice?</b> Then it's either too quiet to matter, or it's doubling something else. Either make it count or remove it.
            </li>
          </Steps>
          <Why>
            Listeners can follow about three things at once: usually the beat, the bass and the lead. Everything else is texture. When a fourth or fifth part starts demanding attention, the brain has to drop something, and it's often the part you cared about most.
          </Why>

          <h2>Making room for the lead</h2>
          <p>The melody (or vocal) is the reason people listen. Everything else should step aside when it's speaking.</p>
          <Cards
            items={[
              { title: 'Call and response', tag: 'arrangement', color: '#45b8c4', body: 'Busy fills and riffs go in the gaps between vocal phrases, not on top of them.' },
              { title: 'Thin out under the lead', tag: 'arrangement', color: '#5dbb7a', body: 'Pianos and guitars play simpler or fewer notes while the melody is busy.' },
              { title: 'Clear its range', tag: 'EQ', color: '#e8a33d', body: 'Cut 1–3 dB around 2–4 kHz on chordal parts so the lead\'s presence comes through.' },
              { title: 'Ride the volume', tag: 'automation', color: '#a07ae0', body: 'Nudge the lead up a dB or two in the chorus, or a backing part down during a verse.' },
            ]}
          />

          <h2>Automation: the mix that changes</h2>
          <p>
            A song isn't one balance; it's many. A verse pad might sit quietly at the back, then come up 3 dB in the chorus. A guitar might pan wider when the chorus opens up. Drawing these changes in is called <b>automation</b>, and it's how professional mixes feel alive.
          </p>
          <Example
            title="A pad that rises into the second half"
            bpm={100}
            chordsAbove={PROG + ' ' + PROG}
            parts={[
              { inst: 'electric-bass', label: 'Bass', notes: bass(PROG + ' ' + PROG, { style: 'eighths' }) },
              { inst: 'kit-acoustic', label: 'Drums', notes: drums({ h: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', k: 'x.......x.x.....' }, { bars: 8 }), vol: 0.9 },
              { inst: 'warm-pad', label: 'Pad (swelling)', notes: chords(PROG + ' ' + PROG, { center: 62 }).map((x) => ({ ...x, v: 0.15 + Math.min(1, x.t / 20) * 0.75 })) },
            ]}
            caption="The pad starts barely audible and grows across eight bars, lifting the energy into the next section without adding a single new part."
          />

          <h2>Check your mix like a pro</h2>
          <Spec
            rows={[
              ['Reference tracks', 'Pick a released song in a similar style and compare often, at the same volume. It recalibrates your ears instantly.'],
              ['Listen quietly', 'At low volume, only the most important parts survive. If the lead and the beat are still clear, the balance is right.'],
              ['Phone speaker', 'No bass, one speaker. Checks that the melody and chords work without the low end.'],
              ['Headphones and speakers', 'Headphones exaggerate panning and reverb; speakers show you the low end and the room.'],
              ['Fresh ears', 'After 30–40 minutes, your hearing adapts and everything sounds fine. Take a break before final decisions.'],
            ]}
          />
          <Try>
            <Steps>
              <li>
                To automate a track's volume, click the <Ui>A</Ui> button on the track header: it cycles through showing the <b>volume</b> lane, the <b>pan</b> lane and off. Click in the lane to add points and drag them to draw changes over time.
              </li>
              <li>
                For a reference track, drag an audio file of the song onto the timeline to import it onto an audio track. Mute it while you work and solo it to compare. Delete or mute it before you export.
              </li>
              <li>
                Use <K>M</K> and <K>S</K> on the selected track for fast mute tests, and the <Ui>Check</Ui> panel (<K>⇧</K>+<K>W</K>) to catch notes from different parts clashing a half step apart, which often sounds like a mix problem but is really a note problem.
              </li>
            </Steps>
          </Try>
          <Watch>
            Mixing in solo. A part that sounds amazing alone (big, bright, wide) often fights everything else in the full mix. Solo is for finding a problem; make every decision with the whole song playing.
          </Watch>
          <Pro>
            Mix engineers on big records often spend more time on automation than on EQ and compression combined: riding the vocal word by word, lifting a guitar riff for one bar, pulling a reverb back in the busy chorus. Static mixes sound like demos; moving mixes sound like records.
          </Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ 6
    {
      id: 'mastering',
      title: 'Mastering and finishing',
      minutes: 8,
      summary: 'The last polish: tone, glue, loudness and a safe ceiling. What streaming loudness targets mean for you, and which export format to choose.',
      keywords: 'mastering master loudness lufs limiter ceiling glue streaming spotify apple music youtube export wav mp3 flac stems normalize headroom finish',
      body: () => (
        <>
          <Lead>
            Mastering is the final step between your mix and the world. It doesn't fix a bad mix; it makes a good mix sound finished: balanced in tone, glued together, as loud as it should be, and safe on every playback system.
          </Lead>

          <h2>What mastering does</h2>
          <Cards
            items={[
              { title: 'Tone', tag: 'broad EQ', color: '#e8a33d', body: 'Gentle, wide adjustments, often ±1–2 dB: a touch more low end for warmth, a little air on top.' },
              { title: 'Glue', tag: 'bus compression', color: '#a07ae0', body: 'Light compression (around 2:1, 1–3 dB of reduction) across the whole song so the parts move as one.' },
              { title: 'Loudness', tag: 'limiting', color: '#e05a4a', body: 'Raises the overall level so your song matches others, without letting peaks go over the ceiling.' },
              { title: 'Ceiling', tag: 'safety', color: '#5dbb7a', body: 'A hard maximum, usually −1 dB, so the file never clips when converted to MP3 or played on cheap speakers.' },
            ]}
          />
          <Compare
            items={[
              {
                label: 'Mix only',
                bpm: 100,
                chordsAbove: PROG,
                parts: band({ drums: 0.75, bass: 0.7, keys: 0.45, pad: 0.3, lead: 0.7, fx: { keys: { pan: -0.4 }, pad: { pan: 0.4 } } }),
                caption: 'Balanced, but quieter and a little loose.',
              },
              {
                label: 'Glued and louder',
                verdict: 'better',
                bpm: 100,
                chordsAbove: PROG,
                parts: band({
                  drums: 0.85,
                  bass: 0.8,
                  keys: 0.5,
                  pad: 0.35,
                  lead: 0.8,
                  fx: { drums: { comp: true }, bass: { comp: true }, keys: { pan: -0.4 }, pad: { pan: 0.4 }, lead: { comp: true } },
                }),
                caption: 'With compression and more level, it hits harder and sits tighter. Same balance, more finished.',
              },
            ]}
          />

          <h2>How loud is loud enough?</h2>
          <p>
            Streaming services measure loudness in <b>LUFS</b> (loudness units, roughly "average perceived loudness") and turn loud songs down so everything plays at a similar level. That means squashing your song to be louder than everyone else gains you nothing: it just gets turned down, and the squashing stays.
          </p>
          <Spec
            title="Common loudness targets"
            rows={[
              ['Spotify, YouTube, Amazon', 'About −14 LUFS'],
              ['Apple Music', 'About −16 LUFS'],
              ['Pop, EDM, rock masters', 'Often −9 to −7 LUFS (loud; the services turn them down)'],
              ['Classical, jazz, film', '−18 to −14 LUFS (more dynamic range)'],
              ['Peak ceiling', '−1 dB, so MP3 and AAC conversion doesn\'t clip'],
            ]}
          />
          <Why>
            A compressed, limited song is louder on average but has smaller differences between loud and quiet. Once streaming turns everything to the same average level, the more dynamic song often sounds bigger, because its drum hits and choruses still rise above the rest. Aim for "as loud as it sounds good", not "as loud as possible".
          </Why>

          <h2>The Mastering card in BandForge</h2>
          <Spec
            rows={[
              ['Presets', 'Clean (default), Loud, Warm, Bright, Lo-Fi and Gentle. Each sets all six knobs; start with one and adjust.'],
              ['Low / Mid / High', 'Broad tone controls across the whole song: a low shelf (±6 dB), a wide mid band (±6 dB) and a high shelf (±8 dB).'],
              ['Glue', 'Gentle 2:1 compression across the mix. 20–40% is plenty for most songs.'],
              ['Loudness', 'Pushes the song into the limiter, 0–9 dB. Each extra dB makes it louder and a little flatter.'],
              ['Ceiling', 'The maximum peak level, −6 to 0 dB. Leave it at −1 dB for releases.'],
            ]}
          />
          <Try>
            <Steps>
              <li>
                Finish the mix first, with the master peaks around −6 dB and the Mastering card on <b>Clean</b>. Then open the <Ui>Mixer</Ui> (<K>X</K>) and find the <b>Mastering</b> card next to the Master strip.
              </li>
              <li>
                Try each preset on the loudest section of your song. Pick the one that sounds most like your style (Warm for acoustic and lo-fi, Bright for pop, Gentle for classical and piano), then adjust.
              </li>
              <li>
                Raise <b>Loudness</b> slowly. Stop when the chorus starts to feel smaller rather than bigger, then back off 1 dB. Keep <b>Ceiling</b> at −1 dB.
              </li>
              <li>
                Compare by setting it back to Clean and matching the volume by ear. Louder always sounds "better" for a few seconds, so judge at equal loudness.
              </li>
            </Steps>
          </Try>

          <h2>Exporting: which format?</h2>
          <Spec
            rows={[
              ['WAV', 'Uncompressed, full quality. 24-bit for sending to a mastering engineer or uploading to a distributor.'],
              ['FLAC', 'Lossless like WAV but about 40% smaller. Great for archiving.'],
              ['MP3', 'Plays everywhere. 256–320 kbps sounds very close to the original for sharing.'],
              ['M4A (AAC)', 'Apple devices, slightly better than MP3 at the same size.'],
              ['OGG (Opus)', 'Small and good quality for the web and games.'],
              ['MIDI', 'Just the notes, to open in other music software or notation apps.'],
              ['Project', 'A full backup of your BandForge song, including recordings.'],
            ]}
          />
          <Tip>
            In the <Ui>Export</Ui> dialog (<K>⌘</K>+<K>E</K>), <b>Normalize</b> sets the loudest peak just under 0 dB, <b>Reverb tail</b> keeps a few seconds after the last note so echoes fade naturally, and <b>Stems</b> exports every track as its own file, which is what collaborators and mix engineers ask for.
          </Tip>
          <Watch>
            Mastering too early. If you push the Loudness while you're still writing and mixing, every decision gets made against a squashed sound, and the mix often ends up too quiet in the bass and too bright on top once the mastering comes off. Keep mastering on Clean until the very end.
          </Watch>
          <Listen>
            Before you call it finished, play your song straight after a commercial track you love, on phone speakers, headphones and the best speakers you have. Notice the low end, the brightness and how loud the lead sits. If yours holds up on all three, it's done.
          </Listen>
          <Pro>
            Professional mastering engineers often make changes of under 1 dB. If you find yourself making big moves at the mastering stage, go back to the mix: the fix almost always belongs on a single track, not the whole song.
          </Pro>
        </>
      ),
    },
  ],
};

export default chapter;
