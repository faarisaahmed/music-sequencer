import type { Lesson } from '../types';
import { Cards, Compare, Example, K, Lead, Listen, PlayChip as P, Pro, SectionMap, Spec, Steps, Tip, Try, Ui, Watch, Why } from '../figures';
import { at, bass, chords, drums, line, repeat, transpose, type GNote } from '../notation';

/** Steady eighth-note "chugs" of one chord: chug('A2+E3+A3', 4) → four beats of eighths. */
const chug = (chord: string, beats: number) => Array.from({ length: beats * 2 }, () => chord + ':0.5').join(' ');

/** Octave-jumping synth bass, one root per bar: octaves(['A1', 'F1']) → A1 A2 A1 A2… in eighths. */
function octaves(roots: string[], beatsEach = 4): GNote[] {
  const toks: string[] = [];
  for (const r of roots) {
    const up = r.replace(/(-?\d)$/, (d) => String(Number(d) + 1));
    for (let i = 0; i < beatsEach; i++) toks.push(`${r}:0.5`, `${up}:0.5`);
  }
  return line(toks.join(' '), { gate: 0.8 });
}

/** A 16th-note arpeggio written out: each chord's notes cycled up and back. */
function arp16(shapes: string[][], beatsEach = 4): GNote[] {
  const toks: string[] = [];
  for (const s of shapes) {
    const cycle = [...s, ...s.slice(1, -1).reverse()];
    for (let i = 0; i < beatsEach * 4; i++) toks.push(cycle[i % cycle.length] + ':0.25');
  }
  return line(toks.join(' '), { gate: 0.7, v: 0.7 });
}

/** Scale a phrase's velocities along a curve (0–1 position → velocity). */
const shape = (notes: GNote[], curve: (pos: number) => number): GNote[] => {
  const end = Math.max(...notes.map((x) => x.t)) || 1;
  return notes.map((x) => ({ ...x, v: curve(x.t / end) }));
};

// ------------------------------------------------------------------ shared material

const classicalTune = line('E5:1.5 F5:0.5 G5:1 E5:1 | F5:1.5 E5:0.5 D5:1 C5:1 | E5:1 C5:1 G4:1 C5:1 | D5:3 r:1 | E5:1.5 F5:0.5 G5:1 E5:1 | A5:1.5 G5:0.5 F5:1 A5:1 | G5:1 F5:1 D5:1 B4:1 | C5:3 r:1');
const classicalChords = 'C F C G C F G7 C';

const popHook = line('r:0.5 B4:0.5 B4:0.5 D5:1 B4:0.5 A4:1 | A4:0.5 A4:0.5 F#4:1 D4:2 | r:0.5 B4:0.5 B4:0.5 D5:1 B4:0.5 G4:1 | E4:1.5 G4:2.5');
const popBeat = drums({ k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 4 });

const rockRiff = line('E3:0.5 E3 G3 E3 A3 E3 A#3:0.25 A3:0.25 G3:0.5 | E3:0.5 E3 G3 E3 D3:1 B2:1');
const rockBeat = drums({ k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 4 });

const waveLead = line('E5:1.5 D5:0.5 C5:1 B4:0.5 C5:0.5 | A4:3 r:1 | G4:0.5 A4:0.5 C5:1 E5:1 G5:1 | D5:3 r:1');
const waveArp = arp16([
  ['A3', 'C4', 'E4', 'A4'],
  ['F3', 'A3', 'C4', 'F4'],
  ['C4', 'E4', 'G4', 'C5'],
  ['G3', 'B3', 'D4', 'G4'],
]);

const lofiMelody = line('r:1 E5:0.5 D5:0.5 C5:1 A4:1 | r:2 B4:0.5 A4:0.5 G4:1 | r:1 A4:0.5 C5:0.5 E5:1 D5:1 | C5:3 r:1', { v: 0.65 });

const lessons: Lesson[] = [
  // ================================================================== classical
  {
    id: 'classical',
    title: 'Classical and orchestral',
    minutes: 11,
    summary: 'How Mozart-era music is put together: balanced question-and-answer phrases, chords with clear jobs, Alberti bass, smooth voice leading, layering an orchestra and shaping dynamics. Then write your own short piece in the style.',
    keywords: 'classical orchestra orchestral mozart haydn beethoven alberti bass cadence period phrase minuet ternary rondo strings voice leading dynamics crescendo sonata',
    body: () => (
      <>
        <Lead>
          Classical music sounds "proper" for a reason: it is built from a small set of very strict, very balanced habits. Learn those habits and you can write something that sounds genuinely period-correct in an afternoon. Break them deliberately and you get film music, which is the next lesson.
        </Lead>
        <Spec
          title="The recipe"
          rows={[
            ['Tempo', 'Slow movements around 60–80 BPM (Adagio, Andante). Lively ones 120–160 BPM (Allegro). Minuets sit near 110–130 BPM in 3/4.'],
            ['Keys', 'Major keys with few sharps or flats: C, G, D, F, B♭, E♭. Minor (D minor, C minor, G minor) for storms and drama.'],
            ['Chords', 'Mostly I, IV, V and V7, with ii and vi for colour. Every phrase ends on a cadence (V→I, or a pause on V).'],
            ['Instruments', 'Grand Piano or Harpsichord (earlier, Baroque); a string section (Violin, String Ensemble, Cello, Upright Bass (Bowed)); winds for colour (Flute, Clarinet, Bassoon, French Horn).'],
            ['Drums', 'None. The rhythm lives in the accompaniment pattern. Orchestras added timpani on the tonic and dominant at big moments.'],
            ['Structure', 'Four-bar phrases paired into eight-bar "periods". Whole pieces in ternary form (A B A), minuet and trio, or rondo (A B A C A).'],
          ]}
        />

        <h2>The eight-bar period: a question and its answer</h2>
        <p>
          The basic unit of classical music is the <b>period</b>: eight bars split into two four-bar halves that start the same way. The first half (the <b>antecedent</b>) ends on the V chord, which sounds like a question or a comma. The second half (the <b>consequent</b>) starts identically and ends on I, which sounds like a full stop. The listener hears the opening again, expects the same ending, and gets a more complete one instead.
        </p>
        <Example
          title="An original period in C major, with Alberti bass"
          bpm={104}
          chordsAbove={classicalChords}
          mark={[
            [12, 16, 'question (ends on V)'],
            [28, 32, 'answer (ends on I)'],
          ]}
          parts={[
            { inst: 'grand-piano', label: 'Melody', notes: classicalTune, vol: 1.05 },
            { inst: 'grand-piano', label: 'Alberti bass', notes: chords(classicalChords, { style: 'broken', center: 54, v: 0.55 }) },
          ]}
          caption="Bars 1–4 end on G (a half cadence, the question). Bars 5–8 start the same way, climb higher, and finish on C (a perfect cadence, the answer). Mute the melody to hear the Alberti pattern on its own."
        />
        <Why>
          A pause on V is unstable because V contains the leading note (B in C major), which pulls hard up to the tonic. Ending the first half there leaves the ear leaning forward. When the second half finally resolves V→I, the four bars of waiting are paid off. That's why classical tunes feel so complete: every eight bars contains a full cycle of tension and release.
        </Why>

        <h2>Alberti bass: the engine of the accompaniment</h2>
        <p>
          Named after Domenico Alberti, it breaks each chord into a repeating <b>low, high, middle, high</b> pattern in steady eighth notes. Mozart's Piano Sonata in C, K. 545, opens with one. It keeps the music moving without drums and spells out the harmony so clearly that the melody can be very simple on top.
        </p>
        <ul>
          <li>Keep it <b>low and quiet</b>, roughly C3 to C4, and noticeably softer than the melody.</li>
          <li>Change chords on the bar or half bar, never on random eighths.</li>
          <li>
            Keep the hand still: move each chord to its <b>nearest</b> shape (C → F as C–E–G → C–F–A, not a jump up to F–A–C). This is voice leading, and it's why the pattern sounds smooth rather than lurching.
          </li>
        </ul>
        <Compare
          items={[
            {
              label: 'Every chord in root position',
              verdict: 'worse',
              title: 'The hand jumps around',
              bpm: 104,
              chordsAbove: 'C F G7 C',
              parts: [{ inst: 'grand-piano', label: 'Accompaniment', notes: chords('C F G7 C', { style: 'broken', center: 54, lead: false, v: 0.6 }) }],
              caption: 'Each chord starts on its root, so the whole pattern leaps up and down the keyboard.',
            },
            {
              label: 'Voice-led',
              verdict: 'better',
              title: 'Each chord moves to the nearest shape',
              bpm: 104,
              chordsAbove: 'C F G7 C',
              parts: [{ inst: 'grand-piano', label: 'Accompaniment', notes: chords('C F G7 C', { style: 'broken', center: 54, v: 0.6 }) }],
              caption: 'Notes the chords share stay put and the rest move by a step. Smooth, quiet and out of the melody’s way.',
            },
          ]}
        />

        <h2>From piano to orchestra</h2>
        <p>
          An orchestral texture is the same harmony shared out between instruments with different jobs. A reliable classical layout uses four layers: the <b>melody</b> on top (violins, flute), <b>inner harmony</b> sustained in the middle (violas, second violins, horns), a <b>bass line</b> (cellos and double basses an octave apart), and <b>colour</b> that is added or removed to shape the form.
        </p>
        <Example
          title="The same period, orchestrated"
          bpm={100}
          chordsAbove={classicalChords}
          parts={[
            { inst: 'violin', label: 'Violin (melody)', notes: classicalTune, fx: { reverb: 0.25 } },
            { inst: 'flute', label: 'Flute (joins on the answer)', notes: transpose(classicalTune.filter((x) => x.t >= 16), 12), vol: 0.55, fx: { reverb: 0.25 } },
            { inst: 'string-ensemble', label: 'Inner strings', notes: chords(classicalChords, { center: 60, v: 0.45 }), vol: 0.6, fx: { reverb: 0.3 } },
            { inst: 'cello', label: 'Cello (bass)', notes: bass(classicalChords, { octave: 2, style: 'quarters', v: 0.7 }), fx: { reverb: 0.2 } },
          ]}
          caption="Notice the flute only doubles the melody an octave higher on the second half. Holding a colour back and adding it on the repeat is how orchestrators make the answer feel bigger than the question without writing new notes."
        />
        <Tip title="Doubling, not crowding">
          Classical composers rarely give every instrument its own idea. They <b>double</b>: flute and violin on the melody an octave apart, cello and bass on the bass line an octave apart. Doubling at the octave adds weight and brightness without adding new harmony, so the texture stays clear even with twenty players.
        </Tip>

        <h2>Dynamics: the period has a shape</h2>
        <p>
          In a classical score, loudness is written in as carefully as the notes. Phrases usually <b>grow towards their highest note</b> and relax into the cadence. A phrase played at one flat volume sounds mechanical even if every note is right.
        </p>
        <Compare
          items={[
            {
              label: 'Flat',
              title: 'Every note the same velocity',
              bpm: 100,
              parts: [{ inst: 'grand-piano', label: 'Melody', notes: classicalTune.filter((x) => x.t >= 16).map((x) => ({ ...x, t: x.t - 16, v: 0.7 })) }],
            },
            {
              label: 'Shaped',
              verdict: 'better',
              title: 'Crescendo to the top, diminuendo into the cadence',
              bpm: 100,
              parts: [{ inst: 'grand-piano', label: 'Melody', notes: shape(classicalTune.filter((x) => x.t >= 16).map((x) => ({ ...x, t: x.t - 16 })), (p) => (p < 0.45 ? 0.45 + p : 0.9 - (p - 0.45) * 0.8)) }],
              caption: 'Same notes. The swell towards the high A and the softer landing on C make it sound played rather than typed.',
            },
          ]}
        />

        <h2>Forms: how pieces get longer</h2>
        <p>Once you can write a period, larger forms are just periods arranged with contrast and return.</p>
        <Cards
          items={[
            { title: 'Ternary (A B A)', tag: '8 + 8 + 8 bars', body: 'A tune, a contrasting middle (new key, often the relative minor or the key of V), then the tune again. The return is the payoff.' },
            { title: 'Minuet and trio', tag: '3/4, A B A', body: 'A stately dance in 3/4, then a lighter "trio" (fewer instruments, often a new key), then the minuet again without repeats.' },
            { title: 'Rondo (A B A C A)', tag: 'refrain form', body: 'A catchy refrain keeps coming back between contrasting episodes. Beethoven’s Für Elise works this way.' },
            { title: 'Theme and variations', tag: 'A A′ A″ …', body: 'One tune repeated with a new accompaniment, rhythm or mode each time. A brilliant exercise for a beginner.' },
          ]}
        />
        <SectionMap
          sections={[
            { name: 'A', bars: 8, energy: 3, note: 'tune, home key' },
            { name: 'A', bars: 8, energy: 3.4, note: 'repeat, add flute' },
            { name: 'B', bars: 8, energy: 2.2, note: 'relative minor, quieter' },
            { name: 'A', bars: 8, energy: 4, note: 'return, full and loud' },
          ]}
          caption="A small ternary piece. The B section deliberately drops energy so the return of A feels like coming home."
        />
        <Listen>
          Listen to the first movement of Mozart's "Eine kleine Nachtmusik" or Haydn's "Surprise" Symphony (No. 94, second movement). Count four-bar phrases out loud, and notice how often the first half stops on a question and the second answers it. Then listen for when the cellos and basses double each other.
        </Listen>
        <Watch>
          <p>The three giveaways of fake classical writing:</p>
          <ul>
            <li>
              <b>Pop progressions.</b> I–V–vi–IV repeated for sixteen bars sounds like pop played on strings. Classical harmony moves towards cadences; it doesn't cycle.
            </li>
            <li>
              <b>Parallel fifths and octaves</b> between the melody and bass. Classical composers avoided them because they make two parts sound like one.
            </li>
            <li>
              <b>Drums and constant reverb wash.</b> Let the accompaniment pattern carry the rhythm, and keep reverb modest so fast notes stay clear.
            </li>
          </ul>
        </Watch>
        <Try title="Write a classical period in BandForge">
          <Steps>
            <li>
              Start an empty song, double-click the <Ui>TEMPO</Ui> readout in the top bar and type <b>100</b>. Click <Ui>KEY</Ui> and choose C major.
            </li>
            <li>
              Add a <b>Grand Piano</b> track (<Ui>+</Ui> in the top bar → Software Instrument). Draw an eight-bar region and open it in the <Ui>Score</Ui>: classical music is easiest to write as notation.
            </li>
            <li>
              Write the chords first as a plan: I, IV, I, V | I, IV, V7, I. Then write the melody so bar 4 ends on a note of G (B, D or G) and bar 8 ends on C.
            </li>
            <li>
              Add a second piano track for the Alberti bass and write it in the <Ui>Piano Roll</Ui>: eighth notes, low–high–middle–high, between C3 and C4. Select those notes and lower their velocity in the velocity lane so the melody sings over them.
            </li>
            <li>
              Shape the melody: select the notes leading to the highest one and use <Ui>Dynamics</Ui> → Crescendo, then select the cadence and choose Diminuendo.
            </li>
            <li>
              Open <Ui>Check</Ui> (<K>⇧</K>+<K>W</K>). It flags parallel fifths and octaves between your lines; fix any that aren't deliberate.
            </li>
            <li>To orchestrate, move the melody to a Violin track, add String Ensemble for sustained inner chords and a Cello for the bass, then copy the melody to a Flute an octave up for bars 5–8 only.</li>
          </Steps>
        </Try>
        <Pro>
          Classical composers wrote the melody and the bass first, as a two-part skeleton, and filled the middle in afterwards. If the melody and bass sound good on their own (moving mostly in contrary motion, meeting on 3rds, 6ths and octaves at cadences), the inner parts almost write themselves. Try muting everything except those two lines in your own piece.
        </Pro>
      </>
    ),
  },

  // ================================================================== film
  {
    id: 'film',
    title: 'Film and cinematic',
    minutes: 12,
    summary: 'The tools behind modern film scores: ostinatos, pedal tones, the "epic" chromatic chord shifts, slowly stacked layers and low brass with drums. Plus a cheat sheet for wonder, tension, sadness and triumph.',
    keywords: 'film score cinematic epic trailer zimmer williams ostinato pedal chromatic mediant orchestral build brass strings toms tension wonder triumph soundtrack',
    body: () => (
      <>
        <Lead>
          Film music borrows the orchestra from classical music but drops most of its rules. It doesn't need tidy eight-bar phrases or cadences; it needs to make a feeling grow over a minute or two. Nearly every modern score does that with the same five tools, and every one of them is easy to write by hand.
        </Lead>
        <Spec
          title="The recipe"
          rows={[
            ['Tempo', 'Emotional cues 60–80 BPM. Adventure and action 120–150 BPM, often written in half time so it feels huge rather than busy.'],
            ['Keys', 'Minor keys dominate (D minor, C minor, E minor). Lydian (major with a raised 4th) for wonder and flight.'],
            ['Chords', 'i–VI, i–VI–III–VII, minor iv inside a major key, and chromatic mediant jumps (C major → A♭ major, C → E) for awe.'],
            ['Instruments', 'String Ensemble, Cello and Upright Bass (Bowed) as the bed; French Horn, Trombone and Tuba for weight; Synth Choir, Harp, Celesta and Grand Piano for colour; Dream Pad for a modern hybrid sound.'],
            ['Drums', 'Studio Kit toms and crash used as orchestral hits, plus the Percussion kit. Big hits land on downbeats, not in a groove.'],
            ['Structure', 'A "cue" follows the picture: start sparse, add one layer every 4–8 bars, peak, then drop to almost nothing.'],
          ]}
        />

        <h2>Tool 1: the ostinato over a pedal</h2>
        <p>
          An <b>ostinato</b> is a short figure repeated over and over, usually in strings. A <b>pedal</b> is one low note held while the chords above it change. Together they create the restless, driving feeling of a chase or a countdown. The trick is choosing ostinato notes that fit every chord, so the figure can keep running while the harmony shifts underneath.
        </p>
        <Example
          title="D minor: an ostinato that never changes, over chords that do"
          bpm={96}
          loop
          chordsAbove="Dm Bb Gm A"
          parts={[
            { inst: 'pizzicato-strings', label: 'Ostinato', notes: repeat(line('D4:0.5 A4 D5 A4 D4 A4 D5 A4'), 4, 4), fx: { reverb: 0.25 } },
            { inst: 'french-horn', label: 'Horns', notes: chords('Dm Bb Gm A', { center: 57, v: 0.6 }), fx: { reverb: 0.4 } },
            { inst: 'upright-bass-bowed', label: 'Low D pedal', notes: line('D2:16'), fx: { reverb: 0.3 } },
            { inst: 'kit-acoustic', label: 'Toms', notes: [...drums({ t2: 'x.....x.x.......', t1: '............x.x.' }, { bars: 4 }), ...drums({ c: 'x' })], fx: { reverb: 0.35 } },
          ]}
          caption="The ostinato only uses D and A. Over D minor they're the root and 5th; over B♭ the A becomes a lush major 7th; over G minor it's a 9th; over A major the D is a suspended 4th that aches. One figure, four colours. Mute the horns to hear it alone."
        />
        <Why>
          A pedal tone ties every chord to one home note, so even strange chords feel anchored. When a chord clashes with the pedal (A major over a low D), the clash itself becomes tension, and releasing it back to D minor feels like relief. Composers like Hans Zimmer (Inception, The Dark Knight, Interstellar) build whole cues out of an ostinato, a pedal and four chords.
        </Why>

        <h2>Tool 2: the "epic" chord shift</h2>
        <p>
          Ordinary songs move between chords that share the key's notes. Film composers love moving between two <b>major</b> chords whose roots are a 3rd apart, like C major to A♭ major or C to E. These are called <b>chromatic mediants</b>. They share one note and change the others, so the move feels both connected and startling, like a camera pulling back to reveal a landscape.
        </p>
        <Example
          title="C → A♭ → C → E: awe, then wonder"
          bpm={66}
          chordsAbove="C Ab C E"
          parts={[
            { inst: 'string-ensemble', label: 'Strings', notes: chords('C Ab C E', { center: 60, v: 0.6 }), fx: { reverb: 0.5 } },
            { inst: 'french-horn', label: 'Horns', notes: line('G4:4 Ab4:4 G4:4 G#4:4', { v: 0.7 }), fx: { reverb: 0.5 } },
            { inst: 'upright-bass-bowed', label: 'Basses', notes: bass('C Ab C E', { octave: 2 }), fx: { reverb: 0.4 } },
            { inst: 'choir', label: 'Choir', notes: chords('C Ab C E', { center: 69, v: 0.4 }), vol: 0.5, fx: { reverb: 0.6 } },
          ]}
          caption="The horn line shows the trick: G holds, slides up to A♭, back to G, then up to G♯. Each shift moves just one or two notes by a half step while the bass moves a 3rd."
        />
        <Listen>
          Compare a normal move with a chromatic one: <P chords="C:3 F:3">C to F</P> is pleasant and expected, <P chords="C:3 Ab:3">C to A♭</P> sounds like something enormous just appeared. Now try the bittersweet cousin, the minor iv borrowed into a major key: <P chords="C:2 F:2 Fm:2 C:3">C F Fm C</P>. One note (A dropping to A♭) turns warm into wistful. That move is everywhere in film and in Beatles songs alike.
        </Listen>

        <h2>Tool 3: the build</h2>
        <p>
          A cue rarely starts big. It starts with one layer and adds another every four or eight bars until everything is playing, then pulls out at the most dramatic moment. Each new layer should take a new <b>register</b> (high, middle, low) or a new <b>rhythm</b> (sustained, moving, hits), never just "more of the same".
        </p>
        <Example
          title="Eight bars in A minor, one layer at a time"
          bpm={100}
          chordsAbove="Am F C G Am F C G"
          mark={[
            [0, 8, 'pad'],
            [8, 16, '+ ostinato'],
            [16, 32, '+ horn tune, low strings, toms'],
          ]}
          height={150}
          parts={[
            { inst: 'string-ensemble', label: 'String pad', notes: chords('Am F C G Am F C G', { center: 57, v: 0.45 }), vol: 0.7, fx: { reverb: 0.5 } },
            { inst: 'pizzicato-strings', label: 'Ostinato', notes: repeat(line('A4:0.5 E5 A4 E5 C5 E5 A4 E5'), 6, 4).map((x) => ({ ...x, t: x.t + 8 })), fx: { reverb: 0.25 } },
            { inst: 'french-horn', label: 'Horn tune', notes: line('A4:3 E5:1 | F5:2 E5:1 C5:1 | E5:3 D5:1 | D5:2 B4:2', { at: 16 }), fx: { reverb: 0.45 } },
            { inst: 'cello', label: 'Low strings', notes: bass('Am F C G', { octave: 2, at: 16 }), fx: { reverb: 0.3 } },
            { inst: 'kit-acoustic', label: 'Toms & crash', notes: [...drums({ t2: 'x.....x.x.......', t1: '............x.x.' }, { bars: 4, at: 16 }), ...drums({ c: 'x' }, { at: 16 })], fx: { reverb: 0.4 } },
          ]}
          caption="i–VI–III–VII (Am F C G) is the workhorse of epic trailers. Notice every layer arrives on a bar line, and the toms only start once the tune does, so the drums announce the arrival of the theme."
        />
        <SectionMap
          sections={[
            { name: 'Intro', bars: 8, energy: 1, note: 'pad + one piano note' },
            { name: 'Build 1', bars: 8, energy: 2, note: '+ ostinato' },
            { name: 'Build 2', bars: 8, energy: 3.2, note: '+ low strings, toms' },
            { name: 'Theme', bars: 8, energy: 5, note: 'horns, choir, full drums' },
            { name: 'Drop', bars: 4, energy: 0.8, note: 'solo piano or cello' },
          ]}
          caption="A typical two-minute cue. The drop at the end matters as much as the peak: sudden quiet after a wall of sound is one of the strongest effects in film music."
        />

        <h2>Tool 4: low brass and drums, used as punctuation</h2>
        <p>
          Big trailer moments come from <b>low, loud, unison</b> writing: trombones, tuba, cellos and basses all playing the same notes in octaves, with a crash and toms on the downbeat. Keep these hits short and leave silence around them. One huge hit every two bars is more powerful than constant drumming.
        </p>
        <Example
          title="Brass hits with space around them"
          bpm={80}
          chordsAbove="Dm Bb Dm C"
          parts={[
            { inst: 'trombone', label: 'Trombone', notes: line('D3:1.5 r:2.5 | Bb2:1.5 r:2.5 | D3:1.5 r:1.5 F3:0.5 E3:0.5 | C3:4', { v: 0.95 }), fx: { reverb: 0.45 } },
            { inst: 'tuba', label: 'Tuba (an octave down)', notes: line('D2:1.5 r:2.5 | Bb1:1.5 r:2.5 | D2:1.5 r:1.5 F2:0.5 E2:0.5 | C2:4', { v: 0.9 }), fx: { reverb: 0.4 } },
            { inst: 'kit-acoustic', label: 'Hits', notes: drums({ k: 'x...............', t2: 'x.........x.x...', c: 'x...............' }, { bars: 4 }), fx: { reverb: 0.5 } },
          ]}
        />

        <h2>Tool 5: a cheat sheet for feelings</h2>
        <Cards
          items={[
            {
              title: 'Wonder',
              color: '#45b8c4',
              body: (
                <>
                  Lydian: a major chord with the raised 4th on top, or alternate between I and II over a held bass. <P chords="C:2 D/C:2 C:2 D/C:2">C to D/C</P>. Harp, celesta, high strings, choir.
                </>
              ),
            },
            {
              title: 'Tension',
              color: '#e05a4a',
              body: (
                <>
                  A low pedal, an ostinato, and chords that clash with the pedal. High sustained strings a half step apart. <P notes="D2 A2 Eb4 D5">this cluster</P>. Avoid resolving for a long time.
                </>
              ),
            },
            {
              title: 'Sadness',
              color: '#5b9be0',
              body: (
                <>
                  Minor key, slow, solo instrument (cello, piano, oboe-like clarinet) with space around it. i–VI–iv: <P chords="Am:2 F:2 Dm:2 Am:3">Am F Dm Am</P>.
                </>
              ),
            },
            {
              title: 'Triumph',
              color: '#e8a33d',
              body: (
                <>
                  Major key, horns and trumpets in octaves, wide leaps up (5ths, octaves), and the ♭VI–♭VII–I rise: <P chords="Ab:2 Bb:2 C:4">A♭ B♭ C</P>.
                </>
              ),
            },
            {
              title: 'Mystery',
              color: '#a07ae0',
              body: (
                <>
                  Diminished chords and minor chords a tritone apart, celesta or music box, very soft. <P chords="Am:2 Ebm:2 Am:3">Am to E♭m</P>.
                </>
              ),
            },
          ]}
        />
        <Watch>
          <p>Where beginner film music goes wrong:</p>
          <ul>
            <li>
              <b>Everything from bar one.</b> If the drums, choir and brass all start immediately, there's nowhere to build to. Hold back at least half your layers.
            </li>
            <li>
              <b>Too much in the low end.</b> Basses, cellos, tuba, trombones and piano left hand all below C3 turns into rumble. Keep only one or two parts truly low.
            </li>
            <li>
              <b>Drums as a pop beat.</b> A steady kick-snare pattern makes it sound like a song. Write hits and rolls that follow the drama.
            </li>
          </ul>
        </Watch>
        <Try title="Write a 16-bar cue in BandForge">
          <Steps>
            <li>
              New empty song. Double-click <Ui>TEMPO</Ui> and set <b>96</b>; click <Ui>KEY</Ui> and pick D minor.
            </li>
            <li>
              Add tracks (<Ui>+</Ui> → Software Instrument): <b>Upright Bass (Bowed)</b>, <b>Pizzicato Strings</b>, <b>String Ensemble</b>, <b>French Horn</b>. Then <Ui>+</Ui> → Drums → <b>Studio Kit</b>.
            </li>
            <li>Bass: one held D2 for all 16 bars. Ostinato: write one bar of eighths using only D and A, then copy it across from bar 5.</li>
            <li>Strings from bar 1, holding Dm, B♭, Gm, A for a bar each. Horns enter at bar 9 with a slow tune made mostly of chord tones.</li>
            <li>Drums enter at bar 9 too: toms only, plus one crash on bar 9 beat 1. Nothing on every beat.</li>
            <li>
              Open the <Ui>Mixer</Ui> (<K>X</K>) and give strings, horns and drums plenty of reverb (the <Ui>Reverb</Ui> card in <Ui>Smart Controls</Ui>, <K>B</K>), or try the <b>Big Room</b> effect preset. Film music lives in a big space.
            </li>
            <li>For the ending, delete everything in the last two bars except the bass and one horn note.</li>
          </Steps>
        </Try>
        <Pro>
          John Williams (Star Wars, Jurassic Park, Harry Potter) writes a strong, singable theme first and builds the orchestration around it. Zimmer often starts from a sound and a rhythm, then finds the theme inside the ostinato. Try both: write a four-note motif, then make an ostinato out of its first two notes. A theme and an accompaniment made from the same material always sound like they belong together.
        </Pro>
      </>
    ),
  },

  // ================================================================== pop
  {
    id: 'pop',
    title: 'Pop',
    minutes: 11,
    summary: 'How modern pop songs are built: the four-chord progressions and why they work, writing the hook first, sparse verses, the pre-chorus lift, choruses that explode, and writing a topline over your own track.',
    keywords: 'pop song hook chorus verse pre-chorus topline four chords I V vi IV max martin structure production drop melody catchy',
    body: () => (
      <>
        <Lead>
          Pop is the most carefully engineered music there is. The chords are often deliberately simple, so that everything else (the hook, the rhythm of the words, the contrast between sections) can do the work. That's good news: the craft is learnable, and you can hear immediately whether it's working.
        </Lead>
        <Spec
          title="The recipe"
          rows={[
            ['Tempo', 'Most pop sits between 100 and 128 BPM. Ballads 65–85 BPM. Dance-pop 118–128.'],
            ['Keys', 'Whatever suits the singer’s range (see the Keys chapter). Major for most, minor for dark or moody pop.'],
            ['Chords', 'I–V–vi–IV, vi–IV–I–V, IV–I–V–vi, I–vi–IV–V. Usually one chord per bar, four bars repeating.'],
            ['Instruments', 'Grand Piano or Bright Piano, Electric Piano, Pluck, Supersaw, Warm Pad, Electric Bass or 808 Sub Bass, Acoustic and Electric Guitar.'],
            ['Drums', 'Stark Kit or House 909 for clean modern drums, Hip Hop 808 for trap-influenced pop. Kick on 1 and 3 (or four-on-the-floor), snare or clap on 2 and 4.'],
            ['Structure', 'Intro 4 · Verse 8–16 · Pre-chorus 4–8 · Chorus 8 · Verse · Pre · Chorus · Bridge 8 · Chorus ×2 · Outro. First chorus within about 45 seconds.'],
          ]}
        />

        <h2>The four-chord progressions</h2>
        <p>
          "Let It Be", "Don't Stop Believin'" and hundreds of other hits use <b>I–V–vi–IV</b>. "Zombie" by The Cranberries uses <b>vi–IV–I–V</b>, the same four chords started from the minor one. These aren't clichés to avoid; they're a neutral canvas. Because the listener's ear already knows where the chords are going, all their attention goes to the melody.
        </p>
        <Listen>
          Same four chords, two moods: <P chords="G:2 D:2 Em:2 C:2">I–V–vi–IV in G</P> starts at home and feels hopeful. <P chords="Em:2 C:2 G:2 D:2">vi–IV–I–V</P> starts on the minor chord and feels yearning, then lifts. Where a progression <i>starts</i> changes its emotion more than which chords it uses.
        </Listen>
        <Example
          title="Hook first: a two-bar idea, repeated with a different ending"
          bpm={112}
          loop
          chordsAbove="G D Em C"
          parts={[
            { inst: 'analog-lead', label: 'Hook', notes: popHook, fx: { reverb: 0.2, delay: 0.15 } },
            { inst: 'grand-piano', label: 'Piano', notes: chords('G D Em C', { style: 'pulse', center: 60, v: 0.5 }), vol: 0.7 },
            { inst: 'electric-bass', label: 'Bass', notes: bass('G D Em C', { style: 'eighths', octave: 2, v: 0.75 }) },
            { inst: 'kit-stark', label: 'Drums', notes: popBeat },
          ]}
          caption="Bars 1 and 3 have the same rhythm and almost the same notes; bars 2 and 4 answer differently. Repetition makes it memorable, the changed ending stops it being boring. That's the basic shape of most pop hooks."
        />
        <Why>
          A hook works when it's <b>short</b> (one or two bars), <b>rhythmically distinctive</b> (the off-beat start and the quick repeated notes here), <b>repeated</b> enough to learn in one listen, and <b>slightly changed</b> each time so the brain stays interested. Producers often write the chorus hook first, then build the verse to lead up to it, because the hook is what people remember.
        </Why>

        <h2>Verse versus chorus: contrast is everything</h2>
        <p>
          The chorus feels big only if the verse is smaller. Pop songwriters build contrast on purpose, using the same chords in both sections and changing nearly everything else.
        </p>
        <Spec
          rows={[
            ['Melody register', 'Verse low and conversational; chorus a 4th to an octave higher.'],
            ['Note lengths', 'Verse busy and wordy (eighths, sixteenths); chorus longer, held notes.'],
            ['Arrangement', 'Verse: drums, bass and one chord instrument. Chorus: add pads, doubled parts, a wider sound.'],
            ['Drums', 'Verse: kick and hats, maybe no snare. Chorus: full beat, claps on the snare, a crash on bar 1.'],
          ]}
        />
        <Compare
          items={[
            {
              label: 'Verse: room to breathe',
              title: 'Low, wordy melody, sparse beat',
              bpm: 108,
              chordsAbove: 'Am F C G',
              parts: [
                { inst: 'analog-lead', label: 'Vocal line', notes: line('r:1 E4:0.5 E4:0.5 E4:0.5 D4:0.5 C4:1 | C4:0.5 D4:0.5 C4:1 A3:2 | r:1 E4:0.5 E4:0.5 G4:0.5 E4:0.5 D4:1 | D4:2 r:2'), fx: { reverb: 0.15 } },
                { inst: 'grand-piano', label: 'Piano', notes: chords('Am F C G', { center: 55, v: 0.45 }) },
                { inst: 'kit-stark', label: 'Drums', notes: drums({ k: 'x.......x.......', h: '..x...x...x...x.' }, { bars: 4 }) },
              ],
            },
            {
              label: 'Chorus: everything lifts',
              verdict: 'better',
              title: 'Higher, longer notes, full arrangement',
              bpm: 108,
              chordsAbove: 'Am F C G',
              parts: [
                { inst: 'analog-lead', label: 'Vocal line', notes: line('C5:1.5 B4:0.5 A4:1 E5:1 | F5:1.5 E5:0.5 C5:2 | E5:1.5 D5:0.5 C5:1 G5:1 | G5:1 D5:1 B4:2'), fx: { reverb: 0.2, delay: 0.15 } },
                { inst: 'supersaw', label: 'Supersaw', notes: chords('Am F C G', { style: 'pulse', center: 62, v: 0.45 }), vol: 0.55 },
                { inst: 'electric-bass', label: 'Bass', notes: bass('Am F C G', { style: 'eighths', v: 0.75 }) },
                { inst: 'kit-stark', label: 'Drums', notes: [...drums({ k: 'x.......x.x.....', s: '....x.......x...', cl: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' }, { bars: 4 }), ...drums({ c: 'x' })] },
              ],
            },
          ]}
        />

        <h2>The pre-chorus: building the ramp</h2>
        <p>
          The pre-chorus exists to make the chorus feel inevitable. It usually starts on the IV chord (which feels like leaving home), ends on V (which demands to resolve), climbs in pitch, and speeds up the drums. Many songs end it with a <b>beat of silence</b> or a single held note right before the chorus lands.
        </p>
        <Example
          title="Pre-chorus: rising melody, IV to V, a snare that speeds up"
          bpm={108}
          chordsAbove="F G Am G"
          parts={[
            { inst: 'analog-lead', label: 'Vocal line', notes: line('A4:0.5 A4 A4 A4 C5:2 | B4:0.5 B4 B4 B4 D5:2 | C5:0.5 C5 C5 C5 E5:2 | B4:1 D5:1 G5:1.5 r:0.5'), fx: { reverb: 0.2 } },
            { inst: 'warm-pad', label: 'Pad', notes: chords('F G Am G', { center: 60, v: 0.5 }), vol: 0.7 },
            { inst: 'electric-bass', label: 'Bass', notes: bass('F G Am G', { style: 'quarters' }) },
            { inst: 'kit-stark', label: 'Snare build', notes: drums({ s: 'x...x...x...x...x...x...x...x...x.x.x.x.x.x.x.x.xxxxxxxxxxxxxxx.', k: 'x.......x.......x.......x.......x...x...x...x...x...x...x...x...' }) },
          ]}
          caption="Each bar repeats the same rhythm a step higher, and the snare doubles its speed twice. The very last 16th is empty: that tiny gap makes the downbeat of the chorus hit harder."
        />
        <SectionMap
          sections={[
            { name: 'Intro', bars: 4, energy: 1.5 },
            { name: 'Verse 1', bars: 8, energy: 2 },
            { name: 'Pre', bars: 4, energy: 3 },
            { name: 'Chorus 1', bars: 8, energy: 4.2 },
            { name: 'Verse 2', bars: 8, energy: 2.5 },
            { name: 'Pre', bars: 4, energy: 3.3 },
            { name: 'Chorus 2', bars: 8, energy: 4.5 },
            { name: 'Bridge', bars: 8, energy: 2.2 },
            { name: 'Chorus 3', bars: 8, energy: 5 },
            { name: 'Outro', bars: 4, energy: 1.5 },
          ]}
          caption="The classic pop shape. Verse 2 is a little busier than verse 1, and each chorus a little bigger than the one before, so the song keeps climbing even though the sections repeat."
        />

        <h2>Writing a topline over your own track</h2>
        <p>
          Most modern pop is written "track first": a producer makes the chords, bass and drums, then a topliner sings melodies over it. You can work the same way.
        </p>
        <Steps>
          <li>Play your four bars on repeat and hum along without words for a few minutes. Record or note anything that sticks.</li>
          <li>Pick the best two-bar idea and decide its rhythm first. Pop melodies are rhythm-led: a strong rhythm with only three different notes beats a wandering melody with ten.</li>
          <li>Repeat it, changing only the ending, so it becomes a four-bar phrase (exactly like the hook example above).</li>
          <li>Put the highest note of the chorus on a strong beat on an important word.</li>
          <li>Leave gaps. Singers need to breathe, and the gaps are where the track gets heard.</li>
        </Steps>
        <Cards
          items={[
            { title: 'The drop-out', body: 'Cut the drums (or everything but the vocal) for the last beat or bar before a chorus. The return is twice as loud by contrast.' },
            { title: 'Octave doubling', body: 'Copy the chorus melody an octave up on a quieter, brighter instrument. Instantly bigger, no new notes needed.' },
            { title: 'Ear candy', body: 'Small one-off sounds (a pluck, a reversed-sounding swell, a little fill) that appear once or twice. They reward repeat listening.' },
            { title: 'A handmade riser', body: 'A snare that speeds up, a note sliding up, or a pad slowly getting brighter with the Filter card, placed in the bar before a chorus.' },
          ]}
        />
        <Watch>
          <ul>
            <li>
              <b>The verse is as big as the chorus.</b> If every section has the full drum kit and pads, nothing lifts. Take things out of the verse rather than adding to the chorus.
            </li>
            <li>
              <b>The hook arrives too late.</b> If the listener reaches a minute without hearing the main idea, it's too late for pop. Try starting the song with the chorus hook played on an instrument.
            </li>
            <li>
              <b>Melodies that follow the chord roots.</b> If your melody always lands on the same note as the bass, it sounds like a bass line. Land on 3rds and 5ths of the chords instead.
            </li>
          </ul>
        </Watch>
        <Try title="Build a pop verse and chorus in BandForge">
          <Steps>
            <li>
              Double-click <Ui>TEMPO</Ui> and type <b>112</b>. Add tracks: <b>Grand Piano</b>, <b>Electric Bass</b>, a lead such as <b>Analog Lead</b> or <b>Pluck</b> for the melody, and Drums → <b>Stark Kit</b>.
            </li>
            <li>
              Show the <Ui>Arrangement</Ui> track above the timeline and mark out Verse (8 bars), Pre-Chorus (4) and Chorus (8), so you can see the shape.
            </li>
            <li>Write I–V–vi–IV (G D Em C) on the piano: one chord per bar, block chords in the verse, repeated quarter notes in the chorus.</li>
            <li>
              Write the chorus hook first in the <Ui>Piano Roll</Ui>, around G4–D5. Then write the verse melody lower (around D4–A4) with shorter notes.
            </li>
            <li>Drums: kick and hats only in the verse; add the snare, a clap on beats 2 and 4 and a crash on bar 1 in the chorus.</li>
            <li>For the pre-chorus, write the snare speeding up (quarters, eighths, then sixteenths) and delete the drums on the final beat.</li>
          </Steps>
        </Try>
        <Pro>
          Swedish producer Max Martin (Britney Spears, Taylor Swift, The Weeknd) is known for a principle often called "melodic math": phrases that mirror each other in length and syllable count, so the second line feels like a perfect answer to the first. Count the syllables and notes in your hook's two halves. If they match closely, the hook will feel "right" even before anyone knows why.
        </Pro>
      </>
    ),
  },

  // ================================================================== rock
  {
    id: 'rock',
    title: 'Rock',
    minutes: 10,
    summary: 'Power chords and why they suit distortion, riffs built from the pentatonic and blues scales, the I–♭VII–IV move, guitar register, quiet-loud dynamics, and locking the bass to the kick drum.',
    keywords: 'rock guitar riff power chord distortion pentatonic blues scale flat seven bVII drums bass kick lock quiet loud grunge nirvana ac/dc',
    body: () => (
      <>
        <Lead>
          Rock is built on a sound: an electric guitar pushed into distortion. Almost every rock writing habit, from the two-note power chord to the riff that repeats all song, comes from what sounds good through a distorted amp. Understand that and the style makes sense.
        </Lead>
        <Spec
          title="The recipe"
          rows={[
            ['Tempo', '90–150 BPM. Classic rock 110–130; punk 160+; heavy rock often slower, 80–100, with a half-time feel.'],
            ['Keys', 'E, A, D and G (major or minor), because those are the guitar’s open strings and give the heaviest low notes. E minor is the classic riff key.'],
            ['Chords', 'Power chords (root + 5th). I–IV–V, I–♭VII–IV, i–♭VI–♭VII. Borrowed ♭VII and ♭III chords everywhere.'],
            ['Instruments', 'Electric Guitar with Amp Drive, Electric Bass, Rock Organ or Grand Piano. A second guitar panned opposite the first.'],
            ['Drums', 'Studio Kit. Kick on 1 and the "and" of 3, snare hard on 2 and 4, eighth notes on hats or ride, crashes on section starts.'],
            ['Structure', 'Intro riff · Verse · Chorus · Verse · Chorus · Solo · Chorus. The riff often returns between sections.'],
          ]}
        />

        <h2>Power chords: why rock uses just two notes</h2>
        <p>
          A <b>power chord</b> is just a root and the 5th above it (often with the root doubled an octave up), written "E5" or "A5". It has no 3rd, so it's neither major nor minor. That's the point: distortion adds lots of extra harmonics, and a full major or minor chord turns into a muddy roar when distorted. A 5th stays clean, solid and huge.
        </p>
        <Listen>
          Hear the difference: <P notes="E3 G#3 B3 E4" inst="electric-guitar">E major chord</P> sounds bright and specific, <P notes="E3 B3 E4" inst="electric-guitar">E5 power chord</P> sounds open and neutral, so it fits under a major or a minor melody equally well.
        </Listen>
        <Example
          title="I–♭VII–IV with power chords: the classic rock move"
          bpm={132}
          loop
          chordsAbove={[
            [0, 'A5'],
            [4, 'G5'],
            [6, 'D5'],
            [8, 'A5'],
            [12, 'G5'],
            [14, 'D5'],
          ]}
          parts={[
            { inst: 'electric-guitar', label: 'Guitar (distorted)', notes: line(`${chug('A2+E3+A3', 4)} ${chug('G2+D3+G3', 2)} ${chug('D3+A3+D4', 2)} ${chug('A2+E3+A3', 4)} ${chug('G2+D3+G3', 2)} ${chug('D3+A3+D4', 2)}`, { gate: 0.85 }), fx: { drive: 0.7, lowpass: 5500 } },
            { inst: 'electric-bass', label: 'Bass', notes: bass('A G:2 D:2 A G:2 D:2', { style: 'eighths', octave: 2, v: 0.8 }) },
            { inst: 'kit-acoustic', label: 'Drums', notes: [...drums({ k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 4 }), ...drums({ c: 'x' })] },
          ]}
          caption="A, G, D: I, then ♭VII (a chord borrowed from A minor), then IV. The ♭VII gives rock its swagger. Lynyrd Skynyrd's 'Sweet Home Alabama' and Guns N’ Roses’ 'Sweet Child O’ Mine' are built on the same three chords (in D: D, C, G)."
        />
        <Why>
          In a major key the 7th chord should be a diminished chord on the 7th note (G♯ in A major). Rock almost always replaces it with a major chord a whole step below the tonic (G in A). That flattened 7th comes from the blues and from the Mixolydian mode, and it makes the music sound tough and loose instead of polite. When you hear a rock song that sounds "classic", look for that ♭VII.
        </Why>

        <h2>Riffs: the hook of rock</h2>
        <p>
          A <b>riff</b> is a short, repeated instrumental phrase, usually one or two bars, played low on the guitar and often doubled by the bass. Most riffs come from the <b>minor pentatonic scale</b> (in E: E G A B D), plus the "blue note" a half step between the 4th and 5th (A♯/B♭ in E).
        </p>
        <Example
          title="An original E minor riff, doubled by the bass"
          bpm={120}
          loop
          parts={[
            { inst: 'electric-guitar', label: 'Guitar riff', notes: repeat(rockRiff, 2, 8), fx: { drive: 0.65, lowpass: 6000 } },
            { inst: 'electric-bass', label: 'Bass (an octave down)', notes: transpose(repeat(rockRiff, 2, 8), -12) },
            { inst: 'kit-acoustic', label: 'Drums', notes: rockBeat },
          ]}
          names
          caption="Bar 1 bounces off the low E and climbs through G, A and the blue note A♯; bar 2 answers by falling to D and B. The open E acts like a pedal, so the riff always returns home. Notice the bass plays exactly the guitar's rhythm, so they hit as one instrument."
        />
        <Tip title="The open-string trick">
          Great riffs keep returning to the lowest note of the key (low E or low A on a guitar), with the melodic notes between. The repeated low note is the heartbeat; the other notes are the personality. AC/DC's "Back in Black" and Black Sabbath's "Paranoid" both work this way.
        </Tip>

        <h2>Quiet, then loud</h2>
        <p>
          One of the most powerful rock devices is the dynamic jump: a clean, quiet verse, then a distorted, loud chorus with the same chords. Pixies pioneered it; Nirvana's "Smells Like Teen Spirit" made it famous.
        </p>
        <Compare
          items={[
            {
              label: 'Verse',
              title: 'Clean picked chords, light drums',
              bpm: 116,
              chordsAbove: 'Em C G D',
              parts: [
                { inst: 'electric-guitar', label: 'Clean guitar', notes: chords('Em C G D', { style: 'arp', center: 57, v: 0.55 }), fx: { reverb: 0.25 } },
                { inst: 'electric-bass', label: 'Bass', notes: bass('Em C G D', { style: 'whole', v: 0.7 }) },
                { inst: 'kit-acoustic', label: 'Drums', notes: drums({ k: 'x.......x.......', rim: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 4 }) },
              ],
            },
            {
              label: 'Chorus',
              verdict: 'better',
              title: 'Same chords, distorted and full',
              bpm: 116,
              chordsAbove: 'E5 C5 G5 D5',
              parts: [
                { inst: 'electric-guitar', label: 'Distorted guitar', notes: line(`${chug('E2+B2+E3', 4)} ${chug('C3+G3+C4', 4)} ${chug('G2+D3+G3', 4)} ${chug('D3+A3+D4', 4)}`, { gate: 0.85 }), fx: { drive: 0.75, lowpass: 5500 } },
                { inst: 'electric-bass', label: 'Bass', notes: bass('E C G D', { style: 'eighths', octave: 2, v: 0.85 }) },
                { inst: 'kit-acoustic', label: 'Drums', notes: [...drums({ k: 'x.x...x.x.x.....', s: '....x.......x...', c: 'x.x.x.x.x.x.x.x.' }, { bars: 4 }), ...drums({ c: 'X' })] },
              ],
            },
          ]}
        />

        <h2>Bass and kick: one instrument</h2>
        <p>
          In rock the bass player watches the drummer's right foot. Writing the bass so its notes start exactly where the kick drum hits makes the band sound tight and heavy; letting them drift apart makes it sound like two bands. Eighth-note "root" bass that only changes note with the chord is completely normal in rock, and sounds great.
        </p>
        <Example
          title="Bass notes placed on the kick drum"
          bpm={120}
          chordsAbove="E G A E"
          parts={[
            { inst: 'electric-bass', label: 'Bass', notes: line('E1:1.5 E1:0.5 r:0.5 E1:1.5 | G1:1.5 G1:0.5 r:0.5 G1:1.5 | A1:1.5 A1:0.5 r:0.5 A1:1.5 | E1:1.5 E1:0.5 r:0.5 E1:1.5', { gate: 0.9 }) },
            { inst: 'kit-acoustic', label: 'Drums', notes: drums({ k: 'x.....xx..x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 4 }) },
          ]}
          caption="The kick pattern (beat 1, the 'and' of 2, beat 3 and the 'and' of 3) is written first; the bass copies its rhythm exactly. Mute the drums and the bass alone still grooves."
        />
        <Watch>
          <ul>
            <li>
              <b>Distorted full chords.</b> Major and minor triads through heavy drive sound fizzy and muddy. Use power chords for distorted parts and save full chords for clean guitars, keys or organ.
            </li>
            <li>
              <b>Guitar parts too high.</b> Rhythm guitar lives between E2 and E4. Up above C5 it thins out and fights the vocal.
            </li>
            <li>
              <b>Bass doing its own thing.</b> Busy bass lines that ignore the kick weaken the groove. Lock first, decorate later.
            </li>
          </ul>
        </Watch>
        <Try title="Write a rock riff and chorus in BandForge">
          <Steps>
            <li>
              Set <Ui>TEMPO</Ui> to <b>120</b> and the <Ui>KEY</Ui> to E minor. Add <b>Electric Guitar</b>, <b>Electric Bass</b> and Drums → <b>Studio Kit</b>.
            </li>
            <li>
              Select the guitar track, open <Ui>Smart Controls</Ui> (<K>B</K>) and turn up the <Ui>Amp Drive</Ui> card. Pull the <Ui>Filter</Ui> down a little to tame fizz.
            </li>
            <li>Write a one-bar riff in the Piano Roll using E G A B D (plus A♯ for a bluesy bend), keeping it between E2 and E3 and returning to low E often.</li>
            <li>
              Duplicate the riff notes (<K>⌘</K>+<K>D</K>), paste them into the bass track and move them down an octave (<K>⌘</K>+<K>↓</K>).
            </li>
            <li>For the chorus, write power chords as stacked root, 5th and octave in steady eighths, and add a crash to every downbeat.</li>
            <li>
              Make a second guitar track playing the same chorus part and pan the two apart in the <Ui>Mixer</Ui> (<K>X</K>). Double-tracked guitars left and right are the classic rock wall of sound.
            </li>
          </Steps>
        </Try>
        <Pro>
          Producers record rhythm guitars at least twice and pan them hard left and right, and keep the bass, kick, snare and vocal in the centre. The guitars feel wide and the important parts stay punchy. Try the same balance with panning in the Mixer even with just two copies of one part.
        </Pro>
      </>
    ),
  },

  // ================================================================== synthwave
  {
    id: 'synthwave',
    title: 'Synth rock and synthwave',
    minutes: 11,
    summary: 'The 1980s palette rebuilt: octave-pumping synth bass, Linn drums with a huge snare, warm pads, supersaw chords and soaring leads over minor progressions. How to write arpeggios note by note, and how to cross it with rock guitars.',
    keywords: 'synthwave retrowave outrun 80s synth rock darksynth octave bass arpeggio supersaw analog lead linn drum gated snare minor progression kavinsky the midnight stranger things',
    body: () => (
      <>
        <Lead>
          Synthwave is 1980s film and pop music reimagined: neon, night drives, VHS. It's one of the most rewarding styles to write in BandForge, because every ingredient is a synth part you can draw note by note and every sound you need is already built in.
        </Lead>
        <Spec
          title="The recipe"
          rows={[
            ['Tempo', '80–118 BPM. Dreamy "chillwave" 80–95; driving outrun 100–118; darksynth faster and heavier.'],
            ['Keys', 'Minor keys almost always: A minor, E minor, F♯ minor, D minor, C minor.'],
            ['Chords', 'i–VI–III–VII (Am F C G), i–VI–VII, i–iv–VI–VII, sus4 chords resolving to minor.'],
            ['Instruments', 'Analog Bass (octave eighths), Warm Pad or Dream Pad, Supersaw for chords, Analog Lead or Square Lead for melodies, Pluck for arpeggios, Synth Brass for stabs. Synth rock adds Electric Guitar with Amp Drive.'],
            ['Drums', 'Linn Drum, or the Vintage CR-78 for a softer, older feel. Four-on-the-floor or a rock beat; a huge, reverb-soaked snare on 2 and 4.'],
            ['Structure', 'Pop structure for vocal tracks; instrumental tracks use Intro · A · B (lead melody) · Breakdown · B · Outro.'],
          ]}
        />

        <h2>The engine: octave bass</h2>
        <p>
          The defining sound of synthwave is the bass jumping between a note and the same note an octave higher in steady eighths. It acts as bass, rhythm and drive all at once, which is why many synthwave tracks barely need anything else to move forward.
        </p>
        <Example
          title="The full palette in A minor: i–VI–III–VII"
          bpm={104}
          loop
          chordsAbove="Am F C G"
          parts={[
            { inst: 'analog-lead', label: 'Lead', notes: waveLead, fx: { delay: 0.3, reverb: 0.3 } },
            { inst: 'warm-pad', label: 'Pad', notes: chords('Am F C G', { center: 60, v: 0.5 }), vol: 0.7, fx: { reverb: 0.4 } },
            { inst: 'synth-bass', label: 'Octave bass', notes: octaves(['A1', 'F1', 'C2', 'G1']) },
            { inst: 'kit-linn', label: 'Kick & hats', notes: drums({ k: 'x...x...x...x...', h: '..x...x...x...x.' }, { bars: 4 }) },
            { inst: 'kit-linn', label: 'Snare (big reverb)', notes: drums({ s: '....X.......X...' }, { bars: 4 }), fx: { reverb: 0.75 } },
          ]}
          caption="Each layer has its own space: bass low and rhythmic, pad sustained in the middle, lead high with echo, and a snare drowned in reverb. Mute parts one by one to hear how little each is doing on its own."
        />
        <Why>
          The 80s snare sound came from "gated reverb": a big room reverb cut off abruptly, made famous by Phil Collins' "In the Air Tonight". The giant snare makes a slow tempo feel huge, and the octave bass makes it feel fast, so synthwave sits in a sweet spot of epic but driving. The i–VI–III–VII progression helps too: it never lands on a major I chord, so it feels endlessly nostalgic rather than resolved.
        </Why>

        <h2>Arpeggios, written by hand</h2>
        <p>
          A fast arpeggio is the other signature sound: the chord's notes played one at a time in sixteenth notes, usually with a dotted-eighth echo. Writing it yourself (instead of letting a machine run the pattern) means you choose the shape: where it turns around, which note is on the beat, and when it changes to match the chord.
        </p>
        <Example
          title="Sixteenth-note arpeggio with echo"
          bpm={104}
          loop
          chordsAbove="Am F C G"
          parts={[
            { inst: 'pluck', label: 'Arpeggio', notes: waveArp, fx: { delay: 0.35, reverb: 0.2 } },
            { inst: 'synth-bass', label: 'Bass', notes: bass('Am F C G', { style: 'eighths', octave: 2, v: 0.75 }) },
            { inst: 'kit-linn', label: 'Drums', notes: drums({ k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 4 }) },
          ]}
          caption="Each bar climbs root, 3rd, 5th, octave and back down, always starting on the chord's root. The echo is set to a dotted eighth, so the repeats fall between the written notes and the arpeggio sounds twice as busy as it really is."
        />
        <Tip title="Make the arpeggio follow the voice leading">
          Instead of starting every chord's arpeggio on its root, start it on the chord tone nearest to the last note of the previous bar. The arpeggio then flows smoothly across the chord changes, like a melody, instead of resetting every bar.
        </Tip>

        <h2>Leads and chords that sound like the 80s</h2>
        <ul>
          <li>
            <b>Long notes, big leaps.</b> Synthwave leads sing in long held notes with octave leaps and slow slides, like a saxophone solo. Give them plenty of echo.
          </li>
          <li>
            <b>Supersaw chords on the offbeat or in long pads.</b> A detuned Supersaw holding the chords an octave above the pad makes the chorus shimmer.
          </li>
          <li>
            <b>Sus4 to minor.</b> <P chords="Asus4:2 Am:2 Fsus2:2 F:2">Asus4 → Am, Fsus2 → F</P>: holding a suspended note and then letting it fall is pure 80s film-soundtrack longing.
          </li>
          <li>
            <b>Synth Brass stabs</b> on the "and" of beats for the pre-chorus or a hook.
          </li>
        </ul>
        <Listen>
          Kavinsky's "Nightcall", The Midnight's "Days of Thunder", FM-84's "Running in the Night", and the Stranger Things theme by Kyle Dixon and Michael Stein (that one is almost nothing but a hand-played arpeggio and a pad). Listen for the octave bass, the giant snare and the echo on every lead.
        </Listen>

        <h2>Crossing over: synth rock</h2>
        <p>
          Add distorted guitars and a live-sounding kit and synthwave becomes synth rock (think Gunship, Muse, or The Killers' "Mr. Brightside" era). The synths keep the harmony and texture; guitar power chords add weight to the choruses.
        </p>
        <Compare
          items={[
            {
              label: 'Synthwave',
              title: 'All synths, Linn drums',
              bpm: 112,
              chordsAbove: 'Em C G D',
              parts: [
                { inst: 'supersaw', label: 'Supersaw', notes: chords('Em C G D', { center: 64, v: 0.5 }), vol: 0.6, fx: { reverb: 0.3 } },
                { inst: 'synth-bass', label: 'Octave bass', notes: octaves(['E1', 'C2', 'G1', 'D2']) },
                { inst: 'kit-linn', label: 'Drums', notes: drums({ k: 'x...x...x...x...', s: '....X.......X...', h: '..x...x...x...x.' }, { bars: 4 }), fx: { reverb: 0.3 } },
              ],
            },
            {
              label: 'Synth rock',
              verdict: 'better',
              title: 'Add power chords and a rock beat',
              bpm: 112,
              chordsAbove: 'Em C G D',
              parts: [
                { inst: 'supersaw', label: 'Supersaw', notes: chords('Em C G D', { center: 64, v: 0.45 }), vol: 0.5, fx: { reverb: 0.3 } },
                { inst: 'electric-guitar', label: 'Guitar', notes: line(`${chug('E2+B2+E3', 4)} ${chug('C3+G3+C4', 4)} ${chug('G2+D3+G3', 4)} ${chug('D3+A3+D4', 4)}`, { gate: 0.85 }), fx: { drive: 0.7, lowpass: 5500, pan: -0.3 } },
                { inst: 'synth-bass', label: 'Octave bass', notes: octaves(['E1', 'C2', 'G1', 'D2']) },
                { inst: 'kit-acoustic', label: 'Drums', notes: [...drums({ k: 'x.....x.x.......', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 4 }), ...drums({ c: 'x' })], fx: { reverb: 0.2 } },
              ],
              caption: 'Same chords and bass. The guitar is panned a little left so the supersaw still has room on the right.',
            },
          ]}
        />
        <Watch>
          <ul>
            <li>
              <b>Too bright and clean.</b> 80s synths were warm and slightly dull. If everything sounds harsh, lower the <Ui>Filter</Ui> on the pad and lead, and add reverb and echo.
            </li>
            <li>
              <b>Major-key cheerfulness.</b> Synthwave is bittersweet. Stay in minor, and if you use a major chord, make it VI or III, not I.
            </li>
            <li>
              <b>Bass and kick muddying each other.</b> The octave bass is constant, so keep the kick short and punchy, and don't add a second low part.
            </li>
          </ul>
        </Watch>
        <Try title="Write a synthwave track in BandForge">
          <Steps>
            <li>
              Set <Ui>TEMPO</Ui> to <b>104</b> and the <Ui>KEY</Ui> to A minor. Add <b>Analog Bass</b>, <b>Warm Pad</b>, <b>Pluck</b>, <b>Analog Lead</b> and Drums → <b>Linn Drum</b>.
            </li>
            <li>Bass: in the Piano Roll with the grid on 1/8, write A1, A2, A1, A2… for a bar, then the same on F, C and G.</li>
            <li>Pad: hold Am, F, C, G for one bar each, voiced close together around middle C.</li>
            <li>
              Arpeggio: set the grid to 1/16 and write the chord tones up and down. Then in <Ui>Smart Controls</Ui> (<K>B</K>) turn up the <Ui>Echo / Delay</Ui> card.
            </li>
            <li>Drums: kick on every beat, snare on 2 and 4, hats on the offbeats. Give the drum track lots of reverb, or split the snare onto its own drum track and drench just that.</li>
            <li>Write a slow, high lead (long notes, an octave leap or two) for the B section, with echo and reverb.</li>
          </Steps>
        </Try>
        <Pro>
          Synthwave producers obsess over space: every part gets its own octave. A typical layout is bass in octave 1–2, pad in octave 3–4, arpeggio in octave 4, lead in octave 5. If two parts share an octave, one of them usually gets moved or cut. Check yours by looking at where each part sits in the Piano Roll.
        </Pro>
      </>
    ),
  },

  // ================================================================== lo-fi
  {
    id: 'lofi',
    title: 'Lo-fi hip hop',
    minutes: 10,
    summary: 'The relaxed study-beat sound: 70–90 BPM, swung and slightly lazy drums, jazzy seventh and ninth chords on felt piano or electric piano, soft bass, and the warmth of rolled-off highs.',
    keywords: 'lofi lo-fi hip hop chill study beats jazz chords seventh ninth maj7 ii V swing laid back dilla nujabes felt piano rhodes electric piano warm vinyl',
    body: () => (
      <>
        <Lead>
          Lo-fi hip hop sounds effortless, and that's exactly what makes it hard to fake: it lives in small details. The chords are richer than pop chords, the drums are deliberately loose, and everything sounds like it's coming through an old speaker. Get those three things right and you have the style.
        </Lead>
        <Spec
          title="The recipe"
          rows={[
            ['Tempo', '70–90 BPM, most often 75–85.'],
            ['Keys', 'Flat keys suit electric piano: E♭, A♭, D♭, F. Often major seventh colours with minor chords mixed in, so it never feels fully happy or sad.'],
            ['Chords', 'Seventh and ninth chords: ii7–V7–Imaj7 (Dm7 G7 Cmaj7), Imaj7–vi7, IVmaj7–iii7 (Fmaj7 Em7), and the minor iv (Fm6 in C).'],
            ['Instruments', 'Felt Piano, Suitcase Electric Piano, Wurly Electric Piano or Electric Piano for chords; Upright Bass or a soft Electric Bass; Nylon Guitar, Flute or Saxophone for little melodies.'],
            ['Drums', 'Lo-Fi Kit. Boom-bap pattern: kick on 1 and around 3, snare on 2 and 4, swung hats. Choose Laid Back or Boom Bap from the swing menu.'],
            ['Structure', 'Short instrumental pieces, 2–3 minutes. Eight-bar sections that change gently: drums drop out, a melody enters, the chords repeat with variations.'],
          ]}
        />

        <h2>Jazzy chords: add sevenths and ninths</h2>
        <p>
          Plain triads sound like pop. Lo-fi gets its warm, wistful sound by stacking one or two more 3rds on top: a <b>7th</b> (the note a step below the octave) and a <b>9th</b> (the 2nd, an octave up). These extra notes are mildly dissonant against the root, which gives the chords a soft blur instead of a clean edge.
        </p>
        <Compare
          items={[
            {
              label: 'Triads',
              title: 'C Am F G',
              bpm: 80,
              chordsAbove: 'C Am F G',
              parts: [{ inst: 'suitcase-ep', label: 'Electric piano', notes: chords('C Am F G', { center: 60, withRoot: true, v: 0.6 }), fx: { reverb: 0.2 } }],
              caption: 'Clear and bright, but it sounds like a pop song.',
            },
            {
              label: 'Sevenths and ninths',
              verdict: 'better',
              title: 'Cmaj7 Am9 Fmaj7 G9',
              bpm: 80,
              chordsAbove: 'Cmaj7 Am9 Fmaj7 G9',
              parts: [{ inst: 'suitcase-ep', label: 'Electric piano', notes: chords('Cmaj7 Am9 Fmaj7 G9', { center: 62, withRoot: true, v: 0.6 }), fx: { reverb: 0.2 } }],
              caption: 'Same roots, same order. The added 7ths and 9ths turn it soft and dreamy.',
            },
          ]}
        />
        <Listen>
          The move at the heart of jazz and lo-fi is the <b>ii–V–I</b>: <P chords="Dm7:2 G7:2 Cmaj7:4">Dm7 G7 Cmaj7</P>. Listen to how the G7 leans hard towards C, and how Cmaj7 answers with a satisfied but slightly dreamy sound. Another lo-fi favourite is falling by step between two major sevenths and minor sevenths: <P chords="Fmaj7:2 Em7:2 Dm7:2 Cmaj7:2">Fmaj7 Em7 Dm7 Cmaj7</P>.
        </Listen>
        <Why>
          A major 7th chord contains two stable chords at once: Cmaj7 (C E G B) is a C major chord with an E minor chord on top of it. That's why it sounds happy and melancholy at the same time, which is exactly the "rainy afternoon" mood lo-fi goes for. Voice the chord with the notes close together and the root low, and the 7th and 9th rub gently in the middle.
        </Why>

        <h2>The beat: swung, lazy and a little dusty</h2>
        <p>
          Lo-fi drums come from hip hop's sampling tradition, and especially from producer J Dilla, whose drums famously drift slightly off the grid. Kicks land a bit early or late, hats are swung, and ghost notes (very quiet snare hits) fill the gaps.
        </p>
        <Example
          title="A complete lo-fi loop: chords, bass, swung drums, a lazy melody"
          bpm={80}
          loop
          chordsAbove="Fmaj7 Em7 Dm7 Cmaj7"
          parts={[
            { inst: 'felt-piano', label: 'Melody', notes: at(lofiMelody, 0.06), fx: { lowpass: 3500, reverb: 0.3 } },
            { inst: 'suitcase-ep', label: 'Chords', notes: chords('Fmaj7 Em7 Dm7 Cmaj7', { style: 'stabs', center: 60, v: 0.55 }), fx: { lowpass: 2200, reverb: 0.25 } },
            { inst: 'upright-bass', label: 'Bass', notes: bass('F E D C', { style: 'root5', octave: 2, v: 0.7 }) },
            { inst: 'kit-lofi', label: 'Drums', notes: drums({ k: 'x......x..x.....', s: '....x..g....x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 4, swing: 0.5 }), fx: { lowpass: 6000 } },
          ]}
          caption="The drums are swung (every second sixteenth pushed late), the snare has a ghost note just before beat 3, and the melody starts a fraction of a beat behind the grid. Mute the melody and listen to how relaxed the groove is on its own."
        />
        <Tip title="Laid back, not sloppy">
          Being late is only relaxing if it's <b>consistent</b>. Push the whole melody or the whole hi-hat part slightly late, by the same small amount, and keep the kick and snare tight. Random timing on every instrument just sounds like a mistake.
        </Tip>

        <h2>Warmth: cut the highs</h2>
        <p>
          "Lo-fi" literally means low fidelity. Old cassettes and samplers lost the very top of the sound, and that dullness is now part of the style. Rolling off the highs also pushes the instruments slightly into the background, which is what makes lo-fi good music to study to.
        </p>
        <Compare
          items={[
            {
              label: 'Clean',
              title: 'Full brightness',
              bpm: 80,
              chordsAbove: 'Dm9 G7 Cmaj7',
              parts: [
                { inst: 'electric-piano', label: 'Electric piano', notes: chords('Dm9:4 G7:4 Cmaj7:8', { style: 'stabs', center: 62, v: 0.6 }) },
                { inst: 'kit-lofi', label: 'Drums', notes: drums({ k: 'x......x..x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 4, swing: 0.5 }) },
              ],
            },
            {
              label: 'Lo-fi',
              verdict: 'better',
              title: 'Highs rolled off, a little saturation and room',
              bpm: 80,
              chordsAbove: 'Dm9 G7 Cmaj7',
              parts: [
                { inst: 'electric-piano', label: 'Electric piano', notes: chords('Dm9:4 G7:4 Cmaj7:8', { style: 'stabs', center: 62, v: 0.6 }), fx: { lowpass: 1800, drive: 0.15, reverb: 0.3 } },
                { inst: 'kit-lofi', label: 'Drums', notes: drums({ k: 'x......x..x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 4, swing: 0.5 }), fx: { lowpass: 4500, drive: 0.1 } },
              ],
              caption: 'A low-pass filter on the keys around 1.8 kHz and a touch of drive. Softer, warmer and further away.',
            },
          ]}
        />
        <Cards
          items={[
            { title: 'Nujabes', body: 'Japanese producer who blended jazz chords, piano and flute with hip hop drums. Start with "Feather" and "Aruarian Dance".' },
            { title: 'J Dilla', body: 'The source of the "drunk" drum feel. His album Donuts is the textbook of off-grid grooves.' },
            { title: 'Jinsang, Tomppabeats, idealism', body: 'The 2010s study-beats sound: short pieces, electric piano chords, gentle melodies, lots of warmth.' },
          ]}
        />
        <Watch>
          <ul>
            <li>
              <b>Too busy.</b> Lo-fi is about space. One chord instrument, a bass, drums and an occasional melody is plenty.
            </li>
            <li>
              <b>Drums too loud and crisp.</b> The beat should sit in the music, not punch through it. Turn the drums down and dull the hats.
            </li>
            <li>
              <b>Chords voiced too wide.</b> Jazzy chords spread over two octaves sound like a hymn. Keep the upper notes within an octave around middle C.
            </li>
          </ul>
        </Watch>
        <Try title="Make a lo-fi beat in BandForge">
          <Steps>
            <li>
              Set <Ui>TEMPO</Ui> to <b>80</b>. Click the <Ui>SWING</Ui> readout in the top bar and pick <b>Laid Back</b> (or <b>Boom Bap</b> for a harder swing).
            </li>
            <li>
              Add <b>Suitcase Electric Piano</b> (or <b>Felt Piano</b>), <b>Upright Bass</b> and Drums → <b>Lo-Fi Kit</b>.
            </li>
            <li>Write four seventh chords, one per bar: Fmaj7, Em7, Dm7, Cmaj7. Keep the upper notes between C4 and C5 and play the root low.</li>
            <li>Drums: kick on beat 1 and just before and on beat 3, snare on 2 and 4, eighth-note hats. Lower a few hat velocities so they aren't all the same.</li>
            <li>
              Select the piano track, open <Ui>Smart Controls</Ui> (<K>B</K>) and try the <b>Lo-Fi</b> effect preset, or pull the <Ui>Filter</Ui> cutoff down until the highs soften.
            </li>
            <li>Add a short melody on Felt Piano or Nylon Guitar using mostly chord tones, with long gaps between phrases.</li>
          </Steps>
        </Try>
        <Pro>
          Lo-fi producers often write the chord progression first, then remove notes: they drop the 5th from each chord (it adds little) and keep the 3rd and 7th, which carry the colour. Try deleting the 5ths from your chords and listen to how the progression gets lighter without losing its mood.
        </Pro>
      </>
    ),
  },
];

export default lessons;
