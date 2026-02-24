import type { Uri, ExtensionContext } from "vscode";
import type { MatchResult, ParsedFile } from "../types";
import { ProgressLocation, window, workspace } from "vscode";
import { getActiveFile, getFileText, isActiveFile } from "../utils/fileUtils";
import { matchFile } from "../matching/matchingEngine";
import { clear as clearActiveFileCache, init as initActiveFilecache } from "../cache/activeFileCache";
import { clearAllDiagnostics, clearFileDiagnostics, handleFileUpdate, rebuildFileDiagnostics, registerDiagnostics } from "./diagnostics";
import { rebuildSemanticTokens } from "../provider/semanticTokensProvider";
import { rebuildHighlights } from "./highlights";
import { clearFile as clearIdentifierFile, clear as clearIdentifierCache, getFileIdentifiers } from '../cache/identifierCache';
import { clear as clearProjectFilesCache, rebuild as rebuildProjectFilesCache } from '../cache/projectFilesCache';
import { registerCommands } from "./commands";
import { registerEventHandlers } from "./eventHandlers";
import { registerProviders } from "./providers";
import { parseFile } from "../parsing/fileParser";
import { findFileExceptionWords } from "../parsing/wordExceptions";
import { isDevMode, logFileRebuild, rebuildMetrics, registerDevMode, reportRebuildMetrics } from "./devMode";
import { clear as clearIdCache, clearAll as clearAllIds } from "../cache/idCache";
import { clear as clearMap, handleMapFileOpened, isMapFile } from "./mapManager";
import { getAllMatchTypes } from "../matching/matchType";

export function initializeExtension(context: ExtensionContext) {
  buildMonitoredFileTypes();
  buildAllFileTypes();

  registerDiagnostics(context);
  registerCommands(context);
  registerEventHandlers(context);
  registerProviders(context);
  registerDevMode();

  void rebuildProjectFilesCache();
  void processAllFiles();

  context.subscriptions.push({ dispose: () => dispose() });
}

/**
 * Process all files and rebuild all caches in the project
 */
export function processAllFiles() {
  // Since it takes a while, show the progress notification
  window.withProgress({
    location: ProgressLocation.Notification,
    title: "Runescript Extension: Scanning files and building the cache...",
    cancellable: false
  }, async () => {
    clearAll();
    await rebuildProjectFilesCache();
    await rebuildAllFiles();
    void rebuildActiveFile();
    reportRebuildMetrics();
  });
}

/**
 * Add a file to get rebuilt into the rebuild file queue
 */
let rebuildFileQueue = Promise.resolve();
export function queueFileRebuild(uri: Uri, fileText: string[], parsedFile: ParsedFile, quiet = false): Promise<void> {
  rebuildFileQueue = rebuildFileQueue.then(() => rebuildFile(uri, fileText, parsedFile, quiet));
  return rebuildFileQueue;
}

/**
 * Read, parse, match, and cache items from all relevant files in the project workspace
 * @param recordMetrics Whether or not to record metrics related to the rebuild
 */
async function rebuildAllFiles(recordMetrics = isDevMode()): Promise<void> {
  // Get all the relevant files to read/parse
  const fileTypesToScan = Array.from(monitoredFileTypes, fileType => `**/*.${fileType}`);
  const uris = await workspace.findFiles(`{${[...fileTypesToScan].join(',')}}`);
  if (recordMetrics) rebuildMetrics.fileCount = uris.length;
  if (recordMetrics) rebuildMetrics.wordCount = 0;

  // Read and parse all of the relevant project files
  let startTime = performance.now();
  type File = { uri: Uri; lines: string[]; parsedFile?: ParsedFile };
  const files: File[] = await Promise.all(uris.map(async uri => ({ uri: uri, lines: await getFileText(uri) })));
  if (recordMetrics) rebuildMetrics.fileReadDuration = performance.now() - startTime;

  // Scan the files for exception words
  startTime = performance.now();
  files.forEach(file => findFileExceptionWords(file.lines));
  if (recordMetrics) rebuildMetrics.exceptionWordScanDuration = performance.now() - startTime;

  // Parse the files into words with deeper parsing context
  startTime = performance.now();
  files.forEach(file => file.parsedFile = parseFile(file.uri, file.lines, true));
  if (recordMetrics) rebuildMetrics.fileParsingDuration = performance.now() - startTime;
  
  // First pass => finds all the declarations & exception words so second pass will be complete
  startTime = performance.now();
  for (const file of files) {
    initActiveFilecache(file.uri, file.parsedFile!);
    matchFile(file.uri, file.parsedFile!, file.lines, true);
    if (recordMetrics) rebuildMetrics.wordCount += [...file.parsedFile!.parsedWords!.values()].reduce((sum, words) => sum + words.length, 0);
  }
  if (recordMetrics) rebuildMetrics.firstPassDuration = performance.now() - startTime;

  // Second pass => now that the declarations and exception words are known full matching can be done
  startTime = performance.now();
  for (const file of files) {
    initActiveFilecache(file.uri, file.parsedFile!);
    const matchResults = matchFile(file.uri, file.parsedFile!, file.lines, false);
    await rebuildFileDiagnostics(file.uri, matchResults);
  }
  if (recordMetrics) rebuildMetrics.secondPassDuration = performance.now() - startTime;
}

/**
 * Rebuild a file: clear all cache data related to the file, parse & match it, build diagnostics, 
 *                 build semantic tokens and highlights if active file
 * @param uri Uri of the file getting rebuilt
 * @param lines Text of the file getting rebuilt
 */
async function rebuildFile(uri: Uri, lines: string[], parsedFile: ParsedFile, quiet = false): Promise<void> { 
  if (!parsedFile) return;
  const startTime = performance.now();
  const startIdentifiers = getFileIdentifiers(uri);
  clearFile(uri);
  initActiveFilecache(uri, parsedFile);  
  const fileMatches: MatchResult[] = matchFile(uri, parsedFile, lines, false);
  await rebuildFileDiagnostics(uri, fileMatches);
  handleFileUpdate(startIdentifiers, getFileIdentifiers(uri));
  if (isActiveFile(uri)) {
    rebuildSemanticTokens();
    rebuildHighlights();
  }
  if (!quiet) logFileRebuild(startTime, uri, fileMatches);
}

/**
 * Rebuilds the active/viewed file
 */
async function rebuildActiveFile(): Promise<void> {
  const activeFile = getActiveFile();
  if (activeFile) {
    if (isMapFile(activeFile)) return handleMapFileOpened(await workspace.openTextDocument(activeFile));
    const fileText = await getFileText(activeFile);
    void queueFileRebuild(activeFile, fileText, parseFile(activeFile, fileText));
  }
}

/**
 * Clear all of the caches
 */
export function clearAll() {
  clearIdentifierCache();
  clearAllDiagnostics();
  clearActiveFileCache();
  clearAllIds();
  clearMap();
}

/**
 * Dispose the caches
 */
function dispose() {
  clearAll();
  clearProjectFilesCache();
}

/**
 * Clear all of the caches relevant to a file
 * @param uri the file to be cleared
 */
export function clearFile(uri: Uri) {
  clearIdentifierFile(uri);
  clearFileDiagnostics(uri);
  clearIdCache(uri);
}

/**
* Files which this extension is interested in
*/
export const monitoredFileTypes = new Set<string>();
function buildMonitoredFileTypes(): void {
  monitoredFileTypes.add('pack');
  getAllMatchTypes().filter(match => !match.referenceOnly).forEach(match => {
    const fileTypes = match.fileTypes || [];
    for (const fileType of fileTypes) {
      monitoredFileTypes.add(fileType);
    }
  });
}

/**
* Files which this extension is interested in
*/
export const allFileTypes = new Set<string>();
function buildAllFileTypes(): void {
  allFileTypes.add('pack');
  getAllMatchTypes().forEach(match => {
    const fileTypes = match.fileTypes || [];
    for (const fileType of fileTypes) {
      allFileTypes.add(fileType);
    }
  });
}
