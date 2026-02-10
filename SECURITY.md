# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| 1.x.x   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Do NOT open a public GitHub issue** for security vulnerabilities
2. Email us at: [security@learnautomatedtesting.com](mailto:security@learnautomatedtesting.com)
3. Or use GitHub's private vulnerability reporting: [Report a vulnerability](https://github.com/learn-automated-testing/selenium_agent/security/advisories/new)

### What to Include

Please include as much of the following information as possible:

- Type of vulnerability (e.g., XSS, SQL injection, RCE)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Resolution Target**: Within 30 days for critical issues

### What to Expect

1. We will acknowledge receipt of your report
2. We will investigate and validate the issue
3. We will work on a fix and coordinate disclosure
4. We will credit you in the security advisory (unless you prefer to remain anonymous)

## Security Measures

This project implements the following security practices:

### Automated Scanning
- **CodeQL**: Static code analysis on every PR
- **Dependabot**: Automated dependency vulnerability alerts
- **Trivy**: Docker image scanning
- **Semgrep**: SAST scanning
- **TruffleHog**: Secret detection

### Development Practices
- All dependencies are regularly updated
- Security-focused code reviews
- Principle of least privilege in browser automation

## Scope

The following are in scope for security reports:

- Selenium MCP Server (`selenium-mcp-server/`)
- npm wrapper (`npm-wrapper/`)
- Docker configurations
- GitHub Actions workflows

The following are out of scope:

- Third-party dependencies (report to upstream maintainers)
- Selenium Grid itself (report to [SeleniumHQ](https://github.com/SeleniumHQ/selenium/security))
- Social engineering attacks
- Denial of service attacks

## Recognition

We appreciate security researchers who help keep our project safe. Contributors who report valid vulnerabilities will be:

- Credited in our security advisories
- Added to our CONTRIBUTORS.md (if desired)
- Thanked publicly (with your permission)

Thank you for helping keep Selenium MCP Server and its users safe!
