const fs = require('fs').promises;
const vscode = require('vscode');
const matchType = require("../matching/matchType");
const identifierCache = require('./identifierCache');
const stringUtils = require('../utils/stringUtils');
const { matchWords } = require('../matching/matchWord');
const identifierFactory = require('../resource/identifierFactory');
const { INFO_MATCHER } = require('../enum/regex');

/**
 * Builds the set of monitored file types, any file events with other file types will be ignored
 * Monitored file types is determined by checking all file types defined in the matchType object
 */
const monitoredFileTypes = new Set();
function determineFileTypes() {
  Object.keys(matchType).forEach(matchTypeId => {
    const fileTypes = matchType[matchTypeId].fileTypes || [];
    for (const fileType of fileTypes) {
      monitoredFileTypes.add(fileType);
    }
  });
}

/**
 * Rebuilds the entire identifier cache for all relevant workspace files
 * Need to do 2 passes on the files to for ensuring things like engine command 
 * parameters get matched correctly. On the first pass, the commands don't yet exist in the cache
 * so the matching service cannot accurately build everything until 2 passes are made
 */
async function rebuildAll() {
  if (monitoredFileTypes.size === 0) determineFileTypes();
  identifierCache.clear();
  const fileUris = await getFiles();
  await Promise.all(fileUris.map(uri => parseFileAndCacheIdentifiers(uri)));
  return Promise.all(fileUris.map(uri => parseFileAndCacheIdentifiers(uri)));
}

/**
 * Rebuilds the identifier cache for identifiers in the provided file uri
 */
async function rebuildFile(uri) {
  if (isValidFile(uri)) {
    identifierCache.clearFile(uri);
    parseFileAndCacheIdentifiers(uri);
  }
}

/**
 * Clears the identifier cache for identifiers in the provided list of file uris
 */
async function clearFiles(uris) {
  for (const uri of uris) {
    if (isValidFile(uri)) {
      identifierCache.clearFile(uri);
    }
  }
}

/**
 * Clears the identifier cache for identifiers in the provided list of old file uris 
 * and then recaches the files using the new file names
 */
async function renameFiles(uriPairs) {
  for (const uriPair of uriPairs) {
    if (isValidFile(uriPair.oldUri) && isValidFile(uriPair.newUri)) {
      identifierCache.clearFile(uriPair.oldUri);
      parseFileAndCacheIdentifiers(uriPair.newUri);
    }
  }
}

/**
 * Adds to cache for new files
 */
async function createFiles(uris) {
  for (const uri of uris) {
    if (isValidFile(uri)) {
      parseFileAndCacheIdentifiers(uri);
    }
  }
}

/**
 * Get a list of all relevant files in the workspace which might contain identifiers
 */
async function getFiles() {
  const fileTypesToScan = [];
  monitoredFileTypes.forEach(fileType => fileTypesToScan.push(`**/*.${fileType}`));
  return vscode.workspace.findFiles(`{${[...fileTypesToScan].join(',')}}`);
}

/**
 * Parses the input file for identifiers, and caches them when found
 */
async function parseFileAndCacheIdentifiers(uri) {
  if (uri.path.endsWith('.if')) {
    const fileSplit = uri.path.split('\\').pop().split('/').pop().split('.');
    const location = new vscode.Location(uri, new vscode.Position(0, 0));
    const identifier = identifierFactory.build(fileSplit[0], matchType.INTERFACE, location, null, []);
    identifierCache.put(fileSplit[0], matchType.INTERFACE, identifier);
  }
  const fileText = await fs.readFile(uri.path, "utf8");
  const lines = stringUtils.getLines(fileText);
  for (let line = 0; line < lines.length; line++) {
    const matches = (matchWords(lines[line], uri) || []).filter(match => match && match.match.cache); 
    if (matches.length > 0) {
      const text = {lines: null, start: 0};
      matches.forEach(match => {
        if (match.match.declaration) {
          text.lines = (text.lines) ? text.lines : lines.slice(line);
          const location = new vscode.Location(uri, new vscode.Position(line, match.context.word.start));
          const info = (line > 0) ? getInfo(lines[line - 1]) : null;
          const identifier = identifierFactory.build(match.word, match.match, location, info, text);
          identifierCache.put(match.word, match.match, identifier);
        } else {
          identifierCache.putReference(match.word, match.match, uri, line, match.context.word.start);
        }
      });
    }
  }
}

/**
 * Checks the previous line before an identifier for an "info" tag, if so it is added to the identifier
 */
function getInfo(infoLine) {
  if (!infoLine) return null;
  const infoMatch = INFO_MATCHER.exec(infoLine);
  return (infoMatch && infoMatch[2]) ? infoMatch[2].trim() : null;
}

/**
 * Checks if the file extension of the uri is in the list of monitored file types
 */
function isValidFile(uri) {
  return monitoredFileTypes.has(uri.path.split(/[#?]/)[0].split('.').pop().trim());
}

/**
 * Empty the cache entirely
 */
function clearAll() {
  identifierCache.clear();
}

module.exports = { rebuildAll, rebuildFile, clearFiles, renameFiles, createFiles, clearAll }