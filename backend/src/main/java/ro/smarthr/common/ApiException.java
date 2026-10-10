package ro.smarthr.common;

import org.springframework.http.HttpStatus;

/** Eroare de business cu status HTTP; mesajul trebuie să fie o constantă (fără input utilizator). */
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
