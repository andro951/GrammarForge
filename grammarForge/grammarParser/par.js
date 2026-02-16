"use strict";

GrammarForge.Par = class Par extends GrammarForge.Word {
    constructor(expList) {
        super();
        if (!(expList instanceof GrammarForge.ExpList))
            throw new Error("expList must be an instance of GrammarForge.ExpList");

        this.expList = expList;
        this.parString = this.toString();
    }

    computeLookaheadSetAndFreeze(parser) {
        if (this.lookaheadSet)
            return this.lookaheadSet;
        
        this.lookaheadSet = this.expList.computeLookaheadSetAndFreeze(parser);
        Object.freeze(this);

        return this.lookaheadSet;
    }

    getParseFunc = (parser) => {
        return this.expList.getParseFunc(parser);
    }

    getTryParseFunc = (parser) => {
        return this.expList.getTryParseFunc(parser);
    }

    getCheckFunction = (exec) => {
        return this.expList.getCheckFunction(exec);
    }

    getBaseFunction = (exec) => {
        return this.expList.getBaseFunction(exec);
    }

    tryGetNonTerminals = () => {
        return this.expList.tryGetNonTerminals();
    }

    hasNonTerminal = () => {
        return this.expList.hasNonTerminal();
    }

    getChildren = (parser, childrenIndexSet) => {
        this.expList.getChildren(parser, childrenIndexSet);
    }

    toString() {
        return `(${this.expList.toString()})`;
    }
}