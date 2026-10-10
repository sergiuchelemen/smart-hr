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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
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

    /** Eșec de autentificare: mereu același răspuns generic. */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Object> handleAuthentication(AuthenticationException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, Messages.BAD_CREDENTIALS);
        pd.setTitle(HttpStatus.UNAUTHORIZED.getReasonPhrase());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(pd);
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Object> handleApi(ApiException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(ex.getStatus(), ex.getMessage());
        pd.setTitle(ex.getStatus().getReasonPhrase());
        return ResponseEntity.status(ex.getStatus()).body(pd);
    }

    /**
     * Încălcări de constrângeri DB, mapate după SQLState; mesajele sunt constante (fără detalii despre
     * constrângeri sau date). 23P01 => 409 cu mesajul de suprapunere, 23505/23503 => 409, 23514 => 400; restul rămân 500.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Object> handleIntegrity(DataIntegrityViolationException ex) {
        String state = sqlState(ex);
        if (state == null) {
            return handleGeneric(ex);
        }
        switch (state) {
            case "23P01" -> {
                ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, Messages.LEAVE_OVERLAP);
                pd.setTitle(HttpStatus.CONFLICT.getReasonPhrase());
                return ResponseEntity.status(HttpStatus.CONFLICT).body(pd);
            }
            case "23505", "23503" -> {
                ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                    "Conflict cu datele existente.");
                pd.setTitle(HttpStatus.CONFLICT.getReasonPhrase());
                return ResponseEntity.status(HttpStatus.CONFLICT).body(pd);
            }
            case "23514" -> {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem(HttpStatus.BAD_REQUEST));
            }
            default -> {
                return handleGeneric(ex);
            }
        }
    }

    /** Conflict de concurență (lock/versiune): 409 cu mesaj constant. */
    @ExceptionHandler({org.springframework.dao.PessimisticLockingFailureException.class,
        org.springframework.orm.ObjectOptimisticLockingFailureException.class})
    public ResponseEntity<Object> handleConcurrency(Exception ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, Messages.CONCURRENT_UPDATE);
        pd.setTitle(HttpStatus.CONFLICT.getReasonPhrase());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(pd);
    }

    private static String sqlState(Throwable ex) {
        for (Throwable t = ex; t != null; t = t.getCause()) {
            if (t instanceof java.sql.SQLException sql && sql.getSQLState() != null) {
                return sql.getSQLState();
            }
            if (t.getCause() == t) {
                break;
            }
        }
        return null;
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleGeneric(Exception ex) {
        ProblemDetail pd = problem(HttpStatus.INTERNAL_SERVER_ERROR);
        logServerError(ex, pd);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(pd);
    }

    /** Se loghează doar clasa excepției + errorId + SQLState (cod de 5 caractere), nu mesajul (poate conține date personale). */
    private static void logServerError(Exception ex, ProblemDetail pd) {
        String errorId = UUID.randomUUID().toString();
        String state = sqlState(ex);
        if (state != null) {
            log.error("Eroare neașteptată [errorId={}]: {} (sqlState={})", errorId, ex.getClass().getName(), state);
        } else {
            log.error("Eroare neașteptată [errorId={}]: {}", errorId, ex.getClass().getName());
        }
        pd.setProperty("errorId", errorId);
    }

    /** Toate excepțiile tratate de clasa de bază primesc un detail generic (fără ecou de input). */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception ex, @Nullable Object body,
            HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        ResponseEntity<Object> response = super.handleExceptionInternal(ex, body, headers, statusCode, request);
        if (response != null && response.getBody() instanceof ProblemDetail pd) {
            pd.setDetail(genericDetail(statusCode));
            if (statusCode.is5xxServerError()) {
                logServerError(ex, pd);
            }
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
