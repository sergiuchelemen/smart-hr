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
import org.hibernate.annotations.TenantId;

@Entity
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

    @Column(name = "job_title", length = 150)
    private String jobTitle;

    @Column(name = "department", length = 150)
    private String department;

    @Column(name = "hire_date")
    private LocalDate hireDate;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "manager_id")
    private UUID managerId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected Employee() {
    }

    public Employee(String firstName, String lastName, String workEmail, String jobTitle, String department,
                    LocalDate hireDate) {
        update(firstName, lastName, workEmail, jobTitle, department, hireDate);
    }

    public void update(String firstName, String lastName, String workEmail, String jobTitle, String department,
                       LocalDate hireDate) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.workEmail = workEmail;
        this.jobTitle = jobTitle;
        this.department = department;
        this.hireDate = hireDate;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public UUID getManagerId() {
        return managerId;
    }

    public void setManagerId(UUID managerId) {
        this.managerId = managerId;
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

    public String getJobTitle() {
        return jobTitle;
    }

    public String getDepartment() {
        return department;
    }

    public LocalDate getHireDate() {
        return hireDate;
    }
}
