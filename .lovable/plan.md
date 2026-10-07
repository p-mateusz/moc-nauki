# Ręczne wysyłanie notatek użytkownikom (panel admina)

## Co zobaczy administrator
W panelu administratora nowa sekcja **„Wyślij notatkę"**:
1. Duże pole do wklejenia kodu z n8n (format `title:` / `text:` oraz opcjonalnie wydarzenia `name:` / `description:` / `eventDate:` / `eventTime:`).
2. Podgląd: tytuł, fragment treści i lista wykrytych wydarzeń (np. „Polski – sprawdzian, 12.10.2026, cały dzień").
3. Wybór użytkownika z wyszukiwarką (imię / nazwa konta / e-mail).
4. Przycisk „Wyślij". Poniżej lista wysłanych notatek ze statusem: oczekuje / przyjęta / odrzucona.

## Co zobaczy użytkownik
Po najbliższym otwarciu aplikacji (po zalogowaniu) wyskakuje okno:
- „Masz nową notatkę", tytuł i pierwsze ~200 znaków treści.
- Wybór notesu i sekcji (domyślnie pierwszy notes i jego pierwsza sekcja).
- **Przyjmij** → notatka trafia jako nowa strona do wybranej sekcji, a wydarzenia (jeśli są) do kalendarza, tak samo jak przy nagraniu.
- **Odrzuć** → znika na zawsze.
Jeśli czeka kilka notatek, pokazują się po kolei.

## SQL do wklejenia w Supabase
Aplikacja korzysta z Twojej bazy Supabase, więc po zatwierdzeniu planu wyślę Ci ten kod:

```sql
create table public.pending_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  content text not null,
  events jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  created_by uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
grant select, insert, update on public.pending_notes to authenticated;
grant all on public.pending_notes to service_role;
alter table public.pending_notes enable row level security;
create policy "admin all" on public.pending_notes for all to authenticated
  using (public.get_user_role(auth.uid()) = 'admin')
  with check (public.get_user_role(auth.uid()) = 'admin');
create policy "owner read" on public.pending_notes for select to authenticated
  using (user_id = auth.uid());
create policy "owner resolve" on public.pending_notes for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status in ('accepted','rejected'));
```

## Szczegóły techniczne
- Parser (wspólny plik w `src/lib`): dzieli tekst na bloki `klucz:wartość`, zamienia `\n` na nowe linie; obsługuje też wklejony JSON w tym samym kształcie co odpowiedź webhooka. `eventTime: cd` → wydarzenie całodniowe (jak w nagrywaniu).
- Panel admina: nowy komponent wpięty w `AdminUsersTab.tsx`, zapis bezpośrednio do `pending_notes` (RLS sprawdza rolę admina).
- Użytkownik: komponent `PendingNoteDialog` montowany w `MocDashboard.tsx`; pobiera notatki `status='pending'`, przy przyjęciu wstawia rekord do `notebook_pages` (sort_order na końcu sekcji) i wydarzenia do `calendar_events`, następnie ustawia `status='accepted'`; odrzucenie ustawia `status='rejected'`. Po przyjęciu zakładka Notatki odświeża dane.
- Nie zmieniam nagrywania ani webhooków.
