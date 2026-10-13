// Regenerates ivan-petrov-cv.pdf (text layer, Cyrillic name): node e2e/fixtures/make-cv-pdf.mts
import { writeFile } from "node:fs/promises";

import { chromium } from "@playwright/test";

const LINES = [
  "Иван Петров",
  "ivan.petrov@example.com",
  "Backend developer with seven years of experience building logistics APIs in Go and PostgreSQL.",
  "Backend Developer at Volga Logistics (2018 - Present)",
  "- Designed the shipment tracking API in Go used by 40 warehouses",
  "- Moved nightly billing jobs from cron scripts to Kafka consumers",
  "Junior Developer at Ural Soft (2016 - 2018)",
  "- Maintained the internal CRM written in PHP and MySQL",
  "Ural Federal University, BSc Computer Science (2012 - 2016)",
  "Skills: Go, PostgreSQL, Kafka, Docker, Linux",
];

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Ivan Petrov CV</title>
    <style>
      body { font: 11pt Arial, "DejaVu Sans", sans-serif; margin: 0; }
      p { margin: 0 0 6pt; }
    </style>
  </head>
  <body>
    ${LINES.map((line) => `<p>${line}</p>`).join("\n    ")}
  </body>
</html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html);
  const pdf = await page.pdf({ format: "A4", margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" } });
  await writeFile(new URL("./ivan-petrov-cv.pdf", import.meta.url), pdf);
} finally {
  await browser.close();
}
