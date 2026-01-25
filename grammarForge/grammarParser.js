"use strict";

/*
grammar : (stmt)+
stmt    : rule | tknDef
rule    : IDENTIFIER (LBRACE IDENTIFIER RBRACE)? DEFINED_AS exp (ORBAR exp)*
exp     : (word)+ (LBRACE IDENTIFIER (IDENTIFIER | INT | TOKEN)* RBRACE)?
word    : term
        | par
term    : IDENTIFIER 
        | TOKEN
        | SYMBOL
par     : LPAREN exp RPAREN (parType)?
parType : QUESTION
        | STAR
        | PLUS
tknDef  : TOKEN DEFINED_AS REGEX ((TOKEN | IDENTIFIER) | (LPAREN (TOKEN | IDENTIFIER) RPAREN))?
*/

{
    GrammarForge.GrammarParser = class GrammarParser {
        static tokens = [];
        static index = 0;
        static rules = [];
        static tokenDefinitions = [];

        static parse(tokens) {
            GrammarParser.tokens = tokens;
            GrammarParser.index = 0;
            GrammarParser.rules = [];
            GrammarParser.tokenDefinitions = [];
            return GrammarParser.grammar();
        }

        static match(type) {
            const token = GrammarParser.tokens[GrammarParser.index];
            if (token.type === type) {
                GrammarParser.index++;
            }
            else {
                throw new Error(`Expected token type ${type}, found ${token.type}`);
            }
        }

        static tryMatch(type) {
            const token = GrammarParser.tokens[GrammarParser.index];
            if (token.type === type) {
                GrammarParser.index++;
                return true;
            }
            else {
                return false;
            }
        }

        //grammar : (stmt)+
        static grammar() {
            if (GrammarParser.tokens.length === 0)
                throw new Error("No tokens to parse");

            while (GrammarParser.index < GrammarParser.tokens.length) {
                GrammarParser.stmt();
            }

            return { rules: GrammarParser.rules, tokenDefinitions: GrammarParser.tokenDefinitions };
        }
        
        static ruleSet = ["IDENTIFIER"];
        static tknDefSet = ["TOKEN"];
        static termSet = ["IDENTIFIER", "TOKEN", "SYMBOL"];
        static parSet = ["LPAREN"];
        static wordSet = GrammarParser.termSet.concat(GrammarParser.parSet);
        static expSet = GrammarParser.wordSet;

        //stmt    : rule | tknDef
        static stmt() {
            const token = GrammarParser.tokens[GrammarParser.index];
            if (GrammarParser.ruleSet.includes(token.type)) {
                GrammarParser.rule();
            }
            else if (GrammarParser.tknDefSet.includes(token.type)) {
                GrammarParser.tknDef();
            }
            else {
                throw new Error(`Unexpected token type in stmt: ${token.type}`);
            }
        }

        //rule    : IDENTIFIER (LBRACE IDENTIFIER RBRACE)? DEFINED_AS exp (ORBAR exp)*
        static rule() {
            const token = GrammarParser.tokens[GrammarParser.index];
            const tokenName = token.value;
            let expressions = [];
            GrammarParser.match("IDENTIFIER");
            let tag = null;
            if (GrammarParser.tryMatch("LBRACE")) {
                const metaToken = GrammarParser.tokens[GrammarParser.index];
                tag = metaToken.value;
                GrammarParser.match("IDENTIFIER");
                GrammarParser.match("RBRACE");
            }

            GrammarParser.match("DEFINED_AS");
            let index = 0;
            const exp = GrammarParser.exp(index++);
            expressions.push(exp);
            while (GrammarParser.index < GrammarParser.tokens.length && GrammarParser.tokens[GrammarParser.index].type === "ORBAR") {
                GrammarParser.match("ORBAR");
                const exp2 = GrammarParser.exp(index++);
                expressions.push(exp2);
            }

            const rule = new GrammarForge.Rule(tokenName, expressions, GrammarParser.rules.length, tag);
            GrammarParser.rules.push(rule);
        }

        //exp     : (word)+ (LBRACE IDENTIFIER (IDENTIFIER | INT | TOKEN)* RBRACE)?
        static exp(index) {
            const words = [];
            while (GrammarParser.index < GrammarParser.tokens.length) {
                const token = GrammarParser.tokens[GrammarParser.index];
                if (GrammarParser.wordSet.includes(token.type)) {
                    const word = GrammarParser.word();
                    if (word === undefined)
                        break;//word returns undefined if it sees a rule definition next.

                    words.push(word);
                } else {
                    break;
                }
            }

            let metadata = [];
            if (GrammarParser.index < GrammarParser.tokens.length) {
                if (GrammarParser.tryMatch("LBRACE")) {
                    const token = GrammarParser.tokens[GrammarParser.index];
                    if (token.type !== "IDENTIFIER" && token.type !== 'SYMBOL' && token.type !== "PLUS" && token.type !== "STAR")
                        throw new Error(`Unexpected token type in expression metadata: ${token.type}`);

                    GrammarParser.match(token.type);
                    metadata.push(token.value);
                    while (!GrammarParser.tryMatch("RBRACE")) {
                        const token = GrammarParser.tokens[GrammarParser.index];
                        GrammarParser.match('IDENTIFIER');
                        metadata.push(token.value);
                    }
                }
            }

            return new GrammarForge.Expression(words, index, metadata);
        }

        //word    : term
        //        | par
        static word() {
            const token = GrammarParser.tokens[GrammarParser.index];
            if (GrammarParser.termSet.includes(token.type)) {
                if (token.type === "IDENTIFIER" || token.type === "TOKEN") {
                    if (GrammarParser.index + 1 < GrammarParser.tokens.length) {
                        const nextToken = GrammarParser.tokens[GrammarParser.index + 1];
                        if (nextToken.type === "DEFINED_AS") {
                            return undefined; //signal that a new rule or token definition is starting
                        }
                        else if (nextToken.type === "LBRACE") {
                            if (GrammarParser.index + 4 < GrammarParser.tokens.length) {
                                const tokenAfterBraces = GrammarParser.tokens[GrammarParser.index + 4];
                                if (tokenAfterBraces.type === "DEFINED_AS") {
                                    return undefined; //signal that a new rule or token definition is starting
                                }
                            }
                        }
                    }
                }

                return GrammarParser.term();
            }
            else if (GrammarParser.parSet.includes(token.type)) {
                return GrammarParser.par();
            }
            else {
                throw new Error(`Unexpected token type in word: ${token.type}`);
            }
        }

        //term    : IDENTIFIER 
        //        | TOKEN
        //        | SYMBOL
        static term() {
            const token = GrammarParser.tokens[GrammarParser.index];
            if (this.termSet.includes(token.type)) {
                GrammarParser.match(token.type);
                return new GrammarForge.Term(token);
            }
            else {
                throw new Error(`Unexpected token type in term: ${token.type}`);
            }
        }

        //par     : LPAREN exp RPAREN (parType)?
        //parType : QUESTION
        //        | STAR
        //        | PLUS
        static par() {
            GrammarParser.match("LPAREN");
            const exp = GrammarParser.exp(0);
            GrammarParser.match("RPAREN");
            const token = GrammarParser.tokens[GrammarParser.index];
            let parType = null;
            if (token.type === "QUESTION" || token.type === "STAR" || token.type === "PLUS") {
                GrammarParser.match(token.type);
                parType = token.type;
            }

            return new GrammarForge.Par(exp, parType);
        }

        //tknDef  : TOKEN DEFINED_AS REGEX ((TOKEN | IDENTIFIER) | (LPAREN (TOKEN | IDENTIFIER) RPAREN))?
        static tknDef() {
            const token1 = GrammarParser.tokens[GrammarParser.index];
            const tokenName = token1.value;
            GrammarParser.match("TOKEN");
            GrammarParser.match("DEFINED_AS");
            const token2 = GrammarParser.tokens[GrammarParser.index];
            if (token2.type !== "REGEX")
                throw new Error(`Unexpected token type in tknDef: ${token2.type}`);

            GrammarParser.match("REGEX");
            let tag = null;
            if (GrammarParser.index + 1 < GrammarParser.tokens.length) {
                const token3 = GrammarParser.tokens[GrammarParser.index];
                if (token3.type === "LPAREN") {
                    GrammarParser.match("LPAREN");
                    const token4 = GrammarParser.tokens[GrammarParser.index];
                    if (token4.type === "TOKEN" || token4.type === "IDENTIFIER") {
                        tag = token4.value;
                        GrammarParser.match(token4.type);
                        GrammarParser.match("RPAREN");
                    }
                }
                else {
                    if (token3.type === "TOKEN" || token3.type === "IDENTIFIER") {
                        let hasTag = false;
                        if (GrammarParser.index + 1 >= GrammarParser.tokens.length) {
                            hasTag = true;
                        }
                        else {
                            const token4 = GrammarParser.tokens[GrammarParser.index + 1];
                            if (token4.type === "TOKEN" || token4.type === "IDENTIFIER")
                                hasTag = true;
                        }

                        if (hasTag) {
                            tag = token3.value;
                            GrammarParser.match(token3.type);
                        }
                    }
                }
            }

            const regex = GrammarForge.stringToRegex(token2.value);
            const tokenDef = new GrammarForge.TokenDefinition(tokenName, regex, tag);
            GrammarParser.tokenDefinitions.push(tokenDef);
        }

        static rulesToString() {
            return GrammarParser.rules.map(rule => rule.toString()).join("\n");
        }

        static tokenDefinitionsToString() {
            return GrammarParser.tokenDefinitions.map(tknDef => tknDef.toString()).join("\n");
        }
    }
}