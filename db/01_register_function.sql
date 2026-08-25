-- Function to safely handle course registration without race conditions
CREATE OR REPLACE FUNCTION register_for_course(
    target_course_id INT,
    target_student_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    -- 'FOR UPDATE' locks the specific course row so no other request can read/modify it simultaneously
    IF EXISTS (
        SELECT 1 
        FROM courses 
        WHERE id = target_course_id AND seats > 0 
        FOR UPDATE
    ) THEN
        -- 1. Decrement available seats
        UPDATE courses 
        SET seats = seats - 1 
        WHERE id = target_course_id;

        -- 2. Create enrollment record
        INSERT INTO enrollments (course_id, student_id, status) 
        VALUES (target_course_id, target_student_id, 'registered');

        RETURN TRUE; -- Registration successful
    ELSE
        RETURN FALSE; -- Course is full or doesn't exist
    END IF;
END;
$$;