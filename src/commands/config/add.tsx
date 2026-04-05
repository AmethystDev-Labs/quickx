import React from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Command } from "commander";

import type { QuickxApi } from "../../api.js";
import type { TemplatePlaceholder } from "../../types.js";
import { messageOf, maskKey } from "../../lib/utils.js";
import { renderOnce } from "../../lib/render-once.js";

// ---------------------------------------------------------------------------
// Interactive form for --from-template
// ---------------------------------------------------------------------------

function TemplateAddOutput({
  api,
  templateId,
  profileName: initialName,
}: {
  api: QuickxApi;
  templateId: string;
  profileName: string;
}): React.JSX.Element {
  const { exit } = useApp();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState<string | null>(null);

  const [placeholders, setPlaceholders] = React.useState<TemplatePlaceholder[]>([]);
  const [displayName, setDisplayName] = React.useState("");
  const [profileName, setProfileName] = React.useState(initialName);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [fieldIndex, setFieldIndex] = React.useState(0);

  // Keep a ref so useInput closures always read fresh state
  const stateRef = React.useRef({ profileName, answers, fieldIndex, placeholders, displayName });
  stateRef.current = { profileName, answers, fieldIndex, placeholders, displayName };

  // Load template on mount
  React.useEffect(() => {
    async function load() {
      try {
        const template = await api.previewTemplate(templateId);
        const setup = await api.getTemplateSetup(templateId);
        const initial: Record<string, string> = {};
        for (const p of setup.placeholders) initial[p.question] = p.defaultValue;
        setDisplayName(template.displayName || templateId);
        setPlaceholders(setup.placeholders);
        setAnswers(initial);
        setProfileName((n) => n || template.id);
        setLoading(false);
      } catch (err) {
        setError(messageOf(err));
        exit(new Error(messageOf(err)));
      }
    }
    void load();
  }, []);

  const totalFields = 1 + placeholders.length; // 0 = profile name, 1..n = placeholders

  const submit = React.useCallback(async () => {
    const c = stateRef.current;
    try {
      const created = await api.createProfileFromTemplate(
        c.profileName.trim() || templateId,
        templateId,
        c.answers,
      );
      setDone(created.name);
      exit();
    } catch (err) {
      setError(messageOf(err));
      exit(new Error(messageOf(err)));
    }
  }, [api, templateId]);

  useInput((input, key) => {
    if (loading || done) return;
    const c = stateRef.current;
    const ctrl = Boolean(key.ctrl);

    if (key.upArrow) {
      setFieldIndex((i) => (i - 1 + totalFields) % totalFields);
      return;
    }
    if (key.downArrow || key.return) {
      const next = (c.fieldIndex + 1) % totalFields;
      // Ctrl+S or Enter on the last field → submit
      if ((ctrl && input === "s") || (key.return && c.fieldIndex === totalFields - 1)) {
        void submit();
        return;
      }
      setFieldIndex(next);
      return;
    }
    if (ctrl && input === "s") { void submit(); return; }

    if (key.backspace || key.delete) {
      if (c.fieldIndex === 0) {
        setProfileName((n) => n.slice(0, Math.max(0, n.length - 1)));
      } else {
        const ph = c.placeholders[c.fieldIndex - 1];
        if (ph) setAnswers((a) => ({ ...a, [ph.question]: (a[ph.question] ?? "").slice(0, -1) }));
      }
      return;
    }

    if (input && !key.ctrl && !key.meta && /^[\x20-\x7E]$/u.test(input)) {
      if (c.fieldIndex === 0) {
        setProfileName((n) => n + input);
      } else {
        const ph = c.placeholders[c.fieldIndex - 1];
        if (ph) setAnswers((a) => ({ ...a, [ph.question]: (a[ph.question] ?? "") + input }));
      }
    }
  });

  if (error) return <Text color="redBright">{error}</Text>;

  if (done) {
    return (
      <Box flexDirection="column">
        <Text>Profile "<Text color="greenBright">{done}</Text>" added from template "{templateId}".</Text>
        <Text color="gray">Run `quickx use {done}` to activate it.</Text>
      </Box>
    );
  }

  if (loading) return <Text color="gray">Fetching template…</Text>;

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="magenta" paddingX={1} flexDirection="column">
        <Text bold>Create profile from template: <Text color="magentaBright">{displayName}</Text></Text>
        <Text color="gray">  Up/Down move field  ·  Ctrl+S or Enter on last field to confirm</Text>
        <Text>{""}</Text>

        {/* Field 0: profile name */}
        <Text color={fieldIndex === 0 ? "greenBright" : undefined}>
          {`${fieldIndex === 0 ? ">" : " "} ${"Profile name".padEnd(28)} : ${profileName || "(defaults to template id)"}`}
        </Text>

        {/* Fields 1..n: placeholders */}
        {placeholders.map((ph, i) => {
          const fi = i + 1;
          const focused = fi === fieldIndex;
          const raw = answers[ph.question] ?? "";
          const shown = ph.secret ? maskKey(raw) : raw;
          const display = shown || (focused ? "" : ph.defaultValue ? `(default: ${ph.defaultValue})` : "(required)");
          return (
            <Text key={ph.full} color={focused ? "greenBright" : undefined}>
              {`${focused ? ">" : " "} ${ph.question.slice(0, 28).padEnd(28)} : ${display}`}
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Simple output for manual add (no template)
// ---------------------------------------------------------------------------

function AddOutput({
  run,
}: {
  run: () => Promise<{ name: string }>;
}): React.JSX.Element {
  const { exit } = useApp();
  const [result, setResult] = React.useState<{ name: string } | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    run()
      .then((r) => { setResult(r); exit(); })
      .catch((err) => { setError(messageOf(err)); exit(new Error(messageOf(err))); });
  }, []);

  if (error) return <Text color="redBright">{error}</Text>;
  if (!result) return <Text color="gray">Adding profile…</Text>;
  return (
    <Box flexDirection="column">
      <Text>Profile "<Text color="greenBright">{result.name}</Text>" added.</Text>
      <Text color="gray">Run `quickx use {result.name}` to activate it.</Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

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
      if (options.fromTemplate) {
        await renderOnce(
          <TemplateAddOutput
            api={api}
            templateId={options.fromTemplate}
            profileName={name ?? ""}
          />,
        ).catch(() => process.exit(1));
        return;
      }

      const run = async () => {
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
