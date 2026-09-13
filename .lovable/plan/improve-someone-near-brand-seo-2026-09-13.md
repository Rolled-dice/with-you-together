# Improve “someone near” brand SEO

## Changes
- Add reusable Organization structured data with `alternateName` values “Someone Near” and “Someone Near App”.
- Update homepage title, description, social metadata, canonical URL, and page URL to naturally connect SomeoneNear with “someone near”.
- Refine the homepage heading and supporting copy while preserving the calm brand voice.
- Add an accessible, descriptive homepage illustration using a search-friendly filename, useful alt text, fixed dimensions, and eager loading for the first screen.
- Keep sitewide metadata limited to true defaults and remove the sitewide share image that does not match every page.

## Verification
- Check the rendered document head and structured data.
- Confirm one clear H1 and accessible image output.
- Check desktop and mobile rendering and confirm a clean build.

## Technical details
- Use TanStack Router `head()` metadata, not Next.js APIs, because this project uses TanStack Start.
- Render the reusable JSON-LD component in the root document head.
