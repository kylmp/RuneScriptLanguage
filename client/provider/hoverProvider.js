const vscode = require('vscode');
const path = require('path');
const stringUtils = require('../utils/stringUtils');
const localVarUtils = require('../utils/localVarUtils');
const matchType = require('../matching/matchType');
const identifierCache = require('../cache/identifierCache');
const identifierFactory = require('../resource/identifierFactory');
const { TITLE, INFO, VALUE, SIGNATURE, CODEBLOCK } = require('../enum/hoverDisplayItems');
const { matchWordFromDocument } = require('../matching/matchWord');
const { resolve } = require('../resource/hoverConfigResolver');
const { DECLARATION_HOVER_ITEMS, REFERENCE_HOVER_ITEMS } = require('../enum/hoverConfigOptions');

const hoverProvider = function(context) {
  return {
    async provideHover(document, position) {
      // Find a match for the word user is hovering over, and ignore noop tagged matches
      const { word, match } = matchWordFromDocument(document, position);
      if (!match || match.noop) {
        return null;
      }

      // Setup the hover text markdown object
      const content = new vscode.MarkdownString();
      content.supportHtml = true;
      content.isTrusted = true;
      content.supportThemeIcons = true;
      content.baseUri = vscode.Uri.file(path.join(context.extensionPath, 'icons', path.sep)); 

      // Local vars are handled differently than the rest
      if (match.id === matchType.LOCAL_VAR.id) {
        appendLocalVarHoverText(document, position, word, match, content);
        return new vscode.Hover(content);
      }

      // If no config found, or no items to display then exit early
      const hoverDisplayItems = (match.declaration) ? resolve(DECLARATION_HOVER_ITEMS, match) : resolve(REFERENCE_HOVER_ITEMS, match);
      if (hoverDisplayItems.length === 0) {
        return null;
      }

      // If we only need to show title, then set the identifier as hover only to prevent unnecessary operations
      if (hoverDisplayItems.length === 1 && hoverDisplayItems[0] === TITLE) {
        match.hoverOnly = true;
      }

      // Build hover text based on identifier data
      const identifier = getIdentifier(word, match, document, position);
      if (!match.declaration && (!identifier || !identifier.declaration)) {
        expectedIdentifierMessage(word, match, content);
        return new vscode.Hover(content);
      }
      if (!identifier || identifier.hideDisplay) {
        return null;
      }
      appendTitle(identifier.name, identifier.fileType, identifier.matchId, content);
      appendInfo(identifier, hoverDisplayItems, content);
      appendValue(identifier, hoverDisplayItems, content);
      appendSignature(identifier, hoverDisplayItems, content);
      appendCodeBlock(identifier, hoverDisplayItems, content);
      return new vscode.Hover(content);
    }
  };
}

function appendLocalVarHoverText(document, position, word, match, content) {
  if (match.declaration === false) {
    const fileText = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
    const foundLocalVar = localVarUtils.findLocalVar(fileText, word);
    if (!foundLocalVar) {
      expectedIdentifierMessage(word, match, content);
    } else {
      appendTitle(word, 'rs2', match.id, content);
      const isDef = fileText.substring(Math.max(foundLocalVar.index - 4, 0), foundLocalVar.index) === "def_";
      if (isDef) {
        const line = stringUtils.getLineText(fileText.substring(foundLocalVar.index - 4));
        content.appendCodeblock(line.substring(0, line.indexOf(";")), 'runescript');
      } else {
        const lineText = stringUtils.getLineText(fileText.substring(foundLocalVar.index));
        content.appendCodeblock(`parameter: ${lineText.substring(0, lineText.indexOf(word) + word.length)}`, 'runescript');
      }
    }
  }
}

function expectedIdentifierMessage(word, match, content) {
  content.appendMarkdown(`<img src="warning.png">&ensp;<b>${match.id}</b>&ensp;<i>${word}</i> not found`);
}

function appendTitle(name, type, matchId, content) {
  content.appendMarkdown(`<img src="${type}.png">&ensp;<b>${matchId}</b>&ensp;${name}`);
}

function appendInfo(identifier, displayItems, content) {
  if (displayItems.includes(INFO) && identifier.info) {
    appendBody(`<i>${identifier.info}</i>`, content);
  }
}

function appendValue(identifier, displayItems, content) {
  if (displayItems.includes(VALUE) && identifier.value) {
    appendBody(`${identifier.value}`, content);
  }
}

function appendSignature(identifier, displayItems, content) {
  if (displayItems.includes(SIGNATURE) && identifier.signature) {
    if (identifier.signature.paramsText.length > 0) content.appendCodeblock(`params: ${identifier.signature.paramsText}`, identifier.language);
    if (identifier.signature.returns.length > 0) content.appendCodeblock(`returns: ${identifier.signature.returns}`, identifier.language);
  }
}

function appendCodeBlock(identifier, displayItems, content) {
  if (displayItems.includes(CODEBLOCK) && identifier.block) {
    content.appendCodeblock(identifier.block, identifier.language);
  }
}

function appendBody(text, content) {
  if (!content.value.includes('---')) {
    content.appendMarkdown('\n\n---');
  }
  content.appendMarkdown(`\n\n${text}`);
}

function getIdentifier(word, match, document, position) {
  if (match.hoverOnly) {
    return identifierFactory.build(word, match, new vscode.Location(document.uri, position));
  }
  return identifierCache.get(word, match, match.declaration ? document.uri : null);
}

module.exports = hoverProvider;