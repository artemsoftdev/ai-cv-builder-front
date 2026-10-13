import type { Cv, CvContent, CvQuestion } from "@/lib/api/types";
import type { ReadyCv } from "@/lib/cv/ready-cv";

export const CV_ID = "11111111-1111-4111-8111-111111111111";
export const QUESTION_ID = "22222222-2222-4222-8222-222222222222";

export const makeContent = (overrides: Partial<CvContent> = {}): CvContent => ({
  contact: {
    fullName: "Jane Doe",
    headline: "Backend Engineer",
    email: "jane@example.com",
    phone: "",
    location: "London",
    links: [{ id: "l1", label: "GitHub", url: "github.com/jane" }],
  },
  summary: "Backend engineer who ships billing systems.",
  experience: [
    {
      id: "e1",
      company: "Acme",
      title: "Engineer",
      location: "",
      startDate: "2021",
      endDate: "Present",
      bullets: [{ id: "b1", text: "Built the billing service." }],
    },
  ],
  education: [],
  skills: [{ id: "s1", name: "Languages", items: ["Go"] }],
  ...overrides,
});

export const makeQuestion = (overrides: Partial<CvQuestion> = {}): CvQuestion => ({
  id: QUESTION_ID,
  section: "experience",
  itemId: "e1",
  question: "By how much did you improve API latency?",
  answer: null,
  status: "open",
  error: null,
  errorMessage: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

export const makeCv = (overrides: Partial<Cv> = {}): Cv => ({
  id: CV_ID,
  title: "Backend CV",
  targetRole: "Senior Backend Engineer",
  sourceType: "text",
  sourceFilename: null,
  status: "ready",
  stage: "done",
  error: null,
  content: makeContent(),
  review: { flags: [], removed: [], evidence: {} },
  questions: [],
  version: 3,
  busy: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

export const makeReadyCv = (overrides: Partial<Cv> = {}): ReadyCv => {
  const cv = makeCv(overrides);
  if (!cv.content) throw new Error("A ready CV needs content");
  return { ...cv, content: cv.content };
};
