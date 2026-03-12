"use strict";

ScriptForge.ScriptParameter = class ScriptParameter {
    constructor(internalName, scriptName, description) {
        this.internalName = internalName;
        this.scriptName = scriptName;
        this.description = description;
    }
}

ScriptForge.ScriptTrigger = class ScriptTrigger {
    constructor(name, description, parameters, disallowedActions, scriptForge) {
        this.name = name;
        if (typeof name !== 'string')
            throw new Error('Trigger name must be a string');
            
        this.description = description;
        if (typeof description !== 'string')
            throw new Error('Trigger description must be a string');

        this.parameters = parameters;
        if (!Array.isArray(parameters) || !parameters.every(p => p instanceof ScriptForge.ScriptParameter))
            throw new Error('Trigger parameters must be an array of ScriptParameter instances');

        if (disallowedActions === null)
            disallowedActions = new Set();

        this.disallowedActions = disallowedActions;
        if (!(disallowedActions instanceof Set))
            throw new Error('Trigger disallowedActions must be a Set or null.');

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
        
        const argsMap = new Map();

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
                    argsMap.set(key, value);
                }
                else {
                    const clonedValue = value.clone;
                    if (clonedValue === undefined)
                        throw new Error(`Value for key ${key} must be a simple type or have a clone getter`);

                    if (clonedValue === value)
                        throw new Error(`Value for key ${key} clone getter must return a different instance`);

                    argsMap.set(key, clonedValue);
                }
            }
        }
        
        for (const [key, script] of this.registeredScripts) {
            this.scriptForge._runScript(script, this.name, this, args, argsMap);
        }
    }
}