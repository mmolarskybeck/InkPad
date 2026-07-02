import { parser } from "./generated/parser"
import { LRLanguage, LanguageSupport, foldNodeProp } from "@codemirror/language"
import type { EditorState } from "@codemirror/state"
import type { SyntaxNode } from "@lezer/common"
import { styleTags, tags as t } from "@lezer/highlight"

function foldSection(tree: SyntaxNode, state: EditorState) {
        const from = state.doc.lineAt(tree.from).to
        let to = state.doc.lineAt(Math.max(tree.from, tree.to - 1)).to

        while (to > from) {
                const line = state.doc.lineAt(to)
                if (state.doc.sliceString(line.from, line.to).trim().length > 0) break
                if (line.number <= 1) break
                to = state.doc.line(line.number - 1).to
        }

        return to > from ? { from, to } : null
}

export const InkLanguage = LRLanguage.define(
        {
                parser: parser.configure({
                        props: [
                                foldNodeProp.add({
                                        Knot: foldSection,
                                        Function: foldSection,
                                        Stitch: foldSection,
                                }),
                                styleTags({
                                        // Comments
                                        BlockComment: t.blockComment,
                                        AuthorWarning: t.special(t.comment),
                                        LineComment: t.comment,

                                        // Plain content
                                        ContentLine: t.content,
                                        PreweaveChoiceContent: t.content,
                                        PostweaveChoiceContent: t.content,
                                        WeaveContent: t.content,
                                        SequenceContent: t.content,

                                        // Keywords
                                        Include: t.keyword,
                                        END: t.keyword,
                                        DONE: t.keyword,
                                        VariableDeclaration: t.keyword,
                                        ConstDeclaration: t.keyword,
                                        ListDeclaration: t.keyword,
                                        _function: t.keyword,
                                        Temp: t.keyword,
                                        Return: t.keyword,
                                        ref: t.keyword,
                                        stopping: t.keyword,
                                        shuffle: t.keyword,
                                        cycle: t.keyword,
                                        once: t.keyword,
                                        not: t.keyword,
                                        ListDefinition: t.keyword,
                                        StackDeclaration: t.keyword,
                                        VariableAssignment: t.operatorKeyword,
                                        SequenceTypeMarker: t.operatorKeyword,

                                        // Literal values
                                        Name: t.name,
                                        StitchName: t.name,
                                        KnotName: t.name,
                                        ListMember: t.literal,
                                        Path: t.name,
                                        SelectedName: t.literal,
                                        Bool: t.bool,
                                        _true: t.bool,
                                        _false: t.bool,
                                        Int: t.number,
                                        Float: t.number,
                                        String: t.string,

                                        // Tags
                                        Tag: t.labelName,
                                        ChoiceTag: t.labelName,

                                        // Brackets
                                        Stack: t.list,
                                        List: t.list,
                                        KnotArguments: t.bracket,
                                        WeaveBracket: t.squareBracket,
                                        BlockConditional: t.brace,
                                        Conditional: t.brace,
                                        InlineSequence: t.brace,
                                        InlineDisplayVariable: t.brace,
                                        BlockSequence: t.brace,
                                        BracketedChoiceName: t.paren,
                                        BracketedGatherName: t.paren,

                                        // Special operators
                                        Glue: t.operator,
                                        Pipe: t.separator,
                                        Gather: t.controlOperator,
                                        DivertArrow: t.controlOperator,
                                        TunnelReturn: t.controlOperator,
                                        OnceOnlyChoice: t.controlOperator,
                                        RepeatingChoice: t.controlOperator,
                                        ChoiceCondition: t.controlOperator,
                                        BlockConditionCase: t.controlOperator,
                                        BlockSequenceItem: t.controlOperator,


                                        // Sections
                                        Knot: t.heading1,
                                        Function: t.heading1,
                                        Stitch: t.heading2,

                                        // Standard operators
                                        Adjust: t.operator,
                                        IncDec: t.operator,
                                        ExpressionAndOr: t.logicOperator,
                                        ExpressionComparison: t.compareOperator,
                                        ExpressionPresence: t.compareOperator,
                                        ExpressionMod: t.arithmeticOperator,
                                        ExpressionAdd: t.arithmeticOperator,
                                        ExpressionSubstract: t.arithmeticOperator,
                                        ExpressionMultiply: t.arithmeticOperator,
                                        ExpressionDivide: t.arithmeticOperator,
                                        ExpressionNot: t.logicOperator,
                                        "=": t.operator
                                })
                        ]
                }), languageData: { commentTokens: { line: "//", block: { open: "/*", close: "*/" } } }
        });

export const InkLanguageSupport = (config: { dialect?: "visualink" } = {}) => {
        const configured = InkLanguage.configure(config)
        return new LanguageSupport(configured)
}
