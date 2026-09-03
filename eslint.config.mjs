import { FlatCompat } from "@eslint/eslintrc";
import nextVitals from "eslint-config-next/core-web-vitals.js";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.config(nextVitals),
  { ignores: [".next/**", "node_modules/**", "coverage/**"] },
];
