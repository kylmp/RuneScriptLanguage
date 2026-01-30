import { window, type Uri } from "vscode";
import { monitoredFileTypes } from "../core/manager";
import { getLines } from "./stringUtils";
import { readFile } from 'fs/promises';
import type { FileInfo } from "../types";

/**
* Checks if the file extension of the uri is in the list of monitored file types
*/
export function isValidFile(uri: Uri): boolean {
  const ext = uri.fsPath.split(/[#?]/)[0].split('.').pop()?.trim();
  return ext !== undefined && monitoredFileTypes.has(ext);
}

/**
 * Checks if the file uri is the active opened editor
 */
export function isActiveFile(uri: Uri): boolean {
  return getActiveFile() === uri;
}

/**
 * Get the active file being viewed
 */
export function getActiveFile(): Uri | undefined {
  return window.activeTextEditor?.document.uri;
}

export async function getFileText(uri: Uri): Promise<string[]> {
  return getLines(await readFile(uri.fsPath, "utf8"))
}

export function getFileInfo(uri: Uri): FileInfo {
  const fileSplit = uri.fsPath.split('\\').pop()!.split('/').pop()!.split('.');
  return { name: fileSplit[0]!, type: fileSplit[1]! };
}

export function getFileName(uri: Uri): string {
  const fileSplit = uri.fsPath.split('\\').pop()!.split('/').pop()!.split('.');
  return `${fileSplit[0]!}.${fileSplit[1]!}`;
}
