"use strict";

GrammarForge.WordBase = class WordBase {
    constructor() {
        if (this.constructor === GrammarForge.WordBase) {
            throw new Error("Abstract class 'WordBase' cannot be instantiated directly.");
        }
    }
    
    computeLookaheadSetAndFreeze(parser) {
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

    tryGetNonTerminals = () => {
        throw new Error("Not implemented");
    }

    toString() {
        throw new Error("Not implemented");
    }
}