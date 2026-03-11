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
    constructor(grammarForge, { onErrorInScriptFunction = null, onErrorDuringActionFunction = null, onParseScriptErrorFunction = null, disableTryCatch = false }) {
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
        this.disableTryCatch = disableTryCatch;
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
    }

    defineScriptAction = (...args) => {
        const scriptAction = new ScriptForge.ScriptAction(...args);
        this.addScriptAction(scriptAction);
    }
    defineTrigger = (name, description, parameters) => {
        const trigger = new ScriptForge.ScriptTrigger(name, description, parameters, this);
        if (this.triggers.has(name)) {
            throw new Error(`Trigger with name ${name} already exists`);
        }

        this.triggers.set(name, trigger);
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
    manuallyRunScript = (script) => {
        if (!script.enabled)
            return;
        
        this.scriptCallStack.push(script);

        const tryFunc = () => {
            this.gf.exec(script.ast, null, this.allGettersFunctions);
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
                    this.onErrorInScriptFunction(e, null, null, script);
                
                script.enabled = false;
                script.error = e.toString();
            }
        }

        this.scriptCallStack.pop();
    }
}