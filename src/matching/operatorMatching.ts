import type { MatchResult, ParsedFile } from "../types";

const comparisonOperators = new Set<string>(['<=', '>=', '=', '<', '>', '!']);

export function matchFromOperators(parsedFile: ParsedFile, lineNum: number): MatchResult[] {
  const results: MatchResult[] = [];
  (parsedFile.operatorTokens.get(lineNum) ?? []).filter(o => comparisonOperators.has(o.token)).forEach(_operator => {
    // find the parsedWord on either side
    // if the parsedWord on both sides is known, exit (can add diagnostic if type mismatch later)
    // if one of the parsedWords was not matched, see if the unmatched word qualifies to get matched to the other sides comparisonType
    //  - qualifies means...? any unmatched word?
    // from the known matche, get the comparisonType (priority identifier > matchType)
    // make a match for the unknown parsed word setting it to the matchType for that comparisonType

  });
  return results;
}