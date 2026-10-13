import start from './chapters/start';
import theory from './chapters/theory';
import keys from './chapters/keys';
import chords from './chapters/chords';
import melody from './chapters/melody';
import harmony from './chapters/harmony';
import arrange from './chapters/arrange';
import drums from './chapters/drums';
import mix from './chapters/mix';
import genres from './chapters/genres';
import type { Chapter, Lesson } from './types';

export const CHAPTERS: Chapter[] = [start, theory, keys, chords, melody, harmony, arrange, drums, mix, genres];

export interface LessonRef {
  chapter: Chapter;
  lesson: Lesson;
  /** "chapterId/lessonId" */
  key: string;
  /** position in the whole course */
  index: number;
}

export const ALL_LESSONS: LessonRef[] = CHAPTERS.flatMap((chapter) => chapter.lessons.map((lesson) => ({ chapter, lesson, key: chapter.id + '/' + lesson.id }))).map((r, index) => ({ ...r, index }));

export function findLesson(key: string | null | undefined): LessonRef | undefined {
  return key ? ALL_LESSONS.find((r) => r.key === key) : undefined;
}

export function searchLessons(q: string): LessonRef[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return ALL_LESSONS.map((r) => {
    const title = r.lesson.title.toLowerCase();
    const hay = [r.lesson.title, r.lesson.summary, r.lesson.keywords ?? '', r.chapter.title].join(' ').toLowerCase();
    if (!words.every((w) => hay.includes(w))) return null;
    return { r, score: words.reduce((s, w) => s + (title.includes(w) ? 3 : 1), 0) };
  })
    .filter((x): x is { r: LessonRef; score: number } => !!x)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.r);
}
