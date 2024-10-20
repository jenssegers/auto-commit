#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const cli_spinner_1 = require("cli-spinner");
const commander_1 = require("commander");
const dotenv_1 = __importDefault(require("dotenv"));
const inquirer_1 = __importDefault(require("inquirer"));
const openai_1 = __importDefault(require("openai"));
const readline_1 = __importDefault(require("readline"));
const simple_git_1 = __importDefault(require("simple-git"));
dotenv_1.default.config();
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
const program = new commander_1.Command();
program
    .name('git-diff')
    .description('Auto generate git commits')
    .argument('[path]', 'Path to the git repository', process.cwd())
    .option('-e, --exclude <files>', 'Files to exclude from the diff', 'package-lock.json,yarn.lock')
    .option('-s, --style <style>', 'Choose between "gitmoji" or "conventional"', 'conventional')
    .parse(process.argv);
const path = program.args[0] || process.cwd();
const excludedFiles = program.opts().exclude.split(',');
const style = program.opts().style;
function generatePrompt(diff, style) {
    let prompt = '';
    switch (style) {
        case 'gitmoji':
            prompt = `Analyze the following git diff and suggest an appropriate gitmoji (in :emoji: format) prefix and a short, clear git commit message without a conventional commits prefix:`;
            break;
        case 'conventional':
            prompt = `Analyze the following git diff and suggest an appropriate conventional commits prefix (build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test) and a short, clear git commit message. Include an exclemation mark if there are breaking changes and optionally include a scope in the conventional commits prefix if the changes are related to a specific part of the codebase.`;
            break;
    }
    return (prompt +
        `

\`\`\`
${diff}
\`\`\`

Return 4 different responses and return them in JSON format array with each response having the following format:

{
    "responses": [
        {
            "prefix": "[suggested ${style} prefix]",
            "message": "[short and clear commit message]"
        },
        ...
    ]
}
`);
}
async function getChatGPTResponse(prompt) {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
    });
    const jsonResponse = JSON.parse(response.choices[0].message.content || '{}');
    return jsonResponse.responses.map((item) => `${style == 'conventional' ? item.prefix + ':' : item.prefix} ${item.message.charAt(0).toUpperCase() + item.message.slice(1)}`);
}
async function selectCommitMessage(choices) {
    const { selected } = await inquirer_1.default.prompt([
        {
            type: 'list',
            name: 'selected',
            message: 'Select your commit message:',
            choices,
        },
    ]);
    return selected;
}
async function getGitDiff(repoPath) {
    const git = (0, simple_git_1.default)(repoPath);
    const diffArgs = [
        '--staged',
        '--',
        ...excludedFiles.map((file) => `:!${file}`),
    ];
    const diff = await git.diff(diffArgs);
    return diff.trim();
}
async function main() {
    try {
        const diff = await getGitDiff(path);
        if (diff === '') {
            console.error('No staged changes found.');
            return;
        }
        const spinner = new cli_spinner_1.Spinner('%s Loading...');
        spinner.setSpinnerString(18);
        spinner.start();
        // Generate the ChatGPT prompt
        const chatGPTPrompt = generatePrompt(diff, style);
        // Get responses from ChatGPT
        const chatGPTResponses = await getChatGPTResponse(chatGPTPrompt);
        spinner.stop();
        readline_1.default.clearLine(process.stdout, 0);
        readline_1.default.cursorTo(process.stdout, 0);
        // Let the user select the preferred commit message
        const message = await selectCommitMessage(chatGPTResponses);
        // Execute git commit with the selected message
        try {
            (0, child_process_1.execSync)(`git commit -e -m "${message}"`, { stdio: 'inherit' });
        }
        catch (error) {
            console.error('Failed to commit:', error);
        }
    }
    catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}
main();
