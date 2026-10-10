package ro.smarthr.iam;

import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ro.smarthr.common.ApiException;
import ro.smarthr.platform.Company;
import ro.smarthr.platform.CompanyRepository;

@Service
public class MeService {

    private final UserRepository users;
    private final CompanyRepository companies;

    public MeService(UserRepository users, CompanyRepository companies) {
        this.users = users;
        this.companies = companies;
    }

    @Transactional(readOnly = true)
    public MeController.MeResponse me(UUID userId, UUID companyId) {
        AppUser user = users.findById(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "Acces interzis."));
        Company company = companies.findById(companyId)
            .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "Acces interzis."));
        var perms = user.getRoles().stream().flatMap(r -> r.getPermissions().stream()).distinct().sorted().toList();
        return new MeController.MeResponse(
            new MeController.UserInfo(user.getId(), user.getEmail()),
            new MeController.CompanyInfo(company.getId(), company.getName(), company.getCode()),
            perms);
    }
}
