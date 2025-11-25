# Security Policy

## Supported Versions

We actively support the following versions of Morgan-Bevy with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.4.x   | :white_check_mark: |
| 0.3.x   | :white_check_mark: |
| < 0.3   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously and appreciate your help in making Morgan-Bevy safer for everyone.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities to:
- **Email**: <mailto:s0ma@protonmail.com>
- **Subject**: [SECURITY] Morgan-Bevy Vulnerability Report

### What to Include

When reporting a vulnerability, please include:

1. **Description**: Clear description of the vulnerability
2. **Impact**: Potential impact and severity assessment
3. **Steps to Reproduce**: Detailed steps to reproduce the issue
4. **Affected Versions**: Which versions of Morgan-Bevy are affected
5. **Environment**: Operating system, browser, and version information
6. **Supporting Materials**: Screenshots, logs, or proof-of-concept code (if applicable)

### Response Timeline

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
- **Initial Assessment**: We will provide an initial assessment within 5 business days
- **Status Updates**: We will provide status updates every 7 days until resolution
- **Resolution**: We aim to resolve critical vulnerabilities within 30 days

### Disclosure Policy

- We follow a **coordinated disclosure** approach
- We will work with you to understand and address the issue before any public disclosure
- We will credit you in our security advisory (unless you prefer to remain anonymous)
- We ask that you do not publicly disclose the vulnerability until we have released a fix

## Security Considerations

### Tauri Application Security

Morgan-Bevy is built with Tauri, which provides several security features:

- **Process Isolation**: The frontend (web) and backend (Rust) run in separate processes
- **API Allowlisting**: Only explicitly allowed APIs can be called from the frontend
- **Content Security Policy**: Helps prevent XSS attacks in the web layer
- **Sandboxing**: The application runs in a sandboxed environment

### File System Access

- Morgan-Bevy requires file system access to read/write 3D models and project files
- File operations are limited to user-selected directories through native file dialogs
- Asset scanning respects user permissions and system security boundaries

### Database Security

- SQLite database files are stored locally on the user's system
- Database access is limited to the application's sandbox
- No external database connections are made by default

### Network Security

- The application does not make external network requests by default
- Any future network features will be explicitly documented and optional
- Plugin system (future) will require explicit user consent for network access

## Best Practices for Users

### Installation Security

1. **Download from Official Sources**: Only download Morgan-Bevy from:
   - GitHub Releases: [https://github.com/greysquirr3l/morgan-bevy/releases](https://github.com/greysquirr3l/morgan-bevy/releases)
   - Official documentation links

2. **Verify Signatures**: Check release signatures when available

3. **Keep Updated**: Regularly update to the latest version for security fixes

### Usage Security

1. **Project Files**: Only open project files from trusted sources
2. **Asset Libraries**: Be cautious when importing assets from unknown sources
3. **Plugins**: Only install plugins from trusted developers (future feature)
4. **Backups**: Regularly backup your projects to prevent data loss

### Development Security

If you're building Morgan-Bevy from source:

1. **Dependencies**: Use `npm audit` and `cargo audit` to check for vulnerable dependencies
2. **Build Environment**: Use a clean, trusted build environment
3. **Code Review**: Review any modifications to the source code

## Security Features

### Current Security Measures

- **Input Validation**: All user inputs are validated before processing
- **File Type Checking**: Asset files are validated before import
- **Error Handling**: Secure error handling prevents information disclosure
- **Memory Safety**: Rust backend provides memory safety guarantees
- **Cross-Platform Security**: Consistent security model across all supported platforms

### Planned Security Enhancements

- **Plugin Sandboxing**: Isolated execution environment for third-party plugins
- **Digital Signatures**: Code signing for release binaries
- **Security Audit**: Regular third-party security assessments
- **Asset Scanning**: Malware detection for imported assets

## Third-Party Dependencies

We regularly monitor and update our dependencies to address security vulnerabilities:

### Frontend Dependencies

- React and associated libraries
- Three.js for 3D rendering
- Tauri frontend APIs

### Backend Dependencies

- Rust crates for file I/O, serialization, and 3D math
- SQLite for local database operations
- Native system APIs through Tauri

## Contact Information

For security-related questions or concerns:

- **Security Email**: <s0ma@protonmail.com>
- **Project Repository**: <https://github.com/greysquirr3l/morgan-bevy>
- **Documentation**: Coming soon

## Acknowledgments

We would like to thank the security researchers and community members who help make Morgan-Bevy more secure:

- Security contributors will be listed here after coordinated disclosure

---

**Note**: This security policy is subject to updates. Please check back regularly for the latest information.

Last Updated: November 24, 2025
