import { describe, expect, it } from 'vitest';
import {
	generateInvitationToken,
	getInvitationState,
	hashInvitationToken,
	normalizeInvitationEmail
} from './invitations';

describe('invitation policy', () => {
	it('normalizes valid email addresses and rejects malformed input', () => {
		expect(normalizeInvitationEmail(' Alan@Example.com ')).toBe('alan@example.com');
		expect(normalizeInvitationEmail('not-an-email')).toBeNull();
		expect(normalizeInvitationEmail(null)).toBeNull();
	});

	it('generates single-use token material and stores only its digest', () => {
		const token = generateInvitationToken();
		expect(token).toMatch(/^[a-f0-9]{64}$/u);
		expect(hashInvitationToken(token)).toHaveLength(64);
		expect(hashInvitationToken(token)).not.toBe(token);
	});

	it('prioritizes revoked and accepted state before expiry', () => {
		const now = new Date('2026-08-21T10:00:00Z');
		expect(
			getInvitationState(
				{ acceptedAt: null, revokedAt: null, expiresAt: new Date('2026-08-22') },
				now
			)
		).toBe('pending');
		expect(
			getInvitationState(
				{ acceptedAt: null, revokedAt: null, expiresAt: new Date('2026-08-20') },
				now
			)
		).toBe('expired');
		expect(
			getInvitationState(
				{ acceptedAt: now, revokedAt: null, expiresAt: new Date('2026-08-20') },
				now
			)
		).toBe('accepted');
		expect(
			getInvitationState(
				{ acceptedAt: now, revokedAt: now, expiresAt: new Date('2026-08-22') },
				now
			)
		).toBe('revoked');
	});
});
