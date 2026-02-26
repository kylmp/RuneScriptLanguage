import { DBCOLUMN, ENUM, PARAM } from "../matching/matchType";
import type { ConfigKeyData } from "../types";

/**
 * The source of the identifier for config keys which have dynamic varargs
 * Used by the matcher to retrieve the identifier which contains the signature type params 
 */
export enum ConfigVarArgSrc { 
  BlockName = 'blockName',
  FirstParam = 'firstParam'
}

/**
 * Extends normal config key data for regex matching
 */
interface RegexConfigData extends ConfigKeyData {
  /** The regular expression which will be tested against the config keys to find if it matches */
  regex: RegExp;
  /** The file types that this will be testing the keys on */
  fileTypes?: string[];
}

/**
 * Defines static config keys (direct match)
 */
const configKeys: Record<string, ConfigKeyData> = {
  walkanim: { params: ['seq', 'seq', 'seq', 'seq'] },
  multivar: { params: ['var'] },
  multiloc: { params: ['int', 'loc'] },
  multinpc: { params: ['int', 'npc'] },
  basevar: { params: ['var'] },
  certlink: { params: ['obj'] },
  certtemplate: { params: ['obj'] },

  category: { params: ['category'] },
  huntmode: { params: ['hunt'] },
  table: { params: ['dbtable'] },
  check_category: { params: ['category'] },
  check_inv: { params: ['inv', 'namedobj'] },
  check_npc: { params: ['npc'] },
  check_obj: { params: ['obj'] },
  check_loc: { params: ['loc'] },
  check_invparam: { params: ['inv', 'param'] },
  extracheck_var: { params: ['var'] },

  param: { params: ['param'], varArgs: {startIndex: 1, idenSrc: ConfigVarArgSrc.FirstParam, idenType: PARAM.id}},
  val: { params: [], varArgs: {startIndex: 0, idenSrc: ConfigVarArgSrc.BlockName, idenType: ENUM.id}},
  data: { params: ['dbcolumn'], varArgs: {startIndex: 1, idenSrc: ConfigVarArgSrc.FirstParam, idenType: DBCOLUMN.id}},
};

/**
 * Defines regex config keys (check key against regex to find match)
 */
const regexConfigKeys: Map<string, RegexConfigData[]> = groupByFileType([
  { regex: /stock\d+/, params: ['obj', 'int', 'int'], fileTypes: ["inv"] },
  { regex: /count\d+/, params: ['obj', 'int'], fileTypes: ["obj"] },
  { regex: /frame\d+/, params: ['frame'], fileTypes: ["seq"] },
  { regex: /^len\d+$/, params: ['seq'], fileTypes: ["mesanim"] },
  { regex: /^(layer|overlayer)$/, params: ['component'], fileTypes: ["if"] },
  { regex: /(model|head|womanwear|manwear|womanhead|manhead|activemodel)\d*/, params: ['ob2'], fileTypes:['npc', 'loc', 'obj', 'spotanim', 'if', 'idk'] },
  { regex: /\w*anim\w*/, params: ['seq'], fileTypes: ["loc", "npc", "if", "spotanim"] },
  { regex: /replaceheldleft|replaceheldright/, params: ['obj'], fileTypes: ["seq"], ignoreValues: ["hide"] },
]);

/**
 * Get the defined config key data, if any
 * @param configKey the name of the config key to find a match for
 * @param fileType the file type the config key is in
 * @returns the config key data, if any
 */
export function getConfigData(configKey: string, fileType: string): ConfigKeyData | undefined {
  return configKeys[configKey] ?? checkRegexConfigKeys(configKey, fileType);
}

/**
 * Caches config keys found during matching, used by completion provider to suggest values
 */
const observedConfigKeys = new Set<string>();

/**
 * Learn a new config key name (save to the cache)
 * @param key config key name
 */
export function learnConfigKey(key: string): void {
  observedConfigKeys.add(key);
}

/**
 * Returns all of the learned config keys so far
 */
export function getObservedConfigKeys(): Set<string> {
  return observedConfigKeys;
}

/**
 * Check a config key against all of the config key regexes applicable to that file type
 * @param configKey config key to check against regex
 * @param fileType file type where the config key is in
 * @returns the matched config key data, if any
 */
function checkRegexConfigKeys(configKey: string, fileType: string): ConfigKeyData | undefined {
  for (const regexConfig of (regexConfigKeys.get(fileType) || [])) {
    if (regexConfig.regex.test(configKey)) return regexConfig;
  }
}

/**
 * Groups the array of regex config data into a quick lookup of valid regex to check by file type
 * @param config the regex config data
 */
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
