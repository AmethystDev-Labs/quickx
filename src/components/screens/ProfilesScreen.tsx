import React from "react";
import { Box, Text } from "ink";

import type { CodexProfile } from "../../types.js";
import { maskKey, truncate, pickWindow } from "../../lib/utils.js";

interface ProfilesScreenProps {
  profiles: CodexProfile[];
  activeProfile: string;
  selectedIndex: number;
}

export function ProfilesScreen({
  profiles,
  activeProfile,
  selectedIndex,
}: ProfilesScreenProps): React.JSX.Element {
  const selectedRow = profiles[selectedIndex] ?? null;
  const window = pickWindow(profiles, selectedIndex, 14);

  return (
    <Box gap={1}>
      <Box
        borderStyle="round"
        borderColor="green"
        paddingX={1}
        flexDirection="column"
        width={72}
      >
        <Text bold>Profiles</Text>
        {profiles.length === 0 ? (
          <Text color="gray">No profiles found.</Text>
        ) : (
          window.rows.map((profile, index) => {
            const absolute = window.start + index;
            const marker = absolute === selectedIndex ? ">" : " ";
            const active = profile.name === activeProfile ? "*" : " ";
            const name = truncate(profile.name, 22).padEnd(22, " ");
            const auth = truncate(profile.authMethod, 10).padEnd(10, " ");
            const display = truncate(profile.displayName, 26);

            return (
              <Text
                key={`profile-${profile.name}-${absolute}`}
                color={absolute === selectedIndex ? "greenBright" : undefined}
              >
                {`${marker}${active} ${name} ${auth} ${display}`}
              </Text>
            );
          })
        )}
      </Box>

      <Box
        borderStyle="round"
        borderColor="yellow"
        paddingX={1}
        flexDirection="column"
        width={46}
      >
        <Text bold>Selected</Text>
        {!selectedRow ? (
          <Text color="gray">No profile selected.</Text>
        ) : (
          <>
            <Text>{`Name: ${selectedRow.name}`}</Text>
            <Text>{`Display: ${selectedRow.displayName}`}</Text>
            <Text>{`Base: ${selectedRow.baseUrl || "-"}`}</Text>
            <Text>{`Model: ${selectedRow.model || "-"}`}</Text>
            <Text>{`Wire API: ${selectedRow.wireApi || "-"}`}</Text>
            <Text>{`Auth: ${selectedRow.authMethod || "-"}`}</Text>
            <Text>{`Key: ${maskKey(selectedRow.apiKey)}`}</Text>
          </>
        )}
      </Box>
    </Box>
  );
}
