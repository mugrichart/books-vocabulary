export type StoryNodeType = 'story' | 'chapter' | 'scene';

export interface StorySummary {
  id: string;
  title: string;
  bookId: string;
  bookTitle: string;
  outline: string;
  captureCursor: number;
  chapterCount: number;
  sceneCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryChapter {
  id: string;
  storyId: string;
  title: string;
  outline: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryScene {
  id: string;
  storyId: string;
  chapterId: string;
  title: string;
  outline: string;
  content: string;
  order: number;
  captureCursor: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryDetail extends StorySummary {
  chapters: StoryChapter[];
  scenes: StoryScene[];
}