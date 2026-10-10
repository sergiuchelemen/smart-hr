package ro.smarthr.iam;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ro.smarthr.common.ApiException;

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
        String cid = jwt.getClaimAsString("cid");
        if (cid == null || !"tenant".equals(jwt.getClaimAsString("typ"))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Acces interzis.");
        }
        return service.me(UUID.fromString(jwt.getSubject()), UUID.fromString(cid));
    }
}
