import type { Uri } from 'vscode';
import type { MatchContext, MatchResult, ParsedWord } from '../types';
import { CATEGORY, COMPONENT, DBCOLUMN, DBROW, DBTABLE, MODEL, OBJ, SKIP, UNKNOWN } from './matchType';
import { buildMatchContext } from '../utils/matchUtils';
import { LOC_MODEL_REGEX, TRIGGER_DEFINITION_REGEX } from '../enum/regex';
import { packMatcher } from './matchers/packMatcher';
import { regexWordMatcher } from './matchers/regexWordMatcher';
import { commandMatcher } from './matchers/commandMatcher';
import { matchLocalVar } from './matchers/localVarMatcher';
import { prevCharMatcher } from './matchers/prevCharMatcher';
import { triggerMatcher } from './matchers/triggerMatcher';
import { configMatcher } from './matchers/configMatcher';
import { switchCaseMatcher } from './matchers/switchCaseMatcher';
import { parametersMatcher } from './matchers/parametersMatcher';
import { configDeclarationMatcher } from './matchers/configDeclarationMatcher';
import { getFileInfo } from '../utils/fileUtils';
import { getBlockScopeIdentifier, processMatch } from '../cache/activeFileCache';
import { columnDeclarationMatcher } from './matchers/columnDeclarationMatcher';
import { put, putReference } from '../cache/identifierCache';
import { constDeclarationMatcher } from './matchers/constMatcher';

export const enum Engine {
  Config = 'config',
  Runescript = 'runescript',
}

const engines = {
  [Engine.Config]: {
    declarationMatchers: [
      configDeclarationMatcher,
      columnDeclarationMatcher,
      constDeclarationMatcher,
    ].slice().sort((a, b) => a.priority - b.priority),
    fullMatchers: [
      packMatcher,
      regexWordMatcher,
      prevCharMatcher,
      configMatcher,
      configDeclarationMatcher,
      columnDeclarationMatcher,
      constDeclarationMatcher,
    ].slice().sort((a, b) => a.priority - b.priority),
  },
  [Engine.Runescript]: {
    declarationMatchers: [
      commandMatcher,
      triggerMatcher,
    ].slice().sort((a, b) => a.priority - b.priority),
    fullMatchers: [
      regexWordMatcher,
      commandMatcher,
      matchLocalVar,
      prevCharMatcher,
      triggerMatcher,
      switchCaseMatcher,
      parametersMatcher,
    ].slice().sort((a, b) => a.priority - b.priority),
  }
} as const

/**
 * Finds all of the matches in a file and caches the matches/identifiers found
 * @param uri File uri to be matched
 * @param parsedFile The parsed file to be matched
 * @param lines The file lines to be matched
 * @param declarationsOnly whether only declarations should be matched (default value = false)
 * @param engineOverride explicity define the matching engine to use (derived from file type if not provided)
 * @returns An array of all the matchResults in the file
 */
export function matchFile(uri: Uri, parsedFile: Map<number, ParsedWord[]>, lines: string[], declarationsOnly = false, engineOverride?: Engine): MatchResult[] {
  const fileMatches: MatchResult[] = [];
  const fileInfo = getFileInfo(uri);
  const isRunescript = fileInfo.type === 'rs2';
  const engine = engineOverride ?? isRunescript ? Engine.Runescript : Engine.Config;
  let parsedLines = Array.from(parsedFile, ([lineNum, parsedWords]) => ({ lineNum, parsedWords }));

  // Process definition lines first if runescript file, because scripts can be refereneced ahead of their declaration
  if (isRunescript) {
    const isTriggerLine = (line: string) => line.startsWith('[') && TRIGGER_DEFINITION_REGEX.test(line);
    const triggerLines: typeof parsedLines = [];
    const otherLines: typeof parsedLines = [];
    for (const line of parsedLines) {
      if (isTriggerLine(lines[line.lineNum])) triggerLines.push(line);
      else otherLines.push(line);
    }
    parsedLines = [...triggerLines, ...otherLines];
  }

  // Iterate thru each line 
  for (const { lineNum, parsedWords } of parsedLines) {
    const lineText = lines[lineNum];
    // Iterate thru each word on the line
    for (let wordIndex = 0; wordIndex < parsedWords.length; wordIndex++) {
      const match = matchWord(buildMatchContext(uri, parsedWords, lineText, lineNum, wordIndex, fileInfo), engine, declarationsOnly);
      if (match) {
        processMatch(match);
        fileMatches.push(match);
        if (!match.context.matchType.cache) continue;
        if (match.context.declaration) {
          const startIndex = Math.max(lineNum - 1, 0);
          put(match.word, match.context, { lines: lines.slice(startIndex), start: lineNum - startIndex });
        } else {
          let index = match.context.word.start;
          if (!match.context.originalWord && match.word.indexOf(':') > 0) index += match.word.indexOf(':') + 1;
          putReference(match.word, match.context, uri, lineNum, index);
        }
      }
    }
  }
  return fileMatches;
}

/**
 * Return the match results for a single word
 * @param uri uri of the file the match is being found in
 * @param parsedLineWords the parsed words on the line the match is being found on
 * @param lineText the text of the line the match is being found on
 * @param lineNum the line number within the file the match is being found on
 * @param wordIndex the index of the *parsed word* that is trying to be matched
 * @param declarationsOnly whether only declarations should be matched (default value = false)
 * @param engineOverride explicity define the matching engine to use (derived from file type if not provided)
 * @returns the resolved matchResult, if any
 */
export function singleWordMatch(uri: Uri, parsedLineWords: ParsedWord[], lineText: string, lineNum: number, wordIndex: number, declarationsOnly = false, engineOverride?: Engine): MatchResult | undefined {
  if (wordIndex < 0) return undefined;
  const fileInfo = getFileInfo(uri);
  const engine = engineOverride ?? fileInfo.type === 'rs2' ? Engine.Runescript : Engine.Config;
  return matchWord(buildMatchContext(uri, parsedLineWords, lineText, lineNum, wordIndex, fileInfo), engine, declarationsOnly);
}

/**
 * Runs a word thru the matching engine to try to find a match, short circuits early if a match is made
 * @param context The match context needed for proper matching, can use buildMatchContext() helper function
 * @param engine The matching engine to use for matching
 * @param declarationsOnly Whether to only use the declaration matchers (default value = false)
 * @returns A matchResult if a match is made, undefined otherwise
 */
function matchWord(context: MatchContext, engine: Engine, declarationsOnly = false): MatchResult | undefined {
  if (!context.word || context.word.value === 'null') {
    return undefined;
  }
  const matchers = declarationsOnly ? engines[engine].declarationMatchers : engines[engine].fullMatchers;
  for (const matcher of matchers) {
    matcher.fn(context);
    if (context.matchType.id !== UNKNOWN.id) {
      return response(context);
    }
  }
}

/**
* Build the response object for a match response
*/
function response(ctx?: MatchContext): MatchResult | undefined {
  if (!ctx || ctx.matchType.id === SKIP.id) {
    return undefined;
  }
  const context = { ...ctx, word: { ...ctx.word } }; // shallow clone + deep clone word since we modify it
  if (context.matchType.id === COMPONENT.id && !context.word.value.includes(':')) {
    context.originalWord = context.word.value;
    context.word.value = `${context.file.name}:${context.word.value}`;
  }
  if (context.matchType.id === DBCOLUMN.id && !context.word.value.includes(':')) {
    const requiredType = context.file.type === 'dbtable' ? DBTABLE.id : DBROW.id;
    const iden = getBlockScopeIdentifier(context.line.number);
    if (!iden || iden.matchId !== requiredType) {
      return undefined;
    }
    const tableName = (context.file.type === 'dbrow') ? iden.extraData?.table : iden.name;
    context.originalWord = context.word.value;
    context.word.value = `${tableName}:${context.word.value}`;
  }
  if (context.matchType.id === OBJ.id && context.word.value.startsWith('cert_')) {
    context.originalWord = context.word.value;
    context.word.value = context.word.value.substring(5);
    context.word.start = context.word.start + 5;
    context.originalPrefix = 'cert_';
    context.cert = true;
  }
  if (context.matchType.id === CATEGORY.id && context.word.value.startsWith('_')) {
    context.originalWord = context.word.value;
    context.word.value = context.word.value.substring(1);
    context.word.start = context.word.start + 1;
    context.originalPrefix = '_';
  }
  // If model match type, determine if it is a loc model and if so remove the suffix part (_0 or _q, etc...)
  if (context.matchType.id === MODEL.id && LOC_MODEL_REGEX.test(context.word.value)) {
    const lastUnderscore = context.word.value.lastIndexOf("_");
    context.originalSuffix = context.word.value.slice(lastUnderscore);
    context.originalWord = context.word.value;
    context.word.value = context.word.value.slice(0, lastUnderscore);
  }
  return { context: context, word: context.word.value };
}
