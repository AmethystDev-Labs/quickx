import React from "react";
import { Box, Text, useApp } from "ink";
import { Command } from "commander";

import type { QuickxApi } from "../../api.js";
import { messageOf } from "../../lib/utils.js";
import { renderOnce } from "../../lib/render-once.js";
import type { Template } from "../../types.js";

function TemplateListOutput({ api }: { api: QuickxApi }): React.JSX.Element {
  const { exit } = useApp();
  const [templates, setTemplates] = React.useState<Template[] | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    api
      .listTemplates()
      .then((rows) => {
        setTemplates(rows);
        exit();
      })
      .catch((err) => {
        setError(messageOf(err));
        exit(new Error(messageOf(err)));
      });
  }, []);

  if (error) return <Text color="redBright">{error}</Text>;
  if (!templates) return <Text color="gray">Fetching templates…</Text>;
  if (templates.length === 0) return <Text color="gray">No templates found.</Text>;

  return (
    <Box flexDirection="column">
      <Text bold>
        {"ID".padEnd(20)} {"NAME".padEnd(30)} SCOPE
      </Text>
      <Text>{"─".repeat(70)}</Text>
      {templates.map((t) => (
        <Text key={t.id}>
          {t.id.padEnd(20)} {t.displayName.padEnd(30)} {t.scope.join(",")}
        </Text>
      ))}
    </Box>
  );
}

export function makeListCommand(api: QuickxApi): Command {
  return new Command("list")
    .description("List available provider templates")
    .action(async () => {
      await renderOnce(<TemplateListOutput api={api} />).catch(() => process.exit(1));
    });
}
