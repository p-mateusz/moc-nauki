create or replace function public.user_note_counts()
returns table (user_id uuid, note_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select n.user_id, count(p.id)::bigint as note_count
  from public.notebooks n
  join public.notebook_sections s on s.notebook_id = n.id
  join public.notebook_pages p on p.section_id = s.id
  group by n.user_id
$$;

grant execute on function public.user_note_counts() to authenticated, service_role;