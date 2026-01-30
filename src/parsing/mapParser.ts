import { Position, Range } from 'vscode';

export type MapEntryKind = 'loc' | 'npc' | 'obj';

export type MapEntry = {
  kind: MapEntryKind;
  line: number;
  level: number;
  x: number;
  z: number;
  id: number;
  extras: number[];
  range: Range;
  idRange: Range;
};

export type MapParseError = {
  line: number;
  message: string;
  range?: Range;
};

export type MapParseResult = {
  entries: MapEntry[];
  errors: MapParseError[];
  sections: Array<{ line: number; name: string }>;
};

const sectionRegex = /^====\s*(\w+)\s*====\s*$/;
const lineRegex = /^(\s*)(\d+)\s+(\d+)\s+(\d+)\s*:\s*(.+)\s*$/;

export function parseMapFile(lines: string[]): MapParseResult {
  const entries: MapEntry[] = [];
  const errors: MapParseError[] = [];
  const sections: Array<{ line: number; name: string }> = [];
  let currentSection: MapEntryKind | undefined;

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum] ?? '';
    const sectionMatch = sectionRegex.exec(line);
    if (sectionMatch) {
      const name = sectionMatch[1]?.toLowerCase();
      sections.push({ line: lineNum, name: (sectionMatch[1] ?? '').toUpperCase() });
      if (name === 'loc' || name === 'npc' || name === 'obj') {
        currentSection = name;
      } else {
        currentSection = undefined;
      }
      continue;
    }

    if (!currentSection) continue;
    if (!line.trim()) continue;

    const match = lineRegex.exec(line);
    if (!match) {
      errors.push({ line: lineNum, message: 'Invalid map line format', range: toRange(lineNum, line) });
      continue;
    }

    const leading = match[1] ?? '';
    const level = parseIntStrict(match[2]);
    const x = parseIntStrict(match[3]);
    const z = parseIntStrict(match[4]);
    if (level === undefined || x === undefined || z === undefined) {
      errors.push({ line: lineNum, message: 'Invalid coordinates', range: toRange(lineNum, line) });
      continue;
    }

    const rhs = match[5] ?? '';
    const rhsTrimmed = rhs.trim();
    const rhsIndex = line.indexOf(rhsTrimmed, leading.length);
    const idMatch = /^(\d+)/.exec(rhsTrimmed);
    const id = parseIntStrict(idMatch?.[1]);
    if (id === undefined) {
      errors.push({ line: lineNum, message: 'Missing or invalid id', range: toRange(lineNum, line) });
      continue;
    }

    const idStart = rhsIndex >= 0 ? rhsIndex : line.indexOf(rhsTrimmed);
    const idLength = idMatch?.[1]?.length ?? 0;
    const idRange = new Range(new Position(lineNum, Math.max(0, idStart)), new Position(lineNum, Math.max(0, idStart + idLength)));

    const parts = rhsTrimmed.split(/\s+/).filter(Boolean);
    const extras: number[] = [];
    for (let i = 1; i < parts.length; i++) {
      const value = parseIntStrict(parts[i]);
      if (value === undefined) {
        errors.push({ line: lineNum, message: 'Invalid extra field', range: toRange(lineNum, line) });
        break;
      }
      extras.push(value);
    }

    entries.push({
      kind: currentSection,
      line: lineNum,
      level,
      x,
      z,
      id,
      extras,
      range: toRange(lineNum, line),
      idRange
    });
  }

  return { entries, errors, sections };
}

function parseIntStrict(value?: string): number | undefined {
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) return undefined;
  return Number(value);
}

function toRange(lineNum: number, line: string): Range {
  return new Range(new Position(lineNum, 0), new Position(lineNum, Math.max(0, line.length)));
}
