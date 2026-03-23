"use strict";

const ScriptForge = class ScriptForge {
    //onErrorInScriptFunction:
    //  Parameters: (error, trigger, arguments, script)
    //  Called when there is an error when running a script.
    //  Errors will automatically disable the script.
    
    //onErrorDuringActionFunction:
    //  Parameters: (error, action, arguments, script, isCheckingAvailability)
    //  Called when there is an error during execution of a script action.
    //  Return true if the error was handled.  Return false if the error was not handled, and the error should be thrown again to be caught by onErrorInScriptFunction.
    
    //onParseScriptErrorFunction:
    //  Parameters: (error, key, scriptText)
    //  Called when there is an error parsing a script.
    //  The script will not be registered if there is a parse error.
    constructor(grammarForge, { onErrorInScriptFunction = null, onErrorDuringActionFunction = null, onParseScriptErrorFunction = null, disableTryCatch = false, logExecutionTime = false } = {}) {
        if (!(grammarForge instanceof GrammarForge))
            throw new Error('grammarForge must be an instance of GrammarForge');
            
        this.gf = grammarForge;

        if (typeof onErrorInScriptFunction !== 'function' && onErrorInScriptFunction !== null)
            throw new Error('onErrorInScriptFunction must be a function or null');

        this.onErrorInScriptFunction = onErrorInScriptFunction;

        if (typeof onErrorDuringActionFunction !== 'function' && onErrorDuringActionFunction !== null)
            throw new Error('onErrorDuringActionFunction must be a function or null');

        this.onErrorDuringActionFunction = onErrorDuringActionFunction;

        if (typeof onParseScriptErrorFunction !== 'function' && onParseScriptErrorFunction !== null)
            throw new Error('onParseScriptErrorFunction must be a function or null');

        this.onParseScriptErrorFunction = onParseScriptErrorFunction;

        this.scriptActions = new Map();
        this.registeredScripts = new Map();
        this.allGetters = new Map();
        this.allGettersFunctions = new Map();
        this.triggers = new Map();
        this.scriptCallStack = [];
        this.triggeredScriptsOnStack = new Map();
        this.maxCallStackSize = 100;
        this.exceededMaxCallStackSize = false;
        this.disableTryCatch = disableTryCatch;
        this.logExecutionTime = logExecutionTime;
    }
    executingScript = () => {
        return this.scriptCallStack[this.scriptCallStack.length - 1];
    }
    addScriptAction = (scriptAction) => {
        if (!(scriptAction instanceof ScriptForge.ScriptAction)) {
            throw new Error('scriptAction must be an instance of ScriptAction');
        }

        //if already exists, throw error
        if (this.scriptActions.has(scriptAction.name)) {
            throw new Error(`Script action with name ${scriptAction.name} already exists`);
        }

        this.scriptActions.set(scriptAction.name, scriptAction);
        scriptAction.scriptForge = this;
        for (const trigger of this.triggers) {
            if (trigger.disallowedActions.has(scriptAction.name)) {
                scriptAction.isDisallowedByAtLeastOneTrigger = true;
                break;
            }
        }
    }

    defineScriptAction = (...args) => {
        const scriptAction = new ScriptForge.ScriptAction(...args);
        this.addScriptAction(scriptAction);
    }
    defineTrigger = (name, description, parameters, disallowedActions = null) => {
        const trigger = new ScriptForge.ScriptTrigger(name, description, parameters, disallowedActions, this);
        if (this.triggers.has(name)) {
            throw new Error(`Trigger with name ${name} already exists`);
        }

        this.triggers.set(name, trigger);
        for (const action of this.scriptActions) {
            if (action.isDisallowedByAtLeastOneTrigger)
                continue;

            if (trigger.disallowedActions.has(action.name))
                action.isDisallowedByAtLeastOneTrigger = true;
        }

        return trigger;
    }
    runScriptAction = (name, args) => {
        const action = this.scriptActions.get(name);
        if (!action) {
            throw new Error(`No script action found with name ${name}`);
        }

        action.run(args);
    }
    scriptActionAvailable = (name, args) => {
        const action = this.scriptActions.get(name);
        if (!action) {
            throw new Error(`No script action found with name ${name}`);
        }

        const tryFunc = () => {
            if (action.parameters != null) {
                const requiredArgsCount = action.requiredCanUseArgsCount;
                if (args.length != action.canCallParameterCount) {
                    throw new ScriptForge.ScriptAction.ScriptActionInvalidArgumentsError(`Error when trying to call ${action.name}?: Expected ${action.canCallParameterCount !== requiredArgsCount ? `${requiredArgsCount} to ${action.canCallParameterCount}` : action.canCallParameterCount} arguments, but got ${args.length}.  arguments: ${args}`);
                }
            }

            return action.canCallAction(args);
        }

        if (this.disableTryCatch) {
            return tryFunc();
        }
        else {
            try {
                return tryFunc();
            } catch (e) {
                const resume = this.onErrorDuringActionFunction ? this.onErrorDuringActionFunction(e, action, args, this.executingScript(), true) : false;
                if (!resume)
                    throw e;
            }
        }

        return false;
    }
    registerScriptFromText = (key, scriptText, registerWithTriggers = false) => {
        const script = new ScriptForge.Script(key, scriptText, this);
        return this.registerScript(script, registerWithTriggers);
    }
    registerScript = (script, registerWithTriggers = false) => {
        const key = script.key;
        if (this.registeredScripts.has(key)) {
            console.error(`A script with the key "${key}" is already registered.`);
            return null;
        }
        
        this.registeredScripts.set(key, script);
        if (script.enabled && registerWithTriggers)
            this.registerScriptWithItsTriggers(key, script);

        if (script.error && this.onParseScriptErrorFunction)
            this.onParseScriptErrorFunction(script.error, script);
        
        return script;
    }
    unregisterScript = (key) => {
        if (!this.registeredScripts.has(key)) {
            console.error(`No script found with the key "${key}".`);
            return;
        }

        const script = this.registeredScripts.get(key);
        for (const triggerName of script.triggers) {
            if (triggerName === ScriptForge.Script.manualTriggerName)
                continue;

            const trigger = this.triggers.get(triggerName);
            if (trigger)
                trigger.unregisterScript(key);
        }

        this.registeredScripts.delete(key);
    }
    defineGetter = (name, description, getter) => {
        const dataGetter = new ScriptForge.ScriptDataGetter(name, description, getter);
        this.allGetters.set(name, dataGetter);
        this.allGettersFunctions.set(name, getter);
    }
    static BadTriggerNameError = class BadTriggerNameError extends Error {
        constructor(message) {
            super(message);
            this.name = "BadTriggerNameError";
        }
    }
    static BadMetaDataLabelError = class BadMetaDataLabelError extends Error {
        constructor(message) {
            super(message);
            this.name = "BadMetaDataLabelError";
        }
    }
    registerScriptWithItsTriggers = (key, script) => {
        for (const triggerName of script.triggers) {
            if (triggerName === ScriptForge.Script.manualTriggerName)
                continue;

            const trigger = this.triggers.get(triggerName);
            if (!trigger) {
                if (this.onParseScriptErrorFunction) {
                    const error = new ScriptForge.BadTriggerNameError(`"${triggerName}" is not a valid trigger name.`);
                    error.badTriggerName = triggerName;
                    this.onParseScriptErrorFunction(error, script);
                }

                continue;
            }
            
            trigger.registerScript(key, script);
        }
    }
    registerAllScriptTriggers = () => {
        for (const [key, script] of this.registeredScripts) {
            this.registerScriptWithItsTriggers(key, script);
        }
    }
    _runScript = (script, triggerName, trigger, args, argsMap) => {
        if (!script.enabled)
            return;

        if (this.scriptCallStack.length >= this.maxCallStackSize) {
            this.exceededMaxCallStackSize = true;
        }

        if (this.exceededMaxCallStackSize) {
            //Prevent scripts from starting if max call stack size was exceeded.
            const error = new Error(`Maximum call stack size of ${this.maxCallStackSize} exceeded.  ${script.key} was not run.  All scripts on the call stack will be disabled.`);
            if (this.onErrorInScriptFunction)
                this.onErrorInScriptFunction(error, trigger, args, script);

            script._enabled = false;
            script.error = error.toString();

            //Stop the current script from running by throwing an error.
            if (this.scriptCallStack.length == this.maxCallStackSize)
                throw new Error(`Exceeded max call stack size.  Current call stack size: ${this.scriptCallStack.length}`);

            return;
        }

        if (this.triggeredScriptsOnStack.has(triggerName)) {
            const set = this.triggeredScriptsOnStack.get(triggerName);
            if (set.has(script)) {
                const error = new Error(`Script ${script.key} is already on the call stack for trigger ${triggerName}.  This is not allowed to prevent infinite loops.`);
                script._enabled = false;
                script.error = error.toString();
                return;
            }

            set.add(script);
        }
        else {
            this.triggeredScriptsOnStack.set(triggerName, new Set([script]));
        }

        this.scriptCallStack.push(script);

        const tryFunc = () => {
            const startTime = performance.now();
            this.gf.exec(script.ast, argsMap, this.allGettersFunctions);
            const endTime = performance.now();
            const executionTime = endTime - startTime;
            if (this.logExecutionTime) {
                console.log(`Script ${script.key} executed in ${executionTime}ms.`);
            }

            if (executionTime > script.maxExecutionTime)
                throw new Error(`Script ${script.key} took ${executionTime}ms to execute, which exceeds the maximum execution time of ${script.maxExecutionTime}ms. This can be increased by setting the MetaData tag, MaxExecutuinTime, but consider trying to make the script smaller or faster.`);
        }

        if (this.disableTryCatch) {
            tryFunc();
        }
        else {
            try {
                tryFunc();
            }
            catch (e) {
                if (this.onErrorInScriptFunction)
                    this.onErrorInScriptFunction(e, trigger, args, script);
                
                script.enabled = false;
                script.error = e.toString();
            }
        }

        this.scriptCallStack.pop();
        if (!this.triggeredScriptsOnStack.has(triggerName))
            throw new Error(`No scripts found in triggeredScriptsOnStack for "${triggerName}"`);

        const existingSet = this.triggeredScriptsOnStack.get(triggerName);
        existingSet.delete(script);
        if (existingSet.size === 0)
            this.triggeredScriptsOnStack.delete(triggerName);

        //If max call stack was exceeded, break all other scripts on the stack
        if (this.exceededMaxCallStackSize) {
            if (this.scriptCallStack.length === 0) {
                this.exceededMaxCallStackSize = false;
            }
            else {
                throw new Error(`Exceeded max call stack size.  Current call stack size: ${this.scriptCallStack.length}`);
            }
        }

        //If A script is called when it already exists on the stack, it will just set it's error, 
        // but it would still try to finish executing.  Instead, stop it by throwing an error.
        const nextScriptOnStack = this.executingScript();
        if (nextScriptOnStack && nextScriptOnStack.error !== null)
            throw new Error(nextScriptOnStack.error);
    }
    manuallyRunScript = (script) => {
        this._runScript(script, ScriptForge.Script.manualTriggerName, null, null, null);
    }
    runTests = (tests, testEnvironment) => {
        this.gf.execution.testMode = true;
        console.log(`Running ${tests.length} ${testEnvironment} tests...`);

        let testNameCounter = 1;
        for (const testCase of tests) {
            const testName = `Test${testNameCounter}`;
            testCase.test(testName, this);
            testNameCounter++;
        }

        console.log(`All ${testEnvironment} tests completed.`);
        this.gf.execution.testMode = false;
    }
}