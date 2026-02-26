import type { FileInfo, MatchResult, ParsedFile, ParsedWord } from "../types";
import type { Uri } from "vscode";
import { buildMatchContext, reference } from "../utils/matchUtils";
import { getByLineIndex } from "../cache/activeFileCache";
import { dataTypeToMatchType } from "../resource/dataTypeToMatchId";
import { SKIP } from "./matchType";
import type { Type } from "../enum/type";

const comparisonOperators = new Set<string>(['<=', '>=', '=', '<', '>', '!']);

export function matchFromOperators(parsedFile: ParsedFile, lineNum: number, uri: Uri, lineText: string, fileInfo: FileInfo): MatchResult[] {
  const results: MatchResult[] = [];
  const words = parsedFile.parsedWords.get(lineNum) ?? [];
  if (words.length === 0) return results;
  const operators = (parsedFile.operatorTokens.get(lineNum) ?? []).filter(o => comparisonOperators.has(o.token));
  for (const operator of operators) {
    const leftWord = findWordBefore(words, operator.index);
    const rightWord = findWordAfter(words, operator.index + operator.token.length - 1);
    if (!leftWord || !rightWord) continue;

    const leftItem = getByLineIndex(uri, lineNum, leftWord.start);
    const rightItem = getByLineIndex(uri, lineNum, rightWord.start);
    if (leftItem && rightItem) continue;

    const knownItem = leftItem ?? rightItem;
    const unknownWord = leftItem ? rightWord : leftWord;
    if (!knownItem || unknownWord.inString || unknownWord.inInterpolation) continue;

    const comparisonTypes = knownItem.identifier?.comparisonTypes ?? (knownItem.context.matchType.comparisonType ? [knownItem.context.matchType.comparisonType] : []);
    if (!comparisonTypes || comparisonTypes.length === 0) continue;
    const resolved = resolveComparisonMatchType(comparisonTypes);
    if (!resolved || resolved.noop || resolved.id === SKIP.id) continue;

    const ctx = buildMatchContext(uri, words, lineText, lineNum, unknownWord.index, fileInfo);
    reference(resolved, ctx);
    results.push({ context: ctx, word: ctx.word.value });
  }
  return results;
}

function findWordBefore(words: ParsedWord[], index: number): ParsedWord | undefined {
  for (let i = words.length - 1; i >= 0; i--) {
    if (words[i]!.end < index) return words[i];
  }
  return undefined;
}

function findWordAfter(words: ParsedWord[], index: number): ParsedWord | undefined {
  for (let i = 0; i < words.length; i++) {
    if (words[i]!.start > index) return words[i];
  }
  return undefined;
}

function resolveComparisonMatchType(types: Type[]) {
  if (types.length === 0) return undefined;
  if (types.length === 1) return dataTypeToMatchType(types[0]);
  let resolvedId: string | undefined;
  let resolvedType: any | undefined;
  for (const type of types) {
    const matchType = dataTypeToMatchType(type);
    if (!resolvedId) {
      resolvedId = matchType.id;
      resolvedType = type;
    } else if (resolvedId !== matchType.id) {
      return undefined;
    }
  }
  return resolvedType ? dataTypeToMatchType(resolvedType) : undefined;
}
