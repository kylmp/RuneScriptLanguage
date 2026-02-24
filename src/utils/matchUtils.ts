import type { Uri } from 'vscode';
import type { MatchType, ParsedWord, MatchContext, DataRange, FileInfo } from '../types';
import { WORD_REGEX } from '../enum/regex';
import { getAllMatchTypes, UNKNOWN } from '../matching/matchType';
import { getFileInfo } from './fileUtils';

export function getWords(lineText: string, wordPattern: RegExp = WORD_REGEX): ParsedWord[] {
  return [...lineText.matchAll(wordPattern)].map((wordMatch, index) => {
    return { 
      value: wordMatch[0]!, 
      start: wordMatch.index!, 
      end: wordMatch.index! + wordMatch[0]!.length - 1, 
      index,
      inString: false,
      inInterpolation: false,
      parenDepth: -1,
      braceDepth: -1,
      callName: undefined,
      callNameIndex: undefined,
      paramIndex: undefined
     };
  });
}

export function getWordAtIndex(words: ParsedWord[], index: number): ParsedWord | undefined {
  if (words.length < 1) return undefined;
  let prev: ParsedWord | undefined;
  for (let i = words.length - 1; i >= 0; i--) {
    if (index <= words[i].end) prev = words[i];
    else break;
  }
  return (prev && prev.start <= index && prev.end >= index) ? prev : undefined;
}

export function expandCsvKeyObject<T>(obj: Record<string, T>): Record<string, T> {
  let keys = Object.keys(obj);
  for (let i = 0; i < keys.length; ++i) {
    let key = keys[i];
    let subkeys = key.split(/,\s?/);
    let target = obj[key];
    delete obj[key];
    subkeys.forEach(k => obj[k] = target);
  }
  return obj;
}

/**
 * Builds the match context needed for processing a word thru the matching engine
 * @param uri The file uri for the word being matched
 * @param fileInfo The file info for the word being matched (use getFileInfo() helper) 
 * @param words The parsed words on the line of the word being matched
 * @param lineText The text of the line that the word is on
 * @param lineNum The line number of the line that the word is on
 * @param wordIndex The index of the word we are matching, that is the index of the parsed word on that line
 * @returns The constructed matchContext
 */
export function buildMatchContext(uri: Uri, words: ParsedWord[], lineText: string, lineNum: number, wordIndex: number, fileInfo?: FileInfo): MatchContext {
  return {
    words: words,
    uri: uri,
    line: { text: lineText, number: lineNum },
    file: fileInfo ?? getFileInfo(uri),
    matchType: UNKNOWN,
    declaration: false,
    word: words[wordIndex],
    lineIndex: words[wordIndex].start,
    prevWord: (wordIndex === 0) ? undefined : words[wordIndex - 1],
    prevChar: lineText.charAt(words[wordIndex].start - 1),
    nextChar: lineText.charAt(words[wordIndex].end + 1),
  };
}

export function reference(type: MatchType, context: MatchContext): void {
  context.matchType = type;
  context.declaration = false;
}

export function declaration(type: MatchType, context: MatchContext): void {
  context.matchType = type;
  context.declaration = true;  
}

export function addExtraData(context: MatchContext, extraData: Record<string, any>): void {
  context.extraData = extraData;
}

/**
 * Binary search to find the match of a data range list at the index provided, if there is one
 * @param index Index of the item you are looking for
 * @param items List of the DataRanges which hold the data being retrieved
 * @returns The data of the DataRange, if a match is found
 */
export function findMatchInRange<T>(index: number, items?: DataRange<T>[]): DataRange<T> | undefined {
  if (!items) return undefined;
  let lo = 0;
  let hi = items.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const item = items[mid];
    if (index < item.start) hi = mid - 1;
    else if (index > item.end) lo = mid + 1;
    else return item;
  }
  return undefined;
}

export function resolveCallableMatchTypes(): string[] {
  return getAllMatchTypes().filter(matchType => matchType.callable).map(matchType => matchType.id);
}
