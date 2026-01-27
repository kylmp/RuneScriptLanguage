import type { Command, TextDocument } from "vscode";
import { Position, CompletionItem, CompletionItemKind, Range, TextEdit } from "vscode";
import { COMMAND, CONFIG_KEY, CONSTANT, ENUM, GLOBAL_VAR, LABEL, LOCAL_VAR, MESANIM, PROC, QUEUE, SKIP, TRIGGER } from "../../matching/matchType";
import { getAllWithPrefix, getTypes } from "../../cache/completionCache";
import { forceRebuild } from "../../core/eventHandlers";
import { parseLineWithStateSnapshot } from "../../parsing/lineParser";
import { singleWordMatch } from "../../matching/matchingEngine";
import { runescriptTrigger } from "../../resource/triggers";
import { getLocalVariableNames } from "../../cache/activeFileCache";
import { getByKey } from "../../cache/identifierCache";
import { getObservedConfigKeys } from "../../resource/configKeys";

const autoTriggeredTypeIds = [
  CONSTANT.id,
  GLOBAL_VAR.id,
  LOCAL_VAR.id,
  PROC.id,
  LABEL.id
];

export function getCompletionItemKind(matchTypeId: string): CompletionItemKind {
  switch (matchTypeId) {
    case CONSTANT.id: return CompletionItemKind.Constant;
    case LOCAL_VAR.id:
    case GLOBAL_VAR.id: return CompletionItemKind.Variable;
    case QUEUE.id:
    case COMMAND.id:
    case PROC.id:
    case LABEL.id: return CompletionItemKind.Function;
    case MESANIM.id:
    case ENUM.id: return CompletionItemKind.Enum;
    default: return CompletionItemKind.Text;
  }
}

export function buildCompletionItem(label: string, kind: CompletionItemKind, desc: string, range?: Range, additionalTextEdits?: TextEdit[], command?: Command): CompletionItem {
  const res = new CompletionItem(label, kind);
  res.label = { label: label, description: desc.toLowerCase() };
  if (range) res.range = range;
  if (additionalTextEdits) res.additionalTextEdits = additionalTextEdits;
  if (command) res.command = command;
  return res;
}

export function completionTypeSelector(position: Position): CompletionItem[] {
  return getTypes().filter(type => !autoTriggeredTypeIds.includes(type)).map(type => {
    const additionalEdits = [TextEdit.delete(new Range(position.translate(0, -1), position))];
    const command = { command: 'editor.action.triggerSuggest', title: 'Trigger Suggest' };
    return buildCompletionItem(`${type}>`, CompletionItemKind.Enum, type, undefined, additionalEdits, command);
  });
}

let lastRequestId = 0;
export async function searchForMatchType(document: TextDocument, position: Position, defaultMatchId = SKIP.id, fromTrigger = false): Promise<CompletionItem[]> {
  const requestId = ++lastRequestId;
  await forceRebuild(document);
  if (requestId !== lastRequestId) return []; // guard debounce, only continue with 1 result
  const triggerOffset = fromTrigger ? 2 : 0;
  let str = document.lineAt(position.line).text;
  str = str.substring(0, position.character - triggerOffset) + 'temp' + str.substring(position.character);
  const parsedWords = parseLineWithStateSnapshot(str, position.line, document.uri);
  const wordIndex = parsedWords.findIndex(w => w.start <= position.character && w.end >= position.character);
  const matchResult = singleWordMatch(document.uri, parsedWords, str, position.line, wordIndex);
  const matchTypeId = (matchResult) ? matchResult.context.matchType.id : defaultMatchId;
  if (matchTypeId === SKIP.id) return [];
  const prefix = (matchResult) ? (matchResult.context.originalWord ?? matchResult.word).slice(0, -4) : '';
  const additionalTextEdits = [TextEdit.delete(new Range(position.translate(0, -triggerOffset), position))];
  return completionWithMatchid(prefix, matchTypeId, position.line, additionalTextEdits);
}

export function completionWithMatchid(prefix: string, matchTypeId: string, lineNum: number, additionalTextEdits?: TextEdit[]): CompletionItem[] {
  const completionItems: CompletionItem[] = [];
  let identifierNames: { name: string, desc: string }[] = [];
  switch(matchTypeId) {
    case CONFIG_KEY.id:
      identifierNames = [...getObservedConfigKeys()].map(configKey => ({ name: configKey, desc: CONFIG_KEY.id }));
      break;
    case TRIGGER.id:
      identifierNames = Object.keys(runescriptTrigger).map(trigger => ({ name: trigger, desc: TRIGGER.id }));
      break;
    case LOCAL_VAR.id:
      identifierNames = Array.from(getLocalVariableNames(lineNum));
      break;
    case GLOBAL_VAR.id:
      identifierNames = (getAllWithPrefix(prefix, matchTypeId) ?? []).map(iden => ({ name: iden, desc: getByKey(`${iden}${matchTypeId}`)!.fileType }));
      break;
    default:
      identifierNames = (getAllWithPrefix(prefix, matchTypeId) ?? []).map(iden => ({ name: iden, desc: matchTypeId }));
  }
  const completionKind = getCompletionItemKind(matchTypeId);
  identifierNames.forEach(completionData => completionItems.push(
    buildCompletionItem(completionData.name, completionKind, completionData.desc, undefined, additionalTextEdits)));
  return completionItems;
}

export function completionByType(document: TextDocument, position: Position, triggerIndex: number, word: string): CompletionItem[] {
  const completionItems: CompletionItem[] = [];
  const prevWordRange = document.getWordRangeAtPosition(new Position(position.line, triggerIndex));
  if (!prevWordRange) {
    return completionItems;
  }
  const additionalTextEdits = [TextEdit.delete(new Range(prevWordRange.start, position))];
  return completionWithMatchid(word, document.getText(prevWordRange), position.line, additionalTextEdits);
}

export function doubleBacktickTrigger(document: TextDocument, position: Position, trigger?: string): boolean {
  return trigger !== undefined && trigger === '`' && position.character > 1 && document.lineAt(position.line).text.charAt(position.character - 2) === '`';
}
