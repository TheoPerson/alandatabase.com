# Security Policy

## Baseline

Security rules override convenience.

## Secrets

- Never commit secrets.
- Never print secrets into logs.
- Use environment/secret management.
- Redact sensitive values in diagnostics.

## Authentication and authorization

- Authentication proves identity.
- Authorization must be enforced server-side.
- Never rely only on client-side guards for protected actions.

## Input and output

Validate untrusted input.
Encode/escape output according to context.
Use parameterized queries or equivalent safe APIs.

## Dependencies

Avoid unnecessary packages.
Review security-sensitive dependencies and lockfiles.

## Network

Use least privilege for external access and credentials.

## Production

No destructive production action, permission broadening, or security weakening without explicit user approval.

## Security review trigger

Perform a focused security review for auth, payments, uploads, secrets, permissions, user data, external commands, and deployment changes.
