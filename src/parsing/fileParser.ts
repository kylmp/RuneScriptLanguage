import { type TextDocument, type TextDocumentContentChangeEvent, type Uri } from "vscode";
import type { ParsedWord } from "../types";
import { applyLineChanges, getAllWords, parseLine, resetLineParser } from "./lineParser";
import { getFileText } from "../utils/fileUtils";
import { logFileParsed } from "../core/devMode";

/**
 * This parses a file to find all of the words in it, and caches the words for later retrieval
 * Calling this method will rebuild the file entirely if it previously existed
 * @param uri The file uri to parse
 * @param fileText The text of the file to parse, if not provided it is read from the uri
 * @returns All of the parsed words for the file
 */
export function parseFile(uri: Uri, fileText: string[], quiet = false): Map<number, ParsedWord[]> {
  const startTime = performance.now();
  const parsedWords = [];
  resetLineParser(uri);
  const lines = fileText ?? getFileText(uri);
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    parsedWords.push(...parseLine(lines[lineNum], lineNum, uri));
  }
  const parsedFile = getAllWords();
  if (!quiet) logFileParsed(startTime, parsedFile, uri, lines.length);
  return parsedFile;
}

/**
 * Rebuilds the active file based on the actual document changes, reparses only modified lines
 * up until the parser state is restored, avoiding a full file reparse.
 * Matches are still done for the whole parsed file.
 */
export function reparseFileWithChanges(document: TextDocument, changes: TextDocumentContentChangeEvent[], quiet = false): Map<number, ParsedWord[]> | undefined {
  if (changes.length === 0) return undefined;
  const startTime = performance.now();
  let linesAffected = 0;
  for (const change of changes) {
    const startLine = change.range.start.line;
    const endLine = change.range.end.line;
    const removedLines = endLine - startLine;
    const addedLines = change.text.split(/\r?\n/).length - 1;
    const lineDelta = addedLines - removedLines;
    linesAffected = applyLineChanges(document, startLine, endLine, lineDelta);
  }
  const parsedFile = getAllWords();
  if (!quiet) logFileParsed(startTime, parsedFile, document.uri, linesAffected);
  return parsedFile;
}
