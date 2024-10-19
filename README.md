# Auto-Commit

Auto-Commit is an intelligent CLI tool that leverages ChatGPT to suggest git commit messages based on your staged changes. It supports both gitmoji and conventional commit styles, making it easier to maintain consistent and meaningful commit histories.

```
➜  g ac
? Select your commit message: (Use arrow keys)
❯ docs: Update README to rename Auto-Commit CLI and add git integration instructions
  docs: Revise README for Auto-Commit with git alias and gitconfig setup
  docs: Enhance README with integration details for git alias
  docs!: Major update to README: renamed tool and added crucial integration steps
```

## Features

- Generates 4 commit message suggestions based on your staged git diff
- Supports both gitmoji and conventional commit styles
- Excludes specified files from the diff analysis
- Interactive selection of the preferred commit message
- Easy integration with your existing git workflow

## Installation

### Prerequisites

- Node.js (v14 or later)
- npm or yarn

### Global Installation

To install Auto-Commit globally, run:

```bash
npm install -g auto-commit
```

or if you prefer yarn:

```bash
yarn global add auto-commit
```

### Adding to PATH

After installing globally, you need to ensure that the npm or yarn global bin directory is in your PATH environment variable.

For npm:

```bash
export PATH="$PATH:$(npm config get prefix)/bin"
```

For yarn:

```bash
export PATH="$PATH:$(yarn global bin)"
```

To make this change permanent, add the appropriate line to your shell configuration file (e.g., `~/.bashrc`, `~/.zshrc`, or `~/.profile`).

## Configuration

Auto-Commit requires an OpenAI API key to function. Set your API key as an environment variable:

```bash
export OPENAI_API_KEY=your_api_key_here
```

## Usage

After installation, you can use the `auto-commit` command in your terminal:

```bash
auto-commit [options] [path]
```

### Options

- `-e, --exclude <files>`: Files to exclude from the diff (default: "package-lock.json,yarn.lock")
- `-s, --style <style>`: Choose between "gitmoji" or "conventional" commit styles (default: "conventional")
- `-h, --help`: Display help information

### Examples

1. Generate commit messages for the current directory using conventional style:

   ```bash
   auto-commit
   ```

2. Generate gitmoji-style commit messages for a specific path:

   ```bash
   auto-commit -s gitmoji /path/to/your/repo
   ```

3. Exclude specific files from the diff analysis:
   ```bash
   auto-commit -e "file1.js,file2.js"
   ```

### Git Integration

You can integrate Auto-Commit more seamlessly with your git workflow by setting up a git alias or adding it to your gitconfig.

#### Git Alias

To create a git alias for Auto-Commit, run the following command:

```bash
git config --global alias.ac '!auto-commit'
```

Now you can use `git ac` instead of `auto-commit` in your git repositories.

#### Adding to gitconfig

Alternatively, you can add Auto-Commit to your global gitconfig file. Open your `~/.gitconfig` file (or create it if it doesn't exist) and add the following lines:

```ini
[alias]
    ac = !auto-commit
```

This will achieve the same result as setting up the git alias.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.
