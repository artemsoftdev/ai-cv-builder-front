import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { removeWithUndo } from "./remove-with-undo";

vi.mock("sonner", () => ({ toast: vi.fn() }));

type Item = { id: string };

// A list with useFieldArray's remove/insert semantics.
function list(...ids: string[]) {
  let items: Item[] = ids.map((id) => ({ id }));
  return {
    items: () => items,
    ids: () => items.map((item) => item.id),
    remove: (index: number) => {
      items = items.filter((_, i) => i !== index);
    },
    insert: (index: number, item: Item) => {
      items = [...items.slice(0, index), item, ...items.slice(index)];
    },
    replace: (...next: string[]) => {
      items = next.map((id) => ({ id }));
    },
  };
}

const undoOf = (call: number) => () => {
  const action = vi.mocked(toast).mock.calls[call]?.[1]?.action as { onClick: () => void } | undefined;
  action?.onClick();
};

beforeEach(() => {
  vi.mocked(toast).mockClear();
});

describe("removeWithUndo", () => {
  it("removes the entry and puts it back where it was", () => {
    const entries = list("a", "b", "c");

    removeWithUndo({ index: 1, ...entries, message: "Position removed" });
    expect(entries.ids()).toEqual(["a", "c"]);
    expect(toast).toHaveBeenCalledWith("Position removed", expect.anything());

    undoOf(0)();
    expect(entries.ids()).toEqual(["a", "b", "c"]);
  });

  it("returns in front of the same neighbour after other removals", () => {
    const entries = list("a", "b", "c", "d");

    removeWithUndo({ index: 2, ...entries, message: "removed c" });
    removeWithUndo({ index: 0, ...entries, message: "removed a" });
    undoOf(0)();

    expect(entries.ids()).toEqual(["b", "c", "d"]);
  });

  it("does nothing when the entry is already back, rather than duplicating its id", () => {
    const entries = list("a", "b");

    removeWithUndo({ index: 0, ...entries, message: "removed" });
    // A conflict reload brought the newer server version, which still has it.
    entries.replace("a", "b");
    undoOf(0)();

    expect(entries.ids()).toEqual(["a", "b"]);
  });
});
