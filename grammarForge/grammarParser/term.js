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

    getParseFunc = (parser) => {
        let funcIndex = parser.ruleSubFunctionLookup.get(this.string);
        if (funcIndex === undefined) {
            let func;
            const type = this.type;
            switch (this.type) {
                case "IDENTIFIER":
                    const rule = parser.getRule(this.value);
                    if (!rule)
                        throw new Error(`No rule found for identifier ${this.value}`);

                    func = (tokenStream) => {
                        return [ 'TERM', parser.ruleFunctions[rule.index](tokenStream), type ];
                    };
                    break;
                case "TOKEN":
                    const tokenType = this.value;
                    func = (tokenStream) => {
                        return [ 'TERM', parser.token(tokenStream, tokenType), type ];
                    };
                    break;
                case "SYMBOL":
                    const symbol = this.value;
                    func = (tokenStream) => {
                        return [ 'TERM', parser.symbol(tokenStream, symbol), type ];
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
            const type = this.type;
            switch (this.type) {
                case "IDENTIFIER":
                    const rule = parser.getRule(this.value);
                    if (!rule)
                        throw new Error(`No rule found for identifier ${this.value}`);

                    func = (tokenStream) => {
                        const tryResult = parser.ruleTryFunctions[rule.index](tokenStream);
                        if (!tryResult)
                            return null;

                        return [ 'TERM', tryResult, type ];
                    };
                    break;
                case "TOKEN":
                    const tokenType = this.value;
                    func = (tokenStream) => {
                        const tryResult = parser.try_token(tokenStream, tokenType);
                        if (!tryResult)
                            return null;

                        return [ 'TERM', tryResult, type ];
                    };
                    break;
                case "SYMBOL":
                    const symbol = this.value;
                    func = (tokenStream) => {
                        const tryResult = parser.try_symbol(tokenStream, symbol);
                        if (!tryResult)
                            return null;

                        return [ 'TERM', tryResult, type ];
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
        const thisType = this.type;
        const checkFunc = this.getCheckFunction(exec);
        switch (this.type) {
            case "IDENTIFIER":
                const rule = exec.getRule(this.value);
                if (!rule)
                    throw new Error(`No rule found for identifier ${this.value}`);

                const ruleIndex = rule.index;
                return (ast) => {
                    const [ termType, innerAST, type ] = ast;
                    if (termType !== "TERM")
                        throw new Error(`Expected TERM AST node, got ${termType}`);

                    if (type !== thisType)
                        throw new Error(`Expected TERM type ${thisType}, got ${type}`);

                    checkFunc(innerAST);

                    return () => {
                        return exec.ruleFunctions[ruleIndex](innerAST);
                    }
                };
            case "TOKEN":
                const tokenType = this.value;
                return (ast) => {
                    const [ termType, innerAST, type ] = ast;
                    if (termType !== "TERM")
                        throw new Error(`Expected TERM AST node, got ${termType}`);

                    if (type !== thisType)
                        throw new Error(`Expected TERM type ${thisType}, got ${type}`);

                    checkFunc(innerAST);

                    return () => {
                        return exec.token(innerAST, tokenType);
                    }
                };
            case "SYMBOL":
                return (ast) => {
                    const [ termType, innerAST, type ] = ast;
                    if (termType !== "TERM")
                        throw new Error(`Expected TERM AST node, got ${termType}`);

                    if (type !== thisType)
                        throw new Error(`Expected TERM type ${thisType}, got ${type}`);

                    checkFunc(innerAST);
                    
                    return () => {
                        return innerAST[1];//TODO
                    }
                }
            default:
                throw new Error(`getExecFunction: ${this.type} not supported`);
        }
    }

    tryGetNonTerminals = () => {
        if (this.type === "IDENTIFIER")
            return [ this ];

        return [];
    }

    hasNonTerminal = () => {
        return this.type === "IDENTIFIER";
    }

    getChildren = (parser, childrenIndexSet) => {
        if (this.type === "IDENTIFIER") {
            const rule = parser.getRule(this.value);
            if (!rule)
                throw new Error(`No rule found for non-terminal: ${this.value}`);

            if (childrenIndexSet.has(rule.index))
                return;
            
            childrenIndexSet.add(rule.index);
            rule.getChildren(parser, childrenIndexSet);
        }
    }

    toString() {
        return `${this.value}`;
        //return `${this.value}{${this.type}}`;
    }
}