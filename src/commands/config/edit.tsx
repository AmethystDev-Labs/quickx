import React from "react";
import { Text, useApp } from "ink";
import { Command } from "commander";

import type { QuickxApi } from "../../api.js";
import { messageOf } from "../../lib/utils.js";
import { renderOnce } from "../../lib/render-once.js";

function EditOutput({
  result,
  error,
  reapplied,
}: {
  result?: string;
  error?: string;
  reapplied?: boolean;
}): React.JSX.Element {
  const { exit } = useApp();

  React.useEffect(() => {
    exit(error ? new Error(error) : undefined);
  }, []);

  if (error) return <Text color="redBright">{error}</Text>;
  return (
    <Text>
      Profile "{result}" updated{reapplied ? " and reapplied" : ""}.
    </Text>
  );
}

type EditOptions = {
  displayName?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  wireApi?: string;
  authMethod?: string;
  reasoningEffort?: string;
  modelVerbosity?: string;
};

export function makeEditCommand(api: QuickxApi): Command {
  return new Command("edit")
    .argument("<name>")
    .description("Edit an existing profile (only flags you pass are changed)")
    .option("--display-name <name>", "Human-readable label")
    .option("--base-url <url>", "Provider API base URL")
    .option("--api-key <key>", "API key")
    .option("--model <model>", "Default model")
    .option("--wire-api <api>", "Wire API (responses or chat)")
    .option("--auth-method <method>", "Auth method (api_key or chatgpt)")
    .option("--reasoning-effort <level>", "Codex reasoning effort")
    .option("--model-verbosity <level>", "Codex model verbosity")
    .action(async (name: string, options: EditOptions) => {
      let result: string | undefined;
      let error: string | undefined;
      let reapplied = false;

      try {
        const existing = api.listProfiles().profiles.find((p) => p.name === name);
        if (!existing) throw new Error(`No profile named "${name}"`);

        const updated = api.updateProfile({
          name,
          displayName: options.displayName ?? existing.displayName,
          baseUrl: options.baseUrl ?? existing.baseUrl,
          apiKey: options.apiKey ?? existing.apiKey,
          model: options.model ?? existing.model,
          wireApi: options.wireApi ?? existing.wireApi,
          authMethod: options.authMethod ?? existing.authMethod,
          reasoningEffort: options.reasoningEffort ?? existing.reasoningEffort,
          modelVerbosity: options.modelVerbosity ?? existing.modelVerbosity,
        });

        if (api.listProfiles().activeProfile === updated.name) {
          api.useProfile(updated.name);
          reapplied = true;
        }

        result = updated.name;
      } catch (err) {
        error = messageOf(err);
      }

      await renderOnce(
        <EditOutput result={result} error={error} reapplied={reapplied} />,
      ).catch(() => process.exit(1));
    });
}
