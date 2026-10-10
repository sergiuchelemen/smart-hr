package ro.smarthr.iam;

import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ro.smarthr.common.ApiException;
import ro.smarthr.employee.EmployeeRepository;
import ro.smarthr.platform.Company;
import ro.smarthr.platform.CompanyRepository;

@Service
public class MeService {

    private final UserRepository users;
    private final CompanyRepository companies;

    private final EmployeeRepository employees;

    public MeService(UserRepository users, CompanyRepository companies, EmployeeRepository employees) {
        this.employees = employees;
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
        MeController.EmployeeInfo employee = employees.findByUserId(userId)
            .map(e -> new MeController.EmployeeInfo(e.getId(), e.getFirstName(), e.getLastName(), e.getManagerId()))
            .orElse(null);
        return new MeController.MeResponse(
            new MeController.UserInfo(user.getId(), user.getEmail()),
            new MeController.CompanyInfo(company.getId(), company.getName(), company.getCode()),
            perms, employee, employee != null && employees.existsByManagerId(employee.id()));
    }
}
