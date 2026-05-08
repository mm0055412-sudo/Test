# **App Name**: Global Bazar

## Core Features:

- Location Onboarding: Guide new users to select their country and state/region, automatically setting the appropriate language and currency.
- Profile Setup: Allow users to register an account using their mobile number as a unique identifier, facilitating data synchronization across devices.
- Real-time Data Sync: Automatically sync and store user data, including market lists and preferences, to Firebase Firestore using the mobile number as a key for cross-device access and backup.
- Smart Item Suggestions: As the user types an item, generate a list of relevant grocery items that may match their text, saving them keystrokes and improving the experience. LLM acts as a tool for generating possible items to select.  This could include images.
- Market List Management: Enable users to create and manage shopping lists, mark items as bought, and view the total amount spent.
- Spending Reports: Generate reports on spending habits, including daily, monthly, and historical data up to 125 days, with options to filter by month or date.
- Settings Customization: Allow users to modify their location settings and apply these changes to their profile.

## Style Guidelines:

- Primary color: Sky blue (#007AFF), inspired by the original app design and evoking a sense of trust and efficiency. 
- Background color: Light gray (#F2F2F7), creating a clean and modern backdrop for the app's content.
- Accent color: Violet (#5856D6), used sparingly for interactive elements, to draw attention and guide the user. 
- Body and headline font: 'Inter' (sans-serif), for a modern, neutral, machined look; good for headlines or body text.
- Use simple, outlined icons to represent different categories of items and actions, maintaining a consistent and clean aesthetic.
- Maintain a consistent layout across all screens, using cards to group related information and a clear visual hierarchy to guide the user's eye.
- Use subtle animations and transitions to provide feedback to user interactions and enhance the app's usability, such as when adding or deleting items from a list.