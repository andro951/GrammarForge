"use strict";

ScriptForge.ScriptAction = class ScriptAction {
    constructor(name, action, canCallAction, description, parameters = null, canCallParameterCount = null) {
        this.name = name;
        this.action = action;
        this.canCallAction = canCallAction;
        this.description = description;
        this.parameters = parameters;
        if (this.parameters !== null && canCallParameterCount === null || this.parameters === null && canCallParameterCount !== null)
            throw new Error(`Error when trying to create ScriptAction ${name}: If parameters is provided, canCallParameterCount must also be provided, and vice versa.`);
        
        this.canCallParameterCount = canCallParameterCount;
        this.scriptForge = null;//Set when registered to ScriptForge
        let foundOptional = false;
        if (parameters != null) {
            for (let parameter of parameters) {
                if (!(parameter instanceof ScriptForge.ScriptActionParameter)) {
                    throw new Error(`Error when trying to create ScriptAction ${name}: All parameters must be instances of ScriptActionParameter. Invalid parameter: ${parameter}`);
                }

                if (parameter.optional) {
                    foundOptional = true;
                }
                else if (foundOptional) {
                    throw new Error(`Error when trying to create ScriptAction ${name}: Required parameters cannot come after optional parameters.  Invalid parameter: ${parameter}`);
                }
            }
        }
    }
    static {
        this.ScriptActionError = class ScriptActionError extends Error {
            constructor(message) {
                super(message);
                this.name = "ScriptActionError";
            }
        }
        this.ScriptActionInvalidArgumentsError = class ScriptActionInvalidArgumentsError extends this.ScriptActionError {
            constructor(message) {
                super(message);
                this.name = "ScriptActionInvalidArgumentsError";
            }
        }
    }
    get requiredArgsCount() {
        if (this.parameters == null)
            return 0;

        let count = 0;
        for (let parameter of this.parameters) {
            if (parameter.optional)
                break;
            
            count++;
        }

        return count;
    }
    get requiredCanUseArgsCount() {
        if (this.parameters == null)
            return 0;

        let count = 0;
        for (let i = 0; i < this.canCallParameterCount; i++) {
            if (this.parameters[i].optional)
                break;

            count++;
        }

        return count;
    }
    run = (args) => {
        const tryFunc = () => {
            if (this.parameters != null) {
                const requiredArgsCount = this.requiredArgsCount;
                if (args.length > this.parameters.length || args.length < requiredArgsCount) {
                    throw new ScriptForge.ScriptAction.ScriptActionInvalidArgumentsError(`Error when trying to call ${this.name}: Expected ${this.parameters.length != requiredArgsCount ? `${requiredArgsCount} to ${this.parameters.length}` : this.parameters.length} arguments, but got ${args.length}.  arguments: ${args}`);
                }
            }

            if (!this.canCallAction(args))
                return;

            this.action(args);
        };

        if (this.scriptForge.disableTryCatch) {
            tryFunc();
        }
        else {
            try {
                tryFunc();
            } catch (e) {
                const resume = this.scriptForge.onErrorDuringActionFunction ? this.scriptForge.onErrorDuringActionFunction(e, this, args, this.scriptForge.executingScript(), false) : false;
                if (!resume)
                    throw e;
            }
        }
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