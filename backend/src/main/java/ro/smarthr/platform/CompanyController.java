package ro.smarthr.platform;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/platform/companies")
public class CompanyController {

    public record CreateCompanyRequest(
        @NotBlank @Size(max = 200) String name,
        @NotBlank @Pattern(regexp = "^[a-z0-9-]{3,32}$") String code,
        @NotBlank @Email @Size(max = 254) String adminEmail,
        @NotBlank @Size(min = 12, max = 72) String adminPassword) {
    }

    public record CompanyResponse(UUID id, String name, String code, Instant createdAt) {
        static CompanyResponse from(Company c) {
            return new CompanyResponse(c.getId(), c.getName(), c.getCode(), c.getCreatedAt());
        }
    }

    private final CompanyProvisioningService provisioning;
    private final CompanyRepository companies;

    public CompanyController(CompanyProvisioningService provisioning, CompanyRepository companies) {
        this.provisioning = provisioning;
        this.companies = companies;
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
        return companies.findAll().stream().map(CompanyResponse::from).toList();
    }
}
