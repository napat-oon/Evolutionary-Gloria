package io.muzoo.ic.gloria.auth;

import io.muzoo.ic.gloria.common.ApiException;
import io.muzoo.ic.gloria.user.User;
import io.muzoo.ic.gloria.user.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthServiceImpl implements AuthService {

    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthServiceImpl(UserService userService, PasswordEncoder passwordEncoder,
            JwtService jwtService) {
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Override
    public User register(String username, String email, String rawPassword) {
        return userService.register(username, email, rawPassword);
    }

    @Override
    public User authenticate(String usernameOrEmail, String rawPassword) {
        return userService.findByLogin(usernameOrEmail)
                .filter(user -> passwordEncoder.matches(rawPassword, user.getPasswordHash()))
                .orElseThrow(() -> new ApiException(
                        HttpStatus.UNAUTHORIZED, "Invalid username or password"));
    }

    @Override
    public User authenticateRefreshToken(String refreshToken) {
        return jwtService.verify(refreshToken, JwtService.TokenType.REFRESH)
                .flatMap(claims -> userService.findById(claims.userId()))
                .orElseThrow(() -> new ApiException(
                        HttpStatus.UNAUTHORIZED, "Refresh token is invalid or expired"));
    }
}
