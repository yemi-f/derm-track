-- Row Level Security for visits, concern_scores, treatment_selections, simulations,
-- per IMPLEMENTATION.md §5: rows scoped to auth.uid(), joined through visits.user_id
-- for the child tables. Safe to re-run (drop-if-exists before each create).

alter table visits enable row level security;
alter table concern_scores enable row level security;
alter table treatment_selections enable row level security;
alter table simulations enable row level security;

drop policy if exists "Users manage own visits" on visits;
create policy "Users manage own visits"
on visits for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users manage own concern_scores" on concern_scores;
create policy "Users manage own concern_scores"
on concern_scores for all
using (exists (
  select 1 from visits where visits.id = concern_scores.visit_id and visits.user_id = auth.uid()
))
with check (exists (
  select 1 from visits where visits.id = concern_scores.visit_id and visits.user_id = auth.uid()
));

drop policy if exists "Users manage own treatment_selections" on treatment_selections;
create policy "Users manage own treatment_selections"
on treatment_selections for all
using (exists (
  select 1 from visits where visits.id = treatment_selections.visit_id and visits.user_id = auth.uid()
))
with check (exists (
  select 1 from visits where visits.id = treatment_selections.visit_id and visits.user_id = auth.uid()
));

drop policy if exists "Users manage own simulations" on simulations;
create policy "Users manage own simulations"
on simulations for all
using (exists (
  select 1 from visits where visits.id = simulations.visit_id and visits.user_id = auth.uid()
))
with check (exists (
  select 1 from visits where visits.id = simulations.visit_id and visits.user_id = auth.uid()
));
