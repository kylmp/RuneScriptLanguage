import type { Uri } from "vscode";
import { LOC, NPC, OBJ } from "../matching/matchType";
import { getFileInfo } from "../utils/fileUtils";

const cache: Map<string, Map<string, string>> = new Map();

const cachedTypes: string[] = [NPC.id, OBJ.id, LOC.id];

export function add(matchTypeId: string, id: string, name: string): void {
  if (cachedTypes.includes(matchTypeId)) {
    cache.get(matchTypeId)!.set(id, name);
  }
}

export function get(matchTypeId: string, id: string): string | undefined {
  return cache.get(matchTypeId)?.get(id);
}

export function clear(uri: Uri): void {
  const fileInfo = getFileInfo(uri);
  if (fileInfo.type === 'pack' && cachedTypes.includes(fileInfo.name.toUpperCase())) {
    cache.set(fileInfo.name.toUpperCase(), new Map());
  }
}

export function clearAll(): void {
  cachedTypes.forEach(type => cache.set(type, new Map()));
}
