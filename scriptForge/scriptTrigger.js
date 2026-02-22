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
    run = () => {
        for (const script of this.registeredScripts) {
            //TODO: possibly pass the static variables in instead of null, then update after?
            ZonScript.gf.exec(script.ast, null, this.scriptForge.allGettersFunctions);
        }
    }
}