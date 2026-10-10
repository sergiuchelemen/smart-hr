package ro.smarthr.common;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Răspunsuri de eroare generice (RFC 7807). Excepțiile Spring MVC cu status 4xx păstrează statusul
 * corect (via ResponseEntityExceptionHandler); mesajele sunt generice, fără ecou al input-ului,
 * pentru a nu expune sau loga date personale. Doar excepțiile neașteptate devin 500.
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** AuthorizationDeniedException (din @PreAuthorize) extinde AccessDeniedException. */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Object> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(problem(HttpStatus.FORBIDDEN));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleGeneric(Exception ex) {
        String errorId = UUID.randomUUID().toString();
        // Se loghează doar tipul excepției, nu mesajul (poate conține date personale).
        log.error("Eroare neașteptată [errorId={}]: {}", errorId, ex.getClass().getName());
        ProblemDetail pd = problem(HttpStatus.INTERNAL_SERVER_ERROR);
        pd.setProperty("errorId", errorId);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(pd);
    }

    /** Toate excepțiile tratate de clasa de bază primesc un detail generic (fără ecou de input). */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception ex, @Nullable Object body,
            HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        ResponseEntity<Object> response = super.handleExceptionInternal(ex, body, headers, statusCode, request);
        if (response != null && response.getBody() instanceof ProblemDetail pd) {
            pd.setDetail(genericDetail(statusCode));
        }
        return response;
    }

    private static ProblemDetail problem(HttpStatus status) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, genericDetail(status));
        pd.setTitle(status.getReasonPhrase());
        return pd;
    }

    private static String genericDetail(HttpStatusCode status) {
        return switch (status.value()) {
            case 400 -> "Cerere invalidă.";
            case 403 -> "Acces interzis.";
            case 404 -> "Resursa nu a fost găsită.";
            case 405 -> "Metodă nepermisă.";
            case 406 -> "Format nepermis.";
            case 415 -> "Tip de conținut nesuportat.";
            case 500 -> "A apărut o eroare internă.";
            default -> status.is4xxClientError() ? "Cerere invalidă." : "A apărut o eroare.";
        };
    }
}
