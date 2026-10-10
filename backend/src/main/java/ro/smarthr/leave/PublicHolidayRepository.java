package ro.smarthr.leave;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PublicHolidayRepository extends JpaRepository<PublicHoliday, LocalDate> {

    boolean existsByHolidayDateBetween(LocalDate from, LocalDate to);

    @Query("select h.holidayDate from PublicHoliday h where h.holidayDate between :from and :to")
    List<LocalDate> findDatesBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("select h from PublicHoliday h where h.holidayDate >= :from order by h.holidayDate")
    List<PublicHoliday> findFrom(@Param("from") LocalDate from, org.springframework.data.domain.Pageable pageable);
}
