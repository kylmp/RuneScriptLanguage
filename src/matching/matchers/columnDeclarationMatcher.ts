import type { MatchContext, Matcher } from "../../types";
import { declaration } from "../../utils/matchUtils";
import { DBCOLUMN, SKIP } from "../matchType";

function columnDeclarationMatcherFn(context: MatchContext): void {
  if (context.file.type === 'dbtable') {
    if (context.word.index === 1) return declaration(DBCOLUMN, context);
    if (context.word.index > 1) return declaration(SKIP, context);
  }
}

export const columnDeclarationMatcher: Matcher = { priority: 2000, fn: columnDeclarationMatcherFn};
