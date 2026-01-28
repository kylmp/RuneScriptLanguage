import type { Uri } from 'vscode';
import type { HoverDisplayItem } from './enum/hoverDisplayItems';
import type { SemanticTokenType } from './enum/semanticTokens';
import type { ConfigVarArgSrc } from './resource/configKeys';

/**
 * Definition of a parsed word
 */
export interface ParsedWord {
  /** The actual string value of the word */
  value: string;
  /** The start index of the word (int) */
  start: number;
  /** The end index of the word (int) */
  end: number;
  /** The index of this word on its line (int), as in of all the words on a line which index is this word */
  index: number;
  /** Whether or not the word is inside a string */
  inString: boolean;
  /** Whether or not the word is inside interpolated code (code inside a string) */
  inInterpolation: boolean;
  /** The depth of parenthesis the word is in */
  parenDepth: number;
  /** The depth of braces (curly brackets) the word is in */
  braceDepth: number;
  /** The call name of the function this word is in, if any */
  callName?: string;
  /** The word index of the call name word */
  callNameIndex?: number;
  /** The param index this word is in inside a call function */
  paramIndex?: number;
  /** The config key name for config value words */
  configKey?: string;
}

export interface FileInfo { name: string, type: string }

/**
 * The full match context for a matching a word
 */
export interface MatchContext {
  /** The specific word that the match is for */
  word: ParsedWord;
  /** An array of all of the words in the line of the found match */
  words: ParsedWord[];
  /** The file uri that the found match is in */
  uri: Uri;
  /** The matchType of the matched word */
  matchType: MatchType;
  /** Whether or not the match is a declaration (if false, its a reference) */
  declaration: boolean;
  /** The line text and number (line number in the file) that the match is on */
  line: { text: string; number: number };
  /** The name and type of the file that the match is in */
  file: FileInfo;
  /** The character index of the match within the line it is in */
  lineIndex: number;
  /** The word that comes before the matched word (undefined if no previous words) */
  prevWord: ParsedWord | undefined;
  /** The character that is right before the matched word */
  prevChar: string;
  /** The character that is right after the matched word */
  nextChar: string;
  /** The original word before modification */
  originalWord?: string;
  /** The original prefix text if this is a modified word */
  originalPrefix?: string;
  /** The original suffic text if this is a modified word */
  originalSuffix?: string;
  /** Extra data that exists for this match, if any */
  extraData?: Record<string, any>;
  /** A boolean indicating if this match is a cert obj */
  cert?: boolean;
  /** The pack ID for this match if it has one (ex: Obj ID 1234, only populated when matching *.pack files) */
  packId?: string;
}

/**
 * The data used to represent a signature of a proc or other type
 */
export interface Signature {
  /** The parameters for the signature */
  params: Array<{ type: string; name: string; matchTypeId: string }>;
  /** The return types for the signature */
  returns: string[];
  /** The precomputed single line text of the parameters, for display purposes */
  paramsText: string;
  /** The precomputed single line text of the return types, for display purposes */
  returnsText: string;
}

/**
 * The definition of an identifier, identifiers are actual found matches of any matchType in the project files
 * This stores all of the data necessary for the core functions of the extension 
 * (finding references, going to definitions, showing hover display info, etc...)
 */
export interface Identifier {
  /** The name of an identifier */
  name: string;
  /** The matchType ID of the identifier */
  matchId: string;
  /** This is the pack id (such as Obj ID 1234), if it has one */
  id?: string;
  /** The cache key for this identifier */
  cacheKey: string;
  /** The location of the declaration/definition of the identifier, if it has one */
  declaration?: { uri: Uri; ref: string };
  /** The locations (encoded as string) of the references of the identifier */
  references: Record<string, Set<string>>;
  /** The file type where the identifier exists/defined in */
  fileType: string;
  /** The code language the identifier should use for syntax highlighting display purposes */
  language: string;
  /** For displaying the identifiers info text on hover (italicized body text, always on first line of body text) */
  info?: string;
  /** For referencing and displaying on hover the identifiers params and return types. */
  signature?: Signature;
  /** For displaying the identifiers code line on hover */
  block?: { code: string };
  /** For displaying the identifiers value text on hover (plain body text, positioned below info text but above signature or code blocks) */
  value?: string;
  /** Any extra data tied to this identifier */
  extraData?: Record<string, any>;
  /** Boolean indicating if hover text should not display for this identifier */
  hideDisplay?: boolean;
}

/**
 * The item returned by the active file cache, contains MatchResult plus the actual identifer (if it exists)
 */
export interface Item extends MatchResult {
  identifier?: Identifier
}

/**
 * Function format for post processors which run when an identifier is created
 */
export type PostProcessor = (identifier: Identifier) => void;

/**
 * Text info necessary for creating identifiers
 */
export interface IdentifierText {
  /** The file text lines this identifier is in */
  lines: string[];
  /** The line number where this identifiers relevant code starts at */
  start: number;
}

/**
  * Tracks the keys of identifier declarations and references within a file
  */
export interface FileIdentifiers {
  declarations: Set<IdentifierKey>;
  references: Set<IdentifierKey>;
}

/**
 * The MatchType is the config that controls how identifiers are built, cached, and displayed
 */
export interface MatchType {
  /** Unique identifier for the match type */
  id: string;
  /** The types which can correspond to a matchtype (ex: [namedobj, obj] are types for the OBJ matchType) */
  types: string[];
  /** The file types where a matchType can be defined/declared */
  fileTypes?: string[];
  /** Override the color this type will show up as by assigning it to a semantic token type */
  semanticTokenConfig?: { declaration?: SemanticTokenType, reference?: SemanticTokenType }
  /** Whether or not identifiers of this match type should be cached */
  cache: boolean;
  /** Whether or not this match type can be a callable or have parameters (like PROC, LOC, COMMAND...) */
  callable?: boolean;
  /** Whether or not identifiers of this type have only references (no definition/declaration). Used mainly for identifiers which refer to a file, like synths. */
  referenceOnly?: boolean;
  /** Whether or not identifiers of this type should be allowed to be renamed (code change) */
  allowRename: boolean;
  /** Whether or not identifiers declaration file name can be renamed (actual file rename) */
  renameFile?: boolean;
  /** Whether or not identifiers of this type is for hover display only (not cached) */
  hoverOnly?: boolean;
  /** Whether or not identifiers of this type is no operation (used for finding matches and terminating matching early, but not ever cached or displayed) */
  noop?: boolean;
  /** The config settings for the hover display of identifiers of this type */
  hoverConfig?: HoverConfig;
  /** Function that is executed after identifiers of this type have been created (allows for more dynamic runtime info with full context to be tied to an identifier) */
  postProcessor?: PostProcessor;
}

/**
 * Config which controls how the hover display is built
 */
export interface HoverConfig {
  /** Hover items shown for declarations of a matchType */
  declarationItems?: HoverDisplayItem[];
  /** Hover items shown for references of a matchType */
  referenceItems?: HoverDisplayItem[];
  /** Language used for displaying code blocks of this matchType (for proper syntax highlighting) */
  language?: string;
  /** Number of lines to skip for displaying a code block (defaults to 1 to skip the declaration line that most types have) */
  blockSkipLines?: number;
  /** Config line items to include in code block. Undefined shows all config items (default). */
  configInclusions?: string[];
}

/**
 * The data returned when a match is found
 */
export interface MatchResult {
  /** The word that was matched */
  word: string;
  /** Additional context for the match found */
  context: MatchContext;
}

/**
 * The definition of matchers. Lower priority runs first. Faster processing matchers should be given priority. 
 */
export interface Matcher {
  /** Lower priority runs first; Quick matchers should have high priority */
  priority: number;
  /** Matcher function for a given match context. 
   * Matchers should mutate the context to set the MatchType and declaration boolean of the found match. 
   * Matchers should set SKIP matchType if you want to early terminate matching.
   * Matchers should keep the default (UNKNOWN) matchType if there might be a match with a different matcher. */
  fn: (context: MatchContext) => void;
}

/**
 * Response type returned when params are matched
 */
export interface ParamsMatchResponse {
  /** The parent identifier for the parameter match */
  identifier: Identifier;
  /** The parameter index in the signature */
  index: number;
  /** The resolved match type for the parameter */
  match: MatchType;
  /** Whether this match refers to return parameters */
  isReturns?: boolean;
  /** Dynamic command name when inferred from callsite */
  dynamicCommand?: string;
}

/**
 * The identifier key is the identifier name + matchTypeId. (ex: a proc called do_something -> do_somethingPROC)
 * This supports identifiers with the same name but different match type. 
 */
export type IdentifierKey = string;

/**
 * The file key is simply the URI fsPath, a full file path is always unique within a specific workspace
 */
export type FileKey = string;

/**
 * A wrapper interface that holds data and the start and end positions that data is contained in
 */
export interface DataRange<T> {
  start: number,
  end: number,
  data: T
}

/**
 * Data about a config line returned from the config matcher
 */
export interface ConfigLineData {
  key: string;
  params: string[];
  index: number;
}

/** Data which defines info about the values a config key expects (key=value(s)) */
export interface ConfigKeyData {
  /** The types of the params for this config key, in order */
  params: string[],
  /** Words to be ignored as params if they belong to this config key */
  ignoreValues?: string[]
  /** If this config key has var args, this data is used by the matcher to figure out the arg match types */
  varArgs?: { 
    /** The param index that the varags start on */
    startIndex: number, 
    /** The source of the identifier where the vararg param types are defined */
    idenSrc: ConfigVarArgSrc, 
    /** The match type id of the identifier where teh varag param types are defined */
    idenType: string 
  }
}