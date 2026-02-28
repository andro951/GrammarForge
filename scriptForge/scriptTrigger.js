"use strict";

ScriptForge.ScriptParameter = class ScriptParameter {
    constructor(internalName, scriptName, description) {
        this.internalName = internalName;
        this.scriptName = scriptName;
        this.description = description;
    }
}

ScriptForge.ScriptTrigger = class ScriptTrigger {
    constructor(name, description, parameters, scriptForge) {
        this.name = name;
        //throw if name not string
        if (typeof name !== 'string')
            throw new Error('Trigger name must be a string');
            
        this.description = description;
        if (typeof description !== 'string')
            throw new Error('Trigger description must be a string');

        this.parameters = parameters;
        if (!Array.isArray(parameters) || !parameters.every(p => p instanceof ScriptForge.ScriptParameter))
            throw new Error('Trigger parameters must be an array of ScriptParameter instances');

        this.scriptForge = scriptForge;
        if (!(scriptForge instanceof ScriptForge))
            throw new Error('scriptForge must be an instance of ScriptForge');

        this.registeredScripts = new Map();
    }
    registerScript = (key, script) => {
        this.registeredScripts.set(key, script);
    }
    unregisterScript = (key) => {
        this.registeredScripts.delete(key);
    }
    static argsMap = new Map();
    static isSimpleType = (value) => {
        return (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean');
    }
    run = (args = null) => {
        if (this.registeredScripts.size === 0)
            return;

        let anyEnabled = false;
        for (const script of this.registeredScripts.values()) {
            if (script.enabled) {
                anyEnabled = true;
                break;
            }
        }

        if (!anyEnabled)
            return;
        
        ScriptForge.ScriptTrigger.argsMap.clear();

        if (args !== null) {
            if (typeof args !== 'function')
                throw new Error('args must be a function that returns a map or null');

            const argsResult = args();
            if (!(argsResult instanceof Map))
                throw new Error('args function must return a map or null');

            if (argsResult.size !== this.parameters.length)
                throw new Error(`Expected ${this.parameters.length} arguments but got ${argsResult.size}`);

            for (const [key, value] of argsResult.entries()) {
                if (value === null || value === undefined)
                    throw new Error(`Value for key ${key} cannot be null or undefined`);

                if (ScriptForge.ScriptTrigger.isSimpleType(value)) {
                    ScriptForge.ScriptTrigger.argsMap.set(key, value);
                }
                else {
                    const clonedValue = value.clone;
                    if (clonedValue === undefined)
                        throw new Error(`Value for key ${key} must be a simple type or have a clone getter`);

                    if (clonedValue === value)
                        throw new Error(`Value for key ${key} clone getter must return a different instance`);

                    ScriptForge.ScriptTrigger.argsMap.set(key, clonedValue);
                }
            }
        }
        
        for (const [key, script] of this.registeredScripts) {
            if (!script.enabled)
                continue;
            
            this.scriptForge.scriptCallStack.push(script);
            try {
                this.scriptForge.gf.exec(script.ast, ScriptForge.ScriptTrigger.argsMap, this.scriptForge.allGettersFunctions);
            }
            catch (e) {
                if (this.scriptForge.onErrorInScriptFunction)
                    this.scriptForge.onErrorInScriptFunction(e, this, args, script);
                
                script.enabled = false;
            }

            this.scriptForge.scriptCallStack.pop();
        }
    }
}