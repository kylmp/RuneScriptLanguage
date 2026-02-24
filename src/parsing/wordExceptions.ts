import { Trie } from '../cache/class/Trie';

const exceptionsTrie = new Trie();
const STANDARD_WORD_REGEX = /^(?:\.\w+|\w+:\w+|\w+)$/;

export function findFileExceptionWords(lines: string[]): void {
  for (const lineText of lines) {
    const matches = lineText.matchAll(/\[([^\]]+)\]/g);
    for (const match of matches) {
      const inner = match[1];
      if (!inner) continue;
      const commaIndex = inner.indexOf(',');
      const word = (commaIndex >= 0 ? inner.slice(commaIndex + 1) : inner).trim();
      if (word) {
        addExceptionWord(word);
      }
    }
  }
}

export function addExceptionWord(word: string): void {
  if (!STANDARD_WORD_REGEX.test(word) && !exceptionsTrie.hasWord(word)) {
    exceptionsTrie.insert(word);
  }
}

export function clearExceptionWords(): void {
  exceptionsTrie.clear();
}

export function getExceptionWords(): string[] {
  return exceptionsTrie.getAllWords();
}

export function matchLongestException(text: string, startIndex: number): number {
  return exceptionsTrie.matchLongest(text, startIndex);
}
