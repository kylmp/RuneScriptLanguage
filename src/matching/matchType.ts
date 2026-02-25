import type { MatchType } from '../types';
import { globalVarPostProcessor, enumPostProcessor, columnPostProcessor, rowPostProcessor, componentPostProcessor,
  fileNamePostProcessor, coordPostProcessor, configKeyPostProcessor, triggerPostProcessor, categoryPostProcessor, 
  paramPostProcessor,
  localVarPostProcessor,
  procPostProcessor,
  commandPostProcessor} from '../resource/postProcessors';
import { CODEBLOCK, INFO, SIGNATURE, TITLE, VALUE } from "../enum/hoverDisplayItems";
import { SemanticTokenType } from '../enum/semanticTokens';
import { Type } from '../enum/type';

const matchTypesById = new Map<string, MatchType>();

function defineMatchType(match: MatchType): MatchType {
  matchTypesById.set(match.id, match);
  return match;
}

export const LOCAL_VAR: MatchType = defineMatchType({
  id: 'LOCAL_VAR', types: [], fileTypes: ['rs2'], cache: false, allowRename: true,
  hoverConfig: { declarationItems: [TITLE, CODEBLOCK], referenceItems: [TITLE, CODEBLOCK], language: 'runescript', blockSkipLines: 0 },
  postProcessor: localVarPostProcessor
});

export const GLOBAL_VAR: MatchType = defineMatchType({
  id: 'GLOBAL_VAR', types: [Type.Var], fileTypes: ['varp', 'varbit', 'vars', 'varn'], cache: true, allowRename: true,
  hoverConfig: { declarationItems: [TITLE, INFO], referenceItems: [TITLE, INFO, CODEBLOCK], language: 'varpconfig' },
  postProcessor: globalVarPostProcessor
});

export const CONSTANT: MatchType = defineMatchType({
  id: 'CONSTANT', types: [], fileTypes: ['constant'], cache: true, allowRename: true,
  hoverConfig: { declarationItems: [TITLE, INFO, VALUE], referenceItems: [TITLE, INFO, VALUE, CODEBLOCK], language: 'constants', blockSkipLines: 0 },
});

export const LABEL: MatchType = defineMatchType({
  id: 'LABEL', types: [Type.Label], fileTypes: ['rs2'], cache: true, allowRename: true, callable: true, comparisonType: Type.Label,
  hoverConfig: { declarationItems: [TITLE, INFO, SIGNATURE], referenceItems: [TITLE, INFO, SIGNATURE] },
});

export const PROC: MatchType = defineMatchType({
  id: 'PROC', types: [Type.Proc], fileTypes: ['rs2'], cache: true, allowRename: true, callable: true, 
  hoverConfig: { declarationItems: [TITLE, INFO, SIGNATURE], referenceItems: [TITLE, INFO, SIGNATURE] },
  postProcessor: procPostProcessor
});

export const TIMER: MatchType = defineMatchType({
  id: 'TIMER', types: [Type.Timer], fileTypes: ['rs2'], cache: true, allowRename: true, callable: true, comparisonType: Type.Timer,
  hoverConfig: { declarationItems: [TITLE, INFO, SIGNATURE], referenceItems: [TITLE, INFO, SIGNATURE] },
});

export const SOFTTIMER: MatchType = defineMatchType({
  id: 'SOFTTIMER', types: [Type.Softtimer], fileTypes: ['rs2'], cache: true, allowRename: true, callable: true, comparisonType: Type.Softtimer,
  hoverConfig: { declarationItems: [TITLE, INFO, SIGNATURE], referenceItems: [TITLE, INFO, SIGNATURE] },
});

export const QUEUE: MatchType = defineMatchType({
  id: 'QUEUE', types: [Type.Queue], fileTypes: ['rs2'], cache: true, allowRename: true, callable: true, comparisonType: Type.Queue,
  hoverConfig: { declarationItems: [TITLE, INFO, SIGNATURE], referenceItems: [TITLE, INFO, SIGNATURE] },
});

export const SEQ: MatchType = defineMatchType({
  id: 'SEQ', types: [Type.Seq], fileTypes: ['seq'], cache: true, allowRename: true, comparisonType: Type.Seq,
  hoverConfig: { declarationItems: [TITLE, INFO], referenceItems: [TITLE, INFO], language: 'seqconfig' },
});

export const SPOTANIM: MatchType = defineMatchType({
  id: 'SPOTANIM', types: [Type.Spotanim], fileTypes: ['spotanim'], cache: true, allowRename: true, comparisonType: Type.Spotanim,
  hoverConfig: { declarationItems: [TITLE, INFO], referenceItems: [TITLE, INFO], language: 'spotanimconfig' },
});

export const HUNT: MatchType = defineMatchType({
  id: 'HUNT', types: [Type.Hunt], fileTypes: ['hunt'], cache: true, allowRename: true, comparisonType: Type.Hunt,
  hoverConfig: { declarationItems: [TITLE, INFO], referenceItems: [TITLE, INFO, CODEBLOCK], language: 'huntconfig', configInclusions: ['type'] },
});

export const LOC: MatchType = defineMatchType({
  id: 'LOC', types: [Type.Loc], fileTypes: ['loc'], cache: true, allowRename: true, comparisonType: Type.Loc,
  hoverConfig: { declarationItems: [TITLE, INFO], referenceItems: [TITLE, INFO, CODEBLOCK], language: 'locconfig', configInclusions: ['name', 'desc', 'category'] },
  semanticTokenConfig: { declaration: SemanticTokenType.Function },
});

export const NPC: MatchType = defineMatchType({
  id: 'NPC', types: [Type.Npc], fileTypes: ['npc'], cache: true, allowRename: true, comparisonType: Type.Npc,
  hoverConfig: { declarationItems: [TITLE, INFO], referenceItems: [TITLE, INFO, CODEBLOCK], language: 'npcconfig', configInclusions: ['name', 'desc', 'category'] },
});

export const OBJ: MatchType = defineMatchType({
  id: 'OBJ', types: [Type.Namedobj, Type.Obj], fileTypes: ['obj'], cache: true, allowRename: true, comparisonType: Type.Obj,
  hoverConfig: { declarationItems: [TITLE, INFO], referenceItems: [TITLE, INFO, CODEBLOCK], language: 'objconfig', configInclusions: ['name', 'desc', 'category'] },
});

export const INV: MatchType = defineMatchType({
  id: 'INV', types: [Type.Inv], fileTypes: ['inv'], cache: true, allowRename: true, comparisonType: Type.Inv,
  hoverConfig: { declarationItems: [TITLE, INFO], referenceItems: [TITLE, INFO, CODEBLOCK], language: 'invconfig', configInclusions: ['scope', 'size'] },
  semanticTokenConfig: { declaration: SemanticTokenType.Function, reference: SemanticTokenType.Property },
});

export const ENUM: MatchType = defineMatchType({
  id: 'ENUM', types: [Type.Enum], fileTypes: ['enum'], cache: true, allowRename: true,
  hoverConfig: { declarationItems: [TITLE, INFO], referenceItems: [TITLE, INFO, CODEBLOCK], language: 'enumconfig', configInclusions: ['inputtype', 'outputtype'] },
  postProcessor: enumPostProcessor
});

export const DBCOLUMN: MatchType = defineMatchType({
  id: 'DBCOLUMN', types: [Type.Dbcolumn], fileTypes: ['dbtable'], cache: true, allowRename: true, comparisonType: Type.Dbcolumn,
  hoverConfig: { declarationItems: [TITLE, INFO, CODEBLOCK], referenceItems: [TITLE, INFO, CODEBLOCK], language: 'runescript', blockSkipLines: 0 },
  postProcessor: columnPostProcessor
});

export const DBROW: MatchType = defineMatchType({
  id: 'DBROW', types: [Type.Dbrow], fileTypes: ['dbrow'], cache: true, allowRename: true, comparisonType: Type.Dbrow,
  hoverConfig: { declarationItems: [TITLE, INFO], referenceItems: [TITLE, INFO, CODEBLOCK], language: 'dbrowconfig', configInclusions: ['table'] },
  semanticTokenConfig: { declaration: SemanticTokenType.Function },
  postProcessor: rowPostProcessor
});

export const DBTABLE: MatchType = defineMatchType({
  id: 'DBTABLE', types: [Type.Dbtable], fileTypes: ['dbtable'], cache: true, allowRename: true, comparisonType: Type.Dbtable,
  hoverConfig: { declarationItems: [TITLE, INFO], referenceItems: [TITLE, INFO, CODEBLOCK], language: 'dbtableconfig' },
});

export const INTERFACE: MatchType = defineMatchType({
  id: 'INTERFACE', types: [Type.Interface], fileTypes: ['if'], cache: true, allowRename: false, referenceOnly: true, comparisonType: Type.Interface,
  hoverConfig: { referenceItems: [TITLE, INFO], language: 'interface' },
  postProcessor: fileNamePostProcessor
});

export const COMPONENT: MatchType = defineMatchType({
  id: 'COMPONENT', types: [Type.Component], fileTypes: ['if'], cache: true, allowRename: true, comparisonType: Type.Component,
  hoverConfig: { declarationItems: [TITLE, INFO], referenceItems: [TITLE, INFO], language: 'interface' },
  postProcessor: componentPostProcessor
});

export const PARAM: MatchType = defineMatchType({
  id: 'PARAM', types: [Type.Param], fileTypes: ['param'], cache: true, allowRename: true,
  hoverConfig: { declarationItems: [TITLE, INFO], referenceItems: [TITLE, INFO, CODEBLOCK], language: 'paramconfig' },
  postProcessor: paramPostProcessor
});

export const COMMAND: MatchType = defineMatchType({
  id: 'COMMAND', types: [], fileTypes: ['rs2'], cache: true, allowRename: false, callable: true, 
  hoverConfig: { declarationItems: [TITLE, INFO, SIGNATURE], referenceItems: [TITLE, INFO, SIGNATURE] },
  semanticTokenConfig: { declaration: SemanticTokenType.Function, reference: SemanticTokenType.Function },
  postProcessor: commandPostProcessor
});

export const SYNTH: MatchType = defineMatchType({
  id: 'SYNTH', types: [Type.Synth], fileTypes: ['synth'], cache: true, allowRename: true, referenceOnly: true, renameFile: true, comparisonType: Type.Synth,
  hoverConfig: { referenceItems: [TITLE, INFO] },
  postProcessor: fileNamePostProcessor
});

export const MIDI: MatchType = defineMatchType({
  id: 'MIDI', types: [Type.Midi], fileTypes: ['mid'], cache: true, allowRename: true, referenceOnly: true, renameFile: true, comparisonType: Type.Midi,
  hoverConfig: { referenceItems: [TITLE, INFO] },
  postProcessor: fileNamePostProcessor
});

export const MODEL: MatchType = defineMatchType({
  id: 'MODEL', types: [Type.Ob2, Type.Model], fileTypes: ['ob2'], cache: true, allowRename: true, referenceOnly: true, renameFile: true,  comparisonType: Type.Model,
  hoverConfig: { referenceItems: [TITLE, INFO] },
});

export const WALKTRIGGER: MatchType = defineMatchType({
  id: 'WALKTRIGGER', types: [Type.Walktrigger], fileTypes: ['rs2'], cache: true, allowRename: true, callable: true,  comparisonType: Type.Walktrigger,
  hoverConfig: { declarationItems: [TITLE, INFO, SIGNATURE], referenceItems: [TITLE, INFO, SIGNATURE] },
});

export const IDK: MatchType = defineMatchType({
  id: 'IDK', types: [Type.Idk, Type.Idkit], fileTypes: ['idk'], cache: true, allowRename: true,  comparisonType: Type.Idkit,
  hoverConfig: { declarationItems: [TITLE, INFO], referenceItems: [TITLE, INFO, CODEBLOCK], language: 'idkconfig' },
});

export const MESANIM: MatchType = defineMatchType({
  id: 'MESANIM', types: [Type.Mesanim], fileTypes: ['mesanim'], cache: true, allowRename: true, comparisonType: Type.Mesanim,
  hoverConfig: { declarationItems: [TITLE, INFO], referenceItems: [TITLE, INFO], language: 'mesanimconfig' },
});

export const STRUCT: MatchType = defineMatchType({
  id: 'STRUCT', types: [Type.Struct], fileTypes: ['struct'], cache: true, allowRename: true, comparisonType: Type.Struct,
  hoverConfig: { declarationItems: [TITLE, INFO], referenceItems: [TITLE, INFO], language: 'structconfig' },
});

export const CATEGORY: MatchType = defineMatchType({
  id: 'CATEGORY', types: [Type.Category], cache: true, allowRename: true, referenceOnly: true, comparisonType: Type.Category,
  hoverConfig: { referenceItems: [TITLE, VALUE] },
  postProcessor: categoryPostProcessor
});

// Hover only match types that are only used for displaying hover displays (no finding references/declarations)
// Useful for terminating word searches early when detected. Postprocessing can be done on these.
// Specify referenceConfig to select which displayItems should be shown on hover.
export const COORDINATES: MatchType = defineMatchType({
  id: 'COORDINATES', types: [Type.Coord], cache: false, allowRename: false,  comparisonType: Type.Coord,
  hoverConfig: { referenceItems: [TITLE, VALUE] },
  postProcessor: coordPostProcessor
});

export const CONFIG_KEY: MatchType = defineMatchType({
  id: 'CONFIG_KEY', types: [], cache: false, allowRename: false,
  hoverConfig: { referenceItems: [TITLE, INFO] },
  postProcessor: configKeyPostProcessor
});

export const TRIGGER: MatchType = defineMatchType({
  id: 'TRIGGER', types: [], cache: false, allowRename: false,
  hoverConfig: { referenceItems: [TITLE, INFO] },
  postProcessor: triggerPostProcessor
});

export const STAT: MatchType = defineMatchType({
  id: 'STAT', types: [Type.Stat], cache: false, allowRename: false, comparisonType: Type.Stat,
  hoverConfig: { referenceItems: [TITLE] },
});

export const NPC_STAT: MatchType = defineMatchType({
  id: 'NPC_STAT', types: [Type.NpcStat], cache: false, allowRename: false, comparisonType: Type.NpcStat,
  hoverConfig: { referenceItems: [TITLE] },
});

export const NPC_MODE: MatchType = defineMatchType({
  id: 'NPC_MODE', types: [Type.NpcMode], cache: false, allowRename: false, comparisonType: Type.NpcMode,
  hoverConfig: { referenceItems: [TITLE] },
});

export const LOCSHAPE: MatchType = defineMatchType({
  id: 'LOCSHAPE', types: [Type.Locshape], cache: false, allowRename: false, comparisonType: Type.Locshape,
  hoverConfig: { referenceItems: [TITLE] },
});

export const FONTMETRICS: MatchType = defineMatchType({
  id: 'FONTMETRICS', types: [Type.Fontmetrics], cache: false, allowRename: false, comparisonType: Type.Fontmetrics,
  hoverConfig: { referenceItems: [TITLE] },
});

// NOOP Match types that might get detected, but nothing is done with them (no hover display, no finding references/declarations)
// Useful for terminating word searching early when detected, and possibly doing something with them at a later date
export const UNKNOWN: MatchType = defineMatchType({ id: 'UNKNOWN', types: [], fileTypes: [], cache: false, allowRename: false, noop: true });
export const SKIP: MatchType = defineMatchType({ id: 'SKIP', types: [], fileTypes: [], cache: false, allowRename: false, noop: true });
export const NUMBER: MatchType = defineMatchType({ id: 'NUMBER', types: [], fileTypes: [], cache: false, allowRename: false, noop: true, comparisonType: Type.Int });
export const KEYWORD: MatchType = defineMatchType({ id: 'KEYWORD', types: [], fileTypes: [], cache: false, allowRename: false, noop: true });
export const TYPE: MatchType = defineMatchType({ id: 'TYPE', types: [], fileTypes: [], cache: false, allowRename: false, noop: true });
export const BOOLEAN: MatchType = defineMatchType({ id: 'BOOLEAN', types: [], fileTypes: [], cache: false, allowRename: false, noop: true, comparisonType: Type.Boolean });
export const NULL: MatchType = defineMatchType({ id: 'NULL', types: [], fileTypes: [], cache: false, allowRename: false, noop: true, comparisonType: Type.Null });

function getMatchTypeById(id: string): MatchType | undefined {
  return matchTypesById.get(id);
}

function getAllMatchTypes(): MatchType[] {
  return [...matchTypesById.values()];
}

export { getMatchTypeById, getAllMatchTypes, matchTypesById };
