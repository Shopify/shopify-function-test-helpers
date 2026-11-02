---
"@shopify/shopify-function-test-helpers": patch
---

`getFunctionInfo` reads the output of Shopify CLI 5's `app function info --json`, which nests the info under `function` and lists targets as an array. It still returns the earlier shape, with `targeting` keyed by target, so tests built on it keep working.
