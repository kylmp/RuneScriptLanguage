import type { Position, TextDocument} from 'vscode';
import { ParameterInformation, SignatureHelp, SignatureInformation } from 'vscode';
import { buildMatchContext } from '../../utils/matchUtils';
import { forceRebuild } from '../../core/eventHandlers';
import { parseLineWithStateSnapshot } from '../../parsing/lineParser';
import { getFileInfo } from '../../utils/fileUtils';
import { getConfigLineMatch } from '../../matching/matchers/configMatcher';

export const configMetadata = {
  triggerCharacters: ['=', ','],
  retriggerCharacters: [',']
}

export const configHelpProvider = {
  async provideSignatureHelp(document: TextDocument, position: Position) {
    let str = document.lineAt(position.line).text;
    str = str.substring(0, position.character) + 'temp' + str.substring(position.character);
    await forceRebuild(document);
    const parsedWords = parseLineWithStateSnapshot(str, position.line, document.uri);
    const wordIndex = parsedWords.findIndex(w => w.start <= position.character && w.end >= position.character);
    const config = getConfigLineMatch(buildMatchContext(document.uri, parsedWords, document.lineAt(position.line).text, position.line, wordIndex, getFileInfo(document.uri)))
    if (!config) return undefined;

    //Build the signature info
    const signatureInfo = new SignatureInformation(`${config.key}=${config.params.join(',')}`);
    let index = config.key.length + 1; // Starting index of params
    config.params.forEach(param => {
      // use range instead of param name due to possible duplicates
      signatureInfo.parameters.push(new ParameterInformation([index, index + param.length]));
      index += param.length + 1;
    });
    signatureInfo.activeParameter = config.index;

    // Build the signature help
    const signatureHelp = new SignatureHelp();
    signatureHelp.signatures.push(signatureInfo);
    signatureHelp.activeSignature = 0;
    return signatureHelp;
  }
}
