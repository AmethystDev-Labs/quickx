import React from "react";
import { Box, Text, useApp } from "ink";
import { Command } from "commander";

import type { QuickxApi } from "../../api.js";
import { messageOf } from "../../lib/utils.js";
import { renderOnce } from "../../lib/render-once.js";
import { getTemplateSetup } from "../../lib/templates.js";
import type { Template } from "../../types.js";

function TemplatePreviewOutput({
  api,
  idOrUrl,
}: {
  api: QuickxApi;
  idOrUrl: string;
}): React.JSX.Element {
  const { exit } = useApp();
  const [data, setData] = React.useState<{
    template: Template;
    placeholders: ReturnType<typeof getTemplateSetup>["placeholders"];
  } | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    async function run() {
      try {
        const template = await api.previewTemplate(idOrUrl);
        const setup = getTemplateSetup(template);
        setData({ template, placeholders: setup.placeholders });
        exit();
      } catch (err) {
        setError(messageOf(err));
        exit(new Error(messageOf(err)));
      }
    }
    void run();
  }, []);

  if (error) return <Text color="redBright">{error}</Text>;
  if (!data) return <Text color="gray">Fetching template…</Text>;

  const { template, placeholders } = data;

  return (
    <Box flexDirection="column">
      <Text>{"ID".padEnd(12)}: {template.id}</Text>
      <Text>{"Name".padEnd(12)}: {template.displayName}</Text>
      <Text>{"Scope".padEnd(12)}: {template.scope.join(", ") || "-"}</Text>
      <Text>{"Base URL".padEnd(12)}: {template.baseUrl || "-"}</Text>
      <Text>{"Model".padEnd(12)}: {template.model || "-"}</Text>
      <Text>{"Wire API".padEnd(12)}: {template.wireApi || "-"}</Text>
      <Text>{"Auth Method".padEnd(12)}: {template.authMethod || "-"}</Text>
      {template.docsUrl ? (
        <Text>{"Docs".padEnd(12)}: {template.docsUrl}</Text>
      ) : null}
      {placeholders.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Dynamic fields:</Text>
          {placeholders.map((p) => (
            <Text key={p.full}>
              {"  "}
              {p.question}
              {p.defaultValue ? ` [default: ${p.defaultValue}]` : " (required)"}
            </Text>
          ))}
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text color="gray">
          Run `quickx config add --from-template {template.id} {"<name>"}` to create a profile.
        </Text>
      </Box>
    </Box>
  );
}

export function makePreviewCommand(api: QuickxApi): Command {
  return new Command("preview")
    .argument("<id-or-url>", "Template ID or raw YAML URL")
    .description("Preview a provider template")
    .action(async (idOrUrl: string) => {
      await renderOnce(<TemplatePreviewOutput api={api} idOrUrl={idOrUrl} />).catch(
        () => process.exit(1),
      );
    });
}
