package ro.smarthr.platform;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ro.smarthr.common.MaxUtf8Bytes;

@RestController
@RequestMapping("/api/platform/companies")
public class CompanyController {

    public record CreateCompanyRequest(
        @NotBlank @Size(max = 200) String name,
        @NotBlank @Pattern(regexp = "^[a-z0-9-]{3,32}$") String code,
        @NotBlank @Email @Size(max = 254) String adminEmail,
        @NotBlank @Size(min = 12) @MaxUtf8Bytes(72) String adminPassword) {
    }

    public record CompanyResponse(UUID id, String name, String code, Instant createdAt, boolean enabled) {
        static CompanyResponse from(Company c) {
            return new CompanyResponse(c.getId(), c.getName(), c.getCode(), c.getCreatedAt(), c.isEnabled());
        }
    }

    public record CompanyDetail(UUID id, String name, String code, Instant createdAt, boolean enabled,
                                long usersTotal, long usersActive, long adminsActive) {
    }

    public record UpdateEnabledRequest(@NotNull Boolean enabled) {
    }

    public record AddAdminRequest(@NotBlank @Email @Size(max = 254) String email,
                                  @NotBlank @Size(min = 12) @MaxUtf8Bytes(72) String password) {
    }

    public record IdResponse(UUID id) {
    }

    private final CompanyProvisioningService provisioning;
    private final CompanyRepository companies;
    private final CompanyAdminService admin;

    public CompanyController(CompanyProvisioningService provisioning, CompanyRepository companies,
                             CompanyAdminService admin) {
        this.provisioning = provisioning;
        this.companies = companies;
        this.admin = admin;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    public CompanyResponse create(@Valid @RequestBody CreateCompanyRequest request) {
        return CompanyResponse.from(provisioning.createCompany(
            request.name().trim(), request.code(), request.adminEmail(), request.adminPassword()));
    }

    @GetMapping
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    public List<CompanyResponse> list() {
        return companies.findAll().stream()
            .sorted(java.util.Comparator.comparing(Company::getName, String.CASE_INSENSITIVE_ORDER))
            .map(CompanyResponse::from).toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    public CompanyDetail get(@PathVariable UUID id) {
        return admin.detail(id);
    }

    @PutMapping("/{id}/enabled")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    public CompanyDetail setEnabled(@PathVariable UUID id, @Valid @RequestBody UpdateEnabledRequest request) {
        return admin.setEnabled(id, request.enabled());
    }

    @PostMapping("/{id}/admins")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    public IdResponse addAdmin(@PathVariable UUID id, @Valid @RequestBody AddAdminRequest request) {
        return new IdResponse(admin.addAdmin(id, request.email(), request.password()));
    }
}
