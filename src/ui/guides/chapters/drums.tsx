import { Drum } from 'lucide-react';
import type { Chapter } from '../types';
import { Cards, Compare, Example, K, Lead, Listen, PlayChip as P, Pro, Spec, Steps, Tip, Try, Ui, Watch, Why } from '../figures';
import { at, bass, drums, line, type GNote } from '../notation';

// Each drum on its own part, so readers can mute pieces of the kit one at a time.
const ROCK_HATS = drums({ h: 'x.x.x.x.x.x.x.x.' }, { bars: 2 });
const ROCK_SNARE = drums({ s: '....x.......x...' }, { bars: 2 });
const ROCK_KICK = drums({ k: 'x.......x.x.....' }, { bars: 2 });

const merge = (...xs: GNote[][]) => xs.flat();

const chapter: Chapter = {
  id: 'drums',
  title: 'Drums & Groove',
  blurb: 'How beats are built, beats for each style, fills, swing and making it feel human.',
  icon: Drum,
  color: '#d99a3a',
  lessons: [
    // ------------------------------------------------------------------ 1
    {
      id: 'anatomy',
      title: 'Anatomy of a beat',
      minutes: 9,
      summary: 'What the kick, snare and hi-hat each do, how the 16-step grid maps onto a bar, and how to build a solid beat from nothing in the Step Sequencer.',
      keywords: 'drum beat kick snare hihat hi-hat backbeat grid sixteenth 16th step sequencer pattern rock beat bar count',
      body: () => (
        <>
          <Lead>
            A drum beat looks complicated, but almost every beat in popular music is three instruments doing three different jobs. Learn those jobs and you can read, copy and invent beats instead of guessing.
          </Lead>
          <Cards
            items={[
              { title: 'Kick', tag: 'the floor · 50–100 Hz', color: '#e06a8f', body: 'The low thump. It tells your body where the beat lands and locks with the bass. Usually on beat 1, plus a few extra hits that give the groove its personality.' },
              { title: 'Snare', tag: 'the backbeat · 150–250 Hz + crack', color: '#e8a33d', body: 'The sharp crack on beats 2 and 4. It is the clap-along point and the single most important hit in pop, rock and hip-hop.' },
              { title: 'Hi-hat', tag: 'the clock · 6–12 kHz', color: '#45b8c4', body: 'The steady tick that divides time into 8ths or 16ths. It sets how busy the song feels without taking up space.' },
            ]}
          />
          <p>
            Listen to each on its own: <P notes="C2" inst="kit-acoustic">kick</P> <P notes="D2" inst="kit-acoustic">snare</P> <P notes="F#2" inst="kit-acoustic">closed hat</P> <P notes="A#2" inst="kit-acoustic">open hat</P> <P notes="C#3" inst="kit-acoustic">crash</P>.
          </p>

          <h2>The grid: 16 steps in a bar</h2>
          <p>
            Most songs are in 4/4: four beats per bar. Split each beat into four and you get <b>16 steps</b>, the grid every drum machine has used since the 1980s. Drummers count it out loud like this:
          </p>
          <Spec
            rows={[
              ['Steps 1–4', <><b>1</b> e & a</>],
              ['Steps 5–8', <><b>2</b> e & a</>],
              ['Steps 9–12', <><b>3</b> e & a</>],
              ['Steps 13–16', <><b>4</b> e & a</>],
            ]}
          />
          <p>
            The bold numbers are the <b>beats</b> (steps 1, 5, 9 and 13). The "&"s are the 8th notes in between (steps 3, 7, 11, 15). The "e" and "a" are 16ths, used for busier hats, funky kicks and ghost notes. When someone says "kick on the and of 3", that is step 11.
          </p>

          <h2>Building a rock beat in three moves</h2>
          <p>Here is the most played beat in the world. Press play, then mute the parts one by one with the chips to hear what each layer adds.</p>
          <Example
            title="The basic rock beat"
            bpm={108}
            loop
            parts={[
              { inst: 'kit-acoustic', label: 'Hi-hat', color: '#45b8c4', notes: ROCK_HATS },
              { inst: 'kit-acoustic', label: 'Snare', color: '#e8a33d', notes: ROCK_SNARE },
              { inst: 'kit-acoustic', label: 'Kick', color: '#e06a8f', notes: ROCK_KICK },
            ]}
            caption="Hats on every 8th (steps 1, 3, 5…), snare on 2 and 4 (steps 5 and 13), kick on 1, 3 and the 'and' of 3 (steps 1, 9, 11)."
          />
          <Steps>
            <li>
              <b>Hats on every 8th note.</b> Eight even ticks per bar. This is the clock everything else hangs on.
            </li>
            <li>
              <b>Snare on 2 and 4.</b> Steps 5 and 13. Now it is already a beat; you could clap a song over this.
            </li>
            <li>
              <b>Kick on 1 and 3,</b> then add one extra kick to make it move. The kick on the "and" of 3 (step 11) is what turns a march into a rock groove.
            </li>
          </Steps>
          <Why>
            Your body hears the kick as "down" and the snare as "up". Alternating them, low-high-low-high, is the push and pull of walking. That is why the <b>backbeat</b> (snare on 2 and 4) feels natural in almost any song, and why moving the snare somewhere else instantly changes the genre.
          </Why>

          <h2>The kick is where the personality lives</h2>
          <p>Keep the hats and snare identical and only move the kick. Each of these is a different song.</p>
          <Compare
            items={[
              {
                label: 'Straight',
                title: 'Kick on 1 and 3',
                bpm: 108,
                loop: true,
                parts: [{ inst: 'kit-acoustic', label: 'Kit', notes: merge(ROCK_HATS, ROCK_SNARE, drums({ k: 'x.......x.......' }, { bars: 2 })) }],
                caption: 'Solid and square. Good for verses that need to stay out of the way.',
              },
              {
                label: 'Syncopated',
                verdict: 'better',
                title: 'Kick pushes ahead of the beat',
                bpm: 108,
                loop: true,
                parts: [{ inst: 'kit-acoustic', label: 'Kit', notes: merge(ROCK_HATS, ROCK_SNARE, drums({ k: 'x.....x...x...x.' }, { bars: 2 })) }],
                caption: 'Kicks on the "and" of 2, the "and" of 3 and the "and" of 4 lean forward and make it bounce.',
              },
            ]}
          />
          <Listen>
            In the second version, notice that the extra kicks land just <em>before</em> beats, on the "&"s. Hits that land between the beats are called <b>syncopation</b>. A little feels exciting; a kick on every off-beat feels nervous. Two or three syncopated kicks per bar is the sweet spot for most pop and rock.
          </Listen>

          <h2>Lock the kick with the bass</h2>
          <p>
            The biggest difference between a demo and a record is that the kick and the bass hit together. When the bass plays a note at the same moment as the kick, they fuse into one big, punchy sound. When they miss each other, the low end turns into a blur.
          </p>
          <Example
            title="Bass doubling the kick rhythm"
            bpm={108}
            loop
            chordsAbove="Am:4 F:4"
            parts={[
              { inst: 'kit-acoustic', label: 'Drums', notes: merge(drums({ h: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', k: 'x.....x...x.....' }, { bars: 2 })) },
              { inst: 'electric-bass', label: 'Bass', notes: line('A1:1.5 A1:1 A1:1.5 | F1:1.5 F1:1 F1:1.5') },
            ]}
            caption="The bass plays exactly where the kick plays: beat 1, the 'and' of 2 and the 'and' of 3. Mute the bass, then the drums: each alone sounds thin."
          />

          <h2>Making it in BandForge</h2>
          <Try>
            <Steps>
              <li>
                Add a <b>Drums</b> track with <Ui>+</Ui> in the top bar, then double-click the empty lane to place a pattern. Double-click the pattern to open the <Ui>Step Sequencer</Ui>.
              </li>
              <li>
                In <Ui>Step On/Off</Ui> mode, click or drag across the grid to paint hits. Every fourth column is a beat; the step size buttons (<Ui>1/8</Ui>, <Ui>1/16</Ui>, <Ui>1/32</Ui>, <Ui>1/16T</Ui>) change how fine the grid is.
              </li>
              <li>
                Press <Ui>Play Pattern</Ui> (or <K>⇧</K>+<K>Space</K>) to loop just this pattern while you edit, so you hear each change immediately.
              </li>
              <li>
                Switch to <Ui>Velocity</Ui> mode and drag steps up or down to set how hard each hit is. Pull every other hat down a little and it instantly sounds more like a person.
              </li>
              <li>
                Choose <Ui>1 bar</Ui>, <Ui>2 bars</Ui> or longer for the pattern, or press <Ui>Double</Ui> to copy the bar after itself and change the second half. Each row also has its own mute, solo, volume and pan.
              </li>
            </Steps>
          </Try>
          <Watch>
            The classic beginner beat has a kick on every beat, a snare on every beat and a crash at the start of every bar. Everything is "on" so nothing stands out. Drums are about contrast: if the snare only plays on 2 and 4, those two hits feel huge.
          </Watch>
          <Pro>
            Session drummers think of the hi-hat as the dynamics knob of the whole band. Closed and soft for a verse, half-open and louder for the pre-chorus, ride cymbal or open hats for the chorus. Same kick and snare, completely different energy. Try writing your verse and chorus beats with only the hat part changing.
          </Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ 2
    {
      id: 'styles',
      title: 'Beats for every style',
      minutes: 11,
      summary: 'Ten core patterns, from rock and house to trap, funk, reggae and bossa nova, with the one detail that makes each of them sound like its genre.',
      keywords: 'genre beat rock pop house four on the floor hip-hop boom bap trap hat rolls half-time funk ghost notes reggae one drop shuffle swing bossa nova latin tempo',
      body: () => (
        <>
          <Lead>
            Genres are recognisable from about two seconds of drums. That is good news: each style has one or two defining moves, and once you know them you can write in that style or deliberately borrow from it.
          </Lead>
          <p>
            Every pattern below loops. Each one is written in the same 16-step grid you use in the <Ui>Step Sequencer</Ui>, so you can copy any of them step for step.
          </p>

          <h2>Rock: 100–140 BPM</h2>
          <Example
            title="Rock: driving 8th-note hats, snare on 2 and 4"
            bpm={124}
            loop
            parts={[{ inst: 'kit-acoustic', label: 'Kit', notes: drums({ h: 'X.x.X.x.X.x.X.x.', s: '....X.......X...', k: 'x.......x.x.....' }, { bars: 2 }) }]}
            caption="What makes it rock: loud, unchanging 8th-note hats (or ride) and a heavy snare. Accenting the hat on each beat gives it drive."
          />

          <h2>Pop: 95–120 BPM</h2>
          <Example
            title="Pop: clap on the snare, kick with a pickup"
            bpm={104}
            loop
            parts={[{ inst: 'kit-linn', label: 'Kit', notes: drums({ h: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', cl: '....x.......x...', k: 'x......xx.x.....' }, { bars: 2 }) }]}
            caption="What makes it pop: a clap layered on the snare for a wider hit, and a kick 'pickup' just before beat 3 that makes the second half of the bar bounce."
          />

          <h2>House and disco: 118–128 BPM</h2>
          <Example
            title="Four-on-the-floor with off-beat open hats"
            bpm={124}
            loop
            parts={[{ inst: 'kit-909', label: 'Kit', notes: drums({ k: 'x...x...x...x...', cl: '....x.......x...', o: '..x...x...x...x.', h: 'x.xxx.xxx.xxx.xx' }, { bars: 2 }) }]}
            caption="What makes it house: a kick on every single beat, and the open hat on every 'and'. That tick-tsss, tick-tsss between kicks is the whole style."
          />

          <h2>Boom bap hip-hop: 80–95 BPM</h2>
          <Example
            title="Boom bap: swung 16ths, lazy kicks"
            bpm={88}
            loop
            parts={[{ inst: 'kit-lofi', label: 'Kit', notes: drums({ h: 'x.x.x.x.x.x.x.x.', s: '....X.......X...', k: 'x.........x..x..' }, { bars: 2, swing: 0.24 }) }]}
            caption="What makes it boom bap: a hard snare on 2 and 4, kicks that land on odd 16ths around beat 3, and a heavy swing (around 60%) on everything."
          />

          <h2>Trap: 130–150 BPM, felt in half time</h2>
          <Example
            title="Trap: snare on 3, rolling hats"
            bpm={140}
            loop
            parts={[
              { inst: 'kit-808', label: 'Hats', color: '#45b8c4', notes: merge(drums({ h: 'x.x.x.x.x.x.x...' }), drums({ h: 'xxxxxxxx' }, { at: 3.5, step: 0.0625 }), drums({ h: 'x.x.x.x.xxx.x.x.' }, { at: 4 })) },
              { inst: 'kit-808', label: 'Clap', color: '#e8a33d', notes: drums({ cl: '........x.......' }, { bars: 2 }) },
              { inst: 'kit-808', label: 'Kick', color: '#e06a8f', notes: merge(drums({ k: 'x......x..x.....' }), drums({ k: 'x.x.......x..x..' }, { at: 4 })) },
            ]}
            caption="What makes it trap: the snare/clap only on beat 3 (half time), so a fast tempo feels slow and heavy, and hi-hat rolls that suddenly double or triple in speed."
          />
          <Tip title="Hat rolls in BandForge">
            Switch the Step Sequencer to <Ui>Note Repeat</Ui> mode and drag a hat step up to play 2, 3 or 4 quick hits inside that one step. Use it on the last beat of a bar, not everywhere: rolls are spice.
          </Tip>

          <h2>Half-time rock: same tempo, heavier feel</h2>
          <Compare
            items={[
              {
                label: 'Normal time',
                bpm: 120,
                loop: true,
                parts: [{ inst: 'kit-acoustic', label: 'Kit', notes: drums({ h: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', k: 'x.......x.x.....' }, { bars: 2 }) }],
              },
              {
                label: 'Half time',
                bpm: 120,
                loop: true,
                parts: [{ inst: 'kit-acoustic', label: 'Kit', notes: drums({ h: 'x.x.x.x.x.x.x.x.', s: '........X.......', k: 'x.....x...x.....' }, { bars: 2 }) }],
                caption: 'Moving the snare to beat 3 halves the pulse. Choruses and breakdowns use this to feel huge without slowing the song down.',
              },
            ]}
          />

          <h2>Funk: 95–115 BPM</h2>
          <Example
            title="Funk: ghost notes around the backbeat"
            bpm={100}
            loop
            parts={[
              { inst: 'kit-acoustic', label: 'Hats', color: '#45b8c4', notes: drums({ h: 'xxxXxxxXxxxXxxxX' }, { bars: 2 }) },
              { inst: 'kit-acoustic', label: 'Snare', color: '#e8a33d', notes: drums({ s: '.g..X..g.g..X..g' }, { bars: 2 }) },
              { inst: 'kit-acoustic', label: 'Kick', color: '#e06a8f', notes: drums({ k: 'x.x.......x..x..' }, { bars: 2 }) },
            ]}
            caption="What makes it funk: very quiet 'ghost' snare hits between the loud backbeats, busy 16th hats and a kick that dances around beat 1. Mute the snare to hear how much the ghosts carry the groove."
          />

          <h2>Reggae one-drop: 70–85 BPM</h2>
          <Example
            title="One-drop: nothing on beat 1"
            bpm={76}
            loop
            parts={[{ inst: 'kit-acoustic', label: 'Kit', notes: drums({ h: 'x.x.x.x.x.x.x.x.', rim: '........x.......', k: '........x.......' }, { bars: 2, swing: 0.3 }) }]}
            caption="What makes it reggae: the kick and a rim-click land together on beat 3 only, leaving beat 1 empty. The bass and the off-beat guitar 'skank' fill the space."
          />

          <h2>Shuffle: blues and swing</h2>
          <Example
            title="Shuffle: every beat split in three"
            bpm={96}
            loop
            parts={[{ inst: 'kit-acoustic', label: 'Kit', notes: drums({ r: 'x.xx.xx.xx.x', s: '...x.....x..', k: 'x.....x.....' }, { bars: 2, step: 1 / 3 }) }]}
            caption="What makes it a shuffle: the ride plays long-short, long-short ('da-ba da-ba'). Each beat is three triplets with the middle one left out."
          />

          <h2>Bossa nova: 120–140 BPM</h2>
          <Example
            title="Bossa nova: soft and syncopated"
            bpm={130}
            loop
            parts={[{ inst: 'kit-acoustic', label: 'Kit', vol: 0.8, notes: drums({ sh: 'xxxxxxxxxxxxxxxx', rim: 'x..x..x...x..x..', k: 'x..xx..xx..xx..x' }, { bars: 2 }) }]}
            caption="What makes it bossa: a gentle, constant shaker or hat, a kick pattern of 'long-short' pairs, and a cross-stick rhythm that sits against the beat like a clave."
          />

          <Spec
            title="Quick reference"
            rows={[
              ['Rock', 'Snare 2 & 4, 8th hats, kick on 1, 3 and some "&"s · 100–140 BPM'],
              ['Pop', 'Clap + snare on 2 & 4, kick pickup before 3 · 95–120 BPM'],
              ['House', 'Kick every beat, open hat every "&" · 118–128 BPM'],
              ['Boom bap', 'Hard snare 2 & 4, swung 16ths, loose kicks · 80–95 BPM'],
              ['Trap', 'Snare on 3 only, hat rolls, long 808 bass · 130–150 BPM'],
              ['Funk', 'Ghost notes, 16th hats, kick around beat 1 · 95–115 BPM'],
              ['Reggae', 'Kick + rim on 3, beat 1 empty, swung · 70–85 BPM'],
              ['Shuffle', 'Triplet long-short ride, snare 2 & 4 · 80–130 BPM'],
              ['Bossa nova', 'Soft shaker, paired kicks, clave-like rim · 120–140 BPM'],
            ]}
          />
          <Try title="Do it in BandForge: steal a style">
            <Steps>
              <li>Pick a kit that fits the style from the kit menu at the top of the <Ui>Step Sequencer</Ui> (an 808 for trap, a 909 for house, a lo-fi kit for boom bap).</li>
              <li>Copy one of the patterns above, step by step, into a 1-bar pattern. Set the song tempo in the top bar's tempo readout.</li>
              <li>Press <Ui>Double</Ui> and change only the last two beats of the second bar. That small difference stops the beat sounding like a copy-and-paste loop.</li>
            </Steps>
          </Try>
          <Pro>
            Producers mix styles on purpose. A house kick under a funk ghost-note snare, a trap hat roll in a pop chorus, a reggae one-drop in a rock bridge. Once the defining move of each style is in your hands, crossing them is how you find a sound of your own.
          </Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ 3
    {
      id: 'fills',
      title: 'Fills and transitions',
      minutes: 8,
      summary: 'Where fills go, how long they should be, snare builds, crash cymbals and the power of stopping. Small moves that make sections feel joined up.',
      keywords: 'drum fill tom fill transition snare roll build up riser crash cymbal downbeat drop stop break section change',
      body: () => (
        <>
          <Lead>
            A fill is the drummer's way of saying "something new is about to happen". Used well, fills glue sections together. Used everywhere, they turn a song into a drum solo.
          </Lead>

          <h2>Where fills go</h2>
          <p>
            Music is built in groups of 4 and 8 bars. Fills belong at the <b>end of a group</b>: the last beat or two of bar 4 or bar 8, leading into the next section. A crash cymbal (with a kick) on the very next downbeat marks the arrival.
          </p>
          <Example
            title="Three bars of groove, a short fill, and a crash on arrival"
            bpm={112}
            mark={[[14, 16, 'fill']]}
            parts={[
              { inst: 'kit-acoustic', label: 'Groove', color: '#d99a3a', notes: merge(drums({ h: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', k: 'x.......x.x.....' }, { bars: 3 }), drums({ h: 'x.x.x.x.', s: '....x...', k: 'x.......' }, { at: 12 })) },
              { inst: 'kit-acoustic', label: 'Fill', color: '#a07ae0', notes: drums({ s: 'x.xx', t1: '....xx', t2: '......xx' }, { at: 14 }) },
              { inst: 'kit-acoustic', label: 'Crash', color: '#5dbb7a', notes: drums({ c: 'x', k: 'x' }, { at: 16 }) },
            ]}
            length={20}
            caption="The fill takes just the last two beats of bar 4, moving snare → mid tom → low tom (high to low feels like falling into the next section)."
          />
          <Why>
            Toms tuned high to low create a downward sweep your ear follows like a ball rolling downhill, and the crash is where it lands. The direction matters: a fill that rises (low to high) feels like a question and suits building into a quieter or suspended moment.
          </Why>

          <h2>Short beats long</h2>
          <Compare
            items={[
              {
                label: 'Too much',
                verdict: 'worse',
                title: 'A whole bar of 16th notes',
                bpm: 112,
                parts: [{ inst: 'kit-acoustic', label: 'Kit', notes: merge(drums({ h: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', k: 'x.......x.x.....' }), drums({ s: 'xxxx........xxxx', t1: '....xxxx........', t2: '........xxxx....' }, { at: 4 }), drums({ c: 'x', k: 'x' }, { at: 8 })) }],
                length: 12,
                caption: 'Impressive for a moment, but it stops the groove dead and draws attention away from the song.',
              },
              {
                label: 'Just enough',
                verdict: 'better',
                title: 'One beat of fill',
                bpm: 112,
                parts: [{ inst: 'kit-acoustic', label: 'Kit', notes: merge(drums({ h: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', k: 'x.......x.x.....' }), drums({ h: 'x.x.x.x.x.x.', s: '....x.......', k: 'x.......x.x.' }, { at: 4 }), drums({ s: 'x.xx' }, { at: 7 }), drums({ c: 'x', k: 'x' }, { at: 8 })) }],
                length: 12,
                caption: 'Three snare hits on beat 4. The groove keeps going right up to the change.',
              },
            ]}
          />
          <Spec
            title="How long should a fill be?"
            rows={[
              ['Every 4 bars', 'A tiny one: a single extra snare or an open hat on the last "&".'],
              ['Every 8 bars', 'One beat to two beats of snare and toms.'],
              ['Into a chorus', 'Up to a full bar, or a snare build (below).'],
              ['Into a quiet section', 'Often no fill at all: just stop.'],
            ]}
          />

          <h2>The snare build</h2>
          <p>
            Electronic music, pop and film all use the same trick to make a chorus or drop feel enormous: the snare plays faster and faster, often getting louder, then everything hits at once.
          </p>
          <Example
            title="Quarters, 8ths, 16ths, then the drop"
            bpm={124}
            parts={[
              {
                inst: 'kit-909',
                label: 'Snare build', color: '#e8a33d',
                notes: merge(
                  drums({ s: 'x...x...x...x...' }).map((x) => ({ ...x, v: 0.45 })),
                  drums({ s: 'x.x.x.x.x.x.x.x.' }, { at: 4 }).map((x) => ({ ...x, v: 0.6 })),
                  drums({ s: 'xxxxxxxxxxxxxxxx' }, { at: 8 }).map((x) => ({ ...x, v: 0.75 })),
                  drums({ s: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' }, { at: 12, step: 0.125 }).map((x, i) => ({ ...x, v: 0.75 + i * 0.008 })),
                ),
              },
              { inst: 'kit-909', label: 'Drop', color: '#e06a8f', notes: drums({ c: 'x...............', k: 'x...x...x...x...', cl: '....x.......x...', o: '..x...x...x...x.' }, { at: 16 }) },
            ]}
            length={20}
            caption="Each bar doubles the speed while the velocity climbs. Mute the 'Drop' part and notice how the build alone feels unfinished: it promises an arrival."
          />

          <h2>The most powerful fill is silence</h2>
          <p>
            Stopping the whole band for a beat, or even a full bar, before a chorus is one of the strongest transitions there is. The ear expects the next downbeat, and the gap makes it land twice as hard.
          </p>
          <Compare
            items={[
              {
                label: 'Straight through',
                bpm: 110,
                parts: [
                  { inst: 'kit-acoustic', label: 'Drums', notes: merge(drums({ h: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', k: 'x.......x.x.....' }, { bars: 2 }), drums({ c: 'x', k: 'x' }, { at: 8 })) },
                  { inst: 'electric-bass', label: 'Bass', notes: bass('A:4 F:4 C:2', { style: 'eighths' }) },
                ],
                length: 12,
              },
              {
                label: 'Stop, then hit',
                verdict: 'better',
                bpm: 110,
                parts: [
                  { inst: 'kit-acoustic', label: 'Drums', notes: merge(drums({ h: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', k: 'x.......x.x.....' }), drums({ h: 'x.x.x.x.x.x.', s: '....x.......', k: 'x.......x...' }, { at: 4 }), drums({ c: 'x', k: 'x' }, { at: 8 })) },
                  { inst: 'electric-bass', label: 'Bass', notes: [...bass('A:4', { style: 'eighths' }), ...bass('F:3', { style: 'eighths', at: 4 }), ...bass('C:2', { style: 'eighths', at: 8 })] },
                ],
                length: 12,
                caption: 'Everything drops out on beat 4 of the second bar. The crash after the gap feels much bigger.',
              },
            ]}
          />
          <Try>
            <Steps>
              <li>Make your main groove pattern, then press <Ui>Double</Ui> so you have two bars. Use the second bar's last beat for a short fill.</li>
              <li>
                For a pattern used in several places, the pattern bar shows a "linked" button when the same pattern is placed more than once. Click it to give one spot its own copy, so the fill only happens before the chorus and not every time.
              </li>
              <li>Add a crash on the first step of the next section, together with a kick. If the crash rings into the vocal, turn its row's volume knob down.</li>
              <li>For a stop, simply clear the steps on the last beat or two before the chorus, in every track, including bass and chords.</li>
            </Steps>
          </Try>
          <Watch>
            Crashing on every bar. A crash is a full stop. Save it for the first beat of a new section, the downbeat after a fill, or a big accent. If you hear more than one crash every 4 bars, most of them can probably go.
          </Watch>
          <Listen>
            Listen to how almost every pop chorus is introduced: often a one-beat fill or a snare build, then a crash and a fuller beat. Count the bars; it is nearly always at bar 8 or 16 of the previous section.
          </Listen>
        </>
      ),
    },

    // ------------------------------------------------------------------ 4
    {
      id: 'feel',
      title: 'Feel: swing, velocity and humanising',
      minutes: 9,
      summary: 'Why programmed drums often sound stiff and how to fix it: accents and ghost notes, hi-hat dynamics, swing amounts that work, and pushing or laying back.',
      keywords: 'groove feel swing shuffle velocity accent ghost note humanize humanise quantize strength laid back behind the beat push dilla mpc',
      body: () => (
        <>
          <Lead>
            Two beats with exactly the same notes can feel completely different. The difference is <b>feel</b>: how hard each hit is and exactly when it lands. Real drummers never hit two notes the same, and listeners can hear it.
          </Lead>

          <h2>Velocity: the single biggest fix</h2>
          <p>
            A drum machine with every hit at the same strength sounds like a typewriter. A drummer plays the beat louder than the in-between notes, and some notes barely at all. Listen:
          </p>
          <Compare
            items={[
              {
                label: 'Robotic',
                verdict: 'worse',
                title: 'Every hit the same',
                bpm: 96,
                loop: true,
                parts: [{ inst: 'kit-acoustic', label: 'Kit', notes: drums({ h: 'xxxxxxxxxxxxxxxx', s: '....x.......x...', k: 'x.....x...x.....' }, { bars: 2 }) }],
              },
              {
                label: 'Played',
                verdict: 'better',
                title: 'Accents, softer in-betweens, ghost notes',
                bpm: 96,
                loop: true,
                parts: [{ inst: 'kit-acoustic', label: 'Kit', notes: drums({ h: 'XgxgXgxgXgxgXgxg', s: '....X..g.g..X...', k: 'X.....x...x.....' }, { bars: 2 }) }],
                caption: 'The notes are almost the same. Only the strengths changed, plus two very quiet snare ghosts.',
              },
            ]}
          />
          <Spec
            title="Velocity rules of thumb"
            rows={[
              ['Beats (1, 2, 3, 4)', 'Strongest hats: 90–100%'],
              ['"&"s', 'A little softer: 70–80%'],
              ['"e" and "a" 16ths', 'Softest hats: 40–60%'],
              ['Backbeat snare', 'Full: 100%'],
              ['Ghost notes', 'Barely there: 20–35%. Felt more than heard.'],
            ]}
          />

          <h2>Swing: delaying the in-between notes</h2>
          <p>
            Swing pushes every second note (every second 8th or 16th) a little late, so pairs of notes become long-short instead of even. It is measured as a percentage: <b>50%</b> is perfectly straight, <b>66%</b> is a full triplet feel, and <b>75%</b> is a dotted, hard bounce.
          </p>
          <Compare
            items={[
              { label: 'Straight · 50%', bpm: 92, loop: true, parts: [{ inst: 'kit-lofi', label: 'Kit', notes: drums({ h: 'XxxxXxxxXxxxXxxx', s: '....X.......X...', k: 'x.........x..x..' }, { bars: 2 }) }] },
              { label: 'Light · 54%', bpm: 92, loop: true, parts: [{ inst: 'kit-lofi', label: 'Kit', notes: drums({ h: 'XxxxXxxxXxxxXxxx', s: '....X.......X...', k: 'x.........x..x..' }, { bars: 2, swing: 0.08 }) }] },
              { label: 'Boom bap · 62%', verdict: 'better', bpm: 92, loop: true, parts: [{ inst: 'kit-lofi', label: 'Kit', notes: drums({ h: 'XxxxXxxxXxxxXxxx', s: '....X.......X...', k: 'x.........x..x..' }, { bars: 2, swing: 0.24 }) }] },
            ]}
          />
          <Spec
            title="BandForge's swing presets"
            rows={[
              ['Light 16th · 54%', 'A gentle bounce for pop and house.'],
              ['MPC 16th · 58%', 'The classic drum-machine swing.'],
              ['Boom Bap · 62%', 'Deep 16th swing for hip-hop and funk.'],
              ['Triplet 16th · 67%', 'Full triplet feel: trap hats, Afrobeats.'],
              ['Laid Back', '57% plus looseness: neo-soul and lo-fi.'],
              ['Jazz 8th · 62%', 'Medium swing eighths.'],
              ['Shuffle · 67%', 'Triplet eighths: blues and rock shuffle.'],
              ['Hard Shuffle · 72%', 'Dotted-eighth bounce: country, boogie.'],
              ['Human Feel', 'No swing, but notes drift slightly, like a real player.'],
            ]}
          />
          <Why>
            Swing mimics how people actually move. When you walk or dance, the steps aren't metronome-even; there is a lilt. Even "straight" pop drummers usually play a hair of swing (52–55%) without thinking about it, which is why a tiny amount often makes a beat feel alive even when you can't hear it as swing.
          </Why>

          <h2>Pushing and laying back</h2>
          <p>
            Beyond swing, players place whole instruments slightly early or late. A snare played a few milliseconds <b>behind</b> the beat feels relaxed and heavy (neo-soul, lo-fi, a lot of 70s soul). Played <b>ahead</b>, it feels urgent (punk, drum and bass).
          </p>
          <Compare
            items={[
              { label: 'On the grid', bpm: 84, loop: true, parts: [{ inst: 'kit-lofi', label: 'Kit', notes: drums({ h: 'x.x.x.x.x.x.x.x.', s: '....X.......X...', k: 'x......x..x.....' }, { bars: 2 }) }] },
              {
                label: 'Snare laid back',
                verdict: 'better',
                bpm: 84,
                loop: true,
                parts: [
                  { inst: 'kit-lofi', label: 'Hats + kick', color: '#45b8c4', notes: drums({ h: 'x.x.x.x.x.x.x.x.', k: 'x......x..x.....' }, { bars: 2 }) },
                  { inst: 'kit-lofi', label: 'Late snare', color: '#e8a33d', notes: at(drums({ s: '....X.......X...' }, { bars: 2 }), 0.045) },
                ],
                caption: 'The snare is about 30 ms late. It drags gently against the hats, which is the "lazy" feel of lo-fi and neo-soul.',
              },
            ]}
          />

          <h2>Getting the feel in BandForge</h2>
          <Try>
            <Steps>
              <li>
                In the Step Sequencer, switch to <Ui>Velocity</Ui> mode and drag each step to the strength you want. Right-click a row for <Ui>Row Velocity</Ui> to set a whole row at once, then shape the accents by hand.
              </li>
              <li>
                Click the <Ui>Swing</Ui> button in the pattern bar to give this pattern its own swing, or click the <b>SWING</b> readout in the top bar to set swing for the whole song. Choose <b>16ths</b> to swing hats and funk, or <b>8ths</b> for jazz and shuffles, then set the <b>Amount</b>.
              </li>
              <li>
                Raise <b>Loose</b> in the same panel to let notes drift slightly late, like a relaxed player. A little (10–30%) goes a long way.
              </li>
              <li>
                If you recorded drums from a keyboard, open the region in the <Ui>Piano Roll</Ui> and quantise with a strength of <Ui>75%</Ui> or <Ui>50%</Ui> instead of 100%. Notes move most of the way to the grid but keep some of your timing.
              </li>
            </Steps>
          </Try>
          <Watch>
            Swinging some instruments but not others. If the drums are at 62% swing and the bass and keys are straight, they will fight. Use the song swing in the top bar so everything follows the same feel, and only give a pattern its own swing on purpose.
          </Watch>
          <Pro>
            The famous "Dilla feel" from J Dilla's productions comes from mixing feels on purpose: hats swung, snare dragging late and kicks slightly early, all at once. It sounds drunk and wonderful because each layer is deliberately in a slightly different place. Try it with separate patterns or the Loose control, but keep the kick and bass together.
          </Pro>
          <Tip>
            Velocity and swing interact. Soft in-between notes make swing sound smoother; loud in-between notes make even a small amount of swing sound sloppy. If a swing setting sounds wrong, try softening the off-beat hats before you change the amount.
          </Tip>
        </>
      ),
    },
  ],
};

export default chapter;
