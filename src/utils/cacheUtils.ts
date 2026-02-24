import type { Uri } from 'vscode';
import type { FileKey, Identifier, IdentifierKey, MatchType } from '../types';
import { Location, Position, Range } from 'vscode';

export function resolveIdentifierKey(name: string, match: MatchType): IdentifierKey {
  return name + match.id;
}

export function resolveKeyFromIdentifier(iden: Identifier): string {
  return iden.name + iden.matchId;
}

export function resolveFileKey(uri: Uri): FileKey | undefined {
  return uri.fsPath;
}

export function encodeReference(line: number, startIndex: number, endIndex: number): string {
  return `${line}|${startIndex}|${endIndex}`;
}

export function decodeReferenceToLocation(uri: Uri, encodedValue: string): Location | undefined {
  const split = encodedValue.split('|');
  return (split.length !== 3) ? undefined : new Location(uri, new Position(Number(split[0]), Number(split[1])));
}

export function decodeReferenceToRange(encodedValue: string): Range | undefined {
  const split = encodedValue.split('|');
  if (split.length !== 3) {
    return undefined;
  }
  const startPosition = new Position(Number(split[0]), Number(split[1]));
  const wordLength = Number(split[2]) - Number(split[1]);
  return new Range(startPosition, startPosition.translate(0, wordLength + 1));
}

export function getFullName(iden: Identifier): string {
  return iden.cacheKey.slice(0, -iden.matchId.length);
}
