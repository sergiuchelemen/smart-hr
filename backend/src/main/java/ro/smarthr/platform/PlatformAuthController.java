package ro.smarthr.platform;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;
import ro.smarthr.common.TokenResponse;

@RestController
@RequestMapping("/api/platform/auth")
public class PlatformAuthController {

    public record PlatformLoginRequest(@NotBlank @Size(max = 254) String email,
                                       @NotBlank @Size(max = 200) String password) {
    }

    private final PlatformAuthService service;

    public PlatformAuthController(PlatformAuthService service) {
        this.service = service;
    }

    /** Public (permitAll în SecurityConfig). */
    @PostMapping("/login")
    @PreAuthorize("permitAll()")
    public TokenResponse login(@Valid @RequestBody PlatformLoginRequest request) {
        return service.login(request.email(), request.password());
    }
}
