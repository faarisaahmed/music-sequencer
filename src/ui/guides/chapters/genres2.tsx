import type { Lesson } from '../types';
import { Cards, Compare, Example, K, Keys, Lead, Listen, PlayChip as P, Pro, SectionMap, Spec, Steps, Tip, Try, Ui, Watch, Why } from '../figures';
import { bass, chords, drums, line, n, repeat, type GNote } from '../notation';

/** Fast broken chord: cycles through `notes` (low to high) in `step`-beat notes for `beats` beats. */
function arp(notes: string, beats: number, start = 0, step = 0.25, v = 0.7): GNote[] {
  const ps = notes.trim().split(/\s+/).map(n);
  const seq = [...ps, ...ps.slice(1, -1).reverse()];
  const out: GNote[] = [];
  for (let i = 0; i < beats / step; i++) out.push({ p: seq[i % seq.length], t: start + i * step, d: step * 0.8, v: i % 4 === 0 ? v : v * 0.8 });
  return out;
}

// ------------------------------------------------------------------ shared grooves

const HOUSE_BEAT = drums(
  {
    k: 'x...x...x...x...',
    cl: '....x.......x...',
    o: '..x...x...x...x.',
    h: 'g.g.g.g.g.g.g.g.',
  },
  { bars: 4 },
);

const BOOM_BAP = drums(
  {
    k: 'x.....x...x..x..|x.x...x...x.....',
    s: '....x.......x...|....x.......x..g',
    h: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.',
  },
  { swing: 0.3 },
);

const TRAP_KICK = drums({ k: 'x.....x...x.....|x.....x..x......' });
const TRAP_SNARE = drums({ cl: '........x.......' }, { bars: 4 });
// Hats in 32nd-note steps: 'x...' is an eighth note, 'xxxx' a quick roll.
const TRAP_HATS = drums({ h: 'x...x...x...x...x...x...xxxxx.x.|x...x...x...x...x.x.x.x.xxxxxxxx' }, { step: 0.125 });

const FUNK_BEAT = drums(
  {
    k: 'x..x......x..x..',
    s: '....X..g.g..X..g',
    h: 'xgxgxgxgxgxgxgxg',
  },
  { bars: 2 },
);

const lessons: Lesson[] = [
  // ================================================================== electronic & house
  {
    id: 'house',
    title: 'Electronic and house',
    minutes: 10,
    summary: 'Four-on-the-floor kicks, off-beat hats, stabbing chords and a bass that dodges the kick. Learn how house and dance tracks are built in 8-bar blocks, and how tension is made with very few chords.',
    keywords: 'house techno edm dance club four on the floor kick clap offbeat hat stab organ piano chords bassline breakdown drop build filter sweep 124 bpm',
    body: () => (
      <>
        <Lead>
          Dance music is a groove that changes slowly. Where a pop song moves the story forward with new chords and new lyrics, a house track holds one feel for minutes and moves you by <b>adding, removing and filtering</b> parts. The writing skill is restraint: two chords and a great bass line, arranged well, beat eight chords arranged badly.
        </Lead>
        <Spec
          title="The recipe"
          rows={[
            ['Tempo', '120–128 BPM. Deep house sits around 120–122, classic and tech house 124–126, big-room and progressive 126–128.'],
            ['Keys', 'Mostly minor or Dorian (a minor key with a brighter 6th). A minor, F minor, G minor and C minor are everywhere because they sit well with the club’s bass frequencies.'],
            ['Chords', 'One to four chords, usually 7ths and 9ths (Am7, Dm9, Fmaj7). Often one chord for 8 bars, then a change.'],
            ['Sounds in BandForge', <>Drums: <b>House 909</b> or <b>Techno Kit</b>. Chords: <b>Electric Piano</b>, <b>Classic Organ</b> or <b>Grand Piano</b> for stabs, <b>Warm Pad</b> for breakdowns. Bass: <b>Analog Bass</b>. Leads: <b>Pluck</b>, <b>Supersaw</b>.</>],
            ['Drums', 'Kick on every beat, clap or snare on 2 and 4, open hi-hat on every off-beat “and”, quiet 16th hats filling the gaps.'],
            ['Structure', 'Everything moves in blocks of 8, 16 and 32 bars. Intro (drums only, so DJs can mix in) → groove → breakdown → build → drop → outro.'],
          ]}
        />

        <h2>The beat: four kicks and an off-beat</h2>
        <p>
          The <b>four-on-the-floor</b> kick is the heartbeat; nothing about it changes for most of the track. What makes it house rather than a march is the <b>open hi-hat on the off-beat</b>, the “and” between kicks. Your body bounces down on the kick and up on the hat. Add a clap on beats 2 and 4 and quiet 16th hats, and you have the whole genre’s skeleton.
        </p>
        <Example
          title="House beat at 124 BPM"
          bpm={124}
          loop
          length={8}
          parts={[{ inst: 'kit-909', label: 'House 909', notes: HOUSE_BEAT.filter((x) => x.t < 8) }]}
          caption="Mute the drum part’s lanes in your head one at a time: the kick alone is a metronome; the open hat on the off-beat is what makes you move."
        />
        <Listen>
          In tracks by Disclosure, Fisher or Purple Disco Machine, listen past the kick for the open hat: <em>“boom-tss, boom-tss”</em>. Then listen for how rarely the drum pattern changes. Variation comes from the music around it and from removing the kick for a few bars, not from busy drum fills.
        </Listen>

        <h2>Stabs and off-beat chords</h2>
        <p>
          House chords are usually <b>short</b>. Long held chords fill the space and fight the groove; short hits leave gaps that the drums and bass breathe through. The two classic rhythms are the <b>off-beat stab</b> (the chord lands with the open hat) and the <b>syncopated stab</b> (on the beat, then just before beat 3).
        </p>
        <Compare
          items={[
            {
              label: 'Off-beat organ',
              title: 'Chords on every “and”',
              bpm: 124,
              loop: true,
              length: 8,
              chordsAbove: 'Am7 D9',
              parts: [
                { inst: 'organ', label: 'Organ', notes: chords('Am7 D9', { style: 'offbeat', center: 64 }) },
                { inst: 'kit-909', label: 'Drums', notes: HOUSE_BEAT.filter((x) => x.t < 8), vol: 0.8 },
              ],
              caption: 'The 90s “organ house” sound. Two chords, one bar each: Am7 to D9 is the Dorian vamp you’ll hear in hundreds of tracks.',
            },
            {
              label: 'Syncopated piano',
              title: 'Hit on 1, again on the “and” of 2',
              bpm: 124,
              loop: true,
              length: 8,
              chordsAbove: 'Am7 D9',
              parts: [
                { inst: 'grand-piano', label: 'Piano', notes: chords('Am7 D9', { style: 'stabs', center: 64 }) },
                { inst: 'kit-909', label: 'Drums', notes: HOUSE_BEAT.filter((x) => x.t < 8), vol: 0.8 },
              ],
              caption: 'The piano-house version. Same chords, a more euphoric push because the second hit anticipates beat 3.',
            },
          ]}
        />
        <Why>
          Am7 and D9 share three notes (A, C and E). Moving between them barely changes the colour, which is exactly what a dance track wants: movement without drama. The one note that does change (G in Am7 becomes F♯ in D9) gives the brightness of the Dorian mode. Try it: <P chords="Am7:2 D9:2 Am7:2 D9:2">Am7 → D9</P>.
        </Why>

        <h2>The bass line dodges the kick</h2>
        <p>
          The kick and the bass both live in the lowest frequencies. If they hit at the same moment, they fight and the low end turns to mush. House solves it with rhythm: the bass plays <b>in the gaps between kicks</b>, most often on the off-beat eighths. The kick says <em>boom</em>, the bass answers <em>dum</em>, and together they make one rolling groove.
        </p>
        <Compare
          items={[
            {
              label: 'Bass on the kick',
              verdict: 'worse',
              title: 'Every bass note lands with a kick',
              bpm: 124,
              loop: true,
              length: 8,
              parts: [
                { inst: 'synth-bass', label: 'Bass', notes: line('A2:1 A2 A2 A2 | D2 D2 D2 D2') },
                { inst: 'kit-909', label: 'Drums', notes: HOUSE_BEAT.filter((x) => x.t < 8) },
              ],
              caption: 'Heavy and stiff. The kick and bass smear into one thud.',
            },
            {
              label: 'Bass between kicks',
              verdict: 'better',
              title: 'Off-beat bass, octave jump at the end of the bar',
              bpm: 124,
              loop: true,
              length: 8,
              parts: [
                { inst: 'synth-bass', label: 'Bass', notes: line('r:1/2 A2:1/2 r A2 r A2 r A3 | r D2 r D2 r D2 r D3') },
                { inst: 'kit-909', label: 'Drums', notes: HOUSE_BEAT.filter((x) => x.t < 8) },
              ],
              caption: 'Same notes, moved half a beat. Now each instrument has its own moment and the groove rolls.',
            },
          ]}
        />
        <Tip>
          The jump up an octave on the last off-beat of the bar is a tiny thing that makes a bass line feel “played”. It also leads the ear into the next bar. Use it every other bar, not every bar.
        </Tip>

        <h2>Arranging in blocks: breakdown, build, drop</h2>
        <p>
          DJs count in phrases, and so do listeners without knowing it. Something should change every <b>8 bars</b> (a new hat, a part dropping out), something bigger every <b>16</b>, and the big moments every <b>32</b>. Change things off this grid and the track feels clumsy even if nobody could tell you why.
        </p>
        <SectionMap
          sections={[
            { name: 'Intro', bars: 16, energy: 2, note: 'drums + bass only' },
            { name: 'Groove', bars: 32, energy: 3, note: 'chords enter' },
            { name: 'Breakdown', bars: 16, energy: 1.5, note: 'no kick, filtered chords' },
            { name: 'Build', bars: 8, energy: 3.5, note: 'snare rolls, rising' },
            { name: 'Drop', bars: 32, energy: 5, note: 'everything, hook' },
            { name: 'Outro', bars: 16, energy: 2, note: 'strip back to drums' },
          ]}
          caption="A typical club structure. The energy dip of the breakdown is what makes the drop feel big: you can’t have a peak without a valley."
        />
        <p>
          The classic tool for the breakdown is a <b>filter</b>: cutting the high frequencies off the chords makes them sound distant and muffled, as if heard from outside the club. Opening the filter again during the build is the “sweep” that tells everyone the drop is coming.
        </p>
        <Compare
          items={[
            {
              label: 'Breakdown',
              title: 'Pad with the highs filtered off, no kick',
              bpm: 124,
              length: 8,
              parts: [{ inst: 'warm-pad', label: 'Filtered pad', notes: chords('Am7 D9', { center: 64 }), fx: { lowpass: 500, reverb: 0.5 } }],
            },
            {
              label: 'Drop',
              title: 'Filter open, kick and bass back',
              bpm: 124,
              length: 8,
              parts: [
                { inst: 'warm-pad', label: 'Open pad', notes: chords('Am7 D9', { center: 64 }), fx: { reverb: 0.3 }, vol: 0.7 },
                { inst: 'synth-bass', label: 'Bass', notes: line('r:1/2 A2:1/2 r A2 r A2 r A3 | r D2 r D2 r D2 r D3') },
                { inst: 'kit-909', label: 'Drums', notes: HOUSE_BEAT.filter((x) => x.t < 8) },
              ],
            },
          ]}
        />
        <Watch>
          The most common beginner dance track has a great 8-bar idea that plays unchanged for four minutes. The second most common has a new idea every 8 bars and no identity. Pick <b>one</b> hook and one groove, then write the arrangement as a list of what enters and leaves, block by block.
        </Watch>
        <Try>
          <Steps>
            <li>
              Open <Ui>Song Settings</Ui> (the gear in the top bar), set the tempo to 124 and the key to A minor (pick <b>Dorian</b> in the scale list for the brighter sound).
            </li>
            <li>
              Add a <Ui>Drums</Ui> track, choose <b>House 909</b> from the kit menu in the step sequencer, and program kick on 1-5-9-13, clap on 5 and 13, open hat on 3-7-11-15. Use <Ui>Velocity</Ui> mode to make the in-between closed hats quiet.
            </li>
            <li>
              Add an <b>Analog Bass</b> and write the off-beat line above in the <Ui>Piano Roll</Ui> with the grid at 1/8. Put the chords on a <b>Classic Organ</b> or <b>Electric Piano</b> track with short notes.
            </li>
            <li>
              For the breakdown and build, click the pad track's <Ui>A</Ui> button and choose <b>Filter</b> in the lane's menu. Draw the lane low at the start of the breakdown and ramp it up to the top across the last 8 bars before the drop: that's the filter sweep. Add a <b>Reverb</b> lane that rises with it for extra lift, then drops back down on the first beat of the drop.
            </li>
            <li>Lay the song out with the arrangement lane in 8-bar blocks before writing more music. Arrangement is half the song in this style.</li>
          </Steps>
        </Try>
        <Pro>
          Producers often sidechain: the pad and bass duck in volume every time the kick hits, which creates the “pumping” breath of French house and EDM. You can get a similar feel by hand in BandForge: draw volume automation that dips at the start of each beat, or simply write shorter pad notes that start just after the kick.
        </Pro>
      </>
    ),
  },

  // ================================================================== hip-hop & trap
  {
    id: 'hiphop-trap',
    title: 'Hip-hop and trap',
    minutes: 11,
    summary: 'From swung boom-bap at 90 BPM to half-time trap with 808s and hat rolls. Learn the drum language, why trap feels slow at 140 BPM, and how to write dark, sparse melodies that leave room for a rapper.',
    keywords: 'hip hop rap boom bap trap drill 808 sub bass hi hat rolls half time swing dark melody harmonic minor phrygian beat making producer',
    body: () => (
      <>
        <Lead>
          A hip-hop beat is a stage for a voice. Every decision, from how loud the snare is to how many notes the melody has, is about leaving space for the words. Beginners overfill; good producers write the smallest idea that still makes your head nod.
        </Lead>
        <Spec
          title="The recipe"
          rows={[
            ['Tempo', <>Boom bap: 85–95 BPM, swung. Trap and drill: 130–150 BPM, but felt in <b>half time</b> (it nods like 65–75).</>],
            ['Keys', 'Almost always minor. Harmonic minor and Phrygian (minor with a flat 2nd) for the dark, tense trap sound. C minor, F minor and G minor suit 808s.'],
            ['Chords', 'Few or none. A two-chord loop, a single sustained chord, or just a melody implying harmony. Jazz-sampled boom bap uses 7ths and 9ths.'],
            ['Sounds in BandForge', <>Boom bap: <b>Lo-Fi Kit</b> or <b>Studio Kit</b>, <b>Wurly</b>/<b>Electric Piano</b>, <b>Upright Bass</b>. Trap: <b>Hip Hop 808</b> kit, <b>808 Sub Bass</b>, <b>Crystal Bells</b>, <b>Pluck</b>, <b>Music Box</b>, <b>Choir</b>.</>],
            ['Drums', 'Boom bap: kick and snare on 2 and 4 with a lazy swing. Trap: snare (or clap) only on beat 3, rapid hi-hats with rolls, kick tied to the 808.'],
            ['Structure', '4- or 8-bar loop as the bed; intro 4–8 bars, verses of 16 bars, hooks of 8. Drop elements out under key lines.'],
          ]}
        />

        <h2>Boom bap: the swing is the song</h2>
        <p>
          Boom bap (think DJ Premier, Pete Rock, J Dilla, early Nas and A Tribe Called Quest) is <b>kick-snare, kick-snare</b> with the off-beat notes pushed late. That delay is <b>swing</b>, and it is the difference between a beat that nods and one that marches. Boom bap kicks also skip around: a double kick before beat 3 is the classic move.
        </p>
        <Example
          title="Boom bap at 90 BPM, swung 16ths"
          bpm={90}
          loop
          parts={[
            { inst: 'kit-lofi', label: 'Lo-Fi Kit', notes: BOOM_BAP },
            { inst: 'wurli', label: 'Wurly keys', notes: chords('Dm9:4 Bbmaj7:4', { center: 62, v: 0.55 }), fx: { lowpass: 3000, reverb: 0.15 } },
            { inst: 'upright-bass', label: 'Upright bass', notes: line('D2:1.5 D2:0.5 r:1 A1:1 | Bb1:1.5 Bb1:0.5 r:1 F2:0.75 E2:0.25') },
          ]}
          chordsAbove="Dm9 Bbmaj7"
          caption="The kick pattern is different in each bar but the snare never moves. Mute the keys and the beat still works; mute the drums and it’s just chords."
        />
        <Listen>
          The upright bass leaves beat 3 empty. That rest is where the snare lives and where a rapper’s strongest word tends to fall. Silence is an instrument in hip-hop.
        </Listen>

        <h2>Trap: fast tempo, slow feel</h2>
        <p>
          Trap (Metro Boomin, Southside, Future, Travis Scott) is written at 130–150 BPM but the snare lands only on <b>beat 3</b> of each bar, so your head nods at half speed. The fast tempo is there for the hi-hats: at 140 BPM the hats can run in quick 16ths, triplets and rolls while the groove underneath feels heavy and slow.
        </p>
        <Compare
          items={[
            {
              label: 'Snare on 2 and 4',
              verdict: 'worse',
              title: '140 BPM, normal backbeat',
              bpm: 140,
              loop: true,
              length: 8,
              parts: [{ inst: 'kit-808', label: 'Hip Hop 808', notes: drums({ k: 'x.......x.......', cl: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 2 }) }],
              caption: 'Frantic. This is a fast rock beat, not trap.',
            },
            {
              label: 'Snare on 3 (half time)',
              verdict: 'better',
              title: '140 BPM, snare only on beat 3',
              bpm: 140,
              loop: true,
              length: 8,
              parts: [{ inst: 'kit-808', label: 'Hip Hop 808', notes: [...TRAP_KICK, ...TRAP_SNARE.filter((x) => x.t < 8), ...TRAP_HATS] }],
              caption: 'Same tempo, half the snares. Suddenly it’s heavy and laid back, and the hats have room to dance.',
            },
          ]}
        />

        <h2>The 808: a kick drum you can tune</h2>
        <p>
          The trap bass is the <b>808</b>, a long, booming sine-wave note that works as kick and bass at once. It almost always plays <b>with the kick</b> (the opposite of house), and it must be in key: an 808 on the wrong note makes the whole beat feel off even when people can’t say why. Write it like a bass line that follows the kick rhythm, mostly on the root, with a move to the 5th or the flat 6th for tension.
        </p>
        <Example
          title="Trap: 808 following the kick, bells in C harmonic minor"
          bpm={140}
          loop
          parts={[
            { inst: 'kit-808', label: 'Drums', notes: [...TRAP_KICK, ...TRAP_SNARE.filter((x) => x.t < 8), ...TRAP_HATS] },
            { inst: 'sub-808', label: '808 Sub', notes: line('C2:1.5 C2:1 G1:1.5 | C2:1.5 Eb2:0.75 D2:1.75'), vol: 1.1 },
            { inst: 'bells', label: 'Bells', notes: line('G4:1/2 C5 Eb5 D5 C5:1 B4:1 | Ab4:1/2 C5 Eb5 D5 C5:1 G4:1', { v: 0.6 }), fx: { reverb: 0.35, delay: 0.25 } },
          ]}
          caption="The B natural in the bell line is the harmonic-minor note: one half step below C, it pulls hard back to the root and gives trap melodies their sinister, almost classical edge."
        />
        <Why>
          Harmonic minor raises the 7th note of the minor scale (B♭ becomes B in C minor). That creates a <P notes="Ab4 B4" mode="apart">gap of three half steps</P> between the 6th and 7th notes, the “exotic” interval you hear in film villains, flamenco and trap. Phrygian does the opposite trick at the bottom, flattening the 2nd: <P notes="C4 Db4" mode="apart">C to D♭</P> is pure menace.
        </Why>
        <Tip title="About 808 slides">
          In many trap beats the 808 glides from one pitch to the next. BandForge’s <b>808 Sub Bass</b> doesn’t slide, so get the effect with rhythm instead: a quick note a step below just before the main one, or a jump to the octave above on the last 16th of the bar.
        </Tip>

        <h2>Hat rolls and triplets</h2>
        <p>
          Trap hats run in steady 8ths or 16ths and then <b>roll</b>: bursts of 32nd notes or 16th-note triplets just before the snare or at the end of a bar. Treat them like a drummer’s fills: one or two per bar, placed where they lead into something. A roll on every beat stops being exciting.
        </p>
        <Example
          title="Hats only: steady eighths with rolls into the next bar"
          bpm={140}
          loop
          parts={[{ inst: 'kit-808', label: 'Hats', notes: TRAP_HATS }]}
          caption="Bar 1 ends with a short roll, bar 2 with a longer one. The longer roll comes last because it leads back to the top of the loop."
        />

        <h2>Leave room for the voice</h2>
        <Cards
          items={[
            { title: 'Melody in the gaps', body: 'Keep the main melody to one or two bars that repeat. Rest where the vocal will be busiest.' },
            { title: 'Mid-range clear', body: 'Voices live roughly between 200 Hz and 4 kHz. Keep pads and busy keys above or below, or turn them down.' },
            { title: 'Drop out under key lines', body: 'Mute the drums or the melody for the last bar of an 8-bar section. That gap is where punchlines land.' },
            { title: 'Hook gets one more layer', body: 'The chorus beat is the verse beat plus one element (a counter-melody, a choir, a wider hat pattern), not a new beat.' },
          ]}
        />
        <Watch>
          Beginners copy the trap sound and forget the space: a busy melody, a busy 808 line and constant hat rolls all at once. Pick which element is the star of each 4 bars and simplify the others.
        </Watch>
        <Try>
          <Steps>
            <li>
              In <Ui>Song Settings</Ui> set 140 BPM and C minor (try <b>Harmonic Minor</b> in the scale list). For boom bap set 90 BPM and click the <Ui>SWING</Ui> readout in the top bar to choose <b>Boom Bap</b>.
            </li>
            <li>
              On a <Ui>Drums</Ui> track with the <b>Hip Hop 808</b> kit, put the clap only on step 9. For hats, switch the step grid to <b>1/32</b> or <b>1/16T</b> (triplets), or keep 1/16 and use <Ui>Note Repeat</Ui> mode: drag up on a step to turn one hit into 2, 3 or 4 quick ones.
            </li>
            <li>
              Add a Software Instrument with <b>808 Sub Bass</b> and copy the kick rhythm into the <Ui>Piano Roll</Ui>, on the root of your key.
            </li>
            <li>Write a two-bar melody on <b>Crystal Bells</b> or <b>Pluck</b>. Give it some <Ui>Reverb</Ui> and <Ui>Echo / Delay</Ui> in <Ui>Smart Controls</Ui> so it floats behind the vocal.</li>
          </Steps>
        </Try>
        <Pro>
          Many producers use <Ui>Chance</Ui>-style variation on hats (a few ghost hits that sometimes play) to stop a loop sounding copy-pasted over a 3-minute song. In BandForge’s step sequencer, <Ui>Chance</Ui> mode sets how likely each step is to sound, so a quiet hat at 50% gives the beat a human restlessness.
        </Pro>
      </>
    ),
  },

  // ================================================================== jazz
  {
    id: 'jazz',
    title: 'Jazz basics',
    minutes: 12,
    summary: 'The ii–V–I, 7th chords and the two notes that matter in each, walking bass, swing and comping. Enough jazz language to write a convincing tune and understand why it sounds sophisticated.',
    keywords: 'jazz swing ii V I two five one seventh chords extensions ninth thirteenth shell voicings rootless walking bass ride cymbal comping charleston blues 12 bar guide tones bebop',
    body: () => (
      <>
        <Lead>
          Jazz sounds complicated but runs on a small set of moves. Learn the <b>ii–V–I</b>, learn which two notes of a chord actually carry its sound, and learn to swing your eighth notes, and you’ll hear most jazz standards as variations on things you already know.
        </Lead>
        <Spec
          title="The recipe"
          rows={[
            ['Tempo', 'Ballads 50–70 BPM, medium swing 110–160, bebop 200+. Bossa nova 120–140, straight eighths.'],
            ['Keys', 'Flat keys dominate (F, B♭, E♭, A♭) because they suit horns. Chords change key constantly, so “the key” is more a home base than a rule.'],
            ['Chords', 'Every chord has a 7th: maj7, m7, 7 (dominant), m7♭5. Extensions (9ths, 11ths, 13ths) add colour on top.'],
            ['Sounds in BandForge', <><b>Grand Piano</b> or <b>Electric Piano</b>, <b>Upright Bass</b>, <b>Studio Kit</b> (ride cymbal!), <b>Saxophone</b>, <b>Trumpet</b>, <b>Trombone</b>, <b>Nylon Guitar</b> for bossa.</>],
            ['Drums', 'The ride cymbal keeps time (“ding, ding-a ding”), hi-hat closes with the foot on 2 and 4, snare and kick add light accents.'],
            ['Structure', 'Head (the tune) → solos over the same chords → head again. Forms are usually 12 bars (blues) or 32 bars (AABA).'],
          ]}
        />

        <h2>The ii–V–I: jazz’s sentence</h2>
        <p>
          Take a major key, say C. Its 2nd chord is <b>Dm7</b>, its 5th is <b>G7</b>, its home is <b>Cmaj7</b>. Played in that order, each root falls a 5th to the next, which is the strongest pull in harmony. Jazz standards are long chains of these, moving through different keys.
        </p>
        <Example
          title="ii–V–I in C with a walking bass"
          bpm={120}
          loop
          chordsAbove="Dm7 G7 Cmaj7 A7"
          parts={[
            { inst: 'grand-piano', label: 'Piano', notes: chords('Dm7 G7 Cmaj7 A7', { center: 60, v: 0.55 }) },
            { inst: 'upright-bass', label: 'Walking bass', notes: line('D2:1 E2 F2 F#2 | G2 A2 B2 Db3 | C3 B2 A2 G2 | A2 G2 F2 Eb2') },
          ]}
          caption="The A7 at the end is a turnaround: it points back to Dm7 so the progression can repeat. The bass plays one note per beat, landing on each chord’s root on beat 1 and approaching it from a half step away on beat 4."
        />
        <Why>
          G7 contains B and F, a <P notes="B3 F4">tritone</P>, the most restless interval there is. In Cmaj7, B steps up to C (or holds as the maj7) and F steps down to E. That collapse of tension into a stable chord is what you hear as “arriving home”, and jazz uses it in every key, all the time.
        </Why>

        <h2>The two notes that matter: 3rd and 7th</h2>
        <p>
          A chord’s root is usually played by the bass, and its 5th adds almost no colour. The notes that tell your ear “minor 7th” or “dominant 7th” are the <b>3rd</b> and the <b>7th</b>. Jazz pianists and guitarists often play only those two, a <b>shell voicing</b>, which leaves space and sounds instantly “jazzy”.
        </p>
        <Keys from="C3" to="B4" marks={{ D3: 'R', F3: '3', C4: '7' }} caption="Dm7 as a shell: root in the left hand, then just the 3rd (F) and 7th (C). Click the keys or play them together." />
        <p>
          Follow only the 3rds and 7ths through a ii–V–I and something lovely appears: they move by <b>a half step or not at all</b>. C (7th of Dm7) slides to B (3rd of G7); F stays as the 7th of G7, then slides to E (3rd of Cmaj7). This smooth inner line is called a <b>guide-tone line</b>, and it is a ready-made melody.
        </p>
        <Example
          title="Guide tones only, over a bass"
          names
          bpm={100}
          loop
          chordsAbove="Dm7 G7 Cmaj7:8"
          parts={[
            { inst: 'electric-piano', label: 'Shells (3rd + 7th)', notes: line('F3+C4:4 | F3+B3:4 | E3+B3:8', { v: 0.6 }) },
            { inst: 'upright-bass', label: 'Bass', notes: line('D2:4 | G1:4 | C2:8') },
          ]}
          caption="Two notes per chord and the harmony is completely clear. Each change moves one voice by a half step."
        />
        <Tip>
          Stuck writing a jazz melody? Sing the guide-tone line, then decorate it: approach each guide tone from a step above or below, add a little rhythm, and leave rests. Many great bebop lines are exactly that.
        </Tip>

        <h2>Swing eighths and the ride cymbal</h2>
        <p>
          Jazz eighth notes are <b>uneven</b>: the first of each pair is longer, the second shorter and later, roughly two-thirds and one-third of the beat. Written straight, a jazz line sounds like a classical exercise. The ride cymbal’s “ding, ding-a ding” pattern spells this swing out for the whole band.
        </p>
        <Compare
          items={[
            {
              label: 'Straight',
              verdict: 'worse',
              title: 'Even eighths',
              bpm: 140,
              loop: true,
              length: 8,
              parts: [
                { inst: 'saxophone', label: 'Sax', notes: line('E4:1/2 F4 G4 A4 Bb4 A4 G4 E4 | F4 D4 E4 C4 D4:2') },
                { inst: 'kit-acoustic', label: 'Ride + hat', notes: drums({ r: 'x.xxx.xx', h: '..x...x.' }, { step: 0.5, bars: 2 }) },
              ],
            },
            {
              label: 'Swung',
              verdict: 'better',
              title: 'Long-short eighths',
              bpm: 140,
              loop: true,
              length: 8,
              parts: [
                { inst: 'saxophone', label: 'Sax', notes: line('E4:2/3 F4:1/3 G4:2/3 A4:1/3 Bb4:2/3 A4:1/3 G4:2/3 E4:1/3 | F4:2/3 D4:1/3 E4:2/3 C4:1/3 D4:2') },
                { inst: 'kit-acoustic', label: 'Ride + hat', notes: drums({ r: 'x.xxx.xx', h: '..x...x.' }, { step: 0.5, bars: 2, swing: 0.33 }) },
              ],
            },
          ]}
        />

        <h2>Comping: chords as rhythm</h2>
        <p>
          Jazz pianists don’t hold chords for a whole bar; they <b>comp</b> (accompany) with short, syncopated hits that leave gaps for the soloist. The most famous rhythm is the <b>Charleston</b>: a hit on beat 1, another on the swung “and” of 2, then silence.
        </p>
        <Example
          title="Charleston comping with rootless voicings"
          bpm={130}
          loop
          chordsAbove="Dm9 G13 Cmaj9:8"
          parts={[
            { inst: 'grand-piano', label: 'Piano', notes: line('F3+A3+C4+E4:5/3 F3+A3+C4+E4:1/3 r:2 | F3+B3+E4:5/3 F3+B3+E4:1/3 r:2 | E3+G3+B3+D4:5/3 E3+G3+B3+D4:1/3 r:2 | r:4', { v: 0.6, gate: 0.6 }) },
            { inst: 'upright-bass', label: 'Bass', notes: line('D2:1 E2 F2 F#2 | G2 F2 E2 D2 | C2 E2 G2 A2 | B2 A2 G2 E2') },
            { inst: 'kit-acoustic', label: 'Ride', notes: drums({ r: 'x.xxx.xx', h: '..x...x.' }, { step: 0.5, bars: 4, swing: 0.33 }), vol: 0.7 },
          ]}
          caption="No roots in the piano (the bass has them), and colour notes on top: E is the 9th of Dm, E over G7 is the 13th, D over Cmaj7 is the 9th."
        />

        <h2>The 12-bar blues</h2>
        <p>
          The blues is the other half of jazz’s DNA. Twelve bars, three chords, all dominant 7ths, so even the “home” chord is a little restless. Learn this form and you can jam with almost any jazz, rock or soul musician on earth.
        </p>
        <Example
          title="12-bar blues in C (one chord per bar)"
          bpm={120}
          chordsAbove="C7 F7 C7 C7 F7 F7 C7 C7 G7 F7 C7 G7"
          parts={[
            { inst: 'grand-piano', label: 'Piano', notes: chords('C7 F7 C7 C7 F7 F7 C7 C7 G7 F7 C7 G7', { style: 'pulse', center: 60, v: 0.5 }) },
            { inst: 'upright-bass', label: 'Bass', notes: bass('C7 F7 C7 C7 F7 F7 C7 C7 G7 F7 C7 G7', { style: 'walk' }) },
          ]}
          caption="The F7 in bar 2 is the “quick change”. Bars 9–10 (G7 to F7) are the turn, and the G7 in bar 12 sends you back to the top."
        />
        <Watch>
          Adding 9ths and 13ths everywhere doesn’t make music jazz; rhythm does. A plain triad progression played with swing, rests and a walking bass sounds more like jazz than lush chords played stiffly on every beat.
        </Watch>
        <Try>
          <Steps>
            <li>
              Click the <Ui>SWING</Ui> readout in the top bar and pick <b>Jazz 8th</b>. BandForge plays your straight eighths with a swing feel, so you can write on the normal grid.
            </li>
            <li>
              Add an <b>Upright Bass</b> and write one note per beat: chord root on beat 1, then notes of the chord or scale, then a note a half step above or below the next chord’s root on beat 4.
            </li>
            <li>
              On a piano track, enter shell voicings (3rd and 7th) and try the Charleston rhythm. Use the <Ui>Chord Track</Ui> (<K>W</K>) to keep the changes in view while you write.
            </li>
            <li>For the drums, the <b>Studio Kit</b> with the ride pattern above and a soft hi-hat on 2 and 4 is all you need.</li>
          </Steps>
        </Try>
        <Pro>
          Listen to Miles Davis’s <em>Kind of Blue</em>, Bill Evans and Wynton Kelly for comping, Ray Brown and Paul Chambers for walking bass. Notice how often the piano plays <em>nothing</em>: good comping is mostly listening.
        </Pro>
      </>
    ),
  },

  // ================================================================== r&b, soul & funk
  {
    id: 'rnb-soul-funk',
    title: 'R&B, soul and funk',
    minutes: 11,
    summary: 'Lush 9th chords and neo-soul movement, Rhodes keys, ghost-note grooves, syncopated bass and horn answers. How to write music that feels warm, grown-up and impossible not to move to.',
    keywords: 'rnb r&b soul neo soul funk gospel rhodes electric piano maj9 m9 7#9 hendrix chord ghost notes syncopation slap bass clav horns call and response laid back groove',
    body: () => (
      <>
        <Lead>
          R&B, soul and funk come from the same family: gospel harmony, blues feeling and a rhythm section that grooves as one. Soul and R&B lean on <b>rich chords</b>; funk leans on <b>rhythm</b>, sometimes staying on a single chord for a whole song. Both live or die on feel.
        </Lead>
        <Spec
          title="The recipe"
          rows={[
            ['Tempo', 'Slow jams and neo-soul 65–90 BPM (often laid back), classic soul 90–120, funk 95–115.'],
            ['Keys', 'Major and minor equally; Dorian minor is the funk home. Neo-soul often blurs the key with chromatic chord moves.'],
            ['Chords', 'maj7, maj9, m7, m9, 9 and 13 chords. Funk: dominant 7th and 7♯9 vamps on one chord.'],
            ['Sounds in BandForge', <><b>Electric Piano</b> and <b>Suitcase Electric Piano</b> (Rhodes), <b>Wurly</b>, <b>Funk Clav</b>, <b>Classic Organ</b>, <b>Electric Bass</b>, <b>Electric Guitar</b>, <b>Trumpet</b>/<b>Synth Brass</b>, <b>Studio Kit</b>.</>],
            ['Drums', 'Backbeat on 2 and 4, with quiet ghost notes on the snare between. 16th hats with accents. Neo-soul drums sit slightly late and loose.'],
            ['Structure', 'Verse–pre-chorus–chorus with a bridge; funk often grows one groove section by section.'],
          ]}
        />

        <h2>Neo-soul chords: 9ths moving by step</h2>
        <p>
          Add a 7th and a 9th to ordinary chords and they turn soft, warm and adult. Then move those rich chords <b>stepwise</b>, often downward, and you have the neo-soul sound of D’Angelo, Erykah Badu, H.E.R. and Daniel Caesar. Played on a Rhodes, it is almost a genre by itself.
        </p>
        <Example
          title="IV – iii – ii – I with 9ths, laid-back Rhodes"
          bpm={78}
          loop
          chordsAbove="Fmaj9 Em9 Dm9 Cmaj9"
          parts={[
            { inst: 'suitcase-ep', label: 'Rhodes', notes: chords('Fmaj9 Em9 Dm9 Cmaj9', { center: 62, v: 0.6 }) },
            { inst: 'electric-bass', label: 'Bass', notes: line('F2:2.5 F2:0.5 C2:1 | E2:2.5 E2:0.5 B1:1 | D2:2.5 D2:0.5 A1:1 | C2:3 G1:0.5 B1:0.5') },
            { inst: 'kit-acoustic', label: 'Drums', notes: drums({ k: 'x.........x.....', s: '....x..g....x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 4, swing: 0.15 }), vol: 0.75 },
          ]}
          caption="A plain IV–iii–ii–I walk-down in C, made lush by the 9ths. The bass anticipates each change slightly; the snare ghost note sits just before beat 3."
        />
        <Listen>
          Compare the plain triads <P chords="F:2 Em:2 Dm:2 C:2">F Em Dm C</P> with the 9th chords <P chords="Fmaj9:2 Em9:2 Dm9:2 Cmaj9:2">Fmaj9 Em9 Dm9 Cmaj9</P>. Same roots, same movement. The added notes are what make it “R&B”.
        </Listen>
        <Why>
          A 9th chord contains two overlapping triads: Fmaj9 is F major (F A C) with A minor (A C E) on top, plus the G. Your ear hears both at once, so the chord feels ambiguous and soft rather than bluntly happy or sad. That gentle ambiguity is the emotional core of soul ballads.
        </Why>

        <h2>Funk: one chord, sixteen places to hit it</h2>
        <p>
          Funk (James Brown, Parliament, Prince, Vulfpeck) often stays on one chord, usually a dominant 7th or the spiky <b>7♯9</b> “Hendrix chord”, and makes it interesting with rhythm. Every instrument plays a short, syncopated part; together they lock like gears. The <b>one</b> (the first beat of the bar) is sacred: everyone hits it hard.
        </p>
        <Example
          title="Funk groove on E7♯9: ghost notes, clav, syncopated bass"
          bpm={104}
          loop
          parts={[
            { inst: 'kit-acoustic', label: 'Drums', notes: FUNK_BEAT },
            { inst: 'electric-bass', label: 'Bass', notes: repeat(line('E2:0.5 r:0.25 E2:0.25 r:0.5 E3:0.25 r:0.25 G2:0.5 A2:0.25 Bb2:0.25 B2:0.5 D3:0.25 E3:0.25'), 2, 4) },
            { inst: 'clav', label: 'Clav', notes: repeat(line('r:0.25 G#3+D4+G4:0.25 r:0.5 G#3+D4+G4:0.25 r:0.5 G#3+D4+G4:0.25 r:0.75 G#3+D4+G4:0.25 r:0.5 G#3+D4+G4:0.25 r:0.5', { gate: 0.5, v: 0.7 }), 2, 4) },
          ]}
          caption="The clav plays the 7♯9 chord (G♯, D and G over the E bass) as short 16th-note chops between the bass notes. Mute parts one at a time: each one alone sounds thin, together they groove."
        />
        <Tip title="Ghost notes">
          The tiny snare hits between the backbeats are called <b>ghost notes</b>: felt more than heard, at around a third of the volume of the main hits. They fill the 16th-note grid so the groove never stops moving. In BandForge’s step sequencer, place them and then pull their level down in <Ui>Velocity</Ui> mode.
        </Tip>
        <Keys from="E2" to="B4" marks={{ E2: 'R', 'G#3': '3', D4: '♭7', G4: '♯9' }} caption="The 7♯9 chord. It contains both a major 3rd (G♯) and a minor 3rd (G, spelled as a raised 9th) at once: major and minor, sweet and nasty, the essence of funk and blues." />

        <h2>Call and response</h2>
        <p>
          Gospel churches are the root of soul: the preacher calls, the congregation answers. Soul arrangements do the same with instruments. The singer sings a phrase, the horns (or the guitar, or backing vocals) answer in the gap. It keeps the energy up without ever stepping on the lead.
        </p>
        <Example
          title="Lead calls, horns answer"
          bpm={96}
          loop
          chordsAbove="C7 F7 C7 G7"
          parts={[
            { inst: 'flute', label: 'Lead (voice)', notes: line('G4:0.5 A4 C5:1 A4:0.5 G4:1.5 r:4 | E4:0.5 G4 A4:1 C5:0.5 A4:1.5 r:4') },
            { inst: 'brass-section', label: 'Horns', notes: line('r:4 A4+C5:0.5 r:0.5 A4+C5:0.5 A4+Eb5:1 r:1.5 r:4 D5+F5:0.5 r:0.5 D5+F5:0.5 B4+D5:1 r:1.5', { gate: 0.7 }) },
            { inst: 'electric-bass', label: 'Bass', notes: bass('C7 F7 C7 G7', { style: 'root5' }) },
            { inst: 'kit-acoustic', label: 'Drums', notes: drums({ k: 'x......x..x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 4 }), vol: 0.75 },
          ]}
          caption="The lead never plays while the horns do, and the horn answers are short and punchy so they don’t compete."
        />
        <Watch>
          Soul and R&B chords sound beautiful on their own, so beginners stack them on every instrument. If the keys play full 9th chords, the guitar plays full chords and a pad plays chords too, the harmony turns to soup. Let one instrument own the rich voicings; give the others short rhythmic parts.
        </Watch>
        <Try>
          <Steps>
            <li>
              For neo-soul, set the song to about 80 BPM and click the <Ui>SWING</Ui> readout in the top bar to choose <b>Laid Back</b>: slightly late and loose, like a real player. For funk, try <b>MPC 16th</b> or keep it straight.
            </li>
            <li>
              Write a four-chord progression on a <b>Suitcase Electric Piano</b> track, adding the 9th to each chord in the <Ui>Piano Roll</Ui>. In the <Ui>Score</Ui> you can select chord notes and press <K>Alt</K>+<K>3</K> to stack a 3rd above them in key.
            </li>
            <li>
              Program drums with ghost notes in the step sequencer’s <Ui>Velocity</Ui> mode. Write a bass line that rests on beat 3 and pushes into the next bar.
            </li>
            <li>Add a horn answer on a <b>Synth Brass</b> or <b>Trumpet</b> track, only in the gaps of your melody.</li>
          </Steps>
        </Try>
        <Pro>
          Session bassists talk about playing “in the pocket”: locking exactly with the kick drum on the important hits and leaving everything else loose. Write your bass line with the kick part visible beside it and make the two agree on beat 1 of every bar, then let them talk to each other in between.
        </Pro>
      </>
    ),
  },

  // ================================================================== folk & acoustic
  {
    id: 'folk',
    title: 'Folk, acoustic and singer-songwriter',
    minutes: 9,
    summary: 'Three chords and the truth: open-string keys, fingerpicking patterns, waltz time and melodies that serve a story. How to keep a sparse arrangement intimate without sounding empty.',
    keywords: 'folk acoustic singer songwriter guitar fingerpicking travis picking capo open chords I IV V three chords waltz 3/4 6/8 storytelling lyrics verse melody sparse arrangement fiddle',
    body: () => (
      <>
        <Lead>
          Folk is the genre where the song itself is the production. A voice, a guitar, maybe a fiddle or a harmony: there is nowhere to hide and nothing to hide behind. The craft is in the <b>words</b>, the <b>melody that carries them</b>, and a guitar part that supports without crowding.
        </Lead>
        <Spec
          title="The recipe"
          rows={[
            ['Tempo', 'Ballads 60–80 BPM, walking songs 90–120, fast bluegrass and reels 130+. Waltzes in 3/4 around 90–110.'],
            ['Keys', <>Guitar-friendly keys with open strings: <b>G, C, D, A, E</b> major and <b>Em, Am</b>. Singers move a song up or down with a capo rather than changing the chord shapes.</>],
            ['Chords', 'I, IV and V carry most songs, with vi and ii for colour. Sus and add9 chords come for free on a guitar (Dsus4, Cadd9).'],
            ['Sounds in BandForge', <><b>Acoustic Guitar</b>, <b>Nylon Guitar</b>, <b>Upright Bass</b>, <b>Violin</b> (fiddle), <b>Accordion</b>, <b>Harmonium</b>, <b>Felt Piano</b>, <b>Percussion</b> kit for shaker and hand drums.</>],
            ['Drums', 'Often none. Otherwise a soft kick on 1 and 3, brushes, a shaker, or a hand drum. Foot stomps and claps for the singalong.'],
            ['Structure', 'Verse–chorus, or strophic (many verses, same melody, a refrain line at the end of each). Story told across verses.'],
          ]}
        />

        <h2>Three chords, played well</h2>
        <p>
          I–IV–V in G is G, C and D, the first three chords most guitarists learn. Thousands of folk songs, from Woody Guthrie to Mumford & Sons, use little else. What separates them is the <b>picking pattern</b>, the melody and the words, which is good news: you can start writing today.
        </p>
        <Example
          title="Travis-style fingerpicking: G – C – G – D"
          bpm={96}
          loop
          chordsAbove="G C G D"
          parts={[
            {
              inst: 'acoustic-guitar',
              label: 'Guitar',
              notes: line(
                'G2+B3:1/2 G3 D3+D4 G3 G2+B3 G3 D3+D4 G3 | C3+C4 G3 G2+E4 G3 C3+C4 G3 G2+E4 G3 | G2+B3 G3 D3+D4 G3 G2+B3 G3 D3+D4 G3 | D3+A3 F#3 A2+D4 F#3 D3+A3 F#3 A2+F#4 A3',
                { v: 0.65 },
              ),
            },
          ]}
          caption="The thumb alternates between two bass notes on every beat while the fingers fill the off-beats. That steady thumb is what makes fingerpicking sound like two players."
        />
        <Why>
          The alternating bass gives you a built-in rhythm section, and the off-beat melody notes give you harmony and movement. Because the thumb never stops, the singer can be free with their phrasing on top; the guitar keeps time for both of you.
        </Why>
        <Tip title="Capo thinking">
          If a song in G is too low for your voice, a guitarist puts a capo on fret 2 and plays the same G shapes, now sounding in A. In BandForge you don’t need a capo: open <Ui>Song Settings</Ui>, change the key, and keep <b>Transpose existing notes</b> ticked. Try a few keys until the highest melody note feels strong but not strained.
        </Tip>

        <h2>Waltz time: 3/4 and 6/8</h2>
        <p>
          Folk is full of songs in three: waltzes, sea shanties, lullabies, Irish airs. In <b>3/4</b> you count “ONE two three”, with the bass on one and the chord on two and three. <b>6/8</b> is two big beats each split into three (“ONE two three FOUR five six”); it rolls and lilts like a boat.
        </p>
        <Compare
          items={[
            {
              label: '3/4 waltz',
              title: 'Bass on 1, chord on 2 and 3',
              bpm: 100,
              meter: 3,
              loop: true,
              length: 12,
              parts: [
                { inst: 'acoustic-guitar', label: 'Guitar', notes: line('G2:1 B3+D4+G4 B3+D4+G4 | D3 B3+D4+G4 B3+D4+G4 | C3 C4+E4+G4 C4+E4+G4 | D3 A3+D4+F#4 A3+D4+F#4', { v: 0.65 }) },
                { inst: 'violin', label: 'Fiddle', notes: line('D5:2 B4:1 | G4:3 | E5:2 D5:1 | C5:1 B4 A4', { v: 0.6 }) },
              ],
            },
            {
              label: '6/8 lilt',
              title: 'Two beats per bar, each split in three',
              bpm: 200,
              meter: 6,
              loop: true,
              length: 24,
              parts: [
                { inst: 'acoustic-guitar', label: 'Guitar', notes: line('E2:1 B3 E4 G3 B3 E4 | E2 B3 E4 G3 B3 E4 | C3 G3 C4 E3 G3 C4 | D3 A3 D4 F#3 A3 D4', { v: 0.6 }) },
                { inst: 'flute', label: 'Whistle', notes: line('B4:2 A4:1 G4:2 E4:1 | G4:3 B4:3 | C5:2 B4:1 A4:2 G4:1 | F#4:3 A4:3') },
              ],
              caption: 'Counted in eighth notes here, so the tempo looks fast. Feel two big swaying beats per bar.',
            },
          ]}
        />

        <h2>Melody serves the story</h2>
        <p>
          Folk verses usually tell the story in a <b>narrow range</b>, close to speech, so every word is clear. The chorus lifts higher and repeats, because it carries the feeling rather than the facts. Write the lyric first, speak it aloud, and let the natural stresses of the words set the rhythm.
        </p>
        <Compare
          items={[
            {
              label: 'Verse: speech-like',
              title: 'Five notes, mostly steps, words first',
              bpm: 92,
              names: true,
              chordsAbove: 'G C G D',
              parts: [
                { inst: 'flute', label: 'Melody', notes: line('B3:0.5 B3 D4:1 D4:0.5 B3 A3:1 | G3:0.5 A3 C4:1 E4:0.5 D4 C4:1 | B3:0.5 B3 D4:1 D4:0.5 E4 D4:1 | B3:0.5 A3 F#3:1 A3:2') },
                { inst: 'acoustic-guitar', label: 'Guitar', notes: chords('G C G D', { center: 55, v: 0.45, style: 'pulse' }) },
              ],
            },
            {
              label: 'Chorus: lifts',
              title: 'Higher, longer notes, a leap at the start',
              bpm: 92,
              names: true,
              chordsAbove: 'C G Em D',
              parts: [
                { inst: 'flute', label: 'Melody', notes: line('G4:1.5 E4:0.5 D4:2 | D4:1 B3 D4 G4 | E4:2 D4:1 B3:1 | A3:4') },
                { inst: 'acoustic-guitar', label: 'Guitar', notes: chords('C G Em D', { center: 55, v: 0.45, style: 'pulse' }) },
              ],
            },
          ]}
        />
        <Listen>
          Joni Mitchell, Bob Dylan, Nick Drake, Gillian Welch, Phoebe Bridgers and Bon Iver all write verses you could almost speak. Notice how the melody rises exactly where the lyric has its most important word.
        </Listen>

        <h2>Arranging sparse, building gently</h2>
        <Cards
          items={[
            { tag: 'Verse 1', title: 'Voice + one instrument', body: 'Fingerpicked guitar or felt piano. Nothing else. Intimacy is the point.' },
            { tag: 'Chorus 1', title: 'Add a second voice', body: 'A harmony a 3rd above or below on the chorus lines only.' },
            { tag: 'Verse 2', title: 'Add a bass or a drone', body: 'Upright bass on beats 1 and 3, or an accordion/harmonium chord held under.' },
            { tag: 'Last chorus', title: 'A colour instrument', body: 'Fiddle or flute playing a counter-melody in the gaps, maybe a stomp on 2 and 4.' },
          ]}
        />
        <Watch>
          Sparse doesn’t mean static. A three-minute song with the same fingerpicking from first bar to last needs <em>something</em> to change: switch to strumming for the chorus, drop the guitar out for one line, or let the bass in on verse two.
        </Watch>
        <Try>
          <Steps>
            <li>
              Add a Software Instrument and pick <b>Acoustic Guitar</b> in the <Ui>Sounds</Ui> library (<K>Y</K>). For a waltz, set <b>3/4</b> or <b>6/8</b> in <Ui>Song Settings</Ui>.
            </li>
            <li>
              In the <Ui>Piano Roll</Ui> set the grid to 1/8 and write the alternating thumb (root, 5th) on the beats, then add higher chord notes on the off-beats. Vary the velocity slightly so it doesn’t sound machine-plucked.
            </li>
            <li>
              Write your verse melody on a separate track (a <b>Flute</b> stands in nicely for a voice), with your lyrics in the <Ui>Score</Ui> (<K>⌘</K>/<K>Ctrl</K>+<K>L</K>) so the rhythm follows the words.
            </li>
            <li>Build the arrangement one instrument per section, as in the cards above.</li>
          </Steps>
        </Try>
        <Pro>
          Folk producers often record the guitar slightly off the beat and leave tiny tempo drifts in, because perfect timing makes intimate songs feel cold. Try BandForge’s <b>Human Feel</b> swing setting (click the <Ui>SWING</Ui> readout) to loosen a programmed guitar part.
        </Pro>
      </>
    ),
  },

  // ================================================================== ambient & textures
  {
    id: 'ambient',
    title: 'Ambient and soundtrack textures',
    minutes: 9,
    summary: 'Slow-moving pads, drones, long reverbs and sparse motifs. How to make music that changes over minutes rather than bars, with modal colour that feels like light rather than a chord progression.',
    keywords: 'ambient soundscape texture pad drone pedal tone reverb delay lydian modal sparse motif evolving slow cinematic atmosphere eno minimal swell automation',
    body: () => (
      <>
        <Lead>
          Ambient music, as Brian Eno put it, should be “as ignorable as it is interesting”. Instead of a beat and a hook, it offers a <b>space</b> that slowly changes. Writing it is a different discipline: fewer notes, much longer time spans, and careful attention to sound itself.
        </Lead>
        <Spec
          title="The recipe"
          rows={[
            ['Tempo', 'Slow (50–80 BPM) or effectively none. Chords last 4, 8 or 16 bars. Changes happen over minutes.'],
            ['Keys', <>Modes over keys: <b>Lydian</b> (major with a raised 4th) for floating light, <b>Dorian</b> for calm reflection, <b>Aeolian</b> (natural minor) for melancholy.</>],
            ['Chords', 'Open voicings, sus2 and add9 chords, maj7s, and chords over a held bass note (pedal tone). Few changes.'],
            ['Sounds in BandForge', <><b>Warm Pad</b>, <b>Dream Pad</b>, <b>String Ensemble</b>, <b>Choir</b>, <b>Felt Piano</b>, <b>Crystal Bells</b>, <b>Music Box</b>, <b>Celesta</b>, <b>Upright Bass (Bowed)</b> for drones.</>],
            ['Drums', 'None, or very soft and distant: a shaker, a filtered kick heartbeat, a mallet.'],
            ['Structure', 'An arc: emerge, bloom, drift, fade. Instruments enter and leave one at a time.'],
          ]}
        />

        <h2>The drone: one note that never leaves</h2>
        <p>
          Hold a low note for the whole piece and change the chords above it. The held note is a <b>drone</b> or <b>pedal tone</b>. When a chord above it doesn’t contain that note, they rub gently, and that soft friction becomes colour rather than clash. It’s the oldest trick in music (bagpipes, Indian classical music, organ preludes) and the backbone of ambient.
        </p>
        <Example
          title="F Lydian: the floating lift from F to G over an F drone"
          bpm={60}
          loop
          chordsAbove="Fmaj7:8 G/F:8"
          parts={[
            { inst: 'dream-pad', label: 'Pad', notes: chords('Fmaj7:8 G:8', { center: 64, v: 0.5 }), fx: { reverb: 0.6 } },
            { inst: 'upright-bass-bowed', label: 'Drone', notes: line('F2:16', { v: 0.6 }), fx: { reverb: 0.4 } },
            { inst: 'bells', label: 'Bells', notes: line('r:2 C6:1 A5:2 r:3 | r:1 B5:1 D6:3 r:3', { v: 0.45 }), fx: { reverb: 0.6, delay: 0.45 } },
          ]}
          caption="The G major chord over an F bass is the signature of the Lydian mode: bright, weightless, slightly unreal. The bells use only a few notes, echoed by delay."
        />
        <Why>
          Lydian is the major scale with a raised 4th (B instead of B♭ in F). That one note removes the major scale’s pull back to home, because the half step that usually leads there disappears. The music feels like it is hovering rather than going somewhere. Composers use it for wonder and flight (think of the <em>E.T.</em> and <em>How to Train Your Dragon</em> scores).
        </Why>

        <h2>Reverb and delay are part of the composition</h2>
        <p>
          In ambient music the space around a note matters as much as the note. A single piano note with a long reverb is a <b>cloud</b>; with an echo it becomes a little rhythm of its own. Write fewer notes than feels comfortable and let the effects fill the silence.
        </p>
        <Compare
          items={[
            {
              label: 'Dry',
              title: 'Felt piano, no effects',
              bpm: 66,
              parts: [{ inst: 'felt-piano', label: 'Felt piano', notes: line('A4:1 E5:1 r:2 | D5:1 C#5:3 | A4:1 E5:1 B5:2 | A5:4', { v: 0.55 }) }],
              caption: 'Pretty, but small and exposed.',
            },
            {
              label: 'In a space',
              verdict: 'better',
              title: 'Same notes, long reverb and an echo',
              bpm: 66,
              parts: [{ inst: 'felt-piano', label: 'Felt piano', notes: line('A4:1 E5:1 r:2 | D5:1 C#5:3 | A4:1 E5:1 B5:2 | A5:4', { v: 0.55 }), fx: { reverb: 0.75, delay: 0.4 } }],
              caption: 'The echoes answer the notes, and the reverb tail connects one phrase to the next.',
            },
          ]}
        />
        <Tip>
          BandForge’s echo is timed to the song tempo (choose the division, such as 1/8 dotted, on the master strip in the <Ui>Mixer</Ui>), so the repeats fall into a gentle rhythm. Write your motif so the echoes fill its rests: a note, a rest, a note, a longer rest.
        </Tip>

        <h2>Slow change: the arc over minutes</h2>
        <p>
          Without a beat or a chorus, the shape of an ambient piece comes from <b>layers entering and leaving</b> and from slow swells in volume. Plan it like a sunrise: one element, then another, a fullest point around two-thirds of the way, then a long thinning out.
        </p>
        <SectionMap
          sections={[
            { name: 'Emerge', bars: 16, energy: 1, note: 'drone alone, fading in' },
            { name: 'Bloom', bars: 24, energy: 2.5, note: 'pad + first motif' },
            { name: 'Glow', bars: 24, energy: 3.5, note: 'strings, choir, bells' },
            { name: 'Drift', bars: 16, energy: 2, note: 'motif leaves, chords stay' },
            { name: 'Fade', bars: 16, energy: 0.8, note: 'drone again, fading out' },
          ]}
          caption="At 60 BPM, 96 bars is about six and a half minutes. Each change is small; together they make a journey."
        />
        <Example
          title="Layers entering one at a time"
          bpm={70}
          chordsAbove="Dsus2:8 Bbmaj7:8"
          parts={[
            { inst: 'warm-pad', label: 'Pad (from bar 1)', notes: chords('Dsus2:8 Bbmaj7:8', { center: 60, v: 0.45 }), fx: { reverb: 0.55 } },
            { inst: 'string-ensemble', label: 'Strings (bar 3)', notes: line('r:8 A4:4 F4:4', { v: 0.45 }), fx: { reverb: 0.5 } },
            { inst: 'celesta', label: 'Celesta (bar 2)', notes: line('r:4 D6:1 A5:1 r:2 | r:4 F5:1 D6:1 C6:2', { v: 0.4 }), fx: { reverb: 0.6, delay: 0.35 } },
          ]}
          caption="Dsus2 has no 3rd, so it is neither major nor minor; B♭maj7 then gives it a soft, melancholy colour. Mute each part to hear how little each one does on its own."
        />
        <Watch>
          Ambient is not “a pad held for five minutes”. Without evolution it becomes wallpaper in the bad sense. Every 8–16 bars something should change: a new voice, a register shift, a chord, a swell, or a thinning-out.
        </Watch>
        <Try>
          <Steps>
            <li>
              In <Ui>Song Settings</Ui>, set about 60 BPM and pick a mode in the scale list (<b>Lydian</b> or <b>Dorian</b>).
            </li>
            <li>
              Make a <b>Dream Pad</b> track with chords of 8 bars each, and a drone track (<b>Upright Bass (Bowed)</b> or a low pad) holding the tonic throughout.
            </li>
            <li>
              In <Ui>Smart Controls</Ui> (<K>B</K>), turn up <Ui>Reverb</Ui> on the pad and bells and add <Ui>Echo / Delay</Ui> to the motif. A touch of <Ui>Filter</Ui> on the pad makes it feel distant.
            </li>
            <li>
              Shape the arc with volume automation: click the <Ui>A</Ui> button on each track header and draw slow fades in and out over 8–16 bars.
            </li>
          </Steps>
        </Try>
        <Pro>
          Listen to Brian Eno’s <em>Music for Airports</em>, Stars of the Lid, Hiroshi Yoshimura and Jóhann Jóhannsson. Eno built pieces from short phrases of <em>different lengths</em> that repeat independently, so they line up differently each time and the music never quite repeats. You can do this by hand: write a 5-bar bell phrase over 8-bar chords and copy both out across the song.
        </Pro>
      </>
    ),
  },

  // ================================================================== video game & chiptune
  {
    id: 'game-chiptune',
    title: 'Video game and chiptune',
    minutes: 10,
    summary: 'Square-wave leads, lightning arpeggios, pulse bass and melodies that survive hearing them a hundred times. How classic game composers worked within limits, and how to write music that repeats seamlessly.',
    keywords: 'video game music chiptune 8 bit nes gameboy square wave pulse arpeggio triangle bass noise drums motif seamless repeat level theme boss battle mixolydian lydian dorian orchestral game score',
    body: () => (
      <>
        <Lead>
          Early game composers had three or four notes at a time, tiny memory and a player who would hear the same tune for hours. Out of those limits came some of the most memorable melodies ever written. The lessons still apply: a <b>strong motif</b>, <b>clear roles</b> for each voice, and music that can repeat forever without wearing thin.
        </Lead>
        <Spec
          title="The recipe"
          rows={[
            ['Tempo', 'Overworld and action themes 120–160 BPM, town and menu themes 80–110, boss fights 150–180.'],
            ['Keys', <>Bright modes for adventure: <b>Mixolydian</b> (major with a flat 7th) for heroic, <b>Lydian</b> for wonder, <b>Dorian</b> for cool, determined minor. Harmonic minor for bosses.</>],
            ['Chords', 'Often implied by fast arpeggios rather than played. ♭VII and ♭VI chords borrowed from minor (C – B♭ – A♭ – C) give the classic heroic lift.'],
            ['Sounds in BandForge', <><b>Square Lead</b> and <b>Chiptune</b> for pulse-wave melody and arps, <b>Analog Bass</b> for the bass channel, <b>FM Kit</b>, <b>Vintage CR-78</b> or <b>Hip Hop 808</b> for noise-style drums. For orchestral game scores: strings, brass, <b>Choir</b>.</>],
            ['Drums', 'Simple and punchy: kick and snare on a rock or march pattern, short noisy hats. Often just two sounds.'],
            ['Structure', 'An A section and a B section (8 or 16 bars each) that repeat. The end leads straight back to the start.'],
          ]}
        />

        <h2>The four-voice band</h2>
        <p>
          The NES had two pulse (square) wave voices, a triangle wave and a noise channel. Composers like Koji Kondo (<em>Super Mario Bros.</em>, <em>Zelda</em>) and Nobuo Uematsu (<em>Final Fantasy</em>) gave each one a job: <b>melody</b>, <b>harmony or arpeggio</b>, <b>bass</b>, <b>drums</b>. Writing within that limit is a brilliant exercise in clarity, even if you later use a full orchestra.
        </p>
        <Example
          title="Four voices: lead, arpeggio, pulse bass, noise drums"
          bpm={150}
          loop
          chordsAbove="C Bb F C"
          parts={[
            { inst: 'square-lead', label: 'Lead (pulse 1)', notes: line('C5:1 E5:1/2 G5 A5:1 G5:1 | F5:1/2 D5 Bb4 D5 F5:2 | F5:1 A5:1/2 C6 Bb5:1 A5:1 | G5:1/2 F5 E5 D5 C5:2', { v: 0.7 }) },
            { inst: 'chiptune', label: 'Arpeggio (pulse 2)', notes: [...arp('C4 E4 G4', 4, 0, 0.25), ...arp('Bb3 D4 F4', 4, 4, 0.25), ...arp('A3 C4 F4', 4, 8, 0.25), ...arp('C4 E4 G4', 4, 12, 0.25)], vol: 0.55 },
            { inst: 'synth-bass', label: 'Bass (triangle)', notes: line('C2:1/2 C3 C2 C3 C2 C3 C2 C3 | Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 | F2 F3 F2 F3 F2 F3 F2 F3 | C2 C3 C2 C3 G1 G2 B1 B2') },
            { inst: 'kit-fm', label: 'Drums (noise)', notes: drums({ k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 4 }), vol: 0.8 },
          ]}
          caption="The C – B♭ – F – C progression is Mixolydian: the B♭ chord (♭VII) gives that bright, heroic, slightly rock lift. The arpeggio plays every chord as fast broken notes because the hardware couldn’t play a chord at once."
        />
        <Why>
          A fast arpeggio fools the ear: cycle through C, E and G quickly enough and you hear a C chord with a shimmering, buzzy energy. It became a signature sound in its own right, which is why chiptune artists still use arps even when they could play full chords.
        </Why>

        <h2>The motif: short enough to hum, strong enough to repeat</h2>
        <p>
          Game themes are built from <b>motifs</b> of four to eight notes with a distinctive rhythm. The player hears it in the title screen, the overworld, the victory jingle, slowed down for a sad scene, in minor for the villain. One idea, many costumes.
        </p>
        <Compare
          items={[
            {
              label: 'The motif',
              title: 'Heroic version, major',
              bpm: 140,
              names: true,
              parts: [
                { inst: 'square-lead', label: 'Lead', notes: line('G4:1/2 C5 E5:1 D5:1/2 C5 G5:2 | r:4') },
                { inst: 'synth-bass', label: 'Bass', notes: line('C2:1/2 C3 C2 C3 C2 C3 C2 C3') },
              ],
            },
            {
              label: 'Same motif, villain',
              title: 'Minor, slower, lower',
              bpm: 90,
              names: true,
              parts: [
                { inst: 'brass-section', label: 'Low brass', notes: line('G3:1/2 C4 Eb4:1 D4:1/2 C4 Ab4:2 | G4:4') },
                { inst: 'string-ensemble', label: 'Strings', notes: line('C3+G3:4 | B2+F3:4', { v: 0.55 }) },
              ],
              caption: 'Same rhythm and shape. The major 3rd becomes minor, the leap lands on the dark flat 6th (A♭), and the harmony underneath turns tense.',
            },
          ]}
        />

        <h2>Writing music that repeats seamlessly</h2>
        <p>
          Level music plays while the player explores, so it repeats many times. The craft is making the <b>end flow back into the beginning</b> so nobody notices the seam, and making the repetition pleasant rather than grating.
        </p>
        <Cards
          items={[
            { title: 'End on the V chord', body: 'Finish the last bar on the dominant (G in C) so the music wants to go back to bar 1. A big final cadence on the tonic sounds like the end of the song.' },
            { title: 'Lead-in notes', body: 'The last beat of the melody should lead into the first note, a step away, like a pickup.' },
            { title: 'A and B sections', body: 'An 8-bar A and a contrasting 8-bar B (different register or chords) gives 16 bars before anything repeats exactly. Many classics are A-A-B-A.' },
            { title: 'Mind the tails', body: 'Long reverb or held notes at the end will be cut when bar 1 restarts. Keep the final bar’s notes short or matching the start.' },
          ]}
        />
        <Example
          title="The last two bars turn back to the top"
          bpm={150}
          loop
          chordsAbove="F G C G"
          mark={[[12, 16, 'turnaround']]}
          parts={[
            { inst: 'square-lead', label: 'Lead', notes: line('A5:1 G5 F5 E5 | D5:1/2 E5 F5 G5 A5:2 | G5:1 E5:1/2 C5 E5:1 G5:1 | F5:1/2 E5 D5 C5 B4:1 D5:1/2 F5') },
            { inst: 'synth-bass', label: 'Bass', notes: line('F2:1/2 F3 F2 F3 F2 F3 F2 F3 | G2 G3 G2 G3 G2 G3 G2 G3 | C2 C3 C2 C3 C2 C3 C2 C3 | G1 G2 G1 G2 B1 B2 D2 D3') },
            { inst: 'kit-fm', label: 'Drums', notes: drums({ k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 3 }).concat(drums({ k: 'x.......', s: '....x.x.xxxxxxxx' }, { at: 12, step: 0.25 })), vol: 0.8 },
          ]}
          caption="The final G chord, the bass walking up B–D and the snare fill all point forward. Play it on repeat: the restart feels like the next phrase, not a reset."
        />
        <Watch>
          Game music written for a short demo often has a 4-bar idea that repeats every 8 seconds. In a game, that becomes torture by minute three. Aim for at least 16 bars, ideally 32, of non-identical music before the repeat, and keep the most piercing sounds (high square leads) for the melody’s best moments.
        </Watch>
        <Listen>
          Listen to <em>Mega Man 2</em> (Takashi Tateishi), <em>Super Mario Bros.</em> and <em>Zelda</em> (Koji Kondo), <em>Undertale</em> (Toby Fox) and <em>Celeste</em> (Lena Raine). Notice how the bass is often as melodic as the lead, and how every theme can be sung after one listen.
        </Listen>
        <Try>
          <Steps>
            <li>
              Make four tracks: <b>Square Lead</b> (melody), <b>Chiptune</b> (arpeggios), <b>Analog Bass</b> (bass), and a <Ui>Drums</Ui> track with the <b>FM Kit</b>. Set 140–150 BPM in <Ui>Song Settings</Ui> and pick <b>Mixolydian</b> for a heroic flavour.
            </li>
            <li>
              Write arpeggios in the <Ui>Piano Roll</Ui> at a 1/16 or 1/32 grid: the three chord notes over and over. Draw one bar, then duplicate it (<K>⌘</K>/<K>Ctrl</K>+<K>D</K>) and move it for the next chord.
            </li>
            <li>
              Write an 8-bar A section and an 8-bar B section, then turn on the cycle (<K>C</K>) across the whole song to check that the last bar flows back to the first.
            </li>
            <li>Write a second version of your motif for a “boss” section: copy it, lower its 3rd and 6th by a half step (select the notes and press <K>↓</K>), and slow it down or move it an octave lower.</li>
          </Steps>
        </Try>
        <Pro>
          Modern game scores are often fully orchestral (see the film-music lesson in this chapter) but the chiptune lessons carry over: Kondo-style clarity of roles, motifs that transform for each situation, and layers that can be added or removed as the action changes. Many composers write each layer so it works alone, so the game can bring in the drums when a fight starts.
        </Pro>
      </>
    ),
  },
];

export default lessons;
