package io.muzoo.ic.gloria.auth;

import io.muzoo.ic.gloria.common.ApiException;
import io.muzoo.ic.gloria.user.User;
import io.muzoo.ic.gloria.user.UserService;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PasswordResetService {

    private static final Duration TOKEN_TTL = Duration.ofMinutes(15);

    private final PasswordResetTokenRepository tokenRepository;
    private final UserService userService;
    private final ResetTokenSender tokenSender;
    private final SecureRandom secureRandom = new SecureRandom();

    public PasswordResetService(PasswordResetTokenRepository tokenRepository,
            UserService userService, ResetTokenSender tokenSender) {
        this.tokenRepository = tokenRepository;
        this.userService = userService;
        this.tokenSender = tokenSender;
    }

    /**
     * Creates and delivers a reset token for the account, if it exists. Always
     * succeeds so callers cannot probe which accounts are registered.
     *
     * @return the raw token when the configured sender delivers on-screen
     */
    @Transactional
    public Optional<String> requestReset(String usernameOrEmail) {
        Optional<User> user = userService.findByLogin(usernameOrEmail);
        if (user.isEmpty()) {
            return Optional.empty();
        }
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        tokenRepository.save(new PasswordResetToken(
                user.get().getId(), sha256(rawToken), LocalDateTime.now().plus(TOKEN_TTL)));
        return tokenSender.deliver(user.get().getEmail(), user.get().getUsername(), rawToken);
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        PasswordResetToken token = tokenRepository.findByTokenHash(sha256(rawToken))
                .filter(PasswordResetToken::isUsable)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.BAD_REQUEST, "Reset token is invalid or expired"));
        User user = userService.findById(token.getUserId())
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Account no longer exists"));
        token.markUsed();
        tokenRepository.save(token);
        userService.changePassword(user, newPassword);
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
