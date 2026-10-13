import { Layers } from 'lucide-react';
import type { Chapter } from '../types';
import { Cards, ChordsInKey, Compare, Example, K, Keys, Lead, Listen, PlayChip as P, Pro, ProgressionPad, Spec, Steps, Tip, Try, Ui, Watch, Why } from '../figures';
import { bass, chords, drums, line } from '../notation';

/** A plain pop beat, repeated for `bars` bars. */
const popBeat = (bars: number) => drums({ k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars });
const rockBeat = (bars: number) => drums({ k: 'x.....x.x.......', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' }, { bars });
/** Swung ride pattern on a triplet grid (three characters per beat). */
const jazzRide = (bars: number) => drums({ r: 'x..x.xx..x.x', h: '...x.....x..' }, { bars, step: 1 / 3 });
const shuffle = (bars: number) => drums({ k: 'x.....x.....', s: '...x.....x..', h: 'x.xx.xx.xx.x' }, { bars, step: 1 / 3 });

const chapter: Chapter = {
  id: 'chords',
  title: 'Chord Progressions',
  blurb: 'Why chords move the way they do, the progressions behind thousands of songs, and making them your own.',
  icon: Layers,
  color: '#a07ae0',
  lessons: [
    // ------------------------------------------------------------------ 1
    {
      id: 'functions',
      title: 'Home, away and tension: what chords do',
      minutes: 9,
      summary: 'Every chord in a key has a job: it feels like home, like travelling away, or like tension that wants to get back. Once you hear those three jobs, progressions stop being a list to memorise and become a story you can tell.',
      keywords: 'tonic subdominant predominant dominant function resolution leading tone V7 roman numerals diatonic chords harmonic minor',
      body: () => (
        <>
          <Lead>
            A chord progression is a tiny story with three characters. One chord feels like <b>home</b>. Some chords feel like <b>going out</b>. One or two feel like <b>tension</b>, a pull to get back home. Almost every progression you love is some version of home → away → tension → home.
          </Lead>
          <p>
            In any key, you can build seven chords using only that key's notes: start on each note of the scale and stack every other note on top. In C major that gives you the seven chords below. Click them. Notice how the first one sounds settled, and how the fifth one (G) sounds like it is waiting for something.
          </p>
          <ChordsInKey tonic="C" caption="The seven chords of C major, numbered with Roman numerals: capitals are major chords, lower case are minor, ° is diminished. The colour shows each chord's job." />
          <p>
            The Roman numerals are worth learning, because they let you talk about a progression without caring which key it's in. "I–IV–V" means the same journey in C (C–F–G), in G (G–C–D) or in E♭ (E♭–A♭–B♭). Musicians who've never met can play a song together on that alone.
          </p>

          <h2>The three jobs</h2>
          <Cards
            items={[
              { title: 'Home: I (and vi, iii)', tag: 'tonic', color: '#5dbb7a', body: 'The I chord is where the key lives. Starting there tells the listener where they are; ending there says "the end". vi and iii share two notes with I, so they feel like softer, darker versions of home.' },
              { title: 'Away: IV and ii', tag: 'predominant', color: '#5b9be0', body: 'These move you off home without creating urgency. They feel like setting out, opening up, or a deep breath. Their most natural next move is to the tension chord.' },
              { title: 'Tension: V (and vii°)', tag: 'dominant', color: '#e8a33d', body: 'The V chord contains the one note that most wants to go home (see below). It creates a pull your ear expects to be answered by I. Holding it, or swerving away from it, is how songs build suspense.' },
            ]}
          />
          <Example
            title="The whole story in four chords: I – IV – V – I"
            bpm={80}
            chordsAbove="C F G C"
            parts={[
              { inst: 'grand-piano', label: 'Chords', notes: chords('C F G C', { center: 60 }) },
              { inst: 'electric-bass', label: 'Bass', notes: bass('C F G C') },
            ]}
            caption="Home (C), away (F), tension (G), home (C). Listen to how the G chord seems to lean forward, and how much relief the last C gives."
          />

          <h2>Why the V chord pulls so hard</h2>
          <p>
            It isn't magic, it's two specific notes. Take the V chord in C, which is G, and add the extra note that makes it G7: G, B, D, F. Two of those notes are sitting just one half step away from notes of the home chord, C–E–G.
          </p>
          <Keys from="G3" to="C5" marks={{ G3: 'G', B3: { label: 'B', color: '#e06a8f' }, D4: 'D', F4: { label: 'F', color: '#5b9be0' } }} caption="G7. The pink B is the leading note: it's a half step under C and wants to step up. The blue F is a half step above E and wants to fall." />
          <Example
            title="Watch the two restless notes resolve"
            names
            bpm={60}
            length={8}
            parts={[
              { inst: 'grand-piano', label: 'B → C (leading note)', color: '#e06a8f', notes: line('B3:4 C4:4') },
              { inst: 'grand-piano', label: 'F → E (the 7th)', color: '#5b9be0', notes: line('F4:4 E4:4') },
              { inst: 'grand-piano', label: 'The rest', color: '#8b8a86', notes: line('G2+D4:4 C3+G3:4') },
            ]}
            chordsAbove="G7 C"
            caption="Mute 'The rest' and the pull is still there: just two notes squeezing inward by a half step each. Add the bass falling from G to C, a drop of a 5th, which is the strongest bass move there is, and you have the most powerful resolution in Western music."
          />
          <Why>
            Half steps are the smallest, most "magnetic" distance in the scale. A note a half step from a stable note sounds like it is about to slide into it. V7 has two of them aimed at the I chord at once, plus a bass falling a 5th. That's why a song can wander anywhere and a single G7 → C makes it feel like you've arrived home.
          </Why>
          <p>
            The order matters less than the jobs. A few moves are so natural they feel like gravity, and once you know them you can build progressions by ear:
          </p>
          <Spec
            rows={[
              ['V → I', 'The strongest resolution. Use it to end phrases, sections and songs.'],
              ['IV → V, ii → V', 'Away to tension: the classic run-up to a resolution. ii → V → I is the backbone of jazz.'],
              ['IV → I', 'Away straight back home with no tension. Gentle and warm: the "Amen" at the end of a hymn.'],
              ['I → vi, I → IV', 'Leaving home. vi turns the mood darker; IV opens it up.'],
              ['V → vi', 'Sets up home… then swerves. A plot twist (more on this in the cadences lesson).'],
              ['vi → anything', 'vi is flexible. It can move to IV, ii, V or back to I.'],
            ]}
          />

          <h2>Same chords, different story</h2>
          <p>Here is the difference tension makes. Both versions use only chords from C major. Only one of them has a V.</p>
          <Compare
            items={[
              {
                label: 'No tension chord',
                title: 'C – Am – F – C',
                bpm: 84,
                chordsAbove: 'C Am F C',
                parts: [
                  { inst: 'grand-piano', label: 'Chords', notes: chords('C Am F C') },
                  { inst: 'electric-bass', label: 'Bass', notes: bass('C Am F C') },
                ],
                caption: 'Gentle and pleasant, but the return home feels like drifting back rather than arriving.',
              },
              {
                label: 'With tension',
                verdict: 'better',
                title: 'C – Am – Dm – G – C',
                bpm: 84,
                chordsAbove: 'C Am Dm:2 G:2 C',
                parts: [
                  { inst: 'grand-piano', label: 'Chords', notes: chords('C Am Dm:2 G:2 C') },
                  { inst: 'electric-bass', label: 'Bass', notes: bass('C Am Dm:2 G:2 C') },
                ],
                caption: 'Two beats of G before the last chord, and the ending suddenly feels earned.',
              },
            ]}
          />

          <h2>Minor keys borrow their tension</h2>
          <p>
            In a minor key the fifth chord is naturally minor (Em in A minor), and a minor v is weak: it has no leading note, because G is a whole step under A, not a half step. So for hundreds of years composers have simply raised that note, G to G♯, which turns Em into <b>E major</b>. That one change gives minor keys a real V.
          </p>
          <Compare
            items={[
              {
                label: 'Natural minor v',
                title: 'Am – Dm – Em – Am',
                bpm: 76,
                chordsAbove: 'Am Dm Em Am',
                parts: [
                  { inst: 'string-ensemble', label: 'Strings', notes: chords('Am Dm Em Am', { center: 60 }) },
                  { inst: 'cello', label: 'Bass', notes: bass('Am Dm Em Am', { octave: 2 }) },
                ],
                caption: 'Moody and modal, but the last chord barely resolves. Good for folk and film; weak as a full stop.',
              },
              {
                label: 'Major V',
                verdict: 'better',
                title: 'Am – Dm – E – Am',
                bpm: 76,
                chordsAbove: 'Am Dm E Am',
                parts: [
                  { inst: 'string-ensemble', label: 'Strings', notes: chords('Am Dm E Am', { center: 60 }) },
                  { inst: 'cello', label: 'Bass', notes: bass('Am Dm E Am', { octave: 2 }) },
                ],
                caption: 'The G♯ in E major is a leading note, a half step under A. Now the ending lands with real weight.',
              },
            ]}
          />
          <Tip>Both are useful. Use the minor v when you want a floating, ancient or Celtic sound. Use the major V when you want drama and a clear resolution, like most classical music, tango and a lot of film scores.</Tip>

          <h2>Try building stories yourself</h2>
          <p>
            This pad is just a sketchpad, not part of your song. Click chords to line them up and loop them. Try ending on a blue (away) chord, then on the orange (tension) one, then on home, and notice how each changes what you expect to happen next.
          </p>
          <ProgressionPad />
          <Watch>
            If every bar of your loop resolves to I, the song keeps stopping. Pop songs often <em>avoid</em> landing on I at the end of a loop (C–G–Am–F never resolves back to C on its own), which is exactly why they can repeat for three minutes without feeling finished. Save the strong V → I for the places you actually want a full stop.
          </Watch>

          <h2>In BandForge</h2>
          <Try>
            <Steps>
              <li>
                In the tracks view, press <Ui>Chords</Ui> in the toolbar to show the chord track under the ruler.
              </li>
              <li>
                Click an empty bar in the chord lane. The chord picker opens with <b>In the key</b>: the same seven chords as above, labelled with Roman numerals. Click one to hear it and drop it in.
              </li>
              <li>
                Click a chord you've placed to hear it again or change it, drag it to move it, and drag its right edge to make it longer or shorter.
              </li>
              <li>
                Press <K>W</K> to open the <Ui>Chord Track</Ui> panel. Under <b>Next chord ideas</b> it lists chords that commonly follow your last one, with a short reason for each, which is a handy way to learn these moves. You still choose every chord.
              </li>
            </Steps>
          </Try>
          <Pro>
            Experienced writers don't think "C then G". They think "home, then tension" and choose the specific chord for its colour afterwards. When a progression isn't working, ask which job each chord is doing. Usually you'll find two "away" chords that need a tension chord between them, or a V that resolves too early.
          </Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ 2
    {
      id: 'classics',
      title: 'The progressions behind thousands of songs',
      minutes: 12,
      summary: 'Eight progressions power a huge share of popular music. Hear each one, learn what mood it carries and where you know it from, so you can pick the right one on purpose and then make it your own.',
      keywords: 'four chord song axis I V vi IV 50s doo wop ii V I jazz 12 bar blues pachelbel canon andalusian cadence aeolian minor progression common progressions',
      body: () => (
        <>
          <Lead>
            Chord progressions aren't owned by anyone. The same four chords sit under hundreds of hit songs, and nobody minds, because the melody, rhythm, lyrics and sound are what make a song itself. Knowing these classics gives you a vocabulary: you can reach for a mood the way a painter reaches for a colour.
          </Lead>
          <p>All the examples are in C major or A minor so you can compare them. Mute the drums or bass to hear the chords on their own.</p>

          <h2>1. I – V – vi – IV: the anthem</h2>
          <Example
            title="C – G – Am – F"
            bpm={100}
            loop
            chordsAbove="C G Am F"
            parts={[
              { inst: 'grand-piano', label: 'Piano', notes: chords('C G Am F', { style: 'pulse' }) },
              { inst: 'electric-bass', label: 'Bass', notes: bass('C G Am F', { style: 'eighths' }) },
              { inst: 'kit-acoustic', label: 'Drums', notes: popBeat(4) },
            ]}
            caption="Uplifting with a lump in the throat: the vi adds a moment of sadness before IV lifts it again. 'Let It Be', 'Don't Stop Believin'', 'With or Without You', 'No Woman, No Cry', 'Someone Like You'."
          />
          <p>
            It works because it never quite resolves: it ends on IV, which wants to go back to I, so it loops forever. The bass also walks down C–B–A in the first three chords if you play G with B in the bass, which is why piano versions often sound so smooth.
          </p>

          <h2>2. vi – IV – I – V: the same chords, starting sad</h2>
          <Example
            title="Am – F – C – G"
            bpm={88}
            loop
            chordsAbove="Am F C G"
            parts={[
              { inst: 'acoustic-guitar', label: 'Guitar', notes: chords('Am F C G', { style: 'arp', center: 58 }) },
              { inst: 'electric-bass', label: 'Bass', notes: bass('Am F C G') },
            ]}
            caption="Starting on the minor chord makes the whole loop feel yearning and restless. 'Zombie' by The Cranberries, 'Despacito', countless emotional pop and rock choruses."
          />
          <Why>
            Your ear treats the first chord of a loop as home. Start on C and the minor chord is a shadow passing through; start on Am and C becomes the brief ray of light. Same four chords, opposite feeling. Rotating a progression to start on a different chord is one of the cheapest, most effective tricks there is.
          </Why>

          <h2>3. I – vi – IV – V: the 1950s progression</h2>
          <Example
            title="C – Am – F – G"
            bpm={72}
            loop
            chordsAbove="C Am F G"
            parts={[
              { inst: 'grand-piano', label: 'Piano', notes: chords('C Am F G', { style: 'broken', center: 60 }) },
              { inst: 'upright-bass', label: 'Bass', notes: bass('C Am F G', { style: 'root5' }) },
            ]}
            caption="Sweet, nostalgic, romantic. 'Stand By Me', 'Earth Angel', 'Every Breath You Take', and endless doo-wop ballads."
          />
          <p>It's the pop anthem's older sibling: same chords, but it reaches the tension chord (G) at the end of every loop, so it constantly pulls back to the start. That pull is what gives it its swaying, slow-dance feeling.</p>

          <h2>4. ii – V – I: the jazz engine</h2>
          <Example
            title="Dm7 – G7 – Cmaj7"
            bpm={120}
            loop
            chordsAbove="Dm7 G7 Cmaj7:8"
            parts={[
              { inst: 'electric-piano', label: 'Keys', notes: chords('Dm7 G7 Cmaj7:8', { style: 'stabs', center: 60 }) },
              { inst: 'upright-bass', label: 'Walking bass', notes: bass('Dm7 G7 Cmaj7 Cmaj7', { style: 'walk' }) },
              { inst: 'kit-acoustic', label: 'Ride', notes: jazzRide(4) },
            ]}
            caption="Sophisticated and smooth. It's the backbone of jazz standards like 'Autumn Leaves' and 'Fly Me to the Moon', and of a lot of soul, R&B and bossa nova."
          />
          <p>
            Away → tension → home, in its purest form, with seventh chords for richness. In jazz the whole song is often a chain of ii–V–Is moving through different keys, which is why players practise it in all twelve.
          </p>

          <h2>5. i – VII – VI – VII and friends: epic minor</h2>
          <Example
            title="Am – G – F – G"
            bpm={96}
            loop
            chordsAbove="Am G F G"
            parts={[
              { inst: 'electric-guitar', label: 'Guitar', notes: chords('Am G F G', { style: 'stabs', center: 57 }) },
              { inst: 'electric-bass', label: 'Bass', notes: bass('Am G F G', { style: 'eighths' }) },
              { inst: 'kit-acoustic', label: 'Drums', notes: rockBeat(4) },
            ]}
            caption="Driving and dark, with no leading note, so it feels ancient and stubborn rather than tense. 'All Along the Watchtower' rocks between these three chords."
          />
          <p>
            Its cousin <b>i – VI – III – VII</b> (Am – F – C – G) is literally the same chords as number 2, but felt with A minor as home. Swap between "starting on C" and "starting on Am" and you can hear the whole idea of relative keys in action. Film and game music lean on these minor loops constantly, usually with big drums and strings.
          </p>

          <h2>6. The 12-bar blues</h2>
          <Example
            title="12 bars in C, with a shuffle"
            bpm={120}
            height={130}
            chordsAbove="C7 F7 C7 C7 F7 F7 C7 C7 G7 F7 C7 G7"
            parts={[
              { inst: 'honky-tonk', label: 'Piano', notes: chords('C7 F7 C7 C7 F7 F7 C7 C7 G7 F7 C7 G7', { style: 'stabs', center: 60 }) },
              { inst: 'electric-bass', label: 'Walking bass', notes: bass('C7 F7 C7 C7 F7 F7 C7 C7 G7 F7 C7 G7', { style: 'walk' }) },
              { inst: 'kit-acoustic', label: 'Shuffle', notes: shuffle(12) },
            ]}
            caption="Three lines of four bars: I for four bars, IV–IV–I–I, then V–IV–I–V to turn around. 'Johnny B. Goode', 'Hound Dog', 'Pride and Joy', and the foundation of rock 'n' roll."
          />
          <Tip>
            In the blues, every chord is a 7th chord, even I and IV. In classical theory that "shouldn't" happen (a 7th chord is supposed to be tension), but in the blues it is the home sound. It's a great reminder that theory describes styles; it doesn't police them.
          </Tip>

          <h2>7. The Canon: a bass line that walks down</h2>
          <Example
            title="C – G/B – Am – Em/G – F – C/E – F – G"
            bpm={76}
            loop
            chordsAbove="C:2 G/B:2 Am:2 Em/G:2 F:2 C/E:2 F:2 G:2"
            parts={[
              { inst: 'grand-piano', label: 'Piano', notes: chords('C:2 G:2 Am:2 Em:2 F:2 C:2 F:2 G:2', { style: 'broken', center: 64 }) },
              { inst: 'cello', label: 'Cello bass', notes: line('C3:2 B2 A2 G2 F2 E2 F2 G2') },
            ]}
            caption="The chords of Pachelbel's Canon. The magic is the bass, stepping down one note at a time. Green Day's 'Basket Case' and Maroon 5's 'Memories' are built on versions of it."
          />
          <p>
            The slash chords (G/B means "G chord with B in the bass") exist purely to make that bass line step smoothly. This is the first hint of something big: a progression is two things at once, a series of chords <em>and</em> a bass melody. Great progressions usually have a great bass line.
          </p>

          <h2>8. The Andalusian cadence: walking down in minor</h2>
          <Example
            title="Am – G – F – E"
            bpm={90}
            loop
            chordsAbove="Am G F E"
            parts={[
              { inst: 'nylon-guitar', label: 'Guitar', notes: chords('Am G F E', { style: 'arp', center: 57 }) },
              { inst: 'upright-bass', label: 'Bass', notes: bass('Am G F E') },
            ]}
            caption="Flamenco's signature, and a staple of dramatic pop: 'Hit the Road Jack', the verses of 'Sultans of Swing'. The last chord is E major, borrowing the leading note G♯ to pull back to Am."
          />

          <h2>Cheat sheet</h2>
          <Spec
            title="Pick a mood"
            rows={[
              ['Hopeful, anthemic', <>I–V–vi–IV <P chords="C G Am F">C G Am F</P></>],
              ['Yearning, emotional', <>vi–IV–I–V <P chords="Am F C G">Am F C G</P></>],
              ['Nostalgic, romantic', <>I–vi–IV–V <P chords="C Am F G">C Am F G</P></>],
              ['Smooth, sophisticated', <>ii–V–I <P chords="Dm7 G7 Cmaj7:4">Dm7 G7 Cmaj7</P></>],
              ['Dark, driving', <>i–VII–VI–VII <P chords="Am G F G">Am G F G</P></>],
              ['Gritty, bluesy', <>12-bar blues with 7th chords <P chords="C7 F7 C7 G7">C7 F7 C7 G7</P></>],
              ['Grand, flowing', <>Descending bass (Canon) <P chords="C G/B Am Em/G F C/E F G">C G/B Am Em/G…</P></>],
              ['Fiery, Spanish, fatalistic', <>Andalusian i–VII–VI–V <P chords="Am G F E">Am G F E</P></>],
            ]}
          />
          <Watch>
            Using a famous progression doesn't make a song generic, but using it <em>exactly as everyone else does</em> can: the same chords, one per bar, held as block chords, in the same key. The last lesson in this chapter shows how to keep the progression and change everything around it so it sounds like yours.
          </Watch>

          <h2>In BandForge</h2>
          <Try>
            <Steps>
              <li>
                Set your song's key in <Ui>Song settings</Ui> (the gear icon), then show the chord track with <Ui>Chords</Ui>.
              </li>
              <li>
                Click each bar and pick the chords from the cheat sheet using the Roman numerals in the picker. For slash chords like G/B, choose the chord and then set <b>Bass</b> at the bottom of the picker.
              </li>
              <li>
                Write your own part on an instrument track that follows the chords: block chords first, then try changing the rhythm. The chord track is only a guide; what you hear is the part you write.
              </li>
              <li>
                To try the same progression in another key, tick <b>Transpose existing notes when the key changes</b> in Song settings, then pick a new key. Your notes and the chord track move together, and the Roman numerals stay the same.
              </li>
            </Steps>
          </Try>
          <Listen>
            For one week, try to name the progression in every song you hear. Most pop choruses are one of the first three on this page, often rotated to start on a different chord. Once you can spot them, you'll start noticing the moments where a song does something <em>different</em>, and those moments are exactly the ones worth stealing.
          </Listen>
        </>
      ),
    },

    // ------------------------------------------------------------------ 3
    {
      id: 'cadences',
      title: 'Cadences: how phrases end',
      minutes: 8,
      summary: 'The last two chords of a phrase work like punctuation: a full stop, a comma, an "amen" or a plot twist. Learn the four cadences and you control whether listeners relax, lean in, or get surprised.',
      keywords: 'cadence perfect authentic imperfect half plagal amen interrupted deceptive V vi ending phrase punctuation picardy',
      body: () => (
        <>
          <Lead>
            Music is heard in phrases, usually 2 or 4 bars long, a bit like sentences. The chords at the end of each phrase tell the listener how to feel about what they just heard: finished, unfinished, comforted, or tricked. Those endings are called <b>cadences</b>.
          </Lead>
          <Cards
            items={[
              { title: 'Perfect (authentic): V → I', tag: 'full stop', color: '#5dbb7a', body: <>Tension resolved. Use it at the end of a section or the song. <P chords="F:2 G:2 C:4">F G C</P></> },
              { title: 'Imperfect (half): … → V', tag: 'comma', color: '#e8a33d', body: <>The phrase stops on the tension chord. It sounds like a question and makes people lean in for the answer. <P chords="C:2 F:2 G:4">C F G</P></> },
              { title: 'Plagal: IV → I', tag: 'amen', color: '#5b9be0', body: <>Home without the tension: warm, calm, a bit churchy. The "A-men" at the end of hymns. <P chords="C:2 F:2 C:4">C F C</P></> },
              { title: 'Interrupted (deceptive): V → vi', tag: 'plot twist', color: '#e06a8f', body: <>You're set up for home and get the minor chord instead. A gasp, or a reason to keep going. <P chords="F:2 G:2 Am:4">F G Am</P></> },
            ]}
          />
          <p>
            British and American musicians use different names (perfect/authentic, imperfect/half, interrupted/deceptive), so you'll see both. What matters is the effect.
          </p>

          <h2>Question and answer</h2>
          <p>
            The most common use of cadences is to pair phrases: the first ends on V (a question), the second ends V → I (the answer). This "period" structure is everywhere, from Mozart to nursery rhymes to pop verses, because it gives listeners a satisfying sense of shape.
          </p>
          <Example
            title="An 8-bar period: imperfect cadence, then perfect"
            bpm={96}
            chordsAbove="C F C G C F G7 C"
            mark={[
              [12, 16, 'Question: ends on V'],
              [28, 32, 'Answer: V → I'],
            ]}
            parts={[
              { inst: 'flute', label: 'Melody', notes: line('E4:1 G4 C5:1.5 B4:0.5 | A4:1 F4 A4 C5 | G4:1.5 E4:0.5 C4:1 E4:1 | D4:4 | E4:1 G4 C5:1.5 B4:0.5 | A4:1 C5 D5 C5 | B4:1 G4 F4 D4 | C4:4') },
              { inst: 'grand-piano', label: 'Chords', notes: chords('C F C G C F G7 C', { center: 55 }), vol: 0.75 },
              { inst: 'upright-bass', label: 'Bass', notes: bass('C F C G C F G7 C') },
            ]}
            caption="Both phrases start the same. The first stops on G with the melody on D, so it hangs in the air. The second reaches G7 → C with the melody falling to C, and the whole thing closes."
          />
          <Why>
            A cadence is strongest when everything agrees: the bass falls from 5 to 1, the chord goes V → I, and the melody lands on the key note on a strong beat. Change any one of those (melody ending on the 3rd, I chord with its 3rd in the bass, the final chord on a weak beat) and the ending softens. Classical composers used softer endings mid-piece and saved the fully agreed version for the very end.
          </Why>

          <h2>The plot twist: interrupted cadences</h2>
          <p>
            V → vi works because vi shares two notes with I. Your ear hears most of the expected resolution, but the bass goes up a step instead of down a 5th, and the chord turns minor. It's the perfect way to delay an ending: songwriters often hit V → vi at the end of a chorus, repeat the last line, and only then give you V → I.
          </p>
          <Compare
            items={[
              {
                label: 'Perfect cadence',
                title: 'G → C: the end',
                bpm: 80,
                chordsAbove: 'F Dm G C',
                parts: [
                  { inst: 'string-ensemble', label: 'Melody', notes: line('A4:1 G4 F4 A4 | F4:2 D4:2 | B3:1 D4 G4 F4 | E4:4') },
                  { inst: 'grand-piano', label: 'Chords', notes: chords('F Dm G C', { center: 55 }) },
                  { inst: 'cello', label: 'Bass', notes: bass('F Dm G C') },
                ],
              },
              {
                label: 'Interrupted cadence',
                title: 'G → Am: wait, not yet',
                bpm: 80,
                chordsAbove: 'F Dm G Am',
                parts: [
                  { inst: 'string-ensemble', label: 'Melody', notes: line('A4:1 G4 F4 A4 | F4:2 D4:2 | B3:1 D4 G4 F4 | E4:4') },
                  { inst: 'grand-piano', label: 'Chords', notes: chords('F Dm G Am', { center: 55 }) },
                  { inst: 'cello', label: 'Bass', notes: bass('F Dm G Am') },
                ],
                caption: 'The melody is identical: E belongs to both C and Am, so it still feels "right", just bittersweet and unfinished.',
              },
            ]}
          />

          <h2>Two endings worth knowing</h2>
          <ul>
            <li>
              <b>The minor plagal ending</b>: IV → iv → I (<P chords="C:2 F:2 Fm:2 C:4">C F Fm C</P>). Borrowing the minor iv just before home gives a wistful, cinematic ending. Radiohead's 'Creep' circles around this sound with its major-to-minor IV.
            </li>
            <li>
              <b>The Picardy third</b>: a minor-key piece that ends on a <em>major</em> I (<P chords="Am:2 Dm:2 E:2 A:4">Am Dm E A</P>). Bach did it constantly. It's like sunlight breaking through at the last moment.
            </li>
          </ul>

          <h2>Where to put which cadence</h2>
          <Spec
            rows={[
              ['End of a verse before the chorus', 'Imperfect (stop on V) or a long V to build anticipation. You want people leaning forward.'],
              ['End of a chorus', 'Perfect cadence the final time. Earlier times, it can loop back without resolving.'],
              ['Before a last repeat', 'Interrupted cadence (V → vi), then repeat the last line and finish with V → I.'],
              ['The final chord of the song', 'Perfect or plagal. Ending on V or vi leaves the song unresolved, which can be a powerful choice if it is deliberate.'],
              ['Middle of a phrase', 'Avoid strong V → I cadences mid-phrase, or the music keeps stopping.'],
            ]}
          />
          <Watch>
            A very common beginner ending: the song simply stops on whatever chord the loop was on, often IV or V. If your ending feels abrupt, it usually isn't the arrangement, it's the missing cadence. Add a bar of V and finish on I, with the melody landing on the key note.
          </Watch>

          <h2>In BandForge</h2>
          <Try>
            <Steps>
              <li>
                Write a 4-bar melody, then copy it to bars 5–8. On the chord track, make bar 4 a V chord and bar 8 a I chord.
              </li>
              <li>
                Change the last note of bars 1–4 to the 2nd or 5th note of the scale, and the last note of bars 5–8 to the key note. Listen to the question-and-answer shape appear.
              </li>
              <li>
                Now change the chord in bar 8 to vi. Click the chord in the chord lane and pick it from <b>In the key</b>. Hear how the music now wants to keep going.
              </li>
              <li>
                In the <Ui>Score</Ui>, press <K>⌘</K>/<K>Ctrl</K>+<K>K</K> on a note to type chord symbols straight onto the sheet music.
              </li>
            </Steps>
          </Try>
          <Pro>
            Producers often build a whole song around delaying the perfect cadence. The verse ends on V, the pre-chorus ends on a long V, the chorus starts on IV or vi instead of I, and the first real V → I with the melody on the key note comes at the very end. Listeners feel that payoff even if they couldn't explain it.
          </Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ 4
    {
      id: 'borrowed',
      title: 'Borrowed chords and secondary dominants',
      minutes: 10,
      summary: 'The chords that make people say "ooh": a minor IV in a major song, a heroic ♭VI–♭VII–I, an E7 that drags you into Am. Learn where these colour chords come from and how to use them without losing the key.',
      keywords: 'borrowed chord modal mixture modal interchange parallel minor iv minor four flat seven bVII bVI bIII mario cadence secondary dominant V of V applied dominant chromatic',
      body: () => (
        <>
          <Lead>
            If you only ever use the seven chords of the key, your music will be correct and slightly flat. The moments that give people goosebumps are often one chord from <em>outside</em> the key. There are two families of these colour chords, and both are easy once you know where they come from.
          </Lead>

          <h2>Family 1: borrowing from the parallel minor</h2>
          <p>
            C major and C minor share the same home note, so a song in C major can "borrow" chords from C minor for a moment without getting lost. These four do almost all the work:
          </p>
          <Cards
            items={[
              { title: 'iv (Fm in C)', tag: 'the sad four', color: '#5b9be0', body: <>A major IV turned minor. Instantly bittersweet and nostalgic. Usually right after the normal IV. <P chords="C:2 F:2 Fm:2 C:4">C F Fm C</P></> },
              { title: '♭VII (B♭ in C)', tag: 'rock and roll', color: '#e8a33d', body: <>Confident, open, a bit rebellious. The end of 'Hey Jude' rocks I–♭VII–IV–I. <P chords="C:2 Bb:2 F:2 C:4">C B♭ F C</P></> },
              { title: '♭VI (A♭ in C)', tag: 'epic', color: '#a07ae0', body: <>Dark and grand. ♭VI–♭VII–I is the heroic "level complete" fanfare from Super Mario, and the climax of many film cues. <P chords="Ab:2 Bb:2 C:4">A♭ B♭ C</P></> },
              { title: '♭III (E♭ in C)', tag: 'bold', color: '#e06a8f', body: <>Bright but unexpected, very rock and Britpop. Works well heading to IV. <P chords="C:2 Eb:2 F:2 C:2">C E♭ F C</P></> },
            ]}
          />
          <Compare
            items={[
              {
                label: 'Plain IV',
                title: 'C – F – C',
                bpm: 72,
                chordsAbove: 'C F C:8',
                parts: [
                  { inst: 'grand-piano', label: 'Chords', notes: chords('C F C:8', { center: 57 }) },
                  { inst: 'string-ensemble', label: 'Melody', notes: line('E4:2 G4:2 | A4:4 | G4:8') },
                ],
              },
              {
                label: 'IV, then minor iv',
                verdict: 'better',
                title: 'C – F – Fm – C',
                bpm: 72,
                chordsAbove: 'C F:2 Fm:2 C:8',
                parts: [
                  { inst: 'grand-piano', label: 'Chords', notes: chords('C F:2 Fm:2 C:8', { center: 57 }) },
                  { inst: 'string-ensemble', label: 'Melody', notes: line('E4:2 G4:2 | A4:2 Ab4:2 | G4:8') },
                ],
                caption: 'Listen to the melody: A slides down to A♭ then G. That half-step slide is where the emotion lives.',
              },
            ]}
          />
          <Why>
            Borrowed chords keep the same home note, so your ear never loses its bearings; it just hears home in a different light. The minor iv works especially well because its A♭ sits a half step above G, the 5th of the home chord, so it slides into the final chord like a sigh.
          </Why>
          <Compare
            items={[
              {
                label: 'Diatonic run-up',
                title: 'C – Am – F – G – C',
                bpm: 92,
                chordsAbove: 'C Am F:2 G:2 C',
                parts: [
                  { inst: 'brass-section', label: 'Brass', notes: chords('C Am F:2 G:2 C', { center: 60 }) },
                  { inst: 'tuba', label: 'Bass', notes: bass('C Am F:2 G:2 C') },
                ],
              },
              {
                label: '♭VI – ♭VII – I',
                verdict: 'better',
                title: 'C – Am – A♭ – B♭ – C',
                bpm: 92,
                chordsAbove: 'C Am Ab:2 Bb:2 C',
                parts: [
                  { inst: 'brass-section', label: 'Brass', notes: chords('C Am Ab:2 Bb:2 C', { center: 60 }) },
                  { inst: 'tuba', label: 'Bass', notes: bass('C Am Ab:2 Bb:2 C') },
                ],
                caption: 'Two borrowed chords marching up by whole steps into home. Heroic, triumphant, a little bit video game.',
              },
            ]}
          />

          <h2>Family 2: secondary dominants</h2>
          <p>
            In the first lesson you saw that V pulls to I because of its leading note. Here's the trick: you can give <em>any</em> major or minor chord in the key its own V. To make a chord feel like a temporary home, put the major chord (or 7th chord) a 5th above it just before it.
          </p>
          <Keys from="C4" to="D5" marks={{ D4: 'D', 'F#4': { label: 'F♯', color: '#e06a8f' }, A4: 'A', C5: 'C' }} caption="D7, the 'V of V' in C. The F♯ isn't in C major. It's a half step below G, so it acts as a leading note into the G chord." />
          <Compare
            items={[
              {
                label: 'All in the key',
                title: 'C – Am – Dm – G',
                bpm: 88,
                chordsAbove: 'C Am Dm G',
                parts: [
                  { inst: 'electric-piano', label: 'Keys', notes: chords('C Am Dm G', { center: 60 }) },
                  { inst: 'electric-bass', label: 'Bass', notes: bass('C Am Dm G') },
                ],
              },
              {
                label: 'With V of V',
                verdict: 'better',
                title: 'C – Am – D7 – G',
                bpm: 88,
                chordsAbove: 'C Am D7 G',
                parts: [
                  { inst: 'electric-piano', label: 'Keys', notes: chords('C Am D7 G', { center: 60 }) },
                  { inst: 'electric-bass', label: 'Bass', notes: bass('C Am D7 G') },
                ],
                caption: 'Swapping Dm for D7 adds F♯, which pulls hard into G. The G now feels like an arrival, not just the next chord.',
              },
            ]}
          />
          <Spec
            title="Secondary dominants in C major"
            rows={[
              ['A7 → Dm', <>V of ii. <P chords="C:2 A7:2 Dm:2 G:2">C A7 Dm G</P></>],
              ['B7 → Em', <>V of iii. Unusual and dramatic. <P chords="C:2 B7:2 Em:4">C B7 Em</P></>],
              ['C7 → F', <>V of IV. Bluesy, gospel. <P chords="C:2 C7:2 F:4">C C7 F</P></>],
              ['D7 → G', <>V of V. The most common, very Beatles. <P chords="C:2 D7:2 G:4">C D7 G</P></>],
              ['E7 → Am', <>V of vi. Everywhere in pop and musicals, pure drama. <P chords="C:2 E7:2 Am:4">C E7 Am</P></>],
            ]}
          />
          <Example
            title="A chain of secondary dominants"
            bpm={100}
            loop
            chordsAbove="C:2 E7:2 Am:2 A7:2 Dm:2 G7:2 C:4"
            parts={[
              { inst: 'grand-piano', label: 'Piano', notes: chords('C:2 E7:2 Am:2 A7:2 Dm:2 G7:2 C:4', { style: 'pulse', center: 60 }) },
              { inst: 'upright-bass', label: 'Bass', notes: bass('C:2 E7:2 Am:2 A7:2 Dm:2 G7:2 C:4', { style: 'quarters' }) },
            ]}
            caption="E7 pulls to Am, A7 pulls to Dm, G7 pulls home. Each chord is briefly a home and then the next chord's run-up. This is how ragtime, jazz and musical theatre get their sense of momentum."
          />
          <Tip>
            How to spot one: a major or dominant-7th chord that isn't in the key, followed by a chord whose root is a 5th lower. If it doesn't resolve that way, it's probably borrowed instead. Both are fine, they just do different jobs.
          </Tip>

          <h2>Keep the melody in on the secret</h2>
          <p>
            A colour chord changes a note of the scale for a moment: A becomes A♭ over Fm, F becomes F♯ over D7. If the melody keeps singing the normal note on top, you get a sour clash. Either follow the chord (sing A♭ over Fm), or rest or hold a note the two share (C works over both F and Fm).
          </p>
          <Watch>
            One or two colour chords per section is plenty. Use them at the emotional moments, the end of a chorus, the last line before a key moment, and resolve them home. A progression where every other chord is from outside the key loses its sense of home, and then nothing sounds special any more.
          </Watch>

          <h2>In BandForge</h2>
          <Try>
            <Steps>
              <li>
                On the chord track, click a chord to open the picker. Under <b>Any chord</b>, choose a root (for example F) and a quality (m for minor, 7 for a dominant 7th), then press the button at the bottom to place it.
              </li>
              <li>
                BandForge spells borrowed chords with flats (B♭, A♭, E♭), so you can see at a glance they come from the minor side.
              </li>
              <li>
                Open <Ui>Check</Ui> (<K>⇧</K>+<K>W</K>) after adding a colour chord. It flags held melody notes that clash with the chord track, which is exactly the A-over-Fm problem described above.
              </li>
            </Steps>
          </Try>
          <Listen>
            Next time a song gives you chills on one particular chord, check whether it's a ♭VI, a minor iv or an E7-type secondary dominant. It usually is. Pop writers deploy them sparingly, often just once in the whole song, right before the final chorus.
          </Listen>
        </>
      ),
    },

    // ------------------------------------------------------------------ 5
    {
      id: 'make-it-yours',
      title: 'Harmonic rhythm and making progressions yours',
      minutes: 10,
      summary: 'Most "generic" songs use ordinary chords in ordinary ways. Change how often the chords move, when they land, what is in the bass and how the part is played, and four stock chords become a sound nobody else has.',
      keywords: 'harmonic rhythm anticipation push pedal point inversions slash chords bass line voicing rhythm comping extensions add9 sus4 maj7 m7 substitution originality',
      body: () => (
        <>
          <Lead>
            Two songs can use exactly C–G–Am–F and sound nothing alike. The difference is never the chord names. It's <b>when</b> the chords change, <b>what's in the bass</b>, <b>how the part is played</b> and <b>which colours</b> are added. Here are the levers, one at a time.
          </Lead>

          <h2>1. Harmonic rhythm: how often chords change</h2>
          <p>
            The speed of chord changes is called <b>harmonic rhythm</b>, and it is one of the biggest controls you have over energy. Slow changes (one chord every two bars) feel spacious and calm; fast changes (two chords a bar) feel busy and urgent. Most songs speed up their harmonic rhythm as they approach a cadence, like a runner sprinting at the finish.
          </p>
          <Example
            title="Speeding up into the cadence"
            bpm={100}
            chordsAbove="C:8 Am:8 F:4 G:4 Em:2 Am:2 Dm:2 G:2 C:8"
            height={120}
            parts={[
              { inst: 'grand-piano', label: 'Piano', notes: chords('C:8 Am:8 F:4 G:4 Em:2 Am:2 Dm:2 G:2 C:8', { style: 'pulse', center: 60 }) },
              { inst: 'electric-bass', label: 'Bass', notes: bass('C:8 Am:8 F:4 G:4 Em:2 Am:2 Dm:2 G:2 C:8', { style: 'quarters' }) },
            ]}
            caption="Two bars per chord, then one, then two per bar, then the arrival. Same tempo throughout, yet it feels like it speeds up."
          />
          <Tip>A reliable verse/chorus trick: keep the verse's chords slow (or even on one chord) so the lyrics have room, then double the harmonic rhythm in the pre-chorus. The chorus can slow down again, and it will feel huge by contrast.</Tip>

          <h2>2. Push the changes</h2>
          <p>
            In a lot of pop, rock and funk, the next chord arrives half a beat <em>before</em> the bar line, on the "and" of beat 4. This is called an <b>anticipation</b> or a "push", and it makes a progression feel like it's leaning forward.
          </p>
          <Compare
            items={[
              {
                label: 'On the beat',
                title: 'Changes on beat 1',
                bpm: 104,
                loop: true,
                chordsAbove: 'C G Am F',
                parts: [
                  { inst: 'electric-piano', label: 'Keys', notes: chords('C G Am F', { center: 60 }) },
                  { inst: 'kit-acoustic', label: 'Drums', notes: popBeat(4) },
                ],
              },
              {
                label: 'Pushed',
                verdict: 'better',
                title: 'Changes on the "and" of 4',
                bpm: 104,
                loop: true,
                chordsAbove: [
                  [0, 'C'],
                  [3.5, 'G'],
                  [7.5, 'Am'],
                  [11.5, 'F'],
                ],
                parts: [
                  { inst: 'electric-piano', label: 'Keys', notes: chords('C:3.5 G:4 Am:4 F:4.5', { center: 60 }) },
                  { inst: 'kit-acoustic', label: 'Drums', notes: popBeat(4) },
                ],
                caption: 'Same chords, same drums. Each change jumps in half a beat early and the loop suddenly has momentum.',
              },
            ]}
          />

          <h2>3. Change the bass: inversions and pedal points</h2>
          <p>
            The bass note changes the feeling of a chord more than any other note. Two techniques give you a lot of control:
          </p>
          <ul>
            <li>
              <b>Inversions</b>: put a note other than the root in the bass (written C/E, G/B…) so the bass moves by step instead of jumping. Smooth bass lines make progressions sound "written", not just strummed.
            </li>
            <li>
              <b>Pedal point</b>: keep the bass on one note while the chords change above it. It builds tension, because the chords keep pulling against a bass that won't move, then releases it when the bass finally moves.
            </li>
          </ul>
          <Compare
            items={[
              {
                label: 'Roots in the bass',
                title: 'Bass jumps: C, G, A, F',
                bpm: 84,
                chordsAbove: 'C G Am F',
                parts: [
                  { inst: 'grand-piano', label: 'Piano', notes: chords('C G Am F', { center: 62 }) },
                  { inst: 'electric-bass', label: 'Bass', notes: line('C2:4 G2 A2 F2') },
                ],
              },
              {
                label: 'Inversion',
                verdict: 'better',
                title: 'C – G/B – Am – F: bass steps down C, B, A',
                bpm: 84,
                chordsAbove: 'C G/B Am F',
                parts: [
                  { inst: 'grand-piano', label: 'Piano', notes: chords('C G Am F', { center: 62 }) },
                  { inst: 'electric-bass', label: 'Bass', notes: line('C2:4 B1 A1 F1') },
                ],
                caption: 'Only one bass note changed, and the progression now flows downhill like a melody.',
              },
            ]}
          />
          <Example
            title="Pedal point: C stays in the bass while the chords move"
            bpm={76}
            chordsAbove="C F/C G/C C"
            parts={[
              { inst: 'string-ensemble', label: 'Strings', notes: chords('C F G C', { center: 64 }) },
              { inst: 'cello', label: 'Bass (pedal)', notes: line('C2:16') },
            ]}
            caption="The F and G chords rub against the unmoving C, which gives a glowing, suspended feeling. Film composers use pedal points constantly for openings and build-ups."
          />

          <h2>4. Change the rhythm of the chord part</h2>
          <p>A held block chord is just one way to play a progression. The pattern you choose often defines the genre more than the chords do.</p>
          <Compare
            items={[
              { label: 'Arpeggio', title: 'Notes one at a time', bpm: 92, loop: true, chordsAbove: 'Am F C G', parts: [{ inst: 'pluck', label: 'Pluck', notes: chords('Am F C G', { style: 'arp', center: 60 }) }] },
              { label: 'Off-beat stabs', title: 'Short chords between the beats', bpm: 92, loop: true, chordsAbove: 'Am F C G', parts: [{ inst: 'electric-piano', label: 'Keys', notes: chords('Am F C G', { style: 'offbeat', center: 60 }) }] },
              { label: 'Broken chords', title: 'Low, high, middle, high', bpm: 92, loop: true, chordsAbove: 'Am F C G', parts: [{ inst: 'grand-piano', label: 'Piano', notes: chords('Am F C G', { style: 'broken', center: 60 }) }] },
            ]}
          />

          <h2>5. Add colour: 7ths, add9 and sus</h2>
          <p>
            Adding one extra note to a chord changes its emotional colour without changing its job. A few you'll use all the time:
          </p>
          <Spec
            rows={[
              [<P key="k" chords="Cmaj7:4">maj7</P>, 'Dreamy, soft, a little melancholy. Lo-fi, neo-soul, bossa nova.'],
              [<P key="k" chords="Am7:4">m7</P>, 'A softer, cooler minor. Funk, R&B, smooth pop.'],
              [<P key="k" chords="Cadd9:4">add9</P>, 'Bright and open, like a ringing guitar. Acoustic pop and worship music.'],
              [<P key="k" chords="Gsus4:2 G:2">sus4 → major</P>, 'The 3rd is replaced by a 4th, then resolves. Built-in tension and release inside one chord.'],
              [<P key="k" chords="G7:4">7</P>, 'Bluesy, and the strongest pull towards home when it is the V chord.'],
            ]}
          />
          <Compare
            items={[
              {
                label: 'Plain triads',
                title: 'C – G – Am – F',
                bpm: 80,
                loop: true,
                chordsAbove: 'C G Am F',
                parts: [{ inst: 'felt-piano', label: 'Piano', notes: chords('C G Am F', { center: 62, withRoot: true }) }],
              },
              {
                label: 'With colour',
                verdict: 'better',
                title: 'Cadd9 – Gsus4 G – Am7 – Fmaj7',
                bpm: 80,
                loop: true,
                chordsAbove: 'Cadd9 Gsus4:2 G:2 Am7 Fmaj7',
                parts: [{ inst: 'felt-piano', label: 'Piano', notes: chords('Cadd9 Gsus4:2 G:2 Am7 Fmaj7', { center: 62, withRoot: true }) }],
                caption: "Exactly the same progression. It's just moved from 'campfire' to 'late-night piano'.",
              },
            ]}
          />

          <h2>6. Swap one chord</h2>
          <p>
            Chords with the same job can stand in for each other. Replace I with vi, IV with ii, or IV with the borrowed iv from the last lesson. Changing just one chord in a stock loop is often enough to make people unable to name where they've heard it before.
          </p>
          <ProgressionPad />

          <h2>A recipe for an original progression</h2>
          <Steps>
            <li>Pick a progression for its mood (the cheat sheet in the classics lesson).</li>
            <li>Decide the harmonic rhythm for each section: slow verse, faster pre-chorus.</li>
            <li>Write a bass line first: find inversions that make it step smoothly, or try a pedal.</li>
            <li>Choose a rhythm pattern for the chord part that fits your style.</li>
            <li>Add colour notes to one or two chords, not all of them.</li>
            <li>Optionally swap a single chord for a borrowed or secondary one at the emotional peak.</li>
          </Steps>
          <Watch>
            Don't change all six things at once. Pros change one or two levers per section, and the contrast between sections does the rest. A verse with slow, plain chords makes a chorus with pushed, coloured chords sound twice as big.
          </Watch>

          <h2>In BandForge</h2>
          <Try>
            <Steps>
              <li>
                On the chord track, drag a chord's right edge to change how long it lasts. Chords snap to the grid set in the tracks toolbar, so set it to 1/2 for two chords per bar.
              </li>
              <li>
                For a push, change the snap grid in the tracks toolbar to 1/8 and drag the chord so it starts half a beat before the bar line. Do the same with the notes in your chord part in the <Ui>Piano Roll</Ui>.
              </li>
              <li>
                For inversions and pedal points, open a chord in the picker and set <b>Bass</b> (for example /E under C). Then write your bass track to match.
              </li>
              <li>
                Pick colour chords from the quality buttons under <b>Any chord</b>: maj7, m7, add9, sus4, 7 and more.
              </li>
            </Steps>
          </Try>
          <Pro>
            Producers often decide the chord part's rhythm before they finalise the chords, because the rhythm is what makes a track recognisable from its first second. Next time you love a track, listen only to the chord instrument for one chorus and write down: how often it changes, whether it pushes, what the bass does, and how it's played. That's a recipe you can reuse with entirely different chords.
          </Pro>
        </>
      ),
    },
  ],
};

export default chapter;
