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
dotenv_1.default.config({ quiet: true });
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
const program = new commander_1.Command();
program
    .name('auto-commit')
    .description('Auto generate git commits')
    .argument('[path]', 'Path to the git repository', process.cwd())
    .option('-e, --exclude <files>', 'Files to exclude from the diff', 'package-lock.json,yarn.lock')
    .option('-s, --style <style>', 'Choose between "gitmoji" or "conventional"', 'conventional')
    .option('-m, --model <model>', 'An OpenAI model such "gpt-4.1-nano" or "gpt-5-nano"', 'gpt-4.1-nano')
    .parse(process.argv);
const path = program.args[0] || process.cwd();
const excludedFiles = program.opts().exclude.split(',');
const style = program.opts().style;
function generatePrompt(diff, style) {
    let prompt = '';
    switch (style) {
        case 'gitmoji':
            prompt = `Analyze the following git diff and suggest an appropriate gitmoji commit message and description of the change following these rules:

1. Format: <intention> [scope?][:?] <message>
   - intention: Use an emoji from the official gitmoji list (in :shortcode: format)
   - scope: Optional context in parentheses
   - message: Clear description of the change

2. Common gitmoji types:
   - :art: Improve structure/format of code
   - :zap: Improve performance
   - :bug: Fix a bug
   - :sparkles: Introduce new features
   - :recycle: Refactor code
   - :memo: Add or update documentation
   - :wrench: Add or update configuration files
   - :fire: Remove code or files
   - :boom: Introduce breaking changes
   - :lipstick: Add or update UI and style files
   - :test_tube: Add a failing test
   - :white_check_mark: Add, update, or pass tests

3. Message must:
   - Be clear and concise
   - Start with a capital letter
   - Not end with a period

Examples:
- ⚡️ Lazyload home screen images
- 🐛 Fix onClick event handler
- ♻️ (components) Transform classes to hooks
- 📈 Add analytics to dashboard
- 🌐 Support Japanese language`;
            break;
        case 'conventional':
            prompt = `Analyze the following git diff and suggest an appropriate conventional commit message and description of the change following these rules:

1. Format: <type>[optional scope][!]: <description>
2. Type must be one of: build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test
3. Type must be lowercase
4. Add a scope in parentheses if changes relate to a specific component (optional)
5. Add ! after the type/scope to indicate breaking changes
6. Description must:
   - Start with lowercase
   - Not end with a period
   - Be concise and clear
   - Be no longer than 100 characters in total
7. If there are breaking changes, include "BREAKING CHANGE: " in the footer

Type guidelines:
  - feat: new feature or significant enhancement
  - fix: bug fix
  - docs: documentation changes only
  - style: formatting, missing semi-colons, etc; no code change
  - refactor: code change that neither fixes a bug nor adds a feature
  - perf: code change that improves performance
  - test: adding/updating tests
  - build: changes affecting build system or dependencies
  - ci: changes to CI configuration files and scripts
  - chore: other changes that don't modify src or test files
  - revert: reverts a previous commit

Examples:
- feat: add user authentication
- fix(api): resolve data parsing issue
- feat(auth)!: change login flow
- refactor: simplify error handling
- docs(readme): update installation steps`;
            break;
    }
    return (prompt +
        `

\`\`\`
${diff}
\`\`\`

Return a minimum of 1 and a maximum of 4 different responses and return them in JSON format array with each response having the following format:

{
    "responses": [
        {
            "prefix": "[type including the scope without the colon]",
            "message": "[field should contain the description]",
            "description": "[description of the change]"
        },
        ...
    ]
}
`);
}
async function getChatGPTResponse(prompt) {
    const response = await openai.chat.completions.create({
        model: program.opts().model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
    });
    const jsonResponse = JSON.parse(response.choices[0].message.content || '{}');
    return jsonResponse.responses;
}
async function selectCommitMessage(choices) {
    const { selected } = await inquirer_1.default.prompt([
        {
            type: 'list',
            name: 'selected',
            message: 'Select your commit message:',
            choices: choices.map((item, index) => ({
                name: `${style === 'conventional' ? item.prefix + ':' : item.prefix} ${item.message}`,
                value: item,
            })),
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
        const selected = await selectCommitMessage(chatGPTResponses);
        const message = `${style === 'conventional'
            ? selected.prefix.split(':')[0] + ':'
            : selected.prefix} ${selected.message}

${selected.description}`;
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
