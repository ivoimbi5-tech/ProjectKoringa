import { Timestamp } from 'firebase/firestore';

export type ProjectStatus = 'ready' | 'in-progress' | 'site';

export interface Project {
  id?: string;
  name: string;
  description?: string;
  link?: string;
  status: ProjectStatus;
  userId: string;
  createdAt: Timestamp;
  isPublic: boolean;
  likes: number;
  accesses: number;
  xp: number;
}

export interface Comment {
  id?: string;
  projectId: string;
  authorName: string;
  contact?: string;
  content: string;
  createdAt: Timestamp;
}
