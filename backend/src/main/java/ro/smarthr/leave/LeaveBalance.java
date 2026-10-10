package ro.smarthr.leave;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.util.UUID;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.TenantId;

@Entity
@DynamicUpdate
@Table(name = "leave_balance")
public class LeaveBalance {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "company_id", nullable = false, updatable = false)
    private UUID companyId;

    @Column(name = "employee_id", nullable = false, updatable = false)
    private UUID employeeId;

    @Column(name = "year", nullable = false, updatable = false)
    private int year;

    @Column(name = "entitled_days", nullable = false)
    private int entitledDays;

    @Column(name = "carried_over_days", nullable = false)
    private int carriedOverDays;

    @Column(name = "used_days", nullable = false)
    private int usedDays;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected LeaveBalance() {
    }

    public LeaveBalance(UUID employeeId, int year, int entitledDays, int carriedOverDays) {
        this.employeeId = employeeId;
        this.year = year;
        this.entitledDays = entitledDays;
        this.carriedOverDays = carriedOverDays;
    }

    public int available() {
        return entitledDays + carriedOverDays - usedDays;
    }

    public void setAllowances(int entitledDays, int carriedOverDays) {
        this.entitledDays = entitledDays;
        this.carriedOverDays = carriedOverDays;
    }

    public void addUsed(int days) {
        this.usedDays += days;
    }

    public void releaseUsed(int days) {
        this.usedDays = Math.max(0, this.usedDays - days);
    }

    public int getYear() {
        return year;
    }

    public int getEntitledDays() {
        return entitledDays;
    }

    public int getCarriedOverDays() {
        return carriedOverDays;
    }

    public int getUsedDays() {
        return usedDays;
    }
}
