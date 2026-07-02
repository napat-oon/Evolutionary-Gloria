package io.muzoo.ic.gloria.auth;

import java.util.Optional;

/**
 * Delivers a freshly minted password-reset token to the user.
 * Implementations decide the channel (on-screen, email, ...).
 */
public interface ResetTokenSender {

    /**
     * @return the raw token if it should be shown to the caller on screen,
     *         or empty when it was delivered out-of-band (e.g. email).
     */
    Optional<String> deliver(String email, String username, String rawToken);
}
