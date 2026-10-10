package ro.smarthr.employee;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.TenantId;

@Entity
@DynamicUpdate
@Table(name = "employee")
public class Employee {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "company_id", nullable = false, updatable = false)
    private UUID companyId;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @Column(name = "work_email", length = 254)
    private String workEmail;

    @Column(name = "position_id")
    private UUID positionId;

    @Column(name = "department_id")
    private UUID departmentId;

    @Column(name = "hire_date")
    private LocalDate hireDate;

    /** Nemodificabile prin entitate: se scriu doar prin interogările dedicate din EmployeeRepository. */
    @Column(name = "user_id", updatable = false)
    private UUID userId;

    @Column(name = "manager_id", updatable = false)
    private UUID managerId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected Employee() {
    }

    public Employee(String firstName, String lastName, String workEmail, UUID positionId, UUID departmentId,
                    LocalDate hireDate) {
        update(firstName, lastName, workEmail, positionId, departmentId, hireDate);
    }

    public void update(String firstName, String lastName, String workEmail, UUID positionId, UUID departmentId,
                       LocalDate hireDate) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.workEmail = workEmail;
        this.positionId = positionId;
        this.departmentId = departmentId;
        this.hireDate = hireDate;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public UUID getManagerId() {
        return managerId;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public String getWorkEmail() {
        return workEmail;
    }

    public UUID getPositionId() {
        return positionId;
    }

    public UUID getDepartmentId() {
        return departmentId;
    }

    public LocalDate getHireDate() {
        return hireDate;
    }
}
