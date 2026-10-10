package ro.smarthr.org;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Filtrul de tenant (@TenantId) se aplică tuturor interogărilor JPQL de mai jos. */
public interface PositionRepository extends JpaRepository<Position, UUID> {

    @Query("select count(p) > 0 from Position p where lower(p.name) = lower(:name)")
    boolean existsByNameIgnoreCase(@Param("name") String name);

    @Query("select count(p) > 0 from Position p where lower(p.name) = lower(:name) and p.id <> :id")
    boolean existsByNameIgnoreCaseAndIdNot(@Param("name") String name, @Param("id") UUID id);

    @Query("select p from Position p where p.id in :ids")
    List<Position> findAllByIdIn(@Param("ids") Collection<UUID> ids);
}
