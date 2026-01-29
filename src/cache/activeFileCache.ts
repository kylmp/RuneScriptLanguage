import type { Position, TextDocument, Uri } from "vscode";
import type { DataRange, Identifier, IdentifierText, Item, MatchResult, MatchType, OperatorToken, ParsedFile, ParsedWord } from "../types";
import { get as getIdentifier } from "./identifierCache";
import { LOCAL_VAR, QUEUE, SKIP, KEYWORD, TRIGGER, UNKNOWN } from "../matching/matchType";
import { decodeReferenceToLocation, resolveFileKey, resolveKeyFromIdentifier } from "../utils/cacheUtils";
import { addReference, buildFromDeclaration } from "../resource/identifierFactory";
import { findMatchInRange } from "../utils/matchUtils";
import { LineReferenceCache } from "./class/LineReferenceCache";
import { CONFIG_DECLARATION_REGEX, QUEUE_REGEX } from "../enum/regex";
import { dataTypeToMatchType } from "../resource/dataTypeToMatchId";
import { isDevMode, logWarning } from "../core/devMode";

/* A cache which holds info about the last processed file, typically the actively open file */

/**
 * Tracks the file that the cache has been built for, used to make sure you're getting the data you expect
 */
let file: string = '';

// ===== CACHE DATA ===== //

/**
 * File matches, keyed by line number
 * The value is an array of a data range containing a match result
 * The data range is the index range on that line of the word the match is for
 */
const fileMatches = new Map<number, DataRange<MatchResult>[]>();

/**
 * File parsed words, keyed by line number
 * The value is an array of parsed words on that line
 */
let parsedWords: Map<number, ParsedWord[]> = new Map();

/**
 * File parsed operator tokens, keyed by line number
 * The value is an array of parsed operator tokens on that line
 */
let operatorTokens: Map<number, OperatorToken[]> = new Map();

// ===== GET DATA ===== //

/**
 * Returns an item at the given position in the given document, if it exists
 * @param document The document to get items for
 * @param position The position (line num + index) to get the item for
 * @returns The item at that positon, if exists
 */
export function getByDocPosition(document: TextDocument, position: Position): Item | undefined {
  return get(document.uri, position.line, position.character);
}

/**
 * Returns an item at the given index of a given line in the file uri, if it exists
 * @param uri The uri of the file to check
 * @param lineNum The line number to search
 * @param lineIndex The index within the line to find the match for
 * @returns The item on that line at that index, if exists
 */
export function getByLineIndex(uri: Uri, lineNum: number, lineIndex: number): Item | undefined {
  return get(uri, lineNum, lineIndex);
}

/**
 * Returns a parsed word at the given position in the given document, if it exists
 * @param document The document to get word for
 * @param position The position (line num + index) to get the word for
 * @returns The word at that positon, if exists
 */
export function getParsedWordByDocPosition(position: Position): ParsedWord | undefined {
  const lineWords = parsedWords.get(position.line);
  if (lineWords) {
    return findMatchInRange(position.character, lineWords.map(word => ({start: word.start, end: word.end, data: word})))?.data;
  }
}

/**
 * Returns a parsed word at the given position in the given document, if it exists
 * @param document The document to get word for
 * @param position The position (line num + index) to get the word for
 * @returns The word at that positon, if exists
 */
export function getOperatorByDocPosition(position: Position): OperatorToken | undefined {
  const lineOperators = operatorTokens.get(position.line);
  if (lineOperators) {
    return findMatchInRange(position.character, lineOperators.map(operator => ({start: operator.index, end: operator.index + operator.token.length, data: operator})))?.data;
  }
}

/**
 * Returns a call function's match result
 * @param lineNum Line number to start on (will check previous lines if not on this line)
 * @param callName The call function name we are looking for
 * @param callerIndex The index of the word of the call function name
 */
export function getCallIdentifier(uri: Uri, lineNum: number, callName: string, callNameIndex: number): Identifier | undefined {
  for (let curLine = lineNum; curLine >= Math.max(0, lineNum - 10); curLine--) {
    const lineParsedWords = parsedWords.get(curLine);
    const potentialCallWord = lineParsedWords?.[callNameIndex];
    if (potentialCallWord?.value === callName) {
      const item = get(uri, curLine, potentialCallWord.start);
      if (!item?.identifier || item.context.matchType.id === LOCAL_VAR.id) {
        if (QUEUE_REGEX.test(potentialCallWord.callName ?? '')) {
          const queueName = lineParsedWords?.[(potentialCallWord.callNameIndex ?? -2) + 1];
          if (!queueName) return;
          return getIdentifier(queueName.value, QUEUE);
        }
      } 
      return item?.identifier;
    }
  }
}

export function getLeftHandSide(): Item | undefined {
  return undefined;
}

export function getRightHandSide(): Item | undefined {
  return undefined;
}

/**
 * The core get item which does the searching of the caches to get an item on a line at that index
 * @param uri Used to validate the uri is the same as the one the cache is using
 * @param lineNum Line number the item is on
 * @param index Position/Index the item is at within that line
 * @returns The item at that position, if it exists
 */
function get(uri: Uri, lineNum: number, index: number): Item | undefined {
  if (file !== uri.fsPath) {
    return undefined; 
  }
  const result = findMatchInRange(index, fileMatches.get(lineNum))?.data;
  if (result) {
    return buildItem(result);
  }
}

/**
 * Builds the Item from the match result (Item = match result + identifier)
 * @param result The match result to build the item for
 */
function buildItem(result: MatchResult): Item {
  return {
    word: result.word,
    context: result.context,
    identifier: result.context.matchType.id === LOCAL_VAR.id ? getLocalVar(result, result.context.line.number) : getIdentifier(result.word, result.context.matchType)
  }
}

/**
 * Returns all match results in the active window
 */
export function getAllMatches(): MatchResult[] {
  return Array.from(fileMatches.values()).flat().map(range => range.data);
}

/**
 * Returns the fsPath of the file the active cache currently represents.
 */
export function getActiveCacheFile(): string {
  return file;
}

/**
 * Returns all of the matches and parsed words for the file
 */
export function getAllParsedWords(): Map<number, ParsedWord[]> {
  return parsedWords;
}

/**
 * Returns all of the matches and parsed words for the file
 */
export function getAllOperatorTokens(): Map<number, OperatorToken[]> {
  return operatorTokens;
}

// ==== CACHE POPULATING FUNCTIONS ==== // 

/**
 * Clears the cache and then initializes it for the new file
 * @param uri The uri of the file being built
 */
export function init(uri: Uri, parsedFile: ParsedFile) {
  fileMatches.clear();
  parsedWords = parsedFile.parsedWords;
  operatorTokens = parsedFile.operatorTokens;
  localVarCache.clear();
  codeBlockCache.clear();
  switchStmtCache.clear();
  file = uri.fsPath;
  newCodeblockFlag = -1;
}

/**
 * Clear all of the data
 */
export function clear() {
  fileMatches.clear();
  parsedWords = new Map();
  operatorTokens = new Map();
  localVarCache.clear();
  codeBlockCache.clear();
  switchStmtCache.clear();
  file = '';
  newCodeblockFlag = -1;
}

/**
 * Process a matched word into the active file cache. 
 * Builds additional context essential for some matches to be found.
 * This method must be called on each match in a file sequentially left to right, and line to line.
 * @param match the match found for the word
 */
export function processMatch(result: MatchResult): void {
  const lineNum = result.context.line.number;
  const lineItems = fileMatches.get(lineNum) ?? [];
  lineItems.push({ start: result.context.word.start, end: result.context.word.end, data: result });
  cacheCodeBlock(result);
  cacheSwitchStmt(result);
  cacheLocalVariable(result);
  fileMatches.set(lineNum, lineItems);
}

/**
 * Insert new matches into the active file cache, takes all matches for one line and inserts them in order
 * @param results results to insert
 */
export function insertLineMatches(results: MatchResult[]): void {
  if (results.length === 0) return;
  const lineNum = results[0]!.context.line.number;
  const lineResults = results.filter(r => r.context.line.number === lineNum);
  if (isDevMode() && lineResults.length !== results.length) {
    logWarning(`[activeFileCache] insertLineMatches expected all results to be on the same line, but got results spanning multiple lines`);
  }
  if (lineResults.length === 0) return;
  const lineItems = fileMatches.get(lineNum) ?? [];
  const additions = lineResults
    .map(r => ({ start: r.context.word.start, end: r.context.word.end, data: r }))
    .sort((a, b) => a.start - b.start);

  if (lineItems.length === 0) {
    fileMatches.set(lineNum, additions);
    return;
  }

  // Merge sorted additions into the existing sorted lineItems.
  const merged: typeof lineItems = [];
  let i = 0;
  let j = 0;
  while (i < lineItems.length && j < additions.length) {
    if (lineItems[i]!.start <= additions[j]!.start) {
      merged.push(lineItems[i++]!);
    } else {
      merged.push(additions[j++]!);
    }
  }
  while (i < lineItems.length) merged.push(lineItems[i++]!);
  while (j < additions.length) merged.push(additions[j++]!);

  fileMatches.set(lineNum, merged);
}


// ==== Local Variable Stuff ==== // 

// key : codeBlock cache key | value : map of local variable identifiers keyed by variable name
const localVarCache = new Map<string, Map<string, Identifier>>();

/**
 * Given a local variable match, this builds the identifier for it and puts it into the local variables cache
 * @param matchResult the match result of the local variable 
 * @param lineNum the line number the local variable is on
 */
function cacheLocalVariable(matchResult: MatchResult): void {
  if (matchResult.context.matchType.id !== LOCAL_VAR.id) return; // exit if not a local var match
  const lineNum = matchResult.context.line.number;
  const blockIdentifier = getBlockScopeIdentifier(lineNum);
  if (!blockIdentifier) return;
  const blockKey = resolveKeyFromIdentifier(blockIdentifier);

  if (matchResult.context.declaration) {
    // Add the new (declarations always come first) local variable to the cache
    const localVarIden = createLocalVariableIdentifier(matchResult);
    if (!localVarIden) return;
    const blockVariables = localVarCache.get(blockKey) ?? new Map<string, Identifier>();
    blockVariables.set(localVarIden.name, localVarIden);
    localVarCache.set(blockKey, blockVariables);
  } else {
    // Get the local variable identifier and add the reference to it
    const blockVariables = localVarCache.get(blockKey);
    if (!blockVariables) return;
    const localVarIden = blockVariables.get(matchResult.word);
    if (!localVarIden) return;
    const fileKey = resolveFileKey(matchResult.context.uri);
    if (!fileKey) return;
    const refs = addReference(localVarIden, fileKey, lineNum, matchResult.context.word.start, matchResult.context.word.end);
    localVarIden.references[fileKey] = refs;
  }
}

/**
 * Creates the Identifier object for the given local variable match result
 * @param matchResult the match result for the local variable
 * @returns the built identifier
 */
function createLocalVariableIdentifier(matchResult: MatchResult): Identifier | undefined {
  const fileKey = resolveFileKey(matchResult.context.uri);
  if (!fileKey) return undefined;
  let code: string = `${matchResult.context.extraData!.type} $${matchResult.word}`;
  if (matchResult.context.extraData!.param) code += ` (parameter)`;
  const text: IdentifierText = { lines: [code], start: 0 };
  const localVarIdentifier = buildFromDeclaration(matchResult.word, matchResult.context, text);
  const refs = addReference(localVarIdentifier, fileKey, matchResult.context.line.number, matchResult.context.word.start, matchResult.context.word.end);
  localVarIdentifier.references[fileKey] = refs;
  return localVarIdentifier;
}

/**
 * Get a local variable from the cache given the variable name and a line number
 * @param name name of the local variable
 * @param lineNum line number of the local variable
 * @returns the matching local variable, if any
 */
function getLocalVar(result: MatchResult, lineNum: number): Identifier | undefined {
  const blockIdentifier = getBlockScopeIdentifier(lineNum);
  if (!blockIdentifier) return;
  const blockKey = resolveKeyFromIdentifier(blockIdentifier);
  return localVarCache.get(blockKey)?.get(result.word);
}

/**
 * Get all of the local variable names within the scope a line number is in
 * @param lineNum a line number used to filter the existing local variables in the scope the line is on
 * @returns a set of local variable names
 */
export function getLocalVariableNames(lineNum: number): Set<{ name: string, desc: string }> {
  const namesInScriptBlock = new Set<{ name: string, desc: string }>();
  const blockIdentifier = getBlockScopeIdentifier(lineNum);
  if (!blockIdentifier) return namesInScriptBlock;
  const blockKey = resolveKeyFromIdentifier(blockIdentifier);
  const localVarsInScope = localVarCache.get(blockKey);
  if (!localVarsInScope) return namesInScriptBlock;
  for (const localVar of localVarsInScope.values()) {
    if (!localVar.declaration) continue;
    const declarationLocation = decodeReferenceToLocation(localVar.declaration.uri, localVar.declaration.ref); 
    if (!declarationLocation || declarationLocation.range.start.line > lineNum) continue;
    const desc = (localVar.extraData?.param) ? `parameter (${localVar.extraData?.type})` : `local variable (${localVar.extraData?.type})`;
    namesInScriptBlock.add({ name: localVar.name, desc: desc });
  }
  return namesInScriptBlock;
}

// ==== Script Block Stuff ==== // 

/**
 * When > -1 it signals that the next word is a script identifier (proc, label, etc...). Value is the lineNum.
 */
let newCodeblockFlag = -1;

/**
 * Caches the lines that a script identifier is defined on. 
 * Allows quick lookup of the block any given line in the file is part of.
 * Used for things such as accurate local variables (same var name can be used in multiple block scopes).
 */
const codeBlockCache = new LineReferenceCache<MatchResult>();

function cacheCodeBlock(result: MatchResult): void {
  result.context.file.type === 'rs2' ? cacheRs2Block(result) : cacheNonRs2Block(result);
}

function cacheRs2Block(result: MatchResult) {
  if (result.context.matchType.id === TRIGGER.id) {
    newCodeblockFlag = result.context.line.number;
  }
  else if (result.context.line.number === newCodeblockFlag && result.context.word.index === 1) {
    codeBlockCache.put(result.context.line.number, result);
    newCodeblockFlag = -1;
  }
}

function cacheNonRs2Block(result: MatchResult) {
  if (result.context.line.text.startsWith('[') && CONFIG_DECLARATION_REGEX.test(result.context.line.text)) {
    codeBlockCache.put(result.context.line.number, result);
  }
}

/**
 * Returns the identifier of the block/script a line is in
 * @param lineNum line number to return the block scope identifier it is part of
 */
export function getBlockScopeIdentifier(lineNum: number): Identifier | undefined {
  const result = codeBlockCache.get(lineNum);
  if (result) {
    return buildItem(result).identifier;
  }
}

// ==== Switch Statement Stuff ==== // 

/**
 * Caches the switch statements a line and particular brace depth is part of
 * The key is the brace depth that the switch applies to
 * The value is a line reference cache
 */
const switchStmtCache: Map<number, LineReferenceCache<MatchType>> = new Map();

export function cacheSwitchStmt(result: MatchResult): void {
  if (result.context.matchType.id === KEYWORD.id && result.word.startsWith('switch_')) {
    const braceDepth = result.context.word.braceDepth + 1;
    const lineRef = switchStmtCache.get(braceDepth) || new LineReferenceCache<MatchType>();
    const type = dataTypeToMatchType(result.word.substring(7));
    lineRef.put(result.context.line.number, (type.id === UNKNOWN.id) ? SKIP : type);
    switchStmtCache.set(braceDepth, lineRef);
  }
}

export function getSwitchStmtType(lineNum: number, braceDepth: number): MatchType | undefined {
  return switchStmtCache.get(braceDepth)?.get(lineNum);
}
