"use strict";

GrammarForge.QWord = class QWord extends GrammarForge.Word {
    constructor(word, oType) {
        if (!(word instanceof GrammarForge.Word))
            throw new Error(`QWord constructor: word must be an instance of GrammarForge.Word.`);

        if (word instanceof GrammarForge.QWord)
            throw new Error(`QWord constructor: word cannot be a QWord.`);

        if (!oType)
            throw new Error(`QWord constructor: oType is required and can't be null.`);

        super();
        this.word = word;
        this.oType = oType;
        this.qWordString = this.toString();
    }

    computeLookaheadSetAndFreeze(parser) {
        if (this.lookaheadSet)
            return this.lookaheadSet;
        
        this.lookaheadSet = this.word.computeLookaheadSetAndFreeze(parser);
        Object.freeze(this);

        return this.lookaheadSet;
    }

    oTypeToString(oType) {
        switch (oType) {
            case "QUESTION":
                return "?";
            case "STAR":
                return "*";
            case "PLUS":
                return "+";
            default:
                throw new Error(`QWord oTypeToString: Unknown oType ${oType}`);
        }
    }

    getParseFunc = (parser) => {
        let funcIndex = parser.ruleSubFunctionLookup.get(this.qWordString);
        if (funcIndex === undefined) {
            let func;
            switch (this.oType) {
                case "QUESTION": {
                        const wordTryParseFunc = this.word.getTryParseFunc(parser);
                        func = (tokenStream) => {
                            let result = null;
                            if (!tokenStream.end()) {
                                const clonedStream = tokenStream.clone();
                                result = wordTryParseFunc(clonedStream);
                                if (result) {
                                    tokenStream.index = clonedStream.index;
                                }
                            }

                            return [ 'QWORD', result, this.oType ];
                        }
                    }
                    break;
                case "STAR": {
                        const wordTryParseFunc = this.word.getTryParseFunc(parser);
                        func = (tokenStream) => {
                            const result = [];
                            const clonedStream = tokenStream.clone();
                            while (true) {
                                if (tokenStream.end())
                                    break;

                                const wordResult = wordTryParseFunc(clonedStream);
                                if (wordResult) {
                                    tokenStream.index = clonedStream.index;
                                    result.push(wordResult);
                                }
                                else {
                                    break;
                                }
                            }

                            return [ 'QWORD', result, this.oType ];
                        }
                    }
                    break;
                case "PLUS": {
                        const wordParseFunc = this.word.getParseFunc(parser);
                        const wordTryParseFunc = this.word.getTryParseFunc(parser);
                        func = (tokenStream) => {
                            const result = [];
                            const firstWordResult = wordParseFunc(tokenStream);
                            result.push(firstWordResult);
                            const clonedStream = tokenStream.clone();
                            while (true) {
                                if (tokenStream.end())
                                    break;

                                const wordResult = wordTryParseFunc(clonedStream);
                                if (wordResult) {
                                    tokenStream.index = clonedStream.index;
                                    result.push(wordResult);
                                }
                                else {
                                    break;
                                }
                            }

                            return [ 'QWORD', result, this.oType ];
                        }
                    }
                    break;
                default:
                    throw new Error(`Par type ${this.oType} not supported in getParseFunc`);
            }

            funcIndex = parser.addSubFunction(this.qWordString, func);
        }
        
        return parser.ruleSubFunctions[funcIndex];
    }

    getTryParseFunc = (parser) => {
        let funcIndex = parser.ruleTrySubFunctionLookup.get(this.qWordString);
        if (funcIndex === undefined) {
            let tryFunc;
            const wordTryParseFunc = this.word.getTryParseFunc(parser);
            switch (this.oType) {
                case "QUESTION":
                    tryFunc = (tokenStream) => {
                        let result = null;
                        if (!tokenStream.end()) {
                            const clonedStream = tokenStream.clone();
                            result = wordTryParseFunc(clonedStream);
                            if (result) {
                                tokenStream.index = clonedStream.index;
                            }
                        }

                        return [ 'QWORD', result, this.oType ];
                    }
                    break;
                case "STAR":
                    tryFunc = (tokenStream) => {
                        const result = [];
                        const clonedStream = tokenStream.clone();
                        while (true) {
                            if (tokenStream.end())
                                break;

                            const wordResult = wordTryParseFunc(clonedStream);
                            if (wordResult) {
                                tokenStream.index = clonedStream.index;
                                result.push(wordResult);
                            }
                            else {
                                break;
                            }
                        }

                        return [ 'QWORD', result, this.oType ];
                    }
                    break;
                case "PLUS":
                    tryFunc = (tokenStream) => {
                        const clonedStream = tokenStream.clone();
                        const firstWordResult = wordTryParseFunc(clonedStream);
                        if (!firstWordResult)
                            return null;
                        
                        const result = [ firstWordResult ];
                        
                        tokenStream.index = clonedStream.index;
                        while (true) {
                            if (tokenStream.end())
                                break;

                            const wordResult = wordTryParseFunc(clonedStream);
                            if (wordResult) {
                                tokenStream.index = clonedStream.index;
                                result.push(wordResult);
                            }
                            else {
                                break;
                            }
                        }

                        return [ 'QWORD', result, this.oType ];
                    }
                    break;
                default:
                    throw new Error(`Par type ${this.oType} not supported in getParseFunc`);
            }

            funcIndex = parser.addTrySubFunction(this.qWordString, tryFunc);
        }

        return parser.ruleTrySubFunctions[funcIndex];
    }

    getCheckFunction = (exec) => {
        switch (this.oType) {
            case "QUESTION":
                return (ast) => {
                    if (ast === undefined)
                        throw new Error(`getCheckFunction: QUESTION QWord AST node cannot be undefined.`);
                }
            case "STAR":
                return (ast) => {
                    exec.check_optional(ast);
                }
            case "PLUS":
                return (ast) => {
                    exec.check_required(ast);
                }
            default:
                throw new Error(`getCheckFunction: Par type ${this.oType} not supported`);
        }
    }

    getBaseFunction = (exec) => {
        const wordFunc = this.word.getBaseFunction(exec);
        let func;
        const thisOType = this.oType;
        const checkFunc = this.getCheckFunction(exec);
        switch (this.oType) {
            case "QUESTION":
                func = (ast) => {
                    const [ qWordType, innerAST, oType ] = ast;
                    if (qWordType !== 'QWORD')
                        throw new Error(`Expected QWORD type in AST node, got ${qWordType}`);

                    if (oType !== thisOType)
                        throw new Error(`Expected ${thisOType} oType QUESTION in AST node, got ${oType}`);

                    checkFunc(innerAST);
                    
                    if (innerAST === null)
                        return null;

                    return wordFunc(innerAST);
                }
                break;
            case "STAR":
            case "PLUS":
                func = (ast) => {
                    const [ qWordType, innerAST, oType ] = ast;
                    if (qWordType !== 'QWORD')
                        throw new Error(`Expected QWORD type in AST node, got ${qWordType}`);

                    if (oType !== thisOType)
                        throw new Error(`Expected ${thisOType} oType in AST node, got ${oType}`);

                    checkFunc(innerAST);

                    const results = [];
                    for (let i = 0; i < innerAST.length; i++) {
                        results.push(wordFunc(innerAST[i]));
                    }

                    return results;
                }
                break;
            default:
                throw new Error(`getExecFunction: Par type ${this.oType} not supported`);
        }

        return func;
    }

    tryGetNonTerminals = () => {
        return this.word.tryGetNonTerminals();
    }

    hasNonTerminal = () => {
        return this.word.hasNonTerminal();
    }

    getChildren = (parser, childrenIndexSet) => {
        this.word.getChildren(parser, childrenIndexSet);
    }

    toString() {
        return `${this.word.toString()}${this.oTypeToString(this.oType)}`;
    }
}