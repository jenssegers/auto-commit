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
    .option('-m, --model <model>', 'An OpenAI model such "gpt-4.1-nano" or "gpt-5-nano"', 'gpt-4.1-nano')
    .parse(process.argv);
const path = program.args[0] || process.cwd();
const excludedFiles = program.opts().exclude.split(',');
function generatePrompt(diffData) {
    return `Analyze the following git diff and suggest 1-4 conventional commit messages following the Conventional Commits specification (v1.0.0).

COMMIT MESSAGE COMPONENTS:

1. TYPE (required) - MUST be EXACTLY one of these:
   - feat: A new feature
   - fix: A bug fix
   - docs: Documentation only changes
   - style: Code style changes (formatting, missing semi-colons, etc; no logic change)
   - refactor: Code change that neither fixes a bug nor adds a feature
   - perf: Performance improvements
   - test: Adding or updating tests
   - build: Changes to build system or dependencies
   - ci: Changes to CI configuration
   - chore: Other changes that don't modify src or test files
   - revert: Reverts a previous commit

2. SCOPE (optional but recommended):
   - A noun describing the affected part of the codebase
   - Examples: api, parser, auth, readme, cli

3. DESCRIPTION (required):
   - Short summary of the change
   - Use imperative mood: "add" not "added", "fix" not "fixed"
   - Start with lowercase letter
   - No period at the end
   - Keep under 72 characters total (including type and scope)

4. BODY (optional):
   - Additional context about the change
   - Explain motivation and contrast with previous behavior

5. BREAKING (boolean):
   - Set to true if this contains breaking changes
   - When true, include "BREAKING CHANGE:" in the body

EXAMPLES:
- Type: feat, Scope: none, Description: "allow provided config object to extend other configs", Breaking: false
- Type: feat, Scope: lang, Description: "add Polish language", Breaking: false
- Type: fix, Scope: none, Description: "prevent racing of requests", Breaking: false
- Type: docs, Scope: none, Description: "correct spelling of CHANGELOG", Breaking: false
- Type: feat, Scope: api, Description: "send an email to customer when product is shipped", Breaking: true
- Type: chore, Scope: none, Description: "drop support for Node 6", Breaking: true

Return 1-4 different commit message suggestions as a JSON array with these EXACT fields:

{
  "responses": [
    {
      "type": "feat",
      "scope": "api",
      "description": "subject text in imperative mood",
      "body": "optional body text with more context",
      "breaking": false
    }
  ]
}

Field definitions:
- "type": The commit type (required). Must be one of the types listed above.
- "scope": Optional scope as a string. Omit the field entirely if no scope is needed.
- "description": The subject line in imperative mood, lowercase, no period (required).
- "body": Optional body text with additional context, motivation, or BREAKING CHANGE footer if needed. Omit the field entirely if no body is needed.
- "breaking": Boolean indicating if this is a breaking change (required, defaults to false).

Complete JSON examples:
{
  "responses": [
    {
      "type": "feat",
      "description": "allow config object to extend other configs",
      "body": "This enables better configuration composition and reduces duplication",
      "breaking": false
    },
    {
      "type": "fix",
      "scope": "api",
      "description": "prevent racing of requests",
      "body": "Introduce a request id and reference to latest request. Dismiss incoming responses other than from latest request.",
      "breaking": false
    },
    {
      "type": "feat",
      "scope": "auth",
      "description": "change login flow to use OAuth2",
      "body": "BREAKING CHANGE: The authentication module now requires OAuth2 tokens for all API requests",
      "breaking": true
    }
  ]
}

Files changed: ${diffData.stagedFiles.join(', ')}

The diff:

\`\`\`
${diffData.diff}
\`\`\`
`;
}
async function getChatGPTResponse(prompt) {
    if (process.env.DEBUG) {
        console.log('\n=== Prompt ===');
        console.log(prompt);
    }
    const response = await openai.chat.completions.create({
        model: program.opts().model,
        messages: [
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
    });
    const message = response.choices[0].message;
    if (message.refusal) {
        throw new Error(`OpenAI API refused to respond: ${message.refusal}\n` +
            'This may indicate an issue with the diff content or prompt format.');
    }
    const content = message.content?.trim();
    if (!content) {
        throw new Error('Empty response from OpenAI API');
    }
    if (response.choices[0].finish_reason === 'length') {
        throw new Error('Response was truncated. The diff may be too large. Try committing fewer changes.');
    }
    const jsonResponse = JSON.parse(content);
    if (!jsonResponse.responses || !Array.isArray(jsonResponse.responses)) {
        throw new Error('Invalid response format from OpenAI API');
    }
    return jsonResponse.responses;
}
async function selectCommitMessage(choices) {
    const { selected } = await inquirer_1.default.prompt([
        {
            type: 'list',
            name: 'selected',
            message: 'Select your commit message:',
            choices: choices.map((item) => {
                const scopePart = item.scope ? `(${item.scope})` : '';
                const breakingPart = item.breaking ? '!' : '';
                return {
                    name: `${item.type}${scopePart}${breakingPart}: ${item.description}`,
                    value: item,
                };
            }),
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
    const status = await git.status();
    const stagedFiles = status.staged || [];
    return {
        diff: diff.trim(),
        stagedFiles,
    };
}
async function main() {
    try {
        const diffData = await getGitDiff(path);
        if (diffData.diff === '') {
            console.error('No staged changes found.');
            return;
        }
        const maxDiffLength = 28000;
        if (diffData.diff.length > maxDiffLength) {
            console.error(`Error: Diff is too large (${diffData.diff.length} characters, max ${maxDiffLength}).`);
            console.error('Please commit changes in smaller, focused chunks.');
            process.exit(1);
        }
        const spinner = new cli_spinner_1.Spinner('%s Loading...');
        spinner.setSpinnerString(18);
        spinner.start();
        // Generate the ChatGPT prompt
        const chatGPTPrompt = generatePrompt(diffData);
        // Get responses from ChatGPT
        const chatGPTResponses = await getChatGPTResponse(chatGPTPrompt);
        spinner.stop();
        readline_1.default.clearLine(process.stdout, 0);
        readline_1.default.cursorTo(process.stdout, 0);
        // Let the user select the preferred commit message
        const selected = await selectCommitMessage(chatGPTResponses);
        const scopePart = selected.scope ? `(${selected.scope})` : '';
        const breakingPart = selected.breaking ? '!' : '';
        const message = selected.body
            ? `${selected.type}${scopePart}${breakingPart}: ${selected.description}

${selected.body}`
            : `${selected.type}${scopePart}${breakingPart}: ${selected.description}`;
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
