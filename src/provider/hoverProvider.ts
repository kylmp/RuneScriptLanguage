import type { ExtensionContext, HoverProvider, MarkdownString, Position, TextDocument } from 'vscode';
import type { Item } from '../types';
import { Hover } from 'vscode';
import { buildFromDeclaration } from '../resource/identifierFactory';
import { getDeclarationHoverItems, getReferenceHoverItems } from '../resource/hoverConfigResolver';
import { markdownBase, appendTitle, appendInfo, appendValue, appendSignature, appendCodeBlock, appendDebugHover, appendOperatorHover } from '../utils/markdownUtils';
import { getFileDiagnostics } from '../core/diagnostics';
import { getByDocPosition, getOperatorByDocPosition, getParsedWordByDocPosition } from '../cache/activeFileCache';
import { isDevMode } from '../core/devMode';
import { getSettingValue, Settings } from '../core/settings';

export const hoverProvider = function(context: ExtensionContext): HoverProvider {
  return {
    async provideHover(document: TextDocument, position: Position): Promise<Hover | undefined> {
      if (!getSettingValue(Settings.ShowHover)) return undefined; // Exit early if hover disabled
      const markdown = markdownBase(context);
      const item = getByDocPosition(document, position);
      appendHover(markdown, document, position, item)
      await appendDebug(markdown, document, position, item);
      return new Hover(markdown);
    }
  };
}

function getIdentifier(item: Item) {
  return item.identifier ?? (!item.context.matchType.cache ? buildFromDeclaration(item.word, item.context) : undefined);
}

function appendHover(markdown: MarkdownString, document: TextDocument, position: Position, item: Item | undefined): void {
  // If theres a diagnostic issue at this location, exit early (do not display normal hover text)
  const diagnostics = getFileDiagnostics(document.uri);
  if (diagnostics.find(d => d.range.contains(position))) {
    return undefined;
  }

  // If no item was found exit early
  if (!item || item.context.matchType.noop) {
    return undefined;
  }

  // If no config found, or no items to display then exit early
  const hoverDisplayItems = item.context.declaration ? getDeclarationHoverItems(item.context.matchType) : getReferenceHoverItems(item.context.matchType);
  if (!Array.isArray(hoverDisplayItems) || hoverDisplayItems.length === 0) {
    return undefined;
  }

  // Try to get identifier, if not found or if hideDisplay property is set, then there is nothing to display
  const identifier = getIdentifier(item);
  if (!identifier || identifier.hideDisplay) {
    return undefined;
  }

  // Append the registered hoverDisplayItems defined in the matchType for the identifier
  appendTitle(identifier.name, identifier.fileType, identifier.matchId, markdown, identifier.id, item.context.cert);
  appendInfo(identifier, hoverDisplayItems, markdown);
  appendValue(identifier, hoverDisplayItems, markdown);
  appendSignature(identifier, hoverDisplayItems, markdown);
  appendCodeBlock(identifier, hoverDisplayItems, markdown);
}

async function appendDebug(markdown: MarkdownString, document: TextDocument, position: Position, item: Item | undefined): Promise<void> {
  if (isDevMode()) {
    if (item) return appendDebugHover(markdown, item.context.word, item.context, getIdentifier(item));
    const parsedWord = getParsedWordByDocPosition(position);
    if (parsedWord) return appendDebugHover(markdown, parsedWord);
    const operator = getOperatorByDocPosition(position);
    if (operator) return appendOperatorHover(markdown, operator);
  }
}
