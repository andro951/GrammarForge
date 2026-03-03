"use strict";

/*
GrammarForge is a recursive decent parser generator with backtracking.

How to write a grammar for GrammarForge:
Start with the base rule that should always be the highest level rule in the Abstract Syntax Tree (AST).

Defining Rules:
RuleName : RuleDefinition
RuleDefinitions are one or more Expressions separated by '|' to indicate alternatives.
Expressions are one or more Words separated by whitespace.
Words are Symbols, Tokens, names of Rules, or grouped Expressions in parentheses.
Example of a Rule Definition:
    func : NAME \( (expr (',' expr)*)? \)
    Rule name: 'func'
    1 Rule expressions: [ "NAME \( (expr (',' expr)*)? \)" ]
    4 Expression words: [ "NAME", "(", "(expr (',' expr)*)?", ")" ]
    The 3rd word is an Expression group in parentheses which can contian multiple words.

In the rule definition, the collon can be ':', ':=' or '::='.
Symbols used in rule definitions:
    '(', ')', '*', '+', '?', '|', '{', '}'
Do use these symbols in your grammar, you must escape them with a backslash '\' as seen above.




: indicates a rule definition.  Example:
    ruleName : ruleDefinition

| indicates an alternative.  Example:
    ruleName : ruleDefinition1
             | ruleDefinition2
(symbol)? indicates that symbol is optional.  Example:
    ruleName : ruleDefinition1 (symbol)?

(symbol)* indicates that symbol can appear zero or more times.  Example:
    ruleName : ruleDefinition1 (symbol)*

(symbol)+ indicates that symbol can appear one or more times.  Example:
    ruleName : ruleDefinition1 (symbol)+

Uppercase names are tokens (terminal symbols).
Lowercase names are rules (non-terminal symbols).

A token definition looks like this:
    TOKEN_NAME : regex

Tokens can have a tag to provide additional information.  They can optionally have parentheses around the tag.  Example:
To have a token ignored by the lexer, put (IGNORE) after the token definition.  Example:
    COMMENT : \#.*\m (IGNORE)
To show that a type needs to be parsed, put the tag after the regex.  Example:
    MY_INT : /\d+/ int

Supported tags:
int - integer
float - floating point number
IGNORE - ignore this token (do not include it in the token stream)

Default tokens always added:
WHITESPACE, /\s+/ (IGNORE) is added at the end to ignore whitespace.
UNKNOWN, /./ is added at the very end and throws an error if no other token matches.
*/

const GrammarForge = class GrammarForge {
    constructor(grammar, functions, tokenDefinitions) {
        this.grammar = grammar;
        this.argTokenDefinitions = tokenDefinitions;
        this.functions = functions;
        this.setup();
    }

    setup = () => {
        this.processGrammar();
        this.createLexer();
        this.createParser();
        this.createExec();
    }

    processGrammar = () => {
        let grammarTokens = GrammarForge.GrammarLexer.tokenize(this.grammar);
        const { rules, tokenDefinitions } = GrammarForge.GrammarParser.parse(grammarTokens);
        this.rules = rules;

        if (tokenDefinitions.length > 0) {
            if (this.argTokenDefinitions && this.argTokenDefinitions.length > 0) {
                throw new Error("Token definitions provided in both grammar and constructor.  Only one allowed.");
            }

            this.tokenDefinitions = tokenDefinitions;
        }
        else {
            this.tokenDefinitions = this.argTokenDefinitions;
        }
        
        // console.log("Parsed Rules:");
        // console.log(GrammarForge.GrammarParser.rulesToString());
        // console.log("\nParsed Token Definitions:");
        // console.log(GrammarForge.GrammarParser.tokenDefinitionsToString());
    }

    createLexer = () => {
        this.lexer = new GrammarForge.Lexer(this.tokenDefinitions);
    }

    createParser = () => {
        this.parser = new GrammarForge.Parser(this.rules, this.lexer);
    }

    createExec = () => {
        this.execution = new GrammarForge.Exec(this.parser, this.functions);
    }

    parse = (str) => {
        return this.parser.parse(str);
    }

    exec = (ast, variables = null, variableGetters = null) => {
        return this.execution.exec(ast, variables, variableGetters);
    }

    replaceOpFunction = (opTag, func) => {
        if (typeof opTag !== 'string')
            throw new Error(`Operator must be a string.`);

        if (typeof func !== 'function')
            throw new Error(`Function must be a function.`);

        const precedence = GrammarForge.Expression.operatorTagPrecedence.get(opTag);
        if (precedence === undefined)
            throw new Error(`Unknown operator: ${opTag}`);

        const op = GrammarForge.Expression.operatorTagToOperator.get(opTag);
        if (op === undefined)
            throw new Error(`Operator tag ${opTag} does not correspond to a valid operator.`);

        if (!this.execution.opFunctions[precedence].has(op))
            throw new Error(`Operator ${op} not defined in precedence level ${precedence}`);

        this.execution.opFunctions[precedence].set(op, func);
    }
};

GrammarForge.debuggingFunctions = false;