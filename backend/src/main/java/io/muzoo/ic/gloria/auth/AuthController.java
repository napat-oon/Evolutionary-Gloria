package io.muzoo.ic.gloria.auth;

import io.muzoo.ic.gloria.auth.dto.AuthDtos.ForgotPasswordRequest;
import io.muzoo.ic.gloria.auth.dto.AuthDtos.ForgotPasswordResponse;
import io.muzoo.ic.gloria.auth.dto.AuthDtos.LoginRequest;
import io.muzoo.ic.gloria.auth.dto.AuthDtos.MessageResponse;
import io.muzoo.ic.gloria.auth.dto.AuthDtos.RegisterRequest;
import io.muzoo.ic.gloria.auth.dto.AuthDtos.ResetPasswordRequest;
import io.muzoo.ic.gloria.auth.dto.AuthDtos.UserResponse;
import io.muzoo.ic.gloria.common.ApiException;
import io.muzoo.ic.gloria.user.User;
import io.muzoo.ic.gloria.user.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final UserService userService;
    private final PasswordResetService passwordResetService;
    private final JwtService jwtService;
    private final AuthCookies authCookies;

    public AuthController(AuthService authService, UserService userService,
            PasswordResetService passwordResetService, JwtService jwtService,
            AuthCookies authCookies) {
        this.authService = authService;
        this.userService = userService;
        this.passwordResetService = passwordResetService;
        this.jwtService = jwtService;
        this.authCookies = authCookies;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse register(@Valid @RequestBody RegisterRequest request,
            HttpServletResponse response) {
        User user = authService.register(request.username(), request.email(), request.password());
        issueCookies(user, response);
        return UserResponse.from(user);
    }

    @PostMapping("/login")
    public UserResponse login(@Valid @RequestBody LoginRequest request,
            HttpServletResponse response) {
        User user = authService.authenticate(request.usernameOrEmail(), request.password());
        issueCookies(user, response);
        return UserResponse.from(user);
    }

    @PostMapping("/refresh")
    public UserResponse refresh(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = authCookies.readRefreshToken(request)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Not authenticated"));
        User user = authService.authenticateRefreshToken(refreshToken);
        issueCookies(user, response);
        return UserResponse.from(user);
    }

    @PostMapping("/logout")
    public MessageResponse logout(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, authCookies.expiredAccessCookie().toString());
        response.addHeader(HttpHeaders.SET_COOKIE, authCookies.expiredRefreshCookie().toString());
        return new MessageResponse("Logged out");
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal AuthenticatedUser principal) {
        if (principal == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        return userService.findById(principal.id())
                .map(UserResponse::from)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Not authenticated"));
    }

    @PostMapping("/forgot")
    public ForgotPasswordResponse forgot(@Valid @RequestBody ForgotPasswordRequest request) {
        String token = passwordResetService.requestReset(request.usernameOrEmail()).orElse(null);
        return new ForgotPasswordResponse(
                "If that account exists, a reset token has been issued", token);
    }

    @PostMapping("/reset")
    public MessageResponse reset(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request.token(), request.newPassword());
        return new MessageResponse("Password updated, you can log in now");
    }

    private void issueCookies(User user, HttpServletResponse response) {
        String access = jwtService.mintAccessToken(user.getId(), user.getUsername());
        String refresh = jwtService.mintRefreshToken(user.getId(), user.getUsername());
        response.addHeader(HttpHeaders.SET_COOKIE, authCookies.accessCookie(access).toString());
        response.addHeader(HttpHeaders.SET_COOKIE, authCookies.refreshCookie(refresh).toString());
    }
}
