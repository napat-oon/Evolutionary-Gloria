package io.muzoo.ic.gloria.auth;

import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Shows the reset token directly in the API response instead of emailing it.
 * Swap this bean for an SMTP-backed sender to deliver real emails.
 */
@Component
public class OnScreenResetTokenSender implements ResetTokenSender {

    @Override
    public Optional<String> deliver(String email, String username, String rawToken) {
        return Optional.of(rawToken);
    }
}
