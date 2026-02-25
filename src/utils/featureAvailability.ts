import type { Uri } from "vscode";
import { workspace } from "vscode";
import { exists as projectFileExists } from "../cache/projectFilesCache";
import { getFileInfo } from "./fileUtils";

const noPackRequired = new Set<string>([
  "constant",
  "pack"
]);

const packAliases = new Map<string, string[]>([
  ["if", ["interface"]],
  ["varp", ["var"]],
  ["varbit", ["var"]],
  ["vars", ["var"]],
  ["varn", ["var"]],
  ["mid", ["midi"]],
  ["ob2", ["model"]]
]);

function getPackCandidates(fileType: string): string[] | undefined {
  if (!fileType || noPackRequired.has(fileType)) return undefined;
  const candidates = [fileType, ...(packAliases.get(fileType) ?? [])];
  return Array.from(new Set(candidates));
}

function hasAnyPack(candidates: string[]): boolean {
  return candidates.some(name => projectFileExists(`${name}.pack`));
}

export function isAdvancedFeaturesEnabled(uri: Uri): boolean {
  if (!workspace.getWorkspaceFolder(uri)) return false;
  const fileInfo = getFileInfo(uri);
  const fileType = (fileInfo.type ?? "").toLowerCase();

  if (fileType === "rs2") {
    return projectFileExists("engine.rs2") && projectFileExists("script.pack");
  }

  const candidates = getPackCandidates(fileType);
  if (!candidates) return true;
  return hasAnyPack(candidates);
}
