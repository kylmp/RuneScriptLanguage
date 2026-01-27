import type { OutputChannel, Uri } from "vscode";
import type { MatchResult, ParsedWord } from "../types";
import { window } from "vscode";
import { version as packageVersion } from '../../package.json';
import { processAllFiles } from "./manager";
import { getSettingValue, Settings } from "./settings";
import { appriximateSize, getCacheKeyCount, getTotalReferences } from "../cache/identifierCache";
import { getTypesCount } from "../cache/completionCache";
import { getExceptionWords } from "../parsing/wordExceptions";
import { getFileInfo } from "../utils/fileUtils";

interface initializationMetrics {
  fileCount: number,
  wordCount: number,
  fileReadDuration: number,
  exceptionWordScanDuration: number,
  fileParsingDuration: number,
  firstPassDuration: number,
  secondPassDuration: number
}

/**
 * Output channel to write debug/dev messages to
 */
const outputChannel: OutputChannel = window.createOutputChannel('Runescript');

/**
 * Contains the last rebuild all metrics
 */
export const rebuildMetrics: initializationMetrics = {
  fileCount: 0,
  wordCount: 0,
  fileReadDuration: 0,
  exceptionWordScanDuration: 0,
  fileParsingDuration: 0,
  firstPassDuration: 0,
  secondPassDuration: 0
} 

/**
 * An easy check to see if dev mode is enabled or not
 */
export function isDevMode() { 
  return getSettingValue(Settings.DevMode);
};

/**
 * Called only during extenstion activation
 */
export function registerDevMode() {
  if (isDevMode()) {
    outputChannel.clear();
    appendOutput([`Runescript Extension v${packageVersion ?? 'unknown'} [Dev Mode]`]);
  }
}

/**
 * Called when dev mode is toggled on
 */
export function initDevMode() {
  outputChannel.clear();
  appendOutput([`Runescript Extension v${packageVersion ?? 'unknown'} [Dev Mode]`]);
  processAllFiles();
  outputChannel.show();
}

/**
 * Append lines of text to the dev mode output channel
 * @param lines lines of text to append
 */
function appendOutput(lines: string[]) {
  lines.forEach(line => outputChannel.appendLine(line));
}

/**
 * Clear out the dev mode output channel, and append new lines
 * @param lines lines of text to append
 */
export function replaceOutput(lines: string[]) {
  outputChannel.clear();
  appendOutput([`Runescript Extension v${packageVersion ?? 'unknown'} [Dev Mode]`]);
  appendOutput(lines);
}

export function clearDevModeOutput() {
  outputChannel.clear();
}

/**
 * Log all of the metrics related to full file cache rebuild to the dev mode output channel
 */
export function reportRebuildMetrics(): void {
  const exceptionWords = getExceptionWords();
  const lines = [
    ``,
    `=== Rebuild all files metrics ===`,
    `Total duration: ${formatToSec(rebuildMetrics.fileReadDuration + rebuildMetrics.fileParsingDuration + rebuildMetrics.exceptionWordScanDuration + rebuildMetrics.firstPassDuration + rebuildMetrics.secondPassDuration)}`,
    ` Read all files:            ${formatMs(rebuildMetrics.fileReadDuration)}`,
    ` Scan for exception words:  ${formatMs(rebuildMetrics.exceptionWordScanDuration)}`,
    ` Parse all files:           ${formatMs(rebuildMetrics.fileParsingDuration)}`,
    ` Match words (first pass):  ${formatMs(rebuildMetrics.firstPassDuration)}`,
    ` Match words (second pass): ${formatMs(rebuildMetrics.secondPassDuration)}`,
    ``,
    `Parsing:`,
    ` Files read, parsed, and matched:  ${rebuildMetrics.fileCount}`,
    ` Valid found word count:           ${rebuildMetrics.wordCount}`,
    ` Exception words discovered:       ${exceptionWords.length}`,
    ` Exception word values:            ${exceptionWords.sort((a, b) => a.localeCompare(b)).map(w => `${w}`).join(', ')}`,
    ``,
    `Cache info:`,
    ` Approximate size:    ${(appriximateSize() / (1024 * 1024)).toFixed(2)} MB`,
    ` Identifiers (total): ${getCacheKeyCount(true)} (total references ${getTotalReferences()})`,
    ...getTypesCount(),
    `=== End rebuild all metrics ===`,
    ``
  ]
  appendOutput(lines);
}

/**
 * Converts a number of milliseconds into a string showing the value in seconds to 2 decimal places
 * @param ms milliseconds
 * @returns formatted string
 */
function formatToSec(ms: number) {
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Converts a number of milliseconds into a string
 * @param ms milliseconds
 * @returns formatted string
 */
function formatMs(ms: number) {
  return `${Math.round(ms)} ms`;
}

/**
 * Converts a number of milliseconds into a string to 2 decimal places
 * @param ms milliseconds
 * @returns formatted string
 */
function formatMs2(ms: number) {
  return `${ms.toFixed(2)} ms`;
}

export enum LogType {
  FileSaved = 'file saved',
  ActiveFileTextChanged = 'active file text changed',
  ActiveFileChanged = 'active document changed',
  FileDeleted = 'file deleted',
  FileCreated = 'file created',
  FileChanged = 'file changed',
  SettingsChanged = 'settings changed',
  GitBranchChanged = 'git branch changed',
  FileParsed = 'file parsed',
  FileMatched = 'matched parsed file',
}

export function logFileEvent(uri: Uri, event: LogType, extra?: string) {
  if (!isDevMode()) return;
  const fileInfo = getFileInfo(uri);
  logEvent(event, `on file ${fileInfo.name}.${fileInfo.type}${extra ? ` [${extra}]` : ''}`);
}

export function logSettingsEvent(setting: Settings) {
  if (!isDevMode()) return;
  logEvent(LogType.SettingsChanged, `setting ${setting} updated to ${getSettingValue(setting)}`);
}

export function logFileParsed(startTime: number, parsedFile: Map<number, ParsedWord[]>, uri: Uri, lines: number, partial = false) {
  if (!isDevMode()) return;
  const fileInfo = getFileInfo(uri);
  const msg = partial ? 'Partial reparse of file' : 'Parsed file';
  log(`${msg} ${fileInfo.name}.${fileInfo.type} in ${formatMs2(performance.now() - startTime)} [lines parsed: ${lines}]`);
}

export function logFileRebuild(startTime: number, uri: Uri, matches: MatchResult[]) {
  if (!isDevMode()) return;
  const fileInfo = getFileInfo(uri);
  log(`Rebuilt file ${fileInfo.name}.${fileInfo.type} in ${formatMs2(performance.now() - startTime)} [matches: ${matches.length}]`);
}

export function logEvent(event: LogType, msg?: string) {
  log(`Event [${event}]${msg ? ' ' + msg : ''}`, true);
}

function log(message: string, skipLine = false) {
  const base = skipLine ? [''] : [];
  appendOutput([...base, `[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ${message}`]);
}
