import type { CSSProperties, ReactNode } from "react";

import type { CvContent } from "@/lib/api/types";
import { isEmptyPrintable, toPrintableCv, type PrintableCv, type PrintableEntry } from "@/lib/cv/printable-cv";

// Mirror of the API's react-pdf template (modules/pdf/cv-document.tsx). Content is untrusted: text only, no anchors.
export function CvDocument({ content }: { content: CvContent }) {
  const cv = toPrintableCv(content);

  return (
    <div className="flex flex-col font-sans break-words" style={STYLES.page}>
      <Header cv={cv} />
      {isEmptyPrintable(cv) && <p style={STYLES.meta}>Fill in the editor and your CV appears here.</p>}
      {cv.summary && (
        <Section title="Summary">
          <p className="whitespace-pre-line">{cv.summary}</p>
        </Section>
      )}
      {cv.experience.length > 0 && (
        <Section title="Experience">
          {cv.experience.map((entry) => (
            <Entry key={entry.id} entry={entry} />
          ))}
        </Section>
      )}
      {cv.education.length > 0 && (
        <Section title="Education">
          {cv.education.map((entry) => (
            <Entry key={entry.id} entry={entry} />
          ))}
        </Section>
      )}
      {cv.skills.length > 0 && (
        <Section title="Skills">
          {cv.skills.map((group) => (
            <p key={group.id} style={STYLES.skillRow}>
              {group.name && <span style={STYLES.bold}>{group.name}: </span>}
              {group.items}
            </p>
          ))}
        </Section>
      )}
    </div>
  );
}

// react-pdf points to CSS pixels (72 pt = 96 px = 1 inch).
const pt = (points: number) => `${(points * 96) / 72}px`;

const PRINT = { text: "#1f2328", muted: "#59636e", accent: "#1d4f7c", rule: "#c9d1d9" } as const;

const STYLES = {
  page: { padding: `${pt(40)} ${pt(46)}`, fontSize: pt(9.5), lineHeight: 1.4, color: PRINT.text },
  name: { fontSize: pt(20), fontWeight: 700, lineHeight: 1.2 },
  headline: { fontSize: pt(11.5), color: PRINT.accent, marginTop: pt(2) },
  // pre-wrap keeps the double spaces around the separators, as in the PDF.
  contact: { fontSize: pt(9), color: PRINT.muted, marginTop: pt(6), whiteSpace: "pre-wrap" },
  section: { marginTop: pt(14) },
  sectionTitle: {
    fontSize: pt(9.5),
    fontWeight: 700,
    letterSpacing: pt(0.8),
    textTransform: "uppercase",
    color: PRINT.accent,
    borderBottom: `${pt(0.75)} solid ${PRINT.rule}`,
    paddingBottom: pt(2),
    marginBottom: pt(6),
  },
  entry: { marginBottom: pt(8) },
  entryHeading: { flexShrink: 1, minWidth: 0, paddingRight: pt(10) },
  bold: { fontWeight: 700 },
  dates: { color: PRINT.muted, flexShrink: 0, textAlign: "right" },
  meta: { color: PRINT.muted },
  details: { marginTop: pt(2) },
  bulletRow: { marginTop: pt(2) },
  bulletMark: { width: pt(10), flexShrink: 0, color: PRINT.muted },
  skillRow: { marginBottom: pt(2) },
} satisfies Record<string, CSSProperties>;

function Header({ cv }: { cv: PrintableCv }) {
  return (
    <div className="flex flex-col">
      {cv.name && <p style={STYLES.name}>{cv.name}</p>}
      {cv.headline && <p style={STYLES.headline}>{cv.headline}</p>}
      {cv.contact.length > 0 && <p style={STYLES.contact}>{cv.contact.join("  ·  ")}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col" style={STYLES.section}>
      <p style={STYLES.sectionTitle}>{title}</p>
      {children}
    </div>
  );
}

function Entry({ entry }: { entry: PrintableEntry }) {
  return (
    <div className="flex flex-col" style={STYLES.entry}>
      <div className="flex justify-between">
        <p style={STYLES.entryHeading}>
          {entry.title && <span style={STYLES.bold}>{entry.title}</span>}
          {entry.title && entry.subtitle && " — "}
          {entry.subtitle}
        </p>
        {entry.dates && <p style={STYLES.dates}>{entry.dates}</p>}
      </div>
      {entry.location && <p style={STYLES.meta}>{entry.location}</p>}
      {entry.details && (
        <p className="whitespace-pre-line" style={STYLES.details}>
          {entry.details}
        </p>
      )}
      {entry.bullets.map((bullet) => (
        <div key={bullet.id} className="flex" style={STYLES.bulletRow}>
          <span style={STYLES.bulletMark}>•</span>
          <p className="min-w-0 flex-1">{bullet.text}</p>
        </div>
      ))}
    </div>
  );
}
