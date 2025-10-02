# auto-commit

Auto-commit is an intelligent CLI tool that leverages ChatGPT to suggest git commit messages based on your staged changes. It uses conventional commit style, making it easier to maintain consistent and meaningful commit histories.

```
➜  g ac
? Select your commit message: (Use arrow keys)
❯ docs: Update README to rename auto-commit CLI and add git integration instructions
  docs: Revise README for auto-commit with git alias and gitconfig setup
  docs: Enhance README with integration details for git alias
  docs!: Major update to README: renamed tool and added crucial integration steps
```

## Features

- Generates 4 commit message suggestions based on your staged git diff
- Uses conventional commit style
- Excludes specified files from the diff analysis
- Interactive selection of the preferred commit message
- Easy integration with your existing git workflow

## Installation

### Prerequisites

- Node.js (v14 or later)

### Using npx (Recommended)

No installation required! Run directly using npx:

```bash
npx github:jenssegers/auto-commit
```

### Configuration

Auto-commit requires an OpenAI API key to function. Set your API key as an environment variable:

```bash
export OPENAI_API_KEY=your_api_key_here
```

#### Git Alias

You can integrate auto-commit more seamlessly with your git workflow by setting up a git alias.

To create a git alias for auto-commit, run the following command:

```bash
git config --global alias.ac '!npx github:jenssegers/auto-commit'
```

Now you can use `git ac` instead of the full npx command in your git repositories.

#### Adding to gitconfig

Alternatively, you can add auto-commit to your global gitconfig file. Open your `~/.gitconfig` file (or create it if it doesn't exist) and add the following lines:

```ini
[alias]
    ac = !npx github:jenssegers/auto-commit
```

This will achieve the same result as setting up the git alias.

## Usage

You can use auto-commit directly with npx:

```bash
npx github:jenssegers/auto-commit [options] [path]
```

Or if you've set up the git alias:

```bash
git ac [options] [path]
```

### Options

- `-e, --exclude <files>`: Files to exclude from the diff (default: "package-lock.json,yarn.lock")
- `-h, --help`: Display help information

### Examples

1. Generate commit messages for the current directory:

   ```bash
   npx github:jenssegers/auto-commit
   ```

2. Generate commit messages for a specific path:

   ```bash
   npx github:jenssegers/auto-commit /path/to/your/repo
   ```

3. Exclude specific files from the diff analysis:
   ```bash
   npx github:jenssegers/auto-commit -e "file1.js,file2.js"
   ```

4. Using the git alias:
   ```bash
   git ac
   ```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.
