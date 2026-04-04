import React from "react";
import { Box, Text } from "ink";

interface LoginDraft {
  name: string;
  method: "browser" | "device";
}

interface LoginFormProps {
  draft: LoginDraft;
  fieldIndex: number;
}

export function LoginForm({ draft, fieldIndex }: LoginFormProps): React.JSX.Element {
  return (
    <Box borderStyle="round" borderColor="yellow" paddingX={1} flexDirection="column">
      <Text bold>Codex Login</Text>
      <Text color={fieldIndex === 0 ? "greenBright" : undefined}>
        {`${fieldIndex === 0 ? ">" : " "} Name        : ${draft.name || "(auto)"}`}
      </Text>
      <Text color={fieldIndex === 1 ? "greenBright" : undefined}>
        {`${fieldIndex === 1 ? ">" : " "} Method      : ${draft.method}`}
      </Text>
    </Box>
  );
}
