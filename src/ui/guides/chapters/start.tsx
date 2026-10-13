import { Compass } from 'lucide-react';
import type { Chapter } from '../types';
import { Cards, Compare, Example, K, Keys, Lead, Listen, PlayChip as P, Pro, ProgressionPad, SectionMap, Spec, Steps, Tip, Try, Ui, Watch, Why } from '../figures';
import { bass, chords, drums, line } from '../notation';

const ROCK = { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' };

/** Melody for the three-layer example (C G Am F). */
const LAYER_TUNE = 'E4:1 G4:1 C5:1.5 B4:0.5 | B4:1 A4:0.5 G4:2.5 | C5:1 E5:1 D5:1 C5:1 | A4:1.5 G4:0.5 A4:2';

/** The finished 8-bar sketch from "Your first song". */
const FIRST_PROG = 'C Am F G C Am F G';
const FIRST_TUNE = 'G4:1 E4:0.5 G4:0.5 C5:2 | A4:1 C5:1 E5:2 | C5:1 A4:1 F4:1 A4:1 | B4:1.5 A4:0.5 G4:2 | G4:1 E4:0.5 G4:0.5 C5:2 | A4:1 C5:1 E5:1.5 D5:0.5 | C5:1 A4:1 F4:0.5 G4:0.5 A4:1 | B4:1 D5:1 G4:2';

const chapter: Chapter = {
  id: 'start',
  title: 'Start Here',
  blurb: 'How music is put together, and your first song from blank page to finished idea.',
  icon: Compass,
  color: '#e8a33d',
  lessons: [
    // ------------------------------------------------------------------ 1
    {
      id: 'how-music-works',
      title: 'How music is built',
      minutes: 9,
      summary: 'Pitch, rhythm, beats, bars and tempo in plain words, how they map onto the piano roll, score and step grid, and the three layers that almost every song is made of.',
      keywords: 'beginner basics pitch rhythm beat bar measure tempo bpm meter time signature note length quarter eighth layers grid',
      body: () => (
        <>
          <Lead>
            Every piece of music you have ever heard is made of two things happening at once: <b>which notes</b> are playing (pitch) and <b>when</b> they play (rhythm). Everything else in this course, from chords to drum beats to mixing, is a way of organising those two.
          </Lead>

          <h2>Pitch: how high or low</h2>
          <p>
            Pitch is how high or low a sound is. On a piano, pitch goes up as you move right. There are only <b>twelve</b> different notes, and then the pattern repeats higher up: the next C sounds like the first one, just brighter. That repeat is called an <b>octave</b>, and it is why a man and a woman can sing &ldquo;the same&rdquo; tune even though she is singing much higher.
          </p>
          <Keys from="C3" to="C5" marks={{ C3: 'C', C4: 'C', C5: 'C' }} caption="Three Cs, an octave apart. Click them: same note name, same character, different height. Click any other key to hear the twelve steps in between." />
          <p>
            Notes are named with the letters A to G plus sharps (♯, a step higher) and flats (♭, a step lower) for the black keys. A number after the letter says which octave: <b>C4</b> is &ldquo;middle C&rdquo;, roughly the centre of a piano and of most voices. You don't need to memorise names to write music in BandForge, because you can see and hear every note, but they make conversations about music much easier.
          </p>

          <h2>Rhythm: when, and for how long</h2>
          <p>
            Rhythm is the pattern of <em>when</em> notes start and how long they last. It matters more than most beginners expect. Here are the same five notes with two different rhythms:
          </p>
          <Compare
            items={[
              { label: 'Even', title: 'Every note the same length', names: true, bpm: 96, parts: [{ inst: 'grand-piano', label: 'Piano', notes: line('C4:1 D4 E4 F4 G4:4') }] },
              {
                label: 'With a rhythm',
                verdict: 'better',
                title: 'Long, short, a pause, a push',
                names: true,
                bpm: 96,
                parts: [{ inst: 'grand-piano', label: 'Piano', notes: line('C4:1.5 D4:0.5 E4:1 r:0.5 F4:0.5 G4:4') }],
              },
            ]}
          />
          <p>
            The first sounds like a scale exercise. The second sounds like the start of a tune, and the only thing that changed is timing. When an idea of yours feels flat, try changing its rhythm before you change its notes.
          </p>

          <h2>The beat, the tempo and the bar</h2>
          <p>
            Under almost all music there is a steady pulse you could tap your foot to. That pulse is the <b>beat</b>. How fast the beats come is the <b>tempo</b>, measured in <b>BPM</b> (beats per minute). 60 BPM is one beat a second, like a slow clock. Most pop sits between 90 and 130.
          </p>
          <Compare
            items={[
              { label: '72 BPM', title: 'Laid back', bpm: 72, parts: [{ inst: 'kit-acoustic', label: 'Drums', notes: drums(ROCK, { bars: 2 }) }, { inst: 'electric-bass', label: 'Bass', notes: bass('C:4 F:4', { style: 'root5' }) }] },
              { label: '128 BPM', title: 'Driving', bpm: 128, parts: [{ inst: 'kit-acoustic', label: 'Drums', notes: drums(ROCK, { bars: 2 }) }, { inst: 'electric-bass', label: 'Bass', notes: bass('C:4 F:4', { style: 'root5' }) }] },
            ]}
          />
          <p>
            Beats are grouped into <b>bars</b> (also called measures). In most songs a bar is four beats long, and you can feel it because beat 1 is a little stronger, like a small &ldquo;and here we go again&rdquo;. The grouping is the <b>meter</b>, written as a <b>time signature</b>: 4/4 means four beats per bar, 3/4 means three, which gives you the lilting &ldquo;ONE two three&rdquo; of a waltz.
          </p>
          <Compare
            items={[
              { label: '4/4', title: 'ONE two three four', bpm: 100, length: 16, parts: [{ inst: 'kit-acoustic', label: 'Drums', notes: drums(ROCK, { bars: 4 }) }] },
              {
                label: '3/4',
                title: 'ONE two three',
                bpm: 132,
                meter: 3,
                length: 12,
                parts: [
                  { inst: 'kit-acoustic', label: 'Drums', notes: drums({ k: 'x...........', h: 'x...x...x...', s: '....x...x...' }, { bars: 4 }) },
                  { inst: 'grand-piano', label: 'Piano', notes: [...line('C3:3 G2:3 G2:3 C3:3'), ...line('r:1 E4+G4+C5:1 E4+G4+C5:1 r:1 F4+G4+B4:1 F4+G4+B4:1 r:1 F4+G4+B4:1 F4+G4+B4:1 r:1 E4+G4+C5:1 E4+G4+C5:1', { v: 0.6 })] },
                ],
              },
            ]}
          />
          <p>Note lengths are counted in beats. In 4/4, these are the ones you will use every day:</p>
          <Spec
            rows={[
              [<P key="r1" melody="C4:4">Whole note</P>, '4 beats: a whole bar of 4/4. Long held notes for pads and endings.'],
              [<P key="r2" melody="C4:2 C4:2">Half note</P>, '2 beats. Slow, singing melodies.'],
              [<P key="r3" melody="C4:1 C4 C4 C4">Quarter note</P>, '1 beat: one foot tap. The basic unit.'],
              [<P key="r4" melody="C4:0.5 C4 C4 C4 C4 C4 C4 C4">Eighth note</P>, 'Half a beat: two per tap. Most melodies and bass lines live here.'],
              [<P key="r5" melody="C4:0.25 C4 C4 C4 C4 C4 C4 C4 C4 C4 C4 C4 C4 C4 C4 C4">16th note</P>, 'A quarter of a beat: four per tap. Hi-hats, fast runs, rap flows.'],
            ]}
          />

          <h2>How BandForge shows all this</h2>
          <p>Every editor in BandForge is the same idea drawn differently: time runs left to right, and pitch (or drum sound) runs bottom to top.</p>
          <Cards
            items={[
              { title: 'Piano Roll', tag: 'rows = pitch', body: 'Each row is one key on the piano; each column of the grid is a slice of time. A note is a bar: where it starts is when, its length is how long, its height is the pitch.', color: '#5dbb7a' },
              { title: 'Score', tag: 'staff = pitch', body: 'Traditional sheet music. Higher on the staff is higher in pitch; the note shapes (filled, hollow, flags) show the length. Handy for anything a real player will read.', color: '#5b9be0' },
              { title: 'Step Sequencer', tag: 'rows = drums', body: 'For drums. Each row is a sound (kick, snare, hat) and each square is a 16th note, so one bar of 4/4 is 16 squares. Light a square to play that drum on that step.', color: '#d99a3a' },
            ]}
          />

          <h2>The three layers of almost every song</h2>
          <p>Strip a song down and you nearly always find three jobs being done at once:</p>
          <ul>
            <li>
              <b>Rhythm</b> (the drums, often helped by the bass) keeps time and sets the energy.
            </li>
            <li>
              <b>Harmony</b> (chords on piano, guitar, pads, plus the bass underneath) sets the mood and tells you where &ldquo;home&rdquo; is.
            </li>
            <li>
              <b>Melody</b> (the voice or lead instrument) is the part people hum afterwards.
            </li>
          </ul>
          <Example
            title="Rhythm, harmony and melody together"
            bpm={104}
            chordsAbove="C G Am F"
            parts={[
              { inst: 'analog-lead', label: 'Melody', notes: line(LAYER_TUNE), vol: 0.8, fx: { reverb: 0.2 } },
              { inst: 'electric-piano', label: 'Chords', notes: chords('C G Am F', { style: 'pulse', center: 60 }), vol: 0.75 },
              { inst: 'electric-bass', label: 'Bass', notes: bass('C G Am F', { style: 'eighths' }) },
              { inst: 'kit-acoustic', label: 'Drums', notes: drums(ROCK, { bars: 4 }) },
            ]}
            caption="Click the chips in the legend to mute parts. Drums alone are a groove with no mood; chords alone are a mood with no tune; the melody alone is a tune with nothing holding it up. Each layer only makes full sense with the others."
          />
          <Listen>
            Mute everything except the bass and drums. That pairing is called the <b>rhythm section</b>, and it is the floor every other part stands on. Now bring the chords back and notice how the same drum beat suddenly feels hopeful, purely because of the harmony.
          </Listen>
          <Why>
            Our brains track these layers separately. Rhythm is processed almost physically (it is why you nod along without deciding to), harmony sets an emotional context, and melody is what memory latches onto. Songs feel complete when each layer has a clear owner, which is why the chapters on <b>Drums &amp; Groove</b>, <b>Chord Progressions</b> and <b>Writing Melodies</b> exist separately.
          </Why>
          <Watch>
            Beginners often give every instrument a bit of everything: the piano plays the tune <em>and</em> busy chords <em>and</em> a bass line, while the guitar does the same. The result is a blur. Give each part one job; you will hear the difference immediately.
          </Watch>

          <Try title="Hear the layers in a real song">
            <Steps>
              <li>
                On the Home screen, open <Ui>Demo: Pop Anthem</Ui>.
              </li>
              <li>
                Press <K>Space</K> to play. Click a track name, then press <K>S</K> to solo it and <K>S</K> again to unsolo. Try the drums, the bass and the piano one at a time.
              </li>
              <li>
                Double-click any instrument region to open it in the <Ui>Editor</Ui> and look at the notes: low, long bass notes; stacked chord notes; a single line for the melody. You are looking at the three layers.
              </li>
            </Steps>
          </Try>
          <Tip>
            Next, <b>Your first song, step by step</b> turns all of this into an 8-bar idea of your own. If you would rather understand the notes first, jump to the <b>Music Theory That Matters</b> chapter.
          </Tip>
        </>
      ),
    },

    // ------------------------------------------------------------------ 2
    {
      id: 'first-song',
      title: 'Your first song, step by step',
      minutes: 12,
      summary: 'Go from a blank song to an 8-bar idea with drums, chords, a bass line and a melody you wrote yourself, using exactly the buttons you will use every day.',
      keywords: 'tutorial walkthrough beginner first track step sequencer piano roll chord track bass melody record quantize loop duplicate',
      body: () => (
        <>
          <Lead>
            In this lesson you will build the short piece below, one layer at a time. It uses four chords, a basic beat, a simple bass line and a melody, and it takes about half an hour the first time. Every musical choice is explained, so you can swap in your own ideas at each step.
          </Lead>
          <Example
            title="Where we are going: 8 bars, four layers"
            bpm={100}
            chordsAbove={FIRST_PROG}
            parts={[
              { inst: 'analog-lead', label: 'Melody', notes: line(FIRST_TUNE), vol: 0.75, fx: { reverb: 0.25, delay: 0.12 } },
              { inst: 'grand-piano', label: 'Chords', notes: chords(FIRST_PROG, { center: 60 }), vol: 0.8 },
              { inst: 'electric-bass', label: 'Bass', notes: bass(FIRST_PROG, { style: 'root5' }) },
              { inst: 'kit-acoustic', label: 'Drums', notes: drums(ROCK, { bars: 8 }) },
            ]}
            caption="Mute the melody and listen to the backing on its own: you could sing a dozen different tunes over it. That is the point. Once the backing works, the melody is the part that makes it yours."
          />

          <h2>Step 1: a new song, a tempo and a key</h2>
          <Steps>
            <li>
              On the Home screen press <Ui>New Song</Ui> and choose <Ui>Empty Song</Ui>. You get one piano track and an empty timeline.
            </li>
            <li>
              In the display at the top, click the <b>tempo</b> number and type <b>100</b>. 100 BPM is a comfortable middle: not a ballad, not a dance track.
            </li>
            <li>
              Click <b>KEY</b> in the same display and pick <b>C</b> and <b>Major</b>. C major uses only the white keys, which makes every step below easy to see. (The <b>Choosing a Key</b> chapter explains how to pick a key properly later.)
            </li>
          </Steps>

          <h2>Step 2: the beat</h2>
          <p>
            Drums first, because they set the energy and give you something to play along to. We will use the most common beat in popular music: kick drum on beats 1 and 3, snare on beats 2 and 4, and hi-hat on every eighth note.
          </p>
          <Example
            title="The basic rock beat (one bar, repeated)"
            bpm={100}
            loop
            parts={[{ inst: 'kit-acoustic', label: 'Drums', notes: drums(ROCK, { bars: 2 }) }]}
            caption="On a 16-step grid: kick on steps 1 and 9, snare on 5 and 13, hat on every odd step (1, 3, 5 … 15)."
          />
          <Steps>
            <li>
              Press <Ui>+</Ui> in the top bar (or <K>⌘</K>/<K>Ctrl</K>+<K>⌥</K>/<K>Alt</K>+<K>N</K>), choose <Ui>Drums</Ui> and pick <Ui>Studio Kit</Ui>.
            </li>
            <li>
              Double-click the empty space in the drum track's lane at bar 1 to make a region, then double-click the region to open the <Ui>Step Sequencer</Ui>.
            </li>
            <li>
              Click squares to light them: <b>Kick</b> on steps 1 and 9, <b>Snare</b> on 5 and 13, <b>Closed Hat</b> on 1, 3, 5, 7, 9, 11, 13 and 15. Press <Ui>Play Pattern</Ui> (or <K>⇧</K>+<K>Space</K>) to hear it loop on its own.
            </li>
          </Steps>
          <Tip>Drum beats sound robotic when every hit is equally loud. Switch the sequencer to <Ui>Velocity</Ui> and pull every second hi-hat down a little. Instantly more human; the <b>Drums &amp; Groove</b> chapter goes much further.</Tip>

          <h2>Step 3: the chords</h2>
          <p>
            We will use <b>C – Am – F – G</b>, one chord per bar, then repeat. It is one of the most used progressions in pop (think of &ldquo;Stand by Me&rdquo; or &ldquo;Every Breath You Take&rdquo;) because it does a complete little journey: home (C), a softer shade of home (Am), stepping away (F), tension that wants to go home (G), and back to C. Hear each chord, and then try your own order:
          </p>
          <ProgressionPad />
          <Steps>
            <li>
              Press <Ui>Chords</Ui> in the toolbar above the tracks to show the chord track. Click in it at bar 1, choose <b>C</b>, and repeat for <b>Am</b> at bar 2, <b>F</b> at bar 3 and <b>G</b> at bar 4. The chord track is your map: every editor and the <Ui>Check</Ui> panel use it.
            </li>
            <li>
              Now play those chords on the piano track. Double-click its lane at bar 1 to make a region and double-click the region to open the <Ui>Piano Roll</Ui>. Turn on the scale button in the toolbar so the notes of C major are highlighted and new notes snap into the key.
            </li>
            <li>
              Choose the pencil tool and draw each chord as three notes stacked, each one bar long: <b>C E G</b>, then <b>A C E</b>, <b>F A C</b>, <b>G B D</b>. Keep them all around middle C.
            </li>
          </Steps>
          <Compare
            items={[
              { label: 'Jumping around', verdict: 'worse', title: 'Every chord in root position', bpm: 100, chordsAbove: 'C Am F G', parts: [{ inst: 'grand-piano', label: 'Chords', notes: chords('C Am F G', { lead: false, center: 62 }) }] },
              { label: 'Moving smoothly', verdict: 'better', title: 'Each chord as close as possible to the last', bpm: 100, chordsAbove: 'C Am F G', parts: [{ inst: 'grand-piano', label: 'Chords', notes: chords('C Am F G', { center: 62 }) }] },
            ]}
          />
          <Pro>
            Look at the right-hand example: instead of moving every finger up to the next chord, pianists keep the notes the chords share and move the others by the smallest step. That is called <b>voice leading</b>, and it is the single biggest difference between chords that sound &ldquo;played by a musician&rdquo; and chords that sound clicked in. When you draw your chords, try moving notes up or down an octave (<K>⇧</K>+<K>↑</K>/<K>↓</K>) until the shape barely moves.
          </Pro>

          <h2>Step 4: the bass</h2>
          <p>
            The bass player's main job is to play the <b>root</b> of each chord, the note the chord is named after, low down. It makes the harmony feel solid. Playing the root and then the note five steps up (the <b>5th</b>) adds movement without confusing anything.
          </p>
          <Example
            title="Root, then 5th, on each beat"
            bpm={100}
            chordsAbove="C Am F G"
            names
            parts={[
              { inst: 'electric-bass', label: 'Bass', notes: bass('C Am F G', { style: 'root5' }) },
              { inst: 'kit-acoustic', label: 'Drums', notes: drums(ROCK, { bars: 4 }) },
            ]}
          />
          <Steps>
            <li>
              Add another <Ui>Software Instrument</Ui> track and pick <Ui>Electric Bass</Ui> from <b>Guitars &amp; Bass</b>.
            </li>
            <li>
              Make a region and draw quarter notes: <b>C G C G</b> in bar 1, <b>A E A E</b> in bar 2, <b>F C F C</b> in bar 3, <b>G D G D</b> in bar 4, all in the octave below the piano (around C2 and C3).
            </li>
          </Steps>
          <Watch>
            A bass line that is too high fights with the chords; one that wanders between notes that aren't in the chord makes the whole band sound out of tune. Start with roots and 5ths. The <b>Bass, Counter-Melodies &amp; Harmony</b> chapter shows how to make bass lines more interesting without losing that foundation.
          </Watch>

          <h2>Step 5: the melody</h2>
          <p>Now the fun part. Two rules of thumb make a first melody work almost every time:</p>
          <ul>
            <li>
              <b>Land on chord notes when the chord changes.</b> On beat 1 of each bar, pick a note from that bar's chord. Between those landings, anything in the key works if you move by step.
            </li>
            <li>
              <b>Repeat yourself.</b> Make bar 3 echo bar 1. Repetition is what makes a tune feel intentional rather than random.
            </li>
          </ul>
          <Example
            title="The melody alone, with the landing notes visible"
            bpm={100}
            names
            chordsAbove="C Am F G"
            parts={[{ inst: 'analog-lead', label: 'Melody', notes: line(FIRST_TUNE.split('|').slice(0, 4).join('|')), fx: { reverb: 0.2 } }]}
            caption="Bar 1 lands on G and C (both in C major), bar 2 on A (in Am), bar 3 on C (in F), bar 4 on B (in G). Everything in between moves by small steps."
          />
          <Steps>
            <li>
              Add a third instrument track (try <Ui>Analog Lead</Ui> or <Ui>Flute</Ui>).
            </li>
            <li>
              Turn on musical typing (<K>⌘</K>/<K>Ctrl</K>+<K>⇧</K>+<K>K</K>) and play on the <K>A</K> <K>S</K> <K>D</K> <K>F</K> row while the song loops. Hum first, then find what you hummed.
            </li>
            <li>
              When you have something, press <K>R</K> to record (turn on <b>Count-in</b> in Song Settings for a bar of clicks first). Don't worry about timing: open the region in the <Ui>Piano Roll</Ui>, select the notes with <K>⌘</K>+<K>A</K> and press <K>Q</K> to quantize them onto the grid.
            </li>
            <li>
              Prefer drawing to playing? Use the pencil tool exactly as you did for the chords.
            </li>
          </Steps>

          <h2>Step 6: make it 8 bars, and keep a copy</h2>
          <Steps>
            <li>
              Press <K>C</K> to turn on the loop, so bars 1 to 4 repeat while you work.
            </li>
            <li>
              Select the drum, piano and bass regions and press <K>⌘</K>/<K>Ctrl</K>+<K>D</K> to duplicate them into bars 5 to 8. Copy the chords in the chord track the same way.
            </li>
            <li>
              Change the <em>melody</em> in bars 5 to 8 a little, especially the last bar. In our example, bar 6 adds a passing note and bar 8 ends lower, which makes the second half sound like an answer to the first.
            </li>
            <li>
              Press <K>⌘</K>/<K>Ctrl</K>+<K>⌥</K>/<K>Alt</K>+<K>S</K> to save a named version. Now you can experiment without fear: <Ui>Version History</Ui> gets this exact state back.
            </li>
          </Steps>
          <Why>
            Four bars that repeat with a changed ending is the most basic unit of song form: a <b>phrase</b> and its <b>answer</b>. Nearly every verse and chorus you know is built from that question-and-answer pair. You will see it again in <b>Writing Melodies</b> and <b>Instruments &amp; Arranging</b>.
          </Why>
          <Try title="Make it yours">
            <p>Before moving on, change one thing in each layer and listen to how much the character moves:</p>
            <ul>
              <li>Swap the chord order to Am – F – C – G. Same chords, sadder start.</li>
              <li>Drop the tempo to 80 and replace the piano with <Ui>Warm Pad</Ui>.</li>
              <li>Move the snare to only beat 3 (step 9). Half as many snares makes it feel half as fast, a trick called a <b>half-time</b> feel.</li>
            </ul>
          </Try>
        </>
      ),
    },

    // ------------------------------------------------------------------ 3
    {
      id: 'how-songwriters-work',
      title: 'How songwriters actually work',
      minutes: 10,
      summary: 'Where ideas come from, the three ways songs usually start, the habits that get songs finished, and what to do when you are stuck.',
      keywords: 'workflow habits writer block stuck finishing inspiration reference track hook progression beat routine versions',
      body: () => (
        <>
          <Lead>
            The biggest myth about writing music is that it starts with inspiration. For working songwriters it mostly starts with a small, ordinary idea that they keep pushing until it becomes interesting. This lesson is about that process: how to begin, how to keep going, and how to finish.
          </Lead>

          <h2>Three ways in</h2>
          <p>Almost every song starts from one of three seeds. None is better; they just lead to different kinds of songs, so it helps to switch between them.</p>
          <Cards
            items={[
              { title: 'Start from a hook', tag: 'melody first', body: 'A 2–4 note idea you can sing. Songs that start this way tend to have the strongest, most singable choruses. Build chords under the hook afterwards.', color: '#45b8c4' },
              { title: 'Start from a progression', tag: 'harmony first', body: 'Four chords that set a mood. Great for emotional, atmospheric writing. The risk: melodies that just trace the chords, so sing over them before you draw anything.', color: '#a07ae0' },
              { title: 'Start from a beat', tag: 'rhythm first', body: 'A groove that makes you move. The usual route in hip hop, dance and funk. Melodies written over a beat tend to be more rhythmic and conversational.', color: '#d99a3a' },
            ]}
          />
          <p>A hook really can be tiny. Here is one bar, and then the same bar developed into a full phrase just by repeating it and changing the ending:</p>
          <Compare
            items={[
              { label: 'The seed', title: 'A four-note hook', names: true, bpm: 96, parts: [{ inst: 'electric-piano', label: 'Hook', notes: line('E4:0.5 G4:0.5 A4:1 G4:2') }] },
              {
                label: 'The phrase',
                verdict: 'better',
                title: 'Repeat, repeat higher, answer',
                names: true,
                bpm: 96,
                chordsAbove: 'C Am F G',
                parts: [
                  { inst: 'electric-piano', label: 'Hook', notes: line('E4:0.5 G4:0.5 A4:1 G4:2 | E4:0.5 G4:0.5 A4:1 E4:2 | F4:0.5 A4:0.5 C5:1 A4:2 | G4:0.5 F4:0.5 D4:1 G4:2') },
                  { inst: 'warm-pad', label: 'Pad', notes: chords('C Am F G', { center: 55 }), vol: 0.55 },
                ],
              },
            ]}
          />
          <Why>
            Listeners need to hear an idea about three times before it feels like &ldquo;the tune&rdquo;. Repeat it exactly, then repeat it slightly changed, then break the pattern. That repeat-repeat-change shape (sometimes called <b>sentence form</b>) runs through everything from Beethoven's Fifth to modern pop choruses, and it is the fastest way to turn a seed into something that sounds finished.
          </Why>

          <h2>Write small, write often</h2>
          <p>
            Ten minutes a day beats three hours on a Sunday. Short sessions keep ideas flowing and stop you from polishing one bar forever. A practical routine that many writers use:
          </p>
          <Spec
            title="A 30-minute session"
            rows={[
              ['5 min', 'Listen to one song you love and notice one specific thing: how the chorus rises, where the drums drop out, a bass note that surprises you.'],
              ['15 min', 'Start something new from that one thing. Don’t open old projects. Aim for 4–8 bars, not a song.'],
              ['5 min', 'Save a version with a name that describes the idea ("sad piano, fast hats") so you can find it later.'],
              ['5 min', 'Write one sentence about what to try next time. Future you will thank you.'],
            ]}
          />
          <p>
            You will end up with lots of short sketches. That is good. Professional writers often have hundreds of unfinished ideas; the hits come from combining the best two or three. A chorus from March and a verse from June are often a better song than either sketch on its own.
          </p>
          <Try title="Keep your ideas safe">
            <Steps>
              <li>
                BandForge saves as you work. To keep a specific moment, press <K>⌘</K>/<K>Ctrl</K>+<K>⌥</K>/<K>Alt</K>+<K>S</K>, or click the save indicator next to the song name and choose <Ui>Save Version</Ui> with a label.
              </li>
              <li>
                In <Ui>Version History</Ui> you can restore any version, or open one as a separate copy and take it somewhere completely different while the original stays intact.
              </li>
              <li>
                Use the song search on the Home screen to find old sketches by name, which is another reason to name them by what they sound like.
              </li>
            </Steps>
          </Try>

          <h2>Use reference tracks</h2>
          <p>
            A <b>reference track</b> is an existing song you keep beside your work as a measuring stick. Pros do this constantly, and it is not copying: you are borrowing <em>decisions</em> (tempo, structure, how dense the arrangement is, where the energy lifts), not notes.
          </p>
          <ul>
            <li>Pick one or two songs in the style you want.</li>
            <li>Write down their tempo, how long the intro is, when the chorus first arrives (often within 45–60 seconds in pop) and which instruments play in each section.</li>
            <li>Lay out your song with the same section lengths. You will be surprised how much structure alone makes a sketch sound like a &ldquo;real song&rdquo;.</li>
          </ul>
          <SectionMap
            sections={[
              { name: 'Intro', bars: 4, energy: 1 },
              { name: 'Verse', bars: 8, energy: 2 },
              { name: 'Chorus', bars: 8, energy: 4 },
              { name: 'Verse 2', bars: 8, energy: 2.5 },
              { name: 'Chorus 2', bars: 8, energy: 4 },
              { name: 'Bridge', bars: 8, energy: 3 },
              { name: 'Chorus 3', bars: 8, energy: 5 },
            ]}
            caption="A common pop shape, mapped from a reference. Heights show energy: each chorus is bigger than the verse before it, and the last chorus is the biggest of all."
          />

          <h2>Finishing beats perfecting</h2>
          <p>
            The hardest skill isn't writing a great 8 bars. It is getting from 8 great bars to a whole song without getting bored or scared. A few rules that help:
          </p>
          <ul>
            <li>
              <b>Rough out the whole song before polishing any part.</b> Sketch every section with simple versions of each part, even if they are ugly. Then improve the weakest section, not your favourite one.
            </li>
            <li>
              <b>Set a finish line.</b> &ldquo;Done&rdquo; means every section exists, it plays start to finish without anything embarrassing, and the levels are roughly balanced. That's it. Export it.
            </li>
            <li>
              <b>Stop editing when changes stop being obviously better.</b> If you are A/B-ing two versions and can't tell which is better, both are fine. Pick one and move on.
            </li>
            <li>
              <b>Finish lots of small songs.</b> Your tenth finished song will be dramatically better than your first, and you only get there by finishing nine.
            </li>
          </ul>
          <Watch title="The loop trap">
            Listening to the same four bars on repeat for an hour is the most common way beginner songs die. Your ear goes numb, the loop starts sounding either amazing or awful, and you have learned nothing about what comes next. Once you have about 8 bars you like, turn the loop off (<K>C</K>) and start the next section.
          </Watch>

          <h2>When you are stuck</h2>
          <p>Being stuck usually means you are trying to decide too many things at once. Shrink the decision:</p>
          <Cards
            items={[
              { title: 'Take something away', body: 'Mute half your tracks. Often the song is hiding under too many parts, and what remains suggests what to write next.' },
              { title: 'Change one setting', body: 'New tempo, new instrument, new key. The notes stay the same but your ears hear them fresh.' },
              { title: 'Write the opposite', body: 'If the verse is low and busy, make the next section high and sparse. Contrast is the engine of song structure.' },
              { title: 'Steal a shape', body: 'Take the rhythm of a melody you love (not its notes) and put your own notes on it. Rhythms are the backbone of style.' },
              { title: 'Set a tiny limit', body: 'Only three notes. Only the black keys. Only one chord. Limits force ideas you would never pick from infinite choice.' },
              { title: 'Walk away', body: 'Seriously. Ten minutes away resets your ears better than an hour of forcing it.' },
            ]}
          />
          <Pro>
            Many writers keep a separate &ldquo;ideas&rdquo; song: a project where they dump every hook, beat and progression they come up with, one after another, with no pressure to finish anything. When starting a real song they scroll through it for raw material. BandForge makes this easy: one song called &ldquo;Ideas&rdquo;, a new region for each idea, and a version saved now and then.
          </Pro>
          <Tip>
            Where to go next depends on what you find hardest. If melodies come easily but the chords feel wrong, read <b>Chord Progressions</b>. If you have great loops that never turn into songs, read <b>Instruments &amp; Arranging</b>. If everything sounds right on its own but messy together, read <b>Bass, Counter-Melodies &amp; Harmony</b> and <b>Effects &amp; Mixing</b>.
          </Tip>
        </>
      ),
    },
  ],
};

export default chapter;
