"use strict";

GrammarForge.Expression = class Expression {
    constructor(words, index, metadata = []) {
        if (!words)
            throw new Error("words is required");

        if (!Array.isArray(words))
            throw new Error("words must be an array");

        if (!Array.isArray(metadata))
            throw new Error("metadata must be an array");

        this.words = words;
        this.index = index;
        this.metadata = metadata;
        this.tag = this.metadata.length > 0 ? this.metadata[0] : null;
        this.expressionString = this.toString();
        this.subFuncString = this.expressionString + `$E`;
        Object.freeze(this.words);
    }

    checkMetadata = (rule) => {
        if (this.metadata.length === 0)
            return;

        const tag = this.metadata[0];
        if (this.tag !== tag)
            throw new Error(`Expression tag mismatch.  Expected: ${this.tag}, found: ${tag} in expression: ${this.expressionString}`);

        if (GrammarForge.Expression.tags.has(tag))
            return;

        if (this.metadata.length > 1) {
            if (GrammarForge.Rule.tags.has(tag)) {
                throw new Error(`${tag} is a rule tag, but was on an expression with additional metadata: ${this.metadata.join(" ")}.  Either remove the extra metadata or move the tag to the rule level.`);
            }
            else {
                throw new Error(`Unknown expression tag: ${tag}`);
            }
        }

        if (rule.expressions.length > 1) {
            let allMatch = true;
            for (let i = 0; i < rule.expressions.length; i++) {
                const expr = rule.expressions[i];
                if (expr === this)
                    continue;

                if (expr.metadata.length !== 1 || expr.metadata[0] !== tag) {
                    allMatch = false;
                    break;
                }
            }

            if (allMatch) {
                rule.tag = tag;
                for (let i = 0; i < rule.expressions.length; i++) {
                    const expr = rule.expressions[i];
                    expr.metadata = [];
                    expr.tag = null;
                }

                return;
            }
            else {
                throw new Error(`${tag} is a rule tag, but was put on an expression: ${this.expressionString}, but the rule (${rule.name}) has multiple expressions and not all expressions have the same tag.  Either remove the expression tag or move it to the rule level.`);
            }
        }

        if (rule.tag !== null)
            throw new Error(`${tag} is a rule tag, but the rule already has a tag: ${rule.tag}.  A rule can't have multiple tags.  Either remove the expression tag or move it to the rule level.`);

        rule.tag = tag;
        this.metadata = [];
        this.tag = null;
    }

    computeLookaheadSetAndFreeze(parser) {
        if (this.lookaheadSet)
            return this.lookaheadSet;
        
        this.lookaheadSet = new Set();
        if (this.words.length < 1)
            throw new Error("Tried to compute lookahead set for empty expression.");

        const firstWord = this.words[0];
        const firstSet = firstWord.computeLookaheadSetAndFreeze(parser);
        for (const token of firstSet) {
            this.lookaheadSet.add(token);
        }

        Object.freeze(this.lookaheadSet);
        Object.freeze(this);

        return this.lookaheadSet;
    }

    getParseFunc = (parser) => {
        let funcIndex = parser.ruleSubFunctionLookup.get(this.subFuncString);
        if (funcIndex === undefined) {
            if (this.words.length === 0)
                throw new Error("Cannot create parse function for empty expression");

            let func;
            const length = this.words.length;
            const wordFunctions = [];
            for (let i = 0; i < this.words.length; i++) {
                wordFunctions.push(this.words[i].getParseFunc(parser));
            }

            func = (tokenStream) => {
                const result = [];
                for (let i = 0; i < wordFunctions.length; i++) {
                    const wordResult = wordFunctions[i](tokenStream);
                    if (!wordResult)
                        throw new Error("Parse function for expression failed unexpectedly.");

                    result.push(wordResult);
                }

                return [ 'EXP', result, ['LENGTH', length] ];
            }

            funcIndex = parser.addSubFunction(this.subFuncString, func);
        }

        return parser.ruleSubFunctions[funcIndex];
    }

    getTryParseFunc = (parser) => {
        let funcIndex = parser.ruleTrySubFunctionLookup.get(this.subFuncString);
        if (funcIndex === undefined) {
            if (this.words.length === 0)
                throw new Error("Cannot create parse function for empty expression");

            let tryFunc;
            const length = this.words.length;
            const wordTryFunctions = [];
            for (let i = 0; i < this.words.length; i++) {
                wordTryFunctions.push(this.words[i].getTryParseFunc(parser));
            }

            tryFunc = (tokenStream) => {
                const clonedStream = tokenStream.clone();
                const result = [];
                for (let i = 0; i < wordTryFunctions.length; i++) {
                    const wordResult = wordTryFunctions[i](clonedStream);
                    if (!wordResult)
                        return null;

                    result.push(wordResult);
                }

                tokenStream.index = clonedStream.index;
                return [ 'EXP', result, ['LENGTH', length] ];
            }

            funcIndex = parser.addTrySubFunction(this.subFuncString, tryFunc);
        }

        return parser.ruleTrySubFunctions[funcIndex];
    }

    getCheckFunction = (exec) => {
        const length = this.words.length;
        return (ast) => {
            exec.check_length(ast, length);
        }
    }

    getBaseFunction = (exec) => {
        //const exprString = this.expressionString;
        const baseFunctions = [];
        for (let i = 0; i < this.words.length; i++) {
            baseFunctions.push(this.words[i].getBaseFunction(exec));
        }

        const len = this.words.length;
        const checkFunc = this.getCheckFunction(exec);
        return (ast) => {
            const [ expType, innerAST, lengthInfo ] = ast;
            if (expType !== 'EXP')
                throw new Error(`Expected EXP AST node, got ${expType}`);

            const [ lengthTag, length ] = lengthInfo;
            if (lengthTag !== 'LENGTH')
                throw new Error(`Expected LENGTH info in EXP AST node, got ${lengthTag}`);

            if (length !== len)
                throw new Error(`Expected EXP AST node length ${len}, got ${length}`);

            checkFunc(innerAST);

            const results = [];
            for (let i = 0; i < baseFunctions.length; i++) {
                results.push(baseFunctions[i](innerAST[i]));
            }

            //const t = exprString;
            
            return results;
        }
    }

    tryGetNonTerminals = () => {
        const nonTerminals = [];
        for (let i = 0; i < this.words.length; i++) {
            const word = this.words[i];
            const wordNonTerminals = word.tryGetNonTerminals();
            if (!wordNonTerminals)
                return null;

            if (wordNonTerminals.length === 0)
                continue;

            nonTerminals.push(...wordNonTerminals);
        }

        return nonTerminals;
    }

    getNonTerminals = () => {
        const nonTerminals = [];
        for (let i = 0; i < this.words.length; i++) {
            const word = this.words[i];
            if (word.hasNonTerminal())
                nonTerminals.push(i);
        }

        return nonTerminals;
    }

    hasNonTerminal = () => {
        return this.getNonTerminals().length > 0;
    }

    getChildren = (parser, childrenIndexSet) => {
        for (let j = 0; j < this.words.length; j++) {
            const word = this.words[j];
            word.getChildren(parser, childrenIndexSet);
        }
    }

    toString() {
        return this.words.map(word => word.toString()).join(" ");
    }
}

GrammarForge.Expression.tags = new Set([
    'declare',//no_value - optional info after tag for not having to provide a value
    'assign',//no_declare - optional info after tag for not having to declare first
    'get',
    'while',
    'foreach',
    'for',
    'if',//Assumes the first stmt is the if body and the second is the else body (if present)
    'par',
    'break',
    'continue',
    'return',
    'func_declare',
    'func_call',
    '+',
    '-',
    '*',
    '/',
    '%',
    '==',
    '!=',
    '<',
    '<=',
    '>',
    '>=',
    '&&',
    '||',
    '!',
    '^',
    '-#',
    '+#',
]);

GrammarForge.Expression.operatorTagPrecedence = new Map([
    ['||', 0],
    ['&&', 1],
    ['==', 2],
    ['!=', 2],
    ['<', 2],
    ['<=', 2],
    ['>', 2],
    ['>=', 2],
    ['+', 3],
    ['-', 3],
    ['*', 4],
    ['/', 4],
    ['%', 4],
    ['!', 5],
    ['-#', 5],
    ['+#', 5],
    ['^', 6],
]);

GrammarForge.Expression.operatorTagToOperator = new Map([
    ['+', '+'],
    ['-', '-'],
    ['*', '*'],
    ['/', '/'],
    ['%', '%'],
    ['==', '=='],
    ['!=', '!='],
    ['<', '<'],
    ['<=', '<='],
    ['>', '>'],
    ['>=', '>='],
    ['&&', '&&'],
    ['||', '||'],
    ['!', '!'],
    ['^', '^'],
    ['-#', '-'],
    ['+#', '+'],
])

GrammarForge.Expression.operatorTags = new Set([
    '+',
    '-',
    '*',
    '/',
    '%',
    '==',
    '!=',
    '<',
    '<=',
    '>',
    '>=',
    '&&',
    '||',
    '!',
    '^',
    '-#',
    '+#',
]);