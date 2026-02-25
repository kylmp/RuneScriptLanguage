import type { Position, CompletionItem, CancellationToken, CompletionContext, TextDocument, CompletionItemProvider } from 'vscode';
import { CompletionTriggerKind } from 'vscode';
import { COMMAND, CONSTANT, GLOBAL_VAR, LABEL, LOCAL_VAR, PROC, TRIGGER } from '../../matching/matchType';
import { completionByType, completionTypeSelector, completionWithMatchid, doubleBacktickTrigger, searchForMatchType } from './completetionCommon';
import { isAdvancedFeaturesEnabled } from '../../utils/featureAvailability';

export const completionTriggers = ['$', '^', '%', '~', '@', '`', '>', ',', '[', '(', ' '];

export const completionProvider: CompletionItemProvider<CompletionItem> = {
  async provideCompletionItems(document: TextDocument, position: Position, _cancellationToken: CancellationToken, context: CompletionContext): Promise<CompletionItem[]> {
    if (!isAdvancedFeaturesEnabled(document.uri)) {
      return [];
    }
    if (context.triggerKind === CompletionTriggerKind.TriggerCharacter) {
      if (doubleBacktickTrigger(document, position, context.triggerCharacter)) {
        return searchForMatchType(document, position, COMMAND.id, true);
      }
      if (context.triggerCharacter === ' ') {
        const line = document.lineAt(position.line).text;
        const triggerIndex = findTriggerIndex(line, position.character - 1);
        if (triggerIndex >= 0 && [','].includes(line.charAt(triggerIndex))) { // list = trigger chars where you might put a space after typing them
          return invoke(document, position, triggerIndex, '');
        }
        return [];
      }
      return invoke(document, position, position.character - 1, '');
    }
    const wordRange = document.getWordRangeAtPosition(position);
    const word = (!wordRange) ? '' : document.getText(wordRange);
    const triggerIndex = (!wordRange) ? position.character - 1 : wordRange.start.character - 1;
    return invoke(document, position, triggerIndex, word);
  }
}

async function invoke(document: TextDocument, position: Position, triggerIndex: number, word: string): Promise<CompletionItem[]> {
  switch (document.lineAt(position.line).text.charAt(triggerIndex)) {
    case '`': return completionTypeSelector(position);
    case '>': return completionByType(document, position, triggerIndex, word);
    case '[': return (document.uri.fsPath.endsWith('.rs2')) ? completionWithMatchid(word, TRIGGER.id, position.line) : searchForMatchType(document, position);
    case '^': return completionWithMatchid(word, CONSTANT.id, position.line);
    case '%': return completionWithMatchid(word, GLOBAL_VAR.id, position.line);
    case '~': return completionWithMatchid(word, PROC.id, position.line);
    case '@': return completionWithMatchid(word, LABEL.id, position.line);
    case '$': return completionWithMatchid(word, LOCAL_VAR.id, position.line);
    case ',': return searchForMatchType(document, position);
    case '(': return searchForMatchType(document, position);
    default: return searchForMatchType(document, position, COMMAND.id);
  }
}

function findTriggerIndex(line: string, start: number): number {
  let i = start;
  while (i >= 0 && line.charAt(i) === ' ') i--;
  return i;
}
