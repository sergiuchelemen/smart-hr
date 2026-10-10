package ro.smarthr.timesheet;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import ro.smarthr.tenancy.mongo.TenantScoped;

/** Fără nume, CNP, salariu sau motive medicale: doar referințe (angajatul se rezolvă din Postgres). */
@Document("timesheet_entries")
public class TimesheetEntry implements TenantScoped {

    @Id
    private String id;
    private UUID companyId;
    private UUID employeeId;
    /** YYYY-MM-DD */
    private String date;
    private int minutes;
    private TimesheetEntryType type;
    private String note;
    private Instant updatedAt;
    private UUID updatedByUserId;

    public TimesheetEntry() {
    }

    @Override
    public UUID getCompanyId() {
        return companyId;
    }

    @Override
    public void setCompanyId(UUID companyId) {
        this.companyId = companyId;
    }

    public UUID getEmployeeId() {
        return employeeId;
    }

    public String getDate() {
        return date;
    }

    public int getMinutes() {
        return minutes;
    }

    public TimesheetEntryType getType() {
        return type;
    }

    public String getNote() {
        return note;
    }
}
