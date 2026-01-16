import type { Identifier, IdentifierText, MatchContext, MatchType } from '../types';
import { dataTypeToMatchId } from './dataTypeToMatchId';
import { getBlockSkipLines, getConfigInclusions, getHoverLanguage, resolveAllHoverItems } from './hoverConfigResolver';
import { SIGNATURE, CODEBLOCK } from '../enum/hoverDisplayItems';
import { END_OF_BLOCK_LINE_REGEX, INFO_MATCHER_REGEX } from '../enum/regex';
import { encodeReference } from '../utils/cacheUtils';

export function buildFromDeclaration(name: string, context: MatchContext, text?: IdentifierText): Identifier {
  const identifier: Identifier = {
    name: name,
    matchId: context.matchType.id,
    declaration: { uri: context.uri, ref: encodeReference(context.line.number, context.word.start) },
    references: {},
    fileType: context.uri.fsPath.split(/[#?]/)[0].split('.').pop()!.trim(),
    language: getHoverLanguage(context.matchType)
  };
  process(identifier, context, text);
  return identifier;
}

export function buildFromReference(name: string, context: MatchContext): Identifier {
  const identifier: Identifier = {
    name: name,
    matchId: context.matchType.id,
    references: {},
    fileType: (context.matchType.fileTypes || [])[0] || 'rs2',
    language: getHoverLanguage(context.matchType),
  };
  if (context.matchType.referenceOnly) {
    process(identifier, context);
  }
  return identifier;
}

export function addReference(identifier: Identifier, fileKey: string, lineNum: number, index: number, context?: MatchContext): Set<string> {
  const fileReferences = identifier.references[fileKey] || new Set<string>();
  fileReferences.add(encodeReference(lineNum, index));
  if (context && context.packId) identifier.id = context.packId;
  return fileReferences;
}

function process(identifier: Identifier, context: MatchContext, text?: IdentifierText): void {
  // Add extra data if any
  const extraData = context.extraData;
  if (extraData) {
    if (!identifier.extraData) identifier.extraData = {};
    Object.keys(extraData).forEach(key => {
      if (identifier.extraData) {
        identifier.extraData[key] = extraData[key];
      }
    });
  }

  // Process hover display texts
  if (text) {
    if (identifier.declaration) processInfoText(identifier, text);
    const hoverDisplayItems = resolveAllHoverItems(context.matchType);
    for (const hoverDisplayItem of hoverDisplayItems) {
      switch(hoverDisplayItem) {
        case SIGNATURE: processSignature(identifier, text); break;
        case CODEBLOCK: processCodeBlock(identifier, context.matchType, text); break;
      }
    }
  }

  // Execute custom post processing for the identifier's matchType (if defined)
  if (context.matchType.postProcessor) {
    context.matchType.postProcessor(identifier);
  }
}

function processSignature(identifier: Identifier, text: IdentifierText): void {
  // Get first line of text, which should contain the data for parsing the signature
  let line = text.lines[text.start];
  if (!line) return;

  // Parse input params
  const params: Array<{ type: string; name: string; matchTypeId: string }> = [];
  let openingIndex = line.indexOf('(');
  let closingIndex = line.indexOf(')');
  if (openingIndex >= 0 && closingIndex >= 0 && ++openingIndex !== closingIndex) {
    line.substring(openingIndex, closingIndex).split(',').forEach(param => {
      if (param.startsWith(' ')) param = param.substring(1);
      const split = param.split(' ');
      if (split.length === 2) {
        params.push({ type: split[0], name: split[1], matchTypeId: dataTypeToMatchId(split[0]) });
      }
    });
  }

  // Parse response type
  let returns: string[] = [];
  let returnsText = '';
  line = line.substring(closingIndex + 1);
  openingIndex = line.indexOf('(');
  closingIndex = line.indexOf(')');
  if (openingIndex >= 0 && closingIndex >= 0 && ++openingIndex !== closingIndex) {
    returnsText = line.substring(openingIndex, closingIndex);
    returns = line.substring(openingIndex, closingIndex).split(',').map(item => dataTypeToMatchId(item.trim()));
  }

  // Add signature to identifier
  const paramsText = (params.length > 0) ? params.map(param => `${param.type} ${param.name}`).join(', ') : '';
  identifier.signature = { params, returns, paramsText, returnsText };
}

function processCodeBlock(identifier: Identifier, match: MatchType, text: IdentifierText): void {
  const lines = text.lines;
  const startIndex = text.start + Number(getBlockSkipLines(match));
  const configInclusionTags = getConfigInclusions(match);
  let blockInclusionLines: string[] = [];
  const matchType = match;

  if (matchType.id === 'CONSTANT' && lines[startIndex]) blockInclusionLines.push(lines[startIndex]);
  let i = startIndex
  for (; i < lines.length; i++) {
    let currentLine = lines[i];
    if (END_OF_BLOCK_LINE_REGEX.test(currentLine)) break;
    if (currentLine.startsWith('//')) continue;
    if (configInclusionTags && !configInclusionTags.some((inclusionTag: string) => currentLine.startsWith(inclusionTag))) continue;
    blockInclusionLines.push(currentLine);
  }
  identifier.block = { code: blockInclusionLines.join('\n') };
}

function processInfoText(identifier: Identifier, text: IdentifierText): void {
  if (text.start < 1) return;
  const infoLine = text.lines[text.start - 1];
  if (!infoLine) return;
  const infoMatch = INFO_MATCHER_REGEX.exec(infoLine);
  if (infoMatch && infoMatch[2]) {
    identifier.info = infoMatch[2].trim();
  }
}

export function serializeIdentifier(identifier: Identifier): Record<string, unknown> {
  return {
    ...identifier,
    declaration: identifier.declaration ? { uri: identifier.declaration.uri.fsPath,ref: identifier.declaration.ref } : undefined,
    references: Object.fromEntries(
      Object.keys(identifier.references || {}).map(fileKey => [fileKey, Array.from(identifier.references[fileKey])])
    )
  };
}
