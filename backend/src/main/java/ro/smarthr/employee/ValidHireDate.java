package ro.smarthr.employee;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.time.LocalDate;

/** Data angajării: între 1900-01-01 și cel mult 1 an în viitor (null acceptat). */
@Documented
@Constraint(validatedBy = ValidHireDate.Validator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidHireDate {

    String message() default "Data angajării invalidă.";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<ValidHireDate, LocalDate> {
        private static final LocalDate MIN_DATE = LocalDate.of(1900, 1, 1);

        @Override
        public boolean isValid(LocalDate value, ConstraintValidatorContext ctx) {
            return value == null
                || (!value.isBefore(MIN_DATE) && !value.isAfter(LocalDate.now().plusYears(1)));
        }
    }
}
