"use strict";

ScriptForge.Script = class Script {
    constructor(scriptText) {
        this.scriptText = scriptText;
        this.extractScriptFromText();
    }
    extractScriptFromText = () => {
        const scriptText = this.scriptText;
        const fullAST = ZonScript.gf.parse(scriptText);
        if (!fullAST)
            throw new Error(`Script did not parse correctly:\n${scriptText}.`);

        if (fullAST.length !== 2)
            throw new Error(`Script did not parse correctly for trigger ${this.name}.`);

        const [scriptNodeType, scriptNode] = fullAST;
        if (scriptNodeType !== 'script')
            throw new Error(`Script did not parse to a script node for trigger ${this.name}, got ${scriptNodeType} instead.`);

        const [expListNodeType, expListNode, scriptExpressionNode] = scriptNode;
        if (expListNodeType !== 'EXPLIST')
            throw new Error(`Script did not parse to a script node for trigger ${this.name}, got ${scriptNodeType} instead.`);

        const [expressionNodeType, expressionIndex, expressionString] = scriptExpressionNode;
        if (expressionNodeType !== 'EXPRESSION')
            throw new Error(`Script did not parse to an EXPRESSION node for trigger ${this.name}, got ${expressionNodeType} instead.`);

        if (expressionIndex !== 0)
            throw new Error(`Script did not parse to the first EXPRESSION node for trigger ${this.name}, got index ${expressionIndex} instead.`);

        if (expressionString !== 'meta_data stmt_list')
            throw new Error(`Script did not parse to a meta_data stmt_list structure for trigger ${this.name}, got ${expressionString} instead.`);

        const [ expTypeNode, expNode, expLength ] = expListNode;
        if (expTypeNode !== 'EXP')
            throw new Error(`Script EXPLIST did not parse to an EXP node for trigger ${this.name}, got ${expTypeNode} instead.`);

        const [ lengthTypeNode, length ] = expLength;
        if (lengthTypeNode !== 'LENGTH')
            throw new Error(`Script EXPLIST did not parse to a LENGTH node for trigger ${this.name}, got ${lengthTypeNode} instead.`);

        const [metaDataTermNode, astTermNode] = expNode;
        const [ metaDataTermType, metaDataNode, metaDataNodeTermType ] = metaDataTermNode;
        if (metaDataTermType !== 'TERM')
            throw new Error(`Script EXP did not parse to a TERM node for trigger ${this.name}, got ${metaDataTermType} instead.`);

        if (metaDataNodeTermType !== 'IDENTIFIER')
            throw new Error(`Script EXP TERM did not parse to an IDENTIFIER node for trigger ${this.name}, got ${metaDataNodeTermType} instead.`);

        const [ astTermType, ast, astNodeTermType ] = astTermNode;
        if (astTermType !== 'TERM')
            throw new Error(`Script EXP did not parse to a TERM node for trigger ${this.name}, got ${astTermType} instead.`);

        if (astNodeTermType !== 'IDENTIFIER')
            throw new Error(`Script EXP TERM did not parse to an IDENTIFIER node for trigger ${this.name}, got ${astNodeTermType} instead.`);

        const [stmtListNodeType, astInner, astExpressionNode] = ast;
        if (stmtListNodeType !== 'stmt_list')
            throw new Error(`Script AST did not parse to a stmt_list node for trigger ${this.name}, got ${stmtListNodeType} instead.`);

        const [metaDataNodeType, metaDataRuleNode] = metaDataNode;
        if (metaDataNodeType !== 'meta_data')
            throw new Error(`Script did not parse to a meta_data node for trigger ${this.name}, got ${metaDataNodeType} instead.`);

        const [metaDataExpListNodeType, metaDataExpListNode, metaDataExpressionNode] = metaDataRuleNode;
        if (metaDataExpListNodeType !== 'EXPLIST')
            throw new Error(`Script meta_data did not parse to an EXPLIST node for trigger ${this.name}, got ${metaDataExpListNodeType} instead.`);

        const [metaDataExpressionNodeType, metaDataExpressionIndex, metaDataExpressionString] = metaDataExpressionNode;
        if (metaDataExpressionNodeType !== 'EXPRESSION')
            throw new Error(`Script meta_data did not parse to an EXPRESSION node for trigger ${this.name}, got ${metaDataExpressionNodeType} instead.`);

        if (metaDataExpressionIndex !== 0)
            throw new Error(`Script meta_data did not parse to the first EXPRESSION node for trigger ${this.name}, got index ${metaDataExpressionIndex} instead.`);

        const [metaDataExpNodeType, metaDataExpNode, metaDataExpNodeLength] = metaDataExpListNode;
        if (metaDataExpNodeType !== 'EXP')
            throw new Error(`Script meta_data did not parse to an EXP node for trigger ${this.name}, got ${metaDataExpNodeType} instead.`);

        const [metaDataLengthNodeType, metaDataLength] = metaDataExpNodeLength;
        if (metaDataLengthNodeType !== 'LENGTH')
            throw new Error(`Script meta_data EXP did not parse to a LENGTH node for trigger ${this.name}, got ${metaDataLengthNodeType} instead.`);

        if (metaDataExpNode.length !== 1)
            throw new Error(`Script meta_data EXP LENGTH did not parse correctly for trigger ${this.name}.`);

        if (metaDataLength !== 1)
            throw new Error(`Script meta_data EXP did not parse to length 1 for trigger ${this.name}, got length ${metaDataLength} instead.`);

        const [metaDataQWordNodeType, metaDataQWordNode, metaDataQWordOType] = metaDataExpNode[0];
        if (metaDataQWordNodeType !== 'QWORD')
            throw new Error(`Script meta_data EXP did not parse to a QWORD node for trigger ${this.name}, got ${metaDataQWordNodeType} instead.`);

        if (metaDataQWordOType !== 'QUESTION')
            throw new Error(`Script meta_data EXP QWORD did not parse to a QUESTION node for trigger ${this.name}, got ${metaDataQWordOType} instead.`);

        const foundArr = new Array(ScriptForge.Script.metaLabels.length).fill(null);
        if (metaDataQWordNode !== null) {
            const [expListNodeType, expListNode, expressionNode] = metaDataQWordNode;
            if (expListNodeType !== 'EXPLIST')
                throw new Error(`Script meta_data QWORD did not parse to an EXPLIST node for trigger ${this.name}, got ${expListNodeType} instead.`);

            const [expressionNodeType, expressionIndex, expressionString] = expressionNode;
            if (expressionNodeType !== 'EXPRESSION')
                throw new Error(`Script meta_data QWORD did not parse to an EXPRESSION node for trigger ${this.name}, got ${expressionNodeType} instead.`);

            if (expressionIndex !== 0)
                throw new Error(`Script meta_data QWORD did not parse to the first EXPRESSION node for trigger ${this.name}, got index ${expressionIndex} instead.`);

            const [expNodeType, expNode, expLengthNode] = expListNode;
            if (expNodeType !== 'EXP')
                throw new Error(`Script meta_data QWORD did not parse to an EXP node for trigger ${this.name}, got ${expNodeType} instead.`);

            const [lengthNodeType, length] = expLengthNode;
            if (lengthNodeType !== 'LENGTH')
                throw new Error(`Script meta_data QWORD EXP did not parse to a LENGTH node for trigger ${this.name}, got ${lengthNodeType} instead.`);

            if (expNode.length !== 2)
                throw new Error(`Script meta_data QWORD EXP LENGTH did not parse correctly for trigger ${this.name}.`);

            const [qWordNode, metaEndQWordNode] = expNode;
            const [metaEndQWordNodeType, metaEndQWordNodeValue, metaEndQWordOType] = metaEndQWordNode;
            if (metaEndQWordNodeType !== 'QWORD')
                throw new Error(`Script meta_data QWORD EXP did not parse to a QWORD node for trigger ${this.name}, got ${metaEndQWordNodeType} instead.`);

            if (metaEndQWordOType !== 'QUESTION')
                throw new Error(`Script meta_data QWORD EXP QWORD did not parse to a QUESTION node for trigger ${this.name}, got ${metaEndQWordOType} instead.`);

            if (metaEndQWordNodeValue !== null) {
                const [metaEndTermNodeLabel, metaEndTermNodeValue, metaEndTermNodeType] = metaEndQWordNodeValue;
                if (metaEndTermNodeLabel !== 'TERM')
                    throw new Error(`Script meta_data QWORD EXP QWORD did not parse to a TERM node for trigger ${this.name}, got ${metaEndTermNodeLabel} instead.`);

                if (metaEndTermNodeType !== 'TOKEN')
                    throw new Error(`Script meta_data QWORD EXP QWORD TERM did not parse to a TOKEN node for trigger ${this.name}, got ${metaEndTermNodeType} instead.`);

                const [metaEndTokenLabel, metaEndTokenName, metaEndTokenValue] = metaEndTermNodeValue;
                if (metaEndTokenLabel !== 'TOKEN')
                    throw new Error(`Script meta_data QWORD EXP QWORD TERM TOKEN did not parse to a TOKEN node for trigger ${this.name}, got ${metaEndTokenLabel} instead.`);

                if (metaEndTokenName !== 'META_END')
                    throw new Error(`Script meta_data QWORD EXP QWORD TERM TOKEN did not parse to a META_END node for trigger ${this.name}, got ${metaEndTokenName} instead.`);
            }

            const [metaDataQWordNodeType, metaDataQWordNodeValue, metaDataQWordOType] = qWordNode;
            if (metaDataQWordNodeType !== 'QWORD')
                throw new Error(`Script meta_data QWORD EXP did not parse to a QWORD node for trigger ${this.name}, got ${metaDataQWordNodeType} instead.`);

            if (metaDataQWordOType !== 'STAR')
                throw new Error(`Script meta_data QWORD EXP QWORD did not parse to a STAR node for trigger ${this.name}, got ${metaDataQWordOType} instead.`);

            for (const [metaDataTermNodeLabel, metaDataTermNodeValue, metaDataTermNodeType] of metaDataQWordNodeValue) {
                if (metaDataTermNodeLabel !== 'TERM')
                    throw new Error(`Script meta_data QWORD EXP QWORD did not parse to a TERM node for trigger ${this.name}, got ${metaDataTermNodeLabel} instead.`);

                if (metaDataTermNodeType !== 'TOKEN')
                    throw new Error(`Script meta_data QWORD EXP QWORD TERM did not parse to a TOKEN node for trigger ${this.name}, got ${metaDataTermNodeType} instead.`);

                const [metaDataTokenLabel, metaDataTokenName, metaDataTokenValue] = metaDataTermNodeValue;
                if (metaDataTokenLabel !== 'TOKEN')
                    throw new Error(`Script meta_data QWORD EXP QWORD TERM TOKEN did not parse to a TOKEN node for trigger ${this.name}, got ${metaDataTokenLabel} instead.`);

                if (metaDataTokenName !== 'META_DATA')
                    throw new Error(`Script meta_data QWORD EXP QWORD TERM TOKEN did not parse to a META_DATA node for trigger ${this.name}, got ${metaDataTokenName} instead.`);

                const match = metaDataTokenValue.match(ScriptForge.Script.metaDataRegex);
                if (!match)
                    throw new Error(`MetaData line did not match expected format: ${metaDataTokenValue}`);

                if (match.index !== 0)
                    throw new Error(`MetaData line did not match expected format at index 0: ${metaDataTokenValue}`);

                const label = match[1].toLowerCase();
                const content = match[2];
                const labelIndex = ScriptForge.Script.metaLabelLookup.get(label);
                if (labelIndex !== undefined) {
                    foundArr[labelIndex] = content;
                }
            }
        }
        
        const [scriptTitle, scriptDescription, scriptAuthor, scriptVersion, triggers] = foundArr;

        this.title = scriptTitle;
        this.description = scriptDescription;
        this.author = scriptAuthor;
        this.version = scriptVersion;
        if (!triggers)
            throw new Error(`Script is missing required Triggers meta data.`);

        this.triggers = triggers.split(/[,\s]+/).filter(Boolean);//Split by comma/whitespace and ignore empty entries
        if (this.triggers.length === 0)
            throw new Error(`Script has no triggers defined.`);
        
        this.ast = ast;
        this.fullAST = fullAST;
    }
}

ScriptForge.Script.metaLabels = ["Title", "Description", "Author", "Version", "Triggers"];
ScriptForge.Script.metaLabelLookup = new Map();
for (let i = 0; i < ScriptForge.Script.metaLabels.length; i++) {
    const label = ScriptForge.Script.metaLabels[i].toLowerCase();
    ScriptForge.Script.metaLabelLookup.set(label, i);
}

ScriptForge.Script.metaDataRegex = /([A-Za-z]+)\s*:\s*([\s\S]*?)(?=\s*[A-Za-z]+\s*:|\s*-{3,}|$)/;//Same as META_DATA REGEX in ZonScript grammar