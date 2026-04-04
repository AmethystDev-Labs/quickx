import { Command } from "commander";

import type { QuickxApi } from "../../api.js";
import { makeListCommand } from "./list.js";
import { makePreviewCommand } from "./preview.js";

export function makeTemplatesCommand(api: QuickxApi): Command {
  const templates = new Command("templates").description(
    "Browse and preview provider templates",
  );

  templates.addCommand(makeListCommand(api));
  templates.addCommand(makePreviewCommand(api));

  return templates;
}
