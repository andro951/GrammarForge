"use strict";

GrammarForge.WordBase = class WordBase {
    constructor() {
        if (this.constructor === GrammarForge.WordBase) {
            throw new Error("Abstract class 'WordBase' cannot be instantiated directly.");
        }
    }

    getParseFunc = (parser) => {
        throw new Error("Not implemented");
    }

    getTryParseFunc = (parser) => {
        throw new Error("Not implemented");
    }

    setNonTerminalIndexs = (containsOptional) => {
        throw new Error("Not implemented");
    }

    getNonTerminalsFromIndexs = (containsOptional) => {
        throw new Error("Not implemented");
    }

    getChildren = (parser, childrenIndexSet) => {
        throw new Error("Not implemented");
    }

    // walk = function*() {
    //     throw new Error("Not implemented");
    // }

    toString() {
        throw new Error("Not implemented");
    }
}