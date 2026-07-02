import { ExternalTokenizer } from "@lezer/lr"

import { inlineConditionalOpen, inlineSequenceOpen, inlineDisplayVariableOpen, blockOpen, endOfKnotMarker, endOfStitchMarker } from "./generated/parser.terms"

const pipe = 124, colon = 58, braceL = 123, braceR = 125, newLine = 10, equal = 61

export const endOfKnot = new ExternalTokenizer((input, stack) => {
  const doubleEquals = input.peek(0) == equal && input.peek(1) == equal
  const endOfFile = input.peek(0) == -1
  if(stack.context.inKnot && (doubleEquals || endOfFile)) {
    input.acceptToken(endOfKnotMarker)
    return
  }
  if(stack.context.inStitch && input.peek(0) == equal) {
    input.acceptToken(endOfStitchMarker)
    return
  }
}, {contextual: true})

export const checkBrace = new ExternalTokenizer((input) => {
        let ahead = 0
        let peeked = input.peek(0)
        let nestedOpeningCount = 0
        while (peeked !== -1) {
                if (peeked === braceL) {
                        nestedOpeningCount++

                        ahead++
                        peeked = input.peek(ahead)
                } else if (peeked === pipe) {
                        input.acceptToken(inlineSequenceOpen)
                        return
                } else if (peeked === braceR) {
                        if (nestedOpeningCount === 0) {
                                input.acceptToken(inlineDisplayVariableOpen)
                                return
                        } else {
                                nestedOpeningCount--
                                ahead++
                                peeked = input.peek(ahead)
                        }
                } else if (peeked === colon) {
                        ahead++
                        peeked = input.peek(ahead)
                        while (peeked !== -1) {
                                if (peeked === braceL) {
                                        nestedOpeningCount++
                                        ahead++
                                        peeked = input.peek(ahead)
                                } else if (peeked === newLine) {
                                        input.acceptToken(blockOpen)
                                        return
                                } else if (peeked === braceR) {
                                        if (nestedOpeningCount === 0) {
                                                input.acceptToken(inlineConditionalOpen)
                                                return
                                        } else {
                                                nestedOpeningCount--
                                        }
                                }
                                ahead++
                                peeked = input.peek(ahead)
                        }
                } else if (peeked === newLine) {
                        return
                } else {
                        ahead++
                        peeked = input.peek(ahead)
                }
        }
}, { fallback: true })
