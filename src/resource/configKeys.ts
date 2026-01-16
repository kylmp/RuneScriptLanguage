import { DBCOLUMN, ENUM, PARAM } from "../matching/matchType";

export interface ConfigData {
  /** The types of the params for this config key, in order */
  params: string[],
  /** Words to be ignored as params if they belong to this config key */
  ignoreValues?: string[]
  /** If this config key has var args, this data is used by the matcher to figure out the arg match types */
  varArgs?: { startIndex: number, idenSrc: ConfigVarArgSrc, idenType: string }
}

export enum ConfigVarArgSrc {
  BlockName = 'blockName',
  FirstParam = 'firstParam'
}

interface RegexConfigData extends ConfigData {
  /** The regular expression which will be tested against the config keys to find if it matches */
  regex: RegExp;
  /** The file types that this will be testing the keys on */
  fileTypes?: string[];
}

const observedConfigKeys = new Set<string>();

export function learnConfigKey(key: string): void {
  observedConfigKeys.add(key);
}

export function getObservedConfigKeys(): Set<string> {
  return observedConfigKeys;
}

// === STATIC CONFIG KEY MATCHES ===
export const configKeys: Record<string, ConfigData> = {
  walkanim: { params: ['seq', 'seq', 'seq', 'seq'] },
  multivar: { params: ['var'] },
  multiloc: { params: ['int', 'loc'] },
  multinpc: { params: ['int', 'npc'] },
  basevar: { params: ['var'] },

  category: { params: ['category'] },
  huntmode: { params: ['hunt'] },
  table: { params: ['dbtable'] },
  check_category: { params: ['category'] },
  check_inv: { params: ['inv', 'namedobj'] },

  param: { params: ['param'], varArgs: {startIndex: 1, idenSrc: ConfigVarArgSrc.FirstParam, idenType: PARAM.id}},
  val: { params: [], varArgs: {startIndex: 0, idenSrc: ConfigVarArgSrc.BlockName, idenType: ENUM.id}},
  data: { params: ['dbcolumn'], varArgs: {startIndex: 1, idenSrc: ConfigVarArgSrc.FirstParam, idenType: DBCOLUMN.id}},
};

// === REGEX CONFIG KEY MATCHES ===
export const regexConfigKeys: Map<string, RegexConfigData[]> = groupByFileType([
  { regex: /stock\d+/, params: ['obj', 'int', 'int'], fileTypes: ["inv"] },
  { regex: /count\d+/, params: ['obj', 'int'], fileTypes: ["obj"] },
  { regex: /frame\d+/, params: ['frame'], fileTypes: ["seq"] },
  { regex: /(model|head|womanwear|manwear|womanhead|manhead|activemodel)\d*/, params: ['ob2'], fileTypes:['npc', 'loc', 'obj', 'spotanim', 'if', 'idk'] },
  { regex: /\w*anim\w*/, params: ['seq'], fileTypes: ["loc", "npc", "if", "spotanim"] },
  { regex: /replaceheldleft|replaceheldright/, params: ['obj'], fileTypes: ["seq"], ignoreValues: ["hide"] },
]);

// === CONFIG KEYS THAT ARE HANDLED MANUALLY IN CONFIG_MATCHER ===
export const specialCaseKeys = ['val', 'param', 'data'];

export function getRegexKey(configKey: string, fileType: string): RegexConfigData | undefined {
  const fileTypeRegexMatchers = regexConfigKeys.get(fileType) || [];
  for (let regexKey of fileTypeRegexMatchers) {
    if (regexKey.regex.test(configKey)) {
      return regexKey;
    }
  }
  return undefined;
}

function groupByFileType(config: RegexConfigData[]): Map<string, RegexConfigData[]> {
  const result = new Map<string, RegexConfigData[]>();
  for (const { regex, params, fileTypes, ignoreValues } of config) {
    const safeFileTypes = fileTypes ?? [];
    for (const fileType of safeFileTypes) {
      if (!result.has(fileType)) {
        result.set(fileType, []);
      }
      result.get(fileType)!.push({ regex: regex, params: params, ignoreValues: ignoreValues });
    }
  }
  return result;
}
