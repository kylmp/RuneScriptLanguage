import { Position, Range, type TextEditor } from 'vscode';
import { DecorationRangeBehavior, window } from "vscode";
import { getAllMatches, getAllParsedWords } from '../cache/activeFileCache';
import { isDevMode } from './devMode';

const matchDecoration = window.createTextEditorDecorationType({
  backgroundColor: 'rgba(255, 200, 0, 0.25)',
  rangeBehavior: DecorationRangeBehavior.ClosedClosed
});

const wordDecoration = window.createTextEditorDecorationType({
  backgroundColor: 'rgba(255, 80, 80, 0.20)',
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
      break;
  }
}

function getMatchRanges(): Range[] {
  return getAllMatches().map(match => new Range(new Position(match.context.line.number, match.context.word.start), new Position(match.context.line.number, match.context.word.end + 1)));
}

function getWordRanges(): Range[] {
  const matches = getMatchRanges();
  const words: Range[] = [];
  getAllParsedWords().forEach((parsedLineWords, lineNum) => {
    parsedLineWords.forEach(word => words.push(new Range(new Position(lineNum, word.start), new Position(lineNum, word.end + 1))));
  });
  return words.filter(range => !matches.some(match => match.intersection(range)));
}
