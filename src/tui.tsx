import React from "react";
import { render } from "ink";

import { QuickxApi } from "./api.js";
import { App } from "./components/App.js";

export async function runInkTui(api: QuickxApi): Promise<void> {
  const instance = render(<App api={api} />);
  await instance.waitUntilExit();
}
