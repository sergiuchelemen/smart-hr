package ro.smarthr.leave;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ro.smarthr.common.ApiException;
import ro.smarthr.common.Messages;

/** Zile lucrătoare: luni-vineri din [start, end] minus sărbătorile legale din tabelă. */
@Component
public class WorkingDaysCalculator {

    static final int MIN_YEAR = 2000;
    static final int MAX_YEAR = 2100;

    private final PublicHolidayRepository holidays;

    public WorkingDaysCalculator(PublicHolidayRepository holidays) {
        this.holidays = holidays;
    }

    /** Intervalul trebuie să fie ordonat și în același an; fără sărbători definite pentru an => 400. */
    @Transactional(readOnly = true)
    public int calculate(LocalDate start, LocalDate end) {
        if (end.isBefore(start)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.LEAVE_INVALID_INTERVAL);
        }
        if (start.getYear() != end.getYear()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.LEAVE_CROSS_YEAR);
        }
        int year = start.getYear();
        requireSupportedYear(year);
        if (!holidays.existsByHolidayDateBetween(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.CALENDAR_UNAVAILABLE);
        }
        Set<LocalDate> off = new HashSet<>(holidays.findDatesBetween(start, end));
        int days = 0;
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            DayOfWeek w = d.getDayOfWeek();
            if (w != DayOfWeek.SATURDAY && w != DayOfWeek.SUNDAY && !off.contains(d)) {
                days++;
            }
        }
        return days;
    }

    static void requireSupportedYear(int year) {
        if (year < MIN_YEAR || year > MAX_YEAR) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.CALENDAR_UNAVAILABLE);
        }
    }
}
