import { ContextTracker } from "@lezer/lr"

import { KnotName, StitchName } from "./generated/parser.terms"

export class KnotContext {
  constructor(public inKnot: boolean, public inStitch: boolean) {
  }
}

export const trackKnotName = new ContextTracker({
  start: new KnotContext(false, false),
  reduce(context, term) {
    if(term == KnotName) {
      return new KnotContext(true, false)
    } else if (term == StitchName) {
      return new KnotContext(true, true)
    } else {
      return context
    }
  },
})
