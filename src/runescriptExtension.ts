import type { ExtensionContext } from 'vscode';
import { initializeExtension } from './core/manager';

/**
 * Lanugages this extension is interested in
 */
export const languageIds = new Set<string>([
  'runescript','locconfig','objconfig','npcconfig','dbtableconfig','dbrowconfig','paramconfig','structconfig',
  'enumconfig','varpconfig','varbitconfig','varnconfig','varsconfig','invconfig','seqconfig','spotanimconfig',
  'mesanimconfig','idkconfig','huntconfig','constants','interface','pack','floconfig'
]);

/**
 * Runs when the extension is activated
 */
export function activate(context: ExtensionContext) {
  initializeExtension(context);
}
