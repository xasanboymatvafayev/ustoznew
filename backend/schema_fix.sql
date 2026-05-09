-- Add unique constraint for scores (needed for ON CONFLICT)
ALTER TABLE scores ADD CONSTRAINT unique_user_assignment UNIQUE (user_id, assignment_id);
ALTER TABLE scores ADD CONSTRAINT unique_user_group_date UNIQUE (user_id, group_id, lesson_date);
