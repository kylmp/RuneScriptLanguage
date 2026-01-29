import type { PostProcessor } from '../types';
import { END_OF_LINE_REGEX } from '../enum/regex';
import { matchConfigKeyInfo } from './configKeyInfo';
import { matchTriggerInfo } from './triggerInfo';
import { getLineText } from '../utils/stringUtils';

// Post processors are used for any additional post modification needed for a matchType, after an identifier has been built
// postProcessors must be a function which takes indentifier as an input, and directly modifies that identifier as necessary

export const coordPostProcessor: PostProcessor = function(identifier) {
  const coordinates = identifier.name.split('_');
  const xCoord = (Number(coordinates[1]) << 6) + Number(coordinates[3]);
  const zCoord = (Number(coordinates[2]) << 6) + Number(coordinates[4]);
  identifier.value = `Absolute coordinates: (${xCoord}, ${zCoord})`;
};

export const enumPostProcessor: PostProcessor = function(identifier) {
  const block = identifier.block!;
  const inputType = getLineText(block.code.substring(block.code.indexOf("inputtype="))).substring(10);
  const outputType = getLineText(block.code.substring(block.code.indexOf("outputtype="))).substring(11);
  const params = [{type: inputType, name: '', matchTypeId: ''}, {type: outputType, name: '', matchTypeId: ''}];
  identifier.signature = { params: params, paramsText: '', returns: [], returnsText: ''};
  identifier.comparisonType = outputType;
};

export const localVarPostProcessor: PostProcessor = function(identifier) {
  identifier.comparisonType = identifier.extraData!.type;
};

export const globalVarPostProcessor: PostProcessor = function(identifier) {
  const index = identifier.block!.code.indexOf("type=");
  const dataType = (index < 0) ? 'int' : getLineText(identifier.block!.code.substring(index)).substring(5);
  identifier.extraData = { dataType: dataType };
  identifier.comparisonType = dataType;
};

export const paramPostProcessor: PostProcessor = function(identifier) {
  const index = identifier.block!.code.indexOf("type=");
  const dataType = (index < 0) ? 'int' : getLineText(identifier.block!.code.substring(index)).substring(5);
  identifier.signature = { params: [{type: dataType, name: '', matchTypeId: ''}], paramsText: '', returns: [], returnsText: ''};
  identifier.comparisonType = dataType;
};

export const configKeyPostProcessor: PostProcessor = function(identifier) {
  const info = matchConfigKeyInfo(identifier.name, identifier.fileType);
  if (info) {
    identifier.info = info.replace(/\$TYPE/g, identifier.fileType);
  } else {
    identifier.hideDisplay = true;
  }
};

export const triggerPostProcessor: PostProcessor = function(identifier) {
  if (identifier.extraData) {
    const info = matchTriggerInfo(identifier.name, identifier.extraData.triggerName);
    if (info) identifier.info = info;
  }
};

export const categoryPostProcessor: PostProcessor = function(identifier) {
  const extraData = identifier.extraData;
  if (extraData && extraData.matchId && extraData.categoryName) {
    identifier.value = `This script applies to all <b>${extraData.matchId}</b> with \`category=${extraData.categoryName}\``;
  }
};

export const componentPostProcessor: PostProcessor = function(identifier) {
  const split = identifier.name.split(':');
  identifier.info = `A component of the <b>${split[0]}</b> interface`;
  identifier.name = split[1];
};

export const rowPostProcessor: PostProcessor = function(identifier) {
  if (identifier.block) {
    const tableName = (identifier.block.code.split('=') || ['', ''])[1];
    identifier.info = `A row in the <b>${tableName}</b> table`;
    delete identifier.block;
    identifier.extraData = { table: tableName };
  }
};

const columnIgnoreTypes = new Set(['LIST','INDEXED','REQUIRED']);
export const columnPostProcessor: PostProcessor = function(identifier) {
  const split = identifier.name.split(':');
  identifier.info = `A column of the <b>${split[0]}</b> table`;
  identifier.name = split[1];

  if (!identifier.block) return;
  const exec = END_OF_LINE_REGEX.exec(identifier.block.code);
  if (!exec) return;
  const types = identifier.block.code.substring(8 + identifier.name.length, exec.index).split(',').map(t => t.trim()).filter(t => !columnIgnoreTypes.has(t));
  const params = types.map(type => ({type: type, name: '', matchTypeId: ''}));
  identifier.signature = { params: params, paramsText: '', returns: [], returnsText: ''};
  identifier.block.code = `Field types: ${types.join(', ')}`;
};

export const fileNamePostProcessor: PostProcessor = function(identifier) {
  identifier.info = `Refers to the file <b>${identifier.name}.${identifier.fileType}</b>`;
};
