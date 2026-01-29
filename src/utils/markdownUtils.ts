import type { ExtensionContext } from 'vscode';
import type { Identifier, MatchContext, OperatorToken, ParsedWord } from '../types';
import { MarkdownString, Uri } from 'vscode';
import { join, sep } from 'path';
import { INFO, VALUE, SIGNATURE, CODEBLOCK } from '../enum/hoverDisplayItems';
import { GLOBAL_VAR } from '../matching/matchType';
import { getFileInfo } from './fileUtils';
import { decodeReferenceToLocation } from './cacheUtils';

export function markdownBase(extensionContext: ExtensionContext): MarkdownString {
  const markdown = new MarkdownString();
  markdown.supportHtml = true;
  markdown.isTrusted = true;
  markdown.supportThemeIcons = true;
  markdown.baseUri = Uri.file(join(extensionContext.extensionPath, 'icons', sep));
  return markdown;
}

export function appendTitle(name: string, type: string, matchId: string | undefined, markdown: MarkdownString, id?: string, isCert?: boolean): void {
  if (isCert) name = `${name} (cert)`;
  if (id) name = `${name} [${id}]`;
  markdown.appendMarkdown(`<b>${matchId === GLOBAL_VAR.id ? type.toUpperCase() : matchId}</b>&ensp;${name}`);
}

export function appendInfo(identifier: Identifier, displayItems: string[], markdown: MarkdownString): void {
  if (displayItems.includes(INFO) && identifier.info) {
    appendBody(`<i>${identifier.info}</i>`, markdown);
  }
}

export function appendValue(identifier: Identifier, displayItems: string[], markdown: MarkdownString): void {
  if (displayItems.includes(VALUE) && identifier.value) {
    appendBody(`${identifier.value}`, markdown);
  }
}

export function appendSignature(identifier: Identifier, displayItems: string[], markdown: MarkdownString): void {
  if (displayItems.includes(SIGNATURE) && identifier.signature) {
    if (identifier.signature.paramsText.length > 0) markdown.appendCodeblock(`params: ${identifier.signature.paramsText}`, identifier.language ?? 'runescript');
    if (identifier.signature.returnsText.length > 0) markdown.appendCodeblock(`returns: ${identifier.signature.returnsText}`, identifier.language ?? 'runescript');
  }
}

export function appendCodeBlock(identifier: Identifier, displayItems: string[], markdown: MarkdownString): void {
  if (displayItems.includes(CODEBLOCK) && identifier.block) {
    markdown.appendCodeblock(identifier.block.code, identifier.language ?? 'runescript');
  }
}

export function appendBody(text: string, markdown: MarkdownString): void {
  if (!markdown.value.includes('---')) {
    markdown.appendMarkdown('\n\n---');
  }
  markdown.appendMarkdown(`\n\n${text}`);
}

export function appendDebugHover(markdown: MarkdownString, word: ParsedWord, context?: MatchContext, identifier?: Identifier): void {
  if (markdown.value) markdown.appendMarkdown('\n\n---\n\n');
  if (!markdown.value) {
    if (context) {
      markdown.appendMarkdown(`**${context.matchType.id}** ${word.value}`);
    } else {
      markdown.appendMarkdown(`**UNMATCHED_TOKEN** ${word.value}`);
    }
  }

  const parsingInfoLines: string[] = [];
  parsingInfoLines.push(`word=${word.value}`);
  parsingInfoLines.push(`wordIndex=${word.index}`);
  parsingInfoLines.push(`wordRange=${word.start}-${word.end}`);
  parsingInfoLines.push(`inInterpolation=${word.inInterpolation}`);
  parsingInfoLines.push(`parenthesisDepth=${word.parenDepth}`);
  parsingInfoLines.push(`braceDepth=${word.braceDepth}`);
  if (context?.extraData && Object.keys(context.extraData).length > 0) {
    parsingInfoLines.push(`extraData=${JSON.stringify(context.extraData)}`);
  }
  markdown.appendMarkdown(`\n\n---\n\n**Parsing Info**`);
  markdown.appendCodeblock(parsingInfoLines.join('\n'), 'properties');

  if (word.callName || word.configKey) {
    const callInfoLines: string[] = [];
    if (word.callName) {
      callInfoLines.push(`callName=${word.callName}`);
      callInfoLines.push(`callNameWordIndex=${word.callNameIndex}`);
    }
    if (word.configKey) {
      callInfoLines.push(`configKey=${word.configKey}`);
      callInfoLines.push(`configKeyWordIndex=${word.callNameIndex}`);
    }
    callInfoLines.push(`paramIndex=${word.paramIndex}`);
    markdown.appendMarkdown(`\n\n---\n\n**Parent Function**`);
    markdown.appendCodeblock(callInfoLines.join('\n'), 'properties');
  }

  if (context?.originalWord) {
    const modifiedWordLines: string[] = [];
    modifiedWordLines.push(`modifiedWord=true`);
    modifiedWordLines.push(`originalWord=${context.originalWord}`);
    if (context.originalPrefix) modifiedWordLines.push(`originalPrefix=${context.originalPrefix}`);
    if (context.originalSuffix) modifiedWordLines.push(`originalSuffix=${context.originalSuffix}`);
    markdown.appendMarkdown(`\n\n---\n\n**Modified Word**`);
    markdown.appendCodeblock(modifiedWordLines.join('\n'), 'properties');
  }

  if (identifier) {
    const identifierLines: string[] = [];
    if (identifier.id) identifierLines.push(`packId=${identifier.id}`);
    identifierLines.push(context?.matchType.cache ? `cacheId=${word.value}${identifier.matchId}` : 'cacheId=Not cached');
    if (identifier.declaration) {
      const fileInfo = getFileInfo(identifier.declaration.uri);
      const location = decodeReferenceToLocation(identifier.declaration.uri, identifier.declaration.ref);
      const line = location ? location.range.start.line + 1 : 'n/a';
      identifierLines.push(`declaration=${fileInfo.name}.${fileInfo.type}, line ${line}`);
    }
    const refCount = Object.values(identifier.references).reduce((count, set) => count + set.size, 0);
    identifierLines.push(`references=${refCount}`);
    identifierLines.push(`language=${identifier.language}`);
    if (identifier.comparisonType) identifierLines.push(`comparisonType=${identifier.comparisonType}`);
    if (identifier.hideDisplay) identifierLines.push(`hideDisplay=true`);
    markdown.appendMarkdown(`\n\n---\n\n**Identifier**`);
    markdown.appendCodeblock(identifierLines.join('\n'), 'properties');
  }
}

export function appendOperatorHover(markdown: MarkdownString, operator: OperatorToken): void {
  const operatorLines: string[] = [];
  operatorLines.push(`index=${operator.index}`);
  operatorLines.push(`parenDepth=${operator.parenDepth}`);
  if (markdown.value) markdown.appendMarkdown('\n\n---\n\n');
  markdown.appendMarkdown(`**OPERATOR** [ ${operator.token} ]`);
  markdown.appendCodeblock(operatorLines.join('\n'), 'properties');
}
