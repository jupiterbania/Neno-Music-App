# Security Policy

## Supported versions

Only the latest release gets fixes. Neno auto-updates; older versions are not patched.

## Reporting a vulnerability

Use GitHub's [private vulnerability reporting](https://github.com/jupiterbania/Neno-Music-App/security/advisories/new)
— it is private until a fix ships. If that is unavailable, contact through GitHub issues or discussions
with `neno security` in the subject.

Please do not open a public issue for a vulnerability.

Include what you have: affected version, OS, steps to reproduce, and what an attacker gains.

## Scope

Neno is an app that plays YouTube Music content. Things worth reporting:

- Remote content (video metadata, captions, thumbnails, URLs) escaping into command
  execution, file writes outside the app's own data directory, or the webview's privileged
  context.
- Anything that leaks the updater signing key, cookies, or the local cookie jar.
- A malicious or spoofed update passing signature verification.

Out of scope: YouTube's own terms of service, rate limits or bot checks, missing hardening
that is not exploitable, and vulnerabilities in a dependency that Neno does not actually
reach.
