import type { ExtensionContext } from 'vscode';
import { getAllMatchTypes } from './matching/matchType';
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
 * Runescript type keywords
 */
export const typeKeywords = new Set<string>([
  'int','string','boolean','seq','locshape','component','idk','midi','npc_mode','namedobj','synth','stat',
  'npc_stat','fontmetrics','enum','loc','model','npc','obj','player_uid','spotanim','npc_uid','inv','category',
  'struct','dbrow','interface','dbtable','coord','mesanim','param','queue','weakqueue','timer','softtimer',
  'char','dbcolumn','proc','label'
])

/**
* Files which this extension is interested in
*/
export const monitoredFileTypes = new Set<string>();
function buildMonitoredFileTypes(): void {
  monitoredFileTypes.add('pack');
  getAllMatchTypes().filter(match => !match.referenceOnly).forEach(match => {
    const fileTypes = match.fileTypes || [];
    for (const fileType of fileTypes) {
      monitoredFileTypes.add(fileType);
    }
  });
}

/**
 * Runs when the extension is activated
 */
export function activate(context: ExtensionContext) {
  buildMonitoredFileTypes();
  initializeExtension(context);
}
