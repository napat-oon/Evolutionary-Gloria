package io.muzoo.ic.gloria.auth;

/** The principal stored in the security context for an authenticated request. */
public record AuthenticatedUser(long id, String username) {
}
