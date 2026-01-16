import type { DefinitionProvider, Position, TextDocument } from 'vscode';
import { Location } from 'vscode';
import { getByDocPosition } from '../cache/activeFileCache';
import { decodeReferenceToLocation } from '../utils/cacheUtils';

export const gotoDefinitionProvider: DefinitionProvider = {
  async provideDefinition(document: TextDocument, position: Position): Promise<Location | undefined> {
    // Get the item from the active document cache, exit early if noop or hoverOnly type
    const item = await getByDocPosition(document, position);
    if (!item || item.context.matchType.noop || item.context.matchType.hoverOnly) {
      return undefined;
    }

    // If we are already on a declaration, there is nowhere to goto. Returning current location
    // indicates to vscode that we instead want to try doing "find references"
    if (item.context.declaration || item.context.matchType.referenceOnly) {
      return new Location(document.uri, position);
    }

    // Goto the declaration if the identifier exists
    if (!item.identifier?.declaration) return undefined;
    return decodeReferenceToLocation(item.identifier.declaration.uri, item.identifier.declaration.ref);
  }
}
