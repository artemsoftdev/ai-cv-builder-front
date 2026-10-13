"use client";

import { createContext, use, type ReactNode } from "react";

type EditorContextValue = {
  /** A background job is rewriting the CV: inputs are disabled until it finishes. */
  readOnly: boolean;
};

const EditorContext = createContext<EditorContextValue>({ readOnly: false });

export function EditorProvider({ readOnly, children }: EditorContextValue & { children: ReactNode }) {
  return <EditorContext value={{ readOnly }}>{children}</EditorContext>;
}

export function useEditor(): EditorContextValue {
  return use(EditorContext);
}
