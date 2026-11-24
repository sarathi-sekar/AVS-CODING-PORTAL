import type { Timestamp } from 'firebase/firestore';

export type Role = 'admin' | 'faculty' | 'placement_coordinator' | 'student';
export type AccountStatus = 'pending' | 'active' | 'suspended';
export type ThemeName = 'light' | 'dark';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  registerNumber: string;
  department: string;
  academicYear: string;
  section: string;
  role: Role;
  status: AccountStatus;
  theme?: ThemeName;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Department {
  id: string;
  name: string;
}

export interface StreakDoc {
  currentStreak: number;
  longestStreak: number;
  totalSolved: number;
  activeDays: number;
}

export interface DailyActivity {
  date: string; // YYYY-MM-DD (Asia/Kolkata)
  attempted: number;
  solved: number;
  minutes: number;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  department: string;
  points: number;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt?: Timestamp;
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  faculty: 'Faculty',
  placement_coordinator: 'Placement Coordinator',
  student: 'Student',
};

export const ACADEMIC_YEARS = ['I Year', 'II Year', 'III Year', 'IV Year'];

export type { LanguageId } from './shared/languages';
import type { LanguageId } from './shared/languages';
import type { Difficulty } from './shared/gamification';
export type { Difficulty };

export interface Course { id: string; title: string; description: string; category: string; level: string; status: 'draft' | 'published'; order: number; lessonCount: number }
export interface ModuleDoc { id: string; courseId: string; title: string; order: number; status: 'draft' | 'published' }
export interface Lesson {
  id: string; courseId: string; moduleId: string; title: string; order: number; level: string; estimatedMinutes: number;
  content: string; status: 'draft' | 'published'; prerequisiteId?: string; relatedQuestionIds?: string[];
  videoUrl?: string; videoPath?: string; attachments?: Attachment[];
}
export interface Attachment { name: string; url: string; path?: string }
export type ResourceType = 'notes' | 'company' | 'interview';
export const RESOURCE_LABEL: Record<ResourceType, string> = { notes: 'Notes & materials', company: 'Company questions', interview: 'Interview questions' };
export interface Resource {
  id: string; type: ResourceType; title: string; subject?: string; company?: string; description?: string; body?: string;
  url?: string; path?: string; status: 'draft' | 'published'; createdAt?: Timestamp;
}
export interface LessonProgress { lessonId: string; courseId: string; completed: boolean }

export interface Example { input: string; output: string; explanation?: string }
export interface TestCase { input: string; expected: string }
export interface Question {
  id: string; title: string; description: string; difficulty: Difficulty; topic: string; constraints: string;
  inputFormat: string; outputFormat: string; examples: Example[]; visibleTests: TestCase[]; hiddenCount: number;
  timeLimitMs: number; memoryLimitKb: number; languages: LanguageId[]; starter: Partial<Record<LanguageId, string>>;
  hints: string[]; editorial?: string; status: 'draft' | 'published';
}

export interface AssessmentQuestion { id: string; text: string; options: string[]; topic: string; marks: number }
export interface Assessment {
  id: string; title: string; category: string; company?: string; durationMinutes: number; maxAttempts: number;
  questions: AssessmentQuestion[]; status: 'draft' | 'published'; description?: string;
}
export const CATEGORIES: Record<string, string> = {
  quantitative: 'Quantitative Aptitude', logical: 'Logical Reasoning', verbal: 'Verbal Ability', technical: 'Technical MCQs',
  programming: 'Programming MCQs', coding: 'Coding Assessments', company: 'Company-Wise Preparation', mock: 'Mock Interviews',
};
export interface Attempt {
  id: string; assessmentId: string; title: string; category: string; company?: string; attemptNo: number; status: 'in_progress' | 'submitted' | 'expired';
  answers: Record<string, number>; total: number; score?: number; totalMarks?: number; startedAt?: Timestamp; endsAt?: Timestamp;
  topicBreakdown?: Record<string, { correct: number; total: number }>;
  review?: { questionId: string; selected: number | null; correctIndex: number; correct: boolean; explanation: string }[];
}
export interface SubmissionDoc {
  id: string; questionId: string; questionTitle: string; language: LanguageId; verdict: string; passed: number; total: number; createdAt?: Timestamp;
  timeMs: number; memoryKb: number; code: string;
}

export interface Job { id: string; company: string; role: string; location?: string; salary?: string; eligibility?: string; description?: string; applyUrl?: string; lastDate: string; status: 'draft' | 'published'; createdAt?: Timestamp }
export interface Application { id: string; uid: string; jobId: string; company: string; role: string; displayName: string; registerNumber: string; department: string; academicYear: string; email: string; createdAt?: Timestamp }
export interface EventDoc { id: string; title: string; date: string; time?: string; program?: string; link?: string; description?: string }
