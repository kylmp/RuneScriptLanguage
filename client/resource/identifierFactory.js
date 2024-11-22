const stringUtils = require('../utils/stringUtils');
const hoverDisplay = require('../enum/hoverDisplay');
const displayConfig = require('./displayConfig');
const matchType = require('./matchType');

function build(name, match, location, info, text) {
  const identifier = {
    name: name,
    match: match,
    location: location,
    fileType: location ? location.uri.path.split(/[#?]/)[0].split('.').pop().trim() : 'rs2',
    language: displayConfig.resolve(displayConfig.option.LANGUAGE, match),
    text: text || ''
  }
  if (info) identifier.info = info;
  process(identifier);
  return identifier;
}

function process(identifier) {
  if (identifier.match.declarationConfig && identifier.match.referenceConfig) {
    const displayItems = new Set();
    identifier.match.declarationConfig.displayItems.forEach(displayItem => displayItems.add(displayItem));
    identifier.match.referenceConfig.displayItems.forEach(displayItem => displayItems.add(displayItem));

    // Process specififed display items
    for (const displayItem of displayItems) {
      switch(displayItem) {
        case hoverDisplay.SIGNATURE: processSignature(identifier); break;
        case hoverDisplay.CODEBLOCK: processCodeBlock(identifier); break;
      }
    }
  }

  // Execute custom post processing for the identifier's matchType (if defined)
  if (identifier.match.postProcessor) {
    identifier.match.postProcessor(identifier);
  }

  delete identifier.text; // no longer need to keep the raw text, save on cache size
}

function processSignature(identifier) {
  // Get first line of text, which should contain the data for parsing the signature
  let line = stringUtils.getLineText(identifier.text);

  // Parse input params
  const params = [];
  let openingIndex = line.indexOf('(');
  let closingIndex = line.indexOf(')');
  if (openingIndex >= 0 && closingIndex >= 0 && ++openingIndex !== closingIndex) {
    line.substring(openingIndex, closingIndex).split(',').forEach(param => {
      if (param.startsWith(' ')) param = param.substring(1);
      const split = param.split(' ');
      if (split.length === 2) {
        const match = Object.keys(matchType).filter(key => (matchType[key].types || []).includes(split[0]));
        params.push({type: split[0], name: split[1], matchTypeId: match.length > 0 ? match[0] : matchType.UNKNOWN.id});
      }
    });
  }

  // Parse response type
  let returns = '';
  line = line.substring(closingIndex + 1);
  openingIndex = line.indexOf('(');
  closingIndex = line.indexOf(')');
  if (openingIndex >= 0 && closingIndex >= 0 && ++openingIndex !== closingIndex) {
    returns = line.substring(openingIndex, closingIndex);
  }

  // Add signature to identifier
  const paramsText = (params.length > 0) ? params.map(param => `${param.type} ${param.name}`).join(', ') : '';
  identifier.signature = {params: params, returns: returns, paramsText: paramsText};
}

function processCodeBlock(identifier) {
  const blockLines = stringUtils.getLines(identifier.text);
  const startIndex = displayConfig.resolve(displayConfig.option.BLOCK_SKIP_LINES, identifier.match);
  const configInclusionTags = displayConfig.resolve(displayConfig.option.CONFIG_INCLUSIONS, identifier.match);
  let blockInclusionLines = [];
  for (let i = startIndex; i < blockLines.length; i++) {
    let currentLine = blockLines[i];
    if (currentLine.startsWith('//')) continue;
    if (configInclusionTags && !configInclusionTags.some(inclusionTag => currentLine.startsWith(inclusionTag))) continue;
    blockInclusionLines.push(currentLine);
  }
  identifier.block = blockInclusionLines.join('\n');
}

module.exports = { build };