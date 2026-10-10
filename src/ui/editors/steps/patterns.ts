// Genre drum pattern presets (16 steps per bar). '|' separates bars and is ignored.
// X = accent, x = normal, o = ghost.
export interface DrumPreset {
  name: string;
  lanes: Record<number, string>;
}

export const DRUM_PRESETS: DrumPreset[] = [
  {
    name: 'Rock',
    lanes: {
      36: 'X.......x.x.....|X.......x.....x.',
      38: '....X.......X...|....X.......X..o',
      42: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.',
      49: 'X...............|................',
    },
  },
  {
    name: 'Pop',
    lanes: {
      36: 'X.....x.X.......|X.....x.X...x...',
      38: '....X.......X...|....X.......X...',
      39: '....x.......x...|....x.......x...',
      42: 'x.x.x.x.x.x.x...|x.x.x.x.x.x.x...',
      46: '..............x.|..............x.',
    },
  },
  {
    name: 'Hip Hop',
    lanes: {
      36: 'X......x..X.....|X......x..x..x..',
      38: '....X.......X...|....X.......X...',
      42: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.xxx.x.',
    },
  },
  {
    name: 'Boom Bap',
    lanes: {
      36: 'X.......x.X.....|X.x.......X.....',
      38: '....X..o....X...|....X..o....X.o.',
      42: 'x.x.x.x.x.x.x...|x.x.x.x.x.x.x...',
      46: '..............x.|..............x.',
    },
  },
  {
    name: 'Trap',
    lanes: {
      36: 'X.........X.....|X......x..X.....',
      38: '........X.......|........X.......',
      42: 'XxxxXxxxXxxxXxxx|XxxxXxxxXxXxXxXx',
      46: '..........x.....|..............x.',
    },
  },
  {
    name: 'House',
    lanes: {
      36: 'X...X...X...X...',
      39: '....X.......X...',
      42: 'o.o.o.o.o.o.o.o.',
      46: '..x...x...x...x.',
      70: 'oxoxoxoxoxoxoxox',
    },
  },
  {
    name: 'Techno',
    lanes: {
      36: 'X...X...X...X...',
      39: '....x.......x...',
      42: 'x.xx..xxx.xx..xx',
      46: '..x...x...x...x.',
      37: '......x.....x..x',
    },
  },
  {
    name: 'Funk',
    lanes: {
      36: 'X..x..x...X..x..|X..x....x.X.....',
      38: '....X..o.o..X..o|....X..o.o..X...',
      42: 'XxxxXxxxXxxxXxxx|XxxxXxxxXxxxXx..',
      46: '................|..............x.',
    },
  },
  {
    name: 'Reggaeton',
    lanes: {
      36: 'X...x...X...x...',
      38: '...x..x....x..x.',
      42: 'x.x.x.x.x.x.x.x.',
      70: 'xoxoxoxoxoxoxoxo',
    },
  },
  {
    name: 'Lo-Fi',
    lanes: {
      36: 'X......x..x.....|X.........x..x..',
      38: '....X.......X...|....X.......X...',
      42: 'x.x.x.xox.x.x.xo|x.x.x.xox.x.x.x.',
      70: '..o...o...o...o.|..o...o...o...o.',
    },
  },
  {
    name: 'Disco',
    lanes: {
      36: 'X...X...X...X...',
      38: '....X.......X...',
      42: 'x...x...x...x...',
      46: '..x...x...x...x.',
      54: 'xoxoxoxoxoxoxoxo',
    },
  },
  {
    name: 'Drum & Bass',
    lanes: {
      36: 'X.........X.....|X.........X..x..',
      38: '....X..o....X...|....X..o....X.o.',
      42: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.',
      49: 'X...............|................',
    },
  },
  {
    name: 'Afrobeat',
    lanes: {
      36: 'X......x..X.....',
      37: '...x..x....x..x.',
      42: 'x.xxx.xxx.xxx.xx',
      56: 'x..x..x...x.x...',
      70: 'oxoxoxoxoxoxoxox',
    },
  },
  {
    name: 'Shuffle',
    lanes: {
      36: 'X.....x.X.....x.',
      38: '....X.......X...',
      42: 'x..xx..xx..xx..x',
    },
  },
];

/** Number of 16th steps in a preset (longest lane). */
export function presetSteps(p: DrumPreset): number {
  return Math.max(...Object.values(p.lanes).map((s) => s.replace(/\s|\|/g, '').length));
}
