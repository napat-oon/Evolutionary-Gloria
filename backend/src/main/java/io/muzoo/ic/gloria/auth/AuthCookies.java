package io.muzoo.ic.gloria.auth;

import io.muzoo.ic.gloria.config.JwtProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.Optional;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/** Builds and reads the httpOnly auth cookies. */
@Component
public class AuthCookies {

    public static final String ACCESS_COOKIE = "gloria_access";
    public static final String REFRESH_COOKIE = "gloria_refresh";
    private static final String REFRESH_PATH = "/api/auth";

    private final JwtProperties properties;

    public AuthCookies(JwtProperties properties) {
        this.properties = properties;
    }

    public ResponseCookie accessCookie(String token) {
        return build(ACCESS_COOKIE, token, "/", properties.accessTtl().toSeconds());
    }

    public ResponseCookie refreshCookie(String token) {
        return build(REFRESH_COOKIE, token, REFRESH_PATH, properties.refreshTtl().toSeconds());
    }

    public ResponseCookie expiredAccessCookie() {
        return build(ACCESS_COOKIE, "", "/", 0);
    }

    public ResponseCookie expiredRefreshCookie() {
        return build(REFRESH_COOKIE, "", REFRESH_PATH, 0);
    }

    public Optional<String> readAccessToken(HttpServletRequest request) {
        return readCookie(request, ACCESS_COOKIE);
    }

    public Optional<String> readRefreshToken(HttpServletRequest request) {
        return readCookie(request, REFRESH_COOKIE);
    }

    private ResponseCookie build(String name, String value, String path, long maxAgeSeconds) {
        return ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(properties.secureCookies())
                .sameSite("Strict")
                .path(path)
                .maxAge(maxAgeSeconds)
                .build();
    }

    private Optional<String> readCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        return Arrays.stream(cookies)
                .filter(c -> name.equals(c.getName()))
                .map(Cookie::getValue)
                .filter(v -> !v.isBlank())
                .findFirst();
    }
}
