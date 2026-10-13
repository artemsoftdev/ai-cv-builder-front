import type { ReactNode } from "react";

import type { CvContent, CvLink } from "@/lib/api/types";
import { formatDateRange } from "@/lib/cv/sections";

/**
 * The CV as a document, laid out like the PDF export (single column, A4): name and headline,
 * a contact line, then Summary, Experience, Education and Skills; empty parts are skipped.
 * Content is untrusted (LLM output / user input): rendered as plain text only, and links are
 * shown as text rather than turned into anchors.
 */
export function CvDocument({ content }: { content: CvContent }) {
  const { contact, summary, experience, education, skills } = content;
  const contactLine = [contact.email, contact.phone, contact.location, ...contact.links.map(linkText)]
    .map((part) => part.trim())
    .filter(Boolean);
  const jobs = experience.filter((item) => hasText(item.title, item.company, ...item.bullets.map((b) => b.text)));
  const schools = education.filter((item) => hasText(item.degree, item.institution, item.details));
  const skillGroups = skills.filter((group) => group.items.some((item) => item.trim()));
  const empty = !hasText(contact.fullName, contact.headline, summary) && contactLine.length === 0 && jobs.length === 0 && schools.length === 0 && skillGroups.length === 0;

  return (
    <div className="px-[60px] py-[56px] font-sans text-[13px] leading-[1.45] break-words text-fg">
      <div>
        <p className="text-[26px] leading-tight font-bold tracking-tight">{contact.fullName.trim() || "Your name"}</p>
        {contact.headline.trim() && <p className="mt-1 text-[15px] text-fg-muted">{contact.headline}</p>}
        {contactLine.length > 0 && <p className="mt-2 text-[11.5px] text-fg-muted">{contactLine.join("  ·  ")}</p>}
      </div>

      {empty && <p className="mt-10 text-fg-subtle">Fill in the editor and your CV appears here.</p>}

      {summary.trim() && (
        <DocSection title="Summary">
          <p className="whitespace-pre-line">{summary.trim()}</p>
        </DocSection>
      )}

      {jobs.length > 0 && (
        <DocSection title="Experience">
          <div className="space-y-3.5">
            {jobs.map((item) => (
              <div key={item.id}>
                <EntryHeader
                  primary={item.title}
                  secondary={item.company}
                  dates={formatDateRange(item.startDate, item.endDate)}
                  location={item.location}
                />
                {item.bullets.some((bullet) => bullet.text.trim()) && (
                  <ul className="mt-1 list-disc space-y-0.5 pl-[18px] marker:text-fg-subtle">
                    {item.bullets
                      .filter((bullet) => bullet.text.trim())
                      .map((bullet) => (
                        <li key={bullet.id}>{bullet.text.trim()}</li>
                      ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </DocSection>
      )}

      {schools.length > 0 && (
        <DocSection title="Education">
          <div className="space-y-3">
            {schools.map((item) => (
              <div key={item.id}>
                <EntryHeader
                  primary={item.degree}
                  secondary={item.institution}
                  dates={formatDateRange(item.startDate, item.endDate)}
                  location={item.location}
                />
                {item.details.trim() && <p className="mt-0.5 whitespace-pre-line">{item.details.trim()}</p>}
              </div>
            ))}
          </div>
        </DocSection>
      )}

      {skillGroups.length > 0 && (
        <DocSection title="Skills">
          <div className="space-y-1">
            {skillGroups.map((group) => (
              <p key={group.id}>
                {group.name.trim() && <span className="font-semibold">{group.name.trim()}: </span>}
                {group.items.map((item) => item.trim()).filter(Boolean).join(", ")}
              </p>
            ))}
          </div>
        </DocSection>
      )}
    </div>
  );
}

function DocSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <p className="mb-2 border-b border-border-strong pb-1 text-[11px] font-semibold tracking-[0.08em] text-primary uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function EntryHeader({ primary, secondary, dates, location }: { primary: string; secondary: string; dates: string; location: string }) {
  const heading = [primary.trim(), secondary.trim()].filter(Boolean);
  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <p className="min-w-0">
          <span className="font-semibold">{heading[0]}</span>
          {heading[1] && <span className="text-fg-muted"> · {heading[1]}</span>}
        </p>
        {dates && <p className="shrink-0 text-[11.5px] text-fg-muted">{dates}</p>}
      </div>
      {location.trim() && <p className="text-[11.5px] text-fg-muted">{location.trim()}</p>}
    </>
  );
}

/** "https://github.com/jane/" -> "github.com/jane"; falls back to the label. */
function linkText(link: CvLink): string {
  const url = link.url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^mailto:/i, "")
    .replace(/\/$/, "");
  return url || link.label;
}

const hasText = (...values: string[]) => values.some((value) => value.trim().length > 0);
