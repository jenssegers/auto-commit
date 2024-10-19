# Auto-Commit CLI

Auto-Commit is an intelligent CLI tool that leverages ChatGPT to suggest git commit messages based on your staged changes. It supports both gitmoji and conventional commit styles, making it easier to maintain consistent and meaningful commit histories.

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

## Configuration

Auto-Commit requires an OpenAI API key to function. Set your API key as an environment variable:

```bash
export OPENAI_API_KEY=your_api_key_here
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.
