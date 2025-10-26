# **App Name**: Earth Firebase Sanctuary

## Core Features:

- NFT Exploration and Trading: Allow users to explore, buy, and sell NFTs, filtering by categories and applying search.
- User Authentication: Implement user registration, login, and logout using Firebase Authentication.
- NFT 'Like' System: Enable users to 'like' NFTs. Store 'likes' in a subcollection within each NFT document, and the NFT 'likes' count shall be updated automatically with an atomic transaction. Firestore Triggers will be set up to automate counting the likes using an automatically triggered Cloud Function.
- Community Validation: Implement an NFT validation system where users can vote on the validity of an NFT. After some number of votes for an NFT are collected, automatically recompute an NFT's is-valid flag by triggering a Firebase Cloud Function to tally the vote counts, which shall also update the NFT.
- NFT Recommendation System: Implement a tool to display personalized NFT recommendations (using an LLM) and top vendors.  Data should come from a Cloud Function to pre-compute which vendors and NFTs should be surfaced.
- Buyback System: Allow the creators of NFTs to set up a two-way buyback system for when a current owner may want to sell back directly to the original creator. A Cloud Function implements all the buyback business logic (since the process is complex) when the buyback occurs.
- Top Developer Ranking: Rank developers based on contribution metrics, calculated with a tool using the data available, using Firestore.

## Style Guidelines:

- Primary color: Forest green (#4CAF50) to reflect the environmental focus of the app.
- Background color: Very light green (#F1F8E9), near white, providing a clean and natural feel.
- Accent color: Earthy brown (#795548), analogous to green, for highlighting key elements and CTAs.
- Headline font: 'Playfair', a serif font with high-contrast thin-thick lines to lend an elegant, high-end feel. Body font: 'PT Sans', to ensure readability.
- Use clean and modern icons related to nature, sustainability, and digital assets.
- Employ a grid-based layout for NFT listings and user profiles.
- Use subtle transitions and animations when loading data or interacting with NFTs.