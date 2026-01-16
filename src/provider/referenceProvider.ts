import type { Location, Position, ReferenceProvider, TextDocument} from 'vscode';
import { Uri } from 'vscode';
import { decodeReferenceToLocation } from '../utils/cacheUtils';
import { getByDocPosition } from '../cache/activeFileCache';

export const referenceProvider: ReferenceProvider = {
  async provideReferences(document: TextDocument, position: Position): Promise<Location[]> {
    // Get the item from the active document cache, exit early if noop or hoverOnly type
    const item = await getByDocPosition(document, position);
    if (!item || item.context.matchType.noop || item.context.matchType.hoverOnly) {
      return [];
    }

    // Check that the identifier exists and has references
    if (!item.identifier || !item.identifier.references) {
      return [];
    }

    // Decode all the references for the identifier into an array of vscode Location objects
    const referenceLocations: Location[] = [];
    Object.keys(item.identifier.references).forEach(fileKey => {
      const uri = Uri.file(fileKey);
      item.identifier!.references[fileKey].forEach(encodedReference => {
        const location = decodeReferenceToLocation(uri, encodedReference);
        if (location) {
          referenceLocations.push(location);
        }
      });
    });

    // If there is only one reference and its the declaration, return empty list as theres no other references to show
    if (item.context.declaration && referenceLocations.length === 1) {
      return [];
    }

    return referenceLocations;
  }
}
