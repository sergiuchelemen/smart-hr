package ro.smarthr.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Răspunsuri de eroare generice (RFC 7807). Fără stack trace și fără ecou al input-ului,
 * pentru a nu expune sau loga date personale.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetail> handleValidation(MethodArgumentNotValidException ex) {
        return build(HttpStatus.BAD_REQUEST, "Date invalide.");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ProblemDetail> handleNotFound(NoResourceFoundException ex) {
        return build(HttpStatus.NOT_FOUND, "Resursa nu a fost găsită.");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleGeneric(Exception ex) {
        // Se loghează doar tipul excepției, nu mesajul (poate conține date personale).
        log.error("Eroare neașteptată: {}", ex.getClass().getName());
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "A apărut o eroare internă.");
    }

    private ResponseEntity<ProblemDetail> build(HttpStatus status, String detail) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detail);
        pd.setTitle(status.getReasonPhrase());
        return ResponseEntity.status(status).body(pd);
    }
}
