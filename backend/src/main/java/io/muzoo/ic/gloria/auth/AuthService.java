package io.muzoo.ic.gloria.auth;

import io.muzoo.ic.gloria.user.User;

public interface AuthService {

    User register(String username, String email, String rawPassword);

    /** @throws io.muzoo.ic.gloria.common.ApiException with 401 when credentials are wrong */
    User authenticate(String usernameOrEmail, String rawPassword);

    /** Verifies a refresh token and returns the user it belongs to. */
    User authenticateRefreshToken(String refreshToken);
}
