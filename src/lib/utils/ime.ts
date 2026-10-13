import type { KeyboardEvent } from "react";

// Safari reports the Enter that confirms an IME conversion with isComposing=false but keyCode 229.
export function isComposing(event: KeyboardEvent): boolean {
  return event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;
}
