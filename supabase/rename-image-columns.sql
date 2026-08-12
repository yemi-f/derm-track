-- IMPLEMENTATION.md §5 specifies *_path column names (a storage path is stored, never
-- a URL — see CLAUDE.md non-negotiable #2). The live schema had these as *_url instead.
-- App code already writes/reads the *_path names; this migration brings the DB in line.

alter table visits rename column original_image_url to original_image_path;
alter table concern_scores rename column mask_image_url to mask_image_path;
alter table simulations rename column simulated_image_url to simulated_image_path;
