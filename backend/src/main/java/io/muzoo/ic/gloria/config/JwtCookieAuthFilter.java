package io.muzoo.ic.gloria.config;

import io.muzoo.ic.gloria.auth.AuthCookies;
import io.muzoo.ic.gloria.auth.AuthenticatedUser;
import io.muzoo.ic.gloria.auth.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Authenticates requests that carry a valid access-token cookie. */
@Component
public class JwtCookieAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final AuthCookies authCookies;

    public JwtCookieAuthFilter(JwtService jwtService, AuthCookies authCookies) {
        this.jwtService = jwtService;
        this.authCookies = authCookies;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        authCookies.readAccessToken(request)
                .flatMap(token -> jwtService.verify(token, JwtService.TokenType.ACCESS))
                .ifPresent(claims -> {
                    var principal = new AuthenticatedUser(claims.userId(), claims.username());
                    var authentication = new UsernamePasswordAuthenticationToken(
                            principal, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                });
        filterChain.doFilter(request, response);
    }
}
