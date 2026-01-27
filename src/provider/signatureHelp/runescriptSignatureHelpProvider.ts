import type { Position, SignatureHelpProvider, SignatureHelpProviderMetadata, TextDocument } from 'vscode';
import { ParameterInformation, SignatureHelp, SignatureInformation } from 'vscode';
import { TRIGGER, UNKNOWN } from '../../matching/matchType';
import { runescriptTrigger } from '../../resource/triggers';
import { waitForActiveFileRebuild } from '../../core/eventHandlers';
import { getCallStateAtPosition } from '../../parsing/lineParser';
import { getCallIdentifier } from '../../cache/activeFileCache';

export const signatureMetadata: SignatureHelpProviderMetadata = {
  triggerCharacters: ['(', ',', '['],
  retriggerCharacters: [',']
}

export const signatureHelpProvider: SignatureHelpProvider = {
  provideSignatureHelp(document: TextDocument, position: Position) {
    const triggerHelp = getScriptTriggerHelp(document, position);
    if (triggerHelp) {
      return triggerHelp;
    }
    return getParametersHelp(document, position);
  }
}

/**
 * Returns a "signature" help for showing what type type when writting script trigger lines
 * @param document document to find build the signature help for
 * @param position position within the document to build the corresponding signature help for
 * @returns the signature help built, if any
 */
function getScriptTriggerHelp(document: TextDocument, position: Position): SignatureHelp | undefined {
  let matchTypeId = UNKNOWN.id;
  let signatureInfo: SignatureInformation | undefined;
  const str = document.lineAt(position.line).text;
  if (str.charAt(0) === '[') {
    if (position.character > str.indexOf(']')) {
      return undefined;
    }
    const split = str.split(',');
    if (split.length > 1) {
      const triggerName = split[0].substring(1);
      const trigger = runescriptTrigger[triggerName];
      if (trigger) {
        matchTypeId = trigger.declaration ? UNKNOWN.id : trigger.match.id;
        const matchLabel = matchTypeId === UNKNOWN.id ? `script_name` : matchTypeId.toLowerCase();
        signatureInfo = new SignatureInformation(`script [${triggerName},${matchLabel}]`);
        signatureInfo.parameters.push(new ParameterInformation(triggerName));
        signatureInfo.parameters.push(new ParameterInformation(matchLabel));
        signatureInfo.activeParameter = 1;
      }
    } else {
      matchTypeId = TRIGGER.id;
      signatureInfo = new SignatureInformation('script [trigger,value]');
      signatureInfo.parameters.push(new ParameterInformation('trigger'));
      signatureInfo.parameters.push(new ParameterInformation('value'));
      signatureInfo.activeParameter = 0;
    }
  }
  if (signatureInfo) {
    const signatureHelp = new SignatureHelp();
    signatureHelp.signatures.push(signatureInfo);
    signatureHelp.activeSignature = 0;
    return signatureHelp;
  }
}

let lastRequestId = 0;

/**
 * Returns a signature help for the signature of the call function user is typing in (if any)
 * @param document document to find signature for
 * @param position position within the document to find the corresponding signature help for
 * @returns the signature help object, if any
 */
async function getParametersHelp(document: TextDocument, position: Position): Promise<SignatureHelp | undefined> {
  // We need the parser and active file cache states up to date
  const requestId = ++lastRequestId;
  await waitForActiveFileRebuild(document);
  if (requestId !== lastRequestId) return undefined; // guard debounce, only continue with 1 result

  // Get the callState at the position in the line of text to get the call info and param index
  const callState = getCallStateAtPosition(document.lineAt(position.line).text, position.line, document.uri, position.character);
  if (!callState?.callName || callState.callNameIndex === undefined || callState.callNameIndex < 0 || callState.paramIndex === undefined) {
    return undefined;
  }

  // Retrieve the call identifier from the active file cache to access its signature
  const identifier = getCallIdentifier(position.line, callState.callName, callState.callNameIndex);
  if (!identifier?.signature) {
    return undefined;
  }

  // Build useful flags and display warning for commands that don't take params if attempted
  const hasParams = (identifier.signature.params ?? []).length > 0;
  const hasReturnTypes = (identifier.signature.returns ?? []).length > 0;
  if (!hasParams) {
    return displayMessage(`${identifier.matchId} ${identifier.name} has no parameters, remove the parenthesis`);
  }

  // Build the signature info and label
  const label = `${identifier.name}(${identifier.signature.paramsText})${hasReturnTypes ? `: ${identifier.signature.returnsText}` : ''}`;
  const signatureInfo = new SignatureInformation(label);
  identifier.signature.paramsText.split(',').forEach(param => signatureInfo.parameters.push(new ParameterInformation(param.trim())));
  signatureInfo.activeParameter = callState.paramIndex;

  // Build the signature help
  const signatureHelp = new SignatureHelp();
  signatureHelp.signatures.push(signatureInfo);
  signatureHelp.activeSignature = 0;
  return signatureHelp;
}

/**
 * Returns a signature help which only displays a simple message, useful for displaying warnings or errors
 * @param message Message to display
 */
function displayMessage(message: string): SignatureHelp {
  const signatureInfo = new SignatureInformation(message);
  const signatureHelp = new SignatureHelp();
  signatureHelp.signatures.push(signatureInfo);
  signatureHelp.activeSignature = 0;
  return signatureHelp;
}
