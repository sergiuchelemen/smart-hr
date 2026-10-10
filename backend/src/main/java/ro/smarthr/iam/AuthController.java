package ro.smarthr.iam;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ro.smarthr.common.TokenResponse;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record LoginRequest(@NotBlank @Size(max = 64) String companyCode,
                               @NotBlank @Size(max = 254) String email,
                               @NotBlank @Size(max = 200) String password) {
    }

    private final AuthService service;

    public AuthController(AuthService service) {
        this.service = service;
    }

    /** Public (permitAll în SecurityConfig). */
    @PostMapping("/login")
    @PreAuthorize("permitAll()")
    public TokenResponse login(@Valid @RequestBody LoginRequest request) {
        return service.login(request.companyCode(), request.email(), request.password());
    }
}
