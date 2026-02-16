"use strict";

ScriptForge.ScriptDataGetter = class ScriptDataGetter {
    constructor(name, description, getter) {
        this.name = name;
        this.description = description;
        this.getter = getter;
    }
    getData = () => {
        return this.getter();
    }
}