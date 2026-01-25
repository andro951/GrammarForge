"use strict";

GrammarForge.FunctionDeclaration = class FunctionDeclaration {
    constructor(name, parameters, body, exec) {
        if (!name)
            throw new Error("name is required");

        this.name = name;
        if (!Array.isArray(parameters))
            throw new Error("parameters must be an array");

        this.parameters = parameters;

        if (typeof body !== 'function')
            throw new Error("body must be a function");

        this.body = body;

        const scope = exec.variables;
        if (!Array.isArray(scope))
            throw new Error("scope must be an array");

        this.scope = [...scope]

        if (!exec)
            throw new Error("exec is required");

        if (!(exec instanceof GrammarForge.Exec))
            throw new Error("exec must be an instance of GrammarForge.Exec");

        this.exec = exec;
    }

    call(args) {
        const exec = this.exec;
        if (args.length !== this.parameters.length)
            throw new Error("Argument count mismatch");

        const savedScope = exec.variables;
        exec.variables = [...this.scope];
        exec.push_block_scope();
        for (let i = 0; i < this.parameters.length; i++) {
            const paramName = this.parameters[i];
            const argValue = args[i];
            exec.declare_variable(paramName, argValue);
        }

        const result = exec.ev(this.body);
        
        exec.pop_block_scope();

        exec.variables = savedScope;

        return result;
    }
}