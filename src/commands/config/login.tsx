import React from "react";
import { Text, useApp } from "ink";
import { Command } from "commander";

import type { QuickxApi } from "../../api.js";
import { messageOf, openBrowser } from "../../lib/utils.js";
import { renderOnce } from "../../lib/render-once.js";

type LoginOptions = { device?: boolean; name?: string };

function LoginOutput({
  api,
  options,
}: {
  api: QuickxApi;
  options: LoginOptions;
}): React.JSX.Element {
  const { exit } = useApp();
  const [lines, setLines] = React.useState<string[]>(["Starting login…"]);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    async function run() {
      const name = options.name ?? "";
      try {
        if (options.device) {
          const pending = await api.loginCodexRequestDevice();
          setLines([
            "Requesting device code…",
            "",
            `1. Open this URL in your browser:\n   ${pending.verificationUrl}`,
            `\n2. Enter this one-time code:\n   ${pending.userCode}`,
            "",
            "Waiting for authentication to complete…",
          ]);
          const created = await api.loginCodexCompleteDevice(pending.handleId, name);
          setLines([
            `✓ Profile "${created.name}" created.`,
            `  Run \`quickx use ${created.name}\` to activate it.`,
          ]);
        } else {
          const pending = await api.loginCodexBrowserStart();
          const opened = openBrowser(pending.authUrl);
          setLines([
            opened ? "Opened your default browser." : `Open this URL:\n  ${pending.authUrl}`,
            "",
            "Waiting for you to complete login in your browser…",
          ]);
          const created = await api.loginCodexBrowserWait(pending.handleId, name);
          setLines([
            `✓ Profile "${created.name}" created.`,
            `  Run \`quickx use ${created.name}\` to activate it.`,
          ]);
        }
        exit();
      } catch (err) {
        setError(messageOf(err));
        exit(new Error(messageOf(err)));
      }
    }
    void run();
  }, []);

  if (error) return <Text color="redBright">{error}</Text>;
  return (
    <>
      {lines.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
    </>
  );
}

export function makeLoginCommand(api: QuickxApi): Command {
  return new Command("login")
    .argument("[name]")
    .description("Log in with ChatGPT/Codex and create a profile")
    .option("--device", "Use device-code flow instead of browser login")
    .action(async (name: string | undefined, options: { device?: boolean }) => {
      await renderOnce(
        <LoginOutput api={api} options={{ ...options, name }} />,
      ).catch(() => process.exit(1));
    });
}
