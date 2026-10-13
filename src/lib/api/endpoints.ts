import { apiFetch, apiFetchBlob, type DownloadedFile } from "./client";
import type {
  CreateCvInput,
  Credentials,
  Cv,
  CvListResponse,
  CvResponse,
  CvSummary,
  UpdateCvInput,
  User,
  UserResponse,
} from "./types";

// Encoding keeps a malformed id from changing the route.
const seg = (value: string) => encodeURIComponent(value);

// Uploads include the PDF parsing on the server; rendering the PDF takes a few seconds too.
const UPLOAD_TIMEOUT_MS = 120_000;
const PDF_TIMEOUT_MS = 60_000;

export const authApi = {
  signup: async (credentials: Credentials): Promise<User> =>
    (await apiFetch<UserResponse>("/api/auth/signup", { method: "POST", json: credentials })).user,

  login: async (credentials: Credentials): Promise<User> =>
    (await apiFetch<UserResponse>("/api/auth/login", { method: "POST", json: credentials })).user,

  logout: (): Promise<void> => apiFetch<void>("/api/auth/logout", { method: "POST" }),

  me: async (signal?: AbortSignal): Promise<User> => (await apiFetch<UserResponse>("/api/auth/me", { signal })).user,
};

export function toCreateCvFormData(input: CreateCvInput): FormData {
  const form = new FormData();
  form.set("targetRole", input.targetRole);
  if (input.file !== undefined) {
    const filename = input.file instanceof File ? input.file.name : "cv.pdf";
    form.set("file", input.file, filename);
  } else {
    form.set("text", input.text);
  }
  return form;
}

export const cvsApi = {
  list: async (signal?: AbortSignal): Promise<CvSummary[]> =>
    (await apiFetch<CvListResponse>("/api/cvs", { signal })).items,

  get: async (id: string, signal?: AbortSignal): Promise<Cv> =>
    (await apiFetch<CvResponse>(`/api/cvs/${seg(id)}`, { signal })).cv,

  create: async (input: CreateCvInput): Promise<Cv> =>
    (
      await apiFetch<CvResponse>("/api/cvs", {
        method: "POST",
        formData: toCreateCvFormData(input),
        timeoutMs: UPLOAD_TIMEOUT_MS,
      })
    ).cv,

  update: async (id: string, patch: UpdateCvInput, { keepalive = false } = {}): Promise<Cv> =>
    (await apiFetch<CvResponse>(`/api/cvs/${seg(id)}`, { method: "PATCH", json: patch, keepalive })).cv,

  remove: (id: string): Promise<void> => apiFetch<void>(`/api/cvs/${seg(id)}`, { method: "DELETE" }),

  retry: async (id: string): Promise<Cv> =>
    (await apiFetch<CvResponse>(`/api/cvs/${seg(id)}/retry`, { method: "POST" })).cv,

  answerQuestion: async (id: string, questionId: string, answer: string): Promise<Cv> =>
    (
      await apiFetch<CvResponse>(`/api/cvs/${seg(id)}/questions/${seg(questionId)}/answer`, {
        method: "POST",
        json: { answer },
      })
    ).cv,

  dismissQuestion: async (id: string, questionId: string): Promise<Cv> =>
    (
      await apiFetch<CvResponse>(`/api/cvs/${seg(id)}/questions/${seg(questionId)}/dismiss`, {
        method: "POST",
      })
    ).cv,

  downloadPdf: (id: string, signal?: AbortSignal): Promise<DownloadedFile> =>
    apiFetchBlob(`/api/cvs/${seg(id)}/pdf`, { signal, timeoutMs: PDF_TIMEOUT_MS }),
};
