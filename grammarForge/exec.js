"use strict";

{
    GrammarForge.Exec = class {
        constructor(parser, functions = null) {
            this.parser = parser;
            this.getRule = this.parser.getRule;
            this.ruleTagLookup = this.parser.ruleTagLookup;
            this.metaExpressionLookup = this.parser.metaExpressionLookup;
            this.rootRuleIndex = 0;
            this.setup(functions);
        }

        setup = (functions) => {
            this.execFunctions = [];
            for (let i = 0; i < this.parser.rules.length; i++) {
                this.execFunctions.push(Array(this.parser.rules[i].expList.expressions.length).fill(null));
            }

            this.ruleFunctions = [];
            
            this.ruleIndexLookup = this.parser.ruleIndexLookup;
            this.expressionIndexLookup = this.parser.expressionIndexLookup;

            this.makeDefaultExecFunctions();
            this.makeOperatorTokenTagMap();
            this.createExecFunctions(functions);

            for (let i = 0; i < this.parser.rules.length; i++) {
                const rule = this.parser.rules[i];
                rule.createBaseFunction(this);
            }
        }

        createExecFunctions = (functions) => {
            //Populate execFunctions from user functions
            if (functions) {
                for (const [ruleName, exprMap] of functions) {
                    const ruleIndex = this.ruleIndexLookup.get(ruleName);
                    if (ruleIndex === undefined)
                        throw new Error(`No rule found with name: ${ruleName}`);

                    for (const [expressionString, func] of exprMap) {
                        const exprIndex = this.expressionIndexLookup[ruleIndex].get(expressionString);
                        if (exprIndex === undefined)
                            throw new Error(`No expression found with string: ${expressionString} in rule: ${ruleName}`);

                        this.execFunctions[ruleIndex][exprIndex] = func;
                    }
                }
            }

            //Simple default functions like sl (statement list) are generated here because it doesn't require an expression tag.  
            //  Others are created by the rule objects.

            const tryGetInnerWord = (word) => {
                if (word instanceof GrammarForge.Term)
                    return word;

                if (word instanceof GrammarForge.Par) {
                    const expList = word.expList;
                    if (expList.expressions.length === 1) {
                        const expr = expList.expressions[0];
                        if (expr.words.length === 1)
                            return tryGetInnerWord(expr.words[0]);
                    }
                    else {
                        return null;
                    }
                }
            }

            //sl (statement list)
            const stmt_rule = this.ruleTagLookup.get("stmt");
            if (stmt_rule !== undefined) {
                let found = false;
                for (let i = 0; i < this.parser.rules.length; i++) {
                    const rule = this.parser.rules[i];
                    for (let j = 0; j < rule.expList.expressions.length; j++) {
                        const expr = rule.expList.expressions[j];
                        const nonTerminals = expr.getNonTerminals();
                        if (nonTerminals.length === 1) {
                            const nonTerminalIndex = nonTerminals[0];
                            const word = expr.words[nonTerminalIndex];//Allowed to have terminals at the top level only like START stmt* END, but not inside the QWord like (stmt SEMI)*
                            if (word instanceof GrammarForge.QWord && (word.oType === "PLUS" || word.oType === "STAR")) {
                                const qWordNonTerminals = word.tryGetNonTerminals();
                                if (qWordNonTerminals.length !== 1)
                                    continue;

                                const parWord = qWordNonTerminals[0];
                                if (!(parWord instanceof GrammarForge.Term))
                                    continue;

                                if (parWord.type !== "IDENTIFIER" || parWord.value !== stmt_rule.name)
                                    continue;

                                found = true;
                                if (this.execFunctions[i][j] !== null) {
                                    console.warn(`A rule was tagged as stmt:\n${stmt_rule.toString()}\nbut the expression that looks like a statement list already has a user-defined exec function.  Skipping default statement list function generation for this expression:\n${expr.expressionString}`);
                                    continue;
                                }

                                if (rule.expList.expressions.length !== 1) {
                                    console.warn(`A rule was tagged as stmt:\n${stmt_rule.toString()}\nbut the expression that looks like a statement list is in a rule with multiple expressions.  Skipping default statement list function generation for this expression:\n${expr.expressionString}`);
                                    break;
                                }

                                if (this.parser.ruleTagLookup.has('sl') && this.parser.ruleTagLookup.get('sl') !== rule)
                                    throw new Error(`Multiple rules found that look like statement lists.  Only one rule can be tagged as 'sl'.  Conflicting rules:\n${rule.toString()}, ${this.parser.ruleTagLookup.get('sl').toString()}`);

                                this.parser.ruleTagLookup.set('sl', rule);

                                const func = this.defaultExecFunctions.get("sl");
                                this.execFunctions[i][j] = (arr) => func(arr[nonTerminalIndex]);
                            }
                        }
                    }
                }

                if (!found)
                    console.warn(`A rule was tagged as stmt:\n${stmt_rule.toString()}\nbut no rules were recognized as a statement list.  Statement lists should only look like (stmt)* or (stmt)+`);
            }

            //func_call only in a stmt
            if (stmt_rule !== undefined && this.metaExpressionLookup.has("func_call")) {
                let found = false;
                for (let j = 0; j < stmt_rule.expList.expressions.length; j++) {
                    const expr = stmt_rule.expList.expressions[j];
                    const nonTerminals = expr.getNonTerminals();
                    if (nonTerminals.length === 1) {
                        const nonTerminalIndex = nonTerminals[0];
                        const word = expr.words[nonTerminalIndex];
                        if (word instanceof GrammarForge.Term && word.type === "IDENTIFIER") {
                            const rule = this.getRule(word.value);
                            if (!rule)
                                throw new Error(`No rule found for non-terminal: ${word.value}`);

                            if (rule.expList.expressions.length !== 1)
                                continue;

                            const ruleExpr = rule.expList.expressions[0];
                            if (ruleExpr.tag !== "func_call")
                                continue;

                            if (found)
                                console.warn(`Multiple expressions found in stmt rule that look like an exp only statement.  Only one is expected.  Expression:\n${expr.expressionString}`);

                            found = true;
                            if (this.execFunctions[stmt_rule.index][j] !== null) {
                                console.warn(`A rule was tagged as stmt:\n${stmt_rule.toString()}\nbut the expression that looks like an exp only statement already has a user-defined exec function.  Skipping default exp only statement function generation for this expression:\n${expr.expressionString}`);
                                continue;
                            }

                            const func = this.defaultExecFunctions.get("exp only");
                            this.execFunctions[stmt_rule.index][j] = (arr) => func(arr[nonTerminalIndex]);
                        }
                    }
                }

                if (!found)
                    console.warn(`A rule was tagged as stmt:\n${stmt_rule.toString()}\nbut no expressions were recognized as an exp only statement.  There should usually be a statement that only contains a function call.`);
            }

            Object.freeze(this.ruleTagLookup);
        }

        exec = (ast, variables = null, variableGetters = null) => {
            if (variables === null) {
                variables = new Map();
            }
            else if (!(variables instanceof Map)) {
                throw new Error("Variables parameter must be a Map or null.");
            }

            if (variableGetters !== null) {
                if (!(variableGetters instanceof Map))
                    throw new Error("Variable getters parameter must be a Map or null.");

                // for (const [ name, func ] of variableGetters) {
                //     if (typeof func !== 'function')
                //         throw new Error(`Variable getter for ${name} is not a function.`);
                // }
            }

            this.variables = [ variables ];
            this.variableGetters = variableGetters;
            const result = this.execute(ast);
            this.variables = null;
            this.variableGetters = null;
            return result;
        }

        execute = (ast) => {
            if (ast.length === 0)
                throw new Error("AST node is empty.");

            if (!this.variables)
                throw new Error("No variables context available for execution.  Call exec() to execute AST.");

            const func = this.ruleFunctions[this.rootRuleIndex];
            if (!func)
                throw new Error(`No exec function found for AST node type: ${first}`);

            return func(ast);
        }

        swapRootRule = (ruleName) => {
            const ruleIndex = this.ruleIndexLookup.get(ruleName);
            if (ruleIndex === undefined)
                throw new Error(`No rule found with name: ${ruleName}`);

            if (this.rootRuleIndex === ruleIndex)
                throw new Error(`Rule ${ruleName} is already the root rule.`);

            this.rootRuleIndex = ruleIndex;
        }

        token = (ast, requiredTokenType) => {
            if (ast.length !== 3)
                throw new Error(`TOKEN node must have exactly two children.`);

            const [ type, tokenType, value ] = ast;
            if (type !== 'TOKEN')
                throw new Error(`Expected TOKEN node, found ${type}`);

            if (tokenType !== requiredTokenType)
                throw new Error(`Expected token type ${requiredTokenType}, found ${tokenType}`);

            return value;
        }

        check_token = (ast, requiredTokenType) => {
            if (ast.length !== 3)
                throw new Error(`TOKEN node must have exactly 3 children.`);

            const [ type, tokenType, ] = ast;
            if (type !== 'TOKEN')
                throw new Error(`Expected TOKEN node, found ${type}`);

            if (tokenType !== requiredTokenType)
                throw new Error(`Expected token type ${requiredTokenType}, found ${tokenType}`);
        }

        check_symbol = (ast, requredSymbol) => {
            if (ast.length !== 2)
                throw new Error(`SYMBOL node must have exactly 2 children.`);

            const [ type, symbol ] = ast;
            if (type !== 'SYMBOL')
                throw new Error(`Expected SYMBOL node, found ${type}`);

            if (symbol !== requredSymbol)
                throw new Error(`Expected symbol ${requredSymbol}, found ${symbol}`);
        }

        check_type = (ast, expectedType) => {
            const type = ast[0];
            if (type !== expectedType)
                throw new Error(`Expected ${expectedType} node, found ${type}`);
        }

        check_length = (ast, expectedLength) => {
            if (ast.length === expectedLength)
                return;

            throw new Error(`Expected ${expectedLength} children, found ${ast.length}`);
        }

        check_optional = (ast) => {
            if (!Array.isArray(ast))
                throw new Error(`Expected optional node to be an array.`);
        }

        check_required = (ast) => {
            if (!Array.isArray(ast))
                throw new Error(`Expected required node to be an array.`);

            if (ast.length === 0)
                throw new Error(`Expected required node to have at least one child.`);
        }

        push_block_scope = () => {
            this.variables.push(new Map());
        }

        pop_block_scope = () => {
            if (this.variables.length === 1)
                throw new Error("Cannot pop global scope.");

            this.variables.pop();
        }

        declare_variable_default_value = (name) => {
            this.declare_variable(name, null);
        }

        declare_variable = (name, val) => {
            if (this.variableGetters && this.variableGetters.has(name)) {
                throw new Error(`${name} is reserved for a global value.  It cannot be used as a variable name.`);
            }

            const variables = this.variables;

            for (let i = variables.length - 1; i >= 0; i--) {
                const scope = variables[i];
                if (scope.has(name))
                    throw new Error(`Variable ${name} is already declared.  Variable shadowing/re-declaration is not allowed.`);
            }

            variables[variables.length - 1].set(name, val);
            if (GrammarForge.debuggingFunctions) {
                console.log(`let ${name} = ${val}`);
            }
        }

        declare_variable_func = (name, func) => {
            if (this.variableGetters && this.variableGetters.has(name)) {
                throw new Error(`${name} is reserved for a global value.  It cannot be used as a variable name.`);
            }

            const variables = this.variables;

            for (let i = variables.length - 1; i >= 0; i--) {
                const scope = variables[i];
                if (scope.has(name))
                    throw new Error(`Variable ${name} is already declared.  Variable shadowing/re-declaration is not allowed.`);
            }

            const val = func();
            variables[variables.length - 1].set(name, val);
            if (GrammarForge.debuggingFunctions) {
                console.log(`let ${name} = ${val}`);
            }
        }

        set_variable = (name, val) => {
            if (this.variableGetters && this.variableGetters.has(name)) {
                throw new Error(`${name} is reserved for a global value.  It cannot be edited.`);
            }

            const variables = this.variables;

            for (let i = variables.length - 1; i >= 0; i--) {
                const scope = variables[i];
                if (scope.has(name)) {
                    scope.set(name, val);
                    if (GrammarForge.debuggingFunctions) {
                        console.log(`${name} = ${val}`);
                    }

                    return;
                }
            }

            throw new Error(`Tried to set undefined variable: ${name}`);
        }

        set_variable_func = (name, func) => {
            if (this.variableGetters && this.variableGetters.has(name)) {
                throw new Error(`${name} is reserved for a global value.  It cannot be edited.`);
            }

            const variables = this.variables;

            for (let i = variables.length - 1; i >= 0; i--) {
                const scope = variables[i];
                if (scope.has(name)) {
                    const val = func();
                    scope.set(name, val);
                    if (GrammarForge.debuggingFunctions) {
                        console.log(`${name} = ${val}`);
                    }

                    return;
                }
            }

            throw new Error(`Tried to set undefined variable: ${name}`);
        }

        try_declare_then_set_variable = (name, val) => {
            if (this.variableGetters && this.variableGetters.has(name)) {
                throw new Error(`${name} is reserved for a global value.  It cannot be edited.`);
            }

            const variables = this.variables;

            let found = false;
            for (let i = variables.length - 1; i >= 0; i--) {
                const scope = variables[i];
                if (scope.has(name)) {
                    found = true;
                    scope.set(name, val);
                }
            }

            if (!found) {
                variables[variables.length - 1].set(name, val);
            }

            if (GrammarForge.debuggingFunctions) {
                console.log(`${name} = ${val}`);
            }
        }

        try_declare_then_set_variable_func = (name, func) => {
            if (this.variableGetters && this.variableGetters.has(name)) {
                throw new Error(`${name} is reserved for a global value.  It cannot be edited.`);
            }

            const variables = this.variables;

            let found = false;
            for (let i = variables.length - 1; i >= 0; i--) {
                const scope = variables[i];
                if (scope.has(name)) {
                    found = true;
                    const val = func();
                    scope.set(name, val);
                }
            }

            if (!found) {
                const val = func();
                variables[variables.length - 1].set(name, val);
            }

            if (GrammarForge.debuggingFunctions) {
                const val = func();
                console.log(`${name} = ${val}`);
            }
        }

        get_variable = (name) => {
            if (this.variableGetters && this.variableGetters.has(name)) {
                return this.variableGetters.get(name)();
            }

            const variables = this.variables;
            for (let i = variables.length - 1; i >= 0; i--) {
                const scope = variables[i];
                if (scope.has(name)) {
                    return scope.get(name);
                }
            }

            throw new Error(`Tried to access undefined variable: ${name}`);
        }

        ev = (resultObj) => {
            if (Array.isArray(resultObj)) {
                if (resultObj.length === 1)
                    return this.ev(resultObj[0]);
                
                const res = [];
                for (let i = 0; i < resultObj.length; i++) {
                    res.push(this.ev(resultObj[i]));
                }

                return res;
            }
            else if (typeof resultObj === 'function') {
                return this.ev(resultObj());
            }
            else {
                return resultObj;
            }
        }

        makeDefaultExecFunctions = () => {
            const execution = this;
            const declare_variable_func = (...args) => execution.declare_variable_func(...args);
            const declare_variable_default_value = (...args) => execution.declare_variable_default_value(...args);
            const set_variable = (...args) => execution.set_variable(...args);
            const get_variable = (...args) => execution.get_variable(...args);
            const set_variable_func = (...args) => execution.set_variable_func(...args);
            const try_declare_then_set_variable_func = (...args) => execution.try_declare_then_set_variable_func(...args);
            this.defaultExecFunctions = new Map([
                ['sl', (stmt_list) => {
                    for (const stmt of stmt_list) {
                        const result = execution.ev(stmt);//Check if works as just const result = stmt();
                        if (result.type !== GrammarForge.FlowControlID.NORMAL)
                            return result;
                    }

                    return GrammarForge.NORMAL_CONTROL;
                }],
                ['exp only', (exp) => {
                    exp();

                    return GrammarForge.NORMAL_CONTROL;
                }],
                ['while', (exp, stmt) => {
                    if (GrammarForge.debuggingFunctions) {
                        console.log(`while start`);
                    }
                    
                    while (exp()) {
                        const result = execution.ev(stmt);
                        let breakWhile = false;
                        switch (result.type) {
                            case GrammarForge.FlowControlID.BREAK:
                                breakWhile = true;
                                break;
                            case GrammarForge.FlowControlID.CONTINUE:
                                continue;
                            case GrammarForge.FlowControlID.NORMAL:
                                break;
                            default:
                                return result;
                        }

                        if (breakWhile)
                            break;
                    }

                    
                    if (GrammarForge.debuggingFunctions) {
                        console.log(`while end`);
                    }

                    return GrammarForge.NORMAL_CONTROL;
                }],
                ['foreach', (var_, exp, stmt) => {
                    if (GrammarForge.debuggingFunctions) {
                        console.log(`foreach start`);
                    }

                    const iterable = exp();
                    if (!iterable || typeof iterable[Symbol.iterator] !== 'function') {
                        throw new Error(`Foreach expression did not return an iterable.`);
                    }

                    execution.push_block_scope();
                    const variableName = var_();
                    declare_variable_default_value(variableName);
                    for (const item of iterable) {
                        set_variable(variableName, item);
                        const result = execution.ev(stmt);
                        let breakForeach = false;
                        switch (result.type) {
                            case GrammarForge.FlowControlID.BREAK:
                                breakForeach = true;
                                break;
                            case GrammarForge.FlowControlID.CONTINUE:
                                continue;
                            case GrammarForge.FlowControlID.NORMAL:
                                break;
                            default:
                                return result;
                        }

                        if (breakForeach)
                            break;
                    }

                    execution.pop_block_scope();
                    
                    if (GrammarForge.debuggingFunctions) {
                        console.log(`foreach end`);
                    }

                    return GrammarForge.NORMAL_CONTROL;
                }],
                ['declare', (var_, exp) => {
                    const v = var_();
                    declare_variable_func(v, exp);

                    return GrammarForge.NORMAL_CONTROL;
                }],
                ['declare no_value', (var_) => {
                    const v = var_();
                    declare_variable_default_value(v);

                    return GrammarForge.NORMAL_CONTROL;
                }],
                ['assign', (var_, exp) => {
                    const v = var_();

                    set_variable_func(v, exp);

                    return GrammarForge.NORMAL_CONTROL;
                }],
                ['assign no_declare', (var_, exp) => {//Used if {assign no_declare} tag is set
                    const v = var_();
                    
                    try_declare_then_set_variable_func(v, exp);

                    return GrammarForge.NORMAL_CONTROL;
                }],
                ['get', (var_) => get_variable(var_())],
                ['block', (stmt_list) => {
                    if (GrammarForge.debuggingFunctions) {
                        console.log(`block start`);
                    }

                    execution.push_block_scope();
                    const result = execution.ev(stmt_list);
                    execution.pop_block_scope();

                    if (GrammarForge.debuggingFunctions) {
                        console.log(`block end`);
                    }
                    
                    return result;
                }],
                ['par', (exp) => {
                    return exp();
                }],
                ['break', () => {
                    if (GrammarForge.debuggingFunctions) {
                        console.log(`BREAK`);
                    }

                    return GrammarForge.BREAK_CONTROL;
                }],
                ['continue', () => {
                    if (GrammarForge.debuggingFunctions) {
                        console.log(`CONTINUE`);
                    }

                    return GrammarForge.CONTINUE_CONTROL;
                }],
                ['if', (exp, stmt, else_stmt) => {
                    if (exp()) {
                        return execution.ev(stmt);
                    }
                    else {
                        if (else_stmt) {
                            const elseStmtResult = else_stmt();
                            return execution.ev(elseStmtResult);
                        }
                        else if (else_stmt !== null) {
                            throw new Error(`If else statement function must return null or a getter.`);
                        }
                    }

                    return GrammarForge.NORMAL_CONTROL;
                }],
                ['return', (exp) => {
                    const value = exp();
                    return new GrammarForge.ReturnControl(value);
                }],
                ['return optional', (exp) => {
                    if (exp === null)
                        return GrammarForge.RETURN_NO_VALUE_CONTROL;

                    if (exp.length > 1)
                        throw new Error(`Return optional node must have at most one child.`);

                    const value = exp[0]();
                    return new GrammarForge.ReturnControl(value);
                }],
                ['func_declare', (var_, optional, block) => {
                    const variables = execution.variables;
                    const v = var_();

                    for (let i = variables.length - 1; i >= 0; i--) {
                        const scope = variables[i];
                        if (scope.has(v))
                            throw new Error(`Variable ${v} is already declared.  Variable shadowing/re-declaration is not allowed.`);
                    }

                    const parameters = [];
                    if (optional !== null) {
                        //TODO: This assumes a structure of (first, (COMMA, exp)*)
                        //Should make it more generic.  Probably generating a collecting function 
                        // and passing it as an arguemnt to this function.
                        const [first, rest] = optional;
                        const firstParam = first();
                        parameters.push(firstParam);
                        parameters.push(...rest.map(([_, exp]) => exp()));
                    }

                    const val = new GrammarForge.FunctionDeclaration(
                        v,
                        parameters,
                        block,
                        execution
                    );

                    variables[variables.length - 1].set(v, val);
                    if (GrammarForge.debuggingFunctions) {
                        console.log(`let ${v} = ${val}`);
                    }

                    return GrammarForge.NORMAL_CONTROL;
                }],
                ['func_call', (var_, optional) => {
                    const v = var_();
                    const func = execution.get_variable(v);
                    if (!(func instanceof GrammarForge.FunctionDeclaration))
                        throw new Error(`Tried to call vairable as a function, but it is not a function: ${v}, type: ${type}, value: ${func}`);

                    let result;
                    if (optional === null) {
                        result = func.call([]);//no arguments
                    }
                    else {
                        //TODO: This assumes a structure of (first, (COMMA, exp)*)
                        //Should make it more generic.  Probably generating a collecting function 
                        // and passing it as an arguemnt to this function.
                        const [first, rest] = optional;
                        const firstArg = first();
                        const args = [firstArg, ...rest.map(([_, exp]) => exp())];
                        result = func.call(args);
                    }

                    if (result instanceof GrammarForge.ReturnControl) {
                        return result.value;
                    }
                    else if (result instanceof GrammarForge.ReturnNoValueControl || result instanceof GrammarForge.NormalControl) {
                        return null;
                    }

                    throw new Error(`Function ${v} did not return a value properly.`);
                }],
            ]);

            this.opFunctions = [
                new Map([
                    ['||', (left, right) => left || right],
                ]),
                new Map([
                    ['&&', (left, right) => left && right],
                ]),
                new Map([
                    ['==', (left, right) => left === right],
                    ['!=', (left, right) => left !== right],
                    ['<', (left, right) => left < right],
                    ['<=', (left, right) => left <= right],
                    ['>', (left, right) => left > right],
                    ['>=', (left, right) => left >= right],
                ]),
                new Map([
                    ['+', (left, right) => left + right],
                    ['-', (left, right) => left - right],
                ]),
                new Map([
                    ['*', (left, right) => left * right],
                    ['/', (left, right) => left / right],
                    ['%', (left, right) => left % right],
                ]),
                new Map([
                    ['!', (value) => !value],
                    ['-', (value) => -value],
                    ['+', (value) => +value],
                ]),
                new Map([
                    ['^', (base, exponent) => base ** exponent],
                ]),
            ];

            Object.freeze(this.defaultExecFunctions);
        }

        makeOperatorTokenTagMap = () => {
            this.operatorTokenTagMap = [];//array of maps <token, tag>
            for (let i = 0; i < 8; i++) {
                this.operatorTokenTagMap.push(new Map());
            }
            
            for (const [ key, ruleExprArr ] of this.metaExpressionLookup) {
                if (!GrammarForge.Expression.operatorTags.has(key))
                    continue;

                for (const [ rule, expression ] of ruleExprArr) {
                    const tag = expression.tag;
                    if (tag === null)
                        return;

                    if (tag !== key)
                        throw new Error(`Mismatched operator tag.  Expected: ${key}, found: ${tag} in expression: ${expression.expressionString} in rule: ${rule.name}`);

                    if (expression.words.length !== 1)
                        throw new Error(`Expression tagged as ${tag} must contain exactly one operator token.  Expression: ${expression.expressionString} in rule: ${this.name}`);

                    const word = expression.words[0];
                    if (!(word instanceof GrammarForge.Term))
                        throw new Error(`Expression tagged as ${tag} must contain exactly one operator token.  Expression: ${expression.expressionString} in rule: ${this.name}`);

                    if (word.type !== 'TOKEN' && word.type !== 'SYMBOL' && word.type !== 'PLUS' && word.type !== 'STAR')
                        throw new Error(`Expression tagged as ${tag} must contain exactly one operator token.  Expression: ${expression.expressionString} in rule: ${this.name}`);

                    if (!GrammarForge.Expression.operatorTagPrecedence.has(tag))
                        throw new Error(`Missing operator tag precedence for tag: ${tag}`);

                    const precedence = GrammarForge.Expression.operatorTagPrecedence.get(tag);
                    const tagMap = this.operatorTokenTagMap[precedence];
                    if (tagMap.has(word.value))
                        throw new Error(`Duplicate operator token for tag ${tag}: ${word.value}`);

                    tagMap.set(word.value, tag);
                }
            }

            Object.freeze(this.operatorTokenTagMap);
        }
    }
}