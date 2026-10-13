import { Combine } from 'lucide-react';
import type { Chapter } from '../types';
import { Cards, Compare, Example, K, Keys, Lead, Listen, PlayChip as P, Pro, Spec, Steps, Tip, Try, Ui, Watch, Why } from '../figures';
import { bass, chords, drums, line, type Part } from '../notation';

/** "C2 C3" pairs → steady eighth notes bouncing between the octaves, one bar each. */
function octavePump(pairs: [string, string][]): string {
  return pairs.map(([lo, hi]) => `${lo}:0.5 ${hi} ${lo} ${hi} ${lo} ${hi} ${lo} ${hi}`).join(' | ');
}

const POP_BEAT = drums({ k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars: 4 });
const POP_KEYS = chords('C Am F G', { center: 62, style: 'pulse', v: 0.5 });

const SWING_RIDE = drums({ r: 'x.xxx.xx', h: '..x...x.' }, { bars: 4, step: 0.5, swing: 0.33 });

const COUNTER_CHORDS = chords('C G Am F', { center: 60, v: 0.45 });

const lessonParts = {
  roots: [
    { inst: 'electric-bass', label: 'Bass', notes: bass('C Am F G') },
    { inst: 'grand-piano', label: 'Keys', notes: POP_KEYS, vol: 0.7 },
    { inst: 'kit-acoustic', label: 'Drums', notes: POP_BEAT },
  ] as Part[],
  moving: [
    { inst: 'electric-bass', label: 'Bass', notes: line('C2:1.5 C2:0.5 G2:1 E2:1 | A1:1.5 A1:0.5 E2:1 C2:1 | F1:1.5 F1:0.5 C2:1 A1:1 | G1:1.5 G1:0.5 D2:1 B1:1') },
    { inst: 'grand-piano', label: 'Keys', notes: POP_KEYS, vol: 0.7 },
    { inst: 'kit-acoustic', label: 'Drums', notes: POP_BEAT },
  ] as Part[],
};

const chapter: Chapter = {
  id: 'harmony',
  title: 'Bass, Counter-Melodies & Harmony',
  blurb: 'Bass lines, second melodies, counterpoint and balancing everything so it sounds full, not muddy.',
  icon: Combine,
  color: '#e06a8f',
  lessons: [
    // ------------------------------------------------------------------ bass lines
    {
      id: 'bass-lines',
      title: 'Writing bass lines',
      minutes: 10,
      summary: 'The bass decides what every chord means and how the whole song moves. Build a bass line in layers, from plain roots to fifths, approach notes and walking lines, and lock it to the kick drum.',
      keywords: 'bass line bassline root fifth approach note walking bass octave kick groove slash chord inversion low end',
      body: () => (
        <>
          <Lead>
            The bass is the most underrated part in music. Listeners rarely hum it, but it quietly decides two huge things: <b>what each chord sounds like</b> (the lowest note colours everything above it) and <b>how the song moves</b> (the bass and kick drum together are the groove). Get the bass right and a simple song suddenly sounds professional.
          </Lead>
          <p>The good news is that you build a bass line in layers. Start with the safest possible version, then add one kind of movement at a time until it feels alive. Every stage below works on its own; most songs live somewhere between stage 2 and stage 4.</p>

          <h2>Stage 1: roots</h2>
          <p>The <b>root</b> is the note a chord is named after: C for a C chord, A for Am. Playing the root on the first beat of every chord change is never wrong, and it is what you should write first, every time. It tells the listener exactly where the harmony is.</p>
          <Compare
            items={[
              {
                label: 'Roots only',
                title: 'One long root per chord',
                bpm: 100,
                chordsAbove: 'C Am F G',
                parts: lessonParts.roots,
                caption: 'Solid but static: the bass just announces each chord and sits there.',
              },
              {
                label: 'A moving line',
                verdict: 'better',
                title: 'Same roots, plus rhythm and passing notes',
                bpm: 100,
                chordsAbove: 'C Am F G',
                parts: lessonParts.moving,
                caption: 'Still a root on every downbeat, but the bass now pushes with the kick and walks toward each next chord. Mute the drums and keys to hear the line alone.',
              },
            ]}
          />
          <p>Listen to the second version closely. It still plays the root on beat 1 of every bar. What changed is <em>everything in between</em>: a short repeated root on the "and" of 2 that locks with the kick, then a chord tone, then a note that leads into the next chord. That is the whole craft in miniature.</p>

          <h2>Stage 2: add the fifth</h2>
          <p>After the root, the safest note is the <b>fifth</b>, seven half steps up (or five down). It belongs to the chord, it's stable, and it adds bounce without changing the harmony. Root–fifth alternation is the backbone of country, folk, march and polka bass, and a lot of rock.</p>
          <Example
            title="Root and fifth, alternating every beat"
            bpm={110}
            names
            chordsAbove="C F G C"
            parts={[
              { inst: 'upright-bass', label: 'Bass', notes: bass('C F G C', { style: 'root5' }) },
              { inst: 'acoustic-guitar', label: 'Guitar', notes: chords('C F G C', { style: 'offbeat', center: 60, v: 0.5 }) },
            ]}
            caption="Root on the strong beats, fifth on the weak ones. The guitar plays on the off-beats, so the two never get in each other's way."
          />
          <Watch>Avoid the <b>third</b> of the chord as a bass note on beat 1 unless you mean it. A C chord with E in the bass (written C/E) sounds lighter and less settled, like it's in the middle of going somewhere. That's a lovely effect when you want it, which is stage 4 below, but a muddy accident when you don't.</Watch>

          <h2>Stage 3: approach notes</h2>
          <p>The single most effective trick in bass writing: on the last beat (or half beat) before a chord change, play a note <b>one step above or below</b> the next root. Your ear hears it pointing at the next chord, so the change feels inevitable instead of abrupt. Pros call these <b>approach notes</b> or leading notes.</p>
          <Spec
            rows={[
              ['From below', <>Next chord is F? Play <b>E</b> just before it. A half step below is the strongest pull of all.</>],
              ['From above', <>Next chord is Am? Play <b>B</b> or <b>B♭</b> just before it, sliding down into the root.</>],
              ['Scale walk', <>C to F is four notes apart, so walk it: <P melody="C2:1 D2 E2 F2:2" inst="electric-bass" bpm={100}>C D E → F</P>.</>],
              ['Through the fifth', <>Land on the fifth of the next chord's root first, then the root: very common in funk and gospel.</>],
            ]}
          />
          <p>You don't need approach notes before every change. One every two bars, or only before the change into a new section, is plenty. Too many and the bass starts to sound busy and nervous.</p>

          <h2>Stage 4: the bass as a second melody</h2>
          <p>Once the basics feel natural, start thinking of the bass as a melody of its own, the lowest line in a duet with the tune. The classic move is a <b>descending bass line</b>: the chords barely change but the bass steps down one note at a time, using inversions (slash chords) so each chord has a different bottom note.</p>
          <Example
            title="A stepwise descending bass under familiar chords"
            bpm={76}
            names
            chordsAbove="C:2 G/B:2 Am:2 C/G:2 F:2 C/E:2 Dm:2 G:2"
            parts={[
              { inst: 'cello', label: 'Bass line', notes: line('C3:2 B2 A2 G2 F2 E2 D2 G2') },
              { inst: 'grand-piano', label: 'Chords', notes: chords('C G Am C F C Dm G', { beats: 2, center: 64, v: 0.55 }) },
            ]}
            caption="C, B, A, G, F, E, D: the bass walks down the scale while the chords above it stay simple. Mute the chords and the bass line alone is a melody."
          />
          <Listen>This descending line is behind a huge number of songs: Procol Harum's "A Whiter Shade of Pale", the verses of many ballads, and Bach's "Air on the G String" all ride a bass that steps down the scale. Once you know the sound, you'll hear it everywhere.</Listen>

          <h2>Walking bass</h2>
          <p>In jazz, swing and a lot of blues, the bass plays a note on every beat and never repeats itself: <b>root on beat 1</b>, chord tones or scale steps on beats 2 and 3, and an <b>approach note on beat 4</b> leading into the next root. It sounds improvised, but it follows that formula almost every time.</p>
          <Example
            title="A walking line over a jazz turnaround"
            bpm={132}
            names
            chordsAbove="Dm7 G7 Cmaj7 A7"
            loop
            parts={[
              { inst: 'upright-bass', label: 'Walking bass', notes: line('D2:1 E2 F2 F#2 G2 F2 D2 Db2 C2 E2 G2 Bb1 A1 C#2 E2 Eb2') },
              { inst: 'electric-piano', label: 'Piano', notes: chords('Dm7 G7 Cmaj7 A7', { center: 62, style: 'stabs', v: 0.5 }) },
              { inst: 'kit-acoustic', label: 'Ride', notes: SWING_RIDE },
            ]}
            caption="Look at beat 4 of each bar: F♯ leads up into G, D♭ down into C, B♭ down into A, E♭ down into D. That's what makes it walk."
          />

          <h2>Octaves and pumping eighths</h2>
          <p>Electronic music, disco and rock often use rhythm instead of note choice for movement. Two simple patterns cover a lot of ground:</p>
          <Cards
            items={[
              { title: 'Driving eighths', tag: 'rock · punk · synth-pop', body: 'The root, repeated on every eighth note. Relentless and powerful. The energy comes from the rhythm and from the guitar or synth chords changing above it.' },
              { title: 'Octave pump', tag: 'disco · house · funk', body: 'Root low, root an octave up, back and forth. It fills the space of a busy line with only one note name per chord, so it never clashes.' },
              { title: 'Long notes', tag: 'ballads · ambient · film', body: 'One held root per chord, sometimes per two chords. When the song is about space and mood, a busy bass ruins it.' },
            ]}
          />
          <Example
            title="Disco-style octave bass"
            bpm={118}
            chordsAbove="Am Dm G C"
            parts={[
              { inst: 'synth-bass', label: 'Octave bass', notes: line(octavePump([['A1', 'A2'], ['D2', 'D3'], ['G1', 'G2'], ['C2', 'C3']])) },
              { inst: 'kit-909', label: 'Drums', notes: drums({ k: 'x...x...x...x...', cl: '....x.......x...', o: '..x...x...x...x.' }, { bars: 4 }) },
            ]}
          />

          <h2>Lock it to the kick drum</h2>
          <p>The bass and the kick drum are both low, both rhythmic and both carry the groove. When they hit together, they sound like one big instrument; when they argue, the low end turns to mush. The working rule from session players: <b>wherever the kick plays, the bass usually plays too</b>. The bass can add notes between kicks, but it shouldn't dodge them.</p>
          <Tip>Write the drums first, then mute everything but the kick and write the bass to its rhythm. Add fills and passing notes afterwards. This one habit fixes most "my song sounds amateur" low-end problems.</Tip>

          <Try>
            <Steps>
              <li>Add an instrument track (<K>⌘</K>/<K>Ctrl</K>+<K>Alt</K>+<K>N</K>) and pick <Ui>Electric Bass</Ui>, <Ui>Upright Bass</Ui> or <Ui>Analog Bass</Ui>. If you've filled in the <Ui>Chord Track</Ui> (<K>W</K>), its chord names appear above your tracks, so you always know which root to play.</li>
              <li>Open the piano roll and write stage 1: one root per chord, starting on the downbeat. Keep it between E1 and C3; above that a bass stops sounding like a bass.</li>
              <li>Solo the drums and the bass together (select each track and press <K>S</K>) and play. Shorten or split notes so the bass hits with the kick.</li>
              <li>Now add one approach note before each chord change and listen again. Then try a fifth on beat 3. Stop adding when it starts to feel busy.</li>
              <li>For a descending line, write the bass notes you want and let the chords above stay the same. To label it, right-click the chord in the chord track, choose <Ui>Edit…</Ui> and set its <Ui>Bass</Ui> (C with E in the bass becomes C/E).</li>
            </Steps>
          </Try>
          <Pro>Many bassists write the line, then play it with all the notes a little shorter than written (about three-quarters of their length). The tiny gaps make room for the kick drum and make the groove bounce. In the piano roll, select the bass notes and drag their ends in slightly to hear the difference.</Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ counter-melodies
    {
      id: 'counter-melodies',
      title: 'Counter-melodies',
      minutes: 9,
      summary: 'A second melody that answers, fills gaps and moves when the main tune rests is how arrangements start to sound rich. Learn the four rules that keep a counter-melody supporting the tune instead of fighting it.',
      keywords: 'countermelody counter melody second melody call and response descant obbligato fill harmony line contrary motion',
      body: () => (
        <>
          <Lead>
            A <b>counter-melody</b> is a second tune that plays alongside the main one. Think of the strings answering the singer in a Motown record, the horn line in a film theme, or the guitar lick that fills the pause after every vocal line. It's the difference between a song that sounds "arranged" and one that sounds like a demo.
          </Lead>
          <p>The danger is obvious: two melodies at once can easily become a mess where neither is heard. Every good counter-melody follows the same four rules, and they all come down to one idea: <b>be different from the main melody in every way you can.</b></p>

          <h2>Rule 1: move when the melody holds</h2>
          <p>Melodies breathe. They hold long notes at the ends of phrases and leave gaps. A counter-melody is busiest exactly there, and goes quiet or holds a long note while the main melody is moving. The listener's attention ping-pongs between the two, and the music never stops moving.</p>
          <Example
            title="The cello moves while the violin holds"
            bpm={84}
            chordsAbove="C G Am F"
            loop
            parts={[
              { inst: 'violin', label: 'Melody', notes: line('E5:1 D5 C5 D5 | B4:3 r:1 | C5:1 B4 A4 C5 | A4:3 r:1') },
              { inst: 'cello', label: 'Counter-melody', notes: line('E3:4 | D3:1 F3 G3 B3 | C4:4 | A3:1 G3 F3 E3') },
              { inst: 'grand-piano', label: 'Chords', notes: COUNTER_CHORDS, vol: 0.55 },
            ]}
            caption="In bars 1 and 3 the violin moves and the cello holds one long note. In bars 2 and 4 the violin holds and the cello takes over. Mute the cello: the tune still works but sounds emptier."
          />

          <h2>Rule 2: call and response</h2>
          <p>The most natural counter-melody is a conversation. The main melody "says" a short phrase, then the counter-melody answers in the gap. Gospel, blues, big-band swing and practically every soul record are built on this. It's also the easiest kind to write, because you're filling silence, not competing with anything.</p>
          <Example
            title="Flute calls, clarinet answers"
            bpm={96}
            names
            chordsAbove="C F C G"
            parts={[
              { inst: 'flute', label: 'Call', notes: line('C5:0.5 D5 E5:1 r:2 | F5:0.5 E5 D5:1 r:2 | E5:0.5 D5 C5:1 r:2 | D5:2 r:2') },
              { inst: 'clarinet', label: 'Response', notes: line('r:2 G4:0.5 E4 C4:1 | r:2 A4:0.5 F4 C4:1 | r:2 G4:0.5 E4 C4:1 | r:2 B3:0.5 D4 G4:1') },
              { inst: 'grand-piano', label: 'Chords', notes: chords('C F C G', { center: 57, v: 0.45 }), vol: 0.6 },
            ]}
            caption="The answers only use notes from each bar's chord, so they can't clash. Notice the response goes down when the call went up."
          />

          <h2>Rule 3: different register</h2>
          <p>Keep the two melodies at least an octave apart most of the time, or put the counter-melody clearly above or below and keep it there. If they live in the same octave, they tangle: your ear can't tell which note belongs to which line. Common, reliable placements:</p>
          <Cards
            items={[
              { title: 'Below the melody', tag: 'cello · horn · trombone · low synth', body: 'Warm and supportive. The usual choice for a vocal song, because it never competes with the singer\'s range.' },
              { title: 'High above (a descant)', tag: 'flute · violin · bells · glockenspiel', body: 'Soaring and decorative. Saved for big moments like the last chorus. Keep it simple: long notes and slow movement.' },
              { title: 'In the gaps (fills)', tag: 'guitar · piano · sax · synth lead', body: 'Short licks only between vocal phrases. Can share the melody\'s register because they never overlap in time.' },
            ]}
          />

          <h2>Rule 4: contrary motion and different rhythm</h2>
          <p>When the melody goes up, let the counter-melody go down, and vice versa. This is called <b>contrary motion</b>, and it's the strongest way to make two lines sound independent. Combine it with a different rhythm (long notes against short ones, or on-beat against off-beat) and the two lines will never blur together.</p>
          <Compare
            items={[
              {
                label: 'Same shape, same rhythm',
                verdict: 'worse',
                title: 'The second line just shadows the first',
                bpm: 90,
                parts: [
                  { inst: 'flute', label: 'Melody', notes: line('C5:1 D5 E5 G5 | F5:1 E5 D5:2') },
                  { inst: 'clarinet', label: 'Counter', notes: line('A4:1 B4 C5 E5 | D5:1 C5 B4:2') },
                ],
                caption: 'Moving in parallel, note for note. It sounds like a thicker single melody, not two.',
              },
              {
                label: 'Opposite direction, own rhythm',
                verdict: 'better',
                title: 'Two genuinely independent lines',
                bpm: 90,
                parts: [
                  { inst: 'flute', label: 'Melody', notes: line('C5:1 D5 E5 G5 | F5:1 E5 D5:2') },
                  { inst: 'clarinet', label: 'Counter', notes: line('E4:2 C4:1 B3:1 | A3:1 B3:0.5 C4:0.5 D4:1 G3:1') },
                ],
                caption: 'While the flute climbs, the clarinet falls, and it moves on different beats. You hear two voices in conversation.',
              },
            ]}
          />
          <Why>Your brain separates sounds into "streams" using cues like direction, register and timing. When two lines share all three, they fuse into one sound (useful for doubling). When they differ in all three, you hear two distinct voices. Composers from Bach to John Williams use exactly these cues to keep busy textures clear.</Why>
          <Watch>The most common counter-melody mistake is making it too interesting. If someone hearing the song for the first time can't tell which tune is the main one, the counter-melody is too busy, too loud, or too high. Simplify it, lower its volume in the mixer, or move it down an octave.</Watch>

          <h2>Where to put counter-melodies in a song</h2>
          <p>Don't run a counter-melody all the way through. Introduce it in the <b>second verse or second chorus</b>, so the song grows as it goes. A counter-melody that wasn't there the first time round is one of the cheapest ways to make a repeat feel new.</p>
          <Try>
            <Steps>
              <li>Write your main melody first and get it right on its own.</li>
              <li>Add a new instrument track for the counter-melody. Pick a sound that contrasts with the melody: a cello or horn under a flute or vocal, bells or strings over a piano.</li>
              <li>In the piano roll, look at where the melody holds long notes or rests. Write the counter-melody notes only there first.</li>
              <li>Fill in the rest with long notes, mostly chord tones. The <Ui>Chord Track</Ui> (<K>W</K>) shows which chord is playing at each bar.</li>
              <li>Open <Ui>Check</Ui> (<K>⇧</K>+<K>W</K>). If it flags parallel fifths or octaves between your two lines, that's a sign they're moving together too much; change direction on one of them.</li>
            </Steps>
          </Try>
          <Pro>Film and pop arrangers often write the counter-melody by "reversing" the melody's shape: where the tune leaps up, the counter steps down; where the tune is fast, the counter holds. Sketch the melody's contour as a line on paper, draw its mirror image, and you have the shape of a counter-melody.</Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ counterpoint
    {
      id: 'counterpoint',
      title: 'Counterpoint rules that actually matter',
      minutes: 9,
      summary: 'Centuries of counterpoint rules boil down to a few that still matter for any style: the four kinds of motion, why parallel fifths and octaves make lines merge, and how to keep voices independent.',
      keywords: 'counterpoint voice leading parallel fifths octaves contrary oblique similar motion voice crossing independence SATB classical',
      body: () => (
        <>
          <Lead>
            <b>Counterpoint</b> is the art of writing several melodies that sound good together while each stays independent. It has a reputation for strict, dusty rules. Most of them only matter if you're writing exam-style chorales, but a handful explain why some arrangements sound clear and others sound clumsy in every genre.
          </Lead>

          <h2>The four ways two lines can move</h2>
          <p>Any two parts, from one note to the next, move in one of four ways. Play each pair and listen to how independent the two lines feel.</p>
          <Compare
            items={[
              {
                label: 'Contrary',
                verdict: 'better',
                title: 'Opposite directions',
                bpm: 80,
                names: true,
                parts: [
                  { inst: 'violin', label: 'Upper', notes: line('E4:1 F4 G4:2') },
                  { inst: 'cello', label: 'Lower', notes: line('C4:1 A3 G3:2') },
                ],
                caption: 'The most independent. Use it as your default whenever the outer parts move.',
              },
              {
                label: 'Oblique',
                title: 'One holds, one moves',
                bpm: 80,
                names: true,
                parts: [
                  { inst: 'violin', label: 'Upper', notes: line('G4:4') },
                  { inst: 'cello', label: 'Lower', notes: line('C4:1 D4 E4 C4') },
                ],
                caption: 'Also very independent. Great for pedal notes and held harmonies.',
              },
              {
                label: 'Similar, in 3rds or 6ths',
                title: 'Same direction, sweet intervals',
                bpm: 80,
                names: true,
                parts: [
                  { inst: 'violin', label: 'Upper', notes: line('E4:1 F4 G4:2') },
                  { inst: 'cello', label: 'Lower', notes: line('C4:1 D4 E4:2') },
                ],
                caption: 'Moving together a 3rd apart: blended and sweet. Every duet harmony does this.',
              },
              {
                label: 'Parallel 5ths',
                verdict: 'worse',
                title: 'Same direction, perfect 5ths',
                bpm: 80,
                names: true,
                parts: [
                  { inst: 'violin', label: 'Upper', notes: line('G4:1 A4 B4:2') },
                  { inst: 'cello', label: 'Lower', notes: line('C4:1 D4 E4:2') },
                ],
                caption: 'The two lines fuse into one hollow sound. You stop hearing two parts.',
              },
            ]}
          />

          <h2>Why parallel fifths and octaves are a problem</h2>
          <p>An octave and a fifth are the two "purest" intervals; their notes share so many overtones that your ear blends them into a single sound. That's exactly why they're useful as <em>one</em> sound: an octave doubling makes a melody bigger, and a rock power chord is a deliberate fifth. But if two parts that are supposed to be <b>separate voices</b> move in parallel fifths or octaves, they lose their independence for that moment, and the texture suddenly thins out.</p>
          <Compare
            items={[
              {
                label: 'Bass shadows the melody',
                verdict: 'worse',
                title: 'Outer parts in parallel octaves',
                bpm: 84,
                names: true,
                parts: [
                  { inst: 'flute', label: 'Melody', notes: line('C5:1 D5 E5 F5 | E5:2 D5:2 | C5:4') },
                  { inst: 'cello', label: 'Bass', notes: line('C3:1 D3 E3 F3 | E3:2 D3:2 | C3:4') },
                ],
                caption: 'Every note is the melody two octaves down. It sounds like one line, with nothing underneath.',
              },
              {
                label: 'Bass moves against it',
                verdict: 'better',
                title: 'Mostly contrary motion',
                bpm: 84,
                names: true,
                parts: [
                  { inst: 'flute', label: 'Melody', notes: line('C5:1 D5 E5 F5 | E5:2 D5:2 | C5:4') },
                  { inst: 'cello', label: 'Bass', notes: line('C3:1 B2 A2 D3 | G2:2 G2:2 | C3:4') },
                ],
                caption: 'Same melody. The bass goes down while the tune goes up, and the harmony suddenly has depth: C, G, Am, Dm, C, G, C.',
              },
            ]}
          />
          <Spec
            title="When parallels are fine"
            rows={[
              ['Doubling on purpose', 'A melody doubled an octave higher on another instrument is meant to sound like one line. That\'s orchestration, not a mistake.'],
              ['Power chords', 'Rock guitar riffs move in parallel fifths by design. The fused, hollow sound is the point.'],
              ['Block chords and pads', 'A pad or piano playing whole chords will naturally move in parallels. Only melodic lines need to be independent.'],
              ['Avoid them', 'Between your melody and bass, between a melody and its counter-melody, and in any choir or string writing where each part is a separate singer or player.'],
            ]}
          />
          <Why>The guideline was never "fifths sound bad". It's "if you've chosen to write separate voices, keep them separate". Bach avoided parallel fifths not because they're ugly but because a four-part chorale is four people, and parallels make two of them disappear into one.</Why>

          <h2>Three more habits of clear part-writing</h2>
          <Cards
            items={[
              { title: 'Move by the smallest step', body: 'When chords change, each inner voice should move to the nearest note of the new chord. Often a voice can stay exactly where it is. This is called voice leading, and it\'s why good chord voicings sound smooth.' },
              { title: "Don't cross voices", body: 'If the alto line goes above the soprano, the listener loses track of who\'s singing the tune. Keep each part in its own lane, top to bottom.' },
              { title: 'Approach fifths and octaves carefully', body: 'Arriving at a fifth or octave with both voices moving the same way (hidden parallels) still sounds a bit bare. Arrive at them by contrary motion, or with the top voice moving by step.' },
            ]}
          />
          <Listen>
            Compare these two endings of the same chords: <P chords="F:2 G:2 C:4">smooth voice leading</P> versus the same chords played as root-position blocks that all jump together: <P notes="F3 A3 C4">F</P> <P notes="G3 B3 D4">G</P> <P notes="C4 E4 G4">C</P>. The first sounds like music; the second sounds like someone looking up chord shapes.
          </Listen>
          <Watch>Beginners who write every chord in root position on the piano end up with all the notes leaping in parallel from chord to chord. That's parallel fifths and octaves in every voice at once. Use inversions so the notes move as little as possible.</Watch>

          <h2>Let BandForge check for you</h2>
          <Try>
            <Steps>
              <li>Write two or more melodic lines (a melody and bass, or two counter-melodies).</li>
              <li>Open <Ui>Check My Writing</Ui> from the <Ui>Check</Ui> tab, or press <K>⇧</K>+<K>W</K>.</li>
              <li>Click the <Ui>Parallels</Ui> filter chip. Each entry names the two tracks and the bar. Click it to select the notes, or the play button to hear it in context.</li>
              <li>Turn on <Ui>Mark notes</Ui> to see the flagged notes highlighted in the piano roll and score while you fix them.</li>
              <li>Decide for each one: is this deliberate doubling, or two lines collapsing? If it's a collapse, move one part in the opposite direction, or change it to a 3rd or 6th.</li>
            </Steps>
          </Try>
          <p>BandForge only checks lines that behave like melodies. Pads and comping parts that mostly play chords are left out, so a pop song with block chords over a bass won't light up with warnings. It never changes your notes; it just tells you what it found.</p>
          <Pro>When reviewing an arrangement, pros check the <b>outer voices</b> first: the top line (melody) and the bottom line (bass). If those two make a good duet on their own, with plenty of contrary motion, everything in between can be fairly simple and the whole thing will still sound strong.</Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ voicing & spacing
    {
      id: 'voicing',
      title: 'Balancing harmony: voicing and spacing',
      minutes: 10,
      summary: 'The same chord can sound clear and huge or muddy and small depending on where you put its notes. Learn the spacing rules that come straight from physics, what to double, and how to keep chords out of the melody\'s way.',
      keywords: 'voicing spacing open close voicing mud muddy low end harmonic series doubling third root register clutter balance mix arrangement',
      body: () => (
        <>
          <Lead>
            "Play a C chord" doesn't tell you much. C, E and G can sit close together in the middle of the piano, spread across four octaves, or stacked in the bass. Each <b>voicing</b> of the same chord sounds completely different, and choosing well is the single biggest factor in whether your arrangement sounds full and clear or thick and muddy.
          </Lead>

          <h2>Wide at the bottom, close at the top</h2>
          <p>Nature has already solved voicing for you. When any instrument plays a low note, it also produces fainter higher notes called <b>overtones</b>, always in the same pattern: wide intervals low down, getting closer together as they go up.</p>
          <Keys
            from="C2"
            to="C5"
            marks={{ C2: '1', C3: '2', G3: '3', C4: '4', E4: '5', G4: '6', Bb4: '7', C5: '8' }}
            caption="The overtones hidden inside a low C (the harmonic series). An octave, then a fifth, then a fourth, then thirds: wide gaps at the bottom, narrow gaps at the top. Voicings that copy this shape sound naturally resonant."
          />
          <p>Copy that shape and chords ring. Fight it, with close intervals low down, and the notes' overtones clash with each other and turn into a growl. That's what engineers mean by <b>mud</b>.</p>
          <Spec
            title="Spacing rules of thumb"
            rows={[
              ['Below C2', 'Only one note. Octaves at most.'],
              ['C2 to C3', 'Roots, fifths and octaves. No thirds; they sound murky down here.'],
              ['C3 to C4', 'Thirds are fine. This is where the chord\'s character lives.'],
              ['Above C4', 'Anything goes: close voicings, seconds, cluster chords all sound clear.'],
            ]}
          />
          <Compare
            items={[
              {
                label: 'Muddy',
                verdict: 'worse',
                title: 'Close chords low on the piano',
                bpm: 72,
                chordsAbove: 'C F G C',
                parts: [{ inst: 'grand-piano', label: 'Piano', notes: line('C2+E2+G2+C3:4 | F2+A2+C3+F3:4 | G2+B2+D3+G3:4 | C2+E2+G2+C3:4', { v: 0.7 }) }],
                caption: 'Every chord is packed into the low register. The thirds rumble and the chord names blur.',
              },
              {
                label: 'Balanced',
                verdict: 'better',
                title: 'Open at the bottom, close at the top',
                bpm: 72,
                chordsAbove: 'C F G C',
                parts: [{ inst: 'grand-piano', label: 'Piano', notes: line('C2+G2+E3+C4+G4:4 | F2+C3+A3+F4+A4:4 | G2+D3+B3+G4+B4:4 | C2+G2+E3+C4+E4:4', { v: 0.7 }) }],
                caption: 'Same chords, same bass notes. Fifth at the bottom, third in the middle, close notes on top: bigger, clearer, richer.',
              },
            ]}
          />

          <h2>What to double</h2>
          <p>A triad has three notes but you'll often have four, five or more parts. Some notes must be doubled, and the choice matters:</p>
          <Cards
            items={[
              { title: 'Double the root', tag: 'best', color: '#5dbb7a', body: 'Strengthens the chord without changing its colour. Your default.' },
              { title: 'Double the fifth', tag: 'fine', color: '#5b9be0', body: 'Neutral and open. Great when the root is already in the bass.' },
              { title: 'Double the third', tag: 'careful', color: '#e8a33d', body: 'Makes the chord sound heavy and lopsided, especially in major chords. Sometimes lovely in minor chords, rarely in major.' },
              { title: 'Double the leading note', tag: 'avoid', color: '#e05a4a', body: 'The 7th note of the key (B in C major) wants to rise to the tonic. Doubled, both copies pull the same way and you get parallel octaves.' },
            ]}
          />
          <Listen>Two C major chords, same range: <P notes="C3 G3 C4 E4 G4">root doubled</P> versus <P notes="C3 E3 G3 E4 G4">third doubled</P>. The second sounds thicker and slightly sour, even though every note is in the chord.</Listen>

          <h2>Don't stack everyone in the same octave</h2>
          <p>Here's the arrangement version of mud. A piano, a guitar, a pad and a synth all playing chords around middle C are four instruments doing the same job in the same space. Each one sounds fine solo; together they turn into a dense wall, and the melody, usually in that same space, gets buried.</p>
          <Compare
            items={[
              {
                label: 'Everyone in the middle',
                verdict: 'worse',
                title: 'Melody, piano and pad all around middle C',
                bpm: 92,
                chordsAbove: 'C Am F G',
                parts: [
                  { inst: 'flute', label: 'Melody', notes: line('E4:1 G4 A4 G4 | E4:2 C4:2 | F4:1 A4 C5 A4 | G4:4') },
                  { inst: 'grand-piano', label: 'Piano', notes: chords('C Am F G', { center: 62, style: 'pulse', v: 0.6 }) },
                  { inst: 'warm-pad', label: 'Pad', notes: chords('C Am F G', { center: 62, v: 0.6 }) },
                ],
                caption: 'The tune is fighting two chord parts for the same octave.',
              },
              {
                label: 'Each in its own lane',
                verdict: 'better',
                title: 'Melody up, pad down, piano between',
                bpm: 92,
                chordsAbove: 'C Am F G',
                parts: [
                  { inst: 'flute', label: 'Melody', notes: line('E5:1 G5 A5 G5 | E5:2 C5:2 | F5:1 A5 C6 A5 | G5:4') },
                  { inst: 'grand-piano', label: 'Piano', notes: chords('C Am F G', { center: 64, style: 'pulse', v: 0.55 }) },
                  { inst: 'warm-pad', label: 'Pad', notes: chords('C Am F G', { center: 52, v: 0.5 }) },
                ],
                caption: 'Same parts, spread across registers. Every line is audible and the whole thing sounds bigger.',
              },
            ]}
          />
          <Tip>A quick test: solo your chord parts one at a time and look at the piano roll. If their notes all sit in the same handful of rows, move one of them up or down an octave (right-click the region, <Ui>Transpose</Ui> → <Ui>Up an Octave</Ui>), or simplify one part to just two notes.</Tip>

          <h2>Open and close voicings</h2>
          <p>A <b>close</b> voicing packs the chord's notes as tightly as possible (C–E–G). An <b>open</b> voicing spreads them over more than an octave (C–G–E). Close voicings are intimate and punchy, good for piano comping and guitar strums. Open voicings are spacious and grand, the sound of strings, choirs and film scores. A quick way to open a close chord: take its middle note and move it up an octave.</p>
          <Listen>
            <P notes="C4 E4 G4">close C</P> then <P notes="C3 G3 E4">open C</P>. Same three notes. One sounds like a pop piano; the other like the start of an orchestral swell.
          </Listen>

          <h2>Keep chords out of the melody's way</h2>
          <p>The top note of a chord is the one the ear notices most. If the chord's top note is <em>above</em> the melody, or clashes with it a half step away, the melody loses focus. Keep accompanying chords mostly <b>below</b> the tune, and avoid putting the melody's note right next to the same note in the chords.</p>
          <Watch>Writing chords with the melody note on top of the voicing as well as in the melody part is a classic way to get an accidental doubling that makes the melody sound smeared. Let the melody have its note to itself and voice the chord underneath.</Watch>

          <Try>
            <Steps>
              <li>Open a chord part in the piano roll and look at its lowest notes. If there are thirds below about C3, move the lower note up an octave or delete it.</li>
              <li>Spread out a close chord: select the middle note of each chord and press <K>⌘</K>/<K>Ctrl</K>+<K>↑</K> to move it up an octave.</li>
              <li>Mute instruments one at a time (<K>M</K>) and ask of each: what does this add that nothing else does? If the answer is "the same chords in the same octave", move it or cut it.</li>
              <li>Open <Ui>Check</Ui> (<K>⇧</K>+<K>W</K>) and look at the <Ui>Rubs</Ui> filter. It flags half steps held between parts, which is often a chord part clashing with the melody.</li>
            </Steps>
          </Try>
          <Pro>Orchestrators often voice the harmony around the melody like a hand around a ball: the bass far below, a couple of inner notes in the middle, and a clear gap of at least a third directly beneath the tune. That small gap is what lets a melody "float" over a full orchestra.</Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ texture
    {
      id: 'texture',
      title: 'Texture: pads, arpeggios and rhythm parts',
      minutes: 8,
      summary: 'One chord progression can be played as held pads, pulsing chords, flowing arpeggios, broken figures or off-beat stabs, and each one changes the mood and energy completely. Learn what each texture does and how to layer them without crowding.',
      keywords: 'texture pad arpeggio arp broken chord alberti pulse offbeat stabs comping rhythm part accompaniment density layering space',
      body: () => (
        <>
          <Lead>
            Once you've chosen the chords, you still have to decide <b>how they're played</b>. The same four chords can feel like a lullaby, a dance track or a film score depending only on the rhythm and shape of the accompaniment. That choice is called <b>texture</b>, and changing it is one of the fastest ways to give a section a new character.
          </Lead>

          <h2>Five ways to play the same chords</h2>
          <p>Here are the same chords, Am F C G, played in five common textures. Play them one after another and notice how each one changes the mood before you've written a single note of melody.</p>
          <Compare
            items={[
              {
                label: 'Held pad',
                title: 'Sustained chords',
                bpm: 90,
                chordsAbove: 'Am F C G',
                parts: [{ inst: 'warm-pad', label: 'Pad', notes: chords('Am F C G', { center: 60 }) }],
                caption: 'Calm, spacious, floating. Glue under everything else.',
              },
              {
                label: 'Pulse',
                title: 'Chords on every beat',
                bpm: 90,
                chordsAbove: 'Am F C G',
                parts: [{ inst: 'grand-piano', label: 'Piano', notes: chords('Am F C G', { center: 60, style: 'pulse' }) }],
                caption: 'Steady and driving. The classic pop-piano ballad and rock-keys texture.',
              },
              {
                label: 'Arpeggio',
                title: 'One note at a time, rolling',
                bpm: 90,
                chordsAbove: 'Am F C G',
                parts: [{ inst: 'pluck', label: 'Arp', notes: chords('Am F C G', { center: 62, style: 'arp' }) }],
                caption: 'Motion without heaviness. Synthwave, film, and fingerpicked guitar.',
              },
              {
                label: 'Broken',
                title: 'Low, high, middle, high',
                bpm: 90,
                chordsAbove: 'Am F C G',
                parts: [{ inst: 'grand-piano', label: 'Piano', notes: chords('Am F C G', { center: 58, style: 'broken' }) }],
                caption: 'Elegant and classical. A rocking figure that keeps the bass on the beat.',
              },
              {
                label: 'Off-beat',
                title: 'Short chords between the beats',
                bpm: 90,
                chordsAbove: 'Am F C G',
                parts: [
                  { inst: 'rock-organ', label: 'Organ', notes: chords('Am F C G', { center: 62, style: 'offbeat' }) },
                  { inst: 'electric-bass', label: 'Bass', notes: bass('Am F C G', { style: 'quarters' }) },
                ],
                caption: 'Bouncy, skanking. Reggae, ska and a lot of indie pop. Needs a bass on the beat to push against.',
              },
            ]}
          />
          <Spec
            title="Choosing a texture"
            rows={[
              ['Held pad', 'Intros, ambient sections, under a busy melody, anywhere you want space and warmth.'],
              ['Pulse', 'Verses and choruses that need momentum. Quarter notes feel steady; eighths feel urgent.'],
              ['Arpeggio', 'Building tension, adding movement without adding weight, gentle verses. Faster arps feel more excited.'],
              ['Broken', 'Piano-led songs, classical pieces, waltzes. Keeps a clear bass on the downbeat.'],
              ['Off-beat stabs', 'Grooves that need lift: reggae, ska, funk, house piano. Always pair with a strong on-beat part.'],
            ]}
          />

          <h2>Layering textures</h2>
          <p>Big arrangements usually combine two or three textures, each in its own register and rhythm: a slow layer (a pad or held strings), a medium layer (a pulse or the bass), and a fast layer (an arpeggio or hi-hats). Because each moves at a different speed, they interlock instead of competing.</p>
          <Example
            title="Three textures at three speeds"
            bpm={100}
            loop
            chordsAbove="Am F C G"
            parts={[
              { inst: 'pluck', label: 'Fast: arpeggio', notes: chords('Am F C G', { center: 72, style: 'arp', v: 0.55 }) },
              { inst: 'warm-pad', label: 'Slow: pad', notes: chords('Am F C G', { center: 58, v: 0.5 }) },
              { inst: 'synth-bass', label: 'Medium: bass', notes: bass('Am F C G', { style: 'quarters' }) },
            ]}
            caption="The arp is high and quick, the pad sits in the middle and barely moves, and the bass marks the beat underneath. Mute each one to hear what it contributes."
          />
          <Why>Your ear can follow a few things at once only if they're different. Three parts at three different speeds and three different heights give the listener a clear picture: here's the floor, here's the walls, here's the sparkle on top. Three parts all playing eighth-note chords in the same octave give them one undifferentiated blur.</Why>

          <h2>Density and space</h2>
          <p>Texture also means <b>how much is happening</b>. A common beginner habit is to fill every beat with something from the first bar. But a song with no change in density has nowhere to go. Thin textures make the next section feel bigger, and silence is part of the texture too.</p>
          <Compare
            items={[
              {
                label: 'Everything at once',
                verdict: 'worse',
                title: 'Pulse, arpeggio and broken chords together',
                bpm: 96,
                chordsAbove: 'C G Am F',
                parts: [
                  { inst: 'grand-piano', label: 'Pulse', notes: chords('C G Am F', { center: 60, style: 'pulse', v: 0.6 }) },
                  { inst: 'pluck', label: 'Arp', notes: chords('C G Am F', { center: 64, style: 'arp', v: 0.6 }) },
                  { inst: 'electric-piano', label: 'Broken', notes: chords('C G Am F', { center: 60, style: 'broken', v: 0.6 }) },
                ],
                caption: 'Three busy parts in the same register: no room left for a melody.',
              },
              {
                label: 'One busy part, one calm part',
                verdict: 'better',
                title: 'An arpeggio over a sparse pulse',
                bpm: 96,
                chordsAbove: 'C G Am F',
                parts: [
                  { inst: 'pluck', label: 'Arp', notes: chords('C G Am F', { center: 70, style: 'arp', v: 0.55 }) },
                  { inst: 'grand-piano', label: 'Chords', notes: chords('C G Am F', { center: 55, v: 0.5 }) },
                ],
                caption: 'Fewer notes, but clearer and wider. There\'s space in the middle for a melody to sit.',
              },
            ]}
          />
          <Watch>If your accompaniment sounds good on its own, it's probably too busy for a song. The accompaniment's job is to support the melody, and great accompaniments often sound a bit boring when soloed. That's normal.</Watch>

          <Try>
            <Steps>
              <li>Write your chords once as plain block chords in the piano roll. This is your harmonic sketch.</li>
              <li>Duplicate the track (right-click the track name, <Ui>Duplicate Track</Ui>) and rewrite the copy as a different texture: break the chords into an arpeggio, or chop them into short off-beat stabs.</li>
              <li>Give the copy a contrasting sound (click the track's icon to change instrument): a <Ui>Pluck</Ui> or <Ui>Harp</Ui> for arpeggios, <Ui>Warm Pad</Ui> or <Ui>String Ensemble</Ui> for pads, <Ui>Rock Organ</Ui> or <Ui>Funk Clav</Ui> for stabs.</li>
              <li>Use different textures for different sections: a pad in the verse, a pulse in the chorus, an arpeggio in the bridge. Mute parts per section to try combinations before committing.</li>
            </Steps>
          </Try>
          <Pro>Producers talk about "the arrangement doing the work". Instead of writing new chords for the chorus, they keep the same chords and switch texture: verse on a soft pad, chorus on driving eighth-note piano plus an arpeggio. The listener hears a big change even though the harmony hasn't moved.</Pro>
        </>
      ),
    },
  ],
};

export default chapter;
