Please implement a complete, feature-rich, and highly performant market list and expense tracking application with the following specifications.

**1. Core Application Logic (Market List & Expense Tracking):**
   - The application should allow users to create, manage, and track market lists.
   - Users can add items with details like name, quantity, rate, and price.
   - An advanced calculator must be available for each item to compute price from rate/quantity, quantity from price/rate, or rate from price/quantity, supporting various units (kg, gm, pc, etc.).
   - Items can be marked as "bought," which affects total spending calculations.
   - Users can generate and view detailed bills for each list.
   - Comprehensive reporting features must be available, allowing users to view spending summaries by day, month, year, or for all time.
   - Users should be able to create new lists and add items directly from summary pages (e.g., "All Items for Today"). If a list for the current day does not exist, the user should be prompted to create a new list with a custom name.

**2. Full Localization and Internationalization:**
   - The application must support a wide range of languages with their specific number systems. All text and numbers across the entire app must be translated and formatted correctly when a language is selected.
   - All localization data (translations, country info, number systems, date formats) must be consolidated into a single, well-organized file: `src/lib/countries.ts`.
   - The required languages and their number systems are:
     - **Indian Languages (for India):** Assamese (as), Bengali (bn), Bodo (brx), Dogri (doi), Gujarati (gu), Hindi (hi), Kannada (kn), Kashmiri (ks), Konkani (kok), Maithili (mai), Malayalam (ml), Manipuri (mni), Marathi (mr), Nepali (ne), Odia (or), Punjabi (pa), Sanskrit (sa), Santali (sat), Sindhi (sd), Tamil (ta), Telugu (te), Urdu (ur).
     - **Chinese Languages (for China, USA):** Mandarin (zh), Cantonese (yue), Wu (wuu).
     - **Other Languages:** Arabic (ar), English (en), Spanish (es), French (fr), German (de), Russian (ru), Tatar (tt), Bashkir (ba), Bhojpuri (bho), Sinhala (si).
   - Ensure the `countries.ts` file is fully populated with all necessary configurations.

**3. User Experience (UX) and Interface (UI) Enhancements:**
   - **Smooth Transitions:** All interactive elements (buttons, cards, links) must have smooth transitions (`transition-all`, `transition-colors`) and active states (e.g., `active:scale-[.98]`) to provide a fluid, modern feel.
   - **Profile Picture Viewer:** On both the Home page and the Settings page, clicking the user's profile picture must open a dialog (modal) to display the full-size image. This feature must be fully accessible, including a visually hidden title for screen readers.
   - **Persistent Scroll Position:**
     - When a user navigates from the "Reports" page or the "Home" page to view a specific list and then returns, the scroll position must be preserved, returning the user to the exact point they left off.
     - This functionality must also work correctly if the user refreshes the page while on the "Home" or "Reports" page. Use URL hashes (`#`) to mark and scroll to the relevant sections (`#history-section` or list-specific IDs).
   - **Multi-select & Bulk Actions:** Users should be able to select multiple items or lists to perform bulk actions like copying or deleting, with clear visual feedback on the number of selected items.

**4. Performance and Data Management:**
   - **Fast Data Loading with Caching:** Implement an efficient client-side caching mechanism using **IndexedDB** (via the `idb` library).
     - On app startup or refresh, data should first be loaded instantly from the local IndexedDB cache to ensure a fast initial render.
     - Subsequently, the app should fetch the latest data from the Firebase Realtime Database in the background and update both the UI and the local cache.
     - The IndexedDB database must be properly versioned and structured with a keyPath to avoid data access errors.
     - All user data, including market lists and configuration, should be stored in Firebase Realtime Database, keyed by the user's phone number.

**5. User Authentication and Profile Management:**
   - User identity should be tied to their mobile number.
   - The settings page should allow users to update their name and profile picture.

Ensure all code is clean, well-organized, and follows best practices for a production-ready Next.js application. All existing functionality and fixes must be preserved.
