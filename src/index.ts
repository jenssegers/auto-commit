#!/usr/bin/env node

import { execSync } from 'child_process';
import { Spinner } from 'cli-spinner';
import { Command } from 'commander';
import dotenv from 'dotenv';
import inquirer from 'inquirer';
import OpenAI from 'openai';
import readline from 'readline';
import simpleGit from 'simple-git';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const program = new Command();

program
  .name('git-diff')
  .description('Auto generate git commits')
  .argument('[path]', 'Path to the git repository', process.cwd())
  .option(
    '-e, --exclude <files>',
    'Files to exclude from the diff',
    'package-lock.json,yarn.lock',
  )
  .option(
    '-s, --style <style>',
    'Choose between "gitmoji" or "conventional"',
    'conventional',
  )
  .parse(process.argv);

const path = program.args[0] || process.cwd();
const excludedFiles = program.opts().exclude.split(',') as string[];
const style = program.opts().style as 'gitmoji' | 'conventional';

function generatePrompt(
  diff: string,
  style: 'gitmoji' | 'conventional',
): string {
  let prompt = '';
  switch (style) {
    case 'gitmoji':
      prompt = `Analyze the following git diff and suggest an appropriate gitmoji (in :emoji: format) prefix and a short, clear git commit message without a conventional commits prefix:`;
      break;
    case 'conventional':
      prompt = `Analyze the following git diff and suggest an appropriate conventional commits prefix (build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test) and a short, clear git commit message. Include an exclemation mark if there are breaking changes and optionally include a scope in the conventional commits prefix if the changes are related to a specific part of the codebase.`;
      break;
  }

  return (
    prompt +
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
`
  );
}

async function getChatGPTResponse(prompt: string): Promise<string[]> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const jsonResponse = JSON.parse(response.choices[0].message.content || '{}');

  return jsonResponse.responses.map(
    (item: { prefix: string; message: string }) =>
      `${style == 'conventional' ? item.prefix + ':' : item.prefix} ${
        item.message.charAt(0).toUpperCase() + item.message.slice(1)
      }`,
  );
}

async function selectCommitMessage(choices: string[]): Promise<string> {
  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message: 'Select your commit message:',
      choices,
    },
  ]);

  return selected;
}

async function getGitDiff(repoPath: string): Promise<string> {
  const git = simpleGit(repoPath);
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

    const spinner = new Spinner('%s Loading...');
    spinner.setSpinnerString(18);
    spinner.start();

    // Generate the ChatGPT prompt
    const chatGPTPrompt = generatePrompt(diff, style);

    // Get responses from ChatGPT
    const chatGPTResponses = await getChatGPTResponse(chatGPTPrompt);

    spinner.stop();
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);

    // Let the user select the preferred commit message
    const message = await selectCommitMessage(chatGPTResponses);

    // Execute git commit with the selected message
    try {
      execSync(`git commit -e -m "${message}"`, { stdio: 'inherit' });
    } catch (error) {
      console.error('Failed to commit:', error);
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
