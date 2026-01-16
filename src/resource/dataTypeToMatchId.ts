import { getAllMatchTypes, getMatchTypeById, SKIP } from "../matching/matchType";
import type { MatchType } from "../types";

const keywordToId: Record<string, string> = {};

getAllMatchTypes().forEach(match => {
  for (const keyword of (match.types || [])) {
    keywordToId[keyword] = match.id;
  }
});

export function dataTypeToMatchId(keyword: string): string {
  return keywordToId[keyword] || SKIP.id;
}

export function dataTypeToMatchType(keyword: string): MatchType {
  return getMatchTypeById(dataTypeToMatchId(keyword))!;
}
