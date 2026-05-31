## Problem
W widoku tygodnia kalendarza po złapaniu wydarzenia myszą natychmiast „skacze" ono tak, by jego środek znalazł się pod kursorem (chwyt za górę = skok w górę, chwyt za dół = skok w dół).

## Przyczyna
W `src/components/dashboard/CalendarTab.tsx`, w `handleMouseMove` dla trybu `move` (linia 907):
```ts
const newStart = snapMin(yToMin(y) - duration / 2);
```
Pozycja startu wydarzenia jest liczona tak, by kursor wypadał w połowie wydarzenia — ignorując miejsce, w którym użytkownik faktycznie kliknął.

## Rozwiązanie
Zapamiętać offset chwytu (różnicę między pozycją kursora a początkiem wydarzenia w momencie `mousedown`) i używać go przy przesuwaniu, tak aby wydarzenie nie skakało — przemieszczało się dopiero proporcjonalnie do ruchu myszy.

### Zmiany w `src/components/dashboard/CalendarTab.tsx`

1. **`DragState`** (ok. linii 17): dodać pole `grabOffsetMin?: number`.

2. **`handleEventMouseDown`** (linia 856–872, tylko dla `mode === "move"`):
   - Po wyliczeniu `y` i `sm`, policzyć `grabOffsetMin = yToMin(y) - sm` (ile minut „w głąb" wydarzenia użytkownik kliknął).
   - Zapisać `grabOffsetMin` w `dragRef.current`.

3. **`handleMouseMove`, blok `move`** (linia 898–914):
   - Zamiast `yToMin(y) - duration / 2` użyć:
     ```ts
     const newStart = snapMin(yToMin(y) - (drag.grabOffsetMin ?? 0));
     ```
   - Reszta (clamp 0..1440-duration, aktualizacja eventu) bez zmian.

Dzięki temu w momencie pierwszego ruchu myszy delta jest zerowa → brak skoku; wydarzenie podąża dokładnie za ruchem kursora niezależnie od miejsca chwytu.

## Poza zakresem
- Tryb `resize` i `create` zostają bez zmian.
- Brak zmian w UI, stylach, danych ani migracjach SQL.
