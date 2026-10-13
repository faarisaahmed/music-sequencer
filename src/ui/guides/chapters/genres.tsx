import { Disc3 } from 'lucide-react';
import type { Chapter } from '../types';
import genres1 from './genres1';
import genres2 from './genres2';

const chapter: Chapter = {
  id: 'genres',
  title: 'Writing in a Style',
  blurb: 'Recipes and signature moves for classical, film, pop, rock, synthwave, lo-fi, electronic, jazz and more.',
  icon: Disc3,
  color: '#e05a4a',
  lessons: [...genres1, ...genres2],
};

export default chapter;
