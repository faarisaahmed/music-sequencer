import { KeyRound } from 'lucide-react';
import type { Chapter } from '../types';
import { Cards, ChordsInKey, CircleOfFifths, Compare, Example, K, Keys, Lead, Listen, PlayChip as P, Pro, ProgressionPad, RangeChart, Spec, Steps, Tip, Try, Ui, Watch, Why } from '../figures';
import { at, bass, chords, drums, line, transpose, type Part } from '../notation';

// ------------------------------------------------------------------ examples

/** A short tune in C, with an ending that either goes home or stops short. */
const TUNE_START = 'G4:1 E4 F4 D4 | E4:1 C4 D4:2 | A4:1 G4 F4 A4 | ';
const HOME = 'G4:1 F4:0.5 D4:0.5 C4:2';
const AWAY = 'G4:1 F4:0.5 E4:0.5 D4:2';

/** Mode vamps, all on C so the one changed note is easy to hear. */
const MODES: { id: string; title: string; prog: string; tune: string; lead: string; pad: string; caption: string }[] = [
  {
    id: 'dorian',
    title: 'C Dorian: minor with a bright 6th (A♮)',
    prog: 'Cm7 F Cm7 F',
    tune: 'G4:1 A4 Bb4 A4 | G4:2 F4:1 Eb4:1 | D4:1 Eb4 F4 A4 | G4:4',
    lead: 'flute',
    pad: 'electric-piano',
    caption: 'The F major chord contains A natural, the note that makes Dorian different from ordinary minor. Listen to the A on beat 2 of the first bar: minor, but hopeful.',
  },
  {
    id: 'mixolydian',
    title: 'C Mixolydian: major with a flat 7th (B♭)',
    prog: 'C Bb F C',
    tune: 'E4:1 G4 Bb4:2 | D5:1 C5 Bb4:2 | A4:1 G4 F4 A4 | G4:1 E4 C4:2',
    lead: 'electric-guitar',
    pad: 'rock-organ',
    caption: 'B♭ instead of B: still major, but relaxed and bluesy instead of shiny. The B♭ chord (♭VII) is the giveaway.',
  },
  {
    id: 'lydian',
    title: 'C Lydian: major with a raised 4th (F♯)',
    prog: 'C D/C C D/C',
    tune: 'E4:1 F#4 G4:2 | A4:1 F#4 D4:2 | E4:1 F#4 G4 B4 | A4:1 F#4 E4:2',
    lead: 'flute',
    pad: 'warm-pad',
    caption: 'F♯ floats where F would normally sit. The D chord over a held C in the bass is the classic Lydian vamp: dreamy, weightless, a little magical.',
  },
  {
    id: 'phrygian',
    title: 'C Phrygian: minor with a flat 2nd (D♭)',
    prog: 'Cm Db Cm Db',
    tune: 'C5:1 Db5 C5:2 | F4:1 Ab4 Db5:2 | G4:1 Ab4:0.5 G4:0.5 Eb4:2 | Eb4:1 Db4 F4:2',
    lead: 'nylon-guitar',
    pad: 'string-ensemble',
    caption: 'D♭ sits just a half step above home, so the music keeps leaning on the tonic. Dark, Spanish, menacing.',
  },
  {
    id: 'aeolian',
    title: 'C Aeolian (natural minor): the flat 6th (A♭)',
    prog: 'Cm Ab Bb Cm',
    tune: 'Eb4:1 G4 C5:2 | C5:1 Bb4 Ab4:2 | F4:1 G4 Bb4:2 | G4:1 F4 Eb4 D4:0.5 C4:0.5',
    lead: 'analog-lead',
    pad: 'warm-pad',
    caption: 'The A♭ (and the A♭ major chord, ♭VI) gives natural minor its weight. Compared with Dorian, this is sadder and more serious.',
  },
  {
    id: 'harmonic',
    title: 'C harmonic minor: the raised 7th (B♮)',
    prog: 'Cm Fm G7 Cm',
    tune: 'G4:1 Eb4 C4:2 | Ab4:1 G4 F4:2 | D4:1 F4 Ab4 B4 | C5:4',
    lead: 'clarinet',
    pad: 'string-ensemble',
    caption: 'B natural turns the V chord into G major (G7), which pulls hard back to C minor. The jump from A♭ up to B in bar 3 is the exotic gap that gives this scale its "ancient" flavour.',
  },
];

function modeParts(m: (typeof MODES)[number]): Part[] {
  return [
    { inst: m.lead, label: 'Melody', notes: line(m.tune), fx: { reverb: 0.25 } },
    { inst: m.pad, label: 'Chords', notes: chords(m.prog, { center: 56 }), vol: 0.65 },
    { inst: 'electric-bass', label: 'Bass', notes: bass(m.prog), vol: 0.8 },
  ];
}

/** A four-bar chorus in C used by the key-change examples. */
const CHORUS_TUNE = 'E4:1 G4 C5 B4 | B4:1 A4:0.5 G4:2.5 | C5:1 E5 D5 C5 | A4:1.5 G4:0.5 A4:2';

const chapter: Chapter = {
  id: 'keys',
  title: 'Choosing a Key',
  blurb: 'What a key really changes, picking one for voices and instruments, and changing key mid-song.',
  icon: KeyRound,
  color: '#5b9be0',
  lessons: [
    // ------------------------------------------------------------------ 1
    {
      id: 'what-a-key-is',
      title: 'What a key really is',
      minutes: 9,
      summary: 'A key is a home note plus a palette of seven notes that orbit it. Learn to hear "home", read key signatures, and use the circle of fifths to see which keys and chords belong together.',
      keywords: 'key tonic home scale palette key signature sharps flats circle of fifths relative minor accidental degree leading note',
      body: () => (
        <>
          <Lead>
            When someone says a song is &ldquo;in G&rdquo;, they mean two things: the note <b>G</b> feels like home, and the song mostly uses a particular set of seven notes that make G feel that way. That home note is the <b>tonic</b>, and the set of notes is the <b>scale</b>. Together they are the key.
          </Lead>

          <h2>Home is something you hear</h2>
          <p>You don't need theory to recognise the tonic. Listen to the same tune with two different last notes:</p>
          <Compare
            items={[
              {
                label: 'Ends at home',
                verdict: 'better',
                title: 'Last note: C',
                names: true,
                bpm: 92,
                chordsAbove: 'C Am F:2 G:2 C',
                parts: [
                  { inst: 'grand-piano', label: 'Melody', notes: line(TUNE_START + HOME) },
                  { inst: 'warm-pad', label: 'Chords', notes: chords('C Am F:2 G:2 C', { center: 52 }), vol: 0.6 },
                ],
                caption: 'Finished. You could stop the music here.',
              },
              {
                label: 'Stops short',
                verdict: 'worse',
                title: 'Last note: D',
                names: true,
                bpm: 92,
                chordsAbove: 'C Am F:2 G:2 G',
                parts: [
                  { inst: 'grand-piano', label: 'Melody', notes: line(TUNE_START + AWAY) },
                  { inst: 'warm-pad', label: 'Chords', notes: chords('C Am F:2 G:2 G', { center: 52 }), vol: 0.6 },
                ],
                caption: 'Your ear waits for something more. That waiting is the pull of the tonic.',
              },
            ]}
          />
          <p>
            That pull is the whole point of a key. It gives your music a sense of <b>direction</b>: phrases can wander away from home, build tension, and come back. Without a clear home, music feels like it is floating (which is sometimes exactly what you want, but should be a choice).
          </p>

          <h2>The scale: seven notes out of twelve</h2>
          <p>
            Of the twelve notes on the keyboard, a major or minor key uses seven. In C major they are the white keys. Each note gets a number, its <b>scale degree</b>, counted up from the tonic:
          </p>
          <Keys from="C4" to="C5" marks={{ C4: '1', D4: '2', E4: '3', F4: '4', G4: '5', A4: '6', B4: '7', C5: '1' }} caption="C major: the seven notes numbered from home. Press One by one to hear the scale. The five black keys are outside this key." />
          <p>Each degree has a personality, and the same degree behaves the same way in every key:</p>
          <Spec
            rows={[
              [<P key="r1" notes="C4">1 · tonic</P>, 'Home. Ending a melody here sounds final. Starting here sounds grounded.'],
              [<P key="r2" notes="C4 E4">3 · mediant</P>, 'Decides major or minor. A melody that lands on the 3rd sounds warm and settled, but less final than the 1.'],
              [<P key="r3" notes="C4 G4">5 · dominant</P>, 'The second strongest note. Stable, but it points back towards 1. Bass lines live on 1 and 5.'],
              [<P key="r4" notes="B3 C4" mode="apart">7 → 1 · leading note</P>, 'Only a half step below home, so it pulls upward hard. Hold a B over a G chord and your ear begs for C.'],
              [<P key="r5" notes="F4 E4" mode="apart">4 → 3</P>, 'The other half step in the scale. The 4th tends to sink down onto the 3rd, which is why a melody that leans on the 4th sounds yearning.'],
            ]}
          />
          <Why>
            A major scale is not evenly spaced. It has two half steps (3–4 and 7–1) among whole steps, and those two tight spots are what create gravity: the notes right next to home and the 3rd lean onto them. Shift the pattern so the half steps fall in different places and you get a different mood, which is what the <b>Major, minor and the modes</b> lesson is about.
          </Why>

          <h2>Key signatures: the key, written down</h2>
          <p>
            In every key except C major and A minor, some of the seven notes are black keys. Rather than write a ♯ or ♭ on every one of them, sheet music lists them once at the start of each line: the <b>key signature</b>. G major has one sharp (F♯), D major has two (F♯, C♯), F major has one flat (B♭), and so on.
          </p>
          <p>
            Those keys are not random. Each step clockwise around the <b>circle of fifths</b> moves the tonic up five notes and adds one sharp; each step anticlockwise adds one flat. Click around it:
          </p>
          <CircleOfFifths caption="Outer ring: major keys. Inner ring: their relative minors, which share the same notes. Neighbours share six of their seven notes, so they are the easiest keys to move between." />
          <Listen>
            Click <b>C</b>, then <b>A minor</b> on the inner ring. Same seven notes, but a different note feels like home, so the mood flips. Every major key has a <b>relative minor</b> three half steps below it that shares its key signature. Songs move between the two all the time; it is the cheapest emotional shift in music.
          </Listen>

          <h2>What &ldquo;in a key&rdquo; does and doesn't mean</h2>
          <p>
            Being in a key doesn't forbid the other five notes. It means most of the music uses the scale, so the outside notes stand out. Used on purpose, an outside note is a spotlight: hear how one borrowed note turns an ordinary progression into something with a lump in its throat.
          </p>
          <Compare
            items={[
              { label: 'All in the key', title: 'C – Am – F – C', bpm: 80, chordsAbove: 'C Am F C', parts: [{ inst: 'grand-piano', label: 'Piano', notes: chords('C Am F C', { withRoot: true }) }] },
              {
                label: 'One outside note',
                verdict: 'better',
                title: 'C – E – F – Fm – C',
                bpm: 80,
                chordsAbove: 'C E F:2 Fm:2 C',
                parts: [{ inst: 'grand-piano', label: 'Piano', notes: chords('C E F:2 Fm:2 C', { withRoot: true }) }],
                caption: 'G♯ in the E chord and A♭ in the F minor chord are both outside C major. They make the progression ache, and C still feels like home.',
              },
            ]}
          />
          <p>Here are the seven chords that come from G major's own notes. Click them: they all sound like they belong together, which is the practical meaning of a key.</p>
          <ChordsInKey tonic="G" caption="Green chords feel like home, blue ones lead away, amber ones create tension that wants to resolve. The Chord Progressions chapter is built on these three jobs." />

          <Try>
            <Steps>
              <li>
                Click <b>KEY</b> in the display at the top of the studio. Pick the tonic from the grid and the scale below it (<Ui>Major</Ui>, <Ui>Minor</Ui>, the modes, pentatonics and blues).
              </li>
              <li>
                Open an instrument region in the <Ui>Piano Roll</Ui> and turn on the scale button in its toolbar. Notes in the key are highlighted, and notes you draw or drag snap into the key. Turn it off when you want an outside note on purpose.
              </li>
              <li>
                Switch to the <Ui>Score</Ui> and you will see the key signature at the start of every line, worked out for you. In the Score, <K>↑</K> and <K>↓</K> move a note to the next note <em>in the key</em>, and <K>⇧</K>+<K>↑</K>/<K>↓</K> add a sharp or flat.
              </li>
            </Steps>
          </Try>
          <Watch>
            Picking a key and then never leaving the white keys of the piano roll (or the highlighted rows) is safe, but after a while every idea sounds alike. Once a section works, try changing one chord to its outside version (major to minor, or the reverse). It is the quickest way to add colour without losing your way home.
          </Watch>
          <Pro>
            Professional writers rarely choose a key for its &ldquo;mood&rdquo;. Every major key has the same internal pattern, so C major and E♭ major feel the same once you've heard a few bars. They choose keys for practical reasons: the singer's range, what is easy to play on the instruments involved, and where the important notes sit. That is the next lesson.
          </Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ 2
    {
      id: 'picking-a-key',
      title: 'Picking a key for voices and instruments',
      minutes: 10,
      summary: 'The real reasons to choose one key over another: fitting the singer, suiting the instruments, and putting your parts in the register where they sound best. Plus how to change your mind later.',
      keywords: 'vocal range singer soprano alto tenor baritone bass guitar keys capo brass saxophone transposing instrument strings register transpose',
      body: () => (
        <>
          <Lead>
            All major keys sound alike once your ear settles in, so the &ldquo;right&rdquo; key is mostly about <b>where the notes land</b>. Put the melody where the singer shines and the instruments where they ring, and the same song suddenly sounds professional.
          </Lead>

          <h2>Reason one: the singer</h2>
          <p>
            If your song has vocals, the singer's range decides the key, every time. A melody that is a whole step too low sounds mumbled and flat; a whole step too high and the singer strains or has to back off. Here are typical comfortable ranges (trained singers can go further, but write for comfort):
          </p>
          <RangeChart
            rows={[
              { label: 'Soprano', lo: 'C4', hi: 'A5', color: '#e06a8f' },
              { label: 'Alto / mezzo', lo: 'F3', hi: 'D5', color: '#a07ae0' },
              { label: 'Tenor', lo: 'C3', hi: 'A4', color: '#5b9be0' },
              { label: 'Baritone', lo: 'A2', hi: 'F4', color: '#45b8c4' },
              { label: 'Bass', lo: 'E2', hi: 'E4', color: '#5dbb7a' },
            ]}
            sweet
            caption="Comfortable ranges for each voice type. The dot marks middle C (C4). Most pop melodies span only about an octave and a half, so they fit comfortably inside one row."
          />
          <p>To pick a key for a singer:</p>
          <Steps>
            <li>
              Find the <b>highest</b> and <b>lowest</b> notes of your melody. The highest note is the important one: it is usually the emotional peak of the chorus.
            </li>
            <li>
              Ask the singer (or yourself) to sing that peak phrase. If it is strained, move the whole song down; if it sounds weak and breathy, move it up. Go a half step at a time.
            </li>
            <li>
              Check the lowest note still speaks clearly. If the melody spans too much for any key to work, the melody needs rewriting, not the key.
            </li>
          </Steps>
          <Tip>
            Pop melodies often put the chorus peak right at the top of the singer's <em>strong</em> range, the point where it takes real effort but still sounds full. That slight strain reads as passion. Verses usually sit four or five notes lower so the chorus has somewhere to go.
          </Tip>

          <h2>Reason two: the instruments</h2>
          <p>
            Instruments have keys they love. On a guitar, open strings ring out and chords are easy in some keys and awkward in others. Brass players read music that is already transposed, so &ldquo;easy&rdquo; keys for them look like flat keys to everyone else. This matters even in BandForge, because <em>sounding like</em> a real guitar or horn section partly means writing what those players would naturally play.
          </p>
          <Spec
            title="Instrument-friendly keys"
            rows={[
              ['Guitar', 'E, A, D, G, C and their relative minors (Em, Am, Dm). These use open strings, so chords ring and riffs are easy. Guitarists use a capo to reach other keys with the same shapes.'],
              ['Bass guitar', 'E, A, D, G: the open strings. A low E (E1) is the lowest note on a standard bass, so songs in E and F can have huge low roots.'],
              ['Brass & saxophone', 'B♭, E♭, F, A♭ and C minor-family keys. Trumpets, clarinets and tenor saxes are built in B♭; alto sax and horn in E♭ and F. Flat keys sit naturally on them.'],
              ['Strings', 'D, G, A, C, E. Violin, viola and cello have open strings on G, D, A (and C), which ring sympathetically. Orchestral music is full of D major for this reason.'],
              ['Piano & synths', 'Anything. Interestingly, keys with many black notes (D♭, G♭, B) are comfortable for pianists’ hands; C major is easy to read, not to play.'],
            ]}
          />
          <RangeChart
            rows={[
              { label: 'Piano', lo: 'A0', hi: 'C8', color: '#5dbb7a' },
              { label: 'Electric bass', lo: 'E1', hi: 'G4', color: '#d99a3a' },
              { label: 'Guitar', lo: 'E2', hi: 'B5', color: '#e08a3c' },
              { label: 'Cello', lo: 'C2', hi: 'A5', color: '#a07ae0' },
              { label: 'Violin', lo: 'G3', hi: 'A6', color: '#e06a8f' },
              { label: 'Trumpet', lo: 'E3', hi: 'C6', color: '#e8a33d' },
              { label: 'Flute', lo: 'C4', hi: 'C7', color: '#45b8c4' },
            ]}
            caption="Practical (sounding) ranges. The top few notes of any instrument are hard to play and sound strained, so keep important lines well inside the bar."
          />

          <h2>Reason three: register, not key, sets the mood</h2>
          <p>
            You will hear people say E♭ is &ldquo;heroic&rdquo; or D minor is &ldquo;the saddest key&rdquo;. On modern equal-tempered instruments those differences are tiny. What you really hear is <b>register</b>: how high or low everything sits. Moving a song up a few steps makes everything brighter and more energetic; moving down makes it darker and heavier. Register also decides whether your chords sound clear or muddy:
          </p>
          <Compare
            items={[
              { label: 'Chords too low', verdict: 'worse', title: 'Voiced around C3', bpm: 84, chordsAbove: 'C Am F G', parts: [{ inst: 'grand-piano', label: 'Chords', notes: chords('C Am F G', { center: 47 }) }], caption: 'Close-together notes below about C3 blur into a growl.' },
              { label: 'Chords in the sweet spot', verdict: 'better', title: 'Voiced around C4', bpm: 84, chordsAbove: 'C Am F G', parts: [{ inst: 'grand-piano', label: 'Chords', notes: chords('C Am F G', { center: 62, withRoot: true }) }], caption: 'A single low root, chord notes up around middle C. Clear and full.' },
            ]}
          />
          <Why>
            Our ears separate notes poorly in the bass: two notes a 3rd apart at the bottom of the piano beat against each other and sound like mud. That's why bass parts use single notes or wide 5ths and octaves, and chords sit higher. If changing key pushes your chords or melody into the murky bottom (or the shrill top), move the part an octave rather than fighting the key.
          </Why>

          <h2>Changing your mind later</h2>
          <p>
            Don't agonise over the key before you start. Write in whatever is comfortable, then move the whole song once you know who will sing or play it. BandForge does this for you, chord track included.
          </p>
          <Try>
            <Steps>
              <li>
                Click <b>KEY</b> in the display at the top. Leave <Ui>Transpose existing notes to the new key</Ui> ticked and click the new tonic. Every instrument track and the chord track move with it, by the shortest route (never more than six half steps up or down). Drum tracks stay put, so the kit doesn't change sound.
              </li>
              <li>
                Untick that box when you only want to relabel the key (for example, you wrote in A minor but BandForge thinks it is C major) without moving any notes. The same options are in <Ui>Song Settings</Ui>.
              </li>
              <li>
                If a part ends up too low or high after the move, right-click its region and choose <Ui>Transpose</Ui> → <Ui>Up an Octave</Ui> or <Ui>Down an Octave</Ui>.
              </li>
              <li>
                Recorded audio doesn't change pitch when the key changes. Decide the key before recording vocals or guitar.
              </li>
            </Steps>
          </Try>
          <Watch>
            Picking a key because it is easy to <em>click</em> in (C major, all white keys) and then recording a singer whose voice wants A♭. If a vocal sounds weak, try the song two or three half steps up or down before you blame the performance. It is often the single biggest improvement you can make.
          </Watch>
          <Pro>
            Session singers often record demos in two or three keys to compare, and producers pick by ear, listening to the chorus peak. With BandForge you can do the same in seconds: save a version (<K>⌘</K>/<K>Ctrl</K>+<K>⌥</K>/<K>Alt</K>+<K>S</K>), change the key, listen, and use <Ui>Version History</Ui> to go back if the old key was better.
          </Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ 3
    {
      id: 'modes',
      title: 'Major, minor and the modes',
      minutes: 12,
      summary: 'There are more moods than happy and sad. Hear the one note that defines Dorian, Mixolydian, Lydian, Phrygian, natural minor and harmonic minor, and the songs that use each.',
      keywords: 'mode modes dorian mixolydian lydian phrygian aeolian locrian ionian harmonic minor natural minor scale mood characteristic note',
      body: () => (
        <>
          <Lead>
            Major and minor are just two of a family of scales called <b>modes</b>. Each mode changes one or two notes of the scale, and that single change gives it a whole new emotional colour. Once you can hear these, you have a much bigger palette than &ldquo;happy or sad&rdquo;.
          </Lead>
          <p>
            The trick to hearing modes is to keep the home note the same and listen for the <b>characteristic note</b>: the one note that differs from plain major or minor. All the examples below are on C, so you can compare them directly.
          </p>
          <Spec
            title="Brightest to darkest, all on C"
            rows={[
              [<P key="r6" melody="C4:0.5 D4 E4 F#4 G4 A4 B4 C5:1">Lydian</P>, 'Major with a raised 4th (F♯). Dreamy, floating, a sense of wonder.'],
              [<P key="r7" melody="C4:0.5 D4 E4 F4 G4 A4 B4 C5:1">Major (Ionian)</P>, 'The reference. Bright, settled, resolved.'],
              [<P key="r8" melody="C4:0.5 D4 E4 F4 G4 A4 Bb4 C5:1">Mixolydian</P>, 'Major with a flat 7th (B♭). Relaxed, bluesy, rock’n’roll.'],
              [<P key="r9" melody="C4:0.5 D4 Eb4 F4 G4 A4 Bb4 C5:1">Dorian</P>, 'Minor with a raised 6th (A♮). Cool, soulful, hopeful minor.'],
              [<P key="r10" melody="C4:0.5 D4 Eb4 F4 G4 Ab4 Bb4 C5:1">Minor (Aeolian)</P>, 'Natural minor. Sad, serious, epic.'],
              [<P key="r11" melody="C4:0.5 Db4 Eb4 F4 G4 Ab4 Bb4 C5:1">Phrygian</P>, 'Minor with a flat 2nd (D♭). Dark, tense, Spanish or menacing.'],
              [<P key="r12" melody="C4:0.5 D4 Eb4 F4 G4 Ab4 B4 C5:1">Harmonic minor</P>, 'Minor with a raised 7th (B♮). Dramatic, classical, a touch exotic.'],
            ]}
          />
          <Why>
            Each step down this list lowers one more note of the scale. More raised notes means brighter; more lowered notes means darker. That is why Lydian (one raised note) sits above major, and Phrygian (four lowered notes) sits near the bottom. The seventh mode, <b>Locrian</b>, lowers the 5th too, which destroys the sense of home, so it is used for brief, unsettled moments rather than whole songs.
          </Why>

          <h2>Dorian: the hopeful minor</h2>
          <Example {...{ title: MODES[0].title, bpm: 96, chordsAbove: MODES[0].prog, names: true, parts: modeParts(MODES[0]), caption: MODES[0].caption }} />
          <p>
            Dorian is all over funk, soul, jazz and folk because it has minor's depth without its gloom. Listen for it in &ldquo;Scarborough Fair&rdquo;, Santana's &ldquo;Oye Como Va&rdquo; and Daft Punk's &ldquo;Get Lucky&rdquo;. The giveaway in a progression is a <b>minor i chord moving to a major IV</b> (here Cm to F).
          </p>

          <h2>Mixolydian: major, but laid back</h2>
          <Example {...{ title: MODES[1].title, bpm: 104, chordsAbove: MODES[1].prog, names: true, parts: modeParts(MODES[1]), caption: MODES[1].caption }} />
          <p>
            The flat 7th removes the leading note's urgent pull up to home, so Mixolydian feels easygoing and earthy. Classic rock lives here: &ldquo;Sweet Home Alabama&rdquo; is built on a I–♭VII–IV loop (D–C–G), and so is the verse of &ldquo;Sweet Child o' Mine&rdquo;. The Beatles' &ldquo;Norwegian Wood&rdquo; is Mixolydian too.
          </p>

          <h2>Lydian: wonder and weightlessness</h2>
          <Example {...{ title: MODES[2].title, bpm: 84, chordsAbove: MODES[2].prog, names: true, parts: modeParts(MODES[2]), caption: MODES[2].caption }} />
          <p>
            Film composers reach for Lydian whenever something should feel magical or vast, and it is the sound of the theme from <i>The Simpsons</i>. Fleetwood Mac's &ldquo;Dreams&rdquo; floats on a two-chord Lydian-style vamp. The trick: a major chord built on the 2nd degree (D major in C), ideally over a held tonic in the bass.
          </p>

          <h2>Phrygian: dark and Spanish</h2>
          <Example {...{ title: MODES[3].title, bpm: 92, chordsAbove: MODES[3].prog, names: true, parts: modeParts(MODES[3]), caption: MODES[3].caption }} />
          <p>
            The half step from ♭2 down to 1 is the sound of flamenco guitar and of countless heavy metal riffs. Its close cousin, <b>Phrygian dominant</b> (Phrygian with a major 3rd), drives Dick Dale's &ldquo;Misirlou&rdquo;. Use it sparingly in pop; even a single ♭II chord before the tonic adds instant drama.
          </p>

          <h2>Natural minor: the serious one</h2>
          <Example {...{ title: MODES[4].title, bpm: 88, chordsAbove: MODES[4].prog, names: true, parts: modeParts(MODES[4]), caption: MODES[4].caption }} />
          <p>
            This is the &ldquo;minor key&rdquo; of most pop and rock. The i–♭VI–♭VII move (here Cm–A♭–B♭) is its signature, heard in &ldquo;All Along the Watchtower&rdquo; (descending i–♭VII–♭VI) and in endless film trailers and anthems. It feels epic rather than tragic because ♭VI and ♭VII are big, bright major chords inside a minor key.
          </p>

          <h2>Harmonic minor: drama and pull</h2>
          <Example {...{ title: MODES[5].title, bpm: 80, chordsAbove: MODES[5].prog, names: true, parts: modeParts(MODES[5]), caption: MODES[5].caption }} />
          <p>
            Classical composers raised the 7th of minor keys so the V chord could become major and pull home strongly. Most minor-key songs borrow that one chord even when everything else is natural minor: &ldquo;Hit the Road Jack&rdquo; walks down Am–G–F–E, and that final E major is pure harmonic minor.
          </p>

          <Keys
            from="C4"
            to="C5"
            marks={{ C4: '1', D4: '2', 'D#4': '♭3', F4: '4', G4: '5', A4: { label: '6', color: '#5dbb7a' }, 'A#4': '♭7', C5: '1' }}
            caption="C Dorian with its characteristic note (A natural) in green. Every other note matches C natural minor; that one key is the whole difference in mood."
          />

          <Cards
            items={[
              { title: 'Lydian', tag: 'raised 4', body: 'Film wonder, dream pop, “floating” bridges. Vamp: I – II (C – D).', color: '#45b8c4' },
              { title: 'Mixolydian', tag: 'flat 7', body: 'Classic rock, folk, jam bands, celebratory anthems. Vamp: I – ♭VII (C – B♭).', color: '#e8a33d' },
              { title: 'Dorian', tag: 'raised 6', body: 'Funk, soul, lo-fi, synthwave, Celtic folk. Vamp: i – IV (Cm – F).', color: '#5dbb7a' },
              { title: 'Aeolian', tag: 'flat 6', body: 'Rock ballads, epic pop, trailer music. Loop: i – ♭VI – ♭VII (Cm – A♭ – B♭).', color: '#5b9be0' },
              { title: 'Phrygian', tag: 'flat 2', body: 'Flamenco, metal, thriller cues. Move: ♭II – i (D♭ – Cm).', color: '#e05a4a' },
              { title: 'Harmonic minor', tag: 'raised 7', body: 'Classical, tango, villains, Middle-Eastern colour. Cadence: V – i (G – Cm).', color: '#a07ae0' },
            ]}
          />

          <Try>
            <Steps>
              <li>
                Click <b>KEY</b> in the display. Under the tonic grid, the scale picker has a <Ui>Modes</Ui> group (Dorian, Phrygian, Lydian, Mixolydian, Locrian) and <Ui>Minor variants</Ui> (Harmonic Minor, Melodic Minor).
              </li>
              <li>
                Choose a mode and untick <Ui>Transpose existing notes to the new key</Ui> if you only want the scale highlight to change.
              </li>
              <li>
                In the <Ui>Piano Roll</Ui>, turn on the scale button: now the highlighted rows and snapping follow the mode. Write a two-chord vamp from the cards above, loop it with <K>C</K>, and improvise over it on the keyboard, leaning on the characteristic note.
              </li>
            </Steps>
          </Try>
          <Watch>
            A mode only sounds like itself if the harmony supports it. Play C Dorian notes over chords that sound like E♭ major and your ear will hear E♭ major, not C Dorian. Keep the tonic chord frequent and make sure the characteristic note appears in the chords (that is why each vamp above includes it).
          </Watch>
          <Listen>
            Play the Dorian and natural minor examples back to back. The only difference is A versus A♭, yet one feels like a cool summer evening and the other like a rainy goodbye. That is how precise mode choice can be.
          </Listen>
          <Pro>
            Writers often switch mode for one section rather than a whole song: a minor verse that brightens to Dorian in the chorus, or a major song whose bridge borrows the ♭VII from Mixolydian. Those borrowed chords are covered in <b>Chord Progressions</b>.
          </Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ 4
    {
      id: 'key-changes',
      title: 'Changing key mid-song',
      minutes: 10,
      summary: 'Lift a final chorus, slide smoothly into a new key with a pivot chord, flip between relative major and minor, or jump somewhere new for a bridge. When each works, and when it sounds cheesy.',
      keywords: 'modulation key change truck driver lift pivot chord relative major minor bridge chromatic mediant final chorus transpose',
      body: () => (
        <>
          <Lead>
            A key change (a <b>modulation</b>) moves home somewhere new partway through a song. Done well it is one of the most powerful moments in music: the floor lifts and everything feels bigger. Done badly it is a cliché people laugh at. The difference is almost always <b>preparation</b>.
          </Lead>

          <h2>The final-chorus lift</h2>
          <p>
            The most famous key change takes the last chorus up a half or whole step. Beyoncé's &ldquo;Love on Top&rdquo; does it four times in a row; Whitney Houston's &ldquo;I Will Always Love You&rdquo; does it once, after a dramatic pause; Michael Jackson's &ldquo;Man in the Mirror&rdquo; lifts on the word &ldquo;change&rdquo;. Compare a lift with no preparation to one that is set up:
          </p>
          <Compare
            items={[
              {
                label: 'Just shifted up',
                verdict: 'worse',
                title: 'C chorus, then the same chorus a half step up',
                bpm: 104,
                chordsAbove: 'C G Am F C# G# A#m F#',
                parts: [
                  { inst: 'analog-lead', label: 'Melody', notes: [...line(CHORUS_TUNE), ...transpose(at(line(CHORUS_TUNE), 16), 1)], fx: { reverb: 0.2 } },
                  { inst: 'grand-piano', label: 'Chords', notes: chords('C G Am F C# G# A#m F#', { center: 58 }), vol: 0.7 },
                  { inst: 'kit-acoustic', label: 'Drums', notes: drums({ k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 8 }) },
                ],
                caption: 'The jump arrives out of nowhere. It works once, but it sounds like a gear change.',
              },
              {
                label: 'Set up',
                verdict: 'better',
                title: 'C chorus, a bar of A7, then the chorus in D',
                bpm: 104,
                chordsAbove: 'C G Am F A7 D A Bm G',
                parts: [
                  { inst: 'analog-lead', label: 'Melody', notes: [...line(CHORUS_TUNE), ...line('A4:1 C#5 E5 G5', { at: 16 }), ...transpose(at(line(CHORUS_TUNE), 20), 2)], fx: { reverb: 0.2 } },
                  { inst: 'grand-piano', label: 'Chords', notes: chords('C G Am F A7 D A Bm G', { center: 58 }), vol: 0.7 },
                  { inst: 'kit-acoustic', label: 'Drums', notes: [...drums({ k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 4 }), ...drums({ s: '....x.x.xxxxXXXX', k: 'x...............' }, { at: 16 }), ...drums({ k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', c: 'x...............' }, { at: 20, bars: 4 })] },
                ],
                caption: 'A7 is the V chord of the new key (D). One bar of it, plus a drum fill, tells the listener "something is coming", so the lift lands as a release instead of a surprise.',
              },
            ]}
          />
          <Why>
            The strongest way into any key is through its <b>V chord</b>, the chord built on its 5th note. V contains the new key's leading note (C♯ in A7, leading to D), and your ear has spent its whole life hearing V resolve to I. Play the new key's V just before you arrive and the listener's ear moves home <em>before</em> the chorus starts, which is why it feels earned.
          </Why>
          <Watch title="When the lift turns cheesy">
            <ul>
              <li>Nothing else changes: same arrangement, same energy, just higher. Add something (a new part, a bigger drum pattern, a harmony vocal) when you lift.</li>
              <li>It is used to rescue a song that has run out of ideas. A lift amplifies a great chorus; it can't fix a weak one.</li>
              <li>The melody ends up beyond the singer's range. A whole-step lift on a chorus that already peaks at the singer's limit is a recipe for strain.</li>
            </ul>
          </Watch>

          <h2>The pivot chord: a smooth glide</h2>
          <p>
            For a key change you barely notice, use a chord that belongs to <b>both</b> keys. Am is the vi chord in C major and the ii chord in G major, so it can &ldquo;pivot&rdquo; between them. Approach it as if you're in C, leave it as if you're in G:
          </p>
          <Example
            title="C major to G major through Am"
            bpm={92}
            chordsAbove="C F Am D7 G C D G"
            mark={[
              [8, 12, 'pivot'],
              [12, 32, 'now in G'],
            ]}
            parts={[
              { inst: 'flute', label: 'Melody', notes: line('E4:1 G4 C5:2 | A4:1 F4 C5:2 | C5:1 B4:0.5 A4:0.5 E4:2 | F#4:1 A4 C5 F#4 | G4:4 | E4:1 G4 C5 E5 | D5:1 C5 A4 F#4 | G4:4'), fx: { reverb: 0.25 } },
              { inst: 'string-ensemble', label: 'Strings', notes: chords('C F Am D7 G C D G', { center: 57 }), vol: 0.7 },
              { inst: 'electric-bass', label: 'Bass', notes: bass('C F Am D7 G C D G'), vol: 0.8 },
            ]}
            caption="Bars 1–2 are plainly C major. Am belongs to both keys; D7 (with its F♯) confirms G as the new home. Notice the melody picks up F♯ too."
          />
          <p>
            Classical music modulates this way constantly, usually to a neighbour on the circle of fifths (the dominant, here G, or the relative minor). Because neighbouring keys share six notes, the move feels like a change of light rather than a change of scene.
          </p>

          <h2>Relative major and minor: same notes, new home</h2>
          <p>
            Switching between a key and its relative (C major and A minor, say) uses no new notes at all. It is a favourite for contrasting a moody verse with an open, bright chorus. Many songs do it so naturally you never notice: the verse circles around Am, the chorus plants itself firmly on C.
          </p>
          <Example
            title="A minor verse, C major chorus"
            bpm={96}
            chordsAbove="Am Dm E Am C F G C"
            mark={[[16, 32, 'chorus: C major']]}
            parts={[
              { inst: 'nylon-guitar', label: 'Guitar', notes: chords('Am Dm E Am', { style: 'arp', center: 57 }) },
              { inst: 'grand-piano', label: 'Piano', notes: chords('C F G C', { at: 16, style: 'pulse', withRoot: true, center: 62 }), vol: 0.8 },
              { inst: 'flute', label: 'Melody', notes: [...line('A4:2 C5:1 B4:1 | A4:2 F4:2 | G#4:1 B4 D5 B4 | A4:4'), ...line('E5:1 D5 C5 G4 | A4:1 C5 F5:2 | D5:1 E5 F5 D5 | C5:4', { at: 16 })], fx: { reverb: 0.2 } },
            ]}
            caption="The verse uses E major (borrowed from harmonic minor) to make A minor feel like home. The chorus just stops visiting Am and lands on C: no new notes, completely new mood."
          />

          <h2>The direct jump: new scene</h2>
          <p>
            Sometimes you want the change to be <em>felt</em>: a bridge that drops into a far-away key and then finds its way back. The Beatles' &ldquo;Penny Lane&rdquo; steps down a whole tone between verse and chorus. Film music loves <b>chromatic mediants</b>, jumps between major chords a third apart (C to A♭, or C to E), which sound like a sudden change of scenery.
          </p>
          <Spec
            title="Where to go, and what it feels like"
            rows={[
              [<P key="r13" chords="C:2 C#:2">Up a half step</P>, 'The classic final-chorus lift. A jolt of energy; can sound cheap if unprepared.'],
              [<P key="r14" chords="C:2 A7:2 D:2">Up a whole step</P>, 'A natural, satisfying lift. Prepare it with the new key’s V (A7 into D).'],
              [<P key="r15" chords="C:2 Eb:2">Up a minor 3rd</P>, 'Dramatic, theatrical. Common in musicals and power ballads.'],
              [<P key="r16" chords="C:2 Bb:2">Down a whole step</P>, 'Softer, more intimate. Good for a quiet bridge before a big return.'],
              [<P key="r17" chords="C:2 Am:2">To the relative minor</P>, 'Same notes, darker mood. The most invisible change of all.'],
              [<P key="r18" chords="C:2 Ab:2">To a chromatic mediant</P>, 'Cinematic, magical, a change of scene. Return through a V chord.'],
            ]}
          />
          <p>Try building your own route between two keys. Pick chords from C major, then switch the pad to G major and keep going: the shared chords (C, Em, G, Am) are your pivots.</p>
          <ProgressionPad />

          <Try>
            <p>
              BandForge's song has one key setting, so a mid-song modulation is done by moving the notes themselves:
            </p>
            <Steps>
              <li>
                Put the playhead where the new key starts and press <K>⌘</K>/<K>Ctrl</K>+<K>T</K> to split the regions there, so the new section is in its own regions.
              </li>
              <li>
                Select the instrument regions after the split, but <b>not the drum regions</b> (transposing a drum region changes which drum each note plays). Right-click and choose <Ui>Transpose</Ui> → <Ui>Up a Semitone</Ui>. Do it twice for a whole step.
              </li>
              <li>
                Update the chords in the chord track for that section (right-click a chord and choose <Ui>Edit…</Ui>), so <Ui>Check</Ui> and the chord-aware tools know about the new key.
              </li>
              <li>
                The piano roll's scale highlight follows the song's single key, so in the modulated section either turn the scale button off or trust your ears.
              </li>
            </Steps>
          </Try>
          <Tip>
            Save a version before experimenting with a modulation (<K>⌘</K>/<K>Ctrl</K>+<K>⌥</K>/<K>Alt</K>+<K>S</K>). Then try a half step, a whole step and no change at all, and pick the one that serves the song, not the one that is most impressive.
          </Tip>
          <Pro>
            Arrangers often &ldquo;hide&rdquo; a lift by changing the arrangement at the same time: the band drops out for a bar, a drum fill or a sung pickup line crosses the gap, and everything comes back together in the new key. The listener feels a surge of energy without noticing the mechanics. Combine this lesson with <b>Instruments &amp; Arranging</b> to plan where the biggest moment of your song should be.
          </Pro>
        </>
      ),
    },
  ],
};

export default chapter;
