"use strict";

GrammarForge.Rule = class Rule {
    constructor(name, expList, index, tag = null) {
        if (!name)
            throw new Error("name is required");

        if (!(expList instanceof GrammarForge.ExpList))
            throw new Error("expList must be a GrammarForge.ExpList");

        if (index === undefined || index === null || typeof index !== 'number' || index < 0)
            throw new Error("index must be a non-negative number");

        if (tag !== null && typeof tag !== 'string')
            throw new Error("tag must be a string or null");

        this.name = name;
        this.expList = expList;
        this.index = index;
        this.tag = tag;
        this.checkTagAndExpressionsMetadata();
        this.checkLeftRecursion();
    }

    computeLookaheadSetAndFreeze(parser) {
        if (this.lookaheadSet)
            return this.lookaheadSet;

        this.lookaheadSet = this.expList.computeLookaheadSetAndFreeze(parser);
        if (!Object.isFrozen(this.lookaheadSet))
            throw new Error("Lookahead set not frozen");

        Object.freeze(this);

        return this.lookaheadSet;
    }

    checkTagAndExpressionsMetadata = () => {
        this.checkTag();
        const tag = this.tag;
        for (const expr of this.expList.expressions) {
            expr.checkMetadata(this);
        }

        if (tag !== this.tag) {
            this.checkTag();
        }
    }

    checkLeftRecursion = () => {
        for (const expr of this.expList.expressions) {
            if (!this.checkWordsForLeftRecursion(expr))
                throw new Error(`All words in expression are optional: ${expr.expressionString} in rule: ${this.name}.  There must be at least 1 non-optional word in each expression.`);
        }
    }

    //Returns true if left recursion was checked and not found
    //Throws an error if left recursion is found
    //Returns false if this word was not a match, but is optional
    checkWordForLeftRecursion = (word, expr) => {
        if (word instanceof GrammarForge.Term) {
            if (word.type === "IDENTIFIER" && word.value === this.name) {
                throw new Error(`Left recursion detected in rule: ${this.name}, expression: ${expr.expressionString}.  The parser is a LL1 recursive desent parser with backtracking. Left recursion is not supported.  Left recursion means the first non-optional word in an expression is the same as the rule name.`);
            }

            return true;//Found and checked the first non-optional word
        }
        else if (word instanceof GrammarForge.QWord) {
            const checked = this.checkWordForLeftRecursion(word.word, expr);
            if (checked)
                return true;

            if (word.oType === 'PLUS')
                return true;

            return false;
        }
        else if (word instanceof GrammarForge.Par) {
            let allChecked = true;
            //Need to check all expressions inside the par in case they allow left recursion.
            for (let i = 0; i < word.expList.expressions.length; i++) {
                const expr = word.expList.expressions[i];
                const checked = this.checkWordsForLeftRecursion(expr);
                if (!checked)
                    allChecked = false;
            }

            //If any of the expressions in the Par are all optional, then the Par is optional, and shouldn't stop looking for left recursion.
            return allChecked;
        }

        throw new Error(`Unknown word type in rule: ${this.name}, expression: ${expr.expressionString}.  Word: ${word.string}`);
    }

    checkWordsForLeftRecursion = (expr) => {
        //The goal is to find the first non-optional word, or the first optional word that is this rule
        for (const word of expr.words) {
            const checked = this.checkWordForLeftRecursion(word, expr);
            if (checked)
                return true;
        }

        return false;
    }

    checkTag = () => {
        if (this.tag === null)
            return;

        if (GrammarForge.Rule.tags.has(this.tag))
            return;

        if (!GrammarForge.Expression.tags.has(this.tag)) {
            if (GrammarForge.Expression.operatorTags.has(this.tag)) {
                if (this.expList.expressions.length === 1) {
                    const expression = this.expList.expressions[0];
                    if (expression.words.length === 1) {
                        if (expression.metadata.length === 0) {
                            expression.metadata.push(this.tag);
                            expression.tag = this.tag;
                            this.tag = null;
                            expression.checkMetadata(this);
                            return;
                        }
                    }
                }

                throw new Error(`Operator tag ${this.tag} can only be used on rules with a single expression containing a single operator token.  Rule: ${this.name}`);
            }
            else {
                throw new Error(`Invalid rule tag: ${this.tag}`);
            }
        }

        const tag = this.tag;
        this.tag = null;
        for (const expr of this.expList.expressions) {
            if (expr.metadata.length !== 0)
                throw new Error(`${tag} was placed on rule: ${this.name}, but it is an expression tag.  Expression: ${expr.expressionString} already has a tag, ${expr.metadata[0]}.  An expression cannot have multiple tags.`);

            expr.metadata.push(tag);
            expr.tag = tag;
            expr.checkMetadata(this);
        }
    }

    createParseFunctions = (parser) => {
        if (parser.ruleFunctions[this.index] !== null)
            throw new Error(`Parse function already exists for rule index ${this.index}`);

        const expListParseFunc = this.expList.getParseFunc(parser);
        const func = (tokenStream) => {
            const result = expListParseFunc(tokenStream);

            return [ this.name, result ];
        }

        const expListTryParseFunc = this.expList.getTryParseFunc(parser);
        const tryFunc = (tokenStream) => {
            const tryResult = expListTryParseFunc(tokenStream);
            if (!tryResult)
                return null;

            return [ this.name, tryResult ];
        }

        parser.ruleFunctions[this.index] = func.bind(parser);
        parser.ruleTryFunctions[this.index] = tryFunc.bind(parser);
    }

    createBaseFunction = (exec) => {
        if (exec.ruleFunctions.length !== this.index)
            throw new Error(`exec.ruleFunctions length ${exec.ruleFunctions.length} does not match rule index ${this.index}`);
        
        this.checkMakeDefaultExecFunctions(exec);

        const name = this.name;
        const execFuncs = exec.execFunctions[this.index];
        //const ruleString = this.toString();//Only for troubleshooting with const t = ruleString; below

        const expListBaseFunc = this.expList.getBaseFunction(exec);

        let func = (ast) => {
            exec.check_length(ast, 2);
            const [ type, expListNode ] = ast;
            if (type !== name)
                throw new Error(`Expected ${name} node, found ${type}`);

            if (expListNode.length === 0)
                return GrammarForge.NORMAL_CONTROL;
            
            const result = expListBaseFunc(expListNode);
            const ruleExpressionIndex = expListNode[2][1];//Get the expression index from the EXPRESSION node.  It is checked in ExpList.getBaseFunction().

            const execFunc = execFuncs[ruleExpressionIndex];
            if (execFunc === undefined)
                throw new Error(`No exec function found for expression index ${ruleExpressionIndex} in rule ${name}.  If none is provided, it must be null.`);

            //const t = ruleString;//Only for troubleshooting with const ruleString = this.toString(); above

            if (execFunc !== null) {
                return execFunc(result);
            }
            else {
                return exec.ev(result);
            }
        }

        exec.ruleFunctions.push(func);
    }

    checkMakeDefaultExecFunctions = (exec) => {
        if (this.tryMakeDefaultExecFunctionFromRuleTag(exec) === true)
            return;

        for (let i = 0; i < this.expList.expressions.length; i++) {
            this.tryMakeDefaultExecFunctionFromTag(exec, i);
        }

        for (let i = 0; i < this.expList.expressions.length; i++) {
            this.tryMakeDefaultExpExecFunc(exec, i);
        }
    }

    tryMakeDefaultExecFunctionFromRuleTag = (exec) => {
        const tag = this.tag;
        if (tag === null)
            return false;

        for (let i = 0; i < this.expList.expressions.length; i++) {
            const expression = this.expList.expressions[i];
            let func = null;
            switch (tag) {
                case 'block': {
                        const [ stmtListIndex ] = this.getNonTerminalIndices(exec, expression, ['sl'], tag);

                        const defaultFunc = exec.defaultExecFunctions.get("block");
                        func = (arr) => defaultFunc(arr[stmtListIndex]);
                    }

                    break;
            }

            if (func !== null) {
                exec.execFunctions[this.index][i] = func;
                continue;
            }

            if (i == 0) {
                return false;
            }
            else {
                throw new Error(`Rule tagged as ${tag} has multiple expressions.  Succeeded creating a default exec function using the rule tag for the first expression, but failed on expression ${i}.  Rule: ${this.name}`);
            }
        }

        return true;
    }

    tryMakeDefaultExecFunctionFromTag = (exec, expressionIndex) => {
        const ruleIndex = this.index;

        const expression = this.expList.expressions[expressionIndex];
        const tag = expression.tag;
        if (tag === null)
            return;

        if (exec.execFunctions[ruleIndex][expressionIndex] !== null) {
            console.warn(`A rule was tagged as ${tag}:\n${this.toString()}\nbut the expression that looks like a ${tag} expression already has a user-defined exec function.  Skipping default ${tag} function generation for this expression:\n${expression.expressionString}`);
            return;
        }

        let func = null;
        switch (tag) {
            case 'while': {
                    const [ expIndex, stmtIndex ] = this.getNonTerminalIndices(exec, expression, ['exp', 'stmt'], tag);
                    
                    const defaultFunc = exec.defaultExecFunctions.get("while");
                    func = (arr) => defaultFunc(arr[expIndex], arr[stmtIndex]);
                }
                break;
            case 'foreach' : {
                    const [ varIndex, expIndex, stmtIndex ] = this.getNonTerminalIndices(exec, expression, ['var', 'exp', 'stmt'], tag);
                    
                    const defaultFunc = exec.defaultExecFunctions.get("foreach");
                    func = (arr) => defaultFunc(arr[varIndex], arr[expIndex], arr[stmtIndex]);
                }
                break;
            case 'assign': {
                    const [ varIndex, expIndex ] = this.getNonTerminalIndices(exec, expression, ['var', 'exp'], tag);

                    let defaultFunc;
                    const metadata = expression.metadata;
                    if (metadata.length > 1) {
                        const tagInfo = metadata[1];
                        if (tagInfo !== 'no_declare')
                            throw new Error(`Expression has a tag with unrecognized info: ${tagInfo}.  The only supported info for assign is 'no_declare'.  expression: ${expression.expressionString} in rule: ${this.name}, tag: ${metadata.join(" ")}`);
                    
                        defaultFunc = exec.defaultExecFunctions.get("assign no_declare");
                    }
                    else {
                        defaultFunc = exec.defaultExecFunctions.get("assign");
                    }

                    func = (arr) => defaultFunc(arr[varIndex], arr[expIndex]);
                }

                break;
            case 'declare': {
                    const metadata = expression.metadata;
                    if (metadata.length > 1) {
                        const tagInfo = metadata[1];
                        if (tagInfo !== 'no_value')
                            throw new Error(`Expression has a tag with unrecognized info: ${tagInfo}.  The only supported info for declare is 'no_value'.  expression: ${expression.expressionString} in rule: ${this.name}, tag: ${metadata.join(" ")}`);

                        const defaultFunc = exec.defaultExecFunctions.get("declare no_value");
                        const [ varIndex ] = this.getNonTerminalIndices(exec, expression, ['var'], tag);
                        func = (arr) => defaultFunc(arr[varIndex]);
                    }
                    else {
                        const [ varIndex, expIndex ] = this.getNonTerminalIndices(exec, expression, ['var', 'exp'], tag);
                        const defaultFunc = exec.defaultExecFunctions.get("declare");
                        func = (arr) => defaultFunc(arr[varIndex], arr[expIndex]);
                    }
                }

                break;
            case 'get': {
                    const [ varIndex ] = this.getNonTerminalIndices(exec, expression, ['var'], tag);

                    const defaultFunc = exec.defaultExecFunctions.get("get");
                    func = (arr) => defaultFunc(arr[varIndex]);
                }

                break;
            case 'par': {
                    const [ expIndex ] = this.getNonTerminalIndices(exec, expression, ['exp'], tag);

                    const defaultFunc = exec.defaultExecFunctions.get("par");
                    func = (arr) => defaultFunc(arr[expIndex]);
                }

                break;
            case 'break': {
                    const empty = this.getNonTerminalIndices(exec, expression, [], tag);

                    const defaultFunc = exec.defaultExecFunctions.get("break");
                    func = (arr) => defaultFunc();
                }

                break;
            case 'continue': {
                    const empty = this.getNonTerminalIndices(exec, expression, [], tag);

                    const defaultFunc = exec.defaultExecFunctions.get("continue");
                    func = (arr) => defaultFunc();
                }

                break;
            case 'return': {
                    try {
                        const [ expIndex ] = this.getNonTerminalIndices(exec, expression, ['exp'], tag);

                        const defaultFunc = exec.defaultExecFunctions.get("return");
                        func = (arr) => defaultFunc(arr[expIndex]);
                    }
                    catch (e) {
                        if (e.message.startsWith("Unknown non-terminal")) {
                            const [ optionalIndex ] = this.getNonTerminalIndices(exec, expression, ['optional'], tag);
                            const optional = expression.words[optionalIndex];
                            if (!(optional instanceof GrammarForge.QWord) || optional.oType !== 'QUESTION')
                                throw e;

                            if (!(optional.word instanceof GrammarForge.Par))
                                throw e;

                            const parExpression = optional.word.expList.expressions[0];
                            if (parExpression.words.length !== 1)
                                throw e;

                            const word = parExpression.words[0];
                            this.validateWord(word, tag);
                            if (word.value !== 'exp')
                                throw e;

                            const defaultFunc = exec.defaultExecFunctions.get("return optional");
                            func = (arr) => defaultFunc(arr[optionalIndex]);
                        }
                        else {
                            throw e;
                        }
                    }
                }

                break;
            case 'func_declare': {
                    const [ varIndex, optionalIndex, blockIndex ] = this.getNonTerminalIndices(exec, expression, ['var', 'optional', 'block'], tag);

                    const defaultFunc = exec.defaultExecFunctions.get("func_declare");
                    func = (arr) => defaultFunc(arr[varIndex], arr[optionalIndex], arr[blockIndex]);
                }

                break;
            case 'func_call': {
                    const [ varIndex, optionalIndex ] = this.getNonTerminalIndices(exec, expression, ['var', 'optional'], tag);

                    const defaultFunc = exec.defaultExecFunctions.get("func_call");
                    func = (arr) => defaultFunc(arr[varIndex], arr[optionalIndex]);
                }

                break;
            case 'if' : {
                    const rules = this.getRulesFromTags(exec, ['exp', 'stmt'], tag, expression);

                    if (rules.length !== 2)
                        throw new Error(`Found a ${tag} tag on expression: ${expression.expressionString}, but ${tag} requires exactly 2 non-terminals: exp and stmt (optional else stmt). Found ${rules.length}`);

                    const [ expRule, stmtRule ] = rules;

                    const nonTerminals = expression.getNonTerminals();
                    if (nonTerminals.length < 2 || nonTerminals.length > 3)
                        throw new Error(`Found a ${tag} tag on expression: ${expression.expressionString}, but ${tag} requires 2 or 3 non-terminals: exp and optional stmt. Found ${nonTerminals.length}`);

                    let expIndex = -1;
                    let ifBodyIndex = -1;
                    let elseBodyIndex = -1;
                    let elseParIndex = -1;
                    for (const index of nonTerminals) {
                        const word = expression.words[index];
                        if (word instanceof GrammarForge.Term) {
                            if (word.type === "IDENTIFIER") {
                                if (word.value === expRule.name) {
                                    if (expIndex !== -1)
                                        throw new Error(`Duplicate ${expRule.name} non-terminal: ${expression.expressionString}`);

                                    expIndex = index;
                                    continue;
                                }

                                if (word.value === stmtRule.name) {
                                    if (ifBodyIndex === -1) {
                                        ifBodyIndex = index;
                                        continue;
                                    }
                                    
                                    if (elseBodyIndex === -1) {
                                        elseBodyIndex = index;
                                        if (elseParIndex !== -1)
                                            throw new Error(`Found both a direct else stmt non-terminal and an optional else stmt par non-terminal in an expression marked with an if tag: ${expression.expressionString}.  Only one else stmt is allowed.  Found in rule: ${this.name}`);

                                        continue;
                                    }

                                    throw new Error(`Found 3 or more stmt (${stmtRule.name}) non-terminals in an expression marked with an if tag: ${expression.expressionString}.  Only 2 are allowed: one for the if body, and an optional one for the else body.  Found in rule: ${this.name}`);
                                }

                                throw new Error(`Unknown non-terminal ${word.string}: ${expression.expressionString}`);
                            }

                            throw new Error(`Found a ${tag} tag, expected Term: ${word.string}`);
                        }
                        
                        if (word instanceof GrammarForge.QWord) {
                            if (word.oType === 'QUESTION') {
                                if (!(word.word instanceof GrammarForge.Par))
                                    throw new Error(`Found a ${tag} tag on expression: ${expression.expressionString}, but the optional else stmt must be a Par.`);

                                //Look for stmt inside the par
                                const nonTerminals = word.word.expList.tryGetNonTerminals();
                                if (nonTerminals === null || nonTerminals.length !== 1)
                                    throw new Error(`Found a ${tag} tag on expression: ${expression.expressionString}, but the optional else stmt must contain exactly 1 non-terminal: stmt. Found ${nonTerminals?.length ?? 'null'}`);

                                const parExpression = word.word.expList.expressions[0];
                                const nonTermIndexes = parExpression.getNonTerminals();
                                if (nonTermIndexes.length !== 1)
                                    throw new Error(`Found a ${tag} tag on expression: ${expression.expressionString}, but the optional else stmt must contain exactly 1 non-terminal: stmt. Found ${nonTermIndexes.length}`);

                                const elseNonTerminalIndex = nonTermIndexes[0];
                                const elseWord = parExpression.words[elseNonTerminalIndex];
                                this.validateWord(elseWord, tag);
                                if (elseWord.value !== stmtRule.name)
                                    throw new Error(`Found a ${tag} tag on expression: ${expression.expressionString}, but the optional else stmt must be of type ${stmtRule.name}. Found ${elseWord.string}`);

                                if (elseBodyIndex !== -1)
                                    throw new Error(`Found multiple optional else stmt non-terminals in an expression marked with an if tag: ${expression.expressionString}.  Only one optional else stmt is allowed.  Found in rule: ${this.name}`);

                                elseBodyIndex = index;
                                elseParIndex = elseNonTerminalIndex;
                                continue;
                            }

                            throw new Error(`Found a ${tag} tag, expected Term: ${word.string}`);
                        }
                    }

                    if (expIndex === -1)
                        throw new Error(`No ${expRule.name} non-terminal found: ${expression.expressionString}`);

                    if (ifBodyIndex === -1)
                        throw new Error(`No ${stmtRule.name} non-terminal found for the if body: ${expression.expressionString}`);

                    const defaultFunc = exec.defaultExecFunctions.get("if");
                    if (elseBodyIndex === -1) {
                        func = (arr) => defaultFunc(arr[expIndex], arr[ifBodyIndex], null);
                    }
                    else {
                        if (elseParIndex === -1) {
                            func = (arr) => {
                                return defaultFunc(arr[expIndex], arr[ifBodyIndex], arr[elseBodyIndex]);
                            }
                        }
                        else {
                            const getElseBody = (arr) => {
                                const parArr = arr[elseBodyIndex];
                                if (parArr === null)
                                    return null;

                                return parArr[elseParIndex];
                            }

                            func = (arr) => {
                                return defaultFunc(arr[expIndex], arr[ifBodyIndex], getElseBody(arr));
                            }
                        }
                    }
                }

                break;
            default:
                return;
        }

        if (func === null)
            throw new Error(`Fell through the switch trying to make default exec function for rule: ${this.name}, expression index: ${expressionIndex}, tag: ${tag}`);

        //console.log(`Auto-generated default ${tag} exec function for rule: ${this.name}, expression index: ${expressionIndex}, expression: ${expression.expressionString}`);
        exec.execFunctions[ruleIndex][expressionIndex] = func;
    }

    getRulesFromTags(exec, rulesTags, tag, expression) {
        return rulesTags.map(rt => {
            const rule = exec.ruleTagLookup.get(rt);
            if (!rule) {
                if (rt === 'optional')
                    return { name: rt };//Dummy rule for optional par

                throw new Error(`Found a ${tag} tag on expression: ${expression.expressionString}, but no rule tagged as ${rt} found.`);
            }

            return rule;
        });
    }

    validateNonTerminalsCount(nonTerminals, rules, tag, expression) {
        if (nonTerminals.length !== rules.length)
            throw new Error(`Found a ${tag} tag on expression: ${expression.expressionString}, but ${tag} requires exactly ${rules.length} non-terminals. Found ${nonTerminals.length}`);
    }

    validateWord(word, tag) {
        if (!(word instanceof GrammarForge.Term))
            throw new Error(`Found a ${tag} tag, expected Term: ${word.string}`);

        if (word.type !== "IDENTIFIER")
            throw new Error(`Found a ${tag} tag, expected IDENTIFIER: ${word.string}`);
    }

    assignIndices(nonTerminals, rules, tag, expression) {
        const indices = Array(rules.length).fill(-1);

        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            let found = false;
            for (let j = 0; j < nonTerminals.length; j++) {
                const index = nonTerminals[j];
                const word = expression.words[index];
                if (rule.name === 'optional') {
                    if (word instanceof GrammarForge.QWord) {
                        if (indices[i] !== -1)
                            throw new Error(`Duplicate optional non-terminal: ${expression.expressionString}`);

                        indices[i] = index;
                        found = true;
                        break;
                    }
                }
                else {
                    if (rule.name === word.value) {
                        if (indices[i] !== -1)
                            throw new Error(`Duplicate ${rule.name} non-terminal: ${expression.expressionString}`);

                        this.validateWord(word, tag, expression);
                        indices[i] = index;
                        found = true;
                        break;
                    }
                }
            }

            if (!found)
                throw new Error(`Unknown non-terminal ${rule.name}: ${expression.expressionString}`);
        }

        for (let i = 0; i < indices.length; i++) {
            if (indices[i] === -1)
                throw new Error(`No ${rules[i].name} non-terminal found: ${expression.expressionString}`);
        }

        return indices;
    }

    getNonTerminalIndices(exec, expression, rulesTags, tag) {
        const rules = this.getRulesFromTags(exec, rulesTags, tag, expression);
        const nonTerminals = expression.getNonTerminals();
        this.validateNonTerminalsCount(nonTerminals, rules, tag, expression);
        return this.assignIndices(nonTerminals, rules, tag, expression);
    }

    tryMakeDefaultExpExecFunc = (exec, expressionIndex) => {
        if (this.isExpRule !== true)
            return;

        const expression = this.expList.expressions[expressionIndex];
        if (expression.tag !== null)
            return;

        const hasExecFunc = !!exec.execFunctions[this.index][expressionIndex];
        if (expression.words.length === 0) {
            throw new Error(`Found an exp rule with an empty expression in rule: ${this.name}, expression: ${expression.expressionString}.  exp rules must have at least one word.`);
        }
        else if (expression.words.length === 1) {
            //exp_n : exp_{n+1}
            const firstWord = expression.words[0];
            if (this.isBaseExpRule(exec, firstWord)) {
                if (this.name === firstWord.value) {
                    if (!hasExecFunc)
                        throw new Error(`Found an exp rule recursion in rule: ${this.name}, expression: ${expression.expressionString}.  The parser is a LL1 recursive desent parser with backtracking. Left recursion is not supported.`);
                }
            }

            return;
        }
        else if (expression.words.length > 3) {
            if (!hasExecFunc)
                console.warn(`Found an rule that is a child of your 'exp' rule, but it has more than 3 words (words: ${expression.words.length}).  It also does not have a provided execution function.  Skipping default exp exec function generation for this expression:\n${this.toString()}\nexpression: ${expression.expressionString}`);

            return;
        }

        let func = null;
        const ruleIndex = this.index;
        // exp_n : exp_{n+1} (op_n exp_{n+1})*              //left associative ((a op b) op c) op d
        // exp_n : exp_{n+1} (op_n exp_{n+1})+ | exp_{n+1}  //left associative ((a op b) op c) op d
        // exp_n : exp_{n+1} (op_n exp_n)?                  //right associative a op (b op (c op d))
        // exp_n : exp_{n+1} op_n exp_n | exp_{n+1}         //right associative a op (b op (c op d))
        // exp_n : op_n exp_n | exp_{n+1}
        if (expression.words.length === 2) {
            const firstWord = expression.words[0];
            const secondWord = expression.words[1];
            if (this.isBaseExpRule(exec, firstWord)) {
                if (firstWord.value === this.name)
                    throw new Error(`Found an exp rule recursion in rule: ${this.name}, expression: ${expression.expressionString}.  The parser is a LL1 recursive desent parser with backtracking. Left recursion is not supported.`);

                // exp_n : exp_{n+1} (op_n exp_{n+1})*
                // exp_n : exp_{n+1} (op_n exp_{n+1})+ | exp_{n+1}
                // exp_n : exp_{n+1} (op_n exp_n)?
                if (!(secondWord instanceof GrammarForge.QWord)) {
                    if (!hasExecFunc)
                        console.warn(`Found an rule that is a child of your 'exp' rule, but its second word is not a QWord.  It also does not have a provided execution function.  Skipping default exp exec function generation for this expression:\n${this.toString()}\nexpression: ${expression.expressionString}`);
                }

                if (!(secondWord.word instanceof GrammarForge.Par)) {
                    if (!hasExecFunc)
                        console.warn(`Found an rule that is a child of your 'exp' rule, but its second word is not a Par.  It also does not have a provided execution function.  Skipping default exp exec function generation for this expression:\n${this.toString()}\nexpression: ${expression.expressionString}`);

                    return;
                }
                
                const parExpression = secondWord.word.expList.expressions[0];
                if (parExpression.words.length !== 2) {
                    if (!hasExecFunc)
                        console.warn(`Found an rule that is a child of your 'exp' rule, but its second word Par does not have exactly 2 words.  It also does not have a provided execution function.  Skipping default exp exec function generation for this expression:\n${this.toString()}\nexpression: ${expression.expressionString}`);

                    return;
                }

                const parFirstWord = parExpression.words[0];
                const parSecondWord = parExpression.words[1];
                if (!this.isOpRule(exec, parFirstWord)) {
                    if (!hasExecFunc)
                        console.warn(`Found an rule that is a child of your 'exp' rule, but its second word Par's first word is not an op rule.  It also does not have a provided execution function.  Skipping default exp exec function generation for this expression:\n${this.toString()}\nexpression: ${expression.expressionString}`);

                    return;
                }

                if (!this.isBaseExpRule(exec, parSecondWord)) {
                    if (!hasExecFunc)
                        console.warn(`Found an rule that is a child of your 'exp' rule, but its second word Par's second word is not a base exp rule.  It also does not have a provided execution function.  Skipping default exp exec function generation for this expression:\n${this.toString()}\nexpression: ${expression.expressionString}`);

                    return;
                }

                const questionPar = secondWord.oType === 'QUESTION';
                if (questionPar) {
                    // exp_n : exp_{n+1} (op_n exp_n)?
                    if (parSecondWord.value !== this.name) {
                        if (!hasExecFunc)
                            console.warn(`Found an rule that is a child of your 'exp' rule, but its second word Par's second word is not the same as the exp rule.  It also does not have a provided execution function.  Skipping default exp exec function generation for this expression:\n${this.toString()}\nexpression: ${expression.expressionString}`);

                        return;
                    }
                }
                else {
                    // exp_n : exp_{n+1} (op_n exp_{n+1})*
                    // exp_n : exp_{n+1} (op_n exp_{n+1})+ | exp_{n+1}
                    if (parSecondWord.value === this.name) {
                        if (!hasExecFunc)
                            console.warn(`Found an rule that is a child of your 'exp' rule, but its second word Par's second word is the same as the exp rule.  It also does not have a provided execution function.  Skipping default exp exec function generation for this expression:\n${this.toString()}\nexpression: ${expression.expressionString}`);

                        return;
                    }
                }

                if (hasExecFunc) {
                    console.warn(`Found an rule that is a child of your 'exp' rule, but it already has a provided execution function.  Skipping default exp exec function generation for this expression:\n${this.toString()}\nexpression: ${expression.expressionString}`);
                    return;
                }

                //Need to get the precedence level by checking which ops this op_n has in it.
                const ops = [];
                this.getOps(exec, parFirstWord, ops);
                if (ops.length === 0)
                    throw new Error(`No operators found for op rule: ${parFirstWord.string} in expression: ${expression.expressionString} in rule: ${this.name}`);

                const firstOp = ops[0];
                let precedenceLevel = GrammarForge.Expression.operatorTagPrecedence.get(firstOp);
                if (precedenceLevel === undefined)
                    throw new Error(`No precedence level found for operator: ${firstOp} in expression: ${expression.expressionString} in rule: ${this.name}`);

                for (let i = 1; i < ops.length; i++) {
                    const op = ops[i];
                    const opPrecedenceLevel = GrammarForge.Expression.operatorTagPrecedence.get(op);
                    if (opPrecedenceLevel === undefined)
                        throw new Error(`No precedence level found for operator: ${op} in expression: ${expression.expressionString} in rule: ${this.name}`);

                    if (opPrecedenceLevel !== precedenceLevel)
                        throw new Error(`Mismatched precedence levels found for operators in op rule: ${parFirstWord.string} in expression: ${expression.expressionString} in rule: ${this.name}.  All operators in an op rule must have the same precedence level.  Found operators: ${ops.join(", ")}`);
                }

                const funcMap = exec.opFunctions[precedenceLevel];
                if (!funcMap)
                    throw new Error(`No default op functions found at precedence level: ${precedenceLevel} in expression: ${expression.expressionString} in rule: ${this.name}`);

                if (ops.length == 1) {
                    const baseFunc = funcMap.get(firstOp);
                    if (!baseFunc)
                        throw new Error(`No default op function found for operator: ${firstOp} at precedence level: ${precedenceLevel} in expression: ${expression.expressionString} in rule: ${this.name}`);

                    if (questionPar) {
                        func = (arr) => {
                            const [ exp_n_1, optionalParArr ] = arr;
                            const left = exp_n_1();
                            if (optionalParArr === null)
                                return left;

                            const [ op_n, exp_n ] = optionalParArr;

                            const right = exp_n();
                            return baseFunc(left, right);
                        }
                    }
                    else {
                        func = (arr) => {
                            const [ exp_n_1, optionalArr ] = arr;
                            let result = exp_n_1();
                            if (optionalArr === null)
                                return result;

                            for (const [ op_n, exp_n ] of optionalArr) {
                                const right = exp_n();
                                result = baseFunc(result, right);
                            }

                            return result;
                        }
                    }
                }
                else {
                    if (questionPar) {
                        func = (arr) => {
                            const [ exp_n_1, optionalArr ] = arr;
                            const left = exp_n_1();
                            if (optionalArr === null)
                                return left;

                            const [ op_n, exp_n ] = optionalArr;
                            const right = exp_n();
                            const op = op_n();
                            const baseFunc = funcMap.get(op);
                            if (!baseFunc)
                                throw new Error(`No default op function found for operator: ${op} at precedence level: ${precedenceLevel} in expression: ${expression.expressionString} in rule: ${this.name}`);

                            return baseFunc(left, right);
                        }
                    }
                    else {
                        func = (arr) => {
                            const [ exp_n_1, optionalArr ] = arr;
                            let result = exp_n_1();
                            if (optionalArr === null)
                                return result;

                            for (const [ op_n, exp_n ] of optionalArr) {
                                const right = exp_n();
                                const op = op_n();
                                const baseFunc = funcMap.get(op);
                                if (!baseFunc)
                                    throw new Error(`No default op function found for operator: ${op} at precedence level: ${precedenceLevel} in expression: ${expression.expressionString} in rule: ${this.name}`);

                                result = baseFunc(result, right);
                            }

                            return result;
                        }
                    }
                }
            }
            else if (this.isBaseExpRule(exec, secondWord)) {
                // exp_n : op_n exp_n | exp_{n+1}
                if (secondWord.value !== this.name) {
                    if (!hasExecFunc)
                        console.warn(`Found an rule that is a child of your 'exp' rule, but its second word is not the same as the exp rule.  It also does not have a provided execution function.  Skipping default exp exec function generation for this expression:\n${this.toString()}\nexpression: ${expression.expressionString}`);

                    return;
                }

                if (!this.isOpRule(exec, firstWord)) {
                    if (!hasExecFunc)
                        console.warn(`Found an rule that is a child of your 'exp' rule, but its first word is not an op rule.  It also does not have a provided execution function.  Skipping default exp exec function generation for this expression:\n${this.toString()}\nexpression: ${expression.expressionString}`);

                    return;
                }

                if (hasExecFunc) {
                    console.warn(`Found an rule that is a child of your 'exp' rule, but it already has a provided execution function.  Skipping default exp exec function generation for this expression:\n${this.toString()}\nexpression: ${expression.expressionString}`);
                    return;
                }

                //Need to get the precedence level by checking which ops this op_n has in it.
                const ops = [];
                this.getOps(exec, firstWord, ops);
                if (ops.length === 0)
                    throw new Error(`No operators found for op rule: ${firstWord.string} in expression: ${expression.expressionString} in rule: ${this.name}`);

                const firstOp = ops[0];
                let precedenceLevel = GrammarForge.Expression.operatorTagPrecedence.get(firstOp);
                if (precedenceLevel === undefined)
                    throw new Error(`No precedence level found for operator: ${firstOp} in expression: ${expression.expressionString} in rule: ${this.name}`);

                for (let i = 1; i < ops.length; i++) {
                    const op = ops[i];
                    const opPrecedenceLevel = GrammarForge.Expression.operatorTagPrecedence.get(op);
                    if (opPrecedenceLevel === undefined)
                        throw new Error(`No precedence level found for operator: ${op} in expression: ${expression.expressionString} in rule: ${this.name}`);

                    if (opPrecedenceLevel !== precedenceLevel)
                        throw new Error(`Mismatched precedence levels found for operators in op rule: ${firstWord.string} in expression: ${expression.expressionString} in rule: ${this.name}.  All operators in an op rule must have the same precedence level.  Found operators: ${ops.join(", ")}`);
                }

                const funcMap = exec.opFunctions[precedenceLevel];
                if (!funcMap)
                    throw new Error(`No default op functions found at precedence level: ${precedenceLevel} in expression: ${expression.expressionString} in rule: ${this.name}`);

                if (ops.length == 1) {
                    const baseFunc = funcMap.get(firstOp);
                    if (!baseFunc)
                        throw new Error(`No default op function found for operator: ${firstOp} at precedence level: ${precedenceLevel} in expression: ${expression.expressionString} in rule: ${this.name}`);

                    func = (arr) => {
                        const [ op_n, exp_n ] = arr;
                        const value = exp_n();
                        return baseFunc(value);
                    }
                }
                else {
                    func = (arr) => {
                        const [ op_n, exp_n ] = arr;
                        const op = op_n();
                        const value = exp_n();
                        const baseFunc = funcMap.get(op);
                        if (!baseFunc)
                            throw new Error(`No default op function found for operator: ${op} at precedence level: ${precedenceLevel} in expression: ${expression.expressionString} in rule: ${this.name}`);

                        return baseFunc(value);
                    }
                }
            }
            else {
                if (!hasExecFunc)
                    console.warn(`Found a rule that is a child of your 'exp' rule, but neither its first nor second word is a base exp rule and it does not have a provided execution function.  expression: ${expression.expressionString} in rule: ${this.name}`);

                return;
            }
        }
        else {
            // exp_n : exp_{n+1} op_n exp_n | exp_{n+1}         //right associative a op (b op (c op d))
            const firstWord = expression.words[0];
            const secondWord = expression.words[1];
            const thirdWord = expression.words[2];

            if (!this.isBaseExpRule(exec, firstWord)) {
                if (!hasExecFunc)
                    console.warn(`Found an rule that is a child of your 'exp' rule, but its first word is not a base exp rule.  It also does not have a provided execution function.  Skipping default exp exec function generation for this expression:\n${this.toString()}\nexpression: ${expression.expressionString}`);

                return;
            }

            if (!this.isOpRule(exec, secondWord)) {
                if (!hasExecFunc)
                    console.warn(`Found an rule that is a child of your 'exp' rule, but its second word is not an op rule.  It also does not have a provided execution function.  Skipping default exp exec function generation for this expression:\n${this.toString()}\nexpression: ${expression.expressionString}`);

                return;
            }

            if (!this.isBaseExpRule(exec, thirdWord)) {
                if (!hasExecFunc)
                    console.warn(`Found an rule that is a child of your 'exp' rule, but its third word is not a base exp rule.  It also does not have a provided execution function.  Skipping default exp exec function generation for this expression:\n${this.toString()}\nexpression: ${expression.expressionString}`);

                return;
            }

            if (firstWord.value === this.name)
                throw new Error(`Found an exp rule recursion in rule: ${this.name}, expression: ${expression.expressionString}.  The parser is a LL1 recursive desent parser with backtracking. Left recursion is not supported.`);

            if (thirdWord.value !== this.name) {
                if (!hasExecFunc)
                    console.warn(`Found an rule that is a child of your 'exp' rule, but its third word is not the same as the exp rule.  It also does not have a provided execution function.  Skipping default exp exec function generation for this expression:\n${this.toString()}\nexpression: ${expression.expressionString}`);

                return;
            }

            if (hasExecFunc) {
                console.warn(`Found an rule that is a child of your 'exp' rule, but it already has a provided execution function.  Skipping default exp exec function generation for this expression:\n${this.toString()}\nexpression: ${expression.expressionString}`);
                return;
            }

            //Need to get the precedence level by checking which ops this op_n has in it.
            const ops = [];
            this.getOps(exec, secondWord, ops);
            if (ops.length === 0)
                throw new Error(`No operators found for op rule: ${secondWord.string} in expression: ${expression.expressionString} in rule: ${this.name}`);

            const firstOp = ops[0];
            let precedenceLevel = GrammarForge.Expression.operatorTagPrecedence.get(firstOp);
            if (precedenceLevel === undefined)
                throw new Error(`No precedence level found for operator: ${firstOp} in expression: ${expression.expressionString} in rule: ${this.name}`);

            for (let i = 1; i < ops.length; i++) {
                const op = ops[i];
                const opPrecedenceLevel = GrammarForge.Expression.operatorTagPrecedence.get(op);
                if (opPrecedenceLevel === undefined)
                    throw new Error(`No precedence level found for operator: ${op} in expression: ${expression.expressionString} in rule: ${this.name}`);

                if (opPrecedenceLevel !== precedenceLevel)
                    throw new Error(`Mismatched precedence levels found for operators in op rule: ${secondWord.string} in expression: ${expression.expressionString} in rule: ${this.name}.  All operators in an op rule must have the same precedence level.  Found operators: ${ops.join(", ")}`);
            }

            const funcMap = exec.opFunctions[precedenceLevel];
            if (!funcMap)
                throw new Error(`No default op functions found at precedence level: ${precedenceLevel} in expression: ${expression.expressionString} in rule: ${this.name}`);

            if (ops.length == 1) {
                const baseFunc = funcMap.get(firstOp);
                if (!baseFunc)
                    throw new Error(`No default op function found for operator: ${firstOp} at precedence level: ${precedenceLevel} in expression: ${expression.expressionString} in rule: ${this.name}`);

                func = (arr) => {
                    const [ exp_n_1, op_n, exp_n ] = arr;
                    const left = exp_n_1();
                    const right = exp_n();
                    return baseFunc(left, right);
                }
            }
            else {
                func = (arr) => {
                    const [ exp_n_1, op_n, exp_n ] = arr;
                    const left = exp_n_1();
                    const right = exp_n();
                    const op = op_n();
                    const baseFunc = funcMap.get(op);
                    if (!baseFunc)
                        throw new Error(`No default op function found for operator: ${op} at precedence level: ${precedenceLevel} in expression: ${expression.expressionString} in rule: ${this.name}`);

                    return baseFunc(left, right);
                }
            }
        }

        if (func === null)
            throw new Error(`Fell through the switch trying to make default exp exec function for rule: ${this.name}, expression index: ${expressionIndex}`);

        //console.log(`Auto-generated default exp exec function for rule: ${this.name}, expression index: ${expressionIndex}, expression: ${expression.expressionString}`);
        exec.execFunctions[ruleIndex][expressionIndex] = func;
    }

    isOpRule = (exec, word) => {
        if (!(word instanceof GrammarForge.Term))
            return false;

        if (word.type !== "IDENTIFIER")
            throw new Error(`Expected IDENTIFIER, found: ${word.string}`);

        const rule = exec.getRule(word.value);
        if (!rule)
            throw new Error(`No rule found with name: ${word.value}`);

        if (rule.isExpRule !== true)
            throw new Error(`Rule is not an exp rule: ${rule.name}`);

        if (rule.expList.expressions.length === 1) {
            const expression = rule.expList.expressions[0];
            if (expression.words.length !== 1)
                return false;

            if (expression.tag !== null) {
                if (GrammarForge.Expression.operatorTags.has(expression.tag))
                    return true;

                return false;
            }

            const firstWord = expression.words[0];
            if (firstWord instanceof GrammarForge.Term) {
                if (firstWord.type === "IDENTIFIER")
                    return this.isOpRule(exec, firstWord);
            }
            
            return false;
        }
        else {
            //If multiple expressions, they must all be 1 word with an operator tag.
            for (const expression of rule.expList.expressions) {
                if (expression.words.length !== 1)
                    return false;

                if (expression.tag === null)
                    return false;

                if (!GrammarForge.Expression.operatorTags.has(expression.tag))
                    throw new Error(`Op rule expression metadata tag must be one of: ${Array.from(GrammarForge.Expression.operatorTags).join(", ")}.  Found tag: ${expression.tag} in expression: ${expression.expressionString} in rule: ${rule.name}`);
            }

            return true;
        }
    }

    isBaseExpRule = (exec, word) => {
        if (!(word instanceof GrammarForge.Term))
            return false;

        if (word.type !== "IDENTIFIER")
            return false;

        const rule = exec.getRule(word.value);
        if (!rule)
            throw new Error(`No rule found with name: ${word.value}`);

        if (rule.isExpRule !== true)
            throw new Error(`Rule is not an exp rule: ${rule.name}`);

        return !this.isOpRule(exec, word);
    }

    getOps = (exec, word, arr) => {
        if (!(word instanceof GrammarForge.Term))
            throw new Error(`Expected Term, found: ${word.string}`);

        if (word.type === "IDENTIFIER") {
            const rule = exec.getRule(word.value);
            if (!rule)
                throw new Error(`No rule found with name: ${word.value}`);

            for (const expression of rule.expList.expressions) {
                if (expression.words.length !== 1) {
                    throw new Error(`Op rule expressions must have exactly 1 word.  Found expression: ${expression.expressionString} in rule: ${rule.name}`);
                }

                const firstWord = expression.words[0];
                const tag = expression.tag;
                if (tag === null) {
                    this.getOps(exec, firstWord, arr);
                    continue;
                }

                if (expression.metadata.length !== 1) {
                    throw new Error(`Op rule expressions must have exactly 1 metadata tag indicating the operator value.  Found expression: ${expression.expressionString} in rule: ${rule.name}`);
                }

                if (!(firstWord instanceof GrammarForge.Term)) {
                    throw new Error(`Op rule expressions must have a Term as their only word.  Found expression: ${expression.expressionString} in rule: ${rule.name}`);
                }

                if (!GrammarForge.Expression.operatorTags.has(tag)) {
                    throw new Error(`Op rule expression metadata tag must be one of: ${Array.from(GrammarForge.Expression.operatorTags).join(", ")}.  Found tag: ${tag} in expression: ${expression.expressionString} in rule: ${rule.name}`);
                }

                if (firstWord.type === "IDENTIFIER") {
                    const innerRule = exec.getRule(firstWord.value);
                    if (!innerRule)
                        throw new Error(`No rule found with name: ${firstWord.value}`);

                    for (const innerExpression of innerRule.expList.expressions) {
                        if (innerExpression.words.length !== 1) {
                            throw new Error(`Op rule expressions must have exactly 1 word.  Found expression: ${innerExpression.expressionString} in rule: ${innerRule.name}`);
                        }

                        if (innerExpression.tag === null)
                            continue;

                        const innerTag = innerExpression.tag;
                        throw new Error(`Found multiple op tags in nested op rule expressions.  An operator can only have one tag.  Parent rule: ${rule.name}, expression: ${expression.expressionString}, tag: ${tag}, inner rule: ${innerRule.name}, inner expression: ${innerExpression.expressionString}, tag: ${innerTag}`);
                    }
                }

                arr.push(tag);
            }
        }
        else {
            throw new Error(`Not implemented`);
        }
    }

    getChildren = (parser, childrenIndexSet) => {
        this.expList.getChildren(parser, childrenIndexSet);
    }

    toString() {
        return `${this.name} ::= ${this.expList.toString()}`;
    }
}

GrammarForge.Rule.tags = new Set([
    'sl',
    'stmt',
    'exp',
    'var',
    'block',
]);