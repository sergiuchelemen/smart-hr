package ro.smarthr.org;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Filtrul de tenant (@TenantId) se aplică tuturor interogărilor JPQL de mai jos. */
public interface DepartmentRepository extends JpaRepository<Department, UUID> {

    @Query("select count(d) > 0 from Department d where lower(d.name) = lower(:name)")
    boolean existsByNameIgnoreCase(@Param("name") String name);

    @Query("select count(d) > 0 from Department d where lower(d.name) = lower(:name) and d.id <> :id")
    boolean existsByNameIgnoreCaseAndIdNot(@Param("name") String name, @Param("id") UUID id);

    boolean existsByParentId(UUID parentId);

    /** Rânduri [parentId, count]. */
    @Query("select d.parentId, count(d) from Department d where d.parentId is not null group by d.parentId")
    List<Object[]> countChildren();

    @Query("select d from Department d where d.id in :ids")
    List<Department> findAllByIdIn(@Param("ids") Collection<UUID> ids);
}
