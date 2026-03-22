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

    _getResult = (result) => {
        if (GrammarForge.makeFullAST) {
            return [ 'EXPLIST', result ];
        }
        else {
            return result;
        }
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
                        return this._getResult(expressionResult);
                    }
                    break;
                default:
                    const expressionTryParseFuncs = [];
                    const expressionStrings = [];
                    const expressionLookaheadSets = [];
                    for (let i = 0; i < this.expressions.length; i++) {
                        expressionTryParseFuncs.push(this.expressions[i].getTryParseFunc(parser));
                        expressionStrings.push(this.expressions[i].expressionString);
                        expressionLookaheadSets.push(this.expressions[i].getLookaheadSet(parser));
                    }

                    func = (tokenStream) => {
                        const token = tokenStream.tryCurrentToken();
                        if (token === null)
                            return new GrammarForge.EmptyNode();//Fall back for an empty program.

                        for (let i = 0; i < this.expressions.length; i++) {
                            if (token.type === 'SYMBOL') {
                                if (!expressionLookaheadSets[i].has(token.value))
                                    continue;
                            }
                            else {
                                if (!expressionLookaheadSets[i].has(token.type))
                                    continue;
                            }

                            const tryParseResult = expressionTryParseFuncs[i](tokenStream);
                            if (tryParseResult) {
                                return this._getResult(tryParseResult);
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
                        
                        return this._getResult(tryParseResult);
                    }
                    break;
                default:
                    const expressionTryParseFuncs = [];
                    const expressionStrings = [];
                    const expressionLookaheadSets = [];
                    for (let i = 0; i < this.expressions.length; i++) {
                        expressionTryParseFuncs.push(this.expressions[i].getTryParseFunc(parser));
                        expressionStrings.push(this.expressions[i].expressionString);
                        expressionLookaheadSets.push(this.expressions[i].getLookaheadSet(parser));
                    }

                    tryFunc = (tokenStream) => {
                        const token = tokenStream.tryCurrentToken();
                        if (token === null)
                            return null;
                        
                        for (let i = 0; i < this.expressions.length; i++) {
                            if (token.type === 'SYMBOL') {
                                if (!expressionLookaheadSets[i].has(token.value))
                                    continue;
                            }
                            else {
                                if (!expressionLookaheadSets[i].has(token.type))
                                    continue;
                            }

                            const tryParseResult = expressionTryParseFuncs[i](tokenStream);
                            if (tryParseResult) {
                                return this._getResult(tryParseResult);
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

    setNonTerminalIndexs = (containsOptional) => {
        const firstExpression = this.expressions[0];
        const firstExpressionNonTerminalIndexesCount = firstExpression.setNonTerminalIndexs(containsOptional);
        if (firstExpressionNonTerminalIndexesCount <= 0)
            return 0;

        if (this.expressions.length === 1)
            return firstExpressionNonTerminalIndexesCount;

        return this.getNonTerminalsFromIndexs(containsOptional).length;
    }

    getNonTerminalsFromIndexs = (containsOptional) => {
        const firstExpression = this.expressions[0];
        const firstExpressionNonTerminals = firstExpression.getNonTerminalsFromIndexs(containsOptional);
        for (const nonTerminal of firstExpressionNonTerminals) {
            if (nonTerminal.value === undefined)
                throw new Error(`Non-terminal in expression ${firstExpression.expressionString} has no value.`);
        }

        for (let i = 1; i < this.expressions.length; i++) {
            const expression = this.expressions[i];
            const expressionNonTerminals = expression.getNonTerminalsFromIndexs(containsOptional);
            let match = true;
            if (expressionNonTerminals.length !== firstExpressionNonTerminals.length) {
                match = false;
            }
            else {
                for (let j = 0; j < firstExpressionNonTerminals.length; j++) {
                    const firstNonTerminal = firstExpressionNonTerminals[j];
                    const expressionNonTerminal = expressionNonTerminals[j];
                    if (firstNonTerminal.value !== expressionNonTerminal.value) {
                        match = false;
                        break;
                    }
                }
            }

            if (!match)
                throw new Error(`All expressions in an ExpList must have the same non-terminals and they must be in the same order in each expression.  Expression 0 does not match expression ${i}.\nExpression 0 non-terminals: ${firstExpressionNonTerminals.map(nt => nt.toString()).join(", ")}\nExpression ${i} non-terminals: ${expressionNonTerminals.map(nt => nt.toString()).join(", ")}`);
        }

        return firstExpressionNonTerminals;
    }

    getChildren = (parser, childrenIndexSet) => {
        for (let i = 0; i < this.expressions.length; i++) {
            const expr = this.expressions[i];
            expr.getChildren(parser, childrenIndexSet);
        }
    }
    
    // walk = function*() {
    //     yield this.expressions;
    // }

    toString(useNewlines = false) {
        return `${this.expressions.map(expr => expr.toString()).join(useNewlines ? "\n| " : " | ")}`;
    }
}