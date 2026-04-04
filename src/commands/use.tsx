import React from "react";
import { Text, useApp } from "ink";
import { Command } from "commander";

import type { QuickxApi } from "../api.js";
import { messageOf } from "../lib/utils.js";
import { renderOnce } from "../lib/render-once.js";

function UseOutput({ name, error }: { name: string; error?: string }): React.JSX.Element {
  const { exit } = useApp();

  React.useEffect(() => {
    exit(error ? new Error(error) : undefined);
  }, []);

  if (error) return <Text color="redBright">{error}</Text>;
  return <Text>Applied profile "{name}" to ~/.codex/config.toml.</Text>;
}

export function makeUseCommand(api: QuickxApi): Command {
  return new Command("use")
    .argument("<profile-name>")
    .description("Apply a saved profile to ~/.codex/config.toml")
    .action(async (name: string) => {
      let error: string | undefined;
      try {
        api.useProfile(name);
      } catch (err) {
        error = messageOf(err);
      }
      await renderOnce(<UseOutput name={name} error={error} />).catch(() => process.exit(1));
    });
}
