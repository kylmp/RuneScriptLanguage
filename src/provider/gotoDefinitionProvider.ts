import type { DefinitionProvider, Position, TextDocument } from 'vscode';
import { Location } from 'vscode';
import { getByDocPosition } from '../cache/activeFileCache';
import { decodeReferenceToLocation } from '../utils/cacheUtils';
import type { Identifier } from '../types';
import { getIdentifierAtPosition as getIdentifierAtMapPosition, isMapFile } from '../core/mapManager';
import { isAdvancedFeaturesEnabled } from '../utils/featureAvailability';

export const gotoDefinitionProvider: DefinitionProvider = {
  async provideDefinition(document: TextDocument, position: Position): Promise<Location | undefined> {
    if (!isAdvancedFeaturesEnabled(document.uri)) {
      return undefined;
    }
    if (isMapFile(document.uri)) {
      return gotoIdentifier(getIdentifierAtMapPosition(position));
    }

    // Get the item from the active document cache, exit early if noop or non cached type
    const item = getByDocPosition(document, position);
    if (!item || item.context.matchType.noop || !item.context.matchType.cache) {
      return undefined;
    }

    // If we are already on a declaration, there is nowhere to goto. Returning current location
    // indicates to vscode that we instead want to try doing "find references"
    if (item.context.declaration || item.context.matchType.referenceOnly) {
      return new Location(document.uri, position);
    }

    // Goto the declaration if the identifier exists
    return gotoIdentifier(item.identifier);
  }
}

function gotoIdentifier(identifier: Identifier | undefined): Location | undefined {
  if (!identifier?.declaration) return undefined;
  return decodeReferenceToLocation(identifier.declaration.uri, identifier.declaration.ref);
}
