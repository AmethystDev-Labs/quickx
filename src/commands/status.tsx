import React from "react";
import { Box, Text, useApp } from "ink";
import { Command } from "commander";

import type { QuickxApi } from "../api.js";
import { maskKey } from "../lib/utils.js";
import { renderOnce } from "../lib/render-once.js";
import type { StatusInfo } from "../types.js";

function StatusOutput({ info }: { info: StatusInfo }): React.JSX.Element {
  const { exit } = useApp();

  React.useEffect(() => {
    exit();
  }, []);

  return (
    <Box flexDirection="column">
      <Text bold color="cyanBright">
        quickx status
      </Text>
      <Text>{"─".repeat(48)}</Text>
      <Text>Config file  : {info.configFile}</Text>
      <Text>Codex config : {info.codexConfigFile}</Text>
      <Text>Auth file    : {info.authFile}</Text>
      <Text>Active       : {info.activeProfile || "(none)"}</Text>
      <Text>Logged in    : {info.loggedInEmail || "(none)"}</Text>
      {info.profiles.length === 0 ? (
        <Text color="gray">
          {"\n"}No profiles yet. Run `quickx config add` or `quickx config login`.
        </Text>
      ) : (
        info.profiles.map((p) => (
          <Box key={p.name} flexDirection="column" marginTop={1}>
            <Text bold>
              {p.displayName} ({p.name})
              {p.name === info.activeProfile ? " ✓" : ""}
            </Text>
            <Text>{"─".repeat(40)}</Text>
            <Text>  Base URL   : {p.baseUrl || "(none)"}</Text>
            <Text>  Model      : {p.model || "(none)"}</Text>
            <Text>  Wire API   : {p.wireApi || "(none)"}</Text>
            <Text>  Auth       : {p.authMethod || "(none)"}</Text>
            <Text>  API Key    : {maskKey(p.apiKey)}</Text>
          </Box>
        ))
      )}
    </Box>
  );
}

export function makeStatusCommand(api: QuickxApi): Command {
  return new Command("status")
    .description("Show current quickx and Codex state")
    .action(async () => {
      await renderOnce(<StatusOutput info={api.status()} />);
    });
}
