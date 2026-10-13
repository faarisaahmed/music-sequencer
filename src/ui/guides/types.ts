import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface Lesson {
  /** unique within its chapter; the address is "chapterId/lessonId" */
  id: string;
  title: string;
  /** reading time */
  minutes: number;
  /** one or two sentences: what you'll be able to do after reading */
  summary: string;
  /** extra words people might search for */
  keywords?: string;
  body: () => ReactNode;
}

export interface Chapter {
  id: string;
  title: string;
  /** one line on the chapter card */
  blurb: string;
  icon: LucideIcon;
  color: string;
  lessons: Lesson[];
}
