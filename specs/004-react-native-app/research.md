# Phase 0: Research & Decisions

## 1. Mobile Framework

- **Decision**: React Native with Expo (specifically Expo Router).
- **Rationale**: The team is already using React for the web client. Expo simplifies the mobile development lifecycle, handles native module linking automatically, and Expo Router provides a file-based routing system similar to Next.js or modern web routers.
- **Alternatives considered**: 
  - **Flutter/Dart**: Rejected because it introduces a new language (Dart) to a TS-heavy team.
  - **Swift/Kotlin Native**: Rejected because it requires maintaining two separate codebases.
  - **React Native CLI**: Rejected because it requires significantly more manual configuration and native IDE knowledge (Xcode/Android Studio) compared to Expo.

## 2. Styling Solution

- **Decision**: Custom `StyleSheet` mappings of `DESIGN.md` tokens.
- **Rationale**: Since `DESIGN.md` explicitly lists a set of highly curated design tokens (Sage canvas, Lime green CTA, 24px border radii), we will create a `theme.ts` file in the mobile app that strictly exposes these exact tokens to standard React Native `StyleSheet` objects or styled components.
- **Alternatives considered**: 
  - **NativeWind (Tailwind for RN)**: While powerful, setting up custom tokens in NativeWind can sometimes be complex and unnecessary if the design system is small and rigid. We can use it if desired, but a simple theme object is less error-prone for a strict design system.

## 3. Data Fetching and State Management

- **Decision**: `@tanstack/react-query` with a custom Axios/Fetch client pointing to `api-rust`.
- **Rationale**: Aligns perfectly with the web client's architecture, allowing developers to easily switch context between `client` and `mobile`.
- **Alternatives considered**: Apollo GraphQL (rejected, API is REST), Redux Toolkit (overkill for simple API fetching).

## 4. Social Authentication

- **Decision**: Use `expo-auth-session` for OAuth flows (Google, Apple, etc.) combined with our custom NestJS backend's `/api/v1/auth/{provider}-auth` endpoints.
- **Rationale**: `expo-auth-session` works seamlessly in both Expo Go and Development Builds without requiring custom native code linking for most web-based OAuth providers. It allows us to retrieve an access token or ID token from the provider and pass it securely to our NestJS backend for verification and JWT issuance.
- **Alternatives considered**: 
  - `@react-native-google-signin/google-signin`: Requires a custom Dev Build (will not work in Expo Go out of the box), making it harder for quick prototyping, though it offers a more native UX. We will default to `expo-auth-session` for broader compatibility.
