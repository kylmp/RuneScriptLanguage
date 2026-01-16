import type { Uri } from "vscode";
import type { ParsedWord } from "../types";
import { getAllWords, parseLine, resetLineParser } from "./lineParser";
import { getFileText } from "../utils/fileUtils";

/**
 * This parses a file to find all of the words in it, and caches the words for later retrieval
 * Calling this method will rebuild the file entirely if it previously existed
 * @param uri The file uri to parse
 * @param fileText The text of the file to parse, if not provided it is read from the uri
 * @returns All of the parsed words for the file
 */
export function parseFile(uri: Uri, fileText: string[]): Map<number, ParsedWord[]> {
  const parsedWords = [];
  resetLineParser(uri);
  const lines = fileText ?? getFileText(uri);
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    parsedWords.push(...parseLine(lines[lineNum], lineNum, uri));
  }
  return getAllWords();
}
