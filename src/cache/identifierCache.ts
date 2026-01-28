const sizeof = require('object-sizeof');
import type { Uri } from 'vscode';
import type { FileIdentifiers, FileKey, Identifier, IdentifierKey, IdentifierText, MatchContext, MatchType } from '../types';
import { addReference, buildFromDeclaration, buildFromReference, serializeIdentifier } from '../resource/identifierFactory';
import { resolveFileKey, resolveIdentifierKey } from '../utils/cacheUtils';
import { clear as clearCompletionCache, put as putCompletionCache, remove as removeCompletionCache } from './completionCache';

/**
  * The identifierCache stores all matched identifiers in the workspace
  * identifierCache = {key [name+matchTypeId]: identifier}
  * See identifierFactory.js for the object structure
  */
const identifierCache = new Map<IdentifierKey, Identifier>();

/**
 * The fileToIdentifierMap keeps track of all declarations and references within a file
 * This is used to invalidate any identifiers within a file and reprocess the file when changes have been made
 */
const fileToIdentifierMap = new Map<FileKey, FileIdentifiers>();

/**
 * Get the cached identifier using the identifier name and match type
 * @param name Name of the identifier
 * @param match MatchType of the identifier
 * @returns Identifier if found, undefined otherwise
 */
function get(name: string, match: MatchType): Identifier | undefined {
  const key = resolveIdentifierKey(name, match);
  return key !== undefined ? identifierCache.get(key) : undefined;
}

/**
 * Get the cacched identifier using the identifier key
 * @param key IdentifierKey
 * @returns Identifier if found, undefined otherwise
 */
function getByKey(key: IdentifierKey): Identifier | undefined {
  return identifierCache.get(key);
}

/**
 * Put (declaration) identifier into the cache. Creates the identifier from the given data. 
 * @param name Identifier name
 * @param context Identifier match type
 * @param declaration Identifier declaration location
 * @param text Identifier text, full file text as lines and line number it is found on
 * @returns The new identifier or undefined if unable to resolve
 */
function put(name: string, context: MatchContext, text: IdentifierText): Identifier | undefined {
  // Make sure cache keys resolve correctly
  const key = resolveIdentifierKey(name, context.matchType);
  const fileKey = resolveFileKey(context.uri);
  if (!key || !fileKey) {
    return;
  }

  // Retrieve current identifier from cache (if any)
  let curIdentifier: Identifier | undefined = identifierCache.get(key);

  // If the current identifier in cache already is the declaration, don't overwrite (happens on 2nd cache populating pass)
  if (curIdentifier && curIdentifier.declaration) {
    return curIdentifier;
  }

  // Build the identifier to insert
  const identifier = buildFromDeclaration(name, context, text);

  // Copy existing (refernces only) identifier values (reference & id) into the new declaration identifier
  if (curIdentifier && curIdentifier.id) identifier.id = curIdentifier.id;
  if (curIdentifier && !curIdentifier.declaration) identifier.references = curIdentifier.references;

  // Add the declarartion to the file map 
  addToFileMap(fileKey, key, true);

  // Add the identifier to the cache
  identifierCache.set(key, identifier);

  // Add the info to the completion cache
  putCompletionCache(name, context.matchType.id);

  // Also insert the declaration as a reference 
  putReference(name, context, context.uri, context.line.number, context.word.start, context.word.end);

  // Return the created identifier
  return identifier;
}

/**
 * Put (reference) identifier into the cache. Adds a reference if identifier already exists, creates it if not. 
 * @param name Identifier name
 * @param context Context of the match this identifier was found in
 * @param uri file URI the reference is found in
 * @param lineNum line number within the file the reference is found on
 * @param startIndex the index within the line where the reference is found
 * @param packId the pack id, if any (ex: Obj id 1234)
 */
function putReference(name: string, context: MatchContext, uri: Uri, lineNum: number, startIndex: number, endIndex: number): void {
  // Make sure cache keys resolve correctly
  const key = resolveIdentifierKey(name, context.matchType);
  const fileKey = resolveFileKey(uri);
  if (!key || !fileKey) {
    return;
  }

  // If the identifier doesn't yet exist in the cache, build the identifier with minimal necessary data
  if (!identifierCache.has(key)) {
    const ref = buildFromReference(name, context);
    if (!ref.matchId) return;
    identifierCache.set(key, { ...ref, references: {} });
  }

  // Get the current references for this identifier in the current file (if any) and add this new reference
  const curIdentifier = identifierCache.get(key);
  if (!curIdentifier) return;
  const fileReferences = addReference(curIdentifier, fileKey, lineNum, startIndex, endIndex, context);

  // Add the reference to the file map
  addToFileMap(fileKey, key, false);

  // Update the identifier in the identifier cache with the new references
  curIdentifier.references[fileKey] = fileReferences;

  // If the matchType of this identifier is reference only, add the data to the completion cache (others will get added when the declaration is added)
  if (context.matchType.referenceOnly) putCompletionCache(name, context.matchType.id);
}

/**
 * Clears the identifier cache and relevant supporting caches
 */
function clear(): void {
  identifierCache.clear();
  fileToIdentifierMap.clear();
  clearCompletionCache();
}

/**
 * Clears out all references and declarations from the cache of a given file
 * @param uri The file URI to clear out of the cache
 */
function clearFile(uri: Uri): void {
  // Make sure cache keys resolve correctly
  const fileKey = resolveFileKey(uri);
  if (!fileKey) {
    return;
  }

  // Get the identifiers in the file
  const identifiersInFile = fileToIdentifierMap.get(fileKey) || { declarations: new Set(), references: new Set() };

  // Iterate thru the references in the file
  identifiersInFile.references.forEach((key) => {
    const iden = identifierCache.get(key);
    if (iden) {
      // Delete references to the cleared file from every identifier which referenced the file
      if (iden.references[fileKey]) {
        delete iden.references[fileKey];
      }
      // Cleanup/Delete identifiers without a declaration who no longer have any references
      if (Object.keys(iden.references).length === 0 && !iden.declaration) {
        if (iden.matchId) removeCompletionCache(iden.name, iden.matchId);
        identifierCache.delete(key);
      }
    }
  });

  // Iterate thru the declarations in the file
  identifiersInFile.declarations.forEach((key) => {
    const iden = identifierCache.get(key);
    if (iden) {
      // If the identifier has orphaned references, then we only delete the declaration and keep the identifier w/references
      // Otherwise, we delete the entire identifier (no declaration and no references => no longer exists in any capacity)
      if (iden.matchId) removeCompletionCache(iden.name, iden.matchId);
      const hasOrphanedRefs = Object.keys(iden.references).length > 0;
      if (hasOrphanedRefs) {
        delete iden.declaration;
      } else {
        identifierCache.delete(key);
      }
    }
  });

  // Remove the entry for the file from the fileToIdentifierMap
  fileToIdentifierMap.delete(fileKey);
}

/**
 * Update the fileMap with the file of a new identifier declared or referenced within said file
 * @param fileKey fileKey where this identifier declaration or reference is found
 * @param identifierKey identifierKey of this identifier 
 * @param declaration boolean: true if inserting a declaration, false if inserting a reference
 */
function addToFileMap(fileKey: FileKey, identifierKey: IdentifierKey, declaration = true): void {
  // Get the current identifiers in a file, or a new default empty set for both declarations and reference if nothing exists
  const identifiersInFile = fileToIdentifierMap.get(fileKey) || { declarations: new Set(), references: new Set() };

  // If we are inserting a declaration update declaration identifiers, else update reference identifiers of the file
  (declaration) ? identifiersInFile.declarations.add(identifierKey) : identifiersInFile.references.add(identifierKey);

  // Update the cache with the new data
  fileToIdentifierMap.set(fileKey, identifiersInFile);
}

/**
 * Serialize the contents of the identifier cache, used for the export cache debug command
 * @returns cache records
 */
function serializeCache(): Record<string, unknown> {
  const serialized: Record<string, unknown> = {};
  identifierCache.forEach((identifier, key) => {
    serialized[key] = serializeIdentifier(identifier);
  });
  return serialized;
}

/**
 * Return all of the cache keys in the identifier cache, used for the export cache keys debug command
 * @returns cache keys
 */
function getCacheKeys(): string[] {
  return Array.from(identifierCache.keys()).sort();
}

function getCacheKeyCount(identifiers = true): number {
  return identifiers ? identifierCache.size : fileToIdentifierMap.size;
}

function appriximateSize() {
  return sizeof(identifierCache) + sizeof(fileToIdentifierMap);
}

function getTotalReferences(): number {
  let total = 0;
  for (const identifier of identifierCache.values()) { 
    for (const references of Object.values(identifier.references ?? {})) {
      total += references.size;
    }
  }
  return total;
}

function getFileIdentifiers(uri: Uri): FileIdentifiers | undefined {
  return fileToIdentifierMap.get(uri.fsPath);
}

export { get, getByKey, put, putReference, clear, clearFile, serializeCache, getCacheKeys, getCacheKeyCount, appriximateSize, getTotalReferences, getFileIdentifiers };
