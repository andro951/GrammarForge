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

    //Returns true if left recursion was checked and not found
    //Throws an error if left recursion is found
    //Returns false if this word was not a match, but is optional
    checkWordForLeftRecursion = (parser, expr, lookAheadSet) => {
        const checked = this.word.checkWordForLeftRecursion(parser, expr, lookAheadSet);
        if (checked && this.oType === 'PLUS')
            return true;

        return false;
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

    _getResultQuestion = (result) => {
        if (result === null)
            result = new GrammarForge.EmptyNode();

        if (GrammarForge.makeFullAST) {
            return [ 'QWORD', result, this.oType ];
        }
        else {
            return result;
        }
    }

    _getResult = (result, parser) => {
        if (GrammarForge.makeFullAST) {
            return [ 'QWORD', result, this.oType ];
        }
        else if (result.length === 1) {
            const stmt_rule = parser.exec.stmt_rule;
            if (stmt_rule !== null) {
                const expNode = result[0];
                if (expNode instanceof GrammarForge.ExpNode && expNode.expression.rule === stmt_rule)
                    return expNode;
            }
        }
        
        return result;
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
                                const tryResult = wordTryParseFunc(clonedStream);
                                if (tryResult && clonedStream.index > tokenStream.index) {
                                    tokenStream.index = clonedStream.index;
                                    result = tryResult;
                                }
                            }

                            return this._getResultQuestion(result);
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

                            return this._getResult(result, parser);
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

                            return this._getResult(result, parser);
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
                            const tryResult = wordTryParseFunc(clonedStream);
                            if (tryResult && clonedStream.index > tokenStream.index) {
                                tokenStream.index = clonedStream.index;
                                result = tryResult;
                            }
                        }

                        return this._getResultQuestion(result);
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

                        return this._getResult(result, parser);
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

                        return this._getResult(result, parser);
                    }
                    break;
                default:
                    throw new Error(`Par type ${this.oType} not supported in getParseFunc`);
            }

            funcIndex = parser.addTrySubFunction(this.qWordString, tryFunc);
        }

        return parser.ruleTrySubFunctions[funcIndex];
    }

    setNonTerminalIndexs = (containsOptional) => {
        const nonTerminalsCount = this.word.setNonTerminalIndexs(containsOptional);
        if (nonTerminalsCount > 0 && containsOptional && this.oType === 'QUESTION')
            return 1;
        
        return nonTerminalsCount;
    }

    getNonTerminalsFromIndexs = (containsOptional) => {
        const nonTerminals = this.word.getNonTerminalsFromIndexs(containsOptional);
        if (nonTerminals.length > 0 && containsOptional && this.oType === 'QUESTION')
            return [ [ this, nonTerminals ] ];

        return nonTerminals;
    }

    getChildren = (parser, childrenIndexSet) => {
        this.word.getChildren(parser, childrenIndexSet);
    }

    // walk = function*() {
    //     yield this;
    // }

    toString() {
        return `${this.word.toString()}${this.oTypeToString(this.oType)}`;
    }
}