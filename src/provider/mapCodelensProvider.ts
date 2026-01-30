import type { CodeLensProvider, TextDocument } from "vscode";
import { CodeLens, Range } from "vscode";
import { getMapSectionHeaders } from "../core/mapManager";

export const mapCodelensProvider: CodeLensProvider = {
  provideCodeLenses(document: TextDocument): CodeLens[] {
    const sections = getMapSectionHeaders(document);
    if (sections.length < 2) return [];

    const lenses: CodeLens[] = [];
    for (let i = 0; i < sections.length; i++) {
      const current = sections[i]!;
      const next = sections[(i + 1) % sections.length]!;
      const range = new Range(current.line, 0, current.line, 0);
      const lineLabel = next.line + 1;
      const title = next.name === 'MAP'
        ? 'Return to top'
        : `Jump to ${next.name} section (line ${lineLabel})`;
      lenses.push(new CodeLens(range, {
        title,
        command: 'RuneScriptLanguage.jumpToMapSection',
        arguments: [next.line]
      }));
    }
    return lenses;
  }
};
