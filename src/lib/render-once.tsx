import React from "react";
import { render } from "ink";

/**
 * Render an Ink element once, wait for it to exit, then return.
 * The component must call `useApp().exit()` when it's done rendering.
 * Rejects if the component calls `exit(error)`, allowing Commander's
 * error handler to set a non-zero exit code.
 */
export async function renderOnce(element: React.JSX.Element): Promise<void> {
  const { waitUntilExit } = render(element);
  await waitUntilExit();
}
