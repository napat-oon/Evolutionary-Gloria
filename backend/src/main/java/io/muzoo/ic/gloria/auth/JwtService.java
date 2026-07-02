package io.muzoo.ic.gloria.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.muzoo.ic.gloria.config.JwtProperties;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import javax.crypto.SecretKey;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

/** Mints and verifies the access and refresh JWTs. Nothing else. */
@Component
public class JwtService {

    public enum TokenType { ACCESS, REFRESH }

    private static final String TYPE_CLAIM = "typ";

    private final SecretKey key;
    private final JwtProperties properties;

    public JwtService(JwtProperties properties) {
        this.key = Keys.hmacShaKeyFor(properties.secret().getBytes(StandardCharsets.UTF_8));
        this.properties = properties;
    }

    public String mintAccessToken(long userId, String username) {
        return mint(userId, username, TokenType.ACCESS, properties.accessTtl());
    }

    public String mintRefreshToken(long userId, String username) {
        return mint(userId, username, TokenType.REFRESH, properties.refreshTtl());
    }

    private String mint(long userId, String username, TokenType type, Duration ttl) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(Long.toString(userId))
                .claim("username", username)
                .claim(TYPE_CLAIM, type.name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    /** Returns the token's claims if it is valid, unexpired and of the expected type. */
    public Optional<TokenClaims> verify(String token, TokenType expectedType) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(token)
                    .getPayload();
            if (!expectedType.name().equals(claims.get(TYPE_CLAIM, String.class))) {
                return Optional.empty();
            }
            return Optional.of(new TokenClaims(
                    Long.parseLong(claims.getSubject()),
                    claims.get("username", String.class)));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    public record TokenClaims(long userId, String username) {
    }
}
