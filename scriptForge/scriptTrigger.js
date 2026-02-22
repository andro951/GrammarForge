"use strict";

ScriptForge.ScriptTrigger = class ScriptTrigger {
    constructor(name, description, scriptForge) {
        this.name = name;
        this.description = description;
        this.registeredScripts = [];
        this.scriptForge = scriptForge;
    }
    registerScript = (script) => {
        this.registeredScripts.push(script);
    }
    static argsMap = new Map();
    static isSimpleType = (value) => {
        return (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean');
    }
    run = (args = null) => {
        argsMap.clear();

        if (args !== null) {
            if (typeof args !== 'function')
                throw new Error('args must be a function that returns a map or null');

            const argsResult = args();
            if (!(argsResult instanceof Map))
                throw new Error('args function must return a map or null');

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
        
        for (const script of this.registeredScripts) {
            this.scriptForge.gf.exec(script.ast, argsMap, this.scriptForge.allGettersFunctions);
        }
    }
}