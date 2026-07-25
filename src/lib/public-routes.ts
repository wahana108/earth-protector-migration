// Rute yang boleh diakses tanpa login — dipakai bersama oleh middleware.ts
// (gerbang redirect) dan use-auth.tsx (gerbang AuthLoader) agar tidak
// menyimpang satu sama lain.
export const PUBLIC_ROUTES = ["/", "/help", "/login", "/signup"];
