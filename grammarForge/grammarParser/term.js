"use strict";

GrammarForge.Term = class Term extends GrammarForge.Word {
    constructor(token) {
        super();
        this.type = token.type;
        this.value = token.value;
        
        this.string = this.toString();
    }

    computeLookaheadSetAndFreeze(parser) {
        if (this.lookaheadSet)
            return this.lookaheadSet;
        
        if (this.type === "IDENTIFIER") {
            const rule = parser.getRule(this.value);
            if (!rule)
                throw new Error(`No rule found for identifier ${this.value}`);

            this.lookaheadSet = rule.computeLookaheadSetAndFreeze(parser);
        }
        else {
            this.lookaheadSet = new Set([this.value]);
        }

        Object.freeze(this.lookaheadSet);
        Object.freeze(this);

        return this.lookaheadSet;
    }

    getLookaheadSet() {
        return this.lookaheadSet;
    }

    getParseFunc = (parser) => {
        let funcIndex = parser.ruleSubFunctionLookup.get(this.string);
        if (funcIndex === undefined) {
            let func;
            switch (this.type) {
                case "IDENTIFIER":
                    const rule = parser.getRule(this.value);
                    if (!rule)
                        throw new Error(`No rule found for identifier ${this.value}`);

                    func = (tokenStream, result) => {
                        result.push(parser.ruleFunctions[rule.index](tokenStream));
                    };
                    break;
                case "TOKEN":
                    const tokenType = this.value;
                    func = (tokenStream, result) => {
                        result.push(parser.token(tokenStream, tokenType));
                    };
                    break;
                case "SYMBOL":
                    const symbol = this.value;
                    func = (tokenStream, result) => {
                        result.push(parser.symbol(tokenStream, symbol));
                    };
                    break;
                default:
                    throw new Error(`getSingleWordParseFunc: ${this.type} not supported`);
            }

            funcIndex = parser.addSubFunction(this.string, func);
        }
        
        return parser.ruleSubFunctions[funcIndex];
    }

    getTryParseFunc = (parser) => {
        let funcIndex = parser.ruleTrySubFunctionLookup.get(this.string);
        if (funcIndex === undefined) {
            let func;
            switch (this.type) {
                case "IDENTIFIER":
                    const rule = parser.getRule(this.value);
                    if (!rule)
                        throw new Error(`No rule found for identifier ${this.value}`);

                    func = (tokenStream, result) => {
                        const parseResult = parser.ruleTryFunctions[rule.index](tokenStream);
                        if (!parseResult)
                            return false;

                        result.push(parseResult);
                        return true;
                    };
                    break;
                case "TOKEN":
                    const tokenType = this.value;
                    func = (tokenStream, result) => {
                        const parseResult = parser.try_token(tokenStream, tokenType);
                        if (!parseResult)
                            return false;

                        result.push(parseResult);
                        return true;
                    };
                    break;
                case "SYMBOL":
                    const symbol = this.value;
                    func = (tokenStream, result) => {
                        const parseResult = parser.try_symbol(tokenStream, symbol);
                        if (!parseResult)
                            return false;

                        result.push(parseResult);
                        return true;
                    };
                    break;
                default:
                    throw new Error(`getSingleWordParseFunc: ${this.type} not supported`);
            }

            funcIndex = parser.addTrySubFunction(this.string, func);
        }

        return parser.ruleTrySubFunctions[funcIndex];
    }

    getCheckFunction = (exec) => {
        switch (this.type) {
            case "IDENTIFIER":
                const ruleName = this.value;
                return (ast) => {
                    exec.check_type(ast, ruleName);
                };
            case "TOKEN":
                const tokenType = this.value;
                return (ast) => {
                    return exec.check_token(ast, tokenType);
                }
            case "SYMBOL":
                const symbol = this.value;
                return (ast) => {
                    return exec.check_symbol(ast, symbol);
                }
            default:
                throw new Error(`getCheckFunction: ${this.type} not supported`);
        }
    }

    getBaseFunction = (exec) => {
        switch (this.type) {
            case "IDENTIFIER":
                const rule = exec.getRule(this.value);
                if (!rule)
                    throw new Error(`No rule found for identifier ${this.value}`);

                const ruleIndex = rule.index;
                return (ast) => {
                    return () => {
                        return exec.ruleFunctions[ruleIndex](ast);
                    }
                };
            case "TOKEN":
                const tokenType = this.value;
                return (ast) => {
                    return () => {
                        return exec.token(ast, tokenType);
                    }
                };
            case "SYMBOL":
                return (ast) => {
                    return () => {
                        return ast[1];//TODO
                    }
                }
            default:
                throw new Error(`getExecFunction: ${this.type} not supported`);
        }
    }

    hasNonTerminal = () => {
        return this.type === "IDENTIFIER";
    }

    toString() {
        return `${this.value}`;
        //return `${this.value}{${this.type}}`;
    }
}