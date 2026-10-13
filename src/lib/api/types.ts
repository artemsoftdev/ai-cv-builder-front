/**
 * DTOs of the REST API. Hand-written mirror of `docs/API.md` (the contract shared with
 * ai-cv-builder-api): keep the two in sync, field for field.
 */

// ---------------------------------------------------------------------------- errors

/** Error codes the API can return (see the table in docs/API.md). */
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

/** Produced by the client itself when no HTTP response was received. */
export type ClientErrorCode = "NETWORK_ERROR";

export type ApiErrorCode = ServerErrorCode | ClientErrorCode;

/** Body of every non-2xx response. */
export type ApiErrorBody = {
  error: { code: string; message: string; details?: Record<string, unknown> };
};

/** `details.issues` of a `VALIDATION_ERROR`. */
export type ValidationIssue = { path: string; message: string };

/** Codes of failed background jobs, found in `Cv.error.code` and `CvQuestion.error`. */
export type JobErrorCode =
  | "SOURCE_UNREADABLE"
  | "LLM_NOT_CONFIGURED"
  | "LLM_REFUSED"
  | "LLM_UNAVAILABLE"
  | "LLM_INVALID_OUTPUT"
  | "INTERNAL";

// ---------------------------------------------------------------------------- auth

export type User = { id: string; email: string; createdAt: string };

export type Credentials = { email: string; password: string };

// ---------------------------------------------------------------------------- CVs

export type CvStatus = "generating" | "ready" | "failed";
/** Progress of the initial generation. 'extracting' only happens for scanned PDFs. */
export type GenerationStage = "queued" | "extracting" | "drafting" | "verifying" | "done";

export type Bullet = { id: string; text: string };

export type ExperienceItem = {
  id: string;
  company: string;
  title: string;
  /** '' when unknown */
  location: string;
  /** Free text exactly as in the source, e.g. "Mar 2021", "2019"; '' when unknown. */
  startDate: string;
  /** Free text, e.g. "Present"; '' when unknown. */
  endDate: string;
  bullets: Bullet[];
};

export type EducationItem = {
  id: string;
  institution: string;
  /** e.g. "BSc Computer Science" */
  degree: string;
  location: string;
  startDate: string;
  endDate: string;
  /** Optional free text (honours, thesis…), '' when none. */
  details: string;
};

/** `name` e.g. "Languages". */
export type SkillGroup = { id: string; name: string; items: string[] };

export type CvLink = { id: string; label: string; url: string };

export type CvContact = {
  fullName: string;
  /** Short professional title aligned with the target role. */
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: CvLink[];
};

export type CvContent = {
  contact: CvContact;
  summary: string;
  /** Most relevant to the target role first. */
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: SkillGroup[];
};

/** Output of the grounding verifier. Lives next to content, never inside it. */
export type ReviewFlag = {
  id: string;
  /** Bullet.id | ExperienceItem.id | EducationItem.id | 'summary' | 'headline' */
  itemId: string;
  /** e.g. 'Number "40%" does not appear in your source' */
  reason: string;
};

export type RemovedClaim = {
  /** e.g. 'contact.phone', 'skills' */
  field: string;
  /** The removed value. */
  value: string;
  reason: string;
};

export type CvReview = {
  /** Shown as warning badges; the user edits or dismisses them. */
  flags: ReviewFlag[];
  /** Values the verifier dropped because they are not in the source. */
  removed: RemovedClaim[];
  /** itemId -> verified verbatim quotes from the source. */
  evidence: Record<string, string[]>;
};

export type QuestionSection = "contact" | "summary" | "experience" | "education" | "skills";
export type QuestionStatus = "open" | "applying" | "applied" | "dismissed" | "failed";

export type CvQuestion = {
  id: string;
  section: QuestionSection;
  /** ExperienceItem.id / EducationItem.id when the question is about one entry. */
  itemId: string | null;
  question: string;
  answer: string | null;
  status: QuestionStatus;
  /** Set when status = 'failed'. */
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
  /** Set when status = 'failed'. `code` is usually a JobErrorCode. */
  error: { code: string; message: string } | null;
  /** null until the first generation succeeds. */
  content: CvContent | null;
  review: CvReview | null;
  /** Ordered by creation. */
  questions: CvQuestion[];
  /** Optimistic-locking counter, incremented on every content change. */
  version: number;
  /** true while any job for this CV is queued or running. */
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

// ---------------------------------------------------------------------------- requests / responses

/** `POST /api/cvs` (sent as multipart/form-data): exactly one source, text or a PDF file. */
export type CreateCvInput =
  | { targetRole: string; text: string; file?: never }
  | { targetRole: string; file: File | Blob; text?: never };

/** `PATCH /api/cvs/:id` */
export type UpdateCvInput = {
  version: number;
  title?: string;
  content?: CvContent;
  dismissFlagIds?: string[];
};

export type UserResponse = { user: User };
export type CvResponse = { cv: Cv };
export type CvListResponse = { items: CvSummary[] };

export type HealthResponse = {
  status: string;
  db: "ok" | "down";
  llm: "configured" | "missing_key" | "fake";
};

// ---------------------------------------------------------------------------- limits

/** Limits from docs/API.md, for client-side validation before hitting the server. */
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
