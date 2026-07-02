package io.muzoo.ic.gloria.common;

import org.springframework.http.HttpStatus;

/** Business-rule violation carrying the HTTP status it should map to. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
