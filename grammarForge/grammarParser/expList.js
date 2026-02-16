"use strict";

GrammarForge.ExpList = class ExpList extends GrammarForge.Word {
    constructor(expressions) {
        super();
        if (!Array.isArray(expressions) || expressions.length === 0)
            throw new Error("expressions must be a non-empty array");

        this.expressions = expressions;
        this.expListString = this.toString();
        this.subFuncString = this.expListString + `$EL`;
    }

    computeLookaheadSetAndFreeze(parser) {
        if (this.lookaheadSet)
            return this.lookaheadSet;
        
        this.lookaheadSet = new Set();
        for (const expr of this.expressions) {
            const exprLookaheadSet = expr.computeLookaheadSetAndFreeze(parser);
            if (!exprLookaheadSet)
                throw new Error("Expression in ExpList has no lookahead set.");

            for (const tokenType of exprLookaheadSet) {
                this.lookaheadSet.add(tokenType);
            }
        }
        
        Object.freeze(this.lookaheadSet);
        Object.freeze(this);

        return this.lookaheadSet;
    }

    getParseFunc = (parser) => {
        let funcIndex = parser.ruleSubFunctionLookup.get(this.subFuncString);
        if (funcIndex === undefined) {
            let func;
            switch (this.expressions.length) {
                case 0:
                    throw new Error(`ExpList has no expressions.`);
                case 1:
                    const expression = this.expressions[0];
                    const expressionParse = expression.getParseFunc(parser);
                    const expressionString = expression.expressionString;
                    func = (tokenStream) => {
                        const expressionResult = expressionParse(tokenStream);
                        return [ 'EXPLIST', expressionResult, [ 'EXPRESSION', 0, expressionString ] ];
                    }
                    break;
                default:
                    const expressionTryParseFuncs = [];
                    const expressionStrings = [];
                    const expressionLookaheadSets = [];
                    for (let i = 0; i < this.expressions.length; i++) {
                        expressionTryParseFuncs.push(this.expressions[i].getTryParseFunc(parser));
                        expressionStrings.push(this.expressions[i].expressionString);
                        expressionLookaheadSets.push(this.expressions[i].computeLookaheadSetAndFreeze(parser));
                    }

                    func = (tokenStream) => {
                        const token = tokenStream.currentToken();
                        for (let i = 0; i < this.expressions.length; i++) {
                            if (!expressionLookaheadSets[i].has(token.type))
                                continue;

                            const tryParseResult = expressionTryParseFuncs[i](tokenStream);
                            if (tryParseResult) {
                                return [ 'EXPLIST', tryParseResult, [ 'EXPRESSION', i, expressionStrings[i] ] ];
                            }
                        }

                        throw new Error(`No expressions parsed successfully for ExpList with multiple expressions.`);
                    }
                    break;
            }

            funcIndex = parser.addSubFunction(this.subFuncString, func);
        }

        return parser.ruleSubFunctions[funcIndex];
    }

    getTryParseFunc = (parser) => {
        let funcIndex = parser.ruleTrySubFunctionLookup.get(this.subFuncString);
        if (funcIndex === undefined) {
            let tryFunc;
            switch (this.expressions.length) {
                case 0:
                    throw new Error(`ExpList has no expressions.`);
                case 1:
                    const expression = this.expressions[0];
                    const expressionString = expression.expressionString;
                    const expressionTryParse = expression.getTryParseFunc(parser);

                    tryFunc = (tokenStream) => {
                        const tryParseResult = expressionTryParse(tokenStream);
                        if (!tryParseResult)
                            return null;
                        
                        return [ 'EXPLIST', tryParseResult, [ 'EXPRESSION', 0, expressionString ] ];
                    }
                    break;
                default:
                    const expressionTryParseFuncs = [];
                    const expressionStrings = [];
                    const expressionLookaheadSets = [];
                    for (let i = 0; i < this.expressions.length; i++) {
                        expressionTryParseFuncs.push(this.expressions[i].getTryParseFunc(parser));
                        expressionStrings.push(this.expressions[i].expressionString);
                        expressionLookaheadSets.push(this.expressions[i].computeLookaheadSetAndFreeze(parser));
                    }

                    tryFunc = (tokenStream) => {
                        const token = tokenStream.tryCurrentToken();
                        if (token === null)
                            return null;
                        
                        for (let i = 0; i < this.expressions.length; i++) {
                            if (!expressionLookaheadSets[i].has(token.type))
                                continue;

                            const tryParseResult = expressionTryParseFuncs[i](tokenStream);
                            if (tryParseResult) {
                                return [ 'EXPLIST', tryParseResult, [ 'EXPRESSION', i, expressionStrings[i] ] ];
                            }
                        }

                        return null;
                    }
                    break;
            }

            funcIndex = parser.addTrySubFunction(this.subFuncString, tryFunc);
        }
        
        return parser.ruleTrySubFunctions[funcIndex];
    }

    getCheckFunction = (exec) => {
        return (ast) => {
            exec.check_required(ast);
        }
    }

    getBaseFunction = (exec) => {
        if (!this.expressions || this.expressions.length === 0)
            throw new Error("ExpList has no expressions");

        const expressionBaseFuncs = [];
        const expressionStrings = [];
        for (let i = 0; i < this.expressions.length; i++) {
            const expression = this.expressions[i];
            expressionBaseFuncs.push(expression.getBaseFunction(exec));
            expressionStrings.push(expression.expressionString);
        }
        
        const checkFunc = this.getCheckFunction(exec);
        return (ast) => {
            exec.check_length(ast, 3);
            const [ type, innerAST, expressionInfo ] = ast;
            if (type !== 'EXPLIST')
                throw new Error(`Expected ${'EXPLIST'} node, found ${type}`);

            const [expressionInfoType, index, expressionStr] = expressionInfo;
            if (expressionInfoType !== 'EXPRESSION')
                throw new Error(`Expected EXPRESSION node, found ${type}`);

            if (expressionStr !== expressionStrings[index])
                throw new Error(`Expression string mismatch for ExpList ${this.expListString} at index ${index}. Expected: ${expressionStrings[index]}, found: ${expressionStr}`);

            const expressionBaseFunc = expressionBaseFuncs[index];
            if (!expressionBaseFunc)
                throw new Error(`No exec function found for expression index ${index} in ExpList ${this.expListString}`);

            checkFunc(innerAST);
            
            return expressionBaseFunc(innerAST);
        }
    }

    tryGetNonTerminals = () => {
        const nonTerminals = this.expressions[0].tryGetNonTerminals();
        if (nonTerminals === null)
            return null;

        for (let i = 1; i < this.expressions.length; i++) {
            const exprNonTerminals = this.expressions[i].tryGetNonTerminals();
            if (exprNonTerminals === null)
                return null;

            if (exprNonTerminals.length !== nonTerminals.length)
                return null;

            for (let j = 0; j < nonTerminals.length; j++) {
                if (exprNonTerminals[j] !== nonTerminals[j])
                    return null;
            }
        }

        return nonTerminals;
    }

    hasNonTerminal = () => {
        //If this function passes, it means you can treat it's output as if there is only one expression because 
        // they have the same order and structure, just different terminal symbols.

        if (this.expressions.length === 1) {
            return this.expressions[0].hasNonTerminal();
        }

        const firstNonTerminalIndexes = this.expressions[0].getNonTerminals();
        if (firstNonTerminalIndexes.length === 0)
            return false;

        //Check indexes match for all sub-expressions
        for (let i = 1; i < this.expressions.length; i++) {
            const exprNonTerminalIndexes = this.expressions[i].getNonTerminals();
            if (firstNonTerminalIndexes.length !== exprNonTerminalIndexes.length)
                return false;

            for (let j = 0; j < firstNonTerminalIndexes.length; j++) {
                if (firstNonTerminalIndexes[j] !== exprNonTerminalIndexes[j])
                    return false;
            }
        }

        //Index matches don't garuntee the types match, so check types too
        const firstNonTerminals = this.expressions[0].tryGetNonTerminals();
        if (firstNonTerminals === null)
            return false;

        for (let i = 1; i < this.expressions.length; i++) {
            const exprNonTerminals = this.expressions[i].tryGetNonTerminals();
            if (exprNonTerminals === null)
                return false;

            if (exprNonTerminals.length !== firstNonTerminals.length)
                return false;

            for (let j = 0; j < firstNonTerminals.length; j++) {
                if (exprNonTerminals[j] !== firstNonTerminals[j])
                    return false;
            }
        }

        return true;
    }

    getChildren = (parser, childrenIndexSet) => {
        for (let i = 0; i < this.expressions.length; i++) {
            const expr = this.expressions[i];
            expr.getChildren(parser, childrenIndexSet);
        }
    }

    toString() {
        return `${this.expressions.map(expr => expr.toString()).join(" | ")}`;
    }
}