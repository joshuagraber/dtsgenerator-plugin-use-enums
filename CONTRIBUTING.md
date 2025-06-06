# Contributing to dtsgenerator-use-enums

Thank you for considering contributing to this project! Here's how you can help.

## Development Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests to ensure everything works (`npm test`)
5. Commit your changes using conventional commit format
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Commit Message Format

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automated versioning and changelog generation. Please format your commit messages as follows:

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to our CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files

### Examples

```
feat: add support for pascal case enum conversion
fix: handle empty string literals in enums
docs: update README with new options
```

## Pull Request Process

1. Ensure your code passes all tests
2. Update documentation if necessary
3. The PR should work for Node.js 16 and above
4. Your PR will be merged once approved by a maintainer

## Release Process

Releases are handled automatically by semantic-release when changes are merged to the main or beta branches.

- Merges to `main` create production releases
- Merges to `beta` create pre-release versions