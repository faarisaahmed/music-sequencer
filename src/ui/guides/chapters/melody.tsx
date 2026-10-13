import { Music } from 'lucide-react';
import type { Chapter } from '../types';
import { Cards, Compare, Example, K, Keys, Lead, Listen, PlayChip as P, Pro, RangeChart, Spec, Steps, Tip, Try, Ui, Watch, Why } from '../figures';
import { chords, drums, line } from '../notation';

const softBeat = (bars: number) => drums({ k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, { bars });

const chapter: Chapter = {
  id: 'melody',
  title: 'Writing Melodies',
  blurb: 'Shape, rhythm, motifs and phrasing: how to write tunes people remember.',
  icon: Music,
  color: '#45b8c4',
  lessons: [
    // ------------------------------------------------------------------ 1
    {
      id: 'shape',
      title: 'Shape: contour and range',
      minutes: 8,
      summary: 'Before notes, a melody is a shape: where it climbs, where it falls, and where its single highest moment lands. Learn the shapes that work, how wide a melody should range, and where to put the peak.',
      keywords: 'contour arch wave climax high point range octave melodic shape peak golden section',
      body: () => (
        <>
          <Lead>
            Ask someone to hum a tune they love and watch their hand. It goes up and down with the melody. People remember melodies as <b>shapes</b> long before they remember exact notes, which is good news: you can design the shape first and fill in the notes afterwards.
          </Lead>

          <h2>Flat versus shaped</h2>
          <p>Here are two melodies over the same chords. Both only use notes that fit. One goes nowhere; one takes a journey.</p>
          <Compare
            items={[
              {
                label: 'Flat',
                verdict: 'worse',
                title: 'Hovers around three notes',
                bpm: 96,
                chordsAbove: 'C Am F G',
                parts: [
                  { inst: 'flute', label: 'Melody', notes: line('E4:1 D4 E4 D4 | C4:1 E4 D4 C4 | C4:1 D4 C4 D4 | D4:2 B3:2') },
                  { inst: 'grand-piano', label: 'Chords', notes: chords('C Am F G', { center: 55 }), vol: 0.7 },
                ],
                caption: 'Nothing wrong, nothing memorable. It never builds, so it never pays off.',
              },
              {
                label: 'Arch',
                verdict: 'better',
                title: 'Climbs to one peak, then comes home',
                bpm: 96,
                chordsAbove: 'C Am F G',
                mark: [[10, 11.5, 'peak']],
                parts: [
                  { inst: 'flute', label: 'Melody', notes: line('C4:1 E4 G4 A4 | C5:2 A4:1 G4:1 | A4:1 C5:1 F5:1.5 E5:0.5 | D5:1 B4:1 G4:2') },
                  { inst: 'grand-piano', label: 'Chords', notes: chords('C Am F G', { center: 55 }), vol: 0.7 },
                ],
                caption: 'It rises in two waves, hits the top F once in bar 3, and falls back. You feel a beginning, a climax and an ending.',
              },
            ]}
          />

          <h2>The five shapes</h2>
          <Cards
            items={[
              { title: 'Arch', body: 'Rise to a peak, then fall. The most natural, satisfying shape. Most phrases and whole choruses are arches.' },
              { title: 'Wave', body: 'Several smaller rises and falls, each peak a little higher than the last, building to a top. Great for verses that build.' },
              { title: 'Rising line', body: 'Keeps climbing. Feels hopeful and builds tension. Perfect for pre-choruses heading into a big chorus.' },
              { title: 'Falling line', body: 'Starts high and sighs downward. Feels tender, resigned or relieved. Lots of sad songs and lullabies.' },
              { title: 'Inverted arch', body: 'Dips down then comes back up. Thoughtful, questioning; often used for the first phrase of a pair.' },
            ]}
          />

          <h2>One peak, placed late</h2>
          <p>
            Your highest note is your most powerful note. Spend it carefully: <b>use it once</b> per phrase (or once per song for the very top note), and place it <b>about two-thirds to three-quarters of the way through</b>. Peaking in the first bar leaves nowhere to go. Peaking at the very end feels like a scream with no landing.
          </p>
          <Example
            title="'Happy Birthday': the textbook late peak"
            bpm={110}
            meter={3}
            mark={[[15, 16, 'highest note']]}
            parts={[{ inst: 'grand-piano', label: 'Melody', notes: line('G3:0.75 G3:0.25 | A3:1 G3 C4 | B3:2 G3:0.75 G3:0.25 | A3:1 G3 D4 | C4:2 G3:0.75 G3:0.25 | G4:1 E4 C4 | B3:1 A3:1 F4:0.75 F4:0.25 | E4:1 C4 D4 | C4:3', { at: 2 }) }]}
            caption="The first two lines stay low. The third line ('happy birthday dear…') leaps a whole octave to its peak, the only time it goes that high, and then the last line settles home. That's why everyone strains and laughs on the same note."
          />
          <Why>
            Your ear measures each new note against everything it's heard so far. A note only feels high if lower notes came before it. Holding the top back builds up expectation, and the further into the phrase the peak arrives, the more it feels like a release instead of a random jump.
          </Why>

          <h2>How wide should a melody be?</h2>
          <RangeChart
            rows={[
              { label: 'Too narrow', lo: 'D4', hi: 'F4', color: '#8b8a86', note: '3rd: chant' },
              { label: 'Typical verse', lo: 'C4', hi: 'A4', note: '6th' },
              { label: 'Typical chorus', lo: 'E4', hi: 'E5', note: 'octave, higher' },
              { label: 'Whole song', lo: 'C4', hi: 'F5', color: '#e8a33d', note: 'octave + 4th' },
              { label: 'Too wide (for most voices)', lo: 'G3', hi: 'C6', color: '#e05a4a', note: '2½ octaves' },
            ]}
            caption="Rough ranges for a singable pop or folk melody. Instruments can go wider, but the same principle holds: a narrow verse makes a wider chorus feel bigger."
          />
          <p>
            A good rule: a single phrase usually stays within about a 6th or an octave. The whole song can span an octave and a half. Save the widest stretch for the chorus or the climax, so the song itself has an arch.
          </p>

          <Watch>
            Two opposite beginner habits: melodies that hug three notes (it sounds like a chant), and melodies that jump all over the place because every chord tone looks equally good on the screen. If you can't hum it after hearing it twice, it's usually one of these. Fix the first by giving the phrase a clear peak; fix the second by connecting jumps with steps.
          </Watch>

          <h2>In BandForge</h2>
          <Try>
            <Steps>
              <li>
                Open your melody in the <Ui>Piano Roll</Ui> and zoom out with the zoom buttons in its toolbar (or <K>⌘</K>/<K>Ctrl</K> + scroll) until you can see the whole phrase. Look at it as a line: is there one clear high point? Where is it?
              </li>
              <li>
                Turn on the scale button in the piano roll toolbar (<b>Scale: highlight & snap to key</b>) so rows outside the key are shaded and new notes snap into the key.
              </li>
              <li>
                Try sketching the shape first: draw a few long notes with the pencil tool tracing the rise and fall you want, then break each one into shorter notes.
              </li>
              <li>
                Find your highest note. If it appears more than once in the phrase, lower all but the most important one.
              </li>
            </Steps>
          </Try>
          <Tip>Sing or hum along as you write, even badly. Your voice will refuse leaps and ranges that are unnatural, and that's useful information even if the melody ends up on a synth.</Tip>
        </>
      ),
    },

    // ------------------------------------------------------------------ 2
    {
      id: 'chord-tones',
      title: 'Chord tones, passing notes and tension',
      minutes: 10,
      summary: 'Which notes of a melody belong to the chord underneath, which ones don’t, and when that matters. Strong beats, passing and neighbour notes, appoggiaturas and suspensions: the tools that make a melody sing instead of just fit.',
      keywords: 'chord tones non chord tones passing note neighbour tone appoggiatura suspension anticipation strong beat weak beat consonance dissonance landing note 3rd root',
      body: () => (
        <>
          <Lead>
            At every moment, your melody note is either part of the chord underneath (a <b>chord tone</b>) or not (a <b>non-chord tone</b>). Chord tones sound stable; the others create friction. A great melody is mostly chord tones in the important places, with friction used on purpose for colour and feeling.
          </Lead>

          <h2>Not all chord tones feel the same</h2>
          <Keys
            from="C4"
            to="D5"
            marks={{ C4: 'R', E4: '3', G4: '5', B4: { label: '7', color: '#5b9be0' }, D5: { label: '9', color: '#5b9be0' }, A4: { label: '6', color: '#5b9be0' }, F4: { label: '4', color: '#e06a8f' } }}
            buttons={false}
            caption="Over a C chord: root, 3rd and 5th (amber) are chord tones. 6th, 7th and 9th (blue) are colour notes. The 4th (pink) clashes with the 3rd and wants to resolve down."
          />
          <p>Hear the same C chord with different notes on top:</p>
          <Spec
            rows={[
              [<P key="k" notes="C3 G3 E4 C5">root on top</P>, 'Final, solid, "the end". Lands like a full stop.'],
              [<P key="k" notes="C3 G3 C4 E5">3rd on top</P>, 'Warm and emotional. The 3rd decides major or minor, so it carries the mood.'],
              [<P key="k" notes="C3 E4 C4 G4">5th on top</P>, 'Open and neutral, a little unfinished. Good for phrase endings that should keep going.'],
              [<P key="k" notes="C3 G3 E4 D5">9th on top</P>, 'Shimmering, modern, wistful. A favourite landing note in pop and R&B.'],
              [<P key="k" notes="C3 G3 E4 F5">4th on top</P>, 'Tense: it rubs against the 3rd. Needs to move, usually down a step.'],
            ]}
          />
          <Compare
            items={[
              {
                label: 'Lands on roots',
                title: 'Each bar ends on the chord’s root',
                bpm: 92,
                chordsAbove: 'C Am F G',
                parts: [
                  { inst: 'clarinet', label: 'Melody', notes: line('G4:1 F4 D4 C4 | D4:1 B3 D4 A3 | B3:1 D4 C4 F3 | F4:1 D4 B3 G3') },
                  { inst: 'grand-piano', label: 'Chords', notes: chords('C Am F G', { center: 57 }), vol: 0.7 },
                ],
                caption: 'Very stable, a bit square: every bar sounds like it is ending.',
              },
              {
                label: 'Lands on 3rds',
                verdict: 'better',
                title: 'Same melody, last note of each bar is the 3rd',
                bpm: 92,
                chordsAbove: 'C Am F G',
                parts: [
                  { inst: 'clarinet', label: 'Melody', notes: line('G4:1 F4 D4 E4 | D4:1 B3 D4 C4 | B3:1 D4 C4 A3 | F4:1 D4 C4 B3') },
                  { inst: 'grand-piano', label: 'Chords', notes: chords('C Am F G', { center: 57 }), vol: 0.7 },
                ],
                caption: 'Only four notes changed. It now flows from bar to bar and sounds more emotional, because the 3rd carries each chord’s colour.',
              },
            ]}
          />

          <h2>Strong beats and weak beats</h2>
          <p>
            In 4/4, beats <b>1 and 3</b> are strong and beats 2 and 4 are weaker; the "ands" in between are weaker still. Listeners judge whether a note "fits" mostly by what happens on strong beats. So the basic rule is:
          </p>
          <Tip title="The rule of thumb">
            Chord tones on strong beats, anything on weak beats. A non-chord tone on a weak beat that moves by step to a chord tone almost always sounds good. Once that's comfortable, start breaking it on purpose, which is where appoggiaturas come in.
          </Tip>

          <h2>The four kinds of friction worth knowing</h2>
          <Example
            title="Each kind of non-chord tone, labelled"
            bpm={72}
            names
            chordsAbove="C F G C"
            mark={[
              [1, 2, 'passing'],
              [5, 6, 'neighbour'],
              [8, 9.5, 'appoggiatura'],
              [12, 13, 'suspension'],
            ]}
            parts={[
              { inst: 'flute', label: 'Melody', notes: line('E4:1 F4:1 G4:2 | A4:1 G4:1 A4:2 | C5:1.5 B4:0.5 D5:2 | D5:1 C5:3') },
              { inst: 'grand-piano', label: 'Chords', notes: chords('C F G C', { center: 55 }), vol: 0.75 },
            ]}
            caption="Mute the chords and it's a simple tune. With the chords, each labelled note creates a little rub that resolves by step."
          />
          <Cards
            items={[
              { title: 'Passing note', tag: 'weak beat · connects', body: 'A step between two chord tones, like F between E and G. Smooths out leaps. Almost impossible to get wrong.' },
              { title: 'Neighbour note', tag: 'weak beat · decorates', body: 'Step away from a chord tone and straight back (A–G–A). Adds motion to a held note without changing it.' },
              { title: 'Appoggiatura', tag: 'strong beat · aches', body: 'A non-chord tone right on the beat, resolving by step (C over G, falling to B). The most expressive note in music: it is the "sob" in a ballad.' },
              { title: 'Suspension', tag: 'held over · sighs', body: 'A note held from the previous chord into the new one, where it clashes, then resolves down (D held into C, falling to C). Classic in hymns, strings and pop pads.' },
            ]}
          />
          <Why>
            Each of these creates a tiny tension and then resolves it by step. The ear tolerates almost any clash if it is short, or on a weak beat, or resolves to its nearest neighbour. What sounds "wrong" is a clash that is long, loud, on a strong beat, and goes nowhere.
          </Why>
          <Listen>
            Many ballad melodies hit an appoggiatura on the most emotional word of the line: the note arrives "wrong" against the chord, on the beat, and melts into the right one. Listen for the moment a melody seems to ache, and check whether it's sitting on a note outside the chord for a beat before stepping down.
          </Listen>

          <h2>Following the chords as they change</h2>
          <p>
            A note that's a chord tone over one chord can be a clash over the next. If you hold a note across a chord change, check what it becomes: holding E from C into F makes it the 7th of F (lush, deliberate), holding it into G makes it a 6th (fine), but holding it into Fm makes a sour half-step rub against A♭. Either move the melody, or decide the rub is the point.
          </p>
          <Watch>
            A long note on a strong beat that clashes with the chord and never resolves is the number-one reason a melody "sounds off" even though every note is in the key. Being in the key isn't enough; what matters is the note against the chord at that moment.
          </Watch>

          <h2>In BandForge</h2>
          <Try>
            <Steps>
              <li>
                Show the chord track (<Ui>Chords</Ui> in the tracks toolbar) and put in your progression, so you always know which chord is under each melody note.
              </li>
              <li>
                In the <Ui>Piano Roll</Ui>, look at the notes that start on beats 1 and 3. Are they chord tones? If one isn't, does it step to a chord tone right after?
              </li>
              <li>
                Open <Ui>Check</Ui> (<K>⇧</K>+<K>W</K>). It flags held notes that clash with the chord track and half-step rubs between parts. Click an issue to select the notes and play from there, then decide: deliberate appoggiatura, or accident?
              </li>
            </Steps>
          </Try>
          <Pro>
            When a melody feels too plain, writers often take one important chord-tone landing and replace it with the note a step above, arriving on the beat and resolving down a moment later. That's an appoggiatura, and one per phrase is often enough to make a line feel heartfelt.
          </Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ 3
    {
      id: 'motifs',
      title: 'Motifs: small ideas, repeated and changed',
      minutes: 9,
      summary: 'Memorable melodies are built from tiny ideas of three to six notes, repeated just enough and changed just enough. Learn the handful of ways to develop a motif so one idea becomes a whole tune.',
      keywords: 'motif motive repetition variation sequence inversion augmentation diminution development sentence riff idea beethoven',
      body: () => (
        <>
          <Lead>
            The most famous opening in classical music is four notes: short, short, short, long. Beethoven built the entire first movement of his Fifth Symphony out of that tiny cell. You don't need a long, brilliant melody. You need a short idea, and the skill to repeat and change it.
          </Lead>
          <Example
            title="Beethoven, Symphony No. 5: the motif and its first echo"
            bpm={180}
            meter={2}
            names
            parts={[{ inst: 'string-ensemble', label: 'Strings', notes: line('r:0.5 G4:0.5 G4 G4 | Eb4:3 r:0.5 F4:0.5 F4 F4 | D4:4') }]}
            caption="The motif, then the same rhythm and shape one step lower. That's already a technique (a sequence), and the whole movement keeps doing variations of it."
          />

          <h2>What a motif is</h2>
          <p>
            A <b>motif</b> is a short, recognisable fragment, usually 3 to 6 notes and a bar or two long. What makes it recognisable is mostly its <b>rhythm</b> and its <b>shape</b> (up, down, step, leap), more than its exact pitches. That's why you can move it around and people still hear it as "the same idea".
          </p>

          <h2>Six ways to develop a motif</h2>
          <p>Here's an original four-note motif (step, step, leap up), followed by four ways of changing it. Mute and unmute each one to compare.</p>
          <Example
            title="One motif, five versions"
            bpm={92}
            names
            length={24}
            mark={[
              [0, 4, 'motif'],
              [4, 8, 'sequence'],
              [8, 12, 'inversion'],
              [12, 16, 'new rhythm'],
              [16, 24, 'extension'],
            ]}
            parts={[
              { inst: 'flute', label: 'Motif', notes: line('E4:0.5 F4:0.5 G4:1 C5:2') },
              { inst: 'flute', label: 'Sequence', notes: line('F4:0.5 G4:0.5 A4:1 D5:2', { at: 4 }) },
              { inst: 'flute', label: 'Inversion', notes: line('E4:0.5 D4:0.5 C4:1 G3:2', { at: 8 }) },
              { inst: 'flute', label: 'New rhythm', notes: line('E4:1.5 F4:0.5 G4:0.5 C5:1.5', { at: 12 }) },
              { inst: 'flute', label: 'Extension', notes: line('E4:0.5 F4:0.5 G4:1 C5:1 B4:0.5 A4:0.5 G4:4', { at: 16 }) },
            ]}
          />
          <Spec
            rows={[
              ['Repetition', 'Play it again, exactly. Do it at least once, or nobody will notice it was an idea.'],
              ['Sequence', 'Same shape, starting on a different note (usually a step higher or lower). Feels like progress.'],
              ['Inversion', 'Flip the direction: what went up now goes down. Related but contrasting, good for an answering phrase.'],
              ['New rhythm', 'Same pitches, different note lengths. Stretched out (augmentation) sounds grand; squashed (diminution) sounds urgent.'],
              ['Extension', 'Play the motif and keep going, letting it grow into a longer line. Great for the end of a phrase.'],
              ['Fragmentation', 'Repeat just part of the motif, often the first two notes, faster and faster. Builds energy before a climax.'],
            ]}
          />

          <h2>Building a whole melody from one idea</h2>
          <p>
            A reliable structure, used everywhere from Mozart to modern pop, is the <b>sentence</b>: state the idea, state it again (varied), then spin it into something longer that reaches a cadence. Proportions of 1 + 1 + 2 bars, or 2 + 2 + 4.
          </p>
          <Example
            title="An 8-bar melody grown from the motif"
            bpm={96}
            chordsAbove="C Dm G C C F G C"
            mark={[
              [0, 4, 'idea'],
              [4, 8, 'sequence'],
              [8, 12, 'fragments'],
              [16, 20, 'idea again'],
              [20, 24, 'wider leap'],
            ]}
            parts={[
              {
                inst: 'violin',
                label: 'Melody',
                notes: line('E4:0.5 F4:0.5 G4:1 C5:2 | F4:0.5 G4:0.5 A4:1 D5:2 | G4:0.5 A4:0.5 B4:0.5 C5:0.5 D5:1 B4:1 | C5:3 r:1 | E4:0.5 F4:0.5 G4:1 C5:2 | F4:0.5 G4:0.5 A4:1 F5:2 | E5:0.5 D5:0.5 C5:0.5 B4:0.5 A4:1 B4:1 | C5:4'),
              },
              { inst: 'grand-piano', label: 'Chords', notes: chords('C Dm G C C F G C', { center: 55 }), vol: 0.7 },
            ]}
            caption="Every bar comes from the first four notes. Bar 2 repeats the shape a step higher; bar 3 speeds up its rising steps; the second half restates the idea and stretches the leap to reach a high F, the peak, before resolving."
          />
          <Why>
            Your brain loves predicting and loves being slightly wrong. Repetition lets the listener predict; variation rewards them with a small surprise. Too much repetition and it's boring; too much variation and there is nothing to hold on to. A useful ratio: hear the idea, hear it again, then change it on the third time. Comedians use the same rule of three.
          </Why>
          <Listen>
            Riffs are motifs too. Think of the bass line in 'Seven Nation Army' or the opening of 'Smoke on the Water': a few notes with a distinctive rhythm, repeated and moved around for the whole song. Film composers do the same with character themes, bringing back a short motif slower, faster, in minor or in major as the story changes.
          </Listen>
          <Watch>
            The most common beginner melody has no repeated material at all: every bar is new. It feels like wandering, and listeners can't sing any of it back. If your melody isn't sticking, find your best two bars and build the rest out of them.
          </Watch>

          <h2>In BandForge</h2>
          <Try>
            <Steps>
              <li>
                Write a short motif in the <Ui>Piano Roll</Ui>, select it and press <K>⌘</K>/<K>Ctrl</K>+<K>D</K>. BandForge places a copy straight after it.
              </li>
              <li>
                For a sequence, open the copy in the <Ui>Score</Ui>, select its notes and press <K>↑</K> or <K>↓</K>. In the score, arrows move notes to the next note <em>in the key</em>, which is exactly how a sequence usually works.
              </li>
              <li>
                For a new rhythm, drag note edges in the piano roll, or in the score pick a new duration with the number keys (<K>3</K> sixteenth up to <K>7</K> whole) and <K>.</K> for a dot.
              </li>
              <li>
                Play the motif, then its variation, and ask: can I still hear the original idea? If not, change less.
              </li>
            </Steps>
          </Try>
          <Pro>
            Songwriters keep a notebook, or a voice-memo folder, of motifs: two bars at a time, recorded the moment they turn up. Writing a song is then less about inventing and more about picking the strongest idea and developing it. In BandForge you can keep a "sketches" song with one short region per idea.
          </Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ 4
    {
      id: 'phrases',
      title: 'Phrases: question and answer',
      minutes: 8,
      summary: 'Melodies breathe in phrases, usually 2 or 4 bars long, and phrases pair up like a question and its answer. Learn how to end a phrase so it asks or answers, and why the silence between phrases matters as much as the notes.',
      keywords: 'phrase phrasing question answer antecedent consequent period call and response breath rests pickup anacrusis 4 bar phrase',
      body: () => (
        <>
          <Lead>
            Melodies are spoken in sentences. Each sentence, or <b>phrase</b>, is usually 2 or 4 bars long and ends with a small pause, like taking a breath. And phrases tend to come in pairs: one that asks, one that answers.
          </Lead>

          <h2>Asking and answering</h2>
          <p>
            A phrase that ends on an unstable note (the 2nd, 5th or 7th of the scale, usually over a V chord) sounds like a <b>question</b>. A phrase that ends on the home note over the I chord sounds like an <b>answer</b>. Put them together and you get the shape musicians call a <b>period</b>.
          </p>
          <Example
            title="Question, then answer, in A minor"
            bpm={92}
            chordsAbove="Am Dm G C Am Dm E Am"
            mark={[
              [0, 16, 'question'],
              [16, 32, 'answer'],
            ]}
            parts={[
              { inst: 'clarinet', label: 'Melody', notes: line('A4:1 C5 B4 A4 | F4:1.5 A4:0.5 D5:2 | B4:1 G4 D4 G4 | E4:3 r:1 | A4:1 C5 B4 A4 | F4:1.5 A4:0.5 D5:1.5 C5:0.5 | B4:1 G#4 E4 G#4 | A4:3 r:1') },
              { inst: 'grand-piano', label: 'Chords', notes: chords('Am Dm G C Am Dm E Am', { center: 55 }), vol: 0.7 },
            ]}
            caption="Both phrases start identically. The first stops on E, the 5th of A minor, and hangs. The second bends towards E major (G♯) and lands on A, the home note."
          />
          <Why>
            Starting the answer the same way as the question is called a <b>parallel period</b>, and it's the most common shape in melody writing. The repetition tells the listener "this is the same thought again", which makes the different ending really register. It's the musical version of "Are you coming? … Yes, I'm coming."
          </Why>

          <h2>Leave room to breathe</h2>
          <p>
            Rests aren't empty space; they're what makes the notes before them land. Singers need breath, listeners need a moment to take in what they heard, and the other instruments need a gap to answer in.
          </p>
          <Compare
            items={[
              {
                label: 'Wall of notes',
                verdict: 'worse',
                title: 'Never stops',
                bpm: 96,
                chordsAbove: 'C Am F G',
                parts: [
                  { inst: 'saxophone', label: 'Melody', notes: line('E4:0.5 G4 A4 G4 E4 D4 C4 D4 | E4 G4 A4 C5 B4 A4 G4 E4 | D4 E4 F4 E4 D4 C4 B3 C4 | D4 E4 D4 C4 B3 G3 B3 D4') },
                  { inst: 'grand-piano', label: 'Chords', notes: chords('C Am F G', { center: 55 }), vol: 0.7 },
                ],
                caption: 'Every note fits, but it is exhausting, and you can’t pick out a single idea.',
              },
              {
                label: 'Phrased',
                verdict: 'better',
                title: 'Short phrases with space between',
                bpm: 96,
                chordsAbove: 'C Am F G',
                parts: [
                  { inst: 'saxophone', label: 'Melody', notes: line('E4:0.5 G4 A4:1 G4:1 r:1 | E4:0.5 G4 A4:1 C5:1 r:1 | C5:0.5 A4 F4:1 A4:1 r:1 | D4:1 E4:0.5 D4:0.5 B3:1 r:1') },
                  { inst: 'grand-piano', label: 'Chords', notes: chords('C Am F G', { center: 55 }), vol: 0.7 },
                ],
                caption: 'Fewer notes, and a beat of silence each bar. Now each little phrase is heard, and it already sounds like a hook.',
              },
            ]}
          />
          <Tip>
            A useful rule: at least one beat of rest (or one long held note) at the end of every 2-bar or 4-bar phrase. In vocal music, if a phrase would take more than about 4–5 seconds to sing without a gap, add a breath.
          </Tip>

          <h2>Starting before the beat</h2>
          <p>
            Phrases don't have to start on beat 1. Starting a note or two early, called a <b>pickup</b> or <b>anacrusis</b>, gives the phrase a running start, like the word "and" before a sentence. Starting late, on beat 2 or the "and" of 1, feels casual and conversational.
          </p>
          <Spec
            rows={[
              [<P key="k" melody="C5:1 B4:0.5 A4:0.5 G4:2" bpm={96}>On the beat</P>, 'Direct and declarative. Hymns, anthems, marches.'],
              [<P key="k" melody="r:3 G4:0.5 A4:0.5 C5:1 B4:0.5 A4:0.5 G4:2" bpm={96}>With a pickup</P>, 'Leans into the bar. Feels natural for lyrics that start with a weak word ("And I…", "In the…").'],
              [<P key="k" melody="r:1.5 C5:0.5 B4:0.5 A4:0.5 G4:1" bpm={96}>Late start</P>, 'Relaxed, speech-like. Very common in modern pop and R&B verses.'],
            ]}
          />

          <h2>Phrase lengths</h2>
          <p>
            Four bars + four bars is the default because it's balanced and easy to follow. That's exactly why breaking it is powerful. A 3-bar or 5-bar phrase feels slightly off-balance, which can make a melody memorable. The verse of The Beatles' 'Yesterday' is a 7-bar phrase, and that oddness is part of its wistful feel.
          </p>
          <Cards
            items={[
              { title: '2 + 2', body: 'Short call and response. Great for riffs, hooks and blues.' },
              { title: '4 + 4', body: 'The standard. Question and answer, verse lines, most choruses.' },
              { title: '2 + 2 + 4', body: 'Idea, idea again, then a longer phrase that completes it. Builds naturally towards the end.' },
              { title: '3 or 5 bars', body: 'Unexpected. Use it once to make a moment stand out.' },
            ]}
          />
          <Watch>
            If every phrase ends on the home note over the home chord, the song keeps finishing. Make the first phrase of each pair end on something unresolved (the 2nd or the 5th over a V chord), and save the home note for the second phrase.
          </Watch>

          <h2>In BandForge</h2>
          <Try>
            <Steps>
              <li>
                Write a 4-bar phrase, copy it after itself (<K>⌘</K>/<K>Ctrl</K>+<K>D</K> in the piano roll), and change only the last bar of the copy so the first ends on the 5th and the second on the key note.
              </li>
              <li>
                In the <Ui>Score</Ui>, rests are real objects you can select. Select the last note of a phrase and press <K>0</K> to turn it into a rest, which is the quickest way to give a phrase room to breathe.
              </li>
              <li>
                Use the chord track to put a V chord under the end of your question phrase and I under the end of the answer.
              </li>
            </Steps>
          </Try>
          <Pro>
            Arrangers use the gaps between vocal phrases as slots for something else: a guitar lick, a piano fill, a backing vocal echo. This "call and response" keeps the track moving without anything fighting the lead. When you write a melody, deliberately leave those gaps.
          </Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ 5
    {
      id: 'rhythm',
      title: 'Rhythm makes the melody',
      minutes: 9,
      summary: 'Listeners recognise a tune by its rhythm before its pitches. See how the same notes become a different melody with new note lengths, how syncopation and anticipation add groove, and how to fit melodies to the natural rhythm of words.',
      keywords: 'rhythm syncopation anticipation note lengths rhythmic motif speech rhythm lyrics stress triplets groove off beat',
      body: () => (
        <>
          <Lead>
            Tap the rhythm of a famous song on a table, without any notes, and most people can still guess it. Rhythm is half of a melody's identity, and the half beginners most often neglect. If your melody sounds stiff, the problem is usually the rhythm, not the notes.
          </Lead>

          <h2>Same notes, different melody</h2>
          <Compare
            items={[
              {
                label: 'All the same length',
                verdict: 'worse',
                title: 'Every note one beat',
                bpm: 100,
                chordsAbove: 'C C',
                parts: [
                  { inst: 'electric-piano', label: 'Melody', notes: line('C4:1 E4 G4 A4 | G4:1 E4 D4 C4') },
                  { inst: 'grand-piano', label: 'Chords', notes: chords('C C', { center: 52 }), vol: 0.6 },
                ],
                caption: 'A scale exercise.',
              },
              {
                label: 'Long and short',
                verdict: 'better',
                title: 'Identical pitches, new rhythm',
                bpm: 100,
                chordsAbove: 'C C',
                parts: [
                  { inst: 'electric-piano', label: 'Melody', notes: line('C4:0.75 E4:0.25 G4:1.5 A4:1.5 | G4:0.5 E4:1 D4:0.5 C4:2') },
                  { inst: 'grand-piano', label: 'Chords', notes: chords('C C', { center: 52 }), vol: 0.6 },
                ],
                caption: 'A tune. Long notes create weight, short notes create motion, and the mix creates character.',
              },
            ]}
          />
          <Tip>
            Put your longest notes on the most important moments: the peak, the end of a phrase, the key word of a lyric. Use quick notes to get between them. A melody that's all quick notes is breathless; all long notes is a hymn.
          </Tip>

          <h2>Syncopation: accents between the beats</h2>
          <p>
            <b>Syncopation</b> means putting notes or accents where the listener doesn't expect them: on the "ands" between beats, or holding through a strong beat. It's what makes pop, funk, Latin and jazz melodies feel like they groove rather than march.
          </p>
          <Compare
            items={[
              {
                label: 'On the beat',
                title: 'Notes start on beats',
                bpm: 100,
                loop: true,
                chordsAbove: 'C Am',
                parts: [
                  { inst: 'square-lead', label: 'Melody', notes: line('E4:1 E4 D4 C4 | D4:1 E4 C4:2') },
                  { inst: 'kit-acoustic', label: 'Drums', notes: softBeat(2) },
                ],
              },
              {
                label: 'Syncopated',
                verdict: 'better',
                title: 'Notes start between beats',
                bpm: 100,
                loop: true,
                chordsAbove: 'C Am',
                parts: [
                  { inst: 'square-lead', label: 'Melody', notes: line('E4:0.5 E4:1 D4:1 C4:1.5 | r:0.5 D4:0.5 E4:1 C4:2') },
                  { inst: 'kit-acoustic', label: 'Drums', notes: softBeat(2) },
                ],
                caption: 'Same notes. The second version dodges the beat, so it bounces against the drums.',
              },
            ]}
          />

          <h2>Anticipation: arriving early</h2>
          <p>
            One special kind of syncopation is the <b>anticipation</b>: a note that belongs to the next bar arrives half a beat early, on the "and" of beat 4, and is held over the bar line. It's one of the most common moves in pop vocals because it sounds eager and natural, like speech.
          </p>
          <Example
            title="The last note jumps in before the bar line"
            bpm={96}
            chordsAbove="C G"
            mark={[[3.5, 4, 'early']]}
            parts={[
              { inst: 'clarinet', label: 'Melody', notes: line('G4:1 A4:1 G4:1 E4:0.5 D4:4.5') },
              { inst: 'grand-piano', label: 'Chords', notes: chords('C G', { center: 55 }), vol: 0.7 },
              { inst: 'kit-acoustic', label: 'Drums', notes: softBeat(2) },
            ]}
            caption="D belongs to the G chord in bar 2, but it starts half a beat early and rings across the change. Mute the drums to hear how much the push depends on the beat underneath."
          />

          <h2>Rhythmic motifs: repeat the rhythm, change the notes</h2>
          <p>
            Because people latch on to rhythm, you can keep a rhythm pattern and change the pitches, and the melody still sounds unified. This is one of the easiest ways to write a verse that hangs together.
          </p>
          <Example
            title="One rhythm (long–short–short–long) in every bar"
            bpm={96}
            chordsAbove="C F G C"
            parts={[
              { inst: 'flute', label: 'Melody', notes: line('E4:1.5 D4:0.5 C4:1 G4:1 | A4:1.5 G4:0.5 F4:1 C5:1 | B4:1.5 A4:0.5 G4:1 D4:1 | C4:4') },
              { inst: 'grand-piano', label: 'Chords', notes: chords('C F G C', { center: 55 }), vol: 0.7 },
            ]}
            caption="The pitches change with each chord, but the same rhythm repeats three times, then breaks for the long final note. It feels designed rather than improvised."
          />

          <h2>Let the words decide</h2>
          <p>
            In vocal music, the rhythm of the melody should follow the natural rhythm of the words. Say the line out loud and notice the stressed syllables: "i CAN'T stop THINK-ing a-BOUT you". Those stressed syllables want to land on strong beats or long notes. Unstressed ones go on weak beats or quick notes.
          </p>
          <Compare
            items={[
              {
                label: 'Stresses on weak beats',
                verdict: 'worse',
                title: 'Sounds like a foreign accent',
                bpm: 92,
                mark: [
                  [5.5, 6, "CAN'T"],
                  [7.5, 8, 'THINK'],
                  [10.5, 11, 'BOUT'],
                ],
                parts: [{ inst: 'clarinet', label: 'Melody', notes: line('r:4 G4:1 r:0.5 C5:0.5 B4:1 r:0.5 A4:0.5 G4:1 G4:1 r:0.5 E4:0.5 D4:1') }],
                caption: 'CAN’T, THINK and BOUT all fall between beats, while "i" and "ing" get the strong beats.',
              },
              {
                label: 'Stresses on strong beats',
                verdict: 'better',
                title: 'Sounds like someone talking',
                bpm: 92,
                mark: [
                  [4, 5, "CAN'T"],
                  [6, 7, 'THINK'],
                  [8, 9.5, 'BOUT'],
                ],
                parts: [{ inst: 'clarinet', label: 'Melody', notes: line('r:3.5 G4:0.5 C5:1 B4:1 A4:1 G4:0.5 G4:0.5 E4:1.5 D4:2.5') }],
                caption: '"i" is a pickup, CAN’T lands on beat 1, THINK on beat 3, BOUT on the next beat 1. It sings itself.',
              },
            ]}
          />
          <Watch>
            Writing the melody first and forcing lyrics onto it later is the classic cause of awkward stresses. If you write that way, adjust the rhythm once the words exist. Moving one note half a beat earlier or later is usually all it takes.
          </Watch>

          <h2>In BandForge</h2>
          <Try>
            <Steps>
              <li>
                In the <Ui>Piano Roll</Ui>, set the snap grid to 1/8 or 1/16 to place syncopated notes, or 1/8T for triplets. Hold <K>⌘</K> while dragging to place a note off the grid.
              </li>
              <li>
                Played something in live and it's sloppy? Select the notes and press <K>Q</K> to quantize them to the grid. Lower the quantize strength in the toolbar to tidy the timing but keep some human feel.
              </li>
              <li>
                In the <Ui>Score</Ui>, choose durations with <K>3</K>–<K>7</K> (sixteenth to whole note), add a dot with <K>.</K>, and toggle triplets with <K>⌘</K>/<K>Ctrl</K>+<K>3</K>.
              </li>
              <li>
                Turn on the metronome (<K>K</K>) and clap your melody's rhythm against it before you worry about the notes.
              </li>
            </Steps>
          </Try>
          <Pro>
            Many writers start a melody from rhythm alone: they speak or mumble nonsense syllables over the beat until a rhythm feels catchy, then find pitches for it. Try it: loop your chords, mumble for a minute, and transcribe the rhythm of whatever bit stuck.
          </Pro>
        </>
      ),
    },

    // ------------------------------------------------------------------ 6
    {
      id: 'hooks',
      title: 'Hooks and writing for a voice',
      minutes: 10,
      summary: 'What makes a hook stick, how chorus melodies differ from verse melodies, the ranges real voices can sing, and how to fit lyrics so a singer sounds great. Everything you need to write a melody someone can actually sing.',
      keywords: 'hook chorus verse catchy singable vocal range soprano alto tenor baritone bass lyrics vowels breath title topline',
      body: () => (
        <>
          <Lead>
            A <b>hook</b> is the bit people sing in the shower: short, repeated, easy to sing and a little bit surprising. Every technique in this chapter, shape, motifs, phrases and rhythm, comes together in the hook. Here's how to aim for one on purpose.
          </Lead>

          <h2>What hooks have in common</h2>
          <Cards
            items={[
              { title: 'Short', body: 'Usually 1–2 bars, about the length of a breath or a short sentence. Short enough to remember after one hearing.' },
              { title: 'Repeated', body: 'A chorus hook often appears 2–4 times per chorus, and the chorus appears 3 or more times. Repetition is the point.' },
              { title: 'Singable', body: 'Mostly steps, few big leaps, within a comfortable range. If people can’t sing it, they can’t get it stuck in their head.' },
              { title: 'One surprise', body: 'A distinctive rhythm, an unexpected leap, a held note, or a colour note. Just one thing that’s not ordinary.' },
              { title: 'Tied to the title', body: 'In songs, the hook usually carries the title words. The melody and the lyric reinforce each other.' },
            ]}
          />

          <h2>Verse and chorus melodies are different on purpose</h2>
          <p>
            Contrast between verse and chorus is what makes a chorus feel like a lift. The verse is conversational: lower, more words, shorter notes, narrower range. The chorus is declarative: higher, fewer words, longer notes, simpler and more repetitive.
          </p>
          <Compare
            items={[
              {
                label: 'Verse',
                title: 'Low, busy, talky',
                bpm: 96,
                chordsAbove: 'Am F C G',
                parts: [
                  { inst: 'clarinet', label: 'Vocal line', notes: line('r:0.5 A3:0.5 C4 C4 C4 B3 A3:1 | r:0.5 A3:0.5 C4 C4 D4 C4 A3:1 | r:0.5 G3:0.5 C4 E4 E4 D4 C4:1 | D4:1 B3:1 G3:2') },
                  { inst: 'grand-piano', label: 'Chords', notes: chords('Am F C G', { center: 55 }), vol: 0.6 },
                ],
                caption: 'Range G3–E4, mostly eighth notes, starting off the beat. Room for a lot of lyrics.',
              },
              {
                label: 'Chorus',
                verdict: 'better',
                title: 'High, long, simple',
                bpm: 96,
                chordsAbove: 'Am F C G',
                parts: [
                  { inst: 'clarinet', label: 'Vocal line', notes: line('E5:2 C5:1 B4:1 | C5:3 A4:1 | G4:1 C5:1 E5:1.5 D5:0.5 | D5:4') },
                  { inst: 'grand-piano', label: 'Chords', notes: chords('Am F C G', { center: 57, style: 'pulse' }), vol: 0.7 },
                  { inst: 'kit-acoustic', label: 'Drums', notes: softBeat(4) },
                ],
                caption: 'Same chords, but the melody jumps up about a 6th, uses long notes and starts right on the beat. That’s the lift.',
              },
            ]}
          />
          <Spec
            title="Verse vs chorus, rules of thumb"
            rows={[
              ['Register', 'Chorus sits a 3rd to a 5th higher on average than the verse.'],
              ['Note lengths', 'Chorus uses longer notes; verse uses more short notes.'],
              ['Words', 'Verse tells the story with more words; chorus repeats fewer, bigger words.'],
              ['Start', 'Verses often start late or with a pickup; choruses often hit beat 1 hard.'],
              ['Repetition', 'Chorus repeats its hook; verse lines vary more.'],
            ]}
          />

          <h2>The ranges real voices can sing</h2>
          <RangeChart
            sweet
            rows={[
              { label: 'Soprano', lo: 'D4', hi: 'G5', note: 'comfortable · reaches C4–C6' },
              { label: 'Alto', lo: 'A3', hi: 'D5', note: 'comfortable · reaches F3–F5' },
              { label: 'Tenor', lo: 'D3', hi: 'G4', note: 'comfortable · reaches C3–C5' },
              { label: 'Baritone', lo: 'A2', hi: 'E4', note: 'comfortable · reaches G2–G4' },
              { label: 'Bass', lo: 'F2', hi: 'C4', note: 'comfortable · reaches E2–E4' },
              { label: 'Untrained voice', lo: 'C3', hi: 'D4', color: '#8b8a86', note: 'about an octave' },
            ]}
            caption="Approximate comfortable singing ranges (the dot marks middle C). Trained singers reach further, but a melody that lives in the comfortable band will sound relaxed and full. For a song anyone can sing along to, aim for about an octave."
          />
          <p>
            Most pop melodies span about an octave and a half, with the highest notes saved for the chorus. Men and women singing "the same" melody are usually an octave apart, so a melody that suits a tenor in its written octave suits an alto an octave higher. If a melody feels too high or low for a particular voice, move the whole song's key rather than rewriting the tune (the keys chapter covers how to choose).
          </p>
          <Watch>
            On a piano roll every note is equally easy to draw, but not equally easy to sing. Long stretches near the top of a range are tiring, and fast leaps of more than a 6th are hard to sing in tune. If you're writing for a voice, sing it, or at least check the highest and lowest notes against the chart above.
          </Watch>

          <h2>Fitting the lyrics</h2>
          <Spec
            rows={[
              ['Stress on strong beats', 'Stressed syllables on beats 1 and 3 or on long notes (see the rhythm lesson).'],
              ['Open vowels up high', '"ah", "oh" and "ay" are easy to sing on high, long notes. Tight vowels like "ee" and "oo" are harder up there.'],
              ['Fast notes, simple words', 'Quick runs of notes suit short, easy words. Consonant clusters ("strengths") on fast notes trip singers up.'],
              ['Breathe at commas', 'Put rests where the sentence naturally pauses, not mid-word.'],
              ['Title on the hook', 'Put the title on the most memorable melodic moment, often the first or last line of the chorus.'],
            ]}
          />
          <Why>
            High notes need open throats; that's why singers naturally open up vowels at the top. And listeners remember the words sitting on the most prominent notes, the highest, longest and most repeated ones. Put the important words there and the song becomes memorable for both its melody and its message.
          </Why>
          <Listen>
            Play the chorus of any big pop song and notice where the title falls. Very often it's on the longest or highest notes, repeated at the start or end of the chorus, sometimes both.
          </Listen>

          <h2>In BandForge</h2>
          <Try>
            <Steps>
              <li>
                Write your vocal melody on its own instrument track: something with a clear, sustained tone like clarinet, flute or a lead synth works well as a stand-in for a voice.
              </li>
              <li>
                Open it in the <Ui>Score</Ui>, select the first note and press <K>⌘</K>/<K>Ctrl</K>+<K>L</K> to type lyrics. Press <K>Space</K> to move to the next note and <K>-</K> to split a word across notes. Seeing words under notes makes bad stresses obvious.
              </li>
              <li>
                Solo the melody track (<K>S</K>) and listen to it on its own. A real hook still works with no accompaniment.
              </li>
              <li>
                Too high or too low? In <Ui>Song settings</Ui>, tick <b>Transpose existing notes when the key changes</b> and try a new key.
              </li>
            </Steps>
          </Try>
          <Pro>
            Professional topline writers often write the chorus first, because it is the part that has to be strongest. They write many versions of the hook, sometimes dozens, sing each one away from the instrument, and keep the one they still remember the next morning. That overnight test is surprisingly reliable.
          </Pro>
          <Tip>Once you have a hook, use it more than you think you should: at the start and end of the chorus, as an instrumental riff in the intro, and stripped down in the bridge. Repetition across the song is what turns a nice melody into "that song".</Tip>
        </>
      ),
    },
  ],
};

export default chapter;
