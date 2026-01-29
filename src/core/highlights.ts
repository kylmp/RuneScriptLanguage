import { Position, Range, type TextEditor } from 'vscode';
import { DecorationRangeBehavior, window } from "vscode";
import { getAllMatches, getAllOperatorTokens, getAllParsedWords } from '../cache/activeFileCache';
import { isDevMode } from './devMode';

const matchDecoration = window.createTextEditorDecorationType({
  backgroundColor: 'rgba(80, 200, 120, 0.20)',
  rangeBehavior: DecorationRangeBehavior.ClosedClosed
});

const wordDecoration = window.createTextEditorDecorationType({
  backgroundColor: 'rgba(255, 80, 80, 0.20)',
  rangeBehavior: DecorationRangeBehavior.ClosedClosed
});

const operatorDecoration = window.createTextEditorDecorationType({
  backgroundColor: 'rgba(160, 80, 255, 0.25)',
  rangeBehavior: DecorationRangeBehavior.ClosedClosed
});

enum HighlightMode {
  Disabled = 'disabled',
  Matches = 'matches',
  AllWords = 'allWords',
}

export function rebuildHighlights(): void {
  if (isDevMode()) {
    const editor = window.activeTextEditor;
    if (!editor) return;
    buildHighlights(editor);
  }
}

function buildHighlights(editor: TextEditor, mode = HighlightMode.AllWords) {
  editor.setDecorations(matchDecoration, []);
  editor.setDecorations(wordDecoration, []);
  switch (mode) {
    case HighlightMode.Matches:
      editor.setDecorations(matchDecoration, getMatchRanges());
      break;
    case HighlightMode.AllWords:
      editor.setDecorations(matchDecoration, getMatchRanges());
      editor.setDecorations(wordDecoration, getWordRanges());
      editor.setDecorations(operatorDecoration, getOperatorTokenRanges());
      break;
  }
}

function getMatchRanges(): Range[] {
  return getAllMatches().map(match => new Range(new Position(match.context.line.number, match.context.word.start), new Position(match.context.line.number, match.context.word.end + 1)));
}

function getWordRanges(): Range[] {
  const matchRanges = getMatchRanges();
  const wordRanges: Range[] = [];
  getAllParsedWords().forEach((parsedLineWords, lineNum) => {
    parsedLineWords.forEach(word => wordRanges.push(new Range(new Position(lineNum, word.start), new Position(lineNum, word.end + 1))));
  });
  return wordRanges.filter(range => !matchRanges.some(match => match.intersection(range)));
}

function getOperatorTokenRanges(): Range[] {
  const operatorRanges: Range[] = [];
  getAllOperatorTokens().forEach((operatorTokens, lineNum) => {
    operatorTokens.forEach(operator => operatorRanges.push(new Range(new Position(lineNum, operator.index), new Position(lineNum, operator.index + operator.token.length))));
  });
  return operatorRanges;
}
