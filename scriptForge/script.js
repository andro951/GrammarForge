"use strict";

ScriptForge.Script = class Script {
    constructor(key, scriptText, scriptForge) {
        this.key = key;
        this.scriptText = scriptText;
        this.sf = scriptForge;
        this._enabled = true;
        this.error = null;
        this.manuallyTriggered = false;
        this.ast = null;
        this.triggers = [];
        this.maxExecutionTime = ScriptForge.Script.defaultMaxExecutionTime;

        const tryFunc = () => {
            const scriptText = this.scriptText;
            const fullAST = this.sf.gf.parse(scriptText);
            this.fullAST = fullAST ?? null;
        }

        if (this.sf.disableTryCatch) {
            tryFunc();
            this.extractScriptFromText();
        }
        else {
            let successfullyParsed = false;
            try {
                tryFunc();
                successfullyParsed = true;
            }
            catch (e) {
                this._enabled = false;
                this.error = e.toString();
            }

            if (successfullyParsed) {
                try {
                    this.extractScriptFromText();
                }
                catch (e) {
                    this._enabled = false;
                    this.error = e.toString();
                }
            }
            else {
                if (this.fullAST === undefined) {
                    this.fullAST = this.sf.gf.parser.partialAstBeingParsed;
                    try {
                        this.extractScriptFromText();
                    }
                    catch {
                        
                    }
                }
            }
        }
    }
    static manualTriggerName = "Manual";
    static defaultMaxExecutionTime = 10;//In milliseconds, 1/100th of a second
    static maxMaxExecutionTime = 10000;//10 seconds, scripts that try to set MaxExecutionTime higher than this will throw an error, as that could cause significant lag.
    get enabled() {
        return this._enabled && !this.error;
    }
    set enabled(value) {
        this._enabled = value;
    }
    extractScriptFromText = () => {
        const fullAST = this.fullAST;
        if (!fullAST)
            throw new Error(`Script did not parse correctly:\n${this.scriptText}.`);

        if (!(fullAST instanceof GrammarForge.AstNode))
            throw new Error(`Script did not parse to an AstNode: ${this.key}.`);

        if (fullAST.nodes.length !== 2)
            throw new Error(`Script did not parse correctly: ${this.key}.`);

        const [ metaDataNode, astNode ] = fullAST.nodes;
        if (!Array.isArray(metaDataNode)) {
            if (metaDataNode.empty)
                throw new Error(`Script is a MetaData section: ${this.key}. Every script must have at least a Triggers section defined in the MetaData.`);

            throw new Error(`MetaData did not parse correctly: ${this.key}.`);
        }
        
        const [ metaDataList, metaEndNode ] = metaDataNode;
        if (!Array.isArray(metaDataList))
            throw new Error(`Script MetaData did not parse to a list of MetaData entries: ${this.key}.`);

        if (!(metaEndNode instanceof GrammarForge.AstNode) || metaEndNode.type !== 'META_END')
            throw new Error(`Meta end marker (3 or more '-'s between the metadata and the script code) did not parse to an AstNode: ${this.key}.`);

        if (metaEndNode.empty)
            throw new Error(`Script is missing meta end marker (3 or more '-'s between the metadata and the script code): ${this.key}.`);

        const foundArr = new Array(ScriptForge.Script.metaLabels.length).fill(null);
        let unrecognizedMetaDataLabels = [];

        for (const metaDataTokenNode of metaDataList) {
            if (!(metaDataTokenNode instanceof GrammarForge.TokenNode) || metaDataTokenNode.type !== 'META_DATA')
                throw new Error(`Script MetaData did not parse to a META_DATA token: ${this.key}.`);

            const match = metaDataTokenNode.value.match(ScriptForge.Script.metaDataRegex);
            if (!match)
                throw new Error(`MetaData line did not match expected format: ${metaDataTokenNode.value}`);

            if (match.index !== 0)
                throw new Error(`MetaData line did not match expected format at index 0: ${metaDataTokenNode.value}`);

            const label = match[1].toLowerCase();
            const content = match[2];
            const labelIndex = ScriptForge.Script.metaLabelLookup.get(label);
            if (labelIndex !== undefined) {
                if (foundArr[labelIndex] !== null)
                    throw new Error(`Duplicate MetaData label: ${match[1]}. Each MetaData label can only be used once.`);

                foundArr[labelIndex] = content;
            }
            else {
                unrecognizedMetaDataLabels.push(match[1]);
            }
        }
        
        const [scriptTitle, scriptDescription, scriptAuthor, scriptVersion, triggers, maxExecutionTime] = foundArr;

        this.title = scriptTitle;
        this.description = scriptDescription;
        this.author = scriptAuthor;
        this.version = scriptVersion;
        if (maxExecutionTime) {
            const maxExecutionTimeFloat = parseFloat(maxExecutionTime);
            if (isNaN(maxExecutionTimeFloat) || maxExecutionTimeFloat <= 0)
                throw new Error(`Invalid MaxExecutionTime: ${maxExecutionTimeFloat}. MaxExecutionTime is the amount of time (in milliiseconds) that the script is allowed to run.  If a script takes longer than it's MaxExecutionTime to run, it will be automatically disabled.  Increasing this past the default value of ${ScriptForge.Script.defaultMaxExecutionTime} could cause lag.  MaxExecutionTime must be a positive number less than ${ScriptForge.Script.maxMaxExecutionTime} (${ScriptForge.Script.maxMaxExecutionTime * 0.001} seconds).`);

            this.maxExecutionTime = maxExecutionTimeFloat;
        }

        if (!triggers)
            throw new Error(`Script is missing required Triggers meta data.`);

        this.triggers = triggers.split(/[,\s]+/).filter(Boolean);//Split by comma/whitespace and ignore empty entries
        if (this.triggers.length === 0)
            throw new Error(`Script has no triggers defined.`);

        if (this.triggers.includes(ScriptForge.Script.manualTriggerName)) {
            if (this.triggers.length !== 1)
                throw new Error(`Script uses the ${ScriptForge.Script.manualTriggerName} trigger. No other triggers are allowed when this trigger is used.`);

            this.manuallyTriggered = true;
        }
        
        if (!(astNode instanceof GrammarForge.AstNode))
            throw new Error(`Script did not parse to a valid AST node: ${this.key}.`);

        this.ast = astNode;

        if (astNode.empty)
            throw new Error(`Script has no code to execute: ${this.key}.`);

        if (unrecognizedMetaDataLabels.length > 0) {
            const error = new ScriptForge.BadMetaDataLabelError(`Unknown MetaData label${unrecognizedMetaDataLabels.length > 1 ? 's' : ''}: ${unrecognizedMetaDataLabels.join(', ')}.  The only valid MetaData labels are: ${ScriptForge.Script.metaLabels.join(', ')}.`);
            if (this.sf.onParseScriptErrorFunction)
                this.sf.onParseScriptErrorFunction(error, this);
        }
    }
}

ScriptForge.Script.metaLabels = ["Title", "Description", "Author", "Version", "Triggers", "MaxExecutionTime"];
ScriptForge.Script.metaDescriptions = [
    "The title of the script. (optional)",
    "A description of the script. (optional)",
    "The author of the script. (optional)",
    "The version of the script. (optional)",
    `A comma or whitespace separated list of triggers that will cause the script to run. (required)`,
    `The maximum amount of time (in milliseconds) that the script is allowed to run before it is automatically disabled. (optional, default is ${ScriptForge.Script.defaultMaxExecutionTime}ms)`
];

ScriptForge.Script.metaLabelLookup = new Map();
for (let i = 0; i < ScriptForge.Script.metaLabels.length; i++) {
    const label = ScriptForge.Script.metaLabels[i].toLowerCase();
    ScriptForge.Script.metaLabelLookup.set(label, i);
}

ScriptForge.Script.metaDataRegex = /([A-Za-z]+)\s*:\s*([\s\S]*?)(?=\s*[A-Za-z]+\s*:|\s*-{3,}|$)/;//Same as META_DATA REGEX in ZonScript grammar