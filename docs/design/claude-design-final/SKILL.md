---
name: smart-expense-ai-design
description: Use this skill to generate well-branded interfaces and assets for Smart Expense - AI, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Notes specific to this system: Arabic is the only UI language and layout is RTL (mirror layout, keep dates/emails/technical values isolated `dir="ltr"` — this fixes known issue F-001). Light mode only. Primary accent is emerald `#0F7A5C`; income is green, expense is red, pending is amber, informational is blue — color never carries meaning alone. No logo was provided (wordmark only) and fonts are Google-Fonts-hosted Tajawal/IBM Plex Sans Arabic substitutes — flag both if the user has real assets to swap in.
