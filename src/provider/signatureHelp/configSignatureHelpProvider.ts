import type { Position, TextDocument} from 'vscode';
import { ParameterInformation, SignatureHelp, SignatureInformation } from 'vscode';
import { buildMatchContext } from '../../utils/matchUtils';
import { waitForActiveFileRebuild } from '../../core/eventHandlers';
import { parseLineWithStateSnapshot } from '../../parsing/lineParser';
import { getFileInfo } from '../../utils/fileUtils';
import { getConfigLineMatch } from '../../matching/matchers/configMatcher';

let lastRequestId = 0;

export const configMetadata = {
  triggerCharacters: ['=', ','],
  retriggerCharacters: [',']
}

export const configHelpProvider = {
  async provideSignatureHelp(document: TextDocument, position: Position) {
    // Try to find a config line match for current cursor position to display signature help for
    const requestId = ++lastRequestId;
    await waitForActiveFileRebuild(document);
    if (requestId !== lastRequestId) return undefined; // guard debounce, only continue with 1 result
    let str = document.lineAt(position.line).text;
    str = str.substring(0, position.character) + 'temp' + str.substring(position.character);
    const parsedWords = parseLineWithStateSnapshot(str, position.line, document.uri);
    const wordIndex = parsedWords.findIndex(w => w.start <= position.character && w.end >= position.character);
    if (wordIndex < 0) return undefined;
    const config = getConfigLineMatch(buildMatchContext(document.uri, parsedWords, document.lineAt(position.line).text, position.line, wordIndex, getFileInfo(document.uri)))
    if (!config) return undefined;

    //Build the signature info
    const signatureInfo = new SignatureInformation(`${config.key}=${config.params.join(',')}`);
    let index = config.key.length + 1; // starting line character index of params (+1 for the '=')
    config.params.forEach(paramName => {
      signatureInfo.parameters.push(new ParameterInformation([index, index + paramName.length]));
      index += paramName.length + 1; // increment index by the length of the param name (+1 for the ',')
    });
    signatureInfo.activeParameter = config.index - 1;

    // Build the signature help
    const signatureHelp = new SignatureHelp();
    signatureHelp.signatures.push(signatureInfo);
    signatureHelp.activeSignature = 0;
    return signatureHelp;
  }
}
