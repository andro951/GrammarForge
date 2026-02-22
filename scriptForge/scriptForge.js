"use strict";

const ScriptForge = class ScriptForge {
    constructor(grammarForge) {
        this.gf = grammarForge;
        this.scriptActions = new Map();
        this.registeredScripts = [];
        this.allGetters = new Map();
        this.allGettersFunctions = new Map();
        this.triggers = new Map();
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

        return action.run(args);
    }
    scriptActionAvailable = (name) => {
        const action = this.scriptActions.get(name);
        if (!action) {
            throw new Error(`No script action found with name ${name}`);
        }

        return action.canCallAction();
    }
    registerScript = (scriptText) => {
        const script = new ScriptForge.Script(scriptText);
        for (const existingScript of this.registeredScripts) {
            if (existingScript.scriptText === script.scriptText) {
                throw new Error(`This script is already registered: ${existingScript.title !== null ? existingScript.title : existingScript.scriptText}.`);
            }

            if (existingScript.title === script.title) {
                if (existingScript.description === script.description)
                    throw new Error(`A script with the title "${script.title}" and the same description is already registered.`);
            }
        }

        this.registeredScripts.push(script);
        return script;
    }
    defineGetter = (name, description, getter) => {
        const dataGetter = new ScriptForge.ScriptDataGetter(name, description, getter);
        this.allGetters.set(name, dataGetter);
        this.allGettersFunctions.set(name, getter);
    }
    registerAllScriptTriggers = () => {
        for (const script of this.registeredScripts) {
            for (const triggerName of script.triggers) {
                const trigger = this.triggers.get(triggerName);
                if (!trigger)
                    console.warn(`"${triggerName}" is not a valid trigger name.  Found in script:\n${script.scriptText}\n`);

                trigger.registerScript(script);
            }
        }
    }
}