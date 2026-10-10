package ro.smarthr.iam;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/permissions")
public class PermissionController {

    public record PermissionResponse(String code, String description) {
    }

    private final PermissionRepository permissions;

    public PermissionController(PermissionRepository permissions) {
        this.permissions = permissions;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PERM_ROLE_MANAGE')")
    public List<PermissionResponse> list() {
        return permissions.findAll().stream()
            .map(p -> new PermissionResponse(p.getCode(), p.getDescription()))
            .sorted(java.util.Comparator.comparing(PermissionResponse::code)).toList();
    }
}
