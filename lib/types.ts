export type Track = 'theory' | 'lab' | 'main';
export type Category = 'lectures' | 'reports' | 'quizzes' | 'midterms' | 'finals' | 'summaries' | 'videos';
export type FileKind = 'pdf' | 'image' | 'doc' | 'video' | 'link';

export interface Item {
  id: string;
  subject_slug: string;
  track: Track;
  category: Category;
  title: string;
  tags: string[];
  badges: string[];
  file_path: string | null;
  file_kind: FileKind;
  external_url: string | null;
  uploader_name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  exam_pick?: boolean;
  description?: string | null;
  created_at: string;
}
