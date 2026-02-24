import type { MatchContext, Matcher } from "../../types";
import { declaration } from "../../utils/matchUtils";
import { CONSTANT } from "../matchType";

function constDeclarationMatcherFn(context: MatchContext): void {
  if (context.prevChar === '^' && context.file.type === "constant") declaration(CONSTANT, context);
}

export const constDeclarationMatcher: Matcher = { priority: 4000, fn: constDeclarationMatcherFn};
