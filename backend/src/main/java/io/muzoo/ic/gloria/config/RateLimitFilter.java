package io.muzoo.ic.gloria.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Fixed-window in-memory rate limit for credential-guessing surfaces
 * (state-changing auth endpoints), keyed by client IP.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Duration WINDOW = Duration.ofMinutes(1);
    private static final int MAX_TRACKED_CLIENTS = 10_000;

    private final int maxRequestsPerWindow;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public RateLimitFilter(
            @Value("${gloria.rate-limit.auth-per-minute:15}") int maxRequestsPerWindow) {
        this.maxRequestsPerWindow = maxRequestsPerWindow;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equals(request.getMethod())
                || !request.getRequestURI().startsWith("/api/auth/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        long windowStart = System.currentTimeMillis() / WINDOW.toMillis();
        String key = clientIp(request) + ":" + windowStart;

        if (windows.size() > MAX_TRACKED_CLIENTS) {
            windows.keySet().removeIf(k -> !k.endsWith(":" + windowStart));
        }
        int count = windows.computeIfAbsent(key, k -> new Window()).count.incrementAndGet();
        if (count > maxRequestsPerWindow) {
            response.setStatus(429);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"detail\":\"Too many requests, slow down\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private String clientIp(HttpServletRequest request) {
        // Nginx terminates TLS in production and sets X-Forwarded-For.
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static final class Window {
        private final AtomicInteger count = new AtomicInteger();
    }
}
