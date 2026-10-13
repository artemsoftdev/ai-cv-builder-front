// Hand-written mirror of docs/API.md: keep the two in sync.

export type ServerErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "INVALID_CREDENTIALS"
  | "CSRF_CHECK_FAILED"
  | "NOT_FOUND"
  | "EMAIL_TAKEN"
  | "VERSION_CONFLICT"
  | "CV_BUSY"
  | "CV_NOT_READY"
  | "INVALID_STATE"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE"
  | "UNPROCESSABLE_SOURCE"
  | "RATE_LIMITED"
  | "INTERNAL";

export type ClientErrorCode = "NETWORK_ERROR";

export type ApiErrorCode = ServerErrorCode | ClientErrorCode;

export type ValidationIssue = { path: string; message: string };

export type JobErrorCode =
  "SOURCE_UNREADABLE" | "LLM_NOT_CONFIGURED" | "LLM_REFUSED" | "LLM_UNAVAILABLE" | "LLM_INVALID_OUTPUT" | "INTERNAL";

export type User = { id: string; email: string; createdAt: string };

export type Credentials = { email: string; password: string };

export type CvStatus = "generating" | "ready" | "failed";
/** 'extracting' only happens for scanned PDFs. */
export type GenerationStage = "queued" | "extracting" | "drafting" | "verifying" | "done";

export type Bullet = { id: string; text: string };

export type ExperienceItem = {
  id: string;
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  bullets: Bullet[];
};

export type EducationItem = {
  id: string;
  institution: string;
  degree: string;
  location: string;
  startDate: string;
  endDate: string;
  details: string;
};

export type SkillGroup = { id: string; name: string; items: string[] };

export type CvLink = { id: string; label: string; url: string };

export type CvContact = {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: CvLink[];
};

export type CvContent = {
  contact: CvContact;
  summary: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: SkillGroup[];
};

export type ReviewFlag = {
  id: string;
  /** Bullet.id | ExperienceItem.id | EducationItem.id | 'summary' | 'headline' */
  itemId: string;
  reason: string;
};

export type RemovedClaim = {
  field: string;
  value: string;
  reason: string;
};

export type CvReview = {
  flags: ReviewFlag[];
  removed: RemovedClaim[];
  evidence: Record<string, string[]>;
};

export type QuestionSection = "contact" | "summary" | "experience" | "education" | "skills";
export type QuestionStatus = "open" | "applying" | "applied" | "dismissed" | "failed";

export type CvQuestion = {
  id: string;
  section: QuestionSection;
  itemId: string | null;
  question: string;
  answer: string | null;
  status: QuestionStatus;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CvSourceType = "pdf" | "text";

export type Cv = {
  id: string;
  title: string;
  targetRole: string;
  sourceType: CvSourceType;
  sourceFilename: string | null;
  status: CvStatus;
  stage: GenerationStage;
  error: { code: string; message: string } | null;
  content: CvContent | null;
  review: CvReview | null;
  questions: CvQuestion[];
  version: number;
  busy: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CvSummary = Pick<
  Cv,
  "id" | "title" | "targetRole" | "status" | "stage" | "busy" | "createdAt" | "updatedAt"
> & {
  openQuestions: number;
};

export type CreateCvInput =
  { targetRole: string; text: string; file?: never } | { targetRole: string; file: File | Blob; text?: never };

export type UpdateCvInput = {
  version: number;
  title?: string;
  content?: CvContent;
  dismissFlagIds?: string[];
};

export type UserResponse = { user: User };
export type CvResponse = { cv: Cv };
export type CvListResponse = { items: CvSummary[] };

export const API_LIMITS = {
  password: { min: 8, max: 128 },
  targetRole: { min: 1, max: 120 },
  sourceText: { min: 50, max: 20_000 },
  pdf: { maxBytes: 5 * 1024 * 1024, maxPages: 10 },
  answer: { min: 1, max: 2_000 },
  content: {
    experienceItems: 30,
    bulletsPerItem: 15,
    educationItems: 15,
    skillGroups: 20,
    skillsPerGroup: 40,
    links: 10,
    string: 300,
    summary: 1_500,
    bullet: 400,
    educationDetails: 600,
  },
} as const;
