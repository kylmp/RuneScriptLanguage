import { Position, Range, type TextEditor } from 'vscode';
import { DecorationRangeBehavior, window } from "vscode";
import { getAllInterpolationRanges, getAllMatches, getAllOperatorTokens, getAllParsedWords, getAllStringRanges } from '../cache/activeFileCache';
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

const stringDecoration = window.createTextEditorDecorationType({
  backgroundColor: 'rgba(255, 170, 60, 0.20)',
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
  editor.setDecorations(operatorDecoration, []);
  editor.setDecorations(stringDecoration, []);
  switch (mode) {
    case HighlightMode.Matches:
      editor.setDecorations(matchDecoration, getMatchRanges());
      break;
    case HighlightMode.AllWords:
      editor.setDecorations(matchDecoration, getMatchRanges());
      editor.setDecorations(wordDecoration, getWordRanges());
      editor.setDecorations(operatorDecoration, getOperatorTokenRanges());
      editor.setDecorations(stringDecoration, getStringRanges());
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

function getStringRanges(): Range[] {
  const stringRanges: Range[] = [];
  const interpolationRanges = getAllInterpolationRanges();
  getAllStringRanges().forEach((strings, lineNum) => {
    const interp = interpolationRanges.get(lineNum) ?? [];
    strings.forEach(stringRange => {
      const segments = subtractRanges(stringRange, interp);
      segments.forEach(segment => {
        stringRanges.push(new Range(new Position(lineNum, segment.start), new Position(lineNum, segment.end + 1)));
      });
    });
  });
  return stringRanges;
}

function subtractRanges(base: { start: number; end: number; }, exclusions: { start: number; end: number; }[]): { start: number; end: number; }[] {
  let segments: { start: number; end: number; }[] = [base];
  for (const exclusion of exclusions) {
    segments = segments.flatMap(segment => subtractSingleRange(segment, exclusion));
    if (segments.length === 0) break;
  }
  return segments;
}

function subtractSingleRange(base: { start: number; end: number; }, exclusion: { start: number; end: number; }): { start: number; end: number; }[] {
  if (exclusion.end < base.start || exclusion.start > base.end) {
    return [base];
  }
  const result: { start: number; end: number; }[] = [];
  if (exclusion.start > base.start) {
    result.push({ start: base.start, end: exclusion.start - 1 });
  }
  if (exclusion.end < base.end) {
    result.push({ start: exclusion.end + 1, end: base.end });
  }
  return result;
}
