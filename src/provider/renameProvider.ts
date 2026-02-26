import type { Position, Range, RenameProvider, TextDocument } from 'vscode';
import type { MatchContext, MatchType, Identifier } from '../types';
import { Position as VsPosition, Range as VsRange, Uri, WorkspaceEdit, workspace } from 'vscode';
import { decodeReferenceToRange, getFullName } from '../utils/cacheUtils';
import { COMPONENT, INTERFACE, MODEL } from '../matching/matchType';
import { LOC_MODEL_REGEX } from '../enum/regex';
import { getByDocPosition } from '../cache/activeFileCache';
import { get as getIdentifier, getIdentifiersByMatchId } from '../cache/identifierCache';
import { isAdvancedFeaturesEnabled } from '../utils/featureAvailability';
import { registerIdentifierRename, registerRenameUris, registerRenameWorkspaceEdit } from '../core/renameTracking';
import { waitForActiveFileRebuild } from '../core/eventHandlers';

export const renameProvider: RenameProvider = {
  async prepareRename(document: TextDocument, position: Position): Promise<Range | { range: Range; placeholder: string } | undefined> {
    await waitForActiveFileRebuildWithTimeout(document);
    // Get the item from the active document cache
    const item = getByDocPosition(document, position)
      ?? (position.character > 0 ? getByDocPosition(document, new VsPosition(position.line, position.character - 1)) : undefined);
    if (!item) {
      throw new Error("Cannot rename");
    }
    if (!isAdvancedFeaturesEnabled(document.uri)) {
      throw new Error("Cannot rename outside of a project");
    }
    if ((item.context.matchType.id !== INTERFACE.id && !item.context.matchType.allowRename) || item.context.matchType.noop) {
      throw new Error(`${item.context.matchType.id} renaming not supported`);
    }
    if (!item.identifier) {
      throw new Error('Cannot find any references to rename');
    }
    const wordRange = document.getWordRangeAtPosition(position);
    if (wordRange) {
      return { range: wordRange, placeholder: item.word };
    }
    const wordStart = item.context.word.start;
    const wordEndExclusive = item.context.word.end + 1;
    return { range: new VsRange(item.context.line.number, wordStart, item.context.line.number, wordEndExclusive), placeholder: item.word };
  },

  async provideRenameEdits(document: TextDocument, position: Position, newName: string): Promise<WorkspaceEdit | undefined> {
    await waitForActiveFileRebuildWithTimeout(document);
    // Get the item from the active document cache
    const item = getByDocPosition(document, position)
      ?? (position.character > 0 ? getByDocPosition(document, new VsPosition(position.line, position.character - 1)) : undefined);
    if (!item) {
      return undefined;
    }
    if (!isAdvancedFeaturesEnabled(document.uri)) {
      throw new Error("Cannot rename outside of a project");
    }

    const adjustedNewName = adjustNewName(item.context, newName);
    if (item.context.matchType.id === INTERFACE.id) {
      const edits = await renameInterface(item, adjustedNewName);
      if (edits) {
        registerRenameWorkspaceEdit(edits);
      }
      return edits;
    }

    const collisionName = resolveRenameTargetName(item.word, adjustedNewName);
    const existing = getIdentifier(collisionName, item.context.matchType);
    if (existing && existing.cacheKey !== item.identifier?.cacheKey) {
      throw new Error('Target name already exists.');
    }
    registerIdentifierRename(item.context.matchType, item.word, adjustedNewName);
    await renameFiles(item.context.matchType, item.word, adjustedNewName);
    if (item.context.matchType.id === MODEL.id) {
      const edits = await renameModelReferences(item.identifier, adjustedNewName);
      registerRenameWorkspaceEdit(edits);
      return edits;
    }
    const edits = renameReferences(item.identifier, adjustedNewName);
    registerRenameWorkspaceEdit(edits);
    return edits;
  }
}

async function waitForActiveFileRebuildWithTimeout(document: TextDocument, timeoutMs = 500): Promise<void> {
  await Promise.race([
    waitForActiveFileRebuild(document),
    new Promise<void>(resolve => setTimeout(resolve, timeoutMs))
  ]);
}

export async function renameInterfaceFromFileRename(oldUri: Uri, newUri: Uri): Promise<void> {
  if (!oldUri.fsPath.endsWith('.if') || !newUri.fsPath.endsWith('.if')) return;
  const oldName = getInterfaceNameFromUri(oldUri);
  const newName = getInterfaceNameFromUri(newUri);
  if (!oldName || !newName || oldName === newName) return;
  registerIdentifierRename(INTERFACE, oldName, newName);
  const componentIdentifiers = getIdentifiersByMatchId(COMPONENT.id)
    .filter(iden => getFullName(iden).startsWith(`${oldName}:`));
  for (const iden of componentIdentifiers) {
    const fullName = getFullName(iden);
    const suffix = fullName.substring(oldName.length + 1);
    const target = `${newName}:${suffix}`;
    registerIdentifierRename(COMPONENT, fullName, target);
  }
  const edits = await buildInterfaceRenameEdits(oldName, newName, true);
  if (edits) {
    await workspace.applyEdit(edits);
    registerRenameWorkspaceEdit(edits);
  }
}

export async function renameReferenceOnlyByName(oldName: string, newName: string, matchType: MatchType): Promise<void> {
  if (!oldName || !newName || oldName === newName) return;
  const existing = getIdentifier(newName, matchType);
  const oldIdentifier = getIdentifier(oldName, matchType);
  if (!oldIdentifier) return;
  if (existing && existing.cacheKey !== oldIdentifier.cacheKey) {
    throw new Error('Target name already exists.');
  }
  registerIdentifierRename(matchType, oldName, newName);
  const edits = renameReferences(oldIdentifier, newName);
  await workspace.applyEdit(edits);
  registerRenameWorkspaceEdit(edits);
}

export async function renameModelReferencesByName(oldName: string, newName: string): Promise<void> {
  if (!oldName || !newName || oldName === newName) return;
  const existing = getIdentifier(newName, MODEL);
  const oldIdentifier = getIdentifier(oldName, MODEL);
  if (!oldIdentifier) return;
  if (existing && existing.cacheKey !== oldIdentifier.cacheKey) {
    throw new Error('Target name already exists.');
  }
  registerIdentifierRename(MODEL, oldName, newName);
  const edits = await renameModelReferences(oldIdentifier, newName);
  await workspace.applyEdit(edits);
  registerRenameWorkspaceEdit(edits);
}

// Decode all the references for the identifier into an array of vscode ranges,
// then use that to rename all of the references to the newName
function renameReferences(identifier: Identifier | undefined, newName: string): WorkspaceEdit {
  const renameWorkspaceEdits = new WorkspaceEdit();
  if (identifier?.references) {
    Object.keys(identifier.references).forEach(fileKey => {
      const uri = Uri.file(fileKey);
      identifier.references[fileKey].forEach((encodedReference: string) => {
        const range = decodeReferenceToRange(encodedReference);
        if (range) {
          renameWorkspaceEdits.replace(uri, range, newName);
        }
      });
    });
  }
  return renameWorkspaceEdits;
}

async function renameModelReferences(identifier: Identifier | undefined, newName: string): Promise<WorkspaceEdit> {
  const renameWorkspaceEdits = new WorkspaceEdit();
  if (!identifier?.references) {
    return renameWorkspaceEdits;
  }
  const docCache = new Map<string, TextDocument>();
  for (const fileKey of Object.keys(identifier.references)) {
    const uri = Uri.file(fileKey);
    let doc = docCache.get(fileKey);
    if (!doc) {
      doc = await workspace.openTextDocument(uri);
      docCache.set(fileKey, doc);
    }
    identifier.references[fileKey].forEach((encodedReference: string) => {
      const range = decodeReferenceToRange(encodedReference);
      if (!range) return;
      const currentText = doc!.getText(range);
      let replacement = newName;
      if (LOC_MODEL_REGEX.test(currentText)) {
        const lastUnderscore = currentText.lastIndexOf('_');
        if (lastUnderscore > 0) {
          replacement = `${newName}${currentText.slice(lastUnderscore)}`;
        }
      }
      renameWorkspaceEdits.replace(uri, range, replacement);
    });
  }
  return renameWorkspaceEdits;
}

function adjustNewName(context: MatchContext, newName: string): string {
  // Strip the cert_ and the _ prefix on objs or categories
  if (context.originalPrefix && newName.startsWith(context.originalPrefix)) {
    newName = newName.substring(context.originalPrefix.length);
  }
  // Strip the suffixes off
  if (context.originalSuffix && newName.endsWith(context.originalSuffix)) {
    newName = newName.slice(0, -context.originalSuffix.length);
  }
  // Strip the left side of identifier names with colons in them
  if (newName.indexOf(':') > -1) {
    newName = newName.substring(newName.indexOf(':') + 1);
  }
  return newName;
}

function resolveRenameTargetName(oldName: string, newName: string): string {
  if (oldName.includes(':') && !newName.includes(':')) {
    const prefix = oldName.split(':', 1)[0] ?? '';
    return prefix ? `${prefix}:${newName}` : newName;
  }
  return newName;
}

async function renameFiles(match: MatchType, oldName: string, newName: string): Promise<void> {
  if (match.renameFile && Array.isArray(match.fileTypes) && match.fileTypes.length > 0) {
    // Find files to rename
    let files: Uri[] = [];
    const ext = match.fileTypes[0];
    const renamedUris: Uri[] = [];
    if (match.id === MODEL.id) {
      files = await workspace.findFiles(`**/${oldName}*.${ext}`) || [];
      const regex = new RegExp(`^(?:${oldName}\\.${ext}|${oldName}_[^/]\\.${ext})$`);
      files = files.filter(uri => regex.test(uri.path.split('/').pop()!));
    } else {
      files = await workspace.findFiles(`**/${oldName}.${ext}`) || [];
    }

    // Rename the files
    for (const oldUri of files) {
      const oldFileName = oldUri.path.split('/').pop();
      const suffix = oldFileName?.startsWith(`${oldName}_`) ? oldFileName!.slice(oldName.length + 1, oldFileName!.lastIndexOf('.')) : '';
      const newFileName = suffix ? `${newName}_${suffix}.${ext}` : `${newName}.${ext}`;
      const newUri = Uri.joinPath(oldUri.with({ path: oldUri.path.replace(/\/[^/]+$/, '') }), newFileName);
      try {
        await workspace.fs.stat(newUri);
        throw new Error('Target name already exists.');
      } catch {
      }
      await workspace.fs.rename(oldUri, newUri);
      renamedUris.push(newUri);
    }
    if (renamedUris.length > 0) {
      registerRenameUris(renamedUris);
    }
  }
}

async function renameInterface(item: { identifier?: Identifier; word: string; context: MatchContext }, newInterfaceName: string): Promise<WorkspaceEdit | undefined> {
  const oldInterfaceName = item.word;
  const existingInterface = getIdentifier(newInterfaceName, INTERFACE);
  if (existingInterface && existingInterface.cacheKey !== item.identifier?.cacheKey) {
    throw new Error('Target name already exists.');
  }

  registerIdentifierRename(INTERFACE, oldInterfaceName, newInterfaceName);
  const componentIdentifiers = getIdentifiersByMatchId(COMPONENT.id)
    .filter(iden => getFullName(iden).startsWith(`${oldInterfaceName}:`));

  const componentIdSet = new Set(componentIdentifiers.map(iden => iden.cacheKey));
  for (const iden of componentIdentifiers) {
    const fullName = getFullName(iden);
    const suffix = fullName.substring(oldInterfaceName.length + 1);
    const target = `${newInterfaceName}:${suffix}`;
    const existing = getIdentifier(target, COMPONENT);
    if (existing && !componentIdSet.has(existing.cacheKey)) {
      throw new Error('Target name already exists.');
    }
    registerIdentifierRename(COMPONENT, fullName, target);
  }

  await renameInterfaceFiles(oldInterfaceName, newInterfaceName);

  const edits = new WorkspaceEdit();
  if (item.identifier) {
    addRenameReferences(edits, item.identifier, newInterfaceName);
  }
  const docCache = new Map<string, TextDocument>();
  for (const iden of componentIdentifiers) {
    const fullName = getFullName(iden);
    const suffix = fullName.substring(oldInterfaceName.length + 1);
    const newFullName = `${newInterfaceName}:${suffix}`;
    await addComponentInterfacePrefixRename(edits, iden, oldInterfaceName, newInterfaceName, docCache);
  }
  return edits;
}

function addRenameReferences(edits: WorkspaceEdit, identifier: Identifier, newName: string): void {
  Object.keys(identifier.references).forEach(fileKey => {
    const uri = Uri.file(fileKey);
    identifier.references[fileKey].forEach((encodedReference: string) => {
      const range = decodeReferenceToRange(encodedReference);
      if (range) {
        edits.replace(uri, range, newName);
      }
    });
  });
}

async function addComponentInterfacePrefixRename(
  edits: WorkspaceEdit,
  identifier: Identifier,
  oldInterfaceName: string,
  newInterfaceName: string,
  docCache: Map<string, TextDocument>
): Promise<void> {
  for (const fileKey of Object.keys(identifier.references)) {
    if (fileKey.endsWith('.if')) {
      continue;
    }
    const uri = Uri.file(fileKey);
    let doc = docCache.get(fileKey);
    if (!doc) {
      doc = await workspace.openTextDocument(uri);
      docCache.set(fileKey, doc);
    }
    const prefix = `${oldInterfaceName}:`;
    const replacement = `${newInterfaceName}:`;
    identifier.references[fileKey].forEach((encodedReference: string) => {
      const range = decodeReferenceToRange(encodedReference);
      if (!range) return;
      const lineText = doc!.lineAt(range.start.line).text;
      const idx = lineText.indexOf(prefix);
      if (idx < 0) return;
      const prefixRange = new VsRange(range.start.line, idx, range.start.line, idx + prefix.length);
      edits.replace(uri, prefixRange, replacement);
    });
  }
}

async function renameInterfaceFiles(oldName: string, newName: string): Promise<void> {
  const files = await workspace.findFiles(`**/${oldName}.if`) || [];
  const renamedUris: Uri[] = [];
  for (const oldUri of files) {
    const newUri = Uri.joinPath(oldUri.with({ path: oldUri.path.replace(/\/[^/]+$/, '') }), `${newName}.if`);
    try {
      await workspace.fs.stat(newUri);
      throw new Error('Target name already exists.');
    } catch {
    }
    await workspace.fs.rename(oldUri, newUri);
    renamedUris.push(newUri);
  }
  if (renamedUris.length > 0) {
    registerRenameUris(renamedUris);
  }
}

function getInterfaceNameFromUri(uri: Uri): string | undefined {
  const fileName = uri.fsPath.split(/[/\\]/).pop() ?? '';
  const parts = fileName.split('.');
  if (parts.length < 2) return undefined;
  if (parts[parts.length - 1] !== 'if') return undefined;
  return parts.slice(0, -1).join('.');
}

async function buildInterfaceRenameEdits(oldInterfaceName: string, newInterfaceName: string, skipFileRename: boolean): Promise<WorkspaceEdit | undefined> {
  const existingInterface = getIdentifier(newInterfaceName, INTERFACE);
  const oldIdentifier = getIdentifier(oldInterfaceName, INTERFACE);
  if (existingInterface && existingInterface.cacheKey !== oldIdentifier?.cacheKey) {
    throw new Error('Target name already exists.');
  }

  const componentIdentifiers = getIdentifiersByMatchId(COMPONENT.id)
    .filter(iden => getFullName(iden).startsWith(`${oldInterfaceName}:`));

  const componentIdSet = new Set(componentIdentifiers.map(iden => iden.cacheKey));
  for (const iden of componentIdentifiers) {
    const fullName = getFullName(iden);
    const suffix = fullName.substring(oldInterfaceName.length + 1);
    const target = `${newInterfaceName}:${suffix}`;
    const existing = getIdentifier(target, COMPONENT);
    if (existing && !componentIdSet.has(existing.cacheKey)) {
      throw new Error('Target name already exists.');
    }
  }

  if (!skipFileRename) {
    await renameInterfaceFiles(oldInterfaceName, newInterfaceName);
  }

  const edits = new WorkspaceEdit();
  if (oldIdentifier) {
    addRenameReferences(edits, oldIdentifier, newInterfaceName);
  }
  const docCache = new Map<string, TextDocument>();
  for (const iden of componentIdentifiers) {
    await addComponentInterfacePrefixRename(edits, iden, oldInterfaceName, newInterfaceName, docCache);
  }
  return edits;
}
