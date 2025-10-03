#!/usr/bin/env node

import { execSync } from 'child_process';
import { Spinner } from 'cli-spinner';
import { Command } from 'commander';
import dotenv from 'dotenv';
import inquirer from 'inquirer';
import OpenAI from 'openai';
import readline from 'readline';
import simpleGit from 'simple-git';

dotenv.config({ quiet: true });

interface ConventionalCommit {
  type: string;
  scope?: string;
  description: string;
  body?: string;
  breaking: boolean;
}

interface DiffData {
  diff: string;
  stagedFiles: string[];
}

const MAX_DIFF_LENGTH = 28000;
const DEFAULT_MODEL = 'gpt-4.1-nano';
const DEFAULT_EXCLUDED_FILES = 'package-lock.json,yarn.lock';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const program = new Command();
program
  .name('auto-commit')
  .description('Auto generate git commits')
  .argument('[path]', 'Path to the git repository', process.cwd())
  .option('-e, --exclude <files>', 'Files to exclude from the diff', DEFAULT_EXCLUDED_FILES)
  .option('-m, --model <model>', 'An OpenAI model such "gpt-4.1-nano" or "gpt-5-nano"', DEFAULT_MODEL)
  .parse(process.argv);

const config = {
  path: program.args[0] || process.cwd(),
  excludedFiles: program.opts().exclude.split(',') as string[],
  model: program.opts().model as string,
};

function formatCommitMessage(commit: ConventionalCommit): string {
  const scope = commit.scope ? `(${commit.scope})` : '';
  const breaking = commit.breaking ? '!' : '';
  const subject = `${commit.type}${scope}${breaking}: ${commit.description}`;

  return commit.body ? `${subject}\n\n${commit.body}` : subject;
}

function formatCommitChoice(commit: ConventionalCommit): string {
  const scope = commit.scope ? `(${commit.scope})` : '';
  const breaking = commit.breaking ? '!' : '';
  return `${commit.type}${scope}${breaking}: ${commit.description}`;
}

async function getGitDiff(repoPath: string, excludedFiles: string[]): Promise<DiffData> {
  const git = simpleGit(repoPath);
  const diffArgs = ['--staged', '--', ...excludedFiles.map((file) => `:!${file}`)];
  const diff = await git.diff(diffArgs);
  const status = await git.status();

  return {
    diff: diff.trim(),
    stagedFiles: status.staged || [],
  };
}

function commitChanges(message: string): void {
  execSync(`git commit -e -m "${message}"`, { stdio: 'inherit' });
}

function generatePrompt(diffData: DiffData): string {
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

async function generateCommitSuggestions(prompt: string, model: string): Promise<ConventionalCommit[]> {
  if (process.env.DEBUG) {
    console.log('\n=== Prompt ===');
    console.log(prompt);
  }

  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 2000,
  });

  const message = response.choices[0].message;

  if (message.refusal) {
    throw new Error(
      `OpenAI API refused to respond: ${message.refusal}\n` +
        'This may indicate an issue with the diff content or prompt format.',
    );
  }

  const content = message.content?.trim();

  if (!content) {
    throw new Error('Empty response from OpenAI API');
  }

  if (response.choices[0].finish_reason === 'length') {
    throw new Error(
      'Response was truncated. The diff may be too large. Try committing fewer changes.',
    );
  }

  const jsonResponse = JSON.parse(content);

  if (!jsonResponse.responses || !Array.isArray(jsonResponse.responses)) {
    throw new Error('Invalid response format from OpenAI API');
  }

  return jsonResponse.responses;
}

async function selectCommitMessage(commits: ConventionalCommit[]): Promise<ConventionalCommit> {
  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message: 'Select your commit message:',
      choices: commits.map((commit) => ({
        name: formatCommitChoice(commit),
        value: commit,
      })),
    },
  ]);

  return selected;
}

async function withSpinner<T>(task: Promise<T>): Promise<T> {
  const spinner = new Spinner('%s Loading...');
  spinner.setSpinnerString(18);
  spinner.start();

  try {
    return await task;
  } finally {
    spinner.stop();
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
  }
}

function validateDiff(diff: string): void {
  if (!diff) {
    throw new Error('No staged changes found.');
  }

  // if (diff.length > MAX_DIFF_LENGTH) {
  //   throw new Error(
  //     `Diff is too large (${diff.length} characters, max ${MAX_DIFF_LENGTH}).\n` +
  //       'Please commit changes in smaller, focused chunks.',
  //   );
  // }
}

async function main() {
  try {
    const diffData = await getGitDiff(config.path, config.excludedFiles);
    validateDiff(diffData.diff);

    const prompt = generatePrompt(diffData);
    const suggestions = await withSpinner(generateCommitSuggestions(prompt, config.model));

    const selected = await selectCommitMessage(suggestions);
    const message = formatCommitMessage(selected);

    commitChanges(message);
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
