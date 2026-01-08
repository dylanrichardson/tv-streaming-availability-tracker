# Feature Backlog

## High Priority: Title Management

### 1. Search Before Import
**Problem:** Users can't preview what will be imported, leading to wrong matches (e.g., The Office UK vs US)

**Solution:**
- Add search functionality that shows JustWatch results BEFORE importing
- Display: title, year, type (movie/tv), poster, services currently available
- User selects exact match they want, then adds to tracking

**UI Flow:**
```
[Search Box: "The Office"] [Search Button]
  ↓
Results:
  [✓] The Office (2005) - TV Show - US
      Available on: Peacock
      [Add to Tracking]

  [ ] The Office (2001) - TV Show - UK
      Not currently streaming
      [Add to Tracking]
```

**Implementation:**
- Frontend: New search component with JustWatch results preview
- Backend: Already have `/api/sync` - just need to expose search separately
- Could reuse existing `searchTitle()` but show all results instead of just first

---

### 2. Remove Title from Tracking
**Problem:** No way to remove incorrectly imported titles

**Solution:**
- Add delete button on title cards
- Confirmation dialog: "Remove [Title] from tracking? This will delete all availability history."
- Backend: `DELETE /api/titles/:id`

**UI:**
```
[The Office]  [View History] [🗑️ Remove]
```

**Implementation:**
- Frontend: Add delete button to Watchlist.tsx title cards
- Backend: New route in worker/src/routes/titles.ts
  ```typescript
  export async function deleteTitle(db: D1Database, id: number): Promise<void> {
    await db.prepare('DELETE FROM availability_logs WHERE title_id = ?').bind(id).run();
    await db.prepare('DELETE FROM titles WHERE id = ?').bind(id).run();
  }
  ```

---

### 3. Post-Import Disambiguation
**Problem:** After bulk import (especially IMDb lists), some titles might match wrong versions

**Solution:**
- After import, show "Review Ambiguous Matches" step
- Display titles that have multiple possible matches or common ambiguities
- Let user confirm or switch to different version

**UI Flow:**
```
Import Complete!
✓ 45 titles added
⚠️  5 titles need review

Review Ambiguous Matches:
───────────────────────────
"The Office"
  Currently tracking: The Office (2005) - US
  Did you mean:
    [ ] The Office (2001) - UK
    [✓] Keep current (2005) - US

[Continue] [Skip Review]
```

**Implementation:**
- Backend: When importing, if search returns multiple results with same base name, flag as ambiguous
- Store ambiguous flag in database or return in sync response
- Frontend: Show disambiguation modal after import completes
- Allow swapping: delete old entry, add new one with correct ID

---

## Implementation Priority

1. **Remove Title** (easiest, immediate value)
   - Backend: ~20 lines
   - Frontend: Add button, confirmation dialog
   - **Estimate:** 30 minutes

2. **Search Before Import** (medium effort, prevents issues)
   - Frontend: New search component
   - Backend: Separate search endpoint (optional - can use client-side)
   - **Estimate:** 2-3 hours

3. **Post-Import Disambiguation** (more complex)
   - Requires detecting ambiguous matches
   - Additional UI state management
   - **Estimate:** 4-6 hours

---

## Related Improvements

### Better Search in JustWatch
Currently using `searchTitle()` which only returns first result. Options:
1. Return all search results (up to 5)
2. Include year/country in search query to be more specific
3. Let user filter by type (movie vs tv)

### Bulk Remove
For cleaning up large import mistakes:
- Checkboxes on title list
- "Remove Selected" bulk action
- Useful after accidentally importing wrong list

### Edit Title Metadata
If JustWatch data is wrong:
- Allow manual override of poster_url
- Allow manual override of full_path
- Mark as "manually edited" to prevent overwrites

---

## Questions to Consider

1. **Remove confirmation:** Should we require typing title name to confirm, or is checkbox enough?
2. **Undo remove:** Should we soft-delete with 30-day restore window?
3. **Search performance:** Should we cache JustWatch search results? How long?
4. **Disambiguation threshold:** When do we consider a match "ambiguous"? Same base title + year difference?
