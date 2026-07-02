package io.muzoo.ic.gloria.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "gloria.jwt")
public record JwtProperties(
        String secret,
        Duration accessTtl,
        Duration refreshTtl,
        boolean secureCookies) {
}
