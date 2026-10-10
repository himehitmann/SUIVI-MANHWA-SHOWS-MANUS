# Durable synchronization — 2026-09-09

Automatic extension sync now combines the existing short delay with a Chrome alarm every five minutes. The alarm is checked and recreated at service-worker startup if missing. Failed requests retain local data and use persisted exponential backoff, capped at fifteen minutes. Simultaneous automatic triggers share one request sequence. Successful synchronization clears the retry state.

Validation: full suite passed with 169 tests before adding the simultaneous-trigger regression; the targeted extension suite covers that additional case. The packaged extension passed real Chromium journeys, alarm registration, OCR and persistent-profile upgrade. Chrome may delay alarms, and they do not wake a sleeping computer: no exact delivery time is promised.

Primary reference: https://developer.chrome.com/docs/extensions/reference/api/alarms

Overall specification completion estimate: 47%. Production hosting, comprehensive discovery and source coverage, detailed episode/chapter history, more advanced list operations, and managed complex-manga translation remain outstanding.
