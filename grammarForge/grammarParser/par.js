"use strict";

GrammarForge.Par = class Par extends GrammarForge.Word {
    constructor(expression, parType = null) {
        super();
        this.expression = expression;
        this.parType = parType;
        this.parString = this.toString();
    }

    computeLookaheadSetAndFreeze(parser) {
        if (this.lookaheadSet)
            return this.lookaheadSet;
        
        this.lookaheadSet = this.expression.computeLookaheadSetAndFreeze(parser);
        Object.freeze(this);

        return this.lookaheadSet;
    }

    getLookaheadSet() {
        return this.lookaheadSet;
    }

    parTypeToString(parType) {
        switch (parType) {
            case "QUESTION":
                return "?";
            case "STAR":
                return "*";
            case "PLUS":
                return "+";
            default:
                return "";
        }
    }

    getParseFunc = (parser) => {
        let funcIndex = parser.ruleSubFunctionLookup.get(this.parString);
        if (funcIndex === undefined) {
            let func;
            const expressionTryParseFunc = this.expression.getTryParseFunc(parser);
            switch (this.parType) {
                case "QUESTION":
                    func = (tokenStream, result) => {
                        const expResult = [];
                        if (!tokenStream.end()) {
                            const clonedStream = tokenStream.clone();
                            const exprResult = expressionTryParseFunc(clonedStream, expResult);
                            if (exprResult)
                                tokenStream.index = clonedStream.index;
                        }

                        result.push(expResult);
                        return true;
                    }
                    break;
                case "STAR":
                    func = (tokenStream, result) => {
                        const resultSubArr = [];
                        const clonedStream = tokenStream.clone();
                        while (true) {
                            if (tokenStream.end())
                                break;

                            const expResult = [];
                            const exprResult = expressionTryParseFunc(clonedStream, expResult);
                            if (exprResult) {
                                tokenStream.index = clonedStream.index;
                                resultSubArr.push(expResult);
                            }
                            else {
                                break;
                            }
                        }

                        result.push(resultSubArr);
                        return true;
                    }
                    break;
                case "PLUS":
                    const expressionParseFunc = this.expression.getParseFunc(parser);
                    func = (tokenStream, result) => {
                        const resultSubArr = [];
                        const firstExpResult = [];
                        expressionParseFunc(tokenStream, firstExpResult);
                        resultSubArr.push(firstExpResult);
                        const clonedStream = tokenStream.clone();
                        while (true) {
                            if (tokenStream.end())
                                break;

                            const expResult = [];
                            const exprResult = expressionTryParseFunc(clonedStream, expResult);
                            if (exprResult) {
                                tokenStream.index = clonedStream.index;
                                resultSubArr.push(expResult);
                            }
                            else {
                                break;
                            }
                        }

                        result.push(resultSubArr);
                        return true;
                    }
                    break;
                default:
                    throw new Error(`Par type ${this.parType} not supported in getParseFunc`);
            }

            funcIndex = parser.addSubFunction(this.parString, func);
        }
        
        return parser.ruleSubFunctions[funcIndex];
    }

    getTryParseFunc = (parser) => {
        let funcIndex = parser.ruleTrySubFunctionLookup.get(this.parString);
        if (funcIndex === undefined) {
            let tryFunc;
            const expressionTryParseFunc = this.expression.getTryParseFunc(parser);
            switch (this.parType) {
                case "QUESTION":
                    tryFunc = (tokenStream, result) => {
                        const expResult = [];
                        const clonedStream = tokenStream.clone();
                        const exprResult = expressionTryParseFunc(clonedStream, expResult);
                        if (exprResult)
                            tokenStream.index = clonedStream.index;

                        result.push(expResult);
                        return true;
                    }
                    break;
                case "STAR":
                    tryFunc = (tokenStream, result) => {
                        const resultSubArr = [];
                        const clonedStream = tokenStream.clone();
                        while (true) {
                            const expResult = [];
                            const exprResult = expressionTryParseFunc(clonedStream, expResult);
                            if (exprResult) {
                                tokenStream.index = clonedStream.index;
                                resultSubArr.push(expResult);
                            }
                            else {
                                break;
                            }
                        }

                        result.push(resultSubArr);
                        return true;
                    }
                    break;
                case "PLUS":
                    tryFunc = (tokenStream, result) => {
                        const resultSubArr = [];
                        const firstExpResult = [];
                        const clonedStream = tokenStream.clone();
                        const firstResult = expressionTryParseFunc(clonedStream, firstExpResult);
                        resultSubArr.push(firstExpResult);
                        if (!firstResult)
                            return null;
                        
                        tokenStream.index = clonedStream.index;
                        while (true) {
                            const expResult = [];
                            const exprResult = expressionTryParseFunc(clonedStream, expResult);
                            if (exprResult) {
                                tokenStream.index = clonedStream.index;
                                resultSubArr.push(expResult);
                            }
                            else {
                                break;
                            }
                        }

                        result.push(resultSubArr);
                        return true;
                    }
                    break;
                default:
                    throw new Error(`Par type ${this.parType} not supported in getParseFunc`);
            }

            funcIndex = parser.addTrySubFunction(this.parString, tryFunc);
        }

        return parser.ruleTrySubFunctions[funcIndex];
    }

    getCheckFunction = (exec) => {
        switch (this.parType) {
            case "QUESTION":
            case "STAR":
                return (ast) => {
                    exec.check_optional(ast);
                }
            case "PLUS":
                return (ast) => {
                    exec.check_required(ast);
                }
            default:
                throw new Error(`getCheckFunction: Par type ${this.parType} not supported`);
        }
    }

    getBaseFunction = (exec) => {
        const expressionFunc = this.expression.getBaseFunction(exec);
        let func;
        switch (this.parType) {
            case "QUESTION":
                func = (ast) => {
                    return () => {
                        if (ast.length === 0)
                            return [];

                        return expressionFunc(ast);
                    }
                }
                break;
            case "STAR":
            case "PLUS":
                func = (ast) => {
                    return () => {
                        const results = [];
                        for (let i = 0; i < ast.length; i++) {
                            results.push(expressionFunc(ast[i]));
                        }

                        return results;
                    }
                }
                break;
            default:
                throw new Error(`getExecFunction: Par type ${this.parType} not supported`);
        }

        return func;
    }

    hasNonTerminal = () => {
        return this.expression.hasNonTerminal();
    }

    toString() {
        return `(${this.expression.toString()})${this.parTypeToString(this.parType)}`;
    }
}