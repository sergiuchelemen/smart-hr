package ro.smarthr.leave;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;

/** Global, nu e tenant-scoped. */
@Entity
@Table(name = "public_holiday")
public class PublicHoliday {

    @Id
    @Column(name = "holiday_date")
    private LocalDate holidayDate;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    protected PublicHoliday() {
    }

    public LocalDate getHolidayDate() {
        return holidayDate;
    }

    public String getName() {
        return name;
    }
}
