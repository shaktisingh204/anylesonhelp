# **App Name**: S3 Explorer

## Core Features:

- Folder Selection: Dynamically list and navigate folders and subfolders from an S3 bucket using a dropdown and navigation links.
- File Listing: Display video files (mp4, mov, mkv, avi, webm) with cleaned names, S3 URLs, and human-readable sizes.
- Single Folder Excel Export: Export the currently displayed video file information (Name, URL, Size) to an Excel file.
- Recursive Excel Export: Recursively list all subfolders and generate Excel files for each subfolder, containing video details, upon the user pressing 'Export All'.
- Loading State: Display a loading spinner during data fetching and Excel export processes.
- Dynamic Deep File display: Use AI as a tool, to generate all possible video previews. The AI tool decides when or if the video preview matches one that actually exists, incorporating or rejecting it accordingly, resulting in a full and dynamic view.
- Error Handling: Provide user-friendly error messages if S3 connection fails or no videos are found, displayed as front-end notifications.

## Style Guidelines:

- Primary color: Deep teal (#008080) to give a sense of stability and security, aligned with cloud services.
- Background color: Light teal (#E0F8F7), a desaturated shade of the primary color to keep a cohesive look and feel.
- Accent color: Soft Orange (#D98880) used for interactive elements to provide a warm contrast against the teal backdrop.
- Body and headline font: 'Inter', a sans-serif font, will be used for both headings and body text to ensure a clean, modern and easily readable aesthetic. 
- Code font: 'Source Code Pro' will be used for any displayed code snippets in the app
- Simple and clear icons for folder navigation and file actions. Favor outline style icons.
- Subtle transition animations for folder navigation and file loading.