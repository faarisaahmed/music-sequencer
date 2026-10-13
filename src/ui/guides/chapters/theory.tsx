import { GraduationCap } from 'lucide-react';
import type { Chapter, Lesson } from '../types';
import { Cards, ChordsInKey, Compare, Example, Keys, Lead, Listen, PlayChip as P, Pro, ProgressionPad, RangeChart, Spec, Steps, Tip, Try, Ui, Watch, Why, K } from '../figures';
import { bass, chords, drums, line } from '../notation';

const W = '#ecebe8';
const B = '#5b9be0';

// ------------------------------------------------------------------ 1. notes

const notes: Lesson = {
  id: 'notes',
  title: 'Notes, octaves and the keyboard',
  minutes: 7,
  summary: 'Twelve notes, repeating higher and lower, make up every song you have ever heard. Learn to find any of them on a keyboard and in the piano roll, why some notes have two names, and how octave numbers work.',
  keywords: 'note names sharp flat natural octave middle c c4 piano keyboard black keys white keys enharmonic pitch midi register range',
  body: () => (
    <>
      <Lead>
        Western music uses just <b>twelve notes</b>. Everything from a nursery rhyme to a film score is those twelve, played higher and lower, in different orders and combinations. Learn where they are once and you can find your way around any instrument, the piano roll and sheet music.
      </Lead>

      <h2>Twelve notes, seven letters</h2>
      <p>
        The white keys of a piano are named with the letters <b>A to G</b>, then the letters start again. The black keys sit in between and borrow a neighbour's name: a <b>sharp (♯)</b> means one half step higher, a <b>flat (♭)</b> one half step lower. So the black key between C and D is C♯ (C raised) or D♭ (D lowered). Same key, two names.
      </p>
      <Keys
        from="C4"
        to="B4"
        buttons={false}
        marks={{
          C4: { label: 'C', color: W },
          'C#4': { label: 'C♯', color: B },
          D4: { label: 'D', color: W },
          'D#4': { label: 'D♯', color: B },
          E4: { label: 'E', color: W },
          F4: { label: 'F', color: W },
          'F#4': { label: 'F♯', color: B },
          G4: { label: 'G', color: W },
          'G#4': { label: 'G♯', color: B },
          A4: { label: 'A', color: W },
          'A#4': { label: 'A♯', color: B },
          B4: { label: 'B', color: W },
        }}
        caption="One octave: seven white keys, five black keys, twelve notes. Click any key to hear it."
      />
      <p>
        The black keys come in a repeating pattern of <b>two, then three</b>. That pattern is your map. <b>C</b> is always the white key just left of a group of two black keys; <b>F</b> is the white key just left of a group of three. Find those two and you can find everything else by counting.
      </p>
      <p>
        Notice the two places with <em>no</em> black key between white keys: <b>E–F</b> and <b>B–C</b>. These pairs are already a half step apart. It looks like a quirk, but it's the reason the major scale sounds the way it does. You'll see why in the scales lesson.
      </p>

      <h2>Why some notes have two names</h2>
      <p>
        If C♯ and D♭ are the same key, why bother with both? Because a scale uses <b>each letter exactly once</b>. The F major scale is F G A B♭ C D E. Calling its fourth note A♯ instead would use the letter A twice and skip B, which makes it far harder to read and to think about. So keys with flats in them spell their black notes as flats, and keys with sharps spell them as sharps.
      </p>
      <Watch title="A sharp isn't always a black key">
        Sharps and flats mean "one half step", not "the black one". Since E and F are already a half step apart, <b>E♯ is the same key as F</b>, and <b>C♭ is the same as B</b>. You'll rarely need them, but they turn up in keys with lots of sharps, such as C♯ major, where every letter is sharpened. If a piece of sheet music seems to have a typo like this, it is probably correct.
      </Watch>

      <h2>Octaves and octave numbers</h2>
      <p>
        After B the letters wrap round to C again, and that new C sounds like the old one, only higher. That's an <b>octave</b>: the higher note vibrates exactly twice as fast (A4 is 440 vibrations a second, A5 is 880). Your ear hears the two as "the same note", which is why men and women can sing a tune together an octave apart without it sounding like harmony.
      </p>
      <p>
        To say <em>which</em> C you mean, notes get a number: <b>C4 is middle C</b>, the C nearest the middle of a piano. The number goes up at every C, so the B just below middle C is B3, not B4. A full 88-key piano runs from A0 to C8.
      </p>
      <Keys from="C3" to="C5" marks={{ C3: 'C3', C4: 'C4', C5: 'C5' }} caption="Three Cs, an octave apart. Press “One by one” to hear the same note at three heights." />
      <Example
        title="One tune, three octaves"
        names
        bpm={104}
        parts={[{ inst: 'grand-piano', label: 'Melody', notes: [...line('C4:0.5 E4 G4 E4 F4 D4 C4:1', { transpose: -12 }), ...line('C4:0.5 E4 G4 E4 F4 D4 C4:1', { at: 4 }), ...line('C4:0.5 E4 G4 E4 F4 D4 C4:1', { at: 8, transpose: 12 })] }]}
        caption="The notes are identical, only the octave changes. Low sounds heavy and murky, the middle sounds natural and singable, high sounds light and delicate. Choosing the octave is a musical decision, not a technicality."
      />
      <Pro title="Not every program agrees on middle C">
        BandForge, sheet music and most teaching use <b>C4</b> for middle C (MIDI note 60). But Ableton Live and Logic Pro label the same key <b>C3</b>, and FL Studio calls it <b>C5</b>. If a tutorial for another program says "start on C3", check which convention it uses before copying it note for note, or everything will come out an octave off.
      </Pro>

      <h2>Where instruments and voices live</h2>
      <p>
        Every instrument covers a slice of those octaves. The sweet spot for melodies is roughly <b>C4 to C6</b>: high enough to be clear, low enough to sound warm. Bass parts live two octaves lower. When a part sounds thin or muddy, the fix is often moving it an octave rather than changing a single note.
      </p>
      <RangeChart
        sweet
        rows={[
          { label: 'Bass guitar', lo: 'E1', hi: 'G3' },
          { label: 'Male voice', lo: 'A2', hi: 'A4' },
          { label: 'Female voice', lo: 'F3', hi: 'F5' },
          { label: 'Violin', lo: 'G3', hi: 'A6' },
          { label: 'Flute', lo: 'C4', hi: 'C7' },
          { label: 'Piano', lo: 'A0', hi: 'C8', color: '#7a86e6' },
        ]}
        caption="Typical comfortable ranges. The amber dot marks middle C (C4). Notice how much of the range sits below middle C; that is where the weight of a song comes from."
      />

      <h2>Finding notes in BandForge</h2>
      <Try>
        <Steps>
          <li>
            Double-click any region on an instrument track to open the <Ui>Piano Roll</Ui>. The keyboard down the left side is labelled at every C (C3, C4, C5…), and every row is one key. The darker rows are the black keys, so the two-and-three pattern is right there.
          </li>
          <li>
            Press <K>P</K> to open the on-screen keyboard and click keys to hear them.
          </li>
          <li>
            Turn on musical typing with <K>⌘</K>/<K>Ctrl</K>+<K>⇧</K>+<K>K</K> and your computer keyboard becomes a piano: <K>A</K> <K>S</K> <K>D</K> <K>F</K> <K>G</K> <K>H</K> <K>J</K> <K>K</K> are the white keys C to the next C, and <K>W</K> <K>E</K> <K>T</K> <K>Y</K> <K>U</K> are the black keys between them. <K>Z</K> and <K>X</K> move down and up an octave; BandForge shows which C you are on.
          </li>
          <li>Find middle C, then find every C and every F on the keyboard without looking at the labels. Thirty seconds of this is worth more than reading about it.</li>
        </Steps>
      </Try>
    </>
  ),
};

// ------------------------------------------------------------------ 2. intervals

const intervals: Lesson = {
  id: 'intervals',
  title: 'Intervals: 3rds, 5ths and the rest',
  minutes: 9,
  summary: 'The distance between two notes decides almost everything about how music feels. Learn the handful that matter, what each one does emotionally, and how to use them on purpose.',
  keywords: 'interval third fifth octave semitone half step whole step tritone sixth seventh second fourth consonance dissonance',
  body: () => (
    <>
      <Lead>
        Forget note names for a moment. Music is built from <b>distances</b>. Two notes a certain distance apart always have the same flavour, whatever key you are in, so if you learn how a handful of distances feel, you can write in any key.
      </Lead>
      <p>
        That distance is called an <b>interval</b>, and it is measured in <b>half steps</b> (also called semitones). One half step is the move from any key on a piano to the very next key, black or white. Two half steps make a <b>whole step</b>.
      </p>
      <Keys from="C4" to="C5" marks={{ C4: '0', 'C#4': '1', D4: '2', 'D#4': '3', E4: '4', F4: '5', G4: '7', C5: '12' }} caption="Counting half steps up from C. Every key, black or white, is one more. Click any key to hear it." />

      <h2>The intervals worth knowing by ear</h2>
      <p>There are twelve, but these seven do nearly all the work. Play each one, and listen for the <em>feeling</em>, not the pitch.</p>
      <Spec
        rows={[
          [<P key="k139-13" notes="C4 D4" mode="apart">2nd · 2</P>, 'A step. Melodies are mostly made of these. Played together it rubs, which is why a 2nd adds "shimmer" inside a chord.'],
          [<P key="k140-13" notes="C4 Eb4" mode="apart">minor 3rd · 3</P>, 'The sound of minor: tender, serious, sad when slow. The bottom of every minor chord.'],
          [<P key="k141-13" notes="C4 E4" mode="apart">major 3rd · 4</P>, 'Bright, settled, open. The bottom of every major chord. Swapping a major 3rd for a minor one is the fastest mood change in music.'],
          [<P key="k142-13" notes="C4 F4" mode="apart">4th · 5</P>, 'Hollow and expectant. Feels like it wants to fall back down a step. "Here Comes the Bride" opens with one.'],
          [<P key="k143-13" notes="C4 G4" mode="apart">5th · 7</P>, 'Strong, pure, almost no colour of its own. The backbone of chords and bass lines. Rock "power chords" are just a 5th.'],
          [<P key="k144-13" notes="C4 A4" mode="apart">major 6th · 9</P>, 'Warm and sweet, a little nostalgic. Leaping up a 6th is the classic way to start a big, yearning melody.'],
          [<P key="k145-13" notes="C4 C5" mode="apart">octave · 12</P>, 'The same note, higher. Doubling a line in octaves makes it bigger without changing its harmony.'],
        ]}
      />
      <Listen>
        Play the major 3rd, then the minor 3rd, back to back: <P notes="C4 E4" mode="together">major</P> <P notes="C4 Eb4" mode="together">minor</P>. One half step of difference in a single note is the whole difference between "happy" and "sad". Every time you hear a song turn bittersweet, look for a 3rd that just got smaller.
      </Listen>

      <h2>Stable and restless intervals</h2>
      <p>
        Some intervals feel finished when played together (they are <b>consonant</b>): octaves, 5ths, 3rds and 6ths. Others feel like they are leaning on something and want to move (they are <b>dissonant</b>): 2nds, 7ths and the <P notes="C4 F#4">tritone</P>, six half steps, the most unstable sound in the system.
      </p>
      <p>
        Dissonance isn't a mistake, it's <b>fuel</b>. A melody that only uses stable notes against the chords sounds like a nursery rhyme. A melody that leans into a dissonant note and then steps to a stable one creates a small ache and release, and that is most of what "expressive" means.
      </p>
      <Compare
        items={[
          {
            label: 'Only stable notes',
            title: 'Melody always lands on chord tones',
            parts: [
              { inst: 'flute', label: 'Melody', notes: line('E4:2 G4:2 | C5:2 G4:2 | F4:2 A4:2 | E4:4') },
              { inst: 'grand-piano', label: 'Chords', notes: chords('C C F C', { center: 55 }) },
            ],
            bpm: 84,
            chordsAbove: 'C C F C',
            caption: 'Correct, but nothing pulls you forward.',
          },
          {
            label: 'Lean, then resolve',
            verdict: 'better',
            title: 'A dissonant note on the beat, resolved a step later',
            parts: [
              { inst: 'flute', label: 'Melody', notes: line('F4:1.5 E4:0.5 G4:2 | D5:1.5 C5:0.5 G4:2 | G4:1.5 F4:0.5 A4:2 | D4:1 E4:3') },
              { inst: 'grand-piano', label: 'Chords', notes: chords('C C F C', { center: 55 }) },
            ],
            bpm: 84,
            chordsAbove: 'C C F C',
            caption: 'Each bar starts on a note that clashes with the chord (a 4th or a 9th above the root) and steps down onto a chord tone. Same chords, far more feeling.',
          },
        ]}
      />
      <Why>
        Your ear constantly predicts. A stable interval confirms the prediction; a dissonant one creates a small question. When the next note answers that question by stepping to a stable one, you get a tiny moment of relief. Composers call this <b>tension and release</b>, and you will see it at every scale in this course: between two notes, between chords, and between whole sections of a song.
      </Why>

      <h2>Intervals in melodies: steps, skips and leaps</h2>
      <p>How far a melody moves between notes shapes its character as much as which notes it uses.</p>
      <ul>
        <li>
          <b>Steps</b> (2nds) feel like singing and talking. Most of any good melody moves by step.
        </li>
        <li>
          <b>Skips</b> (3rds) outline chords and feel bouncy and confident.
        </li>
        <li>
          <b>Leaps</b> (5ths, 6ths, octaves) are dramatic. Use them sparingly, at emotional moments, and follow a big leap with a step <em>back the other way</em>. That is how nearly every memorable melody handles a leap.
        </li>
      </ul>
      <Example
        title="A leap up, then filling in the gap by step"
        names
        bpm={76}
        parts={[
          { inst: 'string-ensemble', label: 'Melody', notes: line('C4:1 A4:3 | G4:1 F4:1 E4:1 D4:1 | E4:4') },
          { inst: 'grand-piano', label: 'Chords', notes: chords('F C/E C', { center: 52, beats: 4 }), vol: 0.7 },
        ]}
        chordsAbove="F C/E C"
        caption="The 6th leap from C up to A is the emotional moment; the melody then walks back down by step to settle. Try muting the chords to hear the line alone."
      />
      <Watch>
        Beginners often write melodies that jump around between chord notes with no steps in between. It sounds like an arpeggio exercise, not a tune. If your melody feels mechanical, look for big jumps in a row and fill some of them in with stepwise notes.
      </Watch>

      <h2>Using intervals in BandForge</h2>
      <Try>
        <Steps>
          <li>
            Open any instrument track and double-click a region to open the <Ui>Piano Roll</Ui>. Each row is one half step, so counting rows <em>is</em> counting intervals: four rows up is a major 3rd, seven is a 5th.
          </li>
          <li>
            Select a few notes and press <K>⌘</K>/<K>Ctrl</K> + <K>↑</K> to move them up an octave in one go, or use <Ui>+1</Ui> and <Ui>−1</Ui> in the toolbar for single half steps.
          </li>
          <li>
            To add a harmony a 3rd above a melody, open the same region in the <Ui>Score</Ui>, select the notes and press <K>Alt</K>+<K>3</K>. BandForge adds the note a 3rd above each one, staying inside the key. <K>Alt</K>+<K>6</K> adds a 6th, <K>Alt</K>+<K>8</K> an octave.
          </li>
          <li>
            Not sure whether a clash is deliberate? Open <Ui>Check</Ui> (<K>⇧</K>+<K>W</K>). It points out half-step rubs held between parts, so you can decide whether each one is tension you want or an accident.
          </li>
        </Steps>
      </Try>
      <Pro>
        Session arrangers think in intervals between parts, not just within one. Two lines moving in parallel 3rds or 6ths sound sweet and blended (think of any duet harmony). Lines moving in parallel 5ths or octaves sound like one thick line, which is great for power but bad for independence. You'll use that in the counter-melody chapter.
      </Pro>
    </>
  ),
};

// ------------------------------------------------------------------ 3. scales

const scales: Lesson = {
  id: 'scales',
  title: 'Scales: the palette for a song',
  minutes: 10,
  summary: 'A scale is the set of notes a song agrees to use. Learn the major, minor, pentatonic and blues scales, why each sounds the way it does, and the personality of every note in a key.',
  keywords: 'scale major minor natural minor pentatonic blues scale degree tonic leading tone whole step half step key mode dorian mixolydian lydian scale lock snap',
  body: () => (
    <>
      <Lead>
        Out of the twelve notes, most songs pick <b>seven</b> and stick to them. That set is the song's <b>scale</b>, and it works like a painter's palette: choose the right colours up front and almost everything you paint with them goes together.
      </Lead>

      <h2>The major scale: W W H W W W H</h2>
      <p>
        Play the white keys from C to C and you get the <b>major scale</b>, the sound of "do re mi". What makes it major is not the notes themselves but the <b>pattern of steps</b> between them: whole, whole, half, whole, whole, whole, half. The two half steps are E–F and B–C, the two places on the keyboard with no black key.
      </p>
      <Keys from="C4" to="C5" marks={{ C4: '1', D4: '2', E4: '3', F4: '4', G4: '5', A4: '6', B4: '7', C5: '1' }} caption="C major. The numbers are scale degrees: each note's position in the scale. Press “One by one” to hear the familiar do-re-mi." />
      <p>
        Start the same pattern on any other note and you get that note's major scale. Starting on G, the pattern forces one black key, F♯, to keep the last step a half step. That's why G major has one sharp, and why every major key, whatever it is called, sounds the same, just higher or lower.
      </p>
      <Keys from="G3" to="G4" marks={{ G3: '1', A3: '2', B3: '3', C4: '4', D4: '5', E4: '6', 'F#4': { label: '7', color: B }, G4: '1' }} caption="G major: the same step pattern starting on G. The pattern needs F♯ (blue) instead of F." />

      <h2>The minor scale: W H W W H W W</h2>
      <p>
        Play the white keys from <b>A to A</b> and you get the <b>natural minor scale</b>. Same notes as C major, different home note, and suddenly it sounds darker and more serious. Compared with major, minor lowers the 3rd, 6th and 7th notes. The lowered 3rd matters most: it's the note that makes minor chords minor.
      </p>
      <Keys from="A3" to="A4" marks={{ A3: '1', B3: '2', C4: '3', D4: '4', E4: '5', F4: '6', G4: '7', A4: '1' }} caption="A natural minor: the white keys again, but with A as home. A minor is called the relative minor of C major because they share every note." />
      <Compare
        items={[
          {
            label: 'C major',
            title: 'Bright and open',
            bpm: 92,
            names: true,
            chordsAbove: 'C C:2 G:2 C',
            parts: [
              { inst: 'flute', label: 'Melody', notes: line('C4:1 E4 G4 A4 | G4:2 F4:1 D4 | C4:4') },
              { inst: 'grand-piano', label: 'Chords', notes: chords('C C:2 G:2 C', { center: 55 }), vol: 0.7 },
            ],
          },
          {
            label: 'C minor',
            title: 'Same tune, three notes lowered',
            bpm: 92,
            names: true,
            chordsAbove: 'Cm Cm:2 G:2 Cm',
            parts: [
              { inst: 'flute', label: 'Melody', notes: line('C4:1 Eb4 G4 Ab4 | G4:2 F4:1 D4 | C4:4') },
              { inst: 'grand-piano', label: 'Chords', notes: chords('Cm Cm:2 G:2 Cm', { center: 55 }), vol: 0.7 },
            ],
            caption: 'Only the 3rd (E→E♭) and 6th (A→A♭) changed in the melody. The mood flips completely.',
          },
        ]}
      />
      <Pro>
        Notice the minor example still uses a <b>G major</b> chord, with a B natural that isn't in the natural minor scale. Almost every minor-key song does this. A B♮ is a half step below C, so it pulls hard towards home, and minor songs borrow it to get a strong ending. Scale books call this the <b>harmonic minor</b>. You'll meet it again in chord progressions.
      </Pro>

      <h2>Pentatonic: five notes that can't clash</h2>
      <p>
        Take the major scale and remove the 4th and 7th: C D E G A. That's the <b>major pentatonic</b>. Start it on A (A C D E G) and it's the <b>minor pentatonic</b>, the scale behind most rock and blues guitar solos. It's also the scale of countless folk tunes worldwide: "Amazing Grace" and "Auld Lang Syne" use only these five notes.
      </p>
      <Keys from="C4" to="C5" marks={{ C4: '1', D4: '2', E4: '3', G4: '5', A4: '6', C5: '1' }} caption="C major pentatonic. The 4th (F) and 7th (B) are gone." />
      <Why title="Why it never sounds wrong">
        The 4th and 7th are the two notes in a major scale that sit a <b>half step</b> from another scale note (F above E, B below C). Half steps are where all the friction in a key lives. Remove them and no two notes can grind against each other, so any pentatonic note sounds fine over almost any chord in the key. That's why beginners improvising on the black keys of a piano (which form a pentatonic scale) always sound musical. The trade-off: without half steps there is less pull, so pentatonic melodies float rather than resolve.
      </Why>
      <Example
        title="A melody using only C D E G A"
        names
        bpm={96}
        chordsAbove="C Am F G C"
        parts={[
          { inst: 'electric-piano', label: 'Melody', notes: line('E4:1 G4:0.5 A4 G4:1 E4 | D4:0.5 E4 C4:1 A3:2 | C4:1 D4 E4 G4 | A4:1.5 G4:0.5 E4:1 D4 | C4:4') },
          { inst: 'grand-piano', label: 'Chords', notes: chords('C Am F G C', { center: 55 }), vol: 0.65 },
          { inst: 'synth-bass', label: 'Bass', notes: bass('C Am F G C'), vol: 0.8 },
        ]}
        caption="Over the F chord, the melody's D, E and G aren't chord notes, but they add colour rather than clash. Mute the melody and try singing your own line using only those five notes."
      />

      <h3>The blues scale</h3>
      <p>
        Add one note to the minor pentatonic, the flattened 5th, and you get the <b>blues scale</b>: A C D <b>E♭</b> E G. That extra note is the "blue note". On its own it's harsh, but sliding through it, from D to E♭ to E, gives you the bent, crying sound of blues, rock and soul.
      </p>
      <Keys from="A3" to="A4" marks={{ A3: '1', C4: '♭3', D4: '4', 'D#4': { label: '♭5', color: '#e06a8f' }, E4: '5', G4: '♭7', A4: '1' }} caption="A blues scale. The pink key is the blue note, E♭ (the same key as D♯)." />
      <p>
        Hear it slide: <P melody="A3:0.5 C4 D4 Eb4 E4:1 G4:0.5 A4:1.5" inst="electric-piano" bpm={96}>blues lick</P>. The E♭ only lasts half a beat, on its way somewhere. That's the trick with every spicy note: pass through it, don't park on it.
      </p>

      <h2>Every note in a key has a personality</h2>
      <p>
        Once you're in a key, each scale degree has a job. Composers lean on these personalities constantly, often without naming them. Play this melody over a held C chord and listen to which notes feel settled and which want to move.
      </p>
      <Example
        title="Degrees 1 to 8 over a held C chord"
        names
        bpm={80}
        parts={[
          { inst: 'flute', label: 'Scale', notes: line('C4:1 D4 E4 F4 G4 A4 B4 C5:2') },
          { inst: 'warm-pad', label: 'C chord', notes: chords('C:10', { center: 52 }), vol: 0.6 },
        ]}
        caption="C, E and G belong to the chord and feel at rest. D, F, A and B lean somewhere. Listen to how strongly B wants to reach C at the end."
      />
      <Spec
        rows={[
          ['1 · tonic', <>Home. Melodies feel finished when they end here. <P melody="G3+B3+D4+G4:1 C4+E4+G4+C5:2">hear it land</P></>],
          ['3 · mediant', 'Warm and stable, but it ends a phrase more softly than 1. Its major or minor form sets the mood of the whole key.'],
          ['5 · dominant', 'Strong and open. Ending a phrase on 5 sounds like a comma, not a full stop: the listener expects more.'],
          ['7 · leading tone', <>A half step below home and pulls up into it harder than any other note. <P melody="G3+D4+F4+B4:1.5 C4+E4+G4+C5:2.5">7 rising to 1</P></>],
          ['4 · subdominant', <>A half step above 3, so it tends to sink down onto it. <P melody="C4+F4+G4:1.5 C4+E4+G4:2.5">4 falling to 3</P></>],
          ['2 and 6', 'Restless but gentle. 2 usually steps down to 1 or up to 3. 6 has a bittersweet, yearning colour; it is the root of the sad vi chord.'],
        ]}
      />
      <Why>
        Look at where the pull is strongest: <b>7 to 1</b> and <b>4 to 3</b>. Both are half steps, and that's no coincidence. A note a half step from a stable note sounds like a near miss, and your ear wants it corrected. That gravity is what makes the major scale feel like it has a home, and it's why the pentatonic scale, which has no half steps, feels relaxed and floating.
      </Why>

      <h2>Keys and scales in BandForge</h2>
      <Try>
        <Steps>
          <li>
            Click the <Ui>KEY</Ui> readout in the top bar. Choose the root note, then a scale: <b>Major</b> and <b>Minor</b> are under Common, and you'll also find Modes, Minor variants and <b>Pentatonic & blues</b>.
          </li>
          <li>
            In the <Ui>Piano Roll</Ui>, click the <Ui>♪</Ui> scale button in the toolbar. Rows in the key are highlighted, and notes you draw or drag snap to them, so you can sketch without hitting wrong notes.
          </li>
          <li>
            On the on-screen keyboard (<K>P</K>), turn on <Ui>Scale</Ui>. Now only notes in the song's key play, whichever key you press, which is a great way to improvise a melody before you write it down.
          </li>
          <li>
            Changing your mind about the key later? In the same KEY popover, tick <b>Transpose existing notes to the new key</b> and the whole song moves with it.
          </li>
        </Steps>
      </Try>
      <Watch title="Don't leave the safety rails on forever">
        Scale snapping makes wrong notes impossible, but it also makes the <em>right</em> notes from outside the key impossible: the blue note, a chromatic passing note, a borrowed chord. Use it to sketch, then turn it off when you want a deliberate splash of colour.
      </Watch>
      <Tip title="Modes, briefly">
        The scale picker also lists <b>modes</b>: the major scale started on a different degree. Three worth knowing: <b>Dorian</b> (minor with a brighter 6th, the sound of "Scarborough Fair"), <b>Mixolydian</b> (major with a flattened 7th, earthy and bluesy, as in "Norwegian Wood"), and <b>Lydian</b> (major with a raised 4th, dreamy and floaty, like The Simpsons theme). The key chapter goes deeper.
      </Tip>
    </>
  ),
};

// ------------------------------------------------------------------ 4. chords

const chordsLesson: Lesson = {
  id: 'chords',
  title: 'Chords: how they are built',
  minutes: 11,
  summary: 'Stack notes a 3rd apart and you get chords. Learn major, minor, diminished and augmented triads, the four seventh chords, sus, add9 and power chords, and how to read any chord symbol.',
  keywords: 'chord triad major minor diminished augmented seventh maj7 dominant 7 m7 half diminished sus2 sus4 add9 power chord slash chord chord symbol root third fifth',
  body: () => (
    <>
      <Lead>
        A chord is three or more notes played together. It sounds like a mystery until you see the recipe: nearly every chord in pop, rock, folk and classical music is built by <b>stacking 3rds</b>, taking every other note of the scale.
      </Lead>

      <h2>Triads: two 3rds stacked</h2>
      <p>
        Start on any note (the <b>root</b>), skip one scale note, take the next (the <b>3rd</b>), skip one, take the next (the <b>5th</b>). That three-note chord is a <b>triad</b>, and it's named after its root.
      </p>
      <Keys from="C4" to="B4" marks={{ C4: 'R', E4: '3', G4: '5' }} caption="C major: root C, 3rd E, 5th G. Try “Together”, then “One by one”." />
      <p>
        The two 3rds can each be major (4 half steps) or minor (3), which gives exactly four kinds of triad. Hear them all built on C:
      </p>
      <Spec
        rows={[
          [<P key="k411-13" notes="C4 E4 G4">major</P>, <><b>C E G</b> · major 3rd + minor 3rd. Bright, stable, resolved. The default chord of pop music.</>],
          [<P key="k412-13" notes="C4 Eb4 G4">minor</P>, <><b>C E♭ G</b> · minor 3rd + major 3rd. Darker, softer, more inward. Only the middle note changed.</>],
          [<P key="k413-13" notes="C4 Eb4 Gb4">diminished</P>, <><b>C E♭ G♭</b> · two minor 3rds. Tense and unstable; it almost always moves on quickly to another chord.</>],
          [<P key="k414-13" notes="C4 E4 G#4">augmented</P>, <><b>C E G♯</b> · two major 3rds. Eerie and suspended in mid-air. Rare, used as a passing chord to add a lift.</>],
        ]}
      />
      <Keys from="C4" to="B4" marks={{ C4: 'R', 'D#4': { label: '♭3', color: B }, G4: '5' }} caption="C minor. The 3rd drops a half step, from E to E♭. One key, a different world." />
      <Why>
        The <b>5th</b> gives a chord its strength and the <b>3rd</b> gives it its mood. The 5th is so stable that it adds almost no colour, which is why you can leave it out of a chord without changing its character, but drop the 3rd and you can no longer tell whether it's major or minor.
      </Why>
      <p>Stack 3rds using only the notes of a major key and you get the same pattern in every key: three major chords, three minor chords and one diminished.</p>
      <ChordsInKey tonic="C" caption="The seven chords of C major, built only from white keys. Click each one. You'll learn what the numerals and colours mean in the Roman numerals lesson." />

      <h2>Seventh chords: one more 3rd on top</h2>
      <p>
        Add another 3rd above the 5th and you get a <b>seventh chord</b>: four notes, more colour, more sophistication. There are four you will see constantly.
      </p>
      <Spec
        rows={[
          [<P key="k430-13" notes="C4 E4 G4 B4">Cmaj7</P>, <><b>C E G B</b> · major 7th. Dreamy, soft, a little wistful. The home sound of bossa nova, neo-soul and lo-fi.</>],
          [<P key="k431-13" notes="C4 E4 G4 Bb4">C7</P>, <><b>C E G B♭</b> · dominant 7th. Bluesy and restless. On the 5th chord of a key it pulls hard back to the 1. Blues uses it on every chord.</>],
          [<P key="k432-13" notes="C4 Eb4 G4 Bb4">Cm7</P>, <><b>C E♭ G B♭</b> · minor 7th. Smooth, mellow minor, less sad than a plain minor triad. Funk, R&B and house live on it.</>],
          [<P key="k433-13" notes="B3 D4 F4 A4">Bø7</P>, <><b>B D F A</b> · half-diminished (m7♭5). Dark and questioning; it usually leads to a minor chord. Common in jazz and film.</>],
        ]}
      />
      <Keys from="C4" to="C5" marks={{ C4: 'R', E4: '3', G4: '5', B4: { label: '7', color: '#a07ae0' } }} caption="Cmaj7: a C major triad with B, a major 7th above the root, on top." />
      <Compare
        items={[
          {
            label: 'Triads',
            title: 'C Am Dm G',
            bpm: 84,
            chordsAbove: 'C Am Dm G',
            parts: [{ inst: 'electric-piano', label: 'Chords', notes: chords('C Am Dm G', { withRoot: true }) }],
            caption: 'Clean and simple.',
          },
          {
            label: 'Sevenths',
            verdict: 'better',
            title: 'Cmaj7 Am7 Dm7 G7',
            bpm: 84,
            chordsAbove: 'Cmaj7 Am7 Dm7 G7',
            parts: [{ inst: 'electric-piano', label: 'Chords', notes: chords('Cmaj7 Am7 Dm7 G7', { withRoot: true }) }],
            caption: 'Same roots, one extra note each. Instantly warmer and jazzier.',
          },
        ]}
      />
      <p>
        "Better" depends on the song. Sevenths sound lush and grown-up, but in a punchy rock song or a simple folk tune they can sound fussy. Pick them on purpose, not by default.
      </p>

      <h2>Sus, add9 and power chords</h2>
      <p>These change the triad recipe slightly, and each is a staple of modern songwriting.</p>
      <Cards
        items={[
          { tag: 'C D G', title: 'sus2', body: <>Swap the 3rd for the 2nd. Open, airy, neither happy nor sad. <P notes="C4 D4 G4">hear it</P></> },
          { tag: 'C F G', title: 'sus4', body: <>Swap the 3rd for the 4th. "Suspended": it aches to fall back to the 3rd. <P notes="C4 F4 G4">hear it</P></> },
          { tag: 'C E G D', title: 'add9', body: <>A major triad plus the 9th (the 2nd, an octave up). Major with sparkle; all over indie and worship guitar. <P notes="C4 E4 G4 D5">hear it</P></> },
          { tag: 'C G', title: 'Power chord (C5)', body: <>Just root and 5th. Neither major nor minor, so it fits any riff. <P notes="C3 G3 C4">hear it</P></> },
        ]}
      />
      <Example
        title="Sus4 chords resolving"
        bpm={88}
        chordsAbove="Csus4:2 C:2 Gsus4:2 G:2 Fsus2:2 F:2 Csus4:2 C:2"
        parts={[{ inst: 'grand-piano', label: 'Chords', notes: chords('Csus4:2 C:2 Gsus4:2 G:2 Fsus2:2 F:2 Csus4:2 C:2', { withRoot: true }) }]}
        caption="Each sus chord holds back the 3rd for two beats, then lets it in. A cheap and very effective way to add movement to a chord that would otherwise just sit there."
      />
      <Why title="Why rock guitar uses power chords">
        Distortion adds strong extra overtones to every note. With a full triad, the overtones of the 3rd clash with everything else and the chord turns to mush. A bare 5th has overtones that line up neatly, so it stays tight and huge under heavy distortion. That's why "Smells Like Teen Spirit" and most punk and metal riffs are power chords: the guitarists aren't avoiding 3rds out of laziness.
      </Why>

      <h2>Reading chord symbols</h2>
      <p>Chord symbols are a compact code. Once you know it, you can read any lead sheet or chord chart.</p>
      <Spec
        rows={[
          ['C', 'C major. A letter alone always means a major triad.'],
          ['Cm · Cmin · C−', 'C minor.'],
          ['C7', 'Dominant 7th: C E G B♭. A plain “7” always means the flat 7th.'],
          ['Cmaj7 · CΔ7', 'Major 7th: C E G B. The “maj” refers to the 7th, not the chord.'],
          ['Cm7', 'Minor 7th: C E♭ G B♭.'],
          ['Cdim · C°', 'Diminished triad: C E♭ G♭.'],
          ['Cø7 · Cm7♭5', 'Half-diminished: C E♭ G♭ B♭.'],
          ['Caug · C+', 'Augmented: C E G♯.'],
          ['Csus2 · Csus4', 'The 3rd replaced by the 2nd or 4th.'],
          ['Cadd9 · C5', 'Major triad plus the 9th · power chord (root and 5th only).'],
          ['C/E', 'A slash chord: a C chord with E as the lowest note. The letter after the slash is the bass note.'],
        ]}
      />
      <Watch title="C7 is not C major 7">
        The most common chord-reading mistake. <b>C7</b> has a B♭ and sounds bluesy and restless: <P notes="C4 E4 G4 Bb4">C7</P>. <b>Cmaj7</b> has a B natural and sounds soft and dreamy: <P notes="C4 E4 G4 B4">Cmaj7</P>. They are a half step apart in one note and nothing alike in feel.
      </Watch>

      <h2>Writing chords in BandForge</h2>
      <Try>
        <Steps>
          <li>
            Click <Ui>Chords</Ui> in the toolbar above your tracks to show the chord track, right-click it and choose <b>Add chord here…</b>. The picker shows the chords <b>In the key</b>, and under <b>Any chord</b> you can pick any root and quality: maj, m, 7, maj7, sus and more. Each chord plays when you pick it.
          </li>
          <li>
            To build chords note by note, open a region in the <Ui>Score</Ui>, write the root, select it and press <K>Alt</K>+<K>3</K> then <K>Alt</K>+<K>5</K>. BandForge adds the 3rd and 5th above, staying in the key: a triad in two keystrokes. <K>Alt</K>+<K>7</K> adds the 7th.
          </li>
          <li>
            In the <Ui>Piano Roll</Ui>, count rows from the root: <b>+4 and +7</b> for major, <b>+3 and +7</b> for minor, add <b>+10</b> or <b>+11</b> for a 7th or major 7th.
          </li>
        </Steps>
      </Try>
      <Pro>
        Players rarely play all of a chord's notes in every instrument. A pianist might leave out the 5th, a bass plays just the root, a guitarist plays a shape with the 3rd on top. The chord is the <em>idea</em>; how you spread it across the band is arranging. You'll learn how in the harmony and arranging chapters.
      </Pro>
    </>
  ),
};

// ------------------------------------------------------------------ 5. inversions

const inversions: Lesson = {
  id: 'voice-leading',
  title: 'Inversions and voice leading',
  minutes: 9,
  summary: 'Why chords played in root position sound clunky, and how inversions and smooth voice leading make the same progression sound like a pro played it.',
  keywords: 'inversion first inversion second inversion root position voice leading common tone slash chord bass line smooth chords voicing parallel fifths',
  body: () => (
    <>
      <Lead>
        Here's a secret that instantly makes beginners sound better: you don't have to play chords with the root at the bottom. The <b>same three notes</b> can be stacked in any order, and choosing the order well is what makes chords flow instead of jump.
      </Lead>

      <h2>Three ways to stack a C chord</h2>
      <Spec
        rows={[
          [<P key="k542-13" notes="C4 E4 G4">root position</P>, <><b>C E G</b> · root at the bottom. Solid and grounded. Ideal for the first and last chord of a song.</>],
          [<P key="k543-13" notes="E4 G4 C5">1st inversion</P>, <><b>E G C</b> · the 3rd at the bottom. Lighter, more in motion. Written <b>C/E</b> when the bass plays the E.</>],
          [<P key="k544-13" notes="G3 C4 E4">2nd inversion</P>, <><b>G C E</b> · the 5th at the bottom. Floating and unstable. Written <b>C/G</b>.</>],
        ]}
      />
      <Keys from="C4" to="E5" marks={{ E4: '3', G4: '5', C5: 'R' }} caption="First inversion: the root C has moved up an octave, so E is now the lowest note." />

      <h2>Why root position everywhere sounds clunky</h2>
      <p>
        If you play every chord with its root at the bottom, your whole hand jumps up and down the keyboard as the chords change. Each note leaps, and the result sounds like separate blocks of sound rather than music moving forward. Compare:
      </p>
      <Compare
        items={[
          {
            label: 'Every chord in root position',
            verdict: 'worse',
            title: 'C Am F G C',
            bpm: 80,
            names: true,
            chordsAbove: 'C Am F G C',
            parts: [{ inst: 'grand-piano', label: 'Chords', notes: chords('C Am F G C', { lead: false }) }],
            caption: 'Every note jumps at every change.',
          },
          {
            label: 'Voice-led',
            verdict: 'better',
            title: 'Same chords, closest notes',
            bpm: 80,
            names: true,
            chordsAbove: 'C Am F G C',
            parts: [{ inst: 'grand-piano', label: 'Chords', notes: chords('C Am F G C') }],
            caption: 'Notes stay put or move a step. It sounds like one hand playing, not five chords pasted together.',
          },
        ]}
      />

      <h2>The two rules of voice leading</h2>
      <p>
        Think of each note in a chord as a separate singer, a <b>voice</b>. Voice leading is deciding where each singer goes next. Two rules get you 90% of the way:
      </p>
      <ol>
        <li>
          <b>Keep common tones.</b> If the next chord shares a note with this one, keep it in the same voice. C (C E G) and Am (A C E) share C and E, so only one note needs to move.
        </li>
        <li>
          <b>Move the rest by the smallest step.</b> Any note that has to change goes to the nearest note of the new chord, ideally a step away.
        </li>
      </ol>
      <Example
        title="Three voices, each moving as little as possible"
        names
        bpm={76}
        chordsAbove="C Am F G C"
        parts={[
          { inst: 'string-ensemble', label: 'Upper voices', notes: line('C4+E4+G4:4 C4+E4+A4:4 C4+F4+A4:4 B3+D4+G4:4 C4+E4+G4:4') },
          { inst: 'synth-bass', label: 'Bass', notes: bass('C Am F G C'), vol: 0.85 },
        ]}
        caption="C stays put through three chords. G moves to A and back. When the G chord arrives, C slips down to B and F to D, then they return home. Mute the bass and each line is almost a melody in itself."
      />
      <Why>
        Your ear follows lines, not blocks. When every voice moves by step, you hear several smooth melodies weaving together, which is how a choir or string section sounds. When every voice leaps, your ear can't follow any of them, so the music sounds lumpy. Bach taught harmony this way three hundred years ago, and it still applies to synth pads today.
      </Why>

      <h2>Inversions make bass lines</h2>
      <p>
        Inversions also let the <b>bass</b> move by step instead of leaping between roots. A walking-down bass under familiar chords is one of the most loved sounds in pop. Procol Harum's "A Whiter Shade of Pale" is built on exactly this kind of descending line.
      </p>
      <Example
        title="A bass line walking down with slash chords"
        names
        bpm={78}
        chordsAbove="C:2 G/B:2 Am:2 Am/G:2 F:2 C/E:2 Dm:2 G:2"
        parts={[{ inst: 'grand-piano', label: 'Piano', notes: chords('C:2 G/B:2 Am:2 Am/G:2 F:2 C/E:2 Dm:2 G:2') }]}
        caption="Watch the lowest notes: C, B, A, G, F, E, D, then G. The chords are ordinary, but the stepping bass turns them into a journey."
      />
      <Watch title="Careful with second inversions">
        A chord with its 5th in the bass (like C/G) sounds unstable. That's fine as a passing chord on a weak beat, or just before the big ending chord, but if you put one on beat 1 at the start of a phrase it sounds like the floor has given way. As a rule of thumb, use 2nd inversions in passing and root position or 1st inversion everywhere else.
      </Watch>
      <Pro>
        Pianists keep the right hand in a small zone around middle C and choose whichever inversion is closest, while the left hand plays the root or a moving bass. Arrangers write string and synth pads exactly the same way. If your pad part jumps more than a few rows between chords, re-voice it.
      </Pro>

      <h2>Voice leading in BandForge</h2>
      <Try>
        <Steps>
          <li>
            Write a few block chords in the <Ui>Piano Roll</Ui>. To invert one, select just its lowest note and press <K>⌘</K>/<K>Ctrl</K>+<K>↑</K> to move it up an octave. Do it again for the next inversion.
          </li>
          <li>
            Go through your chords left to right. For each chord, pick the inversion whose notes are closest to the previous chord's. Your notes should form near-horizontal lines across the roll.
          </li>
          <li>
            Put the root (or a stepping bass note) on a separate bass track, an octave or two lower, so the upper chords are free to use any inversion.
          </li>
          <li>
            Open <Ui>Check</Ui> (<K>⇧</K>+<K>W</K>). It flags parallel 5ths and octaves between melodic lines, a sign that two voices are moving in lockstep rather than as independent lines.
          </li>
        </Steps>
      </Try>
    </>
  ),
};

// ------------------------------------------------------------------ 6. rhythm

const rhythm: Lesson = {
  id: 'rhythm',
  title: 'Rhythm, meter and syncopation',
  minutes: 10,
  summary: 'Beats, bars, note lengths and time signatures, then the good stuff: syncopation, pushes and swing, the rhythmic tricks that make music feel alive.',
  keywords: 'rhythm beat bar measure tempo bpm note value quarter eighth sixteenth triplet dotted time signature 4/4 3/4 6/8 waltz odd meter syncopation anticipation push swing shuffle groove quantize',
  body: () => (
    <>
      <Lead>
        Pitch is <em>what</em> you play; rhythm is <em>when</em>. Listeners forgive an odd note far more easily than a sloppy rhythm, and a simple melody with a great rhythm beats a clever melody with a dull one almost every time.
      </Lead>

      <h2>Beats, bars and note lengths</h2>
      <p>
        The <b>beat</b> is the steady pulse you tap your foot to. Its speed is the <b>tempo</b>, in beats per minute (BPM): around 70 feels slow, 100 relaxed, 120 is classic dance-pop, 170 is drum and bass. Beats are grouped into <b>bars</b> (measures), usually four beats each.
      </p>
      <Spec
        rows={[
          ['Whole note', '4 beats: a whole bar of 4/4.'],
          ['Half note', '2 beats.'],
          ['Quarter note', '1 beat. The basic pulse in most music.'],
          ['Eighth note', '½ beat. Two per beat: “1-and-2-and”.'],
          ['Sixteenth note', '¼ beat. Four per beat: “1-e-and-a”. The busy hi-hats of pop and hip-hop.'],
          ['Dotted note', '1½ times as long. A dotted quarter is 1½ beats.'],
          ['Triplet', 'Three notes in the space of two. Gives a rolling, lilting feel.'],
        ]}
      />
      <Example
        title="Quarters, then eighths, then sixteenths on the hi-hat"
        bpm={96}
        parts={[
          {
            inst: 'kit-acoustic',
            label: 'Drums',
            notes: drums({ k: 'x.......x.......x.......x.......x.......x.......', s: '....x.......x.......x.......x.......x.......x...', h: 'x...x...x...x...x.x.x.x.x.x.x.x.xxxxxxxxxxxxxxxx' }),
          },
        ]}
        mark={[
          [0, 4, 'quarters'],
          [4, 8, 'eighths'],
          [8, 12, 'sixteenths'],
        ]}
        caption="The kick and snare stay the same. Only the hi-hat subdivides, and the energy rises bar by bar. Busier subdivisions are one of the simplest ways to build intensity."
      />

      <h2>Time signatures</h2>
      <p>
        The time signature tells you how beats are grouped. The top number is how many beats are in a bar; the bottom says what kind of note gets the beat. You only need to know a few:
      </p>
      <Cards
        items={[
          { tag: '4/4', title: 'Common time', body: 'Four beats per bar. The vast majority of pop, rock, hip-hop and dance music.' },
          { tag: '3/4', title: 'Waltz time', body: 'Three beats: ONE two three. Lilting and old-fashioned in a lovely way: “Moon River”, Billy Joel’s “Piano Man”.' },
          { tag: '6/8', title: 'Two big beats, each split in three', body: 'ONE two three FOUR five six. Swaying and rolling: “House of the Rising Sun”, “We Are the Champions”.' },
          { tag: '5/4 · 7/4', title: 'Odd meters', body: 'A bar that feels slightly too long or short, which makes it restless: Dave Brubeck’s “Take Five” (5/4), Pink Floyd’s “Money” (7/4).' },
        ]}
      />
      <Compare
        items={[
          {
            label: '3/4 waltz',
            title: 'Bass on 1, chords on 2 and 3',
            bpm: 132,
            meter: 3,
            length: 12,
            chordsAbove: [
              [0, 'C'],
              [3, 'G'],
              [6, 'F'],
              [9, 'G'],
            ],
            parts: [{ inst: 'grand-piano', label: 'Piano', notes: line('C3:1 E4+G4+C5? E4+G4+C5? | G2 D4+G4+B4? D4+G4+B4? | F2 F4+A4+C5? F4+A4+C5? | G2 D4+G4+B4? D4+G4+B4?') }],
          },
          {
            label: '6/8',
            title: 'Accents on 1 and 4',
            bpm: 120,
            meter: 3,
            parts: [{ inst: 'kit-acoustic', label: 'Drums', notes: drums({ k: 'X.....x.....', s: '...X.....X..', h: 'xxxxxxxxxxxx' }, { step: 0.5, bars: 2 }) }],
          },
        ]}
      />

      <h2>Syncopation and pushes</h2>
      <p>
        Most of the time, important notes land on the beat. <b>Syncopation</b> means accenting the spaces in between. The most useful kind is the <b>push</b> (or anticipation): landing a note half a beat <em>early</em>, before the beat it belongs to. It's in almost every pop chorus, and it's the reason they feel urgent.
      </p>
      <Compare
        items={[
          {
            label: 'On the beat',
            title: 'Every phrase lands on beat 1',
            bpm: 100,
            names: true,
            chordsAbove: 'C Am F G',
            parts: [
              { inst: 'electric-piano', label: 'Melody', notes: line('G4:1 G4 A4 G4 | E4:4 | G4:1 G4 A4 G4 | D5:4') },
              { inst: 'grand-piano', label: 'Chords', notes: chords('C Am F G', { center: 52 }), vol: 0.6 },
              { inst: 'kit-acoustic', label: 'Drums', notes: drums({ k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 4 }), vol: 0.7 },
            ],
          },
          {
            label: 'Pushed',
            verdict: 'better',
            title: 'The long notes arrive half a beat early',
            bpm: 100,
            names: true,
            chordsAbove: 'C Am F G',
            mark: [
              [3.5, 4, 'push'],
              [11.5, 12, 'push'],
            ],
            parts: [
              { inst: 'electric-piano', label: 'Melody', notes: line('G4:1 G4 A4 G4:0.5 E4:4 r:0.5 | G4:1 G4 A4 G4:0.5 D5:4.5') },
              { inst: 'grand-piano', label: 'Chords', notes: chords('C Am F G', { center: 52 }), vol: 0.6 },
              { inst: 'kit-acoustic', label: 'Drums', notes: drums({ k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 4 }), vol: 0.7 },
            ],
            caption: 'Same notes. The melody just jumps the gun, and suddenly it leans forward.',
          },
        ]}
      />
      <Why>
        Your brain predicts the beat. A note that arrives early breaks that prediction in a small, pleasant way, like stressing a word in a sentence. Because the drums keep the beat steady, the listener never gets lost; they just feel the melody straining forward against it. That tension between a steady pulse and a restless melody is what people mean by "groove".
      </Why>
      <Watch title="Don't syncopate everything">
        If nothing lands on the beat, the ear stops hearing the beat, and then nothing sounds syncopated at all, just confused. Keep something anchored (usually kick, bass and the start of some phrases) and let the melody push against it.
      </Watch>

      <h2>Straight, triplet and swing feel</h2>
      <p>
        Each beat can be split into <b>two</b> (straight) or <b>three</b> (triplets): <P melody="C4:1/3 D4 E4 F4:1/3 G4 A4 B4:1/3 A4 G4 C5:1" bpm={90}>triplets</P>. <b>Swing</b> sits between the two: the second eighth of each beat is played late, so pairs of eighths go "long-short, long-short". It's the bounce of jazz, blues shuffles, hip-hop and lo-fi.
      </p>
      <Compare
        items={[
          {
            label: 'Straight eighths',
            title: 'Even and driving',
            bpm: 96,
            parts: [{ inst: 'kit-acoustic', label: 'Drums', notes: drums({ k: 'x...x...', s: '..x...x.', h: 'xxxxxxxx' }, { step: 0.5, bars: 2 }) }],
          },
          {
            label: 'Swung eighths',
            title: 'Every second eighth played late',
            bpm: 96,
            parts: [{ inst: 'kit-acoustic', label: 'Drums', notes: drums({ k: 'x...x...', s: '..x...x.', h: 'xxxxxxxx' }, { step: 0.5, bars: 2, swing: 0.33 }) }],
            caption: 'Look at the hi-hat dots: the off-beats have shifted right.',
          },
        ]}
      />

      <h2>Rhythm in BandForge</h2>
      <Try>
        <Steps>
          <li>
            Set the speed in the <Ui>TEMPO</Ui> readout in the top bar. Click the <Ui>TIME</Ui> readout to change the time signature in Song Settings; the <Ui>Tempo</Ui> lane lets you change tempo or meter partway through a song.
          </li>
          <li>
            In the <Ui>Piano Roll</Ui>, the grid menu sets the note length you draw: <b>1/4</b> is a quarter note, <b>1/8</b> an eighth, <b>1/16</b> a sixteenth, and <b>1/8T</b> and <b>1/16T</b> are triplets. Press <K>Q</K> to quantize selected notes onto the grid.
          </li>
          <li>
            For swing, use the <Ui>Swing</Ui> button in the editor toolbar for one region, or the <Ui>SWING</Ui> readout in the top bar for the whole song.
          </li>
          <li>
            In the <Ui>Score</Ui>, number keys choose durations (<K>5</K> quarter, <K>4</K> eighth, <K>3</K> sixteenth, <K>6</K> half), <K>.</K> adds a dot and <K>⌘</K>/<K>Ctrl</K>+<K>3</K> switches triplets on and off.
          </li>
          <li>To try a push, write a phrase on the beat, then select its long notes and drag them half a beat earlier.</li>
        </Steps>
      </Try>
      <Pro>
        Producers usually quantize drums and bass tightly, because they hold the groove together, but leave melodies and chords slightly loose, or quantize them and then nudge a few notes by hand. Perfectly quantized everything can sound robotic. A little imperfection, plus varied note velocities (open the velocity lane in the piano roll), is what makes a part sound played rather than programmed.
      </Pro>
    </>
  ),
};

// ------------------------------------------------------------------ 7. roman numerals

const numerals: Lesson = {
  id: 'roman-numerals',
  title: 'Roman numerals: chords as numbers',
  minutes: 8,
  summary: 'Musicians describe chords by their position in the key: I, IV, V, vi. Learn the system, why it beats memorising chord names, and how it lets you play any progression in any key.',
  keywords: 'roman numerals numbers nashville number system I IV V vi ii iii vii diatonic function tonic subdominant dominant transpose progression key',
  body: () => (
    <>
      <Lead>
        Chord names tell you <em>which</em> chords. Numbers tell you <em>what they're doing</em>. Learn a progression as numbers and you've learned it in all twelve keys at once.
      </Lead>

      <h2>Number the chords of a key</h2>
      <p>
        Build a triad on each note of the scale and number it by its scale degree with a Roman numeral. <b>Upper case</b> means major, <b>lower case</b> means minor, and <b>°</b> means diminished. In every major key you get the same pattern: <b>I ii iii IV V vi vii°</b>.
      </p>
      <ChordsInKey tonic="C" caption="C major. Click the cards to hear each chord." />
      <p>The colours show each chord's job, which matters more than its name:</p>
      <Cards
        items={[
          { title: 'Home', color: '#5dbb7a', tag: 'I · iii · vi', body: 'Stable. The I chord is home base; vi and iii share two of its notes, so they feel like rooms in the same house. The vi is home with the lights dimmed.' },
          { title: 'Away', color: '#5b9be0', tag: 'ii · IV', body: 'Leaving home. These open things up and prepare for tension. IV is the warm, hopeful one; ii is its softer minor cousin.' },
          { title: 'Tension', color: '#e8a33d', tag: 'V · vii°', body: 'Wants to go home. V contains the leading tone (7th degree of the scale), which pulls up into the tonic, so V → I is the strongest move in music.' },
        ]}
      />
      <Why>
        Most progressions just cycle <b>home → away → tension → home</b>. Once you hear chords as jobs rather than letters, you can guess what will sound good next, spot why a progression feels unfinished (it stopped on a tension chord), and fix it.
      </Why>

      <h2>One progression, every key</h2>
      <p>
        The progression <b>I–V–vi–IV</b> is behind a huge number of hits: "Let It Be", "With or Without You", "Don't Stop Believin'", "Someone Like You". In C it's C G Am F; in E it's E B C♯m A. Different names, same numbers, same sound, just higher.
      </p>
      <Compare
        items={[
          {
            label: 'I–V–vi–IV in C',
            title: 'C G Am F',
            bpm: 90,
            chordsAbove: 'C G Am F',
            parts: [
              { inst: 'grand-piano', label: 'Chords', notes: chords('C G Am F') },
              { inst: 'synth-bass', label: 'Bass', notes: bass('C G Am F', { style: 'root5' }), vol: 0.8 },
            ],
          },
          {
            label: 'I–V–vi–IV in E',
            title: 'E B C♯m A',
            bpm: 90,
            chordsAbove: 'E B C♯m A',
            parts: [
              { inst: 'grand-piano', label: 'Chords', notes: chords('E B C#m A') },
              { inst: 'synth-bass', label: 'Bass', notes: bass('E B C#m A', { style: 'root5' }), vol: 0.8 },
            ],
            caption: 'Same shape, four half steps higher.',
          },
        ]}
      />
      <ChordsInKey tonic="G" caption="G major: the jobs and colours sit in exactly the same places. Click I, V, vi, IV and you'll hear the same progression again." />

      <h2>Progressions worth knowing by number</h2>
      <Spec
        rows={[
          [<P key="k887-13" chords="C G Am F">I–V–vi–IV</P>, 'The modern pop progression. Uplifting and familiar.'],
          [<P key="k888-13" chords="Am F C G">vi–IV–I–V</P>, 'The same four chords started on vi: instantly more bittersweet. A favourite for emotional choruses.'],
          [<P key="k889-13" chords="C Am F G">I–vi–IV–V</P>, 'The 1950s doo-wop progression, from “Stand By Me” to countless ballads. Nostalgic and sweet.'],
          [<P key="k890-13" chords="C F G C">I–IV–V–I</P>, 'Rock ’n’ roll, folk and blues in their simplest form: “Twist and Shout”, “La Bamba”.'],
          [<P key="k891-13" chords="Dm7 G7 Cmaj7:4">ii–V–I</P>, 'The backbone of jazz. Away, tension, home in the smoothest possible way.'],
          [<P key="k892-13" chords="Am F C G">i–VI–III–VII</P>, 'The same chords as vi–IV–I–V but heard in A minor: epic, driving minor. Film trailers and anthems.'],
        ]}
      />
      <Watch title="Minor keys count from the minor chord">
        In A minor, Am is <b>i</b>, not vi, even though it uses the same chords as C major. Numerals are always relative to <em>home</em>, and the home chord changes how everything around it feels. Minor keys use <b>i ii° III iv v VI VII</b>.
      </Watch>

      <h2>Try it: line up chords by their job</h2>
      <p>
        Pick a key and click chords to build a progression, then loop it. Try home → away → tension → home (I–IV–V–I), then start somewhere unusual and see whether it still feels like it's going somewhere. Nothing here touches your song; it's a scratch pad for your ears.
      </p>
      <ProgressionPad />

      <h2>Numbers in BandForge</h2>
      <Try>
        <Steps>
          <li>
            Show the chord track with <Ui>Chords</Ui> in the toolbar above the tracks, right-click it and choose <b>Add chord here…</b>. The <b>In the key</b> row lists all seven chords of your song's key with their Roman numeral underneath each name, so you can think in numbers and click names.
          </li>
          <li>
            Write a progression by numbers, for example I–vi–IV–V. Then click the <Ui>KEY</Ui> readout in the top bar, tick <b>Transpose existing notes to the new key</b> and choose a new root. The whole song moves; the numbers stay the same.
          </li>
          <li>
            Write the numerals of your song's chorus on paper. If it ends on V, that's why it feels like it needs to repeat. If it ends on I, it feels finished.
          </li>
        </Steps>
      </Try>
      <Pro title="The Nashville number system">
        Session musicians in Nashville write chord charts as plain numbers (1, 4, 5, 6m) instead of chord names. When a singer walks in and says "let's do it a step higher", the whole band just plays the same chart in a new key, no rewriting needed. Thinking this way is the single biggest shortcut to playing by ear: hear "that's a 4 chord", and you know it in every key.
      </Pro>
    </>
  ),
};

const chapter: Chapter = {
  id: 'theory',
  title: 'Music Theory That Matters',
  blurb: 'Notes, intervals, scales and chords, explained by what they sound like and what to do with them.',
  icon: GraduationCap,
  color: '#5dbb7a',
  lessons: [notes, intervals, scales, chordsLesson, inversions, rhythm, numerals],
};

export default chapter;
