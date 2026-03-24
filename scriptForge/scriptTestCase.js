"use strict";

ScriptForge.ScriptTestCase = class ScriptTestCase {
    constructor(programStr, expected, variables = null, variableGetters = null) {
        this.programStr = programStr;
        this.expected = expected;
        this.variables = variables;
        this.variableGetters = variableGetters;
    }
    static fromArray = (arr) => {
        const [programStr, expected, variables = null, variableGetters = null] = arr;
        return new ScriptTestCase(programStr, expected, variables, variableGetters);
    }
    test = (scriptName, sf) => {
        const gf = sf.gf;
        if (gf.execution.logAllTests) {
            console.log(`Testing program:\n${this.programStr}`);
        }

        const script = new ScriptForge.Script(scriptName, this.programStr, sf);
        ScriptTestCase.testAst(sf, script, this.expected, this.variables, this.variableGetters, this.programStr);
    }
    static testAst = (sf, script, expected, variables, variableGetters, programStr) => {
        const gf = sf.gf;
        gf.execution.testResults.length = 0;

        if (gf.execution.logAllTests) {
            const arrToString = Array.prototype.toString;
            let indentCount = 0;
            Array.prototype.toString = function() {
                if (!this)
                    return '[]';

                indentCount++;
                const childIndent = ' '.repeat(indentCount);
                const innerStr = this.map(x => `${childIndent}${x}`).join(',\n');
                indentCount--;
                return `Array: [\n${innerStr}\n${' '.repeat(indentCount)}]`;
            }

            // const downloadString = (text) => {
            //     const blob = new Blob([text], { type: "text/plain" });
            //     const a = document.createElement("a");
            //     a.href = URL.createObjectURL(blob);
            //     a.download = "log.txt";
            //     a.click();
            // }

            const astText = `${script.ast}`;
            Array.prototype.toString = arrToString;
            console.log(astText);
            //downloadString(astText);
        }
        
        if (variableGetters === null)
            variableGetters = sf.allGettersFunctions;
        
        ZonScript.gf.exec(script.ast, variables, variableGetters);
        if (gf.execution.logAllTests) {
            console.log(`Expected results: ${expected}`);
            console.log(`Actual results:   ${gf.execution.testResults}`);
        }

        if (gf.execution.testResults.length !== expected.length) {
            if (!gf.execution.logAllTests) {
                console.log(programStr);
            }

            console.error(`Test failed. Expected ${expected.length} results, got ${gf.execution.testResults.length}`);
            console.error(`Expected: ${expected}`);
            console.error(`Got: ${gf.execution.testResults}`);
        }
        else {
            let printedFirst = false;
            for (let i = 0; i < expected.length; i++) {
                const result = gf.execution.testResults[i];
                if (result != expected[i]) {
                    if (!printedFirst) {
                        printedFirst = true;
                        if (!gf.execution.logAllTests) {
                            console.log(programStr);
                        }
                    }
                    
                    console.error(`Test failed at result ${i}. Expected: ${expected[i]}, got: ${result}`);
                    break;
                }
            }
        }

        gf.execution.testResults.length = 0;
    }
}