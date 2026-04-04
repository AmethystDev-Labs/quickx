import React from "react";
import { Box, Text, useApp } from "ink";
import { Command } from "commander";

import type { QuickxApi } from "../../api.js";
import { renderOnce } from "../../lib/render-once.js";
import type { ListProfilesResult } from "../../types.js";

function ProfileListOutput({ result }: { result: ListProfilesResult }): React.JSX.Element {
  const { exit } = useApp();

  React.useEffect(() => {
    exit();
  }, []);

  if (result.profiles.length === 0) {
    return (
      <Text color="gray">
        No profiles yet. Run `quickx config add` or `quickx config login`.
      </Text>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>
        {"NAME".padEnd(24)} {"AUTH".padEnd(10)} {"MODEL".padEnd(20)} DISPLAY
      </Text>
      <Text>{"─".repeat(80)}</Text>
      {result.profiles.map((p) => (
        <Text
          key={p.name}
          color={p.name === result.activeProfile ? "greenBright" : undefined}
        >
          {p.name.padEnd(24)} {p.authMethod.padEnd(10)}{" "}
          {(p.model || "(none)").slice(0, 20).padEnd(20)} {p.displayName}
          {p.name === result.activeProfile ? " ✓" : ""}
        </Text>
      ))}
    </Box>
  );
}

export function makeListCommand(api: QuickxApi): Command {
  return new Command("list")
    .description("List saved profiles")
    .action(async () => {
      await renderOnce(<ProfileListOutput result={api.listProfiles()} />);
    });
}
