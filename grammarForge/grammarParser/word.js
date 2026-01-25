"use strict";

GrammarForge.Word = class Word {
    constructor() {
        if (this.constructor === GrammarForge.Word) {
            throw new Error("Abstract class 'Word' cannot be instantiated directly.");
        }
    }
    
    computeLookaheadSetAndFreeze(parser) {
        throw new Error("Not implemented");
    }
    
    getLookaheadSet() {
        throw new Error("Not implemented");
    }

    getParseFunc = (parser) => {
        throw new Error("Not implemented");
    }

    getTryParseFunc = (parser) => {
        throw new Error("Not implemented");
    }

    getCheckFunction = (exec) => {
        throw new Error("Not implemented");
    }

    getBaseFunction = (exec) => {
        throw new Error("Not implemented");
    }

    hasNonTerminal = () => {
        throw new Error("Not implemented");
    }

    toString() {
        throw new Error("Not implemented");
    }
}