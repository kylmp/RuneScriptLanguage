import type { CompletionItem, Position, CancellationToken, CompletionContext, TextDocument, CompletionItemProvider } from 'vscode';
import { CompletionTriggerKind } from 'vscode';
import { CONFIG_KEY } from '../../matching/matchType';
import { completionByType, completionTypeSelector, doubleBacktickTrigger, searchForMatchType } from './completetionCommon';

export const completionTriggers = ['=', ',', '`', '>'];

export const completionProvider: CompletionItemProvider<CompletionItem> = {
  async provideCompletionItems(document: TextDocument, position: Position, _cancellationToken: CancellationToken, context: CompletionContext): Promise<CompletionItem[]> {
    if (context.triggerKind === CompletionTriggerKind.TriggerCharacter) {
      if (doubleBacktickTrigger(document, position, context.triggerCharacter)) {
        return searchForMatchType(document, position, CONFIG_KEY.id, true);
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
    case ',': return searchForMatchType(document, position);
    case '=': return searchForMatchType(document, position);
    default: return searchForMatchType(document, position, CONFIG_KEY.id);
  }
}
