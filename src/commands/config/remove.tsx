import React from "react";
import { Text, useApp } from "ink";
import { Command } from "commander";

import type { QuickxApi } from "../../api.js";
import { messageOf } from "../../lib/utils.js";
import { renderOnce } from "../../lib/render-once.js";

function RemoveOutput({ name, error }: { name: string; error?: string }): React.JSX.Element {
  const { exit } = useApp();

  React.useEffect(() => {
    exit(error ? new Error(error) : undefined);
  }, []);

  if (error) return <Text color="redBright">{error}</Text>;
  return <Text>Profile "{name}" removed.</Text>;
}

export function makeRemoveCommand(api: QuickxApi): Command {
  return new Command("remove")
    .argument("<name>")
    .description("Remove a saved profile")
    .action(async (name: string) => {
      let error: string | undefined;
      try {
        api.removeProfile(name);
      } catch (err) {
        error = messageOf(err);
      }
      await renderOnce(<RemoveOutput name={name} error={error} />).catch(() => process.exit(1));
    });
}
