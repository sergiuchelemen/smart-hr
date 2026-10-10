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

/** Data angajării nu poate fi mai departe de 1 an în viitor (null acceptat). */
@Documented
@Constraint(validatedBy = ValidHireDate.Validator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidHireDate {

    String message() default "Data angajării invalidă.";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<ValidHireDate, LocalDate> {
        @Override
        public boolean isValid(LocalDate value, ConstraintValidatorContext ctx) {
            return value == null || !value.isAfter(LocalDate.now().plusYears(1));
        }
    }
}
