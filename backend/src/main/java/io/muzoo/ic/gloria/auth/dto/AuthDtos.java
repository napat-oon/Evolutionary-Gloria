package io.muzoo.ic.gloria.auth.dto;

import io.muzoo.ic.gloria.user.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank @Size(min = 3, max = 32)
            @Pattern(regexp = "[A-Za-z0-9_]+", message = "letters, digits and underscore only")
            String username,
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(min = 8, max = 72) String password) {
    }

    public record LoginRequest(
            @NotBlank String usernameOrEmail,
            @NotBlank String password) {
    }

    public record ForgotPasswordRequest(@NotBlank String usernameOrEmail) {
    }

    public record ResetPasswordRequest(
            @NotBlank String token,
            @NotBlank @Size(min = 8, max = 72) String newPassword) {
    }

    public record UserResponse(long id, String username, int wins, int points, int potions) {

        public static UserResponse from(User user) {
            return new UserResponse(user.getId(), user.getUsername(),
                    user.getWins(), user.getPoints(), user.getPotions());
        }
    }

    public record ForgotPasswordResponse(String message, String resetToken) {
    }

    public record MessageResponse(String message) {
    }
}
