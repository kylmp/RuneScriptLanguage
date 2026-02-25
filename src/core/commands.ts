import type { ExtensionContext, QuickPickItem } from 'vscode';
import { commands, ExtensionMode, Position, Range, Selection, StatusBarAlignment, TextEditorRevealType, window, workspace } from 'vscode';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { getCacheKeys, serializeCache } from '../cache/identifierCache';
import { processAllFiles } from './manager';
import { showIdentifierLookupView } from '../webview/identifierLookupView';

/**
 * The interface for registering a new command. 
 * The id value must be the same value as the "command" value used to register the command in package.json
 * Set debugOnly to true if this command should not be available in normal production releases
 */
interface Command {
  id: string;
  debug?: { label: string };
  command: (...args: any[]) => Promise<void>;
}

/**
 * Register the commands - use during extension activation to register the commands depending on if dev mode or not
 * @param context Extension context
 */
export function registerCommands(context: ExtensionContext) {
  Object.values(extensionCommands)
    .filter(command => context.extensionMode === ExtensionMode.Development || !command.debug)
    .forEach(command => context.subscriptions.push(commands.registerCommand(command.id, command.command)));
  
  if (context.extensionMode === ExtensionMode.Development) {
    const item = window.createStatusBarItem('runescriptDebug', StatusBarAlignment.Right, 100);
    item.text = 'Runescript: Debug';
    item.command = 'RuneScriptLanguage.debugMenu';
    item.show();
    context.subscriptions.push(item);
  }
}

/**
 * The list of commands to be registered
 * Commands need to be added to package.json to show in the command palatte (use same id)
 * Important: Debug commands should NOT be added to package.json
 */
export const extensionCommands: Record<string, Command> = {
  rebuildCache: {
    id: 'RuneScriptLanguage.rebuildCache',
    command: rebuildCache
  },
  debugMenu: {
    id: 'RuneScriptLanguage.debugMenu',
    command: debugMenu
  },
  dumpCache: {
    id: 'RuneScriptLanguage.dumpCache',
    debug: { label: 'Dump full identifier cache' },
    command: dumpCache
  },
  dumpCacheKeys: {
    id: 'RuneScriptLanguage.dumpCacheKeys',
    debug: { label: 'Dump identifier cache keys' },
    command: dumpCacheKeys
  },
  lookupIdentifier: {
    id: 'RuneScriptLanguage.lookupIdentifier',
    debug: { label: 'Lookup identifier (webview)' },
    command: lookupIdentifier
  },
  jumpToMapSection: {
    id: 'RuneScriptLanguage.jumpToMapSection',
    command: jumpToMapSection
  }
};

/* ======================== COMMAND FUNCTIONS BELOW ======================== */

async function rebuildCache() {
  processAllFiles();
}

async function dumpCache() {
  void writeToFile(JSON.stringify(serializeCache(), undefined, 2), 'identifier cache', 'identifier-cache.json');
}

async function dumpCacheKeys() {
  void writeToFile(JSON.stringify(getCacheKeys(), undefined, 2), 'identifier cache keys', 'identifier-cache-keys.json');
}

async function lookupIdentifier() {
  showIdentifierLookupView();
}

async function jumpToMapSection(line?: number) {
  const editor = window.activeTextEditor;
  if (!editor || line === undefined) return;
  const position = new Position(line, 0);
  editor.selection = new Selection(position, position);
  editor.revealRange(new Range(position, position), TextEditorRevealType.AtTop);
}

interface DebugMenuItem extends QuickPickItem {
  commandId: string;
}

async function debugMenu() {
  const debugCommands: DebugMenuItem[] = Object.values(extensionCommands)
    .filter(command => command.debug)
    .map(command => ({ label: command.debug!.label, commandId: command.id }))
  const pick = await window.showQuickPick(debugCommands, {
    placeHolder: 'Runescript debug actions'
  });
  if (!pick) return;
  await commands.executeCommand(pick.commandId);
}

/* ======================== HELPER FUNCTIONS BELOW ======================== */

/**
 * Write data to a file. Prompts user for file name. Displays error/success message depending on outcome. 
 * @param dataToWrite The string of the data to write to the file
 * @param nameOfData The name of the data used for the info prompts and display messages
 * @param defaultFileName The default name to use for the file (pre-populated value when prompting for file name)
 */
async function writeToFile(dataToWrite: string, nameOfData: string, defaultFileName: string) {
  const workspaceFolder = workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    window.showErrorMessage('No workspace folder found to write the file to.');
    return;
  }
  const defaultName = defaultFileName;
  const fileName = await window.showInputBox({
    prompt: `Enter file name for ${nameOfData} dump`,
    value: defaultName
  });
  if (!fileName) {
    return;
  }
  const dumpPath = join(workspaceFolder.uri.fsPath, fileName);
  await writeFile(dumpPath, dataToWrite, 'utf8');
  window.showInformationMessage(`${nameOfData} written to ${dumpPath}`);
}
