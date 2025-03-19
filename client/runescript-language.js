const vscode = require('vscode');
const hoverProvider = require('./provider/hoverProvider');
const recolorProvider = require('./provider/recolorProvider');
const definitionProvider = require('./provider/gotoDefinition');
const referenceProvider = require('./provider/referenceProvider');
const renameProvider = require('./provider/renameProvider');
const cacheManager = require('./cache/cacheManager');
const commands = require('./provider/vscodeCommands');
const signatureHelp = require('./provider/signatureHelpProvider');
const configHelp = require('./provider/configHelpProvider');
const completionProvider = require('./provider/completionProvider');

const languages = ['runescript','locconfig','objconfig','npcconfig','dbtableconfig','dbrowconfig','paramconfig','structconfig','enumconfig','varpconfig','varnconfig','varsconfig','invconfig','seqconfig','spotanimconfig','mesanimconfig','idkconfig','huntconfig','constants','interface','pack'];

function parseRuneScript(script) {
    const dropTable = [];
    const lines = script.split("\n");
    let previousThreshold = 0;
    
    for (const line of lines) {
      const match = line.match(/\$random < (\d+)\) {\s*obj_add\([^,]+, ([^,]+), ([^,]+), [^,]+\);/);
      
      if (match) {
        const threshold = parseInt(match[1], 10);
        const object = match[2].trim();
        const amount = isNaN(Number(match[3])) ? match[3].trim() : Number(match[3]);
        const dropRate = ((threshold - previousThreshold) / 128) * 100;
        
        dropTable.push({ object, amount, dropRate });
        previousThreshold = threshold;
      }
    }
    
    return dropTable;
  }

function activate(context) {


const runeScript = `
def_int $random = random(128);

if ($random < 4) {
    obj_add(npc_coord, mithril_2h_sword, 1, ^lootdrop_duration);
} else if ($random < 7) {
    obj_add(npc_coord, mithril_axe, 1, ^lootdrop_duration);
} else if ($random < 10) {
    obj_add(npc_coord, mithril_battleaxe, 1, ^lootdrop_duration);
} else if ($random < 13) {
    obj_add(npc_coord, rune_dart, 8, ^lootdrop_duration);
} else if ($random < 14) {
    obj_add(npc_coord, mithril_javelin, 20, ^lootdrop_duration);
} else if ($random < 15) {
    obj_add(npc_coord, mithril_kiteshield, 1, ^lootdrop_duration);
} else if ($random < 16) {
    obj_add(npc_coord, adamant_platebody, 1, ^lootdrop_duration);
} else if ($random < 17) {
    obj_add(npc_coord, rune_longsword, 1, ^lootdrop_duration);
} else if ($random < 25) {
    obj_add(npc_coord, rune_arrow, 4, ^lootdrop_duration);
} else if ($random < 30) {
    obj_add(npc_coord, lawrune, 4, ^lootdrop_duration);
} else if ($random < 34) {
    obj_add(npc_coord, bloodrune, 2, ^lootdrop_duration);
} else if ($random < 37) {
    obj_add(npc_coord, deathrune, 5, ^lootdrop_duration);
} else if ($random < 39) {
    obj_add(npc_coord, ~randomherb, ^lootdrop_duration);
} else if ($random < 79) {
    obj_add(npc_coord, coins, 196, ^lootdrop_duration);
} else if ($random < 108) {
    obj_add(npc_coord, coins, 66, ^lootdrop_duration);
} else if ($random < 118) { // If we ever get there, this is replaced by "Dragon javelin heads" when MMII is completed, oh what a dream eh?
    obj_add(npc_coord, coins, 330, ^lootdrop_duration);
} else if ($random < 119) {
    obj_add(npc_coord, coins, 690, ^lootdrop_duration);
} else if ($random < 122) {
    obj_add(npc_coord, chocolate_cake, 3, ^lootdrop_duration);
} else if ($random < 123) {
    obj_add(npc_coord, adamantite_bar, 1, ^lootdrop_duration);
} else if ($random < 128) {
    obj_add(npc_coord, ~randomjewel, ^lootdrop_duration);
}
`;

console.log(parseRuneScript(runeScript));


    // Register commands created by this extension
    Object.keys(commands).forEach(key => 
        context.subscriptions.push(vscode.commands.registerCommand(commands[key].id, commands[key].command)));

    // Populate cache on extension activation
    vscode.commands.executeCommand(commands.rebuildCache.id); 

    // Cache processing event handlers for git branch changes, updating files, create/rename/delete files
    vscode.workspace.createFileSystemWatcher('**/.git/HEAD').onDidCreate(() => vscode.commands.executeCommand(commands.rebuildCache.id));
    vscode.workspace.onDidSaveTextDocument(saveDocumentEvent => cacheManager.rebuildFile(saveDocumentEvent.uri));
    vscode.workspace.onDidChangeTextDocument(() => cacheManager.rebuildActiveFile());
    vscode.window.onDidChangeActiveTextEditor(() => cacheManager.rebuildActiveFile());
    vscode.workspace.onDidDeleteFiles(filesDeletedEvent => cacheManager.clearFiles(filesDeletedEvent.files));
    vscode.workspace.onDidRenameFiles(filesRenamedEvent => cacheManager.renameFiles(filesRenamedEvent.files));
    vscode.workspace.onDidCreateFiles(filesCreatedEvent => cacheManager.createFiles(filesCreatedEvent.files));

    // Register providers (hover, rename, recolor, definition, reference)
    for (const language of languages) {
        vscode.languages.registerHoverProvider(language, hoverProvider(context));
        vscode.languages.registerRenameProvider(language, renameProvider);
        vscode.languages.registerCompletionItemProvider(language, completionProvider.provider, ...completionProvider.triggers);
        context.subscriptions.push(vscode.languages.registerDefinitionProvider(language, definitionProvider));
        context.subscriptions.push(vscode.languages.registerReferenceProvider(language, referenceProvider));
        if (language.endsWith('config')) {
            vscode.languages.registerColorProvider(language, recolorProvider);
            vscode.languages.registerSignatureHelpProvider(language, configHelp.provider, configHelp.metadata);
        }
    }
    vscode.languages.registerSignatureHelpProvider('runescript', signatureHelp.provider, signatureHelp.metadata);
}

function deactivate() {
    cacheManager.clearAll();
 }

module.exports = {
    activate,
    deactivate
};
