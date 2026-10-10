package ro.smarthr.iam;

import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
public class MeController {

    public record MeResponse(UserInfo user, CompanyInfo company, List<String> permissions) {
    }

    public record UserInfo(UUID id, String email) {
    }

    public record CompanyInfo(UUID id, String name, String code) {
    }

    private final MeService service;

    public MeController(MeService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public MeResponse me(@AuthenticationPrincipal Jwt jwt) {
        // 403 (nu 500) pentru token tenant cu sub/cid invalide.
        return service.me(CurrentUserPrivileges.userIdFromToken(), CurrentUserPrivileges.companyIdFromToken());
    }
}
