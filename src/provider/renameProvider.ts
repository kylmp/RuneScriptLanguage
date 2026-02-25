import type { Position, Range, RenameProvider, TextDocument } from 'vscode';
import type { MatchContext, MatchType, Identifier } from '../types';
import { Position as VsPosition, Range as VsRange, Uri, WorkspaceEdit, workspace } from 'vscode';
import { decodeReferenceToRange } from '../utils/cacheUtils';
import { MODEL } from '../matching/matchType';
import { getByDocPosition } from '../cache/activeFileCache';

export const renameProvider: RenameProvider = {
  async prepareRename(document: TextDocument, position: Position): Promise<Range | { range: Range; placeholder: string } | undefined> {
    // Get the item from the active document cache
    const item = getByDocPosition(document, position)
      ?? (position.character > 0 ? getByDocPosition(document, new VsPosition(position.line, position.character - 1)) : undefined);
    if (!item) {
      throw new Error("Cannot rename");
    }
    if (!item.context.matchType.allowRename || item.context.matchType.noop) {
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
    // Get the item from the active document cache
    const item = getByDocPosition(document, position)
      ?? (position.character > 0 ? getByDocPosition(document, new VsPosition(position.line, position.character - 1)) : undefined);
    if (!item) {
      return undefined;
    }

    const adjustedNewName = adjustNewName(item.context, newName);
    await renameFiles(item.context.matchType, item.word, adjustedNewName);
    return renameReferences(item.identifier, item.word, adjustedNewName);
  }
}

// Decode all the references for the identifier into an array of vscode ranges,
// then use that to rename all of the references to the newName
function renameReferences(identifier: Identifier | undefined, oldName: string, newName: string): WorkspaceEdit {
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

async function renameFiles(match: MatchType, oldName: string, newName: string): Promise<void> {
  if (match.renameFile && Array.isArray(match.fileTypes) && match.fileTypes.length > 0) {
    // Find files to rename
    let files: Uri[] = [];
    const ext = match.fileTypes[0];
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
      await workspace.fs.rename(oldUri, newUri);
    }
  }
}
