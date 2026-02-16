"use strict";

ScriptForge.ScriptAction = class ScriptAction {
    constructor(name, action, canCallAction, description, parameters = null) {
        this.name = name;
        this.action = action;
        this.canCallAction = canCallAction;
        this.description = description;
        this.parameters = parameters;
    }
//TODO: needs to have a way to validate the inputs before running the action.
//Have a condition to say if the action is currently allowed to be run.
//Then change to tryRun with an output of why it didn't work like an enum
    run = (...args) => {
        if (!this.canCallAction())
            return;
        
        this.action(...args);
    }
}