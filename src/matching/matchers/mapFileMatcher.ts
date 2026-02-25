import type { MatchContext, Matcher } from '../../types';
import { reference } from "../../utils/matchUtils";
import { MAPFILE } from "../matchType";

const MAP_FILE_REGEX = /^[lm]\d+_\d+$/i;

export function isMapFileName(value: string): boolean {
  return MAP_FILE_REGEX.test(value);
}

/**
* Looks for map file name references (l##_## or m##_## -> *.jm2)
*/
function mapFileMatcherFn(context: MatchContext): void {
  if (context.word.inString || context.word.inInterpolation) {
    return;
  }
  if (!isMapFileName(context.word.value)) {
    return;
  }
  reference(MAPFILE, context);
}

export const mapFileMatcher: Matcher = { priority: 12500, fn: mapFileMatcherFn };
