import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PdfDropzone } from "./pdf-dropzone";

const pdf = new File([new Uint8Array(1_500)], "jane.pdf", { type: "application/pdf" });

function dragEvent(type: "dragEnter" | "dragOver" | "drop", target: Element, files: File[]) {
  const event = createEvent[type](target);
  Object.defineProperty(event, "dataTransfer", {
    value: { files, types: ["Files"], dropEffect: "none" },
  });
  return event;
}

function renderDropzone(file: File | null = null) {
  const onFileChange = vi.fn();
  render(<PdfDropzone id="cv-file" file={file} onFileChange={onFileChange} />);
  const input = document.getElementById("cv-file") as HTMLInputElement;
  const zone = input.closest("label") as HTMLLabelElement;
  return { onFileChange, input, zone };
}

describe("PdfDropzone", () => {
  it("accepts a dropped file and highlights while dragging", () => {
    const { onFileChange, zone } = renderDropzone();

    fireEvent(zone, dragEvent("dragEnter", zone, [pdf]));
    expect(screen.getByText("Drop your PDF here")).toBeInTheDocument();

    const drop = dragEvent("drop", zone, [pdf]);
    fireEvent(zone, drop);

    expect(drop.defaultPrevented).toBe(true);
    expect(onFileChange).toHaveBeenCalledWith(pdf);
    expect(screen.queryByText("Drop your PDF here")).not.toBeInTheDocument();
  });

  it("opens the native picker from the keyboard-focusable file input", async () => {
    const user = userEvent.setup();
    const { onFileChange, input } = renderDropzone();

    await user.upload(input, pdf);

    expect(onFileChange).toHaveBeenCalledWith(pdf);
    // Reset, so picking the same file again still fires `change`.
    expect(input.value).toBe("");
  });

  it("shows the chosen file and removes it, keeping focus on the picker", async () => {
    const user = userEvent.setup();
    const { onFileChange, input } = renderDropzone(pdf);

    expect(screen.getByText("jane.pdf")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove jane.pdf" }));

    expect(onFileChange).toHaveBeenCalledWith(null);
    expect(input).toHaveFocus();
  });

  it("stops a file dropped next to the zone from navigating away", () => {
    renderDropzone();
    const drop = dragEvent("drop", document.body, [pdf]);
    fireEvent(window, drop);
    expect(drop.defaultPrevented).toBe(true);
  });
});
