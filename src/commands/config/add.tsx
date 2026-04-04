import React from "react";
import { Text, useApp } from "ink";
import { Command } from "commander";

import type { QuickxApi } from "../../api.js";
import { messageOf } from "../../lib/utils.js";
import { renderOnce } from "../../lib/render-once.js";

function AddOutput({
  run,
}: {
  run: () => Promise<{ name: string; template?: string }>;
}): React.JSX.Element {
  const { exit } = useApp();
  const [result, setResult] = React.useState<{ name: string; template?: string } | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    run()
      .then((r) => {
        setResult(r);
        exit();
      })
      .catch((err) => {
        setError(messageOf(err));
        exit(new Error(messageOf(err)));
      });
  }, []);

  if (error) return <Text color="redBright">{error}</Text>;
  if (!result) return <Text color="gray">Adding profile…</Text>;

  return (
    <>
      <Text>
        Profile "{result.name}" added
        {result.template ? ` from template "${result.template}"` : ""}.
      </Text>
      <Text color="gray">Run `quickx use {result.name}` to activate it.</Text>
    </>
  );
}

type AddOptions = {
  fromTemplate?: string;
  displayName?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  wireApi?: string;
  authMethod?: string;
  reasoningEffort?: string;
  modelVerbosity?: string;
};

export function makeAddCommand(api: QuickxApi): Command {
  return new Command("add")
    .argument("[name]")
    .description("Add a profile (use --from-template for provider presets)")
    .option("--from-template <id>", "Template ID or raw template URL")
    .option("--display-name <name>", "Human-readable label")
    .option("--base-url <url>", "Provider API base URL")
    .option("--api-key <key>", "API key")
    .option("--model <model>", "Default model")
    .option("--wire-api <api>", "Wire API (responses or chat)")
    .option("--auth-method <method>", "Auth method (api_key or chatgpt)")
    .option("--reasoning-effort <level>", "Codex reasoning effort")
    .option("--model-verbosity <level>", "Codex model verbosity")
    .action(async (name: string | undefined, options: AddOptions) => {
      const run = async () => {
        if (options.fromTemplate) {
          const template = await api.previewTemplate(options.fromTemplate);
          const setup = await api.getTemplateSetup(options.fromTemplate);
          const answers: Record<string, string> = {};
          for (const p of setup.placeholders) {
            answers[p.question] = p.defaultValue;
          }
          const created = await api.createProfileFromTemplate(
            name || template.id,
            options.fromTemplate,
            answers,
          );
          return { name: created.name, template: options.fromTemplate };
        }

        const created = api.addProfile({
          name: name || "my-codex",
          displayName: options.displayName,
          baseUrl: options.baseUrl,
          apiKey: options.apiKey,
          model: options.model,
          wireApi: options.wireApi,
          authMethod: options.authMethod,
          reasoningEffort: options.reasoningEffort,
          modelVerbosity: options.modelVerbosity,
        });
        return { name: created.name };
      };

      await renderOnce(<AddOutput run={run} />).catch(() => process.exit(1));
    });
}
