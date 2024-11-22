const { VALUE, SIGNATURE, CODEBLOCK, TITLE, INFO } = require("../enum/hoverDisplay");
const { option } = require('./displayConfig');
const postProcessors = require('./postProcessors');

// Match types define the possible types of identifiers that can be found. The config for a match type tells the extension 
// all the necessary data it needs for finding declarations, building hover texts, and finding references.
//
// id, types[], displayConfig{}, declarationConfig{}, referenceConfig{} are required
// postProcessor is optional, if an identifier with this matchType requires any special post processing, this can be added

const matchType = {
  UNKNOWN: {id: 'UNKNOWN'},
  LOCAL_VAR: {
    id: 'LOCAL_VAR', types: [], 
    displayConfig: {},
    declarationConfig: config('$NAME', ['rs2']), 
    referenceConfig: config('$NAME')
  },
  GLOBAL_VAR: {
    id: 'GLOBAL_VAR', types: [], 
    displayConfig: {[option.LANGUAGE]: 'varpconfig'},
    declarationConfig: config('[NAME]', ['varp', 'vars', 'varn'], [TITLE]),
    referenceConfig: config('%NAME', ['rs2', 'obj', 'npc', 'enum', 'inv', 'dbrow', 'param', 'hunt'], [TITLE, INFO, CODEBLOCK])
  },
  CONSTANT: {
    id: 'CONSTANT', types: [], 
    displayConfig: {[option.LANGUAGE]: 'constants', [option.BLOCK_SKIP_LINES]: 0},
    declarationConfig: config('^NAME', ['constant'], [TITLE]),
    referenceConfig: config('^NAME', ['rs2', 'obj', 'npc', 'enum', 'inv', 'dbrow', 'param', 'hunt'], [TITLE, INFO, CODEBLOCK])
  },
  LABEL: {
    id: 'LABEL', types: ['label'], 
    displayConfig: {},
    declarationConfig: config('[label,NAME]', ['rs2'], [TITLE, SIGNATURE]),
    referenceConfig: config('@NAME', ['rs2'], [TITLE, INFO, SIGNATURE])
  },
  PROC: {
    id: 'PROC', types: ['proc'], 
    displayConfig: {},
    declarationConfig: config('[proc,NAME]', ['rs2'], [TITLE, SIGNATURE]),
    referenceConfig: config('~NAME', ['rs2'], [TITLE, INFO, SIGNATURE])
  },
  TIMER: {
    id: 'TIMER', types: ['timer'], 
    displayConfig: {},
    declarationConfig: config('[timer,NAME]', ['rs2'], [TITLE, SIGNATURE]),
    referenceConfig: config('NAME', ['rs2'], [TITLE, INFO, SIGNATURE])
  },
  SOFTTIMER: {
    id: 'SOFTTIMER', types: ['softtimer'], 
    displayConfig: {},
    declarationConfig: config('[softtimer,NAME]', ['rs2'], [TITLE, SIGNATURE]),
    referenceConfig: config('NAME', ['rs2'], [TITLE, INFO, SIGNATURE])
  },
  QUEUE: {
    id: 'QUEUE', types: ['queue'], 
    displayConfig: {},
    declarationConfig: config('[queue,NAME]', ['rs2'], [TITLE, SIGNATURE]),
    referenceConfig: config('NAME', ['rs2'], [TITLE, INFO, SIGNATURE]),
    postProcessor: postProcessors.queuePostProcessor
  },
  SEQ: {
    id: 'SEQ', types: ['seq'], 
    displayConfig: {[option.LANGUAGE]: 'seqconfig'},
    declarationConfig: config('[NAME]', ['seq'], [TITLE]),
    referenceConfig: config('NAME', ['rs2', 'spotanim', 'loc', 'npc'], [TITLE, INFO])
  },
  SPOTANIM: {
    id: 'SPOTANIM', types: ['spotanim'], 
    displayConfig: {[option.LANGUAGE]: 'spotanimconfig'},
    declarationConfig: config('[NAME]', ['spotanim'], [TITLE]),
    referenceConfig: config('NAME', ['rs2'], [TITLE, INFO])
  },
  HUNT: {
    id: 'HUNT', types: ['hunt'], 
    displayConfig: {[option.LANGUAGE]: 'huntconfig', [option.CONFIG_INCLUSIONS]: ['type']},
    declarationConfig: config('[NAME]', ['hunt'], [TITLE]),
    referenceConfig: config('NAME', ['rs2'], [TITLE, INFO, CODEBLOCK])
  },
  LOC: {
    id: 'LOC', types: ['loc'], 
    displayConfig: {[option.LANGUAGE]: 'locconfig', [option.CONFIG_INCLUSIONS]: ['name', 'desc', 'category']},
    declarationConfig: config('[NAME]', ['loc'], [TITLE]),
    referenceConfig: config('NAME', ['rs2'], [TITLE, INFO, CODEBLOCK])
  },
  NPC: {
    id: 'NPC', types: ['npc'], 
    displayConfig: {[option.LANGUAGE]: 'npcconfig', [option.CONFIG_INCLUSIONS]: ['name', 'desc', 'category']},
    declarationConfig: config('[NAME]', ['npc'], [TITLE]),
    referenceConfig: config('NAME', ['rs2'], [TITLE, INFO, CODEBLOCK])
  },
  OBJ: {
    id: 'OBJ', types: ['namedobj', 'obj'], 
    displayConfig: {[option.LANGUAGE]: 'objconfig', [option.CONFIG_INCLUSIONS]: ['name', 'desc', 'category']},
    declarationConfig: config('[NAME]', ['obj'], [TITLE]),
    referenceConfig: config('NAME', ['rs2', 'inv'], [TITLE, INFO, CODEBLOCK])
  },
  INV: {
    id: 'INV', types: ['inv'], 
    displayConfig: {[option.LANGUAGE]: 'invconfig'},
    declarationConfig: config('[NAME]', ['inv'], [TITLE]),
    referenceConfig: config('NAME', ['rs2', 'inv'], [TITLE, INFO, CODEBLOCK])
  },
  ENUM: {
    id: 'ENUM', types: ['enum'], 
    displayConfig: {[option.LANGUAGE]: 'enumconfig', [option.CONFIG_INCLUSIONS]: ['inputtype', 'outputtype']},
    declarationConfig: config('[NAME]', ['enum'], [TITLE]),
    referenceConfig: config('NAME', ['rs2'], [TITLE, INFO, CODEBLOCK])
  },
  DBROW: {
    id: 'DBROW', types: ['dbrow'], 
    displayConfig: {[option.LANGUAGE]: 'dbrowconfig'},
    declarationConfig: config('[NAME]', ['dbrow'], [TITLE]),
    referenceConfig: config('NAME', ['rs2'], [TITLE, INFO, CODEBLOCK])
  },
  DBTABLE: {
    id: 'DBTABLE', types: ['dbtable'], 
    displayConfig: {[option.LANGUAGE]: 'dbtableconfig'},
    declarationConfig: config('[NAME]', ['dbtable'], [TITLE]),
    referenceConfig: config('NAME', ['rs2', 'dbrow'], [TITLE, INFO, CODEBLOCK])
  },
  INTERFACE: {
    id: 'INTERFACE', types: ['interface'], 
    displayConfig: {[option.LANGUAGE]: 'interface'},
    declarationConfig: config('FILE', ['if'], [TITLE], 'NAME.if'), // with format="FILE" will search only for files, not text within file(s) and return the first one found
    referenceConfig: config('NAME', ['rs2'], [TITLE])
  },
  PARAM: {
    id: 'PARAM', types: ['param'], 
    displayConfig: {[option.LANGUAGE]: 'paramconfig'},
    declarationConfig: config('[NAME]', ['param'], [TITLE]),
    referenceConfig: config('NAME', ['rs2', 'loc', 'npc', 'hunt', 'struct', 'obj'], [TITLE, INFO, CODEBLOCK])
  },
  COMMAND: {
    id: 'COMMAND', types: [], 
    displayConfig: {},
    declarationConfig: config('NAME', ['rs2'], [], 'engine.rs2'),
    referenceConfig: config('NAME(', ['rs2'], [TITLE, INFO, SIGNATURE])
  },
  SYNTH: {
    id: 'SOUND_SYNTH', types: ['synth'], 
    displayConfig: {},
    declarationConfig: config('NAME', ['synth'], [], 'sound.pack'),
    referenceConfig: config('NAME', ['rs2'], [TITLE])
  },
  WALKTRIGGER: {
    id: 'WALKTRIGGER', types: ['walktrigger'], 
    displayConfig: {},
    declarationConfig: config('[walktrigger,NAME]', ['rs2'], [TITLE, SIGNATURE]),
    referenceConfig: config('NAME', ['rs2'], [TITLE, INFO, SIGNATURE])
  },
  IDK: {
    id: 'IDK', types: ['idk', 'idkit'], 
    displayConfig: {[option.LANGUAGE]: 'idkconfig'},
    declarationConfig: config('[NAME]', ['idk'], [TITLE]),
    referenceConfig: config('NAME', ['rs2'], [TITLE, INFO, CODEBLOCK])
  },
  MESANIM: {
    id: 'MESANIM', types: ['mesanim'], 
    displayConfig: {[option.LANGUAGE]: 'mesanimconfig'},
    declarationConfig: config('[NAME]', ['mesanim'], [TITLE]),
    referenceConfig: config('<p,NAME>', ['rs2'], [TITLE, INFO])
  },
  COORDINATES: {
    id: 'COORDINATES', types: [], hoverOnly: true, 
    referenceConfig: config(null, null, [TITLE, VALUE]),
    postProcessor: postProcessors.coordPostProcessor
  },
};

function config(format, fileTypesToSearch, hoverDisplayItems=[], fileToSearch=null) {
  // Only define fileToSearch if ALL declarations are found in that file (ex: ALL commands defined in engine.rs2)
  return {format: format, fileTypes: fileTypesToSearch, displayItems: hoverDisplayItems, file: fileToSearch};
}

module.exports = matchType;