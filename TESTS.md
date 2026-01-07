# Browser Test Scenarios

Automated test scenarios for StreamTrack using the browser MCP tool. These tests are written in plain English and can be executed autonomously by Claude without user intervention.

## Test Execution

**Prerequisites:**
- Frontend deployed to: `https://dylanrichardson.github.io/tv-streaming-availability-tracker/`
- API available at: `https://streamtrack-api.dylanrichardson1996.workers.dev`

**How to run:**
- Use browser MCP tool (`mcp__browsermcp__*`) to interact with the frontend
- Combine with API calls (`curl`) to verify backend state
- Check logs with `cd worker && npx wrangler tail` when debugging failures

---

## Test Scenarios

### 1. Basic Page Load

**Test:** Site loads successfully and displays correct navigation

**Steps:**
1. Navigate to `https://dylanrichardson.github.io/tv-streaming-availability-tracker/`
2. Verify page title is "frontend"
3. Verify header shows "TV Streaming Availability Tracker"
4. Verify navigation has "My Watchlist" and "Analytics" links
5. Verify main content shows "My Watchlist" heading

**Expected:**
- All UI elements render correctly
- No console errors
- Page is interactive

---

### 2. Empty State Display

**Test:** Empty watchlist shows appropriate messaging

**Steps:**
1. Navigate to watchlist page (should be default)
2. Verify "0 titles tracked" message appears
3. Verify "+ Import Titles" button is visible
4. Verify "No titles in your watchlist yet" message appears
5. Verify "Import Your First Titles" button is visible

**Expected:**
- User sees clear call-to-action to import titles
- UI gracefully handles empty state

---

### 3. Import Modal Opens

**Test:** Import modal displays when clicking import button

**Steps:**
1. Navigate to watchlist page
2. Click "+ Import Titles" button
3. Verify modal appears with heading "Import Titles"
4. Verify instructions text is present
5. Verify textarea is present with placeholder text
6. Verify "Cancel" and "Import" buttons are visible

**Expected:**
- Modal overlays the page
- Form is ready to accept input

---

### 4. Import Titles Flow (Success Path)

**Test:** User can successfully import titles that exist in JustWatch

**Prerequisites:** JustWatch API must be working

**Steps:**
1. Navigate to watchlist page
2. Click "+ Import Titles" button
3. Type into textarea: "The Matrix\nBreaking Bad\nSuccession"
4. Click "Import" button
5. Wait for processing (modal should show results)
6. Verify success message shows "X created"
7. Click "Done" button
8. Verify watchlist now shows the imported titles

**Expected:**
- Titles are successfully resolved and imported
- UI updates to show titles in watchlist
- Each title shows current availability status

**API Verification:**
```bash
curl https://streamtrack-api.dylanrichardson1996.workers.dev/api/titles | jq '.[] | {name, type}'
```

---

### 5. Import Titles Flow (Not Found)

**Test:** UI handles titles that cannot be found in JustWatch

**Steps:**
1. Navigate to watchlist page
2. Click "+ Import Titles" button
3. Type into textarea: "Made Up Movie XYZ123\nFake Show ABC789"
4. Click "Import" button
5. Wait for processing
6. Verify results show "Not Found" status for each title
7. Verify message says "0 created"
8. Click "Done" button
9. Verify watchlist remains empty

**Expected:**
- User is clearly informed which titles couldn't be found
- No partial imports (all-or-nothing isn't required, but failures are clear)
- Watchlist accurately reflects successful imports only

---

### 6. Import Modal Cancel

**Test:** User can cancel import without submitting

**Steps:**
1. Navigate to watchlist page
2. Click "+ Import Titles" button
3. Type something into textarea
4. Click "Cancel" button
5. Verify modal closes
6. Verify watchlist hasn't changed

**Expected:**
- Modal dismisses without making API call
- No side effects

---

### 7. Analytics Page (Empty State)

**Test:** Analytics page displays correctly when no data exists

**Steps:**
1. Navigate to Analytics page (click "Analytics" link)
2. Verify heading "Analytics" appears
3. Verify subtitle about tracking coverage
4. Verify "No coverage data yet" message
5. Verify "Buy Recommendations" section exists
6. Verify dropdown has time range options (1/3/6/12 months)
7. Verify "No purchase recommendations" message when empty

**Expected:**
- Page loads without errors
- Empty state is informative
- UI elements are properly styled

---

### 8. Analytics Page (With Data)

**Test:** Analytics displays charts and recommendations when data exists

**Prerequisites:** Titles imported + daily check has run

**Steps:**
1. Navigate to Analytics page
2. Verify coverage chart displays (should show service trends over time)
3. Verify chart has legend for each streaming service
4. Verify "Buy Recommendations" section shows titles (if any meet criteria)
5. Change dropdown to different time ranges (1/3/6/12 months)
6. Verify recommendations update based on selection

**Expected:**
- Chart renders with correct data
- Recommendations filtered by selected time range
- Data matches what API returns

**API Verification:**
```bash
curl https://streamtrack-api.dylanrichardson1996.workers.dev/api/stats/services | jq
curl https://streamtrack-api.dylanrichardson1996.workers.dev/api/recommendations?months=3 | jq
```

---

### 9. Title Detail View

**Test:** Clicking on a title shows availability history

**Prerequisites:** At least one title imported with history

**Steps:**
1. Navigate to watchlist page (should show titles)
2. Click on a title card/row
3. Verify detail view opens or navigates to detail page
4. Verify title name and metadata displayed
5. Verify availability timeline/gantt chart shows
6. Verify timeline shows which services had the title over time
7. Verify timeline dates are accurate

**Expected:**
- Detail view provides comprehensive history
- Timeline is visually clear
- User can navigate back to watchlist

**API Verification:**
```bash
# Get title ID first
ID=$(curl -s https://streamtrack-api.dylanrichardson1996.workers.dev/api/titles | jq '.[0].id')
curl https://streamtrack-api.dylanrichardson1996.workers.dev/api/history/$ID | jq
```

---

### 10. Navigation Between Pages

**Test:** User can navigate between Watchlist and Analytics

**Steps:**
1. Start on Watchlist page
2. Click "Analytics" link
3. Verify URL changes to `/analytics`
4. Verify Analytics page content displays
5. Click "My Watchlist" link
6. Verify URL changes back to root
7. Verify Watchlist content displays

**Expected:**
- Navigation works without full page reload (SPA behavior)
- URLs update correctly
- Back/forward browser buttons work

---

### 11. Manual Availability Check Trigger

**Test:** User can manually trigger availability check

**Note:** This may be an admin/debug feature not in production UI

**Steps:**
1. Use API directly: `curl -X POST https://streamtrack-api.dylanrichardson1996.workers.dev/api/trigger-check`
2. Verify response indicates check started
3. Check worker logs to see check running
4. After completion, verify database has new availability_logs entries
5. Refresh frontend and verify data updated

**Expected:**
- Check runs successfully
- Logs written to database
- Frontend reflects new data after refresh

---

### 12. Error Handling - API Unavailable

**Test:** UI gracefully handles API being down

**Steps:**
1. Temporarily modify frontend config to point to invalid API URL (or test with API actually down)
2. Navigate to watchlist
3. Verify error message displays instead of crash
4. Navigate to Analytics
5. Verify error message displays instead of crash
6. Try to import titles
7. Verify user-friendly error message

**Expected:**
- No white screen of death
- Error messages are helpful
- User can recover without refreshing

---

### 13. Responsive Design (Mobile)

**Test:** Site works on mobile viewport

**Steps:**
1. Navigate to site
2. Resize browser to mobile width (375px)
3. Verify navigation is accessible (hamburger menu or stacked)
4. Verify import modal is usable
5. Verify charts scale appropriately
6. Verify touch targets are large enough

**Expected:**
- Site is fully functional on mobile
- No horizontal scrolling
- Text is readable

---

### 14. JustWatch API Integration

**Test:** Verify JustWatch API is being called correctly

**Steps:**
1. Import a known title like "The Matrix"
2. Check worker logs: `cd worker && npx wrangler tail`
3. Verify logs show JustWatch API request
4. Verify response includes title metadata
5. Verify poster image URL is present
6. Verify availability data is retrieved

**Expected:**
- API calls succeed
- Data is parsed correctly
- Errors are logged if API fails

**Manual API Test:**
```bash
curl -X POST "https://apis.justwatch.com/content/titles/en_US/popular" \
  -H "Content-Type: application/json" \
  -d '{"query":"The Matrix","page":1,"page_size":5,"content_types":["movie","show"]}'
```

---

### 15. Database State Verification

**Test:** Verify database reflects UI state

**Prerequisites:** Some titles imported

**Steps:**
1. Import titles via UI
2. Check database: `npx wrangler d1 execute streamtrack --remote --command "SELECT * FROM titles"`
3. Verify each imported title has correct:
   - name
   - type (movie/show)
   - justwatch_id
   - poster_url
4. Verify services table has expected streaming services
5. Verify availability_logs has entries after daily check

**Expected:**
- Database structure matches schema
- Data integrity maintained
- Foreign keys correctly linked

---

## Notes for Claude

**When running these tests:**
- Execute browser actions using MCP tools
- Take screenshots when verification is needed
- Check console logs: `mcp__browsermcp__browser_get_console_logs`
- Combine browser tests with API curl calls for full verification
- If a test fails, check worker logs with `npx wrangler tail`
- Query database when debugging data issues

**Test execution tips:**
- Run tests in order (empty state before populated state)
- Reset database between full test runs if needed
- Some tests depend on others (e.g., test 8 needs titles from test 4)
- Screenshot failures for debugging

**Common issues to watch for:**
- JustWatch API changes (unofficial API may break)
- CORS errors (check browser console)
- Stale data (may need to refresh or trigger check)
- Rate limiting (JustWatch may throttle requests)
