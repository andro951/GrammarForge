"use strict";

ScriptForge.ScriptAction = class ScriptAction {
    constructor(name, action, canCallAction, description, parameters = null) {
        this.name = name;
        this.action = action;
        this.canCallAction = canCallAction;
        this.description = description;
        this.parameters = parameters;
        if (parameters != null) {
            for (let parameter of parameters) {
                if (!(parameter instanceof ScriptForge.ScriptActionParameter)) {
                    throw new Error(`Error when trying to create ScriptAction ${name}: All parameters must be instances of ScriptActionParameter. Invalid parameter: ${parameter}`);
                }
            }
        }
    }
    run = (...args) => {
        if (!this.canCallAction())
            return;
        
        if (this.parameters != null) {
            if (args.length != this.parameters.length) {
                throw new Error(`Error when trying to call ${this.name}: Expected ${this.parameters.length} arguments, but got ${args.length}.  arguments: ${args}`);
            }
        }

        this.action(args);
    }
}

ScriptForge.ScriptActionParameter = class ScriptActionParameter {
    constructor(name, description, optional = false) {
        this.name = name;
        this.description = description;
        this.optional = optional;
    }

    toString = () => {
        return `${this.name}${this.optional ? " (optional)" : ""}: ${this.description}`;
    }
}